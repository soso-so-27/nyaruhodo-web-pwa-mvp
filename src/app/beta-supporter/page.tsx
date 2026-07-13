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

const openingParagraphs = [
  "ねてるねこは、猫の写真がたくさん流れていく場所ではなく、猫をもっと大切に見られる場所でありたいと思っています。",
  "毎日見ている猫を、もう一度かわいいと思えたり。",
  "知らなかったその子らしさに、少しずつ気づけたり。",
  "まだ出会っていない猫にも、自然に目が向いたり。",
  "そんな場所を、静かに長く育てていきたいです。",
] as const;

const valuesParagraphs = [
  "ねてるねこが大事にしたいのは、猫をたくさん見せることよりも、猫を大切に見る時間を増やすことです。",
  "かわいさを競わせるより、その子らしさに気づけること。",
  "流れて消えていくより、あとからそっと見返せること。",
  "誰かに見せるためだけではなく、自分の猫をもっと好きになれること。",
  "そんな場所でありたいと思っています。",
] as const;

const futureItems = [
  {
    title: "自分の猫を、もっと好きになれること",
    body: [
      "毎日そばにいる猫でも、見慣れてしまうことがあります。",
      "でも、ふと見返したときに、「この子らしいな」「やっぱりかわいいな」と思える瞬間があります。",
      "ねてるねこは、自分の猫の好きなところに何度でも気づける場所にしていきたいです。",
    ],
  },
  {
    title: "猫のことを、少しずつわかること",
    body: [
      "猫は、言葉でたくさん説明してくれるわけではありません。",
      "しぐさ、距離感、年齢、暮らし方。少しずつ見ているうちに、その子にとって心地いいことが前よりわかるようになる。",
      "かわいいと思うだけではなく、猫に少しやさしくなれる場所にしていきたいです。",
    ],
  },
  {
    title: "まだ出会っていない猫にも、自然に目が向くこと",
    body: [
      "猫との出会いは、最初から大きな決心ではなくてもいいと思っています。",
      "「この子、かわいいな」「どんな性格なんだろう」「どんな場所が好きなんだろう」",
      "そんな小さな興味から、家族を探している猫のことを知るきっかけが生まれるかもしれません。",
      "ねてるねこの中にも、そんな自然な出会いの余白を少しずつ作っていきたいです。",
    ],
  },
  {
    title: "猫との時間が、ちゃんと残っていくこと",
    body: [
      "猫との毎日は、特別な日ばかりではありません。",
      "いつもの場所にいること。同じような表情をしていること。なんでもない写真が増えていくこと。",
      "でも、あとから見返すと、そういう時間ほど大切だったりします。",
      "ねてるねこは、猫との日々が流れて消えず、あとから静かに見返せる場所でありたいです。",
    ],
  },
  {
    title: "猫を大切にする人が、静かにつながれること",
    body: [
      "にぎやかに広がるよりも、そっと見守れるくらいの距離感がねてるねこには合っていると思っています。",
      "誰かの猫を見て、自分の猫も大切にしたくなる。",
      "自分の猫を置いておくことで、誰かの気持ちも少しやわらぐ。",
      "そんな静かなつながりを育てていきたいです。",
    ],
  },
] as const;

