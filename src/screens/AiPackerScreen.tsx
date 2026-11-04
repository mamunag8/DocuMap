import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { getNodePillarStyle } from '../theme/theme';
import { useVault } from '../store/VaultContext';
import { estimateTokens, serializeLogToCsv } from '../core/linkAndTokenEngine';

type TargetLlmModel = 'CLAUDE' | 'GPT4O' | 'GEMINI' | 'LOCAL_LLM';

const LLM_SPECS: Record<
  TargetLlmModel,
  { name: string; windowLabel: string; maxTokens: number; factor: number }
> = {
  CLAUDE: {
    name: 'Claude 3.5/4',
    windowLabel: '200K ctx',
    maxTokens: 200000,
    factor: 1.0,
  },
  GPT4O: {
    name: 'GPT-4o',
    windowLabel: '128K ctx',
    maxTokens: 128000,
    factor: 0.96,
  },
  GEMINI: {
    name: 'Gemini 2.5',
    windowLabel: '1M ctx',
    maxTokens: 1000000,
    factor: 0.94,
  },
  LOCAL_LLM: {
    name: 'Local Llama (8K)',
    windowLabel: '8K ctx',
    maxTokens: 8192,
    factor: 1.08,
  },
};

export const AiPackerScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const {
    nodes,
    edges,
    folders,
    logSchemas,
    logEntries,
    aiPackerNodeIds,
    toggleNodeInAiPacker,
    packNodeWithFirstDegreeLinks,
    clearAiPackerCart,
  } = useVault();

  const [targetModel, setTargetModel] = useState<TargetLlmModel>('CLAUDE');
  const [stripBoilerplate, setStripBoilerplate] = useState<boolean>(true);
  const [dedupHeaders, setDedupHeaders] = useState<boolean>(true);
  const [compactLogsCsv, setCompactLogsCsv] = useState<boolean>(true);
  const [injectRelationalHeader, setInjectRelationalHeader] = useState<boolean>(true);
  const [actionToast, setActionToast] = useState<string | null>(null);

  const selectedNodes = useMemo(
    () => nodes.filter((n) => aiPackerNodeIds.includes(n.id)),
    [nodes, aiPackerNodeIds]
  );

  // Raw verbose JSON + uncompressed markdown payload
  const rawPayload = useMemo(() => {
    return selectedNodes
      .map((n) => {
        if (n.type === 'LOG') {
          const entries = logEntries.filter((e) => e.node_id === n.id);
          const schema = logSchemas.find((s) => s.node_id === n.id);
          return `### DOCUMENT: ${n.title}\nFILE: ${n.file_path}\nTAGS: ${JSON.stringify(
            n.tags
          )}\n${n.content_md}\nRAW_VERBOSE_JSON_SCHEMA:\n${JSON.stringify(
            schema,
            null,
            2
          )}\nRAW_VERBOSE_JSON_ENTRIES:\n${JSON.stringify(entries, null, 2)}`;
        }
        return `### DOCUMENT: ${n.title}\nFILE: ${n.file_path}\nTAGS: ${JSON.stringify(
          n.tags
        )}\nMETADATA: {"id":"${n.id}","folder":"${n.folder_id}","hash":"${
          n.content_hash
        }"}\n\n${n.content_md}`;
      })
      .join('\n\n========================================\n\n');
  }, [selectedNodes, logEntries, logSchemas]);

  // Token-compressed bundle
  const optimizedPayload = useMemo(() => {
    if (selectedNodes.length === 0) return '';

    const parts: string[] = [];

    if (injectRelationalHeader) {
      const selIds = new Set(selectedNodes.map((n) => n.id));
      const relevantEdges = edges.filter(
        (e) => selIds.has(e.source_node_id) && selIds.has(e.target_node_id)
      );
      const edgeLines = relevantEdges.map((e) => {
        const s =
          selectedNodes.find((n) => n.id === e.source_node_id)?.title ??
          e.source_node_id;
        const t =
          selectedNodes.find((n) => n.id === e.target_node_id)?.title ??
          e.target_node_id;
        return `  - "${s} <-> ${t} (${e.relation_type}: ${e.label})"`;
      });

      parts.push(
        [
          '---',
          'documap_context_bundle: v1.0',
          `target_llm: ${LLM_SPECS[targetModel].name}`,
          `included_nodes: ${selectedNodes.length}`,
          'relational_map:',
          ...(edgeLines.length > 0 ? edgeLines : ['  - "standalone"']),
          '---',
        ].join('\n')
      );
    }

    for (const node of selectedNodes) {
      let body = node.content_md;

      if (node.type === 'LOG' && compactLogsCsv) {
        const schema = logSchemas.find((s) => s.node_id === node.id);
        const entries = logEntries.filter((e) => e.node_id === node.id);
        if (schema && entries.length > 0) {
          body = serializeLogToCsv(schema.columns, entries);
        }
      }

      if (dedupHeaders) {
        body = body
          .replace(/^#+\s*\[OCR EXTRACTED LAYER\].*$/gim, '')
          .replace(/^#+\s*\[ON-DEVICE OCR.*\].*$/gim, '')
          .replace(/^#+\s*Structured Data Log:.*$/gim, '')
          .replace(/^\*\*PDF Studio Metadata:\*\*.*$/gim, '');
      }

      if (stripBoilerplate) {
        body = body
          .replace(/\|?\s*:?---+:?\s*\|/g, '|')
          .replace(/\n{3,}/g, '\n')
          .replace(/[ \t]{2,}/g, ' ')
          .trim();
      }

      parts.push(`[${node.type}:${node.title}|#${node.tags.join(',')}]\n${body}`);
    }

    return parts.join('\n\n');
  }, [
    selectedNodes,
    edges,
    logSchemas,
    logEntries,
    targetModel,
    stripBoilerplate,
    dedupHeaders,
    compactLogsCsv,
    injectRelationalHeader,
  ]);

  const modelFactor = LLM_SPECS[targetModel].factor;
  const rawTokens = useMemo(
    () => Math.round(estimateTokens(rawPayload) * modelFactor),
    [rawPayload, modelFactor]
  );
  const optimizedTokens = useMemo(
    () => Math.round(estimateTokens(optimizedPayload) * modelFactor),
    [optimizedPayload, modelFactor]
  );

  const savedPercent =
    rawTokens > 0
      ? Math.max(0, Math.round(((rawTokens - optimizedTokens) / rawTokens) * 100))
      : 0;

  const showNotice = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 2600);
  };

  const handleCopyPrompt = async () => {
    if (!optimizedPayload) return;
    try {
      await Clipboard.setStringAsync(optimizedPayload);
    } catch {
      // Fallback
    }
    showNotice(
      `Copied Optimized AI Prompt (${optimizedTokens} tokens, -${savedPercent}% saved)!`
    );
  };

  /**
   * Saves the compressed bundle as a portable `.md` file inside DocuMap_Vault/
   * and triggers native share sheet if available
   */
  const handleSaveAiBundleFile = async () => {
    if (!optimizedPayload) return;
    const fileName = `DocuMap_AI_Context_Bundle_${new Date()
      .toISOString()
      .slice(0, 10)}.md`;

    try {
      if (FileSystem.documentDirectory) {
        const uri = `${FileSystem.documentDirectory}${fileName}`;
        await FileSystem.writeAsStringAsync(uri, optimizedPayload, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'text/markdown',
            dialogTitle: 'Save AI-Ready .md Bundle',
          });
          return;
        }
      }
    } catch {
      // Fallback
    }
    showNotice(`Saved AI-Ready bundle to DocuMap_Vault/${fileName}!`);
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Live Token Meter Card */}
      <View
        style={[
          styles.meterCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.accentPrimary,
          },
        ]}
      >
        <View style={styles.meterHeader}>
          <View>
            <Text style={[styles.meterTitle, { color: theme.textPrimary }]}>
              AI Token-Saver & Context Bundler Studio
            </Text>
            <Text style={[styles.meterSub, { color: theme.textSecondary }]}>
              Bundles parent node + 1st-degree linked OCR scans & CSV logs
            </Text>
          </View>
          <View
            style={[
              styles.savingsBadge,
              { backgroundColor: theme.successSoft },
            ]}
          >
            <Ionicons name="trending-down" size={14} color={theme.success} />
            <Text style={[styles.savingsBadgeText, { color: theme.success }]}>
              -{savedPercent}% Tokens Saved
            </Text>
          </View>
        </View>

        {/* Target LLM Selector */}
        <View style={styles.llmRow}>
          {(Object.keys(LLM_SPECS) as TargetLlmModel[]).map((mKey) => {
            const spec = LLM_SPECS[mKey];
            const active = targetModel === mKey;
            return (
              <TouchableOpacity
                key={mKey}
                onPress={() => setTargetModel(mKey)}
                style={[
                  styles.llmChip,
                  {
                    backgroundColor: active
                      ? theme.accentPrimary
                      : theme.surfaceElevated,
                    borderColor: active
                      ? theme.accentPrimary
                      : theme.cardBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.llmChipName,
                    { color: active ? '#FFFFFF' : theme.textPrimary },
                  ]}
                >
                  {spec.name}
                </Text>
                <Text
                  style={[
                    styles.llmChipSub,
                    {
                      color: active
                        ? 'rgba(255,255,255,0.8)'
                        : theme.textMuted,
                    },
                  ]}
                >
                  {spec.windowLabel}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.tokenNumbersRow}>
          <View style={styles.tokenStatBox}>
            <Text style={[styles.tokenStatLabel, { color: theme.textMuted }]}>
              RAW VERBOSE TOKENS
            </Text>
            <Text style={[styles.tokenStatValue, { color: theme.textSecondary }]}>
              {rawTokens} tok
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color={theme.accentPrimary} />
          <View style={styles.tokenStatBox}>
            <Text style={[styles.tokenStatLabel, { color: theme.textMuted }]}>
              COMPRESSED BUNDLE
            </Text>
            <Text style={[styles.tokenStatValue, { color: theme.success }]}>
              {optimizedTokens} tok
            </Text>
          </View>
        </View>

        {/* Visual Progress Bar */}
        <View
          style={[
            styles.progressTrack,
            { backgroundColor: theme.surfaceElevated },
          ]}
        >
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(100, Math.max(12, 100 - savedPercent))}%`,
                backgroundColor: theme.accentPrimary,
              },
            ]}
          />
        </View>
      </View>

      {actionToast && (
        <View
          style={[
            styles.toastBox,
            { backgroundColor: theme.successSoft, borderColor: theme.success },
          ]}
        >
          <Ionicons name="checkmark-circle" size={16} color={theme.success} />
          <Text style={[styles.toastText, { color: theme.success }]}>
            {actionToast}
          </Text>
        </View>
      )}

      {/* Quick Folder & 1-Hop Neighborhood Bundler Strip */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
          QUICK BUNDLE BY FOLDER OR 1-HOP NEIGHBORHOOD
        </Text>
        {selectedNodes.length > 0 && (
          <TouchableOpacity onPress={clearAiPackerCart}>
            <Text style={[styles.clearText, { color: theme.danger }]}>
              Clear Cart
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.foldersStrip}
      >
        {folders.map((folder) => {
          const folderNodes = nodes.filter((n) => n.folder_id === folder.id);
          if (folderNodes.length === 0) return null;
          return (
            <TouchableOpacity
              key={folder.id}
              onPress={() => {
                for (const fn of folderNodes) {
                  if (!aiPackerNodeIds.includes(fn.id)) {
                    toggleNodeInAiPacker(fn.id);
                  }
                }
              }}
              style={[
                styles.folderPackChip,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <Ionicons
                name="folder-open-outline"
                size={13}
                color={theme.accentPrimary}
              />
              <Text
                style={[styles.folderPackText, { color: theme.textPrimary }]}
              >
                Pack {folder.name} ({folderNodes.length})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Context Cart: Toggle VaultNodes in/out or Pull 1-Hop Links */}
      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
        CONTEXT CART ({selectedNodes.length} OF {nodes.length} DOCUMENTS SELECTED)
      </Text>
      <View style={styles.cartList}>
        {nodes.map((node) => {
          const selected = aiPackerNodeIds.includes(node.id);
          const pillar = getNodePillarStyle(node.type, theme);
          return (
            <View
              key={node.id}
              style={[
                styles.cartRow,
                {
                  backgroundColor: theme.surface,
                  borderColor: selected ? pillar.color : theme.cardBorder,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => toggleNodeInAiPacker(node.id)}
                style={styles.cartRowTouch}
              >
                <Ionicons
                  name={selected ? 'checkbox' : 'square-outline'}
                  size={19}
                  color={selected ? pillar.color : theme.textMuted}
                />
                <View style={styles.cartInfo}>
                  <Text
                    style={[styles.cartTitle, { color: theme.textPrimary }]}
                    numberOfLines={1}
                  >
                    {node.title}
                  </Text>
                  <Text style={[styles.cartPath, { color: theme.textMuted }]}>
                    {pillar.shortLabel} • {node.token_count} tok • {node.file_path}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => packNodeWithFirstDegreeLinks(node.id)}
                style={[
                  styles.pull1HopBtn,
                  { backgroundColor: theme.accentPrimarySoft },
                ]}
              >
                <Ionicons
                  name="git-network-outline"
                  size={12}
                  color={theme.accentPrimary}
                />
                <Text
                  style={[
                    styles.pull1HopText,
                    { color: theme.accentPrimary },
                  ]}
                >
                  +1-Hop
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* 4 Token-Saver Compression Toggles */}
      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
        TOKEN-SAVER COMPRESSION PIPELINE
      </Text>
      <View
        style={[
          styles.togglesCard,
          {
            backgroundColor: theme.surface,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        {[
          {
            label: 'Strip redundant whitespace, markdown boilerplate & OCR noise',
            val: stripBoilerplate,
            setter: setStripBoilerplate,
          },
          {
            label: 'Deduplicate repeated headers/footers across multi-page scans',
            val: dedupHeaders,
            setter: setDedupHeaders,
          },
          {
            label:
              'Convert Data Logs into ultra-compact CSV/YAML instead of verbose JSON',
            val: compactLogsCsv,
            setter: setCompactLogsCsv,
          },
          {
            label:
              'Inject Relational Map Header (compact YAML frontmatter explaining how all included documents connect)',
            val: injectRelationalHeader,
            setter: setInjectRelationalHeader,
          },
        ].map((item, idx) => (
          <TouchableOpacity
            key={idx}
            onPress={() => item.setter(!item.val)}
            style={styles.toggleRow}
          >
            <Ionicons
              name={item.val ? 'checkbox' : 'square-outline'}
              size={18}
              color={item.val ? theme.accentPrimary : theme.textMuted}
            />
            <Text style={[styles.toggleLabel, { color: theme.textPrimary }]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Live Compressed Output Preview */}
      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
        OPTIMIZED AI PROMPT BUNDLE PREVIEW
      </Text>
      <View
        style={[
          styles.previewBox,
          {
            backgroundColor: theme.surface,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        <Text style={[styles.previewCode, { color: theme.textSecondary }]}>
          {optimizedPayload ||
            'Select at least one document above to generate an AI context bundle.'}
        </Text>
      </View>

      {/* Dual Export Actions: Copy Optimized Prompt OR Save AI-Ready .md Bundle */}
      <View style={styles.exportActionsRow}>
        <TouchableOpacity
          onPress={handleCopyPrompt}
          style={[
            styles.copyBtn,
            { backgroundColor: theme.accentPrimary },
          ]}
        >
          <Ionicons name="copy-outline" size={17} color="#FFFFFF" />
          <Text style={styles.copyBtnText}>Copy Prompt to Clipboard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSaveAiBundleFile}
          style={[
            styles.saveMdBtn,
            {
              backgroundColor: theme.surface,
              borderColor: theme.accentPrimary,
            },
          ]}
        >
          <Ionicons
            name="download-outline"
            size={17}
            color={theme.accentPrimary}
          />
          <Text style={[styles.saveMdBtnText, { color: theme.accentPrimary }]}>
            Save .md Bundle
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 110,
  },
  meterCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 12,
  },
  meterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  meterTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  meterSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  savingsBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  llmRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  llmChip: {
    flex: 1,
    minWidth: 78,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
  },
  llmChipName: {
    fontSize: 11,
    fontWeight: '800',
  },
  llmChipSub: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 1,
  },
  tokenNumbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tokenStatBox: {
    flex: 1,
  },
  tokenStatLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tokenStatValue: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  toastText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  clearText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  foldersStrip: {
    gap: 7,
    paddingBottom: 12,
  },
  folderPackChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
  },
  folderPackText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  cartList: {
    gap: 7,
    marginBottom: 14,
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  cartRowTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  cartInfo: {
    flex: 1,
  },
  cartTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  cartPath: {
    fontSize: 10.5,
    marginTop: 2,
  },
  pull1HopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
  },
  pull1HopText: {
    fontSize: 10,
    fontWeight: '800',
  },
  togglesCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 10,
    marginBottom: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  toggleLabel: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
  },
  previewBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  previewCode: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'monospace',
  },
  exportActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  copyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 14,
    borderRadius: 13,
  },
  copyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  saveMdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 13,
    borderWidth: 1.5,
  },
  saveMdBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
});
