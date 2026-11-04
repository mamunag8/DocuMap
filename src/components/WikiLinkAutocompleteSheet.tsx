import React, { useMemo, useState } from 'react';
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
import { getNodePillarStyle } from '../theme/theme';
import { NodeType, VaultNode } from '../models/types';

interface WikiLinkAutocompleteSheetProps {
  visible: boolean;
  initialQuery?: string;
  excludeNodeId?: string;
  nodes: VaultNode[];
  onSelectNode: (node: VaultNode) => void;
  onCreateAndLinkNewNote?: (newTitle: string) => void;
  onClose: () => void;
  titleLabel?: string;
}

export const WikiLinkAutocompleteSheet: React.FC<WikiLinkAutocompleteSheetProps> = ({
  visible,
  initialQuery = '',
  excludeNodeId,
  nodes,
  onSelectNode,
  onCreateAndLinkNewNote,
  onClose,
  titleLabel = 'Insert Bidirectional [[Wiki-Link]]',
}) => {
  const { theme } = useAppTheme();
  const [query, setQuery] = useState<string>(initialQuery);
  const [typeFilter, setTypeFilter] = useState<'ALL' | NodeType>('ALL');

  // Sync initialQuery whenever sheet opens
  React.useEffect(() => {
    if (visible) {
      setQuery(initialQuery);
    }
  }, [visible, initialQuery]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return nodes
      .filter((n) => n.id !== excludeNodeId)
      .filter((n) => (typeFilter === 'ALL' ? true : n.type === typeFilter))
      .filter((n) => {
        if (!q) return true;
        return (
          n.title.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q)) ||
          n.file_path.toLowerCase().includes(q)
        );
      });
  }, [nodes, excludeNodeId, typeFilter, query]);

  const exactTitleMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return nodes.some((n) => n.title.trim().toLowerCase() === q);
  }, [nodes, query]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          {/* Sheet Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.bracketBadge,
                  { backgroundColor: theme.accentPrimarySoft },
                ]}
              >
                <Text style={[styles.bracketBadgeText, { color: theme.accentPrimary }]}>
                  [[ ]]
                </Text>
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
                  {titleLabel}
                </Text>
                <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
                  Creates an automatic 2-way edge in NodeEdges & graph_state.json
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={[
                styles.closeBtn,
                { backgroundColor: theme.surfaceElevated },
              ]}
            >
              <Ionicons name="close" size={18} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Search Input inside [[ Autocomplete */}
          <View
            style={[
              styles.searchRow,
              {
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.accentPrimary,
              },
            ]}
          >
            <Text style={[styles.prefixBrackets, { color: theme.accentPrimary }]}>
              [[
            </Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Filter Scans, Markdown Notes, or Data Logs…"
              placeholderTextColor={theme.textMuted}
              style={[styles.searchInput, { color: theme.textPrimary }]}
              autoFocus
              autoCapitalize="none"
            />
            <Text style={[styles.prefixBrackets, { color: theme.accentPrimary }]}>
              ]]
            </Text>
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={17} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Type Filter Pills */}
          <View style={styles.filterPillsRow}>
            {(
              [
                { key: 'ALL', label: 'All Items' },
                { key: 'SCAN', label: 'Scans (Blue)' },
                { key: 'NOTE', label: 'Notes (Emerald)' },
                { key: 'LOG', label: 'Data Logs (Amber)' },
              ] as Array<{ key: 'ALL' | NodeType; label: string }>
            ).map((f) => {
              const active = typeFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setTypeFilter(f.key)}
                  style={[
                    styles.filterChip,
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
                      styles.filterChipText,
                      { color: active ? '#FFFFFF' : theme.textSecondary },
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Create & Link New Note on the fly if query doesn't match an existing title */}
          {!exactTitleMatch && query.trim().length > 1 && onCreateAndLinkNewNote && (
            <TouchableOpacity
              onPress={() => {
                onCreateAndLinkNewNote(query.trim());
                onClose();
              }}
              style={[
                styles.createNewBanner,
                {
                  backgroundColor: theme.nodeNoteSoft,
                  borderColor: theme.nodeNoteBorder,
                },
              ]}
            >
              <Ionicons name="add-circle" size={18} color={theme.nodeNote} />
              <View style={styles.createNewTextCol}>
                <Text style={[styles.createNewTitle, { color: theme.nodeNote }]}>
                  Create & Link New Markdown Note: [[{query.trim()}]]
                </Text>
                <Text style={[styles.createNewSub, { color: theme.textSecondary }]}>
                  Creates DocuMap_Vault/Notes/{query.trim().replace(/\s+/g, '_')}.md immediately
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Node Results List */}
          <ScrollView
            style={styles.resultsList}
            keyboardShouldPersistTaps="handled"
          >
            {candidates.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  No matching documents found in vault.
                </Text>
              </View>
            ) : (
              candidates.map((node) => {
                const pillar = getNodePillarStyle(node.type, theme);
                return (
                  <TouchableOpacity
                    key={node.id}
                    activeOpacity={0.82}
                    onPress={() => {
                      onSelectNode(node);
                      onClose();
                    }}
                    style={[
                      styles.nodeRow,
                      {
                        backgroundColor: theme.surfaceElevated,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.nodeIconBox,
                        {
                          backgroundColor: pillar.softBg,
                          borderColor: pillar.borderColor,
                        },
                      ]}
                    >
                      <Ionicons
                        name={pillar.iconName}
                        size={17}
                        color={pillar.color}
                      />
                    </View>

                    <View style={styles.nodeInfoCol}>
                      <View style={styles.nodeTitleRow}>
                        <Text
                          style={[styles.nodeTitle, { color: theme.textPrimary }]}
                          numberOfLines={1}
                        >
                          [[{node.title}]]
                        </Text>
                        <View
                          style={[
                            styles.nodeTypePill,
                            { backgroundColor: pillar.softBg },
                          ]}
                        >
                          <Text
                            style={[
                              styles.nodeTypePillText,
                              { color: pillar.color },
                            ]}
                          >
                            {pillar.shortLabel}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[styles.nodeMetaText, { color: theme.textMuted }]}
                        numberOfLines={1}
                      >
                        {node.file_path} • {node.tags.map((t) => `#${t}`).join(' ')}
                      </Text>
                    </View>

                    <Ionicons
                      name="return-down-back-outline"
                      size={17}
                      color={theme.accentPrimary}
                    />
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 7, 15, 0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 18,
    maxHeight: '84%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  bracketBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
  },
  bracketBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  headerTitle: {
    fontSize: 15.5,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    height: 44,
    gap: 6,
    marginBottom: 10,
  },
  prefixBrackets: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
  },
  filterPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  createNewBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  createNewTextCol: {
    flex: 1,
  },
  createNewTitle: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  createNewSub: {
    fontSize: 10.5,
    marginTop: 1,
  },
  resultsList: {
    maxHeight: 310,
  },
  emptyBox: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 12.5,
  },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 7,
  },
  nodeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeInfoCol: {
    flex: 1,
  },
  nodeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  nodeTitle: {
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  nodeTypePill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  nodeTypePillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  nodeMetaText: {
    fontSize: 10.5,
    fontFamily: 'monospace',
  },
});
