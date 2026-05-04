"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  DIAGNOSIS_ONBOARDING_QUESTIONS,
} from "../../lib/diagnosisOnboarding/questions";
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
const INITIAL_QUESTIONS = DIAGNOSIS_ONBOARDING_QUESTIONS.slice(0, 3);

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
  social: "鳴く・ついてくるなど、人との距離感を見ていくとよさそうです。",
  stress: "落ち着かない時の時間帯や環境を、少しずつ見ていきましょう。",
  balanced: "日常の記録を少し残すだけでも、この子らしさが見えてきます。",
};

export function DiagnosisOnboardingFlow() {
  const router = useRouter();
  const [catName, setCatName] = useState("");
  const [step, setStep] = useState<"name" | "question" | "result">("name");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>({});
  const [message, setMessage] = useState("");

  const trimmedCatName = catName.trim();
  const displayCatName = trimmedCatName || "この子";
  const currentQuestion = INITIAL_QUESTIONS[questionIndex];
  const result = useMemo(() => buildOnboardingResult(answers), [answers]);
  const answeredInitialCount = INITIAL_QUESTIONS.filter(
    (question) => answers[question.questionId],
  ).length;
  const skippedInitialCount = INITIAL_QUESTIONS.length - answeredInitialCount;
  const hasHealthSignal = result.scores.health >= 2;

  function startQuestions() {
    setCatName(trimmedCatName || "ミケ");
    setMessage("");
    setStep("question");
  }

  function answerQuestion(
    question: OnboardingQuestionDefinition,
    optionId: string | null,
  ) {
    setAnswers((current) => ({
      ...current,
      [question.questionId]: optionId,
    }));

    if (questionIndex >= INITIAL_QUESTIONS.length - 1) {
      setStep("result");
      return;
    }

    setQuestionIndex((current) => current + 1);
  }

  function saveAndGoHome() {
    const now = new Date().toISOString();
    const profile: CatProfile = {
      ...createLocalCatProfile(displayCatName, {
        createdAt: now,
        updatedAt: now,
      }),
      typeKey: result.type.typeKey,
      typeLabel: result.type.typeLabel,
      typeScores: result.scores,
      modifiers: result.modifiers,
      onboarding: {
        version: ONBOARDING_VERSION,
        answeredCount: answeredInitialCount,
        skippedCount: skippedInitialCount,
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
              鳴く・ついてくる・落ち着かない。行動から“いまの気持ち”が見えてきます。
            </p>

            <div style={styles.formBlock}>
              <label style={styles.label} htmlFor="diagnosis-onboarding-cat-name">
                この子、なんて呼んでますか？
              </label>
              <input
                id="diagnosis-onboarding-cat-name"
                type="text"
                value={catName}
                onChange={(event) => setCatName(event.target.value)}
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

        {step === "question" && currentQuestion ? (
          <QuestionStep
            catName={displayCatName}
            question={currentQuestion}
            questionNumber={questionIndex + 1}
            onAnswer={(optionId) => answerQuestion(currentQuestion, optionId)}
          />
        ) : null}

        {step === "result" ? (
          <section style={styles.resultCard}>
            <p style={styles.eyebrow}>最初の手がかり</p>
            <h1 style={styles.title}>{displayCatName}のこと、少し見えてきました</h1>

            <div style={styles.resultSummary}>
              <p style={styles.resultLead}>
                今の回答だけで見ると、
                <br />
                {tendencyTexts[result.type.typeKey]}かもしれません。
              </p>
              <p style={styles.resultText}>
                まだ最初の手がかりなので、これからの記録や回答で少しずつ変わります。
              </p>
              <p style={styles.typeHint}>
                今のところ、{result.type.typeLabel}寄りかもしれません。
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

            <div style={styles.actions}>
              <button type="button" onClick={saveAndGoHome} style={styles.primaryButton}>
                ホームで見る
              </button>
              <button
                type="button"
                onClick={() =>
                  setMessage("追加の質問は次のステップで使えるようにします。")
                }
                style={styles.secondaryButton}
              >
                もう少し詳しく見る
              </button>
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
  onAnswer,
}: {
  catName: string;
  question: OnboardingQuestionDefinition;
  questionNumber: number;
  onAnswer: (optionId: string | null) => void;
}) {
  return (
    <section style={styles.questionCard}>
      <p style={styles.eyebrow}>質問 {questionNumber} / 3</p>
      <h1 style={styles.questionTitle}>{question.question}</h1>
      <p style={styles.lead}>{catName}のことを、少しだけ教えてください。</p>

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
    </section>
  );
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
  actions: {
    display: "grid",
    gap: "10px",
  },
  message: {
    margin: "12px 0 0",
    color: "#71717a",
    fontSize: "13px",
    lineHeight: 1.6,
    textAlign: "center",
  },
} satisfies Record<string, CSSProperties>;
