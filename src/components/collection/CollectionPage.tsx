"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, UIEvent } from "react";
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
  BOX_PHOTO_STORAGE_EVENT,
  deleteOwnSleepingPhoto,
  hideKeptExchangePhoto,
  readKeptExchangePhotos,
  readOwnSleepingPhotos,
  updateOwnSleepingPhotoDelivery,
} from "../../lib/home/sleepingPhotos";
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
import { AppIcon } from "../ui/AppIcons";
import { StoredPhotoImage } from "../ui/StoredPhotoImage";

const COLLECTION_TEXT = "#2d2b27";
const COLLECTION_TEXT_STRONG = "#1f1d1a";
const COLLECTION_MUTED = "#777166";
const COLLECTION_SURFACE: CSSProperties = {
  position: "relative",
  background: "rgba(255,255,255,0.62)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "0.5px solid rgba(78,70,58,0.12)",
  boxShadow: [
    "0 10px 26px rgba(86,76,58,0.08)",
    "inset 0 1px 0 rgba(255,255,255,0.72)",
  ].join(", "),
};
const COLLECTION_SURFACE_SOFT: CSSProperties = {
  ...COLLECTION_SURFACE,
  background: "rgba(255,255,255,0.46)",
  boxShadow: [
    "0 8px 20px rgba(86,76,58,0.06)",
    "inset 0 1px 0 rgba(255,255,255,0.64)",
  ].join(", "),
};

type CollectionPhoto = {
  id: string;
  slotId: string;
  src: string;
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
  catId?: string;
  shared?: boolean;
  createdAt?: number;
  sourcePhotoId?: string;
  deliveredAt?: number;
};

type StoredCollectionPhotoEntry = {
  id: string;
  src: string;
};

