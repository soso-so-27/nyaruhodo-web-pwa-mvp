import type { CSSProperties } from "react";

export default function HowToUsePage() {
  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <a href="/settings" style={styles.backLink}>
          ‹ 設定にもどる
        </a>
        <h1 style={styles.title}>使い方</h1>

        <section style={styles.section}>
          <h2 style={styles.heading}>1日のながれ</h2>
          <p style={styles.text}>
            朝でも、昼でも、ねこがねていたら「きょう」から1まい撮ります。
            撮ったねがおは、この端末と、必要なときだけアカウントに保存されます。
          </p>
          <p style={styles.text}>
            よる8じごろになると、どこかのねこのねがおが1まい届きます。
            ひらくと、自分の1まいと、届いた1まいが「きょうの2まい」になります。
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>よる8じのルール</h2>
          <p style={styles.text}>
            よる8じより前に撮った写真は、きょうの夜に届く手紙のもとになります。
            よる8じをすぎてから撮った写真は、あしたの夜の分になります。
          </p>
          <p style={styles.text}>
            しばらく開かなかった日があっても、次に開いたときに、いちばん新しい
            届く分だけを見られるようにしています。
          </p>
        </section>

        <section style={styles.section}>
          <h2 style={styles.heading}>写真のあつかい</h2>
          <p style={styles.text}>
            届く相手には、猫のねがおだけが届きます。名前やメールアドレスは渡しません。
            表示に必要な写真だけを読み込み、保存できたものは端末にも残します。
          </p>
          <p style={styles.text}>
            表示できない写真や、通報された写真は、届く候補から外します。
            ねてるねこは、静かに使える場所であることを大切にしています。
          </p>
        </section>
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f7f3ea",
    color: "#2a2925",
    padding: "calc(24px + env(safe-area-inset-top)) 20px calc(40px + env(safe-area-inset-bottom))",
  },
  container: {
    width: "min(100%, 430px)",
    margin: "0 auto",
  },
  backLink: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "40px",
    marginBottom: "18px",
    color: "#776f63",
    fontSize: "13px",
    fontWeight: 500,
    textDecoration: "none",
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
