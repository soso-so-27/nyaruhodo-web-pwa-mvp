"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";

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
const HOME_DAYLIGHT_ANCHORS = [
  { minute: 5 * 60, top: "#fcfbf9", bottom: "#f5f2ec" },
  { minute: 12 * 60, top: "#fbfaf7", bottom: "#f4f1ea" },
  { minute: 17 * 60 + 30, top: "#faf7f1", bottom: "#f1ebdf" },
  { minute: 20 * 60, top: "#f8f6f1", bottom: "#efece4" },
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
  const daylightStyle = useDaylight(now);
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
  const latestOwnPhoto = useMemo(
    () => getLatestOwnPhoto(ownSleepingPhotos),
    [ownSleepingPhotos],
  );
  const homePhoto = targetPhoto ?? latestOwnPhoto;
  const shouldHidePresence = true;
  const guidanceCopy = getHomeStatusCopy(deskState, catName, now);
  const isBefore = deskState === "1" || deskState === "1b";
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
    event.currentTarget.setPointerCapture(event.pointerId);
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


  return (
    <section
      data-testid="home-desk-model"
      data-state={deskState}
      style={{
        ...deskStyles.page,
        ...daylightStyle,
      } as CSSProperties}
      aria-label="きょう"
    >
      <div style={deskStyles.stage}>
        <div
          style={{
            ...deskStyles.homeHero,
            ...(deskState === "3" ? deskStyles.homeHeroDelivered : {}),
            ...(deskState === "4" ? deskStyles.homeHeroOpened : {}),
          }}
        >
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
              aria-label={`${catName}のねがおを大きく見る`}
            >
              <span style={deskStyles.homeFrame}>
                <StoredPhotoImage
                  src={getPhotoDisplaySrc(homePhoto)}
                  alt=""
                  style={deskStyles.homeFrameImage}
                />
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
              aria-label="はじめての ねがおを とろう"
            >
              <AppIcon name="camera" size={32} />
              <span style={deskStyles.homeEmptyTitle}>
                はじめての ねがおを とろう
              </span>
              <span style={deskStyles.homeEmptySub}>
                とると、ここに {catName}が すむ
              </span>
            </button>
          )}

          <div style={deskStyles.homeCopyWrap}>
            <p
              style={deskStyles.homeTitle}
              className={
                guidanceCopy.tone === "soon" && !prefersReducedMotion
                  ? "desk-evening-soon-copy"
                  : undefined
              }
            >
              {guidanceCopy.title}
            </p>
            {guidanceCopy.sub ? (
              <p style={deskStyles.homeSub}>{guidanceCopy.sub}</p>
            ) : null}
          </div>

          {isBefore ? (
            <AppButton
              variant="secondary"
              size="md"
              onClick={onTakePhoto}
              style={deskStyles.homeCaptureButton}
            >
              ねがおを とる
            </AppButton>
          ) : null}

          {deskState === "3" ? (
            <div
              style={{
                ...deskStyles.selectionLockedStage,
                ...deskStyles.deliveredLetterWrap,
              }}
              onContextMenu={(event) => event.preventDefault()}
            >
              <button
                type="button"
                role="button"
                data-testid="desk-open-letter"
                aria-label="そっと ひらく"
                style={{
                  ...deskStyles.selectionLockedStage,
                  ...deskStyles.arrivedLetterButton,
                }}
                className={holdProgress ? "desk-letter-holding" : undefined}
                onPointerDown={startHold}
                onPointerUp={cancelHold}
                onPointerCancel={cancelHold}
                onPointerLeave={cancelHold}
                onContextMenu={(event) => event.preventDefault()}
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
              </button>
              <span
                style={{
                  ...deskStyles.holdLabel,
                  ...(holdProgress ? deskStyles.holdLabelActive : {}),
                }}
              >
                そっと ひらく
              </span>
            </div>
          ) : null}
        </div>

        {omoideMemory ? (
          <AppCard
            as="button"
            type="button"
            variant="section"
            padding="md"
            interactive
            data-testid="omoide-arrival-letter"
            style={deskStyles.omoideArrival}
            onClick={() => {
              setOpeningOmoideMemory(omoideMemory);
              onOpenOmoideMemory?.(omoideMemory);
            }}
            aria-label="思い出が、とどきました"
          >
            <span style={deskStyles.omoideLetterIcon} aria-hidden="true">
              思
            </span>
            <span style={deskStyles.omoideArrivalText}>
              <span style={deskStyles.omoideArrivalKicker}>
                今夜は、思い出が とどきました
              </span>
              <span style={deskStyles.omoideArrivalTitle}>過去から、ねがお。</span>
              <span style={deskStyles.omoideArrivalSub}>
                {omoideMemory.subtitle}
              </span>
            </span>
          </AppCard>
        ) : null}

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
        .desk-letter-holding [data-develop-photo="true"] {
          opacity: 1 !important;
          filter: blur(0) !important;
          transform: scale(1) !important;
        }
        @media (prefers-reduced-motion: reduce) {
          .desk-frame-breathe,
          .desk-evening-soon-copy {
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
    const colors = getDaylightColors(minuteKey * 60000);
    return {
      "--home-frame-light": colors.top,
      "--home-frame-glow": colors.bottom,
    } as CSSProperties;
  }, [minuteKey]);
}

