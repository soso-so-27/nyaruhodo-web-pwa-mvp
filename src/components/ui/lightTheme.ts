import type { CSSProperties } from "react";

export type LightLevelKey = 1 | 2 | 3 | 4 | 5;

export const LIGHT_LEVELS = {
  1: {
    brightness: 0.58,
    saturate: 0.78,
    contrast: 0.94,
    mainOverlay:
      "linear-gradient(to top right, rgba(4,8,24,0.62) 0%, rgba(8,12,30,0.50) 32%, rgba(12,16,34,0.28) 60%, rgba(18,18,30,0.10) 82%, rgba(0,0,0,0.0) 100%)",
    cornerGlow:
      "radial-gradient(circle at 86% 12%, rgba(255,190,110,0.16) 0%, rgba(255,190,110,0.06) 14%, rgba(255,190,110,0) 30%)",
    ambientGlow:
      "radial-gradient(ellipse at 50% 64%, rgba(255,226,190,0.07) 0%, rgba(255,226,190,0.03) 22%, rgba(255,226,190,0) 42%)",
    coldOverlay:
      "radial-gradient(circle at 0% 0%, rgba(60,80,120,0.35) 0%, rgba(40,60,100,0.15) 30%, rgba(0,0,0,0) 55%)",
    bottomWarmth:
      "radial-gradient(circle at 50% 92%, rgba(255,170,90,0.03) 0%, rgba(255,170,90,0) 48%)",
    fogOverlay: "rgba(18,24,42,0.08)",
    goldenBloom: "transparent",
    cardBg: "rgba(232,232,226,0.80)",
    glassBorder: "rgba(255,255,255,0.10)",
    glassShadow:
      "0 2px 8px rgba(0,0,0,0.20), inset 0 0.5px 0 rgba(255,255,255,0.10)",
    bulbColor: "#3a3a3a",
    bulbGlow: "none",
    barWidth: 0,
    barColor: "#444",
  },
  2: {
    brightness: 0.72,
    saturate: 0.86,
    contrast: 0.95,
    mainOverlay:
      "linear-gradient(to top right, rgba(10,14,24,0.42) 0%, rgba(12,16,26,0.32) 30%, rgba(18,18,28,0.16) 60%, rgba(0,0,0,0.0) 100%)",
    cornerGlow:
      "radial-gradient(circle at 86% 12%, rgba(255,190,110,0.34) 0%, rgba(255,190,110,0.13) 18%, rgba(255,190,110,0) 36%)",
    ambientGlow:
      "radial-gradient(ellipse at 50% 64%, rgba(255,226,190,0.10) 0%, rgba(255,226,190,0.04) 24%, rgba(255,226,190,0) 44%)",
    coldOverlay:
      "radial-gradient(circle at 0% 0%, rgba(60,80,120,0.18) 0%, rgba(40,60,100,0.06) 30%, rgba(0,0,0,0) 48%)",
    bottomWarmth:
      "radial-gradient(circle at 50% 92%, rgba(255,170,90,0.06) 0%, rgba(255,170,90,0) 50%)",
    fogOverlay: "rgba(36,38,46,0.04)",
    goldenBloom: "transparent",
    cardBg: "rgba(242,238,230,0.82)",
    glassBorder: "rgba(255,255,255,0.12)",
    glassShadow:
      "0 2px 8px rgba(0,0,0,0.18), inset 0 0.5px 0 rgba(255,255,255,0.14)",
    bulbColor: "#C8A050",
    bulbGlow: "none",
    barWidth: 25,
    barColor: "#C8A050",
  },
  3: {
    brightness: 0.88,
    saturate: 0.98,
    contrast: 0.98,
    mainOverlay:
      "linear-gradient(to top right, rgba(0,0,0,0.24) 0%, rgba(0,0,0,0.16) 34%, rgba(0,0,0,0.06) 70%, rgba(0,0,0,0.0) 100%)",
    cornerGlow:
      "radial-gradient(circle at 86% 12%, rgba(255,190,110,0.46) 0%, rgba(255,190,110,0.20) 20%, rgba(255,190,110,0) 40%)",
    ambientGlow:
      "radial-gradient(ellipse at 50% 64%, rgba(255,226,190,0.12) 0%, rgba(255,226,190,0.05) 26%, rgba(255,226,190,0) 46%)",
    coldOverlay: "transparent",
    bottomWarmth:
      "radial-gradient(circle at 50% 92%, rgba(255,170,90,0.10) 0%, rgba(255,170,90,0) 52%)",
    fogOverlay: "transparent",
    goldenBloom: "transparent",
    cardBg: "rgba(255,250,238,0.84)",
    glassBorder: "rgba(255,255,255,0.15)",
    glassShadow:
      "0 2px 10px rgba(0,0,0,0.15), inset 0 0.5px 0 rgba(255,255,255,0.18)",
    bulbColor: "#E0B840",
    bulbGlow: "0 0 5px 2px rgba(245,200,66,0.35)",
    barWidth: 50,
    barColor: "#E0B840",
  },
  4: {
    brightness: 0.94,
    saturate: 1.02,
    contrast: 1,
    mainOverlay:
      "linear-gradient(to top right, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.08) 34%, rgba(0,0,0,0.02) 72%, rgba(0,0,0,0.0) 100%)",
    cornerGlow:
      "radial-gradient(circle at 86% 12%, rgba(255,192,112,0.72) 0%, rgba(255,192,112,0.36) 20%, rgba(255,192,112,0.08) 34%, rgba(255,192,112,0) 44%)",
    ambientGlow:
      "radial-gradient(ellipse at 50% 64%, rgba(255,226,190,0.12) 0%, rgba(255,226,190,0.05) 26%, rgba(255,226,190,0) 46%)",
    coldOverlay: "transparent",
    bottomWarmth:
      "radial-gradient(circle at 50% 92%, rgba(255,170,90,0.16) 0%, rgba(255,170,90,0) 55%)",
    fogOverlay: "transparent",
    goldenBloom:
      "radial-gradient(ellipse at 84% 12%, rgba(255,202,82,0.32) 0%, rgba(255,182,62,0.16) 24%, rgba(255,160,40,0.05) 44%, rgba(255,160,40,0) 56%)",
    cardBg: "rgba(255,250,238,0.86)",
    glassBorder: "rgba(255,220,140,0.32)",
    glassShadow:
      "0 2px 16px rgba(255,180,60,0.16), inset 0 0.5px 0 rgba(255,220,140,0.30)",
    bulbColor: "#F5C842",
    bulbGlow: "0 0 7px 3px rgba(245,200,66,0.55)",
    barWidth: 75,
    barColor: "#F5C842",
  },
  5: {
    brightness: 0.96,
    saturate: 1.04,
    contrast: 1,
    mainOverlay:
      "linear-gradient(to top right, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.03) 44%, rgba(0,0,0,0.0) 100%)",
    cornerGlow:
      "radial-gradient(circle at 86% 12%, rgba(255,198,114,0.78) 0%, rgba(255,198,114,0.38) 22%, rgba(255,198,114,0.10) 36%, rgba(255,198,114,0) 48%)",
    ambientGlow:
      "radial-gradient(ellipse at 50% 64%, rgba(255,232,196,0.14) 0%, rgba(255,232,196,0.05) 26%, rgba(255,232,196,0) 46%)",
    coldOverlay: "transparent",
    bottomWarmth:
      "radial-gradient(circle at 50% 92%, rgba(255,170,90,0.20) 0%, rgba(255,170,90,0) 58%)",
    fogOverlay: "transparent",
    goldenBloom:
      "radial-gradient(ellipse at 84% 12%, rgba(255,212,102,0.40) 0%, rgba(255,192,72,0.22) 22%, rgba(255,170,50,0.08) 40%, rgba(255,170,50,0) 52%)",
    cardBg: "rgba(255,252,242,0.88)",
    glassBorder: "rgba(255,230,160,0.42)",
    glassShadow:
      "0 2px 20px rgba(255,190,70,0.24), inset 0 0.5px 0 rgba(255,230,160,0.42)",
    bulbColor: "#F5C842",
    bulbGlow:
      "0 0 10px 5px rgba(245,200,66,0.7), 0 0 22px 11px rgba(245,200,66,0.3)",
    barWidth: 100,
    barColor: "#F5C842",
  },
} as const;

export type LightTheme = (typeof LIGHT_LEVELS)[LightLevelKey];

export function getLightLevel(score: number): LightLevelKey {
  if (score <= 20) return 1;
  if (score <= 40) return 2;
  if (score <= 60) return 3;
  if (score <= 80) return 4;
  return 5;
}

export function getPhotoStyle(level: LightTheme): CSSProperties {
  return {
    filter: `brightness(${level.brightness}) saturate(${level.saturate}) contrast(${level.contrast})`,
    transition: "filter 1s ease-in-out",
  };
}

export function getDebugLightScore(level: LightLevelKey): number {
  const scoreByLevel: Record<LightLevelKey, number> = {
    1: 10,
    2: 30,
    3: 50,
    4: 70,
    5: 100,
  };
  return scoreByLevel[level];
}

export function getLightText(level: number, name: string) {
  if (level === 1) return `${name}のことが、少し遠くなってきたかも`;
  if (level === 2) return `${name}のこと、もう少し見てあげたいな`;
  if (level === 3) return `${name}のことが、だんだんわかってきたかも`;
  if (level === 4) return `${name}のこと、最近よくわかる気がする`;
  return `${name}のこと、だいぶわかってきたよ`;
}
