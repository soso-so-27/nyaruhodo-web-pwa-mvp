"use client";

import type { CSSProperties } from "react";
import {
  APP_ACCENT,
  APP_PAGE_BACKGROUND,
  APP_PILL,
  APP_SURFACE,
} from "../ui/appTheme";

type LegalSection = {
  title: string;
  body?: string[];
  bullets?: string[];
};

type LegalPageProps = {
  title: string;
  lead: string;
  updatedAt: string;
  sections: readonly LegalSection[];
};

const privacySections = [
  {
    title: "取得する情報",
    body: [
      "にゃるほどは、猫のプロフィール、診断の回答と結果、みっけやお世話の記録、コレクション写真など、利用者が入力・保存した情報を扱います。",
      "Googleログインを利用した場合は、認証に必要なGoogleアカウント情報のうち、メールアドレスなど基本的な情報を扱います。",
    ],
  },
  {
    title: "利用目的",
    bullets: [
      "猫ごとのプロフィール、記録、トリセツ、コレクションを表示するため",
      "ログイン後に、この端末のデータをアカウントへ同期・復元するため",
      "不具合調査、利用状況の把握、β版の改善のため",
      "将来の有料プランや長期保存機能を検討するため",
    ],
  },
  {
    title: "写真と猫の記録",
    body: [
      "写真や猫の記録は、利用者が選択した範囲で保存されます。ログイン前は主にこの端末内に保存され、同期操作を行った場合はアカウントに紐づくデータとして保存されます。",
      "他人の個人情報や、公開の許可がない人物の写真を含む画像は登録しないでください。",
    ],
  },
  {
    title: "分析イベント",
    body: [
      "β版の改善のため、画面閲覧やボタン押下などの利用イベントを記録することがあります。分析イベントには、猫の名前、写真、メール本文のような自由入力の内容は含めない方針です。",
    ],
  },
  {
    title: "外部サービス",
    body: [
      "本サービスでは、認証・データ保存にSupabase、GoogleログインにGoogle、配信・ホスティングにVercelを利用します。",
      "Googleアカウントから取得した情報の取り扱いは、Google API Services User Data Policyを踏まえて、ログインとアカウント接続に必要な範囲に限定します。",
    ],
  },
  {
    title: "削除と問い合わせ",
    body: [
      "端末内のデータは設定画面から削除できます。アカウントに保存されたデータの削除や確認については、β期間中は運営者が案内する連絡先からお問い合わせください。",
      "正式公開に向けて、削除・エクスポート・アカウント管理のUIを整備していきます。",
    ],
  },
] as const satisfies readonly LegalSection[];

const termsSections = [
  {
    title: "β版としての提供",
    body: [
      "にゃるほどは現在β版です。機能、画面、保存仕様、料金体系は、正式公開に向けて変更されることがあります。",
    ],
  },
  {
    title: "このアプリの役割",
    body: [
      "にゃるほどは、猫の様子を記録し、飼い主の迷いを減らすための補助ツールです。獣医療上の診断、治療、緊急判断の代わりにはなりません。",
      "体調不良、けが、食欲不振、排泄異常などがある場合は、必ず獣医師など専門家に相談してください。",
    ],
  },
  {
    title: "利用者の責任",
    bullets: [
      "入力する猫情報や写真について、必要な権利や許可を持っていること",
      "他人の個人情報、許可のない人物写真、不適切な内容を登録しないこと",
      "アカウントを安全に管理すること",
    ],
  },
  {
    title: "アカウントと同期",
    body: [
      "Googleログインを使うと、端末内の猫データをアカウントへ同期・復元できるようになります。同期は利用者の操作によって行われ、すべての端末で自動的に同期されることを保証するものではありません。",
    ],
  },
  {
    title: "禁止事項",
    bullets: [
      "サービスの不正利用、過度な負荷をかける行為",
      "第三者の権利やプライバシーを侵害する行為",
      "法令または公序良俗に反する行為",
      "サービスの運営を妨げる行為",
    ],
  },
  {
    title: "将来の有料プラン",
    body: [
      "正式公開時に、記録の長期保存や追加機能に関する有料プランを導入する可能性があります。有料化する場合は、内容と料金を事前に分かりやすく案内します。",
    ],
  },
  {
    title: "免責",
    body: [
      "β版のため、データ消失、不具合、表示の誤りが発生する可能性があります。重要な記録は、必要に応じて利用者自身でも控えを取ってください。",
    ],
  },
] as const satisfies readonly LegalSection[];

