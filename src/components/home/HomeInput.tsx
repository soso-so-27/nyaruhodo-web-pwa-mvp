"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  calculateUnderstandingPercent,
  getUnderstandingMessage,
} from "../../core/understanding/understanding";
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
  getCatName,
  getGuidanceByUnderstanding,
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
  "\u4eca\u65e5\u306e\u69d8\u5b50\u3092\u8a18\u9332\u3057\u307e\u3057\u305f\u3002";

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
  const [visibleLatestHypothesis, setVisibleLatestHypothesis] =
    useState<LatestHypothesisView | null>(null);
  const [catProfiles, setCatProfiles] = useState<CatProfile[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [isEditingCatName, setIsEditingCatName] = useState(false);
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [catNameInput, setCatNameInput] = useState("");
  const [newCatNameInput, setNewCatNameInput] = useState("");
  const [catNameMessage, setCatNameMessage] = useState("");
  const [hypothesisMessage, setHypothesisMessage] = useState("");
  const [currentStateMessage, setCurrentStateMessage] = useState("");
  const [saveErrorMessage, setSaveErrorMessage] = useState("");
  const [saveErrorSection, setSaveErrorSection] = useState<
    "current" | "concern" | ""
  >("");
  const [isDailyHintDismissed, setIsDailyHintDismissed] = useState(false);
  const [hintSuppressions, setHintSuppressions] = useState<
    CurrentCatHintSuppression[]
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
  const understandingMessage = getUnderstandingMessage(understandingPercent);
  const guidance = getGuidanceByUnderstanding(understandingPercent);
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
    saveActiveCatId(activeProfile.id);

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
    saveActiveCatId(catId);
    setActiveCatId(catId);
    setCatNameInput(getCatName(getActiveCatProfile(catProfiles, catId)));
    clearLatestHypothesis();
    setVisibleLatestHypothesis(null);
    setHypothesisMessage("");
    setCurrentStateMessage("");
    setSaveErrorMessage("");
    setIsDailyHintDismissed(false);
    setHintSuppressions(readCurrentCatHintSuppressions());
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
    setCurrentStateMessage(currentStateSaveSuccessMessage);
    setIsDailyHintDismissed(false);
    router.refresh();
  }

  async function handleConcernSelect(label: string, input: string) {
    dismissLatestHypothesis();
    setCurrentStateMessage("");
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
          understandingPercent={understandingPercent}
          understandingMessage={understandingMessage}
          onCatSelect={handleCatSelect}
        />
        </div>

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
          ) : (
            <GuidanceBlock
              guidance={guidance}
              showDailyHint={shouldShowDailyHint}
              catName={catName}
              dailyHintHypothesis={dailyHintHypothesis}
              onDailyHintMainAction={handleDailyHintMainAction}
              onDailyHintSubAction={handleDailyHintSubAction}
              onDailyHintTertiaryAction={handleDailyHintTertiaryAction}
            />
          )}

          {hypothesisMessage ? (
            <p style={styles.hypothesisMessage}>{hypothesisMessage}</p>
          ) : null}
        </section>

        <div id="record" style={styles.actionArea}>
          <OptionSection
            title={`${catName}\u306f\u3044\u307e\u3069\u3046\u3057\u3066\u308b\uff1f`}
            options={CURRENT_OPTIONS}
            variant="current"
            description={"\u898b\u305f\u307e\u307e\u3092\u3072\u3068\u3064\u6b8b\u305b\u3070OK\u3067\u3059"}
            message={currentStateMessage}
            errorMessage={
              saveErrorSection === "current" ? saveErrorMessage : ""
            }
            onSelect={(option) => {
              void handleCurrentSelect(option.label, option.signal);
            }}
          />

          <OptionSection
            title={"\u3061\u3087\u3063\u3068\u6c17\u306b\u306a\u308b\uff1f"}
            options={CONCERN_OPTIONS}
            variant="concern"
            description={"\u8ff7\u3063\u305f\u3089\u3001\u8fd1\u3044\u3082\u306e\u3092\u9078\u3093\u3067\u304f\u3060\u3055\u3044"}
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

