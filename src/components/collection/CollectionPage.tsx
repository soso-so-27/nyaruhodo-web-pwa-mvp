"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  PHOTO_COLLECTION_POSES,
  getPoseCategoryForEvent,
  isConcernPose,
  isSocialPose,
} from "../../lib/collection/poses";
import type { PoseTone } from "../../lib/collection/poses";
import type { RecentEvent } from "../../lib/supabase/queries";
import {
  getActiveCatProfile,
  getCatName,
  readActiveCatId,
  readCatProfiles,
  saveActiveCatId,
} from "../home/homeInputHelpers";
import type { CatProfile } from "../home/homeInputHelpers";
import { BottomNavigation } from "../navigation/BottomNavigation";

type CollectionPageProps = {
  recentEvents: RecentEvent[];
};

const RECENT_DAYS = 7;
const SAMPLE_COLLECTION_HERO_PHOTO_SRC = "/sample-cats/pose-stretch.png";
const PHOTO_POSE_IMAGE_BY_SLUG: Record<string, string> = {
  belly_up: "/sample-cats/pose-belly.png",
  in_box: "/sample-cats/pose-box.png",
  stretch: "/sample-cats/pose-stretch.png",
  loaf: "/sample-cats/pose-loaf.png",
};

export function CollectionPage({ recentEvents }: CollectionPageProps) {
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
  const activeCatEvents = useMemo(
    () =>
      activeCatId
        ? recentEvents.filter((event) => event.local_cat_id === activeCatId)
        : [],
    [recentEvents, activeCatId],
  );
  const recentActiveCatEvents = useMemo(
    () => filterRecentEvents(activeCatEvents, RECENT_DAYS),
    [activeCatEvents],
  );
  const recentRecordItems = buildRecentRecordItems(recentActiveCatEvents);
  const recentSummary = buildRecentSummary(recentActiveCatEvents, catName);
  if (!hasLoaded) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <section style={styles.emptyCard}>
            <h1 style={styles.emptyTitle}>コレクションを準備しています</h1>
            <p style={styles.emptyText}>
              写真や記録を、少しだけ整えています。
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
              ねこページで登録すると、記録も少しずつ増えていきます。
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
        <header style={styles.hero}>
          <div style={styles.heroPhotoFrame} aria-hidden="true">
            <img
              src={SAMPLE_COLLECTION_HERO_PHOTO_SRC}
              alt=""
              style={styles.heroPhoto}
            />
            <div style={styles.heroPhotoOverlay}>
              <span style={styles.heroPhotoLabel}>写真が入る棚</span>
            </div>
          </div>
        </header>

        <section style={styles.card} aria-labelledby="recent-records">
          <div style={styles.sectionHeader}>
            <div>
              <h2 id="recent-records" style={styles.sectionTitle}>
                最近見た
              </h2>
              <p style={styles.sectionSubText}>最近の記録から</p>
            </div>
          </div>
          {recentRecordItems.length > 0 ? (
            <div style={styles.recentGrid}>
              {recentRecordItems.map((item) => (
                <article key={`${item.label}-${item.date}`} style={styles.recentItem}>
                  <span style={styles.recentMark} aria-hidden="true">
                    {item.label.slice(0, 1)}
                  </span>
                  <span style={styles.recentLabel}>{item.label}</span>
                  <span style={styles.recentDate}>{item.date}</span>
                </article>
              ))}
            </div>
          ) : (
            <div style={styles.softEmpty}>
              <p style={styles.softEmptyTitle}>まだこれから</p>
              <p style={styles.softEmptyText}>
                写真を残すと、ここに並びます。
              </p>
            </div>
          )}
        </section>

        <section style={styles.card} aria-labelledby="pose-collection">
          <div style={styles.sectionHeader}>
            <div>
              <h2 id="pose-collection" style={styles.sectionTitle}>
                ポーズコレクション
              </h2>
              <p style={styles.sectionSubText}>写真はまだこれから</p>
            </div>
          </div>
          <div style={styles.poseGrid}>
            {PHOTO_COLLECTION_POSES.map((pose) => {
              const photoSrc = PHOTO_POSE_IMAGE_BY_SLUG[pose.slug];

              return (
                <article
                  key={pose.slug}
                  style={
                    photoSrc
                      ? { ...styles.poseCard, ...styles.posePhotoCard }
                      : styles.poseCard
                  }
                >
                  {photoSrc ? (
                    <>
                      <img src={photoSrc} alt="" style={styles.posePhoto} />
                      <span style={styles.posePhotoFade} aria-hidden="true" />
                    </>
                  ) : (
                    <span style={styles.poseMark} aria-hidden="true">
                      {pose.label.slice(0, 1)}
                    </span>
                  )}
                  <p style={photoSrc ? styles.posePhotoLabel : styles.poseLabel}>
                    {pose.label}
                  </p>
                  <span
                    style={
                      photoSrc
                        ? styles.posePhotoPendingText
                        : styles.posePendingText
                    }
                  >
                    まだこれから
                  </span>
                </article>
              );
            })}
          </div>
        </section>

        <section style={styles.memoCard} aria-labelledby="recent-summary">
          <h2 id="recent-summary" style={styles.sectionTitle}>
            このごろの{catName}
          </h2>
          <p style={styles.summaryText}>{recentSummary.text}</p>
          <p style={styles.summaryMeta}>
            {recentSummary.note}
          </p>
        </section>
      </div>
      <BottomNavigation active="collection" />
    </main>
  );
}

