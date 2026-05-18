import type { CSSProperties } from "react";
import type { LightTheme } from "./lightTheme";

export function getGlassCardStyle(light: LightTheme): CSSProperties {
  return getLiquidGlassCardStyle(light);
}

export function getLiquidGlassCardStyle(light: LightTheme): CSSProperties {
  return {
    background: [
      "linear-gradient(145deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.12) 38%, rgba(255,255,255,0.04) 100%)",
      "radial-gradient(circle at 24% 0%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.10) 34%, rgba(255,255,255,0) 58%)",
      `linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02)), ${light.cardBg.replace(/0\.\d+\)/g, "0.34)")}`,
    ].join(", "),
    backdropFilter: "blur(34px) saturate(1.45) brightness(1.08)",
    WebkitBackdropFilter: "blur(34px) saturate(1.45) brightness(1.08)",
    border: `1px solid ${light.glassBorder}`,
    boxShadow: [
      "inset 0 1px 0 rgba(255,255,255,0.48)",
      "inset 0 -1px 0 rgba(255,255,255,0.10)",
      "0 18px 42px rgba(0,0,0,0.24)",
      light.glassShadow,
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

export function getGlassPillStyle(light: LightTheme): CSSProperties {
  return {
    background: [
      "linear-gradient(145deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.12) 42%, rgba(255,255,255,0.04) 100%)",
      "radial-gradient(circle at 20% 0%, rgba(255,255,255,0.48) 0%, rgba(255,255,255,0.12) 36%, rgba(255,255,255,0) 62%)",
      light.cardBg.replace(/0\.\d+\)/g, "0.28)"),
    ].join(", "),
    backdropFilter: "blur(28px) saturate(1.55) brightness(1.1)",
    WebkitBackdropFilter: "blur(28px) saturate(1.55) brightness(1.1)",
    border: `1px solid ${light.glassBorder}`,
    boxShadow: [
      "inset 0 1px 0 rgba(255,255,255,0.52)",
      "inset 0 -1px 0 rgba(255,255,255,0.10)",
      "0 10px 26px rgba(0,0,0,0.22)",
      light.glassShadow,
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
