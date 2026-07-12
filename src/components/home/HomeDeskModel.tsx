"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { type EveningHomeState } from "../../lib/home/eveningDelivery";
import {
  fallBackCatIllustrationImage,
  useCatIllustrationAssets,
  useCatIllustrationVariant,
} from "../../lib/assets/catIllustrationAssets";
import type {
  ExchangePhotoReportReason,
  ExchangePhoto,
  OwnSleepingPhoto,
} from "../../lib/home/sleepingPhotos";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import { playOpenSound } from "../../lib/openSound";
import {
  resolvePhotoFallbackSrcs,
  resolvePhotoSrc,
  resolvePhotoStorageVariant,
  type PhotoSourceContext,
  type PhotoSourceSet,
} from "../../lib/photoSources";
import { BottomNavigation } from "../navigation/BottomNavigation";
import { AppButton } from "../ui/AppButton";
import { AppCard } from "../ui/AppCard";
import { AppSheet } from "../ui/AppBottomSheet";
import { AppIcon } from "../ui/AppIcons";
import { PhotoViewerFrame } from "../ui/PhotoTile";
import { StoredPhotoImage } from "../ui/StoredPhotoImage";
import { HomeEnvelopeMotionArt } from "./HomeEnvelopeMotionArt";
import {
  HOME_ENVELOPE_OPEN_MS,
  HOME_REVEAL_MODE,
  HOME_SIMPLE_REVEAL_COMMIT_MS,
} from "./homeEnvelopeMotionConfig";

type DeskState = "1" | "1b" | "2" | "3" | "4";
type HomeDaylightStyle = CSSProperties & Record<`--${string}`, string>;
type HomeFrameLayoutStyle = CSSProperties &
  Record<"--home-frame-layout-width" | "--home-frame-aspect-ratio", string>;
type HomeTodayPhase =
  | "empty-before"
  | "sent-before"
  | "delivered"
  | "opened"
  | "empty-after"
  | "late-sent";
type EveningDeliveryCheckStatus = {
  state: "idle" | "checking" | "slow" | "failed";
  dateKey: string | null;
};

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
  eveningDeliveryCheckStatus?: EveningDeliveryCheckStatus;
  onRetryEveningDeliveryCheck?: () => void;
  deliveredPhotoDecodeStatus?: "idle" | "loading" | "ready" | "failed";
};

const USE_SIMPLE_HOME_REVEAL = HOME_REVEAL_MODE === "simple";
const ENVELOPE_OPEN_MS = USE_SIMPLE_HOME_REVEAL
  ? HOME_SIMPLE_REVEAL_COMMIT_MS
  : HOME_ENVELOPE_OPEN_MS;
const ENVELOPE_SEAL_OPEN_MS = Math.min(760, HOME_ENVELOPE_OPEN_MS);
const HOME_FRAME_TUNING = {
  pagePaddingX: "12px",
  pagePaddingTop: "64px",
  stageMaxWidth: "460px",
  stageGap: "12px",
  heroGap: "12px",
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
  trayRadius: "20px",
  trayMinHeight: "104px",
  trayToNavGap: "32px",
  frameMinWidthPx: 248,
  frameInitialWidth: "312px",
  frameAspectWidthPerHeight: 9 / 14,
  emptyIllustrationWidth: "min(42vw, 152px)",
  emptyIllustrationMinWidth: "128px",
  emptyActionSize: "14px",
} as const;
const HOME_SKY_BACKGROUND =
  "linear-gradient(180deg, color-mix(in srgb, var(--paper-card) 34%, transparent) 0%, color-mix(in srgb, var(--paper) 20%, transparent) 52%, color-mix(in srgb, var(--paper-warm) 18%, transparent) 100%), radial-gradient(88% 62% at var(--home-ambient-warm-x, 18%) var(--home-ambient-warm-y, 8%), color-mix(in srgb, var(--home-ambient-warm, var(--home-sky-glow)) var(--home-ambient-warm-strength, 26%), transparent) 0%, transparent 68%), radial-gradient(86% 58% at var(--home-ambient-cool-x, 86%) var(--home-ambient-cool-y, 94%), color-mix(in srgb, var(--home-ambient-cool, var(--home-sky-bottom)) var(--home-ambient-cool-strength, 16%), transparent) 0%, transparent 72%), var(--home-sky-image), radial-gradient(circle at var(--home-sky-glow-x, 50%) var(--home-sky-glow-y, 12%), color-mix(in srgb, var(--home-sky-glow, var(--paper-warm)) 24%, transparent) 0%, transparent 58%), linear-gradient(180deg, var(--home-sky-top, var(--paper)) 0%, var(--home-sky-mid, var(--paper)) 44%, var(--home-sky-bottom, var(--paper-warm)) 100%)";
const HOME_SKY_BACKGROUND_SIZE =
  "100% 100%, 120% 120%, 120% 120%, 100% 100%, 140% 140%, 100% 100%";
const HOME_SKY_BACKGROUND_POSITION =
  "50% 50%, var(--home-ambient-warm-x, 18%) var(--home-ambient-warm-y, 8%), var(--home-ambient-cool-x, 86%) var(--home-ambient-cool-y, 94%), 50% 50%, var(--home-sky-glow-x, 50%) var(--home-sky-glow-y, 12%), 50% 50%";
