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
import { getNodePillarStyle } from '../theme/theme';
import { useVault } from '../store/VaultContext';
import {
  VaultFilterCategory,
  VaultNode,
  VaultSortBy,
} from '../models/types';

const FILTER_PILLS: Array<{
  key: VaultFilterCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'ALL', label: 'All', icon: 'apps-outline' },
  { key: 'SCAN', label: 'Scans', icon: 'document-text-outline' },
  { key: 'NOTE', label: 'Notes', icon: 'create-outline' },
  { key: 'LOG', label: 'Data Logs', icon: 'grid-outline' },
  { key: 'TAGS', label: '#Tags', icon: 'pricetag-outline' },
  { key: 'FOLDERS', label: 'Folders', icon: 'folder-open-outline' },
];

export const VaultHomeScreen: React.FC = () => {
  const { theme } = useAppTheme();
  const {
    nodes,
    edges,
    folders,
    filteredNodes,
    filterCategory,
    setFilterCategory,
    selectedTag,
    setSelectedTag,
    selectedFolderId,
    setSelectedFolderId,
    viewMode,
    setViewMode,
    sortBy,
    setSortBy,
    allUniqueTags,
    hasDemoNodes,
    deleteStarterDemoVault,
    restoreStarterDemoVault,
    tutorialState,
    dismissWalkthroughBanner,
    setActiveTab,
    setInspectingNode,
    getConnectedNeighbors,
    packNodeWithFirstDegreeLinks,
    aiPackerNodeIds,
    toggleNodeInAiPacker,
  } = useVault();

  const cycleSortBy = () => {
    const order: VaultSortBy[] = ['UPDATED_DESC', 'TITLE_ASC', 'TOKENS_DESC', 'TYPE'];
    const next = order[(order.indexOf(sortBy) + 1) % order.length];
    setSortBy(next);
  };

  const getSortLabel = (s: VaultSortBy) => {
    if (s === 'TITLE_ASC') return 'A–Z';
    if (s === 'TOKENS_DESC') return 'Tokens ↓';
    if (s === 'TYPE') return 'Type';
    return 'Recent';
  };

  const renderNodePreviewExcerpt = (node: VaultNode) => {
    return node.content_md
      .replace(/^#+\s*/gm, '')
      .replace(/\|/g, ' ')
      .replace(/---/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 125);
  };

  const renderGridNodeCard = (node: VaultNode) => {
    const pillar = getNodePillarStyle(node.type, theme);
    const neighbors = getConnectedNeighbors(node.id);
    const isPacked = aiPackerNodeIds.includes(node.id);

    return (
      <TouchableOpacity
        key={node.id}
        activeOpacity={0.86}
        onPress={() => setInspectingNode(node)}
        style={[
          styles.gridCard,
          {
            backgroundColor: theme.surface,
            borderColor: isPacked ? pillar.color : theme.cardBorder,
          },
        ]}
      >
        {/* Visual Thumbnail Header */}
        <View
          style={[
            styles.thumbnailBanner,
            {
              backgroundColor: pillar.softBg,
              borderColor: pillar.borderColor,
            },
          ]}
        >
          <View style={styles.thumbnailTopRow}>
            <View
              style={[
                styles.pillarChip,
                { backgroundColor: theme.surface },
              ]}
            >
              <Ionicons name={pillar.iconName} size={12} color={pillar.color} />
              <Text style={[styles.pillarChipText, { color: pillar.color }]}>
                {pillar.shortLabel}
              </Text>
            </View>

            {node.scan_mode && (
              <View
                style={[
                  styles.scanModeChip,
                  { backgroundColor: pillar.color },
                ]}
              >
                <Text style={styles.scanModeChipText}>
                  {node.scan_mode} • {node.page_count ?? 1}P
                </Text>
              </View>
            )}

            {node.is_demo && (
              <View
                style={[
                  styles.demoMiniBadge,
                  { backgroundColor: theme.surface },
                ]}
              >
                <Text style={[styles.demoMiniBadgeText, { color: theme.accentPrimary }]}>
                  DEMO
                </Text>
              </View>
            )}
          </View>

          {/* Mini Document Visual Wireframe inside Thumbnail */}
          <View style={styles.thumbnailPreviewLines}>
            <Text
              style={[styles.thumbnailSnippetText, { color: theme.textSecondary }]}
              numberOfLines={3}
            >
              {renderNodePreviewExcerpt(node)}
            </Text>
          </View>
        </View>

        {/* Card Body */}
        <Text
          style={[styles.cardTitle, { color: theme.textPrimary }]}
          numberOfLines={2}
        >
          {node.title}
        </Text>

        <Text
          style={[styles.cardFilePath, { color: theme.textMuted }]}
          numberOfLines={1}
        >
          {node.file_path}
        </Text>

        {/* Tags Strip */}
        <View style={styles.cardTagsRow}>
          {node.tags.slice(0, 3).map((tag) => (
            <TouchableOpacity
              key={tag}
              onPress={() => {
                setFilterCategory('TAGS');
                setSelectedTag(tag);
              }}
              style={[
                styles.tagPill,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <Text style={[styles.tagPillText, { color: theme.textSecondary }]}>
                #{tag}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Footer Metrics & Quick AI Pack */}
        <View
          style={[
            styles.cardFooter,
            { borderTopColor: theme.divider },
          ]}
        >
          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Ionicons
                name="git-network-outline"
                size={12}
                color={theme.accentPrimary}
              />
              <Text style={[styles.metricText, { color: theme.textSecondary }]}>
                {neighbors.length} links
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Ionicons name="flash-outline" size={12} color={theme.nodeLog} />
              <Text style={[styles.metricText, { color: theme.textSecondary }]}>
                {node.token_count} tok
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => toggleNodeInAiPacker(node.id)}
            style={[
              styles.aiCartBtn,
              {
                backgroundColor: isPacked
                  ? theme.accentPrimary
                  : theme.surfaceElevated,
              },
            ]}
          >
            <Ionicons
              name={isPacked ? 'checkmark-circle' : 'sparkles-outline'}
              size={12}
              color={isPacked ? '#FFFFFF' : theme.accentPrimary}
            />
            <Text
              style={[
                styles.aiCartBtnText,
                { color: isPacked ? '#FFFFFF' : theme.accentPrimary },
              ]}
            >
              {isPacked ? 'In Cart' : '+ AI'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCompactListNodeCard = (node: VaultNode) => {
    const pillar = getNodePillarStyle(node.type, theme);
    const neighbors = getConnectedNeighbors(node.id);
    const isPacked = aiPackerNodeIds.includes(node.id);

    return (
      <TouchableOpacity
        key={node.id}
        activeOpacity={0.86}
        onPress={() => setInspectingNode(node)}
        style={[
          styles.listCard,
          {
            backgroundColor: theme.surface,
            borderColor: isPacked ? pillar.color : theme.cardBorder,
          },
        ]}
      >
        <View
          style={[
            styles.listIconBox,
            {
              backgroundColor: pillar.softBg,
              borderColor: pillar.borderColor,
            },
          ]}
        >
          <Ionicons name={pillar.iconName} size={20} color={pillar.color} />
        </View>

        <View style={styles.listContentCol}>
          <View style={styles.listTopRow}>
            <Text
              style={[styles.listTitle, { color: theme.textPrimary }]}
              numberOfLines={1}
            >
              {node.title}
            </Text>
            <View
              style={[
                styles.listTypeBadge,
                { backgroundColor: pillar.softBg },
              ]}
            >
              <Text style={[styles.listTypeBadgeText, { color: pillar.color }]}>
                {pillar.shortLabel}
              </Text>
            </View>
          </View>

          <Text
            style={[styles.listExcerpt, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {renderNodePreviewExcerpt(node)}
          </Text>

          <View style={styles.listMetaRow}>
            <Text style={[styles.listPathText, { color: theme.textMuted }]}>
              {node.file_path}
            </Text>
            <Text style={[styles.listMetricText, { color: theme.accentPrimary }]}>
              🔗 {neighbors.length} • ⚡ {node.token_count} tok
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => packNodeWithFirstDegreeLinks(node.id)}
          style={[
            styles.listPackBtn,
            { backgroundColor: theme.accentPrimarySoft },
          ]}
          accessibilityLabel="Pack Node + 1-Hop Links for AI"
        >
          <Ionicons name="sparkles" size={15} color={theme.accentPrimary} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Pre-Loaded "📌 Start Here (Demo)" Interactive Walkthrough Banner */}
      {hasDemoNodes && tutorialState.showInteractiveWalkthroughBanner && (
        <View
          style={[
            styles.demoBanner,
            {
              backgroundColor: theme.surface,
              borderColor: theme.accentPrimary,
            },
          ]}
        >
          <View style={styles.demoBannerHeader}>
            <View style={styles.demoTitleRow}>
              <View
                style={[
                  styles.demoSparkleBadge,
                  { backgroundColor: theme.accentPrimarySoft },
                ]}
              >
                <Text style={styles.demoPinEmoji}>📌</Text>
              </View>
              <View style={styles.demoTitleCol}>
                <Text style={[styles.demoBannerTitle, { color: theme.textPrimary }]}>
                  Start Here (Starter Demo Vault)
                </Text>
                <Text style={[styles.demoBannerSub, { color: theme.textSecondary }]}>
                  3 interconnected items pre-loaded: Invoice Scan + Budget Note + Expense Log
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={dismissWalkthroughBanner}
              style={styles.dismissIconBtn}
            >
              <Ionicons name="close" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Interactive Guided Tooltip Actions */}
          <View style={styles.tooltipStepsRow}>
            <TouchableOpacity
              onPress={() => setActiveTab('DOCUMAP')}
              style={[
                styles.tooltipStepCard,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: tutorialState.visitedDocuMapTab
                    ? theme.success
                    : theme.accentPrimary,
                },
              ]}
            >
              <View style={styles.tooltipStepTop}>
                <Ionicons
                  name={
                    tutorialState.visitedDocuMapTab
                      ? 'checkmark-circle'
                      : 'git-network-outline'
                  }
                  size={16}
                  color={
                    tutorialState.visitedDocuMapTab
                      ? theme.success
                      : theme.accentPrimary
                  }
                />
                <Text
                  style={[styles.tooltipStepTitle, { color: theme.textPrimary }]}
                >
                  Step 1: Tap DocuMap Tab
                </Text>
              </View>
              <Text
                style={[styles.tooltipStepDesc, { color: theme.textSecondary }]}
              >
                See all 3 demo items connected in an automatic 2D visual triangle.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                packNodeWithFirstDegreeLinks('demo-node-note-budget')
              }
              style={[
                styles.tooltipStepCard,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: tutorialState.visitedAiPackerTab
                    ? theme.success
                    : theme.nodeLog,
                },
              ]}
            >
              <View style={styles.tooltipStepTop}>
                <Ionicons
                  name={
                    tutorialState.visitedAiPackerTab
                      ? 'checkmark-circle'
                      : 'sparkles-outline'
                  }
                  size={16}
                  color={
                    tutorialState.visitedAiPackerTab
                      ? theme.success
                      : theme.nodeLog
                  }
                />
                <Text
                  style={[styles.tooltipStepTitle, { color: theme.textPrimary }]}
                >
                  Step 2: Tap AI Packer Tab
                </Text>
              </View>
              <Text
                style={[styles.tooltipStepDesc, { color: theme.textSecondary }]}
              >
                Watch Token-Saver compress the Scan + Note + CSV Log by ~42%.
              </Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Demo Controls: Filter to Demo Folder or One-Tap Delete Demo Data */}
          <View style={styles.demoFooterRow}>
            <TouchableOpacity
              onPress={() => {
                setFilterCategory('FOLDERS');
                setSelectedFolderId('folder-demo-start');
              }}
              style={[
                styles.demoFolderFilterBtn,
                { backgroundColor: theme.accentPrimarySoft },
              ]}
            >
              <Ionicons
                name="folder-open-outline"
                size={13}
                color={theme.accentPrimary}
              />
              <Text
                style={[
                  styles.demoFolderFilterText,
                  { color: theme.accentPrimary },
                ]}
              >
                Filter &quot;📌 Start Here (Demo)&quot;
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={deleteStarterDemoVault}
              style={[
                styles.deleteDemoBtn,
                {
                  backgroundColor: theme.dangerSoft,
                },
              ]}
            >
              <Ionicons name="trash-outline" size={13} color={theme.danger} />
              <Text style={[styles.deleteDemoBtnText, { color: theme.danger }]}>
                Delete Demo Data
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* If Demo Data was deleted, offer subtle 1-tap restore pill */}
      {!hasDemoNodes && (
        <View
          style={[
            styles.restoreDemoStrip,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <Text style={[styles.restoreDemoLabel, { color: theme.textSecondary }]}>
            Starter Demo Vault removed. Want the 3 sample interlinked files back?
          </Text>
          <TouchableOpacity onPress={restoreStarterDemoVault}>
            <Text style={[styles.restoreDemoAction, { color: theme.accentPrimary }]}>
              Restore Demo
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Quick Filter Pills: All | Scans | Notes | Data Logs | #Tags | Folders */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterPillsScroll}
      >
        {FILTER_PILLS.map((pill) => {
          const active = filterCategory === pill.key;
          return (
            <TouchableOpacity
              key={pill.key}
              onPress={() => setFilterCategory(pill.key)}
              style={[
                styles.filterPill,
                {
                  backgroundColor: active ? theme.accentPrimary : theme.surface,
                  borderColor: active ? theme.accentPrimary : theme.cardBorder,
                },
              ]}
            >
              <Ionicons
                name={pill.icon}
                size={14}
                color={active ? '#FFFFFF' : theme.textSecondary}
              />
              <Text
                style={[
                  styles.filterPillText,
                  {
                    color: active ? '#FFFFFF' : theme.textPrimary,
                  },
                ]}
              >
                {pill.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Secondary Sub-Filter Bar when #Tags is selected */}
      {filterCategory === 'TAGS' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subFilterScroll}
        >
          <TouchableOpacity
            onPress={() => setSelectedTag(null)}
            style={[
              styles.subFilterChip,
              {
                backgroundColor: !selectedTag
                  ? theme.accentPrimarySoft
                  : theme.surface,
                borderColor: !selectedTag
                  ? theme.accentPrimary
                  : theme.cardBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.subFilterChipText,
                {
                  color: !selectedTag ? theme.accentPrimary : theme.textSecondary,
                },
              ]}
            >
              All Tags ({allUniqueTags.length})
            </Text>
          </TouchableOpacity>

          {allUniqueTags.map(({ tag, count }) => {
            const isSel = selectedTag === tag;
            return (
              <TouchableOpacity
                key={tag}
                onPress={() => setSelectedTag(isSel ? null : tag)}
                style={[
                  styles.subFilterChip,
                  {
                    backgroundColor: isSel
                      ? theme.accentPrimarySoft
                      : theme.surface,
                    borderColor: isSel ? theme.accentPrimary : theme.cardBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.subFilterChipText,
                    {
                      color: isSel ? theme.accentPrimary : theme.textSecondary,
                    },
                  ]}
                >
                  #{tag} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Secondary Sub-Filter Bar when Folders is selected */}
      {filterCategory === 'FOLDERS' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subFilterScroll}
        >
          <TouchableOpacity
            onPress={() => setSelectedFolderId(null)}
            style={[
              styles.subFilterChip,
              {
                backgroundColor: !selectedFolderId
                  ? theme.accentPrimarySoft
                  : theme.surface,
                borderColor: !selectedFolderId
                  ? theme.accentPrimary
                  : theme.cardBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.subFilterChipText,
                {
                  color: !selectedFolderId
                    ? theme.accentPrimary
                    : theme.textSecondary,
                },
              ]}
            >
              All Folders ({folders.length})
            </Text>
          </TouchableOpacity>

          {folders.map((folder) => {
            const isSel = selectedFolderId === folder.id;
            const folderCount = nodes.filter(
              (n) => n.folder_id === folder.id
            ).length;
            return (
              <TouchableOpacity
                key={folder.id}
                onPress={() => setSelectedFolderId(isSel ? null : folder.id)}
                style={[
                  styles.subFilterChip,
                  {
                    backgroundColor: isSel
                      ? theme.accentPrimarySoft
                      : theme.surface,
                    borderColor: isSel ? theme.accentPrimary : theme.cardBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.subFilterChipText,
                    {
                      color: isSel ? theme.accentPrimary : theme.textSecondary,
                    },
                  ]}
                >
                  {folder.name} ({folderCount})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Vault Stats & One-Tap View Switcher (Visual Thumbnail Grid vs Compact List) */}
      <View style={styles.toolbarRow}>
        <View>
          <Text style={[styles.sectionCountTitle, { color: theme.textPrimary }]}>
            {filteredNodes.length} Vault Item{filteredNodes.length === 1 ? '' : 's'}
          </Text>
          <Text style={[styles.sectionCountSub, { color: theme.textMuted }]}>
            {edges.length} automatic & [[wiki-linked]] edges in graph_state.json
          </Text>
        </View>

        <View style={styles.toolbarRight}>
          {/* Sort Button */}
          <TouchableOpacity
            onPress={cycleSortBy}
            style={[
              styles.sortBtn,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <Ionicons
              name="swap-vertical-outline"
              size={14}
              color={theme.textSecondary}
            />
            <Text style={[styles.sortBtnText, { color: theme.textPrimary }]}>
              {getSortLabel(sortBy)}
            </Text>
          </TouchableOpacity>

          {/* One-Tap View Switcher: Visual Thumbnail Grid vs. Compact List */}
          <View
            style={[
              styles.viewSwitcherGroup,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => setViewMode('GRID')}
              style={[
                styles.viewSwitchBtn,
                viewMode === 'GRID' && {
                  backgroundColor: theme.accentPrimary,
                },
              ]}
              accessibilityLabel="Visual Thumbnail Grid View"
            >
              <Ionicons
                name="grid-outline"
                size={15}
                color={viewMode === 'GRID' ? '#FFFFFF' : theme.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setViewMode('LIST')}
              style={[
                styles.viewSwitchBtn,
                viewMode === 'LIST' && {
                  backgroundColor: theme.accentPrimary,
                },
              ]}
              accessibilityLabel="Compact List View"
            >
              <Ionicons
                name="list-outline"
                size={16}
                color={viewMode === 'LIST' ? '#FFFFFF' : theme.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Nodes Display: Grid vs Compact List */}
      {filteredNodes.length === 0 ? (
        <View
          style={[
            styles.emptyBox,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <Ionicons
            name="folder-open-outline"
            size={36}
            color={theme.textMuted}
          />
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>
            No documents match this filter
          </Text>
          <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
            Tap the + button below to scan a document, write a Markdown note, or
            create a Data Log, or restore the Starter Demo Vault.
          </Text>
          {!hasDemoNodes && (
            <TouchableOpacity
              onPress={restoreStarterDemoVault}
              style={[
                styles.emptyRestoreBtn,
                { backgroundColor: theme.accentPrimary },
              ]}
            >
              <Text style={styles.emptyRestoreBtnText}>
                Restore &quot;📌 Start Here (Demo)&quot;
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : viewMode === 'GRID' ? (
        <View style={styles.gridContainer}>
          {filteredNodes.map(renderGridNodeCard)}
        </View>
      ) : (
        <View style={styles.listContainer}>
          {filteredNodes.map(renderCompactListNodeCard)}
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
  demoBanner: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 14,
  },
  demoBannerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  demoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  demoSparkleBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoPinEmoji: {
    fontSize: 18,
  },
  demoTitleCol: {
    flex: 1,
  },
  demoBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  demoBannerSub: {
    fontSize: 11.5,
    marginTop: 2,
  },
  dismissIconBtn: {
    padding: 4,
  },
  tooltipStepsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tooltipStepCard: {
    flex: 1,
    minWidth: 150,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  tooltipStepTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  tooltipStepTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  tooltipStepDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  demoFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  demoFolderFilterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  demoFolderFilterText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  deleteDemoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  deleteDemoBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  restoreDemoStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 11,
    borderWidth: 1,
    marginBottom: 12,
  },
  restoreDemoLabel: {
    fontSize: 11.5,
    flex: 1,
  },
  restoreDemoAction: {
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 8,
  },
  filterPillsScroll: {
    gap: 8,
    paddingBottom: 10,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  subFilterScroll: {
    gap: 7,
    paddingBottom: 12,
  },
  subFilterChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
  },
  subFilterChipText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionCountTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  sectionCountSub: {
    fontSize: 11,
    marginTop: 1,
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
  },
  sortBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  viewSwitcherGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9,
    borderWidth: 1,
    padding: 2,
  },
  viewSwitchBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  gridCard: {
    width: '48.2%',
    minWidth: 155,
    flexGrow: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  thumbnailBanner: {
    borderRadius: 11,
    borderWidth: 1,
    padding: 9,
    marginBottom: 10,
    minHeight: 84,
    justifyContent: 'space-between',
  },
  thumbnailTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  pillarChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pillarChipText: {
    fontSize: 9,
    fontWeight: '800',
  },
  scanModeChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  scanModeChipText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '800',
  },
  demoMiniBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  demoMiniBadgeText: {
    fontSize: 8.5,
    fontWeight: '800',
  },
  thumbnailPreviewLines: {
    marginTop: 2,
  },
  thumbnailSnippetText: {
    fontSize: 10.5,
    lineHeight: 14,
  },
  cardTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    lineHeight: 19,
    marginBottom: 4,
  },
  cardFilePath: {
    fontSize: 10,
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  cardTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginBottom: 10,
  },
  tagPill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
  },
  tagPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metricText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  aiCartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  aiCartBtnText: {
    fontSize: 10,
    fontWeight: '800',
  },
  listContainer: {
    gap: 9,
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 12,
  },
  listIconBox: {
    width: 42,
    height: 42,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContentCol: {
    flex: 1,
  },
  listTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 3,
  },
  listTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  listTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  listTypeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  listExcerpt: {
    fontSize: 11.5,
    marginBottom: 4,
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listPathText: {
    fontSize: 10,
    fontFamily: 'monospace',
    flex: 1,
  },
  listMetricText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  listPackBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 4,
  },
  emptyDesc: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyRestoreBtn: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyRestoreBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
});
