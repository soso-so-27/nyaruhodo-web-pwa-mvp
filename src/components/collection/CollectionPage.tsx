"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  COLLECTION_GROUPS,
  type CollectionGroup,
  type CollectionGroupId,
  type CollectionSlot,
} from "../../lib/collection/poses";
import {
  getActiveCatProfile,
  getCatName,
  readActiveCatId,
  readCatProfiles,
  saveActiveCatId,
} from "../home/homeInputHelpers";
import type { CatProfile } from "../home/homeInputHelpers";
import { BottomNavigation } from "../navigation/BottomNavigation";

type CollectionPhoto = {
  id: string;
  slotId: string;
  src: string;
  createdAt?: string;
};

const SAMPLE_COLLECTION_PHOTOS: CollectionPhoto[] = [
  {
    id: "sample-belly-up",
    slotId: "belly-up",
    src: "/sample-cats/pose-belly.png",
  },
  {
    id: "sample-loaf",
    slotId: "loaf",
    src: "/sample-cats/pose-loaf.png",
  },
  {
    id: "sample-stretch",
    slotId: "stretch",
    src: "/sample-cats/pose-stretch.png",
  },
  {
    id: "sample-in-box",
    slotId: "in-box",
    src: "/sample-cats/pose-box.png",
  },
];

export function CollectionPage() {
  const [catProfiles, setCatProfiles] = useState<CatProfile[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const profiles = readCatProfiles();
    const savedActiveCatId = readActiveCatId();
    const activeProfile = getActiveCatProfile(profiles, savedActiveCatId);

    setCatProfiles(profiles);
    setActiveCatId(activeProfile.id);
    saveActiveCatId(activeProfile.id);
    setHasLoaded(true);
  }, []);

  const activeCatProfile =
    catProfiles.length > 0
      ? getActiveCatProfile(catProfiles, activeCatId)
      : null;
  const catName = getCatName(activeCatProfile);

  const photosBySlot = useMemo(() => groupPhotosBySlot(SAMPLE_COLLECTION_PHOTOS), []);
  const progress = useMemo(
    () => buildCollectionProgress(COLLECTION_GROUPS, photosBySlot),
    [photosBySlot],
  );

  if (!hasLoaded) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <section style={styles.emptyCard}>
            <h1 style={styles.emptyTitle}>コレクションを準備しています</h1>
            <p style={styles.emptyText}>
              写真を置く棚を、少しだけ整えています。
            </p>
          </section>
        </div>
        <BottomNavigation active="collection" />
      </main>
    );
  }

  if (!activeCatProfile) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <section style={styles.emptyCard}>
            <h1 style={styles.emptyTitle}>一緒に暮らしている子を登録しましょう</h1>
            <p style={styles.emptyText}>
              ねこページで登録すると、コレクションも猫ごとに分けて見られます。
            </p>
            <a href="/cats" style={styles.primaryLink}>
              ねこを登録する
            </a>
          </section>
        </div>
        <BottomNavigation active="collection" />
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <p style={styles.eyebrow}>コレクション</p>
          <h1 style={styles.title}>{catName}のかわいい瞬間をあつめます</h1>
          <CollectionProgress progress={progress} />
        </header>

        {COLLECTION_GROUPS.map((group) => (
          <CollectionSection
            key={group.id}
            group={group}
            photosBySlot={photosBySlot}
          />
        ))}
      </div>
      <BottomNavigation active="collection" />
    </main>
  );
}

function CollectionProgress({
  progress,
}: {
  progress: ReturnType<typeof buildCollectionProgress>;
}) {
  return (
    <section style={styles.progressCard} aria-label="コレクションの進み具合">
      <p style={styles.progressMain}>
        <span style={styles.progressNumber}>{progress.total.collected}</span>
        <span style={styles.progressSlash}> / {progress.total.total}</span>
        <span style={styles.progressLabel}> あつまりました</span>
      </p>
      <div style={styles.progressRows}>
        <span style={styles.progressPill}>
          ポーズ {progress.pose.collected} / {progress.pose.total}
        </span>
        <span style={styles.progressPill}>
          シーン {progress.scene.collected} / {progress.scene.total}
        </span>
      </div>
    </section>
  );
}

function CollectionSection({
  group,
  photosBySlot,
}: {
  group: CollectionGroup;
  photosBySlot: Map<string, CollectionPhoto[]>;
}) {
  return (
    <section style={styles.section} aria-labelledby={`${group.id}-collection`}>
      <div style={styles.sectionHeader}>
        <div>
          <h2 id={`${group.id}-collection`} style={styles.sectionTitle}>
            {group.label}
          </h2>
          <p style={styles.sectionSubText}>{group.description}</p>
        </div>
      </div>
      <div style={styles.collectionGrid}>
        {group.slots.map((slot) => (
          <CollectionCard
            key={slot.id}
            slot={slot}
            photos={photosBySlot.get(slot.id) ?? []}
          />
        ))}
      </div>
    </section>
  );
}

