"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { DIAGNOSIS_ONBOARDING_QUESTIONS } from "../../lib/diagnosisOnboarding/questions";
import { buildOnboardingResult } from "../../lib/diagnosisOnboarding/scoring";
import type {
  OnboardingAnswers,
  OnboardingQuestionDefinition,
  TypeKey,
} from "../../lib/diagnosisOnboarding/types";
import {
  createLocalCatProfile,
  readCatProfiles,
  saveActiveCatId,
  saveCatProfiles,
} from "../home/homeInputHelpers";
import type { CatProfile } from "../home/homeInputHelpers";

const ONBOARDING_VERSION = "diagnosis-v1" as const;
const ONBOARDING_HOME_HINT_KEY = "diagnosis_onboarding_home_hint";
const PREVIEW_QUESTION_COUNT = 3;
const ONBOARDING_QUESTION_LIMIT = 15;
const ONBOARDING_QUESTIONS = DIAGNOSIS_ONBOARDING_QUESTIONS.slice(
  0,
  ONBOARDING_QUESTION_LIMIT,
);

const tendencyTexts: Record<TypeKey, string> = {
  play: "遊びへの反応が少し出やすい",
  food: "ごはんまわりの変化に反応しやすい",
  social: "人との距離や、かまってほしい気持ちが出やすい",
  stress: "環境や音の変化に反応しやすい",
  balanced: "いまは大きな偏りはまだ見えていない",
};

const typeOutlooks: Record<TypeKey, string> = {
  play: "遊びたい気持ちが出る場面を、少しずつ見ていけそうです。",
  food: "ごはん前後の様子を残すと、見立てがしやすくなりそうです。",
  social: "近くにいる、ついてくるなど、人との距離感を見ていくとよさそうです。",
  stress: "落ち着かない時の時間帯や環境を、少しずつ見ていきましょう。",
  balanced: "日常の記録を少し残すだけでも、この子らしさが見えてきます。",
};

