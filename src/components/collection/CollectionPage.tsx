"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  KeyboardEvent,
  MouseEvent,
  TouchEvent,
  UIEvent,
} from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  readImageFileDimensions,
  resizeImageFileToDataUrl,
} from "../../lib/imageResize";
import { assertSupportedImageFile } from "../../lib/imageFileValidation";
import { queueOriginalPhotoPreservation } from "../../lib/photoOriginals";
import {
  getCollectionSlotPhotoSlug,
  getDailyCollectionTarget,
  isReservedCollectionSlotSlug,
} from "../../lib/collection/dailyTarget";
import {
  mergeCollectionPhotoStores,
  readCachedCollectionPhotoLedger,
  removeCollectionPhotoHistory,
  upsertCollectionPhotoHistory,
  type DurableCollectionPhotoStore,
} from "../../lib/collection/photoHistoryLedger";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import {
  deleteAccountCollectionPhoto,
  deleteAccountSleepingPhoto,
  hideAccountKeptExchangePhoto,
} from "../../lib/accountSync";
import {
  storeAccountPhotoDataUrl,
} from "../../lib/photoStorageClient";
import {
  getStoragePhotoPath,
  isUsablePhotoSrc,
} from "../../lib/photoStorage";
import {
  completePhotoSourceSet,
  getPhotoAspectRatio,
  getPhotoContentIdentityKeys,
  resolvePhotoFallbackSrcs,
  resolvePhotoSrc,
  resolvePhotoStorageVariant,
  type PhotoSourceContext,
  type PhotoSourceSet,
} from "../../lib/photoSources";
import {
  BOX_PHOTO_STORAGE_EVENT,
  deleteOwnSleepingPhoto,
  dismissExchangePhoto,
  hideKeptExchangePhoto,
  isExchangePhotoLocallyBlocked,
  keepExchangePhoto,
  readKeptExchangePhotosForAlbum,
  readKeptExchangePhotos,
  readOwnSleepingPhotosForAlbum,
  reportExchangePhoto,
  updateKeptExchangePhotoDataUrl,
  updateKeptExchangePhotoDimensions,
  updateOwnSleepingPhotoDimensions,
  updateOwnSleepingPhotoDelivery,
  type ExchangePhoto,
  type OwnSleepingPhoto,
} from "../../lib/home/sleepingPhotos";
import {
  autoOpenExpiredEveningDeliveries,
  getFirstEveningDeliveryTargetDateKey,
  getJstDateKey,
  getJstDeliveryTime,
  readEveningDeliveryStore,
} from "../../lib/home/eveningDelivery";
import { backupOwnSleepingPhotoMoment } from "../../lib/home/sleepingPhotoBackup";
import { sendPhotoReport } from "../../lib/home/photoReports";
import { readOnboardingProgress } from "../../lib/onboarding/progress";
import { STORAGE_KEYS, readCachedJson, writeCachedJson } from "../../lib/storage";

type OwnPhotoDeliveryPersistResult = {
  photo: OwnSleepingPhoto;
  confirmed: boolean;
};
import {
  COLLECTION_GROUPS,
  type CollectionGroup,
  type CollectionGroupId,
  type CollectionSlot,
} from "../../lib/collection/poses";
import {
  getActiveCatProfile,
  getCatName,
  readActiveCatId,
  readCatProfiles,
  saveActiveCatId,
} from "../home/homeInputHelpers";
import type { CatProfile } from "../home/homeInputHelpers";
import { BottomNavigation } from "../navigation/BottomNavigation";
import { AppBottomSheet } from "../ui/AppBottomSheet";
import { AppButton } from "../ui/AppButton";
import { AppCard } from "../ui/AppCard";
import { AppConfirmDialog } from "../ui/AppConfirmDialog";
import { AppIcon } from "../ui/AppIcons";
import { EmptyState } from "../ui/EmptyState";
import { PhotoTile, PhotoViewerFrame } from "../ui/PhotoTile";
import {
  decodePhotoSourcesForDisplay,
  getStoragePhotoSignedUrl,
  StoredPhotoImage,
  preloadStoragePhotoSignedUrls,
} from "../ui/StoredPhotoImage";
import { color, radius, shadow } from "../ui/designTokens";
import { tayoriPhotoFrameStyles } from "../ui/tayoriPhotoFrameStyles";
import { useModalBehavior } from "../ui/useModalBehavior";

const COLLECTION_TEXT = "var(--ink)";
const COLLECTION_TEXT_STRONG = "var(--ink)";
const COLLECTION_MUTED = "var(--ink-soft)";
const COLLECTION_SURFACE: CSSProperties = {
  position: "relative",
  background: "color-mix(in srgb, var(--paper) 86%, transparent)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-e1)",
};
const COLLECTION_SURFACE_SOFT: CSSProperties = {
  ...COLLECTION_SURFACE,
  background: "color-mix(in srgb, var(--paper-card) 76%, transparent)",
  boxShadow: "var(--shadow-e0)",
};
const COLLECTION_NAV_ENTRY_STORAGE_KEY = "neteruneko_collection_nav_entry";
const MAINICHI_SEEN_PHOTO_KEYS_STORAGE_KEY = "neteruneko_mainichi_seen_photo_keys";
const MAINICHI_CARD_DECODE_TIMEOUT_MS = 800;
const MAINICHI_PASTE_MOTION_CSS = `
@keyframes mainichiPasteSettle {
  0% {
    opacity: 0;
    transform: translate(var(--mainichi-shift-x), calc(var(--mainichi-shift-y) - 18px)) rotate(calc(var(--mainichi-rotation) - 1.2deg)) scale(0.972);
    filter: drop-shadow(0 20px 24px rgba(120,110,90,0.18)) saturate(0.96);
  }
  46% {
    opacity: 1;
    transform: translate(var(--mainichi-shift-x), calc(var(--mainichi-shift-y) + 4px)) rotate(calc(var(--mainichi-rotation) + 0.45deg)) scale(1.012);
    filter: drop-shadow(0 14px 18px rgba(120,110,90,0.13)) saturate(1.02);
  }
  72% {
    opacity: 1;
    transform: translate(var(--mainichi-shift-x), calc(var(--mainichi-shift-y) - 1px)) rotate(var(--mainichi-rotation)) scale(0.997);
    filter: drop-shadow(0 9px 13px rgba(120,110,90,0.10)) saturate(1);
  }
  100% {
    opacity: 1;
    transform: translate(var(--mainichi-shift-x), var(--mainichi-shift-y)) rotate(var(--mainichi-rotation)) scale(1);
    filter: drop-shadow(0 0 0 rgba(120,110,90,0));
  }
}

@keyframes mainichiTapePress {
  0% {
    opacity: 0;
    transform: translate(-50%, -80%) rotate(var(--mainichi-tape-rotation)) scaleX(0.84);
  }
  42% {
    opacity: 0.92;
    transform: translate(-50%, -20%) rotate(var(--mainichi-tape-rotation)) scaleX(1.04);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -15%) rotate(var(--mainichi-tape-rotation)) scaleX(1);
  }
}

[data-mainichi-css-paste="true"] {
  animation: mainichiPasteSettle 720ms cubic-bezier(0.22, 1, 0.36, 1) both;
  will-change: transform, filter, opacity;
}

[data-mainichi-paste-tape="true"] {
  animation: mainichiTapePress 540ms 180ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

[data-mainichi-photo-card="true"] {
  touch-action: manipulation;
}

[data-mainichi-photo-card="true"]:active {
  filter: brightness(0.985) drop-shadow(0 8px 12px rgba(94,76,52,0.12));
}

@media (prefers-reduced-motion: reduce) {
  [data-mainichi-css-paste="true"],
  [data-mainichi-paste-tape="true"] {
    animation: none !important;
  }
}
`;
const MAINICHI_MONTH_PICKER_CSS = `
[data-app-bottom-nav] {
  opacity: 0;
  pointer-events: none;
  transform: translateX(-50%) translateY(12px) scale(0.985) !important;
  transition:
    opacity var(--dur-instant) var(--ease-gentle),
    transform var(--dur-instant) var(--ease-gentle);
}

@media (prefers-reduced-motion: reduce) {
  [data-app-bottom-nav] {
    transition: none !important;
  }
}
`;

type CollectionPhoto = {
  id: string;
  slotId: string;
  src: string;
  thumbnailSrc?: string;
  displaySrc?: string;
  originalSrc?: string;
  width?: number;
  height?: number;
  localIndex?: number;
  storageSlug?: string;
  createdAt?: string;
};

type CollectionView = "collect" | "album" | "share";

type CollectionShareFeedItem = {
  id: string;
  itemType: "photo" | "suggestion";
  ownerScope: "self" | "system";
  slot: CollectionSlot | null;
  src?: string;
  iconPath?: string;
  ownerName?: string;
  badge: string;
  sourcePhotoId?: string;
  description?: string;
};

type BoxPreviewPhoto = {
  id: string;
  src: string;
  thumbnailSrc?: string;
  displaySrc?: string;
  originalSrc?: string;
  width?: number;
  height?: number;
  offlineSrc?: string;
  catId?: string;
  ownerCatId?: string;
  shared?: boolean;
  createdAt?: number;
  sourcePhotoId?: string;
  deliveredAt?: number;
};

type StoredCollectionPhotoEntry = {
  id: string;
  src: string;
  thumbnailSrc?: string;
  displaySrc?: string;
  originalSrc?: string;
  width?: number;
  height?: number;
  createdAt?: string;
};

type BoxDetailKind = "sleeping" | "other";
type AlbumPhotoKind = "sleeping" | "awake" | "other";
type MainichiBoardSide = "sent" | "delivered";

type AlbumMomentPhoto = BoxPreviewPhoto & {
  kind: AlbumPhotoKind;
  timestamp: number;
  slotId?: string;
};

type AlbumDaySection = {
  kind: AlbumPhotoKind;
  photos: AlbumMomentPhoto[];
};

type AlbumDayGroup = {
  key: string;
  label: string;
  subLabel: string;
  sections: AlbumDaySection[];
  total: number;
  hasUnopenedOtherDelivery?: boolean;
  hasUndeliverableOtherDelivery?: boolean;
};

type MainichiBoardPhoto = {
  id: string;
  sourcePhotoId?: string;
  dateKey: string;
  dateLabel: string;
  src: string;
  boardSrc: string;
  offlineSrc?: string;
  fallbackSrcs?: string[];
  width?: number;
  height?: number;
  timestamp: number;
  side: MainichiBoardSide;
  catName?: string;
};

type MainichiBoardMonth = {
  key: string;
  label: string;
  photos: MainichiBoardPhoto[];
};

type MainichiBoardDayBundle = {
  key: string;
  label: string;
  timestamp: number;
  photos: MainichiBoardPhoto[];
};

type MainichiBoardPhotoLayout = {
  left: string;
  top: string;
  width: string;
  rotation: string;
  shiftX: string;
  shiftY: string;
  tapeLeft: string;
  tapeRotation: string;
  zIndex?: number;
};

type MainichiMorphSource = {
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  photoKey: string;
};

type MainichiDayPhoto = {
  id: string;
  sourcePhotoId?: string;
  dateKey: string;
  dateLabel: string;
  src: string;
  thumbnailSrc?: string;
  displaySrc?: string;
  originalSrc?: string;
  width?: number;
  height?: number;
  offlineSrc?: string;
  timestamp: number;
  kind: BoxDetailKind;
  sideLabel: string;
  catName?: string;
  shared?: boolean;
  storageWriteback?: (dataUrl: string) => void;
  deliveredAt?: number;
};

type MainichiViewerState = {
  photos: MainichiDayPhoto[];
  index: number;
  monthLabel: string | null;
};

