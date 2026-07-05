"use client";

import type { CSSProperties } from "react";
import { APP_PAGE_BACKGROUND } from "../ui/appTheme";
import { AppButton } from "../ui/AppButton";

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
    title: "事業者",
    body: ["中西 壮野"],
  },
  {
    title: "取得する情報",
    body: [
      "ねてるねこは、猫のプロフィール、写真、写真に紐づく時間や状態、アカウント連携に必要な情報を扱います。",
      "Googleログインを利用した場合は、認証に必要なGoogleアカウント情報のうち、メールアドレスなど基本的な情報を扱います。",
      "ログイン前の体験では、匿名ID、オンボーディングの進行状況、写真送信やねこだより開封などの利用イベントを扱うことがあります。",
    ],
  },
  {
    title: "利用目的",
    bullets: [
      "猫ごとの写真、寝顔、おきてる写真、とどいた寝顔を表示するため",
      "ログイン後に、この端末のデータをアカウントへ保存・復元するため",
      "不具合調査、利用状況の把握、ベータ版の改善のため",
      "不正利用や迷惑行為を防ぎ、通報や削除依頼に対応するため",
      "将来の保存容量拡張、家族共有、フォト商品などの検討のため",
    ],
  },
  {
    title: "写真と寝顔",
    body: [
      "写真は、利用者が選択した範囲で保存されます。ログイン前は主にこの端末内に保存され、保存操作を行った場合はアカウントに紐づくデータとして保存されます。",
      "とった寝顔を「とどく」設定にした場合、ねてるねこの中で、名前を出さずにほかの利用者へ1枚届く対象になることがあります。名前、連絡先、プロフィール詳細、場所は相手には表示しません。",
      "投稿された写真を、Instagramなど外部のSNSへ自動で公開することはありません。",
      "第三者の個人情報や、公開の許可がない人物の写真を含む画像は登録しないでください。",
    ],
  },
  {
    title: "分析イベント",
    body: [
      "ベータ版の改善のため、画面閲覧やボタン押下などの利用イベントを app_events などに記録することがあります。分析イベントには、写真URL、署名付きURL、猫の名前、場所、メールアドレス、問い合わせ本文のような自由入力の内容は含めない方針です。",
    ],
  },
  {
    title: "外部サービス",
    body: [
      "本サービスでは、認証・データ保存にSupabase、GoogleログインにGoogle、配信・ホスティングにVercel、有料プランの決済にStripeを利用します。",
      "Googleアカウントから取得した情報は、ログインとアカウント連携に必要な範囲に限定して扱います。",
    ],
  },
  {
    title: "決済情報について",
    body: [
      "有料プランの決済は、Stripe, Inc. の決済サービスを利用しています。クレジットカード番号等の決済情報は、運営者のサーバーには保存されず、Stripe社が同社のプライバシーポリシーに基づいて取り扱います。",
      "運営者は、決済の状態（有効・解約等）および決済履歴に関する情報のみを取得します。",
      "Stripe社のプライバシーポリシー: https://stripe.com/jp/privacy",
    ],
  },
  {
    title: "情報の保存期間について",
    bullets: [
      "投稿写真および記録: ユーザーが削除するか、アカウントを削除するまで保存します。",
      "アカウント情報: アカウント削除後、法令上の保存義務があるものを除き、合理的な期間内に削除します。",
      "決済に関する記録: 法令に基づき、取引終了後も一定期間保存します。",
      "アクセスログ・利用状況の記録: 取得から最長2年を目安に削除または匿名化します。",
    ],
  },
  {
    title: "削除と問い合わせ",
    body: [
      "アカウントに保存されたデータの削除を希望する場合は、設定画面の「アカウントとデータの削除について」を確認し、問い合わせ導線から「削除希望」と送ってください。",
      "削除依頼では、本人確認と対象確認に必要な範囲で、利用日時、画面、写真の特徴などを伺うことがあります。秘密情報や署名付きURLを送る必要はありません。",
      "削除対象を確認できたものから7日以内に削除し、完了をお知らせします。正式公開に向けて、削除・エクスポート・アカウント管理のUIを整備していきます。",
    ],
  },
] as const satisfies readonly LegalSection[];

