import type { CSSProperties } from "react";

export const APP_ACCENT = "var(--ink)";
export const APP_ACCENT_MUTED = "var(--ink-soft)";
export const APP_ACCENT_SOFT_BG = "var(--paper-card)";
export const APP_ACCENT_SOFT_BORDER = "var(--line)";
export const APP_PAGE_BACKGROUND = "var(--app-paper-background)";

export const APP_SURFACE: CSSProperties = {
  background: "var(--app-page-surface-strong)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-e1)",
  position: "relative",
};

export const APP_SUBTLE_SURFACE: CSSProperties = {
  ...APP_SURFACE,
  background: "var(--app-page-surface)",
  boxShadow: "var(--shadow-e1)",
};

export const APP_PILL: CSSProperties = {
  ...APP_SURFACE,
  background: "color-mix(in srgb, var(--paper) 66%, transparent)",
  borderRadius: "var(--radius-full)",
};

export const APP_SHEET: CSSProperties = {
  background: "color-mix(in srgb, var(--paper) 82%, transparent)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-e2)",
};

export const APP_SHEET_OVERLAY: CSSProperties = {
  background: "color-mix(in srgb, var(--ink) 22%, transparent)",
  backdropFilter: "blur(2px)",
  WebkitBackdropFilter: "blur(2px)",
};
