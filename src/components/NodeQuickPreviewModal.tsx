import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { getNodePillarStyle } from '../theme/theme';
import { useVault } from '../store/VaultContext';
import { VaultNode } from '../models/types';
import { BacklinksAndMiniGraphTray } from './BacklinksAndMiniGraphTray';
import { MarkdownWorkspaceModal } from './MarkdownWorkspaceModal';
import { DataLogStudioModal } from './DataLogStudioModal';

export const NodeQuickPreviewModal: React.FC = () => {
  const { theme } = useAppTheme();
  const {
    inspectingNode,
    setInspectingNode,
    getConnectedNeighbors,
    packNodeWithFirstDegreeLinks,
    setActiveTab,
    setActiveNodeId,
    deleteNodeById,
    logSchemas,
    logEntries,
  } = useVault();

  const [editingMarkdownNode, setEditingMarkdownNode] = useState<VaultNode | null>(
    null
  );
  const [editingDataLogNode, setEditingDataLogNode] = useState<VaultNode | null>(
    null
  );

  const handleSwitchWorkspaceNode = (target: VaultNode) => {
    if (target.type === 'LOG') {
      setEditingMarkdownNode(null);
      setEditingDataLogNode(target);
    } else {
      setEditingDataLogNode(null);
      setEditingMarkdownNode(target);
    }
  };

  if (!inspectingNode && !editingMarkdownNode && !editingDataLogNode) {
    return null;
  }

  const pillar = inspectingNode
    ? getNodePillarStyle(inspectingNode.type, theme)
    : null;
  const neighbors = inspectingNode
    ? getConnectedNeighbors(inspectingNode.id)
    : [];
  const logSchema = inspectingNode
    ? logSchemas.find((s) => s.node_id === inspectingNode.id)
    : undefined;
  const nodeLogRows = inspectingNode
    ? logEntries.filter((e) => e.node_id === inspectingNode.id)
    : [];

  return (
    <>
      {inspectingNode && pillar && (
        <Modal
          visible={Boolean(inspectingNode)}
          transparent
          animationType="slide"
          onRequestClose={() => setInspectingNode(null)}
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
              {/* Header Bar */}
              <View style={styles.headerRow}>
                <View style={styles.headerBadges}>
                  <View
                    style={[
                      styles.pillarBadge,
                      {
                        backgroundColor: pillar.softBg,
                        borderColor: pillar.borderColor,
                      },
                    ]}
                  >
                    <Ionicons name={pillar.iconName} size={13} color={pillar.color} />
                    <Text style={[styles.pillarBadgeText, { color: pillar.color }]}>
                      {pillar.label.toUpperCase()}
                    </Text>
                  </View>

                  {inspectingNode.scan_mode && (
                    <View
                      style={[
                        styles.metaBadge,
                        {
                          backgroundColor: theme.surfaceElevated,
                          borderColor: theme.cardBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.metaBadgeText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {inspectingNode.scan_mode} • {inspectingNode.page_count ?? 1}p
                      </Text>
                    </View>
                  )}

                  <View
                    style={[
                      styles.metaBadge,
                      {
                        backgroundColor: theme.surfaceElevated,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.metaBadgeText,
                        { color: theme.accentPrimary },
                      ]}
                    >
                      ⚡ {inspectingNode.token_count} tokens
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setInspectingNode(null)}
                  style={[
                    styles.closeBtn,
                    { backgroundColor: theme.surfaceElevated },
                  ]}
                >
                  <Ionicons name="close" size={18} color={theme.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Title + Launch Full Studio Button */}
              <View style={styles.titleAndEditRow}>
                <View style={styles.titleCol}>
                  <Text style={[styles.nodeTitle, { color: theme.textPrimary }]}>
                    {inspectingNode.title}
                  </Text>
                  <View style={styles.filePathRow}>
                    <Ionicons
                      name="folder-outline"
                      size={13}
                      color={theme.textMuted}
                    />
                    <Text style={[styles.filePathText, { color: theme.textMuted }]}>
                      {inspectingNode.file_path}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    const target = inspectingNode;
                    setInspectingNode(null);
                    if (target.type === 'LOG') {
                      setEditingDataLogNode(target);
                    } else {
                      setEditingMarkdownNode(target);
                    }
                  }}
                  style={[
                    styles.studioLaunchBtn,
                    {
                      backgroundColor: pillar.softBg,
                      borderColor: pillar.borderColor,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      inspectingNode.type === 'LOG'
                        ? 'grid-outline'
                        : 'create-outline'
                    }
                    size={15}
                    color={pillar.color}
                  />
                  <Text
                    style={[
                      styles.studioLaunchText,
                      { color: pillar.color },
                    ]}
                  >
                    {inspectingNode.type === 'LOG'
                      ? 'Table Studio'
                      : 'Edit & [[Link]]'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Hashtags Row */}
              {inspectingNode.tags.length > 0 && (
                <View style={styles.tagsRow}>
                  {inspectingNode.tags.map((tag) => (
                    <View
                      key={tag}
                      style={[
                        styles.tagChip,
                        {
                          backgroundColor: theme.surfaceElevated,
                          borderColor: theme.cardBorder,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tagChipText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        #{tag}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Main Document Body + Structured Data Log Table + Collapsible Backlinks & 1-Hop Mini Graph */}
              <ScrollView
                style={styles.bodyScroll}
                showsVerticalScrollIndicator={false}
              >
                {/* Structured Data Log Table if type === 'LOG' */}
                {inspectingNode.type === 'LOG' && logSchema && (
                  <View
                    style={[
                      styles.logTableBox,
                      {
                        backgroundColor: theme.surfaceElevated,
                        borderColor: theme.nodeLogBorder,
                      },
                    ]}
                  >
                    <View style={styles.logTableHeader}>
                      <View style={styles.logTableHeaderLeft}>
                        <Ionicons
                          name="grid-outline"
                          size={14}
                          color={theme.nodeLog}
                        />
                        <Text
                          style={[
                            styles.logTableTitle,
                            { color: theme.nodeLog },
                          ]}
                        >
                          Structured Data Log ({nodeLogRows.length} rows • CSV + JSON)
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          const target = inspectingNode;
                          setInspectingNode(null);
                          setEditingDataLogNode(target);
                        }}
                      >
                        <Text
                          style={[
                            styles.editRowsLink,
                            { color: theme.nodeLog },
                          ]}
                        >
                          + Edit Columns / Rows
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {nodeLogRows.map((entry, rIdx) => (
                      <View
                        key={entry.id}
                        style={[
                          styles.logRowCard,
                          {
                            backgroundColor: theme.surface,
                            borderColor: theme.cardBorder,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.logRowIndex,
                            { color: theme.textMuted },
                          ]}
                        >
                          Row #{rIdx + 1}
                        </Text>
                        <View style={styles.logCellsGrid}>
                          {logSchema.columns.map((col) => (
                            <View key={col.id} style={styles.logCellItem}>
                              <Text
                                style={[
                                  styles.logColName,
                                  { color: theme.textMuted },
                                ]}
                              >
                                {col.name}:
                              </Text>
                              <Text
                                style={[
                                  styles.logColVal,
                                  {
                                    color:
                                      col.type === 'WIKI_LINK'
                                        ? theme.accentPrimary
                                        : col.type === 'CURRENCY'
                                        ? theme.nodeLog
                                        : theme.textPrimary,
                                  },
                                ]}
                              >
                                {col.type === 'CURRENCY' &&
                                entry.values[col.id] !== undefined
                                  ? `${col.currency_symbol ?? '$'}${Number(
                                      entry.values[col.id]
                                    ).toFixed(2)}`
                                  : String(entry.values[col.id] ?? '—')}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Markdown / Extracted OCR Companion Layer */}
                <View
                  style={[
                    styles.contentBox,
                    {
                      backgroundColor: theme.surfaceElevated,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.contentBoxHeader}>
                    <Text
                      style={[
                        styles.contentBoxLabel,
                        { color: theme.textMuted },
                      ]}
                    >
                      {inspectingNode.type === 'SCAN'
                        ? 'AUTOMATIC ON-DEVICE OCR COMPANION LAYER (INDEXED IN SQLITE FTS5)'
                        : 'MARKDOWN SOURCE & [[WIKI-LINKS]]'}
                    </Text>
                    <Text
                      style={[
                        styles.hashBadgeText,
                        { color: theme.textMuted },
                      ]}
                    >
                      {inspectingNode.content_hash.slice(0, 15)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.markdownBodyText,
                      { color: theme.textPrimary },
                    ]}
                  >
                    {inspectingNode.content_md}
                  </Text>
                </View>

                {/* Automatic Collapsible Backlinks Footer & Mini 1-Hop Local Graph Preview */}
                <BacklinksAndMiniGraphTray
                  currentNode={inspectingNode}
                  neighbors={neighbors}
                  onNavigateToNode={(targetNode) => setInspectingNode(targetNode)}
                  onPackNeighborhoodForAi={(targetId) => {
                    setInspectingNode(null);
                    packNodeWithFirstDegreeLinks(targetId);
                  }}
                />
              </ScrollView>

              {/* Bottom Action Bar */}
              <View style={styles.footerActions}>
                <TouchableOpacity
                  onPress={() => {
                    const targetId = inspectingNode.id;
                    setInspectingNode(null);
                    setActiveNodeId(targetId);
                    setActiveTab('DOCUMAP');
                  }}
                  style={[
                    styles.secondaryActionBtn,
                    {
                      backgroundColor: theme.surfaceElevated,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <Ionicons
                    name="git-network-outline"
                    size={16}
                    color={theme.textPrimary}
                  />
                  <Text
                    style={[
                      styles.secondaryActionText,
                      { color: theme.textPrimary },
                    ]}
                  >
                    View on Map
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    const targetId = inspectingNode.id;
                    setInspectingNode(null);
                    packNodeWithFirstDegreeLinks(targetId);
                  }}
                  style={[
                    styles.primaryActionBtn,
                    { backgroundColor: theme.accentPrimary },
                  ]}
                >
                  <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                  <Text style={styles.primaryActionText}>
                    Pack Node + {neighbors.length} Links for AI
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => deleteNodeById(inspectingNode.id)}
                  style={[
                    styles.deleteBtn,
                    {
                      backgroundColor: theme.dangerSoft,
                    },
                  ]}
                  accessibilityLabel="Delete Node"
                >
                  <Ionicons
                    name="trash-outline"
                    size={17}
                    color={theme.danger}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Phase 3 Hybrid Markdown Workspace Modal (with [[ Autocomplete & Floating Toolbar) */}
      <MarkdownWorkspaceModal
        visible={Boolean(editingMarkdownNode)}
        node={editingMarkdownNode}
        onClose={() => setEditingMarkdownNode(null)}
        onSwitchToNode={handleSwitchWorkspaceNode}
      />

      {/* Phase 3 Structured Personal Data Log Table Builder & Studio Modal */}
      <DataLogStudioModal
        visible={Boolean(editingDataLogNode)}
        node={editingDataLogNode}
        onClose={() => setEditingDataLogNode(null)}
        onSwitchToNode={handleSwitchWorkspaceNode}
      />
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 7, 15, 0.76)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 18,
    maxHeight: '92%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  pillarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 7,
    borderWidth: 1,
  },
  pillarBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  metaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 7,
    borderWidth: 1,
  },
  metaBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleAndEditRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  titleCol: {
    flex: 1,
  },
  nodeTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  filePathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  filePathText: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  studioLaunchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  studioLaunchText: {
    fontSize: 12,
    fontWeight: '800',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tagChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  bodyScroll: {
    maxHeight: 430,
    marginBottom: 14,
  },
  logTableBox: {
    borderRadius: 13,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  logTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  logTableHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logTableTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  editRowsLink: {
    fontSize: 11,
    fontWeight: '800',
  },
  logRowCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 7,
  },
  logRowIndex: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
  },
  logCellsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  logCellItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logColName: {
    fontSize: 11,
    fontWeight: '600',
  },
  logColVal: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  contentBox: {
    borderRadius: 13,
    borderWidth: 1,
    padding: 13,
  },
  contentBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  contentBoxLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    flex: 1,
  },
  hashBadgeText: {
    fontSize: 9.5,
    fontFamily: 'monospace',
  },
  markdownBodyText: {
    fontSize: 13,
    lineHeight: 20,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryActionText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  deleteBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
