import type { CSSProperties } from "react";
import type { LightTheme } from "./lightTheme";

function withAlpha(rgba: string, alpha: number): string {
  return rgba.replace(
    /rgba\((\d+),(\d+),(\d+),[0-9.]+\)/,
    `rgba($1,$2,$3,${alpha})`,
  );
}

export function getGlassCardStyle(light: LightTheme): CSSProperties {
  return getLiquidGlassCardStyle(light);
}

export function getLiquidGlassCardStyle(light: LightTheme): CSSProperties {
  return {
    background: [
      "linear-gradient(160deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.07) 42%, rgba(255,255,255,0.02) 100%)",
      "radial-gradient(circle at 18% 0%, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.08) 30%, rgba(255,255,255,0) 54%)",
      withAlpha(light.cardBg, 0.18),
    ].join(", "),
    backdropFilter: "blur(18px) saturate(1.25) brightness(1.04)",
    WebkitBackdropFilter: "blur(18px) saturate(1.25) brightness(1.04)",
    border: `0.75px solid ${light.glassBorder}`,
    boxShadow: [
      "inset 0 1px 0 rgba(255,255,255,0.46)",
      "inset 0 -1px 0 rgba(255,255,255,0.08)",
      "0 10px 28px rgba(0,0,0,0.16)",
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
      "linear-gradient(160deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.08) 44%, rgba(255,255,255,0.02) 100%)",
      "radial-gradient(circle at 18% 0%, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.10) 34%, rgba(255,255,255,0) 58%)",
      withAlpha(light.cardBg, 0.16),
    ].join(", "),
    backdropFilter: "blur(16px) saturate(1.28) brightness(1.06)",
    WebkitBackdropFilter: "blur(16px) saturate(1.28) brightness(1.06)",
    border: `0.75px solid ${light.glassBorder}`,
    boxShadow: [
      "inset 0 1px 0 rgba(255,255,255,0.50)",
      "inset 0 -1px 0 rgba(255,255,255,0.08)",
      "0 8px 20px rgba(0,0,0,0.16)",
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
