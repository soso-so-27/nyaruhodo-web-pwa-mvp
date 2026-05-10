"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CSSProperties } from "react";
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
import {
  readCatProfiles,
  saveActiveCatId,
  saveCatProfiles,
  type CatCoat,
  type CatProfile,
} from "../home/homeInputHelpers";

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

const ONBOARDING_HOME_HINT_KEY = "diagnosis_onboarding_home_hint";
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
  const router = useRouter();
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

  const displayName = catName.trim() || "この子";
  const currentQuestion = allQuestions[currentQuestionIndex];

  function handleNameNext() {
    if (!catName.trim()) {
      return;
    }
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
      input.capture = "environment";
    }

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }

      const dataUrl = await resizeAndEncode(file, 800);
      setAvatarDataUrl(dataUrl);
      setStep("basicInfo");
    };

    input.click();
  }

  function handleAnswer(option: AnswerOption) {
    const newAnswers = [...answers, option];
    setAnswers(newAnswers);

    if (step === "questions_provisional") {
      if (currentQuestionIndex < 2) {
        setCurrentQuestionIndex((index) => index + 1);
        return;
      }

      const scores = calcAxisScores(newAnswers);
      setAxisScores(scores);
      setProvisionalType(determineType(scores));
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
      setFinalType(determineType(scores));
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
      const existing = window.localStorage.getItem("cat_profiles")
        ? readCatProfiles()
        : [];
      const nextProfiles = [...existing, profile];
      saveCatProfiles(nextProfiles);
      saveActiveCatId(newCatId);
      window.localStorage.setItem("onboarding_completed", "true");
      window.localStorage.setItem(
        ONBOARDING_HOME_HINT_KEY,
        JSON.stringify({
          localCatId: newCatId,
          catName: displayName,
          completedAt: now,
        }),
      );
    } catch {
      // localStorage MVPの暫定実装なので、保存失敗時も画面遷移は妨げない。
    }

    setStep("done");
    router.push("/home");
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {step === "name" ? (
          <section style={styles.card}>
            <div style={styles.stepContainer}>
              <p style={styles.eyebrow}>この子のことを教えてください</p>
              <h1 style={styles.title}>まずは名前から</h1>
              <p style={styles.note}>
                診断は、猫の正解を決めるものではありません。迷ったときに見る手がかりを少しずつ作ります。
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
                写真があると、ホームでもこの子らしく表示できます。あとで変更できます。
              </p>
              <button
                type="button"
                onClick={() => {
                  void handleCameraCapture();
                }}
                style={styles.photoButton}
              >
                📷 カメラで撮る
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleGallerySelect();
                }}
                style={styles.photoButton}
              >
                🖼 ライブラリから選ぶ
              </button>
              <button
                type="button"
                onClick={() => setStep("coat")}
                style={styles.skipLink}
              >
                スキップして毛色を選ぶ →
              </button>
            </div>
          </section>
        ) : null}

        {step === "coat" ? (
          <section style={styles.card}>
            <div style={styles.stepContainer}>
              <p style={styles.eyebrow}>どんな毛色？</p>
              <p style={styles.note}>近い色でOKです。あとでねこタブから変えられます。</p>
              <div style={styles.coatGrid}>
                {COAT_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      setCoat(option.key);
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
              <p style={styles.eyebrow}>もう少し教えてください</p>
              <p style={styles.note}>あとで変更できます。スキップしてもOKです。</p>

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
                onClick={() => setStep("questions_provisional")}
                style={styles.primaryButton}
              >
                次へ
              </button>
              <button
                type="button"
                onClick={() => setStep("questions_provisional")}
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
                {currentQuestionIndex + 1} / {allQuestions.length}
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
                    onClick={() => handleAnswer(option)}
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
              <p style={styles.eyebrow}>診断中...</p>
              <div style={styles.typeReveal}>
                <p style={styles.typeLabelLarge}>
                  {getCatTypeInfo(provisionalType)?.label}
                </p>
                <p style={styles.typeTagline}>
                  {getCatTypeInfo(provisionalType)?.tagline}
                </p>
              </div>
              <p style={styles.continueText}>
                もう少し教えてもらうと、もっとくわしくわかります。
              </p>
              <button
                type="button"
                style={styles.primaryButton}
                onClick={() => setStep("questions_refinement")}
              >
                続けて教える →
              </button>
            </div>
          </section>
        ) : null}

        {step === "final_result" && finalType ? (
          <section style={styles.card}>
            <div style={styles.stepContainer}>
              <p style={styles.eyebrow}>
                {finalType === provisionalType
                  ? `やっぱり${getCatTypeInfo(finalType)?.label}でした`
                  : `実は${getCatTypeInfo(finalType)?.label}でした`}
              </p>

              <div style={styles.typeCard}>
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
              <button
                type="button"
                style={styles.primaryButton}
                onClick={() => setStep("collection_preview")}
              >
                {displayName}の毎日を残していく →
              </button>
            </div>
          </section>
        ) : null}

        {step === "collection_preview" ? (
          <section style={styles.card}>
            <div style={styles.stepContainer}>
              <p style={styles.eyebrow}>
                {displayName}の暮らしを、少しずつ残していきませんか
              </p>
              <p style={styles.note}>
                写真や日々の様子が増えるほど、この子らしさをあとから見返しやすくなります。
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
                はじめる →
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
    background: "linear-gradient(180deg, #fdfcf9 0%, #f7f5ef 100%)",
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
    border: "1px solid rgba(219, 216, 207, 0.72)",
    borderRadius: "28px",
    background: "#ffffff",
    boxShadow: "0 12px 28px rgba(44, 42, 38, 0.04)",
    padding: "24px 18px 20px",
  },
  stepContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  eyebrow: {
    margin: 0,
    color: "#6B9E82",
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
    background: "#6B9E82",
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
    width: "100%",
    minHeight: "56px",
    border: "1px solid rgba(219, 216, 207, 0.9)",
    borderRadius: "16px",
    background: "#fbfaf7",
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
    border: "1px solid #dedbd3",
    borderRadius: "14px",
    background: "#ffffff",
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
    borderColor: "rgba(107, 158, 130, 0.45)",
    background: "rgba(107, 158, 130, 0.08)",
    color: "#3d6650",
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
    fontWeight: 550,
    cursor: "pointer",
  },
  genderButtonActive: {
    borderColor: "rgba(107, 158, 130, 0.45)",
    background: "rgba(107, 158, 130, 0.08)",
    color: "#3d6650",
    fontWeight: 700,
  },
  progressBar: {
    height: "6px",
    borderRadius: "999px",
    background: "#ebe8e0",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: "999px",
    background: "#6B9E82",
    transition: "width 0.22s ease",
  },
  avatarArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },
  avatar: {
    width: "76px",
    height: "76px",
    borderRadius: "50%",
    objectFit: "cover",
    background: "#f5f3ef",
    border: "1px solid #e8e5de",
  },
  avatarName: {
    margin: 0,
    color: "#6a6a62",
    fontSize: "13px",
    fontWeight: 700,
  },
  questionCount: {
    margin: "0 0 -10px",
    color: "#9a9890",
    fontSize: "12px",
    fontWeight: 700,
    textAlign: "center",
  },
  questionText: {
    margin: 0,
    color: "#2a2a28",
    fontSize: "24px",
    fontWeight: 750,
    lineHeight: 1.38,
    textAlign: "center",
  },
  optionList: {
    display: "grid",
    gap: "10px",
  },
  optionButton: {
    minHeight: "54px",
    border: "1px solid rgba(219, 216, 207, 0.9)",
    borderRadius: "16px",
    background: "#ffffff",
    color: "#2a2a28",
    fontSize: "15px",
    fontWeight: 700,
    lineHeight: 1.45,
    cursor: "pointer",
    textAlign: "left",
    padding: "0 16px",
  },
  typeReveal: {
    border: "1px solid rgba(107, 158, 130, 0.22)",
    borderRadius: "24px",
    background: "rgba(107, 158, 130, 0.07)",
    padding: "22px 18px",
    textAlign: "center",
    animation: "fadeIn 0.35s ease",
  },
  typeLabelLarge: {
    margin: 0,
    color: "#2a2a28",
    fontSize: "34px",
    fontWeight: 800,
    lineHeight: 1.2,
  },
  typeTagline: {
    margin: "10px 0 0",
    color: "#3d6650",
    fontSize: "15px",
    fontWeight: 700,
    lineHeight: 1.6,
  },
  continueText: {
    margin: 0,
    color: "#6f6a61",
    fontSize: "14px",
    lineHeight: 1.7,
    textAlign: "center",
  },
  typeCard: {
    border: "1px solid rgba(219, 216, 207, 0.72)",
    borderRadius: "24px",
    background: "#fbfaf7",
    padding: "20px 16px",
  },
  typeDescription: {
    margin: "14px 0 0",
    color: "#4f4b45",
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: 1.8,
  },
  triviaList: {
    display: "grid",
    gap: "4px",
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
    border: "1px solid rgba(232, 229, 222, 0.9)",
    borderRadius: "18px",
    background: "#ffffff",
    padding: "13px 14px",
  },
  rarityText: {
    margin: "0 0 9px",
    color: "#6a6a62",
    fontSize: "13px",
    fontWeight: 700,
  },
  rarityBar: {
    height: "7px",
    borderRadius: "999px",
    background: "#ebe8e0",
    overflow: "hidden",
  },
  rarityFill: {
    height: "100%",
    borderRadius: "999px",
    background: "#6B9E82",
  },
  hintText: {
    margin: 0,
    color: "#3d6650",
    border: "1px solid rgba(107, 158, 130, 0.18)",
    borderRadius: "18px",
    background: "rgba(107, 158, 130, 0.06)",
    fontSize: "14px",
    fontWeight: 650,
    lineHeight: 1.7,
    padding: "13px 14px",
  },
  collectionPreview: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "8px",
  },
  collectionPreviewCard: {
    aspectRatio: "1",
    border: "1px solid #e8e5de",
    borderRadius: "18px",
    background: "#f5f3ef",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  collectionPreviewIcon: {
    width: "62px",
    height: "62px",
    objectFit: "contain",
    opacity: 0.48,
    mixBlendMode: "multiply",
  },
} satisfies Record<string, CSSProperties>;