export function CollectionPage() {
  const [catProfiles, setCatProfiles] = useState<CatProfile[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<CollectionGroupId>("pose");
  const [activeView, setActiveView] = useState<CollectionView>("collect");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [collectionPhotos, setCollectionPhotos] = useState<
    Record<string, StoredCollectionPhotoEntry[]>
  >({});
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [completedSlug, setCompletedSlug] = useState<string | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [toastText, setToastText] = useState("");
  const [boxRefreshTick, setBoxRefreshTick] = useState(0);
  const [selectedBoxKind, setSelectedBoxKind] = useState<BoxDetailKind | null>(
    null,
  );
  const [selectedBoxDateKey, setSelectedBoxDateKey] = useState<string | null>(
    null,
  );
  const [selectedMainichiDayKey, setSelectedMainichiDayKey] = useState<
    string | null
  >(null);
  const [selectedMainichiSource, setSelectedMainichiSource] =
    useState<MainichiMorphSource | null>(null);
  const [selectedMainichiViewer, setSelectedMainichiViewer] =
    useState<MainichiViewerState | null>(null);
  const [shouldPlayMainichiNavEntry, setShouldPlayMainichiNavEntry] =
    useState(false);
  const [currentBoxPhotoIndex, setCurrentBoxPhotoIndex] = useState(0);
  const toastTimerRef = useRef<number | null>(null);
  const trackedViewCatIdRef = useRef<string | null>(null);
  const trackedDailyTargetRef = useRef<string | null>(null);
  const hasMigratedOnboardingDeliveryRef = useRef(false);
  const pendingOwnPhotoActionsRef = useRef(new Set<string>());

  useEffect(() => {
    const profiles = readCatProfiles();
    const savedActiveCatId = readActiveCatId();
    const activeProfile = getActiveCatProfile(profiles, savedActiveCatId);
    let shouldPlayNavEntry = false;

    try {
      shouldPlayNavEntry =
        window.sessionStorage.getItem(COLLECTION_NAV_ENTRY_STORAGE_KEY) === "1";
      window.sessionStorage.removeItem(COLLECTION_NAV_ENTRY_STORAGE_KEY);
    } catch {
      shouldPlayNavEntry = false;
    }
    setShouldPlayMainichiNavEntry(shouldPlayNavEntry);
    setCatProfiles(profiles);
    setActiveCatId(activeProfile.id);
    saveActiveCatId(activeProfile.id);
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (!activeCatId) {
      setCollectionPhotos({});
      return;
    }

    setCollectionPhotos(readCollectionPhotos(activeCatId));
  }, [activeCatId, boxRefreshTick]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function refreshBoxes() {
      setBoxRefreshTick((value) => value + 1);
    }

    function refreshBoxesOnVisible() {
      if (document.visibilityState === "visible") {
        refreshBoxes();
      }
    }

    window.addEventListener(BOX_PHOTO_STORAGE_EVENT, refreshBoxes);
    window.addEventListener("storage", refreshBoxes);
    window.addEventListener("focus", refreshBoxes);
    document.addEventListener("visibilitychange", refreshBoxesOnVisible);

    return () => {
      window.removeEventListener(BOX_PHOTO_STORAGE_EVENT, refreshBoxes);
      window.removeEventListener("storage", refreshBoxes);
      window.removeEventListener("focus", refreshBoxes);
      document.removeEventListener("visibilitychange", refreshBoxesOnVisible);
    };
  }, []);

  useEffect(() => {
    if (!hasLoaded || hasMigratedOnboardingDeliveryRef.current) {
      return;
    }

    hasMigratedOnboardingDeliveryRef.current = true;
    const progress = readOnboardingProgress();
    const deliveredPhoto = progress?.deliveredPhoto;

    if (
      deliveredPhoto &&
      progress.isDeliveredPhotoKept &&
      !isExchangePhotoLocallyBlocked(deliveredPhoto)
    ) {
      keepExchangePhoto(deliveredPhoto);
    }
  }, [hasLoaded]);

  const activeCatProfile =
    catProfiles.length > 0
      ? getActiveCatProfile(catProfiles, activeCatId)
      : null;
  const catName = getCatName(activeCatProfile);

  const storedCollectionPhotos = useMemo(
    () => buildStoredCollectionPhotos(collectionPhotos),
    [collectionPhotos],
  );
  const photosBySlot = useMemo(
    () => groupPhotosBySlot(storedCollectionPhotos),
    [storedCollectionPhotos],
  );
  const progress = useMemo(
    () => buildCollectionProgress(COLLECTION_GROUPS, photosBySlot),
    [photosBySlot],
  );
  const dailyTargetSlot = useMemo(
    () =>
      activeCatId
        ? getDailyCollectionTarget(activeCatId, collectionPhotos)
        : null,
    [activeCatId, collectionPhotos],
  );
  const activeGroup =
    COLLECTION_GROUPS.find((group) => group.id === activeGroupId) ??
    COLLECTION_GROUPS[0];
  const selectedSlot = selectedSlug ? getCollectionSlotBySlug(selectedSlug) : null;
  const completedSlot = completedSlug ? getCollectionSlotBySlug(completedSlug) : null;
  const selectedPhotos = selectedSlot
    ? photosBySlot.get(selectedSlot.id) ?? []
    : [];
  const nextTargetSlots = useMemo(
    () => buildNextCollectionTargets(photosBySlot, dailyTargetSlot?.id ?? null),
    [dailyTargetSlot?.id, photosBySlot],
  );
  const shareSuggestionSlot = dailyTargetSlot ?? nextTargetSlots[0] ?? null;
  const shareFeedItems = useMemo(
    () =>
      buildCollectionShareFeed(
        storedCollectionPhotos,
        catName,
        shareSuggestionSlot,
      ),
    [catName, shareSuggestionSlot, storedCollectionPhotos],
  );
  const sleepingBoxPhotos = useMemo(
    () => readOwnSleepingPhotosForAlbum(null),
    [boxRefreshTick, hasLoaded],
  );
  const openedEveningDeliveryPhotos = useMemo(
    () => readOpenedEveningDeliveryBoxPhotos(),
    [boxRefreshTick, hasLoaded],
  );
  const unopenedEveningDeliveryDateKeys = useMemo(
    () => readUnopenedEveningDeliveryDateKeys(),
    [boxRefreshTick, hasLoaded],
  );
  const undeliverableEveningDeliveryDateKeys = useMemo(
    () => readUndeliverableEveningDeliveryDateKeys(),
    [boxRefreshTick, hasLoaded],
  );
  const otherBoxPhotos = useMemo(
    () =>
      mergeBoxPreviewPhotos(
        mergeBoxPreviewPhotos(
          openedEveningDeliveryPhotos,
          readOnboardingDeliveredBoxPhotos(),
        ),
        readKeptExchangePhotosForAlbum(),
      ),
    [boxRefreshTick, hasLoaded, openedEveningDeliveryPhotos],
  );
  const awakeBoxPhotos = useMemo(
    () =>
      storedCollectionPhotos.map((photo) => ({
        id: photo.id,
        src: getPhotoThumbnailSrc(photo),
        thumbnailSrc: photo.thumbnailSrc,
        displaySrc: resolvePhotoSrc(photo, "detail"),
        originalSrc: resolvePhotoSrc(photo, "detail"),
        width: photo.width,
        height: photo.height,
        createdAt: getCollectionPhotoTimestamp(photo),
        sourcePhotoId: photo.slotId,
      })),
    [storedCollectionPhotos],
  );
  const albumDayGroups = useMemo(
    () =>
      buildAlbumDayGroups(
        sleepingBoxPhotos,
        awakeBoxPhotos,
        otherBoxPhotos,
        unopenedEveningDeliveryDateKeys,
        undeliverableEveningDeliveryDateKeys,
      ),
    [
      awakeBoxPhotos,
      otherBoxPhotos,
      sleepingBoxPhotos,
      unopenedEveningDeliveryDateKeys,
      undeliverableEveningDeliveryDateKeys,
    ],
  );
  const firstEveningDeliveryTargetDateKey = useMemo(
    () => getFirstEveningDeliveryTargetDateKey(),
    [boxRefreshTick],
  );
  const selectedBoxPhotos =
    selectedBoxKind === "sleeping"
      ? filterBoxPhotosByDate(sleepingBoxPhotos, selectedBoxDateKey)
      : selectedBoxKind === "other"
        ? filterBoxPhotosByDate(otherBoxPhotos, selectedBoxDateKey)
        : [];
  const catNameById = useMemo(
    () => new Map(catProfiles.map((profile) => [profile.id, getCatName(profile)])),
    [catProfiles],
  );
  const selectedMainichiDayGroup =
    selectedMainichiDayKey
      ? albumDayGroups.find((group) => group.key === selectedMainichiDayKey) ?? null
      : null;
  const selectedMainichiDayPhotos = useMemo(
    () =>
      selectedMainichiDayGroup
        ? buildMainichiDayPhotos(selectedMainichiDayGroup, catNameById)
        : [],
    [catNameById, selectedMainichiDayGroup],
  );
  const selectedMainichiPhoto =
    selectedMainichiViewer?.photos[selectedMainichiViewer.index] ?? null;
  useEffect(() => {
    void preloadStoragePhotoSignedUrls(
      [
        ...storedCollectionPhotos.slice(0, 36).map(getPhotoThumbnailSrc),
        ...sleepingBoxPhotos.slice(0, 18).map(getPhotoThumbnailSrc),
        ...otherBoxPhotos.slice(0, 18).map(getPhotoThumbnailSrc),
      ],
    );
  }, [otherBoxPhotos, sleepingBoxPhotos, storedCollectionPhotos]);

  useEffect(() => {
    if (!hasLoaded || !activeCatId || trackedViewCatIdRef.current === activeCatId) {
      return;
    }

    trackedViewCatIdRef.current = activeCatId;
    trackProductEvent(
      "collection_viewed",
      {
        photo_count: storedCollectionPhotos.length,
        collected_slot_count: photosBySlot.size,
        total_slot_count: COLLECTION_GROUPS.reduce(
          (total, group) => total + group.slots.length,
          0,
        ),
        active_group_id: activeGroupId,
        daily_target_slot_id: dailyTargetSlot?.id ?? null,
      },
      { localCatId: activeCatId },
    );
  }, [
    activeCatId,
    activeGroupId,
    dailyTargetSlot?.id,
    hasLoaded,
    photosBySlot.size,
    storedCollectionPhotos.length,
  ]);

  useEffect(() => {
    if (!activeCatId || !dailyTargetSlot) {
      return;
    }

    const trackingKey = `${activeCatId}:${dailyTargetSlot.id}`;
    if (trackedDailyTargetRef.current === trackingKey) {
      return;
    }

    trackedDailyTargetRef.current = trackingKey;
    trackProductEvent(
      "collection_target_viewed",
      {
        slot_id: dailyTargetSlot.id,
        slot_slug: getCollectionPhotoSlug(dailyTargetSlot),
        group_id: getCollectionGroupIdForSlot(dailyTargetSlot),
      },
      { localCatId: activeCatId },
    );
  }, [activeCatId, dailyTargetSlot]);

  function openSheet(slot: CollectionSlot, entry: "daily_target" | "grid" = "grid") {
    trackProductEvent(
      "collection_slot_opened",
      {
        slot_id: slot.id,
        slot_slug: getCollectionPhotoSlug(slot),
        group_id: getCollectionGroupIdForSlot(slot),
        entry,
        photo_count: photosBySlot.get(slot.id)?.length ?? 0,
      },
      { localCatId: activeCatId },
    );
    setSelectedSlug(getCollectionPhotoSlug(slot));
    setCurrentPhotoIndex(0);
  }

  function closeSheet() {
    if (selectedSlot) {
      trackProductEvent(
        "collection_photo_sheet_closed",
        {
          slot_id: selectedSlot.id,
          slot_slug: getCollectionPhotoSlug(selectedSlot),
          group_id: getCollectionGroupIdForSlot(selectedSlot),
          photo_count: selectedPhotos.length,
          current_photo_index: currentPhotoIndex,
        },
        { localCatId: activeCatId },
      );
    }
    setSelectedSlug(null);
  }

  function openBoxDetail(kind: BoxDetailKind, dateKey: string | null = null) {
    setSelectedBoxKind(kind);
    setSelectedBoxDateKey(dateKey);
    setCurrentBoxPhotoIndex(0);
    trackProductEvent(
      "collection_box_detail_opened",
      { kind, date_key: dateKey },
      { localCatId: activeCatId },
    );
  }

  function closeBoxDetail() {
    if (selectedBoxKind) {
      trackProductEvent(
        "collection_box_detail_closed",
        {
          kind: selectedBoxKind,
          date_key: selectedBoxDateKey,
          current_photo_index: currentBoxPhotoIndex,
          photo_count: selectedBoxPhotos.length,
        },
        { localCatId: activeCatId },
      );
    }

    setSelectedBoxKind(null);
    setSelectedBoxDateKey(null);
    setCurrentBoxPhotoIndex(0);
  }

  function openMainichiDay(
    dateKey: string,
    source: MainichiMorphSource | null = null,
  ) {
    setSelectedMainichiDayKey(dateKey);
    setSelectedMainichiSource(source);
    trackProductEvent(
      "collection_mainichi_day_opened",
      { date_key: dateKey, source_photo_key: source?.photoKey ?? null },
      { localCatId: activeCatId },
    );
  }

  function closeMainichiDay() {
    if (selectedMainichiDayKey) {
      trackProductEvent(
        "collection_mainichi_day_closed",
        {
          date_key: selectedMainichiDayKey,
          photo_count: selectedMainichiDayPhotos.length,
        },
        { localCatId: activeCatId },
      );
    }

    setSelectedMainichiDayKey(null);
    setSelectedMainichiSource(null);
  }

  function openMainichiFullscreenPhoto(photo: MainichiDayPhoto) {
    const photoIndex = selectedMainichiDayPhotos.findIndex(
      (candidate) =>
        candidate.kind === photo.kind &&
        candidate.id === photo.id &&
        candidate.dateKey === photo.dateKey,
    );

    setSelectedMainichiViewer({
      photos: selectedMainichiDayPhotos.length > 0 ? selectedMainichiDayPhotos : [photo],
      index: Math.max(photoIndex, 0),
      monthLabel: null,
    });
    trackProductEvent(
      "collection_mainichi_photo_opened",
      {
        date_key: photo.dateKey,
        kind: photo.kind,
        photo_id: photo.id,
        source_photo_id: photo.sourcePhotoId ?? null,
        entry: "day_sheet",
      },
      { localCatId: activeCatId },
    );
    trackProductEvent(
      "collection_view",
      {
        photo_count: storedCollectionPhotos.length,
        collected_slot_count: photosBySlot.size,
        total_slot_count: COLLECTION_GROUPS.reduce(
          (total, group) => total + group.slots.length,
          0,
        ),
        active_group_id: activeGroupId,
        daily_target_slot_id: dailyTargetSlot?.id ?? null,
      },
      { localCatId: activeCatId },
    );
  }

  function openMainichiBoardPhoto(
    photo: MainichiBoardPhoto,
    month: MainichiBoardMonth,
    source: MainichiMorphSource | null = null,
  ) {
    const monthPhotos = buildMainichiViewerPhotosForMonth(
      month,
      albumDayGroups,
      catNameById,
    );
    const photoKey = getMainichiBoardPhotoKey(photo);
    const photoIndex = monthPhotos.findIndex(
      (candidate) => getMainichiDayPhotoBoardKey(candidate) === photoKey,
    );
    const fallbackGroup = albumDayGroups.find((group) => group.key === photo.dateKey);
    const fallbackPhotos = fallbackGroup
      ? buildMainichiDayPhotos(fallbackGroup, catNameById).filter(
          (candidate) => getMainichiPhotoSide(candidate) === photo.side,
        )
      : [];
    const photos = monthPhotos.length > 0 ? monthPhotos : fallbackPhotos;
    const index = Math.max(photoIndex, 0);
    const selectedPhoto = photos[index] ?? null;

    if (!selectedPhoto) {
      openMainichiDay(photo.dateKey, source);
      return;
    }

    setSelectedMainichiViewer({
      photos,
      index,
      monthLabel: month.label,
    });
    trackProductEvent(
      "collection_mainichi_photo_opened",
      {
        date_key: selectedPhoto.dateKey,
        kind: selectedPhoto.kind,
        photo_id: selectedPhoto.id,
        source_photo_id: selectedPhoto.sourcePhotoId ?? null,
        source_photo_key: source?.photoKey ?? null,
        month_key: month.key,
        entry: "month_board",
      },
      { localCatId: activeCatId },
    );
  }

  function closeMainichiFullscreenPhoto() {
    setSelectedMainichiViewer(null);
  }

  function moveMainichiFullscreenPhoto(direction: -1 | 1) {
    setSelectedMainichiViewer((current) => {
      if (!current || current.photos.length <= 1) {
        return current;
      }

      const nextIndex =
        (current.index + direction + current.photos.length) % current.photos.length;
      const nextPhoto = current.photos[nextIndex];

      trackProductEvent(
        "collection_mainichi_photo_navigated",
        {
          date_key: nextPhoto.dateKey,
          kind: nextPhoto.kind,
          photo_id: nextPhoto.id,
          source_photo_id: nextPhoto.sourcePhotoId ?? null,
          direction,
          index: nextIndex,
          photo_count: current.photos.length,
        },
        { localCatId: activeCatId },
      );

      return {
        ...current,
        index: nextIndex,
      };
    });
  }

  async function persistOwnSleepingPhotoDelivery(
    photoId: string,
    nextShared: boolean,
  ): Promise<OwnPhotoDeliveryPersistResult | null> {
    if (pendingOwnPhotoActionsRef.current.has(photoId)) {
      showToast("写真の保存状態を更新しています。完了してから、もう一度お試しください。");
      return null;
    }

    pendingOwnPhotoActionsRef.current.add(photoId);

    try {
      const currentPhoto = readOwnSleepingPhotosForAlbum().find(
        (candidate) => candidate.id === photoId,
      );

      if (!currentPhoto) {
        showToast(
          "写真の保存状態を確認できませんでした。画面をひらき直して、もう一度お試しください。",
        );
        return null;
      }

      if (nextShared) {
        const updatedPhoto = updateOwnSleepingPhotoDelivery(photoId, true);

        if (!updatedPhoto) {
          showToast(
            "ねこだよりに変更できませんでした。写真は自分だけのままです。画面をひらき直して、もう一度お試しください。",
          );
          return null;
        }

        const backupResult = await backupOwnSleepingPhotoMoment(updatedPhoto);

        if (!backupResult.ok) {
          const previousShared =
            currentPhoto.shared ?? currentPhoto.visibility === "shared";
          const previousPhoto = {
            ...currentPhoto,
            shared: previousShared,
            visibility: previousShared ? ("shared" as const) : ("private" as const),
          };
          const compensationResult = await backupOwnSleepingPhotoMoment(previousPhoto);
          const restoredPhoto = compensationResult.ok
            ? updateOwnSleepingPhotoDelivery(photoId, previousShared)
            : null;
          showToast(
            restoredPhoto
              ? "ねこだよりに変更できませんでした。写真は自分だけのままです。通信を確認して、もう一度お試しください。"
              : "変更結果を確認できませんでした。安全のため、ねこだよりの候補として表示しています。通信を確認して「自分だけにする」を押してください。",
          );
          return restoredPhoto
            ? null
            : {
                photo: updatedPhoto,
                confirmed: false,
              };
        }

        return {
          photo: updatedPhoto,
          confirmed: true,
        };
      }

      const backupResult = await backupOwnSleepingPhotoMoment({
        ...currentPhoto,
        shared: false,
        visibility: "private",
      });

      if (!backupResult.ok) {
        showToast(
          "自分だけに変更できませんでした。写真はねこだよりの候補のままです。通信を確認して、もう一度お試しください。",
        );
        return null;
      }

      const updatedPhoto = updateOwnSleepingPhotoDelivery(photoId, false);

      if (!updatedPhoto) {
        showToast(
          "写真は自分だけに変更しましたが、この端末の表示を更新できませんでした。画面をひらき直してください。",
        );
        return null;
      }

      return {
        photo: updatedPhoto,
        confirmed: true,
      };
    } finally {
      pendingOwnPhotoActionsRef.current.delete(photoId);
    }
  }

  async function deleteOwnSleepingPhotoAfterAccount(photoId: string) {
    if (pendingOwnPhotoActionsRef.current.has(photoId)) {
      showToast("写真の保存状態を更新しています。完了してから、もう一度お試しください。");
      return false;
    }

    pendingOwnPhotoActionsRef.current.add(photoId);

    try {
      try {
        await deleteAccountSleepingPhoto(photoId);
      } catch (error) {
        const needsLogin =
          error instanceof Error && error.message.includes("session missing");
        showToast(
          needsLogin
            ? "ログイン状態を確認できないため、写真を削除できませんでした。ログインして、もう一度お試しください。"
            : "写真を削除できませんでした。写真は残っています。通信を確認して、もう一度お試しください。",
        );
        return false;
      }

      const deletedLocally = await deleteOwnSleepingPhoto(photoId);
      if (!deletedLocally) {
        showToast(
          "この端末の写真を削除できませんでした。写真は残っています。画面をひらき直して、もう一度お試しください。",
        );
        return false;
      }
      const remainsLocally = readOwnSleepingPhotosForAlbum().some(
        (candidate) => candidate.id === photoId,
      );

      if (remainsLocally) {
        showToast(
          "この端末の写真を削除できませんでした。写真は残っています。画面をひらき直して、もう一度お試しください。",
        );
        return false;
      }

      return true;
    } finally {
      pendingOwnPhotoActionsRef.current.delete(photoId);
    }
  }

  async function handleToggleMainichiSleepingDelivery(photo: MainichiDayPhoto) {
    if (photo.kind !== "sleeping") {
      return;
    }

    const nextShared = !photo.shared;
    const result = await persistOwnSleepingPhotoDelivery(photo.id, nextShared);

    if (!result) {
      return;
    }

    const displayedShared =
      result.photo.shared ?? result.photo.visibility === "shared";

    setBoxRefreshTick((value) => value + 1);
    setSelectedMainichiViewer((current) =>
      current
        ? {
            ...current,
            photos: current.photos.map((candidate) =>
              candidate.kind === "sleeping" && candidate.id === photo.id
                ? { ...candidate, shared: displayedShared }
                : candidate,
            ),
          }
        : current,
    );

    if (!result.confirmed) {
      return;
    }

    showToast(
      displayedShared
        ? "ねこだよりの候補として運営確認に送りました"
        : "自分だけの写真にしました",
    );
    trackProductEvent(
      "collection_mainichi_sleeping_delivery_toggled",
      {
        photo_id: photo.id,
        shared: displayedShared,
      },
      { localCatId: activeCatId },
    );
  }

  async function handleDeleteMainichiSleepingPhoto(photo: MainichiDayPhoto) {
    if (photo.kind !== "sleeping") {
      return;
    }

    const wasDeleted = await deleteOwnSleepingPhotoAfterAccount(photo.id);

    if (!wasDeleted) {
      return;
    }

    setBoxRefreshTick((value) => value + 1);
    setSelectedMainichiViewer((current) => {
      if (!current) {
        return current;
      }

      const photos = current.photos.filter(
        (candidate) => !(candidate.kind === "sleeping" && candidate.id === photo.id),
      );

      if (photos.length === 0) {
        return null;
      }

      return {
        ...current,
        photos,
        index: Math.min(current.index, photos.length - 1),
      };
    });
    showToast("写真を削除しました");
    trackProductEvent(
      "collection_mainichi_sleeping_photo_deleted",
      { photo_id: photo.id },
      { localCatId: activeCatId },
    );
  }

  function handleHideMainichiDeliveredPhoto(
    photo: MainichiDayPhoto,
    reason: "hide" | "report",
  ) {
    if (photo.kind !== "other") {
      return;
    }

    const exchangePhoto = createExchangePhotoFromDayPhoto(photo);
    const isKeptPhoto = readKeptExchangePhotosForAlbum().some(
      (savedPhoto) =>
        savedPhoto.id === photo.id ||
        Boolean(
          photo.sourcePhotoId && savedPhoto.sourcePhotoId === photo.sourcePhotoId,
        ),
    );

    if (isKeptPhoto) {
      hideKeptExchangePhoto(photo.id, reason);
    } else {
      if (reason === "report") {
        reportExchangePhoto(exchangePhoto);
      } else {
        dismissExchangePhoto(exchangePhoto);
      }
    }

    void hideAccountKeptExchangePhoto(photo.id, reason).catch(() => undefined);
    setBoxRefreshTick((value) => value + 1);
    setSelectedMainichiViewer((current) => {
      if (!current) {
        return current;
      }

      const photos = current.photos.filter(
        (candidate) =>
          !(
            candidate.kind === "other" &&
            (candidate.id === photo.id ||
              Boolean(
                photo.sourcePhotoId &&
                  candidate.sourcePhotoId === photo.sourcePhotoId,
              ))
          ),
      );

      if (photos.length === 0) {
        return null;
      }

      return {
        ...current,
        photos,
        index: Math.min(current.index, photos.length - 1),
      };
    });
    if (reason === "report") {
      showToast("この写真を「とどいた」から外し、運営へ報告しています");
      void sendPhotoReport(exchangePhoto, "other")
        .then(() => {
          showToast("運営に報告し、この写真を「とどいた」から外しました");
        })
        .catch(() => {
          showToast(
            "この写真は「とどいた」から外しましたが、運営に報告できませんでした。必要な場合は設定の「問い合わせ」からお知らせください。",
          );
        });
    } else {
      showToast("「とどいた」から外しました");
    }
    trackProductEvent(
      "collection_mainichi_delivered_photo_hidden",
      {
        photo_id: photo.id,
        source_photo_id: photo.sourcePhotoId ?? null,
        reason,
      },
      { localCatId: activeCatId },
    );
  }

  function handleBoxPhotoScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const index = Math.round(element.scrollLeft / element.offsetWidth);

    if (index !== currentBoxPhotoIndex) {
      setCurrentBoxPhotoIndex(index);
    }
  }

  async function handleToggleSleepingPhotoDelivery(photo: BoxPreviewPhoto) {
    const nextShared = !photo.shared;
    const result = await persistOwnSleepingPhotoDelivery(photo.id, nextShared);

    if (!result) {
      return;
    }

    setBoxRefreshTick((value) => value + 1);

    if (!result.confirmed) {
      return;
    }

    const displayedShared =
      result.photo.shared ?? result.photo.visibility === "shared";
    showToast(
      displayedShared
        ? "ねこだよりの候補として運営確認に送りました"
        : "自分だけの写真にしました",
    );
    trackProductEvent(
      "collection_sleeping_photo_delivery_toggled",
      {
        photo_id: photo.id,
        shared: displayedShared,
      },
      { localCatId: activeCatId },
    );
  }

  async function handleDeleteSleepingPhoto(photo: BoxPreviewPhoto) {
    const wasDeleted = await deleteOwnSleepingPhotoAfterAccount(photo.id);

    if (!wasDeleted) {
      return;
    }

    setBoxRefreshTick((value) => value + 1);
    setCurrentBoxPhotoIndex((current) =>
      Math.max(0, Math.min(current, sleepingBoxPhotos.length - 2)),
    );
    showToast("写真を削除しました");
    trackProductEvent(
      "collection_sleeping_photo_deleted",
      { photo_id: photo.id },
      { localCatId: activeCatId },
    );
  }

  function handleHideOtherPhoto(photo: BoxPreviewPhoto, reason: "hide" | "report") {
    hideKeptExchangePhoto(photo.id, reason);
    void hideAccountKeptExchangePhoto(photo.id, reason).catch(() => undefined);
    setBoxRefreshTick((value) => value + 1);
    setCurrentBoxPhotoIndex((current) =>
      Math.max(0, Math.min(current, otherBoxPhotos.length - 2)),
    );
    if (reason === "report") {
      showToast("この写真を「とどいた」から外し、運営へ報告しています");
      void sendPhotoReport(createExchangePhotoFromBoxPhoto(photo), "other")
        .then(() => {
          showToast("運営に報告し、この写真を「とどいた」から外しました");
        })
        .catch(() => {
          showToast(
            "この写真は「とどいた」から外しましたが、運営に報告できませんでした。必要な場合は設定の「問い合わせ」からお知らせください。",
          );
        });
    } else {
      showToast("「とどいた」から外しました");
    }
    trackProductEvent(
      "collection_other_photo_hidden",
      {
        photo_id: photo.id,
        reason,
      },
      { localCatId: activeCatId },
    );
  }

  function handleGroupSelect(groupId: CollectionGroupId) {
    setActiveGroupId(groupId);
    trackProductEvent(
      "collection_group_selected",
      { group_id: groupId },
      { localCatId: activeCatId },
    );
  }

  function handleViewSelect(view: CollectionView) {
    setActiveView(view);
    trackProductEvent(
      "collection_view_tab_selected",
      { view },
      { localCatId: activeCatId },
    );
  }

  async function handlePhotoAdd(slot: CollectionSlot) {
    if (!activeCatId) {
      return;
    }

    trackProductEvent(
      "collection_photo_add_started",
      {
        slot_id: slot.id,
        slot_slug: getCollectionPhotoSlug(slot),
        group_id: getCollectionGroupIdForSlot(slot),
      },
      { localCatId: activeCatId },
    );

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async () => {
      const file = input.files?.[0];

      if (!file) {
        return;
      }

      const slug = getCollectionPhotoSlug(slot);
      const photoVariants = await createStoredCollectionPhotoVariantSet({
        file,
        pathSegments: [activeCatId, "collection", slug],
        fileName: `photo-${Date.now()}`,
      });

      if (!photoVariants.src) {
        return;
      }

      const addedPhoto = await addCollectionPhoto(activeCatId, slug, photoVariants);
      if (!addedPhoto) {
        return;
      }

      void queueOriginalPhotoPreservation({
        file,
        localAssetId: addedPhoto.id,
        sourceSurface: "collection",
        displaySrc: photoVariants.displaySrc ?? photoVariants.src,
        catId: activeCatId,
      });

      setCollectionPhotos((current) => ({
        ...current,
        [slug]: [...(current[slug] ?? []), addedPhoto],
      }));
      trackProductEvent(
        "collection_photo_added",
        {
          slot_id: slot.id,
          slot_slug: slug,
          group_id: getCollectionGroupIdForSlot(slot),
          file_size_bucket: getFileSizeBucket(file.size),
          photo_count_after: (collectionPhotos[slug]?.length ?? 0) + 1,
        },
        { localCatId: activeCatId },
      );
      trackProductEvent(
        "collection_pose_found",
        {
          slot_id: slot.id,
          slot_slug: slug,
          group_id: getCollectionGroupIdForSlot(slot),
        },
        { localCatId: activeCatId },
      );
      trackProductEvent(
        "collection_completion_shown",
        {
          slot_id: slot.id,
          slot_slug: slug,
          group_id: getCollectionGroupIdForSlot(slot),
        },
        { localCatId: activeCatId },
      );
      setSelectedSlug(null);
      setCompletedSlug(slug);
    };

    input.click();
  }

  function showToast(message: string) {
    setToastText(message);

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToastText("");
    }, 1600);
  }

  async function handleShareSlot(slot: CollectionSlot, photos: CollectionPhoto[]) {
    if (photos.length === 0) {
      return;
    }

    trackProductEvent(
      "collection_share_tapped",
      {
        slot_id: slot.id,
        slot_slug: getCollectionPhotoSlug(slot),
        group_id: getCollectionGroupIdForSlot(slot),
        photo_count: photos.length,
      },
      { localCatId: activeCatId },
    );

    setActiveView("share");
    setSelectedSlug(null);
    showToast("シェアに並べました");
  }

  function handleShareFeedItemOpen(item: CollectionShareFeedItem) {
    trackProductEvent(
      "collection_share_feed_card_opened",
      {
        item_id: item.id,
        item_type: item.itemType,
        owner_scope: item.ownerScope,
        source_photo_id: item.sourcePhotoId ?? null,
        slot_id: item.slot?.id ?? null,
        slot_slug: item.slot ? getCollectionPhotoSlug(item.slot) : null,
        group_id: item.slot ? getCollectionGroupIdForSlot(item.slot) : null,
      },
      { localCatId: activeCatId },
    );

    if (item.slot) {
      openSheet(item.slot, "grid");
    }
  }

  function handleDeletePhoto(slug: string, index: number) {
    if (!activeCatId) {
      return;
    }

    try {
      const all = readCachedJson<Record<
        string,
        Record<string, StoredCollectionPhotoEntry[] | StoredCollectionPhotoEntry | string[] | string>
      >>(STORAGE_KEYS.collectionPhotos);

      if (!all) {
        return;
      }
      const catPhotos = normalizeStoredPhotoList(all[activeCatId]?.[slug]);

      if (!catPhotos.length) {
        return;
      }

      const slot = getCollectionSlotBySlug(slug);
      const photoToDelete = catPhotos[index];
      const photoCountBefore = catPhotos.length;
      catPhotos.splice(index, 1);

      if (catPhotos.length === 0) {
        delete all[activeCatId]?.[slug];
      } else if (all[activeCatId]) {
        all[activeCatId][slug] = catPhotos;
      }

      writeCachedJson(STORAGE_KEYS.collectionPhotos, all);
      if (photoToDelete?.id) {
        void removeCollectionPhotoHistory(activeCatId, slug, photoToDelete).catch(
          () => undefined,
        );
        void deleteAccountCollectionPhoto(photoToDelete.id).catch(() => {
          // The local album should update immediately; account checks surface sync issues.
        });
      }
      setCollectionPhotos((current) => {
        const next = { ...current };

        if (catPhotos.length === 0) {
          delete next[slug];
        } else {
          next[slug] = catPhotos;
        }

        return next;
      });
      setCurrentPhotoIndex((current) =>
        Math.max(0, Math.min(current, catPhotos.length - 1)),
      );
      trackProductEvent(
        "collection_photo_deleted",
        {
          slot_id: slot?.id ?? null,
          slot_slug: slug,
          group_id: slot ? getCollectionGroupIdForSlot(slot) : null,
          photo_count_before: photoCountBefore,
          photo_count_after: catPhotos.length,
        },
        { localCatId: activeCatId },
      );
    } catch {
      // Ignore delete failures for this MVP fallback.
    }
  }

  function handlePhotoScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const index = Math.round(element.scrollLeft / element.offsetWidth);

    if (index !== currentPhotoIndex && selectedSlot) {
      trackProductEvent(
        "collection_photo_carousel_changed",
        {
          slot_id: selectedSlot.id,
          slot_slug: getCollectionPhotoSlug(selectedSlot),
          group_id: getCollectionGroupIdForSlot(selectedSlot),
          photo_index: index,
          photo_count: selectedPhotos.length,
        },
        { localCatId: activeCatId },
      );
    }
    setCurrentPhotoIndex(index);
  }

  if (!hasLoaded) {
    return (
      <main style={styles.page}>
        <PageBackdrop />
        <div style={styles.container}>
          <AppCard variant="section" padding="lg" style={styles.emptyCard}>
            <h1 style={styles.emptyTitle}>ねこだより</h1>
            <p style={styles.emptyText}>準備しています</p>
          </AppCard>
        </div>
        <BottomNavigation active="collection" />
      </main>
    );
  }

  if (!activeCatProfile) {
    return (
      <main style={styles.page}>
        <PageBackdrop />
        <div style={styles.container}>
          <AppCard variant="section" padding="lg" style={styles.emptyCard}>
            <h1 style={styles.emptyTitle}>ねこだより</h1>
            <p style={styles.emptyText}>一緒に暮らしている猫を登録しましょう</p>
            <AppButton href="/cats" variant="primary" fullWidth>
              猫を登録する
            </AppButton>
          </AppCard>
        </div>
        <BottomNavigation active="collection" />
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <PageBackdrop />
      <div style={styles.container}>
        <BoxOverview
          dayGroups={albumDayGroups}
          firstEveningDeliveryTargetDateKey={firstEveningDeliveryTargetDateKey}
          catProfiles={catProfiles}
          playNavEntryMotion={shouldPlayMainichiNavEntry}
          onNavEntryMotionPlayed={() => setShouldPlayMainichiNavEntry(false)}
          onOpenMainichiDay={openMainichiDay}
          onOpenMainichiPhoto={openMainichiBoardPhoto}
        />
      </div>
      {selectedMainichiDayGroup ? (
        <MainichiDaySheet
          group={selectedMainichiDayGroup}
          photos={selectedMainichiDayPhotos}
          source={selectedMainichiSource}
          onClose={closeMainichiDay}
          onOpenPhoto={openMainichiFullscreenPhoto}
        />
      ) : null}
      <AnimatePresence>
        {selectedMainichiPhoto ? (
          <MainichiFullscreenPhoto
            photo={selectedMainichiPhoto}
            photoCount={selectedMainichiViewer?.photos.length ?? 1}
            currentIndex={selectedMainichiViewer?.index ?? 0}
            monthLabel={selectedMainichiViewer?.monthLabel ?? null}
            onClose={closeMainichiFullscreenPhoto}
            onPrevious={() => moveMainichiFullscreenPhoto(-1)}
            onNext={() => moveMainichiFullscreenPhoto(1)}
            onToggleSleepingDelivery={handleToggleMainichiSleepingDelivery}
            onDeleteSleepingPhoto={handleDeleteMainichiSleepingPhoto}
            onHideDeliveredPhoto={(photo) =>
              handleHideMainichiDeliveredPhoto(photo, "hide")
            }
            onReportDeliveredPhoto={(photo) =>
              handleHideMainichiDeliveredPhoto(photo, "report")
            }
          />
        ) : null}
      </AnimatePresence>
      {selectedBoxKind ? (
        <BoxPhotoDetailSheet
          kind={selectedBoxKind}
          dayLabel={
            selectedBoxDateKey ? getAlbumDateLabelFromKey(selectedBoxDateKey) : null
          }
          photos={selectedBoxPhotos}
          currentPhotoIndex={currentBoxPhotoIndex}
          onClose={closeBoxDetail}
          onPhotoScroll={handleBoxPhotoScroll}
          onToggleSleepingDelivery={handleToggleSleepingPhotoDelivery}
          onDeleteSleepingPhoto={handleDeleteSleepingPhoto}
          onHideOtherPhoto={(photo) => handleHideOtherPhoto(photo, "hide")}
        />
      ) : null}
      {selectedSlot ? (
        <CollectionPhotoSheet
          slot={selectedSlot}
          photos={selectedPhotos}
          currentPhotoIndex={currentPhotoIndex}
          onClose={closeSheet}
          onAddPhoto={() => {
            void handlePhotoAdd(selectedSlot);
          }}
          onShare={() => {
            void handleShareSlot(selectedSlot, selectedPhotos);
          }}
          onDeletePhoto={handleDeletePhoto}
          onPhotoScroll={handlePhotoScroll}
        />
      ) : null}
      {completedSlot ? (
        <CollectionCompletionSheet
          slot={completedSlot}
          onClose={() => setCompletedSlug(null)}
          onOpenAlbum={() => {
            setCompletedSlug(null);
            setActiveView("album");
            setActiveGroupId(completedSlot.group);
            setSelectedSlug(getCollectionPhotoSlug(completedSlot));
            setCurrentPhotoIndex(0);
          }}
          onOpenShare={() => {
            setCompletedSlug(null);
            setActiveView("share");
          }}
        />
      ) : null}
      {toastText ? <div style={styles.toast}>{toastText}</div> : null}
      <BottomNavigation active="collection" />
    </main>
  );
}

function PageBackdrop() {
  return (
    <>
      <div style={styles.ambientBackground} aria-hidden="true" />
      <div style={styles.ambientHighlight} aria-hidden="true" />
      <div style={styles.backgroundVeil} aria-hidden="true" />
    </>
  );
}

function BoxOverview({
  dayGroups,
  firstEveningDeliveryTargetDateKey,
  catProfiles,
  playNavEntryMotion,
  onNavEntryMotionPlayed,
  onOpenMainichiDay,
  onOpenMainichiPhoto,
}: {
  dayGroups: AlbumDayGroup[];
  firstEveningDeliveryTargetDateKey: string | null;
  catProfiles: CatProfile[];
  playNavEntryMotion: boolean;
  onNavEntryMotionPlayed: () => void;
  onOpenMainichiDay: (
    dateKey: string,
    source?: MainichiMorphSource | null,
  ) => void;
  onOpenMainichiPhoto: (
    photo: MainichiBoardPhoto,
    month: MainichiBoardMonth,
    source?: MainichiMorphSource | null,
  ) => void;
}) {
  const [activeBoardSide, setActiveBoardSide] =
    useState<MainichiBoardSide>("delivered");

  return (
    <section style={styles.boxOverview} aria-label="ねこだより">
      <MainichiPhotoBoard
        dayGroups={dayGroups}
        activeSide={activeBoardSide}
        onSideChange={setActiveBoardSide}
        firstEveningDeliveryTargetDateKey={firstEveningDeliveryTargetDateKey}
        catProfiles={catProfiles}
        playNavEntryMotion={playNavEntryMotion}
        onNavEntryMotionPlayed={onNavEntryMotionPlayed}
        onOpenDay={onOpenMainichiDay}
        onOpenPhoto={onOpenMainichiPhoto}
      />
    </section>
  );
}

