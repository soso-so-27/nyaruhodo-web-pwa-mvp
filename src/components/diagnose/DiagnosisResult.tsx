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

const categoryLabels: Record<CauseCategory, string> = {
  food: "\u3054\u98ef",
  play: "\u904a\u3073",
  social: "\u304b\u307e\u3063\u3066\u307b\u3057\u3044",
  stress: "\u30b9\u30c8\u30ec\u30b9",
  health: "\u4f53\u8abf",
};

const hypothesisMessages: Record<CauseCategory, string> = {
  food: "\u3054\u98ef\u304b\u3082\u3057\u308c\u307e\u305b\u3093",
  play: "\u904a\u3073\u305f\u3044\u53ef\u80fd\u6027\u304c\u3042\u308a\u307e\u3059",
  social: "\u304b\u307e\u3063\u3066\u307b\u3057\u3044\u53ef\u80fd\u6027\u304c\u3042\u308a\u307e\u3059",
  stress: "\u5c11\u3057\u843d\u3061\u7740\u304d\u305f\u3044\u53ef\u80fd\u6027\u304c\u3042\u308a\u307e\u3059",
  health: "\u4f53\u8abf\u3092\u898b\u3066\u3042\u3052\u305f\u65b9\u304c\u3088\u3055\u305d\u3046\u3067\u3059",
};

const ctaLabels: Record<
  CauseCategory,
  {
    main: string;
    sub: string;
  }
> = {
  food: {
    main: "\u3054\u306f\u3093\u3092\u78ba\u8a8d\u3057\u305f",
    sub: "\u307e\u3060\u69d8\u5b50\u3092\u898b\u308b",
  },
  play: {
    main: "\u904a\u3093\u3067\u307f\u305f",
    sub: "\u307e\u3060\u69d8\u5b50\u3092\u898b\u308b",
  },
  social: {
    main: "\u304b\u307e\u3063\u3066\u307f\u305f",
    sub: "\u307e\u3060\u69d8\u5b50\u3092\u898b\u308b",
  },
  stress: {
    main: "\u843d\u3061\u7740\u3051\u308b\u3088\u3046\u306b\u3057\u305f",
    sub: "\u307e\u3060\u69d8\u5b50\u3092\u898b\u308b",
  },
  health: {
    main: "\u4f53\u8abf\u3092\u78ba\u8a8d\u3057\u305f",
    sub: "\u8a18\u9332\u3060\u3051\u3059\u308b",
  },
};

const fallbackCtaLabels = {
  main: "\u69d8\u5b50\u3092\u8a18\u9332\u3059\u308b",
  sub: "\u30db\u30fc\u30e0\u306b\u623b\u308b",
};

const feedbackSaveErrorMessage =
  "\u884c\u52d5\u306e\u8a18\u9332\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\n\u5c11\u3057\u6642\u9593\u3092\u304a\u3044\u3066\u3001\u3082\u3046\u4e00\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002";

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
  const [nextCandidateText, setNextCandidateText] = useState("");
  const currentCategory = categories[0];
  const nextCategory = categories[1];
  const labels = currentCategory
    ? ctaLabels[currentCategory]
    : fallbackCtaLabels;

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
    setNextCandidateText(
      feedback === "unresolved" && nextCategory
        ? `${categoryLabels[nextCategory]}\u306e\u53ef\u80fd\u6027\u3082\u3042\u308a\u307e\u3059`
        : "",
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.title}>{"\u8a3a\u65ad\u7d50\u679c"}</h1>

        <section style={styles.resultSection}>
          <p style={styles.resultText}>{resultText}</p>

          <ul style={styles.reasonList}>
            {reasons.map((reason) => (
              <li key={reason} style={styles.reasonItem}>
                {reason}
              </li>
            ))}
          </ul>
        </section>

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

        {feedbackMessage ? (
          <p style={styles.feedbackMessage}>{feedbackMessage}</p>
        ) : null}

        {persistenceMessage ? (
          <p style={styles.persistenceMessage}>{persistenceMessage}</p>
        ) : null}

        {nextCandidateText ? (
          <p style={styles.nextCandidate}>{nextCandidateText}</p>
        ) : null}

        <button
          type="button"
          onClick={() => router.push("/home")}
          style={styles.homeButton}
        >
          {"\u30db\u30fc\u30e0\u306b\u623b\u308b"}
        </button>
      </div>
    </main>
  );
}

function getCompletionMessage(category: CauseCategory) {
  if (category === "health") {
    return "\u8a18\u9332\u3057\u307e\u3057\u305f\u3002\n\u6c17\u306b\u306a\u308b\u69d8\u5b50\u304c\u7d9a\u304f\u3068\u304d\u306f\u3001\u65e9\u3081\u306b\u76f8\u8ac7\u3057\u3066\u304f\u3060\u3055\u3044\u3002";
  }

  return "\u8a18\u9332\u3057\u307e\u3057\u305f\u3002\n\u307e\u305f\u5c11\u3057\u3001\u3053\u306e\u5b50\u306e\u50be\u5411\u304c\u898b\u3048\u3066\u304d\u307e\u3057\u305f\u3002";
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
    width: "min(100%, 560px)",
    margin: "0 auto",
    padding: "48px 24px",
  },
  title: {
    margin: "0 0 44px",
    fontSize: "30px",
    fontWeight: 600,
    letterSpacing: 0,
  },
  resultSection: {
    marginBottom: "32px",
  },
  resultText: {
    margin: "0 0 24px",
    fontSize: "22px",
    fontWeight: 600,
    lineHeight: 1.6,
    letterSpacing: 0,
  },
  reasonList: {
    display: "grid",
    gap: "12px",
    margin: 0,
    padding: 0,
    listStyle: "none",
  },
  reasonItem: {
    border: "1px solid #d4d4d8",
    borderRadius: "14px",
    background: "#ffffff",
    padding: "16px",
    fontSize: "15px",
    lineHeight: 1.7,
  },
  ctaButton: {
    width: "100%",
    minHeight: "58px",
    border: "1px solid #a1a1aa",
    borderRadius: "14px",
    background: "#3f3f46",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: 600,
    letterSpacing: 0,
    cursor: "pointer",
  },
  feedbackGroup: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
    marginTop: "0",
  },
  feedbackButton: {
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
  feedbackMessage: {
    margin: "18px 0 0",
    color: "#52525b",
    fontSize: "14px",
    lineHeight: 1.6,
    whiteSpace: "pre-line",
  },
  persistenceMessage: {
    margin: "18px 0 0",
    color: "#52525b",
    fontSize: "14px",
    lineHeight: 1.6,
    whiteSpace: "pre-line",
  },
  nextCandidate: {
    margin: "10px 0 0",
    border: "1px solid #d4d4d8",
    borderRadius: "14px",
    background: "#ffffff",
    padding: "14px 16px",
    color: "#27272a",
    fontSize: "15px",
    lineHeight: 1.7,
  },
  homeButton: {
    minHeight: "44px",
    marginTop: "24px",
    border: "none",
    background: "transparent",
    color: "#52525b",
    fontSize: "14px",
    fontWeight: 500,
    letterSpacing: 0,
    cursor: "pointer",
  },
} satisfies Record<string, CSSProperties>;
