"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { applyDiagnosisFeedback } from "../../core/understanding/feedback";
import type { CauseCategory } from "../../core/types";
import { insertFeedback } from "../../lib/supabase/queries";

type DiagnosisResultProps = {
  resultText: string;
  reasons: string[];
  categories: CauseCategory[];
  diagnosisId: string | null;
  localCatId?: string | null;
  persistenceMessage?: string;
};

const hypothesisMessages: Record<CauseCategory, string> = {
  food: "お腹が空いている可能性があります",
  play: "遊びたい可能性があります",
  social: "かまってほしい可能性があります",
  stress: "少し落ち着かない可能性があります",
  health: "体調に注意した方がよい可能性があります",
};

const ctaLabels: Record<
  CauseCategory,
  {
    main: string;
    sub: string;
  }
> = {
  food: {
    main: "ごはんを確認する",
    sub: "違うかも",
  },
  play: {
    main: "3分だけ遊ぶ",
    sub: "違うかも",
  },
  social: {
    main: "声をかける",
    sub: "違うかも",
  },
  stress: {
    main: "静かな場所にする",
    sub: "違うかも",
  },
  health: {
    main: "体調を確認する",
    sub: "違うかも",
  },
};

const fallbackCtaLabels = {
  main: "様子を見る",
  sub: "違うかも",
};

const feedbackSaveErrorMessage =
  "行動の記録に失敗しました。\n少し時間をおいて、もう一度お試しください。";

export function DiagnosisResult({
  resultText,
  reasons,
  categories,
  diagnosisId,
  localCatId,
  persistenceMessage,
}: DiagnosisResultProps) {
  const router = useRouter();
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const currentCategory = categories[0];
  const nextCategory = categories[1];
  const labels = currentCategory
    ? ctaLabels[currentCategory]
    : fallbackCtaLabels;
  const mainHypothesisText = currentCategory
    ? hypothesisMessages[currentCategory]
    : resultText;
  const secondaryHypothesisText = nextCategory
    ? hypothesisMessages[nextCategory]
    : "";

  useEffect(() => {
    if (!currentCategory) {
      return;
    }

    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + 3 * 60 * 60 * 1000);

    window.localStorage.setItem(
      "latest_hypothesis",
      JSON.stringify({
        source: "diagnosis",
        text: hypothesisMessages[currentCategory],
        category: currentCategory,
        diagnosisId,
        localCatId: localCatId ?? null,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      }),
    );
  }, [currentCategory, diagnosisId, localCatId]);

  async function handleAction(feedback: "resolved" | "unresolved") {
    if (!currentCategory) {
      setFeedbackMessage(feedbackSaveErrorMessage);
      return;
    }

    applyDiagnosisFeedback(currentCategory, feedback);
    const savedFeedback = await insertFeedback({
      diagnosis_id: diagnosisId,
      feedback,
      category: currentCategory,
      localCatId,
    });

    if (!savedFeedback) {
      setFeedbackMessage(feedbackSaveErrorMessage);
      return;
    }

    setFeedbackMessage(getCompletionMessage(currentCategory));
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.title}>{"診断結果"}</h1>
            <p style={styles.lead}>{"さっきの様子から見ています"}</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/home")}
            style={styles.headerHomeButton}
          >
            {"ホームに戻る"}
          </button>
        </header>

        <section style={styles.hypothesisCard}>
          <p style={styles.cardLabel}>{"今の仮説"}</p>
          <p style={styles.hypothesisText}>{mainHypothesisText}</p>
        </section>

        {secondaryHypothesisText ? (
          <section style={styles.secondaryCard}>
            <p style={styles.secondaryLabel}>{"ほかにもありそう"}</p>
            <p style={styles.secondaryText}>{secondaryHypothesisText}</p>
          </section>
        ) : null}

        <section style={styles.reasonCard}>
          <p style={styles.cardTitle}>{"そう考えた理由"}</p>
          <ul style={styles.reasonList}>
            {reasons.map((reason) => (
              <li key={reason} style={styles.reasonItem}>
                {reason}
              </li>
            ))}
          </ul>
        </section>

        <section style={styles.actionCard}>
          <p style={styles.cardTitle}>{"まず試すなら"}</p>
          <div style={styles.feedbackGroup}>
            <button
              type="button"
              onClick={() => {
                void handleAction("resolved");
              }}
              style={styles.ctaButton}
            >
              {labels.main}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!currentCategory) {
                  router.push("/home");
                  return;
                }

                void handleAction("unresolved");
              }}
              style={styles.feedbackButton}
            >
              {labels.sub}
            </button>
          </div>
        </section>

        {feedbackMessage ? (
          <p style={styles.feedbackMessage}>{feedbackMessage}</p>
        ) : null}

        {persistenceMessage ? (
          <p style={styles.persistenceMessage}>{persistenceMessage}</p>
        ) : null}

        <button
          type="button"
          onClick={() => router.push("/home")}
          style={styles.homeButton}
        >
          {"ホームに戻る"}
        </button>
      </div>
    </main>
  );
}

