import type { Metadata } from "next";
import Image from "next/image";

import {
  CameraIcon,
  LockIcon,
  MailIcon,
  PhotoIcon,
} from "../../components/ui/AppIcons";
import { ServiceSiteCta } from "./ServiceSiteCta";
import styles from "./about.module.css";

const title = "ねてるねこ｜よる8時に、ねこだよりがとどく";
const description =
  "猫のねがおを1枚選ぶと、初回は最大4枚のねこだよりがとどき、その中から1枚を保存できます。次からは、ねがおを選ぶと、次のよる8時ごろにねこだよりがとどく、静かなWebアプリです。";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: "/about",
    siteName: "ねてるねこ",
    title,
    description,
    images: [
      {
        url: "/images/social/onboarding-og.webp",
        width: 1200,
        height: 630,
        alt: "ねてるねこのねこだよりのイラスト",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/images/social/onboarding-og.webp"],
  },
};

const dailySteps = [
  {
    number: "01",
    label: "とる",
    title: "寝ているあの子を、一枚だけ。",
    copy: "朝でも、昼でも、夜でも。ねがおを とるか、写真から1枚選びます。",
    image: "/sample-cats/pose-belly.webp",
    imageAlt: "おなかを見せて眠る猫",
    kind: "photo",
  },
  {
    number: "02",
    label: "よる8時",
    title: "ねこだよりが、とどきます。",
    copy: "ねがおを選ぶと、次のよる8時ごろに、どこかのおうちのねこだよりがとどきます。",
    image: "/illustrations/onboarding-envelope.webp",
    imageAlt: "ねてるねこのねこだよりのイラスト",
    kind: "envelope",
  },
  {
    number: "03",
    label: "ひらく",
    title: "きょうも、どこかでよく寝ています。",
    copy: "ねこだよりが複数あるときは、保存する1枚をえらびます。",
    image: "/sample-cats/mugi-portrait.webp",
    imageAlt: "寝具の上でくつろぐ猫",
    kind: "photo",
  },
] as const;

