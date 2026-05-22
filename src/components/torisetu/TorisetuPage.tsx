"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { loadCatProfiles, getActiveCatProfile } from "../../lib/catProfiles";
import type { RecentEvent } from "../../lib/supabase/queries";
import {
  getCatAvatarSrcForCoat,
  getCatName,
  type CatProfile,
} from "../../components/home/homeInputHelpers";
import { BottomNavigation } from "../navigation/BottomNavigation";
import {
  APP_ACCENT,
  APP_ACCENT_MUTED,
  APP_ACCENT_SOFT_BG,
  APP_ACCENT_SOFT_BORDER,
  APP_PAGE_BACKGROUND,
  APP_SUBTLE_SURFACE,
  APP_SURFACE,
} from "../ui/appTheme";

type TorisetuPageProps = {
  recentEvents: RecentEvent[];
};

type DayPart = "morning" | "daytime" | "evening" | "night";

type RecordLike = {
  id: string;
  type: string;
  signal: string;
  label: string | null;
  timestamp: number;
  timeBand?: string | null;
};

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

const UNLOCKS = [
  {
    id: "mood",
    title: "機嫌の見分け方",
    threshold: 8,
    preview: "よく出るサインが見えてきます",
  },
  {
    id: "play",
    title: "遊び方のコツ",
    threshold: 15,
    preview: "喜びやすい関わり方が見えてきます",
  },
  {
    id: "food",
    title: "ごはんのこと",
    threshold: 20,
    preview: "ごはんへの関心が見えてきます",
  },
  {
    id: "stress",
    title: "ストレスのサイン",
    threshold: 25,
    preview: "不安なときの変化が見えてきます",
  },
  {
    id: "bond",
    title: "距離の縮め方",
    threshold: 30,
    preview: "もっと仲良くなるヒントが見えてきます",
  },
];

