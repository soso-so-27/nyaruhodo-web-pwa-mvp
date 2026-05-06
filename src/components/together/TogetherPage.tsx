"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { RecentEvent } from "../../lib/supabase/queries";
import { BottomNavigation } from "../navigation/BottomNavigation";
import {
  getActiveCatProfile,
  getCatAvatarSrcForCoat,
  getCatName,
  readActiveCatId,
  readCatProfiles,
  saveActiveCatId,
} from "../home/homeInputHelpers";
import type { CatCoat, CatProfile } from "../home/homeInputHelpers";

type TogetherPageProps = {
  recentEvents: RecentEvent[];
};

type PoseCategory = {
  label: string;
  slug: string;
  group: string;
  found: boolean;
};

type RecentDiscovery = {
  label: string;
  date: string;
};

type TimelineItem = {
  date: string;
  text: string;
};

const RECENT_DISCOVERIES: RecentDiscovery[] = [
  { label: "へそ天", date: "5/10" },
  { label: "箱入り", date: "5/22" },
  { label: "のびー", date: "6/03" },
];

const POSE_CATEGORIES: PoseCategory[] = [
  { label: "へそ天", slug: "belly_up", group: "くつろぎ", found: true },
  { label: "ごめん寝", slug: "face_down_sleep", group: "ねむい", found: false },
  { label: "香箱座り", slug: "loaf", group: "くつろぎ", found: false },
  { label: "箱入り", slug: "in_box", group: "場所", found: true },
  { label: "液体化", slug: "liquid_cat", group: "場所", found: false },
  { label: "のびー", slug: "stretch", group: "あそび", found: true },
  { label: "窓辺監視", slug: "window_watch", group: "場所", found: false },
  { label: "ふみふみ", slug: "kneading", group: "あそび", found: false },
  { label: "おててないない", slug: "hidden_paws", group: "くつろぎ", found: false },
  { label: "顔だけ出す", slug: "peek_face", group: "ねむい", found: false },
  { label: "まるまり", slug: "curled_up", group: "くつろぎ", found: false },
  { label: "すりすり", slug: "rubbing", group: "あそび", found: false },
];

const TIMELINE_ITEMS: TimelineItem[] = [
  { date: "5/10", text: "初めてのへそ天" },
  { date: "5/22", text: "箱入りをみつけました" },
  { date: "6/03", text: "のびーが増えてきました" },
];

const FOUND_POSE_COUNT = POSE_CATEGORIES.filter((pose) => pose.found).length;

