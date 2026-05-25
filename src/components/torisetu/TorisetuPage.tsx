"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { loadCatProfiles, getActiveCatProfile } from "../../lib/catProfiles";
import { getCatTypeInfo } from "../../lib/diagnosisOnboarding/catTypes";
import {
  QUESTIONS,
  type AnswerOption,
} from "../../lib/diagnosisOnboarding/questions";
import {
  calcActivityPattern,
  calcAxisScores,
  determineType,
} from "../../lib/diagnosisOnboarding/scoring";
import {
  type TorisetuLockedDiagnosisCard,
} from "../../lib/torisetu/diagnosisCatalog";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import { getRecordLogKey } from "../../lib/storage";
import type { RecentEvent } from "../../lib/supabase/queries";
import {
  getCatAvatarSrcForCoat,
  getCatName,
  saveCatProfiles,
  type CatProfile,
} from "../../components/home/homeInputHelpers";
import { BottomNavigation } from "../navigation/BottomNavigation";
import { AppIcon, type AppIconName } from "../ui/AppIcons";
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
  card: TorisetuLockedDiagnosisCard;
  remaining: number;
  progress: number;
};

type LockedDiagnosisCard = TorisetuLockedDiagnosisCard;

type CategoryIconName = Extract<
  AppIconName,
  "sparkles" | "clipboard" | "lock" | "paw"
>;

const RECENT_CAT_SUMMARY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const peakTimeMap: Record<string, string[]> = {
  morning: ["朝"],
  afternoon: ["昼"],
  evening: ["夕", "夜"],
  night: ["夜"],
  random: [],
};

const LOCKED_DIAGNOSIS_SAMPLES: LockedDiagnosisCard[] = [
  {
    id: "mood",
    title: "ごきげん診断",
    threshold: 8,
  },
  {
    id: "play",
    title: "遊び診断",
    threshold: 15,
  },
  {
    id: "food",
    title: "ごはん診断",
    threshold: 20,
  },
  {
    id: "stress",
    title: "不安サイン診断",
    threshold: 25,
  },
  {
    id: "bond",
    title: "距離感診断",
    threshold: 30,
  },
];

