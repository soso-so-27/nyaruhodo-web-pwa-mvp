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
  APP_ACCENT_SOFT_BG,
  APP_ACCENT_SOFT_BORDER,
  APP_SURFACE,
} from "../ui/appTheme";

const TORISETU_TEXT = "rgba(255,255,255,0.94)";
const TORISETU_TEXT_STRONG = "rgba(255,255,255,0.98)";
const TORISETU_MUTED = "rgba(255,255,255,0.62)";
const TORISETU_FAINT = "rgba(255,255,255,0.42)";
const TORISETU_SURFACE: CSSProperties = {
  position: "relative",
  background: "rgba(34,29,28,0.58)",
  backdropFilter: "blur(28px)",
  WebkitBackdropFilter: "blur(28px)",
  border: "0.5px solid rgba(255,255,255,0.18)",
  boxShadow: [
    "0 14px 34px rgba(0,0,0,0.22)",
    "inset 0 1px 0 rgba(255,255,255,0.16)",
  ].join(", "),
};
const TORISETU_SURFACE_SOFT: CSSProperties = {
  ...TORISETU_SURFACE,
  background: "rgba(255,255,255,0.10)",
  boxShadow: [
    "0 10px 24px rgba(0,0,0,0.18)",
    "inset 0 1px 0 rgba(255,255,255,0.12)",
  ].join(", "),
};

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

type InsightCard = {
  id: string;
  title: string;
  body: string;
  tags?: string[];
};

type DeepDiveOption = {
  label: string;
  result: string;
};

type DeepDiveCard = {
  id: string;
  title: string;
  threshold: number;
  preview: string;
  question: string;
  options: DeepDiveOption[];
};

type DeepDiveAnswer = {
  cardId: string;
  label: string;
  result: string;
  answeredAt: string;
};

const RECENT_CAT_SUMMARY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const peakTimeMap: Record<string, string[]> = {
  morning: ["朝"],
  afternoon: ["昼"],
  evening: ["夕", "夜"],
  night: ["夜"],
  random: [],
};

const DEEP_DIVE_CARDS: DeepDiveCard[] = [
  {
    id: "mood",
    title: "機嫌の見分け方",
    threshold: 8,
    preview: "いつもの表情や距離感を、もう少し詳しく残せます。",
    question: "機嫌がよさそうなとき、いちばん多いサインは？",
    options: [
      { label: "目がやわらかい", result: "機嫌がいいときは、目つきや表情に出やすいかもしれません。" },
      { label: "近くに来る", result: "機嫌がいいときは、距離が少し近くなるタイプかもしれません。" },
      { label: "しっぽがゆっくり動く", result: "しっぽの動きが、気分を見る手がかりになりそうです。" },
      { label: "まだわからない", result: "まだ決めなくて大丈夫。みっけを重ねると見えてきます。" },
    ],
  },
  {
    id: "play",
    title: "遊び方のコツ",
    threshold: 15,
    preview: "喜びやすい誘い方や、乗りやすいタイミングを探せます。",
    question: "遊びに誘うなら、どれが一番反応しやすい？",
    options: [
      { label: "動くおもちゃ", result: "動きのある遊びに反応しやすい子かもしれません。" },
      { label: "隠れる遊び", result: "待ち伏せや物陰を使った遊びが合いやすそうです。" },
      { label: "短く何回か", result: "長時間より、短い遊びを何度か挟む方が合いそうです。" },
      { label: "気分次第", result: "遊びは気分の波を見ながら誘うのがよさそうです。" },
    ],
  },
  {
    id: "food",
    title: "ごはんのこと",
    threshold: 20,
    preview: "ごはん前後の変化や、気にしやすさを整理できます。",
    question: "ごはんの時間が近いとき、どんな様子が多い？",
    options: [
      { label: "先に待っている", result: "ごはんの時間をかなり覚えている子かもしれません。" },
      { label: "鳴いて知らせる", result: "声で伝えることが、ごはん前のサインになりそうです。" },
      { label: "近くを歩く", result: "そばに来ることが、ごはん待ちのサインかもしれません。" },
      { label: "あまり変わらない", result: "ごはんより、その時の気分や環境の影響が大きそうです。" },
    ],
  },
  {
    id: "stress",
    title: "ストレスのサイン",
    threshold: 25,
    preview: "不安なときに出やすい変化を、やさしく見分けます。",
    question: "落ち着かなさそうなとき、先に出やすい変化は？",
    options: [
      { label: "隠れる", result: "不安なときは、まず距離を取るサインが出やすそうです。" },
      { label: "鳴く", result: "声が、不安や戸惑いのサインになることがありそうです。" },
      { label: "うろうろする", result: "落ち着かない動きが、環境変化への反応かもしれません。" },
      { label: "まだわからない", result: "焦らず、いつもと違う小さな変化だけ見ていきましょう。" },
    ],
  },
  {
    id: "bond",
    title: "距離の縮め方",
    threshold: 30,
    preview: "近づきたいとき、待つときの境目を探せます。",
    question: "こちらから近づくなら、どれが一番うまくいきやすい？",
    options: [
      { label: "声をかける", result: "先に声をかけると、安心して受け入れやすいかもしれません。" },
      { label: "手を出して待つ", result: "この子から近づく余白を残すと、距離が縮まりやすそうです。" },
      { label: "そばに座る", result: "触るより先に、同じ場所にいる時間が効きそうです。" },
      { label: "放っておく", result: "構わない時間も、信頼を育てる大事な関わりになりそうです。" },
    ],
  },
];