export default function AboutPage() {
  return (
    <main id="top" className={styles.page}>
      <section className={styles.hero} aria-labelledby="about-title">
        <Image
          src="/sample-cats/home-hero-generated.webp"
          alt="白い寝具の上にいる猫"
          fill
          priority
          sizes="100vw"
          className={styles.heroImage}
        />
        <div className={styles.heroWash} />

        <header className={styles.header}>
          <a href="#top" className={styles.brand} aria-label="ねてるねこ トップ">
            ねてるねこ
          </a>
          <ServiceSiteCta className={styles.headerCta} placement="header">
            はじめる
          </ServiceSiteCta>
        </header>

        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>一枚のねがおから始まる、ねこだより</p>
          <h1 id="about-title">ねてるねこ</h1>
          <p className={styles.heroLead}>
            じぶんの猫のねがおを一枚選ぶと、
            <br />
            最初は最大4枚とどき、その中から1枚を保存できます。
          </p>
          <ServiceSiteCta className={styles.heroCta} placement="hero">
            ねがおを選んではじめる
          </ServiceSiteCta>
          <p className={styles.heroNote}>
            最初はその場で。次からは、写真を選ぶと、次のよる8時ごろに。
          </p>
        </div>

        <a href="#day" className={styles.scrollCue}>
          一日のながれを見る
          <span aria-hidden="true">↓</span>
        </a>
      </section>

      <section id="day" className={styles.daySection}>
        <div className={styles.sectionIntro}>
          <p className={styles.sectionLabel}>ねてるねこの一日</p>
          <h2>一日は、こんなふうに。</h2>
          <p>
            たくさん見るための場所ではありません。
            <br />
            ねがおを一枚選んで、ねこだよりを待つための場所です。
          </p>
        </div>

        <div className={styles.steps}>
          {dailySteps.map((step) => (
            <article key={step.number} className={styles.step}>
              <div className={styles.stepCopy}>
                <p className={styles.stepIndex}>
                  <span>{step.number}</span>
                  {step.label}
                </p>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </div>
              <div
                className={`${styles.stepVisual} ${
                  step.kind === "envelope" ? styles.envelopeVisual : ""
                }`}
              >
                <Image
                  src={step.image}
                  alt={step.imageAlt}
                  fill
                  sizes="(max-width: 767px) 88vw, 46vw"
                  className={
                    step.kind === "envelope"
                      ? styles.envelopeImage
                      : styles.stepImage
                  }
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.keepsakeSection}>
        <div className={styles.keepsakeInner}>
          <div className={styles.keepsakeCopy}>
            <p className={styles.sectionLabel}>そのあと</p>
            <h2>ねがおは、静かに残っていきます。</h2>
            <p>
              とったねがおは「わたしのねがお」へ。選んだねこだよりは「とどいた」へ。
              この子の写真や記録といっしょに、日々が少しずつ積もります。
            </p>
            <p>
              前に とったねがおが、ときどきホームにとどく「思い出便」もあります。
            </p>
          </div>

          <div className={styles.photoStack} aria-label="残っていく猫の写真">
            <figure className={`${styles.postcard} ${styles.postcardBack}`}>
              <Image
                src="/sample-cats/pose-stretch.webp"
                alt="のびをする猫"
                fill
                sizes="260px"
                className={styles.postcardImage}
              />
            </figure>
            <figure className={`${styles.postcard} ${styles.postcardMiddle}`}>
              <Image
                src="/sample-cats/pose-box.webp"
                alt="箱に入った猫"
                fill
                sizes="260px"
                className={styles.postcardImage}
              />
            </figure>
            <figure className={`${styles.postcard} ${styles.postcardFront}`}>
              <Image
                src="/sample-cats/mugi-hero.webp"
                alt="こちらを見る猫"
                fill
                sizes="280px"
                className={styles.postcardImage}
              />
            </figure>
          </div>
        </div>
      </section>

      <section className={styles.quietSection}>
        <div className={styles.quietInner}>
          <p className={styles.sectionLabel}>この場所に、ないもの</p>
          <h2>くらべない。いそがない。さわがない。</h2>
          <div className={styles.absenceList}>
            <p>写真が並ぶ公開ページはありません。</p>
            <p>ほかの人の反応を集める機能もありません。</p>
            <p>広告も表示しません。</p>
          </div>
          <p className={styles.quietClosing}>
            あるのは、一日一枚のねがおと、そのあとにとどくねこだよりだけ。
          </p>
        </div>
      </section>

      <section className={styles.valuesSection}>
        <div className={styles.valuesInner}>
          <div className={styles.valuesHeading}>
            <p className={styles.sectionLabel}>だいじにしていること</p>
            <h2>猫と写真を、外の騒がしさから守ります。</h2>
          </div>
          <div className={styles.valueRows}>
            <article className={styles.valueRow}>
              <span className={styles.valueIcon} aria-hidden="true">
                <PhotoIcon size={24} />
              </span>
              <div>
                <h3>一枚ずつ確認</h3>
                <p>ねこだよりになる前に、とどけてもよい写真かを確認します。</p>
              </div>
            </article>
            <article className={styles.valueRow}>
              <span className={styles.valueIcon} aria-hidden="true">
                <LockIcon size={24} />
              </span>
              <div>
                <h3>名前や場所はとどけない</h3>
                <p>相手にとどくのはねがおだけ。猫の名前やメールアドレス、場所は渡しません。</p>
              </div>
            </article>
            <article className={styles.valueRow}>
              <span className={styles.valueIcon} aria-hidden="true">
                <MailIcon size={24} />
              </span>
              <div>
                <h3>ねこだよりの基本体験は無料</h3>
                <p>ねがおを とると、ねこだよりがとどく体験は、無料のまま使えます。</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.storySection}>
        <div className={styles.storyImageWrap}>
          <Image
            src="/sample-cats/mugi-portrait.webp"
            alt="あめとむぎとの暮らしから生まれた、ねてるねこ"
            fill
            sizes="(max-width: 767px) 100vw, 48vw"
            className={styles.storyImage}
          />
        </div>
        <div className={styles.storyCopy}>
          <p className={styles.sectionLabel}>はじまり</p>
          <h2>あめとむぎのねがおから、作りはじめました。</h2>
          <p>
            二匹の猫と暮らしながら、ひとりで作っています。ねがおを撮りためているうちに、
            どこかのおうちにも、いまこうして寝ている猫がいるんだろうな、と思うようになりました。
          </p>
          <p>それが、ねてるねこのはじまりです。</p>
          <a
            href="https://www.instagram.com/ame.to.mugi/"
            target="_blank"
            rel="noreferrer"
            className={styles.textLink}
          >
            あめとむぎの日々を見る
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      <section className={styles.betaSection}>
        <div className={styles.betaInner}>
          <div className={styles.betaTitle}>
            <CameraIcon size={24} aria-hidden="true" />
            <div>
              <p className={styles.sectionLabel}>いまのねてるねこ</p>
              <h2>まだ、育てている途中です。</h2>
            </div>
          </div>
          <div className={styles.betaColumns}>
            <p>
              いまはβ版です。最初はあめやむぎのねこだよりがとどくこともあります。
              とどくねこだよりはひとつずつ確認しながら、少人数で運営しています。
              通知はまだありません。ねこだよりは、よる8時を過ぎるとホームでひらけます。
            </p>
            <p>
              Webアプリなので、アプリストアは通りません。ブラウザから始められ、
              ホーム画面に追加すると、いつものアプリのようにひらけます。
            </p>
          </div>
        </div>
      </section>

      <section className={styles.finalSection}>
        <Image
          src="/illustrations/onboarding-envelope.webp"
          alt=""
          width={640}
          height={302}
          className={styles.finalEnvelope}
        />
        <p className={styles.sectionLabel}>最初にとどいたねこだよりから</p>
        <h2>どこかのねこだよりを、1枚保存してみませんか。</h2>
        <p>登録せずに始められます。必要なのは、猫のねがお一枚だけです。</p>
        <ServiceSiteCta className={styles.finalCta} placement="footer">
          ねてるねこをはじめる
        </ServiceSiteCta>
      </section>

      <footer className={styles.footer}>
        <a href="#top" className={styles.footerBrand}>ねてるねこ</a>
        <nav aria-label="法務とお問い合わせ" className={styles.footerLinks}>
          <a href="/terms">利用規約</a>
          <a href="/privacy">プライバシーポリシー</a>
          <a href="/commercial-transactions">特商法表記</a>
          <a href="/contact">お問い合わせ</a>
        </nav>
        <p>© 2026 ねてるねこ</p>
      </footer>
    </main>
  );
}
