import type { CSSProperties } from "react";
import { BottomNavigation } from "../navigation/BottomNavigation";

type AppLoadingScreenProps = {
  variant: "home" | "collection" | "cats" | "account" | "startup";
};

export function AppLoadingScreen({ variant }: AppLoadingScreenProps) {
  const isHome = variant === "home";
  const isCollection = variant === "collection";
  const isCats = variant === "cats";
  const isAccount = variant === "account";
  const isStartup = variant === "startup";
  const activeNav = isHome ? "today" : isCollection ? "collection" : "cats";

  return (
    <main style={styles.page} aria-busy="true">
      <div style={styles.paperBackground} aria-hidden="true" />
      <div style={styles.paperBreath} className="loading-paper-breath" aria-hidden="true" />

      <div style={styles.container}>
        {isStartup ? <StartupLoading /> : null}
        {isHome ? <HomeLoading /> : null}
        {isCollection ? <CollectionLoading /> : null}
        {isCats ? <CatsLoading /> : null}
        {isAccount ? <AccountLoading /> : null}
      </div>

      <style>{`
        .loading-sheen {
          position: relative;
          overflow: hidden;
        }

        .loading-sheen::after {
          content: "";
          position: absolute;
          inset: -24% -68%;
          pointer-events: none;
          transform: translateX(-140%);
          background: linear-gradient(
            105deg,
            transparent 35%,
            color-mix(in srgb, var(--paper, #fffdf8) 54%, transparent) 50%,
            transparent 66%
          );
          animation: loadingSheen 2.8s ease-in-out infinite;
        }

        @keyframes loadingSheen {
          0% { transform: translateX(-140%); opacity: 0; }
          18% { opacity: .58; }
          70% { opacity: .36; }
          100% { transform: translateX(140%); opacity: 0; }
        }

        @keyframes loadingBreath {
          0%, 100% { opacity: .5; transform: translate3d(-1.2%, -.7%, 0) scale(1); }
          50% { opacity: .82; transform: translate3d(1.4%, .9%, 0) scale(1.03); }
        }

        @keyframes loadingEnvelopePulse {
          0%, 100% { box-shadow: 0 10px 22px -18px rgba(120, 70, 52, .2); }
          50% { box-shadow: 0 13px 26px -16px rgba(194, 116, 90, .28); }
        }

        @keyframes loadingSplashBreath {
          0%, 100% { opacity: .98; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.006); }
        }

        @media (prefers-reduced-motion: reduce) {
          .loading-sheen::after,
          .loading-paper-breath,
          .loading-envelope-pulse,
          .loading-splash-breath {
            animation: none !important;
          }
        }
      `}</style>

      {isAccount || isStartup ? null : <BottomNavigation active={activeNav} />}
    </main>
  );
}

function StartupLoading() {
  return (
    <section style={styles.startupStage} aria-label="ねてるねこを起動中">
      <div style={styles.splashEnvelope} className="loading-splash-breath" aria-hidden="true" />
    </section>
  );
}

function HomeLoading() {
  return (
    <section style={styles.homeStage} aria-label="きょうを読み込み中">
      <div style={styles.homeFrame} className="loading-sheen">
        <img
          src="/illustrations/sleeping-cat-empty.png"
          alt=""
          aria-hidden="true"
          style={styles.homeCat}
        />
      </div>
      <div style={styles.homeTray}>
        <div style={styles.compactLetter} className="loading-envelope-pulse" aria-hidden="true">
          <span style={styles.letterSeal} />
        </div>
        <div style={styles.trayLines} aria-hidden="true">
          <span style={styles.trayLineLong} className="loading-sheen" />
          <span style={styles.trayLineShort} className="loading-sheen" />
        </div>
      </div>
    </section>
  );
}

function CollectionLoading() {
  return (
    <section style={styles.pageStage} aria-label="まいにちを読み込み中">
      <div style={styles.segmentGhost} aria-hidden="true">
        <span style={styles.segmentPill} />
        <span style={styles.segmentPillSoft} />
      </div>
      <div style={styles.boardPaper}>
        <span style={styles.monthLine} className="loading-sheen" />
        <div style={styles.boardCluster}>
          {boardPhotoLayouts.map((layout, index) => (
            <span key={index} style={{ ...styles.boardPhoto, ...layout }} className="loading-sheen" />
          ))}
        </div>
      </div>
    </section>
  );
}

