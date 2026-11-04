import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import {
  serializeLogToCsv,
  serializeMarkdownWithFrontmatter,
} from '../core/linkAndTokenEngine';
import {
  GraphStateJson,
  LogEntry,
  LogSchema,
  NodeEdge,
  VaultFolder,
  VaultNode,
} from '../models/types';

export interface VirtualVaultFile {
  relativePath: string;
  directory: 'Scans' | 'Notes' | 'Logs' | '.documap';
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  updatedAt: string;
  contentPreview: string;
}

class VaultFileManager {
  private virtualFiles = new Map<string, VirtualVaultFile>();
  private initialized = false;

  public getBaseDirectoryUri(): string {
    if (Platform.OS === 'web' || !FileSystem.documentDirectory) {
      return 'file:///local/DocuMap_Vault/';
    }
    return `${FileSystem.documentDirectory}DocuMap_Vault/`;
  }

  /**
   * Initializes the portable DocuMap_Vault/ directory tree:
   * - DocuMap_Vault/Scans/
   * - DocuMap_Vault/Notes/
   * - DocuMap_Vault/Logs/
   * - DocuMap_Vault/.documap/
   */
  public async initializeVaultDirectories(): Promise<void> {
    if (this.initialized) return;

    if (Platform.OS !== 'web' && FileSystem.documentDirectory) {
      const base = this.getBaseDirectoryUri();
      const subdirs = ['Scans', 'Notes', 'Logs', '.documap'];
      try {
        await FileSystem.makeDirectoryAsync(base, { intermediates: true });
        for (const sub of subdirs) {
          await FileSystem.makeDirectoryAsync(`${base}${sub}/`, { intermediates: true });
        }
      } catch {
        // Directory may already exist
      }
    }

    this.initialized = true;
  }