export function TorisetuPage({ recentEvents }: TorisetuPageProps) {
  const [catProfile, setCatProfile] = useState<CatProfile | null>(null);
  const [localRecords, setLocalRecords] = useState<RecordLike[]>([]);
  const [activeFact, setActiveFact] = useState<KnownFact | null>(null);
  const [isTypeDiagnosisOpen, setIsTypeDiagnosisOpen] = useState(false);
  const [typeAnswers, setTypeAnswers] = useState<AnswerOption[]>([]);
  const [typeQuestionIndex, setTypeQuestionIndex] = useState(0);
  const trackedViewCatIdRef = useRef<string | null>(null);

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
  const dayMap = buildDayMap(records);
  const rhythmSummary = buildRhythmSummary(dayMap, catProfile);
  const recentSummary = buildRecentSummary(records);
  const avatarSrc =
    catProfile?.avatarDataUrl ??
    catProfile?.homePhotoDataUrl ??
    getCatAvatarSrcForCoat(catProfile?.appearance?.coat);
  const hasTypeDiagnosis = Boolean(catProfile?.typeKey && catProfile?.typeLabel);
  const typeLabel = catProfile?.typeLabel ?? "タイプ未診断";

  const hasRhythmSignal = dayMap.some((item) => item.signal);
  const peakTime = catProfile?.activityPattern?.peakTime;
  const peakSlots = peakTime ? peakTimeMap[peakTime] ?? [] : [];
  const diagnosisFacts: KnownFact[] = [
    ...(hasTypeDiagnosis
      ? [
          {
            id: "type",
            label: "タイプ診断",
            value: typeLabel,
            source: "診断結果",
            detail:
              catProfile?.typeTagline ??
              "診断で見えたタイプです。",
          },
        ]
      : []),
    ...(!hasRhythmSignal && peakSlots.length > 0
      ? [
          {
            id: "diagnosis-rhythm",
            label: "リズム",
            value: rhythmSummary,
            source: "オンボーディング結果",
            detail: "最初の回答から見えているリズムです。",
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
  const diagnosisItems: DiagnosisItem[] = LOCKED_DIAGNOSIS_SAMPLES.map((card) => {
    const remaining = Math.max(0, card.threshold - recordCount);

    return {
      card,
      remaining,
      progress: Math.min(100, Math.round((recordCount / card.threshold) * 100)),
    };
  });
  const lockedDiagnoses = diagnosisItems;
  const currentTypeQuestion = QUESTIONS[typeQuestionIndex] ?? QUESTIONS[0];
  const dashboardItems = [
    {
      label: "記録",
      value: String(recordCount),
    },
    {
      label: "発見",
      value: String(diagnosisFacts.length),
    },
    {
      label: "未開封",
      value: String(lockedDiagnoses.length),
    },
  ];

  useEffect(() => {
    if (!catProfile || trackedViewCatIdRef.current === catProfile.id) {
      return;
    }

    trackedViewCatIdRef.current = catProfile.id;
    trackProductEvent(
      "torisetu_viewed",
      {
        record_count: recordCount,
        mikke_fact_count: mikkeFacts.length,
        diagnosis_fact_count: diagnosisFacts.length,
        locked_diagnosis_count: lockedDiagnoses.length,
        has_type_diagnosis: hasTypeDiagnosis,
        mikke_fact_ids: mikkeFacts.map((fact) => fact.id),
        diagnosis_fact_ids: diagnosisFacts.map((fact) => fact.id),
        locked_diagnosis_ids: lockedDiagnoses.map((item) => item.card.id),
      },
      { localCatId: catProfile.id },
    );
  }, [
    catProfile,
    diagnosisFacts.length,
    hasTypeDiagnosis,
    lockedDiagnoses.length,
    mikkeFacts.length,
    recordCount,
  ]);

  function handleStartTypeDiagnosis() {
    trackProductEvent(
      "torisetu_diagnosis_card_started",
      {
        diagnosis_id: "type_diagnosis",
        question_count: QUESTIONS.length,
        has_existing_result: hasTypeDiagnosis,
      },
      { localCatId: catProfile?.id ?? null },
    );
    setTypeAnswers([]);
    setTypeQuestionIndex(0);
    setIsTypeDiagnosisOpen(true);
  }

  function handleCloseTypeDiagnosis(reason: "overlay" | "close_button") {
    trackProductEvent(
      "torisetu_diagnosis_sheet_closed",
      {
        diagnosis_id: "type_diagnosis",
        answered_count: typeAnswers.length,
        question_index: typeQuestionIndex,
        reason,
      },
      { localCatId: catProfile?.id ?? null },
    );
    setIsTypeDiagnosisOpen(false);
  }

  function handleOpenFact(fact: KnownFact, section: "diagnosis_result" | "mikke_fact") {
    trackProductEvent(
      "torisetu_result_card_opened",
      {
        fact_id: fact.id,
        section,
        has_detail: Boolean(fact.detail),
      },
      { localCatId: catProfile?.id ?? null },
    );
    setActiveFact(fact);
  }

  function handleCloseFact(reason: "overlay" | "close_button") {
    if (activeFact) {
      trackProductEvent(
        "torisetu_result_sheet_closed",
        {
          fact_id: activeFact.id,
          reason,
        },
        { localCatId: catProfile?.id ?? null },
      );
    }
    setActiveFact(null);
  }

  function handleLockedDiagnosisTap(item: DiagnosisItem) {
    trackProductEvent(
      "torisetu_locked_diagnosis_tapped",
      {
        diagnosis_id: item.card.id,
        remaining: item.remaining,
        progress: item.progress,
        threshold: item.card.threshold,
      },
      { localCatId: catProfile?.id ?? null },
    );
  }

  function handleTypeAnswer(option: AnswerOption) {
    if (!catProfile) return;

    const nextAnswers = [...typeAnswers, option];

    if (typeQuestionIndex < QUESTIONS.length - 1) {
      setTypeAnswers(nextAnswers);
      setTypeQuestionIndex((index) => index + 1);
      return;
    }

    const axisScores = calcAxisScores(nextAnswers);
    const typeKey = determineType(axisScores);
    const typeInfo = getCatTypeInfo(typeKey);

    if (!typeInfo) {
      setIsTypeDiagnosisOpen(false);
      return;
    }

    const now = new Date().toISOString();
    const profiles = loadCatProfiles();
    const nextProfiles = profiles.map((profile) =>
      profile.id === catProfile.id
        ? {
            ...profile,
            typeKey,
            typeLabel: typeInfo.label,
            typeTagline: typeInfo.tagline,
            axisScores,
            activityPattern: calcActivityPattern(nextAnswers),
            onboarding: {
              version: "torisetu-type-diagnosis-v1",
              answeredCount: nextAnswers.length,
              skippedCount: 0,
              answers: nextAnswers.map((answer) => answer.label),
              completedAt: profile.onboarding?.completedAt ?? now,
              updatedAt: now,
            },
            updatedAt: now,
          }
        : profile,
    );

    saveCatProfiles(nextProfiles);
    trackProductEvent(
      "torisetu_diagnosis_completed",
      {
        diagnosis_id: "type_diagnosis",
        answered_count: nextAnswers.length,
        result_type_key: typeKey,
      },
      { localCatId: catProfile.id },
    );
    setCatProfile(
      nextProfiles.find((profile) => profile.id === catProfile.id) ?? catProfile,
    );
    setTypeAnswers([]);
    setTypeQuestionIndex(0);
    setIsTypeDiagnosisOpen(false);
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
            <h1 style={styles.title}>{catName}のトリセツ</h1>
          </div>
        </header>

        <section style={styles.libraryHero}>
          <div style={styles.libraryDashboard}>
            {dashboardItems.map((item) => (
              <div key={item.label} style={styles.libraryDashboardItem}>
                <span style={styles.libraryDashboardLabel}>{item.label}</span>
                <strong style={styles.libraryDashboardValue}>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section style={{ ...styles.sectionFrame, ...styles.sectionFrameKnowledge }}>
          <CategoryLabel
            icon="sparkles"
            label="発見"
          />
          <div style={styles.factGroups}>
            <FactGroup icon="paw" label={`${catName}の特徴`} facts={mikkeFacts} />
            {diagnosisFacts.length > 0 ? (
              <FactCardShelf
                icon="clipboard"
                label="診断結果"
                facts={diagnosisFacts}
                onOpenFact={(fact) => handleOpenFact(fact, "diagnosis_result")}
              />
            ) : null}
          </div>
        </section>

        {!hasTypeDiagnosis ? (
          <section style={{ ...styles.sectionFrame, ...styles.sectionFrameAction }}>
            <CategoryLabel
              icon="clipboard"
              label="診断"
            />
            <div style={styles.diagnosisList}>
              <TypeDiagnosisCard onStart={handleStartTypeDiagnosis} />
            </div>
          </section>
        ) : null}

        {lockedDiagnoses.length > 0 ? (
          <section style={{ ...styles.sectionFrame, ...styles.sectionFrameLocked }}>
            <CategoryLabel
              icon="lock"
              label="未開封"
            />
            <div style={styles.diagnosisShelf}>
              {lockedDiagnoses.map((item) => (
                <button
                  key={item.card.id}
                  type="button"
                  style={styles.diagnosisShelfCard}
                  aria-disabled="true"
                  onClick={() => handleLockedDiagnosisTap(item)}
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

      {isTypeDiagnosisOpen ? (
        <div style={styles.sheetLayer}>
          <button
            type="button"
            aria-label="閉じる"
            style={styles.sheetOverlay}
            onClick={() => handleCloseTypeDiagnosis("overlay")}
          />
          <section style={styles.sheet}>
            <div style={styles.sheetHandle} />
            <div style={styles.sheetHeader}>
              <div>
                <p style={styles.sheetKicker}>
                  タイプ診断 {typeQuestionIndex + 1}/{QUESTIONS.length}
                </p>
                <h2 style={styles.sheetTitle}>タイプ診断</h2>
              </div>
              <button
                type="button"
                aria-label="閉じる"
                style={styles.sheetClose}
                onClick={() => handleCloseTypeDiagnosis("close_button")}
              >
                ×
              </button>
            </div>
            <p style={styles.sheetQuestion}>
              {currentTypeQuestion.text.replace("{name}", catName)}
            </p>
            <div style={styles.sheetOptions}>
              {currentTypeQuestion.options.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  style={styles.sheetOption}
                  onClick={() => handleTypeAnswer(option)}
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
            onClick={() => handleCloseFact("overlay")}
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
                onClick={() => handleCloseFact("close_button")}
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

function TypeDiagnosisCard({ onStart }: { onStart: () => void }) {
  return (
    <article style={{ ...styles.diagnosisCard, ...styles.diagnosisCardReady }}>
      <div style={styles.diagnosisBodyRow}>
        <div style={styles.diagnosisText}>
          <h3 style={styles.diagnosisTitle}>タイプ診断</h3>
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
        {facts.map((fact) => {
          const isOpenable = Boolean(onOpenFact && fact.detail);

          return (
            <button
              key={fact.id}
              type="button"
              style={
                isOpenable
                  ? { ...styles.factRow, ...styles.factRowButton }
                  : { ...styles.factRow, cursor: "default" }
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
}: {
  icon: CategoryIconName;
  label: string;
}) {
  return (
    <div style={styles.categoryHeader}>
      <span style={styles.categoryIconWrap} aria-hidden="true">
        <CategoryIcon name={icon} />
      </span>
      <div style={styles.categoryText}>
        <h2 style={styles.categoryLabel}>{label}</h2>
      </div>
    </div>
  );
}

function CategoryIcon({ name }: { name: CategoryIconName }) {
  const iconStyle: CSSProperties = { width: "18px", height: "18px" };
  return <AppIcon name={name} size={18} style={iconStyle} />;
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
    const raw = window.localStorage.getItem(getRecordLogKey(catId));
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
  title: {
    fontSize: "22px",
    fontWeight: 620,
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
  libraryHero: {
    margin: "-2px 4px 18px",
  },
  libraryDashboard: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
    minWidth: 0,
  },
  libraryDashboardItem: {
    display: "inline-flex",
    alignItems: "baseline",
    gap: "5px",
    minWidth: 0,
  },
  libraryDashboardLabel: {
    color: TORISETU_FAINT,
    fontSize: "11px",
    fontWeight: 520,
    lineHeight: 1.2,
  },
  libraryDashboardValue: {
    color: TORISETU_TEXT,
    fontSize: "13px",
    fontWeight: 570,
    lineHeight: 1.15,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
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
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "8px",
  },
  factRow: {
    ...TORISETU_SURFACE_SOFT,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: "5px",
    width: "100%",
    minHeight: "72px",
    borderRadius: "18px",
    padding: "12px 13px",
    border: "0.5px solid rgba(255,255,255,0.13)",
    background: "rgba(255,255,255,0.095)",
    textAlign: "left" as const,
  },
  factRowButton: {
    cursor: "pointer",
  },
  factLabel: {
    color: TORISETU_FAINT,
    fontSize: "11px",
    fontWeight: 520,
    lineHeight: 1.3,
  },
  factText: {
    width: "100%",
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  factValue: {
    color: TORISETU_TEXT_STRONG,
    fontSize: "16px",
    fontWeight: 590,
    lineHeight: 1.35,
    textAlign: "left" as const,
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
    margin: 0,
    padding: "0 2px 4px 0",
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
