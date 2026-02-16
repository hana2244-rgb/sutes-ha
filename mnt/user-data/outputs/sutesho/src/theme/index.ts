// ============================================================
// 捨てショ - Theme
// 和モダン × ミニマル × 少しポップ
// ============================================================

export const theme = {
  colors: {
    // ベース
    bg: '#0A0A0A',
    bgElevated: '#141414',
    bgCard: '#1A1A1A',
    bgCardHover: '#222222',
    bgOverlay: 'rgba(0, 0, 0, 0.7)',

    // テキスト
    textPrimary: '#F5F0EB',
    textSecondary: '#8A8680',
    textTertiary: '#5A5550',
    textInverse: '#0A0A0A',

    // アクセント - 朱色（和の赤）
    accent: '#E8503A',
    accentLight: '#FF6B52',
    accentSoft: 'rgba(232, 80, 58, 0.15)',
    accentGlow: 'rgba(232, 80, 58, 0.3)',

    // セカンダリ - 藍色
    secondary: '#3D5A80',
    secondaryLight: '#5B7FA5',
    secondarySoft: 'rgba(61, 90, 128, 0.15)',

    // 成功 - 抹茶
    success: '#7DB87D',
    successSoft: 'rgba(125, 184, 125, 0.15)',

    // 警告
    warning: '#E8A838',
    warningSoft: 'rgba(232, 168, 56, 0.15)',

    // ボーダー
    border: '#2A2A2A',
    borderLight: '#333333',
    borderAccent: 'rgba(232, 80, 58, 0.3)',

    // 特殊
    shimmer: 'rgba(245, 240, 235, 0.05)',
    glass: 'rgba(26, 26, 26, 0.85)',
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
    // iOS のシステムフォントだが weight で使い分け
    // カスタムフォントは expo-font で別途ロード可能
    title: {
      fontSize: 34,
      fontWeight: '800' as const,
      letterSpacing: -0.5,
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
      fontWeight: '500' as const,
      letterSpacing: 0.1,
      lineHeight: 18,
    },
    tiny: {
      fontSize: 11,
      fontWeight: '500' as const,
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
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 16,
      elevation: 8,
    },
    glow: {
      shadowColor: '#E8503A',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.4,
      shadowRadius: 20,
      elevation: 10,
    },
  },
} as const;

export type Theme = typeof theme;
