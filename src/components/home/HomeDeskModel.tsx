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
                <span style={deskStyles.holdLabel}>おさえて ひらく</span>
              </button>
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
          0%, 100% { border-color: #cfc4ae; box-shadow: 0 9px 20px rgba(120,104,80,0.08); }
          50% { border-color: #bfb39d; box-shadow: 0 10px 22px rgba(120,104,80,0.10); }
        }
        @keyframes deskLetterShimmer {
          0%, 100% { opacity: 0.58; transform: translateX(-4px); }
          50% { opacity: 1; transform: translateX(4px); }
        }
        .desk-frame-breathe {
          animation: deskFrameBreathe 4.2s ease-in-out infinite;
        }
        .desk-letter-fill::before {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 2px;
          background: linear-gradient(90deg, rgba(194, 96, 124, 0.18), rgba(194, 96, 124, 0.62), rgba(194, 96, 124, 0.18));
          box-shadow: 0 1px 4px rgba(194, 96, 124, 0.22);
          animation: deskLetterShimmer 3.4s ease-in-out infinite;
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
    color: "#4a4338",
    background: "#f7f3ea",
  },
  duskLayer: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    background: "linear-gradient(180deg, #f3e6da, #ebdcd3)",
    opacity: "var(--desk-dusk)",
    transition: "opacity 300ms ease-out",
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
    border: "1px dashed #cfc4ae",
    borderRadius: "24px",
    background: "rgba(255,253,248,0.55)",
    color: "#b3a890",
    boxShadow: "0 9px 20px rgba(120,104,80,0.08)",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  letter: {
    position: "relative",
    width: "108px",
    height: "72px",
    overflow: "hidden",
    border: "1px solid #ecdcd2",
    borderRadius: "13px",
    background: "#fbf4ef",
    boxShadow: "0 6px 14px rgba(140,100,90,0.10)",
    transform: "rotate(-2.5deg)",
    opacity: 0.55,
    transition: "transform 300ms ease-out, opacity 300ms ease-out",
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
    background: "rgba(194,96,124,0.12)",
    borderBottom: "1px solid rgba(194,96,124,0.14)",
  },
  letterFill: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    background: "linear-gradient(180deg, rgba(194,96,124,0.16), rgba(194,96,124,0.34))",
    transition: "height 250ms ease-out",
  },
  letterHint: {
    minHeight: "16px",
    color: "#9a9183",
    fontSize: "11.5px",
    letterSpacing: "0.06em",
    transition: "opacity 300ms ease-out",
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
    borderRadius: "16px",
    background: "linear-gradient(180deg, #f3dde4, #eccdd7)",
    color: "#a84e68",
    boxShadow: "0 12px 26px rgba(170,90,115,0.22)",
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
    borderRadius: "50%",
    background: "#c2607c",
    boxShadow: "0 1px 3px rgba(120,40,65,0.3)",
    transform: "translate(-50%,-50%)",
  },
  developPhoto: {
    position: "absolute",
    inset: 0,
    opacity: 0,
    filter: "blur(18px)",
    transform: "scale(1.05)",
    transition: "opacity 1600ms ease, filter 1600ms ease, transform 1600ms ease",
    pointerEvents: "none",
  },
  developImage: {
    width: "100%",
    height: "100%",
    borderRadius: "16px",
  },
  holdLabel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "22px",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.14em",
  },
  fallbackOpenButton: {
    minHeight: "40px",
    padding: "0 18px",
    border: "1px solid rgba(168,78,104,0.22)",
    borderRadius: "999px",
    background: "rgba(255,253,248,0.72)",
    color: "#a84e68",
    fontSize: "13px",
    fontWeight: 700,
  },
  photoTileWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "7px",
  },
  photoTile: {
    padding: "8px",
    borderRadius: "24px",
    background: "#fffdf8",
    boxShadow: "0 9px 20px rgba(120,104,80,0.12)",
  },
  normalPhotoTile: {
    width: "144px",
    height: "144px",
    boxSizing: "border-box",
  },
  miniTile: {
    padding: "5px",
    borderRadius: "16px",
    boxShadow: "0 5px 12px rgba(120,104,80,0.10)",
  },
  tileImage: {
    width: "min(36vw, 128px)",
    height: "min(36vw, 128px)",
    borderRadius: "17px",
  },
  smallImage: {
    width: "92px",
    height: "92px",
    borderRadius: "14px",
  },
  miniImage: {
    width: "54px",
    height: "54px",
    borderRadius: "12px",
  },
  tileLabel: {
    color: "#a89f92",
    fontSize: "11.5px",
    fontWeight: 560,
    letterSpacing: "0.04em",
  },
  guidanceCopy: {
    minHeight: "18px",
    margin: "0",
    color: "#9a9183",
    fontSize: "11.5px",
    fontWeight: 520,
    letterSpacing: "0.03em",
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
      "radial-gradient(circle, #c5bcab 0 2px, transparent 2.6px) center / 10px 10px repeat-x",
    opacity: 0.75,
    alignSelf: "center",
  },
  keepButton: {
    width: "min(100%, 330px)",
    minHeight: "58px",
    marginTop: "10px",
    border: "1px solid rgba(120,108,94,0.14)",
    borderRadius: "999px",
    background: "rgba(255,253,248,0.78)",
    color: "#4a4338",
    fontSize: "18px",
    fontWeight: 720,
    boxShadow: "0 8px 18px rgba(90,76,60,0.06)",
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
      "radial-gradient(circle, #c5bcab 0 1.8px, transparent 2.2px) center / 7px 7px repeat-x",
  },
  yesterdayLabel: {
    color: "#b2a897",
    fontSize: "10px",
    letterSpacing: "0.1em",
  },
  presence: {
    position: "relative",
    zIndex: 1,
    width: "min(100%, 390px)",
    minHeight: "18px",
    margin: "0 0 16px",
    color: "#b4aa98",
    fontSize: "10.5px",
    letterSpacing: "0.08em",
    textAlign: "center",
  },
} satisfies Record<string, CSSProperties>;
