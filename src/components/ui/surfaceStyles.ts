import type { CSSProperties } from "react";
import type { LightTheme } from "./lightTheme";

export function getGlassCardStyle(light: LightTheme): CSSProperties {
  return getLiquidGlassCardStyle(light);
}

export function getLiquidGlassCardStyle(_light: LightTheme): CSSProperties {
  return {
    background: "rgba(255, 255, 255, 0.93)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(210, 207, 200, 0.86)",
    boxShadow: [
      "0 4px 14px rgba(52, 50, 46, 0.08)",
      "inset 0 1px 0 rgba(255,255,255,0.46)",
    ].join(", "),
    position: "relative",
    transition: "all 1s ease-in-out",
  };
}

export function getFrostedPaperCardStyle(light: LightTheme): CSSProperties {
  return getLiquidGlassCardStyle(light);
}

export function getReadableFrostedPaperCardStyle(light: LightTheme): CSSProperties {
  return {
    background: `linear-gradient(180deg, rgba(255,255,255,0.58) 0%, rgba(255,255,255,0.28) 52%, rgba(255,255,255,0.14) 100%), ${light.cardBg}`,
    backdropFilter: "blur(22px) saturate(1.08)",
    WebkitBackdropFilter: "blur(22px) saturate(1.08)",
    border: `1px solid ${light.glassBorder}`,
    boxShadow: `${light.glassShadow}, 0 12px 32px rgba(18,16,12,0.18), inset 0 -0.5px 0 rgba(255,255,255,0.12)`,
    position: "relative",
    transition: "all 1s ease-in-out",
  };
}

export function getGlassPillStyle(_light: LightTheme): CSSProperties {
  return {
    background: "rgba(255, 255, 255, 0.90)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    border: "1px solid rgba(210, 207, 200, 0.86)",
    boxShadow: [
      "0 4px 14px rgba(52, 50, 46, 0.08)",
      "inset 0 1px 0 rgba(255,255,255,0.46)",
    ].join(", "),
    position: "relative",
    transition: "all 1s ease-in-out",
  };
}

export function getSolidWarmCardStyle(): CSSProperties {
  return {
    background: "#fbfaf7",
    border: "0.5px solid #e5e2dc",
    boxShadow: "0 8px 22px rgba(44,42,38,0.08)",
    position: "relative",
  };
}
