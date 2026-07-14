import type { CSSProperties } from "react";
import { OfflineRetryButton } from "./OfflineRetryButton";

export const metadata = {
  title: "オフライン | ねてるねこ",
};

export default function OfflinePage() {
  return (
    <main style={styles.page}>
      <section style={styles.panel} aria-labelledby="offline-title">
        <p style={styles.kicker}>ねてるねこ</p>
        <h1 id="offline-title" style={styles.title}>
          いまは通信できません
        </h1>
        <p style={styles.body}>
          電波が戻ったら、もう一度ひらいてください。保存済みの写真や記録は、そのまま残ります。
        </p>
        <OfflineRetryButton />
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100svh",
    display: "grid",
    placeItems: "center",
    padding: "32px 24px",
    boxSizing: "border-box",
    background: "var(--app-paper-background, #f4f1ea)",
    color: "var(--ink, #3f3832)",
    fontFamily:
      'var(--font-ui, "Zen Kaku Gothic New", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif)',
  },
  panel: {
    width: "min(100%, 360px)",
    textAlign: "center",
  },
  kicker: {
    margin: "0 0 12px",
    fontSize: 12,
    letterSpacing: 0,
    color: "rgba(63, 56, 50, 0.52)",
  },
  title: {
    margin: "0 0 14px",
    fontFamily: 'var(--font-display, "Klee One", serif)',
    fontSize: 24,
    fontWeight: 400,
    lineHeight: 1.55,
  },
  body: {
    margin: 0,
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 1.9,
    color: "rgba(63, 56, 50, 0.68)",
  },
} satisfies Record<string, CSSProperties>;
