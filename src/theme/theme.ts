import { NodeType, ThemeMode } from '../models/types';

export interface AppThemeColors {
  mode: ThemeMode;
  isDark: boolean;
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceHighlight: string;
  cardBorder: string;
  divider: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentPrimary: string;
  accentPrimarySoft: string;
  /** Node Pillar Colors */
  nodeScan: string;
  nodeScanSoft: string;
  nodeScanBorder: string;
  nodeNote: string;
  nodeNoteSoft: string;
  nodeNoteBorder: string;
  nodeLog: string;
  nodeLogSoft: string;
  nodeLogBorder: string;
  /** Semantic Status Colors */
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  /** Graph Canvas Colors */
  graphBackground: string;
  graphGrid: string;
  edgeManual: string;
  edgeTag: string;
  edgeKeyword: string;
}

export const LIGHT_THEME: AppThemeColors = {
  mode: 'light',
  isDark: false,
  background: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceElevated: '#F9FAFC',
  surfaceHighlight: '#EEF2FF',
  cardBorder: '#E2E8F0',
  divider: '#E8EDF5',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  accentPrimary: '#4F46E5',
  accentPrimarySoft: '#EEF2FF',
  // Blue = Scanned Docs
  nodeScan: '#2563EB',
  nodeScanSoft: '#DBEAFE',
  nodeScanBorder: '#93C5FD',
  // Emerald = Markdown Notes
  nodeNote: '#059669',
  nodeNoteSoft: '#D1FAE5',
  nodeNoteBorder: '#6EE7B7',
  // Amber = Data Logs
  nodeLog: '#D97706',
  nodeLogSoft: '#FEF3C7',
  nodeLogBorder: '#FCD34D',
  // Status
  success: '#10B981',
  successSoft: '#D1FAE5',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  danger: '#EF4444',
  dangerSoft: '#FEE2E2',
  // Graph
  graphBackground: '#F8FAFC',
  graphGrid: '#E2E8F0',
  edgeManual: '#4F46E5',
  edgeTag: '#10B981',
  edgeKeyword: '#94A3B8',
};

export const DARK_THEME: AppThemeColors = {
  mode: 'dark',
  isDark: true,
  background: '#0B101B',
  surface: '#131B2E',
  surfaceElevated: '#1C2740',
  surfaceHighlight: '#233152',
  cardBorder: '#263452',
  divider: '#1E293B',
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  accentPrimary: '#6366F1',
  accentPrimarySoft: 'rgba(99, 102, 241, 0.18)',
  // Blue = Scanned Docs
  nodeScan: '#3B82F6',
  nodeScanSoft: 'rgba(59, 130, 246, 0.16)',
  nodeScanBorder: 'rgba(96, 165, 250, 0.45)',
  // Emerald = Markdown Notes
  nodeNote: '#10B981',
  nodeNoteSoft: 'rgba(16, 185, 129, 0.16)',
  nodeNoteBorder: 'rgba(52, 211, 153, 0.45)',
  // Amber = Data Logs
  nodeLog: '#F59E0B',
  nodeLogSoft: 'rgba(245, 158, 11, 0.16)',
  nodeLogBorder: 'rgba(251, 191, 36, 0.45)',
  // Status
  success: '#34D399',
  successSoft: 'rgba(16, 185, 129, 0.18)',
  warning: '#FBBF24',
  warningSoft: 'rgba(245, 158, 11, 0.18)',
  danger: '#F87171',
  dangerSoft: 'rgba(239, 68, 68, 0.18)',
  // Graph
  graphBackground: '#080C14',
  graphGrid: '#19233A',
  edgeManual: '#818CF8',
  edgeTag: '#34D399',
  edgeKeyword: '#64748B',
};

export const OLED_THEME: AppThemeColors = {
  mode: 'oled',
  isDark: true,
  background: '#000000',
  surface: '#0A0D12',
  surfaceElevated: '#121722',
  surfaceHighlight: '#1A2233',
  cardBorder: '#1E2738',
  divider: '#141A24',
  textPrimary: '#FFFFFF',
  textSecondary: '#D1D5DB',
  textMuted: '#8E9BAE',
  accentPrimary: '#818CF8',
  accentPrimarySoft: 'rgba(129, 140, 248, 0.22)',
  // Blue = Scanned Docs
  nodeScan: '#60A5FA',
  nodeScanSoft: 'rgba(96, 165, 250, 0.18)',
  nodeScanBorder: 'rgba(96, 165, 250, 0.5)',
  // Emerald = Markdown Notes
  nodeNote: '#34D399',
  nodeNoteSoft: 'rgba(52, 211, 153, 0.18)',
  nodeNoteBorder: 'rgba(52, 211, 153, 0.5)',
  // Amber = Data Logs
  nodeLog: '#FBBF24',
  nodeLogSoft: 'rgba(251, 191, 36, 0.18)',
  nodeLogBorder: 'rgba(251, 191, 36, 0.5)',
  // Status
  success: '#34D399',
  successSoft: 'rgba(52, 211, 153, 0.2)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251, 191, 36, 0.2)',
  danger: '#F87171',
  dangerSoft: 'rgba(248, 113, 113, 0.2)',
  // Graph
  graphBackground: '#000000',
  graphGrid: '#111622',
  edgeManual: '#A5B4FC',
  edgeTag: '#34D399',
  edgeKeyword: '#64748B',
};

export function getThemeColors(mode: ThemeMode): AppThemeColors {
  switch (mode) {
    case 'light':
      return LIGHT_THEME;
    case 'oled':
      return OLED_THEME;
    case 'dark':
    default:
      return DARK_THEME;
  }
}

export function getNodePillarStyle(type: NodeType, theme: AppThemeColors) {
  switch (type) {
    case 'SCAN':
      return {
        label: 'Scanned Doc',
        shortLabel: 'SCAN',
        iconName: 'document-text-outline' as const,
        color: theme.nodeScan,
        softBg: theme.nodeScanSoft,
        borderColor: theme.nodeScanBorder,
      };
    case 'NOTE':
      return {
        label: 'Markdown Note',
        shortLabel: 'NOTE',
        iconName: 'create-outline' as const,
        color: theme.nodeNote,
        softBg: theme.nodeNoteSoft,
        borderColor: theme.nodeNoteBorder,
      };
    case 'LOG':
      return {
        label: 'Data Log',
        shortLabel: 'LOG',
        iconName: 'grid-outline' as const,
        color: theme.nodeLog,
        softBg: theme.nodeLogSoft,
        borderColor: theme.nodeLogBorder,
      };
  }
}
