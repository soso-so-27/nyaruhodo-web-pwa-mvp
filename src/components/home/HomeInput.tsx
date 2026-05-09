"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { calculateUnderstandingPercent } from "../../core/understanding/understanding";
import { buildCalendarContext } from "../../lib/calendarContext";
import { getPoseCategoryForSignal } from "../../lib/collection/poses";
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
  ensureActiveCatTraitMemo,
  getActiveCatProfile,
  getCatName,
  getHypothesisCompletionMessage,
  isCurrentCatHintSuppressed,
  parseStoredContext,
  readActiveCatId,
  readActiveCatTraitMemo,
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
  CatTraitMemo,
  CurrentCatHintFeedback,
  CurrentCatHintSuppression,
  DailyHintHypothesis,
  LatestHypothesisView,
} from "./homeInputHelpers";

type HomeInputProps = {
  recentEvents: RecentEvent[];
};

const eventSaveErrorMessage =
  "\u4fdd\u5b58\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002\n\u901a\u4fe1\u72b6\u614b\u3092\u78ba\u8a8d\u3057\u3066\u3001\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002";

const feedbackSaveErrorMessage =
  "\u884c\u52d5\u306e\u8a18\u9332\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\n\u5c11\u3057\u6642\u9593\u3092\u304a\u3044\u3066\u3001\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002";

const concernSaveSuccessMessage =
  "\u6b8b\u3057\u307e\u3057\u305f\u3002\n{catName}\u306e\u69d8\u5b50\u304c\u3001\u5c11\u3057\u305a\u3064\u305f\u307e\u3063\u3066\u3044\u304d\u307e\u3059\u3002";

const ONBOARDING_HOME_HINT_KEY = "diagnosis_onboarding_home_hint";
const ONBOARDING_HOME_HINT_MAX_AGE_MS = 10 * 60 * 1000;
const POST_DIAGNOSIS_FEEDBACK_KEY = "post_diagnosis_feedback";
const RECENT_STATE_RECORDS_KEY = "recent_state_records";
const RECENT_STATE_RECORD_TTL_MS = 30 * 60 * 1000;
const RECENT_CAT_SUMMARY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const SAMPLE_HOME_CAT_PHOTO_SRC = "/sample-cats/home-hero-generated.png";

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

