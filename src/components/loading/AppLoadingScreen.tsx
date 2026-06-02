import type { CSSProperties } from "react";
import { BottomNavigation } from "../navigation/BottomNavigation";

type AppLoadingScreenProps = {
  variant: "home" | "collection" | "cats" | "torisetu";
};

export function AppLoadingScreen({ variant }: AppLoadingScreenProps) {
  const isHome = variant === "home";
  const isCats = variant === "cats";
  const isCollection = variant === "collection";
  const isTorisetu = variant === "torisetu";
  const activeNav = isHome
    ? "today"
    : isCollection
      ? "collection"
      : isCats
        ? "cats"
        : "torisetu";

  return (
    <main style={styles.page}>
      <div style={styles.paperBackground} aria-hidden="true" />
      <div style={styles.paperNoise} aria-hidden="true" />
      <div style={styles.topBar}>ねてるねこ</div>

      <div style={styles.container}>
        {isHome ? <HomeLoading /> : null}
        {isCollection ? <CollectionLoading /> : null}
        {isCats ? <CatsLoading /> : null}
        {isTorisetu ? <TorisetuLoading /> : null}
      </div>

      <style>{`
        @keyframes paperLoading {
          0% { background-position: 180% 0; }
          100% { background-position: -180% 0; }
        }
      `}</style>
      <BottomNavigation active={activeNav} />
    </main>
  );
}

function HomeLoading() {
  return (
    <section style={styles.homeStage} aria-label="しゃしんを読み込み中">
      <div style={styles.homeCopy}>
        <div style={styles.titleLineLarge} />
        <div style={styles.copyLine} />
        <div style={styles.copyLineShort} />
      </div>
      <div style={styles.cameraCircle}>
        <div style={styles.cameraIconLine} />
      </div>
      <div style={styles.statGrid}>
        <div style={styles.statCard} />
        <div style={styles.statCard} />
        <div style={styles.statCard} />
      </div>
    </section>
  );
}

function CollectionLoading() {
  return (
    <section style={styles.pageStage} aria-label="アルバムを読み込み中">
      <div style={styles.pageTitleLine} />
      <div style={styles.albumSection}>
        <div style={styles.sectionTitleLine} />
        <div style={styles.thumbRow}>
          <div style={styles.thumb} />
          <div style={styles.thumb} />
          <div style={styles.thumb} />
        </div>
      </div>
      <div style={styles.albumSection}>
        <div style={styles.sectionTitleLineShort} />
        <div style={styles.thumbRow}>
          <div style={styles.thumb} />
          <div style={styles.thumb} />
          <div style={styles.thumbMuted} />
        </div>
      </div>
    </section>
  );
}

function CatsLoading() {
  return (
    <section style={styles.pageStage} aria-label="ねこを読み込み中">
      <div style={styles.pageTitleLine} />
      <div style={styles.avatarRail}>
        <div style={styles.avatarItem} />
        <div style={styles.avatarItem} />
        <div style={styles.avatarItem} />
      </div>
      <div style={styles.profileCard}>
        <div style={styles.profilePhoto} />
        <div style={styles.profileLines}>
          <div style={styles.profileNameLine} />
          <div style={styles.profileSmallLine} />
        </div>
      </div>
      <div style={styles.infoList}>
        <div style={styles.infoRow} />
        <div style={styles.infoRow} />
        <div style={styles.infoRow} />
      </div>
    </section>
  );
}

function TorisetuLoading() {
  return (
    <section style={styles.pageStage} aria-label="読み込み中">
      <div style={styles.pageTitleLine} />
      <div style={styles.albumSection}>
        <div style={styles.sectionTitleLine} />
        <div style={styles.copyBlock} />
      </div>
      <div style={styles.infoList}>
        <div style={styles.infoRow} />
        <div style={styles.infoRow} />
      </div>
    </section>
  );
}

const shimmerBase: CSSProperties = {
  background:
    "linear-gradient(90deg, rgba(169,149,126,0.08) 25%, rgba(255,253,248,0.7) 50%, rgba(169,149,126,0.08) 75%)",
  backgroundSize: "200% 100%",
  animation: "paperLoading 1.55s infinite",
  border: "1px solid rgba(144,126,102,0.1)",
  boxShadow: "0 8px 18px rgba(90,76,60,0.045)",
};

const paperCard: CSSProperties = {
  background: "rgba(255,253,248,0.64)",
  border: "1px solid rgba(144,126,102,0.11)",
  boxShadow: "0 8px 18px rgba(90,76,60,0.045)",
};

