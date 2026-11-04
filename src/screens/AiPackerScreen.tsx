import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { getNodePillarStyle } from '../theme/theme';
import { useVault } from '../store/VaultContext';
import { estimateTokens, serializeLogToCsv } from '../core/linkAndTokenEngine';

export const AiPackerScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const {
    nodes,
    edges,
    logSchemas,
    logEntries,
    aiPackerNodeIds,
    toggleNodeInAiPacker,
  } = useVault();

  const [stripBoilerplate, setStripBoilerplate] = useState<boolean>(true);
  const [dedupHeaders, setDedupHeaders] = useState<boolean>(true);
  const [compactLogsCsv, setCompactLogsCsv] = useState<boolean>(true);
  const [injectRelationalHeader, setInjectRelationalHeader] = useState<boolean>(true);
  const [copiedBanner, setCopiedBanner] = useState<boolean>(false);

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
          return `### DOCUMENT: ${n.title}\nFILE: ${n.file_path}\n${n.content_md}\nRAW_JSON_ENTRIES:\n${JSON.stringify(
            entries,
            null,
            2
          )}`;
        }
        return `### DOCUMENT: ${n.title}\nFILE: ${n.file_path}\nTAGS: ${JSON.stringify(
          n.tags
        )}\n\n${n.content_md}`;
      })
      .join('\n\n========================================\n\n');
  }, [selectedNodes, logEntries]);

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
        const s = selectedNodes.find((n) => n.id === e.source_node_id)?.title ?? e.source_node_id;
        const t = selectedNodes.find((n) => n.id === e.target_node_id)?.title ?? e.target_node_id;
        return `  - "${s} <-> ${t} (${e.relation_type}: ${e.label})"`;
      });

      parts.push(
        [
          '---',
          'documap_context_bundle: v1.0',
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
          .replace(/^#+\s*Structured Data Log:.*$/gim, '');
      }

      if (stripBoilerplate) {
        body = body
          .replace(/\|?\s*:?---+:?\s*\|/g, '|')
          .replace(/\n{3,}/g, '\n')
          .replace(/[ \t]{2,}/g, ' ')
          .trim();
      }

      parts.push(
        `[${node.type}:${node.title}|#${node.tags.join(',')}]\n${body}`
      );
    }

    return parts.join('\n\n');
  }, [
    selectedNodes,
    edges,
    logSchemas,
    logEntries,
    stripBoilerplate,
    dedupHeaders,
    compactLogsCsv,
    injectRelationalHeader,
  ]);

  const rawTokens = useMemo(() => estimateTokens(rawPayload), [rawPayload]);
  const optimizedTokens = useMemo(
    () => estimateTokens(optimizedPayload),
    [optimizedPayload]
  );

  const savedPercent =
    rawTokens > 0
      ? Math.max(0, Math.round(((rawTokens - optimizedTokens) / rawTokens) * 100))
      : 0;

  const handleCopyPrompt = async () => {
    if (!optimizedPayload) return;
    try {
      await Clipboard.setStringAsync(optimizedPayload);
    } catch {
      // Fallback
    }
    setCopiedBanner(true);
    setTimeout(() => setCopiedBanner(false), 2400);
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}
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
              AI Token-Saver & Context Bundler
            </Text>
            <Text style={[styles.meterSub, { color: theme.textSecondary }]}>
              Claude 3.5/4 • GPT-4o • Gemini • Local LLMs
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

      {/* Context Cart: Toggle VaultNodes in/out */}
      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
        CONTEXT CART ({selectedNodes.length} OF {nodes.length} DOCUMENTS SELECTED)
      </Text>
      <View style={styles.cartList}>
        {nodes.map((node) => {
          const selected = aiPackerNodeIds.includes(node.id);
          const pillar = getNodePillarStyle(node.type, theme);
          return (
            <TouchableOpacity
              key={node.id}
              onPress={() => toggleNodeInAiPacker(node.id)}
              style={[
                styles.cartRow,
                {
                  backgroundColor: theme.surface,
                  borderColor: selected ? pillar.color : theme.cardBorder,
                },
              ]}
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
                  {pillar.shortLabel} • {node.token_count} tok
                </Text>
              </View>
            </TouchableOpacity>
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
            label: 'Convert Data Logs into ultra-compact CSV/YAML instead of verbose JSON',
            val: compactLogsCsv,
            setter: setCompactLogsCsv,
          },
          {
            label: 'Inject Relational Map Header (compact YAML frontmatter)',
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
          {optimizedPayload || 'Select at least one document above to generate an AI context bundle.'}
        </Text>
      </View>

      <TouchableOpacity
        onPress={handleCopyPrompt}
        style={[
          styles.copyBtn,
          {
            backgroundColor: copiedBanner ? theme.success : theme.accentPrimary,
          },
        ]}
      >
        <Ionicons
          name={copiedBanner ? 'checkmark-circle' : 'copy-outline'}
          size={18}
          color="#FFFFFF"
        />
        <Text style={styles.copyBtnText}>
          {copiedBanner
            ? `Copied Compressed Bundle (${optimizedTokens} tokens, -${savedPercent}%)!`
            : 'Copy Optimized Prompt to Clipboard'}
        </Text>
      </TouchableOpacity>
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
    marginBottom: 14,
  },
  meterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  cartList: {
    gap: 7,
    marginBottom: 14,
  },
  cartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  cartInfo: {
    flex: 1,
  },
  cartTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  cartPath: {
    fontSize: 11,
    marginTop: 2,
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
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 13,
  },
  copyBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
});
