import type { CSSProperties } from "react";

type AppLoadingScreenProps = {
  variant: "home" | "collection" | "cats" | "torisetu";
};

export function AppLoadingScreen({ variant }: AppLoadingScreenProps) {
  const isHome = variant === "home";
  const isCats = variant === "cats";
  const isCollection = variant === "collection";
  const isTorisetu = variant === "torisetu";

  return (
    <main style={isHome ? styles.homePage : styles.page}>
      <div style={styles.backdrop} aria-hidden="true" />
      <div style={styles.veil} aria-hidden="true" />
      <div style={styles.container}>
        <div style={styles.topRow}>
          <div style={styles.titleLine} />
          <div style={styles.pillLine} />
        </div>

        {isHome ? (
          <div style={styles.homeSpacer} />
        ) : (
          <div style={styles.headerCard}>
            <div style={styles.headerLineLarge} />
            <div style={styles.headerLineSmall} />
          </div>
        )}

        {isCats ? <AvatarRail /> : null}
        {isCollection ? <CollectionGridSkeleton /> : null}
        {isTorisetu ? <KnowledgeShelfSkeleton /> : null}
        {isHome ? <HomeBoardSkeleton /> : null}
      </div>
      <style>{`
        @keyframes loadingShimmer {
          0% { background-position: 180% 0; }
          100% { background-position: -180% 0; }
        }
      `}</style>
    </main>
  );
}

function AvatarRail() {
  return (
    <>
      <div style={styles.avatarRail}>
        {[...Array(4)].map((_, index) => (
          <div key={index} style={styles.avatarItem}>
            <div style={styles.avatarCircle} />
            <div style={styles.avatarNameLine} />
          </div>
        ))}
      </div>
      <div style={styles.largeCard} />
      <div style={styles.smallCardRow}>
        <div style={styles.smallCard} />
        <div style={styles.smallCard} />
      </div>
    </>
  );
}

function CollectionGridSkeleton() {
  return (
    <>
      <div style={styles.segmentRow}>
        <div style={styles.segmentActive} />
        <div style={styles.segment} />
      </div>
      <div style={styles.grid}>
        {[...Array(6)].map((_, index) => (
          <div key={index} style={styles.gridCard} />
        ))}
      </div>
    </>
  );
}

function KnowledgeShelfSkeleton() {
  return (
    <>
      <div style={styles.largeCard} />
      <div style={styles.shelfRail}>
        {[...Array(3)].map((_, index) => (
          <div key={index} style={styles.shelfCard} />
        ))}
      </div>
      <div style={styles.stackedList}>
        <div style={styles.listRow} />
        <div style={styles.listRow} />
        <div style={styles.listRow} />
      </div>
    </>
  );
}

function HomeBoardSkeleton() {
  return (
    <div style={styles.homeBoard}>
      <div style={styles.boardTitleLine} />
      <div style={styles.boardRail}>
        <div style={styles.boardCard} />
        <div style={styles.boardCard} />
        <div style={styles.boardCardPeek} />
      </div>
    </div>
  );
}

const glassBase: CSSProperties = {
  background:
    "linear-gradient(90deg, rgba(255,255,255,0.095) 25%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.095) 75%)",
  backgroundSize: "200% 100%",
  animation: "loadingShimmer 1.55s infinite",
  border: "0.5px solid rgba(255,255,255,0.13)",
  boxShadow: [
    "0 14px 34px rgba(0,0,0,0.2)",
    "inset 0 1px 0 rgba(255,255,255,0.13)",
  ].join(", "),
};