const termsSections = [
  {
    title: "ベータ版としての提供",
    body: [
      "ねてるねこは現在ベータ版です。機能、画面、保存仕様、料金体系は、正式公開に向けて変更されることがあります。",
    ],
  },
  {
    title: "このアプリの役割",
    body: [
      "ねてるねこは、猫の寝顔や写真を保存し、あとから見返すための写真記録アプリです。獣医療上の診断、治療、緊急判断の代わりにはなりません。",
      "体調不良、けが、食欲不振、排泄異常などがある場合は、必要に応じて獣医師など専門家に相談してください。",
    ],
  },
  {
    title: "利用者の責任",
    bullets: [
      "入力する猫情報や写真について、必要な権利や許可を持っていること",
      "猫以外が主役の写真、人物が大きく写っている写真、裸・性的・暴力的・グロテスクな内容、他人の権利を侵害する内容、広告・スパムを登録しないこと",
      "第三者の個人情報、許可のない人物写真、不適切な内容を登録しないこと",
      "アカウントを安全に管理すること",
    ],
  },
  {
    title: "写真の権利",
    body: [
      "ユーザーが本サービスに投稿した写真（以下「投稿写真」）の著作権その他の権利は、ユーザーに帰属します。",
      "ユーザーは、運営者に対し、本サービスの提供に必要な範囲に限り、投稿写真を利用する権利（複製、他のユーザーの端末への表示・送信、サムネイル等の形式変換、および内容確認のための閲覧を含む）を、無償で許諾するものとします。",
      "前項の許諾は、本サービスの提供・維持・改善の目的以外（広告素材への利用、第三者への販売・提供等）には及びません。",
      "運営者は、投稿写真を宣伝・広報に利用する場合、事前にユーザーの個別の同意を得るものとします。",
    ],
  },
  {
    title: "投稿写真の審査",
    body: [
      "投稿写真は、他のユーザーへ届く前に、運営者による確認（審査）を行います。",
      "運営者は、ねこが写っていないもの、人物が特定できる形で写り込んでいるもの、法令または公序良俗に反するもの、第三者の権利を侵害するもの、他人が撮影した写真を権利者の許諾なく投稿したもの、その他本サービスの趣旨に照らして不適切と判断したものを、他のユーザーへ届く対象から除外することがあります。",
      "除外された場合でも、当該写真はユーザー自身の記録（アルバム等）には残ります。",
      "運営者は、審査の結果および理由について、個別の回答義務を負いません。",
    ],
  },
  {
    title: "とどく寝顔",
    body: [
      "とった寝顔を「とどく」設定にした場合、ほかの利用者に1枚届く対象になります。いいね、コメント、フォロー、ランキングはありません。",
      "届いた寝顔は、とっておく、閉じる、通報することができます。通報された写真は確認のうえ、表示対象から外すことがあります。",
    ],
  },
  {
    title: "写真の削除",
    body: [
      "ユーザーは、投稿写真をいつでも削除できます。",
      "削除された写真は、以後、他のユーザーへ届く対象から除外されます。",
      "削除の時点で既に他のユーザーへ届いた写真については、当該ユーザーの受け取りの記録として表示が残ることがあります。運営者は、特段の事情（権利侵害等）がある場合を除き、届いた先からの個別の削除は行いません。",
      "前項にかかわらず、権利侵害その他の正当な理由がある場合は、問い合わせ窓口までご連絡ください。運営者において対応を検討します。",
    ],
  },
  {
    title: "アカウントと保存",
    body: [
      "Googleログインを使うと、端末内の猫データや写真をアカウントへ保存・復元できるようになります。同期は利用者の操作によって行われ、すべての端末で自動的に同期されることを保証するものではありません。",
    ],
  },
  {
    title: "有料プラン",
    body: [
      "本サービスの基本機能（一日一枚の写真のやりとり）は、無料で利用できます。",
      "月額1,628円（税込）の有料プランに加入したユーザーは、運営者が別途定める追加機能を利用できます。",
      "有料プランの利用料金は、決済代行事業者（Stripe, Inc.）を通じて毎月自動的に決済されます。",
      "解約は、アプリ内の支払い管理画面からいつでも行えます。解約後も、当該課金期間の末日までは有料機能を利用できます。",
      "期間途中で解約した場合の日割り返金は行いません。ただし、運営者の責めに帰すべき事由によりサービスを利用できなかった場合はこの限りではありません。",
    ],
  },
  {
    title: "サービスの変更・中断・終了",
    body: [
      "運営者は、ユーザーへの事前の通知をもって、本サービスの内容を変更し、または提供を終了することができます。",
      "本サービスを終了する場合、運営者は原則として終了日の60日前までにアプリ内で告知し、ユーザーが自身の写真を保存するための合理的な手段を提供するよう努めます。",
      "有料プランのユーザーに対しては、終了日以降の期間に対応する利用料金を日割りで返金します。",
    ],
  },
  {
    title: "免責",
    body: [
      "ベータ版のため、データ消失、不具合、表示の誤りが発生する可能性があります。重要な写真や記録は、必要に応じて利用者自身でも控えを取ってください。",
    ],
  },
  {
    title: "準拠法および管轄裁判所",
    body: [
      "本規約は、日本法に準拠し、日本法に従って解釈されます。",
      "本サービスに関して運営者とユーザーとの間で紛争が生じた場合、中西 壮野の所在地を管轄する地方裁判所を第一審の専属的合意管轄裁判所とします。",
    ],
  },
] as const satisfies readonly LegalSection[];

