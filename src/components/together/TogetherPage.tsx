"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { RecentEvent } from "../../lib/supabase/queries";
import { BottomNavigation } from "../navigation/BottomNavigation";
import {
  getActiveCatProfile,
  getCatAvatarSrcForCoat,
  getCatName,
  readActiveCatId,
  readCatProfiles,
  saveActiveCatId,
} from "../home/homeInputHelpers";
import type { CatCoat, CatProfile } from "../home/homeInputHelpers";

type TogetherPageProps = {
  recentEvents: RecentEvent[];
};

type SummaryStats = {
  activeEvents: RecentEvent[];
  recentEvents: RecentEvent[];
  previousEvents: RecentEvent[];
  recentDayCount: number;
  previousDayCount: number;
  recentEventCount: number;
  previousEventCount: number;
  increasedSignal: SignalTrend | null;
  summaryText: string;
  changeText: string;
  changeSubText: string;
  score: number;
  badges: BadgeItem[];
};

type SignalTrend = {
  signal: string;
  label: string;
  count: number;
  diff: number;
};

type BadgeItem = {
  label: string;
  text: string;
  unlocked: boolean;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function TogetherPage({ recentEvents }: TogetherPageProps) {
  const [catProfiles, setCatProfiles] = useState<CatProfile[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const profiles = readCatProfiles();
    const savedActiveCatId = readActiveCatId();
    const activeProfile = getActiveCatProfile(profiles, savedActiveCatId);

    setCatProfiles(profiles);
    setActiveCatId(activeProfile.id);
    saveActiveCatId(activeProfile.id);
    setHasLoaded(true);
  }, []);

  const activeCatProfile =
    catProfiles.length > 0
      ? getActiveCatProfile(catProfiles, activeCatId)
      : null;
  const catName = getCatName(activeCatProfile);
  const catCoat = activeCatProfile?.appearance?.coat;
  const catAvatarSrc = getCatAvatarSrcForCoat(catCoat);
  const catAvatarStyle = getCatCoatAvatarStyle(catCoat);

  const stats = useMemo(
    () => buildTogetherStats(recentEvents, activeCatId, catName),
    [recentEvents, activeCatId, catName],
  );
  const weekRange = getWeekRangeText();
  const hasActiveCat = Boolean(activeCatProfile);

  if (!hasLoaded) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <section style={styles.emptyCard}>
            <h1 style={styles.emptyTitle}>いっしょ時間を準備しています</h1>
            <p style={styles.emptyText}>
              この子との最近の記録を、少しだけ見ています。
            </p>
          </section>
        </div>
        <BottomNavigation active="together" />
      </main>
    );
  }

  if (!hasActiveCat) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <section style={styles.emptyCard}>
            <h1 style={styles.emptyTitle}>一緒に暮らしている子を登録しましょう</h1>
            <p style={styles.emptyText}>
              ねこページで登録すると、いっしょの時間も少しずつ見えてきます。
            </p>
            <a href="/cats" style={styles.primaryLink}>
              ねこを登録する
            </a>
          </section>
        </div>
        <BottomNavigation active="together" />
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.hero}>
          <div style={styles.heroCopy}>
            <p style={styles.eyebrow}>いっしょ</p>
            <h1 style={styles.title}>あなたと{catName}のいっしょ時間</h1>
            <p style={styles.lead}>ふたりの関係を一緒に見ていこう</p>
          </div>
          <div style={styles.heroIllustration} aria-hidden="true">
            <span style={styles.personShape}>あなた</span>
            <div style={{ ...styles.heroAvatar, ...catAvatarStyle }}>
              <img
                src={catAvatarSrc}
                alt=""
                style={styles.heroAvatarImage}
                onError={(event) => {
                  event.currentTarget.src = "/icons/cat-avatars/neutral.png";
                }}
              />
            </div>
          </div>
        </header>

        <nav style={styles.segmentNav} aria-label="いっしょページ内ナビ">
          <span style={styles.segmentActive}>まとめ</span>
          <a href="#changes" style={styles.segmentButton}>
            変化
          </a>
          <a href="#message" style={styles.segmentButton}>
            思い出
          </a>
          <a href="#badges" style={styles.segmentButton}>
            バッジ
          </a>
        </nav>

        <section style={styles.summaryCard}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>今週の関係のまとめ</h2>
            <span style={styles.dateRange}>{weekRange}</span>
          </div>
          <p style={styles.summaryText}>{stats.summaryText}</p>
        </section>

        <section style={styles.statsGrid} aria-label="今週の小さなまとめ">
          <MiniStatCard
            label="いっしょに見た日数"
            value={`${stats.recentDayCount}日`}
            subText={formatDelta(stats.recentDayCount, stats.previousDayCount, "日")}
          />
          <MiniStatCard
            label="あなたが見た回数"
            value={`${stats.recentEventCount}回`}
            subText={formatDelta(stats.recentEventCount, stats.previousEventCount, "回")}
          />
          <MiniStatCard
            label={`${catName}の増えた様子`}
            value={stats.increasedSignal ? `${stats.increasedSignal.label}多め` : "少しずつ"}
            subText={
              stats.increasedSignal
                ? formatSignalDelta(stats.increasedSignal)
                : "今週の記録から"
            }
          />
        </section>

        <section id="changes" style={styles.card}>
          <h2 style={styles.cardTitle}>最近の変化</h2>
          <p style={styles.bodyText}>{stats.changeText}</p>
          <p style={styles.subtleText}>{stats.changeSubText}</p>
        </section>

        <section style={styles.relationshipCard}>
          <div style={styles.scoreRing} aria-label={`関係スコア ${stats.score}`}>
            <span style={styles.scoreValue}>{stats.score}</span>
          </div>
          <div style={styles.scoreTextBlock}>
            <p style={styles.scoreLabel}>あなたと{catName}の関係スコア</p>
            <h2 style={styles.scoreTitle}>ふたりの信頼が育ってきています</h2>
            <p style={styles.subtleText}>
              記録から見た、アプリ内の小さな目安です。
            </p>
          </div>
        </section>

        <section id="message" style={styles.messageCard}>
          <div>
            <h2 style={styles.cardTitle}>あなたへのメッセージ</h2>
            <p style={styles.messageText}>
              {stats.recentEventCount > 0
                ? `${catName}のこと、ちゃんと見てるね。これからも少しずつ、いい時間をつくっていこうね。`
                : `${catName}のこと、これから少しずつ見えてきます。見えたままをひとつ残すだけでOKです。`}
            </p>
          </div>
          <div style={{ ...styles.messageAvatar, ...catAvatarStyle }} aria-hidden="true">
            <img src={catAvatarSrc} alt="" style={styles.messageAvatarImage} />
          </div>
        </section>

        {stats.recentEventCount < 2 ? (
          <section style={styles.emptyHintCard}>
            <h2 style={styles.cardTitle}>
              {catName}との時間は、これから少しずつ見えてきます
            </h2>
            <p style={styles.bodyText}>
              いま見えたままをひとつ残すだけでOKです。
            </p>
            <a href="/home" style={styles.secondaryLink}>
              ほーむで記録する
            </a>
          </section>
        ) : null}

        <section id="badges" style={styles.card}>
          <div style={styles.cardHeader}>
            <h2 style={styles.cardTitle}>バッジコレクション</h2>
          </div>
          <div style={styles.badgeGrid}>
            {stats.badges.map((badge) => (
              <div
                key={badge.label}
                style={badge.unlocked ? styles.badge : styles.badgeLocked}
              >
                <span style={styles.badgeIcon} aria-hidden="true">
                  {badge.unlocked ? "○" : "・"}
                </span>
                <span style={styles.badgeLabel}>{badge.label}</span>
                <span style={styles.badgeText}>{badge.text}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <BottomNavigation active="together" />
    </main>
  );
}

function MiniStatCard({
  label,
  value,
  subText,
}: {
  label: string;
  value: string;
  subText: string;
}) {
  return (
    <article style={styles.statCard}>
      <p style={styles.statLabel}>{label}</p>
      <p style={styles.statValue}>{value}</p>
      <p style={styles.statSubText}>{subText}</p>
    </article>
  );
}

function buildTogetherStats(
  events: RecentEvent[],
  activeCatId: string | null,
  catName: string,
): SummaryStats {
  const activeEvents = activeCatId
    ? events.filter((event) => event.local_cat_id === activeCatId)
    : [];
  const now = Date.now();
  const recentStart = now - 7 * ONE_DAY_MS;
  const previousStart = now - 14 * ONE_DAY_MS;
  const recentEvents = activeEvents.filter((event) => {
    const time = getEventTime(event);
    return time >= recentStart && time <= now;
  });
  const previousEvents = activeEvents.filter((event) => {
    const time = getEventTime(event);
    return time >= previousStart && time < recentStart;
  });
  const recentDayCount = countDistinctDays(recentEvents);
  const previousDayCount = countDistinctDays(previousEvents);
  const increasedSignal = getIncreasedSignal(recentEvents, previousEvents);
  const score = calculateRelationshipScore(
    recentEvents.length,
    recentDayCount,
  );

  return {
    activeEvents,
    recentEvents,
    previousEvents,
    recentDayCount,
    previousDayCount,
    recentEventCount: recentEvents.length,
    previousEventCount: previousEvents.length,
    increasedSignal,
    summaryText: buildSummaryText(catName, recentEvents, increasedSignal),
    changeText: buildChangeText(recentEvents, increasedSignal),
    changeSubText: buildChangeSubText(increasedSignal),
    score,
    badges: buildBadges(activeEvents),
  };
}

function getEventTime(event: RecentEvent) {
  const date = new Date(event.occurred_at || event.created_at);
  const time = date.getTime();

  return Number.isNaN(time) ? 0 : time;
}

function countDistinctDays(events: RecentEvent[]) {
  return new Set(events.map((event) => formatTokyoDateKey(new Date(getEventTime(event))))).size;
}

function formatTokyoDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getIncreasedSignal(
  recentEvents: RecentEvent[],
  previousEvents: RecentEvent[],
) {
  const recentCounts = countSignals(recentEvents);
  const previousCounts = countSignals(previousEvents);
  const candidates = [...recentCounts.entries()]
    .map(([signal, count]) => ({
      signal,
      label: getSignalDisplayLabel(signal),
      count,
      diff: count - (previousCounts.get(signal) ?? 0),
    }))
    .filter((item) => item.count >= 2)
    .sort((a, b) => {
      if (b.diff !== a.diff) {
        return b.diff - a.diff;
      }

      return b.count - a.count;
    });

  const top = candidates[0];

  if (!top || top.diff <= 0) {
    return null;
  }

  return top;
}

function countSignals(events: RecentEvent[]) {
  const counts = new Map<string, number>();

  events.forEach((event) => {
    if (!event.signal) {
      return;
    }

    counts.set(event.signal, (counts.get(event.signal) ?? 0) + 1);
  });

  return counts;
}

function buildSummaryText(
  catName: string,
  recentEvents: RecentEvent[],
  increasedSignal: SignalTrend | null,
) {
  if (recentEvents.length === 0) {
    return `${catName}のこと、少しずつ分かってきています`;
  }

  if (recentEvents.length < 3) {
    return `${catName}のリズムが少しずつ見えてきています`;
  }

  if (increasedSignal?.signal === "following") {
    return `${catName}は、あなたの近くで過ごす日が少し増えているみたい`;
  }

  if (increasedSignal?.signal === "meowing") {
    return `${catName}は、声で伝えることが少し多めみたい`;
  }

  if (increasedSignal?.signal === "playing") {
    return `${catName}は、動きたい時間が少し見えてきています`;
  }

  return `${catName}のこと、少しずつ分かってきています`;
}

function buildChangeText(
  recentEvents: RecentEvent[],
  increasedSignal: SignalTrend | null,
) {
  if (recentEvents.length === 0) {
    return "まだこれから。少しずつ見えてきます";
  }

  if (increasedSignal?.signal === "following") {
    return "そばに来る記録が少し増えています";
  }

  if (increasedSignal?.signal === "meowing") {
    return "鳴いて伝えることが少し増えています";
  }

  if (increasedSignal?.signal === "playing") {
    return "遊んでいる記録が少し増えています";
  }

  const nightEvents = recentEvents.filter((event) => {
    const timeBand = event.calendar_context?.timeBand;
    return timeBand === "night" || timeBand === "late_night";
  });

  if (nightEvents.length >= 2) {
    return "夜の記録が少し増えています";
  }

  const daytimeSleeping = recentEvents.filter(
    (event) =>
      event.signal === "sleeping" &&
      event.calendar_context?.timeBand === "daytime",
  );

  if (daytimeSleeping.length >= 2) {
    return "昼によく寝ているみたいです";
  }

  return "いくつかの様子が少しずつ残っています";
}

function buildChangeSubText(increasedSignal: SignalTrend | null) {
  if (!increasedSignal) {
    return "先週と比べながら、少しずつ見ていけます";
  }

  return `先週より +${increasedSignal.diff}回`;
}

function calculateRelationshipScore(eventCount: number, dayCount: number) {
  if (eventCount === 0) {
    return 12;
  }

  return Math.min(95, 40 + eventCount * 5 + dayCount * 5);
}

function buildBadges(events: RecentEvent[]): BadgeItem[] {
  const dayCount = countDistinctDays(events);

  return [
    {
      label: "はじめの一歩",
      text: "1回記録",
      unlocked: events.length >= 1,
    },
    {
      label: "見守り上手",
      text: "記録10回",
      unlocked: events.length >= 10,
    },
    {
      label: "なかよし",
      text: "7日分",
      unlocked: dayCount >= 7,
    },
    {
      label: "これからも",
      text: "おたのしみに",
      unlocked: false,
    },
  ];
}

function formatDelta(current: number, previous: number, unit: string) {
  const diff = current - previous;

  if (diff > 0) {
    return `先週より +${diff}${unit}`;
  }

  if (diff < 0) {
    return "先週より少なめ";
  }

  return current > 0 ? "先週と同じくらい" : "これから";
}

function formatSignalDelta(signal: SignalTrend) {
  if (signal.diff > 0) {
    return `先週より +${signal.diff}回`;
  }

  return "今週の多め";
}

function getWeekRangeText() {
  const end = new Date();
  const start = new Date(end.getTime() - 6 * ONE_DAY_MS);

  return `${formatMonthDay(start)} - ${formatMonthDay(end)}`;
}

function formatMonthDay(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
  }).format(date);
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
    restless: "そわそわ",
    low_energy: "元気ない",
    fighting: "ケンカ",
    unknown: "よくわからない",
  };

  return labels[signal] ?? "様子";
}

