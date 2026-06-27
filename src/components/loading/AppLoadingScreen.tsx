import type { CSSProperties } from "react";
import { BottomNavigation } from "../navigation/BottomNavigation";

type AppLoadingScreenProps = {
  variant: "collection" | "account";
};

export function AppLoadingScreen({ variant }: AppLoadingScreenProps) {
  const isCollection = variant === "collection";
  const isAccount = variant === "account";

  return (
    <main style={styles.page} aria-busy="true">
      <div style={styles.paperBackground} aria-hidden="true" />
      <div style={styles.container}>
        {isCollection ? <CollectionLoading /> : null}
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

        @media (prefers-reduced-motion: reduce) {
          .loading-sheen::after {
            animation: none !important;
          }
        }
      `}</style>

      {isAccount ? null : <BottomNavigation active="collection" />}
    </main>
  );
}

function CollectionLoading() {
  return (
    <section style={styles.pageStage} aria-label="ねこだよりを読み込み中">
      <div style={styles.segmentGhost} aria-hidden="true">
        <span style={styles.segmentPill} />
        <span style={styles.segmentPillSoft} />
      </div>
      <div style={styles.boardPaper}>
        <span style={styles.monthLine} className="loading-sheen" />
        <div style={styles.boardCluster}>
          {boardPhotoLayouts.map((layout, index) => (
            <span
              key={index}
              style={{ ...styles.boardPhoto, ...layout }}
              className="loading-sheen"
            />
          ))}
        </div>
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

const pageBackground =
  "radial-gradient(78% 48% at 12% 5%, rgba(225, 158, 134, 0.28), transparent 64%), radial-gradient(72% 44% at 92% 100%, rgba(145, 165, 194, 0.24), transparent 66%), linear-gradient(180deg, #efe3d3 0%, #e9ddce 52%, #ded5c8 100%)";

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
    background: pageBackground,
    backgroundColor: "#eadfce",
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
  },
  paperBackground: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    background: pageBackground,
    backgroundColor: "#eadfce",
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
  },
  container: {
    position: "relative",
    zIndex: 1,
    width: "min(calc(100% - 28px), 410px)",
    minHeight: "100%",
    margin: "0 auto",
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
