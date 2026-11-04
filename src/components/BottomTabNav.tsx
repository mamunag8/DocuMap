import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { useVault } from '../store/VaultContext';
import { AppTab } from '../models/types';

export const BottomTabNav: React.FC = () => {
  const { theme } = useAppTheme();
  const {
    activeTab,
    setActiveTab,
    nodes,
    edges,
    aiPackerNodeIds,
  } = useVault();

  const tabs: Array<{
    key: AppTab;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    activeIcon: keyof typeof Ionicons.glyphMap;
    badge?: string | number;
  }> = [
    {
      key: 'VAULT',
      label: 'Vault',
      icon: 'folder-outline',
      activeIcon: 'folder',
      badge: nodes.length,
    },
    {
      key: 'DOCUMAP',
      label: 'DocuMap',
      icon: 'git-network-outline',
      activeIcon: 'git-network',
      badge: edges.length > 0 ? `${edges.length}e` : undefined,
    },
    {
      key: 'AI_PACKER',
      label: 'AI Packer',
      icon: 'sparkles-outline',
      activeIcon: 'sparkles',
      badge: aiPackerNodeIds.length > 0 ? aiPackerNodeIds.length : undefined,
    },
    {
      key: 'SETTINGS',
      label: 'Sync & Guide',
      icon: 'cloud-done-outline',
      activeIcon: 'cloud-done',
    },
  ];

  return (
    <View
      style={[
        styles.tabBar,
        {
          backgroundColor: theme.surface,
          borderTopColor: theme.divider,
        },
      ]}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            activeOpacity={0.8}
            onPress={() => setActiveTab(tab.key)}
            style={styles.tabItem}
          >
            <View
              style={[
                styles.iconPill,
                isActive && {
                  backgroundColor: theme.accentPrimarySoft,
                },
              ]}
            >
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={20}
                color={isActive ? theme.accentPrimary : theme.textMuted}
              />
              {tab.badge !== undefined && (
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: isActive
                        ? theme.accentPrimary
                        : theme.surfaceElevated,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      {
                        color: isActive ? '#FFFFFF' : theme.textSecondary,
                      },
                    ]}
                  >
                    {tab.badge}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.tabLabel,
                {
                  color: isActive ? theme.accentPrimary : theme.textMuted,
                  fontWeight: isActive ? '800' : '600',
                },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: 68,
    borderTopWidth: 1,
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 999,
    position: 'relative',
  },
  badge: {
    marginLeft: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  tabLabel: {
    fontSize: 11,
  },
});
