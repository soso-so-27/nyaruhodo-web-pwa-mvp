"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { applyDiagnosisFeedback } from "../../core/understanding/feedback";
import type { BehaviorInput, CauseCategory } from "../../core/types";
import { insertFeedback } from "../../lib/supabase/queries";

type DiagnosisResultProps = {
  resultText: string;
  reasons: string[];
  categories: CauseCategory[];
  diagnosisId: string | null;
  input?: BehaviorInput;
  localCatId?: string | null;
  persistenceMessage?: string;
};

const hypothesisMessages: Record<CauseCategory, string> = {
  food: "ごはんが気になるかもしれません",
  play: "遊びたい気持ちかもしれません",
  social: "かまってほしい気持ちかもしれません",
  stress: "少し落ち着かない気持ちかもしれません",
  health: "体調を少し見てあげてもよさそうです",
};

const secondaryHypothesisMessages: Record<CauseCategory, string> = {
  food: "ごはんが気になる気持ちもありそうです",
  play: "遊びたい気持ちもありそうです",
  social: "かまってほしい気持ちもありそうです",
  stress: "少し落ち着かない気持ちもありそうです",
  health: "体調も少し見てあげるとよさそうです",
};

const outcomeLabels: Record<
  CauseCategory,
  {
    resolved: string;
    unresolved: string;
  }
> = {
  food: {
    resolved: "落ち着いた",
    unresolved: "まだ気になる",
  },
  play: {
    resolved: "落ち着いた",
    unresolved: "まだ気になる",
  },
  social: {
    resolved: "落ち着いた",
    unresolved: "まだ気になる",
  },
  stress: {
    resolved: "落ち着いた",
    unresolved: "まだ気になる",
  },
  health: {
    resolved: "少し落ち着いた",
    unresolved: "まだ気になる",
  },
};

const fallbackOutcomeLabels = {
  resolved: "落ち着いた",
  unresolved: "まだ気になる",
};

const feedbackSaveErrorMessage =
  "行動の記録に失敗しました。\n少し時間をおいて、もう一度お試しください。";

export function DiagnosisResult({
  resultText,
  reasons,
  categories,
  diagnosisId,
  input,
  localCatId,
  persistenceMessage,
}: DiagnosisResultProps) {
  const router = useRouter();
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [catName, setCatName] = useState("");
  const currentCategory = categories[0];
  const nextCategory = categories[1];
  const labels = getOutcomeLabels(input, currentCategory);
  const mainHypothesisText = currentCategory
    ? hypothesisMessages[currentCategory]
    : resultText;
  const displayHypothesisText = catName
    ? `${catName}\u3001${mainHypothesisText}`
    : mainHypothesisText;
  const secondaryHypothesisText = nextCategory
    ? getSecondaryHypothesisMessage(nextCategory)
    : "";

  useEffect(() => {
    setCatName(readCatName(localCatId));
  }, [localCatId]);

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

  async function handleAction(
    feedback: "resolved" | "unresolved",
    label: string,
  ) {
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

    clearLatestHypothesis();
    savePostDiagnosisFeedback({
      localCatId,
      result: feedback,
      category: currentCategory,
      label,
    });
    setFeedbackMessage("");
    router.push("/home");
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div>
            <p style={styles.headerEyebrow}>{"\u8a3a\u65ad\u7d50\u679c"}</p>
            <h1 style={styles.title}>{"\u3055\u3063\u304d\u306e\u69d8\u5b50\u304b\u3089"}</h1>
            <p style={styles.lead}>{"\u6c7a\u3081\u3064\u3051\u305a\u306b\u3001\u307e\u305a\u3067\u304d\u308b\u3053\u3068\u3092\u898b\u3066\u307f\u307e\u3057\u3087\u3046"}</p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/home")}
            style={styles.headerHomeButton}
          >
            {"ホームに戻る"}
          </button>
        </header>

        <section style={styles.actionCard}>
          <p style={styles.cardTitle}>{"\u3067\u304d\u305d\u3046\u306a\u3053\u3068"}</p>
          <p style={styles.actionIntro}>
            {getActionIntro(currentCategory)}
          </p>
          <p style={styles.resultPrompt}>試したあと、教えてください。</p>
          <div style={styles.feedbackGroup}>
            <button
              type="button"
              onClick={() => {
                void handleAction("resolved", labels.resolved);
              }}
              style={styles.ctaButton}
            >
              {labels.resolved}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!currentCategory) {
                  router.push("/home");
                  return;
                }

                void handleAction("unresolved", labels.unresolved);
              }}
              style={styles.feedbackButton}
            >
              {labels.unresolved}
            </button>
          </div>
        </section>

        <section style={styles.hypothesisCard}>
          <p style={styles.cardLabel}>{"\u3044\u307e\u898b\u3048\u308b\u3053\u3068"}</p>
          <p style={styles.hypothesisText}>{displayHypothesisText}</p>
        </section>

        <section style={styles.reasonCard}>
          <p style={styles.cardTitle}>{"\u305d\u3046\u898b\u305f\u7406\u7531"}</p>
          <ul style={styles.reasonList}>
            {reasons.map((reason) => (
              <li key={reason} style={styles.reasonItem}>
                {reason}
              </li>
            ))}
          </ul>
        </section>

        {secondaryHypothesisText ? (
          <section style={styles.secondaryCard}>
            <p style={styles.secondaryLabel}>{"ほかにも"}</p>
            <p style={styles.secondaryText}>{secondaryHypothesisText}</p>
          </section>
        ) : null}

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

