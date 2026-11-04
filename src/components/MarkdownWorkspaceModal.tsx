import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { getNodePillarStyle } from '../theme/theme';
import { useVault } from '../store/VaultContext';
import {
  computeContentHash,
  estimateTokens,
  extractHashtags,
  extractWikiLinks,
  serializeMarkdownWithFrontmatter,
} from '../core/linkAndTokenEngine';
import { VaultNode } from '../models/types';
import { WikiLinkAutocompleteSheet } from './WikiLinkAutocompleteSheet';
import { BacklinksAndMiniGraphTray } from './BacklinksAndMiniGraphTray';

type EditorViewMode = 'HYBRID_SPLIT' | 'EDIT_ONLY' | 'PREVIEW_ONLY';

interface MarkdownWorkspaceModalProps {
  visible: boolean;
  node: VaultNode | null;
  onClose: () => void;
  onSwitchToNode: (target: VaultNode) => void;
}

export const MarkdownWorkspaceModal: React.FC<MarkdownWorkspaceModalProps> = ({
  visible,
  node,
  onClose,
  onSwitchToNode,
}) => {
  const { theme } = useAppTheme();
  const {
    nodes,
    folders,
    createOrUpdateNode,
    getConnectedNeighbors,
    packNodeWithFirstDegreeLinks,
    deleteNodeById,
  } = useVault();

  const [title, setTitle] = useState<string>('');
  const [contentMd, setContentMd] = useState<string>('');
  const [folderId, setFolderId] = useState<string>('folder-knowledge-notes');
  const [editorMode, setEditorMode] = useState<EditorViewMode>('HYBRID_SPLIT');
  const [showYamlFrontmatter, setShowYamlFrontmatter] = useState<boolean>(false);

  // [[Wiki-Link]] Bottom-Sheet Autocomplete State
  const [wikiSheetOpen, setWikiSheetOpen] = useState<boolean>(false);
  const [wikiQuery, setWikiQuery] = useState<string>('');
  const [attachScanPickerOpen, setAttachScanPickerOpen] = useState<boolean>(false);
  const [tagPromptOpen, setTagPromptOpen] = useState<boolean>(false);
  const [newTagText, setNewTagText] = useState<string>('');
  const [isDirty, setIsDirty] = useState<boolean>(false);

  useEffect(() => {
    if (node) {
      setTitle(node.title);
      setContentMd(node.content_md);
      setFolderId(node.folder_id);
      setIsDirty(false);
    }
  }, [node]);

  const liveTags = useMemo(
    () => extractHashtags(contentMd, node?.tags ?? []),
    [contentMd, node]
  );

  const liveWikiLinks = useMemo(() => extractWikiLinks(contentMd), [contentMd]);

  const liveTokenCount = useMemo(
    () => estimateTokens(`${title}\n${contentMd}`),
    [title, contentMd]
  );

  if (!visible || !node) return null;

  const pillar = getNodePillarStyle(node.type, theme);
  const neighbors = getConnectedNeighbors(node.id);
  const scanNodes = nodes.filter((n) => n.type === 'SCAN' && n.id !== node.id);

  /**
   * Detects when the user types `[[` inside the Markdown body and opens
   * the instant [[Wiki-Link]] bottom-sheet autocomplete popup
   */
  const handleContentChange = (nextText: string) => {
    setContentMd(nextText);
    setIsDirty(true);

    // Check if the user just typed `[[` at the end or has an unclosed `[[query` at the end
    const trailingMatch = nextText.match(/\[\[([^[\]\n]{0,36})$/);
    if (trailingMatch && nextText.length > contentMd.length) {
      setWikiQuery(trailingMatch[1]);
      setWikiSheetOpen(true);
    }
  };

  /**
   * Inserts `[[Target_Title]]` into the Markdown content and immediately persists
   * the bidirectional edge in SQLite & graph_state.json
   */
  const handleInsertWikiNode = async (targetNode: VaultNode) => {
    let updatedContent = contentMd;
    if (/ \[\[([^[\]\n]{0,36})$/.test(updatedContent) || /\[\[([^[\]\n]{0,36})$/.test(updatedContent)) {
      updatedContent = updatedContent.replace(
        /\[\[([^[\]\n]{0,36})$/,
        `[[${targetNode.title}]] `
      );
    } else {
      updatedContent = `${updatedContent.trimEnd()} [[${targetNode.title}]] `;
    }
    setContentMd(updatedContent);
    await saveDraftImmediately(title, updatedContent, folderId);
  };

  /**
   * Forward-creates a new Markdown Note when the user types [[New Note Title]]
   * in the autocomplete sheet and links it bidirectionally
   */
  const handleCreateAndLinkNewNote = async (newNoteTitle: string) => {
    const createdTarget = await createOrUpdateNode({
      type: 'NOTE',
      title: newNoteTitle,
      content_md: `# ${newNoteTitle}\n\nReferenced from [[${title}]].\n\n#${
        liveTags[0] ?? 'notes'
      }`,
      tags: [liveTags[0] ?? 'notes'],
      folder_id: 'folder-knowledge-notes',
    });
    await handleInsertWikiNode(createdTarget);
  };

  /**
   * Attaches a Scanned Document (PDF + OCR excerpt) into the current Markdown note
   */
  const handleAttachScanNode = async (scanNode: VaultNode) => {
    const ocrExcerpt = scanNode.content_md
      .replace(/^#+\s*/gm, '')
      .split('\n')
      .filter((l) => l.trim().length > 0)
      .slice(0, 3)
      .join(' • ')
      .slice(0, 160);

    const block = [
      '',
      `> 📎 **Attached Scan:** [[${scanNode.title}]] (\`${scanNode.file_path}\`)`,
      `> *OCR Excerpt:* ${ocrExcerpt}`,
      '',
    ].join('\n');

    const updated = `${contentMd.trimEnd()}\n${block}`;
    setContentMd(updated);
    setAttachScanPickerOpen(false);
    await saveDraftImmediately(title, updated, folderId);
  };

  /**
   * Floating Keyboard Toolbar Snippet Inserters
   */
  const insertToolbarSnippet = (
    snippetType: 'WIKI' | 'TAG' | 'CHECKLIST' | 'TABLE' | 'ATTACH_SCAN' | 'CODE_BLOCK'
  ) => {
    if (snippetType === 'WIKI') {
      setWikiQuery('');
      setWikiSheetOpen(true);
      return;
    }
    if (snippetType === 'ATTACH_SCAN') {
      setAttachScanPickerOpen(true);
      return;
    }
    if (snippetType === 'TAG') {
      setTagPromptOpen(true);
      return;
    }

    let addition = '';
    if (snippetType === 'CHECKLIST') {
      addition = '\n- [ ] Action item / milestone task';
    } else if (snippetType === 'TABLE') {
      addition =
        '\n\n| Parameter / Item | Specification | Linked Document |\n| :--- | :--- | :--- |\n| Entry 01 | Verified | [[' +
        (nodes.find((n) => n.id !== node.id)?.title ?? 'Hardware Supplier Invoice') +
        ']] |\n';
    } else if (snippetType === 'CODE_BLOCK') {
      addition =
        '\n\n```yaml\nvault_pipeline: local_first_ocr\nencryption: AES-256-GCM\nsync_mode: BYOC_DELTA\n```\n';
    }

    const next = `${contentMd.trimEnd()}${addition}`;
    setContentMd(next);
    setIsDirty(true);
  };

  /**
   * Toggles a Markdown checklist line (`- [ ]` <-> `- [x]`) directly from the Live Formatted Preview
   */
  const toggleChecklistLine = async (lineIndex: number) => {
    const lines = contentMd.split('\n');
    const line = lines[lineIndex];
    if (!line) return;

    if (line.includes('- [ ]')) {
      lines[lineIndex] = line.replace('- [ ]', '- [x]');
    } else if (line.includes('- [x]') || line.includes('- [X]')) {
      lines[lineIndex] = line.replace(/- \[[xX]\]/, '- [ ]');
    }
    const next = lines.join('\n');
    setContentMd(next);
    await saveDraftImmediately(title, next, folderId);
  };

  const saveDraftImmediately = async (
    nextTitle = title,
    nextContent = contentMd,
    nextFolder = folderId
  ) => {
    await createOrUpdateNode({
      ...node,
      id: node.id,
      type: node.type,
      title: nextTitle.trim() || 'Untitled Note',
      content_md: nextContent,
      folder_id: nextFolder,
      tags: extractHashtags(nextContent, node.tags),
    });
    setIsDirty(false);
  };

  /**
   * Renders rich interactive Markdown blocks with clickable [[Wiki-Links]],
   * interactive checklists, tables, code blocks, and #tags
   */
  const renderInteractiveMarkdownPreview = () => {
    const lines = contentMd.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <View key={idx} style={{ height: 6 }} />;
      }

      // Heading H1 / H2 / H3
      if (trimmed.startsWith('# ')) {
        return (
          <Text
            key={idx}
            style={[styles.mdH1, { color: theme.textPrimary }]}
          >
            {trimmed.replace(/^#\s+/, '')}
          </Text>
        );
      }
      if (trimmed.startsWith('## ')) {
        return (
          <Text
            key={idx}
            style={[styles.mdH2, { color: theme.textPrimary }]}
          >
            {trimmed.replace(/^##\s+/, '')}
          </Text>
        );
      }
      if (trimmed.startsWith('### ')) {
        return (
          <Text
            key={idx}
            style={[styles.mdH3, { color: theme.accentPrimary }]}
          >
            {trimmed.replace(/^###\s+/, '')}
          </Text>
        );
      }

      // Interactive Checklist `- [ ]` or `- [x]`
      if (/^-\s*\[([ xX])\]\s+/.test(trimmed)) {
        const checked = /^-\s*\[[xX]\]/.test(trimmed);
        const label = trimmed.replace(/^-\s*\[[ xX]\]\s+/, '');
        return (
          <TouchableOpacity
            key={idx}
            activeOpacity={0.78}
            onPress={() => toggleChecklistLine(idx)}
            style={[
              styles.mdChecklistRow,
              {
                backgroundColor: theme.surface,
                borderColor: checked ? theme.nodeNoteBorder : theme.cardBorder,
              },
            ]}
          >
            <Ionicons
              name={checked ? 'checkbox' : 'square-outline'}
              size={18}
              color={checked ? theme.nodeNote : theme.textMuted}
            />
            <Text
              style={[
                styles.mdChecklistText,
                {
                  color: checked ? theme.textMuted : theme.textPrimary,
                  textDecorationLine: checked ? 'line-through' : 'none',
                },
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      }

      // Blockquote `> `
      if (trimmed.startsWith('>')) {
        return (
          <View
            key={idx}
            style={[
              styles.mdQuoteBox,
              {
                backgroundColor: theme.surface,
                borderLeftColor: theme.accentPrimary,
              },
            ]}
          >
            <Text style={[styles.mdQuoteText, { color: theme.textSecondary }]}>
              {trimmed.replace(/^>\s*/, '')}
            </Text>
          </View>
        );
      }

      // Markdown Table row `| ... |`
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        if (/^\|[\s:|-]+\|$/.test(trimmed)) return null;
        const cells = trimmed
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        return (
          <View
            key={idx}
            style={[
              styles.mdTableRow,
              {
                backgroundColor: theme.surface,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            {cells.map((cell, cIdx) => (
              <Text
                key={cIdx}
                style={[styles.mdTableCell, { color: theme.textPrimary }]}
                numberOfLines={2}
              >
                {cell}
              </Text>
            ))}
          </View>
        );
      }

      // Standard paragraph with inline clickable [[Wiki-Link]] pills
      const lineLinks = extractWikiLinks(trimmed);
      return (
        <View key={idx} style={styles.mdParagraphWrap}>
          <Text style={[styles.mdParagraph, { color: theme.textPrimary }]}>
            {trimmed}
          </Text>
          {lineLinks.length > 0 && (
            <View style={styles.inlineWikiPillsRow}>
              {lineLinks.map((targetTitle) => {
                const targetNode = nodes.find(
                  (n) =>
                    n.title.toLowerCase() === targetTitle.toLowerCase() ||
                    n.title.toLowerCase().includes(targetTitle.toLowerCase())
                );
                const tPillar = targetNode
                  ? getNodePillarStyle(targetNode.type, theme)
                  : pillar;

                return (
                  <TouchableOpacity
                    key={targetTitle}
                    onPress={() => {
                      if (targetNode) {
                        onSwitchToNode(targetNode);
                      }
                    }}
                    style={[
                      styles.inlineWikiPill,
                      {
                        backgroundColor: tPillar.softBg,
                        borderColor: tPillar.borderColor,
                      },
                    ]}
                  >
                    <Ionicons
                      name={tPillar.iconName}
                      size={11}
                      color={tPillar.color}
                    />
                    <Text
                      style={[
                        styles.inlineWikiPillText,
                        { color: tPillar.color },
                      ]}
                    >
                      Jump to [[{targetTitle}]]
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={11}
                      color={tPillar.color}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      );
    });
  };

  const liveYamlPreview = serializeMarkdownWithFrontmatter({
    ...node,
    title,
    content_md: contentMd,
    tags: liveTags,
    token_count: liveTokenCount,
    content_hash: computeContentHash(`${title}::${contentMd}`),
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={async () => {
        if (isDirty) await saveDraftImmediately();
        onClose();
      }}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.workspaceSheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          {/* Top Workspace Bar */}
          <View style={styles.topHeader}>
            <View style={styles.topHeaderLeft}>
              <View
                style={[
                  styles.pillarBadge,
                  {
                    backgroundColor: pillar.softBg,
                    borderColor: pillar.borderColor,
                  },
                ]}
              >
                <Ionicons name={pillar.iconName} size={13} color={pillar.color} />
                <Text style={[styles.pillarBadgeText, { color: pillar.color }]}>
                  {node.type === 'SCAN'
                    ? 'SCAN OCR + MARKDOWN STUDIO'
                    : 'OBSIDIAN MARKDOWN WORKSPACE'}
                </Text>
              </View>

              <View
                style={[
                  styles.tokenPill,
                  { backgroundColor: theme.surfaceElevated },
                ]}
              >
                <Text style={[styles.tokenPillText, { color: theme.accentPrimary }]}>
                  ⚡ {liveTokenCount} tok • {liveWikiLinks.length} [[]]
                </Text>
              </View>
            </View>

            <View style={styles.topHeaderRight}>
              <TouchableOpacity
                onPress={() => setShowYamlFrontmatter(!showYamlFrontmatter)}
                style={[
                  styles.yamlToggleBtn,
                  {
                    backgroundColor: showYamlFrontmatter
                      ? theme.accentPrimarySoft
                      : theme.surfaceElevated,
                    borderColor: showYamlFrontmatter
                      ? theme.accentPrimary
                      : theme.cardBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.yamlToggleText,
                    {
                      color: showYamlFrontmatter
                        ? theme.accentPrimary
                        : theme.textSecondary,
                    },
                  ]}
                >
                  YAML
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={async () => {
                  await saveDraftImmediately();
                  onClose();
                }}
                style={[
                  styles.saveAndCloseBtn,
                  { backgroundColor: theme.accentPrimary },
                ]}
              >
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                <Text style={styles.saveAndCloseText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Editable Document Title & Portable File Path */}
          <TextInput
            value={title}
            onChangeText={(t) => {
              setTitle(t);
              setIsDirty(true);
            }}
            placeholder="Document Title…"
            placeholderTextColor={theme.textMuted}
            style={[styles.titleInput, { color: theme.textPrimary }]}
          />

          <View style={styles.pathAndModeBar}>
            <Text
              style={[styles.filePathText, { color: theme.textMuted }]}
              numberOfLines={1}
            >
              {node.file_path}
            </Text>

            {/* Editor View Mode Switcher: Hybrid Split | Edit | Live Preview */}
            <View
              style={[
                styles.modeSegmented,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              {(
                [
                  { key: 'HYBRID_SPLIT', label: 'Hybrid' },
                  { key: 'EDIT_ONLY', label: 'Source' },
                  { key: 'PREVIEW_ONLY', label: 'Live View' },
                ] as Array<{ key: EditorViewMode; label: string }>
              ).map((m) => {
                const active = editorMode === m.key;
                return (
                  <TouchableOpacity
                    key={m.key}
                    onPress={() => setEditorMode(m.key)}
                    style={[
                      styles.modeSegmentBtn,
                      active && { backgroundColor: theme.accentPrimary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.modeSegmentText,
                        { color: active ? '#FFFFFF' : theme.textSecondary },
                      ]}
                    >
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Floating Keyboard Toolbar: [[ Link Node ]] | #Tag | Checklist | Table | Attach Scan | Code Block */}
          <View
            style={[
              styles.floatingToolbar,
              {
                backgroundColor: theme.surfaceElevated,
                borderColor: theme.cardBorder,
              },
            ]}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.toolbarScroll}
              keyboardShouldPersistTaps="handled"
            >
              <TouchableOpacity
                onPress={() => insertToolbarSnippet('WIKI')}
                style={[
                  styles.toolbarBtnPrimary,
                  {
                    backgroundColor: theme.accentPrimarySoft,
                    borderColor: theme.accentPrimary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.toolbarBtnPrimaryText,
                    { color: theme.accentPrimary },
                  ]}
                >
                  [[ Link Node ]]
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => insertToolbarSnippet('TAG')}
                style={[
                  styles.toolbarBtn,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <Ionicons
                  name="pricetag-outline"
                  size={13}
                  color={theme.nodeNote}
                />
                <Text style={[styles.toolbarBtnText, { color: theme.textPrimary }]}>
                  #Tag
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => insertToolbarSnippet('CHECKLIST')}
                style={[
                  styles.toolbarBtn,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <Ionicons
                  name="checkbox-outline"
                  size={13}
                  color={theme.nodeNote}
                />
                <Text style={[styles.toolbarBtnText, { color: theme.textPrimary }]}>
                  Checklist
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => insertToolbarSnippet('TABLE')}
                style={[
                  styles.toolbarBtn,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <Ionicons name="grid-outline" size={13} color={theme.nodeLog} />
                <Text style={[styles.toolbarBtnText, { color: theme.textPrimary }]}>
                  Table
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => insertToolbarSnippet('ATTACH_SCAN')}
                style={[
                  styles.toolbarBtn,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <Ionicons
                  name="document-attach-outline"
                  size={13}
                  color={theme.nodeScan}
                />
                <Text style={[styles.toolbarBtnText, { color: theme.textPrimary }]}>
                  Attach Scan
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => insertToolbarSnippet('CODE_BLOCK')}
                style={[
                  styles.toolbarBtn,
                  {
                    backgroundColor: theme.surface,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <Ionicons
                  name="code-slash-outline"
                  size={13}
                  color={theme.accentPrimary}
                />
                <Text style={[styles.toolbarBtnText, { color: theme.textPrimary }]}>
                  Code Block
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Inline Quick #Tag Adder Strip if open */}
          {tagPromptOpen && (
            <View
              style={[
                styles.quickInlinePrompt,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.nodeNoteBorder,
                },
              ]}
            >
              <Text style={[styles.hashPrefix, { color: theme.nodeNote }]}>#</Text>
              <TextInput
                value={newTagText}
                onChangeText={setNewTagText}
                placeholder="type-tag-name (e.g. q4-audit)"
                placeholderTextColor={theme.textMuted}
                style={[styles.quickTagInput, { color: theme.textPrimary }]}
                autoFocus
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => {
                  const clean = newTagText
                    .replace(/[^a-zA-Z0-9_-]/g, '')
                    .toLowerCase();
                  if (clean) {
                    const updated = `${contentMd.trimEnd()} #${clean}`;
                    setContentMd(updated);
                    setIsDirty(true);
                  }
                  setNewTagText('');
                  setTagPromptOpen(false);
                }}
                style={[
                  styles.addTagConfirmBtn,
                  { backgroundColor: theme.nodeNote },
                ]}
              >
                <Text style={styles.addTagConfirmText}>Insert #Tag</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTagPromptOpen(false)}>
                <Ionicons name="close" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {/* Inline Attach Scan Picker Strip if open */}
          {attachScanPickerOpen && (
            <View
              style={[
                styles.attachScanStrip,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.nodeScanBorder,
                },
              ]}
            >
              <View style={styles.attachScanHeader}>
                <Text style={[styles.attachScanTitle, { color: theme.nodeScan }]}>
                  SELECT A SCANNED DOCUMENT TO EMBED + LINK ([[SCAN_TITLE]])
                </Text>
                <TouchableOpacity onPress={() => setAttachScanPickerOpen(false)}>
                  <Ionicons name="close" size={16} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.attachScanChipsRow}>
                  {scanNodes.map((sn) => (
                    <TouchableOpacity
                      key={sn.id}
                      onPress={() => handleAttachScanNode(sn)}
                      style={[
                        styles.attachScanChip,
                        {
                          backgroundColor: theme.nodeScanSoft,
                          borderColor: theme.nodeScanBorder,
                        },
                      ]}
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={13}
                        color={theme.nodeScan}
                      />
                      <Text
                        style={[
                          styles.attachScanChipText,
                          { color: theme.nodeScan },
                        ]}
                      >
                        {sn.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Main Scrollable Workspace: YAML Frontmatter + Markdown Source Editor + Live Interactive Preview + Backlinks Footer */}
          <ScrollView
            style={styles.workspaceScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Optional Raw Obsidian YAML Frontmatter Inspector */}
            {showYamlFrontmatter && (
              <View
                style={[
                  styles.yamlBox,
                  {
                    backgroundColor: theme.background,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <Text style={[styles.yamlBoxTitle, { color: theme.accentPrimary }]}>
                  PORTABLE OBSIDIAN / VS CODE YAML FRONTMATTER ({node.file_path})
                </Text>
                <Text style={[styles.yamlCodeText, { color: theme.textSecondary }]}>
                  {liveYamlPreview.split('\n').slice(0, 14).join('\n')}
                </Text>
              </View>
            )}

            {/* Markdown Source Editor (shown in HYBRID_SPLIT and EDIT_ONLY) */}
            {(editorMode === 'HYBRID_SPLIT' || editorMode === 'EDIT_ONLY') && (
              <View
                style={[
                  styles.editorPane,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <View style={styles.paneHeaderRow}>
                  <Text style={[styles.paneHeaderLabel, { color: theme.textMuted }]}>
                    MARKDOWN SOURCE (TYPE [[ ANYWHERE FOR INSTANT NODE LINKER)
                  </Text>
                  <TouchableOpacity
                    onPress={() => saveDraftImmediately()}
                    style={[
                      styles.syncDraftChip,
                      {
                        backgroundColor: isDirty
                          ? theme.warningSoft
                          : theme.successSoft,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.syncDraftChipText,
                        {
                          color: isDirty ? theme.warning : theme.success,
                        },
                      ]}
                    >
                      {isDirty ? 'Tap to Save Draft' : 'Saved to Vault ✓'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <TextInput
                  value={contentMd}
                  onChangeText={handleContentChange}
                  multiline
                  placeholder="Write Markdown notes, type [[ to link any Scan/Note/Log, or add #tags…"
                  placeholderTextColor={theme.textMuted}
                  style={[
                    styles.markdownInput,
                    {
                      color: theme.textPrimary,
                      minHeight: editorMode === 'EDIT_ONLY' ? 280 : 155,
                    },
                  ]}
                />
              </View>
            )}

            {/* Live Formatted Interactive Preview (shown in HYBRID_SPLIT and PREVIEW_ONLY) */}
            {(editorMode === 'HYBRID_SPLIT' || editorMode === 'PREVIEW_ONLY') && (
              <View
                style={[
                  styles.previewPane,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <View style={styles.paneHeaderRow}>
                  <Text style={[styles.paneHeaderLabel, { color: theme.textMuted }]}>
                    LIVE FORMATTED PREVIEW (TAP CHECKBOXES OR [[WIKI-LINKS]])
                  </Text>
                </View>
                {renderInteractiveMarkdownPreview()}
              </View>
            )}

            {/* Active #Tags Strip */}
            <View style={styles.tagsFooterRow}>
              {liveTags.map((t) => (
                <View
                  key={t}
                  style={[
                    styles.tagPill,
                    {
                      backgroundColor: theme.surfaceElevated,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <Text style={[styles.tagPillText, { color: theme.nodeNote }]}>
                    #{t}
                  </Text>
                </View>
              ))}
            </View>

            {/* Collapsible Backlinks Footer & Mini 1-Hop Local Graph Preview */}
            <BacklinksAndMiniGraphTray
              currentNode={node}
              neighbors={neighbors}
              onNavigateToNode={async (target) => {
                if (isDirty) await saveDraftImmediately();
                onSwitchToNode(target);
              }}
              onPackNeighborhoodForAi={async (targetId) => {
                if (isDirty) await saveDraftImmediately();
                onClose();
                packNodeWithFirstDegreeLinks(targetId);
              }}
            />
          </ScrollView>

          {/* Bottom Workspace Footer */}
          <View
            style={[
              styles.bottomBar,
              { borderTopColor: theme.divider },
            ]}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.folderChipsRow}>
                {folders.map((f) => {
                  const isCurrentFolder = folderId === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      onPress={() => {
                        setFolderId(f.id);
                        setIsDirty(true);
                      }}
                      style={[
                        styles.folderChip,
                        {
                          backgroundColor: isCurrentFolder
                            ? theme.accentPrimarySoft
                            : theme.surfaceElevated,
                          borderColor: isCurrentFolder
                            ? theme.accentPrimary
                            : theme.cardBorder,
                        },
                      ]}
                    >
                      <Ionicons
                        name="folder-outline"
                        size={11}
                        color={
                          isCurrentFolder
                            ? theme.accentPrimary
                            : theme.textSecondary
                        }
                      />
                      <Text
                        style={[
                          styles.folderChipText,
                          {
                            color: isCurrentFolder
                              ? theme.accentPrimary
                              : theme.textSecondary,
                          },
                        ]}
                      >
                        {f.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={async () => {
                await deleteNodeById(node.id);
                onClose();
              }}
              style={[
                styles.deleteIconBtn,
                { backgroundColor: theme.dangerSoft },
              ]}
            >
              <Ionicons name="trash-outline" size={16} color={theme.danger} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Instant [[ Bottom-Sheet Node Linker Popup */}
      <WikiLinkAutocompleteSheet
        visible={wikiSheetOpen}
        initialQuery={wikiQuery}
        excludeNodeId={node.id}
        nodes={nodes}
        onSelectNode={handleInsertWikiNode}
        onCreateAndLinkNewNote={handleCreateAndLinkNewNote}
        onClose={() => setWikiSheetOpen(false)}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 7, 15, 0.78)',
    justifyContent: 'flex-end',
  },
  workspaceSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    height: '94%',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  pillarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 7,
    borderWidth: 1,
  },
  pillarBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  tokenPill: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 7,
  },
  tokenPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  topHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  yamlToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  yamlToggleText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  saveAndCloseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
  },
  saveAndCloseText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  titleInput: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.3,
    paddingVertical: 4,
  },
  pathAndModeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  filePathText: {
    flex: 1,
    fontSize: 10.5,
    fontFamily: 'monospace',
  },
  modeSegmented: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    padding: 2,
  },
  modeSegmentBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  modeSegmentText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  floatingToolbar: {
    borderRadius: 11,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  toolbarScroll: {
    alignItems: 'center',
    gap: 6,
  },
  toolbarBtnPrimary: {
    paddingHorizontal: 10,
    paddingVertical: 5.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  toolbarBtnPrimaryText: {
    fontSize: 11.5,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5.5,
    borderRadius: 8,
    borderWidth: 1,
  },
  toolbarBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  quickInlinePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
    gap: 6,
  },
  hashPrefix: {
    fontSize: 15,
    fontWeight: '900',
  },
  quickTagInput: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
  },
  addTagConfirmBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  addTagConfirmText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  attachScanStrip: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 9,
    marginBottom: 8,
  },
  attachScanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  attachScanTitle: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  attachScanChipsRow: {
    flexDirection: 'row',
    gap: 7,
  },
  attachScanChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  attachScanChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  workspaceScroll: {
    flex: 1,
  },
  yamlBox: {
    borderRadius: 11,
    borderWidth: 1,
    padding: 10,
    marginBottom: 10,
  },
  yamlBoxTitle: {
    fontSize: 9.5,
    fontWeight: '800',
    marginBottom: 4,
  },
  yamlCodeText: {
    fontSize: 10.5,
    fontFamily: 'monospace',
    lineHeight: 15,
  },
  editorPane: {
    borderRadius: 13,
    borderWidth: 1,
    padding: 11,
    marginBottom: 10,
  },
  paneHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  paneHeaderLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
    flex: 1,
  },
  syncDraftChip: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  syncDraftChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  markdownInput: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlignVertical: 'top',
    fontFamily: 'monospace',
  },
  previewPane: {
    borderRadius: 13,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  mdH1: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 4,
  },
  mdH2: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 4,
  },
  mdH3: {
    fontSize: 13.5,
    fontWeight: '800',
    marginTop: 4,
    marginBottom: 3,
  },
  mdChecklistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    marginVertical: 3,
  },
  mdChecklistText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
  },
  mdQuoteBox: {
    borderLeftWidth: 3.5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    marginVertical: 4,
  },
  mdQuoteText: {
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 17,
  },
  mdTableRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 7,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginVertical: 2,
    gap: 8,
  },
  mdTableCell: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
  },
  mdParagraphWrap: {
    marginVertical: 3,
  },
  mdParagraph: {
    fontSize: 13,
    lineHeight: 19,
  },
  inlineWikiPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  inlineWikiPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 7,
    borderWidth: 1,
  },
  inlineWikiPillText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  tagsFooterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 7,
    borderWidth: 1,
  },
  tagPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: 1,
    gap: 10,
  },
  folderChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  folderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  folderChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deleteIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
