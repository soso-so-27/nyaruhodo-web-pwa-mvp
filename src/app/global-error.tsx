"use client";

import { recoverAppShell } from "../lib/pwa/recoverAppShell";

export default function GlobalError() {
  return (
    <html lang="ja">
      <body style={{ margin: 0 }}>
        <main style={styles.page}>
          <section style={styles.panel} role="alert">
            <p style={styles.kicker}>ねてるねこ</p>
            <h1 style={styles.title}>画面を開けませんでした</h1>
            <p style={styles.copy}>
              通信を確認して、もう一度お試しください。直らない場合は、アプリを閉じて開き直してください。
            </p>
            <button
              type="button"
              style={styles.primary}
              onClick={() => {
                void recoverAppShell();
              }}
            >
              更新してひらく
            </button>
            <a href="/" style={styles.link}>
              ホームへ戻る
            </a>
          </section>
        </main>
      </body>
    </html>
  );
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
  link: { color: "#6f6757", fontSize: "13px", textDecoration: "underline" },
};