function getActionIntro(category: CauseCategory | undefined) {
  const actionIntros: Record<CauseCategory, string> = {
    food:
      "ごはんやお水を確認してみませんか？\n確認したあと、少し様子を見てみましょう。",
    play:
      "3分だけ遊んでみませんか？\n少し遊んだあと、様子を見てみましょう。",
    social:
      "声をかけたり、近くにいてあげませんか？\n少し関わったあと、様子を見てみましょう。",
    stress:
      "静かな場所をつくってみませんか？\n少し落ち着ける時間をつくって、様子を見てみましょう。",
    health:
      "いつもの様子と比べて、少し見てあげませんか？\n気になる様子が続くときは、早めに相談してください。",
  };

  return category
    ? actionIntros[category]
    : "少し様子を見てみませんか？\n気になることが続くときは、もう一度近い様子を選んでみてください。";
}

function getOutcomeLabels(
  input: BehaviorInput | undefined,
  category: CauseCategory | undefined,
) {
  if (input === "meowing") {
    return {
      resolved: "鳴きやんだ",
      unresolved: "まだ鳴いてる",
    };
  }

  return category ? outcomeLabels[category] : fallbackOutcomeLabels;
}

function clearLatestHypothesis() {
  window.localStorage.removeItem("latest_hypothesis");
}

function savePostDiagnosisFeedback({
  localCatId,
  result,
  category,
  label,
}: {
  localCatId?: string | null;
  result: "resolved" | "unresolved";
  category: CauseCategory;
  label: string;
}) {
  window.localStorage.setItem(
    "post_diagnosis_feedback",
    JSON.stringify({
      localCatId: localCatId ?? null,
      result,
      category,
      label,
      createdAt: new Date().toISOString(),
    }),
  );
}

function readCatName(localCatId?: string | null) {
  if (!localCatId) {
    return "";
  }

  try {
    const value = window.localStorage.getItem("cat_profiles");

    if (!value) {
      return "";
    }

    const profiles = JSON.parse(value) as Array<{
      id?: string;
      name?: string;
    }>;
    const profile = profiles.find((item) => item.id === localCatId);

    return profile?.name ?? "";
  } catch {
    return "";
  }
}

function getSecondaryHypothesisMessage(category: CauseCategory) {
  return secondaryHypothesisMessages[category];
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
    padding: "22px 14px calc(120px + env(safe-area-inset-bottom))",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "14px",
  },
  headerEyebrow: {
    margin: "0 0 4px",
    color: "#71717a",
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: 0,
  },
  title: {
    margin: 0,
    color: "#18181b",
    fontSize: "27px",
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
    borderRadius: "24px",
    background: "#fffaf3",
    padding: "20px 18px",
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
    fontSize: "20px",
    fontWeight: 700,
    lineHeight: 1.55,
    letterSpacing: 0,
  },
  secondaryCard: {
    marginBottom: "10px",
    border: "1px solid #e4e4e7",
    borderRadius: "16px",
    background: "#fffdf9",
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
    color: "#52525b",
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: 1.6,
  },
  reasonCard: {
    marginBottom: "10px",
    border: "1px solid #e4e4e7",
    borderRadius: "20px",
    background: "#ffffff",
    padding: "16px",
  },
  actionCard: {
    marginBottom: "10px",
    border: "1px solid #eadbca",
    borderRadius: "22px",
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
  actionIntro: {
    margin: "-2px 0 14px",
    color: "#71717a",
    fontSize: "14px",
    lineHeight: 1.7,
    whiteSpace: "pre-line",
  },
  resultPrompt: {
    margin: "0 0 12px",
    color: "#52525b",
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1.6,
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
  nextActionCard: {
    marginTop: "12px",
    marginBottom: "10px",
    border: "1px solid #eadbca",
    borderRadius: "18px",
    background: "#ffffff",
    padding: "16px",
  },
  nextActionText: {
    margin: "0 0 12px",
    color: "#52525b",
    fontSize: "14px",
    lineHeight: 1.7,
    whiteSpace: "pre-line",
  },
  nextActionButton: {
    width: "100%",
    minHeight: "48px",
    border: "1px solid #a1a1aa",
    borderRadius: "14px",
    background: "#3f3f46",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: 0,
    cursor: "pointer",
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
