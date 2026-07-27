import type { CSSProperties } from "react";
import { AppButton } from "../../components/ui/AppButton";

export default function HowToUsePage() {
  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <AppButton href="/settings" variant="quiet" size="sm" style={styles.backLink}>
          ‹ 設定にもどる
        </AppButton>
        <h1 style={styles.title}>使い方</h1>

        <section style={styles.section}>
          <h2 style={styles.heading}>1日のながれ</h2>
          <p style={styles.text}>
            はじめてのときは、まず4匹のねこから気になる1匹を選びます。
            あなたの猫の写真を1枚送ると、選んだ猫は「ねこだより」に、送った写真は「うちのこ」に保存されます。
            見るだけでホームへ進むこともできます。
          </p>
          <p style={styles.text}>
            そのあとは、「きょう」から猫のねがおを1枚残します。
            「ほかのおうちへ送る」で保存すると、次のよる8時ごろに4匹のねこがとどき、残したい1匹を選べます。
            写真はまずこの端末に保存され、Googleでログインすると、ねてるねこのアカウントにも保存できます。
            保存したねがおは運営確認後、ほかの利用者へとどく候補になります。
            「自分だけ」で保存した写真は自分の記録だけに残り、ねこだよりには使われません。
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>よる8時のルール</h2>
          <p style={styles.text}>
            よる8時より前に「ほかのおうちへ送る」で保存すると、きょうのよる8時ごろにねこだよりがとどきます。
            よる8時をすぎてから保存した分は、あしたとどきます。
            よる8時のすこし前に保存した分も、あしたとどくことがあります。
          </p>
          <p style={styles.text}>
            しばらくひらかなかった場合も、次にひらいたときは、いちばん新しいねこだよりだけがとどきます。
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>写真のあつかい</h2>
          <p style={styles.text}>
            とどく相手には、猫のねがおだけがとどきます。猫の名前やメールアドレスは表示されません。
          </p>
          <p style={styles.text}>
            表示できない写真や、運営に報告された写真は、とどく候補から外します。
            ねてるねこは、静かに使える場所であることを大切にしています。
          </p>
        </section>

        <section id="home-screen" style={styles.section}>
          <h2 style={styles.heading}>ホーム画面に置く</h2>
          <p style={styles.text}>
            LINEやInstagramの中では追加できません。右上のメニューからSafariまたはChromeでひらいてください。
          </p>
          <p style={styles.text}>
            iPhoneはSafari下部の共有ボタンから「ホーム画面に追加」を選びます。
            AndroidはChromeのメニューから「アプリをインストール」または「ホーム画面に追加」を選びます。
          </p>
        </section>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "var(--app-paper-background)",
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
    color: "#2a2925",
    padding: "calc(24px + env(safe-area-inset-top)) 20px calc(40px + env(safe-area-inset-bottom))",
  },
  container: {
    width: "min(100%, 430px)",
    margin: "0 auto",
  },
  backLink: {
    marginBottom: "18px",
  },
  title: {
    margin: "0 0 26px",
    color: "#3f382e",
    fontSize: "24px",
    fontWeight: 500,
    letterSpacing: "0.04em",
  },
  section: {
    padding: "18px 0",
    borderTop: "1px solid rgba(120,108,94,0.14)",
  },
  heading: {
    margin: "0 0 10px",
    color: "#4a4338",
    fontSize: "15px",
    fontWeight: 500,
    letterSpacing: "0.03em",
  },
  text: {
    margin: "0 0 12px",
    color: "#6f6757",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.9,
    letterSpacing: 0,
  },
} satisfies Record<string, CSSProperties>;