function CollectionCard({
  slot,
  photos,
}: {
  slot: CollectionSlot;
  photos: CollectionPhoto[];
}) {
  const firstPhoto = photos[0];
  const isCollected = photos.length > 0;

  if (isCollected && firstPhoto) {
    return (
      <article style={{ ...styles.collectionCard, ...styles.photoCard }}>
        <img src={firstPhoto.src} alt="" style={styles.cardPhoto} />
        <span style={styles.cardPhotoFade} aria-hidden="true" />
        <div style={styles.photoCardText}>
          <p style={styles.photoCardLabel}>{slot.label}</p>
          <span style={styles.photoCount}>{photos.length}枚</span>
        </div>
      </article>
    );
  }

  return (
    <article style={styles.collectionCard}>
      <div style={styles.silhouetteWrap} aria-hidden="true">
        <CollectionSilhouette slot={slot} />
      </div>
      <p style={styles.emptySlotLabel}>{slot.label}</p>
      <span style={styles.emptySlotText}>まだこれから</span>
    </article>
  );
}

function CollectionSilhouette({ slot }: { slot: CollectionSlot }) {
  const shape = getSilhouetteShape(slot.silhouetteKey, slot.group);

  return (
    <svg
      viewBox="0 0 96 72"
      style={styles.silhouette}
      fill="none"
      stroke="currentColor"
      strokeWidth="3.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      {shape}
    </svg>
  );
}

function getSilhouetteShape(key: string, group: CollectionGroupId) {
  switch (key) {
    case "belly-up":
      return (
        <>
          <path d="M23 43c8-16 38-18 50-3 7 9 0 19-18 19H37c-15 0-22-7-14-16Z" />
          <path d="M34 38 27 28" />
          <path d="M59 36 68 27" />
          <path d="M42 50c3 2 9 2 12 0" />
        </>
      );
    case "loaf":
      return (
        <>
          <path d="M25 45c0-15 12-24 26-24s24 9 24 24c0 11-9 16-25 16s-25-5-25-16Z" />
          <path d="M39 24 33 14" />
          <path d="M60 24 66 14" />
          <path d="M38 47h24" />
        </>
      );
    case "stretch":
      return (
        <>
          <path d="M16 47c13-10 38-15 63-6" />
          <path d="M19 47c6 10 17 12 28 6" />
          <path d="M62 41c2 9 10 13 19 13" />
          <path d="M76 38 86 31" />
        </>
      );
    case "face-down-sleep":
      return (
        <>
          <path d="M25 51c0-16 13-26 28-26 14 0 24 9 24 21 0 10-8 15-25 15H36c-7 0-11-3-11-10Z" />
          <path d="M37 48h24" />
          <path d="M40 25 35 17" />
          <path d="M58 25 64 17" />
        </>
      );
    case "curled-up":
      return (
        <>
          <path d="M25 39c4-17 23-25 39-15 15 9 14 29-2 36-15 7-35 0-37-21Z" />
          <path d="M42 44c8 5 18 3 23-4" />
          <path d="M57 25c8 3 13 8 15 15" />
        </>
      );
    case "liquid":
      return (
        <>
          <path d="M17 50c15-10 22 2 34-7 13-9 26-7 31 6 2 7-6 12-26 12H29c-12 0-17-5-12-11Z" />
          <path d="M34 43c2-8 10-13 19-12" />
          <path d="M53 31 49 22" />
          <path d="M65 34 73 28" />
        </>
      );
    case "sitting":
      return (
        <>
          <path d="M34 58c-3-18 2-35 17-35s21 17 17 35" />
          <path d="M39 25 33 14" />
          <path d="M61 25 67 14" />
          <path d="M35 58h34" />
          <path d="M68 54c8-5 8-15 2-21" />
        </>
      );
    case "tail-up":
      return (
        <>
          <path d="M25 54c7-14 25-18 39-9" />
          <path d="M31 54h28" />
          <path d="M62 43c8-12 5-26-5-33" />
          <path d="M30 43 24 34" />
          <path d="M42 41 48 31" />
        </>
      );
    case "weird-sleep":
      return (
        <>
          <path d="M22 46c11-16 30-12 43-7 11 4 16 13 7 20-10 8-34 3-48-3" />
          <path d="M30 41 20 33" />
          <path d="M55 39 65 28" />
          <path d="M45 55c6-4 8-10 6-17" />
        </>
      );
    case "hidden-paws":
      return (
        <>
          <path d="M27 47c0-16 11-27 24-27s23 11 23 27c0 11-9 16-24 16s-23-5-23-16Z" />
          <path d="M39 22 34 14" />
          <path d="M61 22 66 14" />
          <path d="M39 51h22" />
        </>
      );
    case "in-box":
      return (
        <>
          <path d="M21 36h54l-6 25H27l-6-25Z" />
          <path d="M31 36c3-12 12-18 23-14 9 3 14 8 14 14" />
          <path d="M42 24 36 16" />
          <path d="M58 25 65 18" />
        </>
      );
    case "by-window":
      return (
        <>
          <path d="M15 14h66v45H15z" />
          <path d="M48 14v45" />
          <path d="M15 37h66" />
          <path d="M30 56c2-13 9-20 18-20s14 7 16 20" />
        </>
      );
    case "sunbathing":
      return (
        <>
          <circle cx="25" cy="19" r="7" />
          <path d="M25 5v5M25 28v5M11 19h5M34 19h5" />
          <path d="M37 52c8-15 29-16 41-3" />
          <path d="M41 52h34" />
        </>
      );
    case "in-futon":
      return (
        <>
          <path d="M18 43c9-13 21-18 35-16 14 2 23 9 25 22" />
          <path d="M16 48c17 10 44 13 66 0" />
          <path d="M32 42c4-8 10-12 18-12" />
          <path d="M43 30 38 22" />
          <path d="M55 30 61 22" />
        </>
      );
    case "cardboard":
      return (
        <>
          <path d="M21 30h54v31H21z" />
          <path d="M21 30 33 18h54L75 30" />
          <path d="M75 30 87 18" />
          <path d="M35 36c4-7 13-9 21-4 5 3 8 7 8 12" />
        </>
      );
    case "waiting-food":
      return (
        <>
          <path d="M15 54h28l-3 9H18l-3-9Z" />
          <path d="M19 54c1-5 5-8 10-8s9 3 10 8" />
          <path d="M54 59c-3-18 2-32 15-32 11 0 17 12 14 32" />
          <path d="M60 29 55 20" />
          <path d="M76 29 82 20" />
        </>
      );
    case "welcome-home":
      return (
        <>
          <path d="M18 12h29v50H18z" />
          <path d="M47 18h18v44" />
          <path d="M36 37h.01" />
          <path d="M56 58c3-12 10-19 19-19 8 0 12 6 13 19" />
          <path d="M75 39V26" />
        </>
      );
    case "blanket-kneading":
      return (
        <>
          <path d="M16 51c15-8 32 8 64-1" />
          <path d="M17 58c15-8 32 8 64-1" />
          <path d="M37 42c2-10 9-16 19-15 9 1 15 7 17 16" />
          <path d="M46 43c0 6-4 8-8 8" />
          <path d="M63 43c0 6 4 8 8 8" />
        </>
      );
    default:
      return group === "scene" ? (
        <>
          <path d="M17 20h62v39H17z" />
          <path d="M31 54c2-12 9-18 18-18s15 6 17 18" />
        </>
      ) : (
        <>
          <path d="M25 49c3-17 15-27 29-25 13 2 21 13 18 28" />
          <path d="M34 26 28 17" />
          <path d="M59 26 66 18" />
          <path d="M31 56h38" />
        </>
      );
  }
}