function getCatCoatAvatarStyle(coat?: CatCoat): CSSProperties {
  const stylesByCoat: Record<CatCoat, CSSProperties> = {
    saba: {
      borderColor: "#d8d2c4",
      background: "linear-gradient(180deg, #fffaf2 0%, #e6ded1 100%)",
    },
    cream: {
      borderColor: "#d8d2c4",
      background: "linear-gradient(180deg, #fffaf2 0%, #e6ded1 100%)",
    },
    gray: {
      borderColor: "#d6d3d1",
      background: "linear-gradient(180deg, #f6f5f3 0%, #e5e2de 100%)",
    },
    orange_tabby: {
      borderColor: "#efc89a",
      background: "linear-gradient(180deg, #fff1dc 0%, #f5c994 100%)",
    },
    black: {
      borderColor: "#57534e",
      background: "linear-gradient(180deg, #e7e2dc 0%, #9b928a 100%)",
    },
    white: {
      borderColor: "#d4d4d8",
      background: "linear-gradient(180deg, #ffffff 0%, #f4f4f5 100%)",
    },
    calico: {
      borderColor: "#ead7bd",
      background:
        "linear-gradient(135deg, #fff9ef 0%, #fff9ef 42%, #f8d7ad 43%, #f8d7ad 66%, #e4ded5 67%, #e4ded5 100%)",
    },
  };

  return coat ? stylesByCoat[coat] : {};
}

