"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { syncLocalDataWithAccount } from "../../lib/accountSync";
import { isUsablePhotoSrc } from "../../lib/photoStorage";
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
import { StoredPhotoImage } from "../ui/StoredPhotoImage";

type BoardSide = "sent" | "delivered";
type BoardMode = "v2" | "current";

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

export function BoardV2Prototype() {
  const [side, setSide] = useState<BoardSide>("sent");
  const [mode, setMode] = useState<BoardMode>("v2");
  const [allPhotos, setAllPhotos] = useState<PrototypePhoto[]>([]);
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
        .sort((a, b) => b.timestamp - a.timestamp),
    [allPhotos, side],
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

  return (
    <main style={styles.page} data-testid="board-v2-prototype">
      <header style={styles.header}>
        <div>
          <p style={styles.kicker}>prototype</p>
          <h1 style={styles.title}>ねこだよりボード v2</h1>
          <p style={styles.lead}>実データで、散らばり具合を見比べます。</p>
        </div>
        <SegmentedControl
          label="表示"
          value={mode}
          options={[
            { value: "v2", label: "v2" },
            { value: "current", label: "現行" },
          ]}
          onChange={(value) => setMode(value as BoardMode)}
        />
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
          <AccountRestoreNotice status={restoreStatus} onRestore={restoreRemotePhotos} />
        ) : displayedPhotos.length === 0 ? (
          <div style={styles.empty} data-testid="board-v2-empty">
            この月の写真はまだありません。
          </div>
        ) : mode === "v2" ? (
          <V2Board photos={displayedPhotos} onOpen={setViewerPhoto} />
        ) : (
          <CurrentBoard photos={displayedPhotos} onOpen={setViewerPhoto} />
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
  onRestore,
}: {
  status: "idle" | "checking" | "restored" | "skipped" | "error";
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
  );
}

function V2Board({
  photos,
  onOpen,
}: {
  photos: PrototypePhoto[];
  onOpen: (photo: PrototypePhoto) => void;
}) {
  const placements = useMemo(() => buildV2Placements(photos), [photos]);
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
      {placements.items.map(({ photo, style }, index) => {
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
            {showDate ? (
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
              style={styles.photoFrame}
              imageStyle={styles.photoImage}
              width={180}
              height={180}
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
  onOpen,
}: {
  photos: PrototypePhoto[];
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
          style={styles.currentPhotoButton}
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
            style={styles.currentPhotoFrame}
            imageStyle={styles.photoImage}
            width={148}
            height={148}
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
  value,
  options,
  onChange,
}: {
  label: string;
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
            data-testid={`board-v2-${option.value}`}
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

function buildV2Placements(photos: PrototypePhoto[]) {
  const total = photos.length;
  const sparse = total <= 3;
  const cardWidth = sparse ? 190 : total > 18 ? 150 : 166;
  const cardHeight = cardWidth;
  const verticalStep = sparse ? 236 : Math.round(cardHeight * 0.88);
  const topPad = sparse ? 34 : 28;
  const boardHeight = `${topPad * 2 + cardHeight + Math.max(0, total - 1) * verticalStep}px`;

  return {
    boardHeight,
    items: photos.map((photo, index) => {
      const seed = seededUnit(`${photo.sourcePhotoId ?? photo.id}:${photo.dateKey}`);
      const rotate = -3 + seed * 6;
      const xUnit = seededUnit(`x:${photo.sourcePhotoId ?? photo.id}`);
      const maxShift = sparse ? 22 : 74;
      const x = (xUnit - 0.5) * maxShift * 2;
      const y = topPad + index * verticalStep;

      return {
        photo,
        style: {
          width: `${cardWidth}px`,
          top: `${y}px`,
          left: `calc(50% + ${Math.round(x)}px)`,
          transform: `translateX(-50%) rotate(${rotate.toFixed(2)}deg)`,
          zIndex: total - index,
        } satisfies CSSProperties,
      };
    }),
  };
}

function getPhotoTransformBaseSrc(photo: {
  src: string;
  displaySrc?: string;
  originalSrc?: string;
  thumbnailSrc?: string;
}) {
  if (isUsableOptionalPhotoSrc(photo.displaySrc)) {
    return photo.displaySrc;
  }
  if (isUsableOptionalPhotoSrc(photo.originalSrc)) {
    return photo.originalSrc;
  }
  return isUsableOptionalPhotoSrc(photo.thumbnailSrc) ? photo.thumbnailSrc : photo.src;
}

function getPhotoDetailSrc(photo: PrototypePhoto) {
  if (isUsableOptionalPhotoSrc(photo.displaySrc)) {
    return photo.displaySrc;
  }
  if (isUsableOptionalPhotoSrc(photo.originalSrc)) {
    return photo.originalSrc;
  }
  return isUsableOptionalPhotoSrc(photo.thumbnailSrc) ? photo.thumbnailSrc : photo.src;
}

function getPhotoFallbackSrcs(photo: {
  src: string;
  displaySrc?: string;
  originalSrc?: string;
  thumbnailSrc?: string;
}) {
  const sources = [photo.displaySrc, photo.thumbnailSrc, photo.originalSrc, photo.src].filter(
    (src): src is string => isUsableOptionalPhotoSrc(src),
  );
  return [...new Set(sources)];
}

function isUsableOptionalPhotoSrc(src: string | null | undefined): src is string {
  return typeof src === "string" && isUsablePhotoSrc(src);
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
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    maxWidth: 760,
    margin: "0 auto 18px",
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
  restoreButton: {
    marginTop: 4,
    border: "1px solid color-mix(in srgb, var(--seal) 30%, var(--line))",
    borderRadius: 999,
    padding: "10px 18px",
    color: "var(--seal)",
    background: "color-mix(in srgb, var(--paper-card) 86%, white 14%)",
    boxShadow: "var(--shadow-e0)",
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
    border: "7px solid color-mix(in srgb, var(--paper-card) 78%, white 22%)",
    boxShadow:
      "0 14px 26px rgba(72, 58, 39, 0.14), inset 0 0 0 1px rgba(117, 90, 64, 0.08)",
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
