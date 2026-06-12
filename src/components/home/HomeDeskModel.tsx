"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";

import {
  addJstDays,
  getJstDateKey,
  getJstDeliveryTime,
  getJstHour,
  readEveningDeliveryStore,
  type EveningHomeState,
} from "../../lib/home/eveningDelivery";
import type {
  ExchangePhoto,
  OwnSleepingPhoto,
} from "../../lib/home/sleepingPhotos";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import { playOpenSound } from "../../lib/openSound";
import { BottomNavigation } from "../navigation/BottomNavigation";
import { AppIcon } from "../ui/AppIcons";
import { StoredPhotoImage } from "../ui/StoredPhotoImage";

type DeskState = "1" | "1b" | "2" | "3" | "4";

type YesterdayMini = {
  ownPhoto: OwnSleepingPhoto | null;
  deliveredPhoto: ExchangePhoto | null;
};

type HomeDeskModelProps = {
  catName: string;
  eveningState: EveningHomeState;
  ownSleepingPhotos: OwnSleepingPhoto[];
  sleepingCounter: string;
  showGuidanceCopy: boolean;
  showSleepingCounter: boolean;
  now: number;
  onTakePhoto: () => void;
  onOpenDelivery: (state: Extract<EveningHomeState, { kind: "delivered" }>) => void;
  onKeepOpenedDelivery: (dateKey: string, photo: ExchangePhoto) => void;
  onDeliveredStorageDataUrl: (
    dateKey: string,
    photo: ExchangePhoto,
    dataUrl: string,
  ) => void;
};

const HOLD_OPEN_MS = 1600;

