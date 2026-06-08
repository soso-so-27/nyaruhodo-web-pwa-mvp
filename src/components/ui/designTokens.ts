export const typography = {
  fontSans: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSerif:
    '"Shippori Mincho B1", "Hiragino Mincho ProN", "Yu Mincho", serif',

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
    fontWeight: 500,
    lineHeight: 1.45,
  },
  cta: {
    fontSize: 15,
    fontWeight: 600,
    lineHeight: 1,
  },
} as const;

export const color = {
  bg: "#f7f1e7",
  pageBg: "linear-gradient(180deg, #fdfcf9 0%, #f7f5ef 100%)",
  paper: "#fffdf8",
  surface: "rgba(255,253,248,0.86)",
  surfaceSoft: "rgba(255,253,248,0.54)",
  text: "#332c26",
  textStrong: "#202020",
  textMuted: "#746a5f",
  textFaint: "#9c9286",
  accent: "#566052",
  accentWarm: "#9a866b",
  border: "rgba(120,108,94,0.12)",
  danger: "#9b4a3d",
} as const;

export const radius = {
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
  soft: "0 4px 12px rgba(90,76,60,0.035)",
  card: "0 8px 18px rgba(90,76,60,0.045)",
  floating: "0 14px 34px rgba(90,76,60,0.10)",
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
  color,
  radius,
  shadow,
  spacing,
} as const;
