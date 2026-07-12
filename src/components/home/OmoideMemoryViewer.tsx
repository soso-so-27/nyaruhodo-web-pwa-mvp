"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

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
  const [photoAspect, setPhotoAspect] = useState(1);
  const pushedHistoryRef = useRef(false);
  const ignoreNextPopRef = useRef(false);
  const requestStowRef = useRef<(syncHistory?: boolean) => void>(() => undefined);

  function requestStow(syncHistory = true) {
    if (syncHistory && pushedHistoryRef.current) {
      ignoreNextPopRef.current = true;
      pushedHistoryRef.current = false;
      window.history.back();
    }
    onStow();
  }
  requestStowRef.current = requestStow;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.history.pushState(
      { neterunekoOmoideViewer: true },
      "",
      window.location.href,
    );
    pushedHistoryRef.current = true;

    function handlePopState() {
      if (ignoreNextPopRef.current) {
        ignoreNextPopRef.current = false;
        return;
      }
      pushedHistoryRef.current = false;
      requestStowRef.current(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        requestStowRef.current();
      }
    }

    window.addEventListener("popstate", handlePopState);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const photoWidth =
    photoAspect < 1
      ? `min(100%, calc(min(58dvh, 560px) * ${photoAspect}))`
      : "100%";

  return (
    <div
      data-testid="omoide-memory-viewer"
      style={viewerStyles.backdrop}
      onClick={() => requestStow()}
    >
      <section
        style={viewerStyles.stage}
        aria-label={memory.title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 style={viewerStyles.title}>{memory.title}</h2>
        <div
          data-testid="omoide-memory-photo-frame"
          style={{
            ...viewerStyles.photoFrame,
            width: photoWidth,
            aspectRatio: `${photoAspect}`,
          }}
        >
          <StoredPhotoImage
            src={getOmoidePhotoDetailSrc(memory)}
            fallbackSrcs={getOmoidePhotoFallbackSrcs(memory)}
            alt=""
            style={viewerStyles.photo}
            imageStyle={viewerStyles.photoImage}
            storageVariant={resolvePhotoStorageVariant(memory.photo, "detail")}
            loading={isRevisit ? "lazy" : "eager"}
            fetchPriority={isRevisit ? "auto" : "high"}
            onNaturalSize={({ width, height }) => {
              if (width > 0 && height > 0) {
                setPhotoAspect(Math.min(4, Math.max(0.25, width / height)));
              }
            }}
          />
        </div>
        <p data-testid="omoide-memory-date" style={viewerStyles.date}>
          {formatOmoideSourceDate(memory.sourceDateKey)}
        </p>
        <button
          type="button"
          data-testid="omoide-memory-stow"
          style={viewerStyles.stowButton}
          onClick={() => requestStow()}
        >
          思い出箱に もどる
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
    boxSizing: "border-box",
    overflowY: "auto",
    padding:
      "calc(28px + env(safe-area-inset-top)) 18px calc(24px + env(safe-area-inset-bottom))",
    background: "var(--app-paper-background)",
    backgroundColor: "var(--paper-warm)",
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
    color: "var(--ink)",
  },
  stage: {
    width: "min(100%, 420px)",
    minHeight: "min-content",
    display: "grid",
    justifyItems: "center",
    gap: "12px",
  },
  title: {
    margin: "0 0 2px",
    color: "var(--ink)",
    fontFamily: "var(--font-display)",
    fontSize: "24px",
    fontWeight: 500,
    lineHeight: 1.42,
    letterSpacing: "0.08em",
    textAlign: "center",
  },
  photoFrame: {
    maxWidth: "100%",
    maxHeight: "min(58dvh, 560px)",
    padding: "6px",
    boxSizing: "border-box",
    overflow: "hidden",
    borderRadius: "8px",
    background: "color-mix(in srgb, var(--paper-card) 82%, transparent)",
    boxShadow:
      "0 1px 0 rgba(255,255,255,.52) inset, 0 16px 38px rgba(96,78,54,0.12)",
  },
  photo: {
    width: "100%",
    height: "100%",
    borderRadius: "5px",
    background: "rgba(255,253,248,0.72)",
  },
  photoImage: {
    objectFit: "contain",
    borderRadius: "5px",
  },
  date: {
    margin: "0",
    color: "var(--ink-soft)",
    fontFamily: "var(--font-display)",
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: "0.04em",
    textAlign: "center",
  },
  stowButton: {
    width: "min(260px, 100%)",
    minHeight: "54px",
    marginTop: "4px",
    padding: "0 18px",
    border: "1px solid color-mix(in srgb, var(--line) 42%, transparent)",
    borderRadius: "var(--radius-full)",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--paper-card) 98%, white 2%), color-mix(in srgb, var(--paper) 94%, white 6%))",
    color: "var(--ink)",
    fontFamily: "var(--font-ui)",
    fontSize: "15px",
    fontWeight: 520,
    lineHeight: 1.35,
    letterSpacing: "0.04em",
    cursor: "pointer",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.72), 0 12px 26px rgba(90,76,60,0.08)",
    WebkitTapHighlightColor: "transparent",
  },
} satisfies Record<string, CSSProperties>;
