import React, { useState } from 'react';
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
import { useVault } from '../store/VaultContext';
import { NodeType, ScanMode, VaultNode } from '../models/types';
import { WikiLinkAutocompleteSheet } from './WikiLinkAutocompleteSheet';
import { MarkdownWorkspaceModal } from './MarkdownWorkspaceModal';
import { DataLogStudioModal } from './DataLogStudioModal';
import { ScannerAndPdfStudioModal } from './ScannerAndPdfStudioModal';

export const SmartFabMenu: React.FC = () => {
  const { theme } = useAppTheme();
  const { nodes, folders, createOrUpdateNode, setInspectingNode } = useVault();

  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [composerType, setComposerType] = useState<NodeType | null>(null);

  // Quick Composer State
  const [title, setTitle] = useState<string>('');
  const [contentMd, setContentMd] = useState<string>('');
  const [tagsInput, setTagsInput] = useState<string>('project-alpha');
  const [scanMode, setScanMode] = useState<ScanMode>('SINGLE');
  const [folderId, setFolderId] = useState<string>('folder-knowledge-notes');
  const [wikiAutocompleteOpen, setWikiAutocompleteOpen] = useState<boolean>(false);
  const [wikiQuery, setWikiQuery] = useState<string>('');

  // Full Studio Launch State
  const [activeMarkdownNode, setActiveMarkdownNode] = useState<VaultNode | null>(
    null
  );
  const [activeDataLogNode, setActiveDataLogNode] = useState<VaultNode | null>(
    null
  );
  const [scannerStudioOpen, setScannerStudioOpen] = useState<boolean>(false);

  const openComposer = (type: NodeType) => {
    setMenuOpen(false);
    if (type === 'SCAN') {
      setScannerStudioOpen(true);
      return;
    }
    setComposerType(type);

    if (type === 'SCAN') {
      setTitle('Field Sensor Calibration Receipt');
      setScanMode('SINGLE');
      setFolderId('folder-receipts-scans');
      setTagsInput('project-alpha, receipt, hardware');
      setContentMd(
        `# [ON-DEVICE OCR EXTRACTED] Field Sensor Calibration Receipt\n**Vendor:** Precision Photonics Lab\n**Total:** $310.00 USD\n**Connected Project Note:** [[Project Budget & Architecture Notes]]\n**Logged In:** [[Equipment Expense Log]]\n\n#project-alpha #receipt #hardware`
      );
    } else if (type === 'NOTE') {
      setTitle('Edge NPU Benchmark & Sync Notes');
      setFolderId('folder-knowledge-notes');
      setTagsInput('project-alpha, benchmark');
      setContentMd(
        `# Edge NPU Benchmark & Sync Notes\n\nTesting on-device OCR throughput on hardware ordered in [[Hardware Supplier Invoice]] and tracked inside [[Equipment Expense Log]].\n\n- [x] Verify sub-millisecond SQLite FTS5 indexing\n- [x] Confirm bidirectional [[Project Budget & Architecture Notes]] edge\n\n#project-alpha #benchmark`
      );
    } else {
      setTitle('Q4 Hardware Inventory & Serial Log');
      setFolderId('folder-personal-logs');
      setTagsInput('project-alpha, inventory');
      setContentMd(
        `# Structured Data Log: Q4 Hardware Inventory & Serial Log\nLinked to [[Hardware Supplier Invoice]] and [[Project Budget & Architecture Notes]].\n\n| Serial ID | Component | Status | Linked Reference |\n| :--- | :--- | :--- | :--- |\n| SN-NPU-001 | Edge AI 16GB Module | Active | [[Hardware Supplier Invoice]] |\n\n#project-alpha #inventory`
      );
    }
  };

  const handleComposerTextChange = (nextText: string) => {
    setContentMd(nextText);
    const trailingMatch = nextText.match(/\[\[([^[\]\n]{0,36})$/);
    if (trailingMatch && nextText.length > contentMd.length) {
      setWikiQuery(trailingMatch[1]);
      setWikiAutocompleteOpen(true);
    }
  };

  const insertWikiLinkNode = (targetNode: VaultNode) => {
    setContentMd((prev) => {
      if (/\[\[([^[\]\n]{0,36})$/.test(prev)) {
        return prev.replace(/\[\[([^[\]\n]{0,36})$/, `[[${targetNode.title}]] `);
      }
      return `${prev.trimEnd()} [[${targetNode.title}]] `;
    });
  };

  const handleSave = async (openInFullStudio = false) => {
    if (!composerType || !title.trim()) return;
    const explicitTags = tagsInput
      .split(/[,\s]+/)
      .map((t) => t.replace(/^#+/, '').trim().toLowerCase())
      .filter(Boolean);

    const created = await createOrUpdateNode({
      type: composerType,
      title: title.trim(),
      content_md: contentMd,
      tags: explicitTags,
      scan_mode: composerType === 'SCAN' ? scanMode : null,
      folder_id: folderId,
    });

    setComposerType(null);
    if (openInFullStudio) {
      if (created.type === 'LOG') {
        setActiveDataLogNode(created);
      } else {
        setActiveMarkdownNode(created);
      }
    } else {
      setInspectingNode(created);
    }
  };

  return (
    <>
      {/* 3-Action Radial / Bottom Sheet Menu */}
      {menuOpen && (
        <Modal
          visible={menuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuOpen(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setMenuOpen(false)}
            style={styles.fabMenuBackdrop}
          >
            <View
              style={[
                styles.fabMenuSheet,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <Text style={[styles.fabMenuHeading, { color: theme.textMuted }]}>
                CREATE INTERLINKED VAULT ITEM (100% LOCAL-FIRST)
              </Text>

              {/* Action 1: Camera Scan */}
              <TouchableOpacity
                onPress={() => openComposer('SCAN')}
                style={[
                  styles.fabActionRow,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.nodeScanBorder,
                  },
                ]}
              >
                <View
                  style={[
                    styles.fabActionIcon,
                    { backgroundColor: theme.nodeScanSoft },
                  ]}
                >
                  <Ionicons name="camera-outline" size={22} color={theme.nodeScan} />
                </View>
                <View style={styles.fabActionTextCol}>
                  <Text style={[styles.fabActionTitle, { color: theme.textPrimary }]}>
                    Camera Scan & Instant Offline OCR
                  </Text>
                  <Text style={[styles.fabActionDesc, { color: theme.textSecondary }]}>
                    Single, Batch, ID Card, Book & QR • Saves PDF in DocuMap_Vault/Scans/
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.nodeScan} />
              </TouchableOpacity>

              {/* Action 2: New Markdown Note */}
              <TouchableOpacity
                onPress={() => openComposer('NOTE')}
                style={[
                  styles.fabActionRow,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.nodeNoteBorder,
                  },
                ]}
              >
                <View
                  style={[
                    styles.fabActionIcon,
                    { backgroundColor: theme.nodeNoteSoft },
                  ]}
                >
                  <Ionicons name="create-outline" size={22} color={theme.nodeNote} />
                </View>
                <View style={styles.fabActionTextCol}>
                  <Text style={[styles.fabActionTitle, { color: theme.textPrimary }]}>
                    New Markdown Note ([[Wiki-Links]])
                  </Text>
                  <Text style={[styles.fabActionDesc, { color: theme.textSecondary }]}>
                    Obsidian-compatible .md with YAML frontmatter in DocuMap_Vault/Notes/
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.nodeNote} />
              </TouchableOpacity>

              {/* Action 3: New Data Log */}
              <TouchableOpacity
                onPress={() => openComposer('LOG')}
                style={[
                  styles.fabActionRow,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.nodeLogBorder,
                  },
                ]}
              >
                <View
                  style={[
                    styles.fabActionIcon,
                    { backgroundColor: theme.nodeLogSoft },
                  ]}
                >
                  <Ionicons name="grid-outline" size={22} color={theme.nodeLog} />
                </View>
                <View style={styles.fabActionTextCol}>
                  <Text style={[styles.fabActionTitle, { color: theme.textPrimary }]}>
                    New Structured Data Log Table
                  </Text>
                  <Text style={[styles.fabActionDesc, { color: theme.textSecondary }]}>
                    Custom typed columns saved as .csv & .json in DocuMap_Vault/Logs/
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.nodeLog} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Quick Interlinked Node Composer Modal */}
      {composerType && (
        <Modal
          visible={Boolean(composerType)}
          transparent
          animationType="slide"
          onRequestClose={() => setComposerType(null)}
        >
          <View style={styles.composerBackdrop}>
            <View
              style={[
                styles.composerCard,
                {
                  backgroundColor: theme.surface,
                  borderColor: theme.cardBorder,
                },
              ]}
            >
              <View style={styles.composerHeader}>
                <Text style={[styles.composerTitle, { color: theme.textPrimary }]}>
                  {composerType === 'SCAN'
                    ? '📷 Capture Document Scan + Offline OCR'
                    : composerType === 'NOTE'
                    ? '📝 Create Markdown Note with [[Wiki-Links]]'
                    : '📊 Create Structured Data Log (.CSV + .JSON)'}
                </Text>
                <TouchableOpacity onPress={() => setComposerType(null)}>
                  <Ionicons name="close" size={22} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.composerScroll}
                keyboardShouldPersistTaps="handled"
              >
                {/* Scan Mode Selector if SCAN */}
                {composerType === 'SCAN' && (
                  <View style={styles.fieldGroup}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                      CAPTURE OPTICS MODE
                    </Text>
                    <View style={styles.modePillsRow}>
                      {(['SINGLE', 'BATCH', 'ID_CARD', 'BOOK'] as ScanMode[]).map(
                        (m) => (
                          <TouchableOpacity
                            key={m}
                            onPress={() => setScanMode(m)}
                            style={[
                              styles.modePill,
                              {
                                backgroundColor:
                                  scanMode === m
                                    ? theme.nodeScan
                                    : theme.surfaceElevated,
                                borderColor:
                                  scanMode === m
                                    ? theme.nodeScan
                                    : theme.cardBorder,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.modePillText,
                                {
                                  color:
                                    scanMode === m ? '#FFFFFF' : theme.textSecondary,
                                },
                              ]}
                            >
                              {m}
                            </Text>
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                  </View>
                )}

                {/* Title Input */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    DOCUMENT TITLE
                  </Text>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Enter title…"
                    placeholderTextColor={theme.textMuted}
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.surfaceElevated,
                        borderColor: theme.cardBorder,
                        color: theme.textPrimary,
                      },
                    ]}
                  />
                </View>

                {/* Folder Selector */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    TARGET VAULT FOLDER
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.modePillsRow}>
                      {folders.map((f) => (
                        <TouchableOpacity
                          key={f.id}
                          onPress={() => setFolderId(f.id)}
                          style={[
                            styles.modePill,
                            {
                              backgroundColor:
                                folderId === f.id
                                  ? theme.accentPrimary
                                  : theme.surfaceElevated,
                              borderColor:
                                folderId === f.id
                                  ? theme.accentPrimary
                                  : theme.cardBorder,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.modePillText,
                              {
                                color:
                                  folderId === f.id
                                    ? '#FFFFFF'
                                    : theme.textSecondary,
                              },
                            ]}
                          >
                            {f.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* One-Tap [[Wiki-Link]] Autocomplete Bar */}
                <View style={styles.fieldGroup}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                      BIDIRECTIONAL [[WIKI-LINK]] AUTOCOMPLETE
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setWikiQuery('');
                        setWikiAutocompleteOpen(true);
                      }}
                    >
                      <Text
                        style={[
                          styles.openSheetLink,
                          { color: theme.accentPrimary },
                        ]}
                      >
                        Open [[ Linker Sheet ]]
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.modePillsRow}>
                      {nodes.map((n) => (
                        <TouchableOpacity
                          key={n.id}
                          onPress={() => insertWikiLinkNode(n)}
                          style={[
                            styles.wikiChip,
                            {
                              backgroundColor: theme.accentPrimarySoft,
                              borderColor: theme.accentPrimary,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.wikiChipText,
                              { color: theme.accentPrimary },
                            ]}
                          >
                            + [[{n.title}]]
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* Content / OCR Markdown Body */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    {composerType === 'SCAN'
                      ? 'EXTRACTED ON-DEVICE OCR MARKDOWN LAYER (TYPE [[ FOR LINKER)'
                      : 'MARKDOWN CONTENT (TYPE [[ FOR INSTANT AUTOCOMPLETE)'}
                  </Text>
                  <TextInput
                    value={contentMd}
                    onChangeText={handleComposerTextChange}
                    multiline
                    numberOfLines={6}
                    style={[
                      styles.textArea,
                      {
                        backgroundColor: theme.surfaceElevated,
                        borderColor: theme.cardBorder,
                        color: theme.textPrimary,
                      },
                    ]}
                  />
                </View>

                {/* Tags Input */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                    #TAGS (AUTO-CONNECTS NODES SHARING TAGS)
                  </Text>
                  <TextInput
                    value={tagsInput}
                    onChangeText={setTagsInput}
                    placeholder="project-alpha, hardware, invoice"
                    placeholderTextColor={theme.textMuted}
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: theme.surfaceElevated,
                        borderColor: theme.cardBorder,
                        color: theme.textPrimary,
                      },
                    ]}
                  />
                </View>
              </ScrollView>

              <View style={styles.composerActionsRow}>
                <TouchableOpacity
                  onPress={() => handleSave(true)}
                  style={[
                    styles.studioBtn,
                    {
                      backgroundColor: theme.surfaceElevated,
                      borderColor: theme.accentPrimary,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      composerType === 'LOG'
                        ? 'grid-outline'
                        : 'create-outline'
                    }
                    size={16}
                    color={theme.accentPrimary}
                  />
                  <Text
                    style={[
                      styles.studioBtnText,
                      { color: theme.accentPrimary },
                    ]}
                  >
                    {composerType === 'LOG'
                      ? 'Open Table Builder'
                      : 'Open Hybrid Studio'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleSave(false)}
                  style={[
                    styles.saveBtn,
                    { backgroundColor: theme.accentPrimary },
                  ]}
                >
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color="#FFFFFF"
                  />
                  <Text style={styles.saveBtnText}>Save to Vault</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* [[ Bottom-Sheet Node Linker inside Quick Composer */}
      <WikiLinkAutocompleteSheet
        visible={wikiAutocompleteOpen}
        initialQuery={wikiQuery}
        nodes={nodes}
        onSelectNode={insertWikiLinkNode}
        onClose={() => setWikiAutocompleteOpen(false)}
      />

      {/* Full Markdown Workspace Modal */}
      <MarkdownWorkspaceModal
        visible={Boolean(activeMarkdownNode)}
        node={activeMarkdownNode}
        onClose={() => setActiveMarkdownNode(null)}
        onSwitchToNode={(target) => {
          if (target.type === 'LOG') {
            setActiveMarkdownNode(null);
            setActiveDataLogNode(target);
          } else {
            setActiveMarkdownNode(target);
          }
        }}
      />

      {/* Full Data Log Studio Modal */}
      <DataLogStudioModal
        visible={Boolean(activeDataLogNode)}
        node={activeDataLogNode}
        onClose={() => setActiveDataLogNode(null)}
        onSwitchToNode={(target) => {
          if (target.type === 'LOG') {
            setActiveDataLogNode(target);
          } else {
            setActiveDataLogNode(null);
            setActiveMarkdownNode(target);
          }
        }}
      />

      {/* Full CamScanner-Grade Offline Scanner & PDF Studio Modal */}
      <ScannerAndPdfStudioModal
        visible={scannerStudioOpen}
        onClose={() => setScannerStudioOpen(false)}
        onScanSaved={(savedNode) => {
          setScannerStudioOpen(false);
          setInspectingNode(savedNode);
        }}
      />

      {/* Corner Floating Action Button (+) */}
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => setMenuOpen(true)}
        style={[
          styles.fabButton,
          {
            backgroundColor: theme.accentPrimary,
            shadowColor: theme.accentPrimary,
          },
        ]}
        accessibilityLabel="Create Scan, Markdown Note, or Data Log"
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
    </>
  );
};

const styles = StyleSheet.create({
  fabButton: {
    position: 'absolute',
    right: 18,
    bottom: 84,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    zIndex: 40,
  },
  fabMenuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 7, 16, 0.72)',
    justifyContent: 'flex-end',
    padding: 16,
    paddingBottom: 90,
  },
  fabMenuSheet: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  fabMenuHeading: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  fabActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 15,
    borderWidth: 1,
    gap: 12,
  },
  fabActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabActionTextCol: {
    flex: 1,
  },
  fabActionTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  fabActionDesc: {
    fontSize: 11.5,
    marginTop: 2,
  },
  composerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 7, 16, 0.78)',
    justifyContent: 'flex-end',
  },
  composerCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 18,
    maxHeight: '90%',
  },
  composerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  composerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  composerScroll: {
    maxHeight: 420,
    marginBottom: 14,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  openSheetLink: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  modePillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  modePill: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  modePillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  wikiChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  wikiChipText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  textInput: {
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    fontWeight: '600',
  },
  textArea: {
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  composerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  studioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 13,
    borderRadius: 13,
    borderWidth: 1,
  },
  studioBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 13,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
