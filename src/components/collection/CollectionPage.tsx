"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, UIEvent } from "react";
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

type CollectionPhoto = {
  id: string;
  slotId: string;
  src: string;
  localIndex?: number;
  storageSlug?: string;
  createdAt?: string;
};

const SAMPLE_COLLECTION_PHOTOS: CollectionPhoto[] = [
  {
    id: "sample-belly-up",
    slotId: "belly-up",
    src: "/sample-cats/pose-belly.png",
  },
  {
    id: "sample-loaf",
    slotId: "loaf",
    src: "/sample-cats/pose-loaf.png",
  },
  {
    id: "sample-stretch",
    slotId: "stretch",
    src: "/sample-cats/pose-stretch.png",
  },
  {
    id: "sample-in-box",
    slotId: "in-box",
    src: "/sample-cats/pose-box.png",
  },
];
const COLLECTION_PHOTOS_STORAGE_KEY = "collection_photos";

export function CollectionPage() {
  const [catProfiles, setCatProfiles] = useState<CatProfile[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<CollectionGroupId>("pose");
  const [hasLoaded, setHasLoaded] = useState(false);
  const [collectionPhotos, setCollectionPhotos] = useState<Record<string, string[]>>(
    {},
  );
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isCatSheetOpen, setIsCatSheetOpen] = useState(false);

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
  }, [activeCatId]);

  const activeCatProfile =
    catProfiles.length > 0
      ? getActiveCatProfile(catProfiles, activeCatId)
      : null;
  const catName = getCatName(activeCatProfile);

  const storedCollectionPhotos = useMemo(
    () => buildStoredCollectionPhotos(collectionPhotos),
    [collectionPhotos],
  );
  const allCollectionPhotos = useMemo(
    () => [...storedCollectionPhotos, ...SAMPLE_COLLECTION_PHOTOS],
    [storedCollectionPhotos],
  );
  const photosBySlot = useMemo(
    () => groupPhotosBySlot(allCollectionPhotos),
    [allCollectionPhotos],
  );
  const progress = useMemo(
    () => buildCollectionProgress(COLLECTION_GROUPS, photosBySlot),
    [photosBySlot],
  );
  const activeGroup =
    COLLECTION_GROUPS.find((group) => group.id === activeGroupId) ??
    COLLECTION_GROUPS[0];
  const selectedSlot = selectedSlug ? getCollectionSlotBySlug(selectedSlug) : null;
  const selectedPhotos = selectedSlot
    ? photosBySlot.get(selectedSlot.id) ?? []
    : [];

  function openSheet(slot: CollectionSlot) {
    setSelectedSlug(getCollectionPhotoSlug(slot));
    setCurrentPhotoIndex(0);
  }

  function closeSheet() {
    setSelectedSlug(null);
  }

  function handleCatSelect(catId: string) {
    const nextActiveProfile = getActiveCatProfile(catProfiles, catId);

    saveActiveCatId(nextActiveProfile.id);
    setActiveCatId(nextActiveProfile.id);
    setSelectedSlug(null);
    setCurrentPhotoIndex(0);
    setIsCatSheetOpen(false);
  }

  async function handlePhotoAdd(slot: CollectionSlot) {
    if (!activeCatId) {
      return;
    }

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

      addCollectionPhoto(activeCatId, slug, dataUrl);
      setCollectionPhotos((current) => ({
        ...current,
        [slug]: [...(current[slug] ?? []), dataUrl],
      }));
    };

    input.click();
  }

  function handleDeletePhoto(slug: string, index: number) {
    if (!activeCatId) {
      return;
    }

    try {
      const raw = window.localStorage.getItem(COLLECTION_PHOTOS_STORAGE_KEY);

      if (!raw) {
        return;
      }

      const all = JSON.parse(raw) as Record<
        string,
        Record<string, string[] | string>
      >;
      const catPhotos = normalizeStoredPhotoList(all[activeCatId]?.[slug]);

      if (!catPhotos.length) {
        return;
      }

      catPhotos.splice(index, 1);

      if (catPhotos.length === 0) {
        delete all[activeCatId]?.[slug];
      } else if (all[activeCatId]) {
        all[activeCatId][slug] = catPhotos;
      }

      window.localStorage.setItem(COLLECTION_PHOTOS_STORAGE_KEY, JSON.stringify(all));
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
    } catch {
      // Ignore delete failures for this MVP fallback.
    }
  }

  function handlePhotoScroll(event: UIEvent<HTMLDivElement>) {
    const element = event.currentTarget;
    const index = Math.round(element.scrollLeft / element.offsetWidth);

    setCurrentPhotoIndex(index);
  }

  if (!hasLoaded) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <section style={styles.emptyCard}>
            <h1 style={styles.emptyTitle}>コレクション</h1>
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
        <div style={styles.container}>
          <section style={styles.emptyCard}>
            <h1 style={styles.emptyTitle}>コレクション</h1>
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
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.pageHeader}>
            <h1 style={styles.pageTitle}>コレクション</h1>
            <button
              type="button"
              onClick={() => setIsCatSheetOpen(true)}
              style={styles.catNameBtn}
            >
              {catName}
              {"▼"}
            </button>
          </div>
          <CollectionProgress
            activeGroupId={activeGroupId}
            progress={progress}
            onSelectGroup={setActiveGroupId}
          />
        </header>

        <CollectionGrid
          group={activeGroup}
          photosBySlot={photosBySlot}
          onOpenSlot={openSheet}
        />
      </div>
      {selectedSlot ? (
        <CollectionPhotoSheet
          slot={selectedSlot}
          photos={selectedPhotos}
          currentPhotoIndex={currentPhotoIndex}
          onClose={closeSheet}
          onAddPhoto={() => {
            void handlePhotoAdd(selectedSlot);
          }}
          onDeletePhoto={handleDeletePhoto}
          onPhotoScroll={handlePhotoScroll}
        />
      ) : null}
      {isCatSheetOpen ? (
        <>
          <div
            style={styles.catSheetOverlay}
            onClick={() => setIsCatSheetOpen(false)}
          />
          <div style={styles.catSheet}>
            <div style={styles.catSheetHandle} />
            <p style={styles.catSheetTitle}>猫を選ぶ</p>
            <div style={styles.catSheetGrid}>
              {catProfiles.map((profile) => {
                const isSelected = profile.id === activeCatId;
                const age = formatCatAge(profile.basicInfo?.birthDate);
                const gender = formatCatGender(profile.basicInfo?.gender);
                const meta = [gender, age].filter(Boolean).join("・");

                return (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => handleCatSelect(profile.id)}
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
                    {meta ? (
                      <span style={styles.catSheetMeta}>{meta}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <a
              href="/cats"
              style={styles.catSheetLink}
              onClick={() => setIsCatSheetOpen(false)}
            >
              ねこタブで管理する ›
            </a>
          </div>
        </>
      ) : null}
      <BottomNavigation active="collection" />
    </main>
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
        <span style={styles.progressNumber}>{progress.total.collected}</span>
        <span style={styles.progressUnit}>種類</span>
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

function CollectionGrid({
  group,
  photosBySlot,
  onOpenSlot,
}: {
  group: CollectionGroup;
  photosBySlot: Map<string, CollectionPhoto[]>;
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
  onOpenSlot,
}: {
  slot: CollectionSlot;
  photos: CollectionPhoto[];
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
        <img src={firstPhoto.src} alt="" style={styles.cardPhoto} />
        <span style={styles.cardPhotoFade} aria-hidden="true" />
        {photos.length > 1 ? (
          <span style={styles.cardCountBadge}>{photos.length}枚</span>
        ) : null}
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
  onDeletePhoto,
  onPhotoScroll,
}: {
  slot: CollectionSlot;
  photos: CollectionPhoto[];
  currentPhotoIndex: number;
  onClose: () => void;
  onAddPhoto: () => void;
  onDeletePhoto: (slug: string, index: number) => void;
  onPhotoScroll: (event: UIEvent<HTMLDivElement>) => void;
}) {
  const slug = getCollectionPhotoSlug(slot);

  return (
    <div style={styles.sheetOverlay} onClick={onClose}>
      <div style={styles.sheet} onClick={(event) => event.stopPropagation()}>
        <div style={styles.sheetHandle} />
        <div style={styles.sheetHeader}>
          <span style={styles.sheetTitle}>{getCollectionSlotLabel(slot)}</span>
          <span style={styles.sheetCount}>{photos.length}枚</span>
        </div>

        {photos.length > 0 ? (
          <div style={styles.sheetPhotoArea}>
            <div style={styles.photoScroll} onScroll={onPhotoScroll}>
              {photos.map((photo, index) => (
                <div key={photo.id} style={styles.photoSlide}>
                  <img src={photo.src} alt="" style={styles.photoImg} />
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
            <span style={styles.photoEmptyText}>まだ写真がありません</span>
          </div>
        )}

        <div style={styles.sheetActions}>
          <button type="button" style={styles.btnPrimary} onClick={onAddPhoto}>
            ＋ 写真を撮る
          </button>
          <button
            type="button"
            style={
              photos.length > 0
                ? styles.btnSecondary
                : { ...styles.btnSecondary, ...styles.btnDisabled }
            }
            disabled={photos.length === 0}
          >
            シェア
          </button>
        </div>
      </div>
    </div>
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

function buildStoredCollectionPhotos(collectionPhotos: Record<string, string[]>) {
  const photos: CollectionPhoto[] = [];

  COLLECTION_GROUPS.forEach((group) => {
    group.slots.forEach((slot) => {
      const slug = getCollectionPhotoSlug(slot);
      const slotPhotos = collectionPhotos[slug] ?? [];

      slotPhotos.forEach((src, index) => {
        photos.push({
          id: `local-${slug}-${index}`,
          slotId: slot.id,
          src,
          storageSlug: slug,
          localIndex: index,
        });
      });
    });
  });

  return photos.reverse();
}

function readCollectionPhotos(catId: string): Record<string, string[]> {
  try {
    const raw = window.localStorage.getItem(COLLECTION_PHOTOS_STORAGE_KEY);

    if (!raw) {
      return {};
    }

    const all = JSON.parse(raw) as Record<
      string,
      Record<string, string[] | string>
    >;
    const catPhotos = all[catId] ?? {};

    return Object.fromEntries(
      Object.entries(catPhotos).map(([slug, value]) => [
        slug,
        normalizeStoredPhotoList(value),
      ]),
    );
  } catch {
    return {};
  }
}

function addCollectionPhoto(catId: string, slug: string, dataUrl: string) {
  try {
    const raw = window.localStorage.getItem(COLLECTION_PHOTOS_STORAGE_KEY);
    const all = raw
      ? (JSON.parse(raw) as Record<string, Record<string, string[] | string>>)
      : {};

    if (!all[catId]) {
      all[catId] = {};
    }

    all[catId][slug] = [...normalizeStoredPhotoList(all[catId][slug]), dataUrl];
    window.localStorage.setItem(COLLECTION_PHOTOS_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Ignore localStorage quota or parse failures for this MVP fallback.
  }
}

function normalizeStoredPhotoList(value: string[] | string | undefined) {
  if (typeof value === "string") {
    return [value];
  }

  return value ?? [];
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
  return groupId === "pose" ? "ポーズ" : "シーン";
}

const COLLECTION_SLOT_LABELS: Record<string, string> = {
  "belly-up": "へそ天",
  loaf: "香箱",
  stretch: "のびー",
  "face-down-sleep": "ごめん寝",
  "curled-up": "まるまる",
  liquid: "液体化",
  sitting: "おすわり",
  "tail-up": "しっぽピーン",
  "weird-sleep": "変な寝相",
  "hidden-paws": "おててないない",
  "in-box": "箱入り",
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
  return `${slot.group}_${slot.id.replace(/-/g, "_")}`;
}

function getCollectionSlotBySlug(slug: string) {
  return (
    COLLECTION_GROUPS.flatMap((group) => group.slots).find(
      (slot) => getCollectionPhotoSlug(slot) === slug,
    ) ?? null
  );
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
    background: "linear-gradient(180deg, #fdfcf9 0%, #f7f5ef 100%)",
    color: "#242522",
  },
  container: {
    width: "min(100%, 480px)",
    margin: "0 auto",
    padding: "18px 16px calc(144px + env(safe-area-inset-bottom))",
  },
  header: {
    marginBottom: "14px",
    padding: "2px 0 0",
  },
  pageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "14px",
  },
  pageTitle: {
    margin: 0,
    color: "#252622",
    fontSize: "24px",
    lineHeight: 1.25,
    fontWeight: 650,
    letterSpacing: 0,
  },
  catNameBtn: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#6a6a62",
    background: "#f5f3ef",
    border: "0.5px solid #e0ddd6",
    borderRadius: "99px",
    padding: "4px 12px",
    cursor: "pointer",
  },
  catSheetOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.3)",
    zIndex: 50,
  },
  catSheet: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "#fbfaf7",
    borderRadius: "20px 20px 0 0",
    zIndex: 51,
    padding: "0 20px calc(32px + env(safe-area-inset-bottom))",
  },
  catSheetHandle: {
    width: "36px",
    height: "4px",
    background: "#d0cdc6",
    borderRadius: "99px",
    margin: "10px auto 16px",
  },
  catSheetTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#8a8a80",
    margin: "0 0 14px",
    textAlign: "center",
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
    background: "#f5f3ef",
    flexShrink: 0,
  },
  catSheetAvatarActive: {
    border: "3px solid #6B9E82",
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
    color: "#2a2a28",
    maxWidth: "72px",
    textAlign: "center",
    wordBreak: "break-all",
  },
  catSheetMeta: {
    fontSize: "10px",
    color: "#9a9890",
  },
  catSheetLink: {
    display: "block",
    textAlign: "center",
    fontSize: "13px",
    color: "#6B9E82",
    textDecoration: "none",
    padding: "10px 0",
  },
  title: {
    margin: 0,
    color: "#252622",
    fontSize: "24px",
    lineHeight: 1.25,
    fontWeight: 650,
    letterSpacing: 0,
  },
  progressBlock: {
    display: "grid",
    gap: "10px",
  },
  progressMain: {
    display: "flex",
    alignItems: "baseline",
    gap: "4px",
    margin: 0,
    color: "#2c2d29",
  },
  progressNumber: {
    fontSize: "30px",
    fontWeight: 700,
    lineHeight: 1,
  },
  progressUnit: {
    color: "#676963",
    fontSize: "14px",
    fontWeight: 590,
  },
  progressSub: {
    margin: "-4px 0 0",
    color: "#73746d",
    fontSize: "12px",
    fontWeight: 590,
    lineHeight: 1.4,
  },
  progressTrack: {
    position: "relative",
    width: "100%",
    height: "7px",
    borderRadius: "999px",
    background: "rgba(222, 219, 211, 0.72)",
    overflow: "hidden",
  },
  progressFill: {
    position: "absolute",
    inset: "0 auto 0 0",
    borderRadius: "999px",
    background: "linear-gradient(90deg, #a8a697, #8f9688)",
  },
  tabs: {
    display: "flex",
    gap: "6px",
    overflowX: "auto",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    paddingBottom: "2px",
  },
  tab: {
    flex: "0 0 auto",
    minWidth: "92px",
    minHeight: "38px",
    border: "1px solid rgba(220, 217, 209, 0.82)",
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.78)",
    color: "#696b64",
    font: "inherit",
    fontSize: "13px",
    fontWeight: 620,
    lineHeight: 1,
    cursor: "pointer",
  },
  activeTab: {
    border: "1px solid rgba(173, 172, 158, 0.7)",
    background: "rgba(226, 224, 214, 0.72)",
    color: "#343630",
  },
  collectionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  },
  collectionCard: {
    position: "relative",
    display: "block",
    aspectRatio: "1 / 1",
    border: "1px solid rgba(225, 222, 215, 0.72)",
    borderRadius: "18px",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(247,246,242,0.9) 100%)",
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
    width: "80px",
    height: "80px",
    objectFit: "contain",
    opacity: 0.55,
    mixBlendMode: "multiply",
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
    fontSize: "10px",
    fontWeight: 650,
    lineHeight: 1,
    padding: "2px 7px",
  },
  photoCardLabel: {
    margin: 0,
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 680,
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
    color: "#9a9890",
    fontSize: "11px",
    fontWeight: 610,
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
  sheetOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.3)",
    zIndex: 50,
    display: "flex",
    alignItems: "flex-end",
    animation: "fadeIn 0.15s ease",
  },
  sheet: {
    width: "100%",
    background: "#fbfaf7",
    borderRadius: "20px 20px 0 0",
    paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
    minHeight: "70vh",
    maxHeight: "90vh",
    overflowY: "auto",
    animation: "slideUp 0.25s ease",
  },
  sheetHandle: {
    width: "36px",
    height: "4px",
    background: "#d0cdc6",
    borderRadius: "99px",
    margin: "10px auto 14px",
  },
  sheetHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px 12px",
    borderBottom: "0.5px solid #e8e5de",
  },
  sheetTitle: {
    color: "#2a2a28",
    fontSize: "16px",
    fontWeight: 700,
  },
  sheetCount: {
    color: "#8a8a80",
    fontSize: "12px",
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
    background: "#d0cdc6",
    transition: "width 0.2s",
  },
  photoDotActive: {
    width: "14px",
    background: "#6B9E82",
  },
  photoEmpty: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    aspectRatio: "1",
    margin: "12px 16px",
    borderRadius: "16px",
    background: "#f0ede8",
  },
  photoEmptyText: {
    color: "#b0ada6",
    fontSize: "13px",
  },
  sheetActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    padding: "12px 16px 0",
  },
  btnPrimary: {
    border: "none",
    borderRadius: "12px",
    background: "#6B9E82",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 600,
    padding: "12px",
    cursor: "pointer",
  },
  btnSecondary: {
    border: "0.5px solid #d8d5ce",
    borderRadius: "12px",
    background: "#fff",
    color: "#2a2a28",
    fontSize: "13px",
    fontWeight: 500,
    padding: "12px",
    cursor: "pointer",
  },
  btnDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  emptyCard: {
    border: "1px solid #e3e0da",
    borderRadius: "26px",
    background: "#ffffff",
    padding: "20px",
  },
  emptyTitle: {
    margin: "0 0 10px",
    color: "#27272a",
    fontSize: "24px",
    lineHeight: 1.25,
    fontWeight: 700,
  },
  emptyText: {
    margin: "0 0 16px",
    color: "#686760",
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
    border: "1px solid #d4d6ce",
    background: "#e8e9e4",
    color: "#3f433d",
    padding: "0 18px",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 650,
  },
} satisfies Record<string, CSSProperties>;