function MainichiPhotoBoard({
  dayGroups,
  activeSide,
  onSideChange,
  firstEveningDeliveryTargetDateKey,
  catProfiles,
  playNavEntryMotion,
  onNavEntryMotionPlayed,
  onOpenDay,
  onOpenPhoto,
}: {
  dayGroups: AlbumDayGroup[];
  activeSide: MainichiBoardSide;
  onSideChange: (side: MainichiBoardSide) => void;
  firstEveningDeliveryTargetDateKey: string | null;
  catProfiles: CatProfile[];
  playNavEntryMotion: boolean;
  onNavEntryMotionPlayed: () => void;
  onOpenDay: (dateKey: string, source?: MainichiMorphSource | null) => void;
  onOpenPhoto: (
    photo: MainichiBoardPhoto,
    month: MainichiBoardMonth,
    source?: MainichiMorphSource | null,
  ) => void;
}) {
  const contentMonths = useMemo(
    () =>
      buildMainichiBoardMonths(
        dayGroups,
        activeSide,
        firstEveningDeliveryTargetDateKey,
        catProfiles,
      ),
    [
      activeSide,
      catProfiles,
      dayGroups,
      firstEveningDeliveryTargetDateKey,
    ],
  );
  const months = useMemo(
    () => includeCurrentMainichiMonth(contentMonths),
    [contentMonths],
  );
  const alternateContentMonths = useMemo(
    () =>
      buildMainichiBoardMonths(
        dayGroups,
        activeSide === "sent" ? "delivered" : "sent",
        firstEveningDeliveryTargetDateKey,
        catProfiles,
      ),
    [
      activeSide,
      catProfiles,
      dayGroups,
      firstEveningDeliveryTargetDateKey,
    ],
  );
  const prefersReducedMotion = usePrefersReducedMotion();
  const [pastingPhotoKey, setPastingPhotoKey] = useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const hasAutoSelectedBoardSideRef = useRef(false);
  const hasUserSelectedBoardSideRef = useRef(false);
  const hasPlayedNavEntryMotionRef = useRef(false);
  const trackedBoardSideRef = useRef<MainichiBoardSide | null>(null);

  useEffect(() => {
    if (trackedBoardSideRef.current === activeSide) {
      return;
    }

    trackedBoardSideRef.current = activeSide;
    trackProductEvent(
      activeSide === "sent"
        ? "collection_sent_tab_view"
        : "collection_received_tab_view",
      {
        surface: "mainichi_board",
        month_count: months.length,
      },
    );
  }, [activeSide, months.length]);

  useEffect(() => {
    if (
      hasAutoSelectedBoardSideRef.current ||
      hasUserSelectedBoardSideRef.current ||
      contentMonths.length > 0 ||
      alternateContentMonths.length === 0
    ) {
      return;
    }

    hasAutoSelectedBoardSideRef.current = true;
    onSideChange(activeSide === "sent" ? "delivered" : "sent");
  }, [activeSide, alternateContentMonths.length, contentMonths.length, onSideChange]);

  useEffect(() => {
    if (months.length === 0) {
      setSelectedMonthKey(null);
      return;
    }

    setSelectedMonthKey((currentKey) =>
      currentKey && months.some((month) => month.key === currentKey)
        ? currentKey
        : months[0].key,
    );
  }, [months]);

  const selectedMonth =
    months.find((month) => month.key === selectedMonthKey) ?? months[0] ?? null;
  const hasAnyBoardMonths = months.length > 0;
  const shouldUseNavEntryMotion =
    playNavEntryMotion &&
    Boolean(selectedMonth) &&
    !hasPlayedNavEntryMotionRef.current;

  useEffect(() => {
    if (!shouldUseNavEntryMotion) {
      return;
    }

    hasPlayedNavEntryMotionRef.current = true;
    const timerId = window.setTimeout(onNavEntryMotionPlayed, 1100);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [onNavEntryMotionPlayed, shouldUseNavEntryMotion]);

  useEffect(() => {
    const photos = selectedMonth?.photos ?? [];

    if (photos.length === 0 || typeof window === "undefined") {
      setPastingPhotoKey(null);
      return;
    }

    const seenKeys = readMainichiSeenPhotoKeys();
    const unseenPhotos = photos
      .filter((photo) => !seenKeys.has(getMainichiBoardPhotoKey(photo)))
      .sort((a, b) => b.timestamp - a.timestamp);
    const photoToPaste = unseenPhotos[0] ?? null;
    const nextSeenKeys = new Set(seenKeys);

    for (const photo of photos) {
      nextSeenKeys.add(getMainichiBoardPhotoKey(photo));
    }

    writeMainichiSeenPhotoKeys(nextSeenKeys);
    if (photoToPaste && !prefersReducedMotion) {
      setPastingPhotoKey(getMainichiBoardPhotoKey(photoToPaste));
      return;
    }

    setPastingPhotoKey((currentKey) => {
      if (prefersReducedMotion || !currentKey) {
        return null;
      }

      return photos.some((photo) => getMainichiBoardPhotoKey(photo) === currentKey)
        ? currentKey
        : null;
    });
  }, [prefersReducedMotion, selectedMonth]);

  return (
    <section style={styles.mainichiBoard} data-testid="mainichi-photo-board">
      <style>{MAINICHI_PASTE_MOTION_CSS}</style>
      {selectedMonth || hasAnyBoardMonths ? (
        <MainichiBoardHeader
          month={selectedMonth}
          activeSide={activeSide}
          onSideChange={(side) => {
            hasUserSelectedBoardSideRef.current = true;
            onSideChange(side);
          }}
          onOpenMonthPicker={() => setIsMonthPickerOpen(true)}
        />
      ) : null}
      <MotionConfig reducedMotion="user">
        <AnimatePresence mode="wait" initial={shouldUseNavEntryMotion}>
          {selectedMonth && selectedMonth.photos.length > 0 ? (
            <motion.div
              key={`${activeSide}-${selectedMonth.key}`}
              style={styles.mainichiMonthList}
              initial={{ opacity: 0, y: 12, scale: 0.992 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.996 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <MainichiNaturalMonthBoard
                month={selectedMonth}
                pastingPhotoKey={pastingPhotoKey}
                onOpenDay={onOpenDay}
                onOpenPhoto={onOpenPhoto}
              />
            </motion.div>
          ) : (
            <motion.div
              key={`empty-${activeSide}`}
              data-testid="mainichi-board-empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            >
              <MainichiBoardEmptyState activeSide={activeSide} />
            </motion.div>
          )}
        </AnimatePresence>
      </MotionConfig>
      {isMonthPickerOpen ? (
        <MainichiMonthPickerSheet
          months={months}
          selectedMonthKey={selectedMonth?.key ?? null}
          onSelect={(monthKey) => {
            setSelectedMonthKey(monthKey);
            setIsMonthPickerOpen(false);
          }}
          onClose={() => setIsMonthPickerOpen(false)}
        />
      ) : null}
    </section>
  );
}

function MainichiBoardHeader({
  month,
  activeSide,
  onSideChange,
  onOpenMonthPicker,
}: {
  month: MainichiBoardMonth | null;
  activeSide: MainichiBoardSide;
  onSideChange: (side: MainichiBoardSide) => void;
  onOpenMonthPicker: () => void;
}) {
  return (
    <header style={styles.mainichiBoardHeader}>
      {month ? (
        <button
          type="button"
          data-testid="mainichi-month-select"
          style={styles.mainichiMonthSelectButton}
          onClick={onOpenMonthPicker}
          aria-label={`${month.label}をえらぶ`}
        >
          <span style={styles.mainichiMonthSelectLabel}>{month.label}</span>
          <span style={styles.mainichiMonthSelectChevron} aria-hidden="true">
            ⌄
          </span>
        </button>
      ) : null}
      <MainichiSideTabs activeSide={activeSide} onSideChange={onSideChange} />
    </header>
  );
}

function MainichiSideTabs({
  activeSide,
  onSideChange,
}: {
  activeSide: MainichiBoardSide;
  onSideChange: (side: MainichiBoardSide) => void;
}) {
  const tabs = [
    { value: "delivered" as const, label: "とどいた" },
    { value: "sent" as const, label: "わたしのねがお" },
  ];

  return (
    <div style={styles.mainichiBoardTabs} role="tablist" aria-label="写真の種類">
      {tabs.map((tab) => {
        const selected = activeSide === tab.value;

        return (
          <motion.button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            style={{
              ...styles.mainichiBoardTab,
              ...(selected ? styles.mainichiBoardTabActive : {}),
            }}
            onClick={() => onSideChange(tab.value)}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
          >
            {tab.label}
          </motion.button>
        );
      })}
    </div>
  );
}

function MainichiBoardEmptyState({ activeSide }: { activeSide: MainichiBoardSide }) {
  const isSent = activeSide === "sent";

  return (
    <section style={styles.mainichiBoardEmpty} aria-label="写真がない状態">
      <span style={styles.mainichiBoardEmptyStack} aria-hidden="true">
        <span
          style={{
            ...styles.mainichiBoardEmptySheet,
            ...styles.mainichiBoardEmptySheetBack,
          }}
        />
        <span
          style={{
            ...styles.mainichiBoardEmptySheet,
            ...styles.mainichiBoardEmptySheetMiddle,
          }}
        />
        <span
          style={{
            ...styles.mainichiBoardEmptySheet,
            ...styles.mainichiBoardEmptySheetFront,
          }}
        >
          <AppIcon name={isSent ? "camera" : "mail"} size={19} />
        </span>
      </span>
      <p style={styles.mainichiBoardEmptyTitle}>
        {isSent ? "まだねがおはありません" : "選んで保存した写真がここに並びます"}
      </p>
      <AppButton
        href="/home"
        variant="secondary"
        size="sm"
        iconStart={<AppIcon name={isSent ? "camera" : "home"} size={14} />}
        style={styles.mainichiBoardEmptyButton}
      >
        {isSent ? "ねがおを とる" : "ホームへ"}
      </AppButton>
    </section>
  );
}

function MainichiMonthPickerSheet({
  months,
  selectedMonthKey,
  onSelect,
  onClose,
}: {
  months: MainichiBoardMonth[];
  selectedMonthKey: string | null;
  onSelect: (monthKey: string) => void;
  onClose: () => void;
}) {
  const years = useMemo(() => groupMainichiMonthsByYear(months), [months]);
  const selectedYear = selectedMonthKey?.slice(0, 4) ?? years[0]?.year ?? null;
  const [expandedYears, setExpandedYears] = useState<Set<string>>(
    () => new Set(selectedYear ? [selectedYear] : []),
  );

  useEffect(() => {
    if (!selectedYear) {
      return;
    }

    setExpandedYears((currentYears) => {
      if (currentYears.has(selectedYear)) {
        return currentYears;
      }

      const nextYears = new Set(currentYears);
      nextYears.add(selectedYear);
      return nextYears;
    });
  }, [selectedYear]);

  return (
    <AppBottomSheet
      title="月をえらぶ"
      onClose={onClose}
      variant="paper"
      style={styles.mainichiMonthPickerSheet}
    >
      <style>{MAINICHI_MONTH_PICKER_CSS}</style>
      <div style={styles.mainichiMonthPicker}>
        {years.map((yearGroup) => (
          <section key={yearGroup.year} style={styles.mainichiMonthPickerYear}>
            <button
              type="button"
              data-testid={`mainichi-month-picker-year-${yearGroup.year}`}
              style={{
                ...styles.mainichiMonthPickerYearButton,
                ...(expandedYears.has(yearGroup.year)
                  ? styles.mainichiMonthPickerYearButtonOpen
                  : {}),
              }}
              onClick={() => {
                setExpandedYears((currentYears) => {
                  const nextYears = new Set(currentYears);

                  if (nextYears.has(yearGroup.year)) {
                    nextYears.delete(yearGroup.year);
                  } else {
                    nextYears.add(yearGroup.year);
                  }

                  return nextYears;
                });
              }}
              aria-expanded={expandedYears.has(yearGroup.year)}
            >
              <span style={styles.mainichiMonthPickerYearTitle}>{yearGroup.year}年</span>
              <span style={styles.mainichiMonthPickerYearMeta}>
                {yearGroup.months.length}か月
              </span>
              <span style={styles.mainichiMonthPickerYearChevron} aria-hidden="true">
                {expandedYears.has(yearGroup.year) ? "⌃" : "⌄"}
              </span>
            </button>
            {expandedYears.has(yearGroup.year) ? (
              <div style={styles.mainichiMonthPickerRows}>
                {yearGroup.months.map((month) => {
                  const selected = month.key === selectedMonthKey;

                  return (
                    <button
                      key={month.key}
                      type="button"
                      data-testid={`mainichi-month-picker-row-${month.key}`}
                      style={{
                        ...styles.mainichiMonthPickerRow,
                        ...(selected ? styles.mainichiMonthPickerRowActive : {}),
                      }}
                      onClick={() => onSelect(month.key)}
                      aria-current={selected ? "true" : undefined}
                    >
                      <span style={styles.mainichiMonthBundleMark} aria-hidden="true">
                        <span
                          style={{
                            ...styles.mainichiMonthBundleSheet,
                            ...styles.mainichiMonthBundleSheetBack,
                          }}
                        />
                        <span
                          style={{
                            ...styles.mainichiMonthBundleSheet,
                            ...styles.mainichiMonthBundleSheetMiddle,
                          }}
                        />
                        <span
                          style={{
                            ...styles.mainichiMonthBundleSheet,
                            ...styles.mainichiMonthBundleSheetFront,
                          }}
                        />
                        <span style={styles.mainichiMonthBundleSeal} />
                      </span>
                      <span style={styles.mainichiMonthPickerRowLabel}>
                        {formatMainichiMonthShortLabel(month.key)}
                      </span>
                      <span style={styles.mainichiMonthPickerRowCount}>
                        {month.photos.length}枚
                      </span>
                      <span style={styles.mainichiMonthPickerRowChevron} aria-hidden="true">
                        {selected ? "✓" : "›"}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </AppBottomSheet>
  );
}

function MainichiNaturalMonthBoard({
  month,
  pastingPhotoKey,
  onOpenDay,
  onOpenPhoto,
}: {
  month: MainichiBoardMonth;
  pastingPhotoKey: string | null;
  onOpenDay: (dateKey: string, source?: MainichiMorphSource | null) => void;
  onOpenPhoto: (
    photo: MainichiBoardPhoto,
    month: MainichiBoardMonth,
    source?: MainichiMorphSource | null,
  ) => void;
}) {
  const [ratios, setRatios] = useState<Record<string, number>>(() =>
    getKnownMainichiPhotoRatios(month.photos),
  );
  const [decodedPhotoKeys, setDecodedPhotoKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [isDayBrowseOpen, setIsDayBrowseOpen] = useState(false);

  useEffect(() => {
    let active = true;

    void Promise.all(
      month.photos.map(async (photo) => [
        getMainichiBoardPhotoKey(photo),
        await readMainichiDisplayRatio(photo),
      ] as const),
    ).then((values) => {
      if (!active) {
        return;
      }
      setRatios((current) => {
        const next = { ...current };
        for (const [key, value] of values) {
          next[key] = value ?? next[key] ?? 1;
        }
        return next;
      });
    });

    return () => {
      active = false;
    };
  }, [month.photos]);

  useEffect(() => {
    setDecodedPhotoKeys(new Set());
  }, [month.key]);

  const allPhotos = useMemo(
    () => [...month.photos].sort((a, b) => b.timestamp - a.timestamp),
    [month.photos],
  );
  const photos = useMemo(
    () => getMainichiBoardVisiblePhotos(allPhotos),
    [allPhotos],
  );
  const placements = useMemo(
    () => buildMainichiCurrentNaturalPlacements(photos, ratios),
    [photos, ratios],
  );
  useEffect(() => {
    let active = true;

    for (const photo of photos) {
      const key = getMainichiBoardPhotoKey(photo);
      void decodePhotoSourcesForDisplay(
        [photo.boardSrc, photo.src, ...(photo.fallbackSrcs ?? [])],
        getPhotoStorageVariant(photo, "board"),
        MAINICHI_CARD_DECODE_TIMEOUT_MS,
      ).then(() => {
        if (!active) {
          return;
        }
        setDecodedPhotoKeys((current) => {
          if (current.has(key)) {
            return current;
          }
          const next = new Set(current);
          next.add(key);
          return next;
        });
      });
    }

    return () => {
      active = false;
    };
  }, [photos]);

  const revealedPlacements = placements.items.filter(({ photo }) =>
    decodedPhotoKeys.has(getMainichiBoardPhotoKey(photo)) &&
    Object.hasOwn(ratios, getMainichiBoardPhotoKey(photo)),
  );

  return (
    <AppCard
      as="section"
      variant="section"
      padding="md"
      style={styles.mainichiMonthBoard}
      data-testid="mainichi-month-board"
      aria-label={month.label}
    >
      {allPhotos.length > MAINICHI_BOARD_DIRECT_PHOTO_LIMIT ? (
        <div style={styles.mainichiDayBrowseAction}>
          <AppButton
            type="button"
            variant="quiet"
            size="sm"
            data-testid="mainichi-day-browse-button"
            onClick={() => setIsDayBrowseOpen(true)}
          >
            日ごとに見る
          </AppButton>
        </div>
      ) : null}
      <div
        style={{
          ...styles.mainichiBoardPhotos,
          height: placements.height,
        }}
        data-testid="mainichi-natural-board"
        data-board-algorithm="current"
      >
        {revealedPlacements.map(({ photo, style, height, motion: cardMotion }, index) => {
          const key = getMainichiBoardPhotoKey(photo);
          const testId =
            photo.side === "sent"
              ? "mainichi-board-photo-sent"
              : "mainichi-board-photo-delivered";

          return (
            <motion.button
              key={key}
              type="button"
              data-testid={testId}
              data-mainichi-photo-card="true"
              data-mainichi-motion="paste"
              data-mainichi-motion-delay={cardMotion.transition.delay}
              data-mainichi-motion-from-opacity={cardMotion.initial.opacity}
              data-mainichi-motion-from-scale={cardMotion.initial.scale}
              data-photo-id={photo.id}
              data-source-photo-id={photo.sourcePhotoId ?? undefined}
              data-photo-timestamp={photo.timestamp}
              data-photo-decode-ready="true"
              data-photo-frame="f3"
              data-mainichi-paste={key === pastingPhotoKey ? "true" : undefined}
              data-display-natural-ratio={ratios[key]?.toFixed(6) ?? ""}
              style={{ ...styles.mainichiNaturalPhotoButton, ...style }}
              initial={cardMotion.initial}
              animate={cardMotion.animate}
              exit={cardMotion.exit}
              whileTap={cardMotion.whileTap}
              transition={cardMotion.transition}
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                onOpenPhoto(photo, month, {
                  rect: {
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height,
                  },
                  photoKey: key,
                });
              }}
              aria-label={photo.side === "sent" ? "わたしのねがおをひらく" : "ねこだよりをひらく"}
            >
              <StoredPhotoImage
                src={photo.boardSrc}
                previewSrc={photo.offlineSrc ?? photo.src}
                fallbackSrcs={photo.fallbackSrcs}
                alt=""
                loading={index < 8 ? "eager" : "lazy"}
                decoding="async"
                storageVariant={getPhotoStorageVariant(photo, "board")}
                style={styles.mainichiNaturalFrame}
                imageStyle={{
                  ...styles.mainichiNaturalPhotoImage,
                  objectFit: "contain",
                }}
                width={180}
                height={Math.round(height)}
                initiallyLoaded
                onStorageDataUrl={
                  photo.side === "delivered"
                    ? (dataUrl) =>
                        writeBackDeliveredPhotoDataUrl(
                          {
                            id: photo.id,
                            sourcePhotoId: photo.sourcePhotoId,
                            src: photo.src,
                          },
                          dataUrl,
                        )
                    : undefined
                }
                onNaturalSize={({ width, height }) => {
                  if (width <= 0 || height <= 0) {
                    return;
                  }
                  setRatios((current) => ({
                    ...current,
                    [key]: width / height,
                  }));
                  persistMainichiPhotoDimensions(photo, { width, height });
                }}
              />
            </motion.button>
          );
        })}
      </div>
      {isDayBrowseOpen ? (
        <MainichiMonthBundleSheet
          month={month}
          onClose={() => setIsDayBrowseOpen(false)}
          onOpenDay={(dateKey) => {
            setIsDayBrowseOpen(false);
            onOpenDay(dateKey);
          }}
        />
      ) : null}
    </AppCard>
  );
}

function MainichiMonthBoard({
  month,
  showCatNames,
  pastingPhotoKey,
  onOpenDay,
  onOpenPhoto,
}: {
  month: MainichiBoardMonth;
  showCatNames: boolean;
  pastingPhotoKey: string | null;
  onOpenDay: (dateKey: string, source?: MainichiMorphSource | null) => void;
  onOpenPhoto: (
    photo: MainichiBoardPhoto,
    month: MainichiBoardMonth,
    source?: MainichiMorphSource | null,
  ) => void;
}) {
  const bundleSide = month.photos[0]?.side ?? "sent";
  const visiblePhotos = month.photos;
  const isCondensedBundle = false;
  const bundleBaseStyle = {
    ...styles.mainichiBundleBase,
    ...getMainichiBundleBaseStyle(month.photos.length, bundleSide),
  };
  const bundleLayers = (
    <>
      <span
        style={{
          ...styles.mainichiBundleLayer,
          ...styles.mainichiBundleLayerBack,
        }}
      />
      <span
        style={{
          ...styles.mainichiBundleLayer,
          ...styles.mainichiBundleLayerMiddle,
        }}
      />
      <span
        style={{
          ...styles.mainichiBundleLayer,
          ...styles.mainichiBundleLayerFront,
        }}
      />
      <span style={styles.mainichiBundlePocket} />
    </>
  );
  const [isBundleSheetOpen, setIsBundleSheetOpen] = useState(false);
  const [decodedPhotoKeys, setDecodedPhotoKeys] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    let isCancelled = false;
    setDecodedPhotoKeys(new Set());

    if (month.photos.length === 0) {
      return () => {
        isCancelled = true;
      };
    }

    for (const photo of month.photos) {
      const photoKey = getMainichiBoardPhotoKey(photo);
      void decodePhotoSourcesForDisplay(
        [photo.boardSrc, photo.src, ...(photo.fallbackSrcs ?? [])],
        "thumbnail",
        MAINICHI_CARD_DECODE_TIMEOUT_MS,
      ).then((result) => {
        if (isCancelled) {
          return;
        }

        setDecodedPhotoKeys((currentKeys) => {
          if (currentKeys.has(photoKey)) {
            return currentKeys;
          }
          const nextKeys = new Set(currentKeys);
          nextKeys.add(photoKey);
          return nextKeys;
        });
        trackProductEvent("card_decode_wait_ms", {
          surface: "mainichi_board",
          side: photo.side,
          wait_ms: result.waitMs,
          url_resolve_ms: result.urlResolveMs,
          image_ready_ms: result.imageReadyMs,
          timed_out: result.timedOut,
          ok: result.ok,
        });
      });
    }

    return () => {
      isCancelled = true;
    };
  }, [month.key, month.photos]);
  const revealPhotos = visiblePhotos.filter((photo) =>
    decodedPhotoKeys.has(getMainichiBoardPhotoKey(photo)),
  );

  return (
    <>
      <AppCard
        as="section"
        variant="section"
        padding="md"
        style={styles.mainichiMonthBoard}
        data-testid="mainichi-month-board"
        aria-label={month.label}
      >
        <div
          style={{
            ...styles.mainichiBoardPhotos,
            ...getMainichiBoardCanvasStyle(month.photos.length, isCondensedBundle),
          }}
        >
          {isCondensedBundle ? (
            <motion.button
              type="button"
              data-testid="mainichi-month-bundle-open"
              style={styles.mainichiMonthOpenButton}
              onClick={() => setIsBundleSheetOpen(true)}
              initial={{ opacity: 0, y: 10, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              whileTap={{ scale: 0.94, y: 2 }}
              transition={{
                delay: 0.34,
                type: "spring",
                stiffness: 260,
                damping: 22,
              }}
              aria-label={`${month.label}の写真を見る`}
            >
              <span style={styles.mainichiMonthOpenGlyph} aria-hidden="true">
                <span style={styles.mainichiMonthOpenGlyphDot} />
                <span style={styles.mainichiMonthOpenGlyphDot} />
                <span style={styles.mainichiMonthOpenGlyphDot} />
              </span>
            </motion.button>
          ) : null}
          {revealPhotos.map((photo) => {
            const originalIndex = visiblePhotos.findIndex(
              (candidate) => candidate.id === photo.id,
            );
            const index = originalIndex >= 0 ? originalIndex : 0;

            return (
              <MainichiBoardPhotoCard
                key={photo.id}
                photo={photo}
                index={index}
                total={month.photos.length}
                showCatName={showCatNames && month.photos.length <= 3}
                shouldPaste={getMainichiBoardPhotoKey(photo) === pastingPhotoKey}
                onOpenPhoto={(source) => onOpenPhoto(photo, month, source)}
              />
            );
          })}
        </div>
      </AppCard>
      {isBundleSheetOpen ? (
        <MainichiMonthBundleSheet
          month={month}
          onClose={() => setIsBundleSheetOpen(false)}
          onOpenDay={(dateKey) => {
            setIsBundleSheetOpen(false);
            onOpenDay(dateKey);
          }}
        />
      ) : null}
    </>
  );
}

function MainichiMonthBundleSheet({
  month,
  onClose,
  onOpenDay,
}: {
  month: MainichiBoardMonth;
  onClose: () => void;
  onOpenDay: (dateKey: string) => void;
}) {
  const dayBundles = useMemo(
    () => groupMainichiBoardPhotosByDay(month.photos),
    [month.photos],
  );

  return (
    <AppBottomSheet
      title={month.label}
      onClose={onClose}
      variant="paper"
      style={styles.mainichiMonthBundleAppSheet}
    >
      <style>{MAINICHI_MONTH_PICKER_CSS}</style>
      <div style={styles.mainichiMonthBundleDays}>
        {dayBundles.map((bundle, index) => (
          <motion.button
            key={bundle.key}
            type="button"
            style={{
              ...styles.mainichiMonthBundleDay,
              ...getMainichiMonthBundleDayStyle(index, bundle.photos.length),
            }}
            onClick={() => onOpenDay(bundle.key)}
            initial={{ opacity: 0, y: 18, rotate: index % 2 === 0 ? -1.2 : 1.2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            whileTap={{ scale: 0.972, y: 2 }}
            transition={{
              delay: Math.min(index * 0.045, 0.28),
              type: "spring",
              stiffness: 240,
              damping: 25,
            }}
            data-testid="mainichi-month-bundle-day"
            data-photo-count={bundle.photos.length}
            aria-label={`${bundle.label} ${bundle.photos.length}枚`}
          >
            <span style={styles.mainichiMonthBundleDayPhotos} aria-hidden="true">
              {bundle.photos.slice(0, 3).map((photo, index) => (
                <PhotoTile
                  key={photo.id}
                  src={photo.src}
                  fallbackSrcs={photo.fallbackSrcs}
                  alt=""
                  variant="tile"
                  aspect="1 / 1"
                  style={{
                    ...styles.mainichiMonthBundleDayPhotoRoot,
                    ...getMainichiMonthBundleDayPhotoStyle(
                      index,
                      Math.min(bundle.photos.length, 3),
                    ),
                  }}
                  imageStyle={styles.mainichiMonthBundleDayPhoto}
                  onStorageDataUrl={
                    photo.side === "delivered"
                      ? (dataUrl) =>
                          writeBackDeliveredPhotoDataUrl(
                            {
                              id: photo.id,
                              sourcePhotoId: photo.sourcePhotoId,
                              src: photo.src,
                            },
                            dataUrl,
                          )
                      : undefined
                  }
                />
              ))}
            </span>
            <span style={styles.mainichiMonthBundleDayText} aria-hidden="true">
              <span style={styles.mainichiMonthBundleDayLabel}>
                {getMainichiBundleDayNumber(bundle.key)}
              </span>
              {bundle.photos.length > 1 ? (
                <span style={styles.mainichiMonthBundleDayStackDots}>
                  {Array.from({ length: Math.min(bundle.photos.length, 3) }).map(
                    (_, dotIndex) => (
                      <span
                        key={dotIndex}
                        style={styles.mainichiMonthBundleDayStackDot}
                      />
                    ),
                  )}
                </span>
              ) : null}
            </span>
            <span style={styles.mainichiMonthBundleDaySeal} aria-hidden="true" />
          </motion.button>
        ))}
      </div>
    </AppBottomSheet>
  );
}

function MainichiBoardPhotoCard({
  photo,
  index,
  total,
  showCatName,
  shouldPaste,
  onOpenPhoto,
}: {
  photo: MainichiBoardPhoto;
  index: number;
  total: number;
  showCatName: boolean;
  shouldPaste: boolean;
  onOpenPhoto: (source?: MainichiMorphSource | null) => void;
}) {
  const layout = getMainichiBoardPhotoLayout(index, total);
  const showTape = shouldPaste || shouldShowMainichiBoardTape(index, total);
  const cardMotion = getMainichiBoardPhotoMotion(index, total, layout);
  const testId =
    photo.side === "sent"
      ? "mainichi-board-photo-sent"
      : "mainichi-board-photo-delivered";

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();

    onOpenPhoto({
      rect: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
      photoKey: getMainichiBoardPhotoKey(photo),
    });
  }

  return (
    <motion.button
      type="button"
      data-testid={testId}
      data-mainichi-photo-card="true"
      data-photo-decode-ready="true"
      data-photo-id={photo.id}
      data-source-photo-id={photo.sourcePhotoId ?? undefined}
      data-mainichi-paste={shouldPaste ? "true" : undefined}
      style={{
        ...styles.mainichiBoardPhotoButton,
        ...layout.style,
        "--mainichi-rotation": layout.rotation,
        "--mainichi-shift-x": layout.shiftX,
        "--mainichi-shift-y": layout.shiftY,
        "--mainichi-tape-left": layout.tapeLeft,
        "--mainichi-tape-rotation": layout.tapeRotation,
        "--mainichi-photo-border": showTape ? layout.tapedBorderWidth : layout.borderWidth,
        "--mainichi-photo-radius": showTape ? layout.tapedBorderRadius : layout.borderRadius,
        zIndex: layout.zIndex,
      } as CSSProperties}
      initial={cardMotion.initial}
      animate={cardMotion.animate}
      exit={cardMotion.exit}
      whileTap={cardMotion.whileTap}
      transition={cardMotion.transition}
      onClick={handleClick}
      aria-label={photo.side === "sent" ? "わたしのねがおをひらく" : "ねこだよりをひらく"}
    >
      {showTape ? (
        <motion.span
          style={styles.mainichiBoardTape}
          initial={shouldPaste ? { opacity: 0, y: -8, scaleX: 0.88 } : false}
          animate={{ opacity: 0.82, y: 0, scaleX: 1 }}
          transition={{
            delay: cardMotion.tapeDelay,
            duration: shouldPaste ? 0.38 : 0.24,
            ease: [0.22, 1, 0.36, 1],
          }}
          aria-hidden="true"
        />
      ) : null}
      <PhotoTile
        src={photo.boardSrc}
        previewSrc={photo.src}
        fallbackSrcs={photo.fallbackSrcs}
        alt=""
        variant="tile"
        aspect={layout.aspect}
        storageVariant={getPhotoStorageVariant(photo, "board")}
        initiallyLoaded
        style={styles.mainichiBoardPhotoTileRoot}
        imageStyle={styles.mainichiBoardPhotoTile}
        onStorageDataUrl={
          photo.side === "delivered"
            ? (dataUrl) =>
                writeBackDeliveredPhotoDataUrl(
                  { id: photo.id, sourcePhotoId: photo.sourcePhotoId, src: photo.src },
                  dataUrl,
                )
            : undefined
        }
      />
      {showCatName && photo.catName ? (
        <span style={styles.mainichiBoardPhotoCatBadge}>{photo.catName}</span>
      ) : null}
    </motion.button>
  );
}

function MainichiDaySheet({
  group,
  photos,
  source,
  onClose,
  onOpenPhoto,
}: {
  group: AlbumDayGroup;
  photos: MainichiDayPhoto[];
  source: MainichiMorphSource | null;
  onClose: () => void;
  onOpenPhoto: (photo: MainichiDayPhoto) => void;
}) {
  const {
    modalRef: panelRef,
    handleModalKeyDown,
    requestModalClose,
  } = useModalBehavior<HTMLElement>({
    open: true,
    onClose: handleClose,
    manageHistory: true,
  });
  const prefersReducedMotion = usePrefersReducedMotion();
  const closeTimerRef = useRef<number | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [motionStyle, setMotionStyle] = useState<CSSProperties>(() => ({
    opacity: prefersReducedMotion ? 1 : 0,
    transform: prefersReducedMotion ? "translate3d(0, 0, 0) scale(1)" : "translate3d(0, 16px, 0) scale(0.985)",
  }));

  function getSourceTransform() {
    const panel = panelRef.current;

    if (!panel || !source) {
      return "translate3d(0, 16px, 0) scale(0.985)";
    }

    const target = panel.getBoundingClientRect();
    const scaleX = source.rect.width / Math.max(target.width, 1);
    const scaleY = source.rect.height / Math.max(target.height, 1);
    const translateX = source.rect.left - target.left;
    const translateY = source.rect.top - target.top;

    return `translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX}, ${scaleY})`;
  }

  useLayoutEffect(() => {
    if (prefersReducedMotion) {
      setMotionStyle({
        opacity: 1,
        transform: "translate3d(0, 0, 0) scale(1)",
      });
      return;
    }

    setMotionStyle({
      opacity: source ? 0.82 : 0,
      transform: getSourceTransform(),
      transition: "none",
      borderRadius: source ? "var(--radius-lg)" : "var(--radius-2xl)",
    });

    const frame = window.requestAnimationFrame(() => {
      setMotionStyle({
        opacity: 1,
        transform: "translate3d(0, 0, 0) scale(1)",
        transition:
          "transform 340ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 180ms ease-out, border-radius 340ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        borderRadius: "var(--radius-2xl)",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [group.key, prefersReducedMotion, source?.photoKey]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    },
    [],
  );

  function handleClose() {
    if (isClosing) {
      return;
    }

    if (prefersReducedMotion || !source) {
      onClose();
      return;
    }

    setIsClosing(true);
    setMotionStyle({
      opacity: 0.84,
      transform: getSourceTransform(),
      transition:
        "transform 280ms cubic-bezier(0.4, 0, 0.6, 1), opacity 220ms ease-in, border-radius 280ms cubic-bezier(0.4, 0, 0.6, 1)",
      borderRadius: "var(--radius-lg)",
    });
    closeTimerRef.current = window.setTimeout(onClose, 260);
  }

  return (
    <>
      <div
        style={{
          ...styles.mainichiDayBackdrop,
          ...(isClosing ? styles.mainichiDayBackdropClosing : null),
        }}
        onClick={requestModalClose}
        aria-hidden="true"
      />
      <section
        ref={panelRef}
        style={{
          ...styles.mainichiDaySheet,
          ...motionStyle,
        }}
        role="dialog"
        aria-modal="true"
        aria-label={`${group.label} その日`}
        tabIndex={-1}
        onKeyDown={handleModalKeyDown}
        data-testid="mainichi-day-sheet"
      >
        <div style={styles.mainichiDayHeader}>
          <div>
            <p style={styles.mainichiDayKicker}>その日</p>
            <h2 style={styles.mainichiDayTitle}>{group.label}</h2>
          </div>
          <AppButton
            type="button"
            variant="ghost"
            size="icon"
            iconOnly
            aria-label="閉じる"
            onClick={requestModalClose}
          >
            <AppIcon name="close" size={18} />
          </AppButton>
        </div>
        {photos.length > 0 ? (
          <div style={styles.mainichiDayTimeline}>
            {photos.map((photo, index) => {
              const rotation = getMainichiDayPhotoRotation(index);

              return (
                <motion.button
                  key={`${photo.kind}-${photo.id}`}
                  type="button"
                  style={styles.mainichiDayPhotoRow}
                  initial={{ opacity: 0, y: 14, rotate: 0, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, rotate: rotation, scale: 1 }}
                  whileTap={{ scale: 0.972, y: 2, rotate: rotation }}
                  transition={{
                    delay: Math.min(index * 0.045, 0.22),
                    type: "spring",
                    stiffness: 230,
                    damping: 24,
                  }}
                  onClick={() => onOpenPhoto(photo)}
                  data-testid={
                    photo.kind === "sleeping"
                      ? "mainichi-day-photo-sent"
                      : "mainichi-day-photo-delivered"
                  }
                  data-photo-id={photo.id}
                >
                <PhotoTile
                  src={getPhotoThumbnailSrc(photo)}
                  fallbackSrcs={getPhotoFallbackSrcs(photo)}
                  alt=""
                  variant="tile"
                  aspect="1 / 1"
                  storageVariant={getPhotoStorageVariant(photo, "list")}
                  style={styles.mainichiDayPhotoTileRoot}
                  imageStyle={styles.mainichiDayPhotoTile}
                  onStorageDataUrl={photo.storageWriteback}
                />
                <span style={styles.mainichiDayPhotoText}>
                  <span style={styles.mainichiDayPhotoSide}>{photo.sideLabel}</span>
                  {photo.catName ? (
                    <span style={styles.mainichiDayPhotoCat}>{photo.catName}</span>
                  ) : null}
                </span>
                </motion.button>
              );
            })}
          </div>
        ) : (
          <EmptyState
            description="この日の ねがおは ありません"
            style={styles.mainichiDayEmpty}
          />
        )}
      </section>
    </>
  );
}

function MainichiFullscreenPhoto({
  photo,
  photoCount,
  currentIndex,
  monthLabel,
  onClose,
  onPrevious,
  onNext,
  onToggleSleepingDelivery,
  onDeleteSleepingPhoto,
  onHideDeliveredPhoto,
  onReportDeliveredPhoto,
}: {
  photo: MainichiDayPhoto;
  photoCount: number;
  currentIndex: number;
  monthLabel: string | null;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleSleepingDelivery: (photo: MainichiDayPhoto) => void;
  onDeleteSleepingPhoto: (photo: MainichiDayPhoto) => void;
  onHideDeliveredPhoto: (photo: MainichiDayPhoto) => void;
  onReportDeliveredPhoto: (photo: MainichiDayPhoto) => void;
}) {
  const [photoAspectRatio, setPhotoAspectRatio] = useState(() =>
    getPhotoAspectCss(photo),
  );
  const [hasPhotoError, setHasPhotoError] = useState(false);
  const [photoRetryKey, setPhotoRetryKey] = useState(0);
  const [pendingAction, setPendingAction] = useState<
    "delete" | "hide" | "report" | null
  >(null);
  const { modalRef, handleModalKeyDown, requestModalClose } =
    useModalBehavior<HTMLDivElement>({
      open: true,
      onClose,
      manageHistory: true,
    });
  const touchStartXRef = useRef<number | null>(null);
  const canNavigate = photoCount > 1;
  const deliveryActionLabel = photo.shared
    ? "自分だけにする"
    : "ねこだよりにする";
  const pendingActionCopy =
    pendingAction === "delete"
      ? {
          title: "この写真を削除しますか",
          text: "この写真は「わたしのねがお」から削除され、今後のねこだよりには使われません。すでにほかの人へとどいたねこだよりは、その人の「とどいた」に残ります。",
          confirm: "削除",
          variant: "danger" as const,
        }
      : pendingAction === "report"
        ? {
            title: "運営に報告しますか",
            text: "この写真は「とどいた」から外れ、運営の確認対象になります。",
            confirm: "報告",
            variant: "danger" as const,
          }
        : pendingAction === "hide"
          ? {
              title: "「とどいた」から外しますか",
              text: "この写真は「とどいた」に表示されなくなります。写真そのものや相手側の記録は削除されません。",
              confirm: "外す",
              variant: "secondary" as const,
            }
          : null;

  useLayoutEffect(() => {
    setPhotoAspectRatio(getPhotoAspectCss(photo));
    setHasPhotoError(false);
    setPhotoRetryKey(0);
    setPendingAction(null);
  }, [photo.id, photo.kind, photo.sourcePhotoId]);

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX ?? null;

    touchStartXRef.current = null;

    if (!canNavigate || startX === null || endX === null) {
      return;
    }

    const deltaX = endX - startX;

    if (Math.abs(deltaX) < 48) {
      return;
    }

    if (deltaX > 0) {
      onPrevious();
    } else {
      onNext();
    }
  }

  function handleConfirmPendingAction() {
    if (pendingAction === "delete") {
      onDeleteSleepingPhoto(photo);
    } else if (pendingAction === "hide") {
      onHideDeliveredPhoto(photo);
    } else if (pendingAction === "report") {
      onReportDeliveredPhoto(photo);
    }

    setPendingAction(null);
  }

  function handleViewerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!pendingAction && canNavigate && event.key === "ArrowLeft") {
      event.preventDefault();
      onPrevious();
      return;
    }

    if (!pendingAction && canNavigate && event.key === "ArrowRight") {
      event.preventDefault();
      onNext();
      return;
    }

    handleModalKeyDown(event);
  }

  return (
    <motion.div
      ref={modalRef}
      style={styles.mainichiViewerOverlay}
      data-testid="mainichi-photo-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={`${photo.dateLabel}の写真`}
      aria-hidden={pendingActionCopy ? true : undefined}
      tabIndex={-1}
      onKeyDown={handleViewerKeyDown}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <div style={styles.mainichiViewerChrome}>
        <div style={styles.mainichiViewerMeta}>
          <span style={styles.mainichiViewerDate}>{photo.dateLabel}</span>
          <span style={styles.mainichiViewerSide}>{photo.sideLabel}</span>
          {monthLabel && canNavigate ? (
            <span style={styles.mainichiViewerCount}>
              {monthLabel}
            </span>
          ) : null}
        </div>
        <AppButton
          type="button"
          variant="ghost"
          size="icon"
          iconOnly
          aria-label="閉じる"
          onClick={requestModalClose}
        >
          <AppIcon name="close" size={18} />
        </AppButton>
      </div>
      <motion.div
        style={styles.mainichiViewerStage}
        initial={{ opacity: 0, y: 16, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.99 }}
        transition={{
          duration: 0.28,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <PhotoViewerFrame
          key={`${photo.id}:${photoRetryKey}`}
          src={getPhotoDetailSrc(photo)}
          previewSrc={photo.offlineSrc ?? getPhotoThumbnailSrc(photo)}
          fallbackSrcs={getPhotoFallbackSrcs(photo)}
          alt=""
          fit="contain"
          aspect="auto"
          storageVariant={getPhotoStorageVariant(photo, "detail")}
          style={{
            ...styles.mainichiViewerFrame,
            aspectRatio: photoAspectRatio,
          }}
          imageStyle={styles.mainichiViewerImage}
          onStorageDataUrl={photo.storageWriteback}
          onNaturalSize={({ width, height }) => {
            if (width > 0 && height > 0) {
              setPhotoAspectRatio(`${width} / ${height}`);
              persistMainichiDayPhotoDimensions(photo, { width, height });
            }
          }}
          onLoad={() => setHasPhotoError(false)}
          onError={() => setHasPhotoError(true)}
        />
        {hasPhotoError ? (
          <AppButton
            type="button"
            variant="quiet"
            size="sm"
            onClick={() => {
              setHasPhotoError(false);
              setPhotoRetryKey((current) => current + 1);
            }}
          >
            もう一度表示する
          </AppButton>
        ) : null}
        {canNavigate ? (
          <div style={styles.mainichiViewerPager} aria-label="写真を切り替える">
            <AppButton
              type="button"
              variant="quiet"
              size="icon"
              iconOnly
              aria-label="前のねこだより"
              style={styles.mainichiViewerPagerButton}
              onClick={onPrevious}
            >
              <AppIcon
                name="chevronRight"
                size={19}
                style={{ transform: "rotate(180deg)" }}
              />
            </AppButton>
            <span style={styles.mainichiViewerPagerCount}>
              {currentIndex + 1}/{photoCount}
            </span>
            <AppButton
              type="button"
              variant="quiet"
              size="icon"
              iconOnly
              aria-label="次のねこだより"
              style={styles.mainichiViewerPagerButton}
              onClick={onNext}
            >
              <AppIcon name="chevronRight" size={19} />
            </AppButton>
          </div>
        ) : null}
      </motion.div>
      <div style={styles.mainichiViewerActions} aria-label="写真の操作">
        {photo.kind === "sleeping" ? (
          <>
            <AppButton
              type="button"
              variant={photo.shared ? "ghost" : "secondary"}
              size="sm"
              iconStart={
                <AppIcon name={photo.shared ? "eyeOff" : "send"} size={17} />
              }
              onClick={() => onToggleSleepingDelivery(photo)}
            >
              {deliveryActionLabel}
            </AppButton>
            <AppButton
              type="button"
              variant="danger"
              size="icon"
              iconOnly
              aria-label="削除"
              title="削除"
              onClick={() => setPendingAction("delete")}
            >
              <AppIcon name="trash" size={18} />
            </AppButton>
          </>
        ) : (
          <>
            <AppButton
              type="button"
              variant="ghost"
              size="icon"
              iconOnly
              aria-label="「とどいた」から外す"
              title="「とどいた」から外す"
              onClick={() => setPendingAction("hide")}
            >
              <AppIcon name="eyeOff" size={18} />
            </AppButton>
            <AppButton
              type="button"
              variant="danger"
              size="icon"
              iconOnly
              aria-label="運営に報告"
              title="運営に報告"
              onClick={() => setPendingAction("report")}
            >
              <AppIcon name="flag" size={18} />
            </AppButton>
          </>
        )}
      </div>
      {pendingActionCopy ? (
        <AppConfirmDialog
          open
          title={pendingActionCopy.title}
          description={pendingActionCopy.text}
          confirmLabel={pendingActionCopy.confirm}
          confirmVariant={pendingActionCopy.variant}
          onCancel={() => setPendingAction(null)}
          onConfirm={handleConfirmPendingAction}
        />
      ) : null}
    </motion.div>
  );
}

function BoxPhotoDetailSheet({
  kind,
  dayLabel,
  photos,
  currentPhotoIndex,
  onClose,
  onPhotoScroll,
  onToggleSleepingDelivery,
  onDeleteSleepingPhoto,
  onHideOtherPhoto,
}: {
  kind: BoxDetailKind;
  dayLabel?: string | null;
  photos: BoxPreviewPhoto[];
  currentPhotoIndex: number;
  onClose: () => void;
  onPhotoScroll: (event: UIEvent<HTMLDivElement>) => void;
  onToggleSleepingDelivery: (photo: BoxPreviewPhoto) => void;
  onDeleteSleepingPhoto: (photo: BoxPreviewPhoto) => void;
  onHideOtherPhoto: (photo: BoxPreviewPhoto) => void;
}) {
  const [pendingAction, setPendingAction] = useState<
    "delete" | "hide" | null
  >(null);
  const title = dayLabel ?? "ねこだより";
  const currentPhoto =
    photos[Math.max(0, Math.min(currentPhotoIndex, photos.length - 1))] ?? null;
  const deliveryActionLabel = currentPhoto?.shared
    ? "自分だけにする"
    : "ねこだよりにする";
  const pendingActionCopy =
    pendingAction === "delete"
      ? {
          title: "この写真を削除しますか",
          text: "この写真は「わたしのねがお」から削除され、今後のねこだよりには使われません。すでにほかの人へとどいたねこだよりは、その人の「とどいた」に残ります。",
          confirm: "削除",
          variant: "danger" as const,
        }
      : pendingAction === "hide"
        ? {
            title: "「とどいた」から外しますか",
            text: "この写真は「とどいた」に表示されなくなります。写真そのものや相手側の記録は削除されません。",
            confirm: "外す",
            variant: "secondary" as const,
          }
        : null;

  useEffect(() => {
    setPendingAction(null);
  }, [currentPhoto?.id, kind]);

  function handleConfirmPendingAction() {
    if (!currentPhoto) {
      return;
    }

    if (pendingAction === "delete") {
      onDeleteSleepingPhoto(currentPhoto);
    } else if (pendingAction === "hide") {
      onHideOtherPhoto(currentPhoto);
    }

    setPendingAction(null);
  }

  return (
    <AppBottomSheet title={title} onClose={onClose} variant="paper">
      {photos.length > 0 ? (
        <div style={styles.sheetPhotoArea}>
          <div style={styles.photoScroll} onScroll={onPhotoScroll}>
            {photos.map((photo) => (
              <div key={photo.id} style={styles.photoSlide}>
                <StoredPhotoImage
                  src={getPhotoDetailSrc(photo)}
                  fallbackSrcs={getPhotoFallbackSrcs(photo)}
                  alt=""
                  style={styles.photoImg}
                  storageVariant={getPhotoStorageVariant(photo, "detail")}
                  onStorageDataUrl={
                    kind === "other"
                      ? (dataUrl) => writeBackDeliveredPhotoDataUrl(photo, dataUrl)
                      : undefined
                  }
                />
              </div>
            ))}
          </div>
          {photos.length > 1 ? (
            <div style={styles.photoDots}>
              {photos.map((photo, index) => (
                <div
                  key={`${photo.id}-dot`}
                  style={
                    index === currentPhotoIndex
                      ? { ...styles.photoDot, ...styles.photoDotActive }
                      : styles.photoDot
                  }
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div style={styles.photoEmpty}>
          <span style={styles.photoEmptyText}>
            {kind === "sleeping"
              ? "ねがおを とると、ここに並びます"
              : "「とどいた」に保存すると、ここに並びます"}
          </span>
        </div>
      )}

      {currentPhoto ? (
        kind === "sleeping" ? (
          <div style={styles.boxDetailActions}>
            <div style={styles.boxIconActionBar} aria-label="写真の操作">
              <AppButton
                type="button"
                aria-label={deliveryActionLabel}
                title={deliveryActionLabel}
                variant={currentPhoto.shared ? "ghost" : "secondary"}
                size="icon"
                iconOnly
                onClick={() => onToggleSleepingDelivery(currentPhoto)}
              >
                <AppIcon
                  name={currentPhoto.shared ? "eyeOff" : "send"}
                  size={20}
                />
              </AppButton>
              <AppButton
                type="button"
                aria-label="写真を削除"
                title="写真を削除"
                variant="danger"
                size="icon"
                iconOnly
                onClick={() => setPendingAction("delete")}
              >
                <AppIcon name="trash" size={20} />
              </AppButton>
            </div>
          </div>
        ) : (
          <div style={styles.boxDetailActions}>
            <div style={styles.boxIconActionBar} aria-label="写真の操作">
              <AppButton
                type="button"
                aria-label="「とどいた」から外す"
                title="「とどいた」から外す"
                variant="danger"
                size="icon"
                iconOnly
                onClick={() => setPendingAction("hide")}
              >
                <AppIcon name="trash" size={20} />
              </AppButton>
            </div>
          </div>
        )
      ) : null}
      {pendingActionCopy ? (
        <AppConfirmDialog
          open
          title={pendingActionCopy.title}
          description={pendingActionCopy.text}
          confirmLabel={pendingActionCopy.confirm}
          confirmVariant={pendingActionCopy.variant}
          onCancel={() => setPendingAction(null)}
          onConfirm={handleConfirmPendingAction}
        />
      ) : null}
    </AppBottomSheet>
  );
}

function CollectionViewTabs({
  activeView,
  onSelectView,
}: {
  activeView: CollectionView;
  onSelectView: (view: CollectionView) => void;
}) {
  const tabs: Array<{ key: CollectionView; label: string }> = [
    { key: "collect", label: "とったねがお" },
    { key: "album", label: "おきてる写真" },
    { key: "share", label: "とどいた" },
  ];

  return (
    <div role="tablist" aria-label="アルバムの表示" style={styles.viewTabs}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeView;

        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelectView(tab.key)}
            style={{
              ...styles.viewTab,
              ...(isActive ? styles.viewTabActive : {}),
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function CollectionCollectView({
  dailyTargetSlot,
  nextTargetSlots,
  onOpenSlot,
}: {
  dailyTargetSlot: CollectionSlot | null;
  nextTargetSlots: CollectionSlot[];
  onOpenSlot: (slot: CollectionSlot) => void;
}) {
  return (
    <section style={styles.collectView} aria-label="今日あつめる">
      {dailyTargetSlot ? (
        <DailyCollectionTarget slot={dailyTargetSlot} onOpenSlot={onOpenSlot} />
      ) : null}

      {nextTargetSlots.length > 0 ? (
        <AppCard as="div" variant="section" padding="md" style={styles.nextTargetBlock}>
          <div style={styles.sectionHeadingRow}>
            <p style={styles.sectionHeading}>次に見つけたい姿</p>
          </div>
          <div style={styles.nextTargetRail}>
            {nextTargetSlots.map((slot) => (
              <AppCard
                as="button"
                key={slot.id}
                type="button"
                variant="inset"
                padding="sm"
                interactive
                onClick={() => onOpenSlot(slot)}
                style={styles.nextTargetCard}
              >
                <img src={slot.iconPath} alt="" style={styles.nextTargetIcon} />
                <span style={styles.nextTargetName}>
                  {getCollectionSlotLabel(slot)}
                </span>
              </AppCard>
            ))}
          </div>
        </AppCard>
      ) : null}
    </section>
  );
}

function CollectionAlbumView({
  activeGroup,
  activeGroupId,
  progress,
  photosBySlot,
  dailyTargetSlotId,
  onSelectGroup,
  onOpenSlot,
}: {
  activeGroup: CollectionGroup;
  activeGroupId: CollectionGroupId;
  progress: ReturnType<typeof buildCollectionProgress>;
  photosBySlot: Map<string, CollectionPhoto[]>;
  dailyTargetSlotId: string | null;
  onSelectGroup: (groupId: CollectionGroupId) => void;
  onOpenSlot: (slot: CollectionSlot) => void;
}) {
  return (
    <>
      <CollectionProgress
        activeGroupId={activeGroupId}
        progress={progress}
        onSelectGroup={onSelectGroup}
      />
      <CollectionGrid
        group={activeGroup}
        photosBySlot={photosBySlot}
        dailyTargetSlotId={dailyTargetSlotId}
        onOpenSlot={onOpenSlot}
      />
    </>
  );
}

function CollectionShareView({
  feedItems,
  onOpenItem,
  onGoCollect,
}: {
  feedItems: CollectionShareFeedItem[];
  onOpenItem: (item: CollectionShareFeedItem) => void;
  onGoCollect: () => void;
}) {
  if (feedItems.length === 0) {
    return (
      <AppCard as="section" variant="section" padding="standard" style={styles.shareEmptyCard}>
        <p style={styles.shareEmptyTitle}>まだ写真がありません</p>
        <p style={styles.shareEmptyText}>写真を見つけると、ここに自分の一枚が並びます。</p>
        <AppButton type="button" variant="primary" fullWidth onClick={onGoCollect}>
          写真を選ぶ
        </AppButton>
      </AppCard>
    );
  }

  const hasPhotoItems = feedItems.some((item) => item.itemType === "photo");
  const hasSuggestionItems = feedItems.some(
    (item) => item.itemType === "suggestion",
  );
  const headerTitle = hasPhotoItems ? "自分の一枚と候補" : "次にとる候補";

  return (
    <section style={styles.shareView} aria-label="シェア">
      <AppCard as="div" variant="inset" padding="md" style={styles.shareHeaderCard}>
        <p style={styles.shareHeaderKicker}>シェア準備</p>
        <p style={styles.shareHeaderTitle}>{headerTitle}</p>
        <div style={styles.shareSourceRow} aria-label="シェアに並ぶもの">
          <span
            style={
              hasPhotoItems
                ? styles.shareSourceChipActive
                : styles.shareSourceChip
            }
          >
            自分
          </span>
          <span style={styles.shareSourceChip}>共有はこれから</span>
          <span
            style={
              hasSuggestionItems
                ? styles.shareSourceChipActive
                : styles.shareSourceChip
            }
          >
            とる候補
          </span>
        </div>
      </AppCard>
      <div style={styles.shareFeed}>
        {feedItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpenItem(item)}
            style={styles.shareFeedCard}
          >
            {item.src ? (
              <StoredPhotoImage src={item.src} alt="" style={styles.shareFeedPhoto} />
            ) : (
              <span style={styles.shareSuggestionVisual} aria-hidden="true">
                {item.iconPath ? (
                  <img
                    src={item.iconPath}
                    alt=""
                    style={styles.shareSuggestionIcon}
                  />
                ) : null}
              </span>
            )}
            <span style={styles.shareFeedFade} aria-hidden="true" />
            <span style={styles.shareFeedBadge}>{item.badge}</span>
            {item.description ? (
              <span style={styles.shareFeedMeta}>{item.description}</span>
            ) : item.ownerScope !== "self" && item.ownerName ? (
              <span style={styles.shareFeedMeta}>{item.ownerName}</span>
            ) : null}
            <span style={styles.shareFeedLabel}>
              {item.slot ? getCollectionSlotLabel(item.slot) : "写真"}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function CollectionProgress({
  activeGroupId,
  progress,
  onSelectGroup,
}: {
  activeGroupId: CollectionGroupId;
  progress: ReturnType<typeof buildCollectionProgress>;
  onSelectGroup: (groupId: CollectionGroupId) => void;
}) {
  const progressPercent = getProgressPercent(
    progress.total.collected,
    progress.total.total,
  );

  return (
    <AppCard
      as="section"
      variant="section"
      padding="md"
      style={styles.progressBlock}
      aria-label="コレクションの進み具合"
    >
      <p style={styles.progressMain}>
        <span style={styles.progressNumber}>
          {progress.total.collected}
          <span style={styles.progressSlash}>/</span>
          {progress.total.total}
        </span>
        <span style={styles.progressUnit}>残した姿</span>
      </p>
      <p style={styles.progressSub}>
        {`${getCollectionGroupLabel("pose")}${progress.pose.collected} ・ ${getCollectionGroupLabel("scene")}${progress.scene.collected}`}
      </p>
      <div style={styles.progressTrack} aria-hidden="true">
        <span
          style={{
            ...styles.progressFill,
            width: `${progressPercent}%`,
          }}
        />
      </div>
      <style>
        {`.collection-tabs::-webkit-scrollbar{display:none}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}
      </style>
      <div
        role="tablist"
        aria-label="コレクションの種類"
        className="collection-tabs"
        style={styles.tabs}
      >
        {COLLECTION_GROUPS.map((group) => {
          const isActive = group.id === activeGroupId;

          return (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectGroup(group.id)}
              style={{
                ...styles.tab,
                ...(isActive ? styles.activeTab : {}),
              }}
            >
              {getCollectionGroupLabel(group.id)}
            </button>
          );
        })}
      </div>
    </AppCard>
  );
}

function DailyCollectionTarget({
  slot,
  onOpenSlot,
}: {
  slot: CollectionSlot;
  onOpenSlot: (slot: CollectionSlot) => void;
}) {
  return (
    <AppCard
      as="button"
      type="button"
      variant="section"
      padding="md"
      interactive
      style={styles.dailyTargetCard}
      onClick={() => onOpenSlot(slot)}
    >
      <span style={styles.dailyTargetThumb} aria-hidden="true">
        <img src={slot.iconPath} alt="" style={styles.dailyTargetIcon} />
      </span>
      <span style={styles.dailyTargetText}>
        <span style={styles.dailyTargetLabel}>今日の見つけたい姿</span>
        <strong style={styles.dailyTargetName}>
          {getCollectionSlotLabel(slot)}
        </strong>
      </span>
      <span style={styles.dailyTargetHint}>見つける</span>
    </AppCard>
  );
}

function CollectionGrid({
  group,
  photosBySlot,
  dailyTargetSlotId,
  onOpenSlot,
}: {
  group: CollectionGroup;
  photosBySlot: Map<string, CollectionPhoto[]>;
  dailyTargetSlotId: string | null;
  onOpenSlot: (slot: CollectionSlot) => void;
}) {
  return (
    <section aria-label={getCollectionGroupLabel(group.id)}>
      <div style={styles.collectionGrid}>
        {group.slots.map((slot) => (
          <CollectionCard
            key={slot.id}
            slot={slot}
            photos={photosBySlot.get(slot.id) ?? []}
            isDailyTarget={slot.id === dailyTargetSlotId}
            onOpenSlot={onOpenSlot}
          />
        ))}
      </div>
    </section>
  );
}

function CollectionCard({
  slot,
  photos,
  isDailyTarget,
  onOpenSlot,
}: {
  slot: CollectionSlot;
  photos: CollectionPhoto[];
  isDailyTarget: boolean;
  onOpenSlot: (slot: CollectionSlot) => void;
}) {
  const firstPhoto = photos[0];
  const isCollected = photos.length > 0;

  if (isCollected && firstPhoto) {
    return (
      <button
        type="button"
        onClick={() => onOpenSlot(slot)}
        style={{ ...styles.collectionCard, ...styles.photoCard }}
      >
        <StoredPhotoImage
          src={getPhotoThumbnailSrc(firstPhoto)}
          fallbackSrcs={getPhotoFallbackSrcs(firstPhoto)}
          alt=""
          style={styles.cardPhoto}
          storageVariant={getPhotoStorageVariant(firstPhoto, "list")}
        />
        <span style={styles.cardPhotoFade} aria-hidden="true" />
        {photos.length > 1 ? (
          <span style={styles.cardCountBadge}>{photos.length}枚</span>
        ) : null}
        {isDailyTarget ? <span style={styles.todayBadge}>今日</span> : null}
        <div style={styles.photoCardText}>
          <p style={styles.photoCardLabel}>{getCollectionSlotLabel(slot)}</p>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onOpenSlot(slot)}
      style={{ ...styles.collectionCard, ...styles.emptyCollectionCard }}
    >
      {isDailyTarget ? <span style={styles.todayBadge}>今日</span> : null}
      <div style={styles.emptySlotContent}>
        <img src={slot.iconPath} alt="" style={styles.emptyCardIcon} />
        <span style={styles.emptySlotLabel}>{getCollectionSlotLabel(slot)}</span>
      </div>
    </button>
  );
}

function CollectionPhotoSheet({
  slot,
  photos,
  currentPhotoIndex,
  onClose,
  onAddPhoto,
  onShare,
  onDeletePhoto,
  onPhotoScroll,
}: {
  slot: CollectionSlot;
  photos: CollectionPhoto[];
  currentPhotoIndex: number;
  onClose: () => void;
  onAddPhoto: () => void;
  onShare: () => void;
  onDeletePhoto: (slug: string, index: number) => void;
  onPhotoScroll: (event: UIEvent<HTMLDivElement>) => void;
}) {
  const slug = getCollectionPhotoSlug(slot);

  return (
    <AppBottomSheet
      title={getCollectionSlotLabel(slot)}
      onClose={onClose}
      variant="paper"
    >
      {photos.length > 0 ? (
        <div style={styles.sheetPhotoArea}>
          <div style={styles.photoScroll} onScroll={onPhotoScroll}>
            {photos.map((photo, index) => (
              <div key={photo.id} style={styles.photoSlide}>
                <StoredPhotoImage
                  src={getPhotoDetailSrc(photo)}
                  fallbackSrcs={getPhotoFallbackSrcs(photo)}
                  alt=""
                  style={styles.photoImg}
                  storageVariant={getPhotoStorageVariant(photo, "detail")}
                />
                {photo.localIndex !== undefined ? (
                  <AppButton
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => onDeletePhoto(slug, photo.localIndex ?? index)}
                  >
                    削除
                  </AppButton>
                ) : null}
              </div>
            ))}
          </div>
          {photos.length > 1 ? (
            <div style={styles.photoDots}>
              {photos.map((photo, index) => (
                <div
                  key={`${photo.id}-dot`}
                  style={
                    index === currentPhotoIndex
                      ? { ...styles.photoDot, ...styles.photoDotActive }
                      : styles.photoDot
                  }
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <div style={styles.photoEmpty}>
          <span style={styles.photoEmptyText}>写真を選ぶと、ここに表示されます</span>
        </div>
      )}

      <div style={styles.sheetActions}>
        <AppButton
          type="button"
          variant="primary"
          size="md"
          fullWidth
          style={styles.sheetActionButton}
          onClick={onAddPhoto}
        >
          写真を追加
        </AppButton>
        <AppButton
          type="button"
          variant="secondary"
          size="md"
          fullWidth
          onClick={onShare}
          style={styles.sheetActionButton}
          disabled={photos.length === 0}
        >
          シェアに並べる
        </AppButton>
      </div>
    </AppBottomSheet>
  );
}

function CollectionCompletionSheet({
  slot,
  onClose,
  onOpenAlbum,
  onOpenShare,
}: {
  slot: CollectionSlot;
  onClose: () => void;
  onOpenAlbum: () => void;
  onOpenShare: () => void;
}) {
  return (
    <AppBottomSheet title="見つけました" onClose={onClose}>
      <div style={styles.completionBody}>
        <div style={styles.completionIcon} aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <p style={styles.completionTitle}>
          {getCollectionSlotLabel(slot)}
          を見つけた
        </p>
        <div style={styles.completionActions}>
          <AppButton
            type="button"
            variant="primary"
            size="md"
            fullWidth
            style={styles.sheetActionButton}
            onClick={onOpenAlbum}
          >
            アルバムを見る
          </AppButton>
          <AppButton
            type="button"
            variant="secondary"
            size="md"
            fullWidth
            style={styles.sheetActionButton}
            onClick={onOpenShare}
          >
            シェアに並べる
          </AppButton>
        </div>
      </div>
    </AppBottomSheet>
  );
}

function CollectionSilhouette({ slot }: { slot: CollectionSlot }) {
  const shape = getSilhouetteShape(slot.silhouetteKey, slot.group);

  return (
    <svg
      viewBox="0 0 96 72"
      style={styles.silhouette}
      fill="none"
      stroke="currentColor"
      strokeWidth="3.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
    >
      {shape}
    </svg>
  );
}

function getSilhouetteShape(key: string, group: CollectionGroupId) {
  switch (key) {
    case "belly-up":
      return (
        <>
          <path d="M23 43c8-16 38-18 50-3 7 9 0 19-18 19H37c-15 0-22-7-14-16Z" />
          <path d="M34 38 27 28" />
          <path d="M59 36 68 27" />
          <path d="M42 50c3 2 9 2 12 0" />
        </>
      );
    case "loaf":
      return (
        <>
          <path d="M25 45c0-15 12-24 26-24s24 9 24 24c0 11-9 16-25 16s-25-5-25-16Z" />
          <path d="M39 24 33 14" />
          <path d="M60 24 66 14" />
          <path d="M38 47h24" />
        </>
      );
    case "stretch":
      return (
        <>
          <path d="M16 47c13-10 38-15 63-6" />
          <path d="M19 47c6 10 17 12 28 6" />
          <path d="M62 41c2 9 10 13 19 13" />
          <path d="M76 38 86 31" />
        </>
      );
    case "face-down-sleep":
      return (
        <>
          <path d="M25 51c0-16 13-26 28-26 14 0 24 9 24 21 0 10-8 15-25 15H36c-7 0-11-3-11-10Z" />
          <path d="M37 48h24" />
          <path d="M40 25 35 17" />
          <path d="M58 25 64 17" />
        </>
      );
    case "curled-up":
      return (
        <>
          <path d="M25 39c4-17 23-25 39-15 15 9 14 29-2 36-15 7-35 0-37-21Z" />
          <path d="M42 44c8 5 18 3 23-4" />
          <path d="M57 25c8 3 13 8 15 15" />
        </>
      );
    case "liquid":
      return (
        <>
          <path d="M17 50c15-10 22 2 34-7 13-9 26-7 31 6 2 7-6 12-26 12H29c-12 0-17-5-12-11Z" />
          <path d="M34 43c2-8 10-13 19-12" />
          <path d="M53 31 49 22" />
          <path d="M65 34 73 28" />
        </>
      );
    case "sitting":
      return (
        <>
          <path d="M34 58c-3-18 2-35 17-35s21 17 17 35" />
          <path d="M39 25 33 14" />
          <path d="M61 25 67 14" />
          <path d="M35 58h34" />
          <path d="M68 54c8-5 8-15 2-21" />
        </>
      );
    case "tail-up":
      return (
        <>
          <path d="M25 54c7-14 25-18 39-9" />
          <path d="M31 54h28" />
          <path d="M62 43c8-12 5-26-5-33" />
          <path d="M30 43 24 34" />
          <path d="M42 41 48 31" />
        </>
      );
    case "weird-sleep":
      return (
        <>
          <path d="M22 46c11-16 30-12 43-7 11 4 16 13 7 20-10 8-34 3-48-3" />
          <path d="M30 41 20 33" />
          <path d="M55 39 65 28" />
          <path d="M45 55c6-4 8-10 6-17" />
        </>
      );
    case "hidden-paws":
      return (
        <>
          <path d="M27 47c0-16 11-27 24-27s23 11 23 27c0 11-9 16-24 16s-23-5-23-16Z" />
          <path d="M39 22 34 14" />
          <path d="M61 22 66 14" />
          <path d="M39 51h22" />
        </>
      );
    case "in-box":
      return (
        <>
          <path d="M21 36h54l-6 25H27l-6-25Z" />
          <path d="M31 36c3-12 12-18 23-14 9 3 14 8 14 14" />
          <path d="M42 24 36 16" />
          <path d="M58 25 65 18" />
        </>
      );
    case "by-window":
      return (
        <>
          <path d="M15 14h66v45H15z" />
          <path d="M48 14v45" />
          <path d="M15 37h66" />
          <path d="M30 56c2-13 9-20 18-20s14 6 16 20" />
        </>
      );
    case "sunbathing":
      return (
        <>
          <circle cx="25" cy="19" r="7" />
          <path d="M25 5v5M25 28v5M11 19h5M34 19h5" />
          <path d="M37 52c8-15 29-16 41-3" />
          <path d="M41 52h34" />
        </>
      );
    case "in-futon":
      return (
        <>
          <path d="M18 43c9-13 21-18 35-16 14 2 23 9 25 22" />
          <path d="M16 48c17 10 44 13 66 0" />
          <path d="M32 42c4-8 10-12 18-12" />
          <path d="M43 30 38 22" />
          <path d="M55 30 61 22" />
        </>
      );
    case "high-place":
      return (
        <>
          <path d="M18 55h60" />
          <path d="M22 42h50v13H22z" />
          <path d="M37 42c2-12 9-18 18-17 8 1 14 7 15 17" />
          <path d="M45 27 39 19" />
          <path d="M61 28 68 21" />
        </>
      );
    case "waiting-food":
      return (
        <>
          <path d="M15 54h28l-3 9H18l-3-9Z" />
          <path d="M19 54c1-5 5-8 10-8s9 3 10 8" />
          <path d="M54 59c-3-18 2-32 15-32 11 0 17 12 14 32" />
          <path d="M60 29 55 20" />
          <path d="M76 29 82 20" />
        </>
      );
    case "welcome-home":
      return (
        <>
          <path d="M18 12h29v50H18z" />
          <path d="M47 18h18v44" />
          <path d="M36 37h.01" />
          <path d="M56 58c3-12 10-19 19-19 8 0 12 6 13 19" />
          <path d="M75 39V26" />
        </>
      );
    case "blanket-kneading":
      return (
        <>
          <path d="M16 51c15-8 32 8 64-1" />
          <path d="M17 58c15-8 32 8 64-1" />
          <path d="M37 42c2-10 9-16 19-15 9 1 15 7 17 16" />
          <path d="M46 43c0 6-4 8-8 8" />
          <path d="M63 43c0 6 4 8 8 8" />
        </>
      );
    default:
      return group === "scene" ? (
        <>
          <path d="M17 20h62v39H17z" />
          <path d="M31 54c2-12 9-18 18-18s15 6 17 18" />
        </>
      ) : (
        <>
          <path d="M25 49c3-17 15-27 29-25 13 2 21 13 18 28" />
          <path d="M34 26 28 17" />
          <path d="M59 26 66 18" />
          <path d="M31 56h38" />
        </>
      );
  }
}

function groupPhotosBySlot(photos: CollectionPhoto[]) {
  const map = new Map<string, CollectionPhoto[]>();

  photos.forEach((photo) => {
    const current = map.get(photo.slotId) ?? [];
    map.set(photo.slotId, [...current, photo]);
  });

  return map;
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);

    update();
    media.addEventListener?.("change", update);

    return () => media.removeEventListener?.("change", update);
  }, []);

  return prefersReducedMotion;
}

function readMainichiSeenPhotoKeys() {
  if (typeof window === "undefined") {
    return new Set<string>();
  }

  try {
    const values =
      readCachedJson<unknown[]>(MAINICHI_SEEN_PHOTO_KEYS_STORAGE_KEY) ?? [];

    return new Set(
      Array.isArray(values)
        ? values.filter((value): value is string => typeof value === "string")
        : [],
    );
  } catch {
    return new Set<string>();
  }
}

function writeMainichiSeenPhotoKeys(keys: Set<string>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    writeCachedJson(MAINICHI_SEEN_PHOTO_KEYS_STORAGE_KEY, [...keys].slice(-500));
  } catch {
    // Local-only motion bookkeeping should never block the album.
  }
}

function buildMainichiDayPhotos(
  group: AlbumDayGroup,
  catNameById: Map<string, string>,
): MainichiDayPhoto[] {
  const sentPhotos = group.sections
    .filter((section) => section.kind === "sleeping")
    .flatMap((section) => section.photos)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((photo) => {
      const catId = photo.ownerCatId ?? photo.catId;

      return {
        id: photo.id,
        sourcePhotoId: photo.sourcePhotoId,
        dateKey: group.key,
        dateLabel: group.label,
        src: photo.src,
        thumbnailSrc: photo.thumbnailSrc,
        displaySrc: photo.displaySrc,
        originalSrc: photo.originalSrc,
        width: photo.width,
        height: photo.height,
        offlineSrc: photo.offlineSrc,
        timestamp: photo.timestamp,
        kind: "sleeping" as const,
        sideLabel: "わたしのねがお",
        catName: catId ? catNameById.get(catId) : undefined,
        shared: photo.shared,
      };
    });
  const deliveredPhotos = group.sections
    .filter((section) => section.kind === "other")
    .flatMap((section) => section.photos)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((photo) => ({
      id: photo.id,
      sourcePhotoId: photo.sourcePhotoId,
      dateKey: group.key,
      dateLabel: group.label,
      src: photo.src,
      thumbnailSrc: photo.thumbnailSrc,
      displaySrc: photo.displaySrc,
      originalSrc: photo.originalSrc,
      width: photo.width,
      height: photo.height,
      offlineSrc: photo.offlineSrc,
      timestamp: photo.timestamp,
      kind: "other" as const,
      sideLabel: "とどいた",
      deliveredAt: photo.deliveredAt,
      storageWriteback: (dataUrl: string) =>
        writeBackDeliveredPhotoDataUrl(photo, dataUrl),
    }));

  return [...sentPhotos, ...deliveredPhotos];
}

function createExchangePhotoFromDayPhoto(photo: MainichiDayPhoto): ExchangePhoto {
  return {
    id: photo.id,
    sourcePhotoId: photo.sourcePhotoId,
    src: getPhotoDetailSrc(photo),
    thumbnailSrc: photo.thumbnailSrc,
    displaySrc: photo.displaySrc,
    originalSrc: photo.originalSrc,
    offlineSrc: photo.offlineSrc,
    width: photo.width,
    height: photo.height,
    title: "ねこだより",
    subtitle: "",
    triggerLabel: "mainichi",
    theme: "mainichi",
    deliveredAt: photo.deliveredAt ?? photo.timestamp,
  };
}

function createExchangePhotoFromBoxPhoto(photo: BoxPreviewPhoto): ExchangePhoto {
  return {
    id: photo.id,
    sourcePhotoId: photo.sourcePhotoId,
    src: getPhotoDetailSrc(photo),
    thumbnailSrc: photo.thumbnailSrc,
    displaySrc: photo.displaySrc,
    originalSrc: photo.originalSrc,
    offlineSrc: photo.offlineSrc,
    width: photo.width,
    height: photo.height,
    title: "ねこだより",
    subtitle: "",
    triggerLabel: "collection",
    theme: "mainichi",
    deliveredAt: photo.deliveredAt ?? photo.createdAt ?? Date.now(),
  };
}

function getMainichiPhotoSide(photo: MainichiDayPhoto): MainichiBoardSide {
  return photo.kind === "sleeping" ? "sent" : "delivered";
}

function getMainichiDayPhotoBoardKey(photo: MainichiDayPhoto) {
  return `${getMainichiPhotoSide(photo)}:${photo.sourcePhotoId ?? photo.id}:${photo.dateKey}`;
}

function buildMainichiViewerPhotosForMonth(
  month: MainichiBoardMonth,
  dayGroups: AlbumDayGroup[],
  catNameById: Map<string, string>,
) {
  const dayGroupByKey = new Map(dayGroups.map((group) => [group.key, group]));
  const dayPhotoByBoardKey = new Map<string, MainichiDayPhoto>();

  for (const dateKey of new Set(month.photos.map((photo) => photo.dateKey))) {
    const group = dayGroupByKey.get(dateKey);

    if (!group) {
      continue;
    }

    for (const photo of buildMainichiDayPhotos(group, catNameById)) {
      dayPhotoByBoardKey.set(getMainichiDayPhotoBoardKey(photo), photo);
    }
  }

  return month.photos
    .map((photo) => dayPhotoByBoardKey.get(getMainichiBoardPhotoKey(photo)))
    .filter((photo): photo is MainichiDayPhoto => Boolean(photo));
}

function buildMainichiBoardMonths(
  dayGroups: AlbumDayGroup[],
  side: MainichiBoardSide,
  firstEveningDeliveryTargetDateKey: string | null,
  catProfiles: CatProfile[],
): MainichiBoardMonth[] {
  const catNameById = new Map(
    catProfiles.map((profile) => [profile.id, getCatName(profile)]),
  );
  const photos = dayGroups.flatMap((group) => {
    const sectionKind: AlbumPhotoKind = side === "sent" ? "sleeping" : "other";
    const sectionPhotos = group.sections
      .filter((section) => section.kind === sectionKind)
      .flatMap((section) =>
        section.photos.map((photo) =>
          createMainichiBoardPhoto(photo, group.key, side, catNameById),
        ),
      );

    if (
      side === "delivered" &&
      sectionPhotos.length === 0 &&
      !shouldResolveOtherDeliverySlot(
        group.key,
        firstEveningDeliveryTargetDateKey,
      )
    ) {
      return [];
    }

    return sectionPhotos;
  });
  const monthMap = new Map<string, MainichiBoardPhoto[]>();

  for (const photo of photos) {
    const monthKey = getMainichiMonthKey(photo.dateKey);
    monthMap.set(monthKey, [...(monthMap.get(monthKey) ?? []), photo]);
  }

  return [...monthMap.entries()]
    .map(([key, monthPhotos]) => ({
      key,
      label: formatMainichiMonthLabel(key),
      photos: [...monthPhotos].sort((a, b) => b.timestamp - a.timestamp),
    }))
    .sort((a, b) => b.key.localeCompare(a.key));
}

function includeCurrentMainichiMonth(months: MainichiBoardMonth[]) {
  const currentMonthKey = getMainichiMonthKey(getJstDateKey());

  if (months.some((month) => month.key === currentMonthKey)) {
    return months;
  }

  return [
    {
      key: currentMonthKey,
      label: formatMainichiMonthLabel(currentMonthKey),
      photos: [],
    },
    ...months,
  ].sort((a, b) => b.key.localeCompare(a.key));
}

function createMainichiBoardPhoto(
  photo: AlbumMomentPhoto,
  dateKey: string,
  side: MainichiBoardSide,
  catNameById: Map<string, string>,
): MainichiBoardPhoto {
  const catId = photo.ownerCatId ?? photo.catId;

  return {
    id: photo.id,
    sourcePhotoId: photo.sourcePhotoId,
    dateKey,
    dateLabel: getAlbumDateLabelFromKey(dateKey),
    src: getPhotoThumbnailSrc(photo),
    boardSrc: getPhotoTransformBaseSrc(photo),
    offlineSrc: photo.offlineSrc,
    fallbackSrcs: getPhotoFallbackSrcs(photo),
    width: photo.width,
    height: photo.height,
    timestamp: photo.timestamp,
    side,
    catName: side === "sent" && catId ? catNameById.get(catId) : undefined,
  };
}

function persistMainichiPhotoDimensions(
  photo: MainichiBoardPhoto,
  size: { width: number; height: number },
) {
  if (photo.side === "delivered") {
    updateKeptExchangePhotoDimensions(photo, size);
    return;
  }

  updateOwnSleepingPhotoDimensions(
    { id: photo.id, sourceMomentId: photo.sourcePhotoId },
    size,
  );
}

function persistMainichiDayPhotoDimensions(
  photo: MainichiDayPhoto,
  size: { width: number; height: number },
) {
  if (photo.kind === "other") {
    updateKeptExchangePhotoDimensions(photo, size);
    return;
  }

  if (photo.kind === "sleeping") {
    updateOwnSleepingPhotoDimensions(
      { id: photo.id, sourceMomentId: photo.sourcePhotoId },
      size,
    );
  }
}

function getMainichiMonthKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

function formatMainichiMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  return `${year}年${Number(month)}月`;
}

function formatMainichiMonthShortLabel(monthKey: string) {
  const [, month] = monthKey.split("-");
  return `${Number(month)}月`;
}

function groupMainichiMonthsByYear(months: MainichiBoardMonth[]) {
  const yearMap = new Map<string, MainichiBoardMonth[]>();

  for (const month of months) {
    const year = month.key.slice(0, 4);
    yearMap.set(year, [...(yearMap.get(year) ?? []), month]);
  }

  return [...yearMap.entries()]
    .map(([year, yearMonths]) => ({
      year,
      months: [...yearMonths].sort((a, b) => b.key.localeCompare(a.key)),
    }))
    .sort((a, b) => b.year.localeCompare(a.year));
}

function getMainichiDayPhotoRotation(index: number) {
  const rotations = ["-1.2deg", "1deg", "-0.5deg", "1.4deg"];
  return rotations[index % rotations.length];
}

function getMainichiBundleDayNumber(dateKey: string) {
  const day = dateKey.split("-").at(-1) ?? "";

  return `${Number(day) || day}`;
}

function getMainichiMonthBundleDayPhotoStyle(
  index: number,
  total: number,
): CSSProperties {
  const layouts = {
    1: [{ x: 0, y: 3, rotate: "-1.2deg", width: 66, z: 3 }],
    2: [
      { x: -12, y: 12, rotate: "-3deg", width: 54, z: 2 },
      { x: 14, y: 3, rotate: "2.2deg", width: 60, z: 3 },
    ],
    3: [
      { x: -17, y: 17, rotate: "-3.5deg", width: 48, z: 1 },
      { x: 13, y: 11, rotate: "2.4deg", width: 52, z: 2 },
      { x: -2, y: 3, rotate: "-0.8deg", width: 60, z: 3 },
    ],
  } satisfies Record<number, Array<{ x: number; y: number; rotate: string; width: number; z: number }>>;
  const layoutKey = Math.min(Math.max(total, 1), 3) as 1 | 2 | 3;
  const layout = layouts[layoutKey][index] ?? layouts[1][0];

  return {
    left: `calc(50% + ${layout.x}px)`,
    top: `${layout.y}px`,
    width: `${layout.width}px`,
    zIndex: layout.z,
    transform: `translateX(-50%) rotate(${layout.rotate})`,
  };
}

function getMainichiMonthBundleDayStyle(
  index: number,
  photoCount: number,
): CSSProperties {
  const layouts = [
    { rotate: "-2.1deg", y: 4, x: 0, width: "96%", justifySelf: "start" },
    { rotate: "1.4deg", y: -4, x: -1, width: "88%", justifySelf: "center" },
    { rotate: "-0.8deg", y: 9, x: 2, width: "94%", justifySelf: "end" },
    { rotate: "1.9deg", y: 2, x: 3, width: "86%", justifySelf: "center" },
    { rotate: "-1.5deg", y: 10, x: -2, width: "92%", justifySelf: "start" },
    { rotate: "0.9deg", y: -2, x: 1, width: "90%", justifySelf: "end" },
  ];
  const layout = layouts[index % layouts.length];
  const scale = photoCount > 1 ? 1.04 : 1;

  return {
    width: layout.width,
    justifySelf: layout.justifySelf,
    transform: `translate(${layout.x}px, ${layout.y}px) rotate(${layout.rotate}) scale(${scale})`,
  };
}

function getMainichiBoardPhotoKey(photo: MainichiBoardPhoto) {
  return `${photo.side}:${photo.sourcePhotoId ?? photo.id}:${photo.dateKey}`;
}

const MAINICHI_BOARD_DIRECT_PHOTO_LIMIT = 24;
const MAINICHI_BOARD_DENSE_PREVIEW_LIMIT = 18;

function getMainichiBoardVisiblePhotos(photos: MainichiBoardPhoto[]) {
  if (photos.length <= MAINICHI_BOARD_DIRECT_PHOTO_LIMIT) {
    return photos;
  }

  return photos.slice(0, MAINICHI_BOARD_DENSE_PREVIEW_LIMIT);
}

function groupMainichiBoardPhotosByDay(
  photos: MainichiBoardPhoto[],
): MainichiBoardDayBundle[] {
  const dayMap = new Map<string, MainichiBoardDayBundle>();

  for (const photo of photos) {
    const currentDay = dayMap.get(photo.dateKey);

    if (currentDay) {
      currentDay.photos.push(photo);
      currentDay.timestamp = Math.max(currentDay.timestamp, photo.timestamp);
    } else {
      dayMap.set(photo.dateKey, {
        key: photo.dateKey,
        label: photo.dateLabel,
        timestamp: photo.timestamp,
        photos: [photo],
      });
    }
  }

  return [...dayMap.values()]
    .map((day) => ({
      ...day,
      photos: [...day.photos].sort((a, b) => b.timestamp - a.timestamp),
    }))
    .sort((a, b) => b.timestamp - a.timestamp);
}

function buildMainichiCurrentNaturalPlacements(
  photos: MainichiBoardPhoto[],
  ratios: Record<string, number>,
) {
  const baseHeight = getMainichiCurrentCanvasHeight(photos.length);
  let requiredHeight = baseHeight;
  const items = photos.map((photo, index) => {
    const boardLayout = getMainichiBoardPhotoLayout(index, photos.length);
    const widthPercent = Number.parseFloat(boardLayout.width) || 30;
    const width = Math.round((430 * widthPercent) / 100);
    const ratio = ratios[getMainichiBoardPhotoKey(photo)] ?? 1;
    const height = Math.max(1, Math.round(width / Math.max(ratio, 0.01)));
    const top = Number.parseFloat(boardLayout.top) || 0;
    requiredHeight = Math.max(requiredHeight, Math.ceil(top + height + 28));

    return {
      photo,
      height,
      motion: getMainichiBoardPhotoMotion(index, photos.length, boardLayout),
      style: {
        ...boardLayout.style,
        aspectRatio: String(ratio),
        zIndex: boardLayout.zIndex,
      } satisfies CSSProperties,
    };
  });

  return {
    height: `${requiredHeight}px`,
    items,
  };
}

function getMainichiCurrentCanvasHeight(total: number) {
  if (total <= 1) {
    return 280;
  }
  if (total <= 3) {
    return 320;
  }
  if (total <= 8) {
    return 460;
  }
  if (total <= 16) {
    return 520;
  }
  return 560;
}

async function readMainichiDisplayRatio(photo: MainichiBoardPhoto) {
  const knownAspect = getPhotoAspectRatio(photo);
  if (knownAspect) {
    return knownAspect;
  }

  const sources = Array.from(
    new Set(
      [photo.boardSrc, photo.offlineSrc, photo.src, ...(photo.fallbackSrcs ?? [])].filter(
        (source): source is string => Boolean(source),
      ),
    ),
  );

  for (const source of sources) {
    const displaySource = await getStoragePhotoSignedUrl(source, "display");
    if (!displaySource) {
      continue;
    }

    const ratio = await readImageAspectRatio(displaySource);
    if (ratio) {
      return ratio;
    }
  }

  return null;
}

function getKnownMainichiPhotoRatios(photos: MainichiBoardPhoto[]) {
  return Object.fromEntries(
    photos.flatMap((photo) => {
      const aspect = getPhotoAspectRatio(photo);
      return aspect ? [[getMainichiBoardPhotoKey(photo), aspect] as const] : [];
    }),
  );
}

function getPhotoAspectCss(
  photo: Pick<PhotoSourceSet, "width" | "height">,
) {
  const aspect = getPhotoAspectRatio(photo);
  return aspect ? `${photo.width} / ${photo.height}` : "1 / 1";
}

function readImageAspectRatio(src: string) {
  return new Promise<number | null>((resolve) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        resolve(null);
        return;
      }
      resolve(image.naturalWidth / image.naturalHeight);
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function getMainichiBoardCanvasStyle(
  total: number,
  isCondensedBundle = false,
): CSSProperties {
  if (total <= 0) {
    return {};
  }

  if (isCondensedBundle) {
    return {
      height: "520px",
    };
  }

  if (total === 1) {
    return {
      height: "280px",
    };
  }

  if (total <= 3) {
    return {
      height: "320px",
    };
  }

  if (total <= 8) {
    return {
      height: "460px",
    };
  }

  if (total <= 16) {
    return {
      height: "520px",
    };
  }

  if (total <= 24) {
    return {
      height: "560px",
    };
  }

  return {
    height: "560px",
  };
}

function getMainichiBundleBaseStyle(
  total: number,
  side: MainichiBoardSide,
  isCondensedBundle = false,
): CSSProperties {
  const depth =
    isCondensedBundle && total >= 48
      ? {
          width: "90%",
          height: "112px",
          bottom: "44px",
          opacity: 0.36,
          edge: "15px",
          pocket: 0.18,
          shadow: 0.11,
        }
      : isCondensedBundle
      ? {
          width: "86%",
          height: "86px",
          bottom: "52px",
          opacity: 0.3,
          edge: "11px",
          pocket: 0.16,
          shadow: 0.09,
        }
      : total <= 1
      ? {
          width: "58%",
          height: "42px",
          bottom: "62px",
          opacity: 0.34,
          edge: "4px",
          pocket: 0.2,
          shadow: 0.1,
        }
      : total <= 8
        ? {
            width: "72%",
            height: "52px",
            bottom: "54px",
            opacity: 0.42,
            edge: "6px",
            pocket: 0.26,
            shadow: 0.1,
          }
        : total <= 16
          ? {
              width: "82%",
              height: "64px",
              bottom: "46px",
              opacity: 0.48,
              edge: "8px",
              pocket: 0.3,
              shadow: 0.1,
            }
          : {
              width: "88%",
              height: "72px",
              bottom: "44px",
              opacity: 0.52,
              edge: "11px",
              pocket: 0.34,
              shadow: 0.1,
            };

  return {
    "--mainichi-bundle-width": depth.width,
    "--mainichi-bundle-height": depth.height,
    "--mainichi-bundle-bottom": depth.bottom,
    "--mainichi-bundle-opacity": depth.opacity,
    "--mainichi-bundle-edge": depth.edge,
    "--mainichi-bundle-pocket-opacity": depth.pocket,
    "--mainichi-bundle-shadow-alpha": depth.shadow,
    "--mainichi-bundle-seal-x": side === "sent" ? "62%" : "38%",
  } as CSSProperties;
}

function getMainichiBoardPhotoLayout(index: number, total: number) {
  type MainichiBoardSlot = {
    left: number;
    top: number;
    width: number;
    rotation: string;
    shiftX?: number;
    shiftY?: number;
    tapeLeft?: string;
    tapeRotation?: string;
    zIndex?: number;
    aspect?: string;
  };

  const sparse = [
    { left: 21, top: 48, width: 58, rotation: "-1deg", tapeLeft: "52%", tapeRotation: "-3deg", zIndex: 4 },
    { left: 8, top: 104, width: 46, rotation: "-2.1deg", shiftX: -2, tapeLeft: "48%", tapeRotation: "-4deg", zIndex: 3 },
    { left: 48, top: 154, width: 43, rotation: "1.8deg", shiftX: 2, shiftY: 4, tapeLeft: "55%", tapeRotation: "3deg", zIndex: 2 },
    { left: 24, top: 202, width: 38, rotation: "-0.8deg", shiftY: 3, tapeLeft: "50%", tapeRotation: "-2deg", zIndex: 1 },
  ] satisfies MainichiBoardSlot[];
  const loose = [
    { left: 25, top: 28, width: 48, rotation: "-1deg", tapeLeft: "52%", tapeRotation: "-3deg", zIndex: 8 },
    { left: 6, top: 74, width: 34, rotation: "-2.5deg", shiftX: -2, tapeLeft: "47%", tapeRotation: "-5deg", zIndex: 4 },
    { left: 60, top: 86, width: 32, rotation: "1.9deg", shiftX: 2, shiftY: 4, tapeLeft: "57%", tapeRotation: "3deg", zIndex: 3 },
    { left: 32, top: 158, width: 42, rotation: "1.1deg", shiftY: 5, tapeLeft: "50%", tapeRotation: "3deg", zIndex: 7 },
    { left: 8, top: 252, width: 36, rotation: "1.7deg", shiftX: 1, tapeLeft: "56%", tapeRotation: "4deg", zIndex: 3 },
    { left: 55, top: 272, width: 34, rotation: "-1.8deg", shiftX: -2, shiftY: 4, tapeLeft: "46%", tapeRotation: "-4deg", zIndex: 5 },
    { left: 29, top: 324, width: 30, rotation: "-0.9deg", shiftX: 1, tapeLeft: "52%", tapeRotation: "-2deg", zIndex: 2 },
    { left: 66, top: 188, width: 25, rotation: "1.1deg", shiftX: 2, shiftY: 2, tapeLeft: "52%", tapeRotation: "2deg", zIndex: 1 },
  ] satisfies MainichiBoardSlot[];
  const medium = [
    { left: 8, top: 26, width: 34, rotation: "-2.4deg", shiftX: -1, tapeLeft: "48%", tapeRotation: "-4deg", zIndex: 6 },
    { left: 41, top: 38, width: 24, rotation: "1.2deg", shiftX: 1, tapeLeft: "56%", tapeRotation: "3deg", zIndex: 2 },
    { left: 68, top: 48, width: 27, rotation: "-1deg", shiftX: 1, shiftY: 2, tapeLeft: "51%", tapeRotation: "-2deg", zIndex: 3 },
    { left: 19, top: 112, width: 22, rotation: "2deg", tapeLeft: "50%", tapeRotation: "4deg", zIndex: 1 },
    { left: 32, top: 138, width: 39, rotation: "-1.1deg", shiftX: -1, shiftY: 4, tapeLeft: "43%", tapeRotation: "-3deg", zIndex: 8 },
    { left: 72, top: 166, width: 22, rotation: "1.7deg", shiftX: 1, shiftY: 2, tapeLeft: "54%", tapeRotation: "3deg", zIndex: 2 },
    { left: 6, top: 236, width: 33, rotation: "1.4deg", shiftX: -1, shiftY: 2, tapeLeft: "52%", tapeRotation: "3deg", zIndex: 5 },
    { left: 38, top: 292, width: 23, rotation: "-1.3deg", shiftX: 1, shiftY: 2, tapeLeft: "48%", tapeRotation: "-4deg", zIndex: 2 },
    { left: 58, top: 256, width: 34, rotation: "1deg", shiftX: 1, tapeLeft: "55%", tapeRotation: "3deg", zIndex: 7 },
    { left: 13, top: 374, width: 26, rotation: "-1.8deg", tapeLeft: "47%", tapeRotation: "-5deg", zIndex: 1 },
    { left: 39, top: 354, width: 33, rotation: "1.2deg", shiftX: 1, shiftY: 3, tapeLeft: "57%", tapeRotation: "4deg", zIndex: 6 },
    { left: 70, top: 388, width: 23, rotation: "-0.7deg", shiftX: 1, shiftY: 2, tapeLeft: "50%", tapeRotation: "-2deg", zIndex: 2 },
    { left: 25, top: 72, width: 19, rotation: "1.5deg", shiftX: 1, tapeLeft: "51%", tapeRotation: "2deg", zIndex: 1 },
    { left: 18, top: 194, width: 21, rotation: "-1deg", shiftX: -1, tapeLeft: "49%", tapeRotation: "-3deg", zIndex: 1 },
    { left: 54, top: 214, width: 21, rotation: "1.7deg", shiftX: 1, tapeLeft: "52%", tapeRotation: "4deg", zIndex: 1 },
    { left: 8, top: 446, width: 22, rotation: "0.8deg", tapeLeft: "55%", tapeRotation: "2deg", zIndex: 1 },
  ] satisfies MainichiBoardSlot[];
  const dense = [
    { left: 7, top: 24, width: 29, rotation: "-2deg", shiftX: -1, tapeLeft: "48%", tapeRotation: "-4deg", zIndex: 6 },
    { left: 34, top: 38, width: 20, rotation: "1.2deg", shiftX: 1, tapeLeft: "56%", tapeRotation: "3deg", zIndex: 2 },
    { left: 52, top: 24, width: 30, rotation: "-0.8deg", shiftY: 2, tapeLeft: "51%", tapeRotation: "-2deg", zIndex: 8 },
    { left: 75, top: 66, width: 22, rotation: "1.6deg", shiftX: 1, shiftY: 2, tapeLeft: "50%", tapeRotation: "4deg", zIndex: 3 },
    { left: 15, top: 98, width: 20, rotation: "2deg", tapeLeft: "50%", tapeRotation: "4deg", zIndex: 1 },
    { left: 30, top: 126, width: 34, rotation: "-1.1deg", shiftX: -1, shiftY: 2, tapeLeft: "43%", tapeRotation: "-3deg", zIndex: 9 },
    { left: 61, top: 128, width: 25, rotation: "1.4deg", shiftX: 1, tapeLeft: "54%", tapeRotation: "3deg", zIndex: 2 },
    { left: 76, top: 196, width: 18, rotation: "-1.4deg", tapeLeft: "49%", tapeRotation: "-3deg", zIndex: 1 },
    { left: 5, top: 206, width: 31, rotation: "-1.8deg", shiftX: -1, tapeLeft: "47%", tapeRotation: "-5deg", zIndex: 6 },
    { left: 28, top: 238, width: 19, rotation: "1.2deg", shiftX: 1, tapeLeft: "57%", tapeRotation: "4deg", zIndex: 3 },
    { left: 45, top: 220, width: 30, rotation: "-0.9deg", shiftX: 2, tapeLeft: "50%", tapeRotation: "-2deg", zIndex: 7 },
    { left: 69, top: 276, width: 22, rotation: "1deg", shiftX: 1, tapeLeft: "52%", tapeRotation: "2deg", zIndex: 1 },
    { left: 14, top: 330, width: 23, rotation: "-1.5deg", shiftX: -1, tapeLeft: "48%", tapeRotation: "-4deg", zIndex: 2 },
    { left: 34, top: 320, width: 33, rotation: "1.2deg", shiftX: 1, shiftY: 2, tapeLeft: "56%", tapeRotation: "3deg", zIndex: 8 },
    { left: 63, top: 356, width: 24, rotation: "-1.1deg", shiftX: 1, tapeLeft: "51%", tapeRotation: "-2deg", zIndex: 3 },
    { left: 6, top: 424, width: 22, rotation: "1.7deg", tapeLeft: "50%", tapeRotation: "4deg", zIndex: 1 },
    { left: 25, top: 412, width: 28, rotation: "-0.9deg", shiftX: -1, tapeLeft: "43%", tapeRotation: "-3deg", zIndex: 4 },
    { left: 51, top: 448, width: 24, rotation: "1.2deg", shiftX: 1, shiftY: 2, tapeLeft: "54%", tapeRotation: "3deg", zIndex: 2 },
    { left: 72, top: 420, width: 24, rotation: "-1.3deg", tapeLeft: "48%", tapeRotation: "-4deg", zIndex: 4 },
    { left: 10, top: 478, width: 25, rotation: "0.9deg", shiftX: 1, tapeLeft: "52%", tapeRotation: "3deg", zIndex: 5 },
    { left: 35, top: 468, width: 21, rotation: "-1.7deg", shiftX: -1, tapeLeft: "46%", tapeRotation: "-5deg", zIndex: 1 },
    { left: 55, top: 486, width: 28, rotation: "1.5deg", shiftX: 1, shiftY: 1, tapeLeft: "57%", tapeRotation: "4deg", zIndex: 6 },
    { left: 3, top: 518, width: 19, rotation: "-0.8deg", tapeLeft: "50%", tapeRotation: "-2deg", zIndex: 2 },
    { left: 76, top: 508, width: 20, rotation: "1.1deg", shiftX: 1, tapeLeft: "53%", tapeRotation: "3deg", zIndex: 4 },
  ] satisfies MainichiBoardSlot[];
  const preview = [
    { left: 7, top: 32, width: 32, rotation: "-2.2deg", shiftX: -1, tapeLeft: "48%", tapeRotation: "-4deg", zIndex: 9 },
    { left: 36, top: 62, width: 22, rotation: "1.2deg", shiftX: 1, tapeLeft: "56%", tapeRotation: "3deg", zIndex: 3 },
    { left: 53, top: 34, width: 35, rotation: "-0.9deg", shiftY: 2, tapeLeft: "51%", tapeRotation: "-2deg", zIndex: 10 },
    { left: 14, top: 134, width: 22, rotation: "2deg", tapeLeft: "50%", tapeRotation: "4deg", zIndex: 2 },
    { left: 30, top: 154, width: 39, rotation: "-1deg", shiftX: -1, shiftY: 3, tapeLeft: "43%", tapeRotation: "-3deg", zIndex: 12 },
    { left: 66, top: 150, width: 25, rotation: "1.5deg", shiftX: 1, tapeLeft: "54%", tapeRotation: "3deg", zIndex: 4 },
    { left: 6, top: 254, width: 35, rotation: "-1.8deg", shiftX: -1, tapeLeft: "47%", tapeRotation: "-5deg", zIndex: 8 },
    { left: 37, top: 296, width: 21, rotation: "1.2deg", shiftX: 1, tapeLeft: "57%", tapeRotation: "4deg", zIndex: 3 },
    { left: 53, top: 258, width: 35, rotation: "-0.7deg", shiftX: 1, tapeLeft: "50%", tapeRotation: "-2deg", zIndex: 11 },
    { left: 17, top: 382, width: 23, rotation: "-1.4deg", shiftX: -1, tapeLeft: "48%", tapeRotation: "-4deg", zIndex: 2 },
    { left: 36, top: 372, width: 34, rotation: "1.1deg", shiftX: 1, shiftY: 2, tapeLeft: "56%", tapeRotation: "3deg", zIndex: 8 },
    { left: 67, top: 402, width: 23, rotation: "-1deg", shiftX: 1, tapeLeft: "51%", tapeRotation: "-2deg", zIndex: 3 },
    { left: 8, top: 462, width: 22, rotation: "1.5deg", tapeLeft: "50%", tapeRotation: "4deg", zIndex: 1 },
    { left: 29, top: 500, width: 27, rotation: "-0.8deg", shiftX: -1, tapeLeft: "43%", tapeRotation: "-3deg", zIndex: 4 },
    { left: 54, top: 470, width: 29, rotation: "1.4deg", shiftX: 1, shiftY: 1, tapeLeft: "57%", tapeRotation: "4deg", zIndex: 7 },
    { left: 72, top: 214, width: 20, rotation: "-1.4deg", tapeLeft: "49%", tapeRotation: "-3deg", zIndex: 1 },
    { left: 22, top: 232, width: 20, rotation: "1deg", tapeLeft: "52%", tapeRotation: "2deg", zIndex: 1 },
    { left: 74, top: 520, width: 20, rotation: "-0.9deg", tapeLeft: "50%", tapeRotation: "-2deg", zIndex: 2 },
  ] satisfies MainichiBoardSlot[];
  const template: MainichiBoardSlot[] =
    total > MAINICHI_BOARD_DIRECT_PHOTO_LIMIT
      ? preview
      : total <= 1
      ? [sparse[0]]
      : total <= 3
        ? sparse.slice(0, total)
        : total <= 8
          ? loose
          : total <= 16
            ? medium
            : dense;

  const layout = template[index % template.length];
  const repeat = Math.floor(index / template.length);
  const verticalScale =
    total > MAINICHI_BOARD_DIRECT_PHOTO_LIMIT
      ? 0.8
      : total > 16
        ? 0.84
        : total > 8
          ? 0.92
          : total > 3
            ? 0.94
            : 1;
  const top = Math.max(
    0,
    Math.round(layout.top * verticalScale) + repeat * 14,
  );
  const densityScale =
    total >= 48
      ? 0.88
      : total > MAINICHI_BOARD_DIRECT_PHOTO_LIMIT
        ? 0.92
        : total > 20
          ? 0.94
          : total > 16
            ? 0.97
            : 1;
  const width =
    total > MAINICHI_BOARD_DIRECT_PHOTO_LIMIT
      ? Math.max(17, Math.round(layout.width * densityScale))
      : total > 16
        ? Math.max(18, Math.round(layout.width * densityScale))
        : total > 8
          ? Math.max(21, Math.round(layout.width * densityScale))
          : layout.width;
  const borderWidth =
    width <= 27 ? "2px" : width <= 34 ? "3px" : "4px";
  const tapedBorderWidth =
    width <= 27 ? "2px" : "3px";
  const borderRadius =
    width <= 22 ? "7px" : width <= 27 ? "8px" : width <= 34 ? "10px" : "12px";
  const tapedBorderRadius =
    width <= 24 ? "7px" : width <= 27 ? "8px" : "10px";

  return {
    left: `${layout.left}%`,
    top: `${top}px`,
    width: `${width}%`,
    rotation: layout.rotation,
    shiftX: `${layout.shiftX ?? 0}px`,
    shiftY: `${layout.shiftY ?? 0}px`,
    tapeLeft: layout.tapeLeft ?? "50%",
    tapeRotation: layout.tapeRotation ?? "-3deg",
    borderWidth,
    tapedBorderWidth,
    borderRadius,
    tapedBorderRadius,
    zIndex: layout.zIndex,
    aspect: layout.aspect ?? getMainichiBoardPhotoAspect(index, total),
    style: {
      left: `${layout.left}%`,
      top: `${top}px`,
      width: `${width}%`,
    } satisfies CSSProperties,
  };
}

function getMainichiBoardPhotoMotion(
  index: number,
  total: number,
  layout: ReturnType<typeof getMainichiBoardPhotoLayout>,
) {
  const x = parseMainichiPixelValue(layout.shiftX);
  const y = parseMainichiPixelValue(layout.shiftY);
  const isSparse = total <= 3;
  const isMedium = total > 3 && total <= 12;
  const delayStep = total > MAINICHI_BOARD_DIRECT_PHOTO_LIMIT ? 0.018 : 0.034;
  const delayCap = total > MAINICHI_BOARD_DIRECT_PHOTO_LIMIT ? 0.26 : 0.42;
  const delay = Math.min(index * delayStep, delayCap);
  const lift = isSparse ? 18 : isMedium ? 34 : 48;
  const initialScale = isSparse ? 0.94 : isMedium ? 0.84 : 0.76;
  const initialRotate =
    total <= 1 ? layout.rotation : index % 2 === 0 ? "-0.8deg" : "0.8deg";

  return {
    initial: {
      opacity: 0,
      scale: initialScale,
      x: x * 0.28,
      y: y + lift,
      rotate: initialRotate,
      filter: "brightness(1.02) saturate(0.96)",
    },
    animate: {
      opacity: 1,
      scale: 1,
      x,
      y,
      rotate: layout.rotation,
      filter: "brightness(1) saturate(1)",
    },
    exit: {
      opacity: 0,
      scale: 0.97,
      x: x * 0.5,
      y: y - 10,
      rotate: layout.rotation,
      filter: "brightness(0.98) saturate(0.98)",
    },
    whileTap: {
      scale: 0.968,
      x,
      y: y + 2,
      rotate: layout.rotation,
      filter: "brightness(0.985) saturate(0.98)",
    },
    transition: {
      delay,
      type: "spring" as const,
      stiffness: isSparse ? 210 : 250,
      damping: isSparse ? 24 : 28,
      mass: isSparse ? 0.78 : 0.68,
    },
    tapeDelay: delay + (isSparse ? 0.08 : 0.14),
  };
}

function parseMainichiPixelValue(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getMainichiBoardPhotoAspect(index: number, total: number) {
  const sparse = ["1 / 1", "5 / 4", "4 / 5"];
  const loose = ["1 / 1", "5 / 4", "4 / 5", "1 / 1", "6 / 5", "5 / 6", "1 / 1", "5 / 4"];
  const medium = [
    "1 / 1",
    "5 / 4",
    "4 / 5",
    "1 / 1",
    "6 / 5",
    "5 / 6",
    "1 / 1",
    "4 / 5",
    "5 / 4",
    "1 / 1",
    "6 / 5",
    "5 / 6",
  ];
  const full = [
    "1 / 1",
    "5 / 4",
    "4 / 5",
    "1 / 1",
    "6 / 5",
    "5 / 6",
    "1 / 1",
    "5 / 4",
    "4 / 5",
    "1 / 1",
  ];

  if (total <= 3) {
    return sparse[index % sparse.length];
  }

  if (total <= 8) {
    return loose[index % loose.length];
  }

  if (total <= 16) {
    return medium[index % medium.length];
  }

  return full[index % full.length];
}

function shouldShowMainichiBoardTape(index: number, total: number) {
  if (total <= 3) {
    return true;
  }

  if (total <= 8) {
    return [0, 3, 5].includes(index);
  }

  if (total <= 16) {
    return [0, 4, 8, 10].includes(index);
  }

  if (total <= MAINICHI_BOARD_DIRECT_PHOTO_LIMIT) {
    return [0, 5, 8, 13, 16, 21].includes(index);
  }

  return [0, 4, 6, 8, 10, 14].includes(index);
}

function buildAlbumDayGroups(
  sleepingPhotos: BoxPreviewPhoto[],
  awakePhotos: BoxPreviewPhoto[],
  otherPhotos: BoxPreviewPhoto[],
  unopenedOtherDeliveryDateKeys = new Set<string>(),
  undeliverableOtherDeliveryDateKeys = new Set<string>(),
): AlbumDayGroup[] {
  const items: AlbumMomentPhoto[] = [
    ...sleepingPhotos.map((photo) => ({
      ...photo,
      kind: "sleeping" as const,
      timestamp: getBoxPhotoTimestamp(photo),
    })),
    ...otherPhotos.map((photo) => ({
      ...photo,
      kind: "other" as const,
      timestamp: getBoxPhotoTimestamp(photo),
    })),
    ...awakePhotos.map((photo) => ({
      ...photo,
      kind: "awake" as const,
      timestamp: getBoxPhotoTimestamp(photo),
      slotId: photo.sourcePhotoId,
    })),
  ]
    .filter((photo) => Number.isFinite(photo.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp);

  const groups = new Map<string, AlbumMomentPhoto[]>();

  for (const photo of items) {
    const key = getLocalDateKey(photo.timestamp);
    groups.set(key, [...(groups.get(key) ?? []), photo]);
  }

  for (const key of unopenedOtherDeliveryDateKeys) {
    if (!groups.has(key)) {
      groups.set(key, []);
    }
  }

  for (const key of undeliverableOtherDeliveryDateKeys) {
    if (!groups.has(key)) {
      groups.set(key, []);
    }
  }

  return [...groups.entries()].map(([key, photos]) => {
    const hasUnopenedOtherDelivery = unopenedOtherDeliveryDateKeys.has(key);
    const hasUndeliverableOtherDelivery =
      undeliverableOtherDeliveryDateKeys.has(key);
    const sections: AlbumDaySection[] = (
      [
      {
        kind: "sleeping",
        photos: photos.filter((photo) => photo.kind === "sleeping"),
      },
      {
        kind: "other",
        photos: photos.filter((photo) => photo.kind === "other"),
      },
      {
        kind: "awake",
        photos: photos.filter((photo) => photo.kind === "awake"),
      },
    ] satisfies AlbumDaySection[]
    ).filter((section) => section.photos.length > 0);

    return {
      key,
      label: getAlbumDateLabelFromKey(key),
      subLabel: getAlbumDateSubLabelFromKey(key),
      sections,
      total:
        photos.length +
        (hasUnopenedOtherDelivery ? 1 : 0) +
        (hasUndeliverableOtherDelivery ? 1 : 0),
      hasUnopenedOtherDelivery,
      hasUndeliverableOtherDelivery,
    };
  });
}

function readOpenedEveningDeliveryBoxPhotos(): BoxPreviewPhoto[] {
  autoOpenExpiredEveningDeliveries();
  const store = readEveningDeliveryStore();

  return Object.values(store)
    .filter((day) => Boolean(day.deliveredPhoto && day.openedAt))
    .filter((day) => !isExchangePhotoLocallyBlocked(day.deliveredPhoto!))
    .map((day) => {
      const deliveredPhoto = day.deliveredPhoto!;
      const deliveredAt = day.deliveredAt ?? deliveredPhoto.deliveredAt;

      if (deliveredPhoto.src.startsWith("data:image/")) {
        return {
          ...deliveredPhoto,
          thumbnailSrc: deliveredPhoto.src,
          displaySrc: deliveredPhoto.src,
          originalSrc: deliveredPhoto.src,
          deliveredAt,
        };
      }

      return {
        ...deliveredPhoto,
        deliveredAt,
      };
    })
    .filter((photo) => isUsableStoredPhotoSrc(photo.src));
}

function readOnboardingDeliveredBoxPhotos(): BoxPreviewPhoto[] {
  const progress = readOnboardingProgress();
  const deliveredPhoto = progress?.deliveredPhoto;

  if (
    !deliveredPhoto ||
    !progress.isDeliveredPhotoKept ||
    isExchangePhotoLocallyBlocked(deliveredPhoto)
  ) {
    return [];
  }

  const deliveredAt = deliveredPhoto.deliveredAt ?? progress.updatedAt;

  if (deliveredPhoto.src.startsWith("data:image/")) {
    return [
      {
        ...deliveredPhoto,
        thumbnailSrc: deliveredPhoto.src,
        displaySrc: deliveredPhoto.src,
        originalSrc: deliveredPhoto.src,
        deliveredAt,
      },
    ].filter((photo) => isUsableStoredPhotoSrc(photo.src));
  }

  return [
    {
      ...deliveredPhoto,
      deliveredAt,
    },
  ].filter((photo) => isUsableStoredPhotoSrc(photo.src));
}

function readUndeliverableEveningDeliveryDateKeys() {
  autoOpenExpiredEveningDeliveries();
  const store = readEveningDeliveryStore();
  const keys = new Set<string>();

  for (const day of Object.values(store)) {
    if (
      day.openedAt &&
      (!day.deliveredPhoto || isExchangePhotoLocallyBlocked(day.deliveredPhoto))
    ) {
      keys.add(day.dateKey);
    }
  }

  return keys;
}

function readUnopenedEveningDeliveryDateKeys() {
  autoOpenExpiredEveningDeliveries();
  const store = readEveningDeliveryStore();
  const keys = new Set<string>();

  for (const day of Object.values(store)) {
    if (day.deliveredPhoto && !day.openedAt) {
      keys.add(day.dateKey);
    }
  }

  return keys;
}

function mergeBoxPreviewPhotos(
  primaryPhotos: BoxPreviewPhoto[],
  replacementPhotos: BoxPreviewPhoto[],
) {
  const photos: Array<BoxPreviewPhoto | null> = [];
  const indexByIdentity = new Map<string, number>();
  const primaryIndexByContentIdentity = new Map<string, number>();
  const primaryIndexes = new Set<number>();

  for (const [source, photo] of [
    ...primaryPhotos.map((photo) => ["primary", photo] as const),
    ...replacementPhotos.map((photo) => ["replacement", photo] as const),
  ]) {
    const matchingIndexes = new Set(
      getBoxPhotoIdentityKeys(photo)
        .map((key) => indexByIdentity.get(key))
        .filter((index): index is number => index !== undefined),
    );

    if (source === "replacement") {
      for (const key of getPhotoContentIdentityKeys(photo)) {
        const matchingIndex = primaryIndexByContentIdentity.get(key);
        if (matchingIndex !== undefined) {
          matchingIndexes.add(matchingIndex);
        }
      }
    }

    if (matchingIndexes.size === 0) {
      const nextIndex = photos.length;
      photos.push(photo);
      registerBoxPhotoIdentities(indexByIdentity, photo, nextIndex);
      if (source === "primary") {
        primaryIndexes.add(nextIndex);
        registerBoxPhotoContentIdentities(
          primaryIndexByContentIdentity,
          photo,
          nextIndex,
        );
      }
      continue;
    }

    const [primaryIndex, ...duplicateIndexes] = [...matchingIndexes];
    let mergedPhoto = photos[primaryIndex] ?? photo;

    for (const duplicateIndex of duplicateIndexes) {
      const duplicatePhoto = photos[duplicateIndex];
      if (!duplicatePhoto) {
        continue;
      }

      mergedPhoto = mergeBoxPhotoVersions(mergedPhoto, duplicatePhoto);
      registerBoxPhotoIdentities(
        indexByIdentity,
        duplicatePhoto,
        primaryIndex,
      );
      photos[duplicateIndex] = null;
    }

    mergedPhoto = mergeBoxPhotoVersions(mergedPhoto, photo);
    photos[primaryIndex] = mergedPhoto;
    registerBoxPhotoIdentities(indexByIdentity, mergedPhoto, primaryIndex);
    if (primaryIndexes.has(primaryIndex)) {
      registerBoxPhotoContentIdentities(
        primaryIndexByContentIdentity,
        mergedPhoto,
        primaryIndex,
      );
    }
  }

  return photos
    .filter((photo): photo is BoxPreviewPhoto => Boolean(photo))
    .sort((a, b) => getBoxPhotoTimestamp(b) - getBoxPhotoTimestamp(a));
}

function getBoxPhotoIdentityKeys(photo: BoxPreviewPhoto) {
  const storagePaths = [
    photo.src,
    photo.thumbnailSrc,
    photo.displaySrc,
    photo.originalSrc,
  ]
    .map((src) => (src ? getStoragePhotoPath(src) : null))
    .filter((path): path is string => Boolean(path));

  return [
    `id:${photo.id}`,
    photo.sourcePhotoId ? `source:${photo.sourcePhotoId}` : "",
    ...storagePaths.map((path) => `storage:${path}`),
  ].filter(Boolean);
}

function registerBoxPhotoIdentities(
  indexByIdentity: Map<string, number>,
  photo: BoxPreviewPhoto,
  index: number,
) {
  for (const key of getBoxPhotoIdentityKeys(photo)) {
    indexByIdentity.set(key, index);
  }
}

function registerBoxPhotoContentIdentities(
  indexByIdentity: Map<string, number>,
  photo: BoxPreviewPhoto,
  index: number,
) {
  for (const key of getPhotoContentIdentityKeys(photo)) {
    indexByIdentity.set(key, index);
  }
}

function mergeBoxPhotoVersions(
  existing: BoxPreviewPhoto,
  incoming: BoxPreviewPhoto,
) {
  const preferred =
    getBoxPhotoTimestamp(incoming) >= getBoxPhotoTimestamp(existing)
      ? incoming
      : existing;
  const fallback = preferred === incoming ? existing : incoming;

  return {
    ...fallback,
    ...preferred,
    sourcePhotoId: preferred.sourcePhotoId ?? fallback.sourcePhotoId,
    thumbnailSrc: preferred.thumbnailSrc ?? fallback.thumbnailSrc,
    displaySrc: preferred.displaySrc ?? fallback.displaySrc,
    originalSrc: preferred.originalSrc ?? fallback.originalSrc,
    offlineSrc: preferred.offlineSrc ?? fallback.offlineSrc,
    deliveredAt: Math.max(
      existing.deliveredAt ?? 0,
      incoming.deliveredAt ?? 0,
    ) || undefined,
  };
}

function createEmptyTodayAlbumGroup(): AlbumDayGroup {
  const key = getJstDateKey(Date.now());

  return {
    key,
    label: "今日",
    subLabel: getAlbumDateSubLabelFromKey(key),
    sections: [],
    total: 0,
  };
}

function shouldShowOtherDeliverySlot(
  groupKey: string,
  firstEveningDeliveryTargetDateKey: string | null,
) {
  if (!firstEveningDeliveryTargetDateKey) {
    return false;
  }

  return groupKey >= firstEveningDeliveryTargetDateKey;
}

function shouldResolveOtherDeliverySlot(
  groupKey: string,
  firstEveningDeliveryTargetDateKey: string | null,
  now = Date.now(),
) {
  if (!shouldShowOtherDeliverySlot(groupKey, firstEveningDeliveryTargetDateKey)) {
    return false;
  }

  const todayKey = getJstDateKey(now);

  if (groupKey === todayKey && now < getJstDeliveryTime(todayKey)) {
    return false;
  }

  return true;
}

function filterBoxPhotosByDate(
  photos: BoxPreviewPhoto[],
  dateKey: string | null,
) {
  if (!dateKey) {
    return photos;
  }

  return photos.filter((photo) => getLocalDateKey(getBoxPhotoTimestamp(photo)) === dateKey);
}

function getCollectionPhotoTimestamp(photo: CollectionPhoto) {
  if (photo.createdAt) {
    const timestamp = new Date(photo.createdAt).getTime();

    if (!Number.isNaN(timestamp)) {
      return timestamp;
    }
  }

  return parseTimestampFromId(photo.id) ?? Date.now();
}

function getBoxPhotoTimestamp(photo: BoxPreviewPhoto) {
  return photo.deliveredAt ?? photo.createdAt ?? parseTimestampFromId(photo.id) ?? Date.now();
}

function getPhotoThumbnailSrc(photo: PhotoSourceSet) {
  return resolvePhotoSrc(photo, "list");
}

function getPhotoTransformBaseSrc(photo: PhotoSourceSet) {
  // Transformed signed URLs should shrink a larger display/original asset, not
  // upscale the saved 512px thumbnail asset.
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

function writeBackDeliveredPhotoDataUrl(photo: BoxPreviewPhoto, dataUrl: string) {
  updateKeptExchangePhotoDataUrl(
    { id: photo.id, sourcePhotoId: photo.sourcePhotoId },
    dataUrl,
  );
}

function isUsableStoredPhotoSrc(src: string | null | undefined): src is string {
  return typeof src === "string" && isUsablePhotoSrc(src);
}

function getLocalDateKey(timestamp: number) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getAlbumDateLabelFromKey(key: string) {
  const todayKey = getLocalDateKey(Date.now());
  const yesterdayKey = getLocalDateKey(Date.now() - 24 * 60 * 60 * 1000);

  if (key === todayKey) {
    return "今日";
  }

  if (key === yesterdayKey) {
    return "きのう";
  }

  const [, month, day] = key.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

function getAlbumDateSubLabelFromKey(_key: string) {
  return "";
}

function parseTimestampFromId(id: string | undefined) {
  if (!id) {
    return null;
  }

  const match = id.match(/(?:^|[-:])(\d{13})(?:[-:]|$)/);

  if (!match) {
    return null;
  }

  const timestamp = Number(match[1]);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getStoredCollectionPhotoCreatedAt(photo: StoredCollectionPhotoEntry) {
  if (photo.createdAt) {
    const timestamp = new Date(photo.createdAt).getTime();

    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp).toISOString();
    }
  }

  const parsedTimestamp = parseTimestampFromId(photo.id);
  return parsedTimestamp ? new Date(parsedTimestamp).toISOString() : null;
}

function buildStoredCollectionPhotos(
  collectionPhotos: Record<string, StoredCollectionPhotoEntry[]>,
) {
  const photos: CollectionPhoto[] = [];

  COLLECTION_GROUPS.forEach((group) => {
    group.slots.forEach((slot) => {
      const slug = getCollectionPhotoSlug(slot);
      const slotPhotos = collectionPhotos[slug] ?? [];

      slotPhotos.forEach((photo, index) => {
        photos.push({
          id: photo.id,
          slotId: slot.id,
          src: photo.src,
          thumbnailSrc: photo.thumbnailSrc,
          displaySrc: photo.displaySrc,
          originalSrc: photo.originalSrc,
          width: photo.width,
          height: photo.height,
          storageSlug: slug,
          localIndex: index,
          createdAt: photo.createdAt,
        });
      });
    });
  });

  return photos.reverse();
}

function buildCollectionShareFeed(
  photos: CollectionPhoto[],
  catName: string,
  suggestionSlot: CollectionSlot | null,
): CollectionShareFeedItem[] {
  const items: CollectionShareFeedItem[] = photos.slice(0, 12).map((photo) => ({
    id: `mine-${photo.id}`,
    itemType: "photo",
    ownerScope: "self",
    slot: getCollectionSlotById(photo.slotId),
    src: photo.src,
    ownerName: catName,
    badge: "自分",
    sourcePhotoId: photo.id,
  }));

  if (suggestionSlot) {
    items.push({
      id: `suggestion-${getCollectionPhotoSlug(suggestionSlot)}`,
      itemType: "suggestion",
      ownerScope: "system",
      slot: suggestionSlot,
      iconPath: suggestionSlot.iconPath,
      badge: "とる候補",
      description: "次にとる候補",
    });
  }

  return items;
}

function buildNextCollectionTargets(
  photosBySlot: Map<string, CollectionPhoto[]>,
  dailyTargetSlotId: string | null,
) {
  const slots = COLLECTION_GROUPS.flatMap((group) => group.slots);
  const uncollectedSlots = slots.filter(
    (slot) =>
      slot.id !== dailyTargetSlotId && (photosBySlot.get(slot.id)?.length ?? 0) === 0,
  );

  return (uncollectedSlots.length > 0 ? uncollectedSlots : slots)
    .filter((slot) => slot.id !== dailyTargetSlotId)
    .slice(0, 4);
}

function normalizeCollectionStoreForLedger(
  store: Record<
    string,
    Record<
      string,
      StoredCollectionPhotoEntry[] | StoredCollectionPhotoEntry | string[] | string
    >
  >,
): DurableCollectionPhotoStore {
  return Object.fromEntries(
    Object.entries(store).map(([catId, slots]) => [
      catId,
      Object.fromEntries(
        Object.entries(slots).map(([slug, photos]) => [
          slug,
          normalizeStoredPhotoList(photos, catId, slug),
        ]),
      ),
    ]),
  );
}

function readCollectionPhotos(catId: string): Record<string, StoredCollectionPhotoEntry[]> {
  try {
    const localStore = readCachedJson<Record<
      string,
      Record<string, StoredCollectionPhotoEntry[] | StoredCollectionPhotoEntry | string[] | string>
    >>(STORAGE_KEYS.collectionPhotos) ?? {};
    const all = mergeCollectionPhotoStores(
      normalizeCollectionStoreForLedger(localStore),
      readCachedCollectionPhotoLedger(),
    );

    if (Object.keys(all).length === 0) {
      return {};
    }
    const catPhotos = all[catId] ?? {};
    const photosForDisplay =
      countStoredPhotos(catPhotos) > 0 ? catPhotos : mergeAllCollectionPhotos(all);

    return Object.fromEntries(
      Object.entries(photosForDisplay)
        .filter(([slug]) => !isReservedCollectionSlotSlug(slug))
        .map(([slug, value]) => [
          slug,
          normalizeStoredPhotoList(value, catId, slug),
        ]),
    );
  } catch {
    return {};
  }
}

async function addCollectionPhoto(
  catId: string,
  slug: string,
  photoInput: Pick<
    StoredCollectionPhotoEntry,
    "src" | "thumbnailSrc" | "displaySrc" | "originalSrc" | "width" | "height"
  >,
) {
  if (isReservedCollectionSlotSlug(slug)) {
    return null;
  }

  const photo: StoredCollectionPhotoEntry = {
    id: createCollectionPhotoId(catId, slug),
    ...photoInput,
    createdAt: new Date().toISOString(),
  };

  let wasSavedDurably = false;
  try {
    await upsertCollectionPhotoHistory(catId, slug, photo);
    wasSavedDurably = true;
  } catch {
    // The compact local cache remains available when IndexedDB is unavailable.
  }

  try {
    const all =
      readCachedJson<Record<
        string,
        Record<string, StoredCollectionPhotoEntry[] | StoredCollectionPhotoEntry | string[] | string>
      >>(STORAGE_KEYS.collectionPhotos) ?? {};

    if (!all[catId]) {
      all[catId] = {};
    }

    all[catId][slug] = [...normalizeStoredPhotoList(all[catId][slug], catId, slug), photo];
    writeCachedJson(STORAGE_KEYS.collectionPhotos, all);
    return photo;
  } catch {
    return wasSavedDurably ? photo : null;
  }
}

function normalizeStoredPhotoList(
  value:
    | StoredCollectionPhotoEntry[]
    | StoredCollectionPhotoEntry
    | string[]
    | string
    | undefined,
  catId = "cat",
  slug = "photo",
) {
  if (typeof value === "string") {
    return [{ id: `${catId}:${slug}:0`, src: value }];
  }

  const values = Array.isArray(value) ? value : value ? [value] : [];

  return values
    .map((photo, index): StoredCollectionPhotoEntry | null => {
      if (typeof photo === "string") {
        return photo ? { id: `${catId}:${slug}:${index}`, src: photo } : null;
      }

      if (photo && typeof photo.src === "string" && photo.src) {
        const parsedCreatedAt = getStoredCollectionPhotoCreatedAt(photo);

        return completePhotoSourceSet({
          id: photo.id || `${catId}:${slug}:${index}`,
          src: photo.src,
          ...(isUsableStoredPhotoSrc(photo.thumbnailSrc)
            ? { thumbnailSrc: photo.thumbnailSrc }
            : {}),
          ...(isUsableStoredPhotoSrc(photo.displaySrc)
            ? { displaySrc: photo.displaySrc }
            : {}),
          ...(isUsableStoredPhotoSrc(photo.originalSrc)
            ? { originalSrc: photo.originalSrc }
            : {}),
          ...(isValidPhotoDimension(photo.width) ? { width: photo.width } : {}),
          ...(isValidPhotoDimension(photo.height) ? { height: photo.height } : {}),
          ...(parsedCreatedAt ? { createdAt: parsedCreatedAt } : {}),
        });
      }

      return null;
    })
    .filter((photo): photo is StoredCollectionPhotoEntry => Boolean(photo));
}

function countStoredPhotos(
  photosBySlug: Record<
    string,
    StoredCollectionPhotoEntry[] | StoredCollectionPhotoEntry | string[] | string
  >,
) {
  return Object.entries(photosBySlug).reduce(
    (count, [slug, value]) =>
      isReservedCollectionSlotSlug(slug)
        ? count
        : count + normalizeStoredPhotoList(value, "cat", slug).length,
    0,
  );
}

function mergeAllCollectionPhotos(
  allPhotos: Record<
    string,
    Record<string, StoredCollectionPhotoEntry[] | StoredCollectionPhotoEntry | string[] | string>
  >,
) {
  const merged: Record<string, StoredCollectionPhotoEntry[]> = {};

  for (const [catId, photosBySlug] of Object.entries(allPhotos)) {
    for (const [slug, value] of Object.entries(photosBySlug)) {
      if (isReservedCollectionSlotSlug(slug)) {
        continue;
      }

      merged[slug] = [
        ...(merged[slug] ?? []),
        ...normalizeStoredPhotoList(value, catId, slug),
      ];
    }
  }

  return merged;
}

function createCollectionPhotoId(catId: string, slug: string) {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${catId}:${slug}:${random}`;
}

async function createStoredCollectionPhotoVariantSet({
  file,
  pathSegments,
  fileName,
}: {
  file: File;
  pathSegments: string[];
  fileName: string;
}): Promise<
  Pick<
    StoredCollectionPhotoEntry,
    "src" | "thumbnailSrc" | "displaySrc" | "originalSrc" | "width" | "height"
  >
> {
  const [thumbnailDataUrl, displayDataUrl, dimensions] = await Promise.all([
    resizeAndEncode(file, 480, 0.72, "image/webp"),
    resizeAndEncode(file, 1600, 0.84, "image/webp"),
    readImageFileDimensions(file),
  ]);
  const localDisplaySrc =
    displayDataUrl.length <= 1_900_000
      ? displayDataUrl
      : await resizeAndEncode(file, 900, 0.76, "image/webp");
  const storedDisplaySrc = await storeAccountPhotoDataUrl({
    dataUrl: displayDataUrl,
    pathSegments: [...pathSegments, "display"],
    fileName,
  });
  const canStoreVariants = isStoragePhotoReference(storedDisplaySrc);
  const thumbnailSrc = canStoreVariants
    ? await storeAccountPhotoDataUrl({
        dataUrl: thumbnailDataUrl,
        pathSegments: [...pathSegments, "thumbnail"],
        fileName,
      })
    : null;

  return {
    src: canStoreVariants ? storedDisplaySrc : localDisplaySrc,
    ...(canStoreVariants ? { displaySrc: storedDisplaySrc } : {}),
    ...(thumbnailSrc && isStoragePhotoReference(thumbnailSrc)
      ? { thumbnailSrc }
      : {}),
    width: dimensions.width,
    height: dimensions.height,
  };
}

function isValidPhotoDimension(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isStoragePhotoReference(src: string | null | undefined) {
  return Boolean(src?.startsWith("storage:") || src?.startsWith("storage://"));
}

function resizeAndEncode(
  file: File,
  maxSize = 800,
  quality = 0.85,
  mimeType = "image/jpeg",
): Promise<string> {
  assertSupportedImageFile(file);

  return resizeImageFileToDataUrl(file, maxSize, quality, mimeType).catch(
    () => "",
  );
}

function getCollectionGroupLabel(groupId: CollectionGroupId) {
  return groupId === "pose" ? "しぐさ" : "いる場所";
}

const COLLECTION_SLOT_LABELS: Record<string, string> = {
  "belly-up": "へそ天",
  loaf: "ちょこん寝",
  stretch: "のびー",
  "face-down-sleep": "ごめん寝",
  "curled-up": "まるまり",
  liquid: "液体化",
  sitting: "おすわり",
  "tail-up": "しっぽピーン",
  "weird-sleep": "変な寝相",
  "hidden-paws": "おててないない",
  "in-box": "もぐりこみ",
  "by-window": "窓辺",
  sunbathing: "ひなたぼっこ",
  "in-futon": "布団入り",
  "high-place": "高いところ",
  "waiting-food": "ごはん待ち",
  "welcome-home": "お出迎え",
  "blanket-kneading": "毛布ふみふみ",
};

function getCollectionSlotLabel(slot: CollectionSlot) {
  return COLLECTION_SLOT_LABELS[slot.id] ?? slot.label;
}

function getCollectionPhotoSlug(slot: CollectionSlot) {
  return getCollectionSlotPhotoSlug(slot);
}

function getCollectionGroupIdForSlot(slot: CollectionSlot): CollectionGroupId | null {
  return (
    COLLECTION_GROUPS.find((group) =>
      group.slots.some((groupSlot) => groupSlot.id === slot.id),
    )?.id ?? null
  );
}

function getCollectionSlotBySlug(slug: string) {
  return (
    COLLECTION_GROUPS.flatMap((group) => group.slots).find(
      (slot) => getCollectionPhotoSlug(slot) === slug,
    ) ?? null
  );
}

function getCollectionSlotById(slotId: string) {
  return (
    COLLECTION_GROUPS.flatMap((group) => group.slots).find(
      (slot) => slot.id === slotId,
    ) ?? null
  );
}

function getFileSizeBucket(size: number) {
  if (size < 500_000) return "under_500kb";
  if (size < 2_000_000) return "500kb_2mb";
  if (size < 5_000_000) return "2mb_5mb";
  return "over_5mb";
}

function buildCollectionProgress(
  groups: CollectionGroup[],
  photosBySlot: Map<string, CollectionPhoto[]>,
) {
  const byGroup = groups.reduce(
    (acc, group) => {
      const collected = group.slots.filter(
        (slot) => (photosBySlot.get(slot.id)?.length ?? 0) > 0,
      ).length;

      acc[group.id] = {
        collected,
        total: group.slots.length,
      };

      return acc;
    },
    {
      pose: { collected: 0, total: 0 },
      scene: { collected: 0, total: 0 },
    } as Record<CollectionGroupId, { collected: number; total: number }>,
  );

  return {
    total: {
      collected: byGroup.pose.collected + byGroup.scene.collected,
      total: byGroup.pose.total + byGroup.scene.total,
    },
    pose: byGroup.pose,
    scene: byGroup.scene,
  };
}

function getProgressPercent(collected: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round((collected / total) * 100)));
}

const styles = {
  page: {
    position: "relative",
    minHeight: "100svh",
    background: "var(--app-paper-background)",
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
    color: COLLECTION_TEXT,
    overflowX: "hidden",
    overflowY: "auto",
    WebkitOverflowScrolling: "touch",
  },
  ambientBackground: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 0,
    background: "var(--app-paper-background)",
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
  },
  ambientHighlight: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 0,
    pointerEvents: "none" as const,
    background:
      "linear-gradient(115deg, color-mix(in srgb, var(--paper) 16%, transparent) 0%, transparent 42%, color-mix(in srgb, var(--ink-soft) 5%, transparent) 100%)",
  },
  backgroundVeil: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 1,
    pointerEvents: "none" as const,
    background:
      "linear-gradient(to bottom, color-mix(in srgb, var(--paper) 6%, transparent) 0%, transparent 48%, color-mix(in srgb, var(--ink-soft) 5%, transparent) 100%)",
  },
  container: {
    position: "relative",
    zIndex: 2,
    width: "min(100%, 480px)",
    margin: "0 auto",
    padding:
      "calc(18px + env(safe-area-inset-top)) 24px calc(var(--bottom-nav-height) + var(--bottom-nav-bottom-offset) + 96px + env(safe-area-inset-bottom))",
  },
  header: {
    marginBottom: "24px",
    paddingTop: "2px",
  },
  pageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    marginBottom: "0",
    position: "relative",
  },
  pageTitle: {
    margin: 0,
    color: COLLECTION_TEXT_STRONG,
    fontFamily: "var(--font-ui)",
    fontSize: "18px",
    lineHeight: 1.24,
    fontWeight: 500,
    letterSpacing: "0.04em",
  },
  viewTabs: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "6px",
    ...COLLECTION_SURFACE_SOFT,
    borderRadius: "var(--radius-full)",
    padding: "5px",
  },
  viewTab: {
    minHeight: "34px",
    border: "none",
    borderRadius: "var(--radius-full)",
    background: "transparent",
    color: COLLECTION_MUTED,
    font: "inherit",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1,
    cursor: "pointer",
  },
  viewTabActive: {
    background: "rgba(255,255,255,0.92)",
    color: "#2a2a28",
    boxShadow: shadow.soft,
  },
  boxOverview: {
    display: "grid",
    gap: "18px",
  },
  mainichiBoard: {
    display: "grid",
    gap: "12px",
  },
  mainichiBoardHeader: {
    display: "grid",
    gap: "14px",
    padding: "18px 4px 2px",
    boxSizing: "border-box",
  },
  mainichiMonthSelectButton: {
    justifySelf: "start",
    display: "inline-grid",
    gridTemplateColumns: "auto auto",
    alignItems: "center",
    gap: "8px",
    minHeight: "44px",
    border: "1px solid color-mix(in srgb, var(--line) 46%, transparent)",
    borderRadius: "var(--radius-full)",
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--paper-card) 30%, transparent), color-mix(in srgb, var(--paper-warm) 12%, transparent))",
    color: COLLECTION_TEXT,
    boxShadow:
      "0 1px 0 color-mix(in srgb, white 34%, transparent) inset, 0 8px 18px -19px rgba(71,55,34,0.34)",
    padding: "0 11px 0 13px",
    font: "inherit",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  mainichiMonthSelectLabel: {
    fontFamily: "var(--font-display)",
    fontSize: "22px",
    fontWeight: 400,
    lineHeight: 1.1,
    letterSpacing: "0.06em",
  },
  mainichiMonthSelectChevron: {
    color: "color-mix(in srgb, var(--seal) 74%, var(--ink-soft) 26%)",
    fontFamily: "var(--font-ui)",
    fontSize: "16px",
    fontWeight: 500,
    lineHeight: 1,
    transform: "translateY(-1px)",
  },
  mainichiBoardTabs: {
    position: "relative",
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    alignItems: "end",
    minHeight: "44px",
    borderBottom: "1px solid color-mix(in srgb, var(--line) 70%, transparent)",
  },
  mainichiBoardTab: {
    position: "relative",
    minHeight: "44px",
    border: "none",
    borderRadius: 0,
    background: "transparent",
    color: COLLECTION_MUTED,
    padding: "0 8px 12px",
    fontFamily: "var(--font-ui)",
    fontSize: "15px",
    fontWeight: 500,
    lineHeight: 1.2,
    letterSpacing: "0.04em",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  mainichiBoardTabActive: {
    color: "color-mix(in srgb, var(--seal) 86%, var(--ink) 14%)",
    boxShadow: "0 2px 0 color-mix(in srgb, var(--seal) 86%, var(--ink) 14%)",
  },
  mainichiMonthList: {
    display: "grid",
    gap: "0",
  },
  mainichiMonthBoard: {
    display: "grid",
    gap: "0",
    padding: "8px 8px calc(28px + env(safe-area-inset-bottom))",
    overflow: "visible",
    borderRadius: 0,
    border: "none",
    background: "transparent",
    boxShadow: "none",
  },
  mainichiMonthPickerSheet: {
    zIndex: 120,
    paddingBottom: "calc(30px + env(safe-area-inset-bottom))",
  },
  mainichiMonthBundleAppSheet: {
    zIndex: 120,
    paddingBottom: "calc(30px + env(safe-area-inset-bottom))",
  },
  mainichiMonthBundleDays: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    columnGap: "10px",
    rowGap: "10px",
    padding: "4px 2px 28px",
    alignItems: "start",
      contentVisibility: "auto",
    containIntrinsicSize: "720px",
},
  mainichiMonthBundleDay: {
    display: "grid",
    justifyItems: "center",
    alignItems: "end",
    gap: "6px",
    minHeight: "116px",
    border: "0",
    borderRadius: "12px",
    background: "transparent",
    color: COLLECTION_TEXT,
    boxShadow: "none",
    padding: "6px 4px 8px",
    font: "inherit",
    textAlign: "center",
    cursor: "pointer",
    position: "relative",
    overflow: "visible",
    transformOrigin: "50% 46%",
    WebkitTapHighlightColor: "transparent",
  },
  mainichiMonthBundleDayPhotos: {
    position: "relative",
    display: "block",
    width: "100%",
    height: "82px",
  },
  mainichiMonthBundleDayPhotoRoot: {
    position: "absolute",
    transformOrigin: "50% 50%",
  },
  mainichiMonthBundleDayPhoto: {
    width: "100%",
    height: "auto",
    display: "block",
    border: "2px solid color-mix(in srgb, var(--paper-card) 78%, var(--paper-warm) 22%)",
    borderRadius: "10px",
    background: "color-mix(in srgb, var(--paper-card) 86%, var(--paper-warm) 14%)",
    boxShadow:
      "0 0 0 0.5px rgba(74,56,34,0.10) inset, 0 12px 22px -15px rgba(76,62,42,0.46)",
  },
  mainichiMonthBundleDayText: {
    display: "inline-grid",
    justifyItems: "center",
    gap: "3px",
    minWidth: 0,
    position: "relative",
    zIndex: 4,
    minHeight: "20px",
    padding: "3px 9px 1px",
    borderRadius: "999px",
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--paper-card) 42%, transparent), color-mix(in srgb, var(--paper-warm) 18%, transparent))",
    boxShadow: "0 8px 18px -17px rgba(70,50,34,0.44)",
  },
  mainichiMonthBundleDayLabel: {
    minWidth: 0,
    color: "color-mix(in srgb, var(--ink) 72%, var(--seal) 28%)",
    fontFamily: "var(--font-display)",
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1,
    letterSpacing: "0.02em",
  },
  mainichiMonthBundleDayStackDots: {
    display: "flex",
    justifyContent: "center",
    gap: "2px",
  },
  mainichiMonthBundleDayStackDot: {
    width: "3px",
    height: "3px",
    borderRadius: "999px",
    background: "color-mix(in srgb, var(--seal) 52%, var(--paper-card) 48%)",
  },
  mainichiMonthBundleDaySeal: {
    position: "absolute",
    display: "none",
    right: "12px",
    bottom: "11px",
    width: "4px",
    height: "4px",
    borderRadius: "999px",
    background: "color-mix(in srgb, var(--seal) 58%, var(--paper-card) 42%)",
    boxShadow:
      "0 1px 0 color-mix(in srgb, white 38%, transparent) inset, 0 4px 8px -6px rgba(70,50,36,0.44)",
  },
  mainichiMonthPicker: {
    display: "grid",
    gap: "22px",
    padding: "4px 0 8px",
  },
  mainichiMonthPickerYear: {
    display: "grid",
    gap: "9px",
  },
  mainichiMonthPickerYearButton: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto auto",
    alignItems: "center",
    gap: "10px",
    minHeight: "46px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "color-mix(in srgb, var(--line) 52%, transparent)",
    borderRadius: "var(--radius-full)",
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--paper-card) 28%, transparent), color-mix(in srgb, var(--paper-warm) 12%, transparent))",
    color: COLLECTION_TEXT,
    padding: "0 14px 0 18px",
    font: "inherit",
    textAlign: "left",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  mainichiMonthPickerYearButtonOpen: {
    borderColor: "color-mix(in srgb, var(--seal) 24%, var(--line) 76%)",
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--seal) 7%, transparent), color-mix(in srgb, var(--paper-card) 24%, transparent))",
  },
  mainichiMonthPickerYearTitle: {
    minWidth: 0,
    color: COLLECTION_TEXT,
    fontFamily: "var(--font-ui)",
    fontSize: "18px",
    fontWeight: 500,
    lineHeight: 1.3,
    letterSpacing: "0.02em",
  },
  mainichiMonthPickerYearMeta: {
    color: "color-mix(in srgb, var(--seal) 66%, var(--ink-soft) 34%)",
    fontFamily: "var(--font-ui)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1,
    letterSpacing: "0.04em",
  },
  mainichiMonthPickerYearChevron: {
    width: "18px",
    color: COLLECTION_MUTED,
    fontFamily: "var(--font-ui)",
    fontSize: "16px",
    fontWeight: 500,
    lineHeight: 1,
    textAlign: "right",
  },
  mainichiMonthPickerRows: {
    display: "grid",
    border: "1px solid color-mix(in srgb, var(--line) 76%, transparent)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    background: "color-mix(in srgb, var(--paper-card) 42%, transparent)",
  },
  mainichiMonthPickerRow: {
    display: "grid",
    gridTemplateColumns: "58px minmax(0, 1fr) auto auto",
    alignItems: "center",
    gap: "12px",
    minHeight: "62px",
    border: "none",
    borderBottom: "1px solid color-mix(in srgb, var(--line) 64%, transparent)",
    background: "transparent",
    color: COLLECTION_TEXT,
    padding: "0 14px",
    font: "inherit",
    textAlign: "left",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  mainichiMonthPickerRowActive: {
    background:
      "linear-gradient(90deg, color-mix(in srgb, var(--seal) 9%, transparent), color-mix(in srgb, var(--paper-card) 18%, transparent))",
    boxShadow: "3px 0 0 color-mix(in srgb, var(--seal) 82%, var(--ink) 18%) inset",
  },
  mainichiMonthBundleMark: {
    position: "relative",
    width: "48px",
    height: "28px",
    display: "block",
  },
  mainichiMonthBundleSheet: {
    position: "absolute",
    inset: "6px 2px 2px 2px",
    borderRadius: "5px",
    border: "1px solid color-mix(in srgb, var(--line) 82%, transparent)",
    background:
      "linear-gradient(145deg, color-mix(in srgb, var(--paper-card) 90%, white 10%), color-mix(in srgb, var(--paper-warm) 72%, white 28%))",
    boxShadow: "0 6px 10px -9px rgba(72,58,38,0.36)",
  },
  mainichiMonthBundleSheetBack: {
    inset: "3px 8px 7px 0",
    opacity: 0.48,
    transform: "rotate(-4deg)",
  },
  mainichiMonthBundleSheetMiddle: {
    inset: "5px 4px 4px 4px",
    opacity: 0.72,
    transform: "rotate(3deg)",
  },
  mainichiMonthBundleSheetFront: {
    inset: "8px 0 1px 8px",
    opacity: 0.96,
    transform: "rotate(-1deg)",
  },
  mainichiMonthBundleSeal: {
    position: "absolute",
    right: "7px",
    bottom: "4px",
    width: "7px",
    height: "7px",
    borderRadius: "999px",
    background: "color-mix(in srgb, var(--seal) 72%, var(--paper-card) 28%)",
    boxShadow:
      "0 1px 0 color-mix(in srgb, white 36%, transparent) inset, 0 3px 7px -5px rgba(70,50,36,0.42)",
  },
  mainichiMonthPickerRowLabel: {
    minWidth: 0,
    color: COLLECTION_TEXT,
    fontFamily: "var(--font-ui)",
    fontSize: "20px",
    fontWeight: 500,
    lineHeight: 1.2,
    letterSpacing: "0.02em",
  },
  mainichiMonthPickerRowCount: {
    color: "color-mix(in srgb, var(--seal) 76%, var(--ink-soft) 24%)",
    fontFamily: "var(--font-ui)",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1,
    letterSpacing: "0.04em",
  },
  mainichiMonthPickerRowChevron: {
    width: "20px",
    color: COLLECTION_MUTED,
    fontFamily: "var(--font-ui)",
    fontSize: "22px",
    fontWeight: 500,
    lineHeight: 1,
    textAlign: "right",
  },
  mainichiBoardPhotos: {
    position: "relative",
    overflow: "visible",
    margin: "0 auto",
    width: "100%",
    maxWidth: "430px",
      contentVisibility: "auto",
    containIntrinsicSize: "840px",
},
  mainichiBundleBase: {
    position: "absolute",
    zIndex: 0,
    left: "50%",
    bottom: "var(--mainichi-bundle-bottom, 42px)",
    width: "var(--mainichi-bundle-width, 82%)",
    height: "var(--mainichi-bundle-height, 76px)",
    transform: "translateX(-50%) rotate(-0.7deg)",
    opacity: "var(--mainichi-bundle-opacity, 0.56)",
    pointerEvents: "none",
    filter:
      "drop-shadow(0 12px 18px rgba(65, 52, 35, var(--mainichi-bundle-shadow-alpha, 0.1)))",
  },
  mainichiMonthOpenButton: {
    border: "none",
    position: "absolute",
    zIndex: 24,
    left: "50%",
    bottom: "16px",
    width: "58px",
    height: "38px",
    borderRadius: "999px",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--paper-card) 68%, white 32%), color-mix(in srgb, var(--paper-warm) 58%, transparent))",
    boxShadow:
      "0 1px 0 color-mix(in srgb, white 48%, transparent) inset, 0 10px 20px -16px rgba(73,55,36,0.42), 0 0 0 1px color-mix(in srgb, var(--line) 44%, transparent)",
    padding: 0,
    cursor: "pointer",
    transform: "translateX(-50%)",
    outlineOffset: "7px",
    WebkitTapHighlightColor: "transparent",
  },
  mainichiMonthOpenGlyph: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    width: "100%",
    height: "100%",
  },
  mainichiMonthOpenGlyphDot: {
    width: "5px",
    height: "5px",
    borderRadius: "999px",
    background: "color-mix(in srgb, var(--seal) 58%, var(--ink-soft) 42%)",
    opacity: 0.62,
    boxShadow: "0 1px 0 color-mix(in srgb, white 32%, transparent) inset",
  },
  mainichiBundleLayer: {
    position: "absolute",
    left: 0,
    right: 0,
    borderRadius: "12px",
    border: "1px solid color-mix(in srgb, var(--line) 52%, transparent)",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--paper-card) 34%, transparent), color-mix(in srgb, var(--paper-warm) 28%, transparent))",
    boxShadow:
      "0 1px 0 color-mix(in srgb, white 28%, transparent) inset",
  },
  mainichiBundleLayerBack: {
    bottom: "calc(var(--mainichi-bundle-edge, 8px) * 2.15)",
    height: "calc(var(--mainichi-bundle-edge, 8px) * 2.5 + 10px)",
    transform: "translateX(-4px) rotate(-1.1deg)",
    opacity: 0.34,
  },
  mainichiBundleLayerMiddle: {
    bottom: "calc(var(--mainichi-bundle-edge, 8px) * 1.05)",
    height: "calc(var(--mainichi-bundle-edge, 8px) * 2.9 + 12px)",
    transform: "translateX(3px) rotate(0.75deg)",
    opacity: 0.48,
  },
  mainichiBundleLayerFront: {
    bottom: 0,
    height: "calc(var(--mainichi-bundle-edge, 8px) * 3.2 + 13px)",
    transform: "rotate(-0.25deg)",
    opacity: 0.62,
  },
  mainichiBundlePocket: {
    position: "absolute",
    left: "9%",
    right: "9%",
    bottom: "2px",
    height: "28%",
    borderRadius: "0 0 13px 13px",
    border: "1px solid color-mix(in srgb, var(--line) 45%, transparent)",
    borderTop: "none",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--paper-card) 4%, transparent), color-mix(in srgb, var(--paper-warm) 34%, transparent))",
    opacity: "var(--mainichi-bundle-pocket-opacity, 0.46)",
  },
  mainichiBoardPhotoButton: {
    position: "absolute",
    display: "grid",
    gap: "6px",
    minWidth: 0,
    maxWidth: "198px",
    border: "none",
    background: "transparent",
    color: COLLECTION_TEXT,
    font: "inherit",
    textAlign: "left",
    padding: "9px 4px 9px",
    cursor: "pointer",
    transformOrigin: "50% 22%",
    transition:
      "transform var(--dur-instant) var(--ease-settle), filter var(--dur-instant) var(--ease-gentle)",
  },
  mainichiDayBrowseAction: {
    display: "flex",
    justifyContent: "center",
    padding: "2px 0 10px",
  },
  mainichiNaturalPhotoButton: {
    position: "absolute",
    border: "none",
    padding: 0,
    background: "transparent",
    cursor: "pointer",
    transformOrigin: "50% 50%",
    WebkitTapHighlightColor: "transparent",
  },
  mainichiNaturalFrame: {
    width: "100%",
    height: "100%",
    ...tayoriPhotoFrameStyles.frame,
  },
  mainichiNaturalPhotoImage: {
    width: "100%",
    height: "100%",
    ...tayoriPhotoFrameStyles.image,
  },
  mainichiBoardTape: {
    position: "absolute",
    zIndex: 2,
    left: "var(--mainichi-tape-left, 50%)",
    top: "0",
    width: "76px",
    height: "22px",
    backgroundImage: "url('/images/ui/washi-tape-cream.webp')",
    backgroundSize: "100% 100%",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    boxShadow:
      "0 5px 10px -8px rgba(84,65,42,0.28)",
    filter: "saturate(0.82) brightness(1.04)",
    opacity: 0.82,
    transform: "translate(-50%, -15%) rotate(var(--mainichi-tape-rotation, -3deg))",
    pointerEvents: "none",
  },
  mainichiBoardPhotoTileRoot: {
    width: "100%",
  },
  mainichiBoardPhotoTile: {
    width: "100%",
    height: "auto",
    display: "block",
    border: "var(--mainichi-photo-border, 3px) solid color-mix(in srgb, var(--paper-card) 76%, var(--paper-warm) 24%)",
    borderRadius: "var(--mainichi-photo-radius, 10px)",
    background: "color-mix(in srgb, var(--paper-card) 84%, var(--paper-warm) 16%)",
    boxShadow:
      "0 0 0 0.5px rgba(74,56,34,0.12) inset, 0 1px 3px rgba(86,70,45,0.10), 0 12px 22px -17px rgba(76,62,42,0.36)",
  },
  mainichiBoardPhotoCatBadge: {
    position: "absolute",
    zIndex: 3,
    left: "50%",
    bottom: "12px",
    transform: "translateX(-50%)",
    justifySelf: "center",
    minHeight: "20px",
    padding: "2px 9px",
    borderRadius: "var(--radius-full)",
    background: "color-mix(in srgb, var(--paper-card) 84%, transparent)",
    color: "var(--ink-soft)",
    boxShadow:
      "0 1px 0 color-mix(in srgb, var(--paper-card) 74%, transparent) inset, 0 4px 10px -8px rgba(62,48,32,0.28)",
    fontFamily: "var(--font-ui)",
    fontSize: "10px",
    fontWeight: 500,
    lineHeight: 1.45,
  },
  mainichiBoardEmpty: {
    minHeight: "clamp(300px, 44svh, 390px)",
    display: "grid",
    justifyItems: "center",
    alignContent: "start",
    gap: "15px",
    padding: "68px 22px 0",
    boxSizing: "border-box",
    color: COLLECTION_TEXT,
    fontFamily: "var(--font-display)",
    textAlign: "center",
  },
  mainichiBoardEmptyStack: {
    position: "relative",
    width: "132px",
    height: "88px",
    display: "block",
    marginBottom: "2px",
  },
  mainichiBoardEmptySheet: {
    position: "absolute",
    display: "grid",
    placeItems: "center",
    borderRadius: "10px",
    border: "1px solid color-mix(in srgb, var(--line) 80%, transparent)",
    background:
      "linear-gradient(145deg, color-mix(in srgb, var(--paper-card) 90%, white 10%), color-mix(in srgb, var(--paper-warm) 72%, white 28%))",
    boxShadow:
      "0 1px 0 color-mix(in srgb, white 42%, transparent) inset, 0 14px 24px -22px rgba(72,58,38,0.42)",
  },
  mainichiBoardEmptySheetBack: {
    inset: "16px 34px 18px 8px",
    opacity: 0.42,
    transform: "rotate(-6deg)",
  },
  mainichiBoardEmptySheetMiddle: {
    inset: "11px 21px 12px 20px",
    opacity: 0.68,
    transform: "rotate(4deg)",
  },
  mainichiBoardEmptySheetFront: {
    inset: "8px 11px 7px 30px",
    color: "color-mix(in srgb, var(--seal) 70%, var(--ink-soft) 30%)",
    opacity: 0.94,
    transform: "rotate(-1deg)",
  },
  mainichiBoardEmptyTitle: {
    margin: 0,
    color: COLLECTION_TEXT,
    fontSize: "16px",
    fontWeight: 400,
    lineHeight: 1.45,
    letterSpacing: "0.08em",
  },
  mainichiBoardEmptyButton: {
    marginTop: "0",
    minHeight: "42px",
    padding: "0 18px",
  },
  mainichiDayBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 68,
    background: "color-mix(in srgb, var(--ink) 14%, transparent)",
    backdropFilter: "blur(2px)",
    WebkitBackdropFilter: "blur(2px)",
    transition: "opacity 220ms ease",
  },
  mainichiDayBackdropClosing: {
    opacity: 0,
  },
  mainichiDaySheet: {
    position: "fixed",
    left: "max(16px, calc((100vw - 480px) / 2 + 24px))",
    right: "max(16px, calc((100vw - 480px) / 2 + 24px))",
    bottom: "calc(var(--bottom-nav-height) + var(--bottom-nav-bottom-offset) + 20px + env(safe-area-inset-bottom))",
    zIndex: 69,
    maxHeight: "min(72svh, 560px)",
    overflowY: "auto",
    display: "grid",
    gap: "20px",
    padding: "22px 20px 24px",
    borderRadius: "var(--radius-2xl)",
    background: "color-mix(in srgb, var(--paper-card) 94%, transparent)",
    boxShadow: "var(--shadow-e2)",
    transformOrigin: "50% 50%",
  },
  mainichiDayHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
  },
  mainichiDayKicker: {
    margin: "0 0 4px",
    color: COLLECTION_MUTED,
    fontFamily: "var(--font-display)",
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.4,
  },
  mainichiDayTitle: {
    margin: 0,
    color: COLLECTION_TEXT_STRONG,
    fontFamily: "var(--font-ui)",
    fontSize: "18px",
    fontWeight: 500,
    lineHeight: 1.4,
    fontVariantNumeric: "tabular-nums",
  },
  mainichiDayTimeline: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(126px, 148px))",
    justifyContent: "center",
    alignItems: "start",
    gap: "14px",
    padding: "2px 0 4px",
  },
  mainichiDayPhotoRow: {
    display: "grid",
    justifyItems: "center",
    gap: "9px",
    minHeight: "0",
    padding: "9px 9px 11px",
    border: "1px solid color-mix(in srgb, var(--line) 68%, transparent)",
    borderRadius: "16px",
    background:
      "linear-gradient(145deg, color-mix(in srgb, var(--paper-card) 90%, white 10%), color-mix(in srgb, var(--paper-warm) 70%, white 30%))",
    color: COLLECTION_TEXT,
    boxShadow:
      "0 1px 0 color-mix(in srgb, white 38%, transparent) inset, 0 14px 24px -22px rgba(72,58,38,0.42)",
    font: "inherit",
    textAlign: "center",
    cursor: "pointer",
    transformOrigin: "50% 42%",
    transition:
      "transform var(--dur-instant) var(--ease-settle), box-shadow var(--dur-instant) var(--ease-gentle)",
    WebkitTapHighlightColor: "transparent",
  },
  mainichiDayPhotoTileRoot: {
    width: "118px",
  },
  mainichiDayPhotoTile: {
    width: "118px",
    height: "118px",
  },
  mainichiDayPhotoText: {
    display: "grid",
    justifyItems: "center",
    gap: "3px",
  },
  mainichiDayPhotoSide: {
    color: COLLECTION_TEXT_STRONG,
    fontFamily: "var(--font-display)",
    fontSize: "14px",
    fontWeight: 400,
    lineHeight: 1.3,
    letterSpacing: "0.08em",
  },
  mainichiDayPhotoCat: {
    color: COLLECTION_MUTED,
    fontFamily: "var(--font-ui)",
    fontSize: "11px",
    fontWeight: 400,
    lineHeight: 1.3,
  },
  mainichiDayEmpty: {
    minHeight: "144px",
    fontFamily: "var(--font-display)",
  },
  mainichiViewerOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 82,
    display: "grid",
    gridTemplateRows: "auto minmax(0, 1fr) auto",
    gap: "20px",
    padding:
      "calc(18px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom))",
    background: "var(--app-paper-background)",
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
  },
  mainichiViewerChrome: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
  },
  mainichiViewerMeta: {
    display: "flex",
    minWidth: 0,
    alignItems: "baseline",
    gap: "10px",
    color: COLLECTION_TEXT,
  },
  mainichiViewerDate: {
    fontFamily: "var(--font-ui)",
    fontSize: "16px",
    fontWeight: 500,
    lineHeight: 1.3,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
  },
  mainichiViewerSide: {
    color: COLLECTION_MUTED,
    fontFamily: "var(--font-display)",
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.3,
    letterSpacing: "0.08em",
    whiteSpace: "nowrap",
  },
  mainichiViewerCount: {
    minWidth: 0,
    overflow: "hidden",
    color: COLLECTION_MUTED,
    fontFamily: "var(--font-ui)",
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.3,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  mainichiViewerStage: {
    position: "relative",
    display: "grid",
    justifyItems: "center",
    alignItems: "center",
    gap: "14px",
  },
  mainichiViewerFrame: {
    width: "min(100%, 560px)",
    maxWidth: "100%",
    maxHeight: "calc(100svh - 180px - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
    justifySelf: "center",
    alignSelf: "center",
    border: "1px solid color-mix(in srgb, var(--line) 72%, transparent)",
    borderRadius: "var(--radius-xl)",
    background: "color-mix(in srgb, var(--paper-card) 72%, transparent)",
    boxShadow: "0 18px 42px -30px rgba(72,58,38,0.5)",
  },
  mainichiViewerImage: {
    width: "100%",
    height: "100%",
    borderRadius: "calc(var(--radius-xl) - 2px)",
  },
  mainichiViewerPager: {
    display: "inline-grid",
    gridTemplateColumns: "36px auto 36px",
    alignItems: "center",
    gap: "4px",
    minHeight: "36px",
    padding: "2px 6px",
    border: "1px solid color-mix(in srgb, var(--line) 58%, transparent)",
    borderRadius: "999px",
    background: "color-mix(in srgb, var(--paper-card) 66%, transparent)",
    boxShadow: "0 10px 24px -22px rgba(72,58,38,0.34)",
  },
  mainichiViewerPagerButton: {
    width: "36px",
    minWidth: "36px",
    height: "36px",
    minHeight: "36px",
  },
  mainichiViewerPagerCount: {
    minWidth: "42px",
    color: COLLECTION_MUTED,
    fontFamily: "var(--font-ui)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1,
    textAlign: "center",
    fontVariantNumeric: "tabular-nums",
  },
  mainichiViewerActions: {
    width: "min(100%, 420px)",
    justifySelf: "center",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: "10px",
    alignItems: "center",
  },
  todayAlbumCard: {
    display: "grid",
    gap: "14px",
    padding: "0 0 22px",
    borderBottom: "0.5px solid rgba(79,73,63,0.16)",
  },
  todayAlbumHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
  },
  albumKicker: {
    margin: "4px 0 0",
    color: COLLECTION_MUTED,
    fontFamily: "var(--font-display)",
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.45,
    letterSpacing: "0.08em",
  },
  todayAlbumTitle: {
    margin: 0,
    color: COLLECTION_TEXT_STRONG,
    fontFamily: "var(--font-display)",
    fontSize: "19px",
    fontWeight: 500,
    lineHeight: 1.25,
    letterSpacing: "0.1em",
  },
  todayAlbumEmpty: {
    display: "grid",
    gridTemplateColumns: "48px minmax(0, 1fr)",
    alignItems: "center",
    gap: "13px",
    minHeight: "64px",
  },
  todayAlbumEmptyMark: {
    width: "44px",
    height: "44px",
    borderRadius: "var(--radius-md)",
    border: "1px solid rgba(79,73,63,0.075)",
    background: "rgba(255,253,248,0.28)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.26)",
  },
  todayAlbumEmptyLine: {
    width: "18px",
    height: "1px",
    borderRadius: "var(--radius-full)",
    background: "rgba(79,73,63,0.16)",
  },
  todayAlbumEmptyText: {
    margin: 0,
    color: COLLECTION_MUTED,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.45,
  },
  todayAlbumEmptyState: {
    minHeight: "64px",
    justifyItems: "start",
    textAlign: "left",
    alignContent: "center",
    padding: "12px 14px",
    borderRadius: radius.lg,
    background: "rgba(255,253,248,0.34)",
    border: "1px solid rgba(120,108,94,0.08)",
  },
  albumSection: {
    display: "grid",
    gap: "12px",
    padding: "0 0 22px",
    borderBottom: "0.5px solid rgba(79,73,63,0.16)",
  },
  albumSectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "14px",
  },
  albumSectionTitle: {
    margin: 0,
    color: COLLECTION_TEXT_STRONG,
    fontFamily: "var(--font-display)",
    fontSize: "15px",
    fontWeight: 500,
    lineHeight: 1.3,
    letterSpacing: "0.08em",
  },
  albumSectionAction: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    border: "none",
    background: "transparent",
    color: COLLECTION_MUTED,
    font: "inherit",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1,
    cursor: "pointer",
    padding: "4px 0",
  },
  recentDayList: {
    display: "grid",
    gap: "0",
  },
  recentDayCard: {
    display: "grid",
    gap: "11px",
    padding: "14px 0 16px",
    borderBottom: "0.5px solid rgba(79,73,63,0.12)",
  },
  recentDayHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
  },
  recentDayTitle: {
    margin: 0,
    color: COLLECTION_TEXT_STRONG,
    fontFamily: "var(--font-display)",
    fontSize: "15px",
    fontWeight: 500,
    lineHeight: 1.32,
    letterSpacing: "0.06em",
  },
  recentDaySub: {
    margin: "3px 0 0",
    color: COLLECTION_MUTED,
    fontFamily: "var(--font-display)",
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.35,
    letterSpacing: "0.08em",
  },
  daySectionList: {
    display: "grid",
    gap: "12px",
  },
  daySectionListCompact: {
    display: "grid",
    gap: "9px",
  },
  dailyPair: {
    display: "grid",
    gap: "14px",
  },
  dailyPairCompact: {
    display: "grid",
    gap: "14px",
  },
  dailyPairMain: {
    display: "grid",
    justifyItems: "center",
    gap: "16px",
  },
  dailyPairMainSingle: {
    justifyItems: "center",
  },
  dailyPairSealedEnvelope: {
    position: "relative",
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: radius.xl,
    display: "grid",
    placeItems: "center",
    boxSizing: "border-box",
    background: "var(--paper-card)",
    border: "6px solid rgba(255,253,248,0.74)",
    boxShadow: shadow.soft,
    overflow: "hidden",
  },
  dailyPairSealedEnvelopeFlap: {
    position: "absolute",
    inset: "22% 18% auto",
    height: "35%",
    border: "1px solid var(--line)",
    borderRadius: radius.md,
    background: "color-mix(in srgb, var(--paper) 58%, transparent)",
    clipPath: "polygon(0 0,100% 0,50% 100%)",
  },
  dailyPairSealedEnvelopeSeal: {
    position: "absolute",
    left: "50%",
    top: "52%",
    width: "14px",
    height: "14px",
    borderRadius: "var(--radius-full)",
    background: "var(--seal)",
    transform: "translate(-50%, -50%)",
  },
  ownPhotoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
  },
  ownPhotoGridItem: {
    border: "none",
    background: "transparent",
    padding: 0,
    cursor: "pointer",
  },
  ownPhotoGridItemStatic: {
    cursor: "default",
  },
  ownPhotoGridTileRoot: {
    width: "100%",
  },
  ownPhotoGridTile: {
    width: "100%",
    height: "auto",
    aspectRatio: "1 / 1",
    display: "block",
  },
  daySectionRow: {
    display: "grid",
    gap: "8px",
    width: "100%",
    border: "none",
    background: "transparent",
    color: COLLECTION_TEXT,
    font: "inherit",
    textAlign: "left",
    padding: 0,
  },
  daySectionButton: {
    cursor: "pointer",
  },
  dayPhotoStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "8px",
    alignItems: "center",
  },
  dayPhotoThumb: {
    width: "100%",
    minWidth: 0,
  },
  dayPhotoThumbTile: {
    width: "100%",
    height: "auto",
    aspectRatio: "1 / 1",
  },
  boxSummaryCard: {
    position: "relative",
    display: "grid",
    gap: "16px",
    width: "100%",
    padding: "22px 0 28px",
    borderBottom: "0.5px solid rgba(79,73,63,0.16)",
    font: "inherit",
    textAlign: "left",
  },
  boxSummaryButton: {
    borderTop: "none",
    borderRight: "none",
    borderLeft: "none",
    background: "transparent",
    cursor: "pointer",
  },
  boxSummaryStatic: {
    borderTop: "none",
    borderRight: "none",
    borderLeft: "none",
    background: "transparent",
    cursor: "default",
  },
  boxSummaryHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "14px",
  },
  boxSummaryTitle: {
    margin: 0,
    color: COLLECTION_MUTED,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.2,
    letterSpacing: 0,
  },
  boxSummaryMeta: {
    display: "inline-flex",
    alignItems: "center",
    gap: "12px",
    color: "#777166",
  },
  boxSummaryText: {
    margin: "4px 0 0",
    color: COLLECTION_MUTED,
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.35,
  },
  boxSummaryCount: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "flex-end",
    minWidth: "36px",
    color: "#777166",
    fontSize: "12px",
    fontWeight: 500,
    fontVariantNumeric: "tabular-nums",
  },
  boxSummaryArrow: {
    color: "#8a8378",
    fontSize: "18px",
    fontWeight: 400,
    lineHeight: 1,
  },
  boxPhotoStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "10px",
    alignItems: "center",
    minHeight: "104px",
  },
  boxPhotoThumb: {
    aspectRatio: "1 / 1",
    minWidth: 0,
    borderRadius: radius.lg,
    overflow: "hidden",
    background: color.surfaceSoft,
    border: "4px solid rgba(255,253,248,0.76)",
    boxShadow: shadow.soft,
  },
  boxPhotoImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  boxSummaryEmpty: {
    display: "grid",
    gridTemplateColumns: "72px minmax(0, 1fr)",
    alignItems: "center",
    gap: "12px",
    minHeight: "64px",
    color: COLLECTION_MUTED,
  },
  boxSummaryEmptyLine: {
    height: "1px",
    borderRadius: "var(--radius-full)",
    background: "rgba(79,73,63,0.10)",
  },
  boxSummaryEmptyText: {
    color: "#8a8378",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.35,
  },
  title: {
    margin: 0,
    color: COLLECTION_TEXT_STRONG,
    fontSize: "24px",
    lineHeight: 1.25,
    fontWeight: 500,
    letterSpacing: 0,
  },
  progressBlock: {
    display: "grid",
    gap: "8px",
    marginBottom: "12px",
  },
  progressMain: {
    display: "flex",
    alignItems: "baseline",
    gap: "7px",
    margin: 0,
    color: COLLECTION_TEXT_STRONG,
  },
  progressNumber: {
    fontSize: "18px",
    fontWeight: 500,
    lineHeight: 1,
  },
  progressSlash: {
    color: COLLECTION_MUTED,
    fontSize: "15px",
    fontWeight: 500,
    margin: "0 2px",
  },
  progressUnit: {
    color: COLLECTION_MUTED,
    fontSize: "12px",
    fontWeight: 500,
  },
  progressSub: {
    margin: "-3px 0 0",
    color: COLLECTION_MUTED,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.4,
  },
  progressTrack: {
    position: "relative",
    width: "100%",
    height: "4px",
    borderRadius: "var(--radius-full)",
    background: "rgba(255,255,255,0.16)",
    overflow: "hidden",
  },
  progressFill: {
    position: "absolute",
    inset: "0 auto 0 0",
    borderRadius: "var(--radius-full)",
    background: "rgba(255,255,255,0.86)",
  },
  tabs: {
    display: "flex",
    gap: "6px",
    overflowX: "auto",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    paddingTop: "2px",
    paddingBottom: "1px",
  },
  tab: {
    flex: "0 0 auto",
    minWidth: "82px",
    minHeight: "34px",
    border: "0.5px solid rgba(255,255,255,0.16)",
    borderRadius: "var(--radius-full)",
    background: "rgba(255,255,255,0.10)",
    color: COLLECTION_TEXT,
    font: "inherit",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1,
    cursor: "pointer",
  },
  activeTab: {
    border: "0.5px solid rgba(255,255,255,0.42)",
    background: "rgba(255,255,255,0.92)",
    color: "#2a2a28",
  },
  dailyTargetCard: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "48px minmax(0, 1fr) auto",
    alignItems: "center",
    gap: "11px",
    color: COLLECTION_TEXT,
    font: "inherit",
    textAlign: "left",
    cursor: "pointer",
  },
  dailyTargetThumb: {
    width: "48px",
    height: "48px",
    borderRadius: "var(--radius-md)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.11)",
    border: "0.5px solid rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  dailyTargetIcon: {
    width: "38px",
    height: "38px",
    objectFit: "contain",
    opacity: 0.62,
    filter: "grayscale(1) brightness(1.8) contrast(0.88)",
  },
  dailyTargetText: {
    minWidth: 0,
    display: "grid",
    gap: "4px",
  },
  collectView: {
    display: "grid",
    gap: "12px",
  },
  nextTargetBlock: {
    display: "grid",
  },
  sectionHeadingRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "10px",
  },
  sectionHeading: {
    margin: 0,
    color: COLLECTION_TEXT,
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.3,
  },
  nextTargetRail: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "8px",
  },
  nextTargetCard: {
    display: "grid",
    justifyItems: "center",
    gap: "6px",
    minHeight: "96px",
    color: COLLECTION_TEXT,
    font: "inherit",
    cursor: "pointer",
  },
  nextTargetIcon: {
    width: "42px",
    height: "42px",
    objectFit: "contain",
    opacity: 0.54,
    mixBlendMode: "multiply",
    filter: "saturate(0.7) contrast(0.9)",
  },
  nextTargetName: {
    color: COLLECTION_MUTED,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.25,
    textAlign: "center",
  },
  dailyTargetLabel: {
    color: COLLECTION_MUTED,
    fontSize: "12px",
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  dailyTargetName: {
    minWidth: 0,
    color: COLLECTION_TEXT_STRONG,
    fontSize: "15px",
    fontWeight: 500,
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  dailyTargetHint: {
    color: COLLECTION_MUTED,
    fontSize: "12px",
    fontWeight: 500,
    whiteSpace: "nowrap",
  },
  collectionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
      contentVisibility: "auto",
    containIntrinsicSize: "720px",
},
  shareView: {
    display: "grid",
    gap: "12px",
  },
  shareHeaderCard: {
    display: "grid",
  },
  shareHeaderKicker: {
    margin: "0 0 4px",
    color: COLLECTION_MUTED,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.2,
  },
  shareHeaderTitle: {
    margin: "0 0 10px",
    color: COLLECTION_TEXT_STRONG,
    fontSize: "15px",
    fontWeight: 500,
    lineHeight: 1.35,
  },
  shareSourceRow: {
    display: "flex",
    gap: "6px",
    overflowX: "auto",
    scrollbarWidth: "none",
  },
  shareSourceChipActive: {
    flex: "0 0 auto",
    borderRadius: "var(--radius-full)",
    background: "rgba(255,255,255,0.88)",
    color: "#2a2a28",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1,
    padding: "6px 9px",
  },
  shareSourceChip: {
    flex: "0 0 auto",
    borderRadius: "var(--radius-full)",
    border: "0.5px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    color: COLLECTION_MUTED,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1,
    padding: "6px 9px",
  },
  shareFeed: {
    display: "grid",
    gap: "10px",
  },
  shareFeedCard: {
    position: "relative",
    minHeight: "132px",
    overflow: "hidden",
    border: "0.5px solid rgba(255,255,255,0.16)",
    borderRadius: "var(--radius-lg)",
    background: "rgba(255,255,255,0.08)",
    boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
    padding: 0,
    font: "inherit",
    cursor: "pointer",
    textAlign: "left",
  },
  shareFeedPhoto: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  shareSuggestionVisual: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.05))",
  },
  shareSuggestionIcon: {
    width: "68px",
    height: "68px",
    objectFit: "contain",
    opacity: 0.58,
    filter: "grayscale(1) brightness(1.9) contrast(0.9)",
  },
  shareFeedFade: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(90deg, rgba(0,0,0,0.54) 0%, rgba(0,0,0,0.22) 54%, rgba(0,0,0,0.06) 100%)",
  },
  shareFeedBadge: {
    position: "absolute",
    top: "12px",
    left: "12px",
    zIndex: 1,
    borderRadius: "var(--radius-full)",
    background: "rgba(255,255,255,0.84)",
    color: "#2a2a28",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1,
    padding: "4px 8px",
  },
  shareFeedMeta: {
    position: "absolute",
    left: "12px",
    right: "12px",
    bottom: "38px",
    color: "rgba(255,255,255,0.70)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.2,
    zIndex: 1,
  },
  shareFeedLabel: {
    position: "absolute",
    left: "12px",
    right: "12px",
    bottom: "12px",
    zIndex: 1,
    color: "#fff",
    fontSize: "15px",
    fontWeight: 500,
    lineHeight: 1.25,
    textAlign: "left",
    textShadow: "0 1px 8px rgba(0,0,0,0.26)",
  },
  shareEmptyCard: {
    textAlign: "center",
  },
  shareEmptyTitle: {
    margin: "0 0 6px",
    color: COLLECTION_TEXT_STRONG,
    fontSize: "15px",
    fontWeight: 500,
  },
  shareEmptyText: {
    margin: 0,
    color: COLLECTION_MUTED,
    fontSize: "13px",
    lineHeight: 1.55,
    fontWeight: 500,
  },
  collectionCard: {
    position: "relative",
    display: "block",
    aspectRatio: "1 / 1",
    ...COLLECTION_SURFACE_SOFT,
    borderRadius: radius.xl,
    border: "1px solid rgba(120,108,94,0.10)",
    boxShadow: shadow.card,
    overflow: "hidden",
    font: "inherit",
    cursor: "pointer",
    padding: 0,
    textAlign: "inherit",
  },
  emptyCollectionCard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    background: "rgba(255,253,248,0.42)",
    border: `1px solid ${color.border}`,
    boxShadow: shadow.none,
  },
  emptySlotContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    width: "100%",
    height: "100%",
    padding: "12px 8px",
  },
  emptyCardIcon: {
    width: "74px",
    height: "74px",
    objectFit: "contain",
    opacity: 0.44,
    mixBlendMode: "multiply",
    filter: "saturate(0.7) contrast(0.9)",
  },
  photoCard: {
    display: "flex",
    alignItems: "flex-end",
    padding: "11px",
    textAlign: "left",
  },
  cardPhoto: {
    position: "absolute",
    inset: 0,
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: "saturate(0.9) contrast(0.98) brightness(1.02)",
  },
  cardPhotoFade: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(35,34,31,0.02) 52%, rgba(35,34,31,0.34) 100%)",
  },
  photoCardText: {
    position: "relative",
    zIndex: 1,
    display: "grid",
    gap: "6px",
  },
  cardCountBadge: {
    position: "absolute",
    top: "10px",
    right: "10px",
    zIndex: 2,
    borderRadius: "var(--radius-full)",
    background: "rgba(255,253,248,0.82)",
    color: color.text,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1,
    padding: "2px 7px",
  },
  todayBadge: {
    position: "absolute",
    top: "10px",
    left: "10px",
    zIndex: 3,
    borderRadius: "var(--radius-full)",
    background: "rgba(255,255,255,0.9)",
    color: "#2f332f",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1,
    padding: "4px 8px",
    boxShadow: "0 3px 10px rgba(0,0,0,0.12)",
  },
  photoCardLabel: {
    margin: 0,
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.2,
    textShadow: "0 1px 8px rgba(0,0,0,0.24)",
  },
  photoCount: {
    display: "inline-flex",
    width: "fit-content",
    border: "1px solid rgba(255,255,255,0.58)",
    borderRadius: "var(--radius-full)",
    background: "rgba(255,255,255,0.72)",
    color: "#5c6259",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1,
    padding: "5px 8px",
    backdropFilter: "blur(7px)",
  },
  silhouetteWrap: {
    display: "grid",
    placeItems: "center",
    minHeight: 0,
    color: "#aaa69b",
  },
  silhouette: {
    width: "68px",
    height: "56px",
  },
  emptyCardFooter: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  emptySlotLabel: {
    margin: 0,
    color: COLLECTION_MUTED,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.3,
    textAlign: "center",
  },
  plusBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "25px",
    height: "25px",
    flex: "0 0 auto",
    border: "1px solid rgba(206, 203, 195, 0.84)",
    borderRadius: "var(--radius-full)",
    background: "rgba(255,255,255,0.76)",
    color: "#7b7c74",
    font: "inherit",
    fontSize: "18px",
    fontWeight: 500,
    lineHeight: 1,
    padding: 0,
    cursor: "pointer",
  },
  sheetPhotoArea: {
    margin: "10px 18px 2px",
  },
  photoScroll: {
    display: "flex",
    overflowX: "auto",
    scrollSnapType: "x mandatory",
    scrollbarWidth: "none",
    gap: "10px",
  },
  photoSlide: {
    position: "relative",
    flexShrink: 0,
    width: "100%",
    height: "min(62vh, 520px)",
    borderRadius: radius.card,
    overflow: "hidden",
    scrollSnapAlign: "start",
    background:
      "linear-gradient(180deg, rgba(255,253,248,0.92), rgba(246,239,228,0.64))",
    border: "6px solid rgba(255,253,248,0.78)",
    boxShadow: shadow.card,
  },
  photoImg: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    display: "block",
  },
  photoDots: {
    display: "flex",
    justifyContent: "center",
    gap: "5px",
    margin: "8px 0 0",
  },
  photoDot: {
    width: "5px",
    height: "5px",
    borderRadius: "var(--radius-full)",
    background: "rgba(120,108,94,0.24)",
    transition: "width 0.2s",
  },
  photoDotActive: {
    width: "14px",
    background: "rgba(83,72,55,0.58)",
  },
  photoEmpty: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    aspectRatio: "1",
    margin: "12px 16px",
    borderRadius: radius.card,
    background: "rgba(255,253,248,0.44)",
    border: `1px solid ${color.border}`,
    boxShadow: shadow.none,
  },
  photoEmptyText: {
    color: COLLECTION_MUTED,
    fontSize: "13px",
    fontWeight: 500,
  },
  sheetActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    padding: "12px 16px 0",
  },
  sheetActionButton: {
    minHeight: 42,
    padding: "0 12px",
    fontSize: "13px",
    fontWeight: 500,
  },
  boxDetailActions: {
    display: "grid",
    gap: "8px",
    padding: "12px 16px 0",
  },
  boxIconActionBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
  },
  boxPhotoStatusRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "2px 2px 8px",
  },
  boxPhotoStatusLabel: {
    color: COLLECTION_MUTED,
    fontSize: "12px",
    fontWeight: 500,
  },
  boxPhotoStatusValue: {
    color: COLLECTION_TEXT_STRONG,
    fontSize: "13px",
    fontWeight: 500,
  },
  boxDetailNote: {
    margin: "0 0 4px",
    color: COLLECTION_MUTED,
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.5,
  },
  completionBody: {
    display: "grid",
    justifyItems: "center",
    gap: "12px",
    padding: "18px 16px 4px",
  },
  completionIcon: {
    display: "grid",
    placeItems: "center",
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.12)",
    border: "0.5px solid rgba(255,255,255,0.18)",
    color: COLLECTION_TEXT_STRONG,
  },
  completionTitle: {
    margin: 0,
    color: COLLECTION_TEXT_STRONG,
    fontSize: "18px",
    fontWeight: 500,
    lineHeight: 1.35,
    textAlign: "center",
  },
  completionActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    width: "100%",
    paddingTop: "4px",
  },
  toast: {
    position: "fixed",
    left: "50%",
    top: "calc(18px + env(safe-area-inset-top))",
    zIndex: 80,
    transform: "translateX(-50%)",
    borderRadius: "var(--radius-full)",
    background: "rgba(255,255,255,0.92)",
    color: "#2a2a28",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1,
    padding: "10px 16px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  },
  emptyCard: {
    padding: "20px",
  },
  emptyTitle: {
    margin: "0 0 10px",
    color: COLLECTION_TEXT_STRONG,
    fontSize: "24px",
    lineHeight: 1.25,
    fontWeight: 500,
  },
  emptyText: {
    margin: "0 0 16px",
    color: COLLECTION_MUTED,
    fontSize: "13px",
    lineHeight: 1.65,
    fontWeight: 500,
  },
} satisfies Record<string, CSSProperties>;
