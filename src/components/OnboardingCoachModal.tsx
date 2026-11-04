import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme/ThemeContext';
import { useVault } from '../store/VaultContext';

interface OnboardingSlide {
  stepNumber: string;
  badgeText: string;
  title: string;
  quote: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  accentColorKey: 'nodeScan' | 'nodeNote' | 'accentPrimary' | 'nodeLog';
  visualPreviewItems: Array<{
    pill: string;
    text: string;
    colorType: 'SCAN' | 'NOTE' | 'LOG' | 'ACCENT';
  }>;
}

const SLIDES: OnboardingSlide[] = [
  {
    stepNumber: '01 / 04',
    badgeText: '100% OFFLINE • $0 CLOUD FEES',
    title: 'Scan & Write',
    quote:
      '“Scan physical papers with OCR or write Markdown notes—100% offline.”',
    detail:
      'Every physical document you scan (Single, Batch, ID Card, or Book) saves a searchable PDF in DocuMap_Vault/Scans/ AND extracts an instant Markdown OCR layer indexed by SQLite FTS5.',
    icon: 'scan-circle-outline',
    accentColorKey: 'nodeScan',
    visualPreviewItems: [
      {
        pill: 'SCAN (Blue)',
        text: 'DocuMap_Vault/Scans/Hardware_Supplier_Invoice.pdf + On-Device OCR',
        colorType: 'SCAN',
      },
      {
        pill: 'NOTE (Emerald)',
        text: 'DocuMap_Vault/Notes/Project_Budget_&_Architecture_Notes.md',
        colorType: 'NOTE',
      },
      {
        pill: 'LOG (Amber)',
        text: 'DocuMap_Vault/Logs/Equipment_Expense_Log.csv & .json',
        colorType: 'LOG',
      },
    ],
  },
  {
    stepNumber: '02 / 04',
    badgeText: 'BIDIRECTIONAL WIKI-LINKS',
    title: 'Link with [[',
    quote:
      '“Tap [[ to connect any scan, receipt, or note together effortlessly.”',
    detail:
      'Type [[ inside any note, scan annotation, or data log row to open instant autocomplete. Even without manual links, DocuMap auto-discovers connections via shared #tags and OCR keywords.',
    icon: 'link-outline',
    accentColorKey: 'nodeNote',
    visualPreviewItems: [
      {
        pill: '[[Autocomplete]]',
        text: 'Typing [[ inserts [[Hardware Supplier Invoice]] & creates a 2-way edge',
        colorType: 'NOTE',
      },
      {
        pill: '#project-alpha',
        text: 'Auto-Discovery links documents sharing #tags or OCR keywords',
        colorType: 'ACCENT',
      },
    ],
  },
  {
    stepNumber: '03 / 04',
    badgeText: '2D VISUAL KNOWLEDGE GRAPH',
    title: 'Explore Your DocuMap',
    quote:
      '“Watch your files organize themselves into a visual map automatically.”',
    detail:
      'Blue nodes are Scanned Docs, Emerald nodes are Markdown Notes, and Amber nodes are Data Logs. Single-tap any node on the map to inspect its backlinks or bundle its 1-hop neighborhood.',
    icon: 'git-network-outline',
    accentColorKey: 'accentPrimary',
    visualPreviewItems: [
      {
        pill: 'Blue <-> Emerald',
        text: 'Hardware Supplier Invoice.pdf <--> Project Budget Notes.md',
        colorType: 'SCAN',
      },
      {
        pill: 'Amber Triangle',
        text: 'Equipment Expense Log.csv closes the 3-node starter triangle',
        colorType: 'LOG',
      },
    ],
  },
  {
    stepNumber: '04 / 04',
    badgeText: 'AI TOKEN-SAVER & BYOC SYNC',
    title: 'Save AI Tokens & Sync to PC',
    quote:
      '“Compress linked notes for AI and sync across Phone & PC via your own Google Drive.”',
    detail:
      'Bundle a node + all 1st-degree linked OCR scans & CSV logs into a ~42% compressed LLM prompt. All files live in a human-readable DocuMap_Vault/ folder synced via your own Google Drive, iCloud, OneDrive, or WebDAV.',
    icon: 'sparkles-outline',
    accentColorKey: 'nodeLog',
    visualPreviewItems: [
      {
        pill: '~42% Token Saved',
        text: 'Strips OCR noise, deduplicates headers & minifies Logs to CSV/YAML',
        colorType: 'ACCENT',
      },
      {
        pill: 'Phone <-> PC',
        text: 'Open DocuMap_Vault/ directly on Windows/Mac in VS Code, Obsidian, or Acrobat',
        colorType: 'NOTE',
      },
    ],
  },
];