function groupPhotosBySlot(photos: CollectionPhoto[]) {
  const map = new Map<string, CollectionPhoto[]>();

  photos.forEach((photo) => {
    const current = map.get(photo.slotId) ?? [];
    map.set(photo.slotId, [...current, photo]);
  });

  return map;
}

function buildCollectionProgress(
  groups: CollectionGroup[],
  photosBySlot: Map<string, CollectionPhoto[]>,
) {
  const byGroup = groups.reduce(
    (acc, group) => {
      const collected = group.slots.filter(
        (slot) => (photosBySlot.get(slot.id)?.length ?? 0) > 0,
      ).length;

      acc[group.id] = {
        collected,
        total: group.slots.length,
      };

      return acc;
    },
    {
      pose: { collected: 0, total: 0 },
      scene: { collected: 0, total: 0 },
    } as Record<CollectionGroupId, { collected: number; total: number }>,
  );

  return {
    total: {
      collected: byGroup.pose.collected + byGroup.scene.collected,
      total: byGroup.pose.total + byGroup.scene.total,
    },
    pose: byGroup.pose,
    scene: byGroup.scene,
  };
}

const styles = {
  page: {
    minHeight: "100svh",
    background: "linear-gradient(180deg, #fdfcf9 0%, #f7f5ef 100%)",
    color: "#242522",
  },
  container: {
    width: "min(100%, 480px)",
    margin: "0 auto",
    padding: "18px 14px calc(132px + env(safe-area-inset-bottom))",
  },
  header: {
    marginBottom: "12px",
    padding: "2px 2px 0",
  },
  eyebrow: {
    margin: "0 0 8px",
    color: "#777871",
    fontSize: "13px",
    fontWeight: 600,
    letterSpacing: 0,
  },
  title: {
    margin: "0 0 14px",
    color: "#252622",
    fontSize: "24px",
    lineHeight: 1.25,
    fontWeight: 650,
    letterSpacing: 0,
  },
  progressCard: {
    border: "1px solid rgba(226, 223, 216, 0.58)",
    borderRadius: "24px",
    background:
      "linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(250, 249, 246, 0.74))",
    padding: "14px 15px",
    boxShadow: "0 8px 20px rgba(44, 42, 38, 0.018)",
  },
  progressMain: {
    display: "flex",
    alignItems: "baseline",
    gap: "2px",
    margin: "0 0 9px",
    color: "#2c2d29",
  },
  progressNumber: {
    fontSize: "24px",
    fontWeight: 690,
    lineHeight: 1,
  },
  progressSlash: {
    color: "#6f706a",
    fontSize: "17px",
    fontWeight: 580,
  },
  progressLabel: {
    marginLeft: "4px",
    color: "#555750",
    fontSize: "13px",
    fontWeight: 570,
  },
  progressRows: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  progressPill: {
    display: "inline-flex",
    alignItems: "center",
    border: "1px solid rgba(224, 221, 214, 0.72)",
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.66)",
    color: "#656860",
    fontSize: "12px",
    fontWeight: 570,
    lineHeight: 1,
    padding: "7px 10px",
  },
  section: {
    border: "1px solid rgba(228, 225, 218, 0.58)",
    borderRadius: "26px",
    background: "rgba(255, 255, 255, 0.86)",
    padding: "15px",
    marginBottom: "12px",
    boxShadow: "0 7px 18px rgba(44, 42, 38, 0.016)",
  },
  sectionHeader: {
    marginBottom: "12px",
  },
  sectionTitle: {
    margin: 0,
    color: "#282925",
    fontSize: "18px",
    lineHeight: 1.25,
    fontWeight: 610,
    letterSpacing: 0,
  },
  sectionSubText: {
    margin: "4px 0 0",
    color: "#777871",
    fontSize: "13px",
    fontWeight: 500,
  },
  collectionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
  },
  collectionCard: {
    position: "relative",
    minHeight: "148px",
    border: "1px solid rgba(228, 225, 218, 0.58)",
    borderRadius: "22px",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(247,246,242,0.84) 100%)",
    overflow: "hidden",
    padding: "14px 10px 12px",
    textAlign: "center",
  },
  photoCard: {
    display: "flex",
    alignItems: "flex-end",
    minHeight: "166px",
    padding: "12px",
    textAlign: "left",
  },
  cardPhoto: {
    position: "absolute",
    inset: 0,
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: "saturate(0.9) contrast(0.98) brightness(1.02)",
  },
  cardPhotoFade: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(35,34,31,0.02) 48%, rgba(35,34,31,0.42) 100%)",
  },
  photoCardText: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gap: "6px",
  },
  photoCardLabel: {
    margin: 0,
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 680,
    lineHeight: 1.2,
    textShadow: "0 1px 8px rgba(0,0,0,0.24)",
  },
  photoCount: {
    display: "inline-flex",
    width: "fit-content",
    border: "1px solid rgba(255,255,255,0.58)",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.7)",
    color: "#5c6259",
    fontSize: "11px",
    fontWeight: 620,
    lineHeight: 1,
    padding: "5px 8px",
    backdropFilter: "blur(7px)",
  },
  silhouetteWrap: {
    display: "grid",
    placeItems: "center",
    height: "82px",
    marginBottom: "8px",
    color: "#aaa69b",
  },
  silhouette: {
    width: "92px",
    height: "70px",
  },
  emptySlotLabel: {
    margin: "0 0 5px",
    color: "#343532",
    fontSize: "14px",
    fontWeight: 610,
    lineHeight: 1.3,
  },
  emptySlotText: {
    color: "#908c83",
    fontSize: "11px",
    fontWeight: 520,
  },
  emptyCard: {
    border: "1px solid #e3e0da",
    borderRadius: "26px",
    background: "#ffffff",
    padding: "20px",
  },
  emptyTitle: {
    margin: "0 0 10px",
    color: "#27272a",
    fontSize: "24px",
    lineHeight: 1.25,
    fontWeight: 700,
  },
  emptyText: {
    margin: "0 0 16px",
    color: "#686760",
    fontSize: "14px",
    lineHeight: 1.65,
    fontWeight: 500,
  },
  primaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "44px",
    borderRadius: "999px",
    border: "1px solid #d4d6ce",
    background: "#e8e9e4",
    color: "#3f433d",
    padding: "0 18px",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 650,
  },
} satisfies Record<string, CSSProperties>;
