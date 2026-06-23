"use client";

import { useEffect } from "react";

const PAPER_IMAGES = {
  dawn: "url('/images/home-backgrounds/generated-dawn-paper.png')",
  morning: "url('/images/home-backgrounds/generated-morning-paper.png')",
  noon: "url('/images/home-backgrounds/generated-noon-paper.png')",
  evening: "url('/images/home-backgrounds/generated-evening-paper.png')",
  night: "url('/images/home-backgrounds/generated-night-paper.png')",
} as const;

const PAPER_DAYLIGHT_ANCHORS = [
  {
    minute: 4 * 60 + 45,
    washTop: "#ead4c8",
    washMid: "#f4ead9",
    washBottom: "#eadfce",
    washTopStrength: 32,
    washMidStrength: 20,
    washBottomStrength: 24,
    paperCard: "#f2eee7",
    ink: "#3a332f",
    inkSoft: "#62584f",
    inkFaint: "#766b61",
    line: "#ded5c8",
    lineStrong: "#c8bcad",
  },
  {
    minute: 7 * 60,
    washTop: "#f3eadc",
    washMid: "#f7efe3",
    washBottom: "#ebe1d0",
    washTopStrength: 26,
    washMidStrength: 16,
    washBottomStrength: 20,
    paperCard: "#f2efe8",
    ink: "#3f3a33",
    inkSoft: "#665d53",
    inkFaint: "#7b7167",
    line: "#e0d8cb",
    lineStrong: "#c9bdad",
  },
  {
    minute: 12 * 60,
    washTop: "#f1eadf",
    washMid: "#f5ecdc",
    washBottom: "#e7dbc8",
    washTopStrength: 24,
    washMidStrength: 14,
    washBottomStrength: 18,
    paperCard: "#f1efe9",
    ink: "#3f3a33",
    inkSoft: "#665d53",
    inkFaint: "#786e64",
    line: "#ded7cb",
    lineStrong: "#c7bdaf",
  },
  {
    minute: 17 * 60,
    washTop: "#e5b5a4",
    washMid: "#e8d0c4",
    washBottom: "#d5c0b7",
    washTopStrength: 34,
    washMidStrength: 22,
    washBottomStrength: 28,
    paperCard: "#f3ede6",
    ink: "#382f2b",
    inkSoft: "#5b4f49",
    inkFaint: "#6d6058",
    line: "#dbcec4",
    lineStrong: "#bdaea2",
  },
  {
    minute: 20 * 60,
    washTop: "#b9b6bd",
    washMid: "#cac2bc",
    washBottom: "#a9a6a5",
    washTopStrength: 52,
    washMidStrength: 42,
    washBottomStrength: 50,
    paperCard: "#eee8e2",
    ink: "#2d2725",
    inkSoft: "#413937",
    inkFaint: "#584d4a",
    line: "#d5cbc1",
    lineStrong: "#b6aaa0",
  },
] as const;

