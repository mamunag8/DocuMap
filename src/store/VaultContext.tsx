import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { docuMapDb } from '../database/sqliteDatabase';
import { vaultFileManager, VirtualVaultFile } from '../filesystem/vaultFileManager';
import {
  AppTab,
  CloudSyncState,
  LogEntry,
  LogSchema,
  NodeEdge,
  SearchMatchResult,
  TutorialProgressState,
  VaultFilterCategory,
  VaultFolder,
  VaultNode,
  VaultSortBy,
  VaultViewMode,
} from '../models/types';

interface VaultContextValue {
  isLoading: boolean;
  /** Core Database Entities */
  nodes: VaultNode[];
  edges: NodeEdge[];
  folders: VaultFolder[];
  logSchemas: LogSchema[];
  logEntries: LogEntry[];
  vaultFiles: VirtualVaultFile[];
  /** Navigation & UI State */
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  /** Global Header Search & Cloud Sync Pill */
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: SearchMatchResult[];
  cloudSyncState: CloudSyncState;
  triggerQuickDeltaSync: () => Promise<void>;
  /** Vault Home Screen Filters, View Mode & Sorting */
  filterCategory: VaultFilterCategory;
  setFilterCategory: (cat: VaultFilterCategory) => void;
  selectedTag: string | null;
  setSelectedTag: (tag: string | null) => void;
  selectedFolderId: string | null;
  setSelectedFolderId: (folderId: string | null) => void;
  viewMode: VaultViewMode;
  setViewMode: (mode: VaultViewMode) => void;
  sortBy: VaultSortBy;
  setSortBy: (sort: VaultSortBy) => void;
  filteredNodes: VaultNode[];
  allUniqueTags: Array<{ tag: string; count: number }>;
  hasDemoNodes: boolean;
  /** Active Node Selection & AI Packer Cart */
  activeNodeId: string | null;
  setActiveNodeId: (id: string | null) => void;
  aiPackerNodeIds: string[];
  toggleNodeInAiPacker: (nodeId: string) => void;
  packNodeWithFirstDegreeLinks: (nodeId: string) => void;
  clearAiPackerCart: () => void;
  /** Interactive 60-Second Tutorial & Walkthrough Coach-Marks */
  tutorialState: TutorialProgressState;
  isOnboardingModalVisible: boolean;
  openOnboardingModal: () => void;
  completeOnboardingModal: () => void;
  dismissWalkthroughBanner: () => void;
  /** CRUD & Demo Data Actions */
  createOrUpdateNode: (
    partial: Partial<VaultNode> & { title: string; type: VaultNode['type'] },
    logSchema?: LogSchema,
    logEntries?: LogEntry[]
  ) => Promise<VaultNode>;
  deleteNodeById: (nodeId: string) => Promise<void>;
  deleteStarterDemoVault: () => Promise<void>;
  restoreStarterDemoVault: () => Promise<void>;
  createNewFolder: (name: string) => Promise<VaultFolder>;
  getConnectedNeighbors: (nodeId: string) => Array<{ node: VaultNode; edge: NodeEdge }>;
  updateNodeGraphPosition: (nodeId: string, x: number, y: number) => Promise<void>;
  /** Modals for Quick Preview / Sync Inspector */
  isSyncInspectorOpen: boolean;
  setIsSyncInspectorOpen: (open: boolean) => void;
  inspectingNode: VaultNode | null;
  setInspectingNode: (node: VaultNode | null) => void;
}