function CatsLoading() {
  return (
    <section style={styles.pageStage} aria-label="うちのこを読み込み中">
      <div style={styles.catHeader}>
        <span style={styles.avatarGhost} className="loading-sheen" />
        <span style={styles.nameGhost} className="loading-sheen" />
        <span style={styles.smallCircleGhost} />
      </div>
      <div style={styles.recordPaper}>
        <span style={styles.kickerLine} className="loading-sheen" />
        <span style={styles.titleLine} className="loading-sheen" />
        <div style={styles.metricGrid}>
          <span style={styles.metricGhost} />
          <span style={styles.metricGhost} />
          <span style={styles.metricGhost} />
          <span style={styles.metricGhost} />
        </div>
      </div>
      <div style={styles.photoGridGhost}>
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index} style={styles.squareGhost} className="loading-sheen" />
        ))}
      </div>
    </section>
  );
}

function AccountLoading() {
  return (
    <section style={styles.accountStage} aria-label="アカウントを確認中">
      <div style={styles.accountPaper}>
        <span style={styles.accountSeal} />
        <span style={styles.accountTitle} className="loading-sheen" />
        <span style={styles.accountCopy} className="loading-sheen" />
      </div>
    </section>
  );
}

const paperSurface: CSSProperties = {
  background: "color-mix(in srgb, var(--paper-card) 72%, rgba(255,255,255,.16))",
  border: "1px solid color-mix(in srgb, var(--ink) 7%, transparent)",
  boxShadow:
    "0 1px 0 rgba(255,255,255,.46) inset, 0 18px 46px -34px rgba(70,50,30,.34)",
};

const shimmerSurface: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  background: "linear-gradient(180deg, rgba(255,253,248,.44), rgba(241,232,214,.28))",
  border: "1px solid color-mix(in srgb, var(--ink) 7%, transparent)",
};

const boardPhotoLayouts: CSSProperties[] = [
  { left: "11%", top: "24%", width: "116px", height: "112px", transform: "rotate(-5deg)" },
  { left: "46%", top: "19%", width: "96px", height: "92px", transform: "rotate(3deg)" },
  { left: "66%", top: "34%", width: "120px", height: "112px", transform: "rotate(4deg)" },
  { left: "24%", top: "49%", width: "108px", height: "104px", transform: "rotate(6deg)" },
  { left: "51%", top: "56%", width: "128px", height: "118px", transform: "rotate(-4deg)" },
  { left: "15%", top: "71%", width: "92px", height: "88px", transform: "rotate(-3deg)" },
  { left: "66%", top: "75%", width: "92px", height: "88px", transform: "rotate(5deg)" },
];

