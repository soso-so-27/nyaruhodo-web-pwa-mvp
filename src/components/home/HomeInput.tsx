"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { RecentEvent } from "../../lib/supabase/queries";
import { insertEvent, insertFeedback } from "../../lib/supabase/queries";
import {
  CATEGORY_MESSAGES,
  CONCERN_OPTIONS,
  CURRENT_OPTIONS,
  FALLBACK_HYPOTHESIS_CTA_LABELS,
  HYPOTHESIS_CTA_LABELS,
  addCatProfile,
  buildPredictedConcernOptions,
  clearLatestHypothesis,
  getActiveCatProfile,
  getCatName,
  getGuidanceByUnderstanding,
  getHypothesisCompletionMessage,
  parseStoredContext,
  readActiveCatId,
  readCatProfiles,
  readLatestHypothesis,
  saveActiveCatId,
  updateCatProfileName,
} from "./homeInputHelpers";
import type { CatProfile, LatestHypothesisView } from "./homeInputHelpers";

type HomeInputProps = {
  recentEvents: RecentEvent[];
  understandingPercent: number;
  understandingMessage: string;
};

const eventSaveErrorMessage =
  "\u8a18\u9332\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002\n\u901a\u4fe1\u72b6\u614b\u3092\u78ba\u8a8d\u3057\u3066\u3001\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002";

const feedbackSaveErrorMessage =
  "\u884c\u52d5\u306e\u8a18\u9332\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\n\u5c11\u3057\u6642\u9593\u3092\u304a\u3044\u3066\u3001\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002";