export function HomeDeskModel({
  catName,
  eveningState,
  ownSleepingPhotos,
  sleepingCounter,
  showGuidanceCopy,
  showSleepingCounter,
  now,
  onTakePhoto,
  onOpenDelivery,
  onKeepOpenedDelivery,
  onDeliveredStorageDataUrl,
}: HomeDeskModelProps) {
  const deskState = getDeskState(eveningState);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [letterHintVisible, setLetterHintVisible] = useState(false);
  const [holdProgress, setHoldProgress] = useState(false);
  const [holdAttemptCount, setHoldAttemptCount] = useState(0);
  const hintTimerRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const yesterdayMini = useYesterdayMini(now, ownSleepingPhotos);
  const deliveryProgress = useMemo(
    () => getDeliveryProgress(eveningState.dateKey, now),
    [eveningState.dateKey, now],
  );
  const shouldHidePresence =
    deskState === "3" || getJstHour(now) < 5 || !showSleepingCounter;
  const guidanceCopy = getGuidanceCopy(deskState, catName);
  const isBefore = deskState === "1" || deskState === "1b";
  const targetPhoto =
    eveningState.kind === "waiting" ||
    eveningState.kind === "delivered" ||
    eveningState.kind === "opened"
      ? eveningState.targetPhoto
      : null;
  const deliveredPhoto =
    eveningState.kind === "delivered" || eveningState.kind === "opened"
      ? eveningState.deliveredPhoto
      : null;
  const canTapOpen = holdAttemptCount >= 3 || prefersReducedMotion;
  const backgroundTone = deskState === "2" ? deliveryProgress : deskState === "3" ? 1 : 0;

  useEffect(() => {
    trackDeskStateShown(deskState, eveningState.dateKey);
  }, [deskState, eveningState.dateKey]);

  useEffect(() => {
    return () => {
      if (hintTimerRef.current) {
        window.clearTimeout(hintTimerRef.current);
      }
      if (holdTimerRef.current) {
        window.clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  function showLetterHint() {
    setLetterHintVisible(true);
    if (hintTimerRef.current) {
      window.clearTimeout(hintTimerRef.current);
    }
    hintTimerRef.current = window.setTimeout(() => {
      setLetterHintVisible(false);
    }, 2000);
  }

  function startHold(event: PointerEvent<HTMLButtonElement>) {
    if (eveningState.kind !== "delivered") {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    if (prefersReducedMotion) {
      void playOpenSound();
      onOpenDelivery(eveningState);
      return;
    }

    setHoldProgress(true);
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
    }
      holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      setHoldProgress(false);
      void playOpenSound();
      onOpenDelivery(eveningState);
    }, HOLD_OPEN_MS);
  }

  function cancelHold() {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
      setHoldAttemptCount((count) => Math.min(3, count + 1));
    }
    setHoldProgress(false);
  }

  function handleFallbackOpen() {
    if (eveningState.kind === "delivered") {
      void playOpenSound();
      onOpenDelivery(eveningState);
    }
  }

  return (
    <section
      data-testid="home-desk-model"
      data-state={deskState}
      style={{
        ...deskStyles.page,
        "--desk-dusk": String(backgroundTone),
      } as CSSProperties}
      aria-label="きょう"
    >
      <div style={deskStyles.duskLayer} aria-hidden="true" />
      <div style={deskStyles.stage}>
        <div
          style={{
            ...deskStyles.desk,
            ...(deskState === "3" ? deskStyles.deskDelivered : {}),
            ...(deskState === "4" ? deskStyles.deskOpened : {}),
          }}
        >
          <div
            style={{
              ...deskStyles.slot,
              ...(deskState === "3" ? deskStyles.slotRetreated : {}),
            }}
          >
            {targetPhoto ? (
              <PhotoTile
                photo={targetPhoto}
                size={deskState === "3" ? "small" : "normal"}
              />
            ) : (
              <button
                type="button"
                data-testid="desk-empty-frame"
                style={deskStyles.emptyFrame}
                className={prefersReducedMotion ? undefined : "desk-frame-breathe"}
                onClick={onTakePhoto}
                aria-label="ねがおをとる"
              >
                <AppIcon name="camera" size={28} />
              </button>
            )}
          </div>

          {deskState === "3" ? (
            <div style={deskStyles.deliveredLetterWrap}>
              <button
                type="button"
                role="button"
                aria-label="おさえて ひらく"
                style={deskStyles.arrivedLetterButton}
                className={holdProgress ? "desk-letter-holding" : undefined}
                onPointerDown={startHold}
                onPointerUp={cancelHold}
                onPointerCancel={cancelHold}
                onPointerLeave={cancelHold}
                onClick={canTapOpen ? handleFallbackOpen : undefined}
              >
                <span style={deskStyles.letterFlap} aria-hidden="true" />
                <span style={deskStyles.letterSeal} aria-hidden="true" />
                {deliveredPhoto ? (
                  <span
                    data-develop-photo="true"
                    style={deskStyles.developPhoto}
                    aria-hidden="true"
                  >
                    <StoredPhotoImage
                      src={getPhotoDetailSrc(deliveredPhoto)}
                      alt=""
                      style={deskStyles.developImage}
                    />
                  </span>
                ) : null}
              </button>
              <span
                style={{
                  ...deskStyles.holdLabel,
                  ...(holdProgress ? deskStyles.holdLabelActive : {}),
                }}
              >
                おさえて ひらく
              </span>
              {canTapOpen ? (
                <button
                  type="button"
                  style={deskStyles.fallbackOpenButton}
                  onClick={handleFallbackOpen}
                >
                  タップでひらく
                </button>
              ) : null}
            </div>
          ) : (
            <div style={deskStyles.slot}>
              <button
                type="button"
                data-testid="desk-letter"
                style={{
                  ...deskStyles.letter,
                  ...(deskState === "2"
                    ? {
                        transform: `rotate(-2.5deg) scale(${0.94 + deliveryProgress * 0.06})`,
                      }
                    : {}),
                  ...(deskState === "1b" ? deskStyles.letterFullClosed : {}),
                  ...(deskState === "4" ? deskStyles.letterHidden : {}),
                }}
                onClick={deskState === "2" ? showLetterHint : undefined}
                aria-label={
                  deskState === "2"
                    ? "よる8じごろに とどきます"
                    : "よる8じに とどく手紙"
                }
                tabIndex={deskState === "2" ? 0 : -1}
              >
                <span style={deskStyles.letterFlap} aria-hidden="true" />
                <span
                  data-testid="desk-letter-fill"
                  style={{
                    ...deskStyles.letterFill,
                    height:
                      deskState === "2"
                        ? `${Math.round(deliveryProgress * 100)}%`
                        : deskState === "1b"
                          ? "100%"
                          : "0%",
                  }}
                  className={deskState === "2" ? "desk-letter-fill" : undefined}
                  aria-hidden="true"
                />
              </button>
              <span
                style={{
                  ...deskStyles.letterHint,
                  opacity: letterHintVisible ? 1 : 0,
                }}
                aria-live="polite"
              >
                よる8じごろ
              </span>
            </div>
          )}
        </div>

        {showGuidanceCopy && guidanceCopy ? (
          <p style={deskStyles.guidanceCopy}>
            {guidanceCopy}
          </p>
        ) : null}

        {deskState === "4" && targetPhoto && deliveredPhoto ? (
          <div style={deskStyles.openedPair} aria-label="きょうの2まい">
            <PhotoTile photo={targetPhoto} />
            <span style={deskStyles.pairDots} aria-hidden="true" />
            <PhotoTile
              photo={deliveredPhoto}
              label={showGuidanceCopy ? "どこかのこ" : undefined}
              onStorageDataUrl={(dataUrl) =>
                onDeliveredStorageDataUrl(eveningState.dateKey, deliveredPhoto, dataUrl)
              }
            />
          </div>
        ) : null}

        {deskState === "4" && deliveredPhoto ? (
          <button
            type="button"
            style={deskStyles.keepButton}
            onClick={() => onKeepOpenedDelivery(eveningState.dateKey, deliveredPhoto)}
          >
            とっておく
          </button>
        ) : null}

        {isBefore && yesterdayMini ? (
          <div style={deskStyles.yesterday} aria-label="きのうの2まい">
            <div style={deskStyles.yesterdayPair}>
              {yesterdayMini.ownPhoto ? (
                <PhotoTile photo={yesterdayMini.ownPhoto} size="mini" />
              ) : null}
              {yesterdayMini.ownPhoto && yesterdayMini.deliveredPhoto ? (
                <span style={deskStyles.yesterdayDots} aria-hidden="true" />
              ) : null}
              {yesterdayMini.deliveredPhoto ? (
                <PhotoTile
                  photo={yesterdayMini.deliveredPhoto}
                  size="mini"
                  onStorageDataUrl={(dataUrl) =>
                    onDeliveredStorageDataUrl(
                      addJstDays(getJstDateKey(now), -1),
                      yesterdayMini.deliveredPhoto!,
                      dataUrl,
                    )
                  }
                />
              ) : null}
            </div>
            <span style={deskStyles.yesterdayLabel}>きのうの2まい</span>
          </div>
        ) : null}
      </div>

      {!shouldHidePresence ? (
        <p style={deskStyles.presence}>
          きょうも、{sleepingCounter}ひきの ねこが ねています
        </p>
      ) : null}

      <BottomNavigation active="today" homeVariant="desk" homeState={deskState} />

      <style>{`
        @keyframes deskFrameBreathe {
          0%, 100% { border-color: var(--ink-faint); box-shadow: var(--shadow-rest); }
          50% { border-color: var(--ink-soft); box-shadow: var(--shadow-rest); }
        }
        @keyframes deskLetterShimmer {
          0%, 100% { opacity: 0.58; transform: translateX(-4px); }
          50% { opacity: 1; transform: translateX(4px); }
        }
        .desk-frame-breathe {
          animation: deskFrameBreathe calc(var(--dur-move) * 10) var(--ease-gentle) infinite;
        }
        .desk-letter-fill::before {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--ink-soft) 42%, transparent), transparent);
          box-shadow: var(--shadow-rest);
          animation: deskLetterShimmer calc(var(--dur-reveal) * 4) var(--ease-gentle) infinite;
        }
        .desk-letter-holding [data-develop-photo="true"] {
          opacity: 1 !important;
          filter: blur(0) !important;
          transform: scale(1) !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .desk-frame-breathe,
          .desk-letter-fill::before {
            animation: none;
          }
          .desk-letter-holding [data-develop-photo="true"] {
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}

function PhotoTile({
  photo,
  label,
  size = "normal",
  onStorageDataUrl,
}: {
  photo: Pick<
    OwnSleepingPhoto | ExchangePhoto,
    "src" | "thumbnailSrc" | "displaySrc" | "originalSrc"
  >;
  label?: string;
  size?: "normal" | "small" | "mini";
  onStorageDataUrl?: (dataUrl: string) => void;
}) {
  const imageSize =
    size === "mini" ? deskStyles.miniImage : size === "small" ? deskStyles.smallImage : deskStyles.tileImage;
  const tileFrameStyle =
    size === "normal"
      ? { ...deskStyles.photoTile, ...deskStyles.normalPhotoTile }
      : deskStyles.photoTile;

  return (
    <div style={deskStyles.photoTileWrap}>
      <div
        data-testid={size === "normal" ? "desk-photo-tile" : undefined}
        style={{
          ...tileFrameStyle,
          ...(size === "mini" ? deskStyles.miniTile : {}),
        }}
      >
        <StoredPhotoImage
          src={getPhotoThumbnailSrc(photo)}
          alt=""
          style={imageSize}
          onStorageDataUrl={onStorageDataUrl}
        />
      </div>
      {label ? <span style={deskStyles.tileLabel}>{label}</span> : null}
    </div>
  );
}

function useYesterdayMini(
  now: number,
  ownSleepingPhotos: OwnSleepingPhoto[],
): YesterdayMini | null {
  return useMemo(() => {
    const yesterdayKey = addJstDays(getJstDateKey(now), -1);
    const day = readEveningDeliveryStore()[yesterdayKey];
    if (!day?.targetOwnPhotoId && !day?.targetPhoto && !day?.deliveredPhoto) {
      return null;
    }

    const ownPhoto =
      ownSleepingPhotos.find((photo) => photo.id === day.targetOwnPhotoId) ??
      day.targetPhoto ??
      null;

    if (!ownPhoto && !day.deliveredPhoto) {
      return null;
    }

    return {
      ownPhoto,
      deliveredPhoto: day.deliveredPhoto ?? null,
    };
  }, [now, ownSleepingPhotos]);
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}

function getDeskState(eveningState: EveningHomeState): DeskState {
  if (eveningState.kind === "waiting") return "2";
  if (eveningState.kind === "delivered") return "3";
  if (eveningState.kind === "opened") return "4";
  return eveningState.isTodayDelivery ? "1" : "1b";
}

function getDeliveryProgress(dateKey: string, now: number) {
  const deliveryAt = getJstDeliveryTime(dateKey);
  const startsAt = deliveryAt - 15 * 60 * 60 * 1000;
  return Math.min(1, Math.max(0, (now - startsAt) / (deliveryAt - startsAt)));
}

function getGuidanceCopy(state: DeskState, catName: string) {
  switch (state) {
    case "1":
      return `${catName}、ねてる?`;
    case "1b":
      return "いまとると、あしたのよるに とどく";
    case "2":
      return "よる8じごろ とどく";
    default:
      return "";
  }
}

function getPhotoThumbnailSrc(
  photo: Pick<
    OwnSleepingPhoto | ExchangePhoto,
    "src" | "thumbnailSrc" | "displaySrc"
  >,
) {
  return photo.thumbnailSrc ?? photo.displaySrc ?? photo.src;
}

function getPhotoDetailSrc(
  photo: Pick<
    OwnSleepingPhoto | ExchangePhoto,
    "src" | "displaySrc" | "originalSrc"
  >,
) {
  return photo.originalSrc ?? photo.displaySrc ?? photo.src;
}

function trackDeskStateShown(state: DeskState, dateKey: string) {
  try {
    const key = `neteruneko_home_desk_state_shown:${dateKey}:${state}`;
    if (window.localStorage.getItem(key) === "1") {
      return;
    }
    window.localStorage.setItem(key, "1");
  } catch {
    // Analytics should not affect rendering.
  }

  trackProductEvent("motif_state_shown", { state });
}

const deskStyles = {
  page: {
    position: "relative",
    minHeight: "100svh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding:
      "calc(34px + env(safe-area-inset-top)) 22px calc(var(--bottom-nav-height) + var(--bottom-nav-bottom-offset) + 30px + env(safe-area-inset-bottom))",
    color: "var(--ink)",
    background: "var(--bg-gradient)",
  },
  duskLayer: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background: "var(--paper-warm)",
    opacity: "var(--desk-dusk)",
    transition: "opacity var(--dur-instant) var(--ease-settle)",
  },
  stage: {
    position: "relative",
    zIndex: 1,
    flex: 1,
    width: "min(100%, 390px)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "18px",
    paddingTop:
      "clamp(176px, calc(40svh - 106px - env(safe-area-inset-top)), 276px)",
  },
  desk: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "18px",
    width: "100%",
  },
  deskDelivered: {
    flexDirection: "column",
    gap: "16px",
  },
  deskOpened: {
    display: "none",
  },
  slot: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "7px",
    width: "144px",
  },
  slotRetreated: {
    opacity: 0.62,
    transform: "scale(0.76)",
  },
  emptyFrame: {
    width: "144px",
    height: "144px",
    boxSizing: "border-box",
    display: "grid",
    placeItems: "center",
    border: "1px dashed var(--ink-faint)",
    borderRadius: "var(--radius-tile)",
    background: "color-mix(in srgb, var(--paper) 55%, transparent)",
    color: "var(--ink-soft)",
    boxShadow: "var(--shadow-rest)",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  letter: {
    position: "relative",
    width: "108px",
    height: "72px",
    overflow: "hidden",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-s)",
    background: "var(--paper-card)",
    boxShadow: "var(--shadow-rest)",
    transform: "rotate(-2.5deg)",
    opacity: 0.55,
    transition:
      "transform var(--dur-instant) var(--ease-gentle), opacity var(--dur-instant) var(--ease-gentle)",
    WebkitTapHighlightColor: "transparent",
  },
  letterFullClosed: {
    opacity: 0.78,
  },
  letterHidden: {
    display: "none",
  },
  letterFlap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "52%",
    clipPath: "polygon(0 0,100% 0,50% 100%)",
    background: "color-mix(in srgb, var(--ink) 4%, transparent)",
    borderBottom: "1px solid var(--line)",
  },
  letterFill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--ink-soft) 10%, transparent), color-mix(in srgb, var(--ink-soft) 20%, transparent))",
    transition: "height var(--dur-instant) var(--ease-gentle)",
  },
  letterHint: {
    minHeight: "16px",
    color: "var(--ink-soft)",
    fontFamily: "var(--font-serif)",
    fontSize: "11.5px",
    letterSpacing: "0.06em",
    transition: "opacity var(--dur-instant) var(--ease-gentle)",
  },
  deliveredLetterWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
  },
  arrivedLetterButton: {
    position: "relative",
    width: "188px",
    height: "130px",
    overflow: "hidden",
    border: "none",
    borderRadius: "var(--radius-tile)",
    background: "var(--paper-card)",
    color: "var(--seal)",
    boxShadow: "var(--shadow-float)",
    transform: "rotate(-2deg)",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  letterSeal: {
    position: "absolute",
    top: "46%",
    left: "50%",
    width: "16px",
    height: "16px",
    borderRadius: "var(--radius-tile)",
    background: "var(--seal)",
    boxShadow: "var(--shadow-rest)",
    transform: "translate(-50%,-50%)",
  },
  developPhoto: {
    position: "absolute",
    inset: 0,
    opacity: 0,
    filter: "blur(18px)",
    transform: "scale(1.05)",
    transition:
      "opacity var(--dur-develop) var(--ease-gentle), filter var(--dur-develop) var(--ease-gentle), transform var(--dur-develop) var(--ease-gentle)",
    pointerEvents: "none",
  },
  developImage: {
    width: "100%",
    height: "100%",
    borderRadius: "var(--radius-img)",
  },
  holdLabel: {
    color: "var(--ink-soft)",
    fontFamily: "var(--font-serif)",
    fontSize: "12px",
    fontWeight: 400,
    letterSpacing: "var(--tracking-label)",
  },
  holdLabelActive: {
    color: "var(--seal)",
  },
  fallbackOpenButton: {
    minHeight: "40px",
    padding: "0 18px",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-tile)",
    background: "color-mix(in srgb, var(--paper) 72%, transparent)",
    color: "var(--ink-soft)",
    fontFamily: "var(--font-serif)",
    fontSize: "13px",
    fontWeight: 400,
    letterSpacing: "var(--tracking-label)",
  },
  photoTileWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "7px",
  },
  photoTile: {
    padding: "8px",
    borderRadius: "var(--radius-tile)",
    background: "var(--paper)",
    boxShadow: "var(--shadow-rest)",
  },
  normalPhotoTile: {
    width: "144px",
    height: "144px",
    boxSizing: "border-box",
  },
  miniTile: {
    padding: "5px",
    borderRadius: "var(--radius-img)",
    boxShadow: "var(--shadow-rest)",
  },
  tileImage: {
    width: "min(36vw, 128px)",
    height: "min(36vw, 128px)",
    borderRadius: "var(--radius-img)",
  },
  smallImage: {
    width: "92px",
    height: "92px",
    borderRadius: "var(--radius-s)",
  },
  miniImage: {
    width: "54px",
    height: "54px",
    borderRadius: "var(--radius-s)",
  },
  tileLabel: {
    color: "var(--ink-soft)",
    fontSize: "11.5px",
    fontFamily: "var(--font-serif)",
    fontWeight: 400,
    letterSpacing: "var(--tracking-label)",
  },
  guidanceCopy: {
    minHeight: "18px",
    margin: "0",
    color: "var(--ink-soft)",
    fontSize: "11.5px",
    fontFamily: "var(--font-serif)",
    fontWeight: 400,
    letterSpacing: "var(--tracking-label)",
    textAlign: "center",
  },
  openedPair: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: "12px",
    width: "100%",
  },
  pairDots: {
    width: "24px",
    height: "128px",
    flexShrink: 0,
    background:
      "radial-gradient(circle, var(--ink-faint) 0 2px, transparent 2.6px) center / 10px 10px repeat-x",
    opacity: 0.75,
    alignSelf: "center",
  },
  keepButton: {
    width: "min(100%, 330px)",
    minHeight: "58px",
    marginTop: "10px",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-tile)",
    background: "color-mix(in srgb, var(--paper) 78%, transparent)",
    color: "var(--ink)",
    fontSize: "18px",
    fontFamily: "var(--font-serif)",
    fontWeight: 400,
    letterSpacing: "var(--tracking-label)",
    boxShadow: "var(--shadow-rest)",
  },
  yesterday: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    marginTop: "4px",
    opacity: 0.78,
  },
  yesterdayPair: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  yesterdayDots: {
    width: "20px",
    height: "8px",
    background:
      "radial-gradient(circle, var(--ink-faint) 0 1.8px, transparent 2.2px) center / 7px 7px repeat-x",
  },
  yesterdayLabel: {
    color: "var(--ink-faint)",
    fontSize: "10px",
    fontFamily: "var(--font-serif)",
    letterSpacing: "var(--tracking-label)",
  },
  presence: {
    position: "relative",
    zIndex: 1,
    width: "min(100%, 390px)",
    minHeight: "18px",
    margin: "0 0 16px",
    color: "var(--ink-faint)",
    fontSize: "10.5px",
    fontFamily: "var(--font-serif)",
    letterSpacing: "var(--tracking-label)",
    textAlign: "center",
  },
} satisfies Record<string, CSSProperties>;
