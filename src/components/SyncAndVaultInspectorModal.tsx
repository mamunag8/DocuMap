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
import { useVault } from '../store/VaultContext';
import { VirtualVaultFile } from '../filesystem/vaultFileManager';

export const SyncAndVaultInspectorModal: React.FC = () => {
  const { theme } = useAppTheme();
  const {
    isSyncInspectorOpen,
    setIsSyncInspectorOpen,
    vaultFiles,
    cloudSyncState,
    triggerQuickDeltaSync,
    nodes,
    edges,
  } = useVault();

  const [selectedFile, setSelectedFile] = useState<VirtualVaultFile | null>(null);

  if (!isSyncInspectorOpen) return null;

  const activeFile =
    selectedFile ??
    vaultFiles.find((f) => f.relativePath.endsWith('graph_state.json')) ??
    vaultFiles[0] ??
    null;

  return (
    <Modal
      visible={isSyncInspectorOpen}
      transparent
      animationType="slide"
      onRequestClose={() => setIsSyncInspectorOpen(false)}
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
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.headerIcon,
                  { backgroundColor: theme.accentPrimarySoft },
                ]}
              >
                <Ionicons
                  name="folder-open-outline"
                  size={20}
                  color={theme.accentPrimary}
                />
              </View>
              <View>
                <Text style={[styles.title, { color: theme.textPrimary }]}>
                  DocuMap_Vault/ File System & Delta Sync
                </Text>
                <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                  100% Portable Local Directory • Ready for PC (VS Code / Obsidian / PDF)
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => setIsSyncInspectorOpen(false)}
              style={[
                styles.closeBtn,
                { backgroundColor: theme.surfaceElevated },
              ]}
            >
              <Ionicons name="close" size={18} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Sync Status Summary Bar */}
          <View
            style={[
              styles.syncSummaryBox,
              {
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <View style={styles.syncStatsCol}>
              <Text style={[styles.syncStatusLabel, { color: theme.textPrimary }]}>
                Status:{' '}
                <Text style={{ color: theme.success }}>
                  {cloudSyncState === 'SYNCING'
                    ? 'Running Delta Hash Verification…'
                    : 'All Local Files & graph_state.json Synced ✓'}
                </Text>
              </Text>
              <Text style={[styles.syncMetaText, { color: theme.textSecondary }]}>
                {nodes.length} VaultNodes • {edges.length} Bidirectional Edges •{' '}
                {vaultFiles.length} Portable Files on Disk
              </Text>
            </View>

            <TouchableOpacity
              onPress={triggerQuickDeltaSync}
              style={[
                styles.syncNowBtn,
                { backgroundColor: theme.accentPrimary },
              ]}
            >
              <Ionicons name="sync-outline" size={14} color="#FFFFFF" />
              <Text style={styles.syncNowBtnText}>Delta Sync</Text>
            </TouchableOpacity>
          </View>

          {/* Directory Tree List */}
          <Text style={[styles.sectionHeader, { color: theme.textSecondary }]}>
            PORTABLE DIRECTORY TREE (TAP ANY FILE TO INSPECT RAW PAYLOAD)
          </Text>

          <ScrollView style={styles.filesList} nestedScrollEnabled>
            {vaultFiles.map((file) => {
              const isSelected = activeFile?.relativePath === file.relativePath;
              const badgeColor =
                file.directory === 'Scans'
                  ? theme.nodeScan
                  : file.directory === 'Notes'
                  ? theme.nodeNote
                  : file.directory === 'Logs'
                  ? theme.nodeLog
                  : theme.accentPrimary;

              return (
                <TouchableOpacity
                  key={file.relativePath}
                  onPress={() => setSelectedFile(file)}
                  style={[
                    styles.fileRow,
                    {
                      backgroundColor: isSelected
                        ? theme.surfaceHighlight
                        : theme.surfaceElevated,
                      borderColor: isSelected
                        ? theme.accentPrimary
                        : theme.cardBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.dirPill,
                      { backgroundColor: theme.surface },
                    ]}
                  >
                    <Text style={[styles.dirPillText, { color: badgeColor }]}>
                      /{file.directory}
                    </Text>
                  </View>
                  <Text
                    style={[styles.filePathText, { color: theme.textPrimary }]}
                    numberOfLines={1}
                  >
                    {file.relativePath}
                  </Text>
                  <Text style={[styles.fileSizeText, { color: theme.textMuted }]}>
                    {(file.sizeBytes / 1024).toFixed(1)} KB
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Raw File Inspector Preview */}
          {activeFile && (
            <View
              style={[
                styles.previewBox,
                {
                  backgroundColor: theme.background,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <View style={styles.previewHeader}>
                <Text
                  style={[styles.previewTitle, { color: theme.accentPrimary }]}
                  numberOfLines={1}
                >
                  {activeFile.relativePath}
                </Text>
                <Text style={[styles.previewMime, { color: theme.textMuted }]}>
                  {activeFile.mimeType}
                </Text>
              </View>
              <ScrollView style={styles.previewCodeScroll} nestedScrollEnabled>
                <Text style={[styles.previewCodeText, { color: theme.textSecondary }]}>
                  {activeFile.contentPreview}
                </Text>
              </ScrollView>
            </View>
          )}
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
    maxHeight: '88%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15.5,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncSummaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 13,
    borderWidth: 1,
    marginBottom: 14,
    gap: 10,
  },
  syncStatsCol: {
    flex: 1,
  },
  syncStatusLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    marginBottom: 3,
  },
  syncMetaText: {
    fontSize: 11,
    fontWeight: '500',
  },
  syncNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  syncNowBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  filesList: {
    maxHeight: 165,
    marginBottom: 12,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
    gap: 8,
  },
  dirPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  dirPillText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  filePathText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  fileSizeText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  previewBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    maxHeight: 210,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    fontFamily: 'monospace',
    flex: 1,
  },
  previewMime: {
    fontSize: 10,
    fontWeight: '700',
  },
  previewCodeScroll: {
    maxHeight: 155,
  },
  previewCodeText: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: 'monospace',
  },
});
