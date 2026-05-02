"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CSSProperties } from "react";

const concernOptions = [
  "\u9cf4\u3044\u3066\u308b",
  "\u3064\u3044\u3066\u304f\u308b",
  "\u843d\u3061\u7740\u304b\u306a\u3044",
  "\u5143\u6c17\u306a\u3044",
  "\u30b1\u30f3\u30ab\u3057\u3066\u308b",
  "\u3088\u304f\u308f\u304b\u3089\u306a\u3044",
];

const timingOptions = [
  "\u591c",
  "\u98df\u5f8c",
  "\u3088\u304f\u308f\u304b\u3089\u306a\u3044",
];

const reasons = [
  "\u591c\u306f\u904a\u3073\u305f\u3044\u6c17\u6301\u3061\u304c\u51fa\u3084\u3059\u3044\u6642\u9593\u3067\u3059",
  "\u9cf4\u304f\u884c\u52d5\u306f\u304b\u307e\u3063\u3066\u307b\u3057\u3044\u6642\u306b\u3082\u898b\u3089\u308c\u307e\u3059",
];

export function OnboardingFlow() {
  const router = useRouter();
  const [step, setStep] = useState(1);

  function nextStep() {
    setStep((current) => Math.min(current + 1, 5));
  }

  function completeOnboarding() {
    window.localStorage.setItem("onboarding_completed", "true");
    window.localStorage.setItem("last_input_signal", "meowing");
    window.localStorage.setItem("last_context", JSON.stringify({ time: "night" }));
    window.localStorage.setItem("last_primary_category", "play");
    window.localStorage.setItem(
      "latest_hypothesis",
      JSON.stringify({
        source: "onboarding",
        text: "\u904a\u3073\u305f\u3044\u53ef\u80fd\u6027\u304c\u3042\u308a\u307e\u3059",
        category: "play",
        createdAt: new Date().toISOString(),
      }),
    );
    router.push("/home");
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        {step === 1 ? (
          <StepWithOptions
            title={"\u307e\u305a\u3001\u30df\u30b1\u306e\u3053\u3068\u3067\u6c17\u306b\u306a\u308b\u3053\u3068\u306f\uff1f"}
            options={concernOptions}
            onSelect={nextStep}
          />
        ) : null}

        {step === 2 ? (
          <StepWithOptions
            title={"\u3069\u3093\u306a\u6642\u306b\u591a\u3044\u3067\u3059\u304b\uff1f"}
            options={timingOptions}
            onSelect={nextStep}
          />
        ) : null}

        {step === 3 ? (
          <section>
            <h1 style={styles.title}>
              {"\u904a\u3073\u305f\u3044\u53ef\u80fd\u6027\u304c\u9ad8\u3044\u3067\u3059"}
            </h1>
            <ul style={styles.reasonList}>
              {reasons.map((reason) => (
                <li key={reason} style={styles.reasonItem}>
                  {reason}
                </li>
              ))}
            </ul>
            <button type="button" onClick={nextStep} style={styles.primaryButton}>
              {"\u6b21\u3078"}
            </button>
          </section>
        ) : null}

        {step === 4 ? (
          <section>
            <h1 style={styles.title}>
              {"\u307e\u305a\u306f\u5c11\u3057\u904a\u3093\u3067\u307f\u307e\u3057\u3087\u3046"}
            </h1>
            <div style={styles.grid}>
              <button type="button" onClick={nextStep} style={styles.button}>
                {"\u904a\u3093\u3060"}
              </button>
              <button type="button" onClick={nextStep} style={styles.button}>
                {"\u307e\u3060\u9cf4\u3044\u3066\u3044\u308b"}
              </button>
            </div>
          </section>
        ) : null}

        {step === 5 ? (
          <section>
            <h1 style={styles.title}>{"\u30df\u30b1\u306e\u7406\u89e3\u5ea6 10%"}</h1>
            <p style={styles.bodyText}>
              {"\u5c11\u3057\u305a\u3064\u30df\u30b1\u306e\u3053\u3068\u304c\u308f\u304b\u3063\u3066\u304d\u307e\u3059\u3002"}
            </p>
            <p style={styles.bodyText}>
              {"\u3053\u308c\u304b\u3089\u306f\u3001\u8a18\u9332\u304c\u5897\u3048\u308b\u307b\u3069"}
              <br />
              {"\u300c\u4eca\u3053\u3046\u304b\u3082\u300d\u3092\u51fa\u305b\u308b\u3088\u3046\u306b\u306a\u308a\u307e\u3059\u3002"}
            </p>
            <button
              type="button"
              onClick={completeOnboarding}
              style={styles.primaryButton}
            >
              {"\u306f\u3058\u3081\u308b"}
            </button>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function StepWithOptions({
  title,
  options,
  onSelect,
}: {
  title: string;
  options: string[];
  onSelect: () => void;
}) {
  return (
    <section>
      <h1 style={styles.title}>{title}</h1>
      <div style={styles.grid}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={onSelect}
            style={styles.button}
          >
            {option}
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
    padding: "44px 20px",
  },
  title: {
    margin: "0 0 28px",
    fontSize: "24px",
    fontWeight: 600,
    lineHeight: 1.5,
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
  primaryButton: {
    width: "100%",
    minHeight: "60px",
    marginTop: "28px",
    border: "1px solid #a1a1aa",
    borderRadius: "14px",
    background: "#3f3f46",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: 600,
    letterSpacing: 0,
    cursor: "pointer",
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
  bodyText: {
    margin: "0 0 18px",
    color: "#52525b",
    fontSize: "15px",
    lineHeight: 1.8,
    letterSpacing: 0,
  },
} satisfies Record<string, CSSProperties>;