function Header({
  activeCatId,
  catName,
  catProfiles,
  understandingPercent,
  understandingMessage,
  onCatSelect,
}: {
  activeCatId: string | null;
  catName: string;
  catProfiles: CatProfile[];
  understandingPercent: number;
  understandingMessage: string;
  onCatSelect: (catId: string) => void;
}) {
  const understandingTone = getUnderstandingTone(understandingPercent);
  const ringDegree = Math.max(0, Math.min(100, understandingPercent)) * 3.6;

  return (
    <header style={styles.header}>
      <div style={styles.headerTopRow}>
        <p style={styles.headerEyebrow}>{"\u4eca\u65e5\u306e\u732b"}</p>
      </div>
      <div style={styles.profileHero}>
        <div style={styles.catAvatar} aria-hidden="true">
          <img
            src="/icons/cat-actions/purring.png"
            alt=""
            style={styles.catAvatarIcon}
            onError={(event) => {
              event.currentTarget.style.visibility = "hidden";
            }}
          />
        </div>
        <div style={styles.profileText}>
          <h1 style={styles.title}>
            {"\u4eca\u65e5\u306e"}
            {catName}
          </h1>
          <p style={styles.understandingMessage}>
            {catName}
            {"\u306e\u3053\u3068\u3001\u5c11\u3057\u305a\u3064\u898b\u3048\u3066\u304d\u307e\u3057\u305f"}
          </p>
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
      <div style={styles.homeCatSwitcher}>
        <p style={styles.catChipLabel}>{"見る猫"}</p>
        <div style={styles.catChips}>
          {catProfiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => onCatSelect(profile.id)}
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
    </header>
  );
}

function getUnderstandingTone(percent: number) {
  if (percent >= 90) {
    return "\u304b\u306a\u308a\u898b\u3048\u3066\u304d\u307e\u3057\u305f";
  }

  if (percent >= 60) {
    return "\u3060\u3093\u3060\u3093\u5206\u304b\u3063\u3066\u304d\u307e\u3057\u305f";
  }

  if (percent >= 30) {
    return "\u5c11\u3057\u305a\u3064\u5206\u304b\u3063\u3066\u304d\u307e\u3057\u305f";
  }

  return "\u3053\u308c\u304b\u3089\u77e5\u3063\u3066\u3044\u304d\u307e\u3059";
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
  guidance,
  showDailyHint,
  catName,
  dailyHintHypothesis,
  onDailyHintMainAction,
  onDailyHintSubAction,
  onDailyHintTertiaryAction,
}: {
  guidance: { title: string; text: string };
  showDailyHint: boolean;
  catName: string;
  dailyHintHypothesis: DailyHintHypothesis;
  onDailyHintMainAction: () => void;
  onDailyHintSubAction: () => void;
  onDailyHintTertiaryAction: () => void;
}) {
  if (showDailyHint) {
    return (
      <div style={styles.guidance}>
        <p style={styles.predictionReason}>
          {`\u3044\u307e\u306e${catName}`}
        </p>
        <p style={styles.guidanceTitle}>{dailyHintHypothesis.text}</p>
        <p style={styles.guidanceText}>{dailyHintHypothesis.body}</p>
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

  return (
    <div style={styles.guidance}>
      <p style={styles.guidanceTitle}>{guidance.title}</p>
      <p style={styles.guidanceText}>{guidance.text}</p>
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
  onSelect,
}: {
  label?: string;
  title: string;
  options: Option[];
  description?: string;
  variant?: "current" | "concern";
  message?: string;
  errorMessage?: string;
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
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => onSelect(option)}
            style={buttonStyle}
          >
            <span style={iconFrameStyle}>
              <img
                src={getOptionIconSrc(option.label)}
                alt={getOptionDisplayLabel(option.label)}
                style={iconStyle}
                onError={(event) => {
                  event.currentTarget.style.visibility = "hidden";
                }}
              />
            </span>
            <span style={labelStyle}>{getOptionDisplayLabel(option.label)}</span>
          </button>
        ))}
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

function getOptionDisplayLabel(label: string) {
  const labels: Record<string, string> = {
    "\u30b0\u30eb\u30fc\u30df\u30f3\u30b0": "\u6bdb\u3065\u304f\u308d\u3044",
    "\u30b4\u30ed\u30b4\u30ed\u3057\u3066\u308b": "\u30b4\u30ed\u30b4\u30ed",
  };

  return labels[label] ?? label;
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
  header: {
    marginBottom: "12px",
    border: "1px solid #ebe2d6",
    borderRadius: "28px",
    background: "linear-gradient(180deg, #fffdf9 0%, #fff7ec 100%)",
    padding: "18px 16px 17px",
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
    gridTemplateColumns: "56px minmax(0, 1fr) auto",
    alignItems: "center",
    gap: "12px",
    marginTop: "8px",
  },
  catAvatar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "56px",
    height: "56px",
    border: "1px solid #eadbca",
    borderRadius: "20px",
    background: "#ffffff",
    overflow: "hidden",
  },
  catAvatarIcon: {
    display: "block",
    width: "46px",
    height: "46px",
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
    gap: "5px",
    minWidth: "72px",
  },
  understandingRing: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "54px",
    height: "54px",
    borderRadius: "999px",
  },
  understandingRingInner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "42px",
    height: "42px",
    borderRadius: "999px",
    background: "#fffdf9",
    color: "#3f3f46",
    fontSize: "11px",
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
    marginTop: "14px",
    borderTop: "1px solid rgba(234, 219, 202, 0.8)",
    paddingTop: "12px",
  },
  catChipLabel: {
    margin: 0,
    color: "#8a8178",
    fontSize: "11px",
    fontWeight: 700,
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
    width: "72px",
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