const HOME_SKY_BACKGROUND_REPEAT =
  "no-repeat, no-repeat, no-repeat, no-repeat, no-repeat, no-repeat";
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
    ambientWarm: "#e7a07b",
    ambientCool: "#d8c5bc",
    ambientWarmX: "16%",
    ambientWarmY: "8%",
    ambientCoolX: "90%",
    ambientCoolY: "92%",
    ambientWarmStrength: "30%",
    ambientCoolStrength: "12%",
    envelopeLineOpacity: "0.33",
    illustrationInk: "#6b594b",
  },
  {
    minute: 7 * 60,
    skyTop: "#f3e9dc",
    skyMid: "#f7efe3",
    skyBottom: "#ebe1d0",
    mat: "#fff8ef",
    glow: "#dfad7d",
    ambientWarm: "#efbf88",
    ambientCool: "#e1d0bf",
    ambientWarmX: "18%",
    ambientWarmY: "8%",
    ambientCoolX: "86%",
    ambientCoolY: "94%",
    ambientWarmStrength: "24%",
    ambientCoolStrength: "10%",
    envelopeLineOpacity: "0.34",
    illustrationInk: "#665548",
  },
  {
    minute: 12 * 60,
    skyTop: "#f1eadf",
    skyMid: "#f4ead8",
    skyBottom: "#e7dbc8",
    mat: "#fff8ee",
    glow: "#c9ae80",
    ambientWarm: "#e3c596",
    ambientCool: "#d7c8b4",
    ambientWarmX: "44%",
    ambientWarmY: "2%",
    ambientCoolX: "84%",
    ambientCoolY: "92%",
    ambientWarmStrength: "14%",
    ambientCoolStrength: "8%",
    envelopeLineOpacity: "0.36",
    illustrationInk: "#594b40",
  },
  {
    minute: 17 * 60,
    skyTop: "#ead8c7",
    skyMid: "#eddfd0",
    skyBottom: "#d9c8bc",
    mat: "#fff3e8",
    glow: "#bd7b61",
    ambientWarm: "#d58a68",
    ambientCool: "#c7b6b4",
    ambientWarmX: "12%",
    ambientWarmY: "10%",
    ambientCoolX: "88%",
    ambientCoolY: "90%",
    ambientWarmStrength: "28%",
    ambientCoolStrength: "12%",
    envelopeLineOpacity: "0.32",
    illustrationInk: "#493d38",
  },
  {
    minute: 19 * 60 + 40,
    skyTop: "#d3c0ba",
    skyMid: "#dfd0c8",
    skyBottom: "#c5b3ad",
    mat: "#f2e8df",
    glow: "#a66d69",
    ambientWarm: "#bc7469",
    ambientCool: "#9aa0ad",
    ambientWarmX: "18%",
    ambientWarmY: "16%",
    ambientCoolX: "88%",
    ambientCoolY: "88%",
    ambientWarmStrength: "22%",
    ambientCoolStrength: "20%",
    envelopeLineOpacity: "0.26",
    illustrationInk: "#342e31",
  },
  {
    minute: 22 * 60,
    skyTop: "#9fa2a3",
    skyMid: "#c7c1b5",
    skyBottom: "#878786",
    mat: "#e8e0d5",
    glow: "#59657f",
    ambientWarm: "#b88576",
    ambientCool: "#66728c",
    ambientWarmX: "50%",
    ambientWarmY: "34%",
    ambientCoolX: "82%",
    ambientCoolY: "90%",
    ambientWarmStrength: "10%",
    ambientCoolStrength: "28%",
    envelopeLineOpacity: "0.18",
    illustrationInk: "#24242a",
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
  onDeliveredStorageDataUrl,
  eveningDeliveryCheckStatus,
  onRetryEveningDeliveryCheck,
  deliveredPhotoDecodeStatus = "idle",
}: HomeDeskModelProps) {
  const deskState = getDeskState(eveningState);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isEnvelopeOpening, setIsEnvelopeOpening] = useState(false);
  const [envelopeOpenPlayKey, setEnvelopeOpenPlayKey] = useState(0);
  const [developPhotoMounted, setDevelopPhotoMounted] = useState(false);
  const [viewerPhoto, setViewerPhoto] = useState<DeskViewerPhoto | null>(null);
  const [, setReportedDeliveredIds] = useState<Set<string>>(
    () => new Set(),
  );
  const envelopeOpenTimerRef = useRef<number | null>(null);
  const isOpeningEnvelopeRef = useRef(false);
  const revealStartedAtRef = useRef<number | null>(null);
  const revealPhotoLoadedTrackedRef = useRef(false);
  const revealPhotoErrorTrackedRef = useRef(false);
  const daylightStyle = useDaylight(now);
  const [homePhotoAspect, setHomePhotoAspect] = useState<number | null>(null);
  useHomeViewportBackground(daylightStyle);
  const targetPhoto =
    eveningState.kind === "waiting" ||
    eveningState.kind === "delivered" ||
    eveningState.kind === "opened"
      ? eveningState.targetPhoto
      : null;
  const latestHomePhoto = useMemo(
    () => findLatestHomeDisplayPhoto(ownSleepingPhotos, now),
    [now, ownSleepingPhotos],
  );
  const displayPhoto = latestHomePhoto ?? targetPhoto;
  const deliveredPhoto =
    eveningState.kind === "delivered" || eveningState.kind === "opened"
      ? eveningState.deliveredPhoto
      : null;
  const homeDay = getHomeDayPresentation({
    eveningState,
    targetPhoto: displayPhoto,
    now,
  });
  const deliveryCheckState =
    eveningState.kind === "waiting" &&
    eveningDeliveryCheckStatus?.dateKey === eveningState.dateKey &&
    eveningDeliveryCheckStatus.state !== "idle"
      ? eveningDeliveryCheckStatus.state
      : "idle";
  const homePhoto = homeDay.photo;
  const frameLayoutStyle = useHomeFrameLayout(
    deskState,
    false,
    homePhoto ? homePhotoAspect : null,
  );
  const subNotifications = [] as Array<{
    id: string;
    openedAt?: number;
    photo: OwnSleepingPhoto;
  }>;
  const hasUnopenedDeliveryNotification = homeDay.phase === "delivered";
  const hasSplitTrayActions = false;
  const hasTrayActions = hasUnopenedDeliveryNotification;
  const usesTextRibbonTray = !hasTrayActions;
  const usesEnvelopeHome = hasUnopenedDeliveryNotification;
  const shouldSuppressEmptyBeforeNotice =
    homeDay.phase === "empty-before" && deliveryCheckState === "idle";
  const shouldShowBaseNotice =
    hasUnopenedDeliveryNotification ||
    (homeDay.phase !== "opened" && !shouldSuppressEmptyBeforeNotice);
  const shouldShowNotificationTray = shouldShowBaseNotice;
  const shouldShowHomeFrameTakeButton =
    deskState === "1" && homeDay.phase === "empty-before";
  const shouldShowHomeFrameRetakeLink =
    deskState === "2" && homeDay.phase === "sent-before";
  const shouldHidePresence = true;
  useEffect(() => {
    trackDeskStateShown(deskState, eveningState.dateKey);
  }, [deskState, eveningState.dateKey]);

  useEffect(() => {
    setHomePhotoAspect(null);
  }, [homePhoto?.id, homePhoto?.src]);

  useEffect(() => {
    return () => {
      if (envelopeOpenTimerRef.current) {
        window.clearTimeout(envelopeOpenTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (eveningState.kind === "delivered") {
      return;
    }

    setIsEnvelopeOpening(false);
    setDevelopPhotoMounted(false);
    isOpeningEnvelopeRef.current = false;
    if (envelopeOpenTimerRef.current) {
      window.clearTimeout(envelopeOpenTimerRef.current);
      envelopeOpenTimerRef.current = null;
    }
  }, [eveningState.kind]);

  useEffect(() => {
    revealStartedAtRef.current = null;
    revealPhotoLoadedTrackedRef.current = false;
    revealPhotoErrorTrackedRef.current = false;
  }, [eveningState.dateKey, eveningState.kind]);

  function openDeliveredLetter() {
    if (eveningState.kind !== "delivered") {
      return;
    }

    if (isOpeningEnvelopeRef.current) {
      return;
    }

    isOpeningEnvelopeRef.current = true;
    const startedAt = performance.now();
    revealStartedAtRef.current = startedAt;
    trackHomeRevealEvent("delivery_reveal_started", 0);

    if (prefersReducedMotion) {
      trackHomeRevealEvent("delivery_reveal_skipped", 0);
      void playOpenSound();
      onOpenDelivery(eveningState);
      return;
    }

    if (!USE_SIMPLE_HOME_REVEAL || !usesEnvelopeHome) {
      setDevelopPhotoMounted(true);
    }
    setEnvelopeOpenPlayKey((value) => value + 1);
    setIsEnvelopeOpening(true);
    if (envelopeOpenTimerRef.current) {
      window.clearTimeout(envelopeOpenTimerRef.current);
    }
    envelopeOpenTimerRef.current = window.setTimeout(() => {
      envelopeOpenTimerRef.current = null;
      isOpeningEnvelopeRef.current = false;
      setIsEnvelopeOpening(false);
      trackHomeRevealEvent(
        "delivery_reveal_completed",
        performance.now() - startedAt,
      );
      void playOpenSound();
      onOpenDelivery(eveningState);
    }, ENVELOPE_OPEN_MS);
  }

  function getRevealLatencyMs() {
    const startedAt = revealStartedAtRef.current;
    return startedAt ? performance.now() - startedAt : 0;
  }

  function trackHomeRevealEvent(name: string, latencyMs = getRevealLatencyMs()) {
    trackProductEvent(name, {
      latency_ms: Math.max(0, Math.round(latencyMs)),
      route: "/home",
      source: "evening_delivery",
      surface: "home",
      reduced_motion: prefersReducedMotion,
    });
  }

  function handleRevealPhotoLoaded() {
    if (revealPhotoLoadedTrackedRef.current) {
      return;
    }

    revealPhotoLoadedTrackedRef.current = true;
    trackHomeRevealEvent("delivery_reveal_photo_loaded");
  }

  function handleRevealPhotoError() {
    if (revealPhotoErrorTrackedRef.current) {
      return;
    }

    revealPhotoErrorTrackedRef.current = true;
    trackHomeRevealEvent("delivery_reveal_photo_error");
  }

  const openingChromeStyle = isEnvelopeOpening
    ? deskStyles.envelopeOpeningChromeHidden
    : undefined;

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
      <AppButton
        href="/settings"
        variant="ghost"
        size="icon"
        shape="pill"
        iconOnly
        data-testid="home-settings-shortcut"
        aria-label="設定"
        style={{
          ...deskStyles.settingsShortcut,
          ...openingChromeStyle,
        }}
      >
        <AppIcon name="settings" size={16} />
      </AppButton>
      <div style={deskStyles.stage}>
        <div
          style={{
            ...deskStyles.homeHero,
            ...(deskState === "3" ? deskStyles.homeHeroDelivered : {}),
            ...(deskState === "4" ? deskStyles.homeHeroOpened : {}),
          }}
        >
          <div style={deskStyles.todayPhotoZone}>
            {usesEnvelopeHome ? null : homePhoto ? (
              <div
                style={{
                  ...deskStyles.homeFrameShell,
                  ...(deskState === "3" ? deskStyles.homeFrameShellDelivered : {}),
                }}
              >
                <button
                  type="button"
                  data-testid="desk-home-frame"
                  data-photo-id={homePhoto.id}
                  style={deskStyles.homeFrameButton}
                  onClick={() => {
                    setViewerPhoto({
                      kind: "own",
                      photo: homePhoto,
                      dateKey: eveningState.dateKey,
                    });
                  }}
                  aria-label={`${catName}のきょうのねがおを大きく見る`}
                >
                  <span
                    style={{
                      ...deskStyles.homeFrame,
                      ...(deskState === "3" ? deskStyles.homeFrameDelivered : {}),
                    }}
                  >
                    <StoredPhotoImage
                      src={getPhotoBoardSrc(homePhoto)}
                      alt=""
                      style={deskStyles.homeFrameImage}
                      storageVariant={getPhotoStorageVariant(homePhoto, "board")}
                      fallbackSrcs={getPhotoFallbackSrcs(homePhoto)}
                      onNaturalSize={({ width, height }) => {
                        if (width <= 0 || height <= 0) return;
                        const nextAspect = clampHomePhotoAspect(width / height);
                        setHomePhotoAspect((current) =>
                          current !== null && Math.abs(current - nextAspect) < 0.01
                            ? current
                            : nextAspect,
                        );
                      }}
                    />
                  </span>
                </button>
                {shouldShowHomeFrameTakeButton ? (
                  <div style={deskStyles.homePhotoActions}>
                    <button
                      type="button"
                      data-testid="home-retake-action"
                      style={deskStyles.homeAddPhotoButton}
                      onClick={onTakePhoto}
                      aria-label="ねがおを とる"
                    >
                      <AppIcon name="camera" size={15} />
                      <span>ねがおを とる</span>
                    </button>
                    <span style={deskStyles.homeCaptureHint}>
                      <AppIcon
                        name="mail"
                        size={13}
                        style={deskStyles.homeCaptureHintIcon}
                      />
                      きょうの一枚を、よる8時のねこだよりに。
                    </span>
                  </div>
                ) : null}
                {shouldShowHomeFrameRetakeLink ? (
                  <div style={deskStyles.homeRetakeRow}>
                    <button
                      type="button"
                      data-testid="home-retake-action"
                      style={deskStyles.homeRetakeLink}
                      onClick={onTakePhoto}
                    >
                      とりなおす
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div
                data-testid="desk-empty-frame"
                style={deskStyles.homeEmptyFrame}
              >
                <SleepingCatPlaceholder />
                {shouldShowHomeFrameTakeButton ? (
                  <div style={deskStyles.homeEmptyActionGroup}>
                    <button
                      type="button"
                      data-testid="home-empty-action"
                      className="home-empty-cta-action"
                      style={deskStyles.homeEmptyAction}
                      onClick={onTakePhoto}
                      aria-label={`${catName}の ねがおを とる`}
                    >
                      <AppIcon
                        name="camera"
                        size={16}
                        style={deskStyles.homeEmptyActionIcon}
                      />
                      <span>ねがおを とる</span>
                    </button>
                    <span style={deskStyles.homeCaptureHint}>
                      <AppIcon
                        name="mail"
                        size={13}
                        style={deskStyles.homeCaptureHintIcon}
                      />
                      きょうの一枚を、よる8時のねこだよりに。
                    </span>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {shouldShowNotificationTray ? (
          <section
            data-testid="home-letter-tray"
            data-phase={homeDay.phase}
            style={{
              ...deskStyles.notificationTray,
              ...(usesTextRibbonTray ? deskStyles.notificationTrayRibbon : {}),
              ...(hasUnopenedDeliveryNotification ? deskStyles.notificationTrayDelivered : {}),
              ...(usesEnvelopeHome ? deskStyles.notificationTrayEnvelopeHome : {}),
            }}
            className={
              hasUnopenedDeliveryNotification && !prefersReducedMotion
                ? "home-letter-tray-glow"
                : undefined
            }
            aria-label="ホームのお知らせ"
          >
            <div
              style={{
                ...deskStyles.notificationRows,
                ...(usesTextRibbonTray ? deskStyles.notificationRowsRibbon : {}),
                ...deskStyles.notificationRowsSingle,
                ...(usesEnvelopeHome ? deskStyles.notificationRowsEnvelopeHome : {}),
              }}
            >
              {hasUnopenedDeliveryNotification ? (
                <button
                  type="button"
                  role="button"
                  data-testid="desk-open-letter"
                  data-photo-decode={deliveredPhotoDecodeStatus}
                  aria-label="ねこだよりをひらく"
                  style={{
                    ...(usesEnvelopeHome
                      ? deskStyles.envelopeHomeButton
                      : {
                          ...deskStyles.notificationRow,
                          ...deskStyles.notificationRowPrimary,
                        }),
                    ...(hasSplitTrayActions ? deskStyles.notificationRowSplitCard : {}),
                  }}
                  className={[
                    usesEnvelopeHome ? "desk-envelope-home" : null,
                    isEnvelopeOpening
                      ? usesEnvelopeHome && USE_SIMPLE_HOME_REVEAL
                        ? "desk-letter-simple-opening"
                        : "desk-letter-opening"
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={openDeliveredLetter}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <span
                    data-envelope-body={usesEnvelopeHome ? "true" : undefined}
                    aria-hidden="true"
                    style={{
                      ...deskStyles.selectionLockedStage,
                      ...(usesEnvelopeHome
                        ? deskStyles.envelopeHomeBody
                        : {
                            ...deskStyles.arrivedLetterButton,
                            ...deskStyles.trayLetterButton,
                          }),
                      ...(hasSplitTrayActions ? deskStyles.trayLetterButtonCompact : {}),
                    }}
                  >
                    {usesEnvelopeHome ? (
                      USE_SIMPLE_HOME_REVEAL ? (
                        <img
                          data-envelope-art="simple"
                          src="/images/home/generated-envelope-wide-v2.webp"
                          alt=""
                          draggable={false}
                          style={deskStyles.envelopeHomeSimpleImage}
                        />
                      ) : (
                        <HomeEnvelopeMotionArt
                          isOpening={isEnvelopeOpening}
                          playKey={envelopeOpenPlayKey}
                        />
                      )
                    ) : null}
                    <span
                      data-envelope-flap="true"
                      style={
                        usesEnvelopeHome
                          ? deskStyles.envelopeHomeFlap
                          : deskStyles.letterFlap
                      }
                      aria-hidden="true"
                    />
                    <span
                      data-envelope-seal="true"
                      style={
                        usesEnvelopeHome
                          ? deskStyles.envelopeHomeSeal
                          : { ...deskStyles.letterSeal, ...deskStyles.letterSealActive }
                      }
                      aria-hidden="true"
                    />
                    {deliveredPhoto &&
                    !(usesEnvelopeHome && USE_SIMPLE_HOME_REVEAL) &&
                    (developPhotoMounted || usesEnvelopeHome) ? (
                      <span
                        data-develop-photo={
                          developPhotoMounted ? "true" : "preload"
                        }
                        style={{
                          ...deskStyles.selectionLockedStage,
                          ...(usesEnvelopeHome
                            ? deskStyles.envelopeHomeDevelopPhoto
                            : deskStyles.developPhoto),
                        }}
                        aria-hidden="true"
                      >
                        <StoredPhotoImage
                          src={getPhotoDetailSrc(deliveredPhoto)}
                          fallbackSrcs={getPhotoFallbackSrcs(deliveredPhoto)}
                          alt=""
                          storageVariant={getPhotoStorageVariant(deliveredPhoto, "detail")}
                          loading="eager"
                          onLoad={handleRevealPhotoLoaded}
                          onError={handleRevealPhotoError}
                          onStorageDataUrl={(dataUrl) => {
                            onDeliveredStorageDataUrl(
                              eveningState.dateKey,
                              deliveredPhoto,
                              dataUrl,
                            );
                          }}
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
                      ...(usesEnvelopeHome
                        ? deskStyles.envelopeHomeCopy
                        : {
                            ...deskStyles.letterTrayCopy,
                            ...(hasSplitTrayActions ? deskStyles.letterTrayCopySplit : {}),
                          }),
                    }}
                  >
                    <strong
                      style={{
                        ...(usesEnvelopeHome
                          ? deskStyles.envelopeHomeTitle
                          : {
                              ...deskStyles.letterTrayTitle,
                              ...deskStyles.letterTrayTitlePrimary,
                              ...(hasSplitTrayActions
                                ? deskStyles.notificationTitleSplit
                                : {}),
                            }),
                      }}
                    >
                      ねこだより、とどいた
                    </strong>
                    <span
                      data-envelope-action={usesEnvelopeHome ? "true" : undefined}
                      style={{
                        ...(usesEnvelopeHome
                          ? deskStyles.envelopeHomeAction
                          : {
                              ...deskStyles.letterTraySub,
                              ...deskStyles.letterTraySubPrimary,
                              ...(hasSplitTrayActions
                                ? deskStyles.notificationActionSplit
                                : {}),
                            }),
                      }}
                    >
                      ひらく
                    </span>
                  </div>
                </button>
              ) : shouldShowBaseNotice ? (
                <div
                  style={{
                    ...deskStyles.notificationRow,
                    ...deskStyles.notificationRowText,
                    ...(usesTextRibbonTray ? deskStyles.notificationRowTextRibbon : {}),
                  }}
                >
                  <HomeLetterTrayText
                    phase={homeDay.phase}
                    deliveryCheckState={deliveryCheckState}
                    onRetry={onRetryEveningDeliveryCheck}
                  />
                </div>
              ) : null}
              {subNotifications.slice(0, 2).map((memory) => (
                <button
                  key={memory.id}
                  type="button"
                  data-testid="unused-omoide-arrival-card"
                  style={{
                    ...deskStyles.notificationRow,
                    ...deskStyles.notificationRowInteractive,
                    ...(hasSplitTrayActions ? deskStyles.notificationRowSplitCard : {}),
                  }}
                  onClick={() => undefined}
                  aria-label="思い出が、とどきました。うちのこで見る"
                >
                  <span style={deskStyles.notificationThumb} aria-hidden="true">
                    <StoredPhotoImage
                      src={getPhotoListSrc(memory.photo)}
                      alt=""
                      style={deskStyles.notificationThumbImage}
                      storageVariant={getPhotoStorageVariant(memory.photo, "list")}
                      fallbackSrcs={getPhotoFallbackSrcs(memory.photo)}
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
                      思い出が、とどきました
                    </span>
                    <span
                      style={{
                        ...deskStyles.notificationAction,
                        ...(hasSplitTrayActions ? deskStyles.notificationActionSplit : {}),
                      }}
                    >
                      うちのこへ
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
          ) : null}
        </div>

      </div>

      {!shouldHidePresence ? (
        <p
          style={{
            ...deskStyles.presence,
            ...openingChromeStyle,
          }}
        >
          きょうも、{sleepingCounter}ひきの ねこが ねています
        </p>
      ) : null}

      <div
        aria-hidden={isEnvelopeOpening ? true : undefined}
        style={openingChromeStyle}
      >
        <BottomNavigation active="today" homeVariant="desk" homeState={deskState} />
      </div>

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
            background-position: 50% 50%, 50% 50%, 50% 50%, 38% 7%, 50% 50%;
            filter: saturate(1);
          }
          50% {
            --home-sky-glow-x: 62%;
            --home-sky-glow-y: 18%;
            background-position: 50% 50%, 50% 50%, 50% 50%, 62% 18%, 50% 50%;
            filter: saturate(1.045);
          }
          100% {
            --home-sky-glow-x: 46%;
            --home-sky-glow-y: 28%;
            background-position: 50% 50%, 50% 50%, 50% 50%, 46% 28%, 50% 50%;
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
          background-size: ${HOME_SKY_BACKGROUND_SIZE};
          animation: homeSkyFlow var(--home-sky-motion-duration, 52s) var(--ease-gentle) infinite alternate;
        }
        .desk-frame-breathe {
          animation: deskFrameBreathe calc(var(--dur-move) * 10) var(--ease-gentle) infinite;
        }
        .desk-frame-action:active {
          transform: scale(0.96);
          box-shadow: var(--shadow-e1) !important;
        }
        .home-empty-cta-action:active {
          transform: translateY(1px) scale(0.985);
          box-shadow:
            0 1px 0 color-mix(in srgb, var(--paper-card) 72%, transparent) inset,
            0 8px 18px -16px color-mix(in srgb, var(--home-wax, #c2745a) 44%, transparent);
        }
        .desk-evening-soon-copy {
          animation: deskEveningSoonCopyIn 1200ms var(--ease-gentle) both;
        }
        .home-letter-tray-glow {
          animation: homeLetterTrayGlow 2200ms var(--ease-gentle) infinite alternate;
        }
        .desk-envelope-home {
          animation: deskEnvelopeArrive 720ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        .desk-envelope-home:active [data-envelope-body="true"] {
          transform: translateY(2px) scale(0.985);
          box-shadow:
            0 1px 0 rgba(255,255,255,0.54) inset,
            0 0 0 1px color-mix(in srgb, var(--seal-soft) 18%, transparent) inset,
            0 14px 34px -26px color-mix(in srgb, var(--ink) 40%, transparent);
        }
        .desk-envelope-home [data-envelope-action="true"]::before {
          content: "ひらく";
          display: block;
          color: var(--seal);
          font-size: 12px;
          font-weight: 500;
          line-height: 1.45;
          letter-spacing: var(--tracking-body);
        }
        .desk-letter-opening [data-envelope-action="true"]::before,
        .desk-letter-simple-opening [data-envelope-action="true"]::before {
          animation: deskEnvelopeActionFade 110ms ease-out both;
        }
        .desk-letter-simple-opening [data-envelope-art="simple"] {
          animation: deskEnvelopeSimpleFadeOut 260ms 70ms cubic-bezier(0.4, 0, 1, 1) both;
        }
        .desk-letter-opening [data-envelope-body="true"] {
          animation: deskEnvelopeBodyOpen ${ENVELOPE_OPEN_MS}ms cubic-bezier(0.18, 0.92, 0.2, 1) both;
        }
        .desk-letter-opening [data-envelope-art="closed"] {
          animation: deskEnvelopeClosedArtOpen ${ENVELOPE_OPEN_MS}ms cubic-bezier(0.18, 0.92, 0.2, 1) both;
        }
        .desk-letter-opening [data-envelope-art="open"] {
          animation: deskEnvelopeOpenArtReveal ${ENVELOPE_OPEN_MS}ms cubic-bezier(0.18, 0.92, 0.2, 1) both;
        }
        .desk-letter-opening [data-envelope-flap="true"] {
          animation: deskEnvelopeFlapOpen ${ENVELOPE_OPEN_MS}ms cubic-bezier(0.16, 0.9, 0.22, 1) both;
        }
        .desk-letter-opening [data-envelope-seal="true"] {
          animation: deskEnvelopeSealPop ${ENVELOPE_SEAL_OPEN_MS}ms cubic-bezier(0.18, 0.92, 0.2, 1) both;
        }
        .desk-letter-opening [data-develop-photo="true"] {
          animation: deskEnvelopePhotoReveal ${ENVELOPE_OPEN_MS}ms cubic-bezier(0.18, 0.92, 0.2, 1) both;
        }
        @keyframes homeLetterTrayGlow {
          from {
            filter: brightness(1);
          }
          to {
            filter: brightness(1.035);
          }
        }
        @keyframes deskEnvelopeArrive {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.98);
            filter: blur(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }
        @keyframes deskEnvelopeActionFade {
          from {
            opacity: 1;
            transform: translateY(0);
          }
          to {
            opacity: 0;
            transform: translateY(-2px);
          }
        }
        @keyframes deskEnvelopeSimpleFadeOut {
          from {
            opacity: 1;
            transform: translate(-50%, -50%) translateY(0) scale(1);
            filter: drop-shadow(0 16px 28px color-mix(in srgb, var(--ink) 16%, transparent)) blur(0);
          }
          to {
            opacity: 0;
            transform: translate(-50%, -50%) translateY(4px) scale(0.985);
            filter: drop-shadow(0 10px 20px color-mix(in srgb, var(--ink) 10%, transparent)) blur(0.6px);
          }
        }
        @keyframes deskEnvelopeBodyOpen {
          0% {
            transform: translateY(0) scale(1);
          }
          22% {
            transform: translateY(3px) scale(0.982);
          }
          52% {
            transform: translateY(-5px) scale(1.012);
          }
          100% {
            transform: translateY(-10px) scale(1.035);
            filter: brightness(1.04);
          }
        }
        @keyframes deskEnvelopeClosedArtOpen {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter:
              drop-shadow(0 18px 30px color-mix(in srgb, var(--ink) 20%, transparent))
              drop-shadow(0 6px 18px color-mix(in srgb, var(--seal) 10%, transparent));
          }
          30% {
            opacity: 1;
            transform: translateY(3px) scale(0.982);
          }
          56% {
            opacity: 0.88;
            transform: translateY(-8px) scale(1.018);
          }
          100% {
            opacity: 0;
            transform: translateY(-18px) scale(1.05);
            filter:
              drop-shadow(0 24px 36px color-mix(in srgb, var(--ink) 16%, transparent))
              drop-shadow(0 8px 18px color-mix(in srgb, var(--seal) 8%, transparent));
          }
        }
        @keyframes deskEnvelopeOpenArtReveal {
          0% {
            opacity: 0;
            transform: translateY(18px) scale(0.96);
            filter: blur(5px)
              drop-shadow(0 14px 28px color-mix(in srgb, var(--ink) 14%, transparent));
          }
          38% {
            opacity: 0;
          }
          68% {
            opacity: 1;
            transform: translateY(-7px) scale(1.018);
            filter: blur(0)
              drop-shadow(0 20px 32px color-mix(in srgb, var(--ink) 17%, transparent));
          }
          100% {
            opacity: 1;
            transform: translateY(-12px) scale(1.035);
            filter: blur(0)
              drop-shadow(0 24px 34px color-mix(in srgb, var(--ink) 18%, transparent));
          }
        }
        @keyframes deskEnvelopeFlapOpen {
          0% {
            transform: rotateX(0deg) translateY(0);
            filter: brightness(1);
          }
          34% {
            transform: rotateX(0deg) translateY(0);
          }
          100% {
            transform: rotateX(72deg) translateY(-10px);
            filter: brightness(1.08);
          }
        }
        @keyframes deskEnvelopeSealPop {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          28% {
            transform: translate(-50%, -50%) scale(1.18);
          }
          68% {
            opacity: 0.92;
            transform: translate(-50%, -68%) scale(0.82) rotate(-8deg);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -94%) scale(0.62) rotate(12deg);
          }
        }
        @keyframes deskEnvelopePhotoReveal {
          0% {
            opacity: 0;
            filter: blur(10px) saturate(0.94);
            transform: translateY(26px) scale(0.9);
          }
          38% {
            opacity: 0;
          }
          76% {
            opacity: 1;
            filter: blur(1px) saturate(1.02);
            transform: translateY(-8px) scale(1.02);
          }
          100% {
            opacity: 1;
            filter: blur(0) saturate(1.04);
            transform: translateY(-14px) scale(1.04);
          }
        }
        .home-tray-action-carousel::-webkit-scrollbar {
          display: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .desk-frame-breathe,
          .desk-evening-soon-copy,
          .home-letter-tray-glow,
          .desk-envelope-home,
          .desk-letter-simple-opening [data-envelope-action="true"]::before,
          .desk-letter-simple-opening [data-envelope-art="simple"],
          .desk-letter-opening [data-envelope-action="true"]::before,
          .desk-letter-opening [data-envelope-body="true"],
          .desk-letter-opening [data-envelope-art="closed"],
          .desk-letter-opening [data-envelope-art="open"],
          .desk-letter-opening [data-envelope-flap="true"],
          .desk-letter-opening [data-envelope-seal="true"],
          .desk-letter-opening [data-develop-photo="true"] {
            animation: none;
            filter: none;
          }
          .home-sky-shell {
            animation: homeSkyBreath var(--home-sky-reduced-motion-duration, 42s) var(--ease-gentle) infinite alternate;
          }
          .desk-letter-opening [data-develop-photo="true"] {
            transition: none !important;
          }
        }
      `}</style>
    </section>
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
  const isOwnPhoto = viewerPhoto.kind === "own";

  function handleStow() {
    onSave();
    onClose();
  }

  return (
    <div
      data-testid="desk-photo-viewer"
      data-photo-kind={viewerPhoto.kind}
      data-photo-id={viewerPhoto.photo.id}
      style={deskStyles.viewerBackdrop}
      onClick={onClose}
    >
      <section
        style={{
          ...deskStyles.viewerPanel,
          ...(isOwnPhoto ? deskStyles.viewerPanelOwn : {}),
        }}
        aria-label={
          viewerPhoto.kind === "other"
            ? "どこかのこの写真"
            : "うちのこの写真"
        }
        onClick={(event) => event.stopPropagation()}
      >
        {isOwnPhoto ? (
          <div style={deskStyles.viewerOwnTopBar}>
            <AppButton
              type="button"
              variant="quiet"
              size="sm"
              style={deskStyles.viewerOwnCloseButton}
              onClick={onClose}
              aria-label="とじる"
            >
              とじる
            </AppButton>
            <div style={deskStyles.viewerOwnHeader}>
              <p style={deskStyles.viewerOwnKicker}>きょうの ねがお</p>
              <p style={deskStyles.viewerOwnNote}>写真は、ねこだより と うちのこ に残ります</p>
            </div>
            <span style={deskStyles.viewerOwnHeaderSpacer} aria-hidden="true" />
          </div>
        ) : (
          <AppButton
            type="button"
            variant="quiet"
            size="sm"
            style={deskStyles.viewerCloseButton}
            onClick={onClose}
            aria-label="とじる"
          >
            とじる
          </AppButton>
        )}
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
          fallbackSrcs={getPhotoFallbackSrcs(viewerPhoto.photo)}
          alt=""
          storageVariant={getPhotoStorageVariant(viewerPhoto.photo, "detail")}
          aspect={isOwnPhoto ? "auto" : undefined}
          fit={isOwnPhoto ? "cover" : "contain"}
          style={
            isOwnPhoto
              ? deskStyles.viewerOwnImageFrame
              : deskStyles.viewerImageFrame
          }
          imageStyle={
            isOwnPhoto ? deskStyles.viewerOwnImage : deskStyles.viewerImage
          }
        />
        {viewerPhoto.kind === "other" ? (
          <AppButton
            type="button"
            variant="secondary"
            size="lg"
            fullWidth
            data-testid="desk-photo-viewer-stow"
            style={deskStyles.viewerSaveButtonLayout}
            onClick={handleStow}
          >
            しまう
          </AppButton>
        ) : null}
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
      "--home-ambient-warm": colors.ambientWarm,
      "--home-ambient-cool": colors.ambientCool,
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
      "--home-empty-action-size": HOME_FRAME_TUNING.emptyActionSize,
      "--home-sky-glow-x": "50%",
      "--home-sky-glow-y": "12%",
      "--home-ambient-warm-x": colors.ambientWarmX,
      "--home-ambient-warm-y": colors.ambientWarmY,
      "--home-ambient-cool-x": colors.ambientCoolX,
      "--home-ambient-cool-y": colors.ambientCoolY,
      "--home-ambient-warm-strength": colors.ambientWarmStrength,
      "--home-ambient-cool-strength": colors.ambientCoolStrength,
      "--home-envelope-line-opacity": colors.envelopeLineOpacity,
      "--home-illustration-ink": colors.illustrationInk,
      "--home-daylight-transition": HOME_FRAME_TUNING.daylightTransition,
    } as HomeDaylightStyle;
  }, [minuteKey]);
}

function clampHomePhotoAspect(aspect: number) {
  if (!Number.isFinite(aspect) || aspect <= 0) {
    return HOME_FRAME_TUNING.frameAspectWidthPerHeight;
  }

  return Math.min(4, Math.max(0.25, aspect));
}

function useHomeFrameLayout(
  deskState: DeskState,
  hasSupplementalNotification: boolean,
  photoAspect: number | null,
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
      if (!pageElement || !navElement) {
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
      const trayHeight = trayElement
        ? trayElement.getBoundingClientRect().height ||
          readPixels(pageStyle.getPropertyValue("--home-tray-min-height"), 104)
        : 0;
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
      const frameAspectWidthPerHeight =
        photoAspect ?? HOME_FRAME_TUNING.frameAspectWidthPerHeight;
      const widthFromHeight = availableFrameHeight * frameAspectWidthPerHeight;
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
  }, [deskState, hasSupplementalNotification, photoAspect]);

  return useMemo(
    () => ({
      "--home-frame-layout-width": frameWidth,
      "--home-frame-aspect-ratio": photoAspect
        ? `${photoAspect} / 1`
        : HOME_FRAME_TUNING.frameAspectRatio,
    }),
    [frameWidth, photoAspect],
  );
}

function useHomeViewportBackground(daylightStyle: HomeDaylightStyle) {
  useLayoutEffect(() => {
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
      "--home-ambient-warm",
      "--home-ambient-cool",
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
      "--home-empty-action-size",
      "--home-sky-glow-x",
      "--home-sky-glow-y",
      "--home-ambient-warm-x",
      "--home-ambient-warm-y",
      "--home-ambient-cool-x",
      "--home-ambient-cool-y",
      "--home-ambient-warm-strength",
      "--home-ambient-cool-strength",
      "--home-envelope-line-opacity",
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
    root.style.backgroundRepeat = HOME_SKY_BACKGROUND_REPEAT;
    body.style.backgroundRepeat = HOME_SKY_BACKGROUND_REPEAT;
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

    if (
      eveningState.kind === "before" &&
      (afterDelivery || eveningState.afterTodayDelivery)
    ) {
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

function HomeLetterTrayText({
  phase,
  deliveryCheckState = "idle",
  onRetry,
}: {
  phase: HomeTodayPhase;
  deliveryCheckState?: EveningDeliveryCheckStatus["state"];
  onRetry?: () => void;
}) {
  const keyword = (children: ReactNode) => (
    <span style={deskStyles.letterTrayKeyword}>{children}</span>
  );

  if (deliveryCheckState === "checking") {
    return (
      <>
        <strong style={deskStyles.letterTrayTitle}>
          ねこだよりを確認しています…
        </strong>
        <span style={deskStyles.letterTraySub}>もうすぐ、とどく</span>
      </>
    );
  }

  if (deliveryCheckState === "slow" || deliveryCheckState === "failed") {
    return (
      <>
        <strong style={deskStyles.letterTrayTitle}>
          少し時間がかかっています
        </strong>
        <button
          type="button"
          style={deskStyles.letterTrayRetryButton}
          onClick={onRetry}
        >
          もう一度確認する
        </button>
      </>
    );
  }

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

  return null;
}

function SleepingCatPlaceholder() {
  const catIllustrations = useCatIllustrationAssets();
  const illustrationVariant = useCatIllustrationVariant();

  if (illustrationVariant === "b3-ink" || illustrationVariant === "d1-ink") {
    const maskSrc =
      illustrationVariant === "b3-ink"
        ? "/illustrations/candidates/theme-b-variants/b3-ink.svg"
        : "/illustrations/candidates/theme-d-silhouette/d1-ink.svg";
    return (
      <span
        data-testid={`home-${illustrationVariant}-cat`}
        aria-hidden="true"
        style={{
          ...deskStyles.sleepingCatInkMask,
          maskImage: `url('${maskSrc}')`,
          WebkitMaskImage: `url('${maskSrc}')`,
        }}
      />
    );
  }

  return (
    <img
      src={catIllustrations.homeEmptyCat}
      alt=""
      aria-hidden="true"
      style={deskStyles.sleepingCatPlaceholder}
      draggable={false}
      onError={(event) =>
        fallBackCatIllustrationImage(event.currentTarget, "homeEmptyCat")
      }
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
  if (minute < 20 * 60) {
    return HOME_BACKGROUND_IMAGES.evening;
  }
  return HOME_BACKGROUND_IMAGES.night;
}

function interpolateDaylightAnchor(
  from: (typeof HOME_DAYLIGHT_ANCHORS)[number],
  to: (typeof HOME_DAYLIGHT_ANCHORS)[number],
  progress: number,
) {
  const staticAnchor = progress < 0.5 ? from : to;
  return {
    skyTop: interpolateHexColor(from.skyTop, to.skyTop, progress),
    skyMid: interpolateHexColor(from.skyMid, to.skyMid, progress),
    skyBottom: interpolateHexColor(from.skyBottom, to.skyBottom, progress),
    mat: interpolateHexColor(from.mat, to.mat, progress),
    glow: interpolateHexColor(from.glow, to.glow, progress),
    ambientWarm: interpolateHexColor(from.ambientWarm, to.ambientWarm, progress),
    ambientCool: interpolateHexColor(from.ambientCool, to.ambientCool, progress),
    illustrationInk: interpolateHexColor(
      from.illustrationInk,
      to.illustrationInk,
      progress,
    ),
    ambientWarmX: staticAnchor.ambientWarmX,
    ambientWarmY: staticAnchor.ambientWarmY,
    ambientCoolX: staticAnchor.ambientCoolX,
    ambientCoolY: staticAnchor.ambientCoolY,
    ambientWarmStrength: staticAnchor.ambientWarmStrength,
    ambientCoolStrength: staticAnchor.ambientCoolStrength,
    envelopeLineOpacity: staticAnchor.envelopeLineOpacity,
  };
}

function getJstMinuteOfDay(timestamp: number) {
  const date = new Date(timestamp + 9 * 60 * 60 * 1000);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

function findLatestHomeDisplayPhoto(
  photos: OwnSleepingPhoto[],
  timestamp: number,
) {
  const homeDateKey = getHomeDisplayDateKey(timestamp);
  let latestPhoto: OwnSleepingPhoto | null = null;

  for (const photo of photos) {
    if (getJstDateKey(photo.createdAt) !== homeDateKey) {
      continue;
    }

    if (!latestPhoto || photo.createdAt > latestPhoto.createdAt) {
      latestPhoto = photo;
    }
  }

  return latestPhoto;
}

function getHomeDisplayDateKey(timestamp: number) {
  const todayKey = getJstDateKey(timestamp);
  return getJstMinuteOfDay(timestamp) >= 5 * 60
    ? todayKey
    : addJstDays(todayKey, -1);
}

function getJstDateKey(timestamp: number) {
  const date = new Date(timestamp + 9 * 60 * 60 * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addJstDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const base = Date.UTC(year, month - 1, day) - 9 * 60 * 60 * 1000;
  return getJstDateKey(base + days * 24 * 60 * 60 * 1000);
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

function getPhotoListSrc(photo: PhotoSourceSet) {
  return resolvePhotoSrc(photo, "list");
}

function getPhotoBoardSrc(photo: PhotoSourceSet) {
  return resolvePhotoSrc(photo, "board");
}

function getPhotoDetailSrc(photo: PhotoSourceSet) {
  return resolvePhotoSrc(photo, "detail");
}

function getPhotoStorageVariant(
  photo: PhotoSourceSet,
  context: PhotoSourceContext,
) {
  return resolvePhotoStorageVariant(photo, context);
}

function getPhotoFallbackSrcs(photo: PhotoSourceSet) {
  return resolvePhotoFallbackSrcs(photo);
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
    backgroundRepeat: HOME_SKY_BACKGROUND_REPEAT,
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
    backgroundRepeat: HOME_SKY_BACKGROUND_REPEAT,
    transition:
      "background var(--home-daylight-transition, 1800ms) var(--ease-gentle)",
  },
  settingsShortcut: {
    position: "fixed",
    zIndex: 8,
    top: "calc(env(safe-area-inset-top) + 16px)",
    right: "20px",
    width: "36px",
    height: "36px",
    minWidth: "36px",
    minHeight: "36px",
    padding: 0,
    color: "color-mix(in srgb, var(--ink) 66%, transparent)",
    background:
      "color-mix(in srgb, var(--paper-card) 48%, transparent)",
    border: "1px solid color-mix(in srgb, var(--ink) 8%, transparent)",
    boxShadow: "0 10px 24px -20px rgba(70, 50, 30, 0.38)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
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
    justifyContent: "center",
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
  envelopeOpeningChromeHidden: {
    opacity: 0,
    pointerEvents: "none",
    transition: "opacity 140ms ease",
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
  homePhotoActions: {
    position: "absolute",
    right: "clamp(8px, 3%, 12px)",
    bottom: "clamp(8px, 3%, 12px)",
    zIndex: 2,
    display: "grid",
    justifyItems: "end",
    gap: "6px",
    maxWidth: "calc(100% - 16px)",
  },
  homeRetakeRow: {
    display: "flex",
    justifyContent: "center",
    marginTop: "10px",
  },
  homeRetakeLink: {
    appearance: "none",
    WebkitAppearance: "none",
    border: "none",
    background: "transparent",
    color: "color-mix(in srgb, var(--ink-soft) 68%, var(--home-wax, var(--seal)))",
    fontFamily: "var(--font-ui)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.4,
    letterSpacing: "var(--tracking-body)",
    textDecoration: "underline",
    textUnderlineOffset: "3px",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  homeFrameShell: {
    position: "relative",
    display: "grid",
    justifyItems: "center",
    width: "min(100%, var(--home-frame-layout-width, 100%))",
    margin: "0 auto",
  },
  homeFrameShellDelivered: {
    width: "min(92%, 320px)",
  },
  homeFrame: {
    position: "relative",
    display: "block",
    width: "100%",
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
    width: "100%",
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
  homeAddPhotoButton: {
    minHeight: "36px",
    maxWidth: "100%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "8px clamp(10px, 3.5vw, 12px)",
    border: "1px solid color-mix(in srgb, var(--home-wax, var(--seal)) 26%, transparent)",
    borderRadius: "var(--radius-full)",
    background: "color-mix(in srgb, var(--paper-card) 82%, transparent)",
    color: "var(--home-wax, var(--seal))",
    boxShadow:
      "0 1px 0 color-mix(in srgb, var(--paper-card) 64%, transparent) inset, 0 10px 22px -18px rgba(70, 50, 30, 0.28)",
    backdropFilter: "blur(12px)",
    fontFamily: "var(--font-ui)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1,
    letterSpacing: "var(--tracking-label)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  homeEmptyFrame: {
    width: "min(100%, 390px)",
    minHeight: "clamp(360px, 56dvh, 500px)",
    boxSizing: "border-box",
    position: "relative",
    appearance: "none",
    WebkitAppearance: "none",
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    gap: "20px",
    padding: "36px 18px",
    border: "none",
    outline: "none",
    borderRadius: 0,
    background: "transparent",
    color: "var(--ink-soft)",
    boxShadow: "none",
    transition: "filter 220ms var(--ease-gentle)",
  },
  homeEmptyActionGroup: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    justifyItems: "center",
    gap: "8px",
    width: "100%",
  },
  homeEmptyAction: {
    position: "relative",
    zIndex: 1,
    appearance: "none",
    WebkitAppearance: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "min(184px, 72vw)",
    minHeight: "48px",
    padding: "0 24px",
    border:
      "1px solid color-mix(in srgb, var(--ink-soft) 14%, transparent)",
    borderRadius: "var(--radius-full)",
    background:
      "color-mix(in srgb, var(--home-frame-light, var(--paper-card)) 82%, var(--paper-card) 18%)",
    color:
      "color-mix(in srgb, var(--ink) 86%, var(--home-wax, var(--seal)) 14%)",
    boxShadow:
      "0 1px 0 color-mix(in srgb, var(--paper-card) 68%, transparent) inset, 0 10px 22px -18px color-mix(in srgb, var(--ink) 22%, transparent)",
    fontFamily: "var(--font-ui)",
    fontSize: "var(--home-empty-action-size, 14px)",
    fontWeight: 600,
    letterSpacing: "var(--tracking-body)",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    transition:
      "transform 140ms var(--ease-gentle), box-shadow 140ms var(--ease-gentle), color var(--home-daylight-transition, 1800ms) var(--ease-gentle), border-color var(--home-daylight-transition, 1800ms) var(--ease-gentle), background var(--home-daylight-transition, 1800ms) var(--ease-gentle)",
  },
  homeEmptyActionIcon: {
    color: "var(--home-wax, var(--seal))",
  },
  homeCaptureHint: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    maxWidth: "min(260px, 78vw)",
    color:
      "color-mix(in srgb, var(--ink-soft) 84%, var(--home-frame-light, var(--paper)) 16%)",
    fontFamily: "var(--font-ui)",
    fontSize: "11.5px",
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: "var(--tracking-body)",
    textAlign: "center",
    transition: "color var(--home-daylight-transition, 1800ms) var(--ease-gentle)",
  },
  homeCaptureHintIcon: {
    color: "color-mix(in srgb, var(--home-wax, var(--seal)) 72%, var(--ink-soft))",
  },
  sleepingCatPlaceholder: {
    position: "relative",
    zIndex: 1,
    width: "var(--home-empty-illustration-width, min(40vw, 136px))",
    maxWidth: "152px",
    minWidth: "var(--home-empty-illustration-min-width, 112px)",
    height: "auto",
    display: "block",
    opacity: 0.96,
    userSelect: "none",
  },
  sleepingCatInkMask: {
    display: "block",
    width: "var(--home-empty-illustration-width, min(40vw, 136px))",
    minWidth: "var(--home-empty-illustration-min-width, 112px)",
    aspectRatio: "1 / 1",
    backgroundColor: "var(--home-illustration-ink, var(--ink))",
    maskPosition: "center",
    maskRepeat: "no-repeat",
    maskSize: "contain",
    WebkitMaskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
    transition:
      "background-color var(--home-daylight-transition, 1800ms) var(--ease-gentle)",
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
    minHeight: "80px",
    padding: "12px",
    borderRadius: "20px",
    background:
      "color-mix(in srgb, var(--home-tray-paper, #fdf9f1) 58%, transparent)",
    boxShadow:
      "0 1px 0 color-mix(in srgb, var(--line) 14%, transparent) inset, 0 8px 20px -18px color-mix(in srgb, var(--ink) 20%, transparent)",
  },
  notificationTrayDelivered: {
    color: "var(--ink)",
    background:
      "color-mix(in srgb, var(--paper-card) 86%, var(--home-frame-glow, var(--paper-warm)) 14%)",
    boxShadow:
      "0 0 0 1px color-mix(in srgb, var(--seal-soft) 24%, transparent) inset, 0 16px 38px -18px color-mix(in srgb, var(--seal) 34%, transparent), 0 10px 22px -20px color-mix(in srgb, var(--ink) 20%, transparent)",
  },
  notificationTrayEnvelopeHome: {
    minHeight: "min(44vh, 340px)",
    padding: "0",
    borderRadius: 0,
    background: "transparent",
    boxShadow: "none",
    backdropFilter: "none",
  },
  notificationRows: {
    width: "100%",
    minHeight: "72px",
    display: "grid",
    alignContent: "center",
    gap: "8px",
  },
  notificationRowsEnvelopeHome: {
    minHeight: "min(44vh, 340px)",
    placeItems: "center",
    alignContent: "center",
    gap: "14px",
  },
  notificationRowsRibbon: {
    minHeight: "0",
    gap: "0",
  },
  notificationRowsSplit: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    alignItems: "stretch",
    gap: "8px",
    overflow: "hidden",
    paddingBottom: 0,
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
    minHeight: "92px",
    gridTemplateColumns: "1fr",
    justifyItems: "center",
    alignItems: "center",
    gap: "8px",
    padding: "12px 8px",
    alignContent: "center",
    textAlign: "center",
  },
  notificationRowText: {
    gridTemplateColumns: "1fr",
    justifyItems: "center",
    alignContent: "center",
    gap: "4px",
    minHeight: "48px",
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
    gridTemplateColumns: "84px minmax(0, 1fr)",
    minHeight: "72px",
    gap: "16px",
    padding: "12px",
    background: "color-mix(in srgb, var(--seal-soft) 8%, transparent)",
    boxShadow:
      "0 0 0 1px color-mix(in srgb, var(--seal-soft) 18%, transparent) inset",
  },
  notificationRowLink: {
    gridTemplateColumns: "1fr",
    justifyItems: "center",
    textAlign: "center",
  },
  notificationRowInteractive: {
    cursor: "pointer",
    background: "color-mix(in srgb, var(--paper-card) 28%, transparent)",
    boxShadow:
      "0 0 0 1px color-mix(in srgb, var(--line) 18%, transparent) inset",
  },
  notificationThumb: {
    width: "54px",
    height: "44px",
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
    gap: "4px",
    color: "inherit",
    fontFamily: "var(--font-display)",
    letterSpacing: "var(--tracking-body)",
  },
  notificationTextSplit: {
    justifyItems: "center",
    textAlign: "center",
    gap: "4px",
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
    fontSize: "11.5px",
    lineHeight: 1.35,
    letterSpacing: "var(--tracking-label)",
    textAlign: "center",
  },
  notificationAction: {
    color: "var(--ink)",
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.45,
  },
  notificationActionSplit: {
    color: "var(--ink-soft)",
    fontSize: "10.5px",
    lineHeight: 1.35,
    textAlign: "center",
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
    gap: "4px",
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
    color: "color-mix(in srgb, var(--ink) 78%, var(--ink-soft))",
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
    fontSize: "14.5px",
  },
  envelopeHomeButton: {
    width: "min(82vw, 360px)",
    minHeight: "0",
    boxSizing: "border-box",
    display: "grid",
    justifyItems: "center",
    alignContent: "center",
    gap: "14px",
    padding: "0",
    border: "0",
    background: "transparent",
    color: "var(--ink)",
    textAlign: "center",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    touchAction: "manipulation",
  },
  envelopeHomeBody: {
    position: "relative",
    display: "block",
    width: "100%",
    aspectRatio: "1.946 / 1",
    overflow: "visible",
    borderRadius: 0,
    background: "transparent",
    boxShadow: "none",
    transformOrigin: "50% 62%",
  },
  envelopeHomeArt: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "contain",
    objectPosition: "center",
    filter:
      "drop-shadow(0 18px 30px color-mix(in srgb, var(--ink) 20%, transparent)) drop-shadow(0 6px 18px color-mix(in srgb, var(--seal) 10%, transparent))",
    transformOrigin: "50% 58%",
    pointerEvents: "none",
  },
  envelopeHomeSimpleImage: {
    position: "absolute",
    left: "50%",
    top: "54%",
    width: "96%",
    height: "auto",
    display: "block",
    transform: "translate(-50%, -50%)",
    filter:
      "drop-shadow(0 16px 28px color-mix(in srgb, var(--ink) 16%, transparent))",
    transformOrigin: "50% 62%",
    pointerEvents: "none",
  },
  envelopeHomeArtOpen: {
    opacity: 0,
    width: "112%",
    height: "132%",
    left: "-6%",
    top: "-34%",
  },
  envelopeHomeFlap: {
    display: "none",
  },
  envelopeHomeSeal: {
    display: "none",
  },
  envelopeHomeDevelopPhoto: {
    position: "absolute",
    left: "30%",
    right: "30%",
    bottom: "30%",
    height: "112%",
    overflow: "hidden",
    borderRadius: "16px",
    opacity: 0,
    filter: "blur(10px) saturate(0.94)",
    zIndex: 12,
    transform: "translateY(26px) scale(0.9)",
    transformOrigin: "50% 80%",
    boxShadow:
      "0 0 0 1px color-mix(in srgb, var(--paper-card) 68%, transparent) inset, 0 12px 24px -18px color-mix(in srgb, var(--ink) 38%, transparent)",
    pointerEvents: "none",
  },
  envelopeHomeCopy: {
    display: "grid",
    justifyItems: "center",
    gap: "5px",
    color: "var(--ink)",
    fontFamily: "var(--font-display)",
    textAlign: "center",
    pointerEvents: "none",
  },
  envelopeHomeTitle: {
    margin: 0,
    color: "color-mix(in srgb, var(--ink) 86%, var(--ink-soft))",
    fontSize: "17px",
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: "var(--tracking-label)",
  },
  envelopeHomeAction: {
    minHeight: "18px",
    color: "transparent",
    fontFamily: "var(--font-ui)",
    fontSize: 0,
    lineHeight: 1,
    letterSpacing: "var(--tracking-body)",
  },
  letterTraySubPrimary: {
    color: "var(--seal)",
    fontSize: "12.5px",
  },
  letterTraySub: {
    color: "color-mix(in srgb, var(--ink) 62%, var(--ink-soft))",
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
    fontWeight: 500,
  },
  letterTrayRetryButton: {
    minHeight: "30px",
    padding: "4px 14px",
    border: "1px solid color-mix(in srgb, var(--seal) 30%, var(--line))",
    borderRadius: "999px",
    background: "color-mix(in srgb, var(--paper-card) 78%, transparent)",
    color: "var(--seal)",
    fontFamily: "var(--font-display)",
    fontSize: "12px",
    fontWeight: 400,
    letterSpacing: "var(--tracking-body)",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  trayLetterButton: {
    width: "76px",
    height: "48px",
    flex: "0 0 auto",
    borderRadius: "var(--radius-md)",
    transform: "rotate(-1deg)",
    boxShadow:
      "0 0 0 1px color-mix(in srgb, var(--seal-soft) 20%, transparent) inset, 0 10px 20px -17px color-mix(in srgb, var(--seal) 36%, transparent)",
  },
  trayLetterButtonCompact: {
    width: "58px",
    height: "38px",
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
  viewerPanelOwn: {
    width: "min(calc(100vw - 24px), 520px)",
    gap: "12px",
  },
  viewerOwnTopBar: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "76px minmax(0, 1fr) 76px",
    alignItems: "center",
    gap: "6px",
    minHeight: "56px",
  },
  viewerOwnCloseButton: {
    justifySelf: "start",
    color: "var(--ink-soft)",
  },
  viewerOwnHeaderSpacer: {
    width: "76px",
    height: "1px",
    display: "block",
  },
  viewerOwnHeader: {
    display: "grid",
    justifyItems: "center",
    gap: "4px",
    color: "var(--ink)",
    textAlign: "center",
  },
  viewerOwnKicker: {
    margin: 0,
    fontFamily: "var(--font-display)",
    fontSize: "20px",
    letterSpacing: "var(--tracking-label)",
    lineHeight: 1.45,
  },
  viewerOwnNote: {
    margin: 0,
    fontFamily: "var(--font-display)",
    fontSize: "12px",
    letterSpacing: "var(--tracking-body)",
    lineHeight: 1.6,
    color: "var(--ink-soft)",
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
  viewerOwnImageFrame: {
    width: "100%",
    height:
      "min(78dvh, calc(100dvh - 152px - env(safe-area-inset-top) - env(safe-area-inset-bottom)))",
    minHeight: "min(520px, 68dvh)",
    padding: "0",
    border: "none",
    borderRadius: "24px",
    background: "transparent",
    boxShadow:
      "0 2px 6px rgba(70,50,30,.16), 0 16px 40px -10px rgba(70,50,30,.30)",
  },
  viewerImage: {
    width: "100%",
    height: "100%",
    borderRadius: "var(--radius-lg)",
  },
  viewerOwnImage: {
    width: "100%",
    height: "100%",
    borderRadius: "24px",
    objectPosition: "center center",
  },
  viewerSaveButtonLayout: {
    width: "min(100%, 330px)",
    transition: "opacity var(--dur-reveal) var(--ease-gentle)",
  },
  viewerSaveButtonSaved: {
    opacity: 0,
  },
  viewerSaveButtonHidden: {
    display: "none",
  },
  reportSheetActions: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
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
