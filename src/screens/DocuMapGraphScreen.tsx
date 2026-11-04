import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Pattern,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { getNodePillarStyle } from '../theme/theme';
import { useVault } from '../store/VaultContext';
import { EdgeRelationType, VaultNode } from '../models/types';

type DateRangeFilter = 'ALL_TIME' | 'LAST_7_DAYS' | 'TODAY';

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
    updateNodeGraphPosition,
  } = useVault();

  // Graph Filters
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRangeFilter>('ALL_TIME');
  const [relationFilter, setRelationFilter] = useState<'ALL' | EdgeRelationType>('ALL');
  const [hideUnlinked, setHideUnlinked] = useState<boolean>(false);

  // 2D Viewport Zoom & Pan State
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [lastTapMap, setLastTapMap] = useState<Record<string, number>>({});

  // Filter nodes by Tag, Date Range, and Unlinked toggle
  const visibleNodes = useMemo(() => {
    const nowMs = Date.now();
    return nodes.filter((n) => {
      if (tagFilter && !n.tags.includes(tagFilter)) return false;

      if (dateRange !== 'ALL_TIME') {
        const updatedMs = new Date(n.updated_at).getTime();
        const ageHours = (nowMs - updatedMs) / (1000 * 60 * 60);
        if (dateRange === 'TODAY' && ageHours > 36) return false;
        if (dateRange === 'LAST_7_DAYS' && ageHours > 24 * 8) return false;
      }

      if (hideUnlinked) {
        const hasEdge = edges.some(
          (e) => e.source_node_id === n.id || e.target_node_id === n.id
        );
        if (!hasEdge) return false;
      }
      return true;
    });
  }, [nodes, edges, tagFilter, dateRange, hideUnlinked]);

  const visibleIds = useMemo(
    () => new Set(visibleNodes.map((n) => n.id)),
    [visibleNodes]
  );

  const visibleEdges = useMemo(
    () =>
      edges.filter(
        (e) =>
          visibleIds.has(e.source_node_id) &&
          visibleIds.has(e.target_node_id) &&
          (relationFilter === 'ALL' || e.relation_type === relationFilter)
      ),
    [edges, visibleIds, relationFilter]
  );

  const selectedNode =
    visibleNodes.find((n) => n.id === activeNodeId) ?? visibleNodes[0] ?? null;

  const selectedNeighbors = selectedNode
    ? getConnectedNeighbors(selectedNode.id)
    : [];

  /**
   * Single-tap selects node in the Inspector Drawer;
   * Double-tap (< 360ms) opens the full Document Studio immediately!
   */
  const handleNodeTap = (node: VaultNode) => {
    const now = Date.now();
    const prevTap = lastTapMap[node.id] ?? 0;
    setLastTapMap((prev) => ({ ...prev, [node.id]: now }));

    if (now - prevTap < 360) {
      setInspectingNode(node);
    } else {
      setActiveNodeId(node.id);
    }
  };

  /**
   * Runs 2D Force-Directed Spring-Electrical Layout Simulation across visible nodes
   * and saves coordinates to DocuMap_Vault/.documap/graph_state.json
   */
  const runForceDirectedLayout = async () => {
    if (visibleNodes.length === 0) return;

    const coords = new Map<string, { x: number; y: number }>();
    const count = visibleNodes.length;
    const centerX = 200;
    const centerY = 175;
    const radius = count <= 3 ? 95 : 118;

    // Initialize on a balanced ring
    visibleNodes.forEach((n, idx) => {
      const angle = (idx / count) * Math.PI * 2 - Math.PI / 2;
      coords.set(n.id, {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      });
    });

    // Run 25 iterations of Fruchterman-Reingold force relaxation
    for (let iter = 0; iter < 25; iter++) {
      // Repulsion between all pairs
      for (let i = 0; i < visibleNodes.length; i++) {
        for (let j = i + 1; j < visibleNodes.length; j++) {
          const a = visibleNodes[i];
          const b = visibleNodes[j];
          const posA = coords.get(a.id)!;
          const posB = coords.get(b.id)!;
          const dx = posB.x - posA.x || 1;
          const dy = posB.y - posA.y || 1;
          const dist = Math.max(28, Math.sqrt(dx * dx + dy * dy));
          const repulse = 1100 / (dist * dist);
          const fx = (dx / dist) * repulse;
          const fy = (dy / dist) * repulse;
          posA.x -= fx;
          posA.y -= fy;
          posB.x += fx;
          posB.y += fy;
        }
      }

      // Attraction along edges
      for (const edge of visibleEdges) {
        const posS = coords.get(edge.source_node_id);
        const posT = coords.get(edge.target_node_id);
        if (!posS || !posT) continue;
        const dx = posT.x - posS.x;
        const dy = posT.y - posS.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const ideal = 135;
        const spring = (dist - ideal) * 0.045 * edge.weight;
        const fx = (dx / dist) * spring;
        const fy = (dy / dist) * spring;
        posS.x += fx;
        posS.y += fy;
        posT.x -= fx;
        posT.y -= fy;
      }

      // Gravity toward center & boundary clamp
      for (const n of visibleNodes) {
        const pos = coords.get(n.id)!;
        pos.x += (centerX - pos.x) * 0.04;
        pos.y += (centerY - pos.y) * 0.04;
        pos.x = Math.max(54, Math.min(346, pos.x));
        pos.y = Math.max(48, Math.min(295, pos.y));
      }
    }

    for (const [id, pt] of coords.entries()) {
      await updateNodeGraphPosition(id, pt.x, pt.y);
    }
  };

  /**
   * Moves the selected node on the 2D canvas and updates graph_state.json
   */
  const handleNudgeSelectedNode = async (dx: number, dy: number) => {
    if (!selectedNode) return;
    const nextX = Math.max(40, Math.min(360, (selectedNode.graph_x ?? 180) + dx));
    const nextY = Math.max(40, Math.min(300, (selectedNode.graph_y ?? 160) + dy));
    await updateNodeGraphPosition(selectedNode.id, nextX, nextY);
  };

  // Compute SVG viewBox from zoomScale and panOffset
  const baseW = 400;
  const baseH = 350;
  const viewW = baseW / zoomScale;
  const viewH = baseH / zoomScale;
  const viewX = (baseW - viewW) / 2 - panOffset.x;
  const viewY = (baseH - viewH) / 2 - panOffset.y;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Filter & Force-Physics Toolbar */}
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
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>
              2D Force-Directed Knowledge Graph
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Single-tap to inspect • Double-tap node to open document studio
            </Text>
          </View>

          <TouchableOpacity
            onPress={runForceDirectedLayout}
            style={[
              styles.physicsBtn,
              {
                backgroundColor: theme.accentPrimarySoft,
                borderColor: theme.accentPrimary,
              },
            ]}
          >
            <Ionicons name="sparkles-outline" size={13} color={theme.accentPrimary} />
            <Text style={[styles.physicsBtnText, { color: theme.accentPrimary }]}>
              Force Layout
            </Text>
          </TouchableOpacity>
        </View>

        {/* Date Range & Unlinked Filter Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.secondaryFilterRow}
        >
          {(
            [
              { key: 'ALL_TIME', label: 'All Dates' },
              { key: 'LAST_7_DAYS', label: 'Last 7 Days' },
              { key: 'TODAY', label: 'Today' },
            ] as Array<{ key: DateRangeFilter; label: string }>
          ).map((d) => {
            const active = dateRange === d.key;
            return (
              <TouchableOpacity
                key={d.key}
                onPress={() => setDateRange(d.key)}
                style={[
                  styles.smallFilterPill,
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
                    styles.smallFilterText,
                    { color: active ? '#FFFFFF' : theme.textSecondary },
                  ]}
                >
                  {d.label}
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            onPress={() => setHideUnlinked(!hideUnlinked)}
            style={[
              styles.smallFilterPill,
              {
                backgroundColor: hideUnlinked
                  ? theme.nodeNote
                  : theme.surfaceElevated,
                borderColor: hideUnlinked ? theme.nodeNote : theme.cardBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.smallFilterText,
                { color: hideUnlinked ? '#FFFFFF' : theme.textSecondary },
              ]}
            >
              {hideUnlinked ? 'Hide Unlinked ✓' : 'Hide Unlinked'}
            </Text>
          </TouchableOpacity>

          {(
            [
              { key: 'ALL', label: 'All Edges' },
              { key: 'MANUAL_LINK', label: '[[Wiki-Links]]' },
              { key: 'SHARED_TAG', label: '#Shared Tags' },
            ] as Array<{ key: 'ALL' | EdgeRelationType; label: string }>
          ).map((ef) => {
            const active = relationFilter === ef.key;
            return (
              <TouchableOpacity
                key={ef.key}
                onPress={() => setRelationFilter(ef.key)}
                style={[
                  styles.smallFilterPill,
                  {
                    backgroundColor: active
                      ? theme.surfaceHighlight
                      : theme.surfaceElevated,
                    borderColor: active
                      ? theme.accentPrimary
                      : theme.cardBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.smallFilterText,
                    {
                      color: active ? theme.accentPrimary : theme.textSecondary,
                    },
                  ]}
                >
                  {ef.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* #Tag Filter Strip */}
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
              All Tags ({nodes.length})
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

      {/* Interactive 2D Force-Directed Graph Canvas with Zoom, Pan & Node Drag Controls */}
      <View
        style={[
          styles.canvasContainer,
          {
            backgroundColor: theme.graphBackground,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        {/* Top Overlay: Zoom & Pan Controls */}
        <View style={styles.canvasHudRow}>
          <View
            style={[
              styles.hudGroup,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => setZoomScale((z) => Math.max(0.65, +(z - 0.2).toFixed(2)))}
              style={styles.hudBtn}
            >
              <Ionicons name="remove" size={15} color={theme.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setZoomScale(1.0);
                setPanOffset({ x: 0, y: 0 });
              }}
              style={styles.hudResetBtn}
            >
              <Text style={[styles.hudZoomText, { color: theme.accentPrimary }]}>
                {Math.round(zoomScale * 100)}%
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setZoomScale((z) => Math.min(2.2, +(z + 0.2).toFixed(2)))}
              style={styles.hudBtn}
            >
              <Ionicons name="add" size={15} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Pan D-Pad */}
          <View
            style={[
              styles.hudGroup,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => setPanOffset((p) => ({ ...p, x: p.x + 25 }))}
              style={styles.hudBtn}
            >
              <Ionicons name="arrow-back" size={13} color={theme.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPanOffset((p) => ({ ...p, y: p.y + 25 }))}
              style={styles.hudBtn}
            >
              <Ionicons name="arrow-up" size={13} color={theme.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPanOffset((p) => ({ ...p, y: p.y - 25 }))}
              style={styles.hudBtn}
            >
              <Ionicons name="arrow-down" size={13} color={theme.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setPanOffset((p) => ({ ...p, x: p.x - 25 }))}
              style={styles.hudBtn}
            >
              <Ionicons name="arrow-forward" size={13} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <Svg
          width="100%"
          height={340}
          viewBox={`${viewX} ${viewY} ${viewW} ${viewH}`}
        >
          <Defs>
            <Pattern
              id="documapGrid"
              width="28"
              height="28"
              patternUnits="userSpaceOnUse"
            >
              <Circle cx="14" cy="14" r="1" fill={theme.graphGrid} />
            </Pattern>
          </Defs>

          <Rect
            x={-200}
            y={-200}
            width={800}
            height={800}
            fill="url(#documapGrid)"
          />

          {/* Render Bidirectional & Auto-Discovered Edges */}
          {visibleEdges.map((edge) => {
            const src = visibleNodes.find((n) => n.id === edge.source_node_id);
            const tgt = visibleNodes.find((n) => n.id === edge.target_node_id);
            if (!src || !tgt) return null;
            const x1 = src.graph_x ?? 150;
            const y1 = src.graph_y ?? 150;
            const x2 = tgt.graph_x ?? 250;
            const y2 = tgt.graph_y ?? 220;

            const isConnectedToSelected =
              selectedNode &&
              (edge.source_node_id === selectedNode.id ||
                edge.target_node_id === selectedNode.id);

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
                  strokeWidth={
                    isConnectedToSelected
                      ? 3.2
                      : edge.relation_type === 'MANUAL_LINK'
                      ? 2.4
                      : 1.5
                  }
                  strokeDasharray={
                    edge.relation_type === 'MANUAL_LINK' ? undefined : '5,4'
                  }
                  opacity={isConnectedToSelected ? 1 : 0.72}
                />
                <SvgText
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 - 6}
                  fill={
                    isConnectedToSelected ? theme.textPrimary : theme.textMuted
                  }
                  fontSize="8.8"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {edge.relation_type === 'MANUAL_LINK'
                    ? '[[Wiki-Link]]'
                    : edge.label}
                </SvgText>
              </G>
            );
          })}

          {/* Render VaultNodes Color-Coded by Pillar */}
          {visibleNodes.map((node) => {
            const pillar = getNodePillarStyle(node.type, theme);
            const cx = node.graph_x ?? 180;
            const cy = node.graph_y ?? 170;
            const isSelected = selectedNode?.id === node.id;
            const degCount = getConnectedNeighbors(node.id).length;

            return (
              <G key={node.id} onPress={() => handleNodeTap(node)}>
                {/* Outer Pulse Halo if Selected */}
                {isSelected && (
                  <Circle
                    cx={cx}
                    cy={cy}
                    r={33}
                    fill={pillar.softBg}
                    stroke={pillar.color}
                    strokeWidth={2}
                    strokeDasharray="4,3"
                  />
                )}

                {/* Main Node Circle */}
                <Circle
                  cx={cx}
                  cy={cy}
                  r={24}
                  fill={theme.surface}
                  stroke={pillar.color}
                  strokeWidth={isSelected ? 4 : 3}
                />

                {/* Pillar Short Label */}
                <SvgText
                  x={cx}
                  y={cy - 1}
                  fill={pillar.color}
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {pillar.shortLabel}
                </SvgText>

                {/* Degree & Token Micro Readout */}
                <SvgText
                  x={cx}
                  y={cy + 10}
                  fill={theme.textSecondary}
                  fontSize="7.5"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {degCount}L • {node.token_count}t
                </SvgText>

                {/* Node Title Label */}
                <SvgText
                  x={cx}
                  y={cy + 39}
                  fill={theme.textPrimary}
                  fontSize="10.2"
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

        {/* Bottom Canvas Bar: Selected Node Drag / Position Controls + Legend */}
        <View
          style={[
            styles.legendStrip,
            {
              backgroundColor: theme.surface,
              borderTopColor: theme.cardBorder,
            },
          ]}
        >
          <View style={styles.legendGroup}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.nodeScan }]} />
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>
                Scan
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.nodeNote }]} />
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>
                Note
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: theme.nodeLog }]} />
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>
                Log
              </Text>
            </View>
          </View>

          {selectedNode && (
            <View style={styles.dragNodeGroup}>
              <Text style={[styles.dragLabel, { color: theme.textMuted }]}>
                Move Node ({selectedNode.graph_x ?? 180},{selectedNode.graph_y ?? 170}):
              </Text>
              <TouchableOpacity
                onPress={() => handleNudgeSelectedNode(-16, 0)}
                style={[styles.dragMiniBtn, { backgroundColor: theme.surfaceElevated }]}
              >
                <Ionicons name="chevron-back" size={12} color={theme.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleNudgeSelectedNode(16, 0)}
                style={[styles.dragMiniBtn, { backgroundColor: theme.surfaceElevated }]}
              >
                <Ionicons name="chevron-forward" size={12} color={theme.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleNudgeSelectedNode(0, -16)}
                style={[styles.dragMiniBtn, { backgroundColor: theme.surfaceElevated }]}
              >
                <Ionicons name="chevron-up" size={12} color={theme.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleNudgeSelectedNode(0, 16)}
                style={[styles.dragMiniBtn, { backgroundColor: theme.surfaceElevated }]}
              >
                <Ionicons name="chevron-down" size={12} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>
          )}
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
                NODE INSPECTOR DRAWER • {selectedNeighbors.length} BACKLINKS • ⚡{' '}
                {selectedNode.token_count} TOKENS
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
                  borderColor: theme.accentPrimary,
                },
              ]}
            >
              <Ionicons name="open-outline" size={15} color={theme.accentPrimary} />
              <Text style={[styles.openDocBtnText, { color: theme.accentPrimary }]}>
                Open Studio
              </Text>
            </TouchableOpacity>
          </View>

          <Text
            style={[styles.inspectorExcerpt, { color: theme.textSecondary }]}
            numberOfLines={2}
          >
            {selectedNode.content_md
              .replace(/^#+\s*/gm, '')
              .replace(/\s+/g, ' ')
              .trim()}
          </Text>

          {/* Connected Backlinks Chips */}
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
                    {nb.title} ({edge.relation_type === 'MANUAL_LINK' ? '[[]]' : edge.label})
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
    gap: 9,
  },
  filterTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  physicsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
  },
  physicsBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  secondaryFilterRow: {
    gap: 6,
  },
  smallFilterPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
  },
  smallFilterText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  tagPillsRow: {
    gap: 6,
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
    position: 'relative',
  },
  canvasHudRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  hudGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9,
    borderWidth: 1,
    padding: 2,
  },
  hudBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hudResetBtn: {
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  hudZoomText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  legendStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    flexWrap: 'wrap',
    gap: 8,
  },
  legendGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
  dragNodeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dragLabel: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  dragMiniBtn: {
    width: 22,
    height: 22,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginBottom: 6,
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
    fontWeight: '800',
  },
  inspectorExcerpt: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
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