const styles = {
  page: {
    minHeight: "100svh",
    background:
      "linear-gradient(180deg, #faf6ef 0%, #f5efe7 48%, #f0ebe4 100%)",
    color: "#27272a",
    padding: "14px 14px calc(250px + env(safe-area-inset-bottom))",
  },
  container: {
    width: "min(100%, 460px)",
    margin: "0 auto",
  },
  hero: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "14px",
    alignItems: "center",
    padding: "20px 18px",
    border: "1px solid #eadfd2",
    borderRadius: "28px",
    background:
      "radial-gradient(circle at 90% 10%, rgba(239, 196, 144, 0.26), transparent 34%), #fffaf3",
    marginBottom: "12px",
  },
  heroCopy: {
    minWidth: 0,
  },
  eyebrow: {
    margin: "0 0 5px",
    color: "#8a7562",
    fontSize: "12px",
    fontWeight: 800,
  },
  title: {
    margin: 0,
    color: "#27272a",
    fontSize: "26px",
    lineHeight: 1.18,
    letterSpacing: 0,
  },
  lead: {
    margin: "8px 0 0",
    color: "#6f6257",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  heroIllustration: {
    position: "relative",
    width: "118px",
    height: "118px",
  },
  personShape: {
    position: "absolute",
    top: "7px",
    right: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "74px",
    height: "74px",
    borderRadius: "999px",
    background: "#e9d3bd",
    color: "#755d4b",
    fontSize: "11px",
    fontWeight: 800,
  },
  heroAvatar: {
    position: "absolute",
    left: 0,
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "70px",
    height: "70px",
    border: "1px solid #eadfd2",
    borderRadius: "24px",
    background: "#fff8ee",
  },
  heroAvatarImage: {
    width: "56px",
    height: "56px",
    objectFit: "contain",
  },
  segmentNav: {
    display: "flex",
    gap: "8px",
    overflowX: "auto",
    marginBottom: "12px",
  },
  segmentActive: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "34px",
    padding: "0 14px",
    borderRadius: "999px",
    background: "#6b5746",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  segmentButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "34px",
    padding: "0 14px",
    border: "1px solid #eadfd2",
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.72)",
    color: "#6f6257",
    fontSize: "13px",
    fontWeight: 800,
    textDecoration: "none",
    whiteSpace: "nowrap",
  },
  summaryCard: {
    padding: "17px 16px",
    border: "1px solid #eadfd2",
    borderRadius: "22px",
    background: "#fffdfa",
    marginBottom: "10px",
  },
  card: {
    padding: "16px",
    border: "1px solid #eadfd2",
    borderRadius: "22px",
    background: "#fffdfa",
    marginBottom: "10px",
  },
  cardHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "8px",
  },
  cardTitle: {
    margin: 0,
    color: "#27272a",
    fontSize: "16px",
    fontWeight: 900,
    letterSpacing: 0,
  },
  dateRange: {
    color: "#a08a75",
    fontSize: "12px",
    fontWeight: 800,
    whiteSpace: "nowrap",
  },
  summaryText: {
    margin: 0,
    color: "#3f3f46",
    fontSize: "19px",
    fontWeight: 900,
    lineHeight: 1.55,
    letterSpacing: 0,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
    marginBottom: "10px",
  },
  statCard: {
    minWidth: 0,
    padding: "12px 10px",
    border: "1px solid #eadfd2",
    borderRadius: "18px",
    background: "rgba(255, 253, 249, 0.92)",
  },
  statLabel: {
    margin: 0,
    color: "#7a6a5d",
    fontSize: "11px",
    fontWeight: 800,
    lineHeight: 1.35,
  },
  statValue: {
    margin: "8px 0 2px",
    color: "#7b5fbd",
    fontSize: "22px",
    fontWeight: 900,
    lineHeight: 1,
  },
  statSubText: {
    margin: 0,
    color: "#8d8177",
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: 1.35,
  },
  bodyText: {
    margin: "8px 0 0",
    color: "#3f3f46",
    fontSize: "15px",
    fontWeight: 800,
    lineHeight: 1.6,
  },
  subtleText: {
    margin: "6px 0 0",
    color: "#8d8177",
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1.55,
  },
  relationshipCard: {
    display: "grid",
    gridTemplateColumns: "92px 1fr",
    gap: "14px",
    alignItems: "center",
    padding: "16px",
    border: "1px solid #eadfd2",
    borderRadius: "22px",
    background: "#fffdfa",
    marginBottom: "10px",
  },
  scoreRing: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "86px",
    height: "78px",
    borderRadius: "46% 46% 50% 50%",
    background:
      "radial-gradient(circle at 50% 48%, #fffdfa 47%, transparent 48%), conic-gradient(#f29a83 0deg 285deg, #f1e4d8 285deg 360deg)",
  },
  scoreValue: {
    color: "#6b5746",
    fontSize: "25px",
    fontWeight: 950,
  },
  scoreTextBlock: {
    minWidth: 0,
  },
  scoreLabel: {
    margin: "0 0 5px",
    color: "#7a6a5d",
    fontSize: "12px",
    fontWeight: 800,
  },
  scoreTitle: {
    margin: 0,
    color: "#3f3f46",
    fontSize: "17px",
    fontWeight: 900,
    lineHeight: 1.45,
  },
  messageCard: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: "12px",
    alignItems: "center",
    padding: "16px",
    border: "1px solid #eadfd2",
    borderRadius: "22px",
    background: "#fff8ef",
    marginBottom: "10px",
  },
  messageText: {
    margin: "8px 0 0",
    color: "#4b4038",
    fontSize: "14px",
    fontWeight: 800,
    lineHeight: 1.65,
  },
  messageAvatar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "68px",
    height: "68px",
    border: "1px solid #eadfd2",
    borderRadius: "22px",
    background: "#fffdfa",
  },
  messageAvatarImage: {
    width: "54px",
    height: "54px",
    objectFit: "contain",
  },
  emptyHintCard: {
    padding: "16px",
    border: "1px solid #eadfd2",
    borderRadius: "22px",
    background: "#fffdfa",
    marginBottom: "10px",
  },
  secondaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "40px",
    marginTop: "12px",
    padding: "0 14px",
    border: "1px solid #dbcbbd",
    borderRadius: "999px",
    color: "#5f4d3f",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: 850,
  },
  badgeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "8px",
  },
  badge: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    minHeight: "82px",
    padding: "10px 6px",
    border: "1px solid #efd7a6",
    borderRadius: "18px",
    background: "#fff8e7",
    color: "#5f4d3f",
  },
  badgeLocked: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    minHeight: "82px",
    padding: "10px 6px",
    border: "1px solid #eee7df",
    borderRadius: "18px",
    background: "#faf7f2",
    color: "#b4aaa1",
  },
  badgeIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.78)",
    fontSize: "17px",
    fontWeight: 900,
  },
  badgeLabel: {
    color: "inherit",
    fontSize: "11px",
    fontWeight: 900,
    textAlign: "center",
    lineHeight: 1.2,
  },
  badgeText: {
    color: "inherit",
    fontSize: "10px",
    fontWeight: 700,
    textAlign: "center",
    lineHeight: 1.2,
  },
  emptyCard: {
    padding: "24px 18px",
    border: "1px solid #eadfd2",
    borderRadius: "26px",
    background: "#fffdfa",
  },
  emptyTitle: {
    margin: 0,
    color: "#27272a",
    fontSize: "22px",
    fontWeight: 900,
    lineHeight: 1.35,
  },
  emptyText: {
    margin: "10px 0 0",
    color: "#6f6257",
    fontSize: "14px",
    lineHeight: 1.7,
  },
  primaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "44px",
    marginTop: "16px",
    padding: "0 18px",
    borderRadius: "999px",
    background: "#6b5746",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 900,
  },
} satisfies Record<string, CSSProperties>;