export function TogetherPage({ recentEvents }: TogetherPageProps) {
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
  const catCoat = activeCatProfile?.appearance?.coat;
  const catAvatarSrc = getCatAvatarSrcForCoat(catCoat);
  const catAvatarStyle = getCatCoatAvatarStyle(catCoat);
  const hasActiveCat = Boolean(activeCatProfile);
  const activeCatEvents = useMemo(
    () =>
      activeCatId
        ? recentEvents.filter((event) => event.local_cat_id === activeCatId)
        : [],
    [recentEvents, activeCatId],
  );

  if (!hasLoaded) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <section style={styles.emptyCard}>
            <h1 style={styles.emptyTitle}>いっしょを準備しています</h1>
            <p style={styles.emptyText}>
              この子との発見を、少しだけ整えています。
            </p>
          </section>
        </div>
        <BottomNavigation active="together" />
      </main>
    );
  }

  if (!hasActiveCat) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <section style={styles.emptyCard}>
            <h1 style={styles.emptyTitle}>一緒に暮らしている子を登録しましょう</h1>
            <p style={styles.emptyText}>
              ねこページで登録すると、みつけたことや思い出も少しずつ増えていきます。
            </p>
            <a href="/cats" style={styles.primaryLink}>
              ねこを登録する
            </a>
          </section>
        </div>
        <BottomNavigation active="together" />
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.hero}>
          <div style={styles.heroTop}>
            <div style={{ ...styles.avatarFrame, ...catAvatarStyle }}>
              <img
                src={catAvatarSrc}
                alt={`${catName}のアイコン`}
                style={styles.avatarImage}
                onError={(event) => {
                  event.currentTarget.src = "/icons/cat-avatars/neutral.png";
                }}
              />
            </div>
            <div style={styles.heroCopy}>
              <p style={styles.eyebrow}>いっしょ</p>
              <h1 style={styles.title}>いっしょ</h1>
              <p style={styles.lead}>
                みつけたことや思い出が、ここにたまります。
              </p>
            </div>
          </div>
          <p style={styles.heroNote}>
            {activeCatEvents.length > 0
              ? `${catName}との最近の記録も、あとで思い出にできます。`
              : `${catName}との発見は、これから少しずつ増えていきます。`}
          </p>
        </header>

        <section style={styles.discoverySection} aria-labelledby="recent-found">
          <div style={styles.sectionHeader}>
            <h2 id="recent-found" style={styles.sectionTitle}>
              最近みつけた
            </h2>
          </div>
          <div style={styles.discoveryRow}>
            {RECENT_DISCOVERIES.map((item) => (
              <article key={item.label} style={styles.discoveryCard}>
                <div style={styles.discoveryThumb} aria-hidden="true">
                  {getPoseMark(item.label)}
                </div>
                <p style={styles.discoveryLabel}>{item.label}</p>
                <p style={styles.discoveryDate}>{item.date}</p>
              </article>
            ))}
          </div>
        </section>

        <section style={styles.card} aria-labelledby="pose-zukan">
          <div style={styles.sectionHeader}>
            <div>
              <h2 id="pose-zukan" style={styles.sectionTitle}>
                ポーズ図鑑
              </h2>
              <p style={styles.sectionSubText}>{FOUND_POSE_COUNT}つみつけた</p>
            </div>
          </div>
          <div style={styles.poseGrid}>
            {POSE_CATEGORIES.map((pose) => (
              <article
                key={pose.slug}
                style={pose.found ? styles.poseCardFound : styles.poseCard}
              >
                <div style={pose.found ? styles.poseIconFound : styles.poseIcon}>
                  {getPoseMark(pose.label)}
                </div>
                <p style={styles.poseLabel}>{pose.label}</p>
                <p style={styles.poseGroup}>{pose.group}</p>
              </article>
            ))}
          </div>
        </section>

        <section style={styles.card} aria-labelledby="cat-likeness">
          <h2 id="cat-likeness" style={styles.sectionTitle}>
            この子らしさ
          </h2>
          <div style={styles.likenessList}>
            <p style={styles.likenessText}>
              {catName}は、箱に入るのが少し好きそうです。
            </p>
            <p style={styles.likenessText}>
              夜は、のびーが見つかることもあります。
            </p>
          </div>
        </section>

        <section style={styles.card} aria-labelledby="memory-timeline">
          <h2 id="memory-timeline" style={styles.sectionTitle}>
            思い出タイムライン
          </h2>
          <div style={styles.timeline}>
            {TIMELINE_ITEMS.map((item) => (
              <article key={`${item.date}-${item.text}`} style={styles.timelineItem}>
                <span style={styles.timelineDate}>{item.date}</span>
                <span style={styles.timelineDot} aria-hidden="true" />
                <p style={styles.timelineText}>{item.text}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
      <BottomNavigation active="together" />
    </main>
  );
}

function getPoseMark(label: string) {
  const marks: Record<string, string> = {
    "へそ天": "へ",
    "ごめん寝": "寝",
    "香箱座り": "香",
    "箱入り": "箱",
    "液体化": "液",
    "のびー": "伸",
    "窓辺監視": "窓",
    "ふみふみ": "ふ",
    "おててないない": "手",
    "顔だけ出す": "顔",
    "まるまり": "丸",
    "すりすり": "す",
  };

  return marks[label] ?? "猫";
}

function getCatCoatAvatarStyle(coat?: CatCoat): CSSProperties {
  const stylesByCoat: Record<CatCoat, CSSProperties> = {
    saba: {
      borderColor: "#d8d2c4",
      background: "linear-gradient(180deg, #fffaf2 0%, #e6ded1 100%)",
    },
    cream: {
      borderColor: "#d8d2c4",
      background: "linear-gradient(180deg, #fffaf2 0%, #e6ded1 100%)",
    },
    gray: {
      borderColor: "#d6d3d1",
      background: "linear-gradient(180deg, #f6f5f3 0%, #e5e2de 100%)",
    },
    orange_tabby: {
      borderColor: "#efc89a",
      background: "linear-gradient(180deg, #fff1dc 0%, #f5c994 100%)",
    },
    black: {
      borderColor: "#57534e",
      background: "linear-gradient(180deg, #e7e2dc 0%, #9b928a 100%)",
    },
    white: {
      borderColor: "#d4d4d8",
      background: "linear-gradient(180deg, #ffffff 0%, #f4f4f5 100%)",
    },
    calico: {
      borderColor: "#ead7bd",
      background:
        "linear-gradient(135deg, #fff9ef 0%, #fff9ef 42%, #f8d7ad 43%, #f8d7ad 66%, #e4ded5 67%, #e4ded5 100%)",
    },
  };

  return coat ? stylesByCoat[coat] : {};
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
    padding: "18px",
    marginBottom: "14px",
  },
  heroTop: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  avatarFrame: {
    flex: "0 0 auto",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "74px",
    height: "74px",
    border: "1.5px solid #eadfce",
    borderRadius: "24px",
    background: "#fffaf4",
    overflow: "hidden",
  },
  avatarImage: {
    display: "block",
    width: "62px",
    height: "62px",
    objectFit: "contain",
  },
  heroCopy: {
    minWidth: 0,
  },
  eyebrow: {
    margin: "0 0 4px",
    color: "#8a7b6b",
    fontSize: "13px",
    fontWeight: 800,
    letterSpacing: 0,
  },
  title: {
    margin: "0 0 6px",
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
  heroNote: {
    margin: "14px 0 0",
    borderRadius: "18px",
    background: "rgba(255, 255, 255, 0.72)",
    padding: "10px 12px",
    color: "#6f665c",
    fontSize: "13px",
    lineHeight: 1.55,
    fontWeight: 700,
  },
  discoverySection: {
    border: "1px solid #eadfce",
    borderRadius: "26px",
    background: "#fffaf4",
    padding: "16px",
    marginBottom: "14px",
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
  discoveryRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "10px",
  },
  discoveryCard: {
    minWidth: 0,
    border: "1px solid #efdcca",
    borderRadius: "20px",
    background: "#fff7ed",
    padding: "10px 8px",
    textAlign: "center",
  },
  discoveryThumb: {
    display: "grid",
    placeItems: "center",
    width: "48px",
    height: "48px",
    margin: "0 auto 8px",
    borderRadius: "18px",
    background: "#fffdf8",
    color: "#9a6a3f",
    fontSize: "18px",
    fontWeight: 900,
  },
  discoveryLabel: {
    margin: 0,
    color: "#2f2b28",
    fontSize: "13px",
    fontWeight: 900,
    lineHeight: 1.35,
  },
  discoveryDate: {
    margin: "3px 0 0",
    color: "#a09082",
    fontSize: "11px",
    fontWeight: 800,
  },
  poseGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "9px",
  },
  poseCard: {
    minHeight: "92px",
    border: "1px solid #eee4da",
    borderRadius: "18px",
    background: "#fbfaf8",
    padding: "10px 6px",
    textAlign: "center",
    opacity: 0.58,
  },
  poseCardFound: {
    minHeight: "92px",
    border: "1px solid #efd7be",
    borderRadius: "18px",
    background: "#fff7ed",
    padding: "10px 6px",
    textAlign: "center",
  },
  poseIcon: {
    display: "grid",
    placeItems: "center",
    width: "36px",
    height: "36px",
    margin: "0 auto 7px",
    borderRadius: "14px",
    background: "#f4eee8",
    color: "#a69a8e",
    fontSize: "14px",
    fontWeight: 900,
  },
  poseIconFound: {
    display: "grid",
    placeItems: "center",
    width: "36px",
    height: "36px",
    margin: "0 auto 7px",
    borderRadius: "14px",
    background: "#fffdf8",
    color: "#9a6a3f",
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
  poseGroup: {
    margin: "3px 0 0",
    color: "#9a8e82",
    fontSize: "10px",
    fontWeight: 800,
    lineHeight: 1.25,
  },
  likenessList: {
    display: "grid",
    gap: "8px",
  },
  likenessText: {
    margin: 0,
    borderRadius: "18px",
    background: "#fbf7f1",
    padding: "11px 12px",
    color: "#4f463f",
    fontSize: "14px",
    lineHeight: 1.6,
    fontWeight: 800,
  },
  timeline: {
    display: "grid",
    gap: "10px",
  },
  timelineItem: {
    display: "grid",
    gridTemplateColumns: "48px 12px 1fr",
    alignItems: "center",
    gap: "8px",
  },
  timelineDate: {
    color: "#8a7b6b",
    fontSize: "12px",
    fontWeight: 900,
  },
  timelineDot: {
    width: "9px",
    height: "9px",
    borderRadius: "999px",
    background: "#d99b65",
  },
  timelineText: {
    margin: 0,
    borderRadius: "16px",
    background: "#fbf7f1",
    padding: "10px 12px",
    color: "#4f463f",
    fontSize: "13px",
    lineHeight: 1.5,
    fontWeight: 800,
  },
  emptyCard: {
    border: "1px solid #eadfce",
    borderRadius: "28px",
    background: "#fffaf4",
    padding: "22px",
    marginTop: "24px",
  },
  emptyTitle: {
    margin: "0 0 8px",
    color: "#27272a",
    fontSize: "24px",
    lineHeight: 1.3,
    fontWeight: 900,
  },
  emptyText: {
    margin: "0 0 16px",
    color: "#6f665c",
    fontSize: "14px",
    lineHeight: 1.7,
    fontWeight: 700,
  },
  primaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "44px",
    borderRadius: "999px",
    background: "#3f3d46",
    color: "#ffffff",
    padding: "0 18px",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 900,
  },
} satisfies Record<string, CSSProperties>;
