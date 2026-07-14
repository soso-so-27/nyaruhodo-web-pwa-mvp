"use client";

import { useEffect } from "react";

import {
  isAppShellResourceError,
  recordAppRouteError,
  recoverAppShell,
} from "../lib/pwa/recoverAppShell";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("app route error", error);
    recordAppRouteError(error);
    if (isAppShellResourceError(error)) {
      void recoverAppShell({ automatic: true });
    }
  }, [error]);

  const diagnosticText = formatAppErrorDiagnostic(error);

  return (
    <main style={styles.page}>
      <section style={styles.panel} role="alert">
        <p style={styles.kicker}>ねてるねこ</p>
        <h1 style={styles.title}>うまく開けませんでした</h1>
        <p style={styles.copy}>
          通信を確認して、もう一度お試しください。保存済みの写真や記録は、そのまま残ります。
        </p>
        <button
          type="button"
          style={styles.primary}
          onClick={() => {
            void recoverAppShell().catch(() => reset());
          }}
        >
          更新してひらく
        </button>
        <div style={styles.secondaryActions}>
          <a href="/" style={styles.link}>
            ホームへ戻る
          </a>
          <a href="/settings" style={styles.link}>
            設定をひらく
          </a>
        </div>
        <details style={styles.details}>
          <summary style={styles.summary}>エラー情報を見る</summary>
          <code style={styles.code} data-testid="app-error-diagnostic">
            {diagnosticText}
          </code>
        </details>
      </section>
    </main>
  );
}

export function formatAppErrorDiagnostic(
  error: Error & { digest?: string },
) {
  const name = error.name || "Error";
  const message = error.message || "no message";
  const digest = error.digest ? ` / ${error.digest}` : "";

  return `${name}: ${message}${digest}`.slice(0, 600);
}

const styles = {
  page: {
    minHeight: "100dvh",
    display: "grid",
    placeItems: "center",
    padding: "32px 24px",
    boxSizing: "border-box" as const,
    background: "var(--app-paper-background, #f4f1ea)",
    color: "var(--ink, #4a3f35)",
    fontFamily:
      'var(--font-ui, "Zen Kaku Gothic New", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
  },
  panel: {
    width: "min(100%, 360px)",
    display: "grid",
    justifyItems: "center",
    gap: "18px",
    textAlign: "center" as const,
  },
  kicker: { margin: 0, color: "#8a8174", fontSize: "13px" },
  title: {
    margin: 0,
    fontFamily: 'var(--font-display, "Klee One", serif)',
    fontSize: "24px",
    fontWeight: 400,
    lineHeight: 1.5,
  },
  copy: { margin: 0, color: "#6f6757", fontSize: "14px", lineHeight: 1.9 },
  primary: {
    minWidth: "220px",
    minHeight: "50px",
    padding: "0 24px",
    border: "1px solid rgba(74,63,53,0.18)",
    borderRadius: "999px",
    background: "var(--ink, #4a3f35)",
    color: "var(--paper, #fffdfa)",
    font: "inherit",
    cursor: "pointer",
  },
  secondaryActions: {
    display: "flex",
    flexWrap: "wrap" as const,
    justifyContent: "center",
    gap: "12px 20px",
  },
  details: {
    width: "100%",
    color: "#6f6757",
    fontSize: "12px",
    textAlign: "left" as const,
  },
  summary: { cursor: "pointer", textAlign: "center" as const },
  code: {
    display: "block",
    marginTop: "10px",
    padding: "10px",
    borderRadius: "8px",
    background: "rgba(74, 63, 53, 0.06)",
    overflowWrap: "anywhere" as const,
    whiteSpace: "pre-wrap" as const,
  },
  link: { color: "#6f6757", fontSize: "13px", textDecoration: "underline" },
};