const styles = {
  page: {
    position: "relative",
    minHeight: "100dvh",
    overflow: "hidden",
    background: "#171514",
    color: "rgba(255,255,255,0.94)",
  },
  homePage: {
    position: "relative",
    height: "100dvh",
    overflow: "hidden",
    background:
      'linear-gradient(to bottom, rgba(18,16,15,0.16), rgba(18,16,15,0.46)), url("/sample-cats/mugi-hero.png") center 38% / cover no-repeat',
    color: "rgba(255,255,255,0.94)",
  },
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 0,
    background: [
      "radial-gradient(circle at 84% 10%, rgba(220,150,92,0.22) 0%, rgba(220,150,92,0.06) 25%, rgba(220,150,92,0) 52%)",
      "radial-gradient(ellipse at 45% 86%, rgba(78,66,58,0.66) 0%, rgba(25,22,20,0.92) 64%, rgba(15,14,13,1) 100%)",
      "linear-gradient(145deg, #30363a 0%, #5b4f48 44%, #201d1b 100%)",
    ].join(", "),
  },
  veil: {
    position: "fixed",
    inset: 0,
    zIndex: 1,
    pointerEvents: "none",
    background:
      "linear-gradient(to bottom, rgba(8,7,7,0.14) 0%, rgba(8,7,7,0.02) 35%, rgba(8,7,7,0.42) 100%)",
  },
  container: {
    position: "relative",
    zIndex: 2,
    width: "min(100%, 480px)",
    height: "100%",
    margin: "0 auto",
    padding:
      "calc(18px + env(safe-area-inset-top)) 16px calc(118px + env(safe-area-inset-bottom))",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  topRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  titleLine: {
    ...glassBase,
    width: "128px",
    height: "38px",
    borderRadius: "999px",
  },
  pillLine: {
    ...glassBase,
    width: "92px",
    height: "34px",
    borderRadius: "999px",
  },
  headerCard: {
    ...glassBase,
    height: "86px",
    borderRadius: "22px",
    padding: "16px",
    display: "grid",
    alignContent: "center",
    gap: "10px",
  },
  headerLineLarge: {
    width: "52%",
    height: "16px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.2)",
  },
  headerLineSmall: {
    width: "34%",
    height: "10px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.13)",
  },
  homeSpacer: {
    flex: 1,
  },
  avatarRail: {
    display: "flex",
    gap: "14px",
    padding: "2px 0",
  },
  avatarItem: {
    display: "grid",
    justifyItems: "center",
    gap: "7px",
  },
  avatarCircle: {
    ...glassBase,
    width: "68px",
    height: "68px",
    borderRadius: "50%",
  },
  avatarNameLine: {
    ...glassBase,
    width: "38px",
    height: "9px",
    borderRadius: "999px",
  },
  largeCard: {
    ...glassBase,
    height: "168px",
    borderRadius: "24px",
  },
  smallCardRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
  },
  smallCard: {
    ...glassBase,
    height: "72px",
    borderRadius: "18px",
  },
  segmentRow: {
    display: "flex",
    gap: "8px",
  },
  segmentActive: {
    ...glassBase,
    width: "84px",
    height: "34px",
    borderRadius: "999px",
    background:
      "linear-gradient(90deg, rgba(255,255,255,0.24) 25%, rgba(255,255,255,0.36) 50%, rgba(255,255,255,0.24) 75%)",
  },
  segment: {
    ...glassBase,
    width: "84px",
    height: "34px",
    borderRadius: "999px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  },
  gridCard: {
    ...glassBase,
    aspectRatio: "1 / 1",
    borderRadius: "18px",
  },
  shelfRail: {
    display: "flex",
    gap: "10px",
    overflow: "hidden",
  },
  shelfCard: {
    ...glassBase,
    width: "148px",
    minWidth: "148px",
    height: "108px",
    borderRadius: "20px",
  },
  stackedList: {
    display: "grid",
    gap: "8px",
  },
  listRow: {
    ...glassBase,
    height: "64px",
    borderRadius: "18px",
  },
  homeBoard: {
    display: "grid",
    gap: "12px",
  },
  boardTitleLine: {
    ...glassBase,
    width: "168px",
    height: "20px",
    borderRadius: "999px",
  },
  boardRail: {
    display: "flex",
    gap: "12px",
    overflow: "hidden",
  },
  boardCard: {
    ...glassBase,
    width: "168px",
    minWidth: "168px",
    height: "136px",
    borderRadius: "24px",
  },
  boardCardPeek: {
    ...glassBase,
    width: "90px",
    minWidth: "90px",
    height: "136px",
    borderRadius: "24px 0 0 24px",
  },
} satisfies Record<string, CSSProperties>;