const contactSections = [
  {
    title: "問い合わせ方法",
    body: [
      "ベータ期間中の意見、不具合、分かりにくかった点は、設定画面の「意見を送る」から送信できます。",
      "Instagramなどの案内から利用した方は、案内元の運営者アカウントへ連絡してください。削除依頼、通報の補足、ログインできない場合の相談も受け付けます。",
      "ログインしているβ参加者は、種類を選んで本文を送れます。すべてに返信できるとは限りませんが、改善の参考にします。",
    ],
  },
  {
    title: "送れる内容",
    bullets: [
      "よかったこと",
      "分かりにくかったこと",
      "バグっぽいこと",
      "要望",
      "その他の連絡",
    ],
  },
  {
    title: "正式な連絡先について",
    body: [
      "正式な連絡先メールアドレス: nakanishisoya@gmail.com",
    ],
  },
] as const satisfies readonly LegalSection[];

const accountDeletionSections = [
  {
    title: "消えるもの",
    body: [
      "削除依頼を受け付けると、確認できる範囲で、ねてるねこに保存されたアカウントとデータを削除します。",
      "すでにお届けしたねがおは、受け取った方の記録に残ります。",
    ],
    bullets: [
      "アカウント情報",
      "猫のプロフィールと記録",
      "ねがお、この子のとっておき、とどいた写真",
      "思い出便と文箱の記録",
      "通報や問い合わせ対応に必要な記録",
      "保存されている写真ファイル（すでにお届けしたねがおを除く）",
    ],
  },
  {
    title: "依頼方法",
    body: [
      "設定画面の問い合わせ導線、または運営者が案内している連絡先から「削除希望」と送ってください。",
      "本人確認と対象確認のため、ログインに使ったメールアドレス、利用している猫の名前、分かる範囲の利用状況を確認することがあります。パスワード、署名付きURL、写真URLを送る必要はありません。",
    ],
  },
  {
    title: "写真を1枚だけ削除したいとき",
    body: [
      "ねがおを削除したいときは、アルバム「まいにち」から写真をひらき、写真の操作にある削除アイコンを押して、確認画面で「削除」を選びます。",
      "この子の写真を削除したいときは、うちのこ「写真」から写真をひらき、「この写真を削除」を選びます。",
      "削除した写真は、あなたのアルバムやこの子の写真から消え、以後あたらしく届く対象から外れます。",
    ],
  },
  {
    title: "すでにどなたかに届いた写真について",
    body: [
      "ねこだよりは手紙と同じで、一度届いたぶんは、受け取った方の記録に残ります。",
      "写真を削除しても、アカウントを削除しても、それ以降あたらしく届くことはありません。",
      "もし、どうしても届いた先からも消したい事情がある場合は、お問い合わせください。事情をうかがったうえで対応を検討します。",
    ],
  },
  {
    title: "対応の目安",
    body: [
      "削除対象を確認できたものから7日以内に削除し、完了をお知らせします。",
      "ベータ期間中はセルフサービスの削除ボタンはまだありません。削除が必要な場合は、問い合わせから依頼してください。",
    ],
  },
] as const satisfies readonly LegalSection[];

const cancellationSections = [
  {
    title: "解約方法",
    body: [
      "βサポーターは、Stripeの支払い管理画面から解約できます。",
      "設定画面を開き、「βサポーター」内の「支払いを管理」からStripe Customer Portalへ進んでください。",
    ],
  },
  {
    title: "反映タイミング",
    body: [
      "解約手続き後、Stripeからの通知を受けてサポーター状態が更新されます。反映まで少し時間がかかる場合があります。",
    ],
  },
  {
    title: "解約後の扱い",
    body: [
      "βサポーターを解約しても、ねてるねこの基本体験はそのまま使えます。",
      "撮る、届く、とっておく、アルバム、猫プロフィールは、サポーター状態によって制限しません。",
    ],
  },
] as const satisfies readonly LegalSection[];

