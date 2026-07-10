"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { syncLocalDataWithAccount } from "../../lib/accountSync";
import { isUsablePhotoSrc } from "../../lib/photoStorage";
import {
  resolvePhotoFallbackSrcs,
  resolvePhotoSrc,
} from "../../lib/photoSources";
import {
  autoOpenExpiredEveningDeliveries,
  readEveningDeliveryStore,
} from "../../lib/home/eveningDelivery";
import {
  isExchangePhotoLocallyBlocked,
  readKeptExchangePhotosForAlbum,
  readOwnSleepingPhotosForAlbum,
  type ExchangePhoto,
  type OwnSleepingPhoto,
} from "../../lib/home/sleepingPhotos";
import { readCurrentOnboardingProgress } from "../../lib/onboarding/progress";
import {
  getStoragePhotoSignedUrl,
  StoredPhotoImage,
} from "../ui/StoredPhotoImage";

type BoardSide = "sent" | "delivered";
type BoardMode = "v2" | "current";
type BoardLayout = "crop" | "natural";
type BoardFrame = "f1" | "f2" | "f3";
type BoardOrder = "newest" | "brightest";

type PrototypePhoto = {
  id: string;
  sourcePhotoId?: string;
  side: BoardSide;
  src: string;
  thumbnailSrc?: string;
  displaySrc?: string;
  originalSrc?: string;
  boardSrc: string;
  fallbackSrcs: string[];
  dateKey: string;
  dateLabel: string;
  timestamp: number;
  catName?: string;
};

const PHOTO_STORAGE_EVENT = "nyaruhodo_box_photos_updated";
const ACCOUNT_RESTORE_TIMEOUT_MS = 8000;
const BOARD_V2_PREFERENCES_KEY = "nyaruhodo_board_v2_preferences";
const DEFAULT_BOARD_PREFERENCES = {
  mode: "v2" as BoardMode,
  layout: "crop" as BoardLayout,
  frame: "f1" as BoardFrame,
  order: "newest" as BoardOrder,
};

