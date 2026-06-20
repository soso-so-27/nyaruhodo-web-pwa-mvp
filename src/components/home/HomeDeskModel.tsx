"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, PointerEvent, ReactNode } from "react";

import { type EveningHomeState } from "../../lib/home/eveningDelivery";
import type {
  ExchangePhotoReportReason,
  ExchangePhoto,
  OwnSleepingPhoto,
} from "../../lib/home/sleepingPhotos";
import type { OmoideMemory } from "../../lib/home/omoideDelivery";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import { playOpenSound } from "../../lib/openSound";
import { BottomNavigation } from "../navigation/BottomNavigation";
import { AppButton } from "../ui/AppButton";
import { AppCard } from "../ui/AppCard";
import { AppSheet } from "../ui/AppBottomSheet";
import { AppIcon } from "../ui/AppIcons";
import { PhotoViewerFrame } from "../ui/PhotoTile";
import { StoredPhotoImage } from "../ui/StoredPhotoImage";

type DeskState = "1" | "1b" | "2" | "3" | "4";
type HomeDaylightStyle = CSSProperties & Record<`--${string}`, string>;
type HomeFrameLayoutStyle = CSSProperties & Record<"--home-frame-layout-width", string>;
type HomeTodayPhase =
  | "empty-before"
  | "sent-before"
  | "delivered"
  | "opened"
  | "empty-after"
  | "late-sent";

type DeskViewerPhoto =
  | {
      kind: "own";
      dateKey: string;
      photo: OwnSleepingPhoto;
    }
  | {
      kind: "other";
      dateKey: string;
      photo: ExchangePhoto;
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
  onReportOpenedDelivery: (
    dateKey: string,
    photo: ExchangePhoto,
    reason: ExchangePhotoReportReason,
  ) => void;
  onDeliveredStorageDataUrl: (
    dateKey: string,
    photo: ExchangePhoto,
    dataUrl: string,
  ) => void;
  omoideMemory?: OmoideMemory | null;
  onOpenOmoideMemory?: (memory: OmoideMemory) => void;
  onDismissOmoideMemory?: (memory: OmoideMemory) => void;
};

const HOLD_OPEN_MS = 1600;
const HOLD_REWIND_MS = 1000;
const HOME_FRAME_TUNING = {
  pagePaddingX: "12px",
  pagePaddingTop: "8px",
  stageMaxWidth: "460px",
  stageGap: "10px",
  heroGap: "10px",
  frameAspectRatio: "9 / 14",
  emptyFrameAspectRatio: "9 / 14",
  emptyFrameMaxHeight: "660px",
  matWidth: "0px",
  outerRadius: "24px",
  innerRadius: "24px",
  frameShadow:
    "0 2px 6px rgba(70, 50, 30, 0.16), 0 16px 40px -10px rgba(70, 50, 30, 0.30)",
  frameHairline: "inset 0 0 0 0.5px rgba(0, 0, 0, 0.05)",
  skyMotionDuration: "16s",
  skyReducedMotionDuration: "42s",
  statusScrim:
    "linear-gradient(180deg, color-mix(in srgb, var(--ink) 19%, transparent) 0%, color-mix(in srgb, var(--ink) 9%, transparent) 42%, transparent 100%)",
  daylightTransition: "1800ms",
  wax: "#b9634f",
  emptyFrameStart: "#fbf5ea",
  emptyFrameEnd: "#f1e7d6",
  trayPaper: "#fdf9f1",
  trayRadius: "18px",
  trayMinHeight: "104px",
  trayToNavGap: "32px",
  frameMinWidthPx: 248,
  frameInitialWidth: "310px",
  frameAspectWidthPerHeight: 9 / 14,
  emptyIllustrationWidth: "min(36vw, 124px)",
  emptyIllustrationMinWidth: "112px",
  emptyTitleSize: "20px",
  emptyActionSize: "14px",
} as const;
const HOME_SKY_BACKGROUND =
  "linear-gradient(180deg, color-mix(in srgb, var(--home-sky-top, var(--paper)) 18%, transparent) 0%, color-mix(in srgb, var(--home-sky-mid, var(--paper)) 10%, transparent) 48%, color-mix(in srgb, var(--home-sky-bottom, var(--paper-warm)) 16%, transparent) 100%), var(--home-sky-image), radial-gradient(circle at var(--home-sky-glow-x, 50%) var(--home-sky-glow-y, 12%), color-mix(in srgb, var(--home-sky-glow, var(--paper-warm)) 38%, transparent) 0%, transparent 54%), linear-gradient(180deg, var(--home-sky-top, var(--paper)) 0%, var(--home-sky-mid, var(--paper)) 44%, var(--home-sky-bottom, var(--paper-warm)) 100%)";
const HOME_SKY_BACKGROUND_SIZE = "cover, cover, 140% 140%, cover";
const HOME_SKY_BACKGROUND_POSITION =
  "50% 50%, 50% 50%, var(--home-sky-glow-x, 50%) var(--home-sky-glow-y, 12%), 50% 50%";
const HOME_BACKGROUND_IMAGES = {
  dawn: "url('/images/home-backgrounds/dawn.webp')",
  morning: "url('/images/home-backgrounds/morning.webp')",
  noon: "url('/images/home-backgrounds/noon.webp')",
  evening: "url('/images/home-backgrounds/evening.webp')",
  night: "url('/images/home-backgrounds/night.webp')",
} as const;
const HOME_DAYLIGHT_ANCHORS = [
  {
    minute: 4 * 60 + 45,
    skyTop: "#e8cbbd",
    skyMid: "#f3e9da",
    skyBottom: "#eadfce",
    mat: "#fff7ee",
    glow: "#d89b76",
  },
  {
    minute: 7 * 60,
    skyTop: "#f3e9dc",
    skyMid: "#f7efe3",
    skyBottom: "#ebe1d0",
    mat: "#fff8ef",
    glow: "#dfad7d",
  },
  {
    minute: 12 * 60,
    skyTop: "#f4eee3",
    skyMid: "#f3eadc",
    skyBottom: "#ece2d2",
    mat: "#fff9f0",
    glow: "#bca77f",
  },
  {
    minute: 17 * 60,
    skyTop: "#ead8c7",
    skyMid: "#eddfd0",
    skyBottom: "#d9c8bc",
    mat: "#fff3e8",
    glow: "#bd7b61",
  },
  {
    minute: 19 * 60 + 40,
    skyTop: "#d3c0ba",
    skyMid: "#dfd0c8",
    skyBottom: "#c5b3ad",
    mat: "#f2e8df",
    glow: "#a66d69",
  },
  {
    minute: 22 * 60,
    skyTop: "#9fa2a3",
    skyMid: "#c7c1b5",
    skyBottom: "#878786",
    mat: "#e8e0d5",
    glow: "#59657f",
  },
] as const;

