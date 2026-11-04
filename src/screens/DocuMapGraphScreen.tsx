import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { getNodePillarStyle } from '../theme/theme';
import { useVault } from '../store/VaultContext';

export const DocuMapGraphScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const {
    nodes,
    edges,
    allUniqueTags,
    activeNodeId,
    setActiveNodeId,
    getConnectedNeighbors,
    packNodeWithFirstDegreeLinks,
    setInspectingNode,
  } = useVault();

  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [hideUnlinked, setHideUnlinked] = useState<boolean>(false);

  const visibleNodes = nodes.filter((n) => {
    if (tagFilter && !n.tags.includes(tagFilter)) return false;
    if (hideUnlinked) {
      const hasEdge = edges.some(
        (e) => e.source_node_id === n.id || e.target_node_id === n.id
      );
      if (!hasEdge) return false;
    }
    return true;
  });

  const visibleIds = new Set(visibleNodes.map((n) => n.id));
  const visibleEdges = edges.filter(
    (e) => visibleIds.has(e.source_node_id) && visibleIds.has(e.target_node_id)
  );

  const selectedNode =
    nodes.find((n) => n.id === activeNodeId) ?? visibleNodes[0] ?? null;
  const selectedNeighbors = selectedNode
    ? getConnectedNeighbors(selectedNode.id)
    : [];

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Top Graph Filter Bar */}
      <View
        style={[
          styles.filterBar,
          {
            backgroundColor: theme.surface,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        <View style={styles.filterTopRow}>
          <View>
            <Text style={[styles.title, { color: theme.textPrimary }]}>
              2D Visual Knowledge Graph (The DocuMap)
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Blue = Scans • Emerald = Notes • Amber = Data Logs
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => setHideUnlinked(!hideUnlinked)}
            style={[
              styles.toggleChip,
              {
                backgroundColor: hideUnlinked
                  ? theme.accentPrimary
                  : theme.surfaceElevated,
                borderColor: hideUnlinked
                  ? theme.accentPrimary
                  : theme.cardBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.toggleChipText,
                { color: hideUnlinked ? '#FFFFFF' : theme.textSecondary },
              ]}
            >
              {hideUnlinked ? 'Linked Only ✓' : 'Hide Unlinked'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagPillsRow}
        >
          <TouchableOpacity
            onPress={() => setTagFilter(null)}
            style={[
              styles.tagChip,
              {
                backgroundColor: !tagFilter
                  ? theme.accentPrimarySoft
                  : theme.surfaceElevated,
                borderColor: !tagFilter ? theme.accentPrimary : theme.cardBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.tagChipText,
                {
                  color: !tagFilter ? theme.accentPrimary : theme.textSecondary,
                },
              ]}
            >
              All Nodes ({nodes.length})
            </Text>
          </TouchableOpacity>

          {allUniqueTags.map(({ tag, count }) => {
            const active = tagFilter === tag;
            return (
              <TouchableOpacity
                key={tag}
                onPress={() => setTagFilter(active ? null : tag)}
                style={[
                  styles.tagChip,
                  {
                    backgroundColor: active
                      ? theme.accentPrimarySoft
                      : theme.surfaceElevated,
                    borderColor: active ? theme.accentPrimary : theme.cardBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tagChipText,
                    {
                      color: active ? theme.accentPrimary : theme.textSecondary,
                    },
                  ]}
                >
                  #{tag} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Interactive 2D Graph Canvas */}
      <View
        style={[
          styles.canvasContainer,
          {
            backgroundColor: theme.graphBackground,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        <Svg width="100%" height={330} viewBox="0 0 400 340">
          {/* Render Edges */}
          {visibleEdges.map((edge) => {
            const src = visibleNodes.find((n) => n.id === edge.source_node_id);
            const tgt = visibleNodes.find((n) => n.id === edge.target_node_id);
            if (!src || !tgt) return null;
            const x1 = src.graph_x ?? 150;
            const y1 = src.graph_y ?? 150;
            const x2 = tgt.graph_x ?? 250;
            const y2 = tgt.graph_y ?? 220;
            const strokeColor =
              edge.relation_type === 'MANUAL_LINK'
                ? theme.edgeManual
                : edge.relation_type === 'SHARED_TAG'
                ? theme.edgeTag
                : theme.edgeKeyword;

            return (
              <G key={edge.id}>
                <Line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={strokeColor}
                  strokeWidth={edge.relation_type === 'MANUAL_LINK' ? 2.6 : 1.6}
                  strokeDasharray={
                    edge.relation_type === 'MANUAL_LINK' ? undefined : '5,4'
                  }
                />
                <SvgText
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 - 6}
                  fill={theme.textMuted}
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {edge.relation_type === 'MANUAL_LINK'
                    ? '[[link]]'
                    : edge.label}
                </SvgText>
              </G>
            );
          })}

          {/* Render Nodes */}
          {visibleNodes.map((node) => {
            const pillar = getNodePillarStyle(node.type, theme);
            const cx = node.graph_x ?? 180;
            const cy = node.graph_y ?? 170;
            const isSelected = selectedNode?.id === node.id;

            return (
              <G
                key={node.id}
                onPress={() => setActiveNodeId(node.id)}
              >
                {isSelected && (
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={31}
                    fill="none"
                    stroke={pillar.color}
                    strokeWidth={2}
                    strokeDasharray="4,3"
                  />
                )}
                <Circle
                  cx={cx}
                  cy={cy}
                  r={23}
                  fill={theme.surface}
                  stroke={pillar.color}
                  strokeWidth={3.5}
                />
                <SvgText
                  x={cx}
                  y={cy + 4}
                  fill={pillar.color}
                  fontSize="9.5"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {pillar.shortLabel}
                </SvgText>
                <SvgText
                  x={cx}
                  y={cy + 38}
                  fill={theme.textPrimary}
                  fontSize="10.5"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {node.title.length > 22
                    ? `${node.title.slice(0, 20)}…`
                    : node.title}
                </SvgText>
              </G>
            );
          })}
        </Svg>

        {/* Legend Strip */}
        <View
          style={[
            styles.legendStrip,
            {
              backgroundColor: theme.surface,
              borderTopColor: theme.cardBorder,
            },
          ]}
        >
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.nodeScan }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>
              Scanned Doc
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.nodeNote }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>
              Markdown Note
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.nodeLog }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>
              Data Log
            </Text>
          </View>
        </View>
      </View>

      {/* Single-Tap Node Inspector Drawer */}
      {selectedNode && (
        <View
          style={[
            styles.inspectorDrawer,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <View style={styles.inspectorHeader}>
            <View style={styles.inspectorTitleCol}>
              <Text style={[styles.inspectorLabel, { color: theme.accentPrimary }]}>
                SINGLE-TAP NODE INSPECTOR • {selectedNeighbors.length} CONNECTED LINKS
              </Text>
              <Text style={[styles.inspectorTitle, { color: theme.textPrimary }]}>
                {selectedNode.title}
              </Text>
              <Text style={[styles.inspectorPath, { color: theme.textMuted }]}>
                {selectedNode.file_path}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setInspectingNode(selectedNode)}
              style={[
                styles.openDocBtn,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <Ionicons name="open-outline" size={15} color={theme.textPrimary} />
              <Text style={[styles.openDocBtnText, { color: theme.textPrimary }]}>
                Open
              </Text>
            </TouchableOpacity>
          </View>

          {/* Backlinks Pills */}
          <View style={styles.neighborsWrap}>
            {selectedNeighbors.map(({ node: nb, edge }) => {
              const p = getNodePillarStyle(nb.type, theme);
              return (
                <TouchableOpacity
                  key={edge.id}
                  onPress={() => setActiveNodeId(nb.id)}
                  style={[
                    styles.neighborPill,
                    {
                      backgroundColor: p.softBg,
                      borderColor: p.borderColor,
                    },
                  ]}
                >
                  <Ionicons name={p.iconName} size={12} color={p.color} />
                  <Text style={[styles.neighborPillText, { color: p.color }]}>
                    {nb.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={() => packNodeWithFirstDegreeLinks(selectedNode.id)}
            style={[
              styles.packBtn,
              { backgroundColor: theme.accentPrimary },
            ]}
          >
            <Ionicons name="sparkles" size={16} color="#FFFFFF" />
            <Text style={styles.packBtnText}>
              Pack Node + {selectedNeighbors.length} Linked Docs for AI
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
  filterBar: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 13,
    marginBottom: 12,
  },
  filterTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  toggleChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  toggleChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tagPillsRow: {
    gap: 7,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  canvasContainer: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  legendStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 9,
    borderTopWidth: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '700',
  },
  inspectorDrawer: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  inspectorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },
  inspectorTitleCol: {
    flex: 1,
  },
  inspectorLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  inspectorTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  inspectorPath: {
    fontSize: 10.5,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  openDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  openDocBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  neighborsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 12,
  },
  neighborPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  neighborPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  packBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 12,
    borderRadius: 12,
  },
  packBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
