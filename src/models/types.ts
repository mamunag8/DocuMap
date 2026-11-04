/**
 * DocuMap — Core Unified Interlinked Data Model & Type Definitions
 * 100% Local-First & Privacy-Sovereign Architecture
 */

export type NodeType = 'SCAN' | 'NOTE' | 'LOG';

export type ScanMode = 'SINGLE' | 'BATCH' | 'ID_CARD' | 'BOOK';

export type ScanFilter = 'ORIGINAL' | 'MAGIC_COLOR' | 'CRISP_BW' | 'GRAYSCALE';

export type SyncStatus = 'SYNCED' | 'PENDING' | 'CONFLICT';

export type EdgeRelationType = 'MANUAL_LINK' | 'SHARED_TAG' | 'KEYWORD_MATCH';

export type LogFieldType =
  | 'TEXT'
  | 'NUMBER'
  | 'DATE'
  | 'CURRENCY'
  | 'DROPDOWN'
  | 'ATTACHED_SCAN_ID'
  | 'WIKI_LINK';

export type ThemeMode = 'light' | 'dark' | 'oled';

export type VaultFilterCategory = 'ALL' | 'SCAN' | 'NOTE' | 'LOG' | 'TAGS' | 'FOLDERS';

export type VaultViewMode = 'GRID' | 'LIST';

export type VaultSortBy = 'UPDATED_DESC' | 'TITLE_ASC' | 'TOKENS_DESC' | 'TYPE';

export type AppTab = 'VAULT' | 'DOCUMAP' | 'AI_PACKER' | 'SETTINGS';

export type CloudSyncState = 'SYNCED' | 'SYNCING' | 'OFFLINE_LOCAL' | 'CONFLICT_DETECTED';

/**
 * Unified VaultNode representing Scans, Markdown Notes, and Structured Data Logs
 */
export interface VaultNode {
  id: string;
  type: NodeType;
  title: string;
  /** Markdown body for NOTE, extracted OCR companion layer for SCAN, or Markdown summary for LOG */
  content_md: string;
  /** Relative path inside DocuMap_Vault/ (e.g., "DocuMap_Vault/Scans/Hardware_Supplier_Invoice.pdf") */
  file_path: string;
  /** Applicable when type === 'SCAN' */
  scan_mode: ScanMode | null;
  scan_filter?: ScanFilter | null;
  page_count?: number;
  /** Parsed array of hashtags without leading '#' or with normalized lowercase */
  tags: string[];
  /** Folder identifier (e.g., "folder-demo-start", "folder-root", etc.) */
  folder_id: string;
  /** Estimated LLM token count for this node's content */
  token_count: number;
  /** AES-256 local encryption flag */
  is_encrypted: boolean;
  /** Current BYOC sync status */
  sync_status: SyncStatus;
  /** ISO-8601 creation timestamp */
  created_at: string;
  /** ISO-8601 modification timestamp */
  updated_at: string;
  /** Deterministic SHA-256 / FNV-1a content hash for Delta Sync */
  content_hash: string;
  /** Flag indicating if this node belongs to the pre-loaded Starter Demo Vault */
  is_demo?: boolean;
  /** Optional watermark or e-signature metadata for scanned PDFs */
  watermark_text?: string | null;
  has_signature?: boolean;
  /** Persistent 2D coordinates on the DocuMap canvas */
  graph_x?: number;
  graph_y?: number;
}

/**
 * Bidirectional or auto-discovered edge connecting two VaultNodes
 */
export interface NodeEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  relation_type: EdgeRelationType;
  /** Human-readable reason, e.g., "[[Hardware Supplier Invoice]]", "#project-alpha", or "keyword: invoice" */
  label: string;
  /** Connection strength (1.0 for manual wiki-links, 0.7 for shared tags, 0.45 for keyword matches) */
  weight: number;
  created_at: string;
}

/**
 * Column definition for a Structured Personal Data Log table
 */
export interface LogFieldColumn {
  id: string;
  name: string;
  type: LogFieldType;
  currency_symbol?: string;
  dropdown_options?: string[];
  required?: boolean;
}

/**
 * Schema metadata linked to a parent VaultNode of type === 'LOG'
 */
export interface LogSchema {
  id: string;
  node_id: string;
  columns: LogFieldColumn[];
  created_at: string;
  updated_at: string;
}

/**
 * Individual row inside a Structured Personal Data Log
 */
export interface LogEntry {
  id: string;
  node_id: string;
  schema_id: string;
  /** Key-value map where key is LogFieldColumn.id */
  values: Record<string, string | number | null>;
  /** Optional direct reference to a scanned receipt/document VaultNode ID */
  attached_scan_id?: string | null;
  /** Optional direct reference to a Markdown note VaultNode ID */
  linked_note_id?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Vault Folder organization model
 */
export interface VaultFolder {
  id: string;
  name: string;
  icon: string;
  description?: string;
  is_demo?: boolean;
  created_at: string;
}

/**
 * FTS5 Instant Universal Search Result item
 */
export interface SearchMatchResult {
  node: VaultNode;
  score: number;
  matched_in: ('TITLE' | 'FILENAME' | 'CONTENT_OCR' | 'TAGS' | 'DATA_LOG')[];
  snippet: string;
}

/**
 * Portable index file saved at DocuMap_Vault/.documap/graph_state.json
 * Synchronized across Phone <-> PC via Google Drive / iCloud / OneDrive / WebDAV
 */
export interface GraphStateJson {
  schema_version: string;
  vault_name: string;
  last_updated_at: string;
  last_synced_at: string | null;
  device_platform: string;
  folders: VaultFolder[];
  nodes: Array<{
    id: string;
    type: NodeType;
    title: string;
    file_path: string;
    tags: string[];
    folder_id: string;
    token_count: number;
    content_hash: string;
    sync_status: SyncStatus;
    updated_at: string;
    coordinates: { x: number; y: number };
  }>;
  edges: NodeEdge[];
  tags_index: Record<string, string[]>;
}

/**
 * Interactive Guided Tutorial Progression State
 */
export interface TutorialProgressState {
  hasCompletedOnboardingModal: boolean;
  showInteractiveWalkthroughBanner: boolean;
  visitedDocuMapTab: boolean;
  visitedAiPackerTab: boolean;
  inspectedDemoTriangle: boolean;
}
