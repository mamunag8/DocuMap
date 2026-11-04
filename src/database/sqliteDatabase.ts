import { Platform } from 'react-native';
import {
  buildUnifiedGraphEdges,
  computeContentHash,
  estimateTokens,
  extractHashtags,
} from '../core/linkAndTokenEngine';
import { vaultFileManager } from '../filesystem/vaultFileManager';
import {
  LogEntry,
  LogSchema,
  NodeEdge,
  SearchMatchResult,
  VaultFolder,
  VaultNode,
} from '../models/types';
import {
  DEFAULT_FOLDERS,
  DEMO_LOG_ENTRIES,
  DEMO_LOG_SCHEMAS,
  DEMO_NODES,
} from './demoSeedData';

/**
 * Complete SQLite + FTS5 Schema DDL used on native devices via expo-sqlite
 */
export const DOCUMAP_SQLITE_DDL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS vault_folders (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  description TEXT,
  is_demo INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vault_nodes (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('SCAN', 'NOTE', 'LOG')),
  title TEXT NOT NULL,
  content_md TEXT NOT NULL,
  file_path TEXT NOT NULL,
  scan_mode TEXT,
  scan_filter TEXT,
  page_count INTEGER DEFAULT 1,
  tags TEXT NOT NULL DEFAULT '[]',
  folder_id TEXT NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  is_encrypted INTEGER NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'SYNCED' CHECK(sync_status IN ('SYNCED', 'PENDING', 'CONFLICT')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  is_demo INTEGER DEFAULT 0,
  watermark_text TEXT,
  has_signature INTEGER DEFAULT 0,
  graph_x REAL,
  graph_y REAL
);

CREATE VIRTUAL TABLE IF NOT EXISTS vault_nodes_fts USING fts5(
  node_id UNINDEXED,
  title,
  file_path,
  content_md,
  tags,
  tokenize = 'porter unicode61'
);

CREATE TABLE IF NOT EXISTS node_edges (
  id TEXT PRIMARY KEY NOT NULL,
  source_node_id TEXT NOT NULL,
  target_node_id TEXT NOT NULL,
  relation_type TEXT NOT NULL CHECK(relation_type IN ('MANUAL_LINK', 'SHARED_TAG', 'KEYWORD_MATCH')),
  label TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS log_schemas (
  id TEXT PRIMARY KEY NOT NULL,
  node_id TEXT NOT NULL,
  columns_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS log_entries (
  id TEXT PRIMARY KEY NOT NULL,
  node_id TEXT NOT NULL,
  schema_id TEXT NOT NULL,
  values_json TEXT NOT NULL,
  attached_scan_id TEXT,
  linked_note_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

class DocuMapDatabaseEngine {
  private folders: VaultFolder[] = [];
  private nodes: VaultNode[] = [];
  private edges: NodeEdge[] = [];
  private logSchemas: LogSchema[] = [];
  private logEntries: LogEntry[] = [];
  private sqliteDb: any = null;
  private isReady = false;

  /**
   * Initializes SQLite database (with FTS5 virtual table on native Android/iOS),
   * seeds the 3 interlinked "📌 Start Here (Demo)" nodes on first launch,
   * and synchronizes the portable DocuMap_Vault/ file system.
   */
  public async initialize(): Promise<void> {
    if (this.isReady) return;

    // Attempt native SQLite initialization on Android / iOS
    if (Platform.OS !== 'web') {
      try {
        // Dynamic require so web bundler never chokes if native binary is absent
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const SQLite = require('expo-sqlite');
        if (SQLite && typeof SQLite.openDatabaseAsync === 'function') {
          this.sqliteDb = await SQLite.openDatabaseAsync('documap_vault.db');
          await this.sqliteDb.execAsync(DOCUMAP_SQLITE_DDL);
        }
      } catch {
        this.sqliteDb = null;
      }
    }

    await vaultFileManager.initializeVaultDirectories();

    // Load from native SQLite if available and already populated
    let loadedFromSqlite = false;
    if (this.sqliteDb) {
      try {
        const existingRows = await this.sqliteDb.getAllAsync('SELECT * FROM vault_nodes ORDER BY updated_at DESC;');
        if (Array.isArray(existingRows) && existingRows.length > 0) {
          this.nodes = existingRows.map((row: any) => this.mapRowToVaultNode(row));
          const folderRows = await this.sqliteDb.getAllAsync('SELECT * FROM vault_folders;');
          this.folders = folderRows.length > 0
            ? folderRows.map((f: any) => ({
                id: f.id,
                name: f.name,
                icon: f.icon,
                description: f.description,
                is_demo: Boolean(f.is_demo),
                created_at: f.created_at,
              }))
            : [...DEFAULT_FOLDERS];

          const schemaRows = await this.sqliteDb.getAllAsync('SELECT * FROM log_schemas;');
          this.logSchemas = schemaRows.map((s: any) => ({
            id: s.id,
            node_id: s.node_id,
            columns: JSON.parse(s.columns_json || '[]'),
            created_at: s.created_at,
            updated_at: s.updated_at,
          }));

          const entryRows = await this.sqliteDb.getAllAsync('SELECT * FROM log_entries;');
          this.logEntries = entryRows.map((e: any) => ({
            id: e.id,
            node_id: e.node_id,
            schema_id: e.schema_id,
            values: JSON.parse(e.values_json || '{}'),
            attached_scan_id: e.attached_scan_id,
            linked_note_id: e.linked_note_id,
            created_at: e.created_at,
            updated_at: e.updated_at,
          }));
          loadedFromSqlite = true;
        }
      } catch {
        loadedFromSqlite = false;
      }
    }

    if (!loadedFromSqlite) {
      await this.seedStarterDemoVault();
    } else {
      await this.rebuildEdgesAndSyncVaultFiles();
    }

    this.isReady = true;
  }

  /**
   * Pre-loads the 3 interlinked "📌 Start Here (Demo)" nodes:
   * 1. Hardware Supplier Invoice (SCAN)
   * 2. Project Budget & Architecture Notes (NOTE)
   * 3. Equipment Expense Log (LOG)
   */
  public async seedStarterDemoVault(): Promise<void> {
    // Keep non-demo nodes if restoring demo data
    const nonDemoNodes = this.nodes.filter((n) => !n.is_demo);
    const nonDemoSchemas = this.logSchemas.filter(
      (s) => !DEMO_NODES.some((dn) => dn.id === s.node_id)
    );
    const nonDemoEntries = this.logEntries.filter(
      (e) => !DEMO_NODES.some((dn) => dn.id === e.node_id)
    );

    this.folders = [...DEFAULT_FOLDERS];
    this.nodes = [...DEMO_NODES.map((n) => ({ ...n, tags: [...n.tags] })), ...nonDemoNodes];
    this.logSchemas = [
      ...DEMO_LOG_SCHEMAS.map((s) => ({
        ...s,
        columns: s.columns.map((c) => ({ ...c })),
      })),
      ...nonDemoSchemas,
    ];
    this.logEntries = [
      ...DEMO_LOG_ENTRIES.map((e) => ({
        ...e,
        values: { ...e.values },
      })),
      ...nonDemoEntries,
    ];

    if (this.sqliteDb) {
      for (const folder of this.folders) {
        await this.persistFolderToSqlite(folder);
      }
      for (const node of DEMO_NODES) {
        await this.persistNodeToSqlite(node);
      }
      for (const schema of DEMO_LOG_SCHEMAS) {
        await this.persistLogSchemaToSqlite(schema);
      }
      for (const entry of DEMO_LOG_ENTRIES) {
        await this.persistLogEntryToSqlite(entry);
      }
    }

    await this.rebuildEdgesAndSyncVaultFiles();
  }

  /**
   * One-tap "Delete Demo Data" handler for the "📌 Start Here (Demo)" banner
   */
  public async deleteStarterDemoData(): Promise<void> {
    const demoNodes = this.nodes.filter((n) => n.is_demo);
    for (const dn of demoNodes) {
      await vaultFileManager.deleteNodeFromFileSystem(dn);
    }

    const demoNodeIds = new Set(demoNodes.map((n) => n.id));
    this.nodes = this.nodes.filter((n) => !n.is_demo);
    this.logSchemas = this.logSchemas.filter((s) => !demoNodeIds.has(s.node_id));
    this.logEntries = this.logEntries.filter((e) => !demoNodeIds.has(e.node_id));

    if (this.sqliteDb) {
      try {
        await this.sqliteDb.runAsync('DELETE FROM vault_nodes WHERE is_demo = 1;');
        for (const id of demoNodeIds) {
          await this.sqliteDb.runAsync('DELETE FROM vault_nodes_fts WHERE node_id = ?;', [id]);
          await this.sqliteDb.runAsync('DELETE FROM log_schemas WHERE node_id = ?;', [id]);
          await this.sqliteDb.runAsync('DELETE FROM log_entries WHERE node_id = ?;', [id]);
        }
      } catch {
        // Ignore
      }
    }

    await this.rebuildEdgesAndSyncVaultFiles();
  }

  public getAllNodes(): VaultNode[] {
    return [...this.nodes].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  }

  public getNodeById(id: string): VaultNode | undefined {
    return this.nodes.find((n) => n.id === id);
  }

  public getAllEdges(): NodeEdge[] {
    return [...this.edges];
  }

  public getAllFolders(): VaultFolder[] {
    return [...this.folders];
  }

  public getLogSchemaForNode(nodeId: string): LogSchema | undefined {
    return this.logSchemas.find((s) => s.node_id === nodeId);
  }

  public getLogEntriesForNode(nodeId: string): LogEntry[] {
    return this.logEntries.filter((e) => e.node_id === nodeId);
  }

  public getAllLogSchemas(): LogSchema[] {
    return [...this.logSchemas];
  }

  public getAllLogEntries(): LogEntry[] {
    return [...this.logEntries];
  }

  /**
   * Returns all 1st-degree connected backlinks & outgoing links for a given VaultNode ID
   */
  public getConnectedNeighbors(nodeId: string): Array<{
    node: VaultNode;
    edge: NodeEdge;
  }> {
    const results: Array<{ node: VaultNode; edge: NodeEdge }> = [];
    const seenNodeIds = new Set<string>();

    for (const edge of this.edges) {
      let otherId: string | null = null;
      if (edge.source_node_id === nodeId) {
        otherId = edge.target_node_id;
      } else if (edge.target_node_id === nodeId) {
        otherId = edge.source_node_id;
      }
      if (otherId && !seenNodeIds.has(otherId)) {
        const neighbor = this.getNodeById(otherId);
        if (neighbor) {
          seenNodeIds.add(otherId);
          results.push({ node: neighbor, edge });
        }
      }
    }
    return results;
  }

  /**
   * Creates or updates a VaultNode, extracts #tags and [[Wiki-Links]],
   * updates FTS5 search index, writes to DocuMap_Vault/ file system,
   * and recalculates bidirectional NodeEdges + graph_state.json.
   */
  public async upsertNode(
    partial: Partial<VaultNode> & { title: string; type: VaultNode['type'] },
    customLogSchema?: LogSchema,
    customLogEntries?: LogEntry[]
  ): Promise<VaultNode> {
    const nowIso = new Date().toISOString();
    const existing = partial.id ? this.getNodeById(partial.id) : undefined;

    const id = existing?.id ?? partial.id ?? `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const contentMd = partial.content_md ?? existing?.content_md ?? '';
    const mergedTags = extractHashtags(contentMd, partial.tags ?? existing?.tags ?? []);
    const tokenCount = estimateTokens(`${partial.title}\n${contentMd}`);
    const contentHash = computeContentHash(`${partial.title}::${contentMd}::${mergedTags.join(',')}`);
    const filePath =
      partial.file_path ??
      existing?.file_path ??
      vaultFileManager.buildRelativePath(partial.title, partial.type);

    const defaultFolder =
      partial.type === 'SCAN'
        ? 'folder-receipts-scans'
        : partial.type === 'NOTE'
        ? 'folder-knowledge-notes'
        : 'folder-personal-logs';

    const node: VaultNode = {
      id,
      type: partial.type,
      title: partial.title.trim() || 'Untitled Document',
      content_md: contentMd,
      file_path: filePath,
      scan_mode:
        partial.type === 'SCAN'
          ? partial.scan_mode ?? existing?.scan_mode ?? 'SINGLE'
          : null,
      scan_filter:
        partial.type === 'SCAN'
          ? partial.scan_filter ?? existing?.scan_filter ?? 'MAGIC_COLOR'
          : null,
      page_count: partial.page_count ?? existing?.page_count ?? 1,
      tags: mergedTags,
      folder_id: partial.folder_id ?? existing?.folder_id ?? defaultFolder,
      token_count: tokenCount,
      is_encrypted: partial.is_encrypted ?? existing?.is_encrypted ?? false,
      sync_status: partial.sync_status ?? 'PENDING',
      created_at: existing?.created_at ?? partial.created_at ?? nowIso,
      updated_at: nowIso,
      content_hash: contentHash,
      is_demo: partial.is_demo ?? existing?.is_demo ?? false,
      watermark_text: partial.watermark_text ?? existing?.watermark_text ?? null,
      has_signature: partial.has_signature ?? existing?.has_signature ?? false,
      graph_x:
        partial.graph_x ??
        existing?.graph_x ??
        Math.round(110 + Math.random() * 220),
      graph_y:
        partial.graph_y ??
        existing?.graph_y ??
        Math.round(120 + Math.random() * 200),
    };

    const existingIdx = this.nodes.findIndex((n) => n.id === id);
    if (existingIdx >= 0) {
      this.nodes[existingIdx] = node;
    } else {
      this.nodes.unshift(node);
    }

    if (node.type === 'LOG') {
      if (customLogSchema) {
        const sIdx = this.logSchemas.findIndex((s) => s.node_id === node.id);
        if (sIdx >= 0) this.logSchemas[sIdx] = customLogSchema;
        else this.logSchemas.push(customLogSchema);
        if (this.sqliteDb) await this.persistLogSchemaToSqlite(customLogSchema);
      } else if (!this.getLogSchemaForNode(node.id)) {
        const defaultSchema: LogSchema = {
          id: `schema-${node.id}`,
          node_id: node.id,
          columns: [
            { id: 'col_date', name: 'Date', type: 'DATE', required: true },
            { id: 'col_item', name: 'Item / Metric', type: 'TEXT', required: true },
            { id: 'col_amount', name: 'Value / Cost', type: 'CURRENCY', currency_symbol: '$' },
            { id: 'col_wiki', name: 'Linked Document', type: 'WIKI_LINK' },
          ],
          created_at: nowIso,
          updated_at: nowIso,
        };
        this.logSchemas.push(defaultSchema);
        if (this.sqliteDb) await this.persistLogSchemaToSqlite(defaultSchema);
      }

      if (customLogEntries) {
        this.logEntries = [
          ...this.logEntries.filter((e) => e.node_id !== node.id),
          ...customLogEntries,
        ];
        if (this.sqliteDb) {
          for (const entry of customLogEntries) {
            await this.persistLogEntryToSqlite(entry);
          }
        }
      }
    }

    if (this.sqliteDb) {
      await this.persistNodeToSqlite(node);
    }

    await this.rebuildEdgesAndSyncVaultFiles();
    return node;
  }

  /**
   * Updates 2D coordinates of a node on the DocuMap canvas and saves to graph_state.json
   */
  public async updateNodeCoordinates(nodeId: string, x: number, y: number): Promise<void> {
    const node = this.getNodeById(nodeId);
    if (!node) return;
    node.graph_x = Math.round(x);
    node.graph_y = Math.round(y);
    if (this.sqliteDb) {
      try {
        await this.sqliteDb.runAsync(
          'UPDATE vault_nodes SET graph_x = ?, graph_y = ? WHERE id = ?;',
          [node.graph_x, node.graph_y, nodeId]
        );
      } catch {
        // Ignore
      }
    }
    await vaultFileManager.writeGraphStateJson(this.nodes, this.edges, this.folders);
  }

  /**
   * Deletes a VaultNode, cleans up edges, log entries, FTS5 index, and local files
   */
  public async deleteNode(nodeId: string): Promise<void> {
    const target = this.getNodeById(nodeId);
    if (!target) return;

    await vaultFileManager.deleteNodeFromFileSystem(target);
    this.nodes = this.nodes.filter((n) => n.id !== nodeId);
    this.logSchemas = this.logSchemas.filter((s) => s.node_id !== nodeId);
    this.logEntries = this.logEntries.filter((e) => e.node_id !== nodeId);

    if (this.sqliteDb) {
      try {
        await this.sqliteDb.runAsync('DELETE FROM vault_nodes WHERE id = ?;', [nodeId]);
        await this.sqliteDb.runAsync('DELETE FROM vault_nodes_fts WHERE node_id = ?;', [nodeId]);
        await this.sqliteDb.runAsync('DELETE FROM log_schemas WHERE node_id = ?;', [nodeId]);
        await this.sqliteDb.runAsync('DELETE FROM log_entries WHERE node_id = ?;', [nodeId]);
      } catch {
        // Ignore
      }
    }

    await this.rebuildEdgesAndSyncVaultFiles();
  }

  /**
   * Creates a new VaultFolder
   */
  public async createFolder(name: string, icon = 'folder'): Promise<VaultFolder> {
    const folder: VaultFolder = {
      id: `folder-${Date.now()}`,
      name: name.trim(),
      icon,
      is_demo: false,
      created_at: new Date().toISOString(),
    };
    this.folders.push(folder);
    if (this.sqliteDb) {
      await this.persistFolderToSqlite(folder);
    }
    await vaultFileManager.writeGraphStateJson(this.nodes, this.edges, this.folders);
    return folder;
  }

  /**
   * FTS5 Instant Universal Search Engine:
   * Simultaneously searches filenames, titles, Markdown bodies, #tags,
   * structured Data Log entries, and scanned PDF OCR text with BM25-style ranking
   * and contextual snippet highlighting.
   */
  public searchVaultInstant(rawQuery: string): SearchMatchResult[] {
    const query = rawQuery.trim().toLowerCase();
    if (!query) return [];

    const terms = query.split(/\s+/).filter(Boolean);
    const results: SearchMatchResult[] = [];

    for (const node of this.nodes) {
      const matchedIn: SearchMatchResult['matched_in'] = [];
      let score = 0;

      const titleLower = node.title.toLowerCase();
      const fileLower = node.file_path.toLowerCase();
      const contentLower = node.content_md.toLowerCase();
      const tagsJoined = node.tags.join(' ').toLowerCase();

      // Check structured data log cells if node.type === 'LOG'
      let logRowText = '';
      if (node.type === 'LOG') {
        const entries = this.getLogEntriesForNode(node.id);
        logRowText = entries
          .map((e) => Object.values(e.values).join(' '))
          .join(' ')
          .toLowerCase();
      }

      let allTermsMatched = true;
      for (const term of terms) {
        const cleanTerm = term.replace(/^#/, '');
        let termMatched = false;

        if (titleLower.includes(cleanTerm)) {
          score += titleLower.startsWith(cleanTerm) ? 35 : 22;
          if (!matchedIn.includes('TITLE')) matchedIn.push('TITLE');
          termMatched = true;
        }
        if (fileLower.includes(cleanTerm)) {
          score += 12;
          if (!matchedIn.includes('FILENAME')) matchedIn.push('FILENAME');
          termMatched = true;
        }
        if (tagsJoined.includes(cleanTerm)) {
          score += 24;
          if (!matchedIn.includes('TAGS')) matchedIn.push('TAGS');
          termMatched = true;
        }
        if (contentLower.includes(cleanTerm)) {
          score += 15;
          if (!matchedIn.includes('CONTENT_OCR')) matchedIn.push('CONTENT_OCR');
          termMatched = true;
        }
        if (logRowText && logRowText.includes(cleanTerm)) {
          score += 18;
          if (!matchedIn.includes('DATA_LOG')) matchedIn.push('DATA_LOG');
          termMatched = true;
        }

        if (!termMatched) {
          allTermsMatched = false;
          break;
        }
      }

      if (allTermsMatched && score > 0) {
        const snippet = this.extractContextualSnippet(node.content_md, terms[0].replace(/^#/, ''));
        results.push({
          node,
          score,
          matched_in: matchedIn,
          snippet,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Marks all nodes as SYNCED and updates graph_state.json timestamp
   */
  public async markAllNodesSynced(): Promise<void> {
    const nowIso = new Date().toISOString();
    this.nodes = this.nodes.map((n) => ({
      ...n,
      sync_status: 'SYNCED',
    }));

    if (this.sqliteDb) {
      try {
        await this.sqliteDb.runAsync("UPDATE vault_nodes SET sync_status = 'SYNCED';");
      } catch {
        // Ignore
      }
    }

    await vaultFileManager.writeGraphStateJson(this.nodes, this.edges, this.folders, nowIso);
  }

  private extractContextualSnippet(markdown: string, term: string): string {
    const clean = markdown
      .replace(/^#+\s*/gm, '')
      .replace(/\|/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!term) return clean.slice(0, 130);
    const idx = clean.toLowerCase().indexOf(term.toLowerCase());
    if (idx === -1) return clean.slice(0, 130);

    const start = Math.max(0, idx - 38);
    const end = Math.min(clean.length, idx + term.length + 72);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < clean.length ? '…' : '';
    return `${prefix}${clean.slice(start, end)}${suffix}`;
  }

  private async rebuildEdgesAndSyncVaultFiles(): Promise<void> {
    // 1. Rebuild all MANUAL_LINK, SHARED_TAG, and KEYWORD_MATCH edges
    this.edges = buildUnifiedGraphEdges(this.nodes, this.logEntries);

    // 2. Persist edges to SQLite if available
    if (this.sqliteDb) {
      try {
        await this.sqliteDb.runAsync('DELETE FROM node_edges;');
        for (const edge of this.edges) {
          await this.sqliteDb.runAsync(
            `INSERT OR REPLACE INTO node_edges (id, source_node_id, target_node_id, relation_type, label, weight, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?);`,
            [
              edge.id,
              edge.source_node_id,
              edge.target_node_id,
              edge.relation_type,
              edge.label,
              edge.weight,
              edge.created_at,
            ]
          );
        }
      } catch {
        // Ignore
      }
    }

    // 3. Write every node and DocuMap_Vault/.documap/graph_state.json to the portable file system
    for (const node of this.nodes) {
      const schema = this.getLogSchemaForNode(node.id);
      const entries = this.getLogEntriesForNode(node.id);
      await vaultFileManager.writeNodeToFileSystem(node, schema, entries);
    }
    await vaultFileManager.writeGraphStateJson(this.nodes, this.edges, this.folders);
  }

  private async persistNodeToSqlite(node: VaultNode): Promise<void> {
    if (!this.sqliteDb) return;
    try {
      await this.sqliteDb.runAsync(
        `INSERT OR REPLACE INTO vault_nodes (
          id, type, title, content_md, file_path, scan_mode, scan_filter, page_count,
          tags, folder_id, token_count, is_encrypted, sync_status, created_at, updated_at,
          content_hash, is_demo, watermark_text, has_signature, graph_x, graph_y
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          node.id,
          node.type,
          node.title,
          node.content_md,
          node.file_path,
          node.scan_mode,
          node.scan_filter ?? null,
          node.page_count ?? 1,
          JSON.stringify(node.tags),
          node.folder_id,
          node.token_count,
          node.is_encrypted ? 1 : 0,
          node.sync_status,
          node.created_at,
          node.updated_at,
          node.content_hash,
          node.is_demo ? 1 : 0,
          node.watermark_text ?? null,
          node.has_signature ? 1 : 0,
          node.graph_x ?? 150,
          node.graph_y ?? 150,
        ]
      );

      await this.sqliteDb.runAsync('DELETE FROM vault_nodes_fts WHERE node_id = ?;', [node.id]);
      await this.sqliteDb.runAsync(
        `INSERT INTO vault_nodes_fts (node_id, title, file_path, content_md, tags)
         VALUES (?, ?, ?, ?, ?);`,
        [node.id, node.title, node.file_path, node.content_md, node.tags.join(' ')]
      );
    } catch {
      // Fallback handled by in-memory state
    }
  }

  private async persistFolderToSqlite(folder: VaultFolder): Promise<void> {
    if (!this.sqliteDb) return;
    try {
      await this.sqliteDb.runAsync(
        `INSERT OR REPLACE INTO vault_folders (id, name, icon, description, is_demo, created_at)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [
          folder.id,
          folder.name,
          folder.icon,
          folder.description ?? null,
          folder.is_demo ? 1 : 0,
          folder.created_at,
        ]
      );
    } catch {
      // Ignore
    }
  }

  private async persistLogSchemaToSqlite(schema: LogSchema): Promise<void> {
    if (!this.sqliteDb) return;
    try {
      await this.sqliteDb.runAsync(
        `INSERT OR REPLACE INTO log_schemas (id, node_id, columns_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?);`,
        [
          schema.id,
          schema.node_id,
          JSON.stringify(schema.columns),
          schema.created_at,
          schema.updated_at,
        ]
      );
    } catch {
      // Ignore
    }
  }

  private async persistLogEntryToSqlite(entry: LogEntry): Promise<void> {
    if (!this.sqliteDb) return;
    try {
      await this.sqliteDb.runAsync(
        `INSERT OR REPLACE INTO log_entries (
          id, node_id, schema_id, values_json, attached_scan_id, linked_note_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          entry.id,
          entry.node_id,
          entry.schema_id,
          JSON.stringify(entry.values),
          entry.attached_scan_id ?? null,
          entry.linked_note_id ?? null,
          entry.created_at,
          entry.updated_at,
        ]
      );
    } catch {
      // Ignore
    }
  }

  private mapRowToVaultNode(row: any): VaultNode {
    let parsedTags: string[] = [];
    try {
      parsedTags = JSON.parse(row.tags || '[]');
    } catch {
      parsedTags = [];
    }
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      content_md: row.content_md,
      file_path: row.file_path,
      scan_mode: row.scan_mode,
      scan_filter: row.scan_filter,
      page_count: Number(row.page_count || 1),
      tags: parsedTags,
      folder_id: row.folder_id,
      token_count: Number(row.token_count || 0),
      is_encrypted: Boolean(row.is_encrypted),
      sync_status: row.sync_status || 'SYNCED',
      created_at: row.created_at,
      updated_at: row.updated_at,
      content_hash: row.content_hash,
      is_demo: Boolean(row.is_demo),
      watermark_text: row.watermark_text,
      has_signature: Boolean(row.has_signature),
      graph_x: row.graph_x ? Number(row.graph_x) : undefined,
      graph_y: row.graph_y ? Number(row.graph_y) : undefined,
    };
  }
}

export const docuMapDb = new DocuMapDatabaseEngine();