function filterRecentEvents(events: RecentEvent[], days: number) {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  return events.filter((event) => {
    const timestamp = new Date(event.occurred_at || event.created_at).getTime();

    return Number.isFinite(timestamp) && timestamp >= since;
  });
}

function buildRecentRecordItems(events: RecentEvent[]) {
  const items: Array<{ label: string; date: string; slug: string }> = [];
  const seen = new Set<string>();

  for (const event of events) {
    const pose = getPoseCategoryForEvent(event);

    if (!pose || seen.has(pose.slug)) {
      continue;
    }

    seen.add(pose.slug);
    items.push({
      label: pose.label,
      slug: pose.slug,
      date: formatShortDate(event.occurred_at || event.created_at),
    });

    if (items.length >= 3) {
      break;
    }
  }

  return items;
}

function buildRecentSummary(events: RecentEvent[], catName: string) {
  if (events.length === 0) {
    return {
      text: "まだこれから",
      note: "記録が増えると、ひとことメモになります",
    };
  }

  const poseCounts = new Map<
    string,
    { label: string; slug: string; tone: PoseTone; count: number }
  >();

  events.forEach((event) => {
    const pose = getPoseCategoryForEvent(event);

    if (!pose) {
      return;
    }

    const current = poseCounts.get(pose.slug);

    poseCounts.set(pose.slug, {
      label: pose.label,
      slug: pose.slug,
      tone: pose.tone,
      count: (current?.count ?? 0) + 1,
    });
  });

  const sorted = [...poseCounts.values()].sort((a, b) => b.count - a.count);

  if (sorted.length === 0) {
    return {
      text: "少しずつ、残っています",
      note: `${catName}らしい様子が、ゆっくりたまってきました`,
    };
  }

  if (events.length <= 2) {
    return {
      text: `「${sorted[0].label}」が残っています`,
      note: "もう少し増えると、このごろの様子が見えてきます",
    };
  }

  if (sorted.length > 1 && sorted[0].count === sorted[1].count) {
    if (isConcernPose(sorted[0].slug) || isConcernPose(sorted[1].slug)) {
      return {
        text: `「${sorted[0].label}」と「${sorted[1].label}」が残っています`,
        note: "気になる様子も、見たまま少しずつ残せています",
      };
    }

    if (isSocialPose(sorted[0].slug) || isSocialPose(sorted[1].slug)) {
      return {
        text: `「${sorted[0].label}」と「${sorted[1].label}」が見えてきました`,
        note: `${catName}との関わりも、少しずつ残っています`,
      };
    }

    return {
      text: `「${sorted[0].label}」「${sorted[1].label}」が少し多めです`,
      note: "いろいろな様子が、少しずつたまっています",
    };
  }

  if (isConcernPose(sorted[0].slug)) {
    return {
      text: `「${sorted[0].label}」も残っています`,
      note:
        sorted[0].slug === "low_energy"
          ? "いつもの様子と一緒に、やさしく見ていけます"
          : "気になる様子も、見たまま少しずつ残せています",
    };
  }

  if (isSocialPose(sorted[0].slug)) {
    return {
      text: `「${sorted[0].label}」も見えてきました`,
      note: `${catName}との関わりも、少しずつ残っています`,
    };
  }

  if (sorted[0].count >= 2) {
    return {
      text: `「${sorted[0].label}」をよく見かけます`,
      note: `${catName}のこのごろが、少しずつ見えてきました`,
    };
  }

  return {
    text: "少しずつ、残っています",
    note: `${catName}らしい様子が、ゆっくりたまってきました`,
  };
}

function formatShortDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getMonth() + 1}/${date.getDate()}`;
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
    padding: "16px 14px calc(152px + env(safe-area-inset-bottom))",
  },
  hero: {
    border: "1px solid rgba(226, 223, 216, 0.58)",
    borderRadius: "28px",
    background:
      "linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(250, 249, 246, 0.74))",
    padding: "10px",
    marginBottom: "10px",
    boxShadow: "0 8px 20px rgba(44, 42, 38, 0.018)",
  },
  eyebrow: {
    margin: "0 0 5px",
    color: "#74756e",
    fontSize: "13px",
    fontWeight: 600,
    letterSpacing: 0,
  },
  title: {
    margin: "0 0 8px",
    color: "#252622",
    fontSize: "29px",
    lineHeight: 1.05,
    fontWeight: 660,
    letterSpacing: 0,
  },
  lead: {
    margin: 0,
    color: "#6f706a",
    fontSize: "14px",
    lineHeight: 1.65,
    fontWeight: 500,
  },
  heroPhotoFrame: {
    position: "relative",
    height: "206px",
    border: "1px solid rgba(230, 227, 220, 0.58)",
    borderRadius: "22px",
    background: "#f3f1eb",
    overflow: "hidden",
  },
  heroPhoto: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "48% 48%",
    filter: "saturate(0.9) contrast(0.98) brightness(1.02)",
  },
  heroPhotoOverlay: {
    position: "absolute",
    right: "12px",
    bottom: "12px",
    display: "inline-flex",
    border: "1px solid rgba(255,255,255,0.66)",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.68)",
    padding: "5px 10px",
    backdropFilter: "blur(8px)",
  },
  heroPhotoLabel: {
    color: "#60635c",
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: 1,
  },
  card: {
    border: "1px solid rgba(228, 225, 218, 0.58)",
    borderRadius: "26px",
    background: "rgba(255, 255, 255, 0.86)",
    padding: "15px",
    marginBottom: "12px",
    boxShadow: "0 7px 18px rgba(44, 42, 38, 0.016)",
  },
  memoCard: {
    border: "1px solid rgba(228, 225, 218, 0.58)",
    borderRadius: "24px",
    background: "rgba(255, 255, 255, 0.82)",
    padding: "15px 16px",
    marginBottom: "14px",
    boxShadow: "0 7px 18px rgba(44, 42, 38, 0.014)",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "12px",
  },
  sectionTitle: {
    margin: 0,
    color: "#282925",
    fontSize: "18px",
    lineHeight: 1.25,
    fontWeight: 590,
    letterSpacing: 0,
  },
  sectionSubText: {
    margin: "4px 0 0",
    color: "#777871",
    fontSize: "13px",
    fontWeight: 500,
  },
  recentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
  },
  recentItem: {
    display: "grid",
    justifyItems: "center",
    gap: "3px",
    border: "1px solid rgba(228, 225, 218, 0.56)",
    borderRadius: "22px",
    background: "rgba(255, 255, 255, 0.76)",
    padding: "9px 7px",
    textAlign: "center",
  },
  recentMark: {
    display: "grid",
    placeItems: "center",
    width: "36px",
    height: "36px",
    borderRadius: "14px",
    background: "#f3f2ee",
    color: "#72766f",
    fontSize: "15px",
    fontWeight: 650,
  },
  recentLabel: {
    color: "#2e2f2b",
    fontSize: "13px",
    fontWeight: 580,
    lineHeight: 1.35,
  },
  recentDate: {
    color: "#8c887f",
    fontSize: "11px",
    fontWeight: 500,
  },
  softEmpty: {
    borderRadius: "20px",
    background: "#faf9f5",
    border: "1px solid rgba(232, 229, 222, 0.72)",
    padding: "14px",
  },
  softEmptyTitle: {
    margin: "0 0 4px",
    color: "#2f2b28",
    fontSize: "15px",
    fontWeight: 650,
  },
  softEmptyText: {
    margin: 0,
    color: "#686760",
    fontSize: "13px",
    lineHeight: 1.6,
    fontWeight: 500,
  },
  poseGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
  },
  poseCard: {
    position: "relative",
    minHeight: "104px",
    border: "1px solid rgba(228, 225, 218, 0.52)",
    borderRadius: "18px",
    background: "linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(248,247,243,0.82) 100%)",
    padding: "10px 8px",
    textAlign: "center",
    overflow: "hidden",
  },
  posePhotoCard: {
    minHeight: "158px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "flex-end",
    alignItems: "flex-start",
    padding: "11px",
    textAlign: "left",
  },
  posePhoto: {
    position: "absolute",
    inset: 0,
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: "saturate(0.9) contrast(0.98) brightness(1.02)",
  },
  posePhotoFade: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(35,34,31,0.01) 48%, rgba(35,34,31,0.3) 100%)",
  },
  poseMark: {
    display: "grid",
    placeItems: "center",
    width: "28px",
    height: "28px",
    margin: "0 auto 6px",
    borderRadius: "11px",
    background: "#f4f3ef",
    color: "#777a72",
    fontSize: "12px",
    fontWeight: 650,
  },
  poseLabel: {
    margin: 0,
    color: "#30312d",
    fontSize: "11px",
    fontWeight: 560,
    lineHeight: 1.35,
  },
  posePhotoLabel: {
    position: "relative",
    zIndex: 1,
    margin: 0,
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 650,
    lineHeight: 1.25,
    textShadow: "0 1px 8px rgba(0,0,0,0.24)",
  },
  posePendingText: {
    display: "inline-flex",
    marginTop: "5px",
    color: "#8c887f",
    fontSize: "9px",
    fontWeight: 500,
    lineHeight: 1,
  },
  posePhotoPendingText: {
    position: "relative",
    zIndex: 1,
    display: "inline-flex",
    marginTop: "5px",
    border: "1px solid rgba(255,255,255,0.58)",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.66)",
    color: "#5d625a",
    fontSize: "10px",
    fontWeight: 600,
    lineHeight: 1,
    padding: "4px 7px",
    backdropFilter: "blur(7px)",
  },
  summaryText: {
    margin: "10px 0 7px",
    color: "#4f4d49",
    fontSize: "15px",
    lineHeight: 1.65,
    fontWeight: 550,
  },
  summaryMeta: {
    margin: 0,
    color: "#8c887f",
    fontSize: "12px",
    fontWeight: 500,
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
