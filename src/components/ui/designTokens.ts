
export const typography = {
  fontDisplay: "var(--font-display)",
  fontUi: "var(--font-ui)",
  fontSans: 'var(--font-sans)',
  fontSerif: 'var(--font-serif)',

  brand: {
    fontSize: 18,
    fontWeight: 400,
    lineHeight: 1.34,
    letterSpacing: "0.16em",
  },
  hero: {
    fontSize: 23,
    fontWeight: 470,
    lineHeight: 1.45,
  },
  title: {
    fontSize: 20,
    fontWeight: 500,
    lineHeight: 1.4,
  },
  body: {
    fontSize: 14.5,
    fontWeight: 400,
    lineHeight: 1.7,
  },
  caption: {
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1.45,
  },
  cta: {
    fontSize: 15,
    fontWeight: 400,
    lineHeight: 1,
  },
} as const;

export const typeScale = {
  display: 40,
  title: 24,
  section: 18,
  body: 15,
  caption: 13,
  micro: 12,
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
} as const;

export const color = {
  bg: "var(--paper-warm)",
  pageBg: "var(--bg-gradient)",
  paper: "var(--paper)",
  surface: "var(--paper)",
  surfaceSoft: "var(--paper-card)",
  text: "var(--ink)",
  textStrong: "var(--ink)",
  textMuted: "var(--ink-soft)",
  textFaint: "var(--ink-faint)",
  accent: "var(--ink)",
  accentWarm: "var(--ink-soft)",
  border: "var(--line)",
  danger: "var(--seal)",
  seal: "var(--seal)",
  sealSoft: "var(--seal-soft)",
} as const;

export const radius = {
  sm8: 8,
  md12: 12,
  lg16: 16,
  xl20: 20,
  xxl24: 24,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  card: 24,
  pill: 999,
  circle: "50%",
} as const;

export const shadow = {
  none: "none",
  e0: "var(--shadow-e0)",
  e1: "var(--shadow-e1)",
  e2: "var(--shadow-e2)",
  soft: "var(--shadow-rest)",
  card: "var(--shadow-rest)",
  floating: "var(--shadow-float)",
} as const;

export const spacingScale = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  huge: 48,
  page: 64,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  screenX: 24,
  bottomNavClearance: 156,
} as const;

export const designTokens = {
  typography,
  typeScale,
  fontWeight,
  color,
  radius,
  shadow,
  spacingScale,
  spacing,
} as const;