type BoxDetailKind = "sleeping" | "other";

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
  const [isCatSheetOpen, setIsCatSheetOpen] = useState(false);
  const [toastText, setToastText] = useState("");
  const [boxRefreshTick, setBoxRefreshTick] = useState(0);
  const [selectedBoxKind, setSelectedBoxKind] = useState<BoxDetailKind | null>(
    null,
  );
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
    () => readOwnSleepingPhotos(activeCatId),
    [activeCatId, boxRefreshTick, hasLoaded],
  );
  const otherBoxPhotos = useMemo(
    () => readKeptExchangePhotos(),
    [boxRefreshTick, hasLoaded],
  );
  const selectedBoxPhotos =
    selectedBoxKind === "sleeping"
      ? sleepingBoxPhotos
      : selectedBoxKind === "other"
        ? otherBoxPhotos
        : [];
  const awakeBoxPhotos = useMemo(
    () =>
      storedCollectionPhotos.map((photo) => ({
        id: photo.id,
        src: photo.src,
      })),
    [storedCollectionPhotos],
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

  function openBoxDetail(kind: BoxDetailKind) {
    setSelectedBoxKind(kind);
    setCurrentBoxPhotoIndex(0);
    trackProductEvent(
      "collection_box_detail_opened",
      { kind },
      { localCatId: activeCatId },
    );
  }

  function closeBoxDetail() {
    if (selectedBoxKind) {
      trackProductEvent(
        "collection_box_detail_closed",
        {
          kind: selectedBoxKind,
          current_photo_index: currentBoxPhotoIndex,
          photo_count: selectedBoxPhotos.length,
        },
        { localCatId: activeCatId },
      );
    }

    setSelectedBoxKind(null);
    setCurrentBoxPhotoIndex(0);
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

  function handleCatSelect(catId: string) {
    const nextActiveProfile = getActiveCatProfile(catProfiles, catId);

    trackProductEvent(
      "collection_cat_selected",
      {
        previous_cat_id: activeCatId,
        next_cat_id: nextActiveProfile.id,
      },
      { localCatId: nextActiveProfile.id },
    );
    saveActiveCatId(nextActiveProfile.id);
    setActiveCatId(nextActiveProfile.id);
    setSelectedSlug(null);
    setSelectedBoxKind(null);
    setCompletedSlug(null);
    setCurrentPhotoIndex(0);
    setCurrentBoxPhotoIndex(0);
    setIsCatSheetOpen(false);
  }

  function openCatSheet() {
    trackProductEvent(
      "collection_cat_switcher_opened",
      {
        cat_count: catProfiles.length,
      },
      { localCatId: activeCatId },
    );
    setIsCatSheetOpen(true);
  }

  function closeCatSheet() {
    trackProductEvent(
      "collection_cat_switcher_closed",
      {
        cat_count: catProfiles.length,
      },
      { localCatId: activeCatId },
    );
    setIsCatSheetOpen(false);
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

      const dataUrl = await resizeAndEncode(file);
      const slug = getCollectionPhotoSlug(slot);

      if (!dataUrl) {
        return;
      }

      const addedPhoto = addCollectionPhoto(activeCatId, slug, dataUrl);
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
          <section style={styles.emptyCard}>
            <h1 style={styles.emptyTitle}>アルバム</h1>
            <p style={styles.emptyText}>準備しています</p>
          </section>
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
          <section style={styles.emptyCard}>
            <h1 style={styles.emptyTitle}>アルバム</h1>
            <p style={styles.emptyText}>一緒に暮らしている猫を登録しましょう</p>
            <a href="/cats" style={styles.primaryLink}>
              猫を登録する
            </a>
          </section>
        </div>
        <BottomNavigation active="collection" />
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <PageBackdrop />
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.pageHeader}>
            <h1 style={styles.pageTitle}>ねてるねこ</h1>
            <div style={styles.pageHeaderActions}>
              <button
                type="button"
                onClick={openCatSheet}
                style={styles.catNameBtn}
                aria-label="猫を切り替える"
              >
                ☰
              </button>
            </div>
          </div>
        </header>

        <BoxOverview
          sleepingPhotos={sleepingBoxPhotos}
          awakePhotos={awakeBoxPhotos}
          otherPhotos={otherBoxPhotos}
          onOpenBox={openBoxDetail}
        />
      </div>
      {selectedBoxKind ? (
        <BoxPhotoDetailSheet
          kind={selectedBoxKind}
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
      {isCatSheetOpen ? (
        <CollectionCatSheet
          profiles={catProfiles}
          activeCatId={activeCatId}
          onClose={closeCatSheet}
          onSelect={handleCatSelect}
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
  sleepingPhotos,
  awakePhotos,
  otherPhotos,
  onOpenBox,
}: {
  sleepingPhotos: BoxPreviewPhoto[];
  awakePhotos: BoxPreviewPhoto[];
  otherPhotos: BoxPreviewPhoto[];
  onOpenBox: (kind: BoxDetailKind) => void;
}) {
  return (
    <section style={styles.boxOverview} aria-label="アルバム">
      <BoxSummaryCard
        title="とったねがお"
        photos={sleepingPhotos}
        onOpen={() => onOpenBox("sleeping")}
      />
      <BoxSummaryCard
        title="おきてる写真"
        photos={awakePhotos}
        showAddSlot={true}
      />
      <BoxSummaryCard
        title="とどいたねがお"
        photos={otherPhotos}
        onOpen={() => onOpenBox("other")}
      />
    </section>
  );
}

function BoxSummaryCard({
  title,
  photos,
  showAddSlot = false,
  onOpen,
}: {
  title: string;
  photos: BoxPreviewPhoto[];
  showAddSlot?: boolean;
  onOpen?: () => void;
}) {
  const visiblePhotos = photos.slice(0, 4);
  const emptySlotCount = Math.max(
    0,
    4 - visiblePhotos.length - (showAddSlot ? 1 : 0),
  );
  const isOtherBox = title === "とどいたねがお";
  const countLabel = photos.length > 0 ? `${photos.length}枚` : "まだなし";

  return (
    <button
      type="button"
      style={{
        ...styles.boxSummaryCard,
        ...(onOpen ? styles.boxSummaryButton : styles.boxSummaryStatic),
      }}
      onClick={onOpen}
      disabled={!onOpen}
    >
      <div style={styles.boxSummaryHeader}>
        <div>
          <h2 style={styles.boxSummaryTitle}>{title}</h2>
        </div>
        <span style={styles.boxSummaryMeta}>
          <span style={styles.boxSummaryCount}>{countLabel}</span>
          <span style={styles.boxSummaryArrow}>›</span>
        </span>
      </div>
      <div style={styles.boxPhotoStrip}>
        {visiblePhotos.map((photo) => (
          <span key={photo.id} style={styles.boxPhotoThumb}>
            <StoredPhotoImage src={photo.src} alt="" style={styles.boxPhotoImg} />
          </span>
        ))}
        {showAddSlot ? (
          <span style={styles.boxAddSlot} aria-label="おきてる写真を追加">
            +
          </span>
        ) : null}
        {Array.from({ length: emptySlotCount }).map((_, index) => (
          <span
            key={`${title}-empty-${index}`}
            style={isOtherBox ? styles.boxLockedSlot : styles.boxEmptySlot}
            aria-hidden="true"
          >
            {isOtherBox ? <AppIcon name="lock" size={16} /> : null}
          </span>
        ))}
      </div>
    </button>
  );
}

function BoxPhotoDetailSheet({
  kind,
  photos,
  currentPhotoIndex,
  onClose,
  onPhotoScroll,
  onToggleSleepingDelivery,
  onDeleteSleepingPhoto,
  onHideOtherPhoto,
}: {
  kind: BoxDetailKind;
  photos: BoxPreviewPhoto[];
  currentPhotoIndex: number;
  onClose: () => void;
  onPhotoScroll: (event: UIEvent<HTMLDivElement>) => void;
  onToggleSleepingDelivery: (photo: BoxPreviewPhoto) => void;
  onDeleteSleepingPhoto: (photo: BoxPreviewPhoto) => void;
  onHideOtherPhoto: (photo: BoxPreviewPhoto) => void;
}) {
  const title = kind === "sleeping" ? "とったねがお" : "とどいたねがお";
  const currentPhoto =
    photos[Math.max(0, Math.min(currentPhotoIndex, photos.length - 1))] ?? null;
  const deliveryActionLabel = currentPhoto?.shared
    ? "自分だけにする"
    : "とどくようにする";

  return (
    <AppBottomSheet title={title} onClose={onClose}>
      {photos.length > 0 ? (
        <div style={styles.sheetPhotoArea}>
          <div style={styles.photoScroll} onScroll={onPhotoScroll}>
            {photos.map((photo) => (
              <div key={photo.id} style={styles.photoSlide}>
                <StoredPhotoImage src={photo.src} alt="" style={styles.photoImg} />
                {kind === "sleeping" ? (
                  <span style={styles.boxPhotoStateBadge}>
                    {photo.shared ? "とどく" : "自分だけ"}
                  </span>
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
          <span style={styles.photoEmptyText}>
            {kind === "sleeping" ? "ねがおを入れると、ここに並びます" : "とっておくと、ここに並びます"}
          </span>
        </div>
      )}

      {currentPhoto ? (
        kind === "sleeping" ? (
          <div style={styles.boxDetailActions}>
            <div style={styles.boxIconActionBar} aria-label="写真の操作">
              <button
                type="button"
                aria-label={deliveryActionLabel}
                title={deliveryActionLabel}
                style={{
                  ...styles.boxIconActionButton,
                  ...(currentPhoto.shared ? {} : styles.boxIconActionButtonActive),
                }}
                onClick={() => onToggleSleepingDelivery(currentPhoto)}
              >
                <AppIcon
                  name={currentPhoto.shared ? "eyeOff" : "send"}
                  size={20}
                />
              </button>
              <button
                type="button"
                aria-label="とったねがおから外す"
                title="とったねがおから外す"
                style={{
                  ...styles.boxIconActionButton,
                  ...styles.boxIconActionButtonDanger,
                }}
                onClick={() => onDeleteSleepingPhoto(currentPhoto)}
              >
                <AppIcon name="trash" size={20} />
              </button>
            </div>
          </div>
        ) : (
          <div style={styles.boxDetailActions}>
            <div style={styles.boxIconActionBar} aria-label="写真の操作">
              <button
                type="button"
                aria-label="アルバムから外す"
                title="アルバムから外す"
                style={{
                  ...styles.boxIconActionButton,
                  ...styles.boxIconActionButtonDanger,
                }}
                onClick={() => onHideOtherPhoto(currentPhoto)}
              >
                <AppIcon name="trash" size={20} />
              </button>
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
        <div style={styles.nextTargetBlock}>
          <div style={styles.sectionHeadingRow}>
            <p style={styles.sectionHeading}>次に見つけたい姿</p>
          </div>
          <div style={styles.nextTargetRail}>
            {nextTargetSlots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                onClick={() => onOpenSlot(slot)}
                style={styles.nextTargetCard}
              >
                <img src={slot.iconPath} alt="" style={styles.nextTargetIcon} />
                <span style={styles.nextTargetName}>
                  {getCollectionSlotLabel(slot)}
                </span>
              </button>
            ))}
          </div>
        </div>
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
      <section style={styles.shareEmptyCard}>
        <p style={styles.shareEmptyTitle}>まだ写真がありません</p>
        <p style={styles.shareEmptyText}>写真を見つけると、ここに自分の一枚が並びます。</p>
        <button type="button" style={styles.shareEmptyButton} onClick={onGoCollect}>
          写真を入れる
        </button>
      </section>
    );
  }

  const hasPhotoItems = feedItems.some((item) => item.itemType === "photo");
  const hasSuggestionItems = feedItems.some(
    (item) => item.itemType === "suggestion",
  );
  const headerTitle = hasPhotoItems ? "自分の一枚と候補" : "次にとる候補";

  return (
    <section style={styles.shareView} aria-label="シェア">
      <div style={styles.shareHeaderCard}>
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
      </div>
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
    <section style={styles.progressBlock} aria-label="コレクションの進み具合">
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
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}
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
    </section>
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
    <button
      type="button"
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
    </button>
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
        <StoredPhotoImage src={firstPhoto.src} alt="" style={styles.cardPhoto} />
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
    >
      {photos.length > 0 ? (
        <div style={styles.sheetPhotoArea}>
          <div style={styles.photoScroll} onScroll={onPhotoScroll}>
            {photos.map((photo, index) => (
              <div key={photo.id} style={styles.photoSlide}>
                <StoredPhotoImage src={photo.src} alt="" style={styles.photoImg} />
                {photo.localIndex !== undefined ? (
                  <button
                    type="button"
                    style={styles.deleteBtn}
                    onClick={() => onDeletePhoto(slug, photo.localIndex ?? index)}
                  >
                    削除
                  </button>
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
        <button type="button" style={styles.btnPrimary} onClick={onAddPhoto}>
          写真を追加
        </button>
        <button
          type="button"
          onClick={onShare}
          style={
            photos.length > 0
              ? styles.btnSecondary
              : { ...styles.btnSecondary, ...styles.btnDisabled }
          }
          disabled={photos.length === 0}
        >
          シェアに並べる
        </button>
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
          <button type="button" style={styles.btnPrimary} onClick={onOpenAlbum}>
            アルバムを見る
          </button>
          <button type="button" style={styles.btnSecondary} onClick={onOpenShare}>
            シェアに並べる
          </button>
        </div>
      </div>
    </AppBottomSheet>
  );
}

function CollectionCatSheet({
  profiles,
  activeCatId,
  onClose,
  onSelect,
}: {
  profiles: CatProfile[];
  activeCatId: string | null;
  onClose: () => void;
  onSelect: (catId: string) => void;
}) {
  return (
    <AppBottomSheet title="ねこを選ぶ" onClose={onClose}>
      <div style={styles.catSheetGrid}>
        {profiles.map((profile) => {
          const isSelected = profile.id === activeCatId;
          const age = formatCatAge(profile.basicInfo?.birthDate);
          const gender = formatCatGender(profile.basicInfo?.gender);
          const meta = [gender, age].filter(Boolean).join("・");

          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => onSelect(profile.id)}
              style={styles.catSheetItem}
            >
              <div
                style={
                  isSelected
                    ? { ...styles.catSheetAvatar, ...styles.catSheetAvatarActive }
                    : styles.catSheetAvatar
                }
              >
                {profile.avatarDataUrl ? (
                  <img
                    src={profile.avatarDataUrl}
                    alt={profile.name}
                    style={styles.catSheetAvatarPhoto}
                  />
                ) : (
                  <img
                    src={getCatAvatarSrc(profile.appearance?.coat)}
                    alt={profile.name}
                    style={styles.catSheetAvatarImg}
                  />
                )}
              </div>
              <span style={styles.catSheetName}>{profile.name}</span>
              {meta ? <span style={styles.catSheetMeta}>{meta}</span> : null}
            </button>
          );
        })}
      </div>
      <a href="/cats" style={styles.catSheetLink} onClick={onClose}>
        ねこタブで管理する ›
      </a>
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
          storageSlug: slug,
          localIndex: index,
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

function addCollectionPhoto(catId: string, slug: string, dataUrl: string) {
  const photo: StoredCollectionPhotoEntry = {
    id: createCollectionPhotoId(catId, slug),
    src: dataUrl,
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
        return {
          id: photo.id || `${catId}:${slug}:${index}`,
          src: photo.src,
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

function resizeAndEncode(file: File, maxSize = 800): Promise<string> {
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
      resolve(canvas.toDataURL("image/jpeg", 0.85));
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

function getCatAvatarSrc(coat?: string): string {
  const coatMap: Record<string, string> = {
    saba: "/sample-cats/saba.png",
    gray: "/sample-cats/gray.png",
    orange_tabby: "/sample-cats/orange_tabby.png",
    black: "/sample-cats/black.png",
    white: "/sample-cats/white.png",
    calico: "/sample-cats/calico.png",
    cream: "/sample-cats/saba.png",
  };

  return coatMap[coat ?? ""] ?? "/sample-cats/saba.png";
}

function formatCatAge(birthDate?: string): string {
  if (!birthDate) {
    return "";
  }

  const birth = new Date(birthDate);
  const now = new Date();
  const totalMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());

  if (totalMonths < 12) {
    return `${totalMonths}ヶ月`;
  }

  return `${Math.floor(totalMonths / 12)}歳`;
}

function formatCatGender(gender?: string): string {
  if (gender === "male") {
    return "男の子";
  }

  if (gender === "female") {
    return "女の子";
  }

  return "";
}

const styles = {
  page: {
    position: "relative",
    minHeight: "100svh",
    background: "#f7f5ef",
    color: COLLECTION_TEXT,
    overflowX: "hidden",
  },
  ambientBackground: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 0,
    background:
      "linear-gradient(180deg, #fbfaf6 0%, #f2eee5 58%, #eee7dc 100%)",
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
      "calc(18px + env(safe-area-inset-top)) 24px calc(118px + env(safe-area-inset-bottom))",
  },
  header: {
    marginBottom: "28px",
    padding: "2px 0 0",
  },
  pageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    marginBottom: "0",
    position: "relative",
  },
  pageHeaderActions: {
    position: "absolute",
    right: 0,
    top: "50%",
    transform: "translateY(-50%)",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
  },
  pageTitle: {
    margin: 0,
    color: COLLECTION_TEXT_STRONG,
    fontFamily: "\"Shippori Mincho B1\", \"Hiragino Mincho ProN\", \"Yu Mincho\", serif",
    fontSize: "20px",
    lineHeight: 1.24,
    fontWeight: 500,
    letterSpacing: "0.18em",
  },
  viewTabs: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "6px",
    ...COLLECTION_SURFACE_SOFT,
    borderRadius: "999px",
    padding: "5px",
  },
  viewTab: {
    minHeight: "34px",
    border: "none",
    borderRadius: "999px",
    background: "transparent",
    color: COLLECTION_MUTED,
    font: "inherit",
    fontSize: "13px",
    fontWeight: 540,
    lineHeight: 1,
    cursor: "pointer",
  },
  viewTabActive: {
    background: "rgba(255,255,255,0.92)",
    color: "#2a2a28",
    boxShadow: "0 7px 18px rgba(0,0,0,0.16)",
  },
  catNameBtn: {
    width: "34px",
    height: "34px",
    border: "none",
    background: "transparent",
    fontSize: "23px",
    fontWeight: 300,
    color: "#4d4942",
    borderRadius: "50%",
    padding: 0,
    cursor: "pointer",
  },
  boxOverview: {
    display: "grid",
    gap: "0",
  },
  boxSummaryCard: {
    position: "relative",
    display: "grid",
    gap: "22px",
    width: "100%",
    padding: "28px 0 30px",
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
    fontSize: "13px",
    fontWeight: 560,
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
    fontSize: "12.5px",
    fontWeight: 520,
    lineHeight: 1.35,
  },
  boxSummaryCount: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "flex-end",
    minWidth: "36px",
    color: "#777166",
    fontSize: "12px",
    fontWeight: 520,
    fontVariantNumeric: "tabular-nums",
  },
  boxSummaryArrow: {
    color: "#8a8378",
    fontSize: "20px",
    fontWeight: 300,
    lineHeight: 1,
  },
  boxPhotoStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "14px",
    alignItems: "center",
    minHeight: "90px",
  },
  boxPhotoThumb: {
    aspectRatio: "1 / 1",
    minWidth: 0,
    borderRadius: "8px",
    overflow: "hidden",
    background: "rgba(255,255,255,0.52)",
    border: "0.5px solid rgba(85,75,62,0.08)",
    boxShadow: "0 8px 20px rgba(83,72,55,0.08)",
  },
  boxPhotoImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  boxAddSlot: {
    aspectRatio: "1 / 1",
    minWidth: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.42)",
    border: "1.5px dashed rgba(104,96,84,0.26)",
    color: "#777166",
    fontSize: "26px",
    fontWeight: 300,
  },
  boxEmptySlot: {
    aspectRatio: "1 / 1",
    minWidth: 0,
    borderRadius: "8px",
    background: "rgba(255,255,255,0.34)",
    border: "0.5px solid rgba(104,96,84,0.08)",
  },
  boxLockedSlot: {
    aspectRatio: "1 / 1",
    minWidth: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "8px",
    background: "rgba(231,226,216,0.7)",
    border: "0.5px solid rgba(104,96,84,0.08)",
    color: "#8a8378",
  },
  boxLockedIcon: {
    color: "#8a8378",
  },
  boxEmptyText: {
    gridColumn: "1 / -1",
    color: "rgba(255,255,255,0.52)",
    fontSize: "12px",
    fontWeight: 540,
  },
  catSheetGrid: {
    display: "flex",
    gap: "16px",
    overflowX: "auto",
    paddingBottom: "8px",
    scrollbarWidth: "none",
    marginBottom: "16px",
  },
  catSheetItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "5px",
    flexShrink: 0,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    padding: 0,
    minWidth: "64px",
  },
  catSheetAvatar: {
    width: "64px",
    height: "64px",
    borderRadius: "50%",
    border: "3px solid transparent",
    overflow: "hidden",
    background: "rgba(255,255,255,0.12)",
    flexShrink: 0,
  },
  catSheetAvatarActive: {
    border: "3px solid rgba(255,255,255,0.78)",
  },
  catSheetAvatarPhoto: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "50%",
  },
  catSheetAvatarImg: {
    width: "52px",
    height: "52px",
    objectFit: "contain",
    display: "block",
    margin: "6px auto",
  },
  catSheetName: {
    fontSize: "12px",
    fontWeight: 500,
    color: COLLECTION_TEXT,
    maxWidth: "72px",
    textAlign: "center",
    wordBreak: "break-all",
  },
  catSheetMeta: {
    fontSize: "10px",
    color: COLLECTION_MUTED,
  },
  catSheetLink: {
    display: "block",
    textAlign: "center",
    fontSize: "13px",
    color: COLLECTION_TEXT,
    textDecoration: "none",
    padding: "10px 0",
  },
  title: {
    margin: 0,
    color: COLLECTION_TEXT_STRONG,
    fontSize: "24px",
    lineHeight: 1.25,
    fontWeight: 600,
    letterSpacing: 0,
  },
  progressBlock: {
    ...COLLECTION_SURFACE_SOFT,
    display: "grid",
    gap: "8px",
    borderRadius: "18px",
    padding: "11px 12px 12px",
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
    fontSize: "20px",
    fontWeight: 610,
    lineHeight: 1,
  },
  progressSlash: {
    color: COLLECTION_MUTED,
    fontSize: "15px",
    fontWeight: 540,
    margin: "0 2px",
  },
  progressUnit: {
    color: COLLECTION_MUTED,
    fontSize: "12px",
    fontWeight: 540,
  },
  progressSub: {
    margin: "-3px 0 0",
    color: COLLECTION_MUTED,
    fontSize: "11px",
    fontWeight: 500,
    lineHeight: 1.4,
  },
  progressTrack: {
    position: "relative",
    width: "100%",
    height: "4px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.16)",
    overflow: "hidden",
  },
  progressFill: {
    position: "absolute",
    inset: "0 auto 0 0",
    borderRadius: "999px",
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
    borderRadius: "999px",
    background: "rgba(255,255,255,0.10)",
    color: COLLECTION_TEXT,
    font: "inherit",
    fontSize: "13px",
    fontWeight: 540,
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
    ...COLLECTION_SURFACE_SOFT,
    display: "grid",
    gridTemplateColumns: "48px minmax(0, 1fr) auto",
    alignItems: "center",
    gap: "11px",
    borderRadius: "18px",
    padding: "12px",
    color: COLLECTION_TEXT,
    font: "inherit",
    textAlign: "left",
    cursor: "pointer",
  },
  dailyTargetThumb: {
    width: "48px",
    height: "48px",
    borderRadius: "15px",
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
    ...COLLECTION_SURFACE_SOFT,
    borderRadius: "18px",
    padding: "12px",
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
    fontWeight: 560,
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
    border: "0.5px solid rgba(255,255,255,0.12)",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.07)",
    color: COLLECTION_TEXT,
    font: "inherit",
    padding: "10px 6px",
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
    fontSize: "10px",
    fontWeight: 520,
    lineHeight: 1.25,
    textAlign: "center",
  },
  dailyTargetLabel: {
    color: COLLECTION_MUTED,
    fontSize: "10px",
    fontWeight: 520,
    whiteSpace: "nowrap",
  },
  dailyTargetName: {
    minWidth: 0,
    color: COLLECTION_TEXT_STRONG,
    fontSize: "16px",
    fontWeight: 620,
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  dailyTargetHint: {
    color: COLLECTION_MUTED,
    fontSize: "11px",
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
    ...COLLECTION_SURFACE_SOFT,
    borderRadius: "18px",
    padding: "13px 14px",
  },
  shareHeaderKicker: {
    margin: "0 0 4px",
    color: COLLECTION_MUTED,
    fontSize: "11px",
    fontWeight: 540,
    lineHeight: 1.2,
  },
  shareHeaderTitle: {
    margin: "0 0 10px",
    color: COLLECTION_TEXT_STRONG,
    fontSize: "15px",
    fontWeight: 600,
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
    borderRadius: "999px",
    background: "rgba(255,255,255,0.88)",
    color: "#2a2a28",
    fontSize: "11px",
    fontWeight: 610,
    lineHeight: 1,
    padding: "6px 9px",
  },
  shareSourceChip: {
    flex: "0 0 auto",
    borderRadius: "999px",
    border: "0.5px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.08)",
    color: COLLECTION_MUTED,
    fontSize: "11px",
    fontWeight: 560,
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
    borderRadius: "18px",
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
    borderRadius: "99px",
    background: "rgba(255,255,255,0.84)",
    color: "#2a2a28",
    fontSize: "10px",
    fontWeight: 620,
    lineHeight: 1,
    padding: "4px 8px",
  },
  shareFeedMeta: {
    position: "absolute",
    left: "12px",
    right: "12px",
    bottom: "38px",
    color: "rgba(255,255,255,0.70)",
    fontSize: "11px",
    fontWeight: 520,
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
    fontSize: "16px",
    fontWeight: 600,
    lineHeight: 1.25,
    textAlign: "left",
    textShadow: "0 1px 8px rgba(0,0,0,0.26)",
  },
  shareEmptyCard: {
    ...COLLECTION_SURFACE_SOFT,
    borderRadius: "18px",
    padding: "18px",
    textAlign: "center",
  },
  shareEmptyTitle: {
    margin: "0 0 6px",
    color: COLLECTION_TEXT_STRONG,
    fontSize: "15px",
    fontWeight: 600,
  },
  shareEmptyText: {
    margin: 0,
    color: COLLECTION_MUTED,
    fontSize: "13px",
    lineHeight: 1.55,
    fontWeight: 500,
  },
  shareEmptyButton: {
    marginTop: "14px",
    minHeight: "38px",
    border: "0.5px solid rgba(255,255,255,0.2)",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.88)",
    color: "#2a2a28",
    font: "inherit",
    fontSize: "13px",
    fontWeight: 610,
    lineHeight: 1,
    padding: "0 16px",
    cursor: "pointer",
  },
  collectionCard: {
    position: "relative",
    display: "block",
    aspectRatio: "1 / 1",
    ...COLLECTION_SURFACE_SOFT,
    borderRadius: "18px",
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
    background: "rgba(255,255,255,0.055)",
    border: "0.5px solid rgba(255,255,255,0.10)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
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
    padding: "12px",
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
      "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(35,34,31,0.04) 48%, rgba(35,34,31,0.48) 100%)",
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
    borderRadius: "99px",
    background: "rgba(0,0,0,0.45)",
    color: "#fff",
    fontSize: "11px",
    fontWeight: 560,
    lineHeight: 1,
    padding: "2px 7px",
  },
  todayBadge: {
    position: "absolute",
    top: "10px",
    left: "10px",
    zIndex: 3,
    borderRadius: "99px",
    background: "rgba(255,255,255,0.9)",
    color: "#2f332f",
    fontSize: "11px",
    fontWeight: 620,
    lineHeight: 1,
    padding: "4px 8px",
    boxShadow: "0 3px 10px rgba(0,0,0,0.12)",
  },
  photoCardLabel: {
    margin: 0,
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 620,
    lineHeight: 1.2,
    textShadow: "0 1px 8px rgba(0,0,0,0.24)",
  },
  photoCount: {
    display: "inline-flex",
    width: "fit-content",
    border: "1px solid rgba(255,255,255,0.58)",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.72)",
    color: "#5c6259",
    fontSize: "11px",
    fontWeight: 620,
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
    fontSize: "11px",
    fontWeight: 520,
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
    borderRadius: "999px",
    background: "rgba(255,255,255,0.76)",
    color: "#7b7c74",
    font: "inherit",
    fontSize: "17px",
    fontWeight: 460,
    lineHeight: 1,
    padding: 0,
    cursor: "pointer",
  },
  sheetPhotoArea: {
    margin: "12px 16px",
  },
  photoScroll: {
    display: "flex",
    overflowX: "auto",
    scrollSnapType: "x mandatory",
    scrollbarWidth: "none",
    gap: "8px",
  },
  photoSlide: {
    position: "relative",
    flexShrink: 0,
    width: "100%",
    aspectRatio: "1",
    borderRadius: "16px",
    overflow: "hidden",
    scrollSnapAlign: "start",
  },
  photoImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  boxPhotoStateBadge: {
    position: "absolute",
    left: "12px",
    top: "12px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.88)",
    color: "#2a2a28",
    fontSize: "12px",
    fontWeight: 620,
    lineHeight: 1,
    padding: "6px 10px",
    boxShadow: "0 6px 18px rgba(0,0,0,0.14)",
  },
  deleteBtn: {
    position: "absolute",
    top: "10px",
    right: "10px",
    border: "none",
    borderRadius: "99px",
    background: "rgba(0,0,0,0.5)",
    color: "#fff",
    fontSize: "11px",
    padding: "4px 10px",
    cursor: "pointer",
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
    borderRadius: "99px",
    background: "rgba(255,255,255,0.22)",
    transition: "width 0.2s",
  },
  photoDotActive: {
    width: "14px",
    background: "rgba(255,255,255,0.86)",
  },
  photoEmpty: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    aspectRatio: "1",
    margin: "12px 16px",
    borderRadius: "16px",
    ...COLLECTION_SURFACE_SOFT,
  },
  photoEmptyText: {
    color: COLLECTION_MUTED,
    fontSize: "14px",
  },
  sheetActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    padding: "12px 16px 0",
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
  boxIconActionButton: {
    display: "grid",
    placeItems: "center",
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    border: "0.5px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.10)",
    color: COLLECTION_TEXT_STRONG,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
    cursor: "pointer",
  },
  boxIconActionButtonActive: {
    background: "rgba(255,255,255,0.84)",
    color: "#2a2823",
    border: "0.5px solid rgba(255,255,255,0.72)",
  },
  boxIconActionButtonDanger: {
    color: "#f0d3ca",
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
    fontWeight: 560,
  },
  boxPhotoStatusValue: {
    color: COLLECTION_TEXT_STRONG,
    fontSize: "13px",
    fontWeight: 650,
  },
  boxDetailNote: {
    margin: "0 0 4px",
    color: COLLECTION_MUTED,
    fontSize: "12.5px",
    fontWeight: 520,
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
    fontWeight: 620,
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
  btnPrimary: {
    border: "none",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.92)",
    color: "#2a2a28",
    fontSize: "13px",
    fontWeight: 560,
    padding: "12px",
    cursor: "pointer",
  },
  btnSecondary: {
    border: "0.5px solid rgba(255,255,255,0.16)",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.10)",
    color: COLLECTION_TEXT,
    fontSize: "13px",
    fontWeight: 500,
    padding: "12px",
    cursor: "pointer",
  },
  btnDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  toast: {
    position: "fixed",
    left: "50%",
    top: "calc(18px + env(safe-area-inset-top))",
    zIndex: 80,
    transform: "translateX(-50%)",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.92)",
    color: "#2a2a28",
    fontSize: "13px",
    fontWeight: 620,
    lineHeight: 1,
    padding: "10px 16px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  },
  emptyCard: {
    ...COLLECTION_SURFACE,
    borderRadius: "26px",
    padding: "20px",
  },
  emptyTitle: {
    margin: "0 0 10px",
    color: COLLECTION_TEXT_STRONG,
    fontSize: "24px",
    lineHeight: 1.25,
    fontWeight: 640,
  },
  emptyText: {
    margin: "0 0 16px",
    color: COLLECTION_MUTED,
    fontSize: "14px",
    lineHeight: 1.65,
    fontWeight: 500,
  },
  primaryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "44px",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.42)",
    background: "rgba(255,255,255,0.92)",
    color: "#2a2a28",
    padding: "0 18px",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 580,
  },
} satisfies Record<string, CSSProperties>;