export const OnboardingCoachModal: React.FC = () => {
  const { theme } = useAppTheme();
  const {
    isOnboardingModalVisible,
    completeOnboardingModal,
    setActiveTab,
  } = useVault();
  const [slideIndex, setSlideIndex] = useState<number>(0);

  if (!isOnboardingModalVisible) return null;

  const currentSlide = SLIDES[slideIndex];
  const accentColor = theme[currentSlide.accentColorKey];

  const getItemColor = (type: 'SCAN' | 'NOTE' | 'LOG' | 'ACCENT') => {
    if (type === 'SCAN') return { fg: theme.nodeScan, bg: theme.nodeScanSoft };
    if (type === 'NOTE') return { fg: theme.nodeNote, bg: theme.nodeNoteSoft };
    if (type === 'LOG') return { fg: theme.nodeLog, bg: theme.nodeLogSoft };
    return { fg: theme.accentPrimary, bg: theme.accentPrimarySoft };
  };

  const handleNext = () => {
    if (slideIndex < SLIDES.length - 1) {
      setSlideIndex(slideIndex + 1);
    } else {
      setSlideIndex(0);
      completeOnboardingModal();
    }
  };

  const handleJumpToDemoGraph = () => {
    setSlideIndex(0);
    completeOnboardingModal();
    setActiveTab('DOCUMAP');
  };

  return (
    <Modal
      visible={isOnboardingModalVisible}
      transparent
      animationType="fade"
      onRequestClose={completeOnboardingModal}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.surface,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          {/* Top Bar */}
          <View style={styles.topRow}>
            <View
              style={[
                styles.stepBadge,
                { backgroundColor: theme.surfaceElevated, borderColor: theme.cardBorder },
              ]}
            >
              <Text style={[styles.stepBadgeText, { color: accentColor }]}>
                {currentSlide.stepNumber} • {currentSlide.badgeText}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                setSlideIndex(0);
                completeOnboardingModal();
              }}
              style={styles.skipBtn}
            >
              <Text style={[styles.skipText, { color: theme.textMuted }]}>Skip</Text>
            </TouchableOpacity>
          </View>

          {/* Hero Icon & Slide Title */}
          <View style={styles.heroRow}>
            <View
              style={[
                styles.heroIconCircle,
                {
                  backgroundColor: theme.surfaceElevated,
                  borderColor: accentColor,
                },
              ]}
            >
              <Ionicons name={currentSlide.icon} size={30} color={accentColor} />
            </View>
            <View style={styles.heroTextCol}>
              <Text style={[styles.slideTitle, { color: theme.textPrimary }]}>
                {currentSlide.title}
              </Text>
              <Text style={[styles.slideSubtitle, { color: theme.textMuted }]}>
                60-Second Interactive Walkthrough
              </Text>
            </View>
          </View>

          {/* Highlighted Quote Box */}
          <View
            style={[
              styles.quoteBox,
              {
                backgroundColor: theme.surfaceElevated,
                borderLeftColor: accentColor,
              },
            ]}
          >
            <Text style={[styles.quoteText, { color: theme.textPrimary }]}>
              {currentSlide.quote}
            </Text>
          </View>

          <Text style={[styles.detailText, { color: theme.textSecondary }]}>
            {currentSlide.detail}
          </Text>

          {/* Visual Pillar Breakdown */}
          <View style={styles.visualList}>
            {currentSlide.visualPreviewItems.map((item, idx) => {
              const palette = getItemColor(item.colorType);
              return (
                <View
                  key={idx}
                  style={[
                    styles.visualRow,
                    {
                      backgroundColor: theme.surfaceElevated,
                      borderColor: theme.cardBorder,
                    },
                  ]}
                >
                  <View style={[styles.visualPill, { backgroundColor: palette.bg }]}>
                    <Text style={[styles.visualPillText, { color: palette.fg }]}>
                      {item.pill}
                    </Text>
                  </View>
                  <Text
                    style={[styles.visualRowText, { color: theme.textSecondary }]}
                    numberOfLines={2}
                  >
                    {item.text}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Progress Dots */}
          <View style={styles.dotsRow}>
            {SLIDES.map((_, idx) => (
              <TouchableOpacity
                key={idx}
                onPress={() => setSlideIndex(idx)}
                style={[
                  styles.dot,
                  {
                    width: idx === slideIndex ? 24 : 8,
                    backgroundColor:
                      idx === slideIndex ? accentColor : theme.cardBorder,
                  },
                ]}
              />
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            {slideIndex > 0 ? (
              <TouchableOpacity
                onPress={() => setSlideIndex(slideIndex - 1)}
                style={[
                  styles.secondaryBtn,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <Ionicons name="arrow-back" size={16} color={theme.textPrimary} />
                <Text style={[styles.secondaryBtnText, { color: theme.textPrimary }]}>
                  Back
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleJumpToDemoGraph}
                style={[
                  styles.secondaryBtn,
                  {
                    backgroundColor: theme.surfaceElevated,
                    borderColor: theme.cardBorder,
                  },
                ]}
              >
                <Ionicons name="git-network-outline" size={16} color={theme.accentPrimary} />
                <Text style={[styles.secondaryBtnText, { color: theme.accentPrimary }]}>
                  View Demo Map
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={handleNext}
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: accentColor,
                },
              ]}
            >
              <Text style={styles.primaryBtnText}>
                {slideIndex === SLIDES.length - 1
                  ? 'Open Starter Demo Vault'
                  : 'Next Step'}
              </Text>
              <Ionicons
                name={
                  slideIndex === SLIDES.length - 1
                    ? 'checkmark-circle-outline'
                    : 'arrow-forward'
                }
                size={17}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 16, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  stepBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  skipBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  skipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  heroIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextCol: {
    flex: 1,
  },
  slideTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  slideSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  quoteBox: {
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: 12,
  },
  quoteText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  detailText: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 14,
  },
  visualList: {
    gap: 8,
    marginBottom: 16,
  },
  visualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 11,
    borderWidth: 1,
  },
  visualPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  visualPillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  visualRowText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
});
