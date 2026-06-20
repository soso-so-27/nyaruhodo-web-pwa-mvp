"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, UIEvent } from "react";
import {
  getCollectionSlotPhotoSlug,
  getDailyCollectionTarget,
} from "../../lib/collection/dailyTarget";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import {
  deleteAccountCollectionPhoto,
  deleteAccountSleepingPhoto,
  hideAccountKeptExchangePhoto,
} from "../../lib/accountSync";
import {
  storeAccountPhotoDataUrl,
  storeAccountPhotoFile,
} from "../../lib/photoStorageClient";
import { getStoragePhotoPath, isUsablePhotoSrc } from "../../lib/photoStorage";
import {
  BOX_PHOTO_STORAGE_EVENT,
  deleteOwnSleepingPhoto,
  hideKeptExchangePhoto,
  isExchangePhotoLocallyBlocked,
  keepExchangePhoto,
  readKeptExchangePhotos,
  readOwnSleepingPhotos,
  updateKeptExchangePhotoDataUrl,
  updateOwnSleepingPhotoDelivery,
  type ExchangePhoto,
} from "../../lib/home/sleepingPhotos";
import {
  autoOpenExpiredEveningDeliveries,
  getFirstEveningDeliveryTargetDateKey,
  getJstDateKey,
  getJstDeliveryTime,
  readEveningDeliveryStore,
} from "../../lib/home/eveningDelivery";
import { backupOwnSleepingPhotoMoment } from "../../lib/home/sleepingPhotoBackup";
import { STORAGE_KEYS } from "../../lib/storage";
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
import { AppIcon } from "../ui/AppIcons";
import { AppSegmented } from "../ui/AppSegmented";
import { EmptyState } from "../ui/EmptyState";
import { PhotoTile, PhotoViewerFrame } from "../ui/PhotoTile";
import { StoredPhotoImage } from "../ui/StoredPhotoImage";
import { color, radius, shadow } from "../ui/designTokens";

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
const MAINICHI_SEEN_PHOTO_KEYS_STORAGE_KEY = "neteruneko_mainichi_seen_photo_keys";
const MAINICHI_PASTE_MOTION_CSS = `
@keyframes mainichiPasteSettle {
  0% {
    opacity: 0;
    transform: translateY(-28px) rotate(var(--mainichi-rotation)) scale(0.985);
    filter: drop-shadow(0 18px 22px rgba(120,110,90,0.16));
  }
  58% {
    opacity: 1;
    transform: translateY(5px) rotate(var(--mainichi-rotation)) scale(1.006);
    filter: drop-shadow(0 12px 16px rgba(120,110,90,0.11));
  }
  100% {
    opacity: 1;
    transform: translateY(0) rotate(var(--mainichi-rotation)) scale(1);
    filter: drop-shadow(0 0 0 rgba(120,110,90,0));
  }
}

@keyframes mainichiTapePress {
  0% {
    opacity: 0;
    transform: translate(-50%, -80%) rotate(-3deg) scaleX(0.84);
  }
  42% {
    opacity: 0.92;
    transform: translate(-50%, -20%) rotate(-3deg) scaleX(1.04);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -15%) rotate(-3deg) scaleX(1);
  }
}

[data-mainichi-paste="true"] {
  animation: mainichiPasteSettle 720ms cubic-bezier(0.22, 1, 0.36, 1) both;
  will-change: transform, filter, opacity;
}

[data-mainichi-paste-tape="true"] {
  animation: mainichiTapePress 540ms 180ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@media (prefers-reduced-motion: reduce) {
  [data-mainichi-paste="true"],
  [data-mainichi-paste-tape="true"] {
    animation: none !important;
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
  timestamp: number;
  side: MainichiBoardSide;
  catName?: string;
};

type MainichiBoardMonth = {
  key: string;
  label: string;
  photos: MainichiBoardPhoto[];
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
  src: string;
  thumbnailSrc?: string;
  displaySrc?: string;
  originalSrc?: string;
  timestamp: number;
  kind: BoxDetailKind;
  sideLabel: string;
  catName?: string;
  storageWriteback?: (dataUrl: string) => void;
  deliveredAt?: number;
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
  const [selectedMainichiPhoto, setSelectedMainichiPhoto] =
    useState<MainichiDayPhoto | null>(null);
  const [currentBoxPhotoIndex, setCurrentBoxPhotoIndex] = useState(0);
  const toastTimerRef = useRef<number | null>(null);
  const trackedViewCatIdRef = useRef<string | null>(null);
  const trackedDailyTargetRef = useRef<string | null>(null);

  useEffect(() => {
    const profiles = readCatProfiles();
    const savedActiveCatId = readActiveCatId();
    const activeProfile = getActiveCatProfile(profiles, savedActiveCatId);

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

    window.addEventListener(BOX_PHOTO_STORAGE_EVENT, refreshBoxes);
    window.addEventListener("storage", refreshBoxes);

    return () => {
      window.removeEventListener(BOX_PHOTO_STORAGE_EVENT, refreshBoxes);
      window.removeEventListener("storage", refreshBoxes);
    };
  }, []);

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
    () => readOwnSleepingPhotos(),
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
        openedEveningDeliveryPhotos,
        readKeptExchangePhotos(),
      ),
    [boxRefreshTick, hasLoaded, openedEveningDeliveryPhotos],
  );
  const awakeBoxPhotos = useMemo(
    () =>
      storedCollectionPhotos.map((photo) => ({
        id: photo.id,
        src: photo.src,
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
    setSelectedMainichiPhoto(photo);
    trackProductEvent(
      "collection_mainichi_photo_opened",
      {
        date_key: selectedMainichiDayKey,
        kind: photo.kind,
        photo_id: photo.id,
        source_photo_id: photo.sourcePhotoId ?? null,
      },
      { localCatId: activeCatId },
    );
  }

  function closeMainichiFullscreenPhoto() {
    setSelectedMainichiPhoto(null);
  }

  function handleKeepMainichiPhoto(photo: MainichiDayPhoto) {
    if (photo.kind !== "other") {
      return false;
    }

    const saved = keepExchangePhoto(createExchangePhotoFromDayPhoto(photo));

    if (saved) {
      setBoxRefreshTick((value) => value + 1);
      showToast("とっておきました");
    }

    trackProductEvent(
      "collection_mainichi_photo_keep_tapped",
      {
        photo_id: photo.id,
        source_photo_id: photo.sourcePhotoId ?? null,
        saved,
      },
      { localCatId: activeCatId },
    );

    return saved;
  }

  function handleBoxPhotoScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const index = Math.round(element.scrollLeft / element.offsetWidth);

    if (index !== currentBoxPhotoIndex) {
      setCurrentBoxPhotoIndex(index);
    }
  }

  function handleToggleSleepingPhotoDelivery(photo: BoxPreviewPhoto) {
    const nextShared = !photo.shared;

    const updatedPhoto = updateOwnSleepingPhotoDelivery(photo.id, nextShared);

    if (updatedPhoto) {
      void backupOwnSleepingPhotoMoment(updatedPhoto);
    }
    setBoxRefreshTick((value) => value + 1);
    showToast(nextShared ? "とどくようにしました" : "自分だけにしました");
    trackProductEvent(
      "collection_sleeping_photo_delivery_toggled",
      {
        photo_id: photo.id,
        shared: nextShared,
      },
      { localCatId: activeCatId },
    );
  }

  function handleDeleteSleepingPhoto(photo: BoxPreviewPhoto) {
    deleteOwnSleepingPhoto(photo.id);
    void deleteAccountSleepingPhoto(photo.id).catch(() => {
      // Local delete should still feel immediate; restore checks expose remote issues.
    });
    setBoxRefreshTick((value) => value + 1);
    setCurrentBoxPhotoIndex((current) =>
      Math.max(0, Math.min(current, sleepingBoxPhotos.length - 2)),
    );
    showToast("とったねがおから外しました");
    trackProductEvent(
      "collection_sleeping_photo_deleted",
      { photo_id: photo.id },
      { localCatId: activeCatId },
    );
  }

  function handleHideOtherPhoto(photo: BoxPreviewPhoto, reason: "hide" | "report") {
    hideKeptExchangePhoto(photo.id, reason);
    void hideAccountKeptExchangePhoto(photo.id, reason).catch(() => {
      // Local hide/report should stay instant even if the account sync retries later.
    });
    setBoxRefreshTick((value) => value + 1);
    setCurrentBoxPhotoIndex((current) =>
      Math.max(0, Math.min(current, otherBoxPhotos.length - 2)),
    );
    showToast(reason === "report" ? "通報して非表示にしました" : "アルバムから外しました");
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
    input.setAttribute("capture", "environment");

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

      const addedPhoto = addCollectionPhoto(activeCatId, slug, photoVariants);
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
      const raw = window.localStorage.getItem(STORAGE_KEYS.collectionPhotos);

      if (!raw) {
        return;
      }

      const all = JSON.parse(raw) as Record<
        string,
        Record<string, StoredCollectionPhotoEntry[] | StoredCollectionPhotoEntry | string[] | string>
      >;
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

      window.localStorage.setItem(STORAGE_KEYS.collectionPhotos, JSON.stringify(all));
      if (photoToDelete?.id) {
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
            <h1 style={styles.emptyTitle}>まいにち</h1>
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
            <h1 style={styles.emptyTitle}>まいにち</h1>
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
          onOpenMainichiDay={openMainichiDay}
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
      {selectedMainichiPhoto ? (
        <MainichiFullscreenPhoto
          photo={selectedMainichiPhoto}
          onClose={closeMainichiFullscreenPhoto}
          onKeep={handleKeepMainichiPhoto}
        />
      ) : null}
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
  onOpenMainichiDay,
}: {
  dayGroups: AlbumDayGroup[];
  firstEveningDeliveryTargetDateKey: string | null;
  catProfiles: CatProfile[];
  onOpenMainichiDay: (
    dateKey: string,
    source?: MainichiMorphSource | null,
  ) => void;
}) {
  const [activeBoardSide, setActiveBoardSide] =
    useState<MainichiBoardSide>("sent");

  return (
    <section style={styles.boxOverview} aria-label="まいにち">
      <MainichiPhotoBoard
        dayGroups={dayGroups}
        activeSide={activeBoardSide}
        onSideChange={setActiveBoardSide}
        firstEveningDeliveryTargetDateKey={firstEveningDeliveryTargetDateKey}
        catProfiles={catProfiles}
        onOpenDay={onOpenMainichiDay}
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
  onOpenDay,
}: {
  dayGroups: AlbumDayGroup[];
  activeSide: MainichiBoardSide;
  onSideChange: (side: MainichiBoardSide) => void;
  firstEveningDeliveryTargetDateKey: string | null;
  catProfiles: CatProfile[];
  onOpenDay: (dateKey: string, source?: MainichiMorphSource | null) => void;
}) {
  const months = useMemo(
    () =>
      buildMainichiBoardMonths(
        dayGroups,
        activeSide,
        firstEveningDeliveryTargetDateKey,
        catProfiles,
      ),
    [activeSide, catProfiles, dayGroups, firstEveningDeliveryTargetDateKey],
  );
  const prefersReducedMotion = usePrefersReducedMotion();
  const [pastingPhotoKey, setPastingPhotoKey] = useState<string | null>(null);

  useEffect(() => {
    const photos = months.flatMap((month) => month.photos);

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
  }, [months, prefersReducedMotion]);

  return (
    <section style={styles.mainichiBoard} data-testid="mainichi-photo-board">
      <style>{MAINICHI_PASTE_MOTION_CSS}</style>
      <AppSegmented<MainichiBoardSide>
        value={activeSide}
        onChange={onSideChange}
        ariaLabel="まいにちの面"
        columns={2}
        options={[
          { value: "sent", label: "おくった" },
          { value: "delivered", label: "とどいた" },
        ]}
        style={styles.mainichiBoardToggle}
      />
      {months.length > 0 ? (
        <div style={styles.mainichiMonthList}>
          {months.map((month) => (
            <MainichiMonthBoard
              key={`${activeSide}-${month.key}`}
              month={month}
              pastingPhotoKey={pastingPhotoKey}
              onOpenDay={onOpenDay}
            />
          ))}
        </div>
      ) : (
        <div data-testid="mainichi-board-empty">
          <EmptyState
            description="ねがおが、すこしずつ ふえる"
            style={styles.mainichiBoardEmpty}
          />
        </div>
      )}
    </section>
  );
}

function MainichiMonthBoard({
  month,
  pastingPhotoKey,
  onOpenDay,
}: {
  month: MainichiBoardMonth;
  pastingPhotoKey: string | null;
  onOpenDay: (dateKey: string, source?: MainichiMorphSource | null) => void;
}) {
  return (
    <AppCard
      as="section"
      variant="section"
      padding="md"
      style={styles.mainichiMonthBoard}
      data-testid="mainichi-month-board"
    >
      <h2 style={styles.mainichiMonthTitle}>{month.label}</h2>
      <div style={styles.mainichiBoardPhotos}>
        {month.photos.map((photo, index) => (
          <MainichiBoardPhotoCard
            key={photo.id}
            photo={photo}
            index={index}
            shouldPaste={getMainichiBoardPhotoKey(photo) === pastingPhotoKey}
            onOpenDay={onOpenDay}
          />
        ))}
      </div>
    </AppCard>
  );
}

function MainichiBoardPhotoCard({
  photo,
  index,
  shouldPaste,
  onOpenDay,
}: {
  photo: MainichiBoardPhoto;
  index: number;
  shouldPaste: boolean;
  onOpenDay: (dateKey: string, source?: MainichiMorphSource | null) => void;
}) {
  const testId =
    photo.side === "sent"
      ? "mainichi-board-photo-sent"
      : "mainichi-board-photo-delivered";

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();

    onOpenDay(photo.dateKey, {
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
    <button
      type="button"
      data-testid={testId}
      data-mainichi-paste={shouldPaste ? "true" : undefined}
      style={{
        ...styles.mainichiBoardPhotoButton,
        "--mainichi-rotation": getMainichiBoardRotation(index),
        transform: "rotate(var(--mainichi-rotation))",
      } as CSSProperties}
      onClick={handleClick}
      aria-label={photo.side === "sent" ? "おくった ねがおをひらく" : "とどいた ねがおをひらく"}
    >
      <span
        data-mainichi-paste-tape={shouldPaste ? "true" : undefined}
        style={styles.mainichiBoardTape}
        aria-hidden="true"
      />
      <PhotoTile
        src={photo.src}
        alt=""
        variant="tile"
        aspect="1 / 1"
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
      <span style={styles.mainichiBoardPhotoMeta}>
        <span style={styles.mainichiBoardPhotoDate}>{photo.dateLabel}</span>
        {photo.catName ? (
          <span style={styles.mainichiBoardPhotoCat}>{photo.catName}</span>
        ) : null}
      </span>
    </button>
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
  const panelRef = useRef<HTMLElement | null>(null);
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
        onClick={handleClose}
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
            onClick={handleClose}
          >
            ×
          </AppButton>
        </div>
        {photos.length > 0 ? (
          <div style={styles.mainichiDayTimeline}>
            {photos.map((photo) => (
              <button
                key={`${photo.kind}-${photo.id}`}
                type="button"
                style={styles.mainichiDayPhotoRow}
                onClick={() => onOpenPhoto(photo)}
                data-testid={
                  photo.kind === "sleeping"
                    ? "mainichi-day-photo-sent"
                    : "mainichi-day-photo-delivered"
                }
              >
                <PhotoTile
                  src={getPhotoThumbnailSrc(photo)}
                  alt=""
                  variant="tile"
                  aspect="1 / 1"
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
              </button>
            ))}
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
  onClose,
  onKeep,
}: {
  photo: MainichiDayPhoto;
  onClose: () => void;
  onKeep: (photo: MainichiDayPhoto) => boolean;
}) {
  const [saveState, setSaveState] = useState<"idle" | "saved">(() =>
    photo.kind === "other" && isMainichiPhotoKept(photo) ? "saved" : "idle",
  );

  function handleKeep() {
    if (photo.kind !== "other") {
      return;
    }

    if (saveState === "saved") {
      return;
    }

    if (onKeep(photo)) {
      setSaveState("saved");
    }
  }

  return (
    <div style={styles.mainichiViewerOverlay} data-testid="mainichi-photo-viewer">
      <div style={styles.mainichiViewerChrome}>
        <AppButton
          type="button"
          variant="ghost"
          size="icon"
          iconOnly
          aria-label="閉じる"
          onClick={onClose}
        >
          ×
        </AppButton>
      </div>
      <PhotoViewerFrame
        src={getPhotoDetailSrc(photo)}
        alt=""
        fit="contain"
        aspect="auto"
        style={styles.mainichiViewerFrame}
        imageStyle={styles.mainichiViewerImage}
        onStorageDataUrl={photo.storageWriteback}
      />
      {photo.kind === "other" ? (
        <AppButton
          type="button"
          variant="secondary"
          size="lg"
          fullWidth
          style={styles.mainichiViewerKeepButton}
          onClick={handleKeep}
        >
          {saveState === "saved" ? "とっておいた" : "とっておく"}
        </AppButton>
      ) : null}
    </div>
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
  const title = dayLabel ?? "まいにち";
  const currentPhoto =
    photos[Math.max(0, Math.min(currentPhotoIndex, photos.length - 1))] ?? null;
  const deliveryActionLabel = currentPhoto?.shared
    ? "自分だけにする"
    : "とどくようにする";

  return (
    <AppBottomSheet title={title} onClose={onClose} variant="paper">
      {photos.length > 0 ? (
        <div style={styles.sheetPhotoArea}>
          <div style={styles.photoScroll} onScroll={onPhotoScroll}>
            {photos.map((photo) => (
              <div key={photo.id} style={styles.photoSlide}>
                <StoredPhotoImage
                  src={getPhotoDetailSrc(photo)}
                  alt=""
                  style={styles.photoImg}
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
            {kind === "sleeping" ? "ねがおをとると、ここに並びます" : "とっておくと、ここに並びます"}
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
                aria-label="とったねがおから外す"
                title="とったねがおから外す"
                variant="danger"
                size="icon"
                iconOnly
                onClick={() => onDeleteSleepingPhoto(currentPhoto)}
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
                aria-label="アルバムから外す"
                title="アルバムから外す"
                variant="danger"
                size="icon"
                iconOnly
                onClick={() => onHideOtherPhoto(currentPhoto)}
              >
                <AppIcon name="trash" size={20} />
              </AppButton>
            </div>
          </div>
        )
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
    { key: "share", label: "とどいたねがお" },
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
          写真を入れる
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
          alt=""
          style={styles.cardPhoto}
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
                  alt=""
                  style={styles.photoImg}
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
          <span style={styles.photoEmptyText}>見つけたら写真を入れる</span>
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
    const raw = window.localStorage.getItem(MAINICHI_SEEN_PHOTO_KEYS_STORAGE_KEY);
    const values = raw ? JSON.parse(raw) : [];

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
    window.localStorage.setItem(
      MAINICHI_SEEN_PHOTO_KEYS_STORAGE_KEY,
      JSON.stringify([...keys].slice(-500)),
    );
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
        src: photo.src,
        thumbnailSrc: photo.thumbnailSrc,
        displaySrc: photo.displaySrc,
        originalSrc: photo.originalSrc,
        timestamp: photo.timestamp,
        kind: "sleeping" as const,
        sideLabel: "おくった",
        catName: catId ? catNameById.get(catId) : undefined,
      };
    });
  const deliveredPhotos = group.sections
    .filter((section) => section.kind === "other")
    .flatMap((section) => section.photos)
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((photo) => ({
      id: photo.id,
      sourcePhotoId: photo.sourcePhotoId,
      src: photo.src,
      thumbnailSrc: photo.thumbnailSrc,
      displaySrc: photo.displaySrc,
      originalSrc: photo.originalSrc,
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
    title: "とどいたねがお",
    subtitle: "",
    triggerLabel: "mainichi",
    theme: "mainichi",
    deliveredAt: photo.deliveredAt ?? photo.timestamp,
  };
}

function isMainichiPhotoKept(photo: MainichiDayPhoto) {
  if (photo.kind !== "other") {
    return false;
  }

  return readKeptExchangePhotos().some(
    (savedPhoto) =>
      savedPhoto.id === photo.id ||
      Boolean(photo.sourcePhotoId && savedPhoto.sourcePhotoId === photo.sourcePhotoId),
  );
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

    if (
      side === "delivered" &&
      !shouldResolveOtherDeliverySlot(
        group.key,
        firstEveningDeliveryTargetDateKey,
      )
    ) {
      return [];
    }

    return group.sections
      .filter((section) => section.kind === sectionKind)
      .flatMap((section) =>
        section.photos.map((photo) =>
          createMainichiBoardPhoto(photo, group.key, side, catNameById),
        ),
      );
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
    timestamp: photo.timestamp,
    side,
    catName: side === "sent" && catId ? catNameById.get(catId) : undefined,
  };
}

function getMainichiMonthKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

function formatMainichiMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-");
  return `${year}年${Number(month)}月`;
}

function getMainichiBoardPhotoKey(photo: MainichiBoardPhoto) {
  return `${photo.side}:${photo.sourcePhotoId ?? photo.id}:${photo.dateKey}`;
}

function getMainichiBoardRotation(index: number) {
  const rotations = ["-2.2deg", "1.4deg", "-0.8deg", "2deg", "-1.4deg"];

  return rotations[index % rotations.length];
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

      if (getStoragePhotoPath(deliveredPhoto.src)) {
        const {
          thumbnailSrc: _thumbnailSrc,
          displaySrc: _displaySrc,
          originalSrc: _originalSrc,
          ...persistentDeliveredPhoto
        } = deliveredPhoto;

        return {
          ...persistentDeliveredPhoto,
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
  const byKey = new Map<string, BoxPreviewPhoto>();

  for (const photo of [...primaryPhotos, ...replacementPhotos]) {
    byKey.set(getBoxPhotoIdentity(photo), photo);
  }

  return [...byKey.values()].sort(
    (a, b) => getBoxPhotoTimestamp(b) - getBoxPhotoTimestamp(a),
  );
}

function getBoxPhotoIdentity(photo: BoxPreviewPhoto) {
  return photo.sourcePhotoId ? `source:${photo.sourcePhotoId}` : `id:${photo.id}`;
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

function getPhotoThumbnailSrc(photo: {
  src: string;
  thumbnailSrc?: string;
  displaySrc?: string;
}) {
  if (getStoragePhotoPath(photo.src)) {
    return photo.src;
  }

  if (isUsableStoredPhotoSrc(photo.thumbnailSrc)) {
    return photo.thumbnailSrc;
  }

  return isUsableStoredPhotoSrc(photo.displaySrc) ? photo.displaySrc : photo.src;
}

function getPhotoDetailSrc(photo: {
  src: string;
  displaySrc?: string;
  originalSrc?: string;
}) {
  if (getStoragePhotoPath(photo.src)) {
    return photo.src;
  }

  if (isUsableStoredPhotoSrc(photo.displaySrc)) {
    return photo.displaySrc;
  }

  return photo.src;
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

function readCollectionPhotos(catId: string): Record<string, StoredCollectionPhotoEntry[]> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.collectionPhotos);

    if (!raw) {
      return {};
    }

    const all = JSON.parse(raw) as Record<
      string,
      Record<string, StoredCollectionPhotoEntry[] | StoredCollectionPhotoEntry | string[] | string>
    >;
    const catPhotos = all[catId] ?? {};
    const photosForDisplay =
      countStoredPhotos(catPhotos) > 0 ? catPhotos : mergeAllCollectionPhotos(all);

    return Object.fromEntries(
      Object.entries(photosForDisplay).map(([slug, value]) => [
        slug,
        normalizeStoredPhotoList(value, catId, slug),
      ]),
    );
  } catch {
    return {};
  }
}

function addCollectionPhoto(
  catId: string,
  slug: string,
  photoInput: Pick<
    StoredCollectionPhotoEntry,
    "src" | "thumbnailSrc" | "displaySrc" | "originalSrc"
  >,
) {
  const photo: StoredCollectionPhotoEntry = {
    id: createCollectionPhotoId(catId, slug),
    ...photoInput,
    createdAt: new Date().toISOString(),
  };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.collectionPhotos);
    const all = raw
      ? (JSON.parse(raw) as Record<
          string,
          Record<string, StoredCollectionPhotoEntry[] | StoredCollectionPhotoEntry | string[] | string>
        >)
      : {};

    if (!all[catId]) {
      all[catId] = {};
    }

    all[catId][slug] = [...normalizeStoredPhotoList(all[catId][slug], catId, slug), photo];
    window.localStorage.setItem(STORAGE_KEYS.collectionPhotos, JSON.stringify(all));
  } catch {
    // Ignore localStorage quota or parse failures for this MVP fallback.
  }

  return photo;
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

        return {
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
          ...(parsedCreatedAt ? { createdAt: parsedCreatedAt } : {}),
        };
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
    (count, [slug, value]) => count + normalizeStoredPhotoList(value, "cat", slug).length,
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
    "src" | "thumbnailSrc" | "displaySrc" | "originalSrc"
  >
> {
  const [thumbnailDataUrl, displayDataUrl] = await Promise.all([
    resizeAndEncode(file, 400, 0.7, "image/webp"),
    resizeAndEncode(file, 1200, 0.8, "image/webp"),
  ]);
  const localDisplaySrc =
    displayDataUrl.length <= 1_900_000
      ? displayDataUrl
      : await resizeAndEncode(file, 900, 0.76, "image/webp");
  const [originalSrc, storedDisplaySrc] = await Promise.all([
    storeAccountPhotoFile({
      file,
      pathSegments: [...pathSegments, "original"],
      fileName,
    }),
    storeAccountPhotoDataUrl({
      dataUrl: displayDataUrl,
      pathSegments: [...pathSegments, "display"],
      fileName,
    }),
  ]);
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
    ...(originalSrc ? { originalSrc } : {}),
  };
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
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");

      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve("");
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const encoded = canvas.toDataURL(mimeType, quality);
      resolve(
        encoded.startsWith(`data:${mimeType};`)
          ? encoded
          : canvas.toDataURL("image/jpeg", quality),
      );
    };

    img.src = url;
  });
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
      "linear-gradient(115deg, rgba(255,255,255,0.54) 0%, rgba(255,255,255,0) 34%, rgba(205,184,150,0.14) 100%)",
  },
  backgroundVeil: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 1,
    pointerEvents: "none" as const,
    background:
      "linear-gradient(to bottom, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 42%, rgba(203,188,164,0.14) 100%)",
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
    fontFamily: "var(--font-display)",
    fontSize: "18px",
    lineHeight: 1.24,
    fontWeight: 500,
    letterSpacing: "0.18em",
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
    gap: "20px",
  },
  mainichiBoardToggle: {
    width: "min(230px, 100%)",
    justifySelf: "center",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "4px",
  },
  mainichiMonthList: {
    display: "grid",
    gap: "24px",
  },
  mainichiMonthBoard: {
    display: "grid",
    gap: "18px",
    paddingTop: "20px",
    paddingBottom: "24px",
    overflow: "hidden",
  },
  mainichiMonthTitle: {
    margin: 0,
    color: COLLECTION_TEXT_STRONG,
    fontFamily: "var(--font-display)",
    fontSize: "18px",
    fontWeight: 500,
    lineHeight: 1.32,
    letterSpacing: "0.08em",
  },
  mainichiBoardPhotos: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "20px 16px",
    alignItems: "start",
    padding: "4px 2px 2px",
  },
  mainichiBoardPhotoButton: {
    position: "relative",
    display: "grid",
    gap: "8px",
    minWidth: 0,
    border: "none",
    background: "transparent",
    color: COLLECTION_TEXT,
    font: "inherit",
    textAlign: "left",
    padding: "8px 6px 10px",
    cursor: "pointer",
    transformOrigin: "50% 22%",
  },
  mainichiBoardTape: {
    position: "absolute",
    zIndex: 2,
    left: "50%",
    top: "0",
    width: "44px",
    height: "14px",
    borderRadius: radius.sm,
    background: "color-mix(in srgb, var(--paper-card) 72%, transparent)",
    boxShadow: "0 2px 8px rgba(120,110,90,0.08)",
    transform: "translate(-50%, -15%) rotate(-3deg)",
    pointerEvents: "none",
  },
  mainichiBoardPhotoTileRoot: {
    width: "100%",
  },
  mainichiBoardPhotoTile: {
    width: "100%",
    height: "auto",
    aspectRatio: "1 / 1",
    display: "block",
  },
  mainichiBoardPhotoMeta: {
    display: "grid",
    gap: "2px",
    justifyItems: "center",
    color: COLLECTION_MUTED,
    fontFamily: "var(--font-ui)",
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.35,
  },
  mainichiBoardPhotoDate: {
    color: COLLECTION_MUTED,
    fontVariantNumeric: "tabular-nums",
  },
  mainichiBoardPhotoCat: {
    color: "var(--ink-faint)",
  },
  mainichiBoardEmpty: {
    minHeight: "180px",
    alignContent: "center",
    fontFamily: "var(--font-display)",
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
    gap: "16px",
  },
  mainichiDayPhotoRow: {
    display: "grid",
    gridTemplateColumns: "96px minmax(0, 1fr)",
    alignItems: "center",
    gap: "16px",
    minHeight: "116px",
    padding: "12px",
    border: "none",
    borderRadius: "var(--radius-xl)",
    background: "color-mix(in srgb, var(--paper) 78%, transparent)",
    color: COLLECTION_TEXT,
    font: "inherit",
    textAlign: "left",
    cursor: "pointer",
  },
  mainichiDayPhotoTileRoot: {
    width: "96px",
  },
  mainichiDayPhotoTile: {
    width: "96px",
    height: "96px",
  },
  mainichiDayPhotoText: {
    display: "grid",
    gap: "6px",
  },
  mainichiDayPhotoSide: {
    color: COLLECTION_TEXT_STRONG,
    fontFamily: "var(--font-display)",
    fontSize: "18px",
    fontWeight: 400,
    lineHeight: 1.35,
  },
  mainichiDayPhotoCat: {
    color: COLLECTION_MUTED,
    fontFamily: "var(--font-ui)",
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.4,
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
    background: "color-mix(in srgb, var(--paper) 98%, transparent)",
  },
  mainichiViewerChrome: {
    display: "flex",
    justifyContent: "flex-end",
  },
  mainichiViewerFrame: {
    width: "min(100%, 560px)",
    maxWidth: "100%",
    height: "100%",
    justifySelf: "center",
    alignSelf: "center",
    borderRadius: "var(--radius-2xl)",
  },
  mainichiViewerImage: {
    width: "100%",
    height: "100%",
    maxHeight: "calc(100svh - 180px - env(safe-area-inset-top) - env(safe-area-inset-bottom))",
  },
  mainichiViewerKeepButton: {
    width: "min(100%, 420px)",
    justifySelf: "center",
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
    fontWeight: 300,
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