function getDeskState(eveningState: EveningHomeState): DeskState {
  if (eveningState.kind === "waiting") return "2";
  if (eveningState.kind === "delivered") return "3";
  if (eveningState.kind === "opened") return "4";
  return eveningState.isTodayDelivery ? "1" : "1b";
}

function isEveningSoonWindow(now: number) {
  const minute = getJstMinuteOfDay(now);
  return minute >= 17 * 60 && minute < 20 * 60;
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
      return {
        top: interpolateHexColor(start.top, end.top, progress),
        bottom: interpolateHexColor(start.bottom, end.bottom, progress),
      };
    }
  }

  return HOME_DAYLIGHT_ANCHORS[HOME_DAYLIGHT_ANCHORS.length - 1];
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

function getLatestOwnPhoto(photos: OwnSleepingPhoto[]) {
  return photos.reduce<OwnSleepingPhoto | null>(
    (latest, photo) =>
      !latest || photo.createdAt > latest.createdAt ? photo : latest,
    null,
  );
}

function getHomeStatusCopy(
  state: DeskState,
  catName: string,
  now: number,
): { title: string; sub?: string; tone?: "soon" } {
  switch (state) {
    case "1":
      return { title: "きょうも すやすや" };
    case "1b":
      return { title: "おやすみ", sub: "また、あした" };
    case "2":
      if (isEveningSoonWindow(now)) {
        return { title: "そろそろ、とどくころ", tone: "soon" };
      }
      return {
        title: `${catName}を おくった`,
        sub: "よる、よその ねがお が とどく",
      };
    case "3":
      return { title: "とどいた" };
    case "4":
      return {
        title: "どこかの ねこも、ねてた",
        sub: `${catName}の ねがおも、どこかへ`,
      };
    default:
      return { title: "" };
  }
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
    position: "relative",
    minHeight: "100svh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding:
      "calc(24px + env(safe-area-inset-top)) 22px calc(var(--bottom-nav-height) + var(--bottom-nav-bottom-offset) + 30px + env(safe-area-inset-bottom))",
    color: "var(--ink)",
    background: "linear-gradient(180deg, var(--paper) 0%, var(--paper-warm) 100%)",
  },
  stage: {
    position: "relative",
    zIndex: 1,
    flex: 1,
    width: "min(100%, 390px)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "20px",
    paddingTop: "12px",
  },
  homeHero: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "20px",
  },
  homeHeroDelivered: {
    gap: "18px",
  },
  homeHeroOpened: {
    gap: "18px",
  },
  homeFrameButton: {
    display: "block",
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
    width: "min(100%, 430px)",
    aspectRatio: "3 / 4",
    padding: "10px",
    borderRadius: "var(--radius-2xl)",
    background: "var(--home-frame-light, var(--paper))",
    boxShadow:
      "0 20px 54px color-mix(in srgb, var(--home-frame-glow, var(--paper-warm)) 72%, transparent)",
    overflow: "hidden",
  },
  homeFrameImage: {
    width: "100%",
    height: "100%",
    borderRadius: "var(--radius-xl)",
    objectFit: "contain",
  },
  homeEmptyFrame: {
    width: "min(100%, 430px)",
    aspectRatio: "3 / 4",
    boxSizing: "border-box",
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    gap: "12px",
    padding: "24px",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-2xl)",
    background: "var(--home-frame-light, var(--paper))",
    color: "var(--ink-soft)",
    boxShadow:
      "0 20px 54px color-mix(in srgb, var(--home-frame-glow, var(--paper-warm)) 72%, transparent)",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  homeEmptyTitle: {
    color: "var(--ink)",
    fontFamily: "var(--font-display)",
    fontSize: "18px",
    letterSpacing: "var(--tracking-label)",
  },
  homeEmptySub: {
    color: "var(--ink-soft)",
    fontFamily: "var(--font-display)",
    fontSize: "13px",
    letterSpacing: "var(--tracking-body)",
  },
  homeCopyWrap: {
    display: "grid",
    justifyItems: "center",
    gap: "8px",
    minHeight: "54px",
  },
  homeTitle: {
    margin: 0,
    color: "var(--ink-soft)",
    fontFamily: "var(--font-display)",
    fontSize: "18px",
    fontWeight: 400,
    letterSpacing: "var(--tracking-label)",
    textAlign: "center",
  },
  homeSub: {
    margin: 0,
    color: "var(--ink-faint)",
    fontFamily: "var(--font-display)",
    fontSize: "13px",
    letterSpacing: "var(--tracking-body)",
    textAlign: "center",
  },
  homeCaptureButton: {
    minWidth: "176px",
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
    width: "min(100%, 330px)",
    display: "grid",
    gridTemplateColumns: "52px 1fr",
    alignItems: "center",
    gap: "12px",
    marginTop: "4px",
    color: "var(--ink)",
    textAlign: "left",
  },
  omoideLetterIcon: {
    width: "48px",
    height: "34px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-sm)",
    background: "var(--paper-card)",
    color: "var(--seal)",
    fontFamily: "var(--font-display)",
    fontSize: "15px",
    letterSpacing: "0",
    transform: "rotate(-2deg)",
  },
  omoideArrivalText: {
    display: "grid",
    gap: "4px",
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
    fontSize: "15px",
    letterSpacing: "var(--tracking-label)",
  },
  omoideArrivalSub: {
    color: "var(--ink-soft)",
    fontSize: "12px",
    lineHeight: 1.55,
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
