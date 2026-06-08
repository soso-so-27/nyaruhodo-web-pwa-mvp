import type { CSSProperties } from "react";
import { AppButton } from "../components/ui/AppButton";
import { AppCard } from "../components/ui/AppCard";
import { WordmarkHeader } from "../components/ui/AppHeader";
import { EmptyState } from "../components/ui/EmptyState";
import { color, spacing, typography } from "../components/ui/designTokens";

export default function NotFound() {
  return (
    <main style={styles.page}>
      <WordmarkHeader />
      <AppCard variant="outlined" padding="xl" style={styles.card}>
        <EmptyState
          title="ここには、まだねこがいません"
          description="ページが見つかりませんでした。ねてるねこへ戻れます。"
          action={
            <AppButton href="/home" variant="primary" size="md">
              ねてるねこへ
            </AppButton>
          }
        />
      </AppCard>
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
  card: {
    width: "min(100%, 520px)",
    margin: "clamp(96px, 20vh, 176px) auto 0",
  },
} satisfies Record<string, CSSProperties>;
