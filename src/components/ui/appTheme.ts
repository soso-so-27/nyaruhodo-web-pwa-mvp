import type { CSSProperties } from "react";

export const APP_ACCENT = "#566052";
export const APP_ACCENT_MUTED = "#74786f";
export const APP_ACCENT_SOFT_BG = "rgba(236,236,231,0.82)";
export const APP_ACCENT_SOFT_BORDER = "rgba(200,197,190,0.9)";
export const APP_PAGE_BACKGROUND =
  "linear-gradient(180deg, #fdfcf9 0%, #f7f5ef 100%)";

export const APP_SURFACE: CSSProperties = {
  background: "rgba(255, 255, 255, 0.93)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(210, 207, 200, 0.86)",
  boxShadow: [
    "0 4px 14px rgba(52, 50, 46, 0.08)",
    "inset 0 1px 0 rgba(255,255,255,0.46)",
  ].join(", "),
  position: "relative",
};

export const APP_SUBTLE_SURFACE: CSSProperties = {
  ...APP_SURFACE,
  background: "rgba(255, 255, 255, 0.86)",
  boxShadow: [
    "0 3px 10px rgba(52, 50, 46, 0.06)",
    "inset 0 1px 0 rgba(255,255,255,0.38)",
  ].join(", "),
};

export const APP_PILL: CSSProperties = {
  ...APP_SURFACE,
  background: "rgba(255, 255, 255, 0.90)",
  borderRadius: "99px",
};

export const APP_SHEET: CSSProperties = {
  background: "rgba(255, 255, 255, 0.94)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  border: "1px solid rgba(210, 207, 200, 0.86)",
  boxShadow: "0 -8px 28px rgba(52, 50, 46, 0.14)",
};

export const APP_SHEET_OVERLAY: CSSProperties = {
  background: "rgba(42, 42, 40, 0.22)",
  backdropFilter: "blur(2px)",
  WebkitBackdropFilter: "blur(2px)",
};