export function HomeInput({
  recentEvents,
}: HomeInputProps) {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [visibleLatestHypothesis, setVisibleLatestHypothesis] =
    useState<LatestHypothesisView | null>(null);
  const [catProfiles, setCatProfiles] = useState<CatProfile[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [catTraitMemo, setCatTraitMemo] = useState<CatTraitMemo | null>(null);
  const [isEditingCatName, setIsEditingCatName] = useState(false);
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [catNameInput, setCatNameInput] = useState(() => getCatName(null));
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
  const activeCatEvents = isHydrated && activeCatId
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
  const activeCatTraitLabel =
    activeCatProfile?.typeLabel ?? catTraitMemo?.typeLabel;
  const activeCatModifiers =
    activeCatProfile?.modifiers ?? catTraitMemo?.modifiers ?? [];
  const activeCatTypeKey =
    activeCatProfile?.typeKey ??
    (catTraitMemo as { typeKey?: string } | null)?.typeKey;
  const currentTimeBand = buildCalendarContext().timeBand;
  const suggestedSignals = isHydrated
    ? getSuggestedSignals({
        timeBand: currentTimeBand,
        typeKey: activeCatTypeKey,
        modifiers: activeCatModifiers,
      })
    : [];

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
    const profileState = ensureActiveCatTraitMemo(
      savedCatProfiles,
      activeProfile.id,
    );

    setCatProfiles(profileState.profiles);
    setActiveCatId(profileState.activeProfile.id);
    setCatTraitMemo(
      readActiveCatTraitMemo(savedActiveCatId) ??
        readActiveCatTraitMemo(profileState.activeProfile.id) ??
        profileState.traitMemo,
    );
    setCatNameInput(getCatName(profileState.activeProfile));
    setHintSuppressions(readCurrentCatHintSuppressions());
    setRecentStateRecords(readRecentStateRecords());
    saveActiveCatId(profileState.activeProfile.id);
    setOnboardingHomeMessage(
      readOnboardingHomeMessage(profileState.activeProfile.id),
    );
    const postDiagnosisMessage = readPostDiagnosisFeedbackMessage(
      profileState.activeProfile.id,
      getCatName(profileState.activeProfile),
    );

    setPostDiagnosisFeedbackMessage(postDiagnosisMessage);
    if (postDiagnosisMessage) {
      window.setTimeout(() => {
        window.localStorage.removeItem(POST_DIAGNOSIS_FEEDBACK_KEY);
      }, 0);
    }
    setIsHydrated(true);

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
    setCatTraitMemo(readActiveCatTraitMemo(catId));
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
    const firstPoseDiscovery = getFirstPoseDiscovery({
      events: activeCatEvents,
      recentStateRecords,
      localCatId: activeCatId,
      signal,
      label,
    });
    const calendarContext = buildCalendarContext();
    const event = await insertEvent({
      event_type: "current_state",
      signal,
      label,
      source: "home",
      calendarContext,
      localCatId: activeCatId,
    });

    if (!event) {
      setSaveErrorSection("current");
      setSaveErrorMessage(eventSaveErrorMessage);
      return;
    }

    setSaveErrorSection("");
    setSaveErrorMessage("");
    const successMessage = buildCurrentStateSuccessMessage({
      catName,
      label,
      signal,
      isFirst: isFirstSignal,
      totalEventCount: activeCatEvents.length,
      timeBand: calendarContext.timeBand,
      typeKey: activeCatTypeKey,
    });
    setCurrentStateMessage(
      buildSaveSuccessMessage(successMessage, firstPoseDiscovery?.label),
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
    const firstPoseDiscovery = getFirstPoseDiscovery({
      events: activeCatEvents,
      recentStateRecords,
      localCatId: activeCatId,
      signal: input,
      label,
    });
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

    setSaveErrorSection("");
    setSaveErrorMessage("");
    setCurrentStateMessage(
      buildSaveSuccessMessage(
        concernSaveSuccessMessage.replace("{catName}", catName),
        firstPoseDiscovery?.label,
      ),
    );
    setRecentStateRecords(
      saveRecentStateRecord({
        localCatId: activeCatId,
        signal: input,
        label,
      }),
    );
    setIsDailyHintDismissed(false);
    router.refresh();
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
          catTraitLabel={activeCatTraitLabel}
          catModifiers={activeCatModifiers}
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
          <section style={styles.observationCard}>
            <h2 style={styles.sectionTitle}>
              {`${catName}\u306f\u3044\u307e\u3069\u3046\u3057\u3066\u308b\uff1f`}
            </h2>
            <p style={styles.tapPrompt}>
              {"\u3044\u3061\u3070\u3093\u8fd1\u3044\u306e\u3092\u3072\u3068\u3064\u3060\u3051"}
            </p>
            {currentStateMessage ? (
              <p style={styles.sectionMessage}>{currentStateMessage}</p>
            ) : null}
            {saveErrorMessage ? (
              <p
                style={styles.saveErrorAlert}
                role="alert"
                aria-label={
                  saveErrorSection === "concern"
                    ? "\u3061\u3087\u3063\u3068\u6c17\u306b\u306a\u308b\u306e\u4fdd\u5b58\u30a8\u30e9\u30fc"
                    : "\u3044\u3064\u3082\u306e\u69d8\u5b50\u306e\u4fdd\u5b58\u30a8\u30e9\u30fc"
                }
              >
                {saveErrorMessage}
              </p>
            ) : null}

            <OptionSection
              title=""
              options={[...CURRENT_OPTIONS, ...CONCERN_OPTIONS]}
              variant="current"
              embedded
              suggestedSignals={suggestedSignals}
              activeCatId={activeCatId}
              recentStateRecords={recentStateRecords}
              onSelect={(option) => {
                if ("signal" in option) {
                  void handleCurrentSelect(option.label, option.signal);
                  return;
                }

                void handleConcernSelect(option.label, option.input);
              }}
            />
          </section>
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

function getFirstPoseDiscovery({
  events,
  recentStateRecords,
  localCatId,
  signal,
  label,
}: {
  events: RecentEvent[];
  recentStateRecords: RecentStateRecord[];
  localCatId?: string | null;
  signal: string;
  label: string;
}) {
  const pose = getPoseCategoryForSignal(signal, label);

  if (!pose) {
    return null;
  }

  const hasSavedPose = events.some((event) => {
    const savedPose = getPoseCategoryForSignal(event.signal, event.label);

    return savedPose?.slug === pose.slug;
  });

  if (hasSavedPose) {
    return null;
  }

  const normalizedCatId = localCatId ?? null;
  const now = Date.now();
  const hasRecentPose = recentStateRecords.some((record) => {
    const expiresAt = new Date(record.expiresAt).getTime();
    const savedPose = getPoseCategoryForSignal(record.signal, record.label);

    return (
      record.localCatId === normalizedCatId &&
      savedPose?.slug === pose.slug &&
      !Number.isNaN(expiresAt) &&
      expiresAt > now
    );
  });

  return hasRecentPose ? null : pose;
}

function buildSaveSuccessMessage(message: string, discoveredPoseLabel?: string) {
  if (!discoveredPoseLabel) {
    return message;
  }

  return `${message}\n「${discoveredPoseLabel}」の記録が入りました`;
}

function Header({
  activeCatId,
  catName,
  catProfiles,
  catCoat,
  catTraitLabel,
  catModifiers,
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
  catTraitLabel?: string;
  catModifiers: string[];
  onboardingHomeMessage: string;
  postDiagnosisFeedbackMessage: string;
  recentCatSummary: RecentCatSummary;
  understandingPercent: number;
  onCatSelect: (catId: string) => void;
}) {
  const [isCatSheetOpen, setIsCatSheetOpen] = useState(false);
  const ringDegree = Math.max(0, Math.min(100, understandingPercent)) * 3.6;
  const canSwitchCats = catProfiles.length > 1;
  const catAvatarStyle = getCatCoatAvatarStyle(catCoat);
  const photoBorderColor =
    typeof catAvatarStyle.borderColor === "string"
      ? catAvatarStyle.borderColor
      : "#e4e1da";
  const visibleCatModifiers = catModifiers.filter(Boolean).slice(0, 2);
  const isDayMapEmpty = recentCatSummary.dayMap.every((item) => !item.signal);

  return (
    <header style={styles.header}>
      <div style={{ ...styles.photoHero, borderColor: photoBorderColor }}>
        <div style={styles.photoArea}>
        <img src={SAMPLE_HOME_CAT_PHOTO_SRC} alt="" style={styles.photoHeroImage} />
        <div style={styles.photoHeroFade} aria-hidden="true" />
        <div style={styles.photoHeroContent}>
          <h1 style={styles.title}>
            {canSwitchCats ? (
              <button
                type="button"
                onClick={() => setIsCatSheetOpen(true)}
                style={styles.titleSwitchButton}
              >
                <span>{catName}</span>
                <span style={styles.titleChevron} aria-hidden="true">
                  {"▼"}
                </span>
              </button>
            ) : (
              <>{catName}</>
            )}
          </h1>
          {onboardingHomeMessage ? (
            <p style={styles.onboardingHomeMessage}>{onboardingHomeMessage}</p>
          ) : null}
          {postDiagnosisFeedbackMessage ? (
            <p style={styles.onboardingHomeMessage}>
              {postDiagnosisFeedbackMessage}
            </p>
          ) : null}
        </div>
        <div style={styles.understandingPanel}>
          <div
            style={{
              ...styles.understandingRing,
              background: `conic-gradient(#858b7c ${ringDegree}deg, rgba(255, 255, 255, 0.76) 0deg)`,
            }}
            aria-label={`理解度 ${understandingPercent}%`}
          >
            <span style={styles.understandingRingInner}>
              <span style={styles.understandingRingLabel}>理解度</span>
              <span style={styles.understandingRingPercent}>
                {understandingPercent}
                {"%"}
              </span>
            </span>
          </div>
        </div>
        </div>
        <div style={styles.cardBody}>
          <div style={styles.catInfoCard}>
      {catTraitLabel ? (
        <section style={styles.catTraitSection} aria-label={`${catName}\u306e\u3053\u3068`}>
          <p style={styles.catTraitTitle}>{"\u3053\u306e\u5b50\u306e\u3053\u3068"}</p>
          <div style={styles.catTraitPills}>
            <span style={styles.catTraitPill}>{catTraitLabel}</span>
          </div>
          {visibleCatModifiers.length > 0 ? (
            <div style={styles.catModifierTags}>
              {visibleCatModifiers.map((modifier) => (
                <span key={modifier} style={styles.catModifierTag}>
                  {modifier}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
      <div style={styles.headerSummary}>
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
          {isDayMapEmpty ? (
            <p style={styles.dayMapEmptyHint}>
              {"\u8a18\u9332\u304c\u6e9c\u307e\u308b\u3068\u3001\u3053\u306e\u5b50\u306e1\u65e5\u306e\u30ea\u30ba\u30e0\u304c\u898b\u3048\u3066\u304d\u307e\u3059"}
            </p>
          ) : null}
        </div>
      </div>
          </div>
        </div>
      </div>
      {isCatSheetOpen ? (
        <>
          <div
            style={styles.catSheetOverlay}
            onClick={() => setIsCatSheetOpen(false)}
          />
          <div style={styles.catSheet}>
            <div style={styles.catSheetHandle} />
            <p style={styles.catSheetTitle}>猫を選ぶ</p>
            <div style={styles.catSheetGrid}>
              {catProfiles.map((profile) => {
                const isSelected = profile.id === activeCatId;
                const age = formatCatAge(profile.basicInfo?.birthDate);
                const gender = formatCatGender(profile.basicInfo?.gender);
                const meta = [gender, age].filter(Boolean).join("・");

                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => {
                      onCatSelect(profile.id);
                      setIsCatSheetOpen(false);
                    }}
                    style={styles.catSheetItem}
                  >
                    <div
                      style={
                        isSelected
                          ? { ...styles.catSheetAvatar, ...styles.catSheetAvatarActive }
                          : styles.catSheetAvatar
                      }
                    >
                      {profile.avatarDataUrl ? (
                        <img
                          src={profile.avatarDataUrl}
                          alt={profile.name}
                          style={styles.catSheetAvatarPhoto}
                        />
                      ) : (
                        <img
                          src={getCatAvatarSrc(profile.appearance?.coat)}
                          alt={profile.name}
                          style={styles.catSheetAvatarImg}
                        />
                      )}
                    </div>
                    <span style={styles.catSheetName}>{profile.name}</span>
                    {meta ? (
                      <span style={styles.catSheetMeta}>{meta}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <a
              href="/cats"
              style={styles.catSheetLink}
              onClick={() => setIsCatSheetOpen(false)}
            >
              ねこタブで管理する ›
            </a>
          </div>
        </>
      ) : null}
    </header>
  );
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
      : "\u8a18\u9332\u304c\u5897\u3048\u308b\u3068\u898b\u3048\u3066\u304d\u307e\u3059",
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
    return "\u307e\u3060\u8a18\u9332\u304c\u3042\u308a\u307e\u305b\u3093";
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

function formatAge(birthDate?: string): string {
  if (!birthDate) {
    return "";
  }

  const birth = new Date(birthDate);

  if (Number.isNaN(birth.getTime())) {
    return "";
  }

  const now = new Date();
  let totalMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());

  if (now.getDate() < birth.getDate()) {
    totalMonths -= 1;
  }

  if (totalMonths < 0) {
    return "";
  }

  if (totalMonths < 12) {
    return `${totalMonths}ヶ月`;
  }

  if (totalMonths < 24) {
    return "1歳";
  }

  return `${Math.floor(totalMonths / 12)}歳`;
}

function formatGender(gender?: string): string {
  if (gender === "male") {
    return "男の子";
  }

  if (gender === "female") {
    return "女の子";
  }

  return "";
}

function formatCatAge(birthDate?: string): string {
  return formatAge(birthDate);
}

function formatCatGender(gender?: string): string {
  return formatGender(gender);
}

function getCatAvatarSrc(coat?: string): string {
  const coatMap: Record<string, string> = {
    saba: "/sample-cats/saba.png",
    gray: "/sample-cats/gray.png",
    orange_tabby: "/sample-cats/orange_tabby.png",
    black: "/sample-cats/black.png",
    white: "/sample-cats/white.png",
    calico: "/sample-cats/calico.png",
    cream: "/sample-cats/saba.png",
  };

  return coatMap[coat ?? ""] ?? "/sample-cats/saba.png";
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
      <div style={styles.catList}>
        {catProfiles.map((profile) => {
          const age = formatAge(profile.basicInfo?.birthDate);
          const gender = formatGender(profile.basicInfo?.gender);
          const meta = [gender, age].filter(Boolean).join("・");
          const understanding = profile.understanding?.percent ?? 0;
          const isActive = profile.id === activeCatId;

          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => onCatSelect(profile.id)}
              style={isActive ? styles.catListItemActive : styles.catListItem}
            >
              <div style={styles.catListAvatar}>
                {profile.avatarDataUrl ? (
                  <img
                    src={profile.avatarDataUrl}
                    alt=""
                    style={styles.catListAvatarPhoto}
                  />
                ) : (
                  <img
                    src={getCatAvatarSrc(profile.appearance?.coat)}
                    alt=""
                    style={styles.catListAvatarImg}
                  />
                )}
              </div>
              <div style={styles.catListInfo}>
                <span style={styles.catListName}>{profile.name}</span>
                {meta ? <span style={styles.catListMeta}>{meta}</span> : null}
                <div style={styles.catListProgress}>
                  <div style={styles.catListProgressBar}>
                    <div
                      style={{
                        ...styles.catListProgressFill,
                        width: `${Math.min(100, Math.max(0, understanding))}%`,
                      }}
                    />
                  </div>
                  <span style={styles.catListProgressLabel}>
                    {understanding}
                    {"%"}
                  </span>
                </div>
              </div>
              <span style={styles.catListChevron}>›</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onStartAddingCat}
        style={styles.addCatListButton}
      >
        ＋ 猫を追加
      </button>
      <div style={styles.settingsActions}>
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
  embedded = false,
  message,
  errorMessage,
  activeCatId,
  recentStateRecords = [],
  suggestedSignals = [],
  onSelect,
}: {
  label?: string;
  title: string;
  options: Option[];
  description?: string;
  variant?: "current" | "concern";
  embedded?: boolean;
  message?: string;
  errorMessage?: string;
  activeCatId?: string | null;
  recentStateRecords?: RecentStateRecord[];
  suggestedSignals?: string[];
  onSelect: (option: Option) => void;
}) {
  const sectionStyle = embedded
    ? variant === "concern"
      ? { ...styles.embeddedSection, ...styles.embeddedConcernSection }
      : styles.embeddedSection
    : variant === "concern"
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
      {title ? <h2 style={styles.sectionTitle}>{title}</h2> : null}
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
              : "input" in option && typeof option.input === "string"
                ? option.input
              : "";
          const isCompleted =
            signal
              ? isRecentStateRecorded({
                  records: recentStateRecords,
                  localCatId: activeCatId,
                  signal,
                })
              : false;
          const isSuggested = signal
            ? suggestedSignals.includes(getSuggestedSignalKey(signal))
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
                  : isSuggested
                    ? { ...buttonStyle, ...styles.suggestedStateButton }
                  : buttonStyle
              }
            >
              <span style={iconFrameStyle} aria-hidden="true">
                <img
                  src={getSignalIconSrc(signal)}
                  alt=""
                  style={{ width: "40px", height: "40px", objectFit: "contain" }}
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

function buildCurrentStateSuccessMessage({
  catName,
  label,
  signal,
  isFirst,
  totalEventCount,
  timeBand,
  typeKey,
}: {
  catName: string;
  label: string;
  signal: string;
  isFirst: boolean;
  totalEventCount: number;
  timeBand: string;
  typeKey?: string;
}): string {
  const messageSignal = getSuggestedSignalKey(signal);

  if (totalEventCount === 0) {
    return `はじめての記録！\n${catName}のことが、少しずつ見えてきます。`;
  }

  if (isFirst) {
    return `${getOptionDisplayLabel(label)}、見つけました。\nこの様子も${catName}の一部です。`;
  }

  if ((totalEventCount + 1) % 5 === 0) {
    return `${totalEventCount + 1}回目の記録！\n${catName}のことが、だいぶ見えてきました。`;
  }

  const timeBandMessages: Record<string, Record<string, string>> = {
    morning: {
      grooming: "朝の毛づくろい、いつも通りですね。",
      sleeping: `朝もまだねてる${catName}。`,
      food: "朝ごはんの時間、ちゃんと食べてますね。",
    },
    daytime: {
      sleeping: "昼間はねてることが多そうですね。",
      playing: `昼間に遊んでる${catName}、元気そう。`,
    },
    evening: {
      food: "夕ごはんの時間、敏感そうですね。",
      following: `夕方はついてくる${catName}。`,
    },
    night: {
      sleeping: `夜はやっぱりねてる${catName}。`,
      playing: `夜に遊ぶ${catName}、夜型かも。`,
      purring: "夜のゴロゴロ、リラックスしてますね。",
    },
    late_night: {
      sleeping: `深夜もねてる${catName}。`,
    },
    early_morning: {
      sleeping: "早朝もまだねてます。",
      food: "早起きして待ってたのかも。",
    },
  };

  const timeBandMsg = timeBandMessages[timeBand]?.[messageSignal];
  if (timeBandMsg && Math.random() < 0.25) {
    return `残しました。\n${timeBandMsg}`;
  }

  const typeKeyMessages: Record<string, Record<string, string>> = {
    play: {
      playing: "やっぱり遊ぶのが好きそう。",
      sleeping: "遊び疲れてねてるのかも。",
    },
    food: {
      food: "ごはんへの反応、敏感ですね。",
      following: "ごはん待ちでついてきてるのかも。",
    },
    social: {
      following: "かまってほしい気持ちが出てますね。",
      purring: "一緒にいるのが好きそう。",
    },
    stress: {
      restless: "少し落ち着かない様子ですね。",
      unknown: "よくわからないときは、様子見でOK。",
    },
  };

  const typeMsg = typeKey ? typeKeyMessages[typeKey]?.[messageSignal] : undefined;
  if (typeMsg && Math.random() < 0.20) {
    return `残しました。\n${typeMsg}`;
  }

  const defaults = [
    `残しました。\n${catName}のことが、少しずつ見えてきます。`,
    `残しました。\n小さな記録が、${catName}の理解につながります。`,
    `残しました。\nこうして見ていくと、${catName}のことがわかってきます。`,
  ];
  return defaults[totalEventCount % defaults.length];
}

function getSuggestedSignals({
  timeBand,
  typeKey,
  modifiers,
}: {
  timeBand: string;
  typeKey?: string;
  modifiers: string[];
}): string[] {
  const suggestions: string[] = [];

  const timeBandSuggestions: Record<string, string[]> = {
    early_morning: ["food", "grooming"],
    morning: ["grooming", "food", "sleeping"],
    daytime: ["sleeping", "purring"],
    evening: ["food", "following"],
    night: ["sleeping", "purring", "playing"],
    late_night: ["sleeping"],
  };
  const timeSuggested = timeBandSuggestions[timeBand] ?? [];
  suggestions.push(...timeSuggested.slice(0, 1));

  const typeKeySuggestions: Record<string, string[]> = {
    play: ["playing"],
    food: ["food"],
    social: ["following", "purring"],
    stress: ["restless"],
    balanced: [],
  };
  if (typeKey) {
    const typeSuggested = typeKeySuggestions[typeKey] ?? [];
    suggestions.push(...typeSuggested.slice(0, 1));
  }

  if (
    modifiers.includes("夜に元気") &&
    (timeBand === "night" || timeBand === "late_night")
  ) {
    suggestions.push("playing");
  }
  if (modifiers.includes("遊び不足で爆発")) {
    suggestions.push("playing");
  }

  return [...new Set(suggestions)].slice(0, 2);
}

function getSuggestedSignalKey(signal: string) {
  return signal === "after_food" ? "food" : signal;
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
      borderColor: "#dfc7a8",
      background: "linear-gradient(180deg, #fbf3e7 0%, #e6d0b3 100%)",
    },
    black: {
      borderColor: "#625f59",
      background: "linear-gradient(180deg, #e6e3de 0%, #8d8881 100%)",
    },
    white: {
      borderColor: "#dedbd3",
      background: "linear-gradient(180deg, #ffffff 0%, #f4f4f5 100%)",
    },
    calico: {
      borderColor: "#ded6ca",
      background:
        "linear-gradient(135deg, #faf6ee 0%, #faf6ee 44%, #ead8be 45%, #ead8be 64%, #e1ded8 65%, #e1ded8 100%)",
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
    background: "linear-gradient(180deg, #fdfcf9 0%, #f7f5ef 100%)",
    color: "#242522",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
    width: "min(100%, 430px)",
    margin: "0 auto",
    padding: "14px 14px calc(236px + env(safe-area-inset-bottom))",
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
    fontWeight: 720,
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
    fontWeight: 720,
    lineHeight: 1,
    transform: "translateY(1px)",
  },
  header: {
    marginBottom: "12px",
    border: "0",
    borderRadius: "0",
    background: "transparent",
    padding: 0,
    scrollMarginTop: "16px",
  },
  photoHero: {
    position: "relative",
    border: "1px solid rgba(219, 216, 207, 0.72)",
    borderRadius: "32px",
    background: "#fbfaf7",
    overflow: "hidden",
    boxShadow: "0 12px 28px rgba(44, 42, 38, 0.032)",
  },
  photoArea: {
    position: "relative",
    height: "300px",
    overflow: "hidden",
    borderRadius: "32px 32px 0 0",
  },
  cardBody: {
    padding: "0 14px 16px",
    background: "#fbfaf7",
    borderRadius: "0 0 32px 32px",
  },
  catInfoCard: {
    border: "1px solid rgba(219, 216, 207, 0.72)",
    borderRadius: "0 0 24px 24px",
    background: "#ffffff",
    padding: "12px 14px",
    marginTop: "0",
  },
  photoHeroImage: {
    position: "absolute",
    inset: "-1px",
    display: "block",
    width: "calc(100% + 2px)",
    height: "calc(100% + 2px)",
    objectFit: "cover",
    objectPosition: "43% top",
    filter: "saturate(0.9) contrast(0.96) brightness(1.04)",
  },
  photoHeroFade: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 36%, rgba(251,250,247,0.12) 49%, rgba(251,250,247,0.52) 61%, rgba(251,250,247,0.9) 75%, #fbfaf7 90%, #fbfaf7 100%), linear-gradient(90deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.02) 44%, rgba(255,255,255,0) 100%)",
  },
  photoHeroContent: {
    position: "absolute",
    left: "12px",
    right: "12px",
    bottom: "16px",
    zIndex: 2,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    border: "0",
    borderRadius: "0",
    background: "transparent",
    boxShadow: "none",
    padding: "0 4px",
    backdropFilter: "none",
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
    border: "1px solid #ddd8cf",
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
  profileText: {
    minWidth: 0,
  },
  understandingPanel: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
    minWidth: "72px",
    position: "absolute",
    right: "20px",
    top: "28px",
    zIndex: 2,
    border: "1px solid rgba(232, 230, 224, 0.66)",
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.78)",
    boxShadow: "0 12px 24px rgba(43, 40, 34, 0.04)",
    padding: "8px 7px 9px",
    backdropFilter: "blur(14px)",
  },
  understandingRing: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "56px",
    height: "56px",
    borderRadius: "999px",
  },
  understandingRingInner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    gap: "2px",
    width: "44px",
    height: "44px",
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.92)",
    color: "#3f433d",
    fontWeight: 680,
    lineHeight: 1,
  },
  understandingRingLabel: {
    color: "#6c6a61",
    fontSize: "7px",
    fontWeight: 650,
    lineHeight: 1,
  },
  understandingRingPercent: {
    color: "#343733",
    fontSize: "14px",
    fontWeight: 680,
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
    border: "1px solid #dedbd3",
    borderRadius: "999px",
    background: "#fafafa",
    color: "#71717a",
    fontSize: "12px",
    fontWeight: 500,
    letterSpacing: 0,
    cursor: "pointer",
  },
  catSheetOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.3)",
    zIndex: 50,
  },
  catSheet: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "#fbfaf7",
    borderRadius: "20px 20px 0 0",
    zIndex: 51,
    padding: "0 20px calc(32px + env(safe-area-inset-bottom))",
  },
  catSheetHandle: {
    width: "36px",
    height: "4px",
    background: "#d0cdc6",
    borderRadius: "99px",
    margin: "10px auto 16px",
  },
  catSheetTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#8a8a80",
    margin: "0 0 14px",
    textAlign: "center",
  },
  catSheetGrid: {
    display: "flex",
    gap: "16px",
    overflowX: "auto",
    paddingBottom: "8px",
    scrollbarWidth: "none",
    marginBottom: "16px",
  },
  catSheetItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "5px",
    flexShrink: 0,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 0,
    minWidth: "64px",
  },
  catSheetAvatar: {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    border: "3px solid transparent",
    overflow: "hidden",
    background: "#f5f3ef",
    flexShrink: 0,
  },
  catSheetAvatarActive: {
    border: "3px solid #6B9E82",
  },
  catSheetAvatarPhoto: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "50%",
  },
  catSheetAvatarImg: {
    width: "52px",
    height: "52px",
    objectFit: "contain",
    display: "block",
    margin: "6px auto",
  },
  catSheetName: {
    fontSize: "12px",
    fontWeight: 500,
    color: "#2a2a28",
    maxWidth: "72px",
    textAlign: "center",
    wordBreak: "break-all",
  },
  catSheetMeta: {
    fontSize: "10px",
    color: "#9a9890",
  },
  catSheetLink: {
    display: "block",
    textAlign: "center",
    fontSize: "13px",
    color: "#6B9E82",
    textDecoration: "none",
    padding: "10px 0",
  },
  headerGuide: {
    marginTop: "10px",
    border: "1px solid rgba(226, 223, 216, 0.86)",
    borderRadius: "22px",
    background: "rgba(255, 255, 255, 0.74)",
    padding: "10px",
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
  catTraitSection: {
    margin: "0 0 10px",
    borderBottom: "1px solid rgba(232, 229, 222, 0.66)",
    padding: "0 0 10px",
  },
  catTraitTitle: {
    margin: "0 0 6px",
    color: "#6f6a61",
    fontSize: "11px",
    fontWeight: 650,
    lineHeight: 1.3,
  },
  catTraitPills: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "5px",
  },
  catModifierTags: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "5px",
    marginTop: "6px",
  },
  catTraitPill: {
    display: "inline-flex",
    alignItems: "center",
    border: "1px solid rgba(107, 158, 130, 0.24)",
    borderRadius: "999px",
    background: "rgba(107, 158, 130, 0.12)",
    color: "#53685c",
    fontSize: "11px",
    fontWeight: 650,
    lineHeight: 1.35,
    padding: "3px 8px",
  },
  catModifierTag: {
    display: "inline-flex",
    alignItems: "center",
    border: "1px solid rgba(218, 216, 210, 0.78)",
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.64)",
    color: "#6f6a61",
    fontSize: "10px",
    fontWeight: 600,
    lineHeight: 1.35,
    padding: "2px 7px",
  },
  headerSummary: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "8px",
  },
  dashboardTiles: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 0,
    border: "1px solid rgba(225, 222, 215, 0.72)",
    borderRadius: "18px",
    background: "rgba(255, 255, 255, 0.58)",
    overflow: "hidden",
    backdropFilter: "blur(10px)",
  },
  dashboardTile: {
    display: "flex",
    minWidth: 0,
    flexDirection: "column",
    gap: "3px",
    borderRight: "1px solid rgba(225, 222, 215, 0.68)",
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
    color: "#6f6a61",
    fontSize: "10px",
    fontWeight: 650,
    lineHeight: 1.25,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  statusValue: {
    display: "block",
    minWidth: 0,
    overflow: "hidden",
    color: "#343632",
    fontSize: "12px",
    fontWeight: 650,
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
    border: "1px solid rgba(218, 216, 210, 0.84)",
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.78)",
    color: "#6d6c65",
    fontSize: "11px",
    fontWeight: 600,
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
    marginTop: "4px",
  },
  dayMapTitle: {
    margin: "0 0 6px",
    color: "#6f6a61",
    fontSize: "10px",
    fontWeight: 650,
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
    minHeight: "48px",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "2px",
    border: "1px solid rgba(222, 219, 211, 0.78)",
    borderRadius: "12px",
    background: "rgba(255, 255, 255, 0.54)",
    color: "#42433f",
    padding: "4px 3px",
    backdropFilter: "blur(8px)",
  },
  dayMapItemMuted: {
    background: "rgba(255, 255, 255, 0.34)",
    color: "#9a9188",
  },
  dayMapPeriod: {
    color: "inherit",
    fontSize: "9px",
    fontWeight: 650,
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
    background: "rgba(145, 141, 132, 0.3)",
  },
  dayMapLabel: {
    display: "block",
    maxWidth: "100%",
    overflow: "hidden",
    color: "inherit",
    fontSize: "9px",
    fontWeight: 600,
    lineHeight: 1.25,
    textAlign: "center",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  dayMapEmptyHint: {
    margin: "6px 0 0",
    color: "#8a8178",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.45,
  },
  headerGuideTitle: {
    margin: "0 0 2px",
    color: "#343632",
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
    border: "1px solid rgba(218, 216, 210, 0.84)",
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.78)",
    color: "#6d6c65",
    fontSize: "11px",
    fontWeight: 600,
    lineHeight: 1.45,
    padding: "3px 9px",
  },
  addCatChipButton: {
    minHeight: "34px",
    padding: "0 13px",
    border: "1px solid #dedbd3",
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
  catList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginTop: "12px",
  },
  catListItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minHeight: "64px",
    border: "1px solid #e5e2dc",
    borderRadius: "16px",
    background: "#ffffff",
    padding: "10px 12px",
    cursor: "pointer",
    textAlign: "left",
  },
  catListItemActive: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minHeight: "64px",
    border: "1px solid #d4d6ce",
    borderRadius: "16px",
    background: "#f0f1ec",
    padding: "10px 12px",
    cursor: "pointer",
    textAlign: "left",
  },
  catListAvatar: {
    width: "44px",
    height: "44px",
    borderRadius: "12px",
    overflow: "hidden",
    flexShrink: 0,
    background: "#f5f3ef",
    border: "0.5px solid #e0ddd6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  catListAvatarImg: {
    width: "36px",
    height: "36px",
    objectFit: "contain",
  },
  catListAvatarPhoto: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  catListInfo: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  catListName: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#27272a",
    lineHeight: 1.3,
  },
  catListMeta: {
    fontSize: "11px",
    color: "#8a8a80",
    lineHeight: 1.3,
  },
  catListProgress: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginTop: "2px",
  },
  catListProgressBar: {
    flex: 1,
    height: "3px",
    background: "#e8e5de",
    borderRadius: "99px",
    overflow: "hidden",
  },
  catListProgressFill: {
    height: "100%",
    background: "#6B9E82",
    borderRadius: "99px",
  },
  catListProgressLabel: {
    fontSize: "10px",
    color: "#8a8a80",
    flexShrink: 0,
  },
  catListChevron: {
    fontSize: "16px",
    color: "#c8c5be",
    flexShrink: 0,
  },
  addCatListButton: {
    width: "100%",
    minHeight: "48px",
    border: "1px dashed #dedbd3",
    borderRadius: "16px",
    background: "transparent",
    color: "#8a8a80",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    marginTop: "6px",
  },
  catSwitchList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  catSwitchButton: {
    minHeight: "38px",
    padding: "0 14px",
    border: "1px solid #dedbd3",
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
    border: "1px solid #d4d6ce",
    borderRadius: "12px",
    background: "#e8e9e4",
    color: "#3f433d",
    fontSize: "14px",
    fontWeight: 600,
    letterSpacing: 0,
    cursor: "pointer",
  },
  addCatButton: {
    minHeight: "36px",
    padding: "0 14px",
    border: "1px solid #dedbd3",
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
    border: "1px solid #dedbd3",
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
    border: "1px solid #aeb5a8",
    borderRadius: "12px",
    background: "#7b8476",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 600,
    letterSpacing: 0,
    cursor: "pointer",
  },
  catNameCancelButton: {
    minHeight: "40px",
    padding: "0 18px",
    border: "1px solid #dedbd3",
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
    color: "#727168",
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
    border: "1px solid #e5e2dc",
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
    border: "1px solid #ddd8cf",
    borderRadius: "999px",
    background: "#f8f7f3",
    color: "#6f6a61",
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
    border: "1px solid #aeb5a8",
    borderRadius: "14px",
    background: "#7b8476",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 600,
    letterSpacing: 0,
    cursor: "pointer",
  },
  hypothesisSubButton: {
    minHeight: "48px",
    border: "1px solid #dedbd3",
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
    border: "1px solid #e4e1da",
    borderRadius: "28px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8f7f3 100%)",
    padding: "18px 18px 19px",
  },
  guidance: {
    margin: 0,
  },
  predictionReason: {
    margin: "0 0 6px",
    display: "inline-flex",
    width: "fit-content",
    border: "1px solid #ddd8cf",
    borderRadius: "999px",
    background: "#ffffff",
    color: "#6f6a61",
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
    border: "1px solid #dedbd3",
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
    border: "1px solid #e5e2dc",
    borderRadius: "26px",
    background: "#ffffff",
    padding: "18px 16px",
  },
  observationCard: {
    marginBottom: "12px",
    border: "1px solid rgba(227, 224, 218, 0.72)",
    borderRadius: "28px",
    background: "rgba(255, 255, 255, 0.86)",
    padding: "16px 15px",
    boxShadow: "0 10px 24px rgba(44, 42, 38, 0.024)",
  },
  embeddedSection: {
    paddingTop: "11px",
    marginTop: "11px",
    borderTop: "1px solid rgba(232, 229, 222, 0.66)",
  },
  embeddedConcernSection: {
    borderTopColor: "rgba(232, 229, 222, 0.66)",
  },
  currentSection: {
    borderColor: "#e5e2dc",
    background: "#ffffff",
  },
  concernSection: {
    borderColor: "#e6e3dc",
    background: "#ffffff",
  },
  sectionLabel: {
    margin: "0 0 5px",
    color: "#747570",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.5,
  },
  sectionTitle: {
    margin: "0 0 10px",
    fontSize: "18px",
    fontWeight: 610,
    letterSpacing: 0,
  },
  sectionDescription: {
    margin: "-6px 0 14px",
    color: "#767771",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  tapPrompt: {
    margin: "-6px 0 14px",
    color: "#6B9E82",
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.5,
  },
  sectionMessage: {
    margin: "-4px 0 14px",
    color: "#52525b",
    fontSize: "13px",
    lineHeight: 1.7,
    whiteSpace: "pre-line",
  },
  saveErrorAlert: {
    margin: "-2px 0 14px",
    border: "1px solid #d8d2c8",
    borderRadius: "16px",
    background: "#f8f6f1",
    color: "#5f5147",
    fontSize: "13px",
    fontWeight: 650,
    lineHeight: 1.7,
    padding: "10px 12px",
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
    gap: "5px",
    minHeight: "84px",
    border: "1px solid rgba(225, 222, 216, 0.68)",
    borderRadius: "19px",
    background: "rgba(255, 255, 255, 0.72)",
    color: "#41433f",
    fontWeight: 480,
    letterSpacing: 0,
    textAlign: "center",
    padding: "8px 7px",
    cursor: "pointer",
  },
  currentButton: {
    background: "rgba(255, 255, 255, 0.74)",
    borderColor: "rgba(225, 222, 216, 0.68)",
    minHeight: "84px",
  },
  concernButton: {
    background: "rgba(249, 248, 245, 0.52)",
    borderColor: "rgba(228, 225, 219, 0.62)",
    fontWeight: 480,
    minHeight: "84px",
    gap: "5px",
    padding: "8px 6px",
  },
  optionIconFrame: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flex: "0 0 auto",
    background: "transparent",
    position: "relative",
    color: "#7a7b74",
  },
  currentOptionIconFrame: {
    width: "31px",
    height: "31px",
  },
  concernOptionIconFrame: {
    width: "30px",
    height: "30px",
  },
  optionIcon: {
    display: "block",
    pointerEvents: "none",
    color: "currentColor",
  },
  currentOptionIcon: {
    width: "25px",
    height: "25px",
  },
  concernOptionIcon: {
    width: "24px",
    height: "24px",
  },
  optionLabel: {
    display: "block",
    lineHeight: 1.3,
    letterSpacing: 0,
  },
  currentOptionLabel: {
    fontSize: "12px",
    fontWeight: 500,
  },
  concernOptionLabel: {
    fontSize: "12px",
    fontWeight: 500,
  },
  completedStateButton: {
    background: "#f2f3ef",
    borderColor: "#d7dcd2",
    opacity: 0.86,
    transform: "scale(0.98)",
    transition:
      "background 180ms ease, border-color 180ms ease, opacity 180ms ease, transform 160ms ease",
  },
  suggestedStateButton: {
    borderColor: "rgba(107, 158, 130, 0.5)",
    background: "rgba(107, 158, 130, 0.06)",
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
    background: "#8b9288",
    color: "#ffffff",
    fontSize: "12px",
    fontWeight: 750,
    lineHeight: 1,
  },
  completedOptionLabel: {
    color: "#6b6e67",
    fontSize: "12px",
    fontWeight: 580,
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
    border: "1px solid rgba(224, 222, 216, 0.96)",
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.94)",
    boxShadow: "0 10px 24px rgba(52, 50, 46, 0.045)",
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
    fontWeight: 650,
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
    background: "#e8e9e4",
    color: "#3f433d",
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: 0,
    cursor: "pointer",
  },
} satisfies Record<string, CSSProperties>;
