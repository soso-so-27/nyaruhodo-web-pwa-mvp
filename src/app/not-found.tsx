import type { CSSProperties } from "react";
import { AppButton } from "../components/ui/AppButton";
import { WordmarkHeader } from "../components/ui/AppHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { color, spacing, typography } from "../components/ui/designTokens";

export default function NotFound() {
  return (
    <main style={styles.page}>
      <WordmarkHeader />
      <section style={styles.panel} aria-label="ページが見つかりません">
        <p style={styles.kicker}>ページが見つかりません</p>
        <EmptyState
          title="このページは見つかりませんでした"
          description="URLが変わったか、ページがなくなった可能性があります。保存済みの写真や記録には影響ありません。"
          action={
            <AppButton href="/home" variant="primary" size="md">
              ホームへ戻る
            </AppButton>
          }
          style={styles.emptyState}
        />
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100dvh",
    boxSizing: "border-box",
    padding: `calc(${spacing.xl}px + env(safe-area-inset-top)) ${spacing.screenX}px calc(${spacing.xxl}px + env(safe-area-inset-bottom))`,
    background: color.pageBg,
    fontFamily: typography.fontSans,
    color: color.text,
  },
  panel: {
    width: "min(100%, 420px)",
    margin: "clamp(88px, 18vh, 156px) auto 0",
    display: "grid",
    justifyItems: "center",
    gap: spacing.md,
  },
  kicker: {
    margin: 0,
    color: color.textFaint,
    fontSize: typography.caption.fontSize,
    fontWeight: 400,
    lineHeight: 1.5,
  },
  emptyState: {
    gap: spacing.md,
  },
} satisfies Record<string, CSSProperties>;
