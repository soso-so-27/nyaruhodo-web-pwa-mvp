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
import { color, radius, spacing } from "../../components/ui/designTokens";

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
        <AppButton href="/settings" variant="quiet" size="sm" style={styles.backLink}>
          ‹ 設定
        </AppButton>

        <h1 style={styles.title}>これからのねてるねこ</h1>

        <section style={styles.hero}>
          <h2 style={styles.heading}>βサポーター</h2>
          <p style={styles.lead}>
            サポーターの応援は、サーバー費用、写真のお預かり、この場所を静かに保つために使います。
          </p>
          <p style={styles.lead}>
            そのうえで、少しずつ形にしたいことがあります。
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>形にしたいこと</h2>
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
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>小さなメモ</h2>
          <p style={styles.note}>
            これは約束ではなく、アイデアのメモです。
            <br />
            内容や順番は変わることがあります。
          </p>
          <p style={styles.closing}>できたものから、みんなに届きます。</p>
        </section>

        <section style={styles.actionSection}>
          <h2 style={styles.heading}>支払い</h2>
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
        </section>

        <nav style={styles.legalLinks} aria-label="法務リンク">
          <AppButton href="/terms" variant="quiet" size="sm">利用規約</AppButton>
          <AppButton href="/privacy" variant="quiet" size="sm">プライバシーポリシー</AppButton>
          <AppButton href="/contact" variant="quiet" size="sm">問い合わせ</AppButton>
          <AppButton href="/cancellation" variant="quiet" size="sm">解約方法</AppButton>
          <AppButton href="/commercial-transactions" variant="quiet" size="sm">特商法表記</AppButton>
        </nav>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100dvh",
    position: "relative",
    overflowX: "hidden",
    background: "var(--app-paper-background)",
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
    color: color.text,
  },
  backdrop: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    background: "transparent",
    opacity: 0,
  },
  container: {
    position: "relative",
    zIndex: 1,
    width: "min(100%, 430px)",
    margin: "0 auto",
    padding: `calc(${spacing.lg}px + env(safe-area-inset-top)) ${spacing.screenX}px calc(44px + env(safe-area-inset-bottom))`,
    boxSizing: "border-box",
    display: "grid",
    gap: 0,
  },
  backLink: {
    justifySelf: "start",
    marginBottom: "18px",
  },
  hero: {
    display: "grid",
    gap: "10px",
    padding: "18px 0",
    borderTop: "1px solid rgba(120,108,94,0.14)",
  },
  section: {
    display: "grid",
    gap: "12px",
    padding: "18px 0",
    borderTop: "1px solid rgba(120,108,94,0.14)",
  },
  actionSection: {
    display: "grid",
    gap: "12px",
    margin: "18px 0 0",
    padding: "16px",
    borderRadius: "var(--radius-lg)",
    border: "1px solid rgba(120,108,94,0.16)",
    background: "rgba(255,253,248,0.54)",
  },
  heading: {
    margin: 0,
    color: color.textStrong,
    fontSize: 15,
    fontWeight: 500,
    lineHeight: 1.6,
    letterSpacing: "0.03em",
  },
  title: {
    margin: "0 0 26px",
    color: color.textStrong,
    fontSize: 24,
    fontWeight: 500,
    lineHeight: 1.42,
    letterSpacing: "0.04em",
  },
  lead: {
    margin: 0,
    color: color.textMuted,
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.9,
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
    fontSize: 13,
    lineHeight: 1.85,
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
    fontSize: 12,
    fontWeight: 500,
    lineHeight: 1.35,
    verticalAlign: "middle",
  },
  note: {
    margin: 0,
    color: color.textMuted,
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.9,
  },
  closing: {
    margin: 0,
    color: color.textStrong,
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.9,
  },
  price: {
    margin: 0,
    color: color.textStrong,
    fontSize: 15,
    fontWeight: 500,
    lineHeight: 1.7,
  },
  message: {
    margin: 0,
    color: color.danger,
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.5,
  },
  legalLinks: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: `${spacing.sm}px ${spacing.md}px`,
    padding: `18px 0 0`,
  },
} satisfies Record<string, CSSProperties>;