export function BoardV2Prototype({
  returnToPath = "/prototypes/board-v2",
}: {
  returnToPath?: string;
}) {
  const [side, setSide] = useState<BoardSide>("sent");
  const [preferences, setPreferences] = useState(DEFAULT_BOARD_PREFERENCES);
  const [hasLoadedPreferences, setHasLoadedPreferences] = useState(false);
  const { mode, layout, frame, order } = preferences;
  const [allPhotos, setAllPhotos] = useState<PrototypePhoto[]>([]);
  const [photoRatios, setPhotoRatios] = useState<Record<string, number>>({});
  const [photoBrightness, setPhotoBrightness] = useState<Record<string, number>>({});
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [viewerPhoto, setViewerPhoto] = useState<PrototypePhoto | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<
    "idle" | "checking" | "restored" | "skipped" | "error"
  >("idle");

  useEffect(() => {
    const refresh = () => {
      const nextPhotos = readPrototypePhotos();
      setAllPhotos(nextPhotos);
      return nextPhotos;
    };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(PHOTO_STORAGE_EVENT, refresh);
    window.addEventListener("neteruneko_evening_delivery_updated", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(PHOTO_STORAGE_EVENT, refresh);
      window.removeEventListener("neteruneko_evening_delivery_updated", refresh);
    };
  }, []);

  useEffect(() => {
    setPreferences(readBoardPreferences());
    setHasLoadedPreferences(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedPreferences) {
      return;
    }
    try {
      window.localStorage.setItem(BOARD_V2_PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // The prototype still works when the browser does not expose local storage.
    }
  }, [hasLoadedPreferences, preferences]);

  useEffect(() => {
    let active = true;

    void Promise.all(
      allPhotos.map(async (photo) => {
        const brightness = await readPhotoBrightness(photo.boardSrc);
        return [getPhotoKey(photo), brightness] as const;
      }),
    ).then((values) => {
      if (!active) {
        return;
      }
      setPhotoBrightness((current) => {
        const next = { ...current };
        for (const [key, brightness] of values) {
          if (brightness !== null) {
            next[key] = brightness;
          }
        }
        return next;
      });
    });

    return () => {
      active = false;
    };
  }, [allPhotos]);

  async function restoreRemotePhotos() {
    setRestoreStatus("checking");
    const result = await syncAccountDataForPrototype();
    const restoredPhotos = readPrototypePhotos();

    setAllPhotos(restoredPhotos);
    setRestoreStatus(
      result.status === "error"
        ? "error"
        : restoredPhotos.length > 0
          ? "restored"
          : "skipped",
    );
  }

  const photosForSide = useMemo(
    () =>
      allPhotos
        .filter((photo) => photo.side === side)
        .sort((a, b) => {
          if (order === "brightest") {
            const brightnessDelta =
              (photoBrightness[getPhotoKey(b)] ?? -1) -
              (photoBrightness[getPhotoKey(a)] ?? -1);
            if (brightnessDelta !== 0) {
              return brightnessDelta;
            }
          }
          return b.timestamp - a.timestamp;
        }),
    [allPhotos, order, photoBrightness, side],
  );
  const months = useMemo(() => buildMonths(photosForSide), [photosForSide]);
  const monthKey = selectedMonthKey ?? months[0]?.key ?? getCurrentMonthKey();
  const monthPhotos = useMemo(
    () => photosForSide.filter((photo) => getMonthKey(photo.dateKey) === monthKey),
    [monthKey, photosForSide],
  );

  useEffect(() => {
    if (months.length === 0) {
      setSelectedMonthKey(null);
      return;
    }

    if (!selectedMonthKey || !months.some((month) => month.key === selectedMonthKey)) {
      setSelectedMonthKey(months[0].key);
    }
  }, [months, selectedMonthKey]);

  const displayedPhotos = monthPhotos;
  const hasAnyRealPhoto = allPhotos.length > 0;
  const updatePreferences = (next: Partial<typeof preferences>) =>
    setPreferences((current) => ({ ...current, ...next }));

  return (
    <main style={styles.page} data-testid="board-v2-prototype">
      <header style={styles.header}>
        <div>
          <p style={styles.kicker}>prototype</p>
          <h1 style={styles.title}>ねこだよりボード v2</h1>
          <p style={styles.lead}>実データで、散らばり具合を見比べます。</p>
        </div>
        <div style={styles.compareControls} aria-label="表示の比較">
          <SegmentedControl
            label="配置"
            idPrefix="board-v2"
            value={mode}
            options={[
              { value: "v2", label: "v2" },
              { value: "current", label: "現行" },
            ]}
            onChange={(value) => updatePreferences({ mode: value as BoardMode })}
          />
          <SegmentedControl
            label="写真の形"
            idPrefix="board-v2-layout"
            value={layout}
            options={[
              { value: "crop", label: "crop" },
              { value: "natural", label: "原寸" },
            ]}
            onChange={(value) => updatePreferences({ layout: value as BoardLayout })}
          />
          <SegmentedControl
            label="枠"
            idPrefix="board-v2-frame"
            value={frame}
            options={[
              { value: "f1", label: "f1" },
              { value: "f2", label: "f2" },
              { value: "f3", label: "f3" },
            ]}
            onChange={(value) => updatePreferences({ frame: value as BoardFrame })}
          />
          <SegmentedControl
            label="席順"
            idPrefix="board-v2-order"
            value={order}
            options={[
              { value: "newest", label: "新しい順" },
              { value: "brightest", label: "明るい順" },
            ]}
            onChange={(value) => updatePreferences({ order: value as BoardOrder })}
          />
        </div>
      </header>

      <section style={styles.controls} aria-label="ねこだよりボードの切り替え">
        <SegmentedControl
          label="面"
          value={side}
          options={[
            { value: "sent", label: "おくった" },
            { value: "delivered", label: "とどいた" },
          ]}
          onChange={(value) => {
            setSide(value as BoardSide);
            setSelectedMonthKey(null);
          }}
        />
        <div style={styles.monthList} aria-label="月を選ぶ">
          {(months.length > 0 ? months : [{ key: monthKey, label: formatMonthLabel(monthKey), count: 0 }]).map(
            (month) => {
              const selected = month.key === monthKey;
              return (
                <button
                  key={month.key}
                  type="button"
                  data-testid={`board-v2-month-${month.key}`}
                  style={{
                    ...styles.monthButton,
                    ...(selected ? styles.monthButtonActive : null),
                  }}
                  onClick={() => setSelectedMonthKey(month.key)}
                >
                  <span>{month.label}</span>
                  <small>{month.count}枚</small>
                </button>
              );
            },
          )}
        </div>
      </section>

      <section style={styles.prototypeShell}>
        <div style={styles.prototypeMeta}>
          <span>{mode === "v2" ? "v2: 積もる紙面" : "現行: 比較用の整列"}</span>
          <span>
            {displayedPhotos.length}枚
            {restoreStatus === "checking" ? " / 読み込み中" : ""}
          </span>
        </div>
        {!hasAnyRealPhoto ? (
          <AccountRestoreNotice
            status={restoreStatus}
            returnToPath={returnToPath}
            onRestore={restoreRemotePhotos}
          />
        ) : displayedPhotos.length === 0 ? (
          <div style={styles.empty} data-testid="board-v2-empty">
            この月の写真はまだありません。
          </div>
        ) : mode === "v2" ? (
          <V2Board
            photos={displayedPhotos}
            layout={layout}
            frame={frame}
            ratios={photoRatios}
            onNaturalSize={(photo, size) =>
              setPhotoRatios((current) => {
                const key = getPhotoKey(photo);
                const ratio = size.width / size.height;
                return Math.abs((current[key] ?? 0) - ratio) < 0.001
                  ? current
                  : { ...current, [key]: ratio };
              })
            }
            onOpen={setViewerPhoto}
          />
        ) : (
          <CurrentBoard
            photos={displayedPhotos}
            layout={layout}
            frame={frame}
            ratios={photoRatios}
            onNaturalSize={(photo, size) =>
              setPhotoRatios((current) => {
                const key = getPhotoKey(photo);
                const ratio = size.width / size.height;
                return Math.abs((current[key] ?? 0) - ratio) < 0.001
                  ? current
                  : { ...current, [key]: ratio };
              })
            }
            onOpen={setViewerPhoto}
          />
        )}
      </section>

      {viewerPhoto ? (
        <PhotoViewer photo={viewerPhoto} onClose={() => setViewerPhoto(null)} />
      ) : null}
    </main>
  );
}

async function syncAccountDataForPrototype() {
  try {
    return await Promise.race([
      syncLocalDataWithAccount({ forceRestore: true }),
      new Promise<Awaited<ReturnType<typeof syncLocalDataWithAccount>>>((resolve) => {
        window.setTimeout(
          () =>
            resolve({
              status: "error",
              pushedCats: 0,
              pushedRecords: 0,
              pushedCatGalleryPhotos: 0,
              pushedCollectionPhotos: 0,
              pushedOwnSleepingPhotos: 0,
              pushedKeptExchangePhotos: 0,
              pushedLocalState: 0,
              restoredCats: 0,
              restoredRecords: 0,
              restoredCatGalleryPhotos: 0,
              restoredCollectionPhotos: 0,
              restoredOwnSleepingPhotos: 0,
              restoredKeptExchangePhotos: 0,
              restoredLocalState: 0,
              errors: ["Account restore timed out."],
            }),
          ACCOUNT_RESTORE_TIMEOUT_MS,
        );
      }),
    ]);
  } catch {
    return {
      status: "error" as const,
      pushedCats: 0,
      pushedRecords: 0,
      pushedCatGalleryPhotos: 0,
      pushedCollectionPhotos: 0,
      pushedOwnSleepingPhotos: 0,
      pushedKeptExchangePhotos: 0,
      pushedLocalState: 0,
      restoredCats: 0,
      restoredRecords: 0,
      restoredCatGalleryPhotos: 0,
      restoredCollectionPhotos: 0,
      restoredOwnSleepingPhotos: 0,
      restoredKeptExchangePhotos: 0,
      restoredLocalState: 0,
      errors: ["Account restore failed."],
    };
  }
}

function AccountRestoreNotice({
  status,
  returnToPath,
  onRestore,
}: {
  status: "idle" | "checking" | "restored" | "skipped" | "error";
  returnToPath: string;
  onRestore: () => void;
}) {
  const text =
    status === "checking"
      ? "アカウントの写真を読み込んでいます。"
      : status === "error"
        ? "アカウントの写真を読み込めませんでした。ログイン状態を確認してください。"
        : status === "skipped"
          ? "このブラウザには写真がなく、アカウントからも読み込めませんでした。ログインしているPreviewか、いつものPWAで開いてください。"
          : "このブラウザには、まだ表示できる写真がありません。ログイン済みならアカウントから読み込めます。";

  return (
    <div style={styles.restoreNotice} data-testid="board-v2-restore-notice">
      <p style={styles.restoreTitle}>実データがまだありません</p>
      <p style={styles.restoreText}>{text}</p>
      <div style={styles.restoreActions}>
        <a
          href={`/account/create?returnTo=${encodeURIComponent(returnToPath)}`}
          data-testid="board-v2-login-link"
          style={styles.restoreLoginLink}
        >
          ログインして読み込む
        </a>
        <button
          type="button"
          data-testid="board-v2-restore-account"
          style={styles.restoreButton}
          onClick={onRestore}
          disabled={status === "checking"}
        >
          {status === "checking" ? "読み込み中" : "アカウントから読み込む"}
        </button>
      </div>
    </div>
  );
}

function V2Board({
  photos,
  layout,
  frame,
  ratios,
  onNaturalSize,
  onOpen,
}: {
  photos: PrototypePhoto[];
  layout: BoardLayout;
  frame: BoardFrame;
  ratios: Record<string, number>;
  onNaturalSize: (photo: PrototypePhoto, size: { width: number; height: number }) => void;
  onOpen: (photo: PrototypePhoto) => void;
}) {
  const placements = useMemo(
    () => buildV2Placements(photos, layout, ratios),
    [layout, photos, ratios],
  );
  const dated = new Set<string>();
  const sparse = photos.length <= 3;

  return (
    <div
      style={{
        ...styles.v2Board,
        minHeight: placements.boardHeight,
      }}
      data-testid="board-v2-layout"
    >
      {placements.items.map(({ photo, style, height }, index) => {
        const showDate = !dated.has(photo.dateKey);
        dated.add(photo.dateKey);

        return (
          <button
            key={`${photo.side}-${photo.sourcePhotoId ?? photo.id}-${photo.dateKey}`}
            type="button"
            data-testid="board-v2-photo"
            data-date-key={photo.dateKey}
            data-timestamp={photo.timestamp}
            style={{
              ...styles.v2PhotoButton,
              ...(sparse ? styles.v2PhotoButtonSparse : null),
              ...style,
            }}
            onClick={() => onOpen(photo)}
          >
            {showDate && frame === "f1" ? (
              <span data-testid="board-v2-date-tape" style={styles.dateTape}>
                {formatDateTape(photo.dateKey)}
              </span>
            ) : null}
            <StoredPhotoImage
              src={photo.boardSrc}
              previewSrc={photo.thumbnailSrc}
              fallbackSrcs={photo.fallbackSrcs}
              storageVariant="thumbnail"
              alt={photo.side === "sent" ? "おくったねがお" : "とどいたねがお"}
              loading={index < 8 ? "eager" : "lazy"}
              decoding="async"
              style={getFrameStyle(frame)}
              imageStyle={getBoardImageStyle(layout)}
              width={180}
              height={Math.round(height)}
              onNaturalSize={(size) => onNaturalSize(photo, size)}
            />
            {photo.catName ? <span style={styles.catBadge}>{photo.catName}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function CurrentBoard({
  photos,
  layout,
  frame,
  ratios,
  onNaturalSize,
  onOpen,
}: {
  photos: PrototypePhoto[];
  layout: BoardLayout;
  frame: BoardFrame;
  ratios: Record<string, number>;
  onNaturalSize: (photo: PrototypePhoto, size: { width: number; height: number }) => void;
  onOpen: (photo: PrototypePhoto) => void;
}) {
  return (
    <div style={styles.currentGrid} data-testid="board-v2-current-layout">
      {photos.map((photo, index) => (
        <button
          key={`${photo.side}-${photo.sourcePhotoId ?? photo.id}-${photo.dateKey}`}
          type="button"
          data-testid="board-v2-current-photo"
          data-date-key={photo.dateKey}
          data-timestamp={photo.timestamp}
          style={{
            ...styles.currentPhotoButton,
            ...(layout === "natural"
              ? { aspectRatio: `${ratios[getPhotoKey(photo)] ?? 1} / 1` }
              : null),
          }}
          onClick={() => onOpen(photo)}
        >
          <StoredPhotoImage
            src={photo.boardSrc}
            previewSrc={photo.thumbnailSrc}
            fallbackSrcs={photo.fallbackSrcs}
            storageVariant="thumbnail"
            alt={photo.side === "sent" ? "おくったねがお" : "とどいたねがお"}
            loading={index < 8 ? "eager" : "lazy"}
            decoding="async"
            style={getCurrentFrameStyle(frame, layout)}
            imageStyle={getBoardImageStyle(layout)}
            width={148}
            height={layout === "natural" ? undefined : 148}
            onNaturalSize={(size) => onNaturalSize(photo, size)}
          />
          <span style={styles.currentDate}>{formatDateTape(photo.dateKey)}</span>
        </button>
      ))}
    </div>
  );
}

function PhotoViewer({
  photo,
  onClose,
}: {
  photo: PrototypePhoto;
  onClose: () => void;
}) {
  return (
    <div style={styles.viewerOverlay} role="dialog" aria-modal="true">
      <button type="button" style={styles.viewerBackdrop} onClick={onClose} aria-label="閉じる" />
      <div style={styles.viewerSheet}>
        <div style={styles.viewerHeader}>
          <span>{photo.dateLabel}</span>
          <button type="button" style={styles.viewerClose} onClick={onClose}>
            閉じる
          </button>
        </div>
        <StoredPhotoImage
          src={getPhotoDetailSrc(photo)}
          previewSrc={photo.thumbnailSrc}
          fallbackSrcs={photo.fallbackSrcs}
          storageVariant="display"
          alt={photo.side === "sent" ? "おくったねがお" : "とどいたねがお"}
          loading="eager"
          decoding="async"
          style={styles.viewerFrame}
          imageStyle={styles.viewerImage}
        />
      </div>
    </div>
  );
}

function SegmentedControl({
  label,
  idPrefix = "board-v2",
  value,
  options,
  onChange,
}: {
  label: string;
  idPrefix?: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div style={styles.segmented} role="tablist" aria-label={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            data-testid={`${idPrefix}-${option.value}`}
            style={{
              ...styles.segmentButton,
              ...(selected ? styles.segmentButtonActive : null),
            }}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function readPrototypePhotos(): PrototypePhoto[] {
  const sent = readOwnSleepingPhotosForAlbum(null)
    .filter((photo) => isUsablePhotoSrc(photo.src))
    .map((photo) => createPrototypePhotoFromOwn(photo));
  const delivered = mergeDeliveredPhotos([
    ...readOpenedEveningDeliveredPhotos(),
    ...readOnboardingDeliveredPhotos(),
    ...readKeptExchangePhotosForAlbum(),
  ]).map((photo) => createPrototypePhotoFromExchange(photo));

  return [...sent, ...delivered].sort((a, b) => b.timestamp - a.timestamp);
}

function readOpenedEveningDeliveredPhotos(): ExchangePhoto[] {
  autoOpenExpiredEveningDeliveries();
  return Object.values(readEveningDeliveryStore())
    .filter((day) => Boolean(day.deliveredPhoto && day.openedAt))
    .map((day) => ({
      ...day.deliveredPhoto!,
      deliveredAt: day.deliveredAt ?? day.deliveredPhoto!.deliveredAt,
    }))
    .filter((photo) => !isExchangePhotoLocallyBlocked(photo))
    .filter((photo) => isUsablePhotoSrc(photo.src));
}

function readOnboardingDeliveredPhotos(): ExchangePhoto[] {
  const progress = readCurrentOnboardingProgress();
  const deliveredPhoto = progress?.deliveredPhoto;
  if (
    !deliveredPhoto ||
    !progress.isDeliveredPhotoKept ||
    isExchangePhotoLocallyBlocked(deliveredPhoto) ||
    !isUsablePhotoSrc(deliveredPhoto.src)
  ) {
    return [];
  }

  return [
    {
      ...deliveredPhoto,
      deliveredAt: deliveredPhoto.deliveredAt ?? progress.updatedAt,
    },
  ];
}

function mergeDeliveredPhotos(photos: ExchangePhoto[]) {
  const byKey = new Map<string, ExchangePhoto>();
  for (const photo of photos) {
    byKey.set(photo.sourcePhotoId ? `source:${photo.sourcePhotoId}` : `id:${photo.id}`, photo);
  }
  return [...byKey.values()].sort((a, b) => getExchangeTimestamp(b) - getExchangeTimestamp(a));
}

function createPrototypePhotoFromOwn(photo: OwnSleepingPhoto): PrototypePhoto {
  const timestamp = getOwnTimestamp(photo);
  const dateKey = getLocalDateKey(timestamp);
  return {
    id: photo.id,
    side: "sent",
    src: photo.src,
    ...(photo.sourceMomentId ? { sourcePhotoId: photo.sourceMomentId } : {}),
    ...(photo.thumbnailSrc ? { thumbnailSrc: photo.thumbnailSrc } : {}),
    ...(photo.displaySrc ? { displaySrc: photo.displaySrc } : {}),
    ...(photo.originalSrc ? { originalSrc: photo.originalSrc } : {}),
    boardSrc: getPhotoTransformBaseSrc(photo),
    fallbackSrcs: getPhotoFallbackSrcs(photo),
    timestamp,
    dateKey,
    dateLabel: formatDateLabel(dateKey),
    catName: undefined,
  };
}

function createPrototypePhotoFromExchange(photo: ExchangePhoto): PrototypePhoto {
  const timestamp = getExchangeTimestamp(photo);
  const dateKey = getLocalDateKey(timestamp);
  return {
    id: photo.id,
    side: "delivered",
    src: photo.src,
    ...(photo.sourcePhotoId ? { sourcePhotoId: photo.sourcePhotoId } : {}),
    ...(photo.thumbnailSrc ? { thumbnailSrc: photo.thumbnailSrc } : {}),
    ...(photo.displaySrc ? { displaySrc: photo.displaySrc } : {}),
    ...(photo.originalSrc ? { originalSrc: photo.originalSrc } : {}),
    boardSrc: getPhotoTransformBaseSrc(photo),
    fallbackSrcs: getPhotoFallbackSrcs(photo),
    timestamp,
    dateKey,
    dateLabel: formatDateLabel(dateKey),
  };
}

function buildMonths(photos: PrototypePhoto[]) {
  const byMonth = new Map<string, number>();
  for (const photo of photos) {
    const key = getMonthKey(photo.dateKey);
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }
  return [...byMonth.entries()]
    .map(([key, count]) => ({ key, count, label: formatMonthLabel(key) }))
    .sort((a, b) => b.key.localeCompare(a.key));
}

function buildV2Placements(
  photos: PrototypePhoto[],
  layout: BoardLayout,
  ratios: Record<string, number>,
) {
  const total = photos.length;
  const sparse = total <= 3;
  const cardWidth = sparse ? 190 : total > 18 ? 150 : 166;
  const topPad = sparse ? 34 : 28;
  let cursorY = topPad;
  const items = photos.map((photo, index) => {
    const ratio = ratios[getPhotoKey(photo)] ?? 1;
    // A square reserve avoids a jump before natural dimensions are available.
    const height =
      layout === "natural"
        ? clamp(cardWidth / ratio, cardWidth * 0.58, cardWidth * 1.72)
        : cardWidth;
    const seed = seededUnit(`${photo.sourcePhotoId ?? photo.id}:${photo.dateKey}`);
    const rotate = -3 + seed * 6;
    const xUnit = seededUnit(`x:${photo.sourcePhotoId ?? photo.id}`);
    const maxShift = sparse ? 22 : 74;
    const x = (xUnit - 0.5) * maxShift * 2;
    const y = cursorY;
    // The visible centre remains above 70%; taller originals overlap less.
    const overlap = sparse ? 0.12 : 0.22;
    cursorY += Math.round(height * (1 - overlap));

    return {
      photo,
      height,
      style: {
        width: `${cardWidth}px`,
        height: `${Math.round(height)}px`,
        top: `${y}px`,
        left: `calc(50% + ${Math.round(x)}px)`,
        transform: `translateX(-50%) rotate(${rotate.toFixed(2)}deg)`,
        zIndex: total - index,
      } satisfies CSSProperties,
    };
  });

  return {
    boardHeight: `${Math.ceil(cursorY + topPad)}px`,
    items,
  };
}

function getFrameStyle(frame: BoardFrame): CSSProperties {
  if (frame === "f2") {
    return styles.photoFrameFine;
  }
  if (frame === "f3") {
    return styles.photoFrameBare;
  }
  return styles.photoFrame;
}

function getCurrentFrameStyle(frame: BoardFrame, layout: BoardLayout): CSSProperties {
  const base = frame === "f1" ? styles.currentPhotoFrame : getFrameStyle(frame);
  return layout === "natural"
    ? { ...base, width: "100%", height: "100%", aspectRatio: undefined }
    : base;
}

function getBoardImageStyle(layout: BoardLayout): CSSProperties {
  return {
    ...styles.photoImage,
    objectFit: layout === "natural" ? "contain" : "cover",
  };
}

function getPhotoKey(photo: PrototypePhoto) {
  return `${photo.side}:${photo.sourcePhotoId ?? photo.id}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getPhotoTransformBaseSrc(photo: {
  src: string;
  displaySrc?: string;
  originalSrc?: string;
  thumbnailSrc?: string;
}) {
  return resolvePhotoSrc(photo, "board");
}

function getPhotoDetailSrc(photo: PrototypePhoto) {
  return resolvePhotoSrc(photo, "detail");
}

function getPhotoFallbackSrcs(photo: {
  src: string;
  displaySrc?: string;
  originalSrc?: string;
  thumbnailSrc?: string;
}) {
  return resolvePhotoFallbackSrcs(photo);
}

function getOwnTimestamp(photo: OwnSleepingPhoto) {
  return photo.createdAt ?? parseTimestampFromId(photo.id) ?? Date.now();
}

function getExchangeTimestamp(photo: ExchangePhoto) {
  return photo.deliveredAt ?? parseTimestampFromId(photo.id) ?? Date.now();
}

function parseTimestampFromId(id: string | undefined) {
  const match = id?.match(/(?:^|[-:])(\d{13})(?:[-:]|$)/);
  const timestamp = match ? Number(match[1]) : NaN;
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getLocalDateKey(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentMonthKey() {
  return getMonthKey(getLocalDateKey(Date.now()));
}

function getMonthKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

function formatMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  return `${year}年${Number(month)}月`;
}

function formatDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return `${year}年${Number(month)}月${Number(day)}日`;
}

function formatDateTape(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function seededUnit(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function readBoardPreferences(): {
  mode: BoardMode;
  layout: BoardLayout;
  frame: BoardFrame;
  order: BoardOrder;
} {
  const fallback = DEFAULT_BOARD_PREFERENCES;

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(BOARD_V2_PREFERENCES_KEY);
    const value = raw ? (JSON.parse(raw) as Partial<typeof fallback>) : null;
    return {
      mode: value?.mode === "current" ? "current" : "v2",
      layout: value?.layout === "natural" ? "natural" : "crop",
      frame: value?.frame === "f2" || value?.frame === "f3" ? value.frame : "f1",
      order: value?.order === "brightest" ? "brightest" : "newest",
    };
  } catch {
    return fallback;
  }
}

async function readPhotoBrightness(source: string) {
  const displaySource = await getStoragePhotoSignedUrl(source, "thumbnail");
  if (!displaySource) {
    return null;
  }

  return new Promise<number | null>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 16;
        canvas.height = 16;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          resolve(null);
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let total = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          total += pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722;
        }
        resolve(total / (pixels.length / 4));
      } catch {
        // A CDN response without CORS stays in the normal chronological order.
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = displaySource;
  });
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100dvh",
    padding: "max(18px, env(safe-area-inset-top)) 18px 34px",
    color: "var(--ink)",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--paper) 92%, white 8%), color-mix(in srgb, var(--paper-warm) 88%, white 12%))",
    fontFamily: "var(--font-sans, sans-serif)",
  },
  header: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    maxWidth: 760,
    margin: "0 auto 18px",
  },
  compareControls: {
    display: "grid",
    justifyItems: "end",
    gap: 6,
    maxWidth: "100%",
  },
  kicker: {
    margin: "0 0 6px",
    fontSize: 11,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--ink-soft)",
  },
  title: {
    margin: 0,
    fontSize: 24,
    fontFamily: "var(--font-serif, serif)",
    fontWeight: 500,
    letterSpacing: 0,
  },
  lead: {
    margin: "6px 0 0",
    fontSize: 13,
    color: "var(--ink-soft)",
    lineHeight: 1.7,
  },
  controls: {
    display: "grid",
    gap: 12,
    maxWidth: 760,
    margin: "0 auto 16px",
  },
  segmented: {
    display: "inline-flex",
    width: "fit-content",
    padding: 4,
    border: "1px solid var(--line)",
    borderRadius: 999,
    background: "color-mix(in srgb, var(--paper-card) 82%, transparent)",
    boxShadow: "var(--shadow-e0)",
  },
  segmentButton: {
    minWidth: 72,
    border: 0,
    borderRadius: 999,
    padding: "8px 13px",
    color: "var(--ink-soft)",
    background: "transparent",
    font: "inherit",
    fontSize: 13,
    fontWeight: 700,
  },
  segmentButtonActive: {
    color: "var(--seal)",
    background: "color-mix(in srgb, var(--seal) 11%, var(--paper-card) 89%)",
    boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--seal) 24%, transparent)",
  },
  monthList: {
    display: "flex",
    gap: 8,
    overflowX: "auto",
    paddingBottom: 2,
  },
  monthButton: {
    border: "1px solid var(--line)",
    borderRadius: 999,
    padding: "8px 12px",
    color: "var(--ink-soft)",
    background: "color-mix(in srgb, var(--paper-card) 78%, transparent)",
    font: "inherit",
    fontSize: 12,
    whiteSpace: "nowrap",
  },
  monthButtonActive: {
    color: "var(--ink)",
    borderColor: "color-mix(in srgb, var(--seal) 28%, var(--line))",
    background: "color-mix(in srgb, var(--seal) 8%, var(--paper-card) 92%)",
  },
  prototypeShell: {
    maxWidth: 760,
    margin: "0 auto",
    borderRadius: 22,
    border: "1px solid var(--line)",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--paper-card) 86%, white 14%), color-mix(in srgb, var(--paper) 94%, white 6%))",
    boxShadow: "var(--shadow-e1)",
    overflow: "hidden",
  },
  prototypeMeta: {
    display: "flex",
    justifyContent: "space-between",
    padding: "13px 16px",
    borderBottom: "1px solid var(--line)",
    color: "var(--ink-soft)",
    fontSize: 12,
    fontWeight: 700,
  },
  empty: {
    minHeight: 300,
    display: "grid",
    placeItems: "center",
    padding: 24,
    color: "var(--ink-soft)",
    fontSize: 14,
  },
  restoreNotice: {
    minHeight: 300,
    display: "grid",
    alignContent: "center",
    justifyItems: "center",
    gap: 12,
    padding: 28,
    textAlign: "center",
  },
  restoreTitle: {
    margin: 0,
    color: "var(--ink)",
    fontSize: 17,
    fontWeight: 700,
  },
  restoreText: {
    maxWidth: 330,
    margin: 0,
    color: "var(--ink-soft)",
    fontSize: 13,
    lineHeight: 1.8,
  },
  restoreActions: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 4,
  },
  restoreLoginLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid color-mix(in srgb, var(--seal) 30%, var(--line))",
    borderRadius: 999,
    padding: "10px 18px",
    color: "var(--seal)",
    background: "color-mix(in srgb, var(--seal) 8%, var(--paper-card) 92%)",
    boxShadow: "var(--shadow-e0)",
    fontSize: 13,
    fontWeight: 700,
    textDecoration: "none",
  },
  restoreButton: {
    border: "1px solid var(--line)",
    borderRadius: 999,
    padding: "10px 18px",
    color: "var(--ink-soft)",
    background: "color-mix(in srgb, var(--paper-card) 86%, white 14%)",
    font: "inherit",
    fontSize: 13,
    fontWeight: 700,
  },
  v2Board: {
    position: "relative",
    margin: "0 auto",
    width: "min(100%, 430px)",
    padding: "0 0 16px",
    background:
      "radial-gradient(circle at 18% 8%, rgba(183, 111, 91, 0.08), transparent 28%), radial-gradient(circle at 88% 24%, rgba(117, 145, 180, 0.08), transparent 30%)",
  },
  v2PhotoButton: {
    position: "absolute",
    aspectRatio: "1 / 1",
    border: 0,
    padding: 0,
    background: "transparent",
    cursor: "pointer",
    transformOrigin: "50% 50%",
  },
  v2PhotoButtonSparse: {
    filter: "drop-shadow(0 12px 22px rgba(74, 60, 42, 0.12))",
  },
  photoFrame: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    border: "12px solid color-mix(in srgb, var(--paper-card) 78%, white 22%)",
    boxShadow:
      "0 14px 26px rgba(72, 58, 39, 0.14), inset 0 0 0 1px rgba(117, 90, 64, 0.08)",
    background: "var(--paper-card)",
  },
  photoFrameFine: {
    width: "100%",
    height: "100%",
    borderRadius: 2,
    border: "4px solid color-mix(in srgb, var(--paper-card) 72%, white 28%)",
    boxShadow: "0 7px 10px rgba(72, 58, 39, 0.14)",
    background: "var(--paper-card)",
  },
  photoFrameBare: {
    width: "100%",
    height: "100%",
    borderRadius: 0,
    border: "1px solid rgba(255, 255, 255, 0.84)",
    boxShadow: "0 5px 8px rgba(72, 58, 39, 0.16)",
    background: "var(--paper-card)",
  },
  photoImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "50% 45%",
  },
  dateTape: {
    position: "absolute",
    top: -12,
    left: "50%",
    zIndex: 3,
    transform: "translateX(-50%) rotate(-2deg)",
    minWidth: 46,
    borderRadius: 5,
    padding: "4px 10px",
    color: "var(--ink)",
    background:
      "linear-gradient(90deg, rgba(248,230,198,0.88), rgba(255,244,214,0.94))",
    boxShadow: "0 4px 10px rgba(105, 79, 50, 0.12)",
    fontSize: 12,
    fontWeight: 700,
  },
  catBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    borderRadius: 999,
    padding: "4px 8px",
    background: "rgba(255, 252, 246, 0.86)",
    color: "var(--ink-soft)",
    fontSize: 11,
    fontWeight: 700,
  },
  currentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
    padding: 16,
  },
  currentPhotoButton: {
    border: 0,
    padding: 0,
    background: "transparent",
    textAlign: "left",
    color: "inherit",
  },
  currentPhotoFrame: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: 16,
    border: "6px solid var(--paper-card)",
    boxShadow: "0 10px 20px rgba(72, 58, 39, 0.10)",
  },
  currentDate: {
    display: "block",
    marginTop: 6,
    color: "var(--ink-soft)",
    fontSize: 12,
    fontWeight: 700,
  },
  viewerOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "grid",
    placeItems: "center",
    padding: 18,
  },
  viewerBackdrop: {
    position: "absolute",
    inset: 0,
    border: 0,
    background: "rgba(39, 34, 29, 0.62)",
  },
  viewerSheet: {
    position: "relative",
    zIndex: 1,
    width: "min(100%, 520px)",
    borderRadius: 22,
    padding: 14,
    background: "var(--paper-card)",
    boxShadow: "0 24px 60px rgba(36, 28, 20, 0.28)",
  },
  viewerHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "4px 4px 12px",
    color: "var(--ink-soft)",
    fontSize: 13,
    fontWeight: 700,
  },
  viewerClose: {
    border: 0,
    borderRadius: 999,
    padding: "7px 12px",
    color: "var(--ink)",
    background: "color-mix(in srgb, var(--paper) 90%, white 10%)",
    font: "inherit",
    fontSize: 13,
    fontWeight: 700,
  },
  viewerFrame: {
    width: "100%",
    maxHeight: "70dvh",
    aspectRatio: "1 / 1",
    borderRadius: 18,
    background: "var(--paper)",
  },
  viewerImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
};
