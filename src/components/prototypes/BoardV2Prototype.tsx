import { AppButton } from "../ui/AppButton";
import { AppCard } from "../ui/AppCard";

export function BoardV2Prototype() {
  return (
    <main style={styles.page}>
      <AppCard as="section" variant="section" padding="lg" style={styles.notice}>
        <p style={styles.eyebrow}>PROTOTYPE CLOSED</p>
        <h1 style={styles.title}>本番へ 移植しました</h1>
        <p style={styles.body}>
          この比較画面の役目は終わりました。現在のねこだよりが、表示の正です。
        </p>
        <AppButton href="/collection" variant="primary">
          ねこだよりを ひらく
        </AppButton>
      </AppCard>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100svh",
    display: "grid",
    placeItems: "center",
    padding: "32px 20px",
    background: "var(--paper)",
  },
  notice: {
    width: "min(100%, 420px)",
    display: "grid",
    justifyItems: "center",
    gap: "18px",
    textAlign: "center" as const,
  },
  eyebrow: {
    margin: 0,
    color: "var(--seal)",
    fontFamily: "var(--font-ui)",
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "0.12em",
  },
  title: {
    margin: 0,
    color: "var(--ink)",
    fontFamily: "var(--font-display)",
    fontSize: "24px",
    fontWeight: 400,
    letterSpacing: 0,
  },
  body: {
    margin: 0,
    color: "var(--ink-soft)",
    fontFamily: "var(--font-ui)",
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: 1.8,
    letterSpacing: 0,
  },
};
