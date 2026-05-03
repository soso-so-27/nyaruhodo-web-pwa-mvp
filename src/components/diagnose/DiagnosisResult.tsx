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

const ctaLabels: Record<
  CauseCategory,
  {
    main: string;
    sub: string;
  }
> = {
  food: {
    main: "ごはんを確認してみる",
    sub: "違うかも",
  },
  play: {
    main: "3分だけ遊んでみる",
    sub: "違うかも",
  },
  social: {
    main: "声をかけてみる",
    sub: "違うかも",
  },
  stress: {
    main: "静かな場所をつくる",
    sub: "違うかも",
  },
  health: {
    main: "体調を見てあげる",
    sub: "違うかも",
  },
};

const fallbackCtaLabels = {
  main: "少し様子を見る",
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
  const [feedbackOutcome, setFeedbackOutcome] = useState<
    "resolved" | "unresolved" | null
  >(null);
  const [catName, setCatName] = useState("");
  const currentCategory = categories[0];
  const nextCategory = categories[1];
  const labels = currentCategory
    ? ctaLabels[currentCategory]
    : fallbackCtaLabels;
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
      setFeedbackOutcome(null);
      return;
    }

    setFeedbackMessage(getCompletionMessage(currentCategory, feedback));
    setFeedbackOutcome(feedback);
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

        <section style={styles.hypothesisCard}>
          <p style={styles.cardLabel}>{"\u307e\u305a\u306f\u3053\u3053\u304b\u3089"}</p>
          <p style={styles.hypothesisText}>{displayHypothesisText}</p>
        </section>

        {secondaryHypothesisText ? (
          <section style={styles.secondaryCard}>
            <p style={styles.secondaryLabel}>{"ほかにも"}</p>
            <p style={styles.secondaryText}>{secondaryHypothesisText}</p>
          </section>
        ) : null}

        <section style={styles.reasonCard}>
          <p style={styles.cardTitle}>{"\u624b\u304c\u304b\u308a"}</p>
          <ul style={styles.reasonList}>
            {reasons.map((reason) => (
              <li key={reason} style={styles.reasonItem}>
                {reason}
              </li>
            ))}
          </ul>
        </section>

        <section style={styles.actionCard}>
          <p style={styles.cardTitle}>{"\u307e\u305a\u306f\u5c11\u3057\u3060\u3051"}</p>
          <p style={styles.actionIntro}>
            {getActionIntro(currentCategory)}
          </p>
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

        {feedbackOutcome ? (
          <NextActionCard
            category={currentCategory}
            feedback={feedbackOutcome}
            onHomeClick={() => router.push("/home")}
          />
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

function getCompletionMessage(
  category: CauseCategory,
  feedback: "resolved" | "unresolved",
) {
  if (feedback === "unresolved") {
    return "ありがとう。\n違ったことも記録しました。";
  }

  if (category === "health") {
    return "記録しました。\n気になる様子が続くときは、早めに相談してください。";
  }

  return "記録しました。\nこの子の傾向づくりに使います。";
}

function getActionIntro(category: CauseCategory | undefined) {
  const actionIntros: Record<CauseCategory, string> = {
    food: "ごはんやお水を見たあと、少し様子を見てみましょう。",
    play: "3分だけ遊んだあと、落ち着くか少し見てみましょう。",
    social: "声をかけたり近くにいてあげて、反応を見てみましょう。",
    stress: "静かな場所をつくって、しばらく様子を見てみましょう。",
    health: "気になる様子が続くときは、早めに相談してください。",
  };

  return category
    ? actionIntros[category]
    : "少し様子を見て、気になることが続くときはもう一度記録してみましょう。";
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

function NextActionCard({
  category,
  feedback,
  onHomeClick,
}: {
  category: CauseCategory | undefined;
  feedback: "resolved" | "unresolved";
  onHomeClick: () => void;
}) {
  const content = getNextActionContent(category, feedback);

  return (
    <section style={styles.nextActionCard}>
      <p style={styles.cardTitle}>{content.title}</p>
      <p style={styles.nextActionText}>{content.body}</p>
      <button type="button" onClick={onHomeClick} style={styles.nextActionButton}>
        {content.button}
      </button>
    </section>
  );
}

function getNextActionContent(
  category: CauseCategory | undefined,
  feedback: "resolved" | "unresolved",
) {
  if (feedback === "unresolved") {
    return {
      title: "違ったことも記録しました",
      body: "次から少し見立てを調整します。\nまだ気になるときは、もう一度いまの様子を選んでください。",
      button: "ホームに戻る",
    };
  }

  const resolvedContent: Record<
    CauseCategory,
    { title: string; body: string; button: string }
  > = {
    food: {
      title: "まずは試してみてください",
      body: "ごはんやお水を確認したあと、少し様子を見てみましょう。\n落ち着いたら今日はこれでOKです。",
      button: "ホームで様子を見る",
    },
    play: {
      title: "まずは試してみてください",
      body: "3分だけ遊んだあと、少し様子を見てみましょう。\n落ち着いたら今日はこれでOKです。",
      button: "ホームで様子を見る",
    },
    social: {
      title: "まずは試してみてください",
      body: "声をかけたり近くにいてあげたあと、少し様子を見てみましょう。\n落ち着いたら今日はこれでOKです。",
      button: "ホームで様子を見る",
    },
    stress: {
      title: "まずは試してみてください",
      body: "静かな場所をつくったあと、少し様子を見てみましょう。\n落ち着いたら今日はこれでOKです。",
      button: "ホームで様子を見る",
    },
    health: {
      title: "まずは様子を見てください",
      body: "体調の気になる様子が続くときは、早めに相談してください。\nまずは無理に判断せず、様子を見てあげましょう。",
      button: "ホームで様子を見る",
    },
  };

  return (
    category ? resolvedContent[category] : undefined
  ) ?? {
    title: "まずは様子を見てください",
    body: "少し様子を見て、気になることが続くときはもう一度記録してみましょう。",
    button: "ホームで様子を見る",
  };
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