export function TorisetuPage({ recentEvents }: TorisetuPageProps) {
  const [catProfile, setCatProfile] = useState<CatProfile | null>(null);
  const [localRecords, setLocalRecords] = useState<RecordLike[]>([]);

  useEffect(() => {
    const profiles = loadCatProfiles();
    const active = getActiveCatProfile(profiles);
    setCatProfile(active ?? null);
    setLocalRecords(active ? readLocalRecordLog(active.id) : []);
  }, []);

  const catName = catProfile ? getCatName(catProfile) : "ねこ";
  const remoteRecords = useMemo(
    () => buildRemoteRecords(recentEvents, catProfile?.id ?? null),
    [catProfile?.id, recentEvents],
  );
  const records = useMemo(
    () => [...localRecords, ...remoteRecords].sort((a, b) => b.timestamp - a.timestamp),
    [localRecords, remoteRecords],
  );
  const recordCount = records.length;
  const understanding = Math.min(
    100,
    Math.max(catProfile?.understanding?.percent ?? 0, Math.round(recordCount * 3)),
  );
  const nextUnlock = UNLOCKS.find((item) => recordCount < item.threshold);
  const nextRemaining = nextUnlock
    ? Math.max(0, nextUnlock.threshold - recordCount)
    : 0;
  const dayMap = buildDayMap(records);
  const isDayMapEmpty = dayMap.every((item) => !item.signal);
  const peakSlots = catProfile?.activityPattern?.peakTime
    ? peakTimeMap[catProfile.activityPattern.peakTime] ?? []
    : [];
  const avatarSrc =
    catProfile?.avatarDataUrl ??
    catProfile?.homePhotoDataUrl ??
    getCatAvatarSrcForCoat(catProfile?.appearance?.coat);
  const typeLabel = catProfile?.typeLabel ?? "まだ観察中";
  const typeTagline =
    catProfile?.typeTagline ??
    "みっけを重ねると、この子らしさが少しずつ見えてきます。";

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <p style={styles.eyebrow}>トリセツ</p>
          <h1 style={styles.title}>{catName}のこと</h1>
          <p style={styles.subtitle}>記録から少しずつ見えてきたこと</p>
        </header>

        <section style={styles.heroCard}>
          <div style={styles.heroAvatar}>
            <img src={avatarSrc} alt="" style={styles.heroAvatarImg} />
          </div>
          <div style={styles.heroInfo}>
            <div style={styles.heroTitleRow}>
              <span style={styles.heroName}>{catName}</span>
              <span style={styles.heroBadge}>{typeLabel}</span>
            </div>
            <p style={styles.heroText}>{typeTagline}</p>
          </div>
        </section>

        <section style={styles.progressCard}>
          <div style={styles.progressHeader}>
            <span style={styles.progressLabel}>見えてきたこと</span>
            <span style={styles.progressValue}>{understanding}%</span>
          </div>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${understanding}%` }} />
          </div>
          <p style={styles.progressHint}>
            {nextUnlock
              ? `あと${nextRemaining}回のみっけで「${nextUnlock.title}」が開きます`
              : "いま用意しているトリセツはすべて開いています"}
          </p>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>今わかっていること</h2>
          </div>

          <article style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>基本の性格</span>
              <span style={styles.badgeUnlocked}>解放済み</span>
            </div>
            <p style={styles.cardBody}>{typeTagline}</p>
            {catProfile?.typeLabel ? (
              <div style={styles.tagRow}>
                <span style={styles.tag}>{catProfile.typeLabel}</span>
              </div>
            ) : null}
          </article>

          <article style={styles.card}>
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
                            ? APP_ACCENT
                            : isPeakSlot
                              ? "rgba(86,96,82,0.35)"
                              : "#d8d5cd",
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
                記録が増えると、時間帯ごとの傾向がここに並びます。
              </p>
            ) : null}
          </article>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>これから見えてくること</h2>
          </div>

          {UNLOCKS.map((card) => {
            const progress = Math.min(100, Math.round((recordCount / card.threshold) * 100));
            const remaining = Math.max(0, card.threshold - recordCount);
            const isUnlocked = remaining === 0;

            return (
              <article
                key={card.id}
                style={isUnlocked ? styles.card : { ...styles.card, ...styles.cardLocked }}
              >
                <div style={styles.cardHeader}>
                  <span style={isUnlocked ? styles.cardTitle : styles.cardTitleLocked}>
                    {isUnlocked ? null : <LockIcon />}
                    {card.title}
                  </span>
                  <span style={isUnlocked ? styles.badgeUnlocked : styles.badgeLocked}>
                    {isUnlocked ? "解放済み" : `あと${remaining}回`}
                  </span>
                </div>
                <p style={isUnlocked ? styles.cardBody : styles.cardPreview}>
                  {isUnlocked
                    ? `${catName}の記録から、少しずつ読めるようになりました。`
                    : card.preview}
                </p>
                <div style={styles.progressTrackCompact}>
                  <div style={{ ...styles.progressFill, width: `${progress}%` }} />
                </div>
              </article>
            );
          })}
        </section>

        <div style={{ height: "108px" }} />
      </div>
      <BottomNavigation active="torisetu" />
    </main>
  );
}

function buildRemoteRecords(
  events: RecentEvent[],
  catId: string | null,
): RecordLike[] {
  return events
    .filter((event) => !catId || event.local_cat_id === catId)
    .map((event) => ({
      id: event.id,
      type: event.event_type,
      signal: event.signal,
      label: event.label,
      timestamp: new Date(event.occurred_at || event.created_at).getTime(),
      timeBand: event.calendar_context?.timeBand ?? null,
    }))
    .filter((record) => !Number.isNaN(record.timestamp));
}

function readLocalRecordLog(catId: string): RecordLike[] {
  try {
    const raw = window.localStorage.getItem(`record_log_${catId}`);
    const records = raw
      ? (JSON.parse(raw) as Array<{
          id?: string;
          type?: string;
          value?: string;
          timestamp?: number;
        }>)
      : [];

    return records
      .map((record, index) => ({
        id: record.id ?? `local-${index}`,
        type: record.type ?? "record",
        signal: record.value ?? "",
        label: record.value ?? null,
        timestamp: record.timestamp ?? 0,
      }))
      .filter((record) => record.timestamp > 0);
  } catch {
    return [];
  }
}

function buildDayMap(records: RecordLike[]): DayMapItem[] {
  const since = Date.now() - RECENT_CAT_SUMMARY_WINDOW_MS;
  const recentRecords = records.filter((record) => record.timestamp >= since);
  const dayParts: Array<{ dayPart: DayPart; period: string }> = [
    { dayPart: "morning", period: "朝" },
    { dayPart: "daytime", period: "昼" },
    { dayPart: "evening", period: "夕" },
    { dayPart: "night", period: "夜" },
  ];

  return dayParts.map(({ dayPart, period }) => {
    const recordsInPeriod = recentRecords.filter(
      (record) => getRecordDayPart(record) === dayPart,
    );
    const signal = getRepresentativeSignal(recordsInPeriod);

    return {
      period,
      dayPart,
      signal,
    };
  });
}

function getRepresentativeSignal(records: RecordLike[]) {
  if (records.length < 2) {
    return null;
  }

  const counts = new Map<string, number>();

  records.forEach((record) => {
    if (!record.signal) return;
    counts.set(record.signal, (counts.get(record.signal) ?? 0) + 1);
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

function getRecordDayPart(record: RecordLike): DayPart {
  const timeBand = record.timeBand;

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

  const hour = new Date(record.timestamp).getHours();

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
    "ねてる": "ねてる",
    "毛づくろい": "毛づくろい",
    "遊んでる": "遊んでる",
    "ごはん": "ごはん",
    "トイレ": "トイレ",
    "ゴロゴロ": "ゴロゴロ",
    "ついてくる": "ついてくる",
    "鳴いてる": "鳴いてる",
    "落ち着かない": "落ち着かない",
    "窓の外": "窓の外",
    "ふみふみ": "ふみふみ",
    "その他": "その他",
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
    background: APP_PAGE_BACKGROUND,
    color: "#242522",
  },
  container: {
    width: "min(100%, 430px)",
    margin: "0 auto",
    padding: "calc(env(safe-area-inset-top) + 14px) 16px 0",
  },
  header: {
    padding: "4px 0 14px",
  },
  eyebrow: {
    margin: "0 0 4px",
    color: APP_ACCENT_MUTED,
    fontSize: "12px",
    fontWeight: 760,
    letterSpacing: "0.04em",
  },
  title: {
    fontSize: "24px",
    fontWeight: 760,
    color: "#2a2a28",
    margin: "0 0 3px",
    lineHeight: 1.28,
  },
  subtitle: {
    fontSize: "13px",
    color: "#8f8b83",
    margin: 0,
    lineHeight: 1.5,
  },
  heroCard: {
    ...APP_SURFACE,
    display: "flex",
    alignItems: "center",
    gap: "14px",
    borderRadius: "20px",
    padding: "14px",
    marginBottom: "10px",
  },
  heroAvatar: {
    width: "64px",
    height: "64px",
    borderRadius: "20px",
    overflow: "hidden",
    flexShrink: 0,
    border: "0.5px solid rgba(210, 207, 200, 0.86)",
    background: "#f5f3ef",
  },
  heroAvatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  heroInfo: {
    minWidth: 0,
    flex: 1,
  },
  heroTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "5px",
  },
  heroName: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#2a2a28",
    fontSize: "18px",
    fontWeight: 760,
  },
  heroBadge: {
    flexShrink: 0,
    borderRadius: "99px",
    border: `0.5px solid ${APP_ACCENT_SOFT_BORDER}`,
    background: APP_ACCENT_SOFT_BG,
    color: APP_ACCENT,
    fontSize: "11px",
    fontWeight: 720,
    padding: "2px 8px",
  },
  heroText: {
    margin: 0,
    color: "#6f6a62",
    fontSize: "13px",
    fontWeight: 540,
    lineHeight: 1.6,
  },
  progressCard: {
    ...APP_SURFACE,
    borderRadius: "18px",
    padding: "14px 16px",
    marginBottom: "16px",
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "7px",
  },
  progressLabel: {
    fontSize: "13px",
    color: "#8f8b83",
    fontWeight: 680,
  },
  progressValue: {
    fontSize: "16px",
    color: "#2a2a28",
    fontWeight: 780,
  },
  progressTrack: {
    height: "4px",
    background: "#eeeae2",
    borderRadius: "99px",
    overflow: "hidden",
    marginBottom: "8px",
  },
  progressTrackCompact: {
    height: "3px",
    background: "#eeeae2",
    borderRadius: "99px",
    overflow: "hidden",
    marginTop: "10px",
  },
  progressFill: {
    height: "100%",
    background: APP_ACCENT,
    borderRadius: "99px",
    transition: "width 0.3s ease",
  },
  progressHint: {
    fontSize: "12px",
    color: APP_ACCENT,
    margin: 0,
    lineHeight: 1.5,
    fontWeight: 650,
  },
  section: {
    marginBottom: "16px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    margin: "0 4px 8px",
  },
  sectionTitle: {
    margin: 0,
    color: "#6f6a62",
    fontSize: "13px",
    fontWeight: 760,
    letterSpacing: "0.02em",
  },
  card: {
    ...APP_SURFACE,
    borderRadius: "18px",
    padding: "14px 16px",
    marginBottom: "8px",
  },
  cardLocked: {
    ...APP_SUBTLE_SURFACE,
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "7px",
  },
  cardTitle: {
    fontSize: "15px",
    fontWeight: 720,
    color: "#2a2a28",
    lineHeight: 1.45,
  },
  cardTitleLocked: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "14px",
    fontWeight: 650,
    color: "#8f8b83",
    lineHeight: 1.45,
  },
  cardBody: {
    fontSize: "14px",
    color: "#4a4a42",
    lineHeight: "1.75",
    margin: 0,
  },
  cardPreview: {
    fontSize: "13px",
    color: "#8f8b83",
    lineHeight: "1.6",
    margin: 0,
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
    padding: "8px 0",
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
    fontSize: "14px",
    fontWeight: 600,
  },
  dayMapRowValue: {
    color: "#2a2a28",
    fontSize: "14px",
    fontWeight: 680,
    textAlign: "right",
  },
  dayMapRowValueEmpty: {
    color: "#d0cdc6",
    fontSize: "14px",
    fontWeight: 500,
    textAlign: "right",
  },
  dayMapEmptyHint: {
    margin: "8px 0 0",
    color: "#8f8b83",
    fontSize: "13px",
    fontWeight: 560,
    lineHeight: 1.6,
  },
  tagRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "6px",
    marginTop: "10px",
  },
  tag: {
    background: APP_ACCENT_SOFT_BG,
    border: `0.5px solid ${APP_ACCENT_SOFT_BORDER}`,
    borderRadius: "99px",
    color: APP_ACCENT,
    fontSize: "11px",
    fontWeight: 680,
    padding: "3px 9px",
  },
  badgeUnlocked: {
    background: APP_ACCENT_SOFT_BG,
    border: `0.5px solid ${APP_ACCENT_SOFT_BORDER}`,
    borderRadius: "99px",
    color: APP_ACCENT,
    fontSize: "11px",
    fontWeight: 700,
    padding: "2px 8px",
    flexShrink: 0,
  },
  badgeLocked: {
    background: "rgba(255,255,255,0.76)",
    border: "0.5px solid rgba(210, 207, 200, 0.86)",
    borderRadius: "99px",
    color: APP_ACCENT_MUTED,
    fontSize: "11px",
    fontWeight: 700,
    padding: "2px 8px",
    flexShrink: 0,
  },
} satisfies Record<string, CSSProperties>;