const styles = {
  page: {
    position: "relative",
    height: "100dvh",
    overflow: "hidden",
    background: "#f7f3ea",
    color: "#332c26",
    fontFamily:
      'Outfit, "Zen Kaku Gothic New", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  paperBackground: {
    position: "fixed",
    inset: 0,
    zIndex: 0,
    pointerEvents: "none",
    background: [
      "radial-gradient(circle at 18% 14%, rgba(255,255,255,0.84) 0%, rgba(255,255,255,0.28) 28%, rgba(255,255,255,0) 54%)",
      "radial-gradient(circle at 86% 82%, rgba(226,211,185,0.34) 0%, rgba(226,211,185,0.12) 30%, rgba(226,211,185,0) 58%)",
      "linear-gradient(180deg, #fbf8f0 0%, #f4efe4 52%, #eee6d8 100%)",
    ].join(", "),
  },
  paperNoise: {
    position: "fixed",
    inset: 0,
    zIndex: 1,
    pointerEvents: "none",
    opacity: 0.045,
    backgroundImage:
      "linear-gradient(90deg, rgba(88,73,50,0.035) 1px, transparent 1px), linear-gradient(0deg, rgba(88,73,50,0.03) 1px, transparent 1px)",
    backgroundSize: "28px 28px",
  },
  topBar: {
    position: "fixed",
    top: "calc(58px + env(safe-area-inset-top))",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 3,
    color: "#4a463e",
    fontFamily: '"Shippori Mincho B1", "Hiragino Mincho ProN", "Yu Mincho", serif',
    fontSize: "18px",
    fontWeight: 400,
    letterSpacing: "0.16em",
    lineHeight: 1.4,
    whiteSpace: "nowrap",
  },
  container: {
    position: "relative",
    zIndex: 2,
    width: "min(calc(100% - 28px), 410px)",
    height: "100%",
    margin: "0 auto",
  },
  homeStage: {
    position: "absolute",
    inset: 0,
    display: "grid",
    justifyItems: "center",
    textAlign: "center",
  },
  homeCopy: {
    position: "absolute",
    top: "calc(clamp(120px, 18dvh, 168px) + env(safe-area-inset-top))",
    display: "grid",
    justifyItems: "center",
    gap: "13px",
    width: "100%",
  },
  titleLineLarge: {
    ...shimmerBase,
    width: "160px",
    height: "34px",
    borderRadius: "999px",
  },
  copyLine: {
    ...shimmerBase,
    width: "172px",
    height: "12px",
    borderRadius: "999px",
  },
  copyLineShort: {
    ...shimmerBase,
    width: "136px",
    height: "12px",
    borderRadius: "999px",
  },
  cameraCircle: {
    ...shimmerBase,
    position: "absolute",
    top: "calc(clamp(284px, 38dvh, 348px) + env(safe-area-inset-top))",
    left: "50%",
    width: "154px",
    height: "154px",
    transform: "translateX(-50%)",
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    boxShadow:
      "0 0 0 12px rgba(255,255,255,0.66), 0 18px 34px rgba(119,101,73,0.14)",
  },
  cameraIconLine: {
    width: "42px",
    height: "30px",
    borderRadius: "10px",
    background: "rgba(255,253,248,0.58)",
  },
  statGrid: {
    position: "absolute",
    top: "calc(clamp(456px, 64dvh, 584px) + env(safe-area-inset-top))",
    left: "50%",
    width: "min(100%, 380px)",
    transform: "translateX(-50%)",
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px",
  },
  statCard: {
    ...paperCard,
    minHeight: "100px",
    borderRadius: "20px",
  },
  pageStage: {
    padding:
      "calc(128px + env(safe-area-inset-top)) 0 calc(118px + env(safe-area-inset-bottom))",
    display: "grid",
    gap: "18px",
  },
  pageTitleLine: {
    ...shimmerBase,
    width: "132px",
    height: "32px",
    borderRadius: "999px",
    margin: "0 auto 8px",
  },
  albumSection: {
    ...paperCard,
    borderRadius: "24px",
    padding: "18px",
    display: "grid",
    gap: "14px",
  },
  sectionTitleLine: {
    ...shimmerBase,
    width: "108px",
    height: "20px",
    borderRadius: "999px",
  },
  sectionTitleLineShort: {
    ...shimmerBase,
    width: "86px",
    height: "20px",
    borderRadius: "999px",
  },
  thumbRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "10px",
  },
  thumb: {
    ...shimmerBase,
    aspectRatio: "1 / 1",
    borderRadius: "16px",
  },
  thumbMuted: {
    ...shimmerBase,
    aspectRatio: "1 / 1",
    borderRadius: "16px",
    opacity: 0.56,
  },
  avatarRail: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 72px)",
    gap: "16px",
    justifyContent: "center",
  },
  avatarItem: {
    ...shimmerBase,
    width: "72px",
    height: "72px",
    borderRadius: "50%",
  },
  profileCard: {
    ...paperCard,
    borderRadius: "24px",
    padding: "20px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  profilePhoto: {
    ...shimmerBase,
    width: "84px",
    height: "84px",
    borderRadius: "50%",
  },
  profileLines: {
    display: "grid",
    gap: "12px",
    flex: 1,
  },
  profileNameLine: {
    ...shimmerBase,
    width: "104px",
    height: "26px",
    borderRadius: "999px",
  },
  profileSmallLine: {
    ...shimmerBase,
    width: "78px",
    height: "14px",
    borderRadius: "999px",
  },
  infoList: {
    ...paperCard,
    borderRadius: "24px",
    overflow: "hidden",
  },
  infoRow: {
    height: "58px",
    borderBottom: "1px solid rgba(144,126,102,0.1)",
  },
  copyBlock: {
    ...shimmerBase,
    height: "128px",
    borderRadius: "18px",
  },
} satisfies Record<string, CSSProperties>;
