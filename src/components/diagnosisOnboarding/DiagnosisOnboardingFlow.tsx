"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import { getCatTypeInfo } from "../../lib/diagnosisOnboarding/catTypes";
import {
  PROVISIONAL_QUESTIONS,
  REFINEMENT_QUESTIONS,
  type AnswerOption,
} from "../../lib/diagnosisOnboarding/questions";
import {
  calcActivityPattern,
  calcAxisScores,
  determineType,
} from "../../lib/diagnosisOnboarding/scoring";
import type { AxisScores, CatTypeKey } from "../../lib/diagnosisOnboarding/types";
import { STORAGE_KEYS } from "../../lib/storage";
import {
  readCatProfiles,
  saveActiveCatId,
  saveCatProfiles,
  type CatCoat,
  type CatProfile,
} from "../home/homeInputHelpers";
import {
  APP_ACCENT,
  APP_ACCENT_SOFT_BG,
  APP_ACCENT_SOFT_BORDER,
  APP_PAGE_BACKGROUND,
  APP_SUBTLE_SURFACE,
  APP_SURFACE,
} from "../ui/appTheme";

type Step =
  | "name"
  | "photo"
  | "coat"
  | "basicInfo"
  | "questions_provisional"
  | "provisional_result"
  | "questions_refinement"
  | "final_result"
  | "collection_preview"
  | "done";

type BasicInfo = {
  birthDate: string;
  gender: "male" | "female" | "unknown" | "";
  breed: string;
};

const ONBOARDING_VERSION = "diagnosis-v2";
const EMPTY_AXIS_SCORES: AxisScores = { P: 0, C: 0, S: 0, I: 0, B: 0, N: 0 };
const allQuestions = [...PROVISIONAL_QUESTIONS, ...REFINEMENT_QUESTIONS];

const COAT_OPTIONS: {
  key: CatCoat;
  label: string;
  color: string;
}[] = [
  { key: "saba", label: "サバ", color: "#d8d2c4" },
  { key: "gray", label: "グレー", color: "#c8c6c2" },
  { key: "orange_tabby", label: "茶トラ", color: "#dfc7a8" },
  { key: "black", label: "黒", color: "#625f59" },
  { key: "white", label: "白", color: "#f0eeea" },
  { key: "calico", label: "三毛", color: "#ded6ca" },
];

const COLLECTION_PREVIEW_ICONS = [
  "/icons/collection/01_hesoten_belly_up.png",
  "/icons/collection/02_kobako_loaf_pose.png",
  "/icons/collection/03_nobii_stretching.png",
  "/icons/collection/05_marumari_curled_up.png",
];

