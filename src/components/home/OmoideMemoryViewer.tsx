"use client";

import type { CSSProperties } from "react";

import type { OmoideMemory } from "../../lib/home/omoideDelivery";
import { StoredPhotoImage } from "../ui/StoredPhotoImage";

export function OmoideMemoryViewer({
  memory,
  alreadyRecordedToday,
  isRevisit = false,
  onStow,
  onCue,
}: {
  memory: OmoideMemory;
  alreadyRecordedToday: boolean;
  isRevisit?: boolean;
  onStow: () => void;
  onCue: () => void;
}) {
  const duration = isRevisit ? "600ms" : "1350ms";

  return (
    <div
      data-testid="omoide-memory-viewer"
      style={viewerStyles.backdrop}
      onClick={onStow}
    >
      <section
        style={
          {
            ...viewerStyles.card,
            "--omoide-develop-duration": duration,
          } as CSSProperties
        }
        aria-label="思い出が、とどきました"
        onClick={(event) => event.stopPropagation()}
      >
        <p style={viewerStyles.kicker}>
          <span style={viewerStyles.kickerLine} aria-hidden="true" />
          <span>思い出が、とどきました</span>
          <span style={viewerStyles.kickerLine} aria-hidden="true" />
        </p>
        <h2 style={viewerStyles.title}>{memory.title}</h2>
        <p data-testid="omoide-memory-date" style={viewerStyles.date}>
          {formatOmoideSourceDate(memory.sourceDateKey)}
        </p>
        <div style={viewerStyles.photoFrame}>
          <StoredPhotoImage
            src={getOmoidePhotoDetailSrc(memory)}
            fallbackSrcs={getOmoidePhotoFallbackSrcs(memory)}
            alt=""
            style={viewerStyles.photo}
          />
        </div>
        <p style={viewerStyles.voice}>{memory.voice}</p>
        <p style={viewerStyles.bridge}>{memory.bridge}</p>
        <p style={viewerStyles.question}>
          きょうの {memory.catName}は、どんな ねがお？
        </p>
        <button
          type="button"
          data-testid="omoide-memory-cue"
          style={viewerStyles.primaryButton}
          onClick={onCue}
        >
          {alreadyRecordedToday
            ? `きょうの ${memory.catName}を みる`
            : `いまの ${memory.catName}を のこす`}
        </button>
        <button
          type="button"
          data-testid="omoide-memory-stow"
          style={viewerStyles.textButton}
          onClick={onStow}
        >
          文箱に しまう
        </button>
      </section>
      <style>{`
        [data-testid="omoide-memory-viewer"] img {
          animation: omoideDevelop var(--omoide-develop-duration) cubic-bezier(0, 0, 0.2, 1) both;
        }
        @keyframes omoideDevelop {
          from { opacity: 0; filter: blur(14px); transform: scale(0.985); }
          to { opacity: 1; filter: blur(0); transform: scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-testid="omoide-memory-viewer"] img {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

export function formatOmoideSourceDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) {
    return dateKey;
  }

  const weekday = ["日", "月", "火", "水", "木", "金", "土"][
    new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  ];
  return `${year}年${month}月${day}日 ・ ${weekday}よう日`;
}

function getOmoidePhotoDetailSrc(memory: OmoideMemory) {
  return (
    memory.photo.displaySrc ??
    memory.photo.originalSrc ??
    memory.photo.thumbnailSrc ??
    memory.photo.src
  );
}

function getOmoidePhotoFallbackSrcs(memory: OmoideMemory) {
  const src = getOmoidePhotoDetailSrc(memory);
  return [
    memory.photo.displaySrc,
    memory.photo.thumbnailSrc,
    memory.photo.originalSrc,
    memory.photo.src,
  ].filter((value): value is string => Boolean(value && value !== src));
}

const viewerStyles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 60,
    display: "grid",
    placeItems: "center",
    padding:
      "calc(22px + env(safe-area-inset-top)) 18px calc(22px + env(safe-area-inset-bottom))",
    background: "color-mix(in srgb, var(--ink) 78%, transparent)",
  },
  card: {
    width: "min(100%, 390px)",
    maxHeight: "100%",
    overflowY: "auto",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    padding: "24px 18px 18px",
    borderRadius: "16px",
    border: "1px solid color-mix(in srgb, var(--line) 68%, transparent)",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--paper-card) 96%, white 4%) 0%, var(--paper) 100%)",
    boxShadow:
      "0 22px 58px -30px color-mix(in srgb, var(--ink) 62%, transparent), 0 0 0 1px color-mix(in srgb, white 44%, transparent) inset",
    color: "var(--ink)",
    transform: "rotate(-1.2deg)",
  },
  kicker: {
    width: "100%",
    margin: "0 0 2px",
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: "10px",
    color: "var(--ink-soft)",
    fontFamily: "var(--font-display)",
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "var(--tracking-label)",
    textAlign: "center",
  },
  kickerLine: {
    height: "1px",
    background: "color-mix(in srgb, var(--line) 72%, transparent)",
  },
  title: {
    margin: 0,
    color: "var(--ink)",
    fontFamily: "var(--font-serif)",
    fontSize: "23px",
    fontWeight: 400,
    lineHeight: 1.38,
    letterSpacing: "0",
    textAlign: "center",
  },
  date: {
    margin: "0 0 6px",
    color: "var(--ink-soft)",
    fontFamily: "var(--font-serif)",
    fontSize: "12px",
    fontWeight: 400,
    letterSpacing: "0",
  },
  photoFrame: {
    width: "min(72vw, 282px)",
    aspectRatio: "1 / 1",
    padding: "8px",
    borderRadius: "14px",
    background: "color-mix(in srgb, white 88%, var(--paper-card) 12%)",
    boxShadow:
      "0 10px 24px -18px color-mix(in srgb, var(--ink) 40%, transparent), 0 0 0 1px color-mix(in srgb, var(--line) 34%, transparent)",
  },
  photo: {
    width: "100%",
    height: "100%",
    borderRadius: "10px",
    objectFit: "cover",
    background: "var(--paper-card)",
  },
  voice: {
    margin: "12px 0 0",
    color: "var(--ink)",
    fontFamily: "var(--font-serif)",
    fontSize: "15px",
    fontWeight: 400,
    lineHeight: 1.7,
    letterSpacing: "0",
    textAlign: "center",
  },
  bridge: {
    margin: 0,
    color: "var(--ink-soft)",
    fontFamily: "var(--font-serif)",
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.6,
    letterSpacing: "0",
    textAlign: "center",
  },
  question: {
    margin: "2px 0 0",
    color: "var(--ink-soft)",
    fontFamily: "var(--font-display)",
    fontSize: "13px",
    lineHeight: 1.6,
    letterSpacing: "var(--tracking-body)",
    textAlign: "center",
  },
  primaryButton: {
    width: "min(100%, 300px)",
    minHeight: "46px",
    marginTop: "6px",
    padding: "0 18px",
    border: "1px solid color-mix(in srgb, var(--seal) 82%, transparent)",
    borderRadius: "999px",
    background: "var(--seal)",
    color: "white",
    fontFamily: "var(--font-display)",
    fontSize: "14px",
    fontWeight: 500,
    letterSpacing: "var(--tracking-label)",
    cursor: "pointer",
    boxShadow: "0 10px 22px -18px color-mix(in srgb, var(--seal) 78%, transparent)",
  },
  textButton: {
    minHeight: "34px",
    padding: "0 4px",
    border: "none",
    background: "transparent",
    color: "var(--ink-soft)",
    fontFamily: "var(--font-display)",
    fontSize: "13px",
    fontWeight: 500,
    letterSpacing: "var(--tracking-body)",
    textDecoration: "underline",
    textUnderlineOffset: "4px",
    cursor: "pointer",
  },
} satisfies Record<string, CSSProperties>;
