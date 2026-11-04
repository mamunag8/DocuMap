import { LogEntry, NodeEdge, VaultNode } from '../models/types';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'your', 'have', 'are',
  'was', 'were', 'will', 'would', 'could', 'should', 'into', 'about', 'all',
  'not', 'but', 'can', 'has', 'had', 'our', 'out', 'use', 'used', 'using',
  'page', 'date', 'note', 'notes', 'scan', 'document', 'file', 'item', 'total',
  'also', 'each', 'per', 'via', 'more', 'than', 'when', 'where', 'which', 'who',
]);

/**
 * Deterministic 64-bit FNV-1a dual-lane hash for fast local Delta Sync verification
 */
export function computeContentHash(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0xc9dc5118;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c ^ (i & 0xff);
    h2 = Math.imul(h2, 0x01000193);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `sha256-${hex1}${hex2}`;
}

/**
 * Estimates BPE token count for Claude 3.5/4, GPT-4o, and Gemini models
 */
export function estimateTokens(text: string): number {
  if (!text || !text.trim()) return 0;
  const words = text.trim().split(/\s+/).length;
  const punctuationMatches = text.match(/[[\]{}().,:;!@#$%^&*+=<>/?\\|`~"-]/g);
  const punctCount = punctuationMatches ? punctuationMatches.length : 0;
  return Math.max(1, Math.ceil(words * 1.32 + punctCount * 0.35));
}

/**
 * Extracts all [[Wiki-Link]] targets from Markdown or OCR text.
 * Supports [[Target Title]] and [[Target Title|Display Alias]].
 */
export function extractWikiLinks(markdown: string): string[] {
  if (!markdown) return [];
  const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  const results = new Set<string>();
  let match: RegExpExecArray | null = regex.exec(markdown);
  while (match !== null) {
    const cleanTitle = match[1].trim();
    if (cleanTitle.length > 0) {
      results.add(cleanTitle);
    }
    match = regex.exec(markdown);
  }
  return Array.from(results);
}

/**
 * Extracts all #hashtags from Markdown text, returning normalized lowercase tag names (without '#')
 */
export function extractHashtags(markdown: string, existingTags: string[] = []): string[] {
  const tagSet = new Set<string>(
    existingTags.map((t) => t.replace(/^#+/, '').trim().toLowerCase()).filter(Boolean)
  );
  if (markdown) {
    const regex = /(?:^|\s)#([a-zA-Z0-9_-]{2,36})/g;
    let match: RegExpExecArray | null = regex.exec(markdown);
    while (match !== null) {
      tagSet.add(match[1].toLowerCase());
      match = regex.exec(markdown);
    }
  }
  return Array.from(tagSet);
}

/**
 * Extracts high-relevance domain keywords for Auto-Discovery Relations (KEYWORD_MATCH)
 */
export function extractHighRelevanceKeywords(node: VaultNode): string[] {
  const combined = `${node.title} ${node.content_md}`.toLowerCase();
  const words = combined
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) ?? 0) + 1);
  }

  // Boost words that appear in the node title
  const titleWords = new Set(
    node.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP_WORDS.has(w))
  );
  for (const tw of titleWords) {
    freq.set(tw, (freq.get(tw) ?? 0) + 3);
  }

  return Array.from(freq.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word]) => word);
}

/**
 * Rebuilds the complete unified bidirectional & auto-discovered NodeEdge graph
 * across all VaultNodes and LogEntries:
 * 1. MANUAL_LINK: Explicit [[Wiki-Links]] and Log row attached_scan_id / linked_note_id
 * 2. SHARED_TAG: Nodes sharing #tags
 * 3. KEYWORD_MATCH: High-relevance OCR & Markdown keyword overlap
 */
