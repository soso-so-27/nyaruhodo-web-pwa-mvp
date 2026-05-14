"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { loadCatProfiles, getActiveCatProfile } from "../../lib/catProfiles";
import type { RecentEvent } from "../../lib/supabase/queries";
import type { CatProfile } from "../../components/home/homeInputHelpers";
import { BottomNavigation } from "../navigation/BottomNavigation";

type TorisetuPageProps = {
  recentEvents: RecentEvent[];
};

type DayPart = "morning" | "daytime" | "evening" | "night";

type DayMapItem = {
  period: string;
  dayPart: DayPart;
  signal: string | null;
};

const RECENT_CAT_SUMMARY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const peakTimeMap: Record<string, string[]> = {
  morning: ["朝"],
  afternoon: ["昼"],
  evening: ["夕", "夜"],
  night: ["夜"],
  random: [],
};

export function TorisetuPage({ recentEvents }: TorisetuPageProps) {
  const [catProfile, setCatProfile] = useState<CatProfile | null>(null);

  useEffect(() => {
    const profiles = loadCatProfiles();
    const active = getActiveCatProfile(profiles);
    setCatProfile(active ?? null);
  }, []);

  const catName = catProfile?.name ?? "むぎ";
  const rhythmEvents = catProfile
    ? recentEvents.filter((event) => event.local_cat_id === catProfile.id)
    : [];
  const dayMap = buildDayMap(rhythmEvents);
  const isDayMapEmpty = dayMap.every((item) => !item.signal);
  const peakSlots = catProfile?.activityPattern?.peakTime
    ? peakTimeMap[catProfile.activityPattern.peakTime] ?? []
    : [];

  const unlockedCards = [
    {
      id: "personality",
      title: "基本の性格",
      status: "unlocked" as const,
      body: catProfile?.typeTagline ?? "記録が増えると見えてきます",
      tags: [catProfile?.typeLabel ?? ""].filter(Boolean),
    },
  ];

  const lockedCards = [
    {
      id: "mood",
      title: "機嫌の見分け方",
      status: "locked" as const,
      remaining: 8,
      preview: "「3つのサイン」が見えてきます",
      progress: 0,
    },
    {
      id: "play",
      title: "遊び方のコツ",
      status: "locked" as const,
      remaining: 15,
      preview: "「一番喜ぶ遊び方」が分かってきます",
      progress: 0,
    },
    {
      id: "food",
      title: "ごはんのこと",
      status: "locked" as const,
      remaining: 20,
      preview: "「ごはんへの関心」が見えてきます",
      progress: 0,
    },
    {
      id: "stress",
      title: "ストレスのサイン",
      status: "locked" as const,
      remaining: 25,
      preview: "「不安なときのサイン」が分かってきます",
      progress: 0,
    },
    {
      id: "bond",
      title: "距離の縮め方",
      status: "locked" as const,
      remaining: 30,
      preview: "「もっと仲良くなるコツ」が見えてきます",
      progress: 0,
    },
  ];

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>{catName}のトリセツ</h1>
          <p style={styles.subtitle}>記録が増えると解放されます</p>
        </div>

        <div style={styles.progressCard}>
          <div style={styles.progressHeader}>
            <span style={styles.progressLabel}>理解度</span>
            <span style={styles.progressValue}>20%</span>
          </div>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: "20%" }} />
          </div>
          <p style={styles.progressHint}>
            あと6回記録すると「機嫌の見分け方」が見えてきます
          </p>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardTitle}>1日のリズム</span>
            <span style={styles.badgeUnlocked}>記録から</span>
          </div>
          <div style={styles.dayMapList}>
            {dayMap.map((item, index) => {
              const isPeakSlot = !item.signal && peakSlots.includes(item.period);

              return (
                <div
                  key={item.period}
                  style={
                    index === dayMap.length - 1
                      ? { ...styles.dayMapRow, borderBottom: "none" }
                      : styles.dayMapRow
                  }
                >
                  <div style={styles.dayMapRowLeft}>
                    <span
                      style={{
                        ...styles.dayMapRowDot,
                        background: item.signal
                          ? "#6B9E82"
                          : isPeakSlot
                            ? "rgba(107,158,130,0.35)"
                            : "#e0ddd6",
                      }}
                      aria-hidden="true"
                    />
                    <span style={styles.dayMapRowPeriod}>{item.period}</span>
                  </div>
                  <span
                    style={
                      item.signal
                        ? styles.dayMapRowValue
                        : styles.dayMapRowValueEmpty
                    }
                  >
                    {item.signal ? getSignalDisplayLabel(item.signal) : "-"}
                  </span>
                </div>
              );
            })}
          </div>
          {isDayMapEmpty ? (
            <p style={styles.dayMapEmptyHint}>
              記録が溜まると、1日のリズムが見えてきます
            </p>
          ) : null}
        </div>

        {unlockedCards.map((card) => (
          <div key={card.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>{card.title}</span>
              <span style={styles.badgeUnlocked}>解放済み</span>
            </div>
            <p style={styles.cardBody}>{card.body}</p>
            {card.tags.length > 0 ? (
              <div style={styles.tagRow}>
                {card.tags.map((tag) => (
                  <span key={tag} style={styles.tag}>
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}

        {lockedCards.map((card, index) => (
          <div
            key={card.id}
            style={{
              ...styles.card,
              ...styles.cardLocked,
              opacity: Math.max(0.4, 0.85 - index * 0.1),
            }}
          >
            <div style={styles.cardHeader}>
              <span style={styles.cardTitleLocked}>
                <LockIcon />
                {card.title}
              </span>
              <span style={styles.badgeLocked}>あと{card.remaining}回</span>
            </div>
            <p style={styles.cardPreview}>{card.preview}</p>
            <div style={styles.progressTrack}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${card.progress}%`,
                }}
              />
            </div>
          </div>
        ))}

        <div style={{ height: "100px" }} />
      </div>
      <BottomNavigation active="torisetu" />
    </main>
  );
}

function buildDayMap(events: RecentEvent[]): DayMapItem[] {
  const since = Date.now() - RECENT_CAT_SUMMARY_WINDOW_MS;
  const recentEvents = events.filter((event) => {
    const eventDate = new Date(event.occurred_at || event.created_at);

    return !Number.isNaN(eventDate.getTime()) && eventDate.getTime() >= since;
  });
  const dayParts: Array<{ dayPart: DayPart; period: string }> = [
    { dayPart: "morning", period: "朝" },
    { dayPart: "daytime", period: "昼" },
    { dayPart: "evening", period: "夕" },
    { dayPart: "night", period: "夜" },
  ];

  return dayParts.map(({ dayPart, period }) => {
    const eventsInPeriod = recentEvents.filter(
      (event) => getEventDayPart(event) === dayPart,
    );
    const signal = getRepresentativeSignal(eventsInPeriod);

    return {
      period,
      dayPart,
      signal,
    };
  });
}

function getRepresentativeSignal(events: RecentEvent[]) {
  if (events.length < 3) {
    return null;
  }

  const counts = new Map<string, number>();

  events.forEach((event) => {
    if (
      event.event_type !== "current_state" &&
      event.event_type !== "concern"
    ) {
      return;
    }

    counts.set(event.signal, (counts.get(event.signal) ?? 0) + 1);
  });

  const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  const top = sorted[0];

  if (!top || top[1] < 2) {
    return null;
  }

  const tiedTopSignals = sorted.filter(([, count]) => count === top[1]);

  if (tiedTopSignals.length > 1) {
    return null;
  }

  return top[0];
}

function getEventDayPart(event: RecentEvent): DayPart {
  const timeBand = event.calendar_context?.timeBand;

  if (timeBand === "early_morning" || timeBand === "morning") {
    return "morning";
  }

  if (timeBand === "daytime") {
    return "daytime";
  }

  if (timeBand === "evening") {
    return "evening";
  }

  if (timeBand === "night" || timeBand === "late_night") {
    return "night";
  }

  const eventDate = new Date(event.occurred_at || event.created_at);
  const hour = eventDate.getHours();

  if (hour >= 5 && hour < 11) {
    return "morning";
  }

  if (hour >= 11 && hour < 17) {
    return "daytime";
  }

  if (hour >= 17 && hour < 21) {
    return "evening";
  }

  return "night";
}

function getSignalDisplayLabel(signal: string) {
  const labels: Record<string, string> = {
    sleeping: "ねてる",
    grooming: "毛づくろい",
    playing: "遊んでる",
    after_food: "ごはん",
    food: "ごはん",
    toilet: "トイレ",
    purring: "ゴロゴロ",
    meowing: "鳴いてる",
    following: "ついてくる",
    restless: "落ち着かない",
    low_energy: "元気ない",
    fighting: "ケンカしてる",
    unknown: "よくわからない",
  };

  return labels[signal] ?? signal;
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5.5" y="10" width="13" height="9" rx="2" />
      <path d="M8.5 10V7.4a3.5 3.5 0 0 1 7 0V10" />
    </svg>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #fdfcf9 0%, #f7f5ef 100%)",
    color: "#242522",
  },
  container: {
    width: "min(100%, 430px)",
    margin: "0 auto",
    padding: "env(safe-area-inset-top) 16px 0",
  },
  header: {
    padding: "20px 0 12px",
  },
  title: {
    fontSize: "22px",
    fontWeight: 700,
    color: "#2a2a28",
    margin: "0 0 3px",
  },
  subtitle: {
    fontSize: "12px",
    color: "#9a9890",
    margin: 0,
  },
  progressCard: {
    background: "#fff",
    border: "0.5px solid #e5e2dc",
    borderRadius: "16px",
    padding: "14px 16px",
    marginBottom: "12px",
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "6px",
  },
  progressLabel: {
    fontSize: "12px",
    color: "#9a9890",
    fontWeight: 600,
  },
  progressValue: {
    fontSize: "14px",
    color: "#2a2a28",
    fontWeight: 700,
  },
  progressTrack: {
    height: "4px",
    background: "#f0ede8",
    borderRadius: "99px",
    overflow: "hidden",
    marginBottom: "8px",
  },
  progressFill: {
    height: "100%",
    background: "#6B9E82",
    borderRadius: "99px",
    transition: "width 0.3s ease",
  },
  progressHint: {
    fontSize: "11px",
    color: "#6B9E82",
    margin: 0,
  },
  card: {
    background: "#fff",
    border: "0.5px solid #e5e2dc",
    borderRadius: "16px",
    padding: "14px 16px",
    marginBottom: "8px",
  },
  cardLocked: {
    background: "#f9f8f5",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "6px",
  },
  cardTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#2a2a28",
  },
  cardTitleLocked: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "13px",
    fontWeight: 500,
    color: "#b0ada6",
  },
  cardBody: {
    fontSize: "13px",
    color: "#4a4a42",
    lineHeight: "1.7",
    margin: 0,
  },
  cardPreview: {
    fontSize: "12px",
    color: "#c0bdb6",
    fontStyle: "italic",
    lineHeight: "1.5",
    margin: "0 0 6px",
  },
  dayMapList: {
    display: "flex",
    flexDirection: "column",
    gap: "0px",
  },
  dayMapRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    borderBottom: "0.5px solid #f0ede8",
    padding: "7px 0",
  },
  dayMapRowLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  dayMapRowDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    flexShrink: 0,
    transition: "background 0.2s",
  },
  dayMapRowPeriod: {
    color: "#6a6a62",
    fontSize: "13px",
    fontWeight: 500,
  },
  dayMapRowValue: {
    color: "#2a2a28",
    fontSize: "13px",
    fontWeight: 600,
    textAlign: "right",
  },
  dayMapRowValueEmpty: {
    color: "#d0cdc6",
    fontSize: "13px",
    fontWeight: 400,
    textAlign: "right",
  },
  dayMapEmptyHint: {
    margin: "6px 0 0",
    color: "#8a8178",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.45,
  },
  tagRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "6px",
    marginTop: "8px",
  },
  tag: {
    background: "rgba(107,158,130,0.1)",
    border: "0.5px solid rgba(107,158,130,0.3)",
    borderRadius: "99px",
    color: "#3d6650",
    fontSize: "11px",
    padding: "3px 9px",
  },
  badgeUnlocked: {
    background: "#e8f4ee",
    border: "0.5px solid #a8d4bc",
    borderRadius: "99px",
    color: "#3d6650",
    fontSize: "10px",
    padding: "2px 8px",
    flexShrink: 0,
  },
  badgeLocked: {
    background: "#f5f3ef",
    border: "0.5px solid #e0ddd6",
    borderRadius: "99px",
    color: "#9a9890",
    fontSize: "10px",
    padding: "2px 8px",
    flexShrink: 0,
  },
} satisfies Record<string, CSSProperties>;