export function HomeDeskModel({
  catName,
  eveningState,
  ownSleepingPhotos,
  sleepingCounter,
  now,
  onTakePhoto,
  onOpenDelivery,
  onKeepOpenedDelivery,
  onReportOpenedDelivery,
  omoideMemory,
  onOpenOmoideMemory,
  onDismissOmoideMemory,
}: HomeDeskModelProps) {
  const deskState = getDeskState(eveningState);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [holdProgress, setHoldProgress] = useState(false);
  const [developPhotoMounted, setDevelopPhotoMounted] = useState(false);
  const [isRewindingHold, setIsRewindingHold] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState<DeskViewerPhoto | null>(null);
  const [openingOmoideMemory, setOpeningOmoideMemory] =
    useState<OmoideMemory | null>(null);
  const [, setReportedDeliveredIds] = useState<Set<string>>(
    () => new Set(),
  );
  const holdTimerRef = useRef<number | null>(null);
  const rewindTimerRef = useRef<number | null>(null);
  const isHoldingRef = useRef(false);
  const daylightStyle = useDaylight(now);
  const hasSupplementalNotification = Boolean(omoideMemory);
  const frameLayoutStyle = useHomeFrameLayout(
    deskState,
    hasSupplementalNotification,
  );
  useHomeViewportBackground(daylightStyle);
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
  const homeDay = getHomeDayPresentation({
    eveningState,
    targetPhoto,
    now,
  });
  const homePhoto = homeDay.photo;
  const subNotifications = omoideMemory ? [omoideMemory] : [];
  const hasSplitTrayActions = homeDay.phase === "delivered" && subNotifications.length > 0;
  const hasTrayActions = homeDay.phase === "delivered" || subNotifications.length > 0;
  const usesTextRibbonTray = !hasTrayActions;
  const shouldHidePresence = true;
  useEffect(() => {
    trackDeskStateShown(deskState, eveningState.dateKey);
  }, [deskState, eveningState.dateKey]);

  useEffect(() => {
    if (!omoideMemory) {
      return;
    }

    trackProductEvent("omoide_arrival_shown", {
      memory_id: omoideMemory.id,
      lookback: omoideMemory.lookback,
    });
  }, [omoideMemory]);

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        window.clearTimeout(holdTimerRef.current);
      }
      if (rewindTimerRef.current) {
        window.clearTimeout(rewindTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (eveningState.kind === "delivered") {
      return;
    }

    setHoldProgress(false);
    setDevelopPhotoMounted(false);
    setIsRewindingHold(false);
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (rewindTimerRef.current) {
      window.clearTimeout(rewindTimerRef.current);
      rewindTimerRef.current = null;
    }
  }, [eveningState.kind]);

  function startHold(event: PointerEvent<HTMLButtonElement>) {
    if (eveningState.kind !== "delivered") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    beginHold();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best-effort; the hold state itself must still start.
    }
  }

  function startMouseHold(event: MouseEvent<HTMLButtonElement>) {
    if (eveningState.kind !== "delivered") {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    beginHold();
  }

  function beginHold() {
    if (eveningState.kind !== "delivered" || isHoldingRef.current) {
      return;
    }

    isHoldingRef.current = true;
    if (rewindTimerRef.current) {
      window.clearTimeout(rewindTimerRef.current);
      rewindTimerRef.current = null;
    }

    if (prefersReducedMotion) {
      void playOpenSound();
      onOpenDelivery(eveningState);
      return;
    }

    setDevelopPhotoMounted(true);
    setIsRewindingHold(false);
    setHoldProgress(true);
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
    }
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      isHoldingRef.current = false;
      setHoldProgress(false);
      void playOpenSound();
      onOpenDelivery(eveningState);
    }, HOLD_OPEN_MS);
  }

  function cancelHold(event?: PointerEvent<HTMLButtonElement>) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }

    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    isHoldingRef.current = false;
    setHoldProgress(false);
    if (developPhotoMounted) {
      setIsRewindingHold(true);
      if (rewindTimerRef.current) {
        window.clearTimeout(rewindTimerRef.current);
      }
      rewindTimerRef.current = window.setTimeout(() => {
        rewindTimerRef.current = null;
        setDevelopPhotoMounted(false);
        setIsRewindingHold(false);
      }, HOLD_REWIND_MS);
    }
  }

  function cancelMouseHold(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    cancelHold();
  }


  return (
    <section
      data-testid="home-desk-model"
      data-state={deskState}
      className={prefersReducedMotion ? "home-sky-shell" : "home-sky-shell home-sky-flow"}
      style={{
        ...deskStyles.page,
        ...daylightStyle,
        ...frameLayoutStyle,
      } as CSSProperties}
      aria-label="きょう"
    >
      <div style={deskStyles.viewportBackdrop} aria-hidden="true" />
      <div style={deskStyles.stage}>
        <div
          style={{
            ...deskStyles.homeHero,
            ...(deskState === "3" ? deskStyles.homeHeroDelivered : {}),
            ...(deskState === "4" ? deskStyles.homeHeroOpened : {}),
          }}
        >
          <div style={deskStyles.todayPhotoZone}>
            {homePhoto ? (
              <button
                type="button"
                data-testid="desk-home-frame"
                style={deskStyles.homeFrameButton}
                onClick={() =>
                  setViewerPhoto({
                    kind: "own",
                    photo: homePhoto,
                    dateKey: eveningState.dateKey,
                  })
                }
                aria-label={`${catName}のきょうのねがおを大きく見る`}
              >
                <span
                  style={{
                    ...deskStyles.homeFrame,
                    ...(deskState === "3" ? deskStyles.homeFrameDelivered : {}),
                  }}
                >
                  <StoredPhotoImage
                    src={getPhotoDisplaySrc(homePhoto)}
                    alt=""
                    style={deskStyles.homeFrameImage}
                  />
                  <span style={deskStyles.todayTag}>きょう</span>
                </span>
              </button>
            ) : (
              <button
                type="button"
                data-testid="desk-empty-frame"
                style={deskStyles.homeEmptyFrame}
                className={
                  prefersReducedMotion
                    ? "desk-frame-action"
                    : "desk-frame-action desk-frame-breathe"
                }
                onClick={onTakePhoto}
                aria-label={`${catName}の きょう、まだ。ねがおを とる`}
              >
                <SleepingCatPlaceholder />
                <span style={deskStyles.homeEmptyTitle}>
                  きょうの ねがお、まだ
                </span>
                <span style={deskStyles.homeEmptyAction}>
                  <AppIcon name="camera" size={16} />
                  ねがおを とる
                </span>
              </button>
            )}
          </div>

          <section
            data-testid="home-letter-tray"
            data-phase={homeDay.phase}
            style={{
              ...deskStyles.notificationTray,
              ...(usesTextRibbonTray ? deskStyles.notificationTrayRibbon : {}),
              ...(subNotifications.length > 0 && homeDay.phase !== "delivered"
                ? deskStyles.notificationTrayList
                : {}),
              ...(homeDay.phase === "delivered" ? deskStyles.notificationTrayDelivered : {}),
            }}
            className={
              homeDay.phase === "delivered" && !prefersReducedMotion
                ? "home-letter-tray-glow"
                : undefined
            }
            aria-label="ホームのお知らせ"
          >
            <div
              style={{
                ...deskStyles.notificationRows,
                ...(usesTextRibbonTray ? deskStyles.notificationRowsRibbon : {}),
                ...(hasSplitTrayActions ? deskStyles.notificationRowsSplit : {}),
                ...(subNotifications.length === 0
                  ? deskStyles.notificationRowsSingle
                  : {}),
              }}
            >
              {homeDay.phase === "delivered" ? (
                <button
                  type="button"
                  role="button"
                  data-testid="desk-open-letter"
                  aria-label="そっと ひらく"
                  style={{
                    ...deskStyles.notificationRow,
                    ...deskStyles.notificationRowPrimary,
                    ...(hasSplitTrayActions ? deskStyles.notificationRowSplitCard : {}),
                  }}
                  className={holdProgress ? "desk-letter-holding" : undefined}
                  onPointerDown={startHold}
                  onPointerUp={cancelHold}
                  onPointerCancel={cancelHold}
                  onPointerLeave={cancelHold}
                  onMouseDown={startMouseHold}
                  onMouseUp={cancelMouseHold}
                  onMouseLeave={cancelMouseHold}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      ...deskStyles.selectionLockedStage,
                      ...deskStyles.arrivedLetterButton,
                      ...deskStyles.trayLetterButton,
                      ...(hasSplitTrayActions ? deskStyles.trayLetterButtonCompact : {}),
                    }}
                  >
                    <span style={deskStyles.letterFlap} aria-hidden="true" />
                    <span
                      style={{ ...deskStyles.letterSeal, ...deskStyles.letterSealActive }}
                      aria-hidden="true"
                    />
                    {deliveredPhoto && developPhotoMounted ? (
                      <span
                        data-develop-photo="true"
                        style={{
                          ...deskStyles.selectionLockedStage,
                          ...deskStyles.developPhoto,
                          ...(isRewindingHold ? deskStyles.developPhotoRewinding : {}),
                        }}
                        aria-hidden="true"
                      >
                        <StoredPhotoImage
                          src={getPhotoDetailSrc(deliveredPhoto)}
                          alt=""
                          style={{
                            ...deskStyles.selectionLockedStage,
                            ...deskStyles.developImage,
                          }}
                        />
                      </span>
                    ) : null}
                  </span>
                  <div
                    style={{
                      ...deskStyles.letterTrayCopy,
                      ...(hasSplitTrayActions ? deskStyles.letterTrayCopySplit : {}),
                    }}
                  >
                    <strong
                      style={{
                        ...deskStyles.letterTrayTitle,
                        ...deskStyles.letterTrayTitlePrimary,
                        ...(hasSplitTrayActions ? deskStyles.notificationTitleSplit : {}),
                      }}
                    >
                      {hasSplitTrayActions ? "ねこだより" : "ねこだより、とどいた"}
                    </strong>
                    <span
                      style={{
                        ...deskStyles.letterTraySub,
                        ...deskStyles.letterTraySubPrimary,
                        ...(hasSplitTrayActions ? deskStyles.notificationActionSplit : {}),
                      }}
                    >
                      ひらく
                    </span>
                  </div>
                </button>
              ) : homeDay.phase === "opened" ? (
                <a
                  href="/collection"
                  style={{
                    ...deskStyles.notificationRow,
                    ...deskStyles.notificationRowText,
                    ...deskStyles.notificationRowLink,
                    ...(usesTextRibbonTray ? deskStyles.notificationRowTextRibbon : {}),
                  }}
                >
                  <HomeLetterTrayText phase={homeDay.phase} />
                </a>
              ) : (
                <div
                  style={{
                    ...deskStyles.notificationRow,
                    ...deskStyles.notificationRowText,
                    ...(usesTextRibbonTray ? deskStyles.notificationRowTextRibbon : {}),
                  }}
                >
                  <HomeLetterTrayText phase={homeDay.phase} />
                </div>
              )}
              {subNotifications.slice(0, 2).map((memory) => (
                <button
                  key={memory.id}
                  type="button"
                  data-testid="omoide-arrival-letter"
                  style={{
                    ...deskStyles.notificationRow,
                    ...deskStyles.notificationRowInteractive,
                    ...(hasSplitTrayActions ? deskStyles.notificationRowSplitCard : {}),
                  }}
                  onClick={() => {
                    onOpenOmoideMemory?.(memory);
                    window.location.assign("/cats#omoide");
                  }}
                  aria-label="思い出が、とどきました。うちのこで見る"
                >
                  <span style={deskStyles.notificationThumb} aria-hidden="true">
                    <StoredPhotoImage
                      src={getPhotoDisplaySrc(memory.photo)}
                      alt=""
                      style={deskStyles.notificationThumbImage}
                    />
                  </span>
                  <span
                    style={{
                      ...deskStyles.notificationText,
                      ...(hasSplitTrayActions ? deskStyles.notificationTextSplit : {}),
                    }}
                  >
                    <span
                      style={{
                        ...deskStyles.notificationTitle,
                        ...(hasSplitTrayActions ? deskStyles.notificationTitleSplit : {}),
                      }}
                    >
                      {hasSplitTrayActions ? "思い出" : "思い出が、とどきました"}
                    </span>
                    <span
                      style={{
                        ...deskStyles.notificationAction,
                        ...(hasSplitTrayActions ? deskStyles.notificationActionSplit : {}),
                      }}
                    >
                      うちのこで みる
                    </span>
                  </span>
                </button>
              ))}
              {subNotifications.length > 2 ? (
                <div style={deskStyles.notificationMoreRow}>
                  ほか {subNotifications.length - 2} 件
                </div>
              ) : null}
            </div>
          </section>
        </div>

      </div>

      {!shouldHidePresence ? (
        <p style={deskStyles.presence}>
          きょうも、{sleepingCounter}ひきの ねこが ねています
        </p>
      ) : null}

      <BottomNavigation active="today" homeVariant="desk" homeState={deskState} />

      {viewerPhoto ? (
        <DeskPhotoViewer
          viewerPhoto={viewerPhoto}
          onClose={() => setViewerPhoto(null)}
          onSave={() => {
            if (viewerPhoto.kind === "other") {
              onKeepOpenedDelivery(viewerPhoto.dateKey, viewerPhoto.photo);
            }
          }}
          onReport={(reason) => {
            if (viewerPhoto.kind !== "other") {
              return;
            }
            onReportOpenedDelivery(viewerPhoto.dateKey, viewerPhoto.photo, reason);
            setReportedDeliveredIds((current) => {
              const next = new Set(current);
              next.add(getExchangePhotoIdentity(viewerPhoto.photo));
              return next;
            });
            setViewerPhoto(null);
          }}
        />
      ) : null}

      {openingOmoideMemory ? (
        <OmoideMemoryViewer
          memory={openingOmoideMemory}
          alreadyRecordedToday={Boolean(targetPhoto)}
          onClose={() => setOpeningOmoideMemory(null)}
          onDismiss={() => {
            onDismissOmoideMemory?.(openingOmoideMemory);
            setOpeningOmoideMemory(null);
          }}
          onCue={() => {
            trackProductEvent(
              "omoide_cue_tapped",
              { led_to_capture: !targetPhoto },
              { localCatId: openingOmoideMemory.catId },
            );
            setOpeningOmoideMemory(null);
            if (!targetPhoto) {
              onTakePhoto();
            }
          }}
        />
      ) : null}

      <style>{`
        @keyframes deskFrameBreathe {
          0%, 100% { box-shadow: var(--shadow-e1); }
          50% { box-shadow: var(--shadow-e2); }
        }
        @keyframes deskEveningSoonCopyIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes homeSkyFlow {
          0% {
            --home-sky-glow-x: 38%;
            --home-sky-glow-y: 7%;
            background-position: 50% 50%, 50% 50%, 38% 7%, 50% 50%;
            filter: saturate(1);
          }
          50% {
            --home-sky-glow-x: 62%;
            --home-sky-glow-y: 18%;
            background-position: 50% 50%, 50% 50%, 62% 18%, 50% 50%;
            filter: saturate(1.045);
          }
          100% {
            --home-sky-glow-x: 46%;
            --home-sky-glow-y: 28%;
            background-position: 50% 50%, 50% 50%, 46% 28%, 50% 50%;
            filter: saturate(1.02);
          }
        }
        @keyframes homeSkyBreath {
          0% {
            filter: brightness(0.985) saturate(1);
          }
          100% {
            filter: brightness(1.025) saturate(1.025);
          }
        }
        .home-sky-shell::before {
          content: "";
          position: fixed;
          z-index: 0;
          pointer-events: none;
          top: 0;
          left: 0;
          right: 0;
          height: calc(env(safe-area-inset-top) + 64px);
          background: var(--home-status-scrim, transparent);
        }
        .home-sky-flow {
          background-size: 150% 150%, 100% 100%;
          animation: homeSkyFlow var(--home-sky-motion-duration, 52s) var(--ease-gentle) infinite alternate;
        }
        .desk-frame-breathe {
          animation: deskFrameBreathe calc(var(--dur-move) * 10) var(--ease-gentle) infinite;
        }
        .desk-frame-action:active {
          transform: scale(0.96);
          box-shadow: var(--shadow-e1) !important;
        }
        .desk-evening-soon-copy {
          animation: deskEveningSoonCopyIn 1200ms var(--ease-gentle) both;
        }
        .home-letter-tray-glow {
          animation: homeLetterTrayGlow 2200ms var(--ease-gentle) infinite alternate;
        }
        @keyframes homeLetterTrayGlow {
          from {
            filter: brightness(1);
          }
          to {
            filter: brightness(1.035);
          }
        }
        .desk-letter-holding [data-develop-photo="true"] {
          opacity: 1 !important;
          filter: blur(0) !important;
          transform: scale(1) !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .desk-frame-breathe,
          .desk-evening-soon-copy,
          .home-letter-tray-glow {
            animation: none;
            filter: none;
          }
          .home-sky-shell {
            animation: homeSkyBreath var(--home-sky-reduced-motion-duration, 42s) var(--ease-gentle) infinite alternate;
          }
          .desk-letter-holding [data-develop-photo="true"] {
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}

function OmoideMemoryViewer({
  memory,
  alreadyRecordedToday,
  onClose,
  onDismiss,
  onCue,
}: {
  memory: OmoideMemory;
  alreadyRecordedToday: boolean;
  onClose: () => void;
  onDismiss: () => void;
  onCue: () => void;
}) {
  return (
    <div
      data-testid="omoide-memory-viewer"
      style={deskStyles.omoideViewerBackdrop}
      onClick={onClose}
    >
      <section
        style={deskStyles.omoideViewerPanel}
        aria-label="思い出が、とどきました"
        onClick={(event) => event.stopPropagation()}
      >
        <p style={deskStyles.omoideViewerKicker}>思い出が、とどきました</p>
        <h2 style={deskStyles.omoideViewerTitle}>{memory.title}</h2>
        <p style={deskStyles.omoideViewerDate}>
          {formatOmoideDate(memory.sourceDateKey)}
        </p>
        <div style={deskStyles.omoideViewerImageFrame}>
          <StoredPhotoImage
            src={getPhotoDetailSrc(memory.photo)}
            alt=""
            style={deskStyles.omoideViewerImage}
          />
        </div>
        <p style={deskStyles.omoideViewerVoice}>{memory.voice}</p>
        <p style={deskStyles.omoideViewerBridge}>{memory.bridge}</p>
        <p style={deskStyles.omoideViewerQuestion}>
          きょうの {memory.catName}は、どんな ねがお？
        </p>
        <AppButton
          type="button"
          variant="primary"
          fullWidth
          style={deskStyles.omoideViewerButton}
          onClick={onCue}
        >
          {alreadyRecordedToday
            ? `きょうの ${memory.catName}を みる`
            : `いまの ${memory.catName}を のこす`}
        </AppButton>
        <AppButton
          type="button"
          variant="quiet"
          onClick={onDismiss}
        >
          そっと しまう
        </AppButton>
      </section>
      <style>{`
        [data-testid="omoide-memory-viewer"] img {
          animation: omoideDevelop var(--dur-develop) var(--ease-settle) both;
        }
        @keyframes omoideDevelop {
          from { opacity: 0; filter: blur(14px); transform: scale(0.985) rotate(-1deg); }
          to { opacity: 1; filter: blur(0); transform: scale(1) rotate(-1deg); }
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

function DeskPhotoViewer({
  viewerPhoto,
  onClose,
  onSave,
  onReport,
}: {
  viewerPhoto: DeskViewerPhoto;
  onClose: () => void;
  onSave: () => void;
  onReport: (reason: ExchangePhotoReportReason) => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isReportSheetOpen, setIsReportSheetOpen] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");

  async function handleSave() {
    onSave();
    await savePhotoToDevice(viewerPhoto.photo);
    setSaveState("saved");
    window.setTimeout(() => {
      setSaveState("idle");
    }, 2000);
  }

  return (
    <div
      data-testid="desk-photo-viewer"
      style={deskStyles.viewerBackdrop}
      onClick={onClose}
    >
      <section
        style={deskStyles.viewerPanel}
        aria-label={
          viewerPhoto.kind === "other"
            ? "どこかのこの写真"
            : "うちのこの写真"
        }
        onClick={(event) => event.stopPropagation()}
      >
        <AppButton
          type="button"
          variant="quiet"
          size="sm"
          style={deskStyles.viewerCloseButton}
          onClick={onClose}
          aria-label="閉じる"
        >
          閉じる
        </AppButton>
        {viewerPhoto.kind === "other" ? (
          <div style={deskStyles.viewerMenuWrap}>
            <AppButton
              type="button"
              variant="ghost"
              size="icon"
              iconOnly
              aria-label="写真のメニュー"
              onClick={() => setIsMenuOpen((open) => !open)}
            >
              …
            </AppButton>
            {isMenuOpen ? (
              <AppCard as="div" variant="floating" padding="sm" style={deskStyles.viewerMenuSheet}>
                <AppButton
                  type="button"
                  variant="quiet"
                  size="sm"
                  fullWidth
                  style={deskStyles.viewerMenuItem}
                  onClick={() => {
                    setIsMenuOpen(false);
                    setIsReportSheetOpen(true);
                  }}
                >
                  この写真を報告
                </AppButton>
                <AppButton
                  type="button"
                  variant="quiet"
                  size="sm"
                  fullWidth
                  style={deskStyles.viewerMenuItem}
                  onClick={() => setIsMenuOpen(false)}
                >
                  キャンセル
                </AppButton>
              </AppCard>
            ) : null}
          </div>
        ) : null}
        <PhotoViewerFrame
          src={getPhotoDetailSrc(viewerPhoto.photo)}
          alt=""
          fit="contain"
          style={deskStyles.viewerImageFrame}
          imageStyle={deskStyles.viewerImage}
        />
        <AppButton
          type="button"
          variant="secondary"
          size="lg"
          fullWidth
          style={{
            ...deskStyles.viewerSaveButtonLayout,
            ...(saveState === "saved" ? deskStyles.viewerSaveButtonSaved : {}),
          }}
          onClick={handleSave}
        >
          {saveState === "saved" ? "とっておいた" : "とっておく"}
        </AppButton>
      </section>
      {isReportSheetOpen && viewerPhoto.kind === "other" ? (
        <AppSheet
          placement="bottom"
          title={"この写真を報告"}
          onClose={() => setIsReportSheetOpen(false)}
        >
          <div style={deskStyles.reportSheetActions}>
            <AppButton
              type="button"
              variant="danger"
              fullWidth
              onClick={() => onReport("not_cat")}
            >
              ねこの写真ではない
            </AppButton>
            <AppButton
              type="button"
              variant="danger"
              fullWidth
              onClick={() => onReport("uncomfortable")}
            >
              不快な内容
            </AppButton>
            <AppButton
              type="button"
              variant="danger"
              fullWidth
              onClick={() => onReport("other")}
            >
              その他
            </AppButton>
            <AppButton
              type="button"
              variant="quiet"
              fullWidth
              onClick={() => setIsReportSheetOpen(false)}
            >
              キャンセル
            </AppButton>
          </div>
        </AppSheet>
      ) : null}
    </div>
  );
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

function useDaylight(now: number) {
  const minuteKey = Math.floor(now / 60000);
  return useMemo(() => {
    const timestamp = minuteKey * 60000;
    const colors = getDaylightColors(timestamp);
    const skyImage = getHomeBackgroundImage(timestamp);
    return {
      "--home-sky-image": skyImage,
      "--home-sky-top": colors.skyTop,
      "--home-sky-mid": colors.skyMid,
      "--home-sky-bottom": colors.skyBottom,
      "--home-sky-glow": colors.glow,
      "--home-frame-light": colors.mat,
      "--home-frame-glow": colors.glow,
      "--home-page-padding-x": HOME_FRAME_TUNING.pagePaddingX,
      "--home-page-padding-top": HOME_FRAME_TUNING.pagePaddingTop,
      "--home-stage-max-width": HOME_FRAME_TUNING.stageMaxWidth,
      "--home-stage-gap": HOME_FRAME_TUNING.stageGap,
      "--home-hero-gap": HOME_FRAME_TUNING.heroGap,
      "--home-frame-mat-width": HOME_FRAME_TUNING.matWidth,
      "--home-frame-aspect-ratio": HOME_FRAME_TUNING.frameAspectRatio,
      "--home-empty-frame-aspect-ratio": HOME_FRAME_TUNING.emptyFrameAspectRatio,
      "--home-empty-frame-max-height": HOME_FRAME_TUNING.emptyFrameMaxHeight,
      "--home-frame-radius": HOME_FRAME_TUNING.outerRadius,
      "--home-frame-inner-radius": HOME_FRAME_TUNING.innerRadius,
      "--home-frame-shadow": HOME_FRAME_TUNING.frameShadow,
      "--home-frame-hairline": HOME_FRAME_TUNING.frameHairline,
      "--home-sky-motion-duration": HOME_FRAME_TUNING.skyMotionDuration,
      "--home-sky-reduced-motion-duration":
        HOME_FRAME_TUNING.skyReducedMotionDuration,
      "--home-status-scrim": HOME_FRAME_TUNING.statusScrim,
      "--home-wax": HOME_FRAME_TUNING.wax,
      "--home-empty-frame-start": HOME_FRAME_TUNING.emptyFrameStart,
      "--home-empty-frame-end": HOME_FRAME_TUNING.emptyFrameEnd,
      "--home-tray-paper": HOME_FRAME_TUNING.trayPaper,
      "--home-tray-radius": HOME_FRAME_TUNING.trayRadius,
      "--home-tray-min-height": HOME_FRAME_TUNING.trayMinHeight,
      "--home-tray-to-nav-gap": HOME_FRAME_TUNING.trayToNavGap,
      "--home-frame-layout-width": HOME_FRAME_TUNING.frameInitialWidth,
      "--home-empty-illustration-width": HOME_FRAME_TUNING.emptyIllustrationWidth,
      "--home-empty-illustration-min-width":
        HOME_FRAME_TUNING.emptyIllustrationMinWidth,
      "--home-empty-title-size": HOME_FRAME_TUNING.emptyTitleSize,
      "--home-empty-action-size": HOME_FRAME_TUNING.emptyActionSize,
      "--home-sky-glow-x": "50%",
      "--home-sky-glow-y": "12%",
      "--home-daylight-transition": HOME_FRAME_TUNING.daylightTransition,
    } as HomeDaylightStyle;
  }, [minuteKey]);
}

function useHomeFrameLayout(
  deskState: DeskState,
  hasSupplementalNotification: boolean,
): HomeFrameLayoutStyle {
  const [frameWidth, setFrameWidth] = useState<string>(
    HOME_FRAME_TUNING.frameInitialWidth,
  );

  useLayoutEffect(() => {
    let frame = 0;

    const readPixels = (value: string | null | undefined, fallback = 0) => {
      if (!value) {
        return fallback;
      }
      const parsed = Number.parseFloat(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    const updateFrameWidth = () => {
      const pageElement = document.querySelector<HTMLElement>(
        "[data-testid='home-desk-model']",
      );
      const trayElement = document.querySelector<HTMLElement>(
        "[data-testid='home-letter-tray']",
      );
      const navElement = document.querySelector<HTMLElement>("nav");
      if (!pageElement || !trayElement || !navElement) {
        return;
      }

      const pageStyle = getComputedStyle(pageElement);
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const paddingTop = readPixels(pageStyle.paddingTop);
      const paddingX =
        readPixels(pageStyle.paddingLeft) + readPixels(pageStyle.paddingRight);
      const stageMaxWidth = readPixels(
        pageStyle.getPropertyValue("--home-stage-max-width"),
        460,
      );
      const stageWidth = Math.max(
        0,
        Math.min(viewportWidth - paddingX, stageMaxWidth),
      );
      const trayHeight =
        trayElement.getBoundingClientRect().height ||
        readPixels(pageStyle.getPropertyValue("--home-tray-min-height"), 104);
      const trayToNavGap = readPixels(
        pageStyle.getPropertyValue("--home-tray-to-nav-gap"),
        32,
      ) + (hasSupplementalNotification ? 20 : 0);
      const heroGap =
        deskState === "3" || deskState === "4"
          ? 18
          : readPixels(pageStyle.getPropertyValue("--home-hero-gap"), 10);
      const navTop = navElement.getBoundingClientRect().top;
      const availableFrameHeight =
        navTop - paddingTop - trayHeight - heroGap - trayToNavGap;
      const widthFromHeight =
        availableFrameHeight * HOME_FRAME_TUNING.frameAspectWidthPerHeight;
      const nextWidth = Math.round(
        Math.max(
          hasSupplementalNotification ? 220 : HOME_FRAME_TUNING.frameMinWidthPx,
          Math.min(stageWidth, widthFromHeight),
        ),
      );

      if (!Number.isFinite(nextWidth) || nextWidth <= 0) {
        return;
      }

      setFrameWidth((current) => {
        const next = `${nextWidth}px`;
        return current === next ? current : next;
      });
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateFrameWidth);
    };

    updateFrameWidth();
    window.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("resize", scheduleUpdate);
    window.visualViewport?.addEventListener("scroll", scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("resize", scheduleUpdate);
      window.visualViewport?.removeEventListener("scroll", scheduleUpdate);
    };
  }, [deskState, hasSupplementalNotification]);

  return useMemo(
    () => ({ "--home-frame-layout-width": frameWidth }),
    [frameWidth],
  );
}

function useHomeViewportBackground(daylightStyle: HomeDaylightStyle) {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const themeMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    const propertyNames = [
      "--home-sky-top",
      "--home-sky-mid",
      "--home-sky-bottom",
      "--home-sky-glow",
      "--home-frame-light",
      "--home-frame-glow",
      "--home-status-scrim",
      "--home-sky-image",
      "--home-wax",
      "--home-empty-frame-start",
      "--home-empty-frame-end",
      "--home-tray-paper",
      "--home-tray-radius",
      "--home-tray-min-height",
      "--home-tray-to-nav-gap",
      "--home-empty-frame-aspect-ratio",
      "--home-empty-frame-max-height",
      "--home-empty-illustration-width",
      "--home-empty-illustration-min-width",
      "--home-empty-title-size",
      "--home-empty-action-size",
      "--home-sky-glow-x",
      "--home-sky-glow-y",
    ] as const;
    const previousRootBackground = root.style.background;
    const previousBodyBackground = body.style.background;
    const previousRootBackgroundSize = root.style.backgroundSize;
    const previousBodyBackgroundSize = body.style.backgroundSize;
    const previousRootBackgroundPosition = root.style.backgroundPosition;
    const previousBodyBackgroundPosition = body.style.backgroundPosition;
    const previousRootBackgroundRepeat = root.style.backgroundRepeat;
    const previousBodyBackgroundRepeat = body.style.backgroundRepeat;
    const previousRootBackgroundColor = root.style.backgroundColor;
    const previousBodyBackgroundColor = body.style.backgroundColor;
    const previousRootHeight = root.style.height;
    const previousBodyHeight = body.style.height;
    const previousRootMinHeight = root.style.minHeight;
    const previousBodyMinHeight = body.style.minHeight;
    const previousRootOverflowY = root.style.overflowY;
    const previousBodyOverflowY = body.style.overflowY;
    const previousBodyPosition = body.style.position;
    const previousBodyInset = body.style.inset;
    const previousBodyWidth = body.style.width;
    const previousThemeColor = themeMeta?.getAttribute("content") ?? null;

    propertyNames.forEach((name) => {
      const value = daylightStyle[name];
      if (typeof value === "string") {
        root.style.setProperty(name, value);
        body.style.setProperty(name, value);
      }
    });

    root.style.background = HOME_SKY_BACKGROUND;
    body.style.background = HOME_SKY_BACKGROUND;
    root.style.backgroundSize = HOME_SKY_BACKGROUND_SIZE;
    body.style.backgroundSize = HOME_SKY_BACKGROUND_SIZE;
    root.style.backgroundPosition = HOME_SKY_BACKGROUND_POSITION;
    body.style.backgroundPosition = HOME_SKY_BACKGROUND_POSITION;
    root.style.backgroundRepeat = "no-repeat";
    body.style.backgroundRepeat = "no-repeat";
    root.style.backgroundColor = daylightStyle["--home-sky-bottom"] ?? "";
    body.style.backgroundColor = daylightStyle["--home-sky-bottom"] ?? "";
    root.style.height = "100dvh";
    body.style.height = "100dvh";
    root.style.minHeight = "100dvh";
    body.style.minHeight = "100dvh";
    root.style.overflowY = "hidden";
    body.style.overflowY = "hidden";
    body.style.position = "fixed";
    body.style.inset = "0";
    body.style.width = "100%";

    const themeColor = daylightStyle["--home-sky-top"];
    if (themeMeta && typeof themeColor === "string") {
      themeMeta.setAttribute("content", themeColor);
    }

    return () => {
      propertyNames.forEach((name) => {
        root.style.removeProperty(name);
        body.style.removeProperty(name);
      });
      root.style.background = previousRootBackground;
      body.style.background = previousBodyBackground;
      root.style.backgroundSize = previousRootBackgroundSize;
      body.style.backgroundSize = previousBodyBackgroundSize;
      root.style.backgroundPosition = previousRootBackgroundPosition;
      body.style.backgroundPosition = previousBodyBackgroundPosition;
      root.style.backgroundRepeat = previousRootBackgroundRepeat;
      body.style.backgroundRepeat = previousBodyBackgroundRepeat;
      root.style.backgroundColor = previousRootBackgroundColor;
      body.style.backgroundColor = previousBodyBackgroundColor;
      root.style.height = previousRootHeight;
      body.style.height = previousBodyHeight;
      root.style.minHeight = previousRootMinHeight;
      body.style.minHeight = previousBodyMinHeight;
      root.style.overflowY = previousRootOverflowY;
      body.style.overflowY = previousBodyOverflowY;
      body.style.position = previousBodyPosition;
      body.style.inset = previousBodyInset;
      body.style.width = previousBodyWidth;
      if (themeMeta) {
        if (previousThemeColor) {
          themeMeta.setAttribute("content", previousThemeColor);
        } else {
          themeMeta.removeAttribute("content");
        }
      }
    };
  }, [daylightStyle]);
}

function getDeskState(eveningState: EveningHomeState): DeskState {
  if (eveningState.kind === "waiting") return "2";
  if (eveningState.kind === "delivered") return "3";
  if (eveningState.kind === "opened") return "4";
  return eveningState.isTodayDelivery ? "1" : "1b";
}

function getHomeDayPresentation({
  eveningState,
  targetPhoto,
  now,
}: {
  eveningState: EveningHomeState;
  targetPhoto: OwnSleepingPhoto | null;
  now: number;
}): {
  phase: HomeTodayPhase;
  photo: OwnSleepingPhoto | null;
} {
  const afterDelivery = getJstMinuteOfDay(now) >= 20 * 60;

  if (eveningState.kind === "delivered") {
    return {
      phase: "delivered",
      photo: targetPhoto,
    };
  }

  if (eveningState.kind === "opened") {
    return {
      phase: "opened",
      photo: targetPhoto,
    };
  }

  if (targetPhoto) {
    if (eveningState.kind === "waiting" && !eveningState.isTodayDelivery) {
      return {
        phase: "late-sent",
        photo: targetPhoto,
      };
    }

    return {
      phase: "sent-before",
      photo: targetPhoto,
    };
  }

  if (afterDelivery || eveningState.kind === "before" && eveningState.afterTodayDelivery) {
    return {
      phase: "empty-after",
      photo: null,
    };
  }

  return {
    phase: "empty-before",
    photo: null,
  };
}

function HomeLetterTrayText({ phase }: { phase: HomeTodayPhase }) {
  const keyword = (children: ReactNode) => (
    <span style={deskStyles.letterTrayKeyword}>{children}</span>
  );

  if (phase === "opened") {
    return (
      <strong style={deskStyles.letterTrayTitle}>
        きょうの {keyword("ねこだより")} →
      </strong>
    );
  }

  if (phase === "late-sent" || phase === "empty-after") {
    return (
      <>
        <strong style={deskStyles.letterTrayTitle}>きょうは とどかない</strong>
        <span style={deskStyles.letterTraySub}>また あした</span>
      </>
    );
  }

  if (phase === "sent-before") {
    return (
      <>
        <strong style={deskStyles.letterTrayTitle}>おくった</strong>
        <span style={deskStyles.letterTraySub}>
          よる8時に {keyword("とどく")}
        </span>
      </>
    );
  }

  return (
    <strong style={deskStyles.letterTrayTitle}>
      <span style={deskStyles.letterTrayLine}>とると、よる8時に</span>
      <span style={deskStyles.letterTrayLine}>
        {keyword("ねこだより")}が {keyword("とどく")}
      </span>
    </strong>
  );
}

function SleepingCatPlaceholder() {
  return (
    <img
      src="/illustrations/sleeping-cat-empty.png"
      alt=""
      aria-hidden="true"
      style={deskStyles.sleepingCatPlaceholder}
      draggable={false}
    />
  );
}

function getDaylightColors(now: number) {
  const minute = getJstMinuteOfDay(now);

  if (minute < HOME_DAYLIGHT_ANCHORS[0].minute) {
    return HOME_DAYLIGHT_ANCHORS[HOME_DAYLIGHT_ANCHORS.length - 1];
  }

  for (let index = 0; index < HOME_DAYLIGHT_ANCHORS.length - 1; index += 1) {
    const start = HOME_DAYLIGHT_ANCHORS[index];
    const end = HOME_DAYLIGHT_ANCHORS[index + 1];
    if (minute >= start.minute && minute <= end.minute) {
      const progress = (minute - start.minute) / (end.minute - start.minute);
      return interpolateDaylightAnchor(start, end, progress);
    }
  }

  return HOME_DAYLIGHT_ANCHORS[HOME_DAYLIGHT_ANCHORS.length - 1];
}

function getHomeBackgroundImage(now: number) {
  const minute = getJstMinuteOfDay(now);

  if (minute < 5 * 60 + 45) {
    return HOME_BACKGROUND_IMAGES.night;
  }
  if (minute < 8 * 60) {
    return HOME_BACKGROUND_IMAGES.dawn;
  }
  if (minute < 11 * 60) {
    return HOME_BACKGROUND_IMAGES.morning;
  }
  if (minute < 16 * 60 + 30) {
    return HOME_BACKGROUND_IMAGES.noon;
  }
  if (minute < 21 * 60) {
    return HOME_BACKGROUND_IMAGES.evening;
  }
  return HOME_BACKGROUND_IMAGES.night;
}

function interpolateDaylightAnchor(
  from: (typeof HOME_DAYLIGHT_ANCHORS)[number],
  to: (typeof HOME_DAYLIGHT_ANCHORS)[number],
  progress: number,
) {
  return {
    skyTop: interpolateHexColor(from.skyTop, to.skyTop, progress),
    skyMid: interpolateHexColor(from.skyMid, to.skyMid, progress),
    skyBottom: interpolateHexColor(from.skyBottom, to.skyBottom, progress),
    mat: interpolateHexColor(from.mat, to.mat, progress),
    glow: interpolateHexColor(from.glow, to.glow, progress),
  };
}

function getJstMinuteOfDay(timestamp: number) {
  const date = new Date(timestamp + 9 * 60 * 60 * 1000);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function interpolateHexColor(from: string, to: string, progress: number) {
  const fromRgb = parseHexColor(from);
  const toRgb = parseHexColor(to);
  return `rgb(${fromRgb
    .map((channel, index) =>
      Math.round(channel + (toRgb[index] - channel) * progress),
    )
    .join(", ")})`;
}

function parseHexColor(hex: string) {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
}

function getPhotoDisplaySrc(
  photo: Pick<
    OwnSleepingPhoto | ExchangePhoto,
    "src" | "thumbnailSrc" | "displaySrc" | "originalSrc"
  >,
) {
  return photo.displaySrc ?? photo.thumbnailSrc ?? photo.src;
}

function getPhotoDetailSrc(
  photo: Pick<
    OwnSleepingPhoto | ExchangePhoto,
    "src" | "displaySrc" | "originalSrc"
  >,
) {
  return photo.originalSrc ?? photo.displaySrc ?? photo.src;
}

async function savePhotoToDevice(
  photo: Pick<OwnSleepingPhoto | ExchangePhoto, "id" | "src" | "displaySrc" | "originalSrc">,
) {
  const src = getPhotoDetailSrc(photo);
  const blob = await readPhotoBlob(src);

  if (blob) {
    const file = new File([blob], `${photo.id || "neteruneko"}.jpg`, {
      type: blob.type || "image/jpeg",
    });
    const shareNavigator = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };

    if (
      shareNavigator.share &&
      (!shareNavigator.canShare || shareNavigator.canShare({ files: [file] }))
    ) {
      await shareNavigator.share({ files: [file], title: "ねてるねこ" });
      return "share" as const;
    }

    triggerDownload(URL.createObjectURL(blob), `${photo.id || "neteruneko"}.jpg`, true);
    return "download" as const;
  }

  triggerDownload(src, `${photo.id || "neteruneko"}.jpg`);
  return "download" as const;
}

async function readPhotoBlob(src: string) {
  try {
    if (src.startsWith("data:image/")) {
      const response = await fetch(src);
      return await response.blob();
    }

    if (src.startsWith("http://") || src.startsWith("https://")) {
      const response = await fetch(src);
      return response.ok ? await response.blob() : null;
    }
  } catch {
    return null;
  }

  return null;
}

function triggerDownload(src: string, fileName: string, revoke = false) {
  const anchor = document.createElement("a");
  anchor.href = src;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  if (revoke) {
    window.setTimeout(() => URL.revokeObjectURL(src), 5000);
  }
}

function getExchangePhotoIdentity(photo: Pick<ExchangePhoto, "id" | "sourcePhotoId">) {
  return photo.sourcePhotoId ?? photo.id;
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

function formatOmoideDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) {
    return dateKey;
  }

  const weekday = ["日", "月", "火", "水", "木", "金", "土"][
    new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  ];
  return `${year}年${month}月${day}日 ・ ${weekday}よう日`;
}

const deskStyles = {
  page: {
    position: "fixed",
    inset: 0,
    width: "100%",
    minHeight: "auto",
    height: "auto",
    maxHeight: "none",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding:
      "calc(var(--home-page-padding-top, 10px) + env(safe-area-inset-top)) var(--home-page-padding-x, 16px) calc(var(--bottom-nav-height) + var(--bottom-nav-safe-offset) + var(--home-tray-to-nav-gap, 32px))",
    color: "var(--ink)",
    background: HOME_SKY_BACKGROUND,
    backgroundSize: HOME_SKY_BACKGROUND_SIZE,
    backgroundPosition: HOME_SKY_BACKGROUND_POSITION,
    backgroundRepeat: "no-repeat",
    transition:
      "background var(--home-daylight-transition, 1800ms) var(--ease-gentle)",
  },
  viewportBackdrop: {
    position: "fixed",
    zIndex: 0,
    pointerEvents: "none",
    top: "calc(-1 * env(safe-area-inset-top))",
    right: 0,
    bottom: "calc(-1 * env(safe-area-inset-bottom))",
    left: 0,
    background: HOME_SKY_BACKGROUND,
    backgroundColor: "var(--home-sky-bottom)",
    backgroundSize: HOME_SKY_BACKGROUND_SIZE,
    backgroundPosition: HOME_SKY_BACKGROUND_POSITION,
    backgroundRepeat: "no-repeat",
    transition:
      "background var(--home-daylight-transition, 1800ms) var(--ease-gentle)",
  },
  stage: {
    position: "relative",
    zIndex: 1,
    flex: 1,
    width: "min(100%, var(--home-stage-max-width, 430px))",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "var(--home-stage-gap, 14px)",
    paddingTop: "0",
  },
  homeHero: {
    width: "100%",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "var(--home-hero-gap, 14px)",
  },
  homeHeroDelivered: {
    gap: "18px",
  },
  homeHeroOpened: {
    gap: "18px",
  },
  todayPhotoZone: {
    width: "100%",
    display: "grid",
    justifyItems: "center",
  },
  homeFrameButton: {
    display: "grid",
    justifyItems: "center",
    width: "100%",
    border: "none",
    padding: 0,
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  homeFrame: {
    position: "relative",
    display: "block",
    width: "min(100%, var(--home-frame-layout-width, 100%))",
    margin: "0 auto",
    boxSizing: "border-box",
    aspectRatio: "var(--home-frame-aspect-ratio, 9 / 14)",
    padding: "var(--home-frame-mat-width, 12px)",
    borderRadius: "var(--home-frame-radius, var(--radius-2xl))",
    background: "transparent",
    boxShadow: "var(--home-frame-shadow)",
    overflow: "hidden",
    transition:
      "background var(--home-daylight-transition, 1800ms) var(--ease-gentle), box-shadow var(--home-daylight-transition, 1800ms) var(--ease-gentle)",
  },
  homeFrameDelivered: {
    width: "min(92%, 320px)",
  },
  homeFrameImage: {
    width: "100%",
    height: "100%",
    borderRadius: "var(--home-frame-inner-radius, var(--radius-lg))",
    objectFit: "contain",
    objectPosition: "center",
    background:
      "color-mix(in srgb, var(--home-frame-light, var(--paper)) 24%, transparent)",
    boxShadow: "var(--home-frame-hairline)",
  },
  todayTag: {
    position: "absolute",
    top: "12px",
    left: "12px",
    minHeight: "28px",
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 10px",
    borderRadius: "var(--radius-full)",
    background: "color-mix(in srgb, var(--paper-card) 76%, transparent)",
    color: "var(--ink)",
    fontFamily: "var(--font-ui)",
    fontSize: "12px",
    fontWeight: 500,
    letterSpacing: "var(--tracking-label)",
    boxShadow:
      "0 0 0 1px color-mix(in srgb, var(--line) 72%, transparent) inset",
  },
  homeEmptyFrame: {
    width: "min(100%, var(--home-frame-layout-width, 100%))",
    aspectRatio: "var(--home-empty-frame-aspect-ratio, 9 / 14)",
    maxHeight: "var(--home-empty-frame-max-height, 660px)",
    boxSizing: "border-box",
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    gap: "14px",
    padding: "28px 24px 40px",
    border: "none",
    outline: "1px solid rgba(160, 130, 90, 0.12)",
    borderRadius: "var(--home-frame-radius, var(--radius-2xl))",
    background:
      "radial-gradient(125% 95% at 50% 32%, var(--home-empty-frame-start, #fbf5ea), var(--home-empty-frame-end, #f1e7d6))",
    color: "var(--ink-soft)",
    boxShadow:
      "inset 0 2px 18px rgba(150, 110, 70, 0.10), 0 18px 48px -26px color-mix(in srgb, var(--home-frame-glow, var(--paper-warm)) 48%, transparent)",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    transition:
      "background var(--home-daylight-transition, 1800ms) var(--ease-gentle), box-shadow var(--home-daylight-transition, 1800ms) var(--ease-gentle)",
  },
  homeEmptyTitle: {
    color: "var(--ink)",
    fontFamily: "var(--font-display)",
    fontSize: "var(--home-empty-title-size, 20px)",
    letterSpacing: "var(--tracking-label)",
  },
  homeEmptyAction: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    minHeight: "40px",
    padding: "0 4px",
    color: "var(--home-wax, #c2745a)",
    fontFamily: "var(--font-ui)",
    fontSize: "var(--home-empty-action-size, 14px)",
    fontWeight: 500,
    letterSpacing: "var(--tracking-body)",
  },
  sleepingCatPlaceholder: {
    width: "var(--home-empty-illustration-width, min(36vw, 124px))",
    maxWidth: "124px",
    minWidth: "var(--home-empty-illustration-min-width, 112px)",
    height: "auto",
    display: "block",
    opacity: 0.9,
    userSelect: "none",
  },
  notificationTray: {
    width: "100%",
    display: "grid",
    boxSizing: "border-box",
    minHeight: "var(--home-tray-min-height, 96px)",
    padding: "12px",
    borderRadius: "var(--home-tray-radius, 18px)",
    background:
      "color-mix(in srgb, var(--home-tray-paper, #fdf9f1) 76%, transparent)",
    color: "var(--ink-soft)",
    boxShadow:
      "0 1px 0 color-mix(in srgb, var(--line) 24%, transparent) inset, 0 10px 22px -20px color-mix(in srgb, var(--home-frame-glow, var(--paper-warm)) 38%, transparent)",
    backdropFilter: "blur(6px)",
    transition:
      "background var(--home-daylight-transition, 1800ms) var(--ease-gentle), box-shadow var(--home-daylight-transition, 1800ms) var(--ease-gentle)",
  },
  notificationTrayRibbon: {
    minHeight: "0",
    padding: "0 10px",
    borderRadius: 0,
    background: "transparent",
    boxShadow: "none",
    backdropFilter: "none",
  },
  notificationTrayList: {
    minHeight: "92px",
    padding: "10px 12px",
    borderRadius: "18px",
    background:
      "color-mix(in srgb, var(--home-tray-paper, #fdf9f1) 66%, transparent)",
    boxShadow:
      "0 1px 0 color-mix(in srgb, var(--line) 18%, transparent) inset, 0 10px 24px -22px color-mix(in srgb, var(--ink) 24%, transparent)",
  },
  notificationTrayDelivered: {
    color: "var(--ink)",
    background:
      "color-mix(in srgb, var(--paper-card) 92%, var(--home-frame-glow, var(--paper-warm)) 8%)",
    boxShadow:
      "0 0 0 1px color-mix(in srgb, var(--seal-soft) 42%, transparent) inset, 0 18px 44px -18px color-mix(in srgb, var(--seal) 40%, transparent), var(--shadow-e2)",
  },
  notificationRows: {
    width: "100%",
    minHeight: "72px",
    display: "grid",
    alignContent: "center",
    gap: "8px",
  },
  notificationRowsRibbon: {
    minHeight: "0",
    gap: "0",
  },
  notificationRowsSplit: {
    gridTemplateColumns: "1fr",
    alignItems: "center",
    gap: "8px",
  },
  notificationRowsSingle: {
    alignContent: "center",
  },
  notificationRow: {
    width: "100%",
    minHeight: "54px",
    boxSizing: "border-box",
    display: "grid",
    gridTemplateColumns: "40px minmax(0, 1fr)",
    alignItems: "center",
    gap: "12px",
    padding: "8px 10px",
    border: "0",
    borderRadius: "var(--radius-lg)",
    background: "transparent",
    color: "inherit",
    textDecoration: "none",
    textAlign: "left",
    WebkitTapHighlightColor: "transparent",
    scrollMarginBottom:
      "calc(var(--bottom-nav-height) + var(--bottom-nav-safe-offset) + 32px)",
  },
  notificationRowSplitCard: {
    minHeight: "58px",
    gridTemplateColumns: "56px minmax(0, 1fr)",
    justifyItems: "stretch",
    alignItems: "center",
    gap: "10px",
    padding: "7px 10px",
    alignContent: "center",
    textAlign: "left",
  },
  notificationRowText: {
    gridTemplateColumns: "1fr",
    justifyItems: "center",
    alignContent: "center",
    gap: "2px",
    minHeight: "46px",
    padding: "4px 8px",
    textAlign: "center",
  },
  notificationRowTextRibbon: {
    minHeight: "0",
    padding: "0",
    gap: "1px",
    background: "transparent",
    boxShadow: "none",
  },
  notificationRowPrimary: {
    gridTemplateColumns: "76px minmax(0, 1fr)",
    minHeight: "64px",
    gap: "12px",
    padding: "8px 10px",
    background: "color-mix(in srgb, var(--seal-soft) 12%, transparent)",
    boxShadow:
      "0 0 0 1px color-mix(in srgb, var(--seal-soft) 24%, transparent) inset",
  },
  notificationRowLink: {
    gridTemplateColumns: "1fr",
    justifyItems: "center",
    textAlign: "center",
  },
  notificationRowInteractive: {
    cursor: "pointer",
    background: "color-mix(in srgb, var(--paper-card) 34%, transparent)",
    boxShadow:
      "0 0 0 1px color-mix(in srgb, var(--line) 24%, transparent) inset",
  },
  notificationThumb: {
    width: "50px",
    height: "42px",
    display: "block",
    borderRadius: "var(--radius-md)",
    overflow: "hidden",
    background: "color-mix(in srgb, var(--paper-card) 72%, transparent)",
    boxShadow:
      "0 0 0 1px color-mix(in srgb, var(--line) 32%, transparent) inset, 0 8px 18px -16px color-mix(in srgb, var(--ink) 30%, transparent)",
  },
  notificationThumbImage: {
    width: "100%",
    height: "100%",
    border: "0",
    borderRadius: "inherit",
    boxShadow: "none",
    background: "transparent",
    objectFit: "cover",
  },
  notificationText: {
    minWidth: 0,
    display: "grid",
    gap: "2px",
    color: "inherit",
    fontFamily: "var(--font-display)",
    letterSpacing: "var(--tracking-body)",
  },
  notificationTextSplit: {
    justifyItems: "start",
    textAlign: "left",
    gap: "0",
  },
  notificationTitle: {
    minWidth: 0,
    overflow: "visible",
    textOverflow: "clip",
    whiteSpace: "normal",
    color: "var(--ink)",
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.38,
  },
  notificationTitleSplit: {
    maxWidth: "none",
    color: "var(--ink)",
    fontSize: "12px",
    lineHeight: 1.35,
    letterSpacing: "var(--tracking-label)",
    textAlign: "left",
  },
  notificationAction: {
    color: "var(--ink)",
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.45,
  },
  notificationActionSplit: {
    color: "var(--ink-soft)",
    fontSize: "11px",
    lineHeight: 1.35,
    textAlign: "left",
  },
  notificationMoreRow: {
    minHeight: "32px",
    display: "grid",
    placeItems: "center",
    color: "var(--ink-faint)",
    fontFamily: "var(--font-display)",
    fontSize: "11px",
    letterSpacing: "var(--tracking-body)",
  },
  letterTrayCopy: {
    display: "grid",
    gap: "2px",
    justifyItems: "start",
    textAlign: "left",
  },
  letterTrayCopySplit: {
    justifyItems: "start",
    textAlign: "left",
  },
  letterTrayLink: {
    display: "grid",
    justifyItems: "center",
    gap: "6px",
    color: "inherit",
    textDecoration: "none",
    WebkitTapHighlightColor: "transparent",
  },
  letterTrayTitle: {
    margin: 0,
    color: "var(--ink-soft)",
    fontFamily: "var(--font-display)",
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.55,
    letterSpacing: "var(--tracking-label)",
    textAlign: "center",
    maxWidth: "20em",
  },
  letterTrayTitlePrimary: {
    color: "var(--ink)",
    fontSize: "14px",
  },
  letterTraySubPrimary: {
    color: "var(--ink)",
    fontSize: "12px",
  },
  letterTraySub: {
    color: "var(--ink-soft)",
    fontFamily: "var(--font-display)",
    fontSize: "12px",
    lineHeight: 1.55,
    letterSpacing: "var(--tracking-body)",
    textAlign: "center",
  },
  letterTrayLine: {
    display: "block",
  },
  letterTrayKeyword: {
    color: "var(--ink)",
  },
  trayLetterButton: {
    width: "72px",
    height: "46px",
    flex: "0 0 auto",
    borderRadius: "var(--radius-md)",
    transform: "rotate(-1deg)",
    boxShadow:
      "0 0 0 1px color-mix(in srgb, var(--seal-soft) 28%, transparent) inset, 0 10px 20px -16px color-mix(in srgb, var(--seal) 42%, transparent)",
  },
  trayLetterButtonCompact: {
    width: "48px",
    height: "34px",
    borderRadius: "var(--radius-md)",
  },
  homeCopyWrap: {
    display: "grid",
    justifyItems: "center",
    gap: "4px",
    minHeight: "44px",
  },
  homeTitle: {
    margin: 0,
    color: "var(--ink)",
    fontFamily: "var(--font-display)",
    fontSize: "18px",
    fontWeight: 400,
    letterSpacing: "var(--tracking-label)",
    textAlign: "center",
  },
  homeSub: {
    margin: 0,
    color: "var(--ink-soft)",
    fontFamily: "var(--font-display)",
    fontSize: "13px",
    letterSpacing: "var(--tracking-body)",
    textAlign: "center",
  },
  homeCaptureButton: {
    minWidth: "176px",
  },
  homeCycleStatus: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "8px",
    marginTop: "-2px",
  },
  homeCyclePill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    minHeight: "28px",
    padding: "4px 10px",
    borderRadius: "var(--radius-full)",
    background: "color-mix(in srgb, var(--paper-card) 54%, transparent)",
    color: "var(--ink)",
    fontFamily: "var(--font-ui)",
    fontSize: "12px",
    letterSpacing: "var(--tracking-body)",
    boxShadow:
      "0 0 0 1px color-mix(in srgb, var(--line) 72%, transparent) inset",
  },
  homeCycleLabel: {
    color: "var(--ink-soft)",
    fontWeight: 400,
  },
  homeCycleValue: {
    color: "var(--ink)",
    fontWeight: 500,
  },
  desk: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "20px",
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
    gap: "8px",
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
    gap: "8px",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-xl)",
    background: "var(--paper)",
    color: "var(--ink)",
    boxShadow: "var(--shadow-e1)",
    cursor: "pointer",
    transition:
      "transform var(--dur-instant) var(--ease-settle), box-shadow var(--dur-instant) var(--ease-gentle)",
    WebkitTapHighlightColor: "transparent",
  },
  emptyFrameLabel: {
    fontFamily: "var(--font-ui)",
    fontSize: "13px",
    letterSpacing: "var(--tracking-label)",
    color: "var(--ink-soft)",
  },
  letter: {
    position: "relative",
    width: "108px",
    height: "72px",
    overflow: "hidden",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-sm)",
    background: "var(--paper-card)",
    boxShadow: "var(--shadow-e0)",
    transform: "rotate(-2.5deg)",
    opacity: 0.55,
    transition:
      "transform var(--dur-instant) var(--ease-gentle), opacity var(--dur-instant) var(--ease-gentle)",
    WebkitTapHighlightColor: "transparent",
  },
  letterHidden: {
    display: "none",
  },
  letterStateOne: {
    opacity: 1,
    background: "var(--paper-card)",
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
  letterHint: {
    minHeight: "16px",
    color: "var(--ink-soft)",
    fontFamily: "var(--font-display)",
    fontSize: "13px",
    letterSpacing: "var(--tracking-body)",
    transition: "opacity var(--dur-instant) var(--ease-gentle)",
  },
  letterTimeLabel: {
    minHeight: "16px",
    color: "var(--ink-soft)",
    fontFamily: "var(--font-display)",
    fontSize: "13px",
    letterSpacing: "var(--tracking-label)",
  },
  selectionLockedStage: {
    userSelect: "none",
    WebkitUserSelect: "none",
    WebkitTouchCallout: "none",
    WebkitUserDrag: "none",
    touchAction: "none",
  } as CSSProperties,
  deliveredLetterWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
  },
  arrivedLetterButton: {
    position: "relative",
    width: "188px",
    height: "130px",
    overflow: "hidden",
    border: "none",
    borderRadius: "var(--radius-xl)",
    background: "var(--paper-card)",
    color: "var(--seal)",
    boxShadow: "var(--shadow-e2)",
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
    borderRadius: "var(--radius-full)",
    background: "var(--seal-soft)",
    boxShadow: "var(--shadow-e0)",
    transform: "translate(-50%,-50%)",
  },
  letterSealActive: {
    background: "var(--seal)",
    boxShadow: "var(--shadow-e1)",
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
  developPhotoRewinding: {
    transition:
      "opacity calc(var(--dur-develop) / 1.6) var(--ease-gentle), filter calc(var(--dur-develop) / 1.6) var(--ease-gentle), transform calc(var(--dur-develop) / 1.6) var(--ease-gentle)",
  },
  developImage: {
    width: "100%",
    height: "100%",
    borderRadius: "var(--radius-lg)",
    pointerEvents: "none",
  },
  holdLabel: {
    color: "var(--ink-soft)",
    fontFamily: "var(--font-display)",
    fontSize: "12px",
    fontWeight: 400,
    letterSpacing: "var(--tracking-label)",
  },
  holdLabelActive: {
    color: "var(--seal)",
  },
  photoTileWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },
  photoTile: {
    padding: "8px",
    borderRadius: "var(--radius-xl)",
    background: "var(--paper)",
    boxShadow: "var(--shadow-e1)",
    border: "none",
  },
  photoTileButton: {
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  normalPhotoTile: {
    width: "144px",
    height: "144px",
    boxSizing: "border-box",
  },
  miniTile: {
    padding: "4px",
    borderRadius: "var(--radius-lg)",
    boxShadow: "var(--shadow-e1)",
  },
  tileImage: {
    width: "min(36vw, 128px)",
    height: "min(36vw, 128px)",
    borderRadius: "var(--radius-lg)",
  },
  smallImage: {
    width: "92px",
    height: "92px",
    borderRadius: "var(--radius-sm)",
  },
  miniImage: {
    width: "54px",
    height: "54px",
    borderRadius: "var(--radius-sm)",
  },
  tileLabel: {
    color: "var(--ink-soft)",
    fontSize: "13px",
    fontFamily: "var(--font-display)",
    fontWeight: 400,
    letterSpacing: "var(--tracking-label)",
  },
  emptyDeliveredSlot: {
    width: "144px",
    height: "144px",
    boxSizing: "border-box",
    display: "grid",
    placeItems: "center",
    padding: "12px",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-xl)",
    background: "color-mix(in srgb, var(--paper) 72%, transparent)",
    boxShadow: "var(--shadow-e1)",
  },
  emptyDeliveredSlotText: {
    color: "var(--ink-faint)",
    fontFamily: "var(--font-display)",
    fontSize: "12px",
    letterSpacing: "var(--tracking-label)",
    textAlign: "center",
  },
  guidanceCopy: {
    minHeight: "18px",
    margin: "0",
    color: "var(--ink-soft)",
    fontSize: "13px",
    fontFamily: "var(--font-display)",
    fontWeight: 400,
    letterSpacing: "var(--tracking-label)",
    textAlign: "center",
  },
  omoideArrival: {
    width: "min(88%, 316px)",
    flex: "0 0 min(88%, 316px)",
    boxSizing: "border-box",
    display: "grid",
    gridTemplateColumns: "44px 1fr",
    alignItems: "center",
    gap: "10px",
    minHeight: "58px",
    padding: "10px 12px",
    border: "none",
    borderRadius: "var(--radius-xl)",
    background:
      "color-mix(in srgb, var(--paper-card) 72%, transparent)",
    color: "var(--ink)",
    textAlign: "left",
    boxShadow:
      "0 0 0 1px color-mix(in srgb, var(--line) 38%, transparent) inset, 0 8px 20px -18px color-mix(in srgb, var(--home-frame-glow, var(--paper-warm)) 30%, transparent)",
    scrollSnapAlign: "start",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  omoideLetterIcon: {
    width: "40px",
    height: "30px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-sm)",
    background: "var(--paper-card)",
    color: "var(--seal)",
    fontFamily: "var(--font-display)",
    fontSize: "13px",
    letterSpacing: "0",
    transform: "rotate(-2deg)",
  },
  omoideArrivalText: {
    display: "grid",
    gap: "2px",
  },
  omoideArrivalKicker: {
    color: "var(--ink-soft)",
    fontFamily: "var(--font-display)",
    fontSize: "12px",
    letterSpacing: "var(--tracking-label)",
  },
  omoideArrivalTitle: {
    color: "var(--ink)",
    fontFamily: "var(--font-display)",
    fontSize: "13px",
    lineHeight: 1.45,
    letterSpacing: "var(--tracking-label)",
  },
  omoideArrivalSub: {
    color: "var(--ink-soft)",
    fontFamily: "var(--font-display)",
    fontSize: "11px",
    lineHeight: 1.45,
    letterSpacing: "var(--tracking-body)",
  },
  openedPair: {
    display: "grid",
    justifyItems: "center",
    gap: "12px",
    width: "100%",
  },
  viewerBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 50,
    display: "grid",
    placeItems: "center",
    padding: "calc(24px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom))",
    background: "color-mix(in srgb, var(--paper) 96%, transparent)",
  },
  viewerPanel: {
    position: "relative",
    width: "min(100%, 430px)",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "24px",
  },
  viewerCloseButton: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  viewerMenuWrap: {
    position: "absolute",
    top: 0,
    right: 0,
  },
  viewerMenuSheet: {
    position: "absolute",
    top: "44px",
    right: 0,
    minWidth: "180px",
  },
  viewerMenuItem: {
    justifyContent: "flex-start",
    textAlign: "left",
  },
  viewerImageFrame: {
    width: "min(100%, 360px)",
    aspectRatio: "1 / 1",
    padding: "8px",
    borderRadius: "var(--radius-xl)",
    background: "var(--paper)",
    boxShadow: "var(--shadow-e1)",
  },
  viewerImage: {
    width: "100%",
    height: "100%",
    borderRadius: "var(--radius-lg)",
  },
  viewerSaveButtonLayout: {
    width: "min(100%, 330px)",
    transition: "opacity var(--dur-reveal) var(--ease-gentle)",
  },
  viewerSaveButtonSaved: {
    opacity: 0,
  },
  reportSheetActions: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  omoideViewerBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 60,
    display: "grid",
    placeItems: "center",
    padding:
      "calc(24px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom))",
    background: "var(--bg-gradient)",
  },
  omoideViewerPanel: {
    width: "min(100%, 430px)",
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    color: "var(--ink)",
  },
  omoideViewerKicker: {
    margin: "0 0 4px",
    color: "var(--ink-soft)",
    fontFamily: "var(--font-display)",
    fontSize: "12px",
    letterSpacing: "var(--tracking-label)",
  },
  omoideViewerTitle: {
    margin: 0,
    color: "var(--ink)",
    fontFamily: "var(--font-display)",
    fontSize: "24px",
    fontWeight: 400,
    letterSpacing: "var(--tracking-label)",
    lineHeight: 1.4,
    textAlign: "center",
  },
  omoideViewerDate: {
    margin: "0 0 8px",
    color: "var(--ink-soft)",
    fontFamily: "var(--font-display)",
    fontSize: "12px",
    letterSpacing: "var(--tracking-body)",
  },
  omoideViewerImageFrame: {
    width: "min(72vw, 280px)",
    aspectRatio: "1 / 1",
    padding: "8px",
    borderRadius: "var(--radius-xl)",
    background: "var(--paper)",
    boxShadow: "var(--shadow-e2)",
    transform: "rotate(-1deg)",
  },
  omoideViewerImage: {
    width: "100%",
    height: "100%",
    borderRadius: "var(--radius-lg)",
  },
  omoideViewerVoice: {
    margin: "16px 0 0",
    color: "var(--ink)",
    fontFamily: "var(--font-display)",
    fontSize: "15px",
    letterSpacing: "var(--tracking-label)",
    textAlign: "center",
  },
  omoideViewerBridge: {
    margin: 0,
    color: "var(--ink-soft)",
    fontFamily: "var(--font-display)",
    fontSize: "12px",
    letterSpacing: "var(--tracking-body)",
  },
  omoideViewerQuestion: {
    margin: "4px 0 0",
    color: "var(--ink-soft)",
    fontFamily: "var(--font-display)",
    fontSize: "13px",
    letterSpacing: "var(--tracking-body)",
    textAlign: "center",
  },
  omoideViewerButton: {
    width: "min(100%, 320px)",
    marginTop: "8px",
  },
  omoideViewerGuard: {
    margin: "8px 0 0",
    color: "var(--ink-faint)",
    fontSize: "12px",
    letterSpacing: "var(--tracking-body)",
    textAlign: "center",
  },
  yesterday: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    marginTop: "4px",
    opacity: 0.78,
  },
  yesterdayPair: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  yesterdayDots: {
    width: "20px",
    height: "8px",
    background:
      "radial-gradient(circle, var(--ink-faint) 0 1.8px, transparent 2.2px) center / 7px 7px repeat-x",
  },
  yesterdayLabel: {
    color: "var(--ink-faint)",
    fontSize: "12px",
    fontFamily: "var(--font-display)",
    letterSpacing: "var(--tracking-label)",
  },
  presence: {
    position: "relative",
    zIndex: 1,
    width: "min(100%, 390px)",
    minHeight: "18px",
    margin: "0 0 16px",
    color: "var(--ink-faint)",
    fontSize: "12px",
    fontFamily: "var(--font-display)",
    letterSpacing: "var(--tracking-label)",
    textAlign: "center",
  },
} satisfies Record<string, CSSProperties>;
