"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("app route error", error);
  }, [error]);

  return (
    <main style={styles.page}>
      <section style={styles.panel} role="alert">
        <p style={styles.kicker}>ねてるねこ</p>
        <h1 style={styles.title}>うまく開けませんでした</h1>
        <p style={styles.copy}>
          通信を確認して、もう一度お試しください。保存済みの写真や記録は、そのまま残ります。
        </p>
        <button type="button" style={styles.primary} onClick={reset}>
          もう一度読み込む
        </button>
        <a href="/" style={styles.link}>
          ホームへ戻る
        </a>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100dvh",
    display: "grid",
    placeItems: "center",
    padding: "32px 24px",
    boxSizing: "border-box" as const,
    background: "#f4f1ea",
    color: "#4a3f35",
    fontFamily:
      'Outfit, "Zen Kaku Gothic New", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  panel: {
    width: "min(100%, 360px)",
    display: "grid",
    justifyItems: "center",
    gap: "18px",
    textAlign: "center" as const,
  },
  kicker: { margin: 0, color: "#8a8174", fontSize: "13px" },
  title: { margin: 0, fontSize: "24px", fontWeight: 500, lineHeight: 1.5 },
  copy: { margin: 0, color: "#6f6757", fontSize: "14px", lineHeight: 1.9 },
  primary: {
    minWidth: "220px",
    minHeight: "50px",
    padding: "0 24px",
    border: "1px solid rgba(168,88,78,0.34)",
    borderRadius: "999px",
    background: "#a8584e",
    color: "#fffdfa",
    font: "inherit",
    cursor: "pointer",
  },
  link: { color: "#6f6757", fontSize: "13px", textDecoration: "underline" },
};
