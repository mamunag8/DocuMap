import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { getNodePillarStyle } from '../theme/theme';
import { useVault } from '../store/VaultContext';
import { SearchMatchResult } from '../models/types';

export const GlobalHeader: React.FC = () => {
  const { theme, themeMode, cycleThemeMode } = useAppTheme();
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    cloudSyncState,
    setIsSyncInspectorOpen,
    openOnboardingModal,
    setInspectingNode,
    packNodeWithFirstDegreeLinks,
  } = useVault();

  const renderSyncPill = () => {
    let label = 'Synced ✓';
    let dotColor = theme.success;
    let pillBg = theme.successSoft;

    if (cloudSyncState === 'SYNCING') {
      label = 'Syncing Delta…';
      dotColor = theme.warning;
      pillBg = theme.warningSoft;
    } else if (cloudSyncState === 'OFFLINE_LOCAL') {
      label = 'Offline • Saved Locally';
      dotColor = theme.textMuted;
      pillBg = theme.surfaceElevated;
    }

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setIsSyncInspectorOpen(true)}
        style={[
          styles.syncPill,
          {
            backgroundColor: pillBg,
            borderColor: theme.cardBorder,
          },
        ]}
      >
        <View style={[styles.syncDot, { backgroundColor: dotColor }]} />
        <Text style={[styles.syncPillText, { color: theme.textPrimary }]} numberOfLines={1}>
          {label}
        </Text>
        <Ionicons name="chevron-down" size={12} color={theme.textSecondary} />
      </TouchableOpacity>
    );
  };

  const renderMatchedFieldBadge = (field: SearchMatchResult['matched_in'][number]) => {
    const labelMap: Record<SearchMatchResult['matched_in'][number], string> = {
      TITLE: 'Title',
      FILENAME: 'File Path',
      CONTENT_OCR: 'OCR / Markdown',
      TAGS: '#Tag',
      DATA_LOG: 'Data Log Cell',
    };
    return (
      <View
        key={field}
        style={[
          styles.matchBadge,
          {
            backgroundColor: theme.accentPrimarySoft,
          },
        ]}
      >
        <Text style={[styles.matchBadgeText, { color: theme.accentPrimary }]}>
          {labelMap[field]}
        </Text>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.headerContainer,
        {
          backgroundColor: theme.surface,
          borderBottomColor: theme.divider,
        },
      ]}
    >
      {/* Top Brand Bar + Live Cloud Sync Pill + Theme & Guide Buttons */}
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          <View
            style={[
              styles.logoBadge,
              {
                backgroundColor: theme.accentPrimary,
              },
            ]}
          >
            <Ionicons name="git-network-outline" size={18} color="#FFFFFF" />
          </View>
          <View>
            <View style={styles.titleWithBadge}>
              <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>DocuMap</Text>
              <View
                style={[
                  styles.localFirstTag,
                  { backgroundColor: theme.surfaceElevated, borderColor: theme.cardBorder },
                ]}
              >
                <Text style={[styles.localFirstTagText, { color: theme.textSecondary }]}>
                  LOCAL-FIRST
                </Text>
              </View>
            </View>
            <Text style={[styles.brandSubtitle, { color: theme.textMuted }]}>
              Personal Vault & Knowledge Map
            </Text>
          </View>
        </View>

        <View style={styles.rightControls}>
          {renderSyncPill()}

          <TouchableOpacity
            onPress={openOnboardingModal}
            style={[
              styles.iconBtn,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.cardBorder },
            ]}
            accessibilityLabel="Replay 60-Second Interactive Tutorial"
          >
            <Ionicons name="help-circle-outline" size={18} color={theme.accentPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={cycleThemeMode}
            style={[
              styles.iconBtn,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.cardBorder },
            ]}
            accessibilityLabel="Switch Light, Dark, or OLED Theme"
          >
            <Ionicons
              name={
                themeMode === 'light'
                  ? 'sunny-outline'
                  : themeMode === 'oled'
                  ? 'contrast-outline'
                  : 'moon-outline'
              }
              size={17}
              color={theme.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Instant Universal FTS5 Search Bar */}
      <View
        style={[
          styles.searchBarWrapper,
          {
            backgroundColor: theme.surfaceElevated,
            borderColor: searchQuery.trim() ? theme.accentPrimary : theme.cardBorder,
          },
        ]}
      >
        <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search filenames, Markdown, #tags & inside scanned PDF OCR…"
          placeholderTextColor={theme.textMuted}
          style={[styles.searchInput, { color: theme.textPrimary }]}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View
          style={[
            styles.ftsPill,
            { backgroundColor: theme.surface, borderColor: theme.cardBorder },
          ]}
        >
          <Text style={[styles.ftsPillText, { color: theme.textMuted }]}>FTS5</Text>
        </View>
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color={theme.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Instant FTS5 Universal Search Results Dropdown */}
      {searchQuery.trim().length > 0 && (
        <View
          style={[
            styles.searchResultsPanel,
            {
              backgroundColor: theme.surfaceElevated,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <View style={styles.searchResultsHeader}>
            <Text style={[styles.searchResultsCount, { color: theme.textSecondary }]}>
              {searchResults.length === 0
                ? `No FTS5 matches for "${searchQuery}"`
                : `${searchResults.length} instant FTS5 match${
                    searchResults.length === 1 ? '' : 'es'
                  } across Scans, Notes & Logs`}
            </Text>
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={[styles.closeSearchText, { color: theme.accentPrimary }]}>
                Close
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.searchResultsScroll} keyboardShouldPersistTaps="handled">
            {searchResults.map((res) => {
              const pillar = getNodePillarStyle(res.node.type, theme);
              return (
                <TouchableOpacity
                  key={res.node.id}
                  activeOpacity={0.82}
                  onPress={() => {
                    setInspectingNode(res.node);
                    setSearchQuery('');
                  }}
                  style={[
                    styles.searchResultCard,
                    {
                      backgroundColor: theme.surface,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.searchResultTop}>
                    <View
                      style={[
                        styles.typeBadge,
                        { backgroundColor: pillar.softBg, borderColor: pillar.borderColor },
                      ]}
                    >
                      <Ionicons name={pillar.iconName} size={12} color={pillar.color} />
                      <Text style={[styles.typeBadgeText, { color: pillar.color }]}>
                        {pillar.shortLabel}
                      </Text>
                    </View>
                    <Text
                      style={[styles.searchResultTitle, { color: theme.textPrimary }]}
                      numberOfLines={1}
                    >
                      {res.node.title}
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        packNodeWithFirstDegreeLinks(res.node.id);
                        setSearchQuery('');
                      }}
                      style={[
                        styles.packQuickBtn,
                        { backgroundColor: theme.accentPrimarySoft },
                      ]}
                    >
                      <Ionicons name="sparkles" size={11} color={theme.accentPrimary} />
                      <Text style={[styles.packQuickBtnText, { color: theme.accentPrimary }]}>
                        AI Pack
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text
                    style={[styles.searchSnippet, { color: theme.textSecondary }]}
                    numberOfLines={2}
                  >
                    {res.snippet}
                  </Text>

                  <View style={styles.matchBadgesRow}>
                    <Text style={[styles.filePathText, { color: theme.textMuted }]}>
                      {res.node.file_path}
                    </Text>
                    <View style={styles.badgesGroup}>
                      {res.matched_in.map(renderMatchedFieldBadge)}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    zIndex: 30,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  localFirstTag: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
  },
  localFirstTagText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  brandSubtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    gap: 5,
  },
  syncDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  syncPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 11,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    paddingVertical: 6,
  },
  ftsPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  ftsPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  clearBtn: {
    padding: 2,
  },
  searchResultsPanel: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    padding: 10,
    maxHeight: 310,
  },
  searchResultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  searchResultsCount: {
    fontSize: 11,
    fontWeight: '700',
  },
  closeSearchText: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchResultsScroll: {
    maxHeight: 260,
  },
  searchResultCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 7,
  },
  searchResultTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 4,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  searchResultTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  packQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  packQuickBtnText: {
    fontSize: 10,
    fontWeight: '700',
  },
  searchSnippet: {
    fontSize: 11.5,
    lineHeight: 16,
    marginBottom: 6,
  },
  matchBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 4,
  },
  filePathText: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
  badgesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  matchBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  matchBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
});
