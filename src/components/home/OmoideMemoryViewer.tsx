"use client";

import type { CSSProperties } from "react";

import type { OmoideMemory } from "../../lib/home/omoideDelivery";
import {
  resolvePhotoFallbackSrcs,
  resolvePhotoSrc,
  resolvePhotoStorageVariant,
} from "../../lib/photoSources";
import { StoredPhotoImage } from "../ui/StoredPhotoImage";

export function OmoideMemoryViewer({
  memory,
  isRevisit = false,
  onStow,
}: {
  memory: OmoideMemory;
  isRevisit?: boolean;
  onStow: () => void;
}) {
  return (
    <div
      data-testid="omoide-memory-viewer"
      style={viewerStyles.backdrop}
      onClick={onStow}
    >
      <section
        style={viewerStyles.card}
        aria-label={memory.title}
        onClick={(event) => event.stopPropagation()}
      >
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
            storageVariant={resolvePhotoStorageVariant(memory.photo, "detail")}
            loading={isRevisit ? "lazy" : "eager"}
            fetchPriority={isRevisit ? "auto" : "high"}
          />
        </div>
        <button
          type="button"
          data-testid="omoide-memory-stow"
          style={viewerStyles.textButton}
          onClick={onStow}
        >
          思い出箱に もどす
        </button>
      </section>
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
  return resolvePhotoSrc(memory.photo, "detail");
}

function getOmoidePhotoFallbackSrcs(memory: OmoideMemory) {
  return resolvePhotoFallbackSrcs(memory.photo);
}

const viewerStyles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 90,
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
    gap: "12px",
    padding: "26px 18px 18px",
    borderRadius: "16px",
    border: "1px solid color-mix(in srgb, var(--line) 68%, transparent)",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--paper-card) 96%, white 4%) 0%, var(--paper) 100%)",
    boxShadow:
      "0 22px 58px -30px color-mix(in srgb, var(--ink) 62%, transparent), 0 0 0 1px color-mix(in srgb, white 44%, transparent) inset",
    color: "var(--ink)",
    transform: "rotate(-1.2deg)",
  },
  title: {
    margin: 0,
    color: "var(--ink)",
    fontFamily: "var(--font-serif)",
    fontSize: "24px",
    fontWeight: 400,
    lineHeight: 1.38,
    letterSpacing: "0",
    textAlign: "center",
  },
  date: {
    margin: "-4px 0 8px",
    color: "var(--ink-soft)",
    fontFamily: "var(--font-display)",
    fontSize: "12px",
    fontWeight: 500,
    letterSpacing: "0",
  },
  photoFrame: {
    width: "min(76vw, 302px)",
    aspectRatio: "1 / 1",
    padding: "8px",
    borderRadius: "14px",
    background: "color-mix(in srgb, white 88%, var(--paper-card) 12%)",
    boxShadow:
      "0 10px 24px -18px color-mix(in srgb, var(--ink) 40%, transparent), 0 0 0 1px color-mix(in srgb, var(--line) 34%, transparent)",
    transform: "rotate(0.7deg)",
  },
  photo: {
    width: "100%",
    height: "100%",
    borderRadius: "10px",
    objectFit: "cover",
    background: "var(--paper-card)",
  },
  textButton: {
    minHeight: "36px",
    marginTop: "4px",
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
