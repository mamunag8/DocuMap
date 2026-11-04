import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { useVault } from '../store/VaultContext';
import { ThemeMode } from '../models/types';

export const SettingsAndSyncScreen: React.FC = () => {
  const { theme, themeMode, setThemeMode } = useAppTheme();
  const {
    openOnboardingModal,
    hasDemoNodes,
    deleteStarterDemoVault,
    restoreStarterDemoVault,
    setIsSyncInspectorOpen,
    triggerQuickDeltaSync,
    vaultFiles,
    nodes,
    edges,
  } = useVault();

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Theme Engine Section (Light / Dark / OLED True Black) */}
      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
        APPEARANCE & OLED THEME ENGINE
      </Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        <View style={styles.themeRow}>
          {(
            [
              { key: 'light', label: 'Light', icon: 'sunny-outline' },
              { key: 'dark', label: 'Dark Slate', icon: 'moon-outline' },
              { key: 'oled', label: 'OLED Black', icon: 'contrast-outline' },
            ] as Array<{
              key: ThemeMode;
              label: string;
              icon: keyof typeof Ionicons.glyphMap;
            }>
          ).map((item) => {
            const active = themeMode === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setThemeMode(item.key)}
                style={[
                  styles.themeOption,
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
                <Ionicons
                  name={item.icon}
                  size={16}
                  color={active ? '#FFFFFF' : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.themeOptionText,
                    { color: active ? '#FFFFFF' : theme.textPrimary },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Interactive Tutorial & Starter Demo Vault Controls */}
      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
        60-SECOND INTERACTIVE TUTORIAL & STARTER DEMO VAULT
      </Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        <TouchableOpacity
          onPress={openOnboardingModal}
          style={[
            styles.actionRow,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <Ionicons
            name="school-outline"
            size={20}
            color={theme.accentPrimary}
          />
          <View style={styles.actionTextCol}>
            <Text style={[styles.actionTitle, { color: theme.textPrimary }]}>
              Replay 4-Slide Visual Coach-Mark Tutorial
            </Text>
            <Text style={[styles.actionSub, { color: theme.textSecondary }]}>
              Learn Scan & Write, [[Wiki-Links]], DocuMap & AI Token-Saver in 60s
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={theme.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={
            hasDemoNodes ? deleteStarterDemoVault : restoreStarterDemoVault
          }
          style={[
            styles.actionRow,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <Ionicons
            name={hasDemoNodes ? 'trash-outline' : 'refresh-outline'}
            size={20}
            color={hasDemoNodes ? theme.danger : theme.success}
          />
          <View style={styles.actionTextCol}>
            <Text style={[styles.actionTitle, { color: theme.textPrimary }]}>
              {hasDemoNodes
                ? 'Delete "📌 Start Here (Demo)" Sample Nodes'
                : 'Restore "📌 Start Here (Demo)" Starter Vault'}
            </Text>
            <Text style={[styles.actionSub, { color: theme.textSecondary }]}>
              3 interlinked nodes: Invoice Scan + Budget Note + Equipment Expense Log
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={theme.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Portable File System & BYOC Cloud Sync Engine */}
      <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
        ZERO-COST BYOC CLOUD SYNC (PHONE &lt;-&gt; PC)
      </Text>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.surface,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => setIsSyncInspectorOpen(true)}
          style={[
            styles.actionRow,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.accentPrimary,
            },
          ]}
        >
          <Ionicons
            name="folder-open-outline"
            size={20}
            color={theme.accentPrimary}
          />
          <View style={styles.actionTextCol}>
            <Text style={[styles.actionTitle, { color: theme.textPrimary }]}>
              Inspect Portable DocuMap_Vault/ File Tree
            </Text>
            <Text style={[styles.actionSub, { color: theme.textSecondary }]}>
              {vaultFiles.length} local files (/Scans, /Notes, /Logs & graph_state.json)
            </Text>
          </View>
          <Ionicons
            name="code-working-outline"
            size={18}
            color={theme.accentPrimary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={triggerQuickDeltaSync}
          style={[
            styles.actionRow,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <Ionicons name="logo-google" size={19} color={theme.nodeScan} />
          <View style={styles.actionTextCol}>
            <Text style={[styles.actionTitle, { color: theme.textPrimary }]}>
              Google Drive Direct Sync (drive.file + appDataFolder)
            </Text>
            <Text style={[styles.actionSub, { color: theme.textSecondary }]}>
              Delta-syncs {nodes.length} nodes & {edges.length} edges to your own 15GB Google Drive
            </Text>
          </View>
          <Text style={[styles.statusChip, { color: theme.success }]}>
            Ready
          </Text>
        </TouchableOpacity>

        <View
          style={[
            styles.actionRow,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <Ionicons name="cloud-outline" size={20} color={theme.nodeNote} />
          <View style={styles.actionTextCol}>
            <Text style={[styles.actionTitle, { color: theme.textPrimary }]}>
              Local Cloud Folder Bridge & WebDAV
            </Text>
            <Text style={[styles.actionSub, { color: theme.textSecondary }]}>
              Bind directly to iCloud Drive, OneDrive, Dropbox, Syncthing, or Nextcloud WebDAV
            </Text>
          </View>
        </View>
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
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 9,
    marginBottom: 16,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 11,
    borderWidth: 1,
  },
  themeOptionText: {
    fontSize: 12,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionTextCol: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  actionSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  statusChip: {
    fontSize: 11.5,
    fontWeight: '800',
  },
});