const VaultContext = createContext<VaultContextValue | undefined>(undefined);

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [nodes, setNodes] = useState<VaultNode[]>([]);
  const [edges, setEdges] = useState<NodeEdge[]>([]);
  const [folders, setFolders] = useState<VaultFolder[]>([]);
  const [logSchemas, setLogSchemas] = useState<LogSchema[]>([]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [vaultFiles, setVaultFiles] = useState<VirtualVaultFile[]>([]);

  // Navigation & Global Header State
  const [activeTab, setActiveTabState] = useState<AppTab>('VAULT');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cloudSyncState, setCloudSyncState] = useState<CloudSyncState>('SYNCED');

  // Vault Home Filter & View State
  const [filterCategory, setFilterCategoryState] = useState<VaultFilterCategory>('ALL');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<VaultViewMode>('GRID');
  const [sortBy, setSortBy] = useState<VaultSortBy>('UPDATED_DESC');

  // Active Node & AI Packer Context Cart
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [aiPackerNodeIds, setAiPackerNodeIds] = useState<string[]>([
    'demo-node-scan-invoice',
    'demo-node-note-budget',
    'demo-node-log-expenses',
  ]);

  // Modals
  const [isSyncInspectorOpen, setIsSyncInspectorOpen] = useState<boolean>(false);
  const [inspectingNode, setInspectingNode] = useState<VaultNode | null>(null);

  // Interactive 60-Second Tutorial & Guided Coach-Marks
  const [isOnboardingModalVisible, setIsOnboardingModalVisible] = useState<boolean>(true);
  const [tutorialState, setTutorialState] = useState<TutorialProgressState>({
    hasCompletedOnboardingModal: false,
    showInteractiveWalkthroughBanner: true,
    visitedDocuMapTab: false,
    visitedAiPackerTab: false,
    inspectedDemoTriangle: false,
  });

  const syncFromDatabase = useCallback(() => {
    setNodes(docuMapDb.getAllNodes());
    setEdges(docuMapDb.getAllEdges());
    setFolders(docuMapDb.getAllFolders());
    setLogSchemas(docuMapDb.getAllLogSchemas());
    setLogEntries(docuMapDb.getAllLogEntries());
    setVaultFiles(vaultFileManager.listVaultFiles());
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await docuMapDb.initialize();
      if (mounted) {
        syncFromDatabase();
        setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [syncFromDatabase]);

  const setActiveTab = useCallback((tab: AppTab) => {
    setActiveTabState(tab);
    if (tab === 'DOCUMAP') {
      setTutorialState((prev) => ({
        ...prev,
        visitedDocuMapTab: true,
        inspectedDemoTriangle: true,
      }));
    } else if (tab === 'AI_PACKER') {
      setTutorialState((prev) => ({
        ...prev,
        visitedAiPackerTab: true,
      }));
    }
  }, []);

  const setFilterCategory = useCallback((cat: VaultFilterCategory) => {
    setFilterCategoryState(cat);
    if (cat !== 'TAGS') setSelectedTag(null);
    if (cat !== 'FOLDERS') setSelectedFolderId(null);
  }, []);

  const searchResults = useMemo<SearchMatchResult[]>(() => {
    if (!searchQuery.trim()) return [];
    return docuMapDb.searchVaultInstant(searchQuery);
  }, [searchQuery, nodes]);

  const allUniqueTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of nodes) {
      for (const tag of node.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [nodes]);

  const hasDemoNodes = useMemo(() => nodes.some((n) => n.is_demo), [nodes]);

  const filteredNodes = useMemo(() => {
    let list = [...nodes];

    // Apply pill filter
    if (filterCategory === 'SCAN') {
      list = list.filter((n) => n.type === 'SCAN');
    } else if (filterCategory === 'NOTE') {
      list = list.filter((n) => n.type === 'NOTE');
    } else if (filterCategory === 'LOG') {
      list = list.filter((n) => n.type === 'LOG');
    } else if (filterCategory === 'TAGS' && selectedTag) {
      list = list.filter((n) => n.tags.includes(selectedTag));
    } else if (filterCategory === 'FOLDERS' && selectedFolderId) {
      list = list.filter((n) => n.folder_id === selectedFolderId);
    }

    // Apply sorting
    list.sort((a, b) => {
      if (sortBy === 'TITLE_ASC') return a.title.localeCompare(b.title);
      if (sortBy === 'TOKENS_DESC') return b.token_count - a.token_count;
      if (sortBy === 'TYPE') return a.type.localeCompare(b.type);
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return list;
  }, [nodes, filterCategory, selectedTag, selectedFolderId, sortBy]);

  const triggerQuickDeltaSync = useCallback(async () => {
    setCloudSyncState('SYNCING');
    await new Promise((resolve) => setTimeout(resolve, 650));
    await docuMapDb.markAllNodesSynced();
    syncFromDatabase();
    setCloudSyncState('SYNCED');
  }, [syncFromDatabase]);

  const createOrUpdateNode = useCallback(
    async (
      partial: Partial<VaultNode> & { title: string; type: VaultNode['type'] },
      customLogSchema?: LogSchema,
      customLogEntries?: LogEntry[]
    ) => {
      setCloudSyncState('SYNCING');
      const saved = await docuMapDb.upsertNode(partial, customLogSchema, customLogEntries);
      syncFromDatabase();
      setTimeout(() => {
        docuMapDb.markAllNodesSynced().then(() => {
          syncFromDatabase();
          setCloudSyncState('SYNCED');
        });
      }, 450);
      return saved;
    },
    [syncFromDatabase]
  );

  const deleteNodeById = useCallback(
    async (nodeId: string) => {
      await docuMapDb.deleteNode(nodeId);
      setAiPackerNodeIds((prev) => prev.filter((id) => id !== nodeId));
      if (inspectingNode?.id === nodeId) {
        setInspectingNode(null);
      }
      syncFromDatabase();
    },
    [inspectingNode, syncFromDatabase]
  );

  const deleteStarterDemoVault = useCallback(async () => {
    await docuMapDb.deleteStarterDemoData();
    setAiPackerNodeIds((prev) => prev.filter((id) => !id.startsWith('demo-node-')));
    syncFromDatabase();
  }, [syncFromDatabase]);

  const restoreStarterDemoVault = useCallback(async () => {
    await docuMapDb.seedStarterDemoVault();
    setAiPackerNodeIds([
      'demo-node-scan-invoice',
      'demo-node-note-budget',
      'demo-node-log-expenses',
    ]);
    setTutorialState((prev) => ({
      ...prev,
      showInteractiveWalkthroughBanner: true,
    }));
    syncFromDatabase();
  }, [syncFromDatabase]);

  const createNewFolder = useCallback(
    async (name: string) => {
      const folder = await docuMapDb.createFolder(name);
      syncFromDatabase();
      return folder;
    },
    [syncFromDatabase]
  );

  const getConnectedNeighbors = useCallback(
    (nodeId: string) => docuMapDb.getConnectedNeighbors(nodeId),
    [edges, nodes]
  );

  const updateNodeGraphPosition = useCallback(
    async (nodeId: string, x: number, y: number) => {
      await docuMapDb.updateNodeCoordinates(nodeId, x, y);
      syncFromDatabase();
    },
    [syncFromDatabase]
  );

  const toggleNodeInAiPacker = useCallback((nodeId: string) => {
    setAiPackerNodeIds((prev) =>
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]
    );
  }, []);

  /**
   * Pulls a target node PLUS all its 1st-degree linked nodes into the AI Packer Context Cart
   * and navigates to the AI Packer tab.
   */
  const packNodeWithFirstDegreeLinks = useCallback(
    (nodeId: string) => {
      const neighbors = docuMapDb.getConnectedNeighbors(nodeId);
      const bundleIds = new Set<string>([nodeId, ...neighbors.map((n) => n.node.id)]);
      setAiPackerNodeIds(Array.from(bundleIds));
      setActiveTab('AI_PACKER');
    },
    [setActiveTab]
  );

  const clearAiPackerCart = useCallback(() => {
    setAiPackerNodeIds([]);
  }, []);

  const openOnboardingModal = useCallback(() => {
    setIsOnboardingModalVisible(true);
  }, []);

  const completeOnboardingModal = useCallback(() => {
    setIsOnboardingModalVisible(false);
    setTutorialState((prev) => ({
      ...prev,
      hasCompletedOnboardingModal: true,
    }));
  }, []);

  const dismissWalkthroughBanner = useCallback(() => {
    setTutorialState((prev) => ({
      ...prev,
      showInteractiveWalkthroughBanner: false,
    }));
  }, []);

  const value = useMemo<VaultContextValue>(
    () => ({
      isLoading,
      nodes,
      edges,
      folders,
      logSchemas,
      logEntries,
      vaultFiles,
      activeTab,
      setActiveTab,
      searchQuery,
      setSearchQuery,
      searchResults,
      cloudSyncState,
      triggerQuickDeltaSync,
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
      filteredNodes,
      allUniqueTags,
      hasDemoNodes,
      activeNodeId,
      setActiveNodeId,
      aiPackerNodeIds,
      toggleNodeInAiPacker,
      packNodeWithFirstDegreeLinks,
      clearAiPackerCart,
      tutorialState,
      isOnboardingModalVisible,
      openOnboardingModal,
      completeOnboardingModal,
      dismissWalkthroughBanner,
      createOrUpdateNode,
      deleteNodeById,
      deleteStarterDemoVault,
      restoreStarterDemoVault,
      createNewFolder,
      getConnectedNeighbors,
      updateNodeGraphPosition,
      isSyncInspectorOpen,
      setIsSyncInspectorOpen,
      inspectingNode,
      setInspectingNode,
    }),
    [
      isLoading,
      nodes,
      edges,
      folders,
      logSchemas,
      logEntries,
      vaultFiles,
      activeTab,
      setActiveTab,
      searchQuery,
      searchResults,
      cloudSyncState,
      triggerQuickDeltaSync,
      filterCategory,
      setFilterCategory,
      selectedTag,
      selectedFolderId,
      viewMode,
      sortBy,
      filteredNodes,
      allUniqueTags,
      hasDemoNodes,
      activeNodeId,
      aiPackerNodeIds,
      toggleNodeInAiPacker,
      packNodeWithFirstDegreeLinks,
      clearAiPackerCart,
      tutorialState,
      isOnboardingModalVisible,
      openOnboardingModal,
      completeOnboardingModal,
      dismissWalkthroughBanner,
      createOrUpdateNode,
      deleteNodeById,
      deleteStarterDemoVault,
      restoreStarterDemoVault,
      createNewFolder,
      getConnectedNeighbors,
      updateNodeGraphPosition,
      isSyncInspectorOpen,
      inspectingNode,
    ]
  );

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>;
};

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext);
  if (!ctx) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return ctx;
}