export function AppPaperTheme() {
  useEffect(() => {
    const applyPaperTheme = () => {
      const now = getThemeTimestamp();
      const paper = getAppPaperTheme(now);
      const root = document.documentElement;
      const themeColorMeta = document.querySelector<HTMLMetaElement>(
        'meta[name="theme-color"]',
      );

      root.style.setProperty("--app-paper-image", paper.image);
      root.style.setProperty("--app-paper-wash-top", paper.washTop);
      root.style.setProperty("--app-paper-wash-mid", paper.washMid);
      root.style.setProperty("--app-paper-wash-bottom", paper.washBottom);
      root.style.setProperty(
        "--app-paper-wash-top-strength",
        `${paper.washTopStrength}%`,
      );
      root.style.setProperty(
        "--app-paper-wash-mid-strength",
        `${paper.washMidStrength}%`,
      );
      root.style.setProperty(
        "--app-paper-wash-bottom-strength",
        `${paper.washBottomStrength}%`,
      );
      root.style.setProperty("--paper-card", paper.paperCard);
      root.style.setProperty("--ink", paper.ink);
      root.style.setProperty("--ink-soft", paper.inkSoft);
      root.style.setProperty("--ink-faint", paper.inkFaint);
      root.style.setProperty("--line", paper.line);
      root.style.setProperty("--line-strong", paper.lineStrong);
      root.style.setProperty("--control-border", paper.lineStrong);
      root.style.setProperty("--control-border-selected", paper.inkSoft);
      root.style.setProperty("--app-theme-color", paper.themeColor);
      root.dataset.paperTheme = paper.key;

      if (themeColorMeta) {
        themeColorMeta.setAttribute("content", paper.themeColor);
      }
    };

    applyPaperTheme();
    const interval = window.setInterval(applyPaperTheme, 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  return null;
}

function getThemeTimestamp() {
  const testNow = (window as typeof window & { __testNow?: number }).__testNow;
  return typeof testNow === "number" && Number.isFinite(testNow)
    ? testNow
    : Date.now();
}

function getAppPaperTheme(timestamp: number) {
  const minute = getJstMinuteOfDay(timestamp);
  const colors = getPaperDaylightColors(minute);
  return {
    key: getPaperThemeKey(minute),
    image: getPaperBackgroundImage(minute),
    themeColor: colors.paperCard,
    ...colors,
  };
}

function getPaperThemeKey(minute: number) {
  if (minute < 5 * 60 + 45) {
    return "night";
  }
  if (minute < 8 * 60) {
    return "dawn";
  }
  if (minute < 11 * 60) {
    return "morning";
  }
  if (minute < 16 * 60 + 30) {
    return "noon";
  }
  if (minute < 20 * 60) {
    return "evening";
  }
  return "night";
}

function getPaperBackgroundImage(minute: number) {
  if (minute < 5 * 60 + 45) {
    return PAPER_IMAGES.night;
  }
  if (minute < 8 * 60) {
    return PAPER_IMAGES.dawn;
  }
  if (minute < 11 * 60) {
    return PAPER_IMAGES.morning;
  }
  if (minute < 16 * 60 + 30) {
    return PAPER_IMAGES.noon;
  }
  if (minute < 20 * 60) {
    return PAPER_IMAGES.evening;
  }
  return PAPER_IMAGES.night;
}

function getPaperDaylightColors(minute: number) {
  if (minute < PAPER_DAYLIGHT_ANCHORS[0].minute) {
    return PAPER_DAYLIGHT_ANCHORS[PAPER_DAYLIGHT_ANCHORS.length - 1];
  }

  for (let index = 0; index < PAPER_DAYLIGHT_ANCHORS.length - 1; index += 1) {
    const start = PAPER_DAYLIGHT_ANCHORS[index];
    const end = PAPER_DAYLIGHT_ANCHORS[index + 1];
    if (minute >= start.minute && minute <= end.minute) {
      const progress = (minute - start.minute) / (end.minute - start.minute);
      return {
        washTop: interpolateHexColor(start.washTop, end.washTop, progress),
        washMid: interpolateHexColor(start.washMid, end.washMid, progress),
        washBottom: interpolateHexColor(start.washBottom, end.washBottom, progress),
        washTopStrength: interpolateNumber(
          start.washTopStrength,
          end.washTopStrength,
          progress,
        ),
        washMidStrength: interpolateNumber(
          start.washMidStrength,
          end.washMidStrength,
          progress,
        ),
        washBottomStrength: interpolateNumber(
          start.washBottomStrength,
          end.washBottomStrength,
          progress,
        ),
        paperCard: interpolateHexColor(start.paperCard, end.paperCard, progress),
        ink: interpolateHexColor(start.ink, end.ink, progress),
        inkSoft: interpolateHexColor(start.inkSoft, end.inkSoft, progress),
        inkFaint: interpolateHexColor(start.inkFaint, end.inkFaint, progress),
        line: interpolateHexColor(start.line, end.line, progress),
        lineStrong: interpolateHexColor(start.lineStrong, end.lineStrong, progress),
      };
    }
  }

  return PAPER_DAYLIGHT_ANCHORS[PAPER_DAYLIGHT_ANCHORS.length - 1];
}

function getJstMinuteOfDay(timestamp: number) {
  const date = new Date(timestamp + 9 * 60 * 60 * 1000);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function interpolateNumber(from: number, to: number, progress: number) {
  return Math.round((from + (to - from) * progress) * 10) / 10;
}

function interpolateHexColor(from: string, to: string, progress: number) {
  const start = parseHexColor(from);
  const end = parseHexColor(to);
  const mix = start.map((channel, index) =>
    Math.round(channel + (end[index] - channel) * progress),
  );
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

function parseHexColor(hex: string) {
  const normalized = hex.replace("#", "");
  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
}