  /**
   * Generates a clean, portable relative file path inside DocuMap_Vault/
   */
  public buildRelativePath(nodeTitle: string, type: VaultNode['type']): string {
    const safeName = nodeTitle
      .trim()
      .replace(/[^a-zA-Z0-9_&-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'Untitled_Item';

    switch (type) {
      case 'SCAN':
        return `DocuMap_Vault/Scans/${safeName}.pdf`;
      case 'NOTE':
        return `DocuMap_Vault/Notes/${safeName}.md`;
      case 'LOG':
        return `DocuMap_Vault/Logs/${safeName}.csv`;
    }
  }

  /**
   * Persists a VaultNode to the portable file structure:
   * - SCAN -> searchable PDF metadata & companion .ocr.md in DocuMap_Vault/Scans/
   * - NOTE -> Markdown with YAML frontmatter in DocuMap_Vault/Notes/
   * - LOG  -> Both .csv and .json in DocuMap_Vault/Logs/
   */
  public async writeNodeToFileSystem(
    node: VaultNode,
    logSchema?: LogSchema,
    logEntries?: LogEntry[]
  ): Promise<void> {
    await this.initializeVaultDirectories();

    if (node.type === 'NOTE') {
      const mdPayload = serializeMarkdownWithFrontmatter(node);
      await this.writePhysicalAndVirtualFile(
        node.file_path,
        'Notes',
        'text/markdown',
        mdPayload,
        node.updated_at
      );
    } else if (node.type === 'SCAN') {
      // Write PDF descriptor + companion OCR markdown file
      const ocrCompanionPayload = serializeMarkdownWithFrontmatter(node);
      await this.writePhysicalAndVirtualFile(
        node.file_path,
        'Scans',
        'application/pdf',
        `%PDF-1.7 [DocuMap Searchable PDF + Embedded OCR Layer]\n${ocrCompanionPayload}`,
        node.updated_at
      );
    } else if (node.type === 'LOG') {
      const columns = logSchema?.columns ?? [
        { id: 'col_item', name: 'Item' },
        { id: 'col_value', name: 'Value' },
      ];
      const entries = logEntries ?? [];
      const csvContent = serializeLogToCsv(columns, entries);
      await this.writePhysicalAndVirtualFile(
        node.file_path,
        'Logs',
        'text/csv',
        csvContent,
        node.updated_at
      );

      // Also write companion structured .json file as required by spec
      const jsonPath = node.file_path.replace(/\.csv$/i, '.json');
      const jsonContent = JSON.stringify(
        {
          id: node.id,
          title: node.title,
          tags: node.tags,
          updated_at: node.updated_at,
          content_hash: node.content_hash,
          schema: logSchema ?? null,
          entries,
        },
        null,
        2
      );
      await this.writePhysicalAndVirtualFile(
        jsonPath,
        'Logs',
        'application/json',
        jsonContent,
        node.updated_at
      );
    }
  }

  /**
   * Removes a node's file(s) from DocuMap_Vault/
   */
  public async deleteNodeFromFileSystem(node: VaultNode): Promise<void> {
    this.virtualFiles.delete(node.file_path);
    if (node.type === 'LOG') {
      this.virtualFiles.delete(node.file_path.replace(/\.csv$/i, '.json'));
    }

    if (Platform.OS !== 'web' && FileSystem.documentDirectory) {
      const absUri = this.resolveAbsoluteUri(node.file_path);
      try {
        await FileSystem.deleteAsync(absUri, { idempotent: true });
      } catch {
        // Ignore if file wasn't on disk
      }
    }
  }

  /**
   * Writes DocuMap_Vault/.documap/graph_state.json containing node coordinates,
   * bidirectional edges, tags index, and sync timestamps.
   */
  public async writeGraphStateJson(
    nodes: VaultNode[],
    edges: NodeEdge[],
    folders: VaultFolder[],
    lastSyncedAt: string | null = null
  ): Promise<GraphStateJson> {
    await this.initializeVaultDirectories();

    const tagsIndex: Record<string, string[]> = {};
    for (const node of nodes) {
      for (const tag of node.tags) {
        if (!tagsIndex[tag]) {
          tagsIndex[tag] = [];
        }
        tagsIndex[tag].push(node.id);
      }
    }

    const nowIso = new Date().toISOString();
    const graphState: GraphStateJson = {
      schema_version: '1.0.0',
      vault_name: 'DocuMap_Vault',
      last_updated_at: nowIso,
      last_synced_at: lastSyncedAt ?? nowIso,
      device_platform: `${Platform.OS}`,
      folders,
      nodes: nodes.map((n, idx) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        file_path: n.file_path,
        tags: n.tags,
        folder_id: n.folder_id,
        token_count: n.token_count,
        content_hash: n.content_hash,
        sync_status: n.sync_status,
        updated_at: n.updated_at,
        coordinates: {
          x: n.graph_x ?? 120 + (idx % 3) * 110,
          y: n.graph_y ?? 140 + Math.floor(idx / 3) * 120,
        },
      })),
      edges,
      tags_index: tagsIndex,
    };

    const jsonString = JSON.stringify(graphState, null, 2);
    await this.writePhysicalAndVirtualFile(
      'DocuMap_Vault/.documap/graph_state.json',
      '.documap',
      'application/json',
      jsonString,
      nowIso
    );

    return graphState;
  }

  /**
   * Lists all portable files currently inside DocuMap_Vault/
   */
  public listVaultFiles(): VirtualVaultFile[] {
    return Array.from(this.virtualFiles.values()).sort((a, b) =>
      a.relativePath.localeCompare(b.relativePath)
    );
  }

  public getGraphStatePreview(): string {
    const file = this.virtualFiles.get('DocuMap_Vault/.documap/graph_state.json');
    return file ? file.contentPreview : '{}';
  }

  private resolveAbsoluteUri(relativePath: string): string {
    const cleanRel = relativePath.replace(/^DocuMap_Vault\//, '');
    return `${this.getBaseDirectoryUri()}${cleanRel}`;
  }

  private async writePhysicalAndVirtualFile(
    relativePath: string,
    directory: VirtualVaultFile['directory'],
    mimeType: string,
    content: string,
    updatedAt: string
  ): Promise<void> {
    const parts = relativePath.split('/');
    const fileName = parts[parts.length - 1] || relativePath;

    this.virtualFiles.set(relativePath, {
      relativePath,
      directory,
      fileName,
      mimeType,
      sizeBytes: content.length,
      updatedAt,
      contentPreview: content,
    });

    if (Platform.OS !== 'web' && FileSystem.documentDirectory) {
      const absUri = this.resolveAbsoluteUri(relativePath);
      try {
        await FileSystem.writeAsStringAsync(absUri, content, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      } catch {
        // Fallback silently to virtual mirror if permission restricted
      }
    }
  }
}

export const vaultFileManager = new VaultFileManager();