export function DiagnosisOnboardingFlow() {
  const router = useRouter();
  const catNameDraftRef = useRef("");
  const [catName, setCatName] = useState("");
  const [confirmedCatName, setConfirmedCatName] = useState("");
  const [step, setStep] = useState<
    "name" | "basicInfo" | "questions" | "result"
  >("name");
  const [basicInfo, setBasicInfo] = useState<{
    birthDate: string;
    gender: "male" | "female" | "unknown" | "";
    breed: string;
  }>({
    birthDate: "",
    gender: "",
    breed: "",
  });
  const [questionIndex, setQuestionIndex] = useState(0);
  const [furthestQuestionCount, setFurthestQuestionCount] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [message, setMessage] = useState("");

  const trimmedCatName = catName.trim();
  const displayCatName = confirmedCatName || trimmedCatName || "この子";
  const currentQuestion = ONBOARDING_QUESTIONS[questionIndex];
  const result = useMemo(() => buildOnboardingResult(answers), [answers]);
  const visibleQuestionCount =
    step === "result"
      ? Math.max(furthestQuestionCount, PREVIEW_QUESTION_COUNT)
      : Math.max(furthestQuestionCount, questionIndex + 1);
  const visibleQuestions = ONBOARDING_QUESTIONS.slice(0, visibleQuestionCount);
  const answeredVisibleCount = visibleQuestions.filter(
    (question) => answers[question.questionId],
  ).length;
  const skippedVisibleCount = visibleQuestions.length - answeredVisibleCount;
  const hasHealthSignal = result.scores.health >= 2;
  const canAnswerMore = visibleQuestionCount < ONBOARDING_QUESTION_LIMIT;

  function resolveCatName() {
    const draftName = catNameDraftRef.current.trim() || catName.trim();

    return draftName || "ミケ";
  }

  function startQuestions() {
    const nextCatName = resolveCatName();

    catNameDraftRef.current = nextCatName;
    setCatName(nextCatName);
    setConfirmedCatName(nextCatName);
    setFurthestQuestionCount(1);
    setMessage("");
    setStep("basicInfo");
  }

  function startQuestionStep() {
    setMessage("");
    setQuestionIndex(0);
    setFurthestQuestionCount(1);
    setStep("questions");
  }

  function answerQuestion(
    question: OnboardingQuestionDefinition,
    optionId: string | null,
  ) {
    const nextIndex = questionIndex + 1;

    setAnswers((current) => ({
      ...current,
      [question.questionId]: optionId,
    }));
    setFurthestQuestionCount((current) =>
      Math.max(current, questionIndex + 1),
    );
    setMessage("");

    if (
      nextIndex === PREVIEW_QUESTION_COUNT ||
      nextIndex >= ONBOARDING_QUESTIONS.length
    ) {
      setStep("result");
      return;
    }

    setQuestionIndex(nextIndex);
    setFurthestQuestionCount((current) => Math.max(current, nextIndex + 1));
  }

  function continueQuestions() {
    const nextIndex = Math.max(PREVIEW_QUESTION_COUNT, furthestQuestionCount);
    const safeNextIndex = Math.min(nextIndex, ONBOARDING_QUESTIONS.length - 1);

    setQuestionIndex(safeNextIndex);
    setFurthestQuestionCount((current) =>
      Math.max(current, safeNextIndex + 1),
    );
    setMessage("");
    setStep("questions");
  }

  function showResult() {
    setFurthestQuestionCount((current) =>
      Math.max(current, questionIndex + 1),
    );
    setMessage("");
    setStep("result");
  }

  function saveAndGoHome() {
    const now = new Date().toISOString();
    const profileName = confirmedCatName || resolveCatName();
    const normalizedBasicInfo: CatProfile["basicInfo"] = {
      birthDate: basicInfo.birthDate || undefined,
      gender: basicInfo.gender || undefined,
      breed: basicInfo.breed.trim() || undefined,
    };
    const basicInfoToSave =
      normalizedBasicInfo.birthDate ||
      normalizedBasicInfo.gender ||
      normalizedBasicInfo.breed
        ? normalizedBasicInfo
        : undefined;
    const profile: CatProfile = {
      ...createLocalCatProfile(profileName, {
        createdAt: now,
        updatedAt: now,
      }),
      basicInfo: basicInfoToSave,
      typeKey: result.type.typeKey,
      typeLabel: result.type.typeLabel,
      typeScores: result.scores,
      modifiers: result.modifiers,
      onboarding: {
        version: ONBOARDING_VERSION,
        answeredCount: answeredVisibleCount,
        skippedCount: skippedVisibleCount,
        answers,
        completedAt: now,
        updatedAt: now,
      },
      understanding: result.understanding,
    };
    const profiles = window.localStorage.getItem("cat_profiles")
      ? readCatProfiles()
      : [];
    const nextProfiles = [...profiles, profile];

    saveCatProfiles(nextProfiles);
    saveActiveCatId(profile.id);
    window.localStorage.setItem("onboarding_completed", "true");
    window.localStorage.setItem(
      ONBOARDING_HOME_HINT_KEY,
      JSON.stringify({
        localCatId: profile.id,
        catName: profile.name,
        completedAt: now,
      }),
    );
    router.push("/home");
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {step === "name" ? (
          <section style={styles.heroCard}>
            <p style={styles.eyebrow}>はじめに</p>
            <h1 style={styles.title}>うちの猫、どんなタイプ？</h1>
            <p style={styles.lead}>
              鳴く・ついてくる・落ち着かない。
              行動から&quot;いまの気持ち&quot;が見えてきます。
            </p>

            <div style={styles.formBlock}>
              <label style={styles.label} htmlFor="diagnosis-onboarding-cat-name">
                この子、なんて呼んでますか？
              </label>
              <input
                id="diagnosis-onboarding-cat-name"
                type="text"
                value={catName}
                onChange={(event) => {
                  catNameDraftRef.current = event.target.value;
                  setCatName(event.target.value);
                }}
                placeholder="例：ミケ"
                style={styles.input}
              />
              <p style={styles.hint}>あとで変更できます</p>
            </div>

            <button type="button" onClick={startQuestions} style={styles.primaryButton}>
              3問だけ答える
            </button>
          </section>
        ) : null}

        {step === "basicInfo" ? (
          <section style={styles.heroCard}>
            <div style={styles.stepContainer}>
              <p style={styles.stepEyebrow}>この子のことを少し教えてください</p>
              <p style={styles.stepNote}>
                あとで変更できます。スキップしてもOKです。
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
                          gender: option.value as "male" | "female" | "unknown",
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

              <div style={styles.basicInfoActions}>
                <button
                  type="button"
                  onClick={startQuestionStep}
                  style={styles.primaryButton}
                >
                  次へ
                </button>
                <button
                  type="button"
                  onClick={startQuestionStep}
                  style={styles.basicInfoSkipButton}
                >
                  スキップ
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {step === "questions" && currentQuestion ? (
          <QuestionStep
            catName={displayCatName}
            question={currentQuestion}
            questionNumber={questionIndex + 1}
            totalQuestions={ONBOARDING_QUESTION_LIMIT}
            showProgressActions={questionIndex + 1 > PREVIEW_QUESTION_COUNT}
            onAnswer={(optionId) => answerQuestion(currentQuestion, optionId)}
            onShowResult={showResult}
            onGoHome={saveAndGoHome}
          />
        ) : null}

        {step === "result" ? (
          <section style={styles.resultCard}>
            <p style={styles.eyebrow}>
              {getResultStageLabel(visibleQuestionCount)}
            </p>
            <h1 style={styles.title}>
              {getResultTitle(displayCatName, visibleQuestionCount)}
            </h1>

            <div style={styles.resultSummary}>
              <p style={styles.resultLead}>
                今の回答だけで見ると、
                <br />
                {tendencyTexts[result.type.typeKey]}かもしれません。
              </p>
              <p style={styles.resultText}>
                {getResultBodyText(displayCatName, visibleQuestionCount)}
              </p>
              <p style={styles.typeHint}>
                今のところ、{result.type.typeLabel}寄りかもしれません
              </p>
            </div>

            {hasHealthSignal ? (
              <div style={styles.noticeCard}>
                体調やトイレまわりは、少し丁寧に見てあげてもよさそうです。
              </div>
            ) : null}

            {result.modifiers.length > 0 ? (
              <div style={styles.modifierGroup}>
                <p style={styles.smallLabel}>気にして見ていけそうなところ</p>
                <div style={styles.modifierList}>
                  {result.modifiers.map((modifier) => (
                    <span key={modifier} style={styles.modifierPill}>
                      {modifier}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={styles.outlookCard}>
              <p style={styles.smallLabel}>これから見ていくこと</p>
              <p style={styles.outlookText}>{typeOutlooks[result.type.typeKey]}</p>
              <p style={styles.outlookText}>
                もっと答えると、{displayCatName}の傾向がもう少し見えてきます。
              </p>
            </div>

            {visibleQuestionCount <= PREVIEW_QUESTION_COUNT ? (
              <p style={styles.progressHint}>
                今は3問だけ。あとからでも続けられます。
              </p>
            ) : null}

            <div style={styles.actions}>
              {canAnswerMore ? (
                <>
                  <button
                    type="button"
                    onClick={continueQuestions}
                    style={styles.primaryButton}
                  >
                    もう少し答えてみる
                  </button>
                  <button
                    type="button"
                    onClick={saveAndGoHome}
                    style={styles.secondaryButton}
                  >
                    ホームで見る
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={saveAndGoHome}
                    style={styles.primaryButton}
                  >
                    ホームで見る
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setMessage(
                        "追加の質問は次のステップで使えるようにします。",
                      )
                    }
                    style={styles.secondaryButton}
                  >
                    もう少し詳しく見る
                  </button>
                </>
              )}
            </div>
            {message ? <p style={styles.message}>{message}</p> : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function QuestionStep({
  catName,
  question,
  questionNumber,
  totalQuestions,
  showProgressActions,
  onAnswer,
  onShowResult,
  onGoHome,
}: {
  catName: string;
  question: OnboardingQuestionDefinition;
  questionNumber: number;
  totalQuestions: number;
  showProgressActions: boolean;
  onAnswer: (optionId: string | null) => void;
  onShowResult: () => void;
  onGoHome: () => void;
}) {
  return (
    <section style={styles.questionCard}>
      <p style={styles.eyebrow}>
        質問 {questionNumber} / {totalQuestions}
      </p>
      <h1 style={styles.questionTitle}>{question.question}</h1>
      <p style={styles.lead}>
        {catName}のことを、少しだけ教えてください。
      </p>

      <div style={styles.optionList}>
        {question.options.map((option) => (
          <button
            key={option.optionId}
            type="button"
            onClick={() => onAnswer(option.optionId)}
            style={styles.optionButton}
          >
            {option.label}
          </button>
        ))}
      </div>

      {question.skippable ? (
        <button type="button" onClick={() => onAnswer(null)} style={styles.skipButton}>
          スキップする
        </button>
      ) : null}

      {showProgressActions ? (
        <div style={styles.progressActions}>
          <button type="button" onClick={onShowResult} style={styles.tertiaryButton}>
            いま見えていることを見る
          </button>
          <button type="button" onClick={onGoHome} style={styles.ghostButton}>
            今日はここまで
          </button>
        </div>
      ) : null}
    </section>
  );
}

function getResultStageLabel(questionCount: number) {
  if (questionCount <= PREVIEW_QUESTION_COUNT) {
    return "最初の手がかり";
  }

  if (questionCount < ONBOARDING_QUESTION_LIMIT) {
    return "少し傾向が見えてきました";
  }

  return "だんだん傾向が見えてきました";
}

function getResultTitle(catName: string, questionCount: number) {
  if (questionCount >= ONBOARDING_QUESTION_LIMIT) {
    return `${catName}の傾向が、だんだん見えてきました`;
  }

  return `${catName}のこと、少し見えてきました`;
}

function getResultBodyText(catName: string, questionCount: number) {
  if (questionCount <= PREVIEW_QUESTION_COUNT) {
    return "まだ最初の手がかりなので、これからの記録や回答で少しずつ変わります。";
  }

  if (questionCount >= ONBOARDING_QUESTION_LIMIT) {
    return `ここまで答えると、${catName}の見え方が少し深まりました。これからの記録でも、少しずつ変わっていきます。`;
  }

  return "答えてくれた分だけ、この子の傾向が少しずつ見えやすくなっています。";
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f7f3ee",
    color: "#27272a",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
    width: "min(100%, 430px)",
    margin: "0 auto",
    padding: "18px 14px calc(40px + env(safe-area-inset-bottom))",
  },
  heroCard: {
    border: "1px solid #ebe2d6",
    borderRadius: "28px",
    background: "linear-gradient(180deg, #fffdf9 0%, #fff7ec 100%)",
    padding: "24px 18px 18px",
  },
  stepContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
    padding: "0 4px",
  },
  stepEyebrow: {
    fontSize: "18px",
    fontWeight: 650,
    color: "#2a2a28",
    margin: 0,
    lineHeight: 1.4,
  },
  stepNote: {
    fontSize: "13px",
    color: "#8a8a80",
    margin: "-12px 0 0",
    lineHeight: 1.6,
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  fieldLabel: {
    fontSize: "12px",
    fontWeight: 600,
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
    fontWeight: 500,
    cursor: "pointer",
  },
  genderButtonActive: {
    border: "1px solid #aeb5a8",
    background: "#e8e9e4",
    color: "#3f433d",
    fontWeight: 600,
  },
  basicInfoActions: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginTop: "8px",
  },
  basicInfoSkipButton: {
    minHeight: "44px",
    border: "none",
    background: "transparent",
    color: "#8a8a80",
    fontSize: "13px",
    cursor: "pointer",
  },
  questionCard: {
    border: "1px solid #e4e4e7",
    borderRadius: "28px",
    background: "#ffffff",
    padding: "22px 18px 18px",
  },
  resultCard: {
    border: "1px solid #ebe2d6",
    borderRadius: "28px",
    background: "#fffdf9",
    padding: "22px 18px 18px",
  },
  eyebrow: {
    margin: "0 0 8px",
    color: "#71717a",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: 0,
  },
  title: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 800,
    letterSpacing: 0,
    lineHeight: 1.25,
  },
  questionTitle: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 800,
    letterSpacing: 0,
    lineHeight: 1.35,
  },
  lead: {
    margin: "10px 0 0",
    color: "#71717a",
    fontSize: "14px",
    lineHeight: 1.7,
  },
  formBlock: {
    marginTop: "24px",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#3f3f46",
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: 0,
  },
  input: {
    width: "100%",
    minHeight: "52px",
    border: "1px solid #d4d4d8",
    borderRadius: "16px",
    background: "#ffffff",
    color: "#27272a",
    fontSize: "16px",
    fontWeight: 600,
    letterSpacing: 0,
    padding: "0 14px",
  },
  hint: {
    margin: "8px 0 0",
    color: "#71717a",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  optionList: {
    display: "grid",
    gap: "10px",
    marginTop: "22px",
  },
  optionButton: {
    minHeight: "54px",
    border: "1px solid #e4e4e7",
    borderRadius: "16px",
    background: "#ffffff",
    color: "#27272a",
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: 0,
    cursor: "pointer",
    textAlign: "left",
    padding: "0 16px",
  },
  skipButton: {
    width: "100%",
    minHeight: "46px",
    marginTop: "12px",
    border: "1px solid transparent",
    borderRadius: "14px",
    background: "transparent",
    color: "#71717a",
    fontSize: "14px",
    fontWeight: 700,
    letterSpacing: 0,
    cursor: "pointer",
  },
  primaryButton: {
    width: "100%",
    minHeight: "54px",
    marginTop: "22px",
    border: "1px solid #3f3f46",
    borderRadius: "16px",
    background: "#3f3f46",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 800,
    letterSpacing: 0,
    cursor: "pointer",
  },
  secondaryButton: {
    width: "100%",
    minHeight: "52px",
    border: "1px solid #d4d4d8",
    borderRadius: "16px",
    background: "#ffffff",
    color: "#3f3f46",
    fontSize: "15px",
    fontWeight: 800,
    letterSpacing: 0,
    cursor: "pointer",
  },
  tertiaryButton: {
    width: "100%",
    minHeight: "46px",
    border: "1px solid #d4d4d8",
    borderRadius: "14px",
    background: "#ffffff",
    color: "#3f3f46",
    fontSize: "14px",
    fontWeight: 800,
    letterSpacing: 0,
    cursor: "pointer",
  },
  ghostButton: {
    width: "100%",
    minHeight: "46px",
    border: "1px solid transparent",
    borderRadius: "14px",
    background: "transparent",
    color: "#71717a",
    fontSize: "14px",
    fontWeight: 800,
    letterSpacing: 0,
    cursor: "pointer",
  },
  resultSummary: {
    marginTop: "18px",
    border: "1px solid #ebe2d6",
    borderRadius: "22px",
    background: "#ffffff",
    padding: "16px",
  },
  resultLead: {
    margin: 0,
    color: "#27272a",
    fontSize: "17px",
    fontWeight: 800,
    lineHeight: 1.65,
  },
  resultText: {
    margin: "10px 0 0",
    color: "#52525b",
    fontSize: "14px",
    lineHeight: 1.75,
  },
  typeHint: {
    margin: "10px 0 0",
    color: "#71717a",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.6,
  },
  noticeCard: {
    marginTop: "14px",
    border: "1px solid #ebe2d6",
    borderRadius: "18px",
    background: "#fff8ed",
    color: "#52525b",
    padding: "13px 14px",
    fontSize: "14px",
    lineHeight: 1.7,
  },
  modifierGroup: {
    marginTop: "14px",
  },
  smallLabel: {
    margin: "0 0 8px",
    color: "#71717a",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: 0,
  },
  modifierList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  modifierPill: {
    border: "1px solid #e4e4e7",
    borderRadius: "999px",
    background: "#ffffff",
    color: "#3f3f46",
    fontSize: "13px",
    fontWeight: 700,
    padding: "7px 11px",
  },
  outlookCard: {
    marginTop: "14px",
    border: "1px solid #e4e4e7",
    borderRadius: "18px",
    background: "#ffffff",
    padding: "14px",
  },
  outlookText: {
    margin: "0 0 8px",
    color: "#52525b",
    fontSize: "14px",
    lineHeight: 1.7,
  },
  progressHint: {
    margin: "14px 0 0",
    color: "#71717a",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  actions: {
    display: "grid",
    gap: "10px",
  },
  progressActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    marginTop: "10px",
  },
  message: {
    margin: "12px 0 0",
    color: "#71717a",
    fontSize: "13px",
    lineHeight: 1.6,
    textAlign: "center",
  },
} satisfies Record<string, CSSProperties>;
