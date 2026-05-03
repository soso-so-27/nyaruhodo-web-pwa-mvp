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
  const [isSwitchingCat, setIsSwitchingCat] = useState(false);
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
  const understandingPercent = calculateUnderstandingPercent(
    activeCatEvents.length,
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
    setIsSwitchingCat(false);
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
    setIsSwitchingCat(false);
    setIsAddingCat(false);
    setCatNameMessage("");
  }

  function startAddingCat() {
    setNewCatNameInput("");
    setCatNameMessage("");
    setIsAddingCat(true);
    setIsSwitchingCat(true);
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
    setIsSwitchingCat(false);
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
        <Header
          activeCatId={activeCatId}
          catName={catName}
          catNameInput={catNameInput}
          catNameMessage={catNameMessage}
          catProfiles={catProfiles}
          isEditingCatName={isEditingCatName}
          isAddingCat={isAddingCat}
          isSwitchingCat={isSwitchingCat}
          newCatNameInput={newCatNameInput}
          understandingPercent={understandingPercent}
          understandingMessage={understandingMessage}
          onCatNameInputChange={setCatNameInput}
          onNewCatNameInputChange={setNewCatNameInput}
          onCatNameSave={handleCatNameSave}
          onAddCatSave={handleAddCatSave}
          onCatSelect={handleCatSelect}
          onEditCatName={startEditingCatName}
          onCancelCatNameEdit={cancelEditingCatName}
          onStartAddingCat={startAddingCat}
          onCancelAddingCat={cancelAddingCat}
        />

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

        <OptionSection
          label={"\u3044\u307e\u306e\u69d8\u5b50"}
          title={`${catName}\u306f\u4eca\u4f55\u3057\u3066\u308b\uff1f`}
          options={CURRENT_OPTIONS}
          variant="current"
          message={currentStateMessage}
          errorMessage={
            saveErrorSection === "current" ? saveErrorMessage : ""
          }
          onSelect={(option) => {
            void handleCurrentSelect(option.label, option.signal);
          }}
        />

        <OptionSection
          title={"\u6c17\u306b\u306a\u308b\u3053\u3068"}
          options={CONCERN_OPTIONS}
          variant="concern"
          description={"\u3044\u3064\u3082\u3068\u9055\u3046\u69d8\u5b50\u304c\u3042\u308b\u3068\u304d\u306f\u3053\u3061\u3089"}
          errorMessage={
            saveErrorSection === "concern" ? saveErrorMessage : ""
          }
          onSelect={(option) => {
            void handleConcernSelect(option.label, option.input);
          }}
        />
      </div>
    </main>
  );
}

function Header({
  activeCatId,
  catName,
  catNameInput,
  catNameMessage,
  catProfiles,
  isEditingCatName,
  isAddingCat,
  isSwitchingCat,
  newCatNameInput,
  understandingPercent,
  understandingMessage,
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
  catName: string;
  catNameInput: string;
  catNameMessage: string;
  catProfiles: CatProfile[];
  isEditingCatName: boolean;
  isAddingCat: boolean;
  isSwitchingCat: boolean;
  newCatNameInput: string;
  understandingPercent: number;
  understandingMessage: string;
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
    <div style={styles.header}>
      <h1 style={styles.title}>{catName}</h1>
      <div style={styles.catNameControls}>
        <button
          type="button"
          onClick={onEditCatName}
          style={styles.catNameEditButton}
        >
          {"\u540d\u524d\u3092\u5909\u66f4"}
        </button>
      </div>
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
        <button
          type="button"
          onClick={onStartAddingCat}
          style={styles.addCatChipButton}
        >
          {"\uff0b\u8ffd\u52a0"}
        </button>
      </div>
      {isSwitchingCat ? (
        <div style={styles.catSwitcher}>
          <div style={styles.catSwitchList}>
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
          {isAddingCat ? (
            <div style={styles.catNameEditor}>
              <label style={styles.catNameLabel} htmlFor="new-cat-name">
                {"\u3053\u306e\u5b50\u306e\u540d\u524d"}
              </label>
              <input
                id="new-cat-name"
                type="text"
                value={newCatNameInput}
                onChange={(event) =>
                  onNewCatNameInputChange(event.target.value)
                }
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
          ) : (
            <button
              type="button"
              onClick={onStartAddingCat}
              style={styles.addCatButton}
            >
              {"\u732b\u3092\u8ffd\u52a0"}
            </button>
          )}
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
      <p style={styles.understanding}>
        {catName}
        {"\u306e\u7406\u89e3\u5ea6 "}
        {understandingPercent}
        {"%"}
      </p>
      <p style={styles.understandingMessage}>{understandingMessage}</p>
    </div>
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
      <div style={styles.grid}>
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => onSelect(option)}
            style={buttonStyle}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
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
    padding: "16px 14px calc(136px + env(safe-area-inset-bottom))",
  },
  title: {
    margin: 0,
    fontSize: "32px",
    fontWeight: 600,
    letterSpacing: 0,
  },
  header: {
    marginBottom: "10px",
    border: "1px solid #ebe2d6",
    borderRadius: "18px",
    background: "#fffdf9",
    padding: "18px 16px",
  },
  catNameControls: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "8px",
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
    marginTop: "12px",
  },
  catChipButton: {
    minHeight: "34px",
    padding: "0 13px",
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
    minHeight: "34px",
    padding: "0 13px",
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
    marginTop: "8px",
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
    margin: "10px 0 0",
    color: "#71717a",
    fontSize: "13px",
    fontWeight: 500,
    letterSpacing: 0,
  },
  understandingMessage: {
    margin: "5px 0 0",
    color: "#71717a",
    fontSize: "13px",
    fontWeight: 400,
    letterSpacing: 0,
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
    marginBottom: "10px",
    border: "1px solid #eadbca",
    borderRadius: "18px",
    background: "#fffaf3",
    padding: "16px",
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
    marginBottom: "10px",
    border: "1px solid #e4e4e7",
    borderRadius: "18px",
    background: "#ffffff",
    padding: "16px",
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
    margin: "0 0 12px",
    fontSize: "17px",
    fontWeight: 600,
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
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  },
  button: {
    minHeight: "54px",
    border: "1px solid #d4d4d8",
    borderRadius: "14px",
    background: "#ffffff",
    color: "#27272a",
    fontSize: "15px",
    fontWeight: 500,
    letterSpacing: 0,
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
  },
} satisfies Record<string, CSSProperties>;
