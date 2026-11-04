import React from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ThemeProvider, useAppTheme } from './src/theme/ThemeContext';
import { VaultProvider, useVault } from './src/store/VaultContext';
import { GlobalHeader } from './src/components/GlobalHeader';
import { BottomTabNav } from './src/components/BottomTabNav';
import { SmartFabMenu } from './src/components/SmartFabMenu';
import { OnboardingCoachModal } from './src/components/OnboardingCoachModal';
import { SyncAndVaultInspectorModal } from './src/components/SyncAndVaultInspectorModal';
import { NodeQuickPreviewModal } from './src/components/NodeQuickPreviewModal';
import { VaultHomeScreen } from './src/screens/VaultHomeScreen';
import { DocuMapGraphScreen } from './src/screens/DocuMapGraphScreen';
import { AiPackerScreen } from './src/screens/AiPackerScreen';
import { SettingsAndSyncScreen } from './src/screens/SettingsAndSyncScreen';

const DocuMapShell: React.FC = () => {
  const { theme } = useAppTheme();
  const { isLoading, activeTab } = useVault();

  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: theme.background },
        ]}
      >
        <ActivityIndicator size="large" color={theme.accentPrimary} />
        <Text style={[styles.loadingTitle, { color: theme.textPrimary }]}>
          Initializing DocuMap_Vault/ & SQLite FTS5…
        </Text>
        <Text style={[styles.loadingSub, { color: theme.textSecondary }]}>
          100% Local-First • Zero Cloud Servers • Pre-Loading Starter Demo Vault
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: theme.background },
      ]}
    >
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.surface}
      />

      {/* Top Global Header: FTS5 Search + Live Cloud Sync Pill */}
      <GlobalHeader />

      {/* Main Active Tab Viewport */}
      <View style={styles.mainViewport}>
        {activeTab === 'VAULT' && <VaultHomeScreen />}
        {activeTab === 'DOCUMAP' && <DocuMapGraphScreen />}
        {activeTab === 'AI_PACKER' && <AiPackerScreen />}
        {activeTab === 'SETTINGS' && <SettingsAndSyncScreen />}
      </View>

      {/* Corner Smart Floating Action Button (+) */}
      <SmartFabMenu />

      {/* 4-Tab Bottom Navigation Bar */}
      <BottomTabNav />

      {/* Modals & Drawers */}
      <OnboardingCoachModal />
      <SyncAndVaultInspectorModal />
      <NodeQuickPreviewModal />
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <VaultProvider>
        <DocuMapShell />
      </VaultProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  mainViewport: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 14,
  },
  loadingSub: {
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
});