export function TorisetuPage({ recentEvents }: TorisetuPageProps) {
  const [catProfile, setCatProfile] = useState<CatProfile | null>(null);
  const [localRecords, setLocalRecords] = useState<RecordLike[]>([]);
  const [answers, setAnswers] = useState<Record<string, DeepDiveAnswer>>({});
  const [activeDive, setActiveDive] = useState<DeepDiveCard | null>(null);

  useEffect(() => {
    const profiles = loadCatProfiles();
    const active = getActiveCatProfile(profiles);
    setCatProfile(active ?? null);
    setLocalRecords(active ? readLocalRecordLog(active.id) : []);
    setAnswers(active ? readDeepDiveAnswers(active.id) : {});
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
  const dayMap = buildDayMap(records);
  const rhythmSummary = buildRhythmSummary(dayMap, catProfile);
  const recentSummary = buildRecentSummary(records);
  const avatarSrc =
    catProfile?.avatarDataUrl ??
    catProfile?.homePhotoDataUrl ??
    getCatAvatarSrcForCoat(catProfile?.appearance?.coat);
  const typeLabel = catProfile?.typeLabel ?? "観察中";

  const insightCards: InsightCard[] = [
    {
      id: "personality",
      title: "基本の性格",
      body: catProfile?.typeLabel ?? "観察中",
    },
    {
      id: "recent",
      title: "最近",
      body: recentSummary,
    },
    {
      id: "rhythm",
      title: "リズム",
      body: rhythmSummary,
    },
    ...Object.values(answers).map((answer) => ({
      id: `answer-${answer.cardId}`,
      title: answer.label,
      body: compactText(answer.result, 24),
    })),
  ];
  const answeredCount = Object.keys(answers).length;
  const actionableDive =
    DEEP_DIVE_CARDS.find(
      (card) => recordCount >= card.threshold && !answers[card.id],
    ) ?? null;
  const nextLockedDive =
    DEEP_DIVE_CARDS.find(
      (card) => recordCount < card.threshold && !answers[card.id],
    ) ?? null;
  const nextRemaining = nextLockedDive
    ? Math.max(0, nextLockedDive.threshold - recordCount)
    : 0;

  function handleAnswer(option: DeepDiveOption) {
    if (!catProfile || !activeDive) return;

    const nextAnswers = {
      ...answers,
      [activeDive.id]: {
        cardId: activeDive.id,
        label: activeDive.title,
        result: option.result,
        answeredAt: new Date().toISOString(),
      },
    };

    setAnswers(nextAnswers);
    saveDeepDiveAnswers(catProfile.id, nextAnswers);
    setActiveDive(null);
  }

  return (
    <main style={styles.page}>
      <div style={styles.ambientBackground} aria-hidden="true" />
      <div style={styles.ambientBackgroundAfter} aria-hidden="true" />
      <div style={styles.backgroundVeil} aria-hidden="true" />
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.headerAvatar}>
            <img src={avatarSrc} alt="" style={styles.headerAvatarImg} />
          </div>
          <div style={styles.headerText}>
            <p style={styles.eyebrow}>トリセツ</p>
            <h1 style={styles.title}>{catName}</h1>
          </div>
          <span style={styles.headerBadge}>{typeLabel}</span>
        </header>

        <section style={styles.progressCard}>
          <div style={styles.progressHeader}>
            <span style={styles.progressLabel}>トリセツ</span>
            <span style={styles.progressValue}>{understanding}%</span>
          </div>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${understanding}%` }} />
          </div>
          <div style={styles.progressMeta}>
            <span>見えてきたこと {insightCards.length}</span>
            <span>質問 {answeredCount}/{DEEP_DIVE_CARDS.length}</span>
          </div>
        </section>

        <section style={styles.nextCard}>
          <p style={styles.nextLabel}>次にできること</p>
          {actionableDive ? (
            <div style={styles.nextActionRow}>
              <div style={styles.nextActionText}>
                <h2 style={styles.nextTitle}>{actionableDive.title}</h2>
                <p style={styles.nextSub}>質問に答えると、トリセツに追加されます。</p>
              </div>
              <button
                type="button"
                style={styles.nextButton}
                onClick={() => setActiveDive(actionableDive)}
              >
                答える
              </button>
            </div>
          ) : nextLockedDive ? (
            <div style={styles.nextActionText}>
              <h2 style={styles.nextTitle}>{nextLockedDive.title}</h2>
              <p style={styles.nextSub}>あと{nextRemaining}回のみっけで開きます。</p>
            </div>
          ) : (
            <div style={styles.nextActionText}>
              <h2 style={styles.nextTitle}>いまは全部開いています</h2>
              <p style={styles.nextSub}>またみっけが増えたら、新しい見え方を足していきます。</p>
            </div>
          )}
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>見えてきたこと</h2>
          </div>

          <div style={styles.insightShelf}>
            {insightCards.map((card) => (
              <article key={card.id} style={styles.insightCard}>
                <h3 style={styles.insightTitle}>{card.title}</h3>
                <p style={styles.insightBody}>{card.body}</p>
                {card.tags?.length ? (
                  <div style={styles.tagRow}>
                    {card.tags.map((tag) => (
                      <span key={tag} style={styles.tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h2 style={styles.sectionTitle}>質問</h2>
          </div>

          <div style={styles.diveList}>
            {DEEP_DIVE_CARDS.map((card) => {
              const remaining = Math.max(0, card.threshold - recordCount);
              const answer = answers[card.id];
              const isUnlocked = remaining === 0;

              return (
                <article key={card.id} style={styles.questionRow}>
                  <div style={styles.questionMain}>
                    <span style={answer ? styles.diveStatusDone : styles.diveStatus}>
                      {answer ? "回答済み" : isUnlocked ? "開いた" : `あと${remaining}`}
                    </span>
                    <h3 style={styles.diveTitle}>{card.title}</h3>
                  </div>
                  <button
                    type="button"
                    disabled={!isUnlocked || Boolean(answer)}
                    onClick={() => setActiveDive(card)}
                    style={
                      answer
                        ? styles.questionButtonDone
                        : isUnlocked
                          ? styles.questionButton
                          : styles.questionButtonLocked
                    }
                    aria-label={`${card.title}に答える`}
                  >
                    {answer ? "✓" : isUnlocked ? "答える" : "－"}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <div style={{ height: "108px" }} />
      </div>

      {activeDive ? (
        <div style={styles.sheetLayer}>
          <button
            type="button"
            aria-label="閉じる"
            style={styles.sheetOverlay}
            onClick={() => setActiveDive(null)}
          />
          <section style={styles.sheet}>
            <div style={styles.sheetHandle} />
            <div style={styles.sheetHeader}>
              <div>
                <p style={styles.sheetKicker}>深掘り質問</p>
                <h2 style={styles.sheetTitle}>{activeDive.title}</h2>
              </div>
              <button
                type="button"
                aria-label="閉じる"
                style={styles.sheetClose}
                onClick={() => setActiveDive(null)}
              >
                ×
              </button>
            </div>
            <p style={styles.sheetQuestion}>{activeDive.question}</p>
            <div style={styles.sheetOptions}>
              {activeDive.options.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  style={styles.sheetOption}
                  onClick={() => handleAnswer(option)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}

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

function readDeepDiveAnswers(catId: string): Record<string, DeepDiveAnswer> {
  try {
    const raw = window.localStorage.getItem(`torisetu_check_answers_${catId}`);
    return raw ? (JSON.parse(raw) as Record<string, DeepDiveAnswer>) : {};
  } catch {
    return {};
  }
}

function saveDeepDiveAnswers(
  catId: string,
  answers: Record<string, DeepDiveAnswer>,
) {
  try {
    window.localStorage.setItem(
      `torisetu_check_answers_${catId}`,
      JSON.stringify(answers),
    );
  } catch {
    // localStorage保存失敗時はUIだけ更新する
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

function buildRhythmSummary(dayMap: DayMapItem[], catProfile: CatProfile | null) {
  const activeItems = dayMap.filter((item) => item.signal);

  if (activeItems.length > 0) {
    const first = activeItems[0];
    return `${first.period}に${getSignalDisplayLabel(first.signal ?? "")}`;
  }

  const peakTime = catProfile?.activityPattern?.peakTime;
  const peakSlots = peakTime ? peakTimeMap[peakTime] ?? [] : [];

  if (peakSlots.length > 0) {
    return `${peakSlots.join("・")}に動きやすい`;
  }

  return "まだ観察中";
}

function buildRecentSummary(records: RecordLike[]) {
  if (records.length === 0) {
    return "まだ観察中";
  }

  const representativeSignal = getRepresentativeSignal(records.slice(0, 12));

  if (representativeSignal) {
    return `${getSignalDisplayLabel(representativeSignal)}多め`;
  }

  if (records.length < 3) {
    return "少しずつ記録中";
  }

  return "いろいろ混ざる";
}

function compactText(text: string, maxLength: number) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
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

const styles = {
  page: {
    position: "relative",
    minHeight: "100vh",
    background: "#1a1a18",
    color: TORISETU_TEXT,
    overflowX: "hidden",
  },
  ambientBackground: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 0,
    background: [
      "radial-gradient(circle at 18% 12%, rgba(148,136,118,0.30) 0%, rgba(148,136,118,0.08) 22%, rgba(148,136,118,0) 45%)",
      "radial-gradient(circle at 82% 18%, rgba(192,132,80,0.24) 0%, rgba(192,132,80,0.08) 20%, rgba(192,132,80,0) 42%)",
      "radial-gradient(ellipse at 50% 82%, rgba(74,65,58,0.62) 0%, rgba(39,34,32,0.78) 48%, rgba(20,18,17,0.96) 100%)",
      "linear-gradient(145deg, #2f3438 0%, #5e514a 38%, #342c29 70%, #171615 100%)",
    ].join(", "),
  },
  ambientBackgroundAfter: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 0,
    pointerEvents: "none" as const,
    background:
      "linear-gradient(115deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 28%, rgba(255,210,150,0.07) 62%, rgba(255,255,255,0) 100%)",
  },
  backgroundVeil: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 1,
    pointerEvents: "none" as const,
    background: [
      "linear-gradient(to bottom, rgba(12,10,9,0.20) 0%, rgba(12,10,9,0.04) 34%, rgba(12,10,9,0.38) 100%)",
      "radial-gradient(circle at 72% 8%, rgba(255,200,130,0.18) 0%, rgba(255,200,130,0.05) 24%, rgba(255,200,130,0) 52%)",
      "radial-gradient(circle at 20% 86%, rgba(110,130,130,0.16) 0%, rgba(110,130,130,0) 42%)",
    ].join(", "),
  },
  container: {
    position: "relative",
    zIndex: 2,
    width: "min(100%, 430px)",
    margin: "0 auto",
    padding: "calc(env(safe-area-inset-top) + 14px) 16px 0",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "4px 0 14px",
  },
  headerAvatar: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    overflow: "hidden",
    flexShrink: 0,
    border: "2px solid rgba(255,255,255,0.5)",
    background: "rgba(255,255,255,0.12)",
    boxShadow: "0 10px 24px rgba(0,0,0,0.22)",
  },
  headerAvatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  headerText: {
    minWidth: 0,
    flex: 1,
  },
  headerBadge: {
    flexShrink: 0,
    borderRadius: "99px",
    border: "0.5px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.10)",
    color: TORISETU_TEXT,
    fontSize: "11px",
    fontWeight: 620,
    padding: "3px 9px",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  },
  eyebrow: {
    margin: "0 0 4px",
    color: TORISETU_MUTED,
    fontSize: "11px",
    fontWeight: 620,
    letterSpacing: "0.04em",
  },
  title: {
    fontSize: "22px",
    fontWeight: 680,
    color: TORISETU_TEXT_STRONG,
    margin: 0,
    lineHeight: 1.28,
  },
  subtitle: {
    fontSize: "13px",
    color: "#8f8b83",
    margin: 0,
    lineHeight: 1.55,
  },
  heroCard: {
    ...APP_SURFACE,
    display: "flex",
    alignItems: "center",
    gap: "14px",
    borderRadius: "22px",
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
    whiteSpace: "nowrap" as const,
    color: "#2a2a28",
    fontSize: "18px",
    fontWeight: 680,
  },
  heroBadge: {
    flexShrink: 0,
    borderRadius: "99px",
    border: `0.5px solid ${APP_ACCENT_SOFT_BORDER}`,
    background: APP_ACCENT_SOFT_BG,
    color: APP_ACCENT,
    fontSize: "11px",
    fontWeight: 600,
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
    ...TORISETU_SURFACE,
    borderRadius: "20px",
    padding: "12px 14px",
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
    color: TORISETU_MUTED,
    fontWeight: 600,
  },
  progressValue: {
    fontSize: "16px",
    color: TORISETU_TEXT_STRONG,
    fontWeight: 680,
  },
  progressTrack: {
    height: "4px",
    background: "rgba(255,255,255,0.16)",
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
    background: "rgba(255,255,255,0.86)",
    borderRadius: "99px",
    transition: "width 0.3s ease",
  },
  progressHint: {
    fontSize: "12px",
    color: APP_ACCENT,
    margin: 0,
    lineHeight: 1.5,
    fontWeight: 520,
  },
  progressMeta: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    color: TORISETU_MUTED,
    fontSize: "11px",
    fontWeight: 520,
    lineHeight: 1.4,
  },
  nextCard: {
    ...TORISETU_SURFACE,
    borderRadius: "20px",
    padding: "14px",
    marginBottom: "18px",
  },
  nextLabel: {
    color: TORISETU_MUTED,
    fontSize: "11px",
    fontWeight: 620,
    letterSpacing: "0.04em",
    margin: "0 0 8px",
  },
  nextActionRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  nextActionText: {
    minWidth: 0,
    flex: 1,
  },
  nextTitle: {
    margin: "0 0 4px",
    color: TORISETU_TEXT_STRONG,
    fontSize: "17px",
    fontWeight: 680,
    lineHeight: 1.35,
  },
  nextSub: {
    margin: 0,
    color: TORISETU_MUTED,
    fontSize: "13px",
    fontWeight: 560,
    lineHeight: 1.55,
  },
  nextButton: {
    flexShrink: 0,
    minHeight: "38px",
    border: "none",
    borderRadius: "99px",
    background: "rgba(255,255,255,0.92)",
    color: "#2a2a28",
    fontSize: "13px",
    fontWeight: 620,
    padding: "0 16px",
    cursor: "pointer",
  },
  section: {
    marginBottom: "18px",
  },
  sectionHeader: {
    margin: "0 4px 8px",
  },
  sectionKicker: {
    color: TORISETU_MUTED,
    fontSize: "11px",
    fontWeight: 620,
    letterSpacing: "0.04em",
    margin: "0 0 3px",
  },
  sectionTitle: {
    margin: 0,
    color: TORISETU_TEXT_STRONG,
    fontSize: "17px",
    fontWeight: 680,
    lineHeight: 1.35,
  },
  insightShelf: {
    display: "flex",
    gap: "10px",
    margin: "0 -16px",
    padding: "0 16px 4px",
    overflowX: "auto" as const,
    scrollbarWidth: "none" as const,
    scrollSnapType: "x proximity",
  },
  insightCard: {
    ...TORISETU_SURFACE_SOFT,
    width: "min(44vw, 178px)",
    minHeight: "118px",
    flex: "0 0 auto",
    scrollSnapAlign: "start",
    borderRadius: "18px",
    padding: "14px",
    display: "flex",
    flexDirection: "column" as const,
  },
  insightSource: {
    color: TORISETU_MUTED,
    fontSize: "11px",
    fontWeight: 620,
    letterSpacing: "0.04em",
    marginBottom: "10px",
  },
  insightTitle: {
    color: TORISETU_MUTED,
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: 1.35,
    margin: "0 0 8px",
  },
  insightBody: {
    color: TORISETU_TEXT_STRONG,
    fontSize: "18px",
    fontWeight: 680,
    lineHeight: 1.35,
    margin: 0,
  },
  tagRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "6px",
    marginTop: "auto",
    paddingTop: "12px",
  },
  tag: {
    background: "rgba(255,255,255,0.10)",
    border: "0.5px solid rgba(255,255,255,0.18)",
    borderRadius: "99px",
    color: TORISETU_TEXT,
    fontSize: "11px",
    fontWeight: 560,
    padding: "3px 9px",
  },
  diveList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  },
  questionRow: {
    ...TORISETU_SURFACE_SOFT,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    borderRadius: "16px",
    padding: "12px 12px 12px 14px",
  },
  questionMain: {
    minWidth: 0,
    flex: 1,
  },
  questionButton: {
    flexShrink: 0,
    minWidth: "58px",
    minHeight: "34px",
    border: "none",
    borderRadius: "99px",
    background: "rgba(255,255,255,0.92)",
    color: "#2a2a28",
    fontSize: "12px",
    fontWeight: 620,
    padding: "0 12px",
    cursor: "pointer",
  },
  questionButtonDone: {
    flexShrink: 0,
    width: "34px",
    height: "34px",
    border: "0.5px solid rgba(255,255,255,0.14)",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.10)",
    color: TORISETU_MUTED,
    fontSize: "14px",
    fontWeight: 620,
  },
  questionButtonLocked: {
    flexShrink: 0,
    width: "34px",
    height: "34px",
    border: "0.5px solid rgba(255,255,255,0.10)",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.06)",
    color: TORISETU_FAINT,
    fontSize: "14px",
    fontWeight: 600,
  },
  diveCard: {
    ...APP_SURFACE,
    borderRadius: "18px",
    padding: "13px 14px",
  },
  diveHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "4px",
  },
  diveTitleArea: {
    minWidth: 0,
  },
  diveStatus: {
    display: "inline-flex",
    color: TORISETU_TEXT,
    background: "rgba(255,255,255,0.10)",
    border: "0.5px solid rgba(255,255,255,0.16)",
    borderRadius: "99px",
    padding: "2px 8px",
    fontSize: "11px",
    fontWeight: 600,
    marginBottom: "6px",
  },
  diveStatusDone: {
    display: "inline-flex",
    color: TORISETU_MUTED,
    background: "rgba(255,255,255,0.08)",
    border: "0.5px solid rgba(255,255,255,0.12)",
    borderRadius: "99px",
    padding: "2px 8px",
    fontSize: "11px",
    fontWeight: 600,
    marginBottom: "6px",
  },
  diveTitle: {
    margin: 0,
    color: TORISETU_TEXT_STRONG,
    fontSize: "15px",
    fontWeight: 660,
    lineHeight: 1.38,
  },
  divePreview: {
    color: "#6a665e",
    fontSize: "13px",
    fontWeight: 560,
    lineHeight: 1.6,
    margin: 0,
  },
  diveButton: {
    flexShrink: 0,
    minHeight: "34px",
    border: "none",
    borderRadius: "99px",
    background: APP_ACCENT,
    color: "#fff",
    fontSize: "12px",
    fontWeight: 620,
    padding: "0 14px",
    cursor: "pointer",
  },
  diveButtonDone: {
    flexShrink: 0,
    minHeight: "34px",
    border: "0.5px solid rgba(210,207,200,0.9)",
    borderRadius: "99px",
    background: "rgba(245,242,235,0.9)",
    color: "#8f8b83",
    fontSize: "12px",
    fontWeight: 600,
    padding: "0 14px",
  },
  diveButtonLocked: {
    flexShrink: 0,
    minHeight: "34px",
    border: "0.5px solid rgba(210,207,200,0.9)",
    borderRadius: "99px",
    background: "rgba(255,255,255,0.72)",
    color: "#aaa59b",
    fontSize: "12px",
    fontWeight: 600,
    padding: "0 14px",
  },
  sheetLayer: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 80,
  },
  sheetOverlay: {
    position: "absolute" as const,
    inset: 0,
    border: "none",
    padding: 0,
    background: "rgba(12,10,9,0.42)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
  },
  sheet: {
    ...TORISETU_SURFACE,
    position: "absolute" as const,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: "24px 24px 0 0",
    padding: "0 18px calc(24px + env(safe-area-inset-bottom))",
    borderBottom: "none",
    color: TORISETU_TEXT,
    boxShadow:
      "0 -18px 48px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.16)",
  },
  sheetHandle: {
    width: "38px",
    height: "4px",
    borderRadius: "99px",
    background: "rgba(255,255,255,0.34)",
    margin: "10px auto 16px",
  },
  sheetHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "12px",
    marginBottom: "14px",
  },
  sheetKicker: {
    margin: "0 0 4px",
    color: TORISETU_MUTED,
    fontSize: "11px",
    fontWeight: 620,
    letterSpacing: "0.04em",
  },
  sheetTitle: {
    margin: 0,
    color: TORISETU_TEXT_STRONG,
    fontSize: "20px",
    fontWeight: 680,
  },
  sheetClose: {
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    border: "0.5px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.08)",
    color: TORISETU_MUTED,
    fontSize: "20px",
    cursor: "pointer",
  },
  sheetQuestion: {
    margin: "0 0 14px",
    color: TORISETU_TEXT,
    fontSize: "15px",
    fontWeight: 600,
    lineHeight: 1.55,
  },
  sheetOptions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },
  sheetOption: {
    minHeight: "54px",
    border: "0.5px solid rgba(255,255,255,0.16)",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.10)",
    color: TORISETU_TEXT_STRONG,
    fontSize: "14px",
    fontWeight: 620,
    cursor: "pointer",
    padding: "10px",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  },
} satisfies Record<string, CSSProperties>;