const styles = {
  page: {
    position: "relative",
    minHeight: "100dvh",
    height: "100dvh",
    overflow: "hidden",
    color: "var(--ink)",
    fontFamily: "var(--font-ui)",
    background: "var(--app-paper-background)",
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
  },
  paperBackground: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    background: "var(--app-paper-background)",
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
  },
  paperBreath: {
    position: "fixed",
    inset: "-8%",
    pointerEvents: "none",
    background:
      "radial-gradient(60% 48% at 58% 18%, rgba(255,255,255,.22), transparent 62%), radial-gradient(52% 42% at 18% 78%, color-mix(in srgb, var(--app-paper-wash-bottom) 18%, transparent), transparent 68%)",
    mixBlendMode: "soft-light",
    animation: "loadingBreath 18s ease-in-out infinite",
  },
  container: {
    position: "relative",
    zIndex: 1,
    width: "min(calc(100% - 28px), 410px)",
    minHeight: "100%",
    margin: "0 auto",
  },
  startupStage: {
    minHeight: "100dvh",
    position: "relative",
    margin: "0 calc(50% - 50vw)",
    width: "100vw",
    overflow: "hidden",
    backgroundImage: "url('/splash/v5/apple-splash-1170-2532.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  },
  splashEnvelope: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(56% 36% at 50% 44%, rgba(255,255,255,.08), transparent 68%)",
    mixBlendMode: "soft-light",
    animation: "loadingSplashBreath 4.8s ease-in-out infinite",
  },
  homeStage: {
    minHeight: "100dvh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "18px",
    padding: "calc(26px + env(safe-area-inset-top)) 4px calc(116px + env(safe-area-inset-bottom))",
  },
  homeFrame: {
    ...paperSurface,
    position: "relative",
    width: "100%",
    minHeight: "clamp(500px, 62dvh, 606px)",
    borderRadius: "30px",
    display: "grid",
    placeItems: "center",
  },
  homeCat: {
    width: "118px",
    opacity: 0.7,
    filter: "drop-shadow(0 10px 18px rgba(70,50,30,.1))",
  },
  homeTray: {
    ...paperSurface,
    width: "100%",
    minHeight: "86px",
    borderRadius: "22px",
    display: "grid",
    gridTemplateColumns: "96px 1fr",
    alignItems: "center",
    gap: "18px",
    padding: "14px 18px",
  },
  compactLetter: {
    width: "96px",
    height: "48px",
    borderRadius: "14px",
    display: "grid",
    placeItems: "center",
    background:
      "linear-gradient(145deg, rgba(255,253,248,.88), rgba(245,237,222,.7)), linear-gradient(32deg, transparent 49%, rgba(160,130,90,.12) 50%, transparent 51%)",
    border: "1px solid color-mix(in srgb, var(--seal) 10%, transparent)",
  },
  letterSeal: {
    width: "14px",
    height: "14px",
    borderRadius: "999px",
    background: "var(--seal)",
    opacity: 0.84,
  },
  trayLines: {
    display: "grid",
    gap: "10px",
    justifyItems: "start",
  },
  trayLineLong: {
    ...shimmerSurface,
    width: "min(100%, 172px)",
    height: "11px",
    borderRadius: "999px",
  },
  trayLineShort: {
    ...shimmerSurface,
    width: "112px",
    height: "10px",
    borderRadius: "999px",
    opacity: 0.8,
  },
  pageStage: {
    minHeight: "100dvh",
    padding: "calc(34px + env(safe-area-inset-top)) 0 calc(112px + env(safe-area-inset-bottom))",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },
  segmentGhost: {
    alignSelf: "center",
    display: "flex",
    gap: "10px",
    padding: "4px",
    borderRadius: "999px",
    background: "rgba(255,253,248,.42)",
    border: "1px solid color-mix(in srgb, var(--ink) 7%, transparent)",
  },
  segmentPill: {
    width: "120px",
    height: "44px",
    borderRadius: "999px",
    background: "rgba(255,253,248,.72)",
    border: "1px solid color-mix(in srgb, var(--ink) 16%, transparent)",
  },
  segmentPillSoft: {
    width: "120px",
    height: "44px",
    borderRadius: "999px",
    background: "rgba(255,253,248,.3)",
  },
  boardPaper: {
    ...paperSurface,
    position: "relative",
    minHeight: "min(66dvh, 620px)",
    borderRadius: "30px",
    padding: "28px 22px",
  },
  monthLine: {
    ...shimmerSurface,
    display: "block",
    width: "148px",
    height: "24px",
    borderRadius: "999px",
  },
  boardCluster: {
    position: "relative",
    height: "calc(100% - 38px)",
    minHeight: "480px",
  },
  boardPhoto: {
    ...shimmerSurface,
    position: "absolute",
    borderRadius: "14px",
    boxShadow: "0 12px 22px -18px rgba(70,50,30,.35)",
  },
  catHeader: {
    ...paperSurface,
    borderRadius: "28px",
    minHeight: "104px",
    display: "grid",
    gridTemplateColumns: "58px 1fr 48px",
    alignItems: "center",
    gap: "14px",
    padding: "18px 20px",
  },
  avatarGhost: {
    ...shimmerSurface,
    width: "58px",
    height: "58px",
    borderRadius: "999px",
  },
  nameGhost: {
    ...shimmerSurface,
    width: "92px",
    height: "22px",
    borderRadius: "999px",
  },
  smallCircleGhost: {
    width: "48px",
    height: "48px",
    borderRadius: "999px",
    border: "1px solid color-mix(in srgb, var(--ink) 9%, transparent)",
    background: "rgba(255,253,248,.4)",
  },
  recordPaper: {
    ...paperSurface,
    borderRadius: "28px",
    padding: "24px",
    display: "grid",
    gap: "16px",
  },
  kickerLine: {
    ...shimmerSurface,
    width: "120px",
    height: "13px",
    borderRadius: "999px",
  },
  titleLine: {
    ...shimmerSurface,
    width: "190px",
    height: "28px",
    borderRadius: "999px",
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  metricGhost: {
    height: "74px",
    borderRadius: "18px",
    border: "1px solid color-mix(in srgb, var(--ink) 7%, transparent)",
    background: "rgba(255,253,248,.34)",
  },
  photoGridGhost: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "3px",
  },
  squareGhost: {
    ...shimmerSurface,
    aspectRatio: "1 / 1",
    borderRadius: "8px",
  },
  accountStage: {
    minHeight: "100dvh",
    display: "grid",
    placeItems: "center",
    padding: "calc(24px + env(safe-area-inset-top)) 0 calc(24px + env(safe-area-inset-bottom))",
  },
  accountPaper: {
    ...paperSurface,
    width: "min(100%, 340px)",
    borderRadius: "28px",
    padding: "28px",
    display: "grid",
    justifyItems: "center",
    gap: "16px",
  },
  accountSeal: {
    width: "34px",
    height: "34px",
    borderRadius: "999px",
    background: "var(--seal)",
    opacity: 0.64,
  },
  accountTitle: {
    ...shimmerSurface,
    width: "170px",
    height: "18px",
    borderRadius: "999px",
  },
  accountCopy: {
    ...shimmerSurface,
    width: "230px",
    height: "12px",
    borderRadius: "999px",
    opacity: 0.8,
  },
} satisfies Record<string, CSSProperties>;
