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
  buildPredictedConcernOptions,
  clearLatestHypothesis,
  getGuidanceByUnderstanding,
  getHypothesisCompletionMessage,
  parseStoredContext,
  readLatestHypothesis,
} from "./homeInputHelpers";
import type { LatestHypothesisView } from "./homeInputHelpers";

type HomeInputProps = {
  recentEvents: RecentEvent[];
  understandingPercent: number;
  understandingMessage: string;
};

export function HomeInput({
  recentEvents,
  understandingPercent,
  understandingMessage,
}: HomeInputProps) {
  const router = useRouter();
  const [visibleLatestHypothesis, setVisibleLatestHypothesis] =
    useState<LatestHypothesisView | null>(null);
  const [hypothesisMessage, setHypothesisMessage] = useState("");

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

  async function handleCurrentSelect(label: string, signal: string) {
    dismissLatestHypothesis();
    await insertEvent({
      event_type: "current_state",
      signal,
      label,
      source: "home",
    });
  }

  async function handleConcernSelect(label: string, input: string) {
    dismissLatestHypothesis();
    const event = await insertEvent({
      event_type: "concern",
      signal: input,
      label,
      source: "home",
    });

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
      setHypothesisMessage("\u8a18\u9332\u306f\u4fdd\u5b58\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f");
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
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <Header
          understandingPercent={understandingPercent}
          understandingMessage={understandingMessage}
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
  understandingPercent,
  understandingMessage,
}: {
  understandingPercent: number;
  understandingMessage: string;
}) {
  return (
    <div style={styles.header}>
      <h1 style={styles.title}>{"\u30df\u30b1"}</h1>
      <p style={styles.understanding}>
        {"\u30df\u30b1\u306e\u7406\u89e3\u5ea6 "}
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