export function PrivacyPage() {
  return (
    <LegalPage
      title="プライバシーポリシー"
      lead="にゃるほどで扱う猫の記録、写真、Googleログイン、分析イベントについての基本方針です。"
      updatedAt="2026年5月25日"
      sections={privacySections}
    />
  );
}

export function TermsPage() {
  return (
    <LegalPage
      title="利用規約"
      lead="にゃるほどβ版を安心して使うための、最小限のルールです。"
      updatedAt="2026年5月25日"
      sections={termsSections}
    />
  );
}

function LegalPage({ title, lead, updatedAt, sections }: LegalPageProps) {
  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <a href="/settings" style={styles.backButton} aria-label="設定へ戻る">
            <span style={styles.backIcon}>‹</span>
          </a>
          <div>
            <h1 style={styles.title}>{title}</h1>
            <p style={styles.updatedAt}>最終更新: {updatedAt}</p>
          </div>
        </div>

        <p style={styles.lead}>{lead}</p>

        <div style={styles.card}>
          {sections.map((section, sectionIndex) => (
            <section key={section.title} style={styles.section}>
              <h2 style={styles.sectionTitle}>{section.title}</h2>
              {section.body?.map((paragraph) => (
                <p key={paragraph} style={styles.paragraph}>
                  {paragraph}
                </p>
              ))}
              {section.bullets ? (
                <ul style={styles.list}>
                  {section.bullets.map((item) => (
                    <li key={item} style={styles.listItem}>
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}
              {sectionIndex < sections.length - 1 ? <div style={styles.divider} /> : null}
            </section>
          ))}
        </div>

        <p style={styles.note}>
          このページはβ版公開に向けた暫定版です。正式公開前に内容を更新することがあります。
        </p>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: APP_PAGE_BACKGROUND,
    color: "#242522",
  },
  container: {
    width: "min(100%, 430px)",
    margin: "0 auto",
    padding: "0 16px 44px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px 0 14px",
  },
  backButton: {
    ...APP_PILL,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    textDecoration: "none",
    color: "#2a2a28",
    flexShrink: 0,
  },
  backIcon: {
    fontSize: "21px",
    lineHeight: 1,
  },
  title: {
    fontSize: "21px",
    fontWeight: 680,
    color: "#2a2a28",
    margin: "0 0 3px",
  },
  updatedAt: {
    fontSize: "12px",
    color: "#9a9890",
    margin: 0,
  },
  lead: {
    fontSize: "14px",
    lineHeight: 1.75,
    color: "#6a6a62",
    margin: "0 0 14px",
  },
  card: {
    ...APP_SURFACE,
    borderRadius: "20px",
    padding: "4px 16px",
  },
  section: {
    padding: "14px 0",
  },
  sectionTitle: {
    fontSize: "15px",
    fontWeight: 620,
    color: "#2a2a28",
    margin: "0 0 8px",
  },
  paragraph: {
    fontSize: "13px",
    lineHeight: 1.8,
    color: "#6a6a62",
    margin: "0 0 8px",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    paddingLeft: "18px",
    margin: "0 0 8px",
  },
  listItem: {
    fontSize: "13px",
    lineHeight: 1.7,
    color: "#6a6a62",
  },
  divider: {
    height: "0.5px",
    background: "#f0ede8",
    margin: "14px -16px 0",
  },
  note: {
    fontSize: "12px",
    lineHeight: 1.7,
    color: "#9a9890",
    margin: "14px 4px 0",
  },
} satisfies Record<string, CSSProperties>;
