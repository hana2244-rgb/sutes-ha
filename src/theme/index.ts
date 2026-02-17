// ============================================================
// 捨てショ - Theme
// ソーダグラス: パステル × ガラスモーフィズム
// ============================================================

export const theme = {
  colors: {
    // ベース（背景系）
    bg: '#DFE6F6',
    bgSoft: '#E8EDF9',
    bgCard: 'rgba(255, 255, 255, 0.55)',
    bgCardSolid: '#FFFFFF',
    bgOverlay: 'rgba(180, 190, 220, 0.4)',

    // テキスト
    textPrimary: '#2D3047',
    textSecondary: '#7A809B',
    textTertiary: '#A8ADCA',
    textOnAccent: '#FFFFFF',
    textOnGlass: '#4A5073',

    // アクセント（メインアクション）
    accent: '#7EB5F5',
    accentDeep: '#5A9AE6',
    accentSoft: 'rgba(126, 181, 245, 0.18)',

    // セカンダリ（情報・バッジ）
    secondary: '#B8A9D4',
    secondarySoft: 'rgba(184, 169, 212, 0.15)',

    // 成功（「残す」選択）
    success: '#8CC5A2',
    successSoft: 'rgba(140, 197, 162, 0.2)',

    // 危険（削除）
    danger: '#F2918A',
    dangerSoft: 'rgba(242, 145, 138, 0.15)',

    // 警告
    warning: '#F2CC6B',
    warningSoft: 'rgba(242, 204, 107, 0.15)',

    // ガラス効果用
    glassBorder: 'rgba(255, 255, 255, 0.6)',
    glassHighlight: 'rgba(255, 255, 255, 0.8)',
    glassInnerShadow: 'rgba(100, 120, 180, 0.08)',
    bubbleShine: 'rgba(255, 255, 255, 0.9)',

    // ボーダー
    border: 'rgba(180, 190, 220, 0.3)',
    borderLight: 'rgba(255, 255, 255, 0.5)',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
    xxxl: 64,
  },

  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 999,
  },

  typography: {
    title: {
      fontSize: 32,
      fontWeight: '800' as const,
      letterSpacing: -0.8,
      lineHeight: 41,
    },
    heading: {
      fontSize: 24,
      fontWeight: '700' as const,
      letterSpacing: -0.3,
      lineHeight: 30,
    },
    subheading: {
      fontSize: 18,
      fontWeight: '600' as const,
      letterSpacing: -0.2,
      lineHeight: 24,
    },
    body: {
      fontSize: 16,
      fontWeight: '400' as const,
      letterSpacing: 0,
      lineHeight: 22,
    },
    caption: {
      fontSize: 13,
      fontWeight: '600' as const,
      letterSpacing: 0.1,
      lineHeight: 18,
    },
    tiny: {
      fontSize: 11,
      fontWeight: '600' as const,
      letterSpacing: 0.2,
      lineHeight: 14,
    },
    mono: {
      fontSize: 14,
      fontWeight: '600' as const,
      fontFamily: 'Menlo',
      letterSpacing: 0.5,
      lineHeight: 20,
    },
  },

  shadow: {
    glass: {
      shadowColor: '#8090C0',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 4,
    },
    glassSm: {
      shadowColor: '#8090C0',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 2,
    },
    bubble: {
      shadowColor: '#7EB5F5',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.2,
      shadowRadius: 20,
      elevation: 6,
    },
    soft: {
      shadowColor: '#A0AAD0',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 24,
      elevation: 3,
    },
  },
} as const;

export const glassCard = {
  backgroundColor: 'rgba(255, 255, 255, 0.55)',
  borderRadius: 24,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.6)',
  borderTopWidth: 1.5,
  borderTopColor: 'rgba(255, 255, 255, 0.8)',
  ...theme.shadow.glass,
} as const;

export const glassPill = {
  borderRadius: 999,
  borderWidth: 1,
  borderColor: 'rgba(255, 255, 255, 0.6)',
  borderTopWidth: 1.5,
  borderTopColor: 'rgba(255, 255, 255, 0.8)',
} as const;

export const bubbleButton = {
  ...glassPill,
  shadowColor: '#7EB5F5',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.2,
  shadowRadius: 20,
  elevation: 6,
} as const;

export type Theme = typeof theme;
