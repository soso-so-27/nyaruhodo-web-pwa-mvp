"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import {
  openBillingPortal,
  readClientBillingStatus,
  startBetaSupporterCheckout,
  type ClientBillingStatus,
} from "../../lib/billingClient";
import {
  readClientBetaCapabilities,
  type ClientBetaCapabilities,
} from "../../lib/betaClient";
import { AppButton } from "../../components/ui/AppButton";
import { AppCard } from "../../components/ui/AppCard";
import { AppHeader } from "../../components/ui/AppHeader";
import { color, radius, spacing, typography } from "../../components/ui/designTokens";

const dreams = [
  {
    text: "家族を探している保護猫の寝顔が、特別な封筒で届く",
    done: false,
  },
  { text: "寝相の図鑑（香箱、アンモニャイト、へそ天など）", done: false },
  { text: "月の終わりに届く「◯月の寝顔」", done: false },
  { text: "年の終わりに、1冊の「寝顔の本」", done: false },
  { text: "寝顔に添える、3秒の寝息", done: false },
] as const;

export default function BetaSupporterPage() {
  const [billingStatus, setBillingStatus] = useState<ClientBillingStatus>({
    isLoggedIn: false,
    billingConfigured: false,
    isBetaSupporter: false,
    status: "none",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    canManageBilling: false,
  });
  const [betaCapabilities, setBetaCapabilities] = useState<ClientBetaCapabilities>({
    isLoggedIn: false,
    isBetaParticipant: false,
    feedbackEnabled: false,
    supporterVoiceEnabled: false,
    isBetaSupporter: false,
  });
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const [nextBillingStatus, nextBetaCapabilities] = await Promise.all([
        readClientBillingStatus(),
        readClientBetaCapabilities(),
      ]);

      if (!isMounted) {
        return;
      }

      setBillingStatus(nextBillingStatus);
      setBetaCapabilities(nextBetaCapabilities);
    }

    void load();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleStartSupporter() {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setMessage("");

    const url = await startBetaSupporterCheckout();
    if (url) {
      window.location.href = url;
      return;
    }

    setMessage("支払いページを開けませんでした。ログイン状態を確認してください。");
    setIsLoading(false);
  }

  async function handleOpenPortal() {
    if (isLoading) {
      return;
    }

    setIsLoading(true);
    setMessage("");

    const url = await openBillingPortal();
    if (url) {
      window.location.href = url;
      return;
    }

    setMessage("支払い管理を開けませんでした。");
    setIsLoading(false);
  }

  const canStartSupporter =
    billingStatus.billingConfigured && betaCapabilities.isBetaParticipant;

  return (
    <main style={styles.page}>
      <div style={styles.backdrop} aria-hidden="true" />
      <div style={styles.container}>
        <a href="/settings" style={styles.backLink}>
          ‹ 設定
        </a>
        <AppHeader variant="pageTitle" title="ねてるねこ" />

        <AppCard variant="soft" padding="xl" style={styles.hero}>
          <p style={styles.kicker}>βサポーター</p>
          <h1 style={styles.title}>これからのねてるねこ</h1>
          <p style={styles.lead}>
            サポーターの応援は、サーバー費用、写真のお預かり、この場所を静かに保つために使います。
          </p>
          <p style={styles.lead}>
            そのうえで、少しずつ形にしたいことがあります。
          </p>
        </AppCard>

        <AppCard variant="soft" padding="lg" style={styles.card}>
          <ul style={styles.dreamList}>
            {dreams.map((dream) => (
              <li key={dream.text} style={styles.dreamItem}>
                <span style={styles.dreamDot} aria-hidden="true" />
                <span>
                  {dream.text}
                  {dream.done ? <span style={styles.doneMark}>できました</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </AppCard>

        <AppCard variant="outlined" padding="lg" style={styles.card}>
          <p style={styles.note}>
            これは約束ではなく、アイデアのメモです。
            <br />
            内容や順番は変わることがあります。
          </p>
          <p style={styles.closing}>できたものから、みんなに届きます。</p>
        </AppCard>

        <AppCard variant="soft" padding="lg" style={styles.card}>
          <p style={styles.price}>月 1,480円</p>
          <p style={styles.note}>
            機能は何も制限しません。
            <br />
            応援してもしなくても、ねてるねこは同じように使えます。
          </p>
          {billingStatus.isBetaSupporter ? (
            <AppButton
              type="button"
              variant="secondary"
              fullWidth
              onClick={handleOpenPortal}
              disabled={isLoading || !billingStatus.canManageBilling}
            >
              支払いを管理
            </AppButton>
          ) : canStartSupporter ? (
            <AppButton
              type="button"
              variant="accent"
              fullWidth
              onClick={handleStartSupporter}
              disabled={isLoading}
            >
              {isLoading ? "Stripeへ移動しています" : "応援する"}
            </AppButton>
          ) : (
            <p style={styles.note}>
              {billingStatus.billingConfigured
                ? "β参加者としてログインすると、サポーター導線を使えます。"
                : "現在、支払い導線は準備中です。"}
            </p>
          )}
          {message ? <p style={styles.message}>{message}</p> : null}
        </AppCard>

        <nav style={styles.legalLinks} aria-label="法務リンク">
          <a href="/terms" style={styles.legalLink}>利用規約</a>
          <a href="/privacy" style={styles.legalLink}>プライバシーポリシー</a>
          <a href="/contact" style={styles.legalLink}>問い合わせ</a>
          <a href="/cancellation" style={styles.legalLink}>解約方法</a>
          <a href="/commercial-transactions" style={styles.legalLink}>特商法表記</a>
        </nav>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100dvh",
    position: "relative",
    overflow: "hidden",
    background: color.pageBg,
    color: color.text,
  },
  backdrop: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.9), transparent 34%), linear-gradient(180deg, rgba(255,253,248,0.82), rgba(247,241,231,0.92))",
  },
  container: {
    position: "relative",
    zIndex: 1,
    width: "min(100%, 430px)",
    margin: "0 auto",
    padding: `calc(${spacing.md}px + env(safe-area-inset-top)) ${spacing.screenX}px calc(44px + env(safe-area-inset-bottom))`,
    boxSizing: "border-box",
    display: "grid",
    gap: spacing.md,
  },
  backLink: {
    justifySelf: "start",
    color: color.textMuted,
    fontSize: typography.body.fontSize,
    fontWeight: 520,
    lineHeight: 1.4,
    textDecoration: "none",
    padding: "8px 2px",
  },
  hero: {
    display: "grid",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  card: {
    display: "grid",
    gap: spacing.md,
  },
  kicker: {
    margin: 0,
    color: color.textMuted,
    fontSize: typography.body.fontSize,
    fontWeight: 600,
    lineHeight: typography.body.lineHeight,
  },
  title: {
    margin: 0,
    color: color.textStrong,
    fontSize: 18,
    fontWeight: 650,
    lineHeight: 1.5,
  },
  lead: {
    margin: 0,
    color: color.textMuted,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
  dreamList: {
    display: "grid",
    gap: spacing.md,
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  dreamItem: {
    display: "grid",
    gridTemplateColumns: "12px 1fr",
    alignItems: "start",
    gap: spacing.sm,
    color: color.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
  },
  dreamDot: {
    width: 5,
    height: 5,
    marginTop: 9,
    borderRadius: "50%",
    background: color.accentWarm,
    opacity: 0.62,
  },
  doneMark: {
    display: "inline-flex",
    marginLeft: spacing.sm,
    padding: "2px 7px",
    borderRadius: radius.pill,
    border: `1px solid ${color.border}`,
    color: color.accent,
    fontSize: 11,
    fontWeight: 600,
    lineHeight: 1.35,
    verticalAlign: "middle",
  },
  note: {
    margin: 0,
    color: color.textMuted,
    fontSize: typography.body.fontSize,
    fontWeight: typography.body.fontWeight,
    lineHeight: typography.body.lineHeight,
  },
  closing: {
    margin: 0,
    color: color.textStrong,
    fontSize: typography.body.fontSize,
    fontWeight: 600,
    lineHeight: typography.body.lineHeight,
  },
  price: {
    margin: 0,
    color: color.textStrong,
    fontSize: typography.body.fontSize,
    fontWeight: 650,
    lineHeight: typography.body.lineHeight,
  },
  message: {
    margin: 0,
    color: color.danger,
    fontSize: 12.5,
    fontWeight: 520,
    lineHeight: 1.5,
  },
  legalLinks: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: `${spacing.sm}px ${spacing.md}px`,
    padding: `${spacing.sm}px 0 0`,
  },
  legalLink: {
    color: color.textFaint,
    fontSize: 12,
    fontWeight: 520,
    textDecoration: "none",
  },
} satisfies Record<string, CSSProperties>;
