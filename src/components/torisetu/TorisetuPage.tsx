"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { loadCatProfiles, getActiveCatProfile } from "../../lib/catProfiles";
import type { CatProfile } from "../../components/home/homeInputHelpers";
import { BottomNavigation } from "../navigation/BottomNavigation";

export function TorisetuPage() {
  const [catProfile, setCatProfile] = useState<CatProfile | null>(null);

  useEffect(() => {
    const profiles = loadCatProfiles();
    const active = getActiveCatProfile(profiles);
    setCatProfile(active ?? null);
  }, []);

  const catName = catProfile?.name ?? "むぎ";

  const unlockedCards = [
    {
      id: "personality",
      title: "基本の性格",
      status: "unlocked" as const,
      body: catProfile?.typeTagline ?? "記録が増えると見えてきます",
      tags: [catProfile?.typeLabel ?? ""].filter(Boolean),
    },
  ];

  const lockedCards = [
    {
      id: "mood",
      title: "機嫌の見分け方",
      status: "locked" as const,
      remaining: 8,
      preview: "「3つのサイン」が見えてきます",
      progress: 0,
    },
    {
      id: "play",
      title: "遊び方のコツ",
      status: "locked" as const,
      remaining: 15,
      preview: "「一番喜ぶ遊び方」が分かってきます",
      progress: 0,
    },
    {
      id: "food",
      title: "ごはんのこと",
      status: "locked" as const,
      remaining: 20,
      preview: "「ごはんへの関心」が見えてきます",
      progress: 0,
    },
    {
      id: "stress",
      title: "ストレスのサイン",
      status: "locked" as const,
      remaining: 25,
      preview: "「不安なときのサイン」が分かってきます",
      progress: 0,
    },
    {
      id: "bond",
      title: "距離の縮め方",
      status: "locked" as const,
      remaining: 30,
      preview: "「もっと仲良くなるコツ」が見えてきます",
      progress: 0,
    },
  ];

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>{catName}のトリセツ</h1>
          <p style={styles.subtitle}>記録が増えると解放されます</p>
        </div>

        <div style={styles.progressCard}>
          <div style={styles.progressHeader}>
            <span style={styles.progressLabel}>理解度</span>
            <span style={styles.progressValue}>20%</span>
          </div>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: "20%" }} />
          </div>
          <p style={styles.progressHint}>
            あと6回記録すると「機嫌の見分け方」が見えてきます
          </p>
        </div>

        {unlockedCards.map((card) => (
          <div key={card.id} style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.cardTitle}>{card.title}</span>
              <span style={styles.badgeUnlocked}>解放済み</span>
            </div>
            <p style={styles.cardBody}>{card.body}</p>
            {card.tags.length > 0 ? (
              <div style={styles.tagRow}>
                {card.tags.map((tag) => (
                  <span key={tag} style={styles.tag}>
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}

        {lockedCards.map((card, index) => (
          <div
            key={card.id}
            style={{
              ...styles.card,
              ...styles.cardLocked,
              opacity: Math.max(0.4, 0.85 - index * 0.1),
            }}
          >
            <div style={styles.cardHeader}>
              <span style={styles.cardTitleLocked}>🔒 {card.title}</span>
              <span style={styles.badgeLocked}>あと{card.remaining}回</span>
            </div>
            <p style={styles.cardPreview}>{card.preview}</p>
            <div style={styles.progressTrack}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${card.progress}%`,
                }}
              />
            </div>
          </div>
        ))}

        <div style={{ height: "100px" }} />
      </div>
      <BottomNavigation active="torisetu" />
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #fdfcf9 0%, #f7f5ef 100%)",
    color: "#242522",
  },
  container: {
    width: "min(100%, 430px)",
    margin: "0 auto",
    padding: "0 16px",
  },
  header: {
    padding: "20px 0 12px",
  },
  title: {
    fontSize: "22px",
    fontWeight: 700,
    color: "#2a2a28",
    margin: "0 0 3px",
  },
  subtitle: {
    fontSize: "12px",
    color: "#9a9890",
    margin: 0,
  },
  progressCard: {
    background: "#fff",
    border: "0.5px solid #e5e2dc",
    borderRadius: "16px",
    padding: "14px 16px",
    marginBottom: "12px",
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "6px",
  },
  progressLabel: {
    fontSize: "12px",
    color: "#9a9890",
    fontWeight: 600,
  },
  progressValue: {
    fontSize: "14px",
    color: "#2a2a28",
    fontWeight: 700,
  },
  progressTrack: {
    height: "4px",
    background: "#f0ede8",
    borderRadius: "99px",
    overflow: "hidden",
    marginBottom: "8px",
  },
  progressFill: {
    height: "100%",
    background: "#6B9E82",
    borderRadius: "99px",
    transition: "width 0.3s ease",
  },
  progressHint: {
    fontSize: "11px",
    color: "#6B9E82",
    margin: 0,
  },
  card: {
    background: "#fff",
    border: "0.5px solid #e5e2dc",
    borderRadius: "16px",
    padding: "14px 16px",
    marginBottom: "8px",
  },
  cardLocked: {
    background: "#f9f8f5",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "6px",
  },
  cardTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#2a2a28",
  },
  cardTitleLocked: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#b0ada6",
  },
  cardBody: {
    fontSize: "13px",
    color: "#4a4a42",
    lineHeight: "1.7",
    margin: 0,
  },
  cardPreview: {
    fontSize: "12px",
    color: "#c0bdb6",
    fontStyle: "italic",
    lineHeight: "1.5",
    margin: "0 0 6px",
  },
  tagRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "6px",
    marginTop: "8px",
  },
  tag: {
    background: "rgba(107,158,130,0.1)",
    border: "0.5px solid rgba(107,158,130,0.3)",
    borderRadius: "99px",
    color: "#3d6650",
    fontSize: "11px",
    padding: "3px 9px",
  },
  badgeUnlocked: {
    background: "#e8f4ee",
    border: "0.5px solid #a8d4bc",
    borderRadius: "99px",
    color: "#3d6650",
    fontSize: "10px",
    padding: "2px 8px",
    flexShrink: 0,
  },
  badgeLocked: {
    background: "#f5f3ef",
    border: "0.5px solid #e0ddd6",
    borderRadius: "99px",
    color: "#9a9890",
    fontSize: "10px",
    padding: "2px 8px",
    flexShrink: 0,
  },
} satisfies Record<string, CSSProperties>;
