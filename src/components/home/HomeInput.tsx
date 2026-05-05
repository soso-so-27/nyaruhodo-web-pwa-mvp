"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { calculateUnderstandingPercent } from "../../core/understanding/understanding";
import { buildCalendarContext } from "../../lib/calendarContext";
import type { RecentEvent } from "../../lib/supabase/queries";
import {
  insertEvent,
  insertFeedback,
  insertHintFeedback,
} from "../../lib/supabase/queries";
import { BottomNavigation } from "../navigation/BottomNavigation";
import {
  CATEGORY_MESSAGES,
  CONCERN_OPTIONS,
  CURRENT_OPTIONS,
  FALLBACK_HYPOTHESIS_CTA_LABELS,
  HYPOTHESIS_CTA_LABELS,
  addCatProfile,
  buildDailyHintHypothesis,
  clearLatestHypothesis,
  getActiveCatProfile,
  getCatAvatarSrcForCoat,
  getCatName,
  getHypothesisCompletionMessage,
  isCurrentCatHintSuppressed,
  parseStoredContext,
  readActiveCatId,
  readCatProfiles,
  readCurrentCatHintSuppressions,
  readLatestHypothesis,
  saveActiveCatId,
  saveCurrentCatHintSuppression,
  updateCatProfileName,
} from "./homeInputHelpers";
import type {
  CatCoat,
  CatProfile,
  CurrentCatHintFeedback,
  CurrentCatHintSuppression,
  DailyHintHypothesis,
  LatestHypothesisView,
} from "./homeInputHelpers";

type HomeInputProps = {
  recentEvents: RecentEvent[];
};

const eventSaveErrorMessage =
  "\u8a18\u9332\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002\n\u901a\u4fe1\u72b6\u614b\u3092\u78ba\u8a8d\u3057\u3066\u3001\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002";

const feedbackSaveErrorMessage =
  "\u884c\u52d5\u306e\u8a18\u9332\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\n\u5c11\u3057\u6642\u9593\u3092\u304a\u3044\u3066\u3001\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002";

const currentStateSaveSuccessMessage =
  "\u6b8b\u3057\u307e\u3057\u305f\u3002\n{catName}\u306e\u3053\u3068\u304c\u3001\u5c11\u3057\u305a\u3064\u898b\u3048\u3066\u304d\u307e\u3059\u3002";
const firstCurrentStateSaveSuccessMessage =
  "{label}\u3001\u898b\u3064\u3051\u307e\u3057\u305f";

const ONBOARDING_HOME_HINT_KEY = "diagnosis_onboarding_home_hint";
const ONBOARDING_HOME_HINT_MAX_AGE_MS = 10 * 60 * 1000;
const POST_DIAGNOSIS_FEEDBACK_KEY = "post_diagnosis_feedback";
const RECENT_STATE_RECORDS_KEY = "recent_state_records";
const RECENT_STATE_RECORD_TTL_MS = 30 * 60 * 1000;
const RECENT_CAT_SUMMARY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_CAT_AVATAR_ICON_SRC = "/icons/cat-avatars/neutral.png";

type RecentStateRecord = {
  localCatId: string | null;
  signal: string;
  label: string;
  createdAt: string;
  expiresAt: string;
};

const dailyHintFeedbackMessages: Record<CurrentCatHintFeedback, string> = {
  accepted:
    "\u8a18\u9332\u3057\u307e\u3057\u305f\u3002\n\u6b21\u304b\u3089\u306e\u30d2\u30f3\u30c8\u306b\u4f7f\u3044\u307e\u3059\u3002",
  rejected:
    "\u3042\u308a\u304c\u3068\u3046\u3002\n\u6b21\u304b\u3089\u5c11\u3057\u63a7\u3048\u3081\u306b\u3057\u307e\u3059\u3002",
  dismissed:
    "\u3042\u3068\u3067\u898b\u3089\u308c\u308b\u3088\u3046\u306b\u3057\u3066\u304a\u304d\u307e\u3059\u3002",
};

type InitialHomeState = {
  activeCatId: string | null;
  activeProfile: CatProfile | null;
  catProfiles: CatProfile[];
};

function readInitialHomeState(): InitialHomeState {
  if (typeof window === "undefined") {
    return {
      activeCatId: null,
      activeProfile: null,
      catProfiles: [],
    };
  }

  try {
    const catProfiles = readCatProfiles();
    const savedActiveCatId = readActiveCatId();
    const activeProfile = getActiveCatProfile(catProfiles, savedActiveCatId);

    return {
      activeCatId: activeProfile.id,
      activeProfile,
      catProfiles,
    };
  } catch {
    return {
      activeCatId: null,
      activeProfile: null,
      catProfiles: [],
    };
  }
}

