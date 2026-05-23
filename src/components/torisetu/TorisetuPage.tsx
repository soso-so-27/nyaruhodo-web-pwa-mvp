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

type KnownFact = {
  id: string;
  label: string;
  value: string;
  source: string;
  detail?: string;
};

type DiagnosisItem = {
  card: DeepDiveCard;
  status: "completed" | "ready" | "locked";
  meta: string;
  body: string;
  remaining: number;
  progress: number;
  answer?: DeepDiveAnswer;
};

type DeepDiveOption = {
  label: string;
  result: string;
};

type DeepDiveCard = {
  id: string;
  title: string;
  threshold: number;
  questionCount: number;
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

type CategoryIconName = "sparkles" | "clipboard" | "lock" | "paw";

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
    title: "ごきげん",
    threshold: 8,
    questionCount: 30,
    preview: "表情・距離感・しっぽなどから、機嫌のサインを整理する診断です。",
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
    title: "遊び",
    threshold: 15,
    questionCount: 30,
    preview: "好きな誘い方、乗りやすい時間、飽きやすさを探る診断です。",
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
    title: "ごはん",
    threshold: 20,
    questionCount: 30,
    preview: "ごはん前後の変化や、食への関心の強さを整理する診断です。",
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
    title: "苦手",
    threshold: 25,
    questionCount: 30,
    preview: "不安なときに出やすい行動や、環境変化への反応を見る診断です。",
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
    title: "距離",
    threshold: 30,
    questionCount: 30,
    preview: "触る・待つ・声をかけるなど、距離の取り方を探る診断です。",
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
  const [activeFact, setActiveFact] = useState<KnownFact | null>(null);

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
  const dayMap = buildDayMap(records);
  const rhythmSummary = buildRhythmSummary(dayMap, catProfile);
  const recentSummary = buildRecentSummary(records);
  const avatarSrc =
    catProfile?.avatarDataUrl ??
    catProfile?.homePhotoDataUrl ??
    getCatAvatarSrcForCoat(catProfile?.appearance?.coat);
  const typeLabel = catProfile?.typeLabel ?? "タイプ未診断";
  const shouldShowTypeBadge = Boolean(catProfile?.typeLabel);

  const answeredDeepDives = DEEP_DIVE_CARDS.map((card) => answers[card.id]).filter(
    Boolean,
  );
  const hasRhythmSignal = dayMap.some((item) => item.signal);
  const peakTime = catProfile?.activityPattern?.peakTime;
  const peakSlots = peakTime ? peakTimeMap[peakTime] ?? [] : [];
  const diagnosisFacts: KnownFact[] = [
    {
      id: "type",
      label: "タイプ診断",
      value: typeLabel,
      source: "オンボーディング結果",
      detail:
        catProfile?.typeTagline ??
        "最初のタイプ診断で見えている、この子の入り口です。",
    },
    ...answeredDeepDives.map((answer) => ({
      id: `diagnosis-${answer.cardId}`,
      label: answer.label,
      value: compactText(answer.result, 42),
      source: "診断結果",
      detail: answer.result,
    })),
    ...(!hasRhythmSignal && peakSlots.length > 0
      ? [
          {
            id: "diagnosis-rhythm",
            label: "リズム",
            value: rhythmSummary,
            source: "オンボーディング結果",
            detail:
              "オンボーディングで答えた時間帯から見えた傾向です。みっけが増えると、実際の記録から見えるリズムに置き換わっていきます。",
          },
        ]
      : []),
  ];
  const mikkeFacts: KnownFact[] = [
    {
      id: "recent",
      label: "最近",
      value: recentSummary,
      source: records.length > 0 ? `${recordCount}件のみっけから` : "みっけ待ち",
    },
    ...(hasRhythmSignal || peakSlots.length === 0
      ? [
          {
            id: "rhythm",
            label: "リズム",
            value: rhythmSummary,
            source: hasRhythmSignal ? "時間帯のみっけから" : "みっけ待ち",
          },
        ]
      : []),
  ];
  const knownFacts = [...mikkeFacts, ...diagnosisFacts];
  const diagnosisItems: DiagnosisItem[] = DEEP_DIVE_CARDS.map((card) => {
    const answer = answers[card.id];
    const remaining = Math.max(0, card.threshold - recordCount);
    const status = answer ? "completed" : remaining === 0 ? "ready" : "locked";

    return {
      card,
      status,
      answer,
      remaining,
      progress: Math.min(100, Math.round((recordCount / card.threshold) * 100)),
      meta: answer ? "結果" : status === "ready" ? "できます" : `あと${remaining}回`,
      body: answer?.result ?? card.preview,
    };
  });
  const readyDiagnoses = diagnosisItems.filter((item) => item.status === "ready");
  const lockedDiagnoses = diagnosisItems.filter((item) => item.status === "locked");
  const readyDiagnosis = readyDiagnoses[0] ?? null;
  const nextDiagnosis = readyDiagnosis ?? lockedDiagnoses[0] ?? null;
  const dashboardItems = [
    {
      label: "みっけ",
      value: String(recordCount),
      note: "手がかり",
    },
    {
      label: "トリセツ",
      value: String(diagnosisFacts.length),
      note: "読める",
    },
    {
      label: "診断",
      value: readyDiagnosis ? "開く" : nextDiagnosis ? `あと${nextDiagnosis.remaining}` : "完了",
      note: readyDiagnosis?.card.title ?? nextDiagnosis?.card.title ?? "深掘り",
    },
  ];

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
        <header style={styles.libraryHeader}>
          <div style={styles.headerAvatar}>
            <img src={avatarSrc} alt="" style={styles.headerAvatarImg} />
          </div>
          <div style={styles.headerText}>
            <p style={styles.eyebrow}>CAT GUIDE</p>
            <h1 style={styles.title}>{catName}のトリセツ</h1>
            <p style={styles.headerLead}>みっけで少しずつ増えます。</p>
          </div>
        </header>

        <section style={styles.libraryHero}>
          <div style={styles.libraryHeroTop}>
            <span style={styles.libraryHeroLabel}>トリセツ</span>
            {shouldShowTypeBadge ? (
              <span style={styles.headerBadge}>{typeLabel}</span>
            ) : null}
          </div>
          <p style={styles.libraryHeroMain}>
            {readyDiagnosis
              ? `${readyDiagnosis.card.title}を答えられます。`
              : nextDiagnosis
                ? `${nextDiagnosis.card.title}まであと${nextDiagnosis.remaining}回`
                : "見返せる手がかりがここにたまります。"}
          </p>
          <div style={styles.libraryDashboard}>
            {dashboardItems.map((item) => (
              <div key={item.label} style={styles.libraryDashboardItem}>
                <span style={styles.libraryDashboardLabel}>{item.label}</span>
                <strong style={styles.libraryDashboardValue}>{item.value}</strong>
                <span style={styles.libraryDashboardNote}>{item.note}</span>
              </div>
            ))}
          </div>
          {!readyDiagnosis && nextDiagnosis ? (
            <a href="/home" style={styles.heroActionLink}>
              今日のみっけを残す
            </a>
          ) : null}
        </section>

        <section style={{ ...styles.sectionFrame, ...styles.sectionFrameKnowledge }}>
          <CategoryLabel
            icon="sparkles"
            label="見返す"
            description="みっけと診断でわかったこと"
          />
          <div style={styles.factGroups}>
            <FactGroup icon="paw" label="みっけから" facts={mikkeFacts} />
            <FactCardShelf
              icon="clipboard"
              label="トリセツ"
              facts={diagnosisFacts}
              onOpenFact={setActiveFact}
            />
          </div>
        </section>

        <section style={{ ...styles.sectionFrame, ...styles.sectionFrameAction }}>
          <CategoryLabel
            icon="clipboard"
            label="答える"
            description="開いた診断でさらに深掘り"
          />
          {readyDiagnoses.length > 0 ? (
            <div style={styles.diagnosisList}>
              {readyDiagnoses.map((item) => (
                <DiagnosisCard
                  key={item.card.id}
                  item={item}
                  onStart={() => setActiveDive(item.card)}
                />
              ))}
            </div>
          ) : (
            <div style={styles.emptyStateCard}>
              <span style={styles.emptyStateText}>
                みっけが増えると開きます。
              </span>
            </div>
          )}
        </section>

        {lockedDiagnoses.length > 0 ? (
          <section style={{ ...styles.sectionFrame, ...styles.sectionFrameLocked }}>
            <CategoryLabel
              icon="lock"
              label="これから開く"
              description="みっけが増えると順番に増えます"
            />
            <div style={styles.diagnosisShelf}>
              {lockedDiagnoses.map((item) => (
                <button
                  key={item.card.id}
                  type="button"
                  style={styles.diagnosisShelfCard}
                  disabled
                >
                  <span style={styles.diagnosisShelfTitle}>{item.card.title}</span>
                  <span style={styles.diagnosisShelfMeta}>
                    あと{item.remaining}回
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

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
                <p style={styles.sheetKicker}>診断</p>
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

      {activeFact ? (
        <div style={styles.sheetLayer}>
          <button
            type="button"
            aria-label="閉じる"
            style={styles.sheetOverlay}
            onClick={() => setActiveFact(null)}
          />
          <section style={styles.sheet}>
            <div style={styles.sheetHandle} />
            <div style={styles.sheetHeader}>
              <div>
                <p style={styles.sheetKicker}>{activeFact.source}</p>
                <h2 style={styles.sheetTitle}>{activeFact.label}</h2>
              </div>
              <button
                type="button"
                aria-label="閉じる"
                style={styles.sheetClose}
                onClick={() => setActiveFact(null)}
              >
                ×
              </button>
            </div>
            <p style={styles.resultValue}>{activeFact.value}</p>
            {activeFact.detail ? (
              <p style={styles.resultDetail}>{activeFact.detail}</p>
            ) : null}
          </section>
        </div>
      ) : null}

      <BottomNavigation active="torisetu" />
    </main>
  );
}

function DiagnosisCard({
  item,
  onStart,
}: {
  item: DiagnosisItem;
  onStart: () => void;
}) {
  return (
    <article style={{ ...styles.diagnosisCard, ...styles.diagnosisCardReady }}>
      <div style={styles.diagnosisBodyRow}>
        <div style={styles.diagnosisText}>
          <h3 style={styles.diagnosisTitle}>{item.card.title}</h3>
        </div>
        <button type="button" style={styles.diagnosisAction} onClick={onStart}>
          はじめる
        </button>
      </div>
    </article>
  );
}

function FactGroup({
  icon,
  label,
  facts,
  onOpenFact,
}: {
  icon: CategoryIconName;
  label: string;
  facts: KnownFact[];
  onOpenFact?: (fact: KnownFact) => void;
}) {
  return (
    <div style={styles.factGroup}>
      <div style={styles.factGroupHeader}>
        <div style={styles.factGroupHeading}>
          <span style={styles.factGroupIcon} aria-hidden="true">
            <CategoryIcon name={icon} />
          </span>
          <span style={styles.factGroupLabel}>{label}</span>
        </div>
      </div>
      <div style={styles.factCard}>
        {facts.map((fact, index) => {
          const isOpenable = Boolean(onOpenFact && fact.detail);
          const rowStyle =
            index === facts.length - 1
              ? { ...styles.factRow, borderBottom: "none" }
              : styles.factRow;

          return (
            <button
              key={fact.id}
              type="button"
              style={
                isOpenable
                  ? { ...rowStyle, ...styles.factRowButton }
                  : { ...rowStyle, cursor: "default" }
              }
              onClick={isOpenable ? () => onOpenFact?.(fact) : undefined}
              disabled={!isOpenable}
            >
            <span style={styles.factLabel}>{fact.label}</span>
            <div style={styles.factText}>
              <strong style={styles.factValue}>{fact.value}</strong>
              {isOpenable ? (
                <span style={styles.factChevron} aria-hidden="true">
                  ›
                </span>
              ) : null}
            </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FactCardShelf({
  icon,
  label,
  facts,
  onOpenFact,
}: {
  icon: CategoryIconName;
  label: string;
  facts: KnownFact[];
  onOpenFact: (fact: KnownFact) => void;
}) {
  return (
    <div style={styles.factGroup}>
      <div style={styles.factGroupHeader}>
        <div style={styles.factGroupHeading}>
          <span style={styles.factGroupIcon} aria-hidden="true">
            <CategoryIcon name={icon} />
          </span>
          <span style={styles.factGroupLabel}>{label}</span>
        </div>
      </div>
      <div style={styles.torisetuCardRail}>
        {facts.map((fact, index) => (
          <button
            key={fact.id}
            type="button"
            style={{
              ...styles.torisetuFactCard,
              ...(index === 0 ? styles.torisetuFactCardPrimary : {}),
            }}
            onClick={() => onOpenFact(fact)}
          >
            <span style={styles.torisetuFactTop}>
              <span style={styles.torisetuFactIcon} aria-hidden="true">
                <CategoryIcon name={icon} />
              </span>
              <span style={styles.torisetuFactChevron} aria-hidden="true">
                ›
              </span>
            </span>
            <span style={styles.torisetuFactLabel}>{fact.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CategoryLabel({
  icon,
  label,
  description,
}: {
  icon: CategoryIconName;
  label: string;
  description?: string;
}) {
  return (
    <div style={styles.categoryHeader}>
      <span style={styles.categoryIconWrap} aria-hidden="true">
        <CategoryIcon name={icon} />
      </span>
      <div style={styles.categoryText}>
        <h2 style={styles.categoryLabel}>{label}</h2>
        {description ? (
          <p style={styles.categoryDescription}>{description}</p>
        ) : null}
      </div>
    </div>
  );
}

function CategoryIcon({ name }: { name: CategoryIconName }) {
  if (name === "paw") {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
        <path
          d="M12 13.2c3 0 5.2 2.1 5.2 4.4 0 1.7-1.2 2.9-2.9 2.9-.8 0-1.5-.3-2.3-.3s-1.5.3-2.3.3c-1.7 0-2.9-1.2-2.9-2.9 0-2.3 2.2-4.4 5.2-4.4Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M6.8 11.2c1 0 1.8-1 1.8-2.2S7.8 6.8 6.8 6.8 5 7.8 5 9s.8 2.2 1.8 2.2ZM10.3 8.8c1 0 1.8-1.1 1.8-2.4S11.3 4 10.3 4 8.5 5.1 8.5 6.4s.8 2.4 1.8 2.4ZM13.7 8.8c1 0 1.8-1.1 1.8-2.4S14.7 4 13.7 4s-1.8 1.1-1.8 2.4.8 2.4 1.8 2.4ZM17.2 11.2c1 0 1.8-1 1.8-2.2s-.8-2.2-1.8-2.2-1.8 1-1.8 2.2.8 2.2 1.8 2.2Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (name === "clipboard") {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
        <path
          d="M9 5h6M9 11h6M9 15h4M8 3.5h8l1 2H7l1-2Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7 5.5H5.8A1.8 1.8 0 0 0 4 7.3v11.4a1.8 1.8 0 0 0 1.8 1.8h12.4a1.8 1.8 0 0 0 1.8-1.8V7.3a1.8 1.8 0 0 0-1.8-1.8H17"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (name === "lock") {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
        <path
          d="M7 10V8.3a5 5 0 0 1 9.4-2.4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M6.5 10h11A2.5 2.5 0 0 1 20 12.5v5A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-5A2.5 2.5 0 0 1 6.5 10Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M12 14v2"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
      <path
        d="M12 3.5 13.8 8l4.7 1.8-4.7 1.8L12 16l-1.8-4.4-4.7-1.8L10.2 8 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m18 15 .8 2 .2.2 2 .8-2 .8-.2.2-.8 2-.8-2-.2-.2-2-.8 2-.8.2-.2.8-2ZM5 14l.5 1.2 1.2.5-1.2.5L5 17.5l-.5-1.3-1.2-.5 1.2-.5L5 14Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
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
  libraryHeader: {
    display: "flex",
    alignItems: "center",
    gap: "11px",
    padding: "6px 0 16px",
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
    fontWeight: 540,
    padding: "3px 9px",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  },
  eyebrow: {
    margin: "0 0 4px",
    color: TORISETU_MUTED,
    fontSize: "11px",
    fontWeight: 540,
    letterSpacing: "0.04em",
  },
  title: {
    fontSize: "22px",
    fontWeight: 620,
    color: TORISETU_TEXT_STRONG,
    margin: 0,
    lineHeight: 1.28,
  },
  headerLead: {
    margin: "4px 0 0",
    color: TORISETU_MUTED,
    fontSize: "12px",
    fontWeight: 520,
    lineHeight: 1.5,
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
  libraryHero: {
    ...TORISETU_SURFACE,
    borderRadius: "24px",
    padding: "14px",
    marginBottom: "16px",
  },
  libraryHeroTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "12px",
  },
  libraryHeroLabel: {
    color: TORISETU_TEXT_STRONG,
    fontSize: "15px",
    fontWeight: 560,
    lineHeight: 1.4,
  },
  libraryHeroMain: {
    margin: "2px 0 0",
    color: TORISETU_TEXT_STRONG,
    fontSize: "17px",
    fontWeight: 590,
    lineHeight: 1.45,
  },
  libraryDashboard: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "7px",
    marginTop: "14px",
  },
  libraryDashboardItem: {
    borderRadius: "16px",
    background: "rgba(255,255,255,0.09)",
    border: "0.5px solid rgba(255,255,255,0.12)",
    padding: "9px 8px",
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
    minWidth: 0,
  },
  libraryDashboardLabel: {
    color: TORISETU_MUTED,
    fontSize: "10px",
    fontWeight: 500,
    lineHeight: 1.2,
  },
  libraryDashboardValue: {
    color: TORISETU_TEXT_STRONG,
    fontSize: "18px",
    fontWeight: 610,
    lineHeight: 1.15,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  libraryDashboardNote: {
    color: TORISETU_FAINT,
    fontSize: "10px",
    fontWeight: 500,
    lineHeight: 1.25,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  heroActionLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "34px",
    marginTop: "12px",
    borderRadius: "99px",
    background: "rgba(255,255,255,0.88)",
    color: "#2a2a28",
    fontSize: "12px",
    fontWeight: 560,
    textDecoration: "none",
    padding: "0 14px",
    boxShadow: "0 8px 18px rgba(0,0,0,0.12)",
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
    marginBottom: "22px",
  },
  sectionFrame: {
    position: "relative",
    borderRadius: "24px",
    padding: "14px",
    marginBottom: "18px",
    background: "rgba(255,255,255,0.075)",
    border: "0.5px solid rgba(255,255,255,0.13)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  sectionFrameKnowledge: {
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.11), rgba(255,255,255,0.055))",
    boxShadow:
      "inset 3px 0 0 rgba(255,255,255,0.24), inset 0 1px 0 rgba(255,255,255,0.08)",
  },
  sectionFrameAction: {
    background:
      "linear-gradient(135deg, rgba(255,219,165,0.15), rgba(255,255,255,0.055))",
    boxShadow:
      "inset 3px 0 0 rgba(255,214,150,0.38), inset 0 1px 0 rgba(255,255,255,0.08)",
  },
  sectionFrameLocked: {
    background:
      "linear-gradient(135deg, rgba(180,190,205,0.13), rgba(255,255,255,0.045))",
    boxShadow:
      "inset 3px 0 0 rgba(190,200,220,0.22), inset 0 1px 0 rgba(255,255,255,0.08)",
  },
  sectionHeader: {
    margin: "0 4px 8px",
  },
  sectionHeaderInline: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    margin: "0 4px 11px",
  },
  categoryHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: "9px",
    margin: "0 0 13px",
  },
  categoryText: {
    minWidth: 0,
    flex: 1,
  },
  categoryLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    margin: 0,
    color: TORISETU_TEXT_STRONG,
    fontSize: "15px",
    fontWeight: 600,
    lineHeight: 1.25,
    letterSpacing: "0.01em",
  },
  categoryDescription: {
    margin: "3px 0 0",
    color: TORISETU_FAINT,
    fontSize: "11px",
    fontWeight: 460,
    lineHeight: 1.45,
  },
  categoryIconWrap: {
    width: "26px",
    height: "26px",
    borderRadius: "10px",
    color: "rgba(255,255,255,0.9)",
    background: "rgba(255,255,255,0.08)",
    border: "0.5px solid rgba(255,255,255,0.10)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  categoryIcon: {
    width: "22px",
    height: "22px",
    borderRadius: "999px",
    color: "rgba(255,255,255,0.88)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
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
    fontSize: "16px",
    fontWeight: 660,
    lineHeight: 1.35,
  },
  sectionLead: {
    margin: "5px 0 0",
    color: TORISETU_MUTED,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.55,
  },
  sectionHeaderCompact: {
    margin: "0 4px 8px",
  },
  sectionTitleSmall: {
    margin: 0,
    color: TORISETU_MUTED,
    fontSize: "13px",
    fontWeight: 620,
    lineHeight: 1.35,
  },
  factGroups: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "14px",
  },
  factGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "9px",
  },
  factGroupHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    padding: "0 4px",
  },
  factGroupHeading: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    color: TORISETU_TEXT,
  },
  factGroupIcon: {
    width: "20px",
    height: "20px",
    color: "rgba(255,255,255,0.84)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  factGroupLabel: {
    color: TORISETU_TEXT,
    fontSize: "13px",
    fontWeight: 560,
    lineHeight: 1.3,
  },
  factCard: {
    ...TORISETU_SURFACE_SOFT,
    borderRadius: "20px",
    padding: "1px 13px",
  },
  factRow: {
    display: "grid",
    gridTemplateColumns: "62px 1fr",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    padding: "11px 0",
    border: "none",
    background: "transparent",
    borderBottom: "0.5px solid rgba(255,255,255,0.08)",
    textAlign: "left" as const,
  },
  factRowButton: {
    cursor: "pointer",
  },
  factLabel: {
    color: TORISETU_FAINT,
    fontSize: "12px",
    fontWeight: 470,
    lineHeight: 1.45,
  },
  factText: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "8px",
  },
  factValue: {
    color: TORISETU_TEXT_STRONG,
    fontSize: "14px",
    fontWeight: 560,
    lineHeight: 1.45,
    textAlign: "right" as const,
  },
  factSource: {
    color: TORISETU_MUTED,
    fontSize: "11px",
    fontWeight: 500,
    lineHeight: 1.45,
  },
  factChevron: {
    color: TORISETU_FAINT,
    fontSize: "18px",
    fontWeight: 500,
    lineHeight: 1,
    flexShrink: 0,
  },
  torisetuCardRail: {
    display: "flex",
    gap: "10px",
    margin: 0,
    padding: "0 16px 4px 0",
    overflowX: "auto" as const,
    scrollbarWidth: "none" as const,
    scrollSnapType: "x mandatory",
  },
  torisetuFactCard: {
    ...TORISETU_SURFACE_SOFT,
    width: "min(40vw, 156px)",
    minWidth: "min(40vw, 156px)",
    minHeight: "88px",
    flex: "0 0 auto",
    scrollSnapAlign: "start",
    borderRadius: "18px",
    padding: "13px",
    color: TORISETU_TEXT_STRONG,
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "8px",
    textAlign: "left" as const,
    cursor: "pointer",
  },
  torisetuFactCardPrimary: {
    background: "rgba(255,255,255,0.14)",
    border: "0.5px solid rgba(255,220,160,0.24)",
  },
  torisetuFactTop: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  torisetuFactIcon: {
    width: "28px",
    height: "28px",
    color: "rgba(255,255,255,0.88)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  torisetuFactChevron: {
    color: TORISETU_FAINT,
    fontSize: "18px",
    fontWeight: 500,
    lineHeight: 1,
    flexShrink: 0,
  },
  torisetuFactLabel: {
    color: TORISETU_TEXT_STRONG,
    fontSize: "16px",
    fontWeight: 590,
    lineHeight: 1.32,
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflowWrap: "anywhere",
  },
  diagnosisList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
  },
  emptyStateCard: {
    ...TORISETU_SURFACE_SOFT,
    borderRadius: "18px",
    padding: "13px 14px",
  },
  emptyStateText: {
    color: TORISETU_MUTED,
    fontSize: "13px",
    fontWeight: 460,
    lineHeight: 1.55,
  },
  diagnosisCard: {
    ...TORISETU_SURFACE_SOFT,
    borderRadius: "20px",
    padding: "12px 13px",
  },
  diagnosisCardReady: {
    background: "rgba(255,255,255,0.14)",
    border: "0.5px solid rgba(255,220,160,0.28)",
  },
  diagnosisCardLocked: {
    opacity: 0.72,
    background: "rgba(255,255,255,0.07)",
  },
  diagnosisTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "7px",
  },
  diagnosisBadgeDone: {
    color: "rgba(255,255,255,0.72)",
    border: "0.5px solid rgba(255,255,255,0.16)",
    borderRadius: "99px",
    padding: "2px 8px",
    fontSize: "11px",
    fontWeight: 520,
  },
  diagnosisBadgeReady: {
    color: "rgba(255,232,190,0.95)",
    border: "0.5px solid rgba(255,220,160,0.28)",
    borderRadius: "99px",
    padding: "2px 8px",
    fontSize: "11px",
    fontWeight: 560,
  },
  diagnosisBadgeLocked: {
    color: TORISETU_FAINT,
    border: "0.5px solid rgba(255,255,255,0.10)",
    borderRadius: "99px",
    padding: "2px 8px",
    fontSize: "11px",
    fontWeight: 520,
  },
  diagnosisBodyRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "14px",
  },
  diagnosisText: {
    minWidth: 0,
    flex: 1,
  },
  diagnosisTitle: {
    margin: 0,
    color: TORISETU_TEXT_STRONG,
    fontSize: "16px",
    fontWeight: 590,
    lineHeight: 1.38,
  },
  diagnosisBody: {
    margin: 0,
    color: TORISETU_MUTED,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.58,
  },
  diagnosisAction: {
    flexShrink: 0,
    minHeight: "36px",
    border: "none",
    borderRadius: "99px",
    background: "rgba(255,255,255,0.92)",
    color: "#2a2a28",
    fontSize: "12px",
    fontWeight: 560,
    padding: "0 14px",
    cursor: "pointer",
  },
  diagnosisProgressArea: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "center",
    gap: "10px",
    marginTop: "10px",
  },
  diagnosisShelf: {
    display: "flex",
    gap: "10px",
    margin: "0 -16px",
    padding: "0 16px 4px",
    overflowX: "auto" as const,
    scrollbarWidth: "none" as const,
    scrollSnapType: "x proximity",
  },
  diagnosisShelfCard: {
    ...TORISETU_SURFACE_SOFT,
    width: "min(45vw, 176px)",
    minHeight: "92px",
    flex: "0 0 auto",
    scrollSnapAlign: "start",
    borderRadius: "18px",
    padding: "13px",
    border: "0.5px solid rgba(255,255,255,0.13)",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "space-between",
    textAlign: "left" as const,
    cursor: "default",
  },
  diagnosisShelfTitle: {
    color: TORISETU_TEXT,
    fontSize: "13px",
    fontWeight: 540,
    lineHeight: 1.45,
  },
  diagnosisShelfMeta: {
    color: TORISETU_FAINT,
    fontSize: "11px",
    fontWeight: 540,
    lineHeight: 1.35,
  },
  diagnosisProgressTrack: {
    height: "3px",
    borderRadius: "99px",
    background: "rgba(255,255,255,0.13)",
    overflow: "hidden",
  },
  diagnosisProgressFill: {
    height: "100%",
    borderRadius: "99px",
    background: "rgba(255,232,190,0.82)",
    transition: "width 0.3s ease",
  },
  diagnosisProgressText: {
    color: TORISETU_MUTED,
    fontSize: "11px",
    fontWeight: 520,
    lineHeight: 1.3,
  },
  upcomingList: {
    ...TORISETU_SURFACE_SOFT,
    borderRadius: "18px",
    padding: "2px 14px",
  },
  upcomingRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "11px 0",
    borderBottom: "0.5px solid rgba(255,255,255,0.08)",
  },
  upcomingText: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column" as const,
    gap: "2px",
  },
  upcomingTitle: {
    minWidth: 0,
    color: TORISETU_TEXT,
    fontSize: "13px",
    fontWeight: 560,
    lineHeight: 1.45,
  },
  upcomingSub: {
    color: TORISETU_FAINT,
    fontSize: "11px",
    fontWeight: 500,
    lineHeight: 1.35,
  },
  upcomingMeta: {
    flexShrink: 0,
    color: TORISETU_FAINT,
    fontSize: "12px",
    fontWeight: 520,
    lineHeight: 1.45,
  },
  chapterList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "10px",
  },
  chapterCard: {
    ...TORISETU_SURFACE_SOFT,
    borderRadius: "20px",
    padding: "14px",
  },
  chapterCardReady: {
    background: "rgba(255,255,255,0.14)",
    border: "0.5px solid rgba(255,220,160,0.28)",
  },
  chapterCardLocked: {
    opacity: 0.74,
    background: "rgba(255,255,255,0.07)",
  },
  chapterCardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "9px",
  },
  chapterLabel: {
    color: TORISETU_MUTED,
    fontSize: "11px",
    fontWeight: 560,
    lineHeight: 1.3,
  },
  chapterStatusOpen: {
    color: "rgba(255,255,255,0.72)",
    border: "0.5px solid rgba(255,255,255,0.16)",
    borderRadius: "99px",
    padding: "2px 8px",
    fontSize: "11px",
    fontWeight: 520,
  },
  chapterStatusReady: {
    color: "rgba(255,232,190,0.95)",
    border: "0.5px solid rgba(255,220,160,0.28)",
    borderRadius: "99px",
    padding: "2px 8px",
    fontSize: "11px",
    fontWeight: 560,
  },
  chapterStatusLocked: {
    color: TORISETU_FAINT,
    border: "0.5px solid rgba(255,255,255,0.10)",
    borderRadius: "99px",
    padding: "2px 8px",
    fontSize: "11px",
    fontWeight: 520,
  },
  chapterBodyRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "14px",
  },
  chapterText: {
    minWidth: 0,
    flex: 1,
  },
  chapterTitle: {
    margin: "0 0 5px",
    color: TORISETU_TEXT_STRONG,
    fontSize: "17px",
    fontWeight: 650,
    lineHeight: 1.38,
  },
  chapterBody: {
    margin: 0,
    color: TORISETU_MUTED,
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.58,
  },
  chapterAction: {
    flexShrink: 0,
    minHeight: "36px",
    border: "none",
    borderRadius: "99px",
    background: "rgba(255,255,255,0.92)",
    color: "#2a2a28",
    fontSize: "12px",
    fontWeight: 620,
    padding: "0 14px",
    cursor: "pointer",
  },
  chapterRows: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0px",
    marginTop: "12px",
    borderTop: "0.5px solid rgba(255,255,255,0.10)",
  },
  chapterRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "8px 0",
    borderBottom: "0.5px solid rgba(255,255,255,0.08)",
  },
  chapterRowLabel: {
    color: TORISETU_FAINT,
    fontSize: "12px",
    fontWeight: 520,
    flexShrink: 0,
  },
  chapterRowValue: {
    color: TORISETU_TEXT,
    fontSize: "12px",
    fontWeight: 560,
    lineHeight: 1.45,
    textAlign: "right" as const,
  },
  knowledgeList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "9px",
  },
  knowledgeCard: {
    ...TORISETU_SURFACE_SOFT,
    borderRadius: "18px",
    padding: "14px",
  },
  knowledgeCardReady: {
    background: "rgba(255,255,255,0.14)",
    border: "0.5px solid rgba(255,220,160,0.28)",
  },
  knowledgeCardLocked: {
    opacity: 0.72,
    background: "rgba(255,255,255,0.07)",
  },
  knowledgeCardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "9px",
  },
  knowledgeLabel: {
    color: TORISETU_MUTED,
    fontSize: "11px",
    fontWeight: 560,
    lineHeight: 1.3,
  },
  knowledgeStatusOpen: {
    color: "rgba(255,255,255,0.72)",
    border: "0.5px solid rgba(255,255,255,0.16)",
    borderRadius: "99px",
    padding: "2px 8px",
    fontSize: "11px",
    fontWeight: 520,
  },
  knowledgeStatusReady: {
    color: "rgba(255,232,190,0.95)",
    border: "0.5px solid rgba(255,220,160,0.28)",
    borderRadius: "99px",
    padding: "2px 8px",
    fontSize: "11px",
    fontWeight: 560,
  },
  knowledgeStatusLocked: {
    color: TORISETU_FAINT,
    border: "0.5px solid rgba(255,255,255,0.10)",
    borderRadius: "99px",
    padding: "2px 8px",
    fontSize: "11px",
    fontWeight: 520,
  },
  knowledgeBodyRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "14px",
  },
  knowledgeText: {
    minWidth: 0,
    flex: 1,
  },
  knowledgeTitle: {
    margin: "0 0 5px",
    color: TORISETU_TEXT_STRONG,
    fontSize: "16px",
    fontWeight: 650,
    lineHeight: 1.38,
  },
  knowledgeBody: {
    margin: 0,
    color: TORISETU_MUTED,
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.58,
  },
  knowledgeAction: {
    flexShrink: 0,
    minHeight: "36px",
    border: "none",
    borderRadius: "99px",
    background: "rgba(255,255,255,0.92)",
    color: "#2a2a28",
    fontSize: "12px",
    fontWeight: 620,
    padding: "0 14px",
    cursor: "pointer",
  },
  noteShelf: {
    display: "flex",
    gap: "10px",
    margin: "0 -16px",
    padding: "0 16px 4px",
    overflowX: "auto" as const,
    scrollbarWidth: "none" as const,
    scrollSnapType: "x proximity",
  },
  noteCard: {
    ...TORISETU_SURFACE_SOFT,
    width: "min(50vw, 188px)",
    minHeight: "104px",
    flex: "0 0 auto",
    scrollSnapAlign: "start",
    borderRadius: "18px",
    padding: "14px",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "space-between",
  },
  noteTitle: {
    margin: "0 0 10px",
    color: TORISETU_MUTED,
    fontSize: "12px",
    fontWeight: 560,
    lineHeight: 1.35,
  },
  noteBody: {
    margin: 0,
    color: TORISETU_TEXT_STRONG,
    fontSize: "17px",
    fontWeight: 660,
    lineHeight: 1.38,
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
    fontWeight: 520,
    letterSpacing: "0.04em",
  },
  sheetTitle: {
    margin: 0,
    color: TORISETU_TEXT_STRONG,
    fontSize: "20px",
    fontWeight: 610,
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
    fontWeight: 540,
    lineHeight: 1.55,
  },
  resultValue: {
    margin: "0 0 10px",
    color: TORISETU_TEXT_STRONG,
    fontSize: "18px",
    fontWeight: 590,
    lineHeight: 1.45,
  },
  resultDetail: {
    margin: "0 0 8px",
    color: TORISETU_TEXT,
    fontSize: "14px",
    fontWeight: 520,
    lineHeight: 1.75,
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
    fontWeight: 540,
    cursor: "pointer",
    padding: "10px",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  },
} satisfies Record<string, CSSProperties>;