const commercialTransactionsSections = [
  {
    title: "サービス名",
    body: ["ねてるねこ"],
  },
  {
    title: "販売事業者",
    body: ["中西 壮野"],
  },
  {
    title: "運営責任者",
    body: ["中西 壮野"],
  },
  {
    title: "所在地",
    body: ["請求があった場合、遅滞なく開示します。"],
  },
  {
    title: "連絡先",
    body: [
      "メールアドレス: nakanishisoya@gmail.com",
      "電話番号: 請求があった場合、遅滞なく開示します。",
    ],
  },
  {
    title: "販売価格",
    body: ["有料プラン 月額1,628円（税込）"],
  },
  {
    title: "商品代金以外の必要料金",
    body: [
      "インターネット接続料金、通信料金はお客様のご負担となります。",
    ],
  },
  {
    title: "支払方法",
    body: ["クレジットカード決済（Stripe）"],
  },
  {
    title: "支払時期",
    body: ["申込時に初回決済、以後毎月同日に自動決済"],
  },
  {
    title: "提供時期",
    body: ["決済完了後、直ちに利用可能"],
  },
  {
    title: "解約・返金",
    body: ["アプリ内の支払い管理画面からいつでも解約可能。解約後も当該課金期間の末日まで利用可。日割り返金は行いません。"],
  },
  {
    title: "動作環境",
    body: ["iOS Safari / Android Chrome の最新版。ホーム画面への追加（PWA）に対応。"],
  },
] as const satisfies readonly LegalSection[];

export function PrivacyPage() {
  return (
    <LegalPage
      title="プライバシーポリシー"
      lead="ねてるねこで扱う猫の写真、Googleログイン、アカウント保存、分析イベントについての基本方針です。"
      updatedAt="2026年7月5日"
      sections={privacySections}
    />
  );
}

export function TermsPage() {
  return (
    <LegalPage
      title="利用規約"
      lead="ねてるねこベータ版を安心して使うための、最小限のルールです。"
      updatedAt="2026年7月5日"
      sections={termsSections}
    />
  );
}

export function ContactPage() {
  return (
    <LegalPage
      title="問い合わせ"
      lead="ベータ期間中の連絡方法についてまとめています。"
      updatedAt="2026年7月5日"
      sections={contactSections}
    />
  );
}

export function AccountDeletionPage() {
  return (
    <LegalPage
      title="アカウントとデータの削除について"
      lead="ねてるねこに保存したアカウント、写真、猫の記録、思い出の削除依頼についてまとめています。"
      updatedAt="2026年7月3日"
      sections={accountDeletionSections}
    />
  );
}

export function CancellationPage() {
  return (
    <LegalPage
      title="解約方法"
      lead="βサポーターの支払い管理と解約についてまとめています。"
      updatedAt="2026年6月7日"
      sections={cancellationSections}
    />
  );
}

export function CommercialTransactionsPage() {
  return (
    <LegalPage
      title="特定商取引法に基づく表記"
      lead="βサポーターの支払いに関する表示です。"
      updatedAt="2026年7月5日"
      sections={commercialTransactionsSections}
    />
  );
}

function LegalPage({ title, lead, updatedAt, sections }: LegalPageProps) {
  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <AppButton href="/settings" variant="quiet" size="sm" style={styles.backLink}>
            ‹ 設定にもどる
          </AppButton>
          <div>
            <h1 style={styles.title}>{title}</h1>
            <p style={styles.updatedAt}>最終更新: {updatedAt}</p>
          </div>
        </div>

        <p style={styles.lead}>{lead}</p>

        {sections.map((section) => (
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
            </section>
        ))}

        <p style={styles.note}>
          このページはベータ版公開に向けた暫定版です。正式公開前に内容を更新することがあります。
        </p>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: APP_PAGE_BACKGROUND,
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
    color: "#2a2925",
    padding:
      "calc(24px + env(safe-area-inset-top)) 20px calc(40px + env(safe-area-inset-bottom))",
  },
  container: {
    width: "min(100%, 430px)",
    margin: "0 auto",
  },
  header: {
    display: "grid",
    gap: "18px",
    justifyItems: "start",
    padding: "0 0 22px",
  },
  backLink: {
    marginBottom: 0,
  },
  title: {
    margin: "0 0 3px",
    color: "#3f382e",
    fontSize: "24px",
    fontWeight: 500,
    letterSpacing: "0.04em",
  },
  updatedAt: {
    margin: 0,
    fontSize: "12px",
    color: "#8f8779",
    fontWeight: 500,
    lineHeight: 1.5,
  },
  lead: {
    margin: "0 0 8px",
    color: "#6f6757",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.9,
    letterSpacing: 0,
  },
  section: {
    padding: "18px 0",
    borderTop: "1px solid rgba(120,108,94,0.14)",
  },
  sectionTitle: {
    margin: "0 0 10px",
    color: "#4a4338",
    fontSize: "15px",
    fontWeight: 500,
    letterSpacing: "0.03em",
  },
  paragraph: {
    margin: "0 0 12px",
    color: "#6f6757",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.9,
    letterSpacing: 0,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    paddingLeft: "20px",
    margin: "0 0 12px",
  },
  listItem: {
    color: "#6f6757",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.85,
  },
  note: {
    margin: "2px 0 0",
    color: "#8f8779",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.75,
  },
} satisfies Record<string, CSSProperties>;