function getCompletionMessage(category: CauseCategory) {
  if (category === "health") {
    return "記録しました。\n気になる様子が続くときは、早めに相談してください。";
  }

  return "記録しました。\nまた少し、この子の傾向が見えてきました。";
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#fffaf3",
    color: "#27272a",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
    width: "min(100%, 560px)",
    margin: "0 auto",
    padding: "28px 20px calc(40px + env(safe-area-inset-bottom))",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "14px",
  },
  title: {
    margin: 0,
    color: "#18181b",
    fontSize: "28px",
    fontWeight: 700,
    letterSpacing: 0,
  },
  lead: {
    margin: "6px 0 0",
    color: "#71717a",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  headerHomeButton: {
    minHeight: "34px",
    border: "1px solid #eadbca",
    borderRadius: "999px",
    background: "#ffffff",
    color: "#52525b",
    fontSize: "12px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    padding: "0 12px",
    cursor: "pointer",
  },
  hypothesisCard: {
    marginBottom: "10px",
    border: "1px solid #eadbca",
    borderRadius: "18px",
    background: "#ffffff",
    padding: "18px",
  },
  cardLabel: {
    display: "inline-flex",
    width: "fit-content",
    margin: "0 0 10px",
    border: "1px solid #eadbca",
    borderRadius: "999px",
    background: "#fffaf3",
    color: "#6b5f54",
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: 1.5,
    padding: "2px 9px",
  },
  hypothesisText: {
    margin: 0,
    color: "#18181b",
    fontSize: "22px",
    fontWeight: 700,
    lineHeight: 1.55,
    letterSpacing: 0,
  },
  secondaryCard: {
    marginBottom: "10px",
    border: "1px solid #e4e4e7",
    borderRadius: "16px",
    background: "#ffffff",
    padding: "14px 16px",
  },
  secondaryLabel: {
    margin: "0 0 4px",
    color: "#71717a",
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: 1.5,
  },
  secondaryText: {
    margin: 0,
    color: "#3f3f46",
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: 1.6,
  },
  reasonCard: {
    marginBottom: "10px",
    border: "1px solid #e4e4e7",
    borderRadius: "18px",
    background: "#ffffff",
    padding: "16px",
  },
  actionCard: {
    marginBottom: "10px",
    border: "1px solid #eadbca",
    borderRadius: "18px",
    background: "#fffdf9",
    padding: "16px",
  },
  cardTitle: {
    margin: "0 0 10px",
    color: "#27272a",
    fontSize: "15px",
    fontWeight: 700,
    lineHeight: 1.5,
  },
  reasonList: {
    display: "grid",
    gap: "8px",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  reasonItem: {
    border: "1px solid #f0e6dc",
    borderRadius: "12px",
    background: "#fffaf3",
    padding: "12px",
    color: "#52525b",
    fontSize: "14px",
    lineHeight: 1.7,
  },
  feedbackGroup: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "10px",
    marginTop: "0",
  },
  ctaButton: {
    width: "100%",
    minHeight: "56px",
    border: "1px solid #a1a1aa",
    borderRadius: "14px",
    background: "#3f3f46",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: 700,
    letterSpacing: 0,
    cursor: "pointer",
  },
  feedbackButton: {
    minHeight: "50px",
    border: "1px solid #d4d4d8",
    borderRadius: "14px",
    background: "#ffffff",
    color: "#27272a",
    fontSize: "15px",
    fontWeight: 600,
    letterSpacing: 0,
    cursor: "pointer",
  },
  feedbackMessage: {
    margin: "14px 0 0",
    color: "#52525b",
    fontSize: "14px",
    lineHeight: 1.6,
    whiteSpace: "pre-line",
  },
  persistenceMessage: {
    margin: "14px 0 0",
    color: "#52525b",
    fontSize: "14px",
    lineHeight: 1.6,
    whiteSpace: "pre-line",
  },
  homeButton: {
    minHeight: "44px",
    marginTop: "18px",
    border: "none",
    background: "transparent",
    color: "#52525b",
    fontSize: "14px",
    fontWeight: 600,
    letterSpacing: 0,
    cursor: "pointer",
  },
} satisfies Record<string, CSSProperties>;