export function HomeInput({
  recentEvents,
  understandingPercent,
  understandingMessage,
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
  const [saveErrorMessage, setSaveErrorMessage] = useState("");

  const activeCatProfile =
    catProfiles.length > 0
      ? getActiveCatProfile(catProfiles, activeCatId)
      : null;
  const catName = getCatName(activeCatProfile);
  const guidance = getGuidanceByUnderstanding(understandingPercent);
  const hypothesisCta = visibleLatestHypothesis
    ? HYPOTHESIS_CTA_LABELS[visibleLatestHypothesis.category] ??
      FALLBACK_HYPOTHESIS_CTA_LABELS
    : FALLBACK_HYPOTHESIS_CTA_LABELS;
  const hasKnownHypothesisCategory = visibleLatestHypothesis
    ? Boolean(HYPOTHESIS_CTA_LABELS[visibleLatestHypothesis.category])
    : false;
  const predictedConcernOptions = buildPredictedConcernOptions(recentEvents);
  const shouldShowPredictedConcerns =
    !visibleLatestHypothesis && understandingPercent >= 71;

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
    saveActiveCatId(activeProfile.id);

    const latestHypothesis = readLatestHypothesis();

    if (latestHypothesis) {
      setVisibleLatestHypothesis({
        input: "",
        context: {},
        category: latestHypothesis.category ?? "",
        text: latestHypothesis.text,
        source: latestHypothesis.source,
        diagnosisId: latestHypothesis.diagnosisId ?? null,
      });
      return;
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

  function toggleCatSwitcher() {
    setIsSwitchingCat((current) => !current);
    setIsAddingCat(false);
    setIsEditingCatName(false);
    setCatNameMessage("");
  }

  function handleCatSelect(catId: string) {
    saveActiveCatId(catId);
    setActiveCatId(catId);
    setCatNameInput(getCatName(getActiveCatProfile(catProfiles, catId)));
    setIsSwitchingCat(false);
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
    setIsSwitchingCat(false);
    setCatNameMessage("\u4fdd\u5b58\u3057\u307e\u3057\u305f\u3002");
  }

  async function handleCurrentSelect(label: string, signal: string) {
    dismissLatestHypothesis();
    const event = await insertEvent({
      event_type: "current_state",
      signal,
      label,
      source: "home",
    });

    if (!event) {
      setSaveErrorMessage(eventSaveErrorMessage);
    }
  }

  async function handleConcernSelect(label: string, input: string) {
    dismissLatestHypothesis();
    const event = await insertEvent({
      event_type: "concern",
      signal: input,
      label,
      source: "home",
    });

    if (!event) {
      setSaveErrorMessage(eventSaveErrorMessage);
      return;
    }

    const eventQuery = event?.id ? `&event_id=${event.id}` : "";

    router.push(`/diagnose?input=${input}${eventQuery}`);
  }

  function handlePredictedConcernSelect(input: string) {
    router.push(`/diagnose?input=${input}`);
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
          onToggleCatSwitcher={toggleCatSwitcher}
          onCancelCatNameEdit={cancelEditingCatName}
          onStartAddingCat={startAddingCat}
          onCancelAddingCat={cancelAddingCat}
        />

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
            showPredictedConcerns={shouldShowPredictedConcerns}
            predictedConcernOptions={predictedConcernOptions}
            onPredictedConcernSelect={handlePredictedConcernSelect}
          />
        )}

        {hypothesisMessage ? (
          <p style={styles.hypothesisMessage}>{hypothesisMessage}</p>
        ) : null}

        {saveErrorMessage ? (
          <p style={styles.saveErrorMessage}>{saveErrorMessage}</p>
        ) : null}

        <OptionSection
          title={"\u3044\u307e\u306e\u69d8\u5b50"}
          options={CURRENT_OPTIONS}
          onSelect={(option) => {
            void handleCurrentSelect(option.label, option.signal);
          }}
        />

        <OptionSection
          title={"\u6c17\u306b\u306a\u308b\u3053\u3068"}
          options={CONCERN_OPTIONS}
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
  onToggleCatSwitcher,
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
  onToggleCatSwitcher: () => void;
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
          onClick={onToggleCatSwitcher}
          style={styles.catNameEditButton}
        >
          {"\u732b\u3092\u5207\u308a\u66ff\u3048"}
        </button>
        <button
          type="button"
          onClick={onEditCatName}
          style={styles.catNameEditButton}
        >
          {"\u540d\u524d\u3092\u5909\u66f4"}
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
  showPredictedConcerns,
  predictedConcernOptions,
  onPredictedConcernSelect,
}: {
  guidance: { title: string; text: string };
  showPredictedConcerns: boolean;
  predictedConcernOptions: { label: string; input: string }[];
  onPredictedConcernSelect: (input: string) => void;
}) {
  return (
    <div style={styles.guidance}>
      {showPredictedConcerns ? (
        <p style={styles.predictionReason}>
          {"\u3053\u306e\u5b50\u306e\u6700\u8fd1\u306e\u8a18\u9332\u304b\u3089"}
        </p>
      ) : null}
      <p style={styles.guidanceTitle}>{guidance.title}</p>
      <p style={styles.guidanceText}>{guidance.text}</p>
      {showPredictedConcerns ? (
        <div style={styles.predictionActions}>
          {predictedConcernOptions.map(({ label, input }) => (
            <button
              key={input}
              type="button"
              onClick={() => onPredictedConcernSelect(input)}
              style={styles.predictionButton}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function OptionSection<Option extends { label: string }>({
  title,
  options,
  onSelect,
}: {
  title: string;
  options: Option[];
  onSelect: (option: Option) => void;
}) {
  return (
    <section style={styles.section}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <div style={styles.grid}>
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => onSelect(option)}
            style={styles.button}
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
    background: "#f4f4f5",
    color: "#27272a",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
    width: "min(100%, 430px)",
    margin: "0 auto",
    padding: "32px 20px",
  },
  title: {
    margin: 0,
    fontSize: "32px",
    fontWeight: 600,
    letterSpacing: 0,
  },
  header: {
    marginBottom: "40px",
  },
  catNameControls: {
    display: "flex",
    gap: "14px",
    marginTop: "8px",
  },
  catNameEditButton: {
    margin: 0,
    padding: 0,
    border: "none",
    background: "transparent",
    color: "#71717a",
    fontSize: "13px",
    fontWeight: 500,
    letterSpacing: 0,
    cursor: "pointer",
  },
  catSwitcher: {
    marginTop: "12px",
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
    marginTop: "10px",
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
  catNameEditor: {
    marginTop: "12px",
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
    margin: "-18px 0 42px",
    padding: 0,
  },
  lastResultLead: {
    margin: "0 0 4px",
    color: "#52525b",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  lastResultText: {
    margin: 0,
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
    margin: "-22px 0 38px",
    color: "#52525b",
    fontSize: "13px",
    lineHeight: 1.7,
    whiteSpace: "pre-line",
  },
  saveErrorMessage: {
    margin: "-22px 0 38px",
    color: "#52525b",
    fontSize: "13px",
    lineHeight: 1.7,
    whiteSpace: "pre-line",
  },
  guidance: {
    margin: "-18px 0 42px",
  },
  predictionReason: {
    margin: "0 0 6px",
    color: "#71717a",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.5,
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
    marginBottom: "48px",
  },
  sectionTitle: {
    margin: "0 0 18px",
    fontSize: "18px",
    fontWeight: 600,
    letterSpacing: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  },
  button: {
    minHeight: "60px",
    border: "1px solid #d4d4d8",
    borderRadius: "14px",
    background: "#ffffff",
    color: "#27272a",
    fontSize: "15px",
    fontWeight: 500,
    letterSpacing: 0,
    cursor: "pointer",
  },
} satisfies Record<string, CSSProperties>;
