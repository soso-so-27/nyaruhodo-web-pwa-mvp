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
  },
  {
    minute: 7 * 60,
    washTop: "#f3eadc",
    washMid: "#f7efe3",
    washBottom: "#ebe1d0",
  },
  {
    minute: 12 * 60,
    washTop: "#f1eadf",
    washMid: "#f5ecdc",
    washBottom: "#e7dbc8",
  },
  {
    minute: 17 * 60,
    washTop: "#e5b5a4",
    washMid: "#e8d0c4",
    washBottom: "#d5c0b7",
  },
  {
    minute: 20 * 60,
    washTop: "#b9b6bd",
    washMid: "#cac2bc",
    washBottom: "#a9a6a5",
  },
] as const;

export function AppPaperTheme() {
  useEffect(() => {
    const applyPaperTheme = () => {
      const now = Date.now();
      const paper = getAppPaperTheme(now);
      const root = document.documentElement;
      root.style.setProperty("--app-paper-image", paper.image);
      root.style.setProperty("--app-paper-wash-top", paper.washTop);
      root.style.setProperty("--app-paper-wash-mid", paper.washMid);
      root.style.setProperty("--app-paper-wash-bottom", paper.washBottom);
    };

    applyPaperTheme();
    const interval = window.setInterval(applyPaperTheme, 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  return null;
}

function getAppPaperTheme(timestamp: number) {
  const minute = getJstMinuteOfDay(timestamp);
  const colors = getPaperDaylightColors(minute);
  return {
    image: getPaperBackgroundImage(minute),
    ...colors,
  };
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
      };
    }
  }

  return PAPER_DAYLIGHT_ANCHORS[PAPER_DAYLIGHT_ANCHORS.length - 1];
}

function getJstMinuteOfDay(timestamp: number) {
  const date = new Date(timestamp + 9 * 60 * 60 * 1000);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
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