export function DiagnosisOnboardingFlow() {
  const [step, setStep] = useState<Step>("name");
  const [catName, setCatName] = useState("");
  const [coat, setCoat] = useState<CatCoat | "">("");
  const [avatarDataUrl, setAvatarDataUrl] = useState("");
  const [basicInfo, setBasicInfo] = useState<BasicInfo>({
    birthDate: "",
    gender: "",
    breed: "",
  });
  const [answers, setAnswers] = useState<AnswerOption[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [provisionalType, setProvisionalType] = useState<CatTypeKey | null>(null);
  const [finalType, setFinalType] = useState<CatTypeKey | null>(null);
  const [axisScores, setAxisScores] = useState<AxisScores>(EMPTY_AXIS_SCORES);
  const hasTrackedStart = useRef(false);

  const displayName = catName.trim() || "この子";
  const currentQuestion = allQuestions[currentQuestionIndex];

  useEffect(() => {
    if (hasTrackedStart.current) {
      return;
    }
    hasTrackedStart.current = true;
    trackProductEvent("diagnosis_onboarding_started", {
      has_existing_profile: getStoredCatProfileCount() > 0,
      entry_source: "diagnosis_onboarding",
    });
  }, []);

  function handleNameNext() {
    if (!catName.trim()) {
      return;
    }
    trackProductEvent("diagnosis_name_submitted", {
      name_length_bucket: getNameLengthBucket(catName.trim()),
    });
    setCatName(catName.trim());
    setStep("photo");
  }

  async function handleCameraCapture() {
    await selectPhoto({ capture: true });
  }

  async function handleGallerySelect() {
    await selectPhoto({ capture: false });
  }

  async function selectPhoto({ capture }: { capture: boolean }) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (capture) {
      input.setAttribute("capture", "environment");
    }

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }

      const dataUrl = await resizeAndEncode(file, 800);
      setAvatarDataUrl(dataUrl);
      trackProductEvent("diagnosis_photo_added", {
        source: capture ? "camera" : "gallery",
        file_size_bucket: getFileSizeBucket(file.size),
      });
      setStep("basicInfo");
    };

    input.click();
  }

  function handleBasicInfoNext() {
    trackProductEvent("diagnosis_basic_info_submitted", {
      has_birth_date: Boolean(basicInfo.birthDate),
      has_gender: Boolean(basicInfo.gender),
      has_breed: Boolean(basicInfo.breed.trim()),
    });
    setStep("questions_provisional");
  }

  function handleBasicInfoSkip() {
    trackProductEvent("diagnosis_basic_info_skipped");
    setStep("questions_provisional");
  }

  function handleAnswer(option: AnswerOption, optionIndex: number) {
    const newAnswers = [...answers, option];
    setAnswers(newAnswers);
    trackProductEvent("diagnosis_question_answered", {
      phase:
        step === "questions_provisional" ? "provisional" : "refinement",
      question_id: currentQuestion?.id,
      question_index: currentQuestionIndex,
      option_index: optionIndex,
    });

    if (step === "questions_provisional") {
      if (currentQuestionIndex < 2) {
        setCurrentQuestionIndex((index) => index + 1);
        return;
      }

      const scores = calcAxisScores(newAnswers);
      setAxisScores(scores);
      const provisional = determineType(scores);
      setProvisionalType(provisional);
      trackProductEvent("diagnosis_provisional_result_viewed", {
        type_key: provisional,
        answered_count: newAnswers.length,
      });
      setCurrentQuestionIndex(3);
      setStep("provisional_result");
      return;
    }

    if (step === "questions_refinement") {
      if (currentQuestionIndex < 7) {
        setCurrentQuestionIndex((index) => index + 1);
        return;
      }

      const scores = calcAxisScores(newAnswers);
      setAxisScores(scores);
      const final = determineType(scores);
      setFinalType(final);
      trackProductEvent("diagnosis_final_result_viewed", {
        type_key: final,
        provisional_type_key: provisionalType,
        changed_from_provisional: Boolean(provisionalType && final !== provisionalType),
        answered_count: newAnswers.length,
      });
      setStep("final_result");
    }
  }

  function handleSaveAndGoHome() {
    if (!finalType) {
      return;
    }

    const typeInfo = getCatTypeInfo(finalType);
    if (!typeInfo) {
      return;
    }

    const now = new Date().toISOString();
    const activityPattern = calcActivityPattern(answers);
    const newCatId = `local-cat-${Date.now()}`;
    const profile: CatProfile = {
      id: newCatId,
      name: displayName,
      createdAt: now,
      updatedAt: now,
      typeKey: finalType,
      typeLabel: typeInfo.label,
      typeTagline: typeInfo.tagline,
      axisScores,
      activityPattern,
      appearance: { coat: coat || undefined },
      avatarDataUrl: avatarDataUrl || undefined,
      homePhotoDataUrl: avatarDataUrl || undefined,
      homePhotoPosition: "center 38%",
      basicInfo: {
        birthDate: basicInfo.birthDate || undefined,
        gender: basicInfo.gender || undefined,
        breed: basicInfo.breed.trim() || undefined,
      },
      modifiers: [],
      onboarding: {
        version: ONBOARDING_VERSION,
        answeredCount: answers.length,
        skippedCount: 0,
        answers: answers.map((answer) => answer.label),
        completedAt: now,
        updatedAt: now,
      },
      understanding: {
        percent: Math.round((answers.length / allQuestions.length) * 20),
        sourceBreakdown: {
          onboarding: Math.round((answers.length / allQuestions.length) * 20),
          events: 0,
          feedbacks: 0,
          hintFeedbacks: 0,
        },
      },
    };

    try {
      const existing = window.localStorage.getItem(STORAGE_KEYS.catProfiles)
        ? readCatProfiles()
        : [];
      const nextProfiles = [...existing, profile];
      saveCatProfiles(nextProfiles);
      saveActiveCatId(newCatId);
      trackProductEvent(
        "diagnosis_result_saved",
        {
          type_key: finalType,
          has_photo: Boolean(avatarDataUrl),
          has_basic_info: hasAnyBasicInfo(basicInfo),
        },
        { localCatId: newCatId },
      );
      window.localStorage.setItem(STORAGE_KEYS.onboardingCompleted, "true");
      window.localStorage.setItem(STORAGE_KEYS.homeVisitCount, "0");
      window.localStorage.setItem(
        STORAGE_KEYS.diagnosisOnboardingHomeHint,
        JSON.stringify({
          localCatId: newCatId,
          catName: displayName,
          completedAt: now,
        }),
      );
    } catch {
      // localStorage MVPなので、保存失敗時も画面遷移は妨げない。
    }

    setStep("done");
    trackProductEvent(
      "diagnosis_home_started",
      {
        cta: "mikke_start",
      },
      { localCatId: newCatId },
    );
    window.location.href = "/home";
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {step === "name" ? (
          <section style={styles.card}>
            <div style={styles.stepContainer}>
              <p style={styles.eyebrow}>うちの子、何タイプ？</p>
              <h1 style={styles.title}>この子のトリセツを作ります</h1>
              <p style={styles.note}>
                名前といくつかの質問から、迷ったときに見返せる最初の手がかりを作ります。
              </p>
              <input
                type="text"
                value={catName}
                onChange={(event) => setCatName(event.target.value)}
                placeholder="名前を入力"
                style={styles.nameInput}
              />
              <button
                type="button"
                style={
                  catName.trim()
                    ? styles.primaryButton
                    : { ...styles.primaryButton, ...styles.disabledButton }
                }
                disabled={!catName.trim()}
                onClick={handleNameNext}
              >
                次へ
              </button>
            </div>
          </section>
        ) : null}

        {step === "photo" ? (
          <section style={styles.card}>
            <div style={styles.stepContainer}>
              <p style={styles.eyebrow}>{displayName}の写真を1枚</p>
              <p style={styles.note}>
                ホームの背景やねこアイコンに使います。あとで、ねこタブから変更できます。
              </p>
              <button
                type="button"
                onClick={() => {
                  void handleCameraCapture();
                }}
                style={styles.photoButton}
              >
                写真を撮る
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleGallerySelect();
                }}
                style={styles.photoButton}
              >
                写真を選ぶ
              </button>
              <button
                type="button"
                onClick={() => {
                  trackProductEvent("diagnosis_photo_skipped", {
                    next_step: "coat",
                  });
                  setStep("coat");
                }}
                style={styles.skipLink}
              >
                あとで登録して、毛色を選ぶ →
              </button>
            </div>
          </section>
        ) : null}

        {step === "coat" ? (
          <section style={styles.card}>
            <div style={styles.stepContainer}>
              <p style={styles.eyebrow}>写真なしでも始められます</p>
              <p style={styles.note}>
                近い毛色を選ぶと、仮のアイコンでトリセツを作れます。
              </p>
              <div style={styles.coatGrid}>
                {COAT_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      setCoat(option.key);
                      trackProductEvent("diagnosis_coat_selected", {
                        coat: option.key,
                      });
                      setStep("basicInfo");
                    }}
                    style={
                      coat === option.key
                        ? { ...styles.coatButton, ...styles.coatButtonActive }
                        : styles.coatButton
                    }
                  >
                    <span style={{ ...styles.coatDot, background: option.color }} />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {step === "basicInfo" ? (
          <section style={styles.card}>
            <div style={styles.stepContainer}>
              <p style={styles.eyebrow}>診断の手がかりを増やします</p>
              <p style={styles.note}>
                わかるところだけでOKです。空欄でも、あとからねこタブで変更できます。
              </p>

              <div style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>生年月日</label>
                <input
                  type="date"
                  value={basicInfo.birthDate}
                  onChange={(event) =>
                    setBasicInfo((current) => ({
                      ...current,
                      birthDate: event.target.value,
                    }))
                  }
                  style={styles.dateInput}
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>性別</label>
                <div style={styles.genderButtons}>
                  {[
                    { value: "male", label: "男の子" },
                    { value: "female", label: "女の子" },
                    { value: "unknown", label: "わからない" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setBasicInfo((current) => ({
                          ...current,
                          gender: option.value as BasicInfo["gender"],
                        }))
                      }
                      style={
                        basicInfo.gender === option.value
                          ? {
                              ...styles.genderButton,
                              ...styles.genderButtonActive,
                            }
                          : styles.genderButton
                      }
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>猫種</label>
                <input
                  type="text"
                  value={basicInfo.breed}
                  onChange={(event) =>
                    setBasicInfo((current) => ({
                      ...current,
                      breed: event.target.value,
                    }))
                  }
                  placeholder="例：サバトラ、雑種・ミックス"
                  style={styles.textInput}
                />
              </div>

              <button
                type="button"
                onClick={handleBasicInfoNext}
                style={styles.primaryButton}
              >
                診断を始める
              </button>
              <button
                type="button"
                onClick={handleBasicInfoSkip}
                style={styles.skipLink}
              >
                スキップ
              </button>
            </div>
          </section>
        ) : null}

        {(step === "questions_provisional" || step === "questions_refinement") &&
        currentQuestion ? (
          <section style={styles.card}>
            <div style={styles.stepContainer}>
              <div style={styles.progressBar} aria-hidden="true">
                <div
                  style={{
                    ...styles.progressFill,
                    width: `${((currentQuestionIndex + 1) / allQuestions.length) * 100}%`,
                  }}
                />
              </div>

              <div style={styles.avatarArea}>
                <img
                  src={avatarDataUrl || getCatAvatarSrc(coat || undefined)}
                  style={styles.avatar}
                  alt=""
                />
                <p style={styles.avatarName}>{displayName}</p>
              </div>

              <p style={styles.questionCount}>
                {step === "questions_provisional"
                  ? "まずは3問"
                  : "あと5問でくわしく"}{" "}
                ・ {currentQuestionIndex + 1} / {allQuestions.length}
              </p>
              <h1 style={styles.questionText}>
                {currentQuestion.text.replace("{name}", displayName)}
              </h1>

              <div style={styles.optionList}>
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={`${currentQuestion.id}-${index}`}
                    type="button"
                    style={styles.optionButton}
                    onClick={() => handleAnswer(option, index)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {step === "provisional_result" && provisionalType ? (
          <section style={styles.card}>
            <div style={styles.stepContainer}>
              <p style={styles.eyebrow}>最初の手がかり</p>
              <div style={styles.typeReveal}>
                <p style={styles.typeLabelLarge}>
                  {getCatTypeInfo(provisionalType)?.label}
                </p>
                <p style={styles.typeTagline}>
                  {getCatTypeInfo(provisionalType)?.tagline}
                </p>
              </div>
              <p style={styles.continueText}>
                ここから5問だけ答えると、トリセツに残す内容がもう少しはっきりします。
              </p>
              <button
                type="button"
                style={styles.primaryButton}
                onClick={() => {
                  trackProductEvent("diagnosis_refinement_started", {
                    provisional_type_key: provisionalType,
                  });
                  setStep("questions_refinement");
                }}
              >
                くわしく診断する →
              </button>
            </div>
          </section>
        ) : null}

        {step === "final_result" && finalType ? (
          <section style={styles.card}>
            <div style={styles.stepContainer}>
              <p style={styles.eyebrow}>トリセツの最初の1枚ができました</p>

              <div style={styles.typeCard}>
                <p style={styles.resultStatus}>
                  {finalType === provisionalType
                    ? "最初の印象と同じタイプでした"
                    : "追加の質問で見え方が変わりました"}
                </p>
                <p style={styles.typeLabelLarge}>
                  {getCatTypeInfo(finalType)?.label}
                </p>
                <p style={styles.typeTagline}>{getCatTypeInfo(finalType)?.tagline}</p>
                <p style={styles.typeDescription}>
                  {getCatTypeInfo(finalType)?.description}
                </p>
                <div style={styles.triviaList}>
                  {getCatTypeInfo(finalType)?.trivia.map((trivia) => (
                    <p key={trivia} style={styles.triviaItem}>
                      ・{trivia}
                    </p>
                  ))}
                </div>
              </div>

              <div style={styles.rarityArea}>
                <p style={styles.rarityText}>
                  {getCatTypeInfo(finalType)?.label}は全体の約
                  {getCatTypeInfo(finalType)?.rarity}%
                </p>
                <div style={styles.rarityBar}>
                  <div
                    style={{
                      ...styles.rarityFill,
                      width: `${getCatTypeInfo(finalType)?.rarity ?? 0}%`,
                    }}
                  />
                </div>
              </div>

              <p style={styles.hintText}>{getCatTypeInfo(finalType)?.hint}</p>
              <p style={styles.saveNote}>
                この診断結果は、あとでトリセツから見返せます。
              </p>
              <button
                type="button"
                style={styles.primaryButton}
                onClick={() => setStep("collection_preview")}
              >
                トリセツに残して次へ →
              </button>
            </div>
          </section>
        ) : null}

        {step === "collection_preview" ? (
          <section style={styles.card}>
            <div style={styles.stepContainer}>
              <p style={styles.eyebrow}>
                ここからは、見つけた日常を残せます
              </p>
              <p style={styles.note}>
                ホームで「みっけ」すると、トリセツやコレクションにこの子らしさが少しずつ残ります。
              </p>
              <div style={styles.collectionPreview}>
                {COLLECTION_PREVIEW_ICONS.map((src) => (
                  <div key={src} style={styles.collectionPreviewCard}>
                    <img src={src} style={styles.collectionPreviewIcon} alt="" />
                  </div>
                ))}
              </div>
              <button
                type="button"
                style={styles.primaryButton}
                onClick={handleSaveAndGoHome}
              >
                みっけを始める →
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
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

function getNameLengthBucket(name: string) {
  if (name.length <= 3) {
    return "1-3";
  }
  if (name.length <= 8) {
    return "4-8";
  }
  return "9+";
}

function getFileSizeBucket(size: number) {
  if (size < 1_000_000) {
    return "small";
  }
  if (size < 5_000_000) {
    return "medium";
  }
  return "large";
}

function hasAnyBasicInfo(basicInfo: BasicInfo) {
  return Boolean(
    basicInfo.birthDate || basicInfo.gender || basicInfo.breed.trim(),
  );
}

function getStoredCatProfileCount() {
  if (typeof window === "undefined") {
    return 0;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.catProfiles);
    if (!raw) {
      return 0;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.length;
    }
    if (parsed && typeof parsed === "object") {
      return Object.keys(parsed).length;
    }
  } catch {
    return 0;
  }

  return 0;
}

function resizeAndEncode(file: File, maxSize = 800): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve("");
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve("");
    };
    img.src = url;
  });
}

const styles = {
  page: {
    minHeight: "100vh",
    background: APP_PAGE_BACKGROUND,
    color: "#2a2a28",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
    width: "min(100%, 430px)",
    margin: "0 auto",
    padding: "18px 14px calc(42px + env(safe-area-inset-bottom))",
    boxSizing: "border-box",
  },
  card: {
    ...APP_SURFACE,
    borderRadius: "28px",
    padding: "24px 18px 20px",
  },
  stepContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  eyebrow: {
    margin: 0,
    color: APP_ACCENT,
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1.45,
  },
  title: {
    margin: 0,
    color: "#2a2a28",
    fontSize: "28px",
    fontWeight: 750,
    lineHeight: 1.28,
    letterSpacing: 0,
  },
  note: {
    margin: "-8px 0 0",
    color: "#6f6a61",
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: 1.75,
  },
  nameInput: {
    width: "100%",
    minHeight: "54px",
    border: "1px solid #dedbd3",
    borderRadius: "16px",
    background: "#fbfaf7",
    color: "#27272a",
    fontSize: "17px",
    fontWeight: 650,
    padding: "0 15px",
    boxSizing: "border-box",
  },
  primaryButton: {
    width: "100%",
    minHeight: "54px",
    border: "none",
    borderRadius: "16px",
    background: APP_ACCENT,
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 750,
    cursor: "pointer",
  },
  disabledButton: {
    opacity: 0.42,
    cursor: "not-allowed",
  },
  photoButton: {
    ...APP_SUBTLE_SURFACE,
    width: "100%",
    minHeight: "56px",
    borderRadius: "16px",
    color: "#2a2a28",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
  },
  skipLink: {
    width: "100%",
    minHeight: "44px",
    border: "none",
    background: "transparent",
    color: "#8a8a80",
    fontSize: "13px",
    fontWeight: 650,
    cursor: "pointer",
  },
  coatGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
  },
  coatButton: {
    minHeight: "48px",
    border: "1px solid rgba(210, 207, 200, 0.86)",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.86)",
    color: "#27272a",
    fontSize: "14px",
    fontWeight: 650,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  coatButtonActive: {
    borderColor: APP_ACCENT_SOFT_BORDER,
    background: APP_ACCENT_SOFT_BG,
    color: APP_ACCENT,
  },
  coatDot: {
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    border: "0.5px solid rgba(0,0,0,0.12)",
    flexShrink: 0,
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  fieldLabel: {
    fontSize: "12px",
    fontWeight: 650,
    color: "#6a6a62",
  },
  dateInput: {
    width: "100%",
    minHeight: "48px",
    border: "1px solid #dedbd3",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#27272a",
    fontSize: "15px",
    padding: "0 14px",
    boxSizing: "border-box",
  },
  textInput: {
    width: "100%",
    minHeight: "48px",
    border: "1px solid #dedbd3",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#27272a",
    fontSize: "15px",
    padding: "0 14px",
    boxSizing: "border-box",
  },
  genderButtons: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "8px",
  },
  genderButton: {
    minHeight: "44px",
    border: "1px solid #dedbd3",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#27272a",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  genderButtonActive: {
    border: "1px solid #aeb5a8",
    background: "#e8e9e4",
    color: "#3f433d",
  },
  progressBar: {
    width: "100%",
    height: "5px",
    borderRadius: "99px",
    background: "#ede9df",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: APP_ACCENT,
    borderRadius: "99px",
    transition: "width 0.2s ease",
  },
  avatarArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },
  avatar: {
    width: "82px",
    height: "82px",
    borderRadius: "50%",
    objectFit: "cover",
    background: "#f5f3ef",
    border: "1px solid #e0ddd6",
  },
  avatarName: {
    margin: 0,
    color: "#6a6a62",
    fontSize: "13px",
    fontWeight: 700,
  },
  questionCount: {
    margin: 0,
    color: "#9a9890",
    fontSize: "12px",
    fontWeight: 700,
    textAlign: "center",
  },
  questionText: {
    margin: 0,
    color: "#2a2a28",
    fontSize: "22px",
    fontWeight: 760,
    lineHeight: 1.45,
    textAlign: "center",
  },
  optionList: {
    display: "grid",
    gap: "10px",
  },
  optionButton: {
    minHeight: "56px",
    border: "1px solid rgba(222,219,211,0.95)",
    borderRadius: "16px",
    background: "#ffffff",
    color: "#2a2a28",
    fontSize: "15px",
    fontWeight: 700,
    lineHeight: 1.45,
    padding: "10px 14px",
    cursor: "pointer",
  },
  typeReveal: {
    ...APP_SUBTLE_SURFACE,
    borderRadius: "24px",
    padding: "22px 16px",
    textAlign: "center",
  },
  typeLabelLarge: {
    margin: "0 0 8px",
    color: "#2a2a28",
    fontSize: "30px",
    fontWeight: 760,
    lineHeight: 1.2,
  },
  typeTagline: {
    margin: 0,
    color: "#6a6a62",
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: 1.7,
  },
  continueText: {
    margin: 0,
    color: "#6a6a62",
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: 1.7,
    textAlign: "center",
  },
  typeCard: {
    ...APP_SUBTLE_SURFACE,
    borderRadius: "24px",
    padding: "20px 16px",
  },
  resultStatus: {
    margin: "0 0 10px",
    color: APP_ACCENT,
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1.5,
  },
  typeDescription: {
    margin: "12px 0 0",
    color: "#4a4a42",
    fontSize: "14px",
    fontWeight: 560,
    lineHeight: 1.85,
  },
  triviaList: {
    display: "grid",
    gap: "6px",
    marginTop: "14px",
  },
  triviaItem: {
    margin: 0,
    color: "#6a6a62",
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.6,
  },
  rarityArea: {
    display: "grid",
    gap: "8px",
  },
  rarityText: {
    margin: 0,
    color: "#6a6a62",
    fontSize: "13px",
    fontWeight: 700,
  },
  rarityBar: {
    height: "7px",
    borderRadius: "99px",
    background: "#ede9df",
    overflow: "hidden",
  },
  rarityFill: {
    height: "100%",
    borderRadius: "99px",
    background: APP_ACCENT,
  },
  hintText: {
    margin: 0,
    color: APP_ACCENT,
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1.75,
  },
  saveNote: {
    margin: "-6px 0 0",
    color: "#8a8a80",
    fontSize: "12px",
    fontWeight: 650,
    lineHeight: 1.65,
    textAlign: "center",
  },
  collectionPreview: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "8px",
  },
  collectionPreviewCard: {
    aspectRatio: "1",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.7)",
    border: "1px solid rgba(222,219,211,0.86)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  collectionPreviewIcon: {
    width: "70%",
    height: "70%",
    objectFit: "contain",
    opacity: 0.7,
    mixBlendMode: "multiply",
  },
} satisfies Record<string, CSSProperties>;