const supportUses = [
  "写真や記録を安心して預かるための仕組み",
  "静かで見やすい体験を守ること",
  "猫のことを少し知れる機能や読みもの",
  "家族を探している猫にも自然に目が向く仕組みの準備",
  "アプリを続けていくための開発と運営",
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
  const [isStatusLoading, setIsStatusLoading] = useState(true);

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
      setIsStatusLoading(false);
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

    setMessage("支払いページを開けませんでした。少し時間をおいて、もう一度お試しください。");
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
  const needsBillingAttention = ["past_due", "unpaid", "incomplete"].includes(
    billingStatus.status,
  );

  return (
    <main style={styles.page}>
      <div style={styles.backdrop} aria-hidden="true" />
      <div style={styles.container}>
        <AppButton href="/settings" variant="quiet" size="sm" style={styles.backLink}>
          ‹ 設定
        </AppButton>

        <header style={styles.header}>
          <p style={styles.kicker}>これからのねてるねこ</p>
          <h1 style={styles.title}>猫をもっと大切に見られる場所へ。</h1>
        </header>

        <section style={styles.hero} aria-label="これからのねてるねこ">
          {openingParagraphs.map((paragraph) => (
            <p key={paragraph} style={styles.lead}>
              {paragraph}
            </p>
          ))}
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>小さなきっかけ</h2>
          <p style={styles.body}>
            保護猫と暮らすようになってから、猫を見る目が少し変わりました。
          </p>
          <p style={styles.body}>好きな場所。安心する距離感。ちょっとしたクセや、表情。</p>
          <p style={styles.body}>
            知っていくほど、その子の好きなところが増えていく。
          </p>
          <p style={styles.body}>
            ねてるねこも、そんな小さな発見が増えていく場所にしたいです。
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>大事にしたいこと</h2>
          {valuesParagraphs.map((paragraph) => (
            <p key={paragraph} style={styles.body}>
              {paragraph}
            </p>
          ))}
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>少しずつ育てたいこと</h2>
          <p style={styles.body}>まだ、全部の形は決まっていません。</p>
          <p style={styles.body}>でも、ねてるねこで増やしていきたい時間があります。</p>
          <div style={styles.futureList}>
            {futureItems.map((item) => (
              <article key={item.title} style={styles.futureItem}>
                <h3 style={styles.futureTitle}>{item.title}</h3>
                {item.body.map((paragraph) => (
                  <p key={paragraph} style={styles.futureBody}>
                    {paragraph}
                  </p>
                ))}
              </article>
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>まだ形にしすぎないこと</h2>
          <p style={styles.body}>ここに書いていることは、決まった機能の一覧ではありません。</p>
          <p style={styles.body}>作りながら、変わることもあります。順番が入れ替わることもあります。</p>
          <p style={styles.body}>
            でも、猫をもっと好きになれる場所にしたい、猫のことを少し知れる場所にしたい、まだ出会っていない猫にも目が向く場所にしたい。
          </p>
          <p style={styles.body}>その気持ちは変わりません。</p>
          <p style={styles.closing}>できたものから、少しずつ届けます。</p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>この場所を続けるために</h2>
          <p style={styles.body}>
            ねてるねこを、広告や数字に寄りすぎない場所として静かに続けていくには、少しずつ支えが必要です。
          </p>
          <p style={styles.body}>
            いただいた応援は、ねてるねこを長く育てるために使います。
          </p>
          <ul style={styles.supportList}>
            {supportUses.map((use) => (
              <li key={use} style={styles.supportItem}>
                <span style={styles.supportDot} aria-hidden="true" />
                <span>{use}</span>
              </li>
            ))}
          </ul>
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>応援しても、しなくても</h2>
          <p style={styles.body}>
            応援してもしなくても、ねてるねこの基本的な体験は変わりません。
          </p>
          <p style={styles.body}>
            投稿が有利になったり、見える猫が増えたりするものではありません。
          </p>
          <p style={styles.body}>
            これは機能を買うための支払いというより、この場所を一緒に育てるための応援です。
          </p>
        </section>

        <section style={styles.actionSection}>
          <p style={styles.supporterLabel}>βサポーター</p>
          <h2 style={styles.actionTitle}>この場所を支える</h2>
          <p style={styles.price}>月額 1,628円（税込）</p>
          <p style={styles.note}>
            ねてるねこを、静かに長く続く場所にするための応援です。
          </p>
          <p style={styles.note}>
            自分の猫をもっと好きになれる場所を。猫のことを少し知れる場所を。まだ出会っていない猫にも、自然に目が向く場所を。
          </p>
          <p style={styles.closing}>少しずつ育てていきます。</p>
          {isStatusLoading ? (
            <p style={styles.note} role="status">サポーター状態を確認中です。</p>
          ) : billingStatus.isBetaSupporter ? (
            <>
              <SupporterStatus status={billingStatus} />
            <AppButton
              type="button"
              variant="secondary"
              fullWidth
              onClick={handleOpenPortal}
              disabled={isLoading || !billingStatus.canManageBilling}
            >
              支払いを管理
            </AppButton>
              {!billingStatus.canManageBilling ? (
                <p style={styles.note}>
                  支払い管理を開けません。問い合わせからご連絡ください。
                </p>
              ) : null}
            </>
          ) : needsBillingAttention ? (
            <>
              <p style={styles.message}>
                支払い状態の確認が必要です。支払い管理から内容を確認してください。
              </p>
              {billingStatus.canManageBilling ? (
                <AppButton
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={handleOpenPortal}
                  disabled={isLoading}
                >
                  支払いを管理
                </AppButton>
              ) : null}
            </>
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
          ) : !billingStatus.isLoggedIn ? (
            <>
              <p style={styles.note}>
                Googleでログイン後、β参加対象のアカウントから応援できます。
              </p>
              <AppButton href="/account/create" variant="secondary" fullWidth>
                Googleでログイン
              </AppButton>
            </>
          ) : (
            <p style={styles.note}>
              {billingStatus.billingConfigured
                ? "現在は、β参加対象のアカウントから応援できます。"
                : "現在、支払い導線は準備中です。"}
            </p>
          )}
          <div style={styles.billingTerms}>
            <p style={styles.note}>毎月自動で更新され、いつでも解約できます。</p>
            <p style={styles.note}>
              解約後もその期間の末日まで有効です。保存した写真や、とどいたねこだよりは失われません。
            </p>
          </div>
          {message ? <p style={styles.message}>{message}</p> : null}
        </section>

        <nav style={styles.legalLinks} aria-label="法務リンク">
          <AppButton href="/terms" variant="quiet" size="sm">
            利用規約
          </AppButton>
          <AppButton href="/privacy" variant="quiet" size="sm">
            プライバシーポリシー
          </AppButton>
          <AppButton href="/contact" variant="quiet" size="sm">
            問い合わせ
          </AppButton>
          <AppButton href="/cancellation" variant="quiet" size="sm">
            解約方法
          </AppButton>
          <AppButton href="/commercial-transactions" variant="quiet" size="sm">
            特商法表記
          </AppButton>
        </nav>
      </div>
    </main>
  );
}

function SupporterStatus({ status }: { status: ClientBillingStatus }) {
  if (status.cancelAtPeriodEnd) {
    return (
      <p style={styles.note} role="status">
        解約予定です。
        {status.currentPeriodEnd
          ? `${formatBillingDate(status.currentPeriodEnd)}までβサポーターです。`
          : "現在の期間の末日までβサポーターです。"}
      </p>
    );
  }

  return <p style={styles.note} role="status">βサポーターとして応援中です。</p>;
}

function formatBillingDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  }).format(date);
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
    marginBottom: 18,
  },
  header: {
    display: "grid",
    gap: 8,
    marginBottom: 28,
  },
  kicker: {
    margin: 0,
    color: color.textMuted,
    fontSize: 12,
    fontWeight: 500,
    lineHeight: 1.5,
  },
  title: {
    margin: 0,
    color: color.textStrong,
    fontSize: 25,
    fontWeight: 500,
    lineHeight: 1.48,
  },
  hero: {
    display: "grid",
    gap: 12,
    padding: "20px 0 22px",
    borderTop: "1px solid rgba(120,108,94,0.14)",
  },
  section: {
    display: "grid",
    gap: 12,
    padding: "22px 0",
    borderTop: "1px solid rgba(120,108,94,0.14)",
  },
  actionSection: {
    display: "grid",
    gap: 12,
    margin: "20px 0 0",
    padding: "18px 16px",
    borderRadius: radius.lg,
    border: "1px solid rgba(120,108,94,0.16)",
    background: "rgba(255,253,248,0.58)",
  },
  heading: {
    margin: 0,
    color: color.textStrong,
    fontSize: 16,
    fontWeight: 500,
    lineHeight: 1.6,
  },
  lead: {
    margin: 0,
    color: color.text,
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.95,
  },
  body: {
    margin: 0,
    color: color.textMuted,
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.92,
  },
  futureList: {
    display: "grid",
    gap: 0,
    marginTop: 4,
    borderTop: "1px solid rgba(120,108,94,0.12)",
  },
  futureItem: {
    display: "grid",
    gap: 8,
    padding: "16px 0",
    borderBottom: "1px solid rgba(120,108,94,0.12)",
  },
  futureTitle: {
    margin: 0,
    color: color.textStrong,
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.65,
  },
  futureBody: {
    margin: 0,
    color: color.textMuted,
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.9,
  },
  supportList: {
    display: "grid",
    gap: 10,
    listStyle: "none",
    margin: "2px 0 0",
    padding: 0,
  },
  supportItem: {
    display: "grid",
    gridTemplateColumns: "12px 1fr",
    alignItems: "start",
    gap: spacing.sm,
    color: color.textMuted,
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.75,
  },
  supportDot: {
    width: 5,
    height: 5,
    marginTop: 9,
    borderRadius: "50%",
    background: color.accentWarm,
    opacity: 0.62,
  },
  supporterLabel: {
    margin: 0,
    color: color.textMuted,
    fontSize: 12,
    fontWeight: 500,
    lineHeight: 1.5,
  },
  actionTitle: {
    margin: 0,
    color: color.textStrong,
    fontSize: 18,
    fontWeight: 500,
    lineHeight: 1.5,
  },
  note: {
    margin: 0,
    color: color.textMuted,
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.9,
  },
  billingTerms: {
    display: "grid",
    gap: 4,
    paddingTop: 4,
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
    padding: "18px 0 0",
  },
} satisfies Record<string, CSSProperties>;
