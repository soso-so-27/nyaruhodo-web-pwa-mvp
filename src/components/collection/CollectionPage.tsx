"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  POSE_CATEGORIES,
  buildDiscoveredPoseSlugs,
  getPoseCategoryForEvent,
} from "../../lib/collection/poses";
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
  const recentFoundItems = buildRecentFoundItems(recentActiveCatEvents);
  const recentSummary = buildRecentSummary(recentActiveCatEvents, catName);
  const discoveredPoseSlugs = useMemo(
    () => buildDiscoveredPoseSlugs(activeCatEvents),
    [activeCatEvents],
  );
  const discoveredPoseCount = discoveredPoseSlugs.size;

  if (!hasLoaded) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <section style={styles.emptyCard}>
            <h1 style={styles.emptyTitle}>コレクションを準備しています</h1>
            <p style={styles.emptyText}>
              みつけたことを、少しだけ整えています。
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
              ねこページで登録すると、みつけたことも少しずつ増えていきます。
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
          <p style={styles.eyebrow}>コレクション</p>
          <h1 style={styles.title}>コレクション</h1>
          <p style={styles.lead}>{catName}との“みつけた”を集める</p>
        </header>

        <section style={styles.card} aria-labelledby="recent-found">
          <div style={styles.sectionHeader}>
            <h2 id="recent-found" style={styles.sectionTitle}>
              最近みつけた
            </h2>
          </div>
          {recentFoundItems.length > 0 ? (
            <div style={styles.recentGrid}>
              {recentFoundItems.map((item) => (
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
                今日みつけた様子が、ここにたまります。
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
              <p style={styles.sectionSubText}>
                {discoveredPoseCount > 0
                  ? `${discoveredPoseCount}つみつけた`
                  : "これからみつけるポーズ"}
              </p>
            </div>
          </div>
          <div style={styles.poseGrid}>
            {POSE_CATEGORIES.map((pose) => {
              const isDiscovered = discoveredPoseSlugs.has(pose.slug);

              return (
                <article
                  key={pose.slug}
                  style={isDiscovered ? styles.poseCardFound : styles.poseCard}
                >
                  <span
                    style={isDiscovered ? styles.poseMarkFound : styles.poseMark}
                    aria-hidden="true"
                  >
                    {pose.label.slice(0, 1)}
                  </span>
                  <p style={styles.poseLabel}>{pose.label}</p>
                  <span
                    style={
                      isDiscovered ? styles.poseFoundBadge : styles.posePendingText
                    }
                  >
                    {isDiscovered ? "みつけた" : "まだこれから"}
                  </span>
                </article>
              );
            })}
          </div>
        </section>

        <section style={styles.card} aria-labelledby="recent-summary">
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

function buildRecentFoundItems(events: RecentEvent[]) {
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
      note: "今日見えたことを残すと、ここに少しずつ出てきます",
    };
  }

  const poseCounts = new Map<
    string,
    { label: string; slug: string; count: number }
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
    return {
      text: `「${sorted[0].label}」「${sorted[1].label}」が少し多めです`,
      note: "いろいろな様子が、少しずつたまっています",
    };
  }

  if (sorted[0].slug === "low_energy") {
    return {
      text: "「休む」も残っています",
      note: "いつもの様子と一緒に、やさしく見ていけます",
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
    background: "#f3eee7",
    color: "#27272a",
  },
  container: {
    width: "min(100%, 480px)",
    margin: "0 auto",
    padding: "16px 14px calc(154px + env(safe-area-inset-bottom))",
  },
  hero: {
    border: "1px solid #eadfce",
    borderRadius: "28px",
    background:
      "linear-gradient(145deg, rgba(255, 252, 247, 0.98), rgba(255, 245, 231, 0.92))",
    padding: "20px 18px",
    marginBottom: "14px",
  },
  eyebrow: {
    margin: "0 0 5px",
    color: "#8a7b6b",
    fontSize: "13px",
    fontWeight: 800,
    letterSpacing: 0,
  },
  title: {
    margin: "0 0 8px",
    color: "#27272a",
    fontSize: "34px",
    lineHeight: 1.05,
    fontWeight: 900,
    letterSpacing: 0,
  },
  lead: {
    margin: 0,
    color: "#6f665c",
    fontSize: "14px",
    lineHeight: 1.65,
    fontWeight: 700,
  },
  card: {
    border: "1px solid #e7ded4",
    borderRadius: "26px",
    background: "#ffffff",
    padding: "16px",
    marginBottom: "14px",
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
    color: "#2f2b28",
    fontSize: "20px",
    lineHeight: 1.25,
    fontWeight: 900,
    letterSpacing: 0,
  },
  sectionSubText: {
    margin: "4px 0 0",
    color: "#8a7b6b",
    fontSize: "13px",
    fontWeight: 800,
  },
  recentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "10px",
  },
  recentItem: {
    display: "grid",
    justifyItems: "center",
    gap: "4px",
    border: "1px solid #efdcca",
    borderRadius: "20px",
    background: "#fff7ed",
    padding: "10px 7px",
    textAlign: "center",
  },
  recentMark: {
    display: "grid",
    placeItems: "center",
    width: "36px",
    height: "36px",
    borderRadius: "14px",
    background: "#fffdf8",
    color: "#9a6a3f",
    fontSize: "15px",
    fontWeight: 900,
  },
  recentLabel: {
    color: "#2f2b28",
    fontSize: "13px",
    fontWeight: 900,
    lineHeight: 1.35,
  },
  recentDate: {
    color: "#a09082",
    fontSize: "11px",
    fontWeight: 800,
  },
  softEmpty: {
    borderRadius: "20px",
    background: "#fbf7f1",
    padding: "14px",
  },
  softEmptyTitle: {
    margin: "0 0 4px",
    color: "#2f2b28",
    fontSize: "15px",
    fontWeight: 900,
  },
  softEmptyText: {
    margin: 0,
    color: "#6f665c",
    fontSize: "13px",
    lineHeight: 1.6,
    fontWeight: 700,
  },
  poseGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "9px",
  },
  poseCard: {
    minHeight: "88px",
    border: "1px solid #eee4da",
    borderRadius: "18px",
    background: "#fbfaf8",
    padding: "10px 6px",
    textAlign: "center",
  },
  poseCardFound: {
    minHeight: "88px",
    border: "1px solid #ead2bd",
    borderRadius: "18px",
    background: "#fff7ed",
    padding: "10px 6px",
    textAlign: "center",
  },
  poseMark: {
    display: "grid",
    placeItems: "center",
    width: "34px",
    height: "34px",
    margin: "0 auto 7px",
    borderRadius: "13px",
    background: "#f4eee8",
    color: "#9a8e82",
    fontSize: "14px",
    fontWeight: 900,
  },
  poseMarkFound: {
    display: "grid",
    placeItems: "center",
    width: "34px",
    height: "34px",
    margin: "0 auto 7px",
    borderRadius: "13px",
    background: "#fffdf8",
    color: "#8b5a35",
    fontSize: "14px",
    fontWeight: 900,
  },
  poseLabel: {
    margin: 0,
    color: "#2f2b28",
    fontSize: "12px",
    fontWeight: 900,
    lineHeight: 1.35,
  },
  poseFoundBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: "6px",
    borderRadius: "999px",
    background: "#6b5746",
    color: "#ffffff",
    padding: "3px 8px",
    fontSize: "10px",
    fontWeight: 900,
    lineHeight: 1,
  },
  posePendingText: {
    display: "inline-flex",
    marginTop: "6px",
    color: "#a09082",
    fontSize: "10px",
    fontWeight: 800,
    lineHeight: 1,
  },
  summaryText: {
    margin: "12px 0 8px",
    color: "#4f463f",
    fontSize: "15px",
    lineHeight: 1.65,
    fontWeight: 800,
  },
  summaryMeta: {
    margin: 0,
    color: "#9a8e82",
    fontSize: "12px",
    fontWeight: 800,
  },
  emptyCard: {
    border: "1px solid #e7ded4",
    borderRadius: "26px",
    background: "#ffffff",
    padding: "20px",
  },
  emptyTitle: {
    margin: "0 0 10px",
    color: "#27272a",
    fontSize: "24px",
    lineHeight: 1.25,
    fontWeight: 900,
  },
  emptyText: {
    margin: "0 0 16px",
    color: "#6f665c",
    fontSize: "14px",
    lineHeight: 1.65,
    fontWeight: 700,
  },
  primaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "44px",
    borderRadius: "999px",
    background: "#6b5746",
    color: "#ffffff",
    padding: "0 18px",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 900,
  },
} satisfies Record<string, CSSProperties>;
