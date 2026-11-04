import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { getNodePillarStyle } from '../theme/theme';
import { NodeEdge, VaultNode } from '../models/types';

interface BacklinksAndMiniGraphTrayProps {
  currentNode: VaultNode;
  neighbors: Array<{ node: VaultNode; edge: NodeEdge }>;
  onNavigateToNode: (targetNode: VaultNode) => void;
  onPackNeighborhoodForAi?: (nodeId: string) => void;
}

export const BacklinksAndMiniGraphTray: React.FC<BacklinksAndMiniGraphTrayProps> = ({
  currentNode,
  neighbors,
  onNavigateToNode,
  onPackNeighborhoodForAi,
}) => {
  const { theme } = useAppTheme();
  const [expanded, setExpanded] = useState<boolean>(true);
  const [showMiniGraph, setShowMiniGraph] = useState<boolean>(true);

  const centerPillar = getNodePillarStyle(currentNode.type, theme);
  const centerX = 175;
  const centerY = 82;
  const radius = 58;

  return (
    <View
      style={[
        styles.trayContainer,
        {
          backgroundColor: theme.surfaceElevated,
          borderColor: theme.cardBorder,
        },
      ]}
    >
      {/* Collapsible Tray Header */}
      <TouchableOpacity
        activeOpacity={0.82}
        onPress={() => setExpanded(!expanded)}
        style={styles.headerRow}
      >
        <View style={styles.headerLeft}>
          <Ionicons
            name="git-compare-outline"
            size={16}
            color={theme.accentPrimary}
          />
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>
            Connected Documents (Backlinks)
          </Text>
          <View
            style={[
              styles.countBadge,
              { backgroundColor: theme.accentPrimarySoft },
            ]}
          >
            <Text style={[styles.countBadgeText, { color: theme.accentPrimary }]}>
              {neighbors.length}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {expanded && (
            <TouchableOpacity
              onPress={() => setShowMiniGraph(!showMiniGraph)}
              style={[
                styles.miniGraphToggle,
                {
                  backgroundColor: showMiniGraph
                    ? theme.accentPrimarySoft
                    : theme.surface,
                  borderColor: showMiniGraph
                    ? theme.accentPrimary
                    : theme.cardBorder,
                },
              ]}
            >
              <Ionicons
                name="git-network-outline"
                size={12}
                color={showMiniGraph ? theme.accentPrimary : theme.textSecondary}
              />
              <Text
                style={[
                  styles.miniGraphToggleText,
                  {
                    color: showMiniGraph
                      ? theme.accentPrimary
                      : theme.textSecondary,
                  },
                ]}
              >
                1-Hop Map
              </Text>
            </TouchableOpacity>
          )}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={theme.textSecondary}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.bodyCol}>
          {/* Mini 1-Hop Local Graph SVG Preview */}
          {showMiniGraph && (
            <View
              style={[
                styles.miniGraphBox,
                {
                  backgroundColor: theme.graphBackground,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <View style={styles.miniGraphOverlayHeader}>
                <Text style={[styles.miniGraphLabel, { color: theme.textMuted }]}>
                  1-HOP LOCAL NEIGHBORHOOD GRAPH (TAP ANY ORBIT NODE TO JUMP)
                </Text>
              </View>

              <Svg width="100%" height={164} viewBox="0 0 350 164">
                {/* Edges from center to 1-hop neighbors */}
                {neighbors.map(({ node: nb, edge }, idx) => {
                  const angle =
                    (idx / Math.max(1, neighbors.length)) * Math.PI * 2 -
                    Math.PI / 2;
                  const nx = centerX + Math.cos(angle) * (radius + 36);
                  const ny = centerY + Math.sin(angle) * (radius - 4);
                  const strokeColor =
                    edge.relation_type === 'MANUAL_LINK'
                      ? theme.edgeManual
                      : edge.relation_type === 'SHARED_TAG'
                      ? theme.edgeTag
                      : theme.edgeKeyword;

                  return (
                    <G key={`line-${edge.id}`}>
                      <Line
                        x1={centerX}
                        y1={centerY}
                        x2={nx}
                        y2={ny}
                        stroke={strokeColor}
                        strokeWidth={
                          edge.relation_type === 'MANUAL_LINK' ? 2.2 : 1.5
                        }
                        strokeDasharray={
                          edge.relation_type === 'MANUAL_LINK'
                            ? undefined
                            : '4,3'
                        }
                      />
                    </G>
                  );
                })}

                {/* Orbiting 1-Hop Neighbor Nodes */}
                {neighbors.map(({ node: nb }, idx) => {
                  const angle =
                    (idx / Math.max(1, neighbors.length)) * Math.PI * 2 -
                    Math.PI / 2;
                  const nx = centerX + Math.cos(angle) * (radius + 36);
                  const ny = centerY + Math.sin(angle) * (radius - 4);
                  const nbPillar = getNodePillarStyle(nb.type, theme);

                  return (
                    <G
                      key={`nb-${nb.id}`}
                      onPress={() => onNavigateToNode(nb)}
                    >
                      <Circle
                        cx={nx}
                        cy={ny}
                        r={16}
                        fill={theme.surface}
                        stroke={nbPillar.color}
                        strokeWidth={2.5}
                      />
                      <SvgText
                        x={nx}
                        y={ny + 3}
                        fill={nbPillar.color}
                        fontSize="8"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {nbPillar.shortLabel}
                      </SvgText>
                      <SvgText
                        x={nx}
                        y={ny + 27}
                        fill={theme.textSecondary}
                        fontSize="9"
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {nb.title.length > 16
                          ? `${nb.title.slice(0, 15)}…`
                          : nb.title}
                      </SvgText>
                    </G>
                  );
                })}

                {/* Center Focus Node */}
                <G>
                  <Circle
                    cx={centerX}
                    cy={centerY}
                    r={22}
                    fill={centerPillar.softBg}
                    stroke={centerPillar.color}
                    strokeWidth={3}
                  />
                  <SvgText
                    x={centerX}
                    y={centerY + 3.5}
                    fill={centerPillar.color}
                    fontSize="9"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    THIS
                  </SvgText>
                </G>
              </Svg>
            </View>
          )}

          {/* Connected Backlinks List */}
          {neighbors.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>
              No connected documents yet. Type [[ inside the editor or share a #tag to create automatic bidirectional backlinks.
            </Text>
          ) : (
            <View style={styles.listCol}>
              {neighbors.map(({ node: neighbor, edge }) => {
                const nPillar = getNodePillarStyle(neighbor.type, theme);
                const relationBadgeText =
                  edge.relation_type === 'MANUAL_LINK'
                    ? `[[Wiki-Link]]`
                    : edge.relation_type === 'SHARED_TAG'
                    ? `Shared ${edge.label}`
                    : `Auto OCR (${edge.label})`;

                return (
                  <TouchableOpacity
                    key={edge.id}
                    activeOpacity={0.82}
                    onPress={() => onNavigateToNode(neighbor)}
                    style={[
                      styles.backlinkRow,
                      {
                        backgroundColor: theme.surface,
                        borderColor: theme.cardBorder,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.pillarDot,
                        { backgroundColor: nPillar.color },
                      ]}
                    />
                    <View style={styles.backlinkInfo}>
                      <Text
                        style={[
                          styles.backlinkTitle,
                          { color: theme.textPrimary },
                        ]}
                        numberOfLines={1}
                      >
                        {neighbor.title}
                      </Text>
                      <Text
                        style={[
                          styles.backlinkPath,
                          { color: theme.textMuted },
                        ]}
                        numberOfLines={1}
                      >
                        {neighbor.file_path}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.relationPill,
                        {
                          backgroundColor:
                            edge.relation_type === 'MANUAL_LINK'
                              ? theme.accentPrimarySoft
                              : theme.surfaceElevated,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.relationPillText,
                          {
                            color:
                              edge.relation_type === 'MANUAL_LINK'
                                ? theme.accentPrimary
                                : theme.textSecondary,
                          },
                        ]}
                      >
                        {relationBadgeText}
                      </Text>
                    </View>

                    <Ionicons
                      name="arrow-forward-circle-outline"
                      size={17}
                      color={theme.accentPrimary}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {onPackNeighborhoodForAi && (
            <TouchableOpacity
              onPress={() => onPackNeighborhoodForAi(currentNode.id)}
              style={[
                styles.packNeighborhoodBtn,
                {
                  backgroundColor: theme.accentPrimarySoft,
                  borderColor: theme.accentPrimary,
                },
              ]}
            >
              <Ionicons name="sparkles" size={14} color={theme.accentPrimary} />
              <Text
                style={[
                  styles.packNeighborhoodText,
                  { color: theme.accentPrimary },
                ]}
              >
                Send This Document + {neighbors.length} Connected Backlinks to AI Packer
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  trayContainer: {
    borderRadius: 15,
    borderWidth: 1,
    padding: 12,
    marginTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flex: 1,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  countBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  miniGraphToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 7,
    borderWidth: 1,
  },
  miniGraphToggleText: {
    fontSize: 10,
    fontWeight: '700',
  },
  bodyCol: {
    marginTop: 10,
    gap: 10,
  },
  miniGraphBox: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  miniGraphOverlayHeader: {
    paddingHorizontal: 10,
    paddingTop: 7,
  },
  miniGraphLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  emptyText: {
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 17,
  },
  listCol: {
    gap: 7,
  },
  backlinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    padding: 10,
    borderRadius: 11,
    borderWidth: 1,
  },
  pillarDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  backlinkInfo: {
    flex: 1,
  },
  backlinkTitle: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  backlinkPath: {
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 1,
  },
  relationPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  relationPillText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  packNeighborhoodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  packNeighborhoodText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
});