export function HomeInput({
  recentEvents,
}: HomeInputProps) {
  const router = useRouter();
  const [initialHomeState] = useState(readInitialHomeState);
  const [visibleLatestHypothesis, setVisibleLatestHypothesis] =
    useState<LatestHypothesisView | null>(null);
  const [catProfiles, setCatProfiles] = useState<CatProfile[]>(
    initialHomeState.catProfiles,
  );
  const [activeCatId, setActiveCatId] = useState<string | null>(
    initialHomeState.activeCatId,
  );
  const [isEditingCatName, setIsEditingCatName] = useState(false);
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [catNameInput, setCatNameInput] = useState(() =>
    getCatName(initialHomeState.activeProfile),
  );
  const [newCatNameInput, setNewCatNameInput] = useState("");
  const [catNameMessage, setCatNameMessage] = useState("");
  const [hypothesisMessage, setHypothesisMessage] = useState("");
  const [currentStateMessage, setCurrentStateMessage] = useState("");
  const [onboardingHomeMessage, setOnboardingHomeMessage] = useState("");
  const [postDiagnosisFeedbackMessage, setPostDiagnosisFeedbackMessage] =
    useState("");
  const [saveErrorMessage, setSaveErrorMessage] = useState("");
  const [saveErrorSection, setSaveErrorSection] = useState<
    "current" | "concern" | ""
  >("");
  const [isDailyHintDismissed, setIsDailyHintDismissed] = useState(false);
  const [hintSuppressions, setHintSuppressions] = useState<
    CurrentCatHintSuppression[]
  >([]);
  const [recentStateRecords, setRecentStateRecords] = useState<
    RecentStateRecord[]
  >([]);

  const activeCatProfile =
    catProfiles.length > 0
      ? getActiveCatProfile(catProfiles, activeCatId)
      : null;
  const catName = getCatName(activeCatProfile);
  const activeCatEvents = activeCatId
    ? recentEvents.filter((event) => event.local_cat_id === activeCatId)
    : [];
  const eventUnderstandingPercent = calculateUnderstandingPercent(
    activeCatEvents.length,
  );
  const profileUnderstandingPercent = activeCatProfile?.understanding?.percent ?? 0;
  const understandingPercent = Math.max(
    eventUnderstandingPercent,
    profileUnderstandingPercent,
  );
  const hypothesisCta = visibleLatestHypothesis
    ? HYPOTHESIS_CTA_LABELS[visibleLatestHypothesis.category] ??
      FALLBACK_HYPOTHESIS_CTA_LABELS
    : FALLBACK_HYPOTHESIS_CTA_LABELS;
  const hasKnownHypothesisCategory = visibleLatestHypothesis
    ? Boolean(HYPOTHESIS_CTA_LABELS[visibleLatestHypothesis.category])
    : false;
  const dailyHintHypothesis = buildDailyHintHypothesis(activeCatEvents);
  const isDailyHintSuppressed = isCurrentCatHintSuppressed({
    suppressions: hintSuppressions,
    localCatId: activeCatId,
    category: dailyHintHypothesis.category,
  });
  const shouldShowDailyHint =
    !visibleLatestHypothesis &&
    !isDailyHintDismissed &&
    !isDailyHintSuppressed &&
    activeCatEvents.length >= 3;
  const recentCatSummary = buildRecentCatSummary(activeCatEvents);

  useEffect(() => {
    const completed =
      window.localStorage.getItem("onboarding_completed") === "true";

    if (!completed) {
      router.replace("/diagnosis-onboarding");
      return;
    }

    const savedCatProfiles = readCatProfiles();
    const savedActiveCatId = readActiveCatId();
    const activeProfile = getActiveCatProfile(
      savedCatProfiles,
      savedActiveCatId,
    );

    setCatProfiles(savedCatProfiles);
    setActiveCatId(activeProfile.id);
    setCatNameInput(getCatName(activeProfile));
    setHintSuppressions(readCurrentCatHintSuppressions());
    setRecentStateRecords(readRecentStateRecords());
    saveActiveCatId(activeProfile.id);
    setOnboardingHomeMessage(readOnboardingHomeMessage(activeProfile.id));
    const postDiagnosisMessage = readPostDiagnosisFeedbackMessage(
      activeProfile.id,
      getCatName(activeProfile),
    );

    setPostDiagnosisFeedbackMessage(postDiagnosisMessage);
    if (postDiagnosisMessage) {
      window.setTimeout(() => {
        window.localStorage.removeItem(POST_DIAGNOSIS_FEEDBACK_KEY);
      }, 0);
    }

    const latestHypothesis = readLatestHypothesis();

    if (latestHypothesis) {
      if (
        latestHypothesis.localCatId &&
        latestHypothesis.localCatId !== activeProfile.id
      ) {
        clearLatestHypothesis();
      } else {
        setVisibleLatestHypothesis({
          input: "",
          context: {},
          category: latestHypothesis.category ?? "",
          text: latestHypothesis.text,
          source: latestHypothesis.source,
          diagnosisId: latestHypothesis.diagnosisId ?? null,
          localCatId: latestHypothesis.localCatId ?? activeProfile.id,
        });
        return;
      }
    }

    const input = window.localStorage.getItem("last_input_signal");
    const context = window.localStorage.getItem("last_context");
    const category = window.localStorage.getItem("last_primary_category");

    if (input && context && category) {
      setVisibleLatestHypothesis({
        input,
        context: parseStoredContext(context),
        category,
      });
    }
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRecentStateRecords(readRecentStateRecords());
    }, 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  function startEditingCatName() {
    setCatNameInput(catName);
    setCatNameMessage("");
    setIsAddingCat(false);
    setIsEditingCatName(true);
  }

  function cancelEditingCatName() {
    setCatNameInput(catName);
    setCatNameMessage("");
    setIsEditingCatName(false);
  }

  function handleCatNameSave() {
    const result = updateCatProfileName(catProfiles, activeCatId, catNameInput);

    if (!result) {
      return;
    }

    const activeProfile = getActiveCatProfile(
      result.profiles,
      result.activeCatId,
    );

    setCatProfiles(result.profiles);
    setActiveCatId(result.activeCatId);
    setCatNameInput(activeProfile.name);
    setIsEditingCatName(false);
    setCatNameMessage("\u4fdd\u5b58\u3057\u307e\u3057\u305f\u3002");
  }

  function handleCatSelect(catId: string) {
    const selectedProfile = getActiveCatProfile(catProfiles, catId);

    saveActiveCatId(catId);
    setActiveCatId(catId);
    setCatNameInput(getCatName(selectedProfile));
    clearLatestHypothesis();
    setVisibleLatestHypothesis(null);
    setHypothesisMessage("");
    setCurrentStateMessage("");
    setOnboardingHomeMessage("");
    setPostDiagnosisFeedbackMessage(
      readPostDiagnosisFeedbackMessage(catId, getCatName(selectedProfile)),
    );
    setSaveErrorMessage("");
    setIsDailyHintDismissed(false);
    setHintSuppressions(readCurrentCatHintSuppressions());
    setRecentStateRecords(readRecentStateRecords());
    setIsAddingCat(false);
    setCatNameMessage("");
  }

  function startAddingCat() {
    setNewCatNameInput("");
    setCatNameMessage("");
    setIsAddingCat(true);
    setIsEditingCatName(false);
  }

  function cancelAddingCat() {
    setNewCatNameInput("");
    setIsAddingCat(false);
  }

  function handleAddCatSave() {
    const result = addCatProfile(catProfiles, newCatNameInput);

    if (!result) {
      return;
    }

    const activeProfile = getActiveCatProfile(
      result.profiles,
      result.activeCatId,
    );

    setCatProfiles(result.profiles);
    setActiveCatId(result.activeCatId);
    setCatNameInput(activeProfile.name);
    setNewCatNameInput("");
    setIsAddingCat(false);
    setCatNameMessage("\u4fdd\u5b58\u3057\u307e\u3057\u305f\u3002");
  }

  async function handleCurrentSelect(label: string, signal: string) {
    dismissLatestHypothesis();
    setCurrentStateMessage("");
    setOnboardingHomeMessage("");
    setPostDiagnosisFeedbackMessage("");
    const isFirstSignal = isFirstCurrentStateSignal({
      events: activeCatEvents,
      recentStateRecords,
      localCatId: activeCatId,
      signal,
    });
    const event = await insertEvent({
      event_type: "current_state",
      signal,
      label,
      source: "home",
      calendarContext: buildCalendarContext(),
      localCatId: activeCatId,
    });

    if (!event) {
      setSaveErrorSection("current");
      setSaveErrorMessage(eventSaveErrorMessage);
      return;
    }

    setSaveErrorSection("");
    setSaveErrorMessage("");
    setCurrentStateMessage(
      isFirstSignal
        ? firstCurrentStateSaveSuccessMessage.replace(
            "{label}",
            getOptionDisplayLabel(label),
          )
        : currentStateSaveSuccessMessage.replace("{catName}", catName),
    );
    setRecentStateRecords(
      saveRecentStateRecord({
        localCatId: activeCatId,
        signal,
        label,
      }),
    );
    setIsDailyHintDismissed(false);
    router.refresh();
  }

  async function handleConcernSelect(label: string, input: string) {
    dismissLatestHypothesis();
    setCurrentStateMessage("");
    setOnboardingHomeMessage("");
    setPostDiagnosisFeedbackMessage("");
    const event = await insertEvent({
      event_type: "concern",
      signal: input,
      label,
      source: "home",
      calendarContext: buildCalendarContext(),
      localCatId: activeCatId,
    });

    if (!event) {
      setSaveErrorSection("concern");
      setSaveErrorMessage(eventSaveErrorMessage);
      return;
    }

    const params = new URLSearchParams({
      input,
    });

    if (event?.id) {
      params.set("event_id", event.id);
    }

    if (activeCatId) {
      params.set("local_cat_id", activeCatId);
    }

    if (
      activeCatProfile?.typeKey &&
      activeCatProfile.typeKey !== "balanced"
    ) {
      params.set("onboarding_type_key", activeCatProfile.typeKey);
    }

    if (activeCatProfile?.modifiers?.length) {
      params.set("onboarding_modifiers", activeCatProfile.modifiers.join(","));
    }

    router.push(`/diagnose?${params.toString()}`);
  }

  async function saveDailyHintFeedback(
    feedback: CurrentCatHintFeedback,
    action: "primary_cta" | "rejected" | "dismissed",
  ) {
    const savedFeedback = await insertHintFeedback({
      localCatId: activeCatId,
      hintType: "current_cat",
      shownCategory: dailyHintHypothesis.category,
      shownSignal: dailyHintHypothesis.shownSignal,
      feedback,
      understandingPercent,
      sourceEventIds: activeCatEvents.map((event) => event.id),
      calendarContext: buildCalendarContext(),
      metadata: {
        source: "current_cat_card",
        action,
        catName,
        headline: dailyHintHypothesis.text,
        ...(action === "primary_cta"
          ? { primaryCta: dailyHintHypothesis.cta.main }
          : {}),
      },
    });

    if (!savedFeedback) {
      setHypothesisMessage(eventSaveErrorMessage);
      return;
    }

    const nextSuppressions = saveCurrentCatHintSuppression({
      localCatId: activeCatId,
      category: dailyHintHypothesis.category,
      feedback,
    });

    setHintSuppressions(nextSuppressions);
    setIsDailyHintDismissed(true);
    setHypothesisMessage(dailyHintFeedbackMessages[feedback]);
  }

  function handleDailyHintMainAction() {
    void saveDailyHintFeedback("accepted", "primary_cta");
  }

  function handleDailyHintSubAction() {
    void saveDailyHintFeedback("rejected", "rejected");
  }

  function handleDailyHintTertiaryAction() {
    void saveDailyHintFeedback("dismissed", "dismissed");
  }

  async function handleHypothesisAction(feedback: "resolved" | "unresolved") {
    if (!visibleLatestHypothesis) {
      return;
    }

    if (!visibleLatestHypothesis.diagnosisId) {
      dismissLatestHypothesis();
      setHypothesisMessage("\u9589\u3058\u307e\u3057\u305f");
      return;
    }

    const savedFeedback = await insertFeedback({
      diagnosis_id: visibleLatestHypothesis.diagnosisId,
      feedback,
      category: visibleLatestHypothesis.category,
      localCatId: visibleLatestHypothesis.localCatId ?? activeCatId,
    });

    if (!savedFeedback) {
      setHypothesisMessage(feedbackSaveErrorMessage);
      return;
    }

    clearLatestHypothesis();
    setVisibleLatestHypothesis(null);
    setHypothesisMessage(
      getHypothesisCompletionMessage(visibleLatestHypothesis.category),
    );
  }

  function dismissLatestHypothesis() {
    clearLatestHypothesis();
    setVisibleLatestHypothesis(null);
    setHypothesisMessage("");
    setCurrentStateMessage("");
    setOnboardingHomeMessage("");
    setPostDiagnosisFeedbackMessage("");
    setSaveErrorSection("");
    setSaveErrorMessage("");
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div id="today">
        <Header
          activeCatId={activeCatId}
          catName={catName}
          catProfiles={catProfiles}
          catCoat={activeCatProfile?.appearance?.coat}
          onboardingHomeMessage={onboardingHomeMessage}
          postDiagnosisFeedbackMessage={postDiagnosisFeedbackMessage}
          recentCatSummary={recentCatSummary}
          understandingPercent={understandingPercent}
          onCatSelect={handleCatSelect}
        />
        </div>

        {visibleLatestHypothesis || hypothesisMessage ? (
        <section style={styles.insightCard}>
          {visibleLatestHypothesis ? (
            <LatestHypothesisCard
              hypothesis={visibleLatestHypothesis}
              cta={hypothesisCta}
              onMainAction={() => {
                void handleHypothesisAction("resolved");
              }}
              onSubAction={() => {
                if (hasKnownHypothesisCategory) {
                  void handleHypothesisAction("unresolved");
                  return;
                }

                dismissLatestHypothesis();
              }}
            />
          ) : null}

          {hypothesisMessage ? (
            <p style={styles.hypothesisMessage}>{hypothesisMessage}</p>
          ) : null}
        </section>
        ) : null}

        <div id="record" style={styles.actionArea}>
          <OptionSection
            title={`${catName}\u306f\u3044\u307e\u3069\u3046\u3057\u3066\u308b\uff1f`}
            options={CURRENT_OPTIONS}
            variant="current"
            description={"\u3044\u307e\u898b\u3048\u305f\u307e\u307e\u3001\u3072\u3068\u3064\u3067OK\u3067\u3059"}
            message={currentStateMessage}
            errorMessage={
              saveErrorSection === "current" ? saveErrorMessage : ""
            }
            activeCatId={activeCatId}
            recentStateRecords={recentStateRecords}
            onSelect={(option) => {
              void handleCurrentSelect(option.label, option.signal);
            }}
          />

          <OptionSection
            title={"\u3061\u3087\u3063\u3068\u6c17\u306b\u306a\u308b\uff1f"}
            options={CONCERN_OPTIONS}
            variant="concern"
            description={"\u8fd1\u3044\u3082\u306e\u3092\u3072\u3068\u3064\u3067OK"}
            errorMessage={
              saveErrorSection === "concern" ? saveErrorMessage : ""
            }
            onSelect={(option) => {
              void handleConcernSelect(option.label, option.input);
            }}
          />
        </div>

      </div>
      <BottomNavigation active="today" />
    </main>
  );
}

function readOnboardingHomeMessage(activeCatId: string) {
  const value = window.localStorage.getItem(ONBOARDING_HOME_HINT_KEY);

  if (!value) {
    return "";
  }

  window.localStorage.removeItem(ONBOARDING_HOME_HINT_KEY);

  try {
    const parsed = JSON.parse(value) as {
      localCatId?: string;
      catName?: string;
      completedAt?: string;
    };
    const completedAtTime = parsed.completedAt
      ? new Date(parsed.completedAt).getTime()
      : Number.NaN;

    if (
      parsed.localCatId !== activeCatId ||
      Number.isNaN(completedAtTime) ||
      Date.now() - completedAtTime > ONBOARDING_HOME_HINT_MAX_AGE_MS
    ) {
      return "";
    }

    const catName = parsed.catName || "\u3053\u306e\u5b50";

    return `\u3055\u3063\u304d\u306e\u56de\u7b54\u304b\u3089\u3001${catName}\u306e\u3053\u3068\u304c\u5c11\u3057\u898b\u3048\u3066\u304d\u307e\u3057\u305f\u3002\n\u307e\u305a\u306f\u3001\u4eca\u65e5\u306e\u69d8\u5b50\u3092\u3072\u3068\u3064\u6b8b\u3057\u3066\u307f\u307e\u3057\u3087\u3046\u3002`;
  } catch {
    return "";
  }
}

function readPostDiagnosisFeedbackMessage(activeCatId: string, catName: string) {
  const value = window.localStorage.getItem(POST_DIAGNOSIS_FEEDBACK_KEY);

  if (!value) {
    return "";
  }

  try {
    const parsed = JSON.parse(value) as {
      localCatId?: string | null;
      result?: "resolved" | "unresolved";
      category?: string;
      label?: string;
    };

    if (parsed.localCatId !== activeCatId) {
      return "";
    }

    if (parsed.result === "resolved") {
      if (parsed.label === "鳴きやんだ") {
        return "鳴きやんだことを記録しました。\nまた気づいたら、見たままをひとつ残せばOKです。";
      }

      return `${catName}の様子が${parsed.label ?? "落ち着いた"}ことを記録しました。\nまた気づいたら、見たままをひとつ残せばOKです。`;
    }

    if (parsed.label === "まだ鳴いてる") {
      return "まだ鳴いていることを記録しました。\nもう一度、近い様子を選んでみても大丈夫です。";
    }

    if (parsed.category === "health") {
      return "まだ気になることを記録しました。\n様子が続くときは、無理に判断せず相談も考えてください。";
    }

    return "まだ気になることを記録しました。\nもう一度、近い様子を選んでみても大丈夫です。";
  } catch {
    return "";
  }
}

function readRecentStateRecords() {
  const value = window.localStorage.getItem(RECENT_STATE_RECORDS_KEY);

  if (!value) {
    return [];
  }

  try {
    const now = Date.now();
    const records = JSON.parse(value) as RecentStateRecord[];
    const activeRecords = records.filter((record) => {
      const expiresAt = new Date(record.expiresAt).getTime();

      return (
        record &&
        typeof record.signal === "string" &&
        !Number.isNaN(expiresAt) &&
        expiresAt > now
      );
    });

    if (activeRecords.length !== records.length) {
      writeRecentStateRecords(activeRecords);
    }

    return activeRecords;
  } catch {
    window.localStorage.removeItem(RECENT_STATE_RECORDS_KEY);
    return [];
  }
}

function writeRecentStateRecords(records: RecentStateRecord[]) {
  if (records.length === 0) {
    window.localStorage.removeItem(RECENT_STATE_RECORDS_KEY);
    return;
  }

  window.localStorage.setItem(
    RECENT_STATE_RECORDS_KEY,
    JSON.stringify(records),
  );
}

function saveRecentStateRecord({
  localCatId,
  signal,
  label,
}: {
  localCatId?: string | null;
  signal: string;
  label: string;
}) {
  const now = new Date();
  const normalizedCatId = localCatId ?? null;
  const records = readRecentStateRecords().filter(
    (record) =>
      record.localCatId !== normalizedCatId || record.signal !== signal,
  );
  const nextRecords = [
    ...records,
    {
      localCatId: normalizedCatId,
      signal,
      label,
      createdAt: now.toISOString(),
      expiresAt: new Date(
        now.getTime() + RECENT_STATE_RECORD_TTL_MS,
      ).toISOString(),
    },
  ];

  writeRecentStateRecords(nextRecords);

  return nextRecords;
}

function isRecentStateRecorded({
  records,
  localCatId,
  signal,
}: {
  records: RecentStateRecord[];
  localCatId?: string | null;
  signal: string;
}) {
  const normalizedCatId = localCatId ?? null;
  const now = Date.now();

  return records.some((record) => {
    const expiresAt = new Date(record.expiresAt).getTime();

    return (
      record.localCatId === normalizedCatId &&
      record.signal === signal &&
      !Number.isNaN(expiresAt) &&
      expiresAt > now
    );
  });
}

function isFirstCurrentStateSignal({
  events,
  recentStateRecords,
  localCatId,
  signal,
}: {
  events: RecentEvent[];
  recentStateRecords: RecentStateRecord[];
  localCatId?: string | null;
  signal: string;
}) {
  const hasSavedSignal = events.some(
    (event) =>
      event.event_type === "current_state" && event.signal === signal,
  );

  if (hasSavedSignal) {
    return false;
  }

  return !isRecentStateRecorded({
    records: recentStateRecords,
    localCatId,
    signal,
  });
}

function Header({
  activeCatId,
  catName,
  catProfiles,
  catCoat,
  onboardingHomeMessage,
  postDiagnosisFeedbackMessage,
  recentCatSummary,
  understandingPercent,
  onCatSelect,
}: {
  activeCatId: string | null;
  catName: string;
  catProfiles: CatProfile[];
  catCoat?: CatCoat;
  onboardingHomeMessage: string;
  postDiagnosisFeedbackMessage: string;
  recentCatSummary: RecentCatSummary;
  understandingPercent: number;
  onCatSelect: (catId: string) => void;
}) {
  const [isCatSwitcherOpen, setIsCatSwitcherOpen] = useState(false);
  const understandingTone = getUnderstandingTone(understandingPercent);
  const ringDegree = Math.max(0, Math.min(100, understandingPercent)) * 3.6;
  const canSwitchCats = catProfiles.length > 1;
  const catAvatarSrc = getCatAvatarSrcForCoat(catCoat);
  const stateBadgeSrc = getCatStateBadgeIconSrc(recentCatSummary.avatarSignal);
  const catAvatarStyle = getCatCoatAvatarStyle(catCoat);

  function handleCatChipSelect(catId: string) {
    onCatSelect(catId);
    setIsCatSwitcherOpen(false);
  }

  return (
    <header style={styles.header}>
      <div style={styles.profileHero}>
        <div style={{ ...styles.catAvatar, ...catAvatarStyle }} aria-hidden="true">
          <img
            key={catAvatarSrc}
            src={catAvatarSrc}
            alt=""
            style={styles.catAvatarIcon}
            onError={(event) => {
              if (event.currentTarget.src.endsWith(DEFAULT_CAT_AVATAR_ICON_SRC)) {
                event.currentTarget.style.visibility = "hidden";
                return;
              }

              event.currentTarget.src = DEFAULT_CAT_AVATAR_ICON_SRC;
            }}
          />
          {stateBadgeSrc ? (
            <span style={styles.catAvatarBadge}>
              <img
                key={stateBadgeSrc}
                src={stateBadgeSrc}
                alt=""
                style={styles.catAvatarBadgeIcon}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            </span>
          ) : null}
        </div>
        <div style={styles.profileText}>
          <h1 style={styles.title}>
            {canSwitchCats ? (
              <button
                type="button"
                onClick={() => setIsCatSwitcherOpen((current) => !current)}
                style={styles.titleSwitchButton}
                aria-expanded={isCatSwitcherOpen}
              >
                <span>
                  {catName}
                </span>
                <span style={styles.titleChevron} aria-hidden="true">
                  {isCatSwitcherOpen ? "▲" : "▼"}
                </span>
              </button>
            ) : (
              <>{catName}</>
            )}
          </h1>
        </div>
        <div style={styles.understandingPanel}>
          <div
            style={{
              ...styles.understandingRing,
              background: `conic-gradient(#3f3f46 ${ringDegree}deg, #eee7dd 0deg)`,
            }}
            aria-label={`理解度 ${understandingPercent}%`}
          >
            <span style={styles.understandingRingInner}>
              {understandingPercent}
              {"%"}
            </span>
          </div>
          <p style={styles.understanding}>{understandingTone}</p>
        </div>
      </div>
      <div style={styles.headerGuide}>
        {onboardingHomeMessage ? (
          <p style={styles.onboardingHomeMessage}>{onboardingHomeMessage}</p>
        ) : null}
        {postDiagnosisFeedbackMessage ? (
          <p style={styles.onboardingHomeMessage}>
            {postDiagnosisFeedbackMessage}
          </p>
        ) : null}
        <div style={styles.dashboardTiles}>
          <div style={styles.dashboardTile}>
            <span style={styles.statusLabel}>
              {`\u3055\u3044\u304d\u3093\u306e${catName}`}
            </span>
            <span style={styles.statusValue}>
              {recentCatSummary.recentSignalLabel}
            </span>
          </div>
          <div style={{ ...styles.dashboardTile, ...styles.dashboardTileLast }}>
            <span style={styles.statusLabel}>
              {`\u3044\u307e\u306e${catName}`}
            </span>
            <span style={styles.statusValue}>
              {recentCatSummary.currentTrendText}
            </span>
          </div>
        </div>
        <div style={styles.dayMap}>
          <p style={styles.dayMapTitle}>{`${catName}\u306e1\u65e5`}</p>
          <div style={styles.dayMapGrid}>
            {recentCatSummary.dayMap.map((item) => (
              <div
                key={item.period}
                style={
                  item.isMuted
                    ? { ...styles.dayMapItem, ...styles.dayMapItemMuted }
                    : styles.dayMapItem
                }
              >
                <span style={styles.dayMapPeriod}>{item.period}</span>
                {item.signal ? (
                  <img
                    src={getSignalIconSrc(item.signal)}
                    alt=""
                    style={styles.dayMapIcon}
                    onError={(event) => {
                      event.currentTarget.style.visibility = "hidden";
                    }}
                  />
                ) : (
                  <span style={styles.dayMapDot} aria-hidden="true" />
                )}
                <span style={styles.dayMapLabel}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {isCatSwitcherOpen ? (
        <div style={styles.homeCatSwitcher}>
          <p style={styles.catChipLabel}>{"\u898b\u308b\u732b\u3092\u9078\u3076"}</p>
          <div style={styles.catChips}>
            {catProfiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => handleCatChipSelect(profile.id)}
                style={
                  profile.id === activeCatId
                    ? styles.activeCatChipButton
                    : styles.catChipButton
                }
              >
                {profile.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}

function getUnderstandingTone(percent: number) {
  if (percent >= 90) {
    return "\u304b\u306a\u308a";
  }

  if (percent >= 60) {
    return "\u3060\u3093\u3060\u3093";
  }

  if (percent >= 30) {
    return "\u5c11\u3057\u305a\u3064";
  }

  return "\u3053\u308c\u304b\u3089";
}

function buildHomeReturnMotivation(
  events: RecentEvent[],
  catName: string,
): { title: string; text: string } {
  const todayEventCount = events.filter((event) => isTodayEvent(event)).length;

  if (todayEventCount > 0) {
    return {
      title: "今日の様子が少し残っています。",
      text: "また気づいたら、ひとつ足してみてください。",
    };
  }

  const lastEvent = events[0];
  const lastLabel = lastEvent?.label ? getOptionDisplayLabel(lastEvent.label) : "";

  if (lastLabel) {
    return {
      title: `前回は「${lastLabel}」を残しました。`,
      text: `少しずつ、${catName}の過ごし方が見えてきます。`,
    };
  }

  return {
    title: "今日はまだ記録がありません。",
    text: "見たままをひとつ残せばOKです。",
  };
}

function isTodayEvent(event: RecentEvent) {
  const eventDate = new Date(event.occurred_at || event.created_at);

  if (Number.isNaN(eventDate.getTime())) {
    return false;
  }

  return formatTokyoDateKey(eventDate) === formatTokyoDateKey(new Date());
}

function formatTokyoDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

type RecentCatSummary = {
  avatarSignal: string | null;
  recentSignalLabel: string;
  currentTrendText: string;
  dayMap: DayMapItem[];
};

type DayPart = "morning" | "daytime" | "evening" | "night";

type DayMapItem = {
  period: string;
  dayPart: DayPart;
  label: string;
  signal: string | null;
  isMuted: boolean;
};

type RecentCatSignalSummary = {
  eventType: "current_state" | "concern";
  signal: string;
  count: number;
};

function buildRecentCatSummary(events: RecentEvent[]): RecentCatSummary {
  const recentEvents = getRecentSummaryEvents(events);
  const topSignal = getTopRecentSignal(recentEvents);
  const dayMap = buildDayMap(recentEvents);
  const currentDayPart = getCurrentDayPart();
  const currentMapItem = dayMap.find((item) => item.dayPart === currentDayPart);

  return {
    avatarSignal: currentMapItem?.signal ?? topSignal?.signal ?? null,
    recentSignalLabel: topSignal
      ? `${getSignalDisplayLabel(topSignal.signal)}\u591a\u3081`
      : recentEvents.length > 0
        ? "\u5c11\u3057\u305a\u3064"
        : "\u307e\u3060\u3053\u308c\u304b\u3089",
    currentTrendText: getCurrentTrendText(currentMapItem),
    dayMap,
  };
}

function getRecentSummaryEvents(events: RecentEvent[]) {
  const since = Date.now() - RECENT_CAT_SUMMARY_WINDOW_MS;

  return events.filter((event) => {
    if (
      event.event_type !== "current_state" &&
      event.event_type !== "concern"
    ) {
      return false;
    }

    const eventDate = new Date(event.occurred_at || event.created_at);

    return !Number.isNaN(eventDate.getTime()) && eventDate.getTime() >= since;
  });
}

function getTopRecentSignal(
  events: RecentEvent[],
): RecentCatSignalSummary | null {
  const counts = new Map<string, RecentCatSignalSummary>();

  events.forEach((event) => {
    if (
      event.event_type !== "current_state" &&
      event.event_type !== "concern"
    ) {
      return;
    }

    const key = `${event.event_type}:${event.signal}`;
    const current = counts.get(key);

    if (current) {
      counts.set(key, {
        ...current,
        count: current.count + 1,
      });
      return;
    }

    counts.set(key, {
      eventType: event.event_type,
      signal: event.signal,
      count: 1,
    });
  });

  const sorted = Array.from(counts.values()).sort((a, b) => b.count - a.count);
  const top = sorted[0];

  if (!top || top.count < 2) {
    return null;
  }

  const tiedTopSignals = sorted.filter((entry) => entry.count === top.count);

  if (tiedTopSignals.length > 1) {
    return null;
  }

  return top;
}

function buildDayMap(events: RecentEvent[]): DayMapItem[] {
  const dayParts: Array<{ dayPart: DayPart; period: string }> = [
    { dayPart: "morning", period: "\u671d" },
    { dayPart: "daytime", period: "\u663c" },
    { dayPart: "evening", period: "\u5915" },
    { dayPart: "night", period: "\u591c" },
  ];

  return dayParts.map(({ dayPart, period }) => {
    const eventsInPeriod = events.filter(
      (event) => getEventDayPart(event) === dayPart,
    );
    const summary = getRepresentativeSignal(eventsInPeriod);

    return {
      period,
      dayPart,
      label: summary?.signal
        ? getSignalDisplayLabel(summary.signal)
        : summary?.label ?? "\u307e\u3060",
      signal: summary?.signal ?? null,
      isMuted: !summary?.signal,
    };
  });
}

function getRepresentativeSignal(events: RecentEvent[]) {
  if (events.length < 3) {
    return {
      label: "-",
      signal: null,
    };
  }

  const topSignal = getTopRecentSignal(events);

  if (!topSignal) {
    return {
      label: "\u5c11\u3057\u305a\u3064",
      signal: null,
    };
  }

  return {
    label: getSignalDisplayLabel(topSignal.signal),
    signal: topSignal.signal,
  };
}

function getCurrentDayPart(): DayPart {
  return getDayPartFromTimeBand(buildCalendarContext().timeBand);
}

function getEventDayPart(event: RecentEvent): DayPart {
  const timeBand =
    event.calendar_context?.timeBand ??
    buildCalendarContext(new Date(event.occurred_at || event.created_at))
      .timeBand;

  return getDayPartFromTimeBand(timeBand);
}

function getDayPartFromTimeBand(
  timeBand: ReturnType<typeof buildCalendarContext>["timeBand"],
): DayPart {
  if (timeBand === "early_morning" || timeBand === "morning") {
    return "morning";
  }

  if (timeBand === "daytime") {
    return "daytime";
  }

  if (timeBand === "evening") {
    return "evening";
  }

  return "night";
}

function getCurrentTrendText(item?: DayMapItem) {
  if (!item || !item.signal) {
    return "\u3053\u308c\u304b\u3089";
  }

  const trendTexts: Record<string, string> = {
    sleeping: `${item.period}\u306f\u306d\u3066\u308b\u591a\u3081`,
    grooming: `${item.period}\u306f\u6bdb\u3065\u304f\u308d\u3044\u591a\u3081`,
    playing: `${item.period}\u306f\u904a\u3073\u591a\u3081`,
    after_food: `${item.period}\u306f\u3054\u306f\u3093\u591a\u3081`,
    food: `${item.period}\u306f\u3054\u306f\u3093\u591a\u3081`,
    toilet: `${item.period}\u306f\u30c8\u30a4\u30ec\u591a\u3081`,
    purring: `${item.period}\u306f\u30b4\u30ed\u30b4\u30ed\u591a\u3081`,
    meowing: `${item.period}\u306f\u9cf4\u3044\u3066\u308b\u591a\u3081`,
    following: `${item.period}\u306f\u3064\u3044\u3066\u304f\u308b\u591a\u3081`,
    restless: `${item.period}\u306f\u305d\u308f\u305d\u308f\u591a\u3081`,
    low_energy: `${item.period}\u306f\u5143\u6c17\u306a\u3044\u591a\u3081`,
    fighting: `${item.period}\u306f\u30b1\u30f3\u30ab\u591a\u3081`,
    unknown: `${item.period}\u306f\u3088\u304f\u308f\u304b\u3089\u306a\u3044\u591a\u3081`,
  };

  return (
    trendTexts[item.signal] ??
    `${item.period}\u306f${item.label}\u591a\u3081`
  );
}

function getRecentSignalSummaryText(
  summary: RecentCatSignalSummary,
  catName: string,
) {
  if (summary.eventType === "current_state") {
    const currentMessages: Record<string, string> = {
      sleeping:
        "\u6700\u8fd1\u306f\u300c\u306d\u3066\u308b\u300d\u306e\u8a18\u9332\u304c\u591a\u3081\u3067\u3059\u3002\n\u843d\u3061\u7740\u3044\u3066\u904e\u3054\u3059\u6642\u9593\u304c\u5c11\u3057\u898b\u3048\u3066\u304d\u307e\u3057\u305f\u3002",
      grooming:
        "\u6700\u8fd1\u306f\u300c\u6bdb\u3065\u304f\u308d\u3044\u300d\u306e\u8a18\u9332\u304c\u6b8b\u3063\u3066\u3044\u307e\u3059\u3002\n\u3044\u3064\u3082\u306e\u6574\u3048\u308b\u6642\u9593\u304c\u5c11\u3057\u898b\u3048\u3066\u304d\u307e\u3057\u305f\u3002",
      playing:
        "\u6700\u8fd1\u306f\u300c\u904a\u3093\u3067\u308b\u300d\u306e\u8a18\u9332\u304c\u6b8b\u3063\u3066\u3044\u307e\u3059\u3002\n\u5143\u6c17\u306b\u52d5\u304f\u6642\u9593\u304c\u5c11\u3057\u898b\u3048\u3066\u304d\u307e\u3057\u305f\u3002",
      after_food:
        "\u6700\u8fd1\u306f\u300c\u3054\u306f\u3093\u300d\u306e\u8a18\u9332\u304c\u6b8b\u3063\u3066\u3044\u307e\u3059\u3002\n\u98df\u3079\u308b\u30ea\u30ba\u30e0\u304c\u5c11\u3057\u898b\u3048\u3066\u304d\u307e\u3057\u305f\u3002",
      food:
        "\u6700\u8fd1\u306f\u300c\u3054\u306f\u3093\u300d\u306e\u8a18\u9332\u304c\u6b8b\u3063\u3066\u3044\u307e\u3059\u3002\n\u98df\u3079\u308b\u30ea\u30ba\u30e0\u304c\u5c11\u3057\u898b\u3048\u3066\u304d\u307e\u3057\u305f\u3002",
      toilet:
        "\u6700\u8fd1\u306f\u300c\u30c8\u30a4\u30ec\u300d\u306e\u8a18\u9332\u304c\u6b8b\u3063\u3066\u3044\u307e\u3059\u3002\n\u3044\u3064\u3082\u306e\u30ea\u30ba\u30e0\u3092\u898b\u308b\u624b\u304c\u304b\u308a\u306b\u306a\u308a\u307e\u3059\u3002",
      purring:
        "\u6700\u8fd1\u306f\u300c\u30b4\u30ed\u30b4\u30ed\u300d\u306e\u8a18\u9332\u304c\u6b8b\u3063\u3066\u3044\u307e\u3059\u3002\n\u30ea\u30e9\u30c3\u30af\u30b9\u3057\u3066\u3044\u308b\u6642\u9593\u304c\u5c11\u3057\u898b\u3048\u3066\u304d\u307e\u3057\u305f\u3002",
    };

    return (
      currentMessages[summary.signal] ??
      `\u6700\u8fd1\u306f\u3044\u304f\u3064\u304b\u306e\u69d8\u5b50\u304c\u6b8b\u3063\u3066\u3044\u307e\u3059\u3002\n${catName}\u306e\u904e\u3054\u3057\u65b9\u304c\u5c11\u3057\u305a\u3064\u898b\u3048\u3066\u304d\u307e\u3057\u305f\u3002`
    );
  }

  const concernMessages: Record<string, string> = {
    meowing:
      "\u6700\u8fd1\u300c\u9cf4\u3044\u3066\u308b\u300d\u304c\u4f55\u5ea6\u304b\u6b8b\u3063\u3066\u3044\u307e\u3059\u3002\n\u7d9a\u304f\u3088\u3046\u306a\u3089\u3001\u8fd1\u3044\u69d8\u5b50\u3092\u9078\u3093\u3067\u898b\u3066\u307f\u307e\u3057\u3087\u3046\u3002",
    following:
      "\u6700\u8fd1\u300c\u3064\u3044\u3066\u304f\u308b\u300d\u304c\u4f55\u5ea6\u304b\u6b8b\u3063\u3066\u3044\u307e\u3059\u3002\n\u304b\u307e\u3063\u3066\u307b\u3057\u3044\u6c17\u6301\u3061\u304c\u51fa\u3066\u3044\u308b\u65e5\u3082\u3042\u308b\u304b\u3082\u3057\u308c\u307e\u305b\u3093\u3002",
    restless:
      "\u6700\u8fd1\u300c\u843d\u3061\u7740\u304b\u306a\u3044\u300d\u304c\u4f55\u5ea6\u304b\u6b8b\u3063\u3066\u3044\u307e\u3059\u3002\n\u97f3\u3084\u74b0\u5883\u306e\u5909\u5316\u3082\u3001\u5c11\u3057\u898b\u3066\u3042\u3052\u308b\u3068\u3088\u3055\u305d\u3046\u3067\u3059\u3002",
    low_energy:
      "\u6700\u8fd1\u300c\u5143\u6c17\u306a\u3044\u300d\u304c\u4f55\u5ea6\u304b\u6b8b\u3063\u3066\u3044\u307e\u3059\u3002\n\u3044\u3064\u3082\u306e\u69d8\u5b50\u3068\u6bd4\u3079\u306a\u304c\u3089\u3001\u5c11\u3057\u4e01\u5be7\u306b\u898b\u3066\u3042\u3052\u307e\u3057\u3087\u3046\u3002",
    fighting:
      "\u6700\u8fd1\u300c\u30b1\u30f3\u30ab\u3057\u3066\u308b\u300d\u304c\u4f55\u5ea6\u304b\u6b8b\u3063\u3066\u3044\u307e\u3059\u3002\n\u843d\u3061\u7740\u3051\u308b\u5834\u6240\u3084\u8ddd\u96e2\u611f\u3092\u5c11\u3057\u898b\u3066\u3042\u3052\u308b\u3068\u3088\u3055\u305d\u3046\u3067\u3059\u3002",
    unknown:
      "\u6700\u8fd1\u300c\u3088\u304f\u308f\u304b\u3089\u306a\u3044\u300d\u304c\u4f55\u5ea6\u304b\u6b8b\u3063\u3066\u3044\u307e\u3059\u3002\n\u8fd1\u3044\u69d8\u5b50\u3092\u5c11\u3057\u305a\u3064\u9078\u3076\u3068\u3001\u898b\u3048\u65b9\u304c\u5897\u3048\u3066\u3044\u304d\u307e\u3059\u3002",
  };

  return (
    concernMessages[summary.signal] ??
    `\u6700\u8fd1\u306f\u3044\u304f\u3064\u304b\u306e\u69d8\u5b50\u304c\u6b8b\u3063\u3066\u3044\u307e\u3059\u3002\n${catName}\u306e\u904e\u3054\u3057\u65b9\u304c\u5c11\u3057\u305a\u3064\u898b\u3048\u3066\u304d\u307e\u3057\u305f\u3002`
  );
}

function CatSettings({
  activeCatId,
  catNameInput,
  catNameMessage,
  catProfiles,
  isEditingCatName,
  isAddingCat,
  newCatNameInput,
  onCatNameInputChange,
  onNewCatNameInputChange,
  onCatNameSave,
  onAddCatSave,
  onCatSelect,
  onEditCatName,
  onCancelCatNameEdit,
  onStartAddingCat,
  onCancelAddingCat,
}: {
  activeCatId: string | null;
  catNameInput: string;
  catNameMessage: string;
  catProfiles: CatProfile[];
  isEditingCatName: boolean;
  isAddingCat: boolean;
  newCatNameInput: string;
  onCatNameInputChange: (value: string) => void;
  onNewCatNameInputChange: (value: string) => void;
  onCatNameSave: () => void;
  onAddCatSave: () => void;
  onCatSelect: (catId: string) => void;
  onEditCatName: () => void;
  onCancelCatNameEdit: () => void;
  onStartAddingCat: () => void;
  onCancelAddingCat: () => void;
}) {
  return (
    <section id="cats" style={styles.catSettings}>
      <p style={styles.settingsEyebrow}>{"\u306d\u3053"}</p>
      <h2 style={styles.sectionTitle}>{"\u306d\u3053\u306e\u8a2d\u5b9a"}</h2>
      <p style={styles.sectionDescription}>
        {"\u732b\u306e\u8ffd\u52a0\u3084\u540d\u524d\u306e\u5909\u66f4\u306f\u3053\u3053\u304b\u3089\u3067\u304d\u307e\u3059\u3002"}
      </p>
      <div style={styles.settingsCatList}>
        {catProfiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            onClick={() => onCatSelect(profile.id)}
            style={
              profile.id === activeCatId
                ? styles.activeCatSwitchButton
                : styles.catSwitchButton
            }
          >
            {profile.name}
          </button>
        ))}
      </div>
      <div style={styles.settingsActions}>
        <button
          type="button"
          onClick={onStartAddingCat}
          style={styles.addCatButton}
        >
          {"\u732b\u3092\u8ffd\u52a0"}
        </button>
        <button
          type="button"
          onClick={onEditCatName}
          style={styles.addCatButton}
        >
          {"\u540d\u524d\u3092\u5909\u66f4"}
        </button>
      </div>
      {isAddingCat ? (
        <div style={styles.catNameEditor}>
          <label style={styles.catNameLabel} htmlFor="new-cat-name">
            {"\u3053\u306e\u5b50\u306e\u540d\u524d"}
          </label>
          <input
            id="new-cat-name"
            type="text"
            value={newCatNameInput}
            onChange={(event) => onNewCatNameInputChange(event.target.value)}
            placeholder={"\u4f8b\uff1a\u9ea6"}
            style={styles.catNameInput}
          />
          <div style={styles.catNameActions}>
            <button
              type="button"
              onClick={onAddCatSave}
              style={styles.catNameSaveButton}
            >
              {"\u4fdd\u5b58"}
            </button>
            <button
              type="button"
              onClick={onCancelAddingCat}
              style={styles.catNameCancelButton}
            >
              {"\u30ad\u30e3\u30f3\u30bb\u30eb"}
            </button>
          </div>
        </div>
      ) : null}
      {isEditingCatName ? (
        <div style={styles.catNameEditor}>
          <label style={styles.catNameLabel} htmlFor="cat-name">
            {"\u3053\u306e\u5b50\u306e\u540d\u524d"}
          </label>
          <input
            id="cat-name"
            type="text"
            value={catNameInput}
            onChange={(event) => onCatNameInputChange(event.target.value)}
            placeholder={"\u4f8b\uff1a\u30df\u30b1"}
            style={styles.catNameInput}
          />
          <div style={styles.catNameActions}>
            <button
              type="button"
              onClick={onCatNameSave}
              style={styles.catNameSaveButton}
            >
              {"\u4fdd\u5b58"}
            </button>
            <button
              type="button"
              onClick={onCancelCatNameEdit}
              style={styles.catNameCancelButton}
            >
              {"\u30ad\u30e3\u30f3\u30bb\u30eb"}
            </button>
          </div>
        </div>
      ) : null}
      {catNameMessage ? (
        <p style={styles.catNameMessage}>{catNameMessage}</p>
      ) : null}
    </section>
  );
}

function LatestHypothesisCard({
  hypothesis,
  cta,
  onMainAction,
  onSubAction,
}: {
  hypothesis: LatestHypothesisView;
  cta: { main: string; sub: string };
  onMainAction: () => void;
  onSubAction: () => void;
}) {
  return (
    <div style={styles.lastResult}>
      <p style={styles.lastResultLead}>
        {"\u3055\u3063\u304d\u306e\u69d8\u5b50\u304b\u3089"}
      </p>
      <p style={styles.lastResultText}>
        {hypothesis.text ??
          CATEGORY_MESSAGES[hypothesis.category] ??
          "\u4f55\u304b\u4f1d\u3048\u305f\u3044\u53ef\u80fd\u6027\u304c\u3042\u308a\u307e\u3059"}
      </p>
      <p style={styles.lastResultHint}>
        {"\u307e\u305a\u306f\u3067\u304d\u305d\u3046\u306a\u3053\u3068\u3060\u3051\u3067\u5927\u4e08\u592b\u3067\u3059\u3002\u9055\u3063\u305f\u3089\u3001\u9055\u3046\u304b\u3082\u3067\u6559\u3048\u3066\u304f\u3060\u3055\u3044\u3002"}
      </p>
      <div style={styles.hypothesisActions}>
        <button
          type="button"
          onClick={onMainAction}
          style={styles.hypothesisMainButton}
        >
          {cta.main}
        </button>
        <button
          type="button"
          onClick={onSubAction}
          style={styles.hypothesisSubButton}
        >
          {cta.sub}
        </button>
      </div>
    </div>
  );
}

function GuidanceBlock({
  catName,
  dailyHintHypothesis,
  onDailyHintMainAction,
  onDailyHintSubAction,
  onDailyHintTertiaryAction,
}: {
  catName: string;
  dailyHintHypothesis: DailyHintHypothesis;
  onDailyHintMainAction: () => void;
  onDailyHintSubAction: () => void;
  onDailyHintTertiaryAction: () => void;
}) {
  return (
    <div style={styles.guidance}>
      <p style={styles.predictionReason}>
        {`\u3044\u307e\u306e${catName}`}
      </p>
      <p style={styles.guidanceTitle}>{dailyHintHypothesis.text}</p>
      <div style={styles.predictionActions}>
        <button
          type="button"
          onClick={onDailyHintMainAction}
          style={{
            ...styles.hypothesisMainButton,
            ...styles.dailyHintPrimaryButton,
          }}
        >
          {dailyHintHypothesis.cta.main}
        </button>
        <button
          type="button"
          onClick={onDailyHintSubAction}
          style={styles.hypothesisSubButton}
        >
          {dailyHintHypothesis.cta.sub}
        </button>
        <button
          type="button"
          onClick={onDailyHintTertiaryAction}
          style={styles.hypothesisSubButton}
        >
          {dailyHintHypothesis.cta.tertiary}
        </button>
      </div>
    </div>
  );
}

function OptionSection<Option extends { label: string }>({
  label,
  title,
  options,
  description,
  variant = "current",
  message,
  errorMessage,
  activeCatId,
  recentStateRecords = [],
  onSelect,
}: {
  label?: string;
  title: string;
  options: Option[];
  description?: string;
  variant?: "current" | "concern";
  message?: string;
  errorMessage?: string;
  activeCatId?: string | null;
  recentStateRecords?: RecentStateRecord[];
  onSelect: (option: Option) => void;
}) {
  const sectionStyle =
    variant === "concern"
      ? { ...styles.section, ...styles.concernSection }
      : { ...styles.section, ...styles.currentSection };
  const buttonStyle =
    variant === "concern"
      ? { ...styles.button, ...styles.concernButton }
      : { ...styles.button, ...styles.currentButton };
  const gridStyle =
    variant === "concern"
      ? { ...styles.grid, ...styles.concernGrid }
      : { ...styles.grid, ...styles.currentGrid };
  const iconFrameStyle =
    variant === "concern"
      ? { ...styles.optionIconFrame, ...styles.concernOptionIconFrame }
      : { ...styles.optionIconFrame, ...styles.currentOptionIconFrame };
  const iconStyle =
    variant === "concern"
      ? { ...styles.optionIcon, ...styles.concernOptionIcon }
      : { ...styles.optionIcon, ...styles.currentOptionIcon };
  const labelStyle =
    variant === "concern"
      ? { ...styles.optionLabel, ...styles.concernOptionLabel }
      : { ...styles.optionLabel, ...styles.currentOptionLabel };

  return (
    <section style={sectionStyle}>
      {label ? <p style={styles.sectionLabel}>{label}</p> : null}
      <h2 style={styles.sectionTitle}>{title}</h2>
      {description ? (
        <p style={styles.sectionDescription}>{description}</p>
      ) : null}
      {message ? <p style={styles.sectionMessage}>{message}</p> : null}
      {errorMessage ? (
        <p style={styles.sectionErrorMessage}>{errorMessage}</p>
      ) : null}
      <div style={gridStyle}>
        {options.map((option) => {
          const signal =
            "signal" in option && typeof option.signal === "string"
              ? option.signal
              : "";
          const isCompleted =
            variant === "current" && signal
              ? isRecentStateRecorded({
                  records: recentStateRecords,
                  localCatId: activeCatId,
                  signal,
                })
              : false;

          return (
            <button
              key={option.label}
              type="button"
              onClick={() => onSelect(option)}
              style={
                isCompleted
                  ? {
                      ...buttonStyle,
                      ...styles.completedStateButton,
                    }
                  : buttonStyle
              }
            >
              <span style={iconFrameStyle}>
                <img
                  src={getOptionIconSrc(option.label)}
                  alt={getOptionDisplayLabel(option.label)}
                  style={
                    isCompleted
                      ? { ...iconStyle, ...styles.completedOptionIcon }
                      : iconStyle
                  }
                  onError={(event) => {
                    event.currentTarget.style.visibility = "hidden";
                  }}
                />
                {isCompleted ? (
                  <span style={styles.completedCheck} aria-hidden="true">
                    {"✓"}
                  </span>
                ) : null}
              </span>
              <span
                style={
                  isCompleted
                    ? { ...labelStyle, ...styles.completedOptionLabel }
                    : labelStyle
                }
              >
                {isCompleted ? "✓ 残しました" : getOptionDisplayLabel(option.label)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function getOptionIconSrc(label: string) {
  const icons: Record<string, string> = {
    "\u306d\u3066\u308b": "sleeping",
    "\u30b0\u30eb\u30fc\u30df\u30f3\u30b0": "grooming",
    "\u904a\u3093\u3067\u308b": "playing",
    "\u3054\u306f\u3093": "food",
    "\u30c8\u30a4\u30ec": "toilet",
    "\u30b4\u30ed\u30b4\u30ed\u3057\u3066\u308b": "purring",
    "\u9cf4\u3044\u3066\u308b": "meowing",
    "\u3064\u3044\u3066\u304f\u308b": "following",
    "\u843d\u3061\u7740\u304b\u306a\u3044": "restless",
    "\u5143\u6c17\u306a\u3044": "low_energy",
    "\u30b1\u30f3\u30ab\u3057\u3066\u308b": "fighting",
    "\u3088\u304f\u308f\u304b\u3089\u306a\u3044": "unknown",
  };

  return `/icons/cat-actions/${icons[label] ?? "unknown"}.png`;
}

function getSignalIconSrc(signal: string) {
  const icons: Record<string, string> = {
    sleeping: "sleeping",
    grooming: "grooming",
    playing: "playing",
    after_food: "food",
    food: "food",
    toilet: "toilet",
    purring: "purring",
    meowing: "meowing",
    following: "following",
    restless: "restless",
    low_energy: "low_energy",
    fighting: "fighting",
    unknown: "unknown",
  };

  return `/icons/cat-actions/${icons[signal] ?? "unknown"}.png`;
}

function getCatStateBadgeIconSrc(signal: string | null) {
  const icons: Record<string, string> = {
    sleeping: "sleeping",
    grooming: "grooming",
    playing: "playing",
    after_food: "food",
    food: "food",
    toilet: "toilet",
    purring: "purring",
    meowing: "meowing",
    following: "following",
    restless: "restless",
    low_energy: "low_energy",
    fighting: "fighting",
    unknown: "unknown",
  };

  if (!signal || !icons[signal]) {
    return null;
  }

  return `/icons/cat-actions/${icons[signal]}.png`;
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

function getOptionDisplayLabel(label: string) {
  const labels: Record<string, string> = {
    "\u30b0\u30eb\u30fc\u30df\u30f3\u30b0": "\u6bdb\u3065\u304f\u308d\u3044",
    "\u30b4\u30ed\u30b4\u30ed\u3057\u3066\u308b": "\u30b4\u30ed\u30b4\u30ed",
  };

  return labels[label] ?? label;
}

function getSignalDisplayLabel(signal: string) {
  const labels: Record<string, string> = {
    sleeping: "\u306d\u3066\u308b",
    grooming: "\u6bdb\u3065\u304f\u308d\u3044",
    playing: "\u904a\u3093\u3067\u308b",
    after_food: "\u3054\u306f\u3093",
    food: "\u3054\u306f\u3093",
    toilet: "\u30c8\u30a4\u30ec",
    purring: "\u30b4\u30ed\u30b4\u30ed",
    meowing: "\u9cf4\u3044\u3066\u308b",
    following: "\u3064\u3044\u3066\u304f\u308b",
    restless: "\u305d\u308f\u305d\u308f",
    low_energy: "\u5143\u6c17\u306a\u3044",
    fighting: "\u30b1\u30f3\u30ab\u3057\u3066\u308b",
    unknown: "\u3088\u304f\u308f\u304b\u3089\u306a\u3044",
  };

  return labels[signal] ?? signal;
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f7f3ee",
    color: "#27272a",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
    width: "min(100%, 430px)",
    margin: "0 auto",
    padding: "16px 14px calc(260px + env(safe-area-inset-bottom))",
  },
  actionArea: {
    scrollMarginTop: "18px",
  },
  headerEyebrow: {
    margin: "0 0 4px",
    color: "#71717a",
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: 0,
  },
  title: {
    margin: "2px 0 0",
    fontSize: "26px",
    fontWeight: 750,
    letterSpacing: 0,
    lineHeight: 1.2,
  },
  titleSwitchButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    margin: 0,
    padding: 0,
    border: 0,
    background: "transparent",
    color: "inherit",
    font: "inherit",
    fontWeight: "inherit",
    letterSpacing: 0,
    lineHeight: "inherit",
    textAlign: "left",
    cursor: "pointer",
  },
  titleChevron: {
    color: "#71717a",
    fontSize: "12px",
    fontWeight: 800,
    lineHeight: 1,
    transform: "translateY(1px)",
  },
  header: {
    marginBottom: "10px",
    border: "1px solid #ebe2d6",
    borderRadius: "26px",
    background: "linear-gradient(180deg, #fffdf9 0%, #fff7ec 100%)",
    padding: "15px 14px 14px",
    scrollMarginTop: "16px",
  },
  headerTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  profileHero: {
    display: "grid",
    gridTemplateColumns: "52px minmax(0, 1fr) auto",
    alignItems: "center",
    gap: "10px",
    marginTop: 0,
  },
  catAvatar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    width: "52px",
    height: "52px",
    border: "1px solid #eadbca",
    borderRadius: "20px",
    background: "#ffffff",
    overflow: "hidden",
  },
  catAvatarIcon: {
    display: "block",
    width: "42px",
    height: "42px",
    animation: "catAvatarSettle 220ms ease-out",
    objectFit: "contain",
    pointerEvents: "none",
    transition: "transform 160ms ease, opacity 160ms ease",
  },
  catAvatarBadge: {
    position: "absolute",
    right: "-3px",
    bottom: "-3px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    border: "1px solid rgba(234, 219, 202, 0.92)",
    borderRadius: "999px",
    background: "rgba(255, 253, 249, 0.96)",
    boxShadow: "0 1px 4px rgba(63, 63, 70, 0.08)",
  },
  catAvatarBadgeIcon: {
    display: "block",
    width: "16px",
    height: "16px",
    objectFit: "contain",
    pointerEvents: "none",
  },
  profileText: {
    minWidth: 0,
  },
  understandingPanel: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    minWidth: "58px",
  },
  understandingRing: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "46px",
    height: "46px",
    borderRadius: "999px",
  },
  understandingRingInner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "35px",
    height: "35px",
    borderRadius: "999px",
    background: "#fffdf9",
    color: "#3f3f46",
    fontSize: "10px",
    fontWeight: 800,
    lineHeight: 1,
  },
  catNameControls: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "10px",
  },
  catNameEditButton: {
    margin: 0,
    minHeight: "30px",
    padding: "0 12px",
    border: "1px solid #d4d4d8",
    borderRadius: "999px",
    background: "#fafafa",
    color: "#71717a",
    fontSize: "12px",
    fontWeight: 500,
    letterSpacing: 0,
    cursor: "pointer",
  },
  catChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "8px",
  },
  homeCatSwitcher: {
    marginTop: "10px",
    borderTop: "1px solid rgba(234, 219, 202, 0.58)",
    paddingTop: "10px",
  },
  headerGuide: {
    marginTop: "10px",
    border: "1px solid rgba(234, 219, 202, 0.65)",
    borderRadius: "17px",
    background: "rgba(255, 255, 255, 0.52)",
    padding: "9px 10px 10px",
  },
  catSwitchHint: {
    margin: "0 0 6px",
    color: "#8a8178",
    fontSize: "11px",
    fontWeight: 600,
    lineHeight: 1.45,
  },
  onboardingHomeMessage: {
    margin: "0 0 8px",
    color: "#52525b",
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.65,
    whiteSpace: "pre-line",
  },
  dashboardTiles: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 0,
    border: "1px solid rgba(234, 219, 202, 0.68)",
    borderRadius: "15px",
    background: "rgba(255, 250, 243, 0.66)",
    overflow: "hidden",
  },
  dashboardTile: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: "3px",
    borderRight: "1px solid rgba(234, 219, 202, 0.58)",
    background: "transparent",
    padding: "7px 9px",
  },
  dashboardTileLast: {
    borderRight: 0,
  },
  dashboardRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: "8px",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "6px",
  },
  statusLabel: {
    display: "block",
    color: "#6b5f54",
    fontSize: "10px",
    fontWeight: 700,
    lineHeight: 1.25,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  statusValue: {
    display: "block",
    minWidth: 0,
    overflow: "hidden",
    color: "#3f3f46",
    fontSize: "12px",
    fontWeight: 750,
    lineHeight: 1.25,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  signalChipRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: 0,
  },
  signalChip: {
    display: "inline-flex",
    alignItems: "center",
    border: "1px solid rgba(234, 219, 202, 0.72)",
    borderRadius: "999px",
    background: "rgba(255, 250, 243, 0.78)",
    color: "#6b5f54",
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: 1.4,
    padding: "3px 8px",
  },
  signalCount: {
    color: "#8a8178",
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: 1.4,
  },
  dayMap: {
    marginTop: "9px",
  },
  dayMapTitle: {
    margin: "0 0 6px",
    color: "#6b5f54",
    fontSize: "10px",
    fontWeight: 750,
    lineHeight: 1.4,
  },
  dayMapGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "5px",
  },
  dayMapItem: {
    display: "flex",
    minWidth: 0,
    minHeight: "54px",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
    border: "1px solid rgba(234, 219, 202, 0.72)",
    borderRadius: "12px",
    background: "rgba(255, 255, 255, 0.58)",
    color: "#3f3f46",
    padding: "5px 3px",
  },
  dayMapItemMuted: {
    background: "rgba(255, 255, 255, 0.36)",
    color: "#9a9188",
  },
  dayMapPeriod: {
    color: "inherit",
    fontSize: "9px",
    fontWeight: 750,
    lineHeight: 1.2,
  },
  dayMapIcon: {
    display: "block",
    width: "19px",
    height: "19px",
    objectFit: "contain",
    pointerEvents: "none",
  },
  dayMapDot: {
    display: "block",
    width: "6px",
    height: "6px",
    borderRadius: "999px",
    background: "#d8cbbb",
  },
  dayMapLabel: {
    display: "block",
    maxWidth: "100%",
    overflow: "hidden",
    color: "inherit",
    fontSize: "9px",
    fontWeight: 700,
    lineHeight: 1.25,
    textAlign: "center",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  headerGuideTitle: {
    margin: "0 0 2px",
    color: "#3f3f46",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.45,
  },
  headerGuideText: {
    margin: 0,
    color: "#71717a",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.5,
    whiteSpace: "pre-line",
  },
  recentSignalTrail: {
    display: "inline-flex",
    width: "fit-content",
    margin: "8px 0 0",
    border: "1px solid rgba(234, 219, 202, 0.72)",
    borderRadius: "999px",
    background: "rgba(255, 250, 243, 0.78)",
    color: "#6b5f54",
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: 1.45,
    padding: "3px 9px",
  },
  catChipLabel: {
    margin: 0,
    color: "#8a8178",
    fontSize: "11px",
    fontWeight: 600,
    letterSpacing: 0,
  },
  catChipButton: {
    minHeight: "36px",
    padding: "0 14px",
    border: "1px solid #d4d4d8",
    borderRadius: "999px",
    background: "#ffffff",
    color: "#27272a",
    fontSize: "13px",
    fontWeight: 500,
    letterSpacing: 0,
    cursor: "pointer",
  },
  activeCatChipButton: {
    minHeight: "36px",
    padding: "0 14px",
    border: "1px solid #a1a1aa",
    borderRadius: "999px",
    background: "#3f3f46",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 600,
    letterSpacing: 0,
    cursor: "pointer",
  },
  addCatChipButton: {
    minHeight: "34px",
    padding: "0 13px",
    border: "1px solid #d4d4d8",
    borderRadius: "999px",
    background: "#fafafa",
    color: "#52525b",
    fontSize: "13px",
    fontWeight: 500,
    letterSpacing: 0,
    cursor: "pointer",
  },
  catSwitcher: {
    marginTop: "10px",
  },
  catSwitchList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  catSwitchButton: {
    minHeight: "38px",
    padding: "0 14px",
    border: "1px solid #d4d4d8",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#27272a",
    fontSize: "14px",
    fontWeight: 500,
    letterSpacing: 0,
    cursor: "pointer",
  },
  activeCatSwitchButton: {
    minHeight: "38px",
    padding: "0 14px",
    border: "1px solid #a1a1aa",
    borderRadius: "12px",
    background: "#3f3f46",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 600,
    letterSpacing: 0,
    cursor: "pointer",
  },
  addCatButton: {
    minHeight: "36px",
    padding: "0 14px",
    border: "1px solid #d4d4d8",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#27272a",
    fontSize: "14px",
    fontWeight: 500,
    letterSpacing: 0,
    cursor: "pointer",
  },
  catNameEditor: {
    marginTop: "10px",
  },
  catNameLabel: {
    display: "block",
    marginBottom: "8px",
    color: "#71717a",
    fontSize: "13px",
    fontWeight: 500,
    letterSpacing: 0,
  },
  catNameInput: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: "48px",
    border: "1px solid #d4d4d8",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#27272a",
    fontSize: "15px",
    fontWeight: 500,
    letterSpacing: 0,
    padding: "0 14px",
  },
  catNameActions: {
    display: "flex",
    gap: "10px",
    marginTop: "10px",
  },
  catNameSaveButton: {
    minHeight: "40px",
    padding: "0 18px",
    border: "1px solid #a1a1aa",
    borderRadius: "12px",
    background: "#3f3f46",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 600,
    letterSpacing: 0,
    cursor: "pointer",
  },
  catNameCancelButton: {
    minHeight: "40px",
    padding: "0 18px",
    border: "1px solid #d4d4d8",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#27272a",
    fontSize: "14px",
    fontWeight: 500,
    letterSpacing: 0,
    cursor: "pointer",
  },
  catNameMessage: {
    margin: "8px 0 0",
    color: "#71717a",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  understanding: {
    display: "block",
    width: "62px",
    margin: 0,
    color: "#6b5f54",
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: 0,
    lineHeight: 1.35,
    textAlign: "center",
  },
  understandingMessage: {
    margin: "8px 0 0",
    color: "#71717a",
    fontSize: "13px",
    fontWeight: 400,
    letterSpacing: 0,
    lineHeight: 1.7,
  },
  understandingMeta: {
    display: "block",
    marginTop: "2px",
    color: "#a1a1aa",
    fontSize: "11px",
    fontWeight: 500,
    lineHeight: 1.5,
  },
  catSettings: {
    marginTop: "12px",
    marginBottom: "10px",
    border: "1px solid #e4e4e7",
    borderRadius: "22px",
    background: "#ffffff",
    padding: "16px",
    scrollMarginTop: "18px",
  },
  settingsEyebrow: {
    margin: "0 0 4px",
    color: "#71717a",
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: 0,
  },
  settingsCatList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "12px",
  },
  settingsActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "12px",
  },
  lastResult: {
    margin: 0,
    padding: 0,
  },
  lastResultLead: {
    margin: "0 0 4px",
    display: "inline-flex",
    width: "fit-content",
    border: "1px solid #eadbca",
    borderRadius: "999px",
    background: "#fffaf3",
    color: "#6b5f54",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.6,
    padding: "2px 9px",
  },
  lastResultText: {
    margin: "8px 0 0",
    color: "#27272a",
    fontSize: "16px",
    fontWeight: 600,
    lineHeight: 1.6,
  },
  lastResultHint: {
    margin: "6px 0 0",
    color: "#71717a",
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.6,
  },
  hypothesisActions: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
    marginTop: "14px",
  },
  hypothesisMainButton: {
    minHeight: "48px",
    border: "1px solid #a1a1aa",
    borderRadius: "14px",
    background: "#3f3f46",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 600,
    letterSpacing: 0,
    cursor: "pointer",
  },
  hypothesisSubButton: {
    minHeight: "48px",
    border: "1px solid #d4d4d8",
    borderRadius: "14px",
    background: "#ffffff",
    color: "#27272a",
    fontSize: "14px",
    fontWeight: 500,
    letterSpacing: 0,
    cursor: "pointer",
  },
  hypothesisMessage: {
    margin: "14px 0 0",
    color: "#52525b",
    fontSize: "13px",
    lineHeight: 1.7,
    whiteSpace: "pre-line",
  },
  insightCard: {
    marginBottom: "12px",
    border: "1px solid #eadbca",
    borderRadius: "28px",
    background: "linear-gradient(180deg, #fffaf3 0%, #fffdf9 100%)",
    padding: "18px 18px 19px",
  },
  guidance: {
    margin: 0,
  },
  predictionReason: {
    margin: "0 0 6px",
    display: "inline-flex",
    width: "fit-content",
    border: "1px solid #eadbca",
    borderRadius: "999px",
    background: "#ffffff",
    color: "#6b5f54",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.5,
    padding: "2px 9px",
  },
  guidanceTitle: {
    margin: "0 0 4px",
    color: "#27272a",
    fontSize: "15px",
    fontWeight: 600,
    lineHeight: 1.6,
  },
  guidanceText: {
    margin: 0,
    color: "#71717a",
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.6,
  },
  predictionActions: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
    marginTop: "14px",
  },
  dailyHintPrimaryButton: {
    gridColumn: "1 / -1",
  },
  predictionButton: {
    minHeight: "48px",
    border: "1px solid #d4d4d8",
    borderRadius: "14px",
    background: "#ffffff",
    color: "#27272a",
    fontSize: "14px",
    fontWeight: 500,
    letterSpacing: 0,
    cursor: "pointer",
  },
  section: {
    marginBottom: "12px",
    border: "1px solid #e4e4e7",
    borderRadius: "26px",
    background: "#ffffff",
    padding: "18px 16px",
  },
  currentSection: {
    borderColor: "#e4e4e7",
    background: "#ffffff",
  },
  concernSection: {
    borderColor: "#eadbca",
    background: "#fffdf9",
  },
  sectionLabel: {
    margin: "0 0 5px",
    color: "#71717a",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.5,
  },
  sectionTitle: {
    margin: "0 0 10px",
    fontSize: "19px",
    fontWeight: 700,
    letterSpacing: 0,
  },
  sectionDescription: {
    margin: "-6px 0 14px",
    color: "#71717a",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  sectionMessage: {
    margin: "-4px 0 14px",
    color: "#52525b",
    fontSize: "13px",
    lineHeight: 1.7,
    whiteSpace: "pre-line",
  },
  sectionErrorMessage: {
    margin: "-4px 0 14px",
    color: "#52525b",
    fontSize: "13px",
    lineHeight: 1.7,
    whiteSpace: "pre-line",
  },
  grid: {
    display: "grid",
    gap: "10px",
  },
  currentGrid: {
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
  },
  concernGrid: {
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
  },
  button: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    minHeight: "98px",
    border: "1px solid #d4d4d8",
    borderRadius: "22px",
    background: "#ffffff",
    color: "#27272a",
    fontWeight: 600,
    letterSpacing: 0,
    textAlign: "center",
    padding: "10px 7px 11px",
    cursor: "pointer",
  },
  currentButton: {
    background: "#ffffff",
    borderColor: "#d4d4d8",
  },
  concernButton: {
    background: "#fffaf3",
    borderColor: "#eadbca",
    fontWeight: 600,
    minHeight: "104px",
    gap: "7px",
    padding: "10px 6px 11px",
  },
  optionIconFrame: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    background: "transparent",
    position: "relative",
  },
  currentOptionIconFrame: {
    width: "48px",
    height: "48px",
  },
  concernOptionIconFrame: {
    width: "42px",
    height: "42px",
  },
  optionIcon: {
    display: "block",
    objectFit: "contain",
    pointerEvents: "none",
  },
  currentOptionIcon: {
    width: "46px",
    height: "46px",
  },
  concernOptionIcon: {
    width: "39px",
    height: "39px",
  },
  optionLabel: {
    display: "block",
    lineHeight: 1.3,
    letterSpacing: 0,
  },
  currentOptionLabel: {
    fontSize: "13px",
    fontWeight: 600,
  },
  concernOptionLabel: {
    fontSize: "13px",
    fontWeight: 650,
  },
  completedStateButton: {
    background: "#f8f4ee",
    borderColor: "#d7c8b8",
    opacity: 0.78,
    transform: "scale(0.98)",
    transition:
      "background 180ms ease, border-color 180ms ease, opacity 180ms ease, transform 160ms ease",
  },
  completedOptionIcon: {
    opacity: 0.78,
    transform: "scale(0.96)",
  },
  completedCheck: {
    position: "absolute",
    right: "-3px",
    top: "-4px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "18px",
    height: "18px",
    borderRadius: "999px",
    background: "#3f3f46",
    color: "#ffffff",
    fontSize: "12px",
    fontWeight: 800,
    lineHeight: 1,
  },
  completedOptionLabel: {
    color: "#6b5f54",
    fontSize: "12px",
    fontWeight: 700,
  },
  bottomNav: {
    position: "fixed",
    left: "50%",
    bottom: "calc(18px + env(safe-area-inset-bottom))",
    zIndex: 20,
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "6px",
    width: "min(calc(100% - 28px), 402px)",
    transform: "translateX(-50%)",
    border: "1px solid rgba(212, 212, 216, 0.9)",
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.94)",
    boxShadow: "0 12px 30px rgba(39, 39, 42, 0.08)",
    padding: "6px",
    backdropFilter: "blur(14px)",
  },
  navButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "42px",
    border: "none",
    borderRadius: "999px",
    background: "transparent",
    color: "#71717a",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: 0,
    cursor: "pointer",
  },
  activeNavButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "42px",
    border: "none",
    borderRadius: "999px",
    background: "#3f3f46",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: 0,
    cursor: "pointer",
  },
} satisfies Record<string, CSSProperties>;