export function buildUnifiedGraphEdges(
  nodes: VaultNode[],
  logEntries: LogEntry[] = []
): NodeEdge[] {
  const edges: NodeEdge[] = [];
  const pairSeen = new Set<string>();
  const nowIso = new Date().toISOString();

  const makePairKey = (a: string, b: string, type: string) => {
    const [first, second] = a < b ? [a, b] : [b, a];
    return `${first}::${second}::${type}`;
  };

  const hasAnyLinkBetween = (a: string, b: string) => {
    const [first, second] = a < b ? [a, b] : [b, a];
    return (
      pairSeen.has(`${first}::${second}::MANUAL_LINK`) ||
      pairSeen.has(`${first}::${second}::SHARED_TAG`) ||
      pairSeen.has(`${first}::${second}::KEYWORD_MATCH`)
    );
  };

  // Index nodes by normalized title for [[Wiki-Link]] resolution
  const nodeByTitle = new Map<string, VaultNode>();
  const nodeById = new Map<string, VaultNode>();
  for (const node of nodes) {
    nodeByTitle.set(node.title.trim().toLowerCase(), node);
    nodeById.set(node.id, node);
  }

  // 1. MANUAL_LINK from [[Wiki-Links]] in content_md
  for (const source of nodes) {
    const wikiTargets = extractWikiLinks(source.content_md);
    for (const targetTitle of wikiTargets) {
      const normalized = targetTitle.toLowerCase();
      // Exact or prefix/substring match
      let target = nodeByTitle.get(normalized);
      if (!target) {
        target = nodes.find(
          (n) =>
            n.id !== source.id &&
            (n.title.toLowerCase().includes(normalized) ||
              normalized.includes(n.title.toLowerCase()))
        );
      }
      if (target && target.id !== source.id) {
        const key = makePairKey(source.id, target.id, 'MANUAL_LINK');
        if (!pairSeen.has(key)) {
          pairSeen.add(key);
          edges.push({
            id: `edge-manual-${source.id}-${target.id}`,
            source_node_id: source.id,
            target_node_id: target.id,
            relation_type: 'MANUAL_LINK',
            label: `[[${target.title}]]`,
            weight: 1.0,
            created_at: nowIso,
          });
        }
      }
    }
  }

  // Also check LogEntries for attached_scan_id, linked_note_id, or [[Wiki-Links]] inside cell values
  for (const entry of logEntries) {
    const parentLog = nodeById.get(entry.node_id);
    if (!parentLog) continue;

    const linkedIds: string[] = [];
    if (entry.attached_scan_id && nodeById.has(entry.attached_scan_id)) {
      linkedIds.push(entry.attached_scan_id);
    }
    if (entry.linked_note_id && nodeById.has(entry.linked_note_id)) {
      linkedIds.push(entry.linked_note_id);
    }

    // Check cell values for [[Wiki-Links]]
    for (const val of Object.values(entry.values)) {
      if (typeof val === 'string' && val.includes('[[')) {
        for (const wt of extractWikiLinks(val)) {
          const found = nodeByTitle.get(wt.toLowerCase());
          if (found) linkedIds.push(found.id);
        }
      }
    }

    for (const targetId of linkedIds) {
      if (targetId === parentLog.id) continue;
      const target = nodeById.get(targetId);
      if (!target) continue;
      const key = makePairKey(parentLog.id, target.id, 'MANUAL_LINK');
      if (!pairSeen.has(key)) {
        pairSeen.add(key);
        edges.push({
          id: `edge-manual-${parentLog.id}-${target.id}`,
          source_node_id: parentLog.id,
          target_node_id: target.id,
          relation_type: 'MANUAL_LINK',
          label: `[[${target.title}]]`,
          weight: 1.0,
          created_at: nowIso,
        });
      }
    }
  }

  // 2. SHARED_TAG edges
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const sharedTags = a.tags.filter((tag) => b.tags.includes(tag));
      if (sharedTags.length > 0) {
        const key = makePairKey(a.id, b.id, 'SHARED_TAG');
        if (!pairSeen.has(key)) {
          pairSeen.add(key);
          edges.push({
            id: `edge-tag-${a.id}-${b.id}`,
            source_node_id: a.id,
            target_node_id: b.id,
            relation_type: 'SHARED_TAG',
            label: `#${sharedTags[0]}`,
            weight: 0.72,
            created_at: nowIso,
          });
        }
      }
    }
  }

  // 3. KEYWORD_MATCH auto-discovery edges (high-relevance OCR & Markdown keywords)
  const keywordsByNode = new Map<string, string[]>();
  for (const node of nodes) {
    keywordsByNode.set(node.id, extractHighRelevanceKeywords(node));
  }

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (hasAnyLinkBetween(a.id, b.id)) continue;

      const kwA = keywordsByNode.get(a.id) ?? [];
      const kwB = new Set(keywordsByNode.get(b.id) ?? []);
      const sharedKw = kwA.filter((k) => kwB.has(k));

      if (sharedKw.length >= 2) {
        const key = makePairKey(a.id, b.id, 'KEYWORD_MATCH');
        pairSeen.add(key);
        edges.push({
          id: `edge-kw-${a.id}-${b.id}`,
          source_node_id: a.id,
          target_node_id: b.id,
          relation_type: 'KEYWORD_MATCH',
          label: `kw: ${sharedKw.slice(0, 2).join(', ')}`,
          weight: 0.45,
          created_at: nowIso,
        });
      }
    }
  }

  return edges;
}

/**
 * Serializes a VaultNode into an Obsidian-compatible Markdown file with YAML frontmatter
 */
export function serializeMarkdownWithFrontmatter(node: VaultNode): string {
  const tagsYaml = node.tags.map((t) => `  - "${t}"`).join('\n');
  return [
    '---',
    `id: "${node.id}"`,
    `title: "${node.title.replace(/"/g, '\\"')}"`,
    `type: "${node.type}"`,
    `folder_id: "${node.folder_id}"`,
    `token_count: ${node.token_count}`,
    `content_hash: "${node.content_hash}"`,
    `updated_at: "${node.updated_at}"`,
    'tags:',
    tagsYaml || '  []',
    '---',
    '',
    node.content_md,
  ].join('\n');
}

/**
 * Converts a LogSchema + LogEntry[] into standard RFC-4180 CSV text for DocuMap_Vault/Logs/*.csv
 */
export function serializeLogToCsv(
  columns: { id: string; name: string }[],
  entries: LogEntry[]
): string {
  const escapeCsv = (val: string | number | null | undefined) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const header = [
    ...columns.map((c) => escapeCsv(c.name)),
    'Attached_Scan_ID',
    'Linked_Note_ID',
  ].join(',');

  const rows = entries.map((entry) =>
    [
      ...columns.map((c) => escapeCsv(entry.values[c.id])),
      escapeCsv(entry.attached_scan_id ?? ''),
      escapeCsv(entry.linked_note_id ?? ''),
    ].join(',')
  );

  return [header, ...rows].join('\n');
}
