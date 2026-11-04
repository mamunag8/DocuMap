import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { useVault } from '../store/VaultContext';
import {
  LogEntry,
  LogFieldColumn,
  LogFieldType,
  LogSchema,
  VaultNode,
} from '../models/types';
import { serializeLogToCsv } from '../core/linkAndTokenEngine';
import { WikiLinkAutocompleteSheet } from './WikiLinkAutocompleteSheet';
import { BacklinksAndMiniGraphTray } from './BacklinksAndMiniGraphTray';

interface DataLogStudioModalProps {
  visible: boolean;
  node: VaultNode | null;
  onClose: () => void;
  onSwitchToNode: (target: VaultNode) => void;
}

const COLUMN_TYPES: LogFieldType[] = [
  'TEXT',
  'NUMBER',
  'CURRENCY',
  'DATE',
  'DROPDOWN',
  'WIKI_LINK',
  'ATTACHED_SCAN_ID',
];

export const DataLogStudioModal: React.FC<DataLogStudioModalProps> = ({
  visible,
  node,
  onClose,
  onSwitchToNode,
}) => {
  const { theme } = useAppTheme();
  const {
    nodes,
    logSchemas,
    logEntries,
    createOrUpdateNode,
    getConnectedNeighbors,
    packNodeWithFirstDegreeLinks,
    deleteNodeById,
  } = useVault();

  const [title, setTitle] = useState<string>('');
  const [tagsInput, setTagsInput] = useState<string>('');
  const [columns, setColumns] = useState<LogFieldColumn[]>([]);
  const [rows, setRows] = useState<LogEntry[]>([]);
  const [schemaBuilderOpen, setSchemaBuilderOpen] = useState<boolean>(false);
  const [showRawCsvJson, setShowRawCsvJson] = useState<'NONE' | 'CSV' | 'JSON'>('NONE');

  // New Column Builder State
  const [newColName, setNewColName] = useState<string>('');
  const [newColType, setNewColType] = useState<LogFieldType>('TEXT');
  const [newColDropdownOpts, setNewColDropdownOpts] = useState<string>('Option A, Option B, Option C');

  // Row-level [[Wiki-Link]] or Attached Scan Picker State
  const [wikiPickerTarget, setWikiPickerTarget] = useState<{
    rowId: string;
    columnId?: string;
    mode: 'CELL_WIKI' | 'ROW_NOTE' | 'ROW_SCAN';
  } | null>(null);

  useEffect(() => {
    if (!node) return;
    setTitle(node.title);
    setTagsInput(node.tags.join(', '));

    const existingSchema = logSchemas.find((s) => s.node_id === node.id);
    const existingRows = logEntries.filter((e) => e.node_id === node.id);

    if (existingSchema) {
      setColumns(existingSchema.columns.map((c) => ({ ...c })));
    } else {
      setColumns([
        { id: 'col_date', name: 'Date', type: 'DATE', required: true },
        { id: 'col_item', name: 'Item / Metric', type: 'TEXT', required: true },
        {
          id: 'col_category',
          name: 'Category',
          type: 'DROPDOWN',
          dropdown_options: ['Compute', 'Optics', 'Storage', 'Field Test'],
        },
        { id: 'col_cost', name: 'Amount', type: 'CURRENCY', currency_symbol: '$' },
        { id: 'col_wiki', name: 'Wiki Reference', type: 'WIKI_LINK' },
      ]);
    }

    setRows(
      existingRows.map((r) => ({
        ...r,
        values: { ...r.values },
      }))
    );
  }, [node, logSchemas, logEntries]);

  /**
   * Computes automatic column totals for CURRENCY and NUMBER columns
   */
  const numericTotals = useMemo(() => {
    const totals: Record<string, { sum: number; avg: number; symbol: string }> = {};
    for (const col of columns) {
      if (col.type === 'CURRENCY' || col.type === 'NUMBER') {
        const nums = rows
          .map((r) => Number(r.values[col.id]))
          .filter((val) => !Number.isNaN(val));
        const sum = nums.reduce((acc, v) => acc + v, 0);
        const avg = nums.length > 0 ? sum / nums.length : 0;
        totals[col.id] = {
          sum,
          avg,
          symbol: col.type === 'CURRENCY' ? col.currency_symbol ?? '$' : '',
        };
      }
    }
    return totals;
  }, [columns, rows]);

  if (!visible || !node) return null;

  const neighbors = getConnectedNeighbors(node.id);
  const scanNodes = nodes.filter((n) => n.type === 'SCAN');

  /**
   * Builds a clean Markdown summary from the structured table so FTS5 search,
   * [[Wiki-Links]], and AI Packer index every row automatically
   */
  const buildCompanionMarkdownFromTable = (
    currentTitle: string,
    cols: LogFieldColumn[],
    entries: LogEntry[],
    tagsArr: string[]
  ): string => {
    const linkedTitles = new Set<string>();
    for (const entry of entries) {
      if (entry.attached_scan_id) {
        const sn = nodes.find((n) => n.id === entry.attached_scan_id);
        if (sn) linkedTitles.add(`[[${sn.title}]]`);
      }
      if (entry.linked_note_id) {
        const nn = nodes.find((n) => n.id === entry.linked_note_id);
        if (nn) linkedTitles.add(`[[${nn.title}]]`);
      }
      for (const val of Object.values(entry.values)) {
        if (typeof val === 'string' && val.includes('[[')) {
          linkedTitles.add(val);
        }
      }
    }

    const headerRow = `| ${cols.map((c) => c.name).join(' | ')} |`;
    const dividerRow = `| ${cols.map(() => ':---').join(' | ')} |`;
    const bodyRows = entries.map((e) => {
      const cells = cols.map((c) => {
        const v = e.values[c.id];
        if (v === null || v === undefined || v === '') return '—';
        if (c.type === 'CURRENCY') {
          return `${c.currency_symbol ?? '$'}${Number(v).toFixed(2)}`;
        }
        return String(v);
      });
      return `| ${cells.join(' | ')} |`;
    });

    const tagsFooter = tagsArr.map((t) => `#${t}`).join(' ');

    return [
      `# Structured Data Log: ${currentTitle}`,
      `**Portable Files:** \`${node.file_path}\` & \`.json\``,
      linkedTitles.size > 0
        ? `**Connected Documents:** ${Array.from(linkedTitles).join(' | ')}`
        : '',
      '',
      headerRow,
      dividerRow,
      ...bodyRows,
      '',
      tagsFooter,
    ]
      .filter(Boolean)
      .join('\n');
  };

  const persistDataLogChanges = async (
    nextCols = columns,
    nextRows = rows,
    nextTitle = title,
    nextTagsStr = tagsInput
  ) => {
    const nowIso = new Date().toISOString();
    const parsedTags = nextTagsStr
      .split(/[,\s]+/)
      .map((t) => t.replace(/^#+/, '').trim().toLowerCase())
      .filter(Boolean);

    const schemaId =
      logSchemas.find((s) => s.node_id === node.id)?.id ?? `schema-${node.id}`;

    const updatedSchema: LogSchema = {
      id: schemaId,
      node_id: node.id,
      columns: nextCols,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const normalizedRows: LogEntry[] = nextRows.map((r) => ({
      ...r,
      node_id: node.id,
      schema_id: schemaId,
      updated_at: nowIso,
    }));

    const companionMd = buildCompanionMarkdownFromTable(
      nextTitle,
      nextCols,
      normalizedRows,
      parsedTags
    );

    await createOrUpdateNode(
      {
        ...node,
        id: node.id,
        type: 'LOG',
        title: nextTitle.trim() || 'Untitled Data Log',
        content_md: companionMd,
        tags: parsedTags,
      },
      updatedSchema,
      normalizedRows
    );
  };

  const handleAddColumn = () => {
    if (!newColName.trim()) return;
    const colId = `col_${Date.now().toString(36)}`;
    const newCol: LogFieldColumn = {
      id: colId,
      name: newColName.trim(),
      type: newColType,
      currency_symbol: newColType === 'CURRENCY' ? '$' : undefined,
      dropdown_options:
        newColType === 'DROPDOWN'
          ? newColDropdownOpts
              .split(',')
              .map((o) => o.trim())
              .filter(Boolean)
          : undefined,
    };
    const nextCols = [...columns, newCol];
    setColumns(nextCols);
    setNewColName('');
  };

  const handleRemoveColumn = (colId: string) => {
    if (columns.length <= 1) return;
    setColumns(columns.filter((c) => c.id !== colId));
  };

  const applyPresetTemplate = (preset: 'EXPENSE' | 'RESEARCH' | 'INVENTORY') => {
    const today = new Date().toISOString().slice(0, 10);
    if (preset === 'EXPENSE') {
      setColumns([
        { id: 'col_date', name: 'Date', type: 'DATE' },
        { id: 'col_item', name: 'Expense Item', type: 'TEXT' },
        {
          id: 'col_cat',
          name: 'Category',
          type: 'DROPDOWN',
          dropdown_options: ['Compute', 'Optics', 'Storage', 'Cloud/Travel'],
        },
        { id: 'col_cost', name: 'Cost (USD)', type: 'CURRENCY', currency_symbol: '$' },
        { id: 'col_wiki', name: 'Linked Note / Scan', type: 'WIKI_LINK' },
      ]);
    } else if (preset === 'RESEARCH') {
      setColumns([
        { id: 'col_date', name: 'Timestamp', type: 'DATE' },
        { id: 'col_sample', name: 'Sample / Trial ID', type: 'TEXT' },
        { id: 'col_val', name: 'Measured Value', type: 'NUMBER' },
        {
          id: 'col_status',
          name: 'QC Status',
          type: 'DROPDOWN',
          dropdown_options: ['Verified Q1', 'Calibration', 'Anomaly'],
        },
        { id: 'col_wiki', name: 'Protocol Note', type: 'WIKI_LINK' },
      ]);
      if (rows.length === 0) {
        setRows([
          {
            id: `entry-${Date.now()}`,
            node_id: node.id,
            schema_id: `schema-${node.id}`,
            values: {
              col_date: today,
              col_sample: 'NPU-OCR-Trial-01',
              col_val: 99.4,
              col_status: 'Verified Q1',
              col_wiki: '[[Project Budget & Architecture Notes]]',
            },
            attached_scan_id: scanNodes[0]?.id ?? null,
            linked_note_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ]);
      }
    } else {
      setColumns([
        { id: 'col_sku', name: 'Serial / SKU', type: 'TEXT' },
        { id: 'col_asset', name: 'Hardware Asset', type: 'TEXT' },
        { id: 'col_qty', name: 'Qty', type: 'NUMBER' },
        { id: 'col_unit', name: 'Unit Value', type: 'CURRENCY', currency_symbol: '$' },
        { id: 'col_wiki', name: 'Invoice Link', type: 'WIKI_LINK' },
      ]);
    }
    setSchemaBuilderOpen(false);
  };

  const handleAddRow = () => {
    const today = new Date().toISOString().slice(0, 10);
    const defaultValues: Record<string, string | number | null> = {};
    for (const col of columns) {
      if (col.type === 'DATE') defaultValues[col.id] = today;
      else if (col.type === 'CURRENCY' || col.type === 'NUMBER') defaultValues[col.id] = 0;
      else if (col.type === 'DROPDOWN') {
        defaultValues[col.id] = col.dropdown_options?.[0] ?? '';
      } else if (col.type === 'WIKI_LINK') {
        defaultValues[col.id] =
          nodes.find((n) => n.id !== node.id)
            ? `[[${nodes.find((n) => n.id !== node.id)!.title}]]`
            : '';
      } else {
        defaultValues[col.id] = '';
      }
    }

    const newEntry: LogEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      node_id: node.id,
      schema_id: `schema-${node.id}`,
      values: defaultValues,
      attached_scan_id: scanNodes[0]?.id ?? null,
      linked_note_id:
        nodes.find((n) => n.type === 'NOTE')?.id ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setRows([...rows, newEntry]);
  };

  const handleUpdateCellValue = (
    rowId: string,
    col: LogFieldColumn,
    rawVal: string
  ) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        let parsed: string | number | null = rawVal;
        if (col.type === 'NUMBER' || col.type === 'CURRENCY') {
          const num = parseFloat(rawVal.replace(/[^0-9.-]/g, ''));
          parsed = Number.isNaN(num) ? 0 : num;
        }
        return {
          ...r,
          values: {
            ...r.values,
            [col.id]: parsed,
          },
        };
      })
    );
  };

  const handleCycleDropdownValue = (rowId: string, col: LogFieldColumn) => {
    const opts = col.dropdown_options ?? ['Default'];
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const curr = String(r.values[col.id] ?? '');
        const nextIdx = (opts.indexOf(curr) + 1) % opts.length;
        return {
          ...r,
          values: {
            ...r.values,
            [col.id]: opts[nextIdx],
          },
        };
      })
    );
  };

  const handleRemoveRow = (rowId: string) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  };

  const liveCsvPreview = serializeLogToCsv(columns, rows);
  const liveJsonPreview = JSON.stringify(
    {
      title,
      file_path: node.file_path,
      columns,
      entries: rows,
    },
    null,
    2
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={async () => {
        await persistDataLogChanges();
        onClose();
      }}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.studioSheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          {/* Top Studio Header */}
          <View style={styles.topHeader}>
            <View style={styles.topHeaderLeft}>
              <View
                style={[
                  styles.logBadge,
                  {
                    backgroundColor: theme.nodeLogSoft,
                    borderColor: theme.nodeLogBorder,
                  },
                ]}
              >
                <Ionicons name="grid-outline" size={13} color={theme.nodeLog} />
                <Text style={[styles.logBadgeText, { color: theme.nodeLog }]}>
                  STRUCTURED DATA LOG STUDIO (.CSV + .JSON)
                </Text>
              </View>
            </View>

            <View style={styles.topHeaderRight}>
              <TouchableOpacity
                onPress={() => setSchemaBuilderOpen(!schemaBuilderOpen)}
                style={[
                  styles.schemaToggleBtn,
                  {
                    backgroundColor: schemaBuilderOpen
                      ? theme.nodeLogSoft
                      : theme.surfaceElevated,
                    borderColor: schemaBuilderOpen
                      ? theme.nodeLog
                      : theme.cardBorder,
                  },
                ]}
              >
                <Ionicons
                  name="options-outline"
                  size={13}
                  color={schemaBuilderOpen ? theme.nodeLog : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.schemaToggleText,
                    {
                      color: schemaBuilderOpen
                        ? theme.nodeLog
                        : theme.textSecondary,
                    },
                  ]}
                >
                  Columns ({columns.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  await persistDataLogChanges();
                  onClose();
                }}
                style={[
                  styles.doneBtn,
                  { backgroundColor: theme.accentPrimary },
                ]}
              >
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                <Text style={styles.doneBtnText}>Save Log</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Editable Title & Portable Paths */}
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Data Log Title (e.g. Equipment Expense Log)…"
            placeholderTextColor={theme.textMuted}
            style={[styles.titleInput, { color: theme.textPrimary }]}
          />

          <View style={styles.subHeaderBar}>
            <Text
              style={[styles.filePathText, { color: theme.textMuted }]}
              numberOfLines={1}
            >
              {node.file_path} + .json ({rows.length} rows)
            </Text>

            <View style={styles.exportTogglesRow}>
              {(['CSV', 'JSON'] as const).map((fmt) => {
                const active = showRawCsvJson === fmt;
                return (
                  <TouchableOpacity
                    key={fmt}
                    onPress={() =>
                      setShowRawCsvJson(active ? 'NONE' : fmt)
                    }
                    style={[
                      styles.fmtChip,
                      {
                        backgroundColor: active
                          ? theme.accentPrimarySoft
                          : theme.surfaceElevated,
                        borderColor: active
                          ? theme.accentPrimary
                          : theme.cardBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.fmtChipText,
                        {
                          color: active
                            ? theme.accentPrimary
                            : theme.textSecondary,
                        },
                      ]}
                    >
                      .{fmt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <ScrollView
            style={styles.studioScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Collapsible Custom Column Schema Builder */}
            {schemaBuilderOpen && (
              <View
                style={[
                  styles.schemaBox,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.nodeLogBorder,
                  },
                ]}
              >
                <Text style={[styles.schemaBoxTitle, { color: theme.nodeLog }]}>
                  CUSTOM TYPED COLUMN BUILDER & TEMPLATES
                </Text>

                {/* Quick Templates */}
                <View style={styles.presetsRow}>
                  <TouchableOpacity
                    onPress={() => applyPresetTemplate('EXPENSE')}
                    style={[
                      styles.presetBtn,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.presetBtnText, { color: theme.textPrimary }]}>
                      💰 Expense Tracker
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => applyPresetTemplate('RESEARCH')}
                    style={[
                      styles.presetBtn,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.presetBtnText, { color: theme.textPrimary }]}>
                      🔬 Research Metrics
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => applyPresetTemplate('INVENTORY')}
                    style={[
                      styles.presetBtn,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.presetBtnText, { color: theme.textPrimary }]}>
                      📦 Asset Inventory
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Existing Columns Chips */}
                <View style={styles.existingColsWrap}>
                  {columns.map((c) => (
                    <View
                      key={c.id}
                      style={[
                        styles.colChip,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.cardBorder,
                        },
                      ]}
                    >
                      <Text style={[styles.colChipName, { color: theme.textPrimary }]}>
                        {c.name}
                      </Text>
                      <Text style={[styles.colChipType, { color: theme.nodeLog }]}>
                        {c.type}
                      </Text>
                      {columns.length > 1 && (
                        <TouchableOpacity onPress={() => handleRemoveColumn(c.id)}>
                          <Ionicons
                            name="close-circle"
                            size={15}
                            color={theme.danger}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>

                {/* Add New Typed Column Form */}
                <View style={styles.addColForm}>
                  <TextInput
                    value={newColName}
                    onChangeText={setNewColName}
                    placeholder="New Column Name (e.g. Serial Number, Unit Cost)…"
                    placeholderTextColor={theme.textMuted}
                    style={[
                      styles.newColInput,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.cardBorder,
                        color: theme.textPrimary,
                      },
                    ]}
                  />

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.typeSelectRow}
                  >
                    {COLUMN_TYPES.map((t) => {
                      const active = newColType === t;
                      return (
                        <TouchableOpacity
                          key={t}
                          onPress={() => setNewColType(t)}
                          style={[
                            styles.typeOptionPill,
                            {
                              backgroundColor: active
                                ? theme.nodeLog
                                : theme.surface,
                              borderColor: active
                                ? theme.nodeLog
                                : theme.cardBorder,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.typeOptionText,
                              {
                                color: active ? '#FFFFFF' : theme.textSecondary,
                              },
                            ]}
                          >
                            {t}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {newColType === 'DROPDOWN' && (
                    <TextInput
                      value={newColDropdownOpts}
                      onChangeText={setNewColDropdownOpts}
                      placeholder="Comma-separated options: Compute, Optics, Storage"
                      placeholderTextColor={theme.textMuted}
                      style={[
                        styles.newColInput,
                        {
                          backgroundColor: theme.surface,
                          borderColor: theme.cardBorder,
                          color: theme.textPrimary,
                        },
                      ]}
                    />
                  )}

                  <TouchableOpacity
                    onPress={handleAddColumn}
                    style={[
                      styles.addColBtn,
                      { backgroundColor: theme.nodeLog },
                    ]}
                  >
                    <Ionicons name="add-circle-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.addColBtnText}>Add Typed Column</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Raw .CSV or .JSON Portable File Preview if toggled */}
            {showRawCsvJson !== 'NONE' && (
              <View
                style={[
                  styles.rawPreviewBox,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <Text style={[styles.rawPreviewTitle, { color: theme.accentPrimary }]}>
                  LIVE PORTABLE {showRawCsvJson} FILE PAYLOAD (
                  {showRawCsvJson === 'CSV'
                    ? node.file_path
                    : node.file_path.replace(/\.csv$/i, '.json')}
                  )
                </Text>
                <Text style={[styles.rawPreviewCode, { color: theme.textSecondary }]}>
                  {showRawCsvJson === 'CSV' ? liveCsvPreview : liveJsonPreview}
                </Text>
              </View>
            )}

            {/* Live Numeric & Currency Aggregation Summary Bar */}
            {Object.keys(numericTotals).length > 0 && (
              <View
                style={[
                  styles.totalsBar,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.nodeLogBorder,
                  },
                ]}
              >
                {columns
                  .filter((c) => numericTotals[c.id])
                  .map((c) => {
                    const stat = numericTotals[c.id];
                    return (
                      <View key={c.id} style={styles.totalMetricCol}>
                        <Text
                          style={[styles.totalMetricLabel, { color: theme.textMuted }]}
                        >
                          TOTAL {c.name.toUpperCase()}
                        </Text>
                        <Text
                          style={[styles.totalMetricVal, { color: theme.nodeLog }]}
                        >
                          {stat.symbol}
                          {stat.sum.toFixed(2)}{' '}
                          <Text
                            style={[
                              styles.totalMetricAvg,
                              { color: theme.textSecondary },
                            ]}
                          >
                            (avg {stat.symbol}
                            {stat.avg.toFixed(2)})
                          </Text>
                        </Text>
                      </View>
                    );
                  })}
              </View>
            )}

            {/* Interactive Row Cards */}
            {rows.map((row, rIdx) => {
              const attachedScan = row.attached_scan_id
                ? nodes.find((n) => n.id === row.attached_scan_id)
                : null;
              const linkedNote = row.linked_note_id
                ? nodes.find((n) => n.id === row.linked_note_id)
                : null;

              return (
                <View
                  key={row.id}
                  style={[
                    styles.rowCard,
                    {
                      backgroundColor: theme.surfaceElevated,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.rowCardHeader}>
                    <Text style={[styles.rowBadgeText, { color: theme.nodeLog }]}>
                      ROW #{rIdx + 1}
                    </Text>

                    <View style={styles.rowAttachmentsStrip}>
                      {/* Attached Scan Receipt Button */}
                      <TouchableOpacity
                        onPress={() =>
                          setWikiPickerTarget({
                            rowId: row.id,
                            mode: 'ROW_SCAN',
                          })
                        }
                        style={[
                          styles.attachmentChip,
                          {
                            backgroundColor: attachedScan
                              ? theme.nodeScanSoft
                              : theme.surface,
                            borderColor: attachedScan
                              ? theme.nodeScanBorder
                              : theme.cardBorder,
                          },
                        ]}
                      >
                        <Ionicons
                          name="document-text-outline"
                          size={11}
                          color={
                            attachedScan ? theme.nodeScan : theme.textSecondary
                          }
                        />
                        <Text
                          style={[
                            styles.attachmentChipText,
                            {
                              color: attachedScan
                                ? theme.nodeScan
                                : theme.textSecondary,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {attachedScan
                            ? `Scan: ${attachedScan.title}`
                            : '+ Attach Scan'}
                        </Text>
                      </TouchableOpacity>

                      {/* Linked Markdown Note Button */}
                      <TouchableOpacity
                        onPress={() =>
                          setWikiPickerTarget({
                            rowId: row.id,
                            mode: 'ROW_NOTE',
                          })
                        }
                        style={[
                          styles.attachmentChip,
                          {
                            backgroundColor: linkedNote
                              ? theme.nodeNoteSoft
                              : theme.surface,
                            borderColor: linkedNote
                              ? theme.nodeNoteBorder
                              : theme.cardBorder,
                          },
                        ]}
                      >
                        <Ionicons
                          name="create-outline"
                          size={11}
                          color={
                            linkedNote ? theme.nodeNote : theme.textSecondary
                          }
                        />
                        <Text
                          style={[
                            styles.attachmentChipText,
                            {
                              color: linkedNote
                                ? theme.nodeNote
                                : theme.textSecondary,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {linkedNote
                            ? `Note: ${linkedNote.title}`
                            : '+ [[Link Note]]'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleRemoveRow(row.id)}
                        style={styles.removeRowBtn}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={15}
                          color={theme.danger}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Typed Column Fields inside Row */}
                  <View style={styles.fieldsGrid}>
                    {columns.map((col) => {
                      const val = row.values[col.id];

                      if (col.type === 'DROPDOWN') {
                        return (
                          <View key={col.id} style={styles.fieldCell}>
                            <Text
                              style={[
                                styles.fieldLabel,
                                { color: theme.textMuted },
                              ]}
                            >
                              {col.name} (Dropdown)
                            </Text>
                            <TouchableOpacity
                              onPress={() =>
                                handleCycleDropdownValue(row.id, col)
                              }
                              style={[
                                styles.dropdownBtn,
                                {
                                  backgroundColor: theme.surface,
                                  borderColor: theme.cardBorder,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.dropdownBtnText,
                                  { color: theme.textPrimary },
                                ]}
                              >
                                {String(val || col.dropdown_options?.[0] || 'Select')}
                              </Text>
                              <Ionicons
                                name="chevron-down"
                                size={13}
                                color={theme.textSecondary}
                              />
                            </TouchableOpacity>
                          </View>
                        );
                      }

                      if (
                        col.type === 'WIKI_LINK' ||
                        col.type === 'ATTACHED_SCAN_ID'
                      ) {
                        return (
                          <View key={col.id} style={styles.fieldCell}>
                            <Text
                              style={[
                                styles.fieldLabel,
                                { color: theme.textMuted },
                              ]}
                            >
                              {col.name} ([[Wiki-Link]])
                            </Text>
                            <TouchableOpacity
                              onPress={() =>
                                setWikiPickerTarget({
                                  rowId: row.id,
                                  columnId: col.id,
                                  mode: 'CELL_WIKI',
                                })
                              }
                              style={[
                                styles.wikiCellBtn,
                                {
                                  backgroundColor: theme.accentPrimarySoft,
                                  borderColor: theme.accentPrimary,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.wikiCellBtnText,
                                  { color: theme.accentPrimary },
                                ]}
                                numberOfLines={1}
                              >
                                {String(val || 'Tap to Link [[Document]]')}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        );
                      }

                      return (
                        <View key={col.id} style={styles.fieldCell}>
                          <Text
                            style={[
                              styles.fieldLabel,
                              { color: theme.textMuted },
                            ]}
                          >
                            {col.name}{' '}
                            {col.type === 'CURRENCY'
                              ? `(${col.currency_symbol ?? '$'})`
                              : ''}
                          </Text>
                          <TextInput
                            value={
                              val === null || val === undefined
                                ? ''
                                : String(val)
                            }
                            onChangeText={(txt) =>
                              handleUpdateCellValue(row.id, col, txt)
                            }
                            keyboardType={
                              col.type === 'NUMBER' || col.type === 'CURRENCY'
                                ? 'numeric'
                                : 'default'
                            }
                            placeholder={col.name}
                            placeholderTextColor={theme.textMuted}
                            style={[
                              styles.cellInput,
                              {
                                backgroundColor: theme.surface,
                                borderColor: theme.cardBorder,
                                color:
                                  col.type === 'CURRENCY'
                                    ? theme.nodeLog
                                    : theme.textPrimary,
                              },
                            ]}
                          />
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {/* Add New Row Button */}
            <TouchableOpacity
              onPress={handleAddRow}
              style={[
                styles.addRowBtn,
                {
                  backgroundColor: theme.nodeLogSoft,
                  borderColor: theme.nodeLogBorder,
                },
              ]}
            >
              <Ionicons name="add-circle" size={18} color={theme.nodeLog} />
              <Text style={[styles.addRowBtnText, { color: theme.nodeLog }]}>
                + Add New Row to {title}
              </Text>
            </TouchableOpacity>

            {/* #Tags Input */}
            <View style={styles.tagsBox}>
              <Text style={[styles.tagsLabel, { color: theme.textMuted }]}>
                #TAGS (AUTO-CONNECTS THIS DATA LOG TO SHARED PROJECT NOTES & SCANS)
              </Text>
              <TextInput
                value={tagsInput}
                onChangeText={setTagsInput}
                placeholder="project-alpha, finance, hardware"
                placeholderTextColor={theme.textMuted}
                style={[
                  styles.tagsInput,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.cardBorder,
                    color: theme.textPrimary,
                  },
                ]}
              />
            </View>

            {/* Collapsible Backlinks Footer & Mini 1-Hop Local Graph */}
            <BacklinksAndMiniGraphTray
              currentNode={node}
              neighbors={neighbors}
              onNavigateToNode={async (target) => {
                await persistDataLogChanges();
                onSwitchToNode(target);
              }}
              onPackNeighborhoodForAi={async (targetId) => {
                await persistDataLogChanges();
                onClose();
                packNodeWithFirstDegreeLinks(targetId);
              }}
            />
          </ScrollView>

          {/* Bottom Bar */}
          <View
            style={[
              styles.bottomBar,
              { borderTopColor: theme.divider },
            ]}
          >
            <Text style={[styles.bottomHint, { color: theme.textMuted }]}>
              Auto-syncs both .CSV & .JSON in DocuMap_Vault/Logs/
            </Text>
            <TouchableOpacity
              onPress={async () => {
                await deleteNodeById(node.id);
                onClose();
              }}
              style={[
                styles.deleteBtn,
                { backgroundColor: theme.dangerSoft },
              ]}
            >
              <Ionicons name="trash-outline" size={16} color={theme.danger} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Instant [[ Bottom-Sheet Node Linker for Row Cells or Attached Scans/Notes */}
      <WikiLinkAutocompleteSheet
        visible={Boolean(wikiPickerTarget)}
        excludeNodeId={node.id}
        nodes={
          wikiPickerTarget?.mode === 'ROW_SCAN'
            ? nodes.filter((n) => n.type === 'SCAN')
            : nodes
        }
        titleLabel={
          wikiPickerTarget?.mode === 'ROW_SCAN'
            ? 'Attach Scanned Receipt / PDF to Row'
            : 'Link Row to [[Vault Document]]'
        }
        onSelectNode={(selected) => {
          if (!wikiPickerTarget) return;
          setRows((prev) =>
            prev.map((r) => {
              if (r.id !== wikiPickerTarget.rowId) return r;
              if (wikiPickerTarget.mode === 'ROW_SCAN') {
                return { ...r, attached_scan_id: selected.id };
              }
              if (wikiPickerTarget.mode === 'ROW_NOTE') {
                return { ...r, linked_note_id: selected.id };
              }
              if (
                wikiPickerTarget.mode === 'CELL_WIKI' &&
                wikiPickerTarget.columnId
              ) {
                return {
                  ...r,
                  values: {
                    ...r.values,
                    [wikiPickerTarget.columnId]: `[[${selected.title}]]`,
                  },
                };
              }
              return r;
            })
          );
          setWikiPickerTarget(null);
        }}
        onClose={() => setWikiPickerTarget(null)}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 7, 15, 0.78)',
    justifyContent: 'flex-end',
  },
  studioSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    height: '94%',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 7,
    borderWidth: 1,
  },
  logBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  topHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  schemaToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  schemaToggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  titleInput: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
    paddingVertical: 4,
  },
  subHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  filePathText: {
    flex: 1,
    fontSize: 10.5,
    fontFamily: 'monospace',
  },
  exportTogglesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  fmtChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
  },
  fmtChipText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  studioScroll: {
    flex: 1,
  },
  schemaBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  schemaBoxTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  presetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  existingColsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  colChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
  },
  colChipName: {
    fontSize: 11,
    fontWeight: '700',
  },
  colChipType: {
    fontSize: 9,
    fontWeight: '800',
  },
  addColForm: {
    gap: 8,
  },
  newColInput: {
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12.5,
  },
  typeSelectRow: {
    gap: 6,
  },
  typeOptionPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
  },
  typeOptionText: {
    fontSize: 10,
    fontWeight: '800',
  },
  addColBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  addColBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  rawPreviewBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 11,
    marginBottom: 12,
  },
  rawPreviewTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    marginBottom: 5,
  },
  rawPreviewCode: {
    fontSize: 10.5,
    fontFamily: 'monospace',
    lineHeight: 15,
  },
  totalsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  totalMetricCol: {
    flex: 1,
    minWidth: 130,
  },
  totalMetricLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  totalMetricVal: {
    fontSize: 15.5,
    fontWeight: '800',
    marginTop: 2,
  },
  totalMetricAvg: {
    fontSize: 11,
    fontWeight: '600',
  },
  rowCard: {
    borderRadius: 13,
    borderWidth: 1,
    padding: 11,
    marginBottom: 9,
  },
  rowCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6,
  },
  rowBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  rowAttachmentsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 7,
    borderWidth: 1,
    maxWidth: 145,
  },
  attachmentChipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  removeRowBtn: {
    padding: 3,
  },
  fieldsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  fieldCell: {
    width: '48%',
    flexGrow: 1,
    minWidth: 135,
  },
  fieldLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    marginBottom: 3,
  },
  cellInput: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 6.5,
    fontSize: 12.5,
    fontWeight: '600',
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  dropdownBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  wikiCellBtn: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  wikiCellBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  addRowBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  tagsBox: {
    marginBottom: 6,
  },
  tagsLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginBottom: 5,
  },
  tagsInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
    fontSize: 12.5,
    fontWeight: '600',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: 1,
  },
  bottomHint: {
    fontSize: 11,
    fontWeight: '600',
  },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
