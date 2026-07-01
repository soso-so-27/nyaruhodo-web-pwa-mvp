"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import {
  clearAccountCatAvatar,
  deleteAccountCatGalleryPhoto,
  restoreCatGalleryPhotosFromAccount,
} from "../../lib/accountSync";
import { storeAccountPhotoDataUrl } from "../../lib/photoStorageClient";
import { STORAGE_KEYS } from "../../lib/storage";
import {
  markCatPickupSeen,
  readCatPickupHistory,
  selectCatPickup,
  type CatPickup,
} from "../../lib/cats/pickup";
import { createCatFootprintEntries } from "../../lib/cats/footprints";
import { createCatCelebrationItems } from "../../lib/cats/celebrations";
import type { CatCelebrationTone } from "../../lib/cats/celebrations";
import {
  createCatYearSummaries,
  type CatYearSummary,
} from "../../lib/cats/yearSummary";
import {
  CAT_GALLERY_PHOTO_LIMIT,
  deleteCatGalleryPhoto,
  readCatGalleryPhotos,
  saveCatGalleryPhoto,
  type CatGalleryPhoto,
} from "../../lib/cats/catGalleryPhotos";
import {
  readCatSleepingMilestones,
  readOwnSleepingPhotos,
  readOwnSleepingPhotoCount,
  type CatSleepingMilestone,
  type OwnSleepingPhoto,
} from "../../lib/home/sleepingPhotos";
import {
  readCatMomentsForCat,
  type CatMomentForCat,
} from "../../lib/supabase/catMomentCats";
import { createBrowserSupabaseClient } from "../../lib/supabase/browser";
import {
  disableOmoideMemories,
  hideOmoideDate,
  pauseOmoideMemories,
  readOmoideMemoriesForCat,
  readOmoideMemoryControls,
  type OmoideMemory,
} from "../../lib/home/omoideDelivery";
import { BottomNavigation } from "../navigation/BottomNavigation";
import { AppButton } from "../ui/AppButton";
import { AppBottomSheet } from "../ui/AppBottomSheet";
import { AppCard } from "../ui/AppCard";
import { AppSegmented } from "../ui/AppSegmented";
import { AppTextField } from "../ui/AppTextField";
import { PhotoTile } from "../ui/PhotoTile";
import { StoredPhotoImage } from "../ui/StoredPhotoImage";
import {
  addCatProfile,
  getActiveCatProfile,
  getCatName,
  isCatProfileNameUnset,
  readActiveCatId,
  readCatProfiles,
  saveActiveCatId,
  saveCatProfiles,
} from "../home/homeInputHelpers";
import type { CatCoat, CatProfile } from "../home/homeInputHelpers";

const COAT_OPTIONS: { value: CatCoat; label: string; color: string }[] = [
  { value: "saba", label: "サバ", color: "#d8d2c4" },
  { value: "gray", label: "グレー", color: "#d6d3d1" },
  { value: "orange_tabby", label: "茶トラ", color: "#d8bd9a" },
  { value: "black", label: "黒", color: "#625f59" },
  { value: "white", label: "白", color: "#fafafa" },
  { value: "calico", label: "三毛", color: "#f0c28b" },
];
type EditableGender = "male" | "female" | "unknown" | "";
type EditableCoat = CatCoat | "";
type UchinokoLens = "cat" | "all";
type UchinokoSection = "record" | "photos" | "basic";
const MAX_UPLOAD_SOURCE_FILE_BYTES = 20 * 1024 * 1024;
const SUPPORTED_SOURCE_IMAGE_MIME_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type LensPhoto = {
  id: string;
  src: string;
  createdAt: number;
  catIds: string[];
  catNames: string[];
  kind: "sleeping" | "photo";
  deliveryCount?: number;
};
type DeleteCatTarget = {
  profile: CatProfile;
  photoCount: number;
};
type RemoteCatDeleteResult =
  | { status: "deleted" | "skipped" }
  | { status: "error"; message: string };
type RemoteCatSaveResult =
  | { status: "saved" | "skipped" }
  | { status: "error"; message: string };
type PhotoSheetLens = "cat" | "all";
type YearSummaryDetailKind = "photos" | "pickups" | "milestones";
type RecordPhotoPreview = {
  id?: string;
  src: string;
  title: string;
  timestamp: number;
  kind?: LensPhoto["kind"];
  catIds?: string[];
};

const CATS_TEXT = "var(--ink)";
const CATS_TEXT_STRONG = "var(--ink)";
const CATS_MUTED = "var(--ink-soft)";
const CATS_FAINT = "var(--ink-faint)";
const CATS_PAPER = "var(--paper)";
const CATS_UI = "var(--font-ui)";
const CATS_SERIF = CATS_UI;
const CATS_TITLE_SIZE = "20px";
const CATS_DISPLAY_SIZE = "25px";
const CATS_BODY_SIZE = "13px";
const CATS_META_SIZE = "12px";
const CATS_TINY_SIZE = "11px";
const CATS_TITLE_TRACKING = "0.02em";
const CATS_BODY_TRACKING = "0.01em";
const CATS_META_TRACKING = "0.015em";
const CATS_PANEL_BACKGROUND = "var(--app-page-surface-strong)";
const CATS_PANEL_BACKGROUND_SOFT = "var(--app-page-surface)";
const CATS_SURFACE: CSSProperties = {
  position: "relative",
  background: "var(--app-page-surface)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-e1)",
};
const CATS_SURFACE_SOFT: CSSProperties = {
  ...CATS_SURFACE,
  background: "var(--app-page-surface-soft)",
  boxShadow: "var(--shadow-e1)",
};
const ONBOARDING_ALBUM_COMPLETION_READY_KEY =
  "neteruneko_onboarding_album_completion_ready";
const CAT_GALLERY_RESTORE_SESSION_KEY =
  "neteruneko_cat_gallery_restore_checked";
const SHOW_LEGACY_DETAIL_SECTIONS = false;

export function CatsPage() {
  const [catProfiles, setCatProfiles] = useState<CatProfile[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [catNameInput, setCatNameInput] = useState("");
  const [newCatNameInput, setNewCatNameInput] = useState("");
  const [duplicateCatNameToConfirm, setDuplicateCatNameToConfirm] =
    useState<string | null>(null);
  const [isEditingCatName, setIsEditingCatName] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [isCatManageOpen, setIsCatManageOpen] = useState(false);
  const [isCatManageEditing, setIsCatManageEditing] = useState(false);
  const [isThumbnailPickerOpen, setIsThumbnailPickerOpen] = useState(false);
  const [isOnboardingMode, setIsOnboardingMode] = useState(false);
  const [isOnboardingCompletionReady, setIsOnboardingCompletionReady] =
    useState(false);
  const [isOnboardingExistingCat, setIsOnboardingExistingCat] = useState(false);
  const [isOnboardingAlbumCreated, setIsOnboardingAlbumCreated] = useState(false);
  const [editFamilySinceDate, setEditFamilySinceDate] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editGender, setEditGender] = useState<EditableGender>("");
  const [editBreed, setEditBreed] = useState("");
  const [editCoat, setEditCoat] = useState<EditableCoat>("");
  const [editCallName, setEditCallName] = useState("");
  const [editFavoritePlace, setEditFavoritePlace] = useState("");
  const [editFavoritePlay, setEditFavoritePlay] = useState("");
  const [editFavoriteTouch, setEditFavoriteTouch] = useState("");
  const [editDislikes, setEditDislikes] = useState("");
  const [editWeightKg, setEditWeightKg] = useState("");
  const [editWeightMeasuredDate, setEditWeightMeasuredDate] = useState("");
  const [editVetClinic, setEditVetClinic] = useState("");
  const [editCareNote, setEditCareNote] = useState("");
  const [message, setMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [omoideRefreshTick, setOmoideRefreshTick] = useState(0);
  const [galleryRefreshTick, setGalleryRefreshTick] = useState(0);
  const isCatGalleryRestoreCheckRunningRef = useRef(false);
  const [activeLens, setActiveLens] = useState<UchinokoLens>("cat");
  const [activeSection, setActiveSection] =
    useState<UchinokoSection>("record");
  const [deleteCatTarget, setDeleteCatTarget] =
    useState<DeleteCatTarget | null>(null);
  const [isDeletingCat, setIsDeletingCat] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [photoSheetLens, setPhotoSheetLens] = useState<PhotoSheetLens | null>(
    null,
  );
  const [remoteLensPhotosByCat, setRemoteLensPhotosByCat] = useState<
    Record<string, LensPhoto[]>
  >({});
  const [hasRemoteLensPhotosLoaded, setHasRemoteLensPhotosLoaded] =
    useState(false);
  const [selectedOmoideMemory, setSelectedOmoideMemory] =
    useState<OmoideMemory | null>(null);
  const [selectedRecordPhoto, setSelectedRecordPhoto] =
    useState<RecordPhotoPreview | null>(null);
  const [deleteGalleryPhotoTarget, setDeleteGalleryPhotoTarget] =
    useState<RecordPhotoPreview | null>(null);
  const [isDeletingGalleryPhoto, setIsDeletingGalleryPhoto] = useState(false);
  const [selectedYearSummary, setSelectedYearSummary] =
    useState<CatYearSummary | null>(null);

  const activeCatProfile =
    catProfiles.length > 0
      ? getActiveCatProfile(catProfiles, activeCatId)
      : null;
  const catName = getCatName(activeCatProfile);
  const familyDuration = formatFamilyDuration(
    activeCatProfile?.basicInfo?.familySinceDate,
  );
  const birthdayStatus = getBirthdayStatus(activeCatProfile?.basicInfo?.birthDate);
  const takenSleepingPhotoCount = activeCatId
    ? readOwnSleepingPhotoCount(activeCatId)
    : 0;
  const omoideMemories = readOmoideMemoriesForCat(activeCatId);
  const omoideControls = readOmoideMemoryControls();
  void omoideRefreshTick;
  const sleepingMilestones = readCatSleepingMilestones(activeCatId);
  const activeAvatarSrc =
    activeCatProfile?.avatarDataUrl ??
    getCatAvatarSrc(activeCatProfile?.appearance?.coat);
  const isOnboardingProfileSetup = isOnboardingMode && isEditingProfile;
  const isOnboardingCompletionView =
    isOnboardingMode && isOnboardingCompletionReady && !isEditingProfile;
  const canManageCats = !isOnboardingProfileSetup && !isOnboardingCompletionView;
  const shouldShowCatSwitchButton = catProfiles.length > 1 && canManageCats;
  const shouldShowPhotoLensSwitch =
    catProfiles.length > 1 &&
    canManageCats &&
    !isAddingCat &&
    !isEditingProfile;
  const localLensPhotos = useMemo(
    () => createLocalLensPhotos(catProfiles),
    [catProfiles, galleryRefreshTick],
  );
  const lensPhotosByCat = mergeLensPhotoSources(
    localLensPhotos.byCat,
    remoteLensPhotosByCat,
    hasRemoteLensPhotosLoaded,
  );
  const activeCatLensPhotos = activeCatId
    ? lensPhotosByCat[activeCatId] ?? []
    : [];
  const activeCatGalleryLensPhotos = useMemo(
    () => activeCatLensPhotos.filter(isCatGalleryLensPhoto),
    [activeCatLensPhotos],
  );
  const stableSleepingCoverPhoto = useMemo(
    () => getStableSleepingCoverPhoto(activeCatLensPhotos),
    [activeCatLensPhotos],
  );
  const hasCustomThumbnail = Boolean(activeCatProfile?.avatarDataUrl);
  const activeCoverPhoto =
    activeCatGalleryLensPhotos[0] ?? stableSleepingCoverPhoto;
  const activeCoverSrc =
    activeCatProfile?.avatarDataUrl ?? activeCoverPhoto?.src ?? activeAvatarSrc;
  const activeCoverFit =
    hasCustomThumbnail || activeCoverPhoto ? "cover" : "contain";
  const allLensPhotos = useMemo(
    () =>
      mergeAllLensPhotos(
        hasRemoteLensPhotosLoaded
          ? Object.values(remoteLensPhotosByCat).flat()
          : [],
        localLensPhotos.all,
      ),
    [hasRemoteLensPhotosLoaded, localLensPhotos.all, remoteLensPhotosByCat],
  );
  const allGalleryLensPhotos = useMemo(
    () => allLensPhotos.filter(isCatGalleryLensPhoto),
    [allLensPhotos],
  );
  const photoSheetPhotos =
    photoSheetLens === "all" ? allGalleryLensPhotos : activeCatGalleryLensPhotos;
  const photoSheetTitle =
    photoSheetLens === "all" ? "ぜんぶの写真" : "この子の写真";

  useEffect(() => {
    document.documentElement.classList.add("cats-scrollbar-quiet");
    document.body.classList.add("cats-scrollbar-quiet");

    return () => {
      document.documentElement.classList.remove("cats-scrollbar-quiet");
      document.body.classList.remove("cats-scrollbar-quiet");
    };
  }, []);

  useLayoutEffect(() => {
    const requestedOnboardingMode =
      new URLSearchParams(window.location.search).get("onboarding") === "1";
    const onboardingCompletionReady =
      requestedOnboardingMode &&
      window.sessionStorage.getItem(ONBOARDING_ALBUM_COMPLETION_READY_KEY) ===
        "true";
    const onboardingMode =
      requestedOnboardingMode && onboardingCompletionReady;
    const savedCatProfiles = readCatProfiles();
    const savedActiveCatId = readActiveCatId();
    const activeProfile = getActiveCatProfile(
      savedCatProfiles,
      savedActiveCatId,
    );

    const shouldEditOnboardingProfile =
      onboardingMode && isCatProfileNameUnset(activeProfile);

    setCatProfiles(savedCatProfiles);
    setActiveCatId(activeProfile.id);
    setCatNameInput(
      shouldEditOnboardingProfile ? "" : getCatName(activeProfile),
    );
    setIsOnboardingMode(onboardingMode);
    setIsOnboardingCompletionReady(onboardingCompletionReady);
    setIsOnboardingExistingCat(onboardingMode && !shouldEditOnboardingProfile);
    if (shouldEditOnboardingProfile) {
      setIsEditingCatName(true);
      setIsEditingProfile(true);
    }
    saveActiveCatId(activeProfile.id);
  }, []);

  useEffect(() => {
    if (catProfiles.length <= 1 && activeLens !== "cat") {
      setActiveLens("cat");
    }
  }, [activeLens, catProfiles.length]);

  useEffect(() => {
    let isCancelled = false;

    async function loadRemoteLensPhotos() {
      if (catProfiles.length === 0) {
        setRemoteLensPhotosByCat({});
        setHasRemoteLensPhotosLoaded(false);
        return;
      }

      const supabase = createBrowserSupabaseClient();

      if (!supabase) {
        setRemoteLensPhotosByCat({});
        setHasRemoteLensPhotosLoaded(false);
        return;
      }

      const { data: userResult } = await supabase.auth.getUser();

      if (!userResult.user) {
        if (!isCancelled) {
          setRemoteLensPhotosByCat({});
          setHasRemoteLensPhotosLoaded(false);
        }
        return;
      }

      const localCatIds = catProfiles.map((profile) => profile.id);
      const { data: remoteCats, error } = await supabase
        .from("cats")
        .select("id, local_cat_id")
        .in("local_cat_id", localCatIds);

      if (error || !Array.isArray(remoteCats)) {
        if (!isCancelled) {
          setRemoteLensPhotosByCat({});
          setHasRemoteLensPhotosLoaded(false);
        }
        return;
      }

      const remoteByLocalCatId = new Map<string, string>();

      for (const row of remoteCats as { id: string; local_cat_id: string | null }[]) {
        if (row.local_cat_id && row.id) {
          remoteByLocalCatId.set(row.local_cat_id, row.id);
        }
      }

      const nextPhotosByCat: Record<string, LensPhoto[]> = {};

      await Promise.all(
        catProfiles.map(async (profile) => {
          const remoteCatId = remoteByLocalCatId.get(profile.id);

          if (!remoteCatId) {
            return;
          }

          const rows = await readCatMomentsForCat(supabase, remoteCatId);
          nextPhotosByCat[profile.id] = rows.map((row) =>
            createRemoteLensPhoto(row, profile),
          );
        }),
      );

      if (!isCancelled) {
        setRemoteLensPhotosByCat(nextPhotosByCat);
        setHasRemoteLensPhotosLoaded(true);
      }
    }

    void loadRemoteLensPhotos();

    return () => {
      isCancelled = true;
    };
  }, [catProfiles]);

  useEffect(() => {
    if (catProfiles.length === 0 || isCatGalleryRestoreCheckRunningRef.current) {
      return;
    }

    try {
      if (window.sessionStorage.getItem(CAT_GALLERY_RESTORE_SESSION_KEY)) {
        return;
      }
    } catch {
      // Session storage can be unavailable in some embedded browsers.
    }

    let isCancelled = false;

    async function restoreRemoteCatGalleryIfNeeded() {
      isCatGalleryRestoreCheckRunningRef.current = true;
      const localBefore = readCatGalleryPhotos(null).length;

      trackProductEvent(
        "cat_gallery_restore_started",
        {
          route: "/cats",
          local_count: localBefore,
          has_session: null,
        },
        { localCatId: activeCatId },
      );

      const result = await restoreCatGalleryPhotosFromAccount();

      if (result.hasSession && result.status !== "error") {
        try {
          window.sessionStorage.setItem(
            CAT_GALLERY_RESTORE_SESSION_KEY,
            String(Date.now()),
          );
        } catch {
          // Restore should still work even when session storage is unavailable.
        }
      }

      const eventName =
        result.status === "restored"
          ? "cat_gallery_restore_completed"
          : result.status === "empty"
            ? "cat_gallery_remote_empty"
            : result.status === "error"
              ? "cat_gallery_restore_failed"
              : "cat_gallery_local_merged";

      trackProductEvent(
        eventName,
        {
          route: "/cats",
          local_count: result.localBefore,
          remote_count: result.remoteCount,
          restored_count: result.restoredCount,
          merged_count: Math.max(0, result.localAfter - result.localBefore),
          has_session: result.hasSession,
          error_count: result.errors.length,
        },
        { localCatId: activeCatId },
      );

      if (!isCancelled && result.restoredCount > 0) {
        setGalleryRefreshTick((value) => value + 1);
      }

      isCatGalleryRestoreCheckRunningRef.current = false;
    }

    void restoreRemoteCatGalleryIfNeeded();

    return () => {
      isCancelled = true;
    };
  }, [activeCatId, catProfiles.length]);

  useEffect(() => {
    if (!isOnboardingCompletionView) {
      return;
    }

    window.sessionStorage.removeItem(ONBOARDING_ALBUM_COMPLETION_READY_KEY);
  }, [isOnboardingCompletionView]);

  function clearOnboardingAlbumCompletionReady() {
    window.sessionStorage.removeItem(ONBOARDING_ALBUM_COMPLETION_READY_KEY);
  }

  function handleCatSelect(catId: string) {
    const nextActiveProfile = getActiveCatProfile(catProfiles, catId);

    saveActiveCatId(nextActiveProfile.id);
    setActiveCatId(nextActiveProfile.id);
    setCatNameInput(getCatName(nextActiveProfile));
    setIsAddingCat(false);
    setIsEditingCatName(false);
    setIsEditingProfile(false);
    setIsOnboardingAlbumCreated(false);
    setMessage("");
    setSaveMessage("");
  }

  function handleCycleCat() {
    if (catProfiles.length <= 1) {
      return;
    }

    const currentIndex = catProfiles.findIndex(
      (profile) => profile.id === activeCatId,
    );
    const nextIndex =
      currentIndex >= 0 ? (currentIndex + 1) % catProfiles.length : 0;
    handleCatSelect(catProfiles[nextIndex].id);
  }

  function startAddingCat() {
    setNewCatNameInput("");
    setDuplicateCatNameToConfirm(null);
    setMessage("");
    setSaveMessage("");
    setIsAddingCat(true);
    setIsCatManageOpen(true);
    setIsCatManageEditing(false);
    setIsEditingCatName(false);
    setIsEditingProfile(false);
  }

  function cancelAddingCat() {
    setNewCatNameInput("");
    setDuplicateCatNameToConfirm(null);
    setIsAddingCat(false);
  }

  function handleAddCatSave() {
    const trimmedName = newCatNameInput.trim();
    const duplicateProfile = findDuplicateCatName(catProfiles, trimmedName);

    if (
      duplicateProfile &&
      duplicateCatNameToConfirm !== normalizeCatNameForMatch(trimmedName)
    ) {
      setDuplicateCatNameToConfirm(normalizeCatNameForMatch(trimmedName));
      setMessage("");
      return;
    }

    const result = addCatProfile(catProfiles, newCatNameInput);

    if (!result) {
      return;
    }

    const activeProfile = getActiveCatProfile(
      result.profiles,
      result.activeCatId,
    );

    setCatProfiles(result.profiles);
    setActiveCatId(result.activeCatId);
    setCatNameInput(activeProfile.name);
    setNewCatNameInput("");
    setDuplicateCatNameToConfirm(null);
    setIsAddingCat(false);
    setIsCatManageOpen(false);
    trackProductEvent(
      "cat_album_created",
      {
        source: "cat_manage",
        method: "add_cat",
      },
      { localCatId: result.activeCatId },
    );
    trackProductEvent(
      "cat_name_saved",
      {
        source: "cat_manage",
        method: "add_cat",
      },
      { localCatId: result.activeCatId },
    );
    setMessage("保存しました。");
  }

  function handleStartEdit() {
    setCatNameInput(activeCatProfile?.name ?? catName);
    setEditFamilySinceDate(activeCatProfile?.basicInfo?.familySinceDate ?? "");
    setEditBirthDate(activeCatProfile?.basicInfo?.birthDate ?? "");
    setEditGender(activeCatProfile?.basicInfo?.gender ?? "");
    setEditBreed(activeCatProfile?.basicInfo?.breed ?? "");
    setEditCoat(activeCatProfile?.appearance?.coat ?? "");
    setEditCallName(activeCatProfile?.basicInfo?.personality?.callName ?? "");
    setEditFavoritePlace(
      activeCatProfile?.basicInfo?.personality?.favoritePlace ?? "",
    );
    setEditFavoritePlay(
      activeCatProfile?.basicInfo?.personality?.favoritePlay ?? "",
    );
    setEditFavoriteTouch(
      activeCatProfile?.basicInfo?.personality?.favoriteTouch ?? "",
    );
    setEditDislikes(activeCatProfile?.basicInfo?.personality?.dislikes ?? "");
    setEditWeightKg(
      formatEditableWeight(activeCatProfile?.basicInfo?.care?.weightKg),
    );
    setEditWeightMeasuredDate(
      activeCatProfile?.basicInfo?.care?.weightMeasuredDate ?? "",
    );
    setEditVetClinic(activeCatProfile?.basicInfo?.care?.vetClinic ?? "");
    setEditCareNote(activeCatProfile?.basicInfo?.care?.careNote ?? "");
    setMessage("");
    setSaveMessage("");
    setIsAddingCat(false);
    setIsEditingCatName(true);
    setIsEditingProfile(true);
  }

  function openCatManageEditor() {
    handleStartEdit();
    setIsCatManageEditing(true);
    setIsCatManageOpen(true);
  }

  function cancelEditingCatName() {
    setCatNameInput(catName);
    setMessage("");
    setSaveMessage("");
    setIsEditingCatName(false);
    setIsEditingProfile(false);
    setIsCatManageEditing(false);
  }

  async function handleSaveProfile() {
    if (isSavingProfile) {
      return;
    }

    setIsSavingProfile(true);
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.catProfiles);

      if (!raw) {
        return;
      }

      const profiles = JSON.parse(raw) as CatProfile[];
      const index = profiles.findIndex((profile) => profile.id === activeCatId);

      if (index === -1) {
        return;
      }

      const parsedWeightKg = parseEditableWeightKg(editWeightKg);
      if (parsedWeightKg === "invalid") {
        setSaveMessage("体重は0.5〜20kgの範囲で入力してください。");
        return;
      }

      const nextPersonality = buildCatPersonalityInfo({
        callName: editCallName,
        favoritePlace: editFavoritePlace,
        favoritePlay: editFavoritePlay,
        favoriteTouch: editFavoriteTouch,
        dislikes: editDislikes,
      });
      const nextCare = buildCatCareInfo({
        weightKg: parsedWeightKg,
        weightMeasuredDate: editWeightMeasuredDate,
        vetClinic: editVetClinic,
        careNote: editCareNote,
      });
      const nextProfile = {
        ...profiles[index],
        name: catNameInput.trim() || profiles[index].name,
        basicInfo: {
          familySinceDate: editFamilySinceDate || undefined,
          birthDate: editBirthDate || undefined,
          gender: editGender || undefined,
          breed: editBreed.trim() || undefined,
          personality: nextPersonality,
          care: nextCare,
        },
        appearance: {
          ...(profiles[index].appearance ?? {}),
          coat: editCoat || undefined,
        },
        updatedAt: new Date().toISOString(),
      } satisfies CatProfile;
      const nextProfiles = profiles.map((profile, profileIndex) =>
        profileIndex === index ? nextProfile : profile,
      );
      const didSaveName = nextProfile.name !== profiles[index].name;

      window.localStorage.setItem(
        STORAGE_KEYS.catProfiles,
        JSON.stringify(nextProfiles),
      );
      setCatProfiles(nextProfiles);
      setActiveCatId(nextProfile.id);
      setCatNameInput(nextProfile.name);
      const remoteSaveResult = await saveRemoteCatProfile(nextProfile);
      if (didSaveName) {
        trackProductEvent(
          "cat_name_saved",
          {
            source: isOnboardingMode ? "onboarding" : "cat_profile",
            method: "profile_save",
          },
          { localCatId: nextProfile.id },
        );
      }
      setIsEditingCatName(false);
      setIsEditingProfile(false);
      setIsCatManageEditing(false);
      if (isOnboardingMode) {
        trackProductEvent(
          "cat_album_created",
          {
            source: "onboarding",
            method: "profile_save",
          },
          { localCatId: nextProfile.id },
        );
        trackProductEvent(
          "onboarding_completed",
          {
            source: "onboarding",
            method: "cat_profile_save",
          },
          { localCatId: nextProfile.id },
        );
        setIsOnboardingAlbumCreated(true);
        setSaveMessage("");
        return;
      }

      setSaveMessage(
        remoteSaveResult.status === "error"
          ? "この端末には保存しました。Google連携への反映はあとでやり直します。"
          : "保存しました。",
      );
      setTimeout(() => setSaveMessage(""), 2000);
    } catch {
      return;
    } finally {
      setIsSavingProfile(false);
    }
  }

  function updateActiveCatThumbnail(photoSrc: string | undefined) {
    if (!activeCatId) {
      return;
    }

    const targetCatId = activeCatId;
    const raw = window.localStorage.getItem(STORAGE_KEYS.catProfiles);

    if (!raw) {
      return;
    }

    const profiles = JSON.parse(raw) as CatProfile[];
    const index = profiles.findIndex((profile) => profile.id === targetCatId);

    if (index === -1) {
      return;
    }

    const nextProfile = {
      ...profiles[index],
      avatarDataUrl: photoSrc,
      updatedAt: new Date().toISOString(),
    } satisfies CatProfile;
    const nextProfiles = profiles.map((profile, profileIndex) =>
      profileIndex === index ? nextProfile : profile,
    );

    saveCatProfiles(nextProfiles);
    setCatProfiles(nextProfiles);
    setSaveMessage(photoSrc ? "サムネイルを変えました。" : "自動表示に戻しました。");
    setTimeout(() => setSaveMessage(""), 2000);
  }

  function isGalleryPhotoAvatar(photo: RecordPhotoPreview) {
    return catProfiles.some(
      (profile) =>
        photo.catIds?.includes(profile.id) && profile.avatarDataUrl === photo.src,
    );
  }

  async function handleAvatarUpload() {
    if (!activeCatId) {
      return;
    }

    const targetCatId = activeCatId;
    const input = document.createElement("input");

    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];

      if (!file) {
        return;
      }

      try {
        assertSupportedSourceImage(file);
        const dataUrl = await resizeAndEncode(file, 800);
        const photoSrc = await storeAccountPhotoDataUrl({
          dataUrl,
          pathSegments: [targetCatId, "avatar"],
          fileName: "avatar",
        });
        if (!isStoragePhotoReference(photoSrc)) {
          setSaveMessage("代表写真を保存できませんでした。");
          setTimeout(() => setSaveMessage(""), 2400);
          return;
        }
        updateActiveCatThumbnail(photoSrc);
        setIsThumbnailPickerOpen(false);
      } catch {
        setSaveMessage("代表写真を保存できませんでした。");
        setTimeout(() => setSaveMessage(""), 2400);
        return;
      }
    };

    input.click();
  }

  async function handleAddCatPhoto() {
    if (!activeCatId) {
      return;
    }

    const targetCatId = activeCatId;
    if (readCatGalleryPhotos(targetCatId).length >= CAT_GALLERY_PHOTO_LIMIT) {
      setSaveMessage(
        `この子の写真は${CAT_GALLERY_PHOTO_LIMIT}枚までです。残したい写真を整理してから追加してください。`,
      );
      setTimeout(() => setSaveMessage(""), 2400);
      return;
    }

    const input = document.createElement("input");

    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];

      if (!file) {
        return;
      }

      try {
        assertSupportedSourceImage(file);
        const dataUrl = await resizeAndEncode(file, 2560, 0.88);
        const photoSrc = await storeAccountPhotoDataUrl({
          dataUrl,
          pathSegments: [targetCatId, "photos"],
          fileName: `photo-${Date.now()}`,
        });
        if (!isStoragePhotoReference(photoSrc)) {
          setSaveMessage("写真を追加できませんでした。");
          setTimeout(() => setSaveMessage(""), 2400);
          return;
        }
        const savedPhoto = saveCatGalleryPhoto({
          catId: targetCatId,
          src: photoSrc,
        });

        if (!savedPhoto) {
          setSaveMessage("写真を追加できませんでした。");
          setTimeout(() => setSaveMessage(""), 2400);
          return;
        }

        setGalleryRefreshTick((value) => value + 1);
        setActiveSection("photos");
        setActiveLens("cat");
        trackProductEvent(
          "cat_gallery_photo_added",
          {
            route: "/cats",
            source: "cats_photos_tab",
            cat_id: targetCatId,
          },
          { localCatId: targetCatId },
        );
        setSaveMessage("写真を追加しました。");
        setTimeout(() => setSaveMessage(""), 2000);
      } catch {
        setSaveMessage("写真を追加できませんでした。");
        setTimeout(() => setSaveMessage(""), 2400);
      }
    };

    input.click();
  }

  function requestDeleteGalleryPhoto(photo: RecordPhotoPreview) {
    if (photo.kind !== "photo" || !photo.id) {
      return;
    }

    setDeleteGalleryPhotoTarget(photo);
  }

  function cancelDeleteGalleryPhoto() {
    if (isDeletingGalleryPhoto) {
      return;
    }

    if (deleteGalleryPhotoTarget) {
      trackProductEvent(
        "cat_gallery_photo_delete_cancelled",
        {
          route: "/cats",
          source: "photo_viewer",
          cat_id: deleteGalleryPhotoTarget.catIds?.[0] ?? null,
          is_avatar_photo: isGalleryPhotoAvatar(deleteGalleryPhotoTarget),
        },
        { localCatId: deleteGalleryPhotoTarget.catIds?.[0] ?? activeCatId },
      );
    }
    setDeleteGalleryPhotoTarget(null);
  }

  async function confirmDeleteGalleryPhoto() {
    const target = deleteGalleryPhotoTarget;

    if (!target?.id || isDeletingGalleryPhoto) {
      return;
    }

    const targetCatId = target.catIds?.[0] ?? activeCatId;
    const wasAvatarPhoto = isGalleryPhotoAvatar(target);

    setIsDeletingGalleryPhoto(true);

    try {
      if (wasAvatarPhoto && targetCatId) {
        await clearAccountCatAvatar(targetCatId);
      }

      await deleteAccountCatGalleryPhoto(target.id);

      if (wasAvatarPhoto) {
        const nextProfiles = catProfiles.map((profile) =>
          profile.avatarDataUrl === target.src
            ? {
                ...profile,
                avatarDataUrl: undefined,
                updatedAt: new Date().toISOString(),
              }
            : profile,
        );

        saveCatProfiles(nextProfiles);
        setCatProfiles(nextProfiles);
      }

      const deletedPhoto = deleteCatGalleryPhoto(target.id);

      if (!deletedPhoto) {
        setDeleteGalleryPhotoTarget(null);
        return;
      }

      setGalleryRefreshTick((value) => value + 1);
      setSelectedRecordPhoto(null);
      setDeleteGalleryPhotoTarget(null);
      trackProductEvent(
        "cat_gallery_photo_deleted",
        {
          route: "/cats",
          source: "photo_viewer",
          cat_id: targetCatId ?? null,
          is_avatar_photo: wasAvatarPhoto,
        },
        { localCatId: targetCatId ?? activeCatId },
      );
      setSaveMessage("この子の写真から削除しました。");
      setTimeout(() => setSaveMessage(""), 2200);
    } catch {
      setSaveMessage("写真を削除できませんでした。もう一度お試しください。");
      setTimeout(() => setSaveMessage(""), 2600);
    } finally {
      setIsDeletingGalleryPhoto(false);
    }
  }

  function startDeleteCat(profile: CatProfile) {
    if (catProfiles.length <= 1) {
      setMessage("最後の1匹は消せません");
      return;
    }

    setDeleteCatTarget({
      profile,
      photoCount: getCatDeletePhotoCount(profile.id, lensPhotosByCat),
    });
    setMessage("");
    setSaveMessage("");
  }

  async function confirmDeleteCat() {
    if (!deleteCatTarget || isDeletingCat) {
      return;
    }

    if (catProfiles.length <= 1) {
      setMessage("最後の1匹は消せません");
      setDeleteCatTarget(null);
      return;
    }

    const target = deleteCatTarget.profile;
    const nextProfiles = catProfiles.filter((profile) => profile.id !== target.id);
    const nextActiveProfile =
      activeCatId === target.id
        ? nextProfiles[0]
        : getActiveCatProfile(nextProfiles, activeCatId);

    if (!nextActiveProfile) {
      setMessage("最後の1匹は消せません");
      setDeleteCatTarget(null);
      return;
    }

    setIsDeletingCat(true);
    const remoteDeleteResult = await deleteRemoteCatProfile(
      target,
      nextActiveProfile.id,
    );

    if (remoteDeleteResult.status === "error") {
      setIsDeletingCat(false);
      setMessage(`削除できませんでした。${remoteDeleteResult.message}`);
      return;
    }

    saveCatProfiles(nextProfiles);
    saveActiveCatId(nextActiveProfile.id);
    setCatProfiles(nextProfiles);
    setActiveCatId(nextActiveProfile.id);
    setCatNameInput(getCatName(nextActiveProfile));
    setDeleteCatTarget(null);
    setIsDeletingCat(false);
    setIsAddingCat(false);
    setIsEditingCatName(false);
    setIsEditingProfile(false);
    setSelectedOmoideMemory(null);
    setRemoteLensPhotosByCat((current) => {
      const next = { ...current };
      delete next[target.id];
      return next;
    });
    if (nextProfiles.length <= 1) {
      setActiveLens("cat");
    }
    setMessage(`${getCatName(target)}を消しました`);
  }

  const selectedCoat = activeCatProfile?.appearance?.coat;

  return (
    <main className="cats-page" data-testid="cats-page" style={styles.page}>
      <style>{`
        .cats-scrollbar-quiet {
          scrollbar-width: none;
        }

        .cats-scrollbar-quiet::-webkit-scrollbar,
        .cats-page::-webkit-scrollbar,
        .cats-page *::-webkit-scrollbar {
          width: 0;
          height: 0;
          display: none;
        }
      `}</style>
      <PageBackdrop />
      <div style={styles.container}>
        {isOnboardingMode ? (
          <AppCard
            variant="section"
            padding="md"
            style={styles.onboardingPanel}
            aria-label="オンボーディング"
          >
            <p style={styles.onboardingKicker}>
              {isEditingProfile
                ? "このねこの場所"
                : isOnboardingExistingCat && !isOnboardingAlbumCreated
                  ? "アルバムに入りました"
                  : "アルバムができました"}
            </p>
            <h2 style={styles.onboardingTitle}>
              {isEditingProfile ? "このねこの名前は？" : "また寝ていたら、ここへ。"}
            </h2>
            {isEditingProfile ? (
              <p style={styles.onboardingText}>
                名前だけで大丈夫です。あとから変えられます。
              </p>
            ) : null}
            {!isEditingProfile ? (
              <AppButton
                href="/home"
                onClick={clearOnboardingAlbumCompletionReady}
                variant="secondary"
                size="md"
                style={styles.onboardingHomeButton}
              >
                ねてるねこへ
              </AppButton>
            ) : null}
          </AppCard>
        ) : null}

        {activeCatProfile && !isOnboardingCompletionView ? (
          <div
            style={
              isOnboardingProfileSetup
                ? styles.profileCard
                : styles.profilePlaceCard
            }
          >
            {!isOnboardingProfileSetup ? (
              <>
                <div style={styles.profileCoverHero}>
                  <div
                    data-testid="cats-profile-cover"
                    style={styles.profileCoverFrame}
                  >
                    <PhotoTile
                      src={activeCoverSrc}
                      alt=""
                      variant="bare"
                      fit={activeCoverFit}
                      aspect="auto"
                      loading="eager"
                      style={styles.profileCoverTileRoot}
                      imageStyle={styles.profileCoverImage}
                    />
                    {shouldShowCatSwitchButton ? (
                      <button
                        type="button"
                        style={styles.profileCoverSwitchButton}
                        onClick={handleCycleCat}
                        aria-label="次のねこに切り替える"
                      >
                        <img
                          src="/icons/cat-switch-generated.png"
                          alt=""
                          style={styles.profileCoverSwitchIcon}
                        />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      data-testid="cats-thumbnail-picker-button"
                      style={styles.profileCoverThumbnailButton}
                      onClick={() => setIsThumbnailPickerOpen(true)}
                    >
                      写真を変える
                    </button>
                  </div>
                </div>
              </>
            ) : null}

            {isEditingProfile ? (
              <>
                {!isOnboardingProfileSetup ? <hr style={styles.divider} /> : null}
                {isEditingCatName ? (
                  <AppCard as="div" variant="inset" padding="sm" style={styles.editor}>
                    <AppTextField
                      id="cat-name"
                      type="text"
                      label="この子の名前"
                      value={catNameInput}
                      onChange={(event) => setCatNameInput(event.target.value)}
                      placeholder={isOnboardingProfileSetup ? "例：むぎ" : "例：ミケ"}
                    />
                    {!isOnboardingProfileSetup ? (
                      <>
                        <AppTextField
                          type="date"
                          label="家族になった日"
                          value={editFamilySinceDate}
                          onChange={(event) =>
                            setEditFamilySinceDate(event.target.value)
                          }
                          max={new Date().toISOString().split("T")[0]}
                        />

                        <AppTextField
                          type="date"
                          label="誕生日"
                          value={editBirthDate}
                          onChange={(event) => setEditBirthDate(event.target.value)}
                          max={new Date().toISOString().split("T")[0]}
                        />

                        <AppSegmented<EditableGender>
                          value={editGender}
                          ariaLabel="性別"
                          columns={3}
                          onChange={setEditGender}
                          options={[
                            { value: "male", label: "男の子" },
                            { value: "female", label: "女の子" },
                            { value: "unknown", label: "わからない" },
                          ]}
                        />

                        <AppTextField
                          type="text"
                          label="猫種・タイプ"
                          value={editBreed}
                          onChange={(event) => setEditBreed(event.target.value)}
                          placeholder="例：サバトラ、雑種・ミックス"
                        />
                      </>
                    ) : null}

                    <div style={styles.actions}>
                      {isOnboardingProfileSetup ? (
                        <AppButton
                          type="button"
                          onClick={handleSaveProfile}
                          size="md"
                        >
                          アルバムをつくる
                        </AppButton>
                      ) : (
                        <AppButton type="button" onClick={handleSaveProfile} variant="primary" size="md">
                          保存
                        </AppButton>
                      )}
                    </div>
                  </AppCard>
                ) : null}

                {!isOnboardingProfileSetup ? (
                  <CoatSelector
                    currentCoat={editCoat || selectedCoat}
                    onSelect={setEditCoat}
                  />
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        {activeCatProfile && !isOnboardingCompletionView ? (
          <UchinokoSectionTabs
            value={activeSection}
            onChange={setActiveSection}
            options={[
              { value: "record", label: "記録" },
              { value: "photos", label: "写真" },
              { value: "basic", label: "基本" },
            ]}
          />
        ) : null}

        {activeCatProfile &&
        !isOnboardingCompletionView &&
        activeSection === "basic" ? (
          <AppCard
            as="section"
            variant="section"
            padding="md"
            style={styles.basicInfoPanel}
          >
            <CatBasicProfilePanel
              profile={activeCatProfile}
              onEdit={openCatManageEditor}
              onManage={() => {
                setIsCatManageEditing(false);
                setIsAddingCat(false);
                setIsCatManageOpen(true);
              }}
            />
          </AppCard>
        ) : null}

        {activeCatProfile &&
        !isOnboardingCompletionView &&
        activeSection === "photos" &&
        shouldShowPhotoLensSwitch ? (
          <PhotoLensFilter
            value={activeLens}
            onChange={setActiveLens}
          />
        ) : null}

        {activeCatProfile &&
        !isOnboardingCompletionView &&
        activeSection === "photos" &&
        activeLens === "cat" ? (
          <LensPhotoSection
            title="この子の写真"
            photos={activeCatGalleryLensPhotos}
            emptyCopy="毎日のねがおは別にたまります。ここには「この子の写真を残す」で選んだ写真だけが入ります。"
            onAddPhoto={() => {
              void handleAddCatPhoto();
            }}
            onOpenPhoto={(photo) => setSelectedRecordPhoto(toRecordPhotoPreview(photo))}
          />
        ) : null}

        {activeCatProfile &&
        !isOnboardingCompletionView &&
        activeSection === "photos" &&
        activeLens === "all" ? (
          <AllCatsLensView
            photos={allGalleryLensPhotos}
            catCount={catProfiles.length}
            onOpenPhoto={(photo) => setSelectedRecordPhoto(toRecordPhotoPreview(photo))}
          />
        ) : null}

        {activeCatProfile &&
        !isOnboardingCompletionView &&
        activeSection === "record" ? (
          <RecordOverview
            activeCatId={activeCatId}
            photos={activeCatLensPhotos}
            milestones={sleepingMilestones}
            memories={omoideMemories}
            familyDuration={familyDuration}
            birthdayStatus={birthdayStatus}
            takenSleepingPhotoCount={takenSleepingPhotoCount}
            onOpenMemory={(memory) => setSelectedOmoideMemory(memory)}
            onOpenPhoto={(photo) => setSelectedRecordPhoto(photo)}
            onOpenPhotos={() => setPhotoSheetLens("cat")}
            onOpenYear={(summary) => setSelectedYearSummary(summary)}
          />
        ) : null}

        {activeCatProfile &&
        !isOnboardingCompletionView &&
        activeSection === "record" &&
        SHOW_LEGACY_DETAIL_SECTIONS ? (
          <>
            <AppCard
              as="section"
              variant="section"
              padding="md"
              style={styles.recordPanel}
            >
              <p style={styles.bunbakoSectionTitle}>記録</p>
              <p style={styles.sectionLead}>写真と思い出から、自動でたまります。</p>
              <AppCard as="div" variant="inset" padding="sm" style={styles.recordList}>
                <div style={styles.recordRow}>
                  <span style={styles.recordLabel}>
                    {getCurrentSeasonCountLabel(
                      activeCatProfile.basicInfo?.familySinceDate,
                    )}
                  </span>
                  <span style={styles.recordMetricValue}>
                    {getCurrentSeasonName()}
                  </span>
                </div>
                <div style={styles.recordRow}>
                  <span style={styles.recordLabel}>とどいた思い出</span>
                  <span style={styles.recordMetricValue}>
                    {omoideMemories.length}通
                  </span>
                </div>
                <div style={styles.recordRow}>
                  <span style={styles.recordLabel}>とったねがお</span>
                  <span style={styles.recordMetricValue}>
                    {takenSleepingPhotoCount}枚
                  </span>
                </div>
                <div style={{ ...styles.recordRow, ...styles.recordRowLast }}>
                  <span style={styles.recordLabel}>関係の記録</span>
                  <span style={styles.recordMetricValue}>
                    家族になった日から
                  </span>
                </div>
              </AppCard>
            </AppCard>
            <AppCard as="section" variant="section" padding="md" style={styles.daysThread}>
              <p style={styles.bunbakoSectionTitle}>{catName}との 日々</p>
              <p style={styles.sectionLead}>ねがおがふえるほど、ここも育ちます。</p>
              <div style={styles.threadLine}>
                <div style={styles.threadNode}>
                  <span style={styles.threadNodeTitle}>今月の {catName}</span>
                  <span style={styles.threadNodeText}>
                    {getDaysThreadIntro(
                      catName,
                      activeCatProfile.basicInfo?.familySinceDate,
                    )}
                  </span>
                </div>
                <div style={styles.threadNode}>
                  <span style={styles.threadNodeTitle}>これまで</span>
                  <span style={styles.threadNodeText}>
                    思い出 {omoideMemories.length}通 ・ ねがお{" "}
                    {takenSleepingPhotoCount}枚
                  </span>
                </div>
              </div>
            </AppCard>
          </>
        ) : null}

        {message ? <p style={styles.message}>{message}</p> : null}
        {saveMessage ? <p style={styles.message}>{saveMessage}</p> : null}
      </div>
      {!isOnboardingProfileSetup && !isOnboardingCompletionView ? (
        <BottomNavigation active="cats" />
      ) : null}
      {isCatManageOpen && activeCatProfile ? (
        <AppBottomSheet
          title={
            isCatManageEditing
              ? "基本情報を編集"
              : isAddingCat
                ? "ねこをふやす"
                : "うちのこを管理"
          }
          onClose={() => {
            setIsCatManageOpen(false);
            if (isCatManageEditing) {
              cancelEditingCatName();
            } else if (isAddingCat) {
              cancelAddingCat();
            } else {
              setIsCatManageEditing(false);
            }
          }}
        >
          <div style={styles.catManageSheet}>
            {isAddingCat ? (
              <div style={styles.catManageEditor}>
                <div style={styles.catManageEditorHero}>
                  <span style={styles.catManageAddAvatar} aria-hidden="true">
                    <AddSmallIcon />
                  </span>
                  <div style={styles.catManageEditorHeroText}>
                    <p style={styles.catManageEditorKicker}>新しい子</p>
                    <p style={styles.catManageEditorName}>
                      {newCatNameInput.trim() || "名前を入れる"}
                    </p>
                  </div>
                </div>

                <section style={styles.catManageFormSection}>
                  <p style={styles.catManageFormTitle}>名前</p>
                  <AppTextField
                    id="new-cat-name"
                    type="text"
                    label="この子の名前"
                    value={newCatNameInput}
                    onChange={(event) => {
                      setNewCatNameInput(event.target.value);
                      setDuplicateCatNameToConfirm(null);
                    }}
                    placeholder="例：麦"
                  />
                  {duplicateCatNameToConfirm ? (
                    <p style={styles.duplicateCatWarning}>
                      おなじこかもしれません。別のねことして保存しますか？
                    </p>
                  ) : null}
                </section>

                <div style={styles.catManageEditorActions}>
                  <AppButton
                    type="button"
                    variant="quiet"
                    fullWidth
                    onClick={cancelAddingCat}
                  >
                    戻る
                  </AppButton>
                  <AppButton
                    type="button"
                    variant="primary"
                    fullWidth
                    onClick={handleAddCatSave}
                  >
                    {duplicateCatNameToConfirm ? "別のねことして保存" : "保存"}
                  </AppButton>
                </div>
              </div>
            ) : isCatManageEditing ? (
              <div style={styles.catManageEditor}>
                <div style={styles.catManageEditorIntro}>
                  <p style={styles.catManageEditorKicker}>基本情報</p>
                  <p style={styles.catManageEditorIntroTitle}>
                    {catNameInput.trim() || activeCatProfile.name}のこと
                  </p>
                  <p style={styles.catManageEditorIntroText}>
                    あとから見返したいことだけ、少しずつ残せます。
                  </p>
                </div>

                <section style={styles.catManageFormSection}>
                  <div style={styles.catManageFormHeading}>
                    <p style={styles.catManageFormTitle}>名前と日付</p>
                    <p style={styles.catManageFormNote}>
                      名前と、家族になった日・誕生日を残します。
                    </p>
                  </div>
                  <AppTextField
                    id="cat-manage-name"
                    type="text"
                    label="この子の名前"
                    value={catNameInput}
                    onChange={(event) => setCatNameInput(event.target.value)}
                    placeholder="例：むぎ"
                  />
                  <div style={styles.catManageDateGrid}>
                    <AppTextField
                      type="date"
                      label="家族になった日"
                      value={editFamilySinceDate}
                      onChange={(event) =>
                        setEditFamilySinceDate(event.target.value)
                      }
                      max={new Date().toISOString().split("T")[0]}
                    />
                    <AppTextField
                      type="date"
                      label="誕生日"
                      value={editBirthDate}
                      onChange={(event) => setEditBirthDate(event.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                </section>

                <section style={styles.catManageFormSection}>
                  <div style={styles.catManageFormHeading}>
                    <p style={styles.catManageFormTitle}>見た目</p>
                    <p style={styles.catManageFormNote}>
                      わかるところだけで大丈夫です。
                    </p>
                  </div>
                  <AppSegmented<EditableGender>
                    value={editGender}
                    ariaLabel="性別"
                    columns={1}
                    onChange={setEditGender}
                    options={[
                      { value: "male", label: "男の子" },
                      { value: "female", label: "女の子" },
                      { value: "unknown", label: "わからない" },
                    ]}
                  />
                  <AppTextField
                    type="text"
                    label="猫種・タイプ"
                    value={editBreed}
                    onChange={(event) => setEditBreed(event.target.value)}
                    placeholder="例：サバトラ、雑種・ミックス"
                  />
                  <CoatSelector
                    currentCoat={editCoat || selectedCoat}
                    onSelect={setEditCoat}
                  />
                </section>

                <section style={styles.catManageFormSection}>
                  <div style={styles.catManageFormHeading}>
                    <p style={styles.catManageFormTitle}>この子らしさ</p>
                    <p style={styles.catManageFormNote}>
                      好きな場所や苦手なことを、短くメモできます。
                    </p>
                  </div>
                  <AppTextField
                    type="text"
                    label="よく呼ぶ名前"
                    value={editCallName}
                    maxLength={50}
                    onChange={(event) => setEditCallName(event.target.value)}
                    placeholder="例：むぎちゃん"
                  />
                  <AppTextField
                    as="textarea"
                    label="好きな場所"
                    value={editFavoritePlace}
                    maxLength={120}
                    onChange={(event) => setEditFavoritePlace(event.target.value)}
                    placeholder="例：ソファの右端"
                  />
                  <AppTextField
                    as="textarea"
                    label="好きな遊び"
                    value={editFavoritePlay}
                    maxLength={120}
                    onChange={(event) => setEditFavoritePlay(event.target.value)}
                    placeholder="例：ひも、追いかけっこ"
                  />
                  <AppTextField
                    as="textarea"
                    label="なでられると好きなところ"
                    value={editFavoriteTouch}
                    maxLength={120}
                    onChange={(event) => setEditFavoriteTouch(event.target.value)}
                    placeholder="例：あごの下"
                  />
                  <AppTextField
                    as="textarea"
                    label="苦手なこと"
                    value={editDislikes}
                    maxLength={120}
                    onChange={(event) => setEditDislikes(event.target.value)}
                    placeholder="例：掃除機、大きな音"
                  />
                </section>

                <section style={styles.catManageFormSection}>
                  <div style={styles.catManageFormHeading}>
                    <p style={styles.catManageFormTitle}>ケアのメモ</p>
                    <p style={styles.catManageFormNote}>
                      体重や病院のことを、必要な分だけ残せます。
                    </p>
                  </div>
                  <div style={styles.catManageDateGrid}>
                    <AppTextField
                      type="number"
                      label="体重"
                      value={editWeightKg}
                      min="0.5"
                      max="20"
                      step="0.1"
                      inputMode="decimal"
                      onChange={(event) => setEditWeightKg(event.target.value)}
                      placeholder="例：4.8"
                      hint="kg"
                    />
                    <AppTextField
                      type="date"
                      label="最後に測った日"
                      value={editWeightMeasuredDate}
                      onChange={(event) =>
                        setEditWeightMeasuredDate(event.target.value)
                      }
                      max={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <AppTextField
                    type="text"
                    label="かかりつけ"
                    value={editVetClinic}
                    maxLength={80}
                    onChange={(event) => setEditVetClinic(event.target.value)}
                    placeholder="例：○○動物病院"
                  />
                  <AppTextField
                    as="textarea"
                    label="気をつけること"
                    value={editCareNote}
                    maxLength={180}
                    onChange={(event) => setEditCareNote(event.target.value)}
                    placeholder="例：爪切りが苦手"
                  />
                </section>

                <div style={styles.catManageEditorActions}>
                  <AppButton
                    type="button"
                    variant="quiet"
                    fullWidth
                    onClick={cancelEditingCatName}
                    disabled={isSavingProfile}
                  >
                    戻る
                  </AppButton>
                  <AppButton
                    type="button"
                    variant="primary"
                    fullWidth
                    onClick={handleSaveProfile}
                    loading={isSavingProfile}
                    loadingLabel="保存中"
                  >
                    保存
                  </AppButton>
                </div>
              </div>
            ) : (
              <>
            <AppButton
              type="button"
              variant="secondary"
              fullWidth
              iconStart={<AddSmallIcon />}
              onClick={() => {
                startAddingCat();
              }}
            >
              ねこをふやす
            </AppButton>
            {canManageCats && catProfiles.length > 1 ? (
              <AppButton
                type="button"
                variant="danger"
                fullWidth
                onClick={() => {
                  setIsCatManageOpen(false);
                  startDeleteCat(activeCatProfile);
                }}
              >
                この子を消す
              </AppButton>
            ) : null}
              </>
            )}
          </div>
        </AppBottomSheet>
      ) : null}
      {deleteCatTarget ? (
        <AppBottomSheet
          title="この子を消しますか？"
          onClose={() => {
            if (!isDeletingCat) {
              setDeleteCatTarget(null);
            }
          }}
        >
          <div style={styles.deleteCatConfirm}>
            <p style={styles.deleteCatConfirmTitle}>
              {getCatName(deleteCatTarget.profile)}・写真
              {deleteCatTarget.photoCount}枚 を消しますか？
            </p>
            <p style={styles.deleteCatConfirmText}>
              {deleteCatTarget.photoCount > 0
                ? "写真がある子です。写真そのものは消さず、この子との紐づきだけ外します。"
                : "写真がまだない子です。プロフィールだけを消します。"}
            </p>
            <div style={styles.deleteCatConfirmActions}>
              <AppButton
                type="button"
                variant="danger"
                fullWidth
                onClick={() => void confirmDeleteCat()}
                disabled={isDeletingCat}
              >
                {isDeletingCat ? "消しています" : "消す"}
              </AppButton>
              <AppButton
                type="button"
                variant="quiet"
                fullWidth
                onClick={() => setDeleteCatTarget(null)}
                disabled={isDeletingCat}
              >
                やめる
              </AppButton>
            </div>
          </div>
        </AppBottomSheet>
      ) : null}
      {photoSheetLens ? (
        <PhotoListSheet
          title={photoSheetTitle}
          photos={photoSheetPhotos}
          showCatNames={photoSheetLens === "all"}
          onOpenPhoto={(photo) => setSelectedRecordPhoto(toRecordPhotoPreview(photo))}
          onClose={() => setPhotoSheetLens(null)}
        />
      ) : null}
      {selectedYearSummary ? (
        <YearSummarySheet
          summary={selectedYearSummary}
          photos={activeCatLensPhotos}
          memories={omoideMemories}
          milestones={sleepingMilestones}
          onOpenPhoto={(photo) => {
            setSelectedRecordPhoto(photo);
          }}
          onClose={() => setSelectedYearSummary(null)}
        />
      ) : null}
      {selectedOmoideMemory ? (
        <OmoideMemorySheet
          memory={selectedOmoideMemory}
          onClose={() => setSelectedOmoideMemory(null)}
          onHideDate={() => {
            hideOmoideDate(selectedOmoideMemory.sourceDateKey);
            setOmoideRefreshTick((value) => value + 1);
            setSelectedOmoideMemory(null);
          }}
        />
      ) : null}
      {selectedRecordPhoto ? (
        <PhotoFullscreenViewer
          photo={selectedRecordPhoto}
          canDelete={selectedRecordPhoto.kind === "photo"}
          onRequestDelete={() => requestDeleteGalleryPhoto(selectedRecordPhoto)}
          onClose={() => setSelectedRecordPhoto(null)}
        />
      ) : null}
      {deleteGalleryPhotoTarget ? (
        <AppBottomSheet
          title="この写真を削除"
          onClose={cancelDeleteGalleryPhoto}
        >
          <div style={styles.deleteCatConfirm}>
            <p style={styles.deleteCatConfirmTitle}>
              この子の写真から削除します。
            </p>
            <p style={styles.deleteCatConfirmText}>
              ねこだよりや、ほかの人に届いた写真には影響しません。
            </p>
            {isGalleryPhotoAvatar(deleteGalleryPhotoTarget) ? (
              <p style={styles.deleteCatConfirmText}>
                この写真は代表写真にも使われています。削除すると、代表写真は自動表示に戻ります。
              </p>
            ) : null}
            <div style={styles.deleteCatConfirmActions}>
              <AppButton
                type="button"
                variant="danger"
                fullWidth
                onClick={() => {
                  void confirmDeleteGalleryPhoto();
                }}
                disabled={isDeletingGalleryPhoto}
              >
                {isDeletingGalleryPhoto ? "削除しています..." : "この写真を削除"}
              </AppButton>
              <AppButton
                type="button"
                variant="quiet"
                fullWidth
                onClick={cancelDeleteGalleryPhoto}
                disabled={isDeletingGalleryPhoto}
              >
                やめる
              </AppButton>
            </div>
          </div>
        </AppBottomSheet>
      ) : null}
      {isThumbnailPickerOpen && activeCatProfile ? (
        <ThumbnailPickerSheet
          catName={getCatName(activeCatProfile)}
          photos={activeCatLensPhotos}
          hasCustomThumbnail={hasCustomThumbnail}
          onPickPhoto={(photo) => {
            updateActiveCatThumbnail(photo.src);
            setIsThumbnailPickerOpen(false);
          }}
          onUpload={() => {
            void handleAvatarUpload();
          }}
          onReset={() => {
            updateActiveCatThumbnail(undefined);
            setIsThumbnailPickerOpen(false);
          }}
          onClose={() => setIsThumbnailPickerOpen(false)}
        />
      ) : null}
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

function RecordOverview({
  activeCatId,
  photos,
  milestones,
  memories,
  familyDuration,
  birthdayStatus,
  takenSleepingPhotoCount,
  onOpenMemory,
  onOpenPhoto,
  onOpenPhotos,
  onOpenYear,
}: {
  activeCatId: string | null;
  photos: LensPhoto[];
  milestones: CatSleepingMilestone[];
  memories: OmoideMemory[];
  familyDuration: { primary: string; secondary: string };
  birthdayStatus: { copy: string; isToday: boolean } | null;
  takenSleepingPhotoCount: number;
  onOpenMemory: (memory: OmoideMemory) => void;
  onOpenPhoto: (photo: RecordPhotoPreview) => void;
  onOpenPhotos: () => void;
  onOpenYear: (summary: CatYearSummary) => void;
}) {
  const [pickupRefreshTick, setPickupRefreshTick] = useState(0);
  const now = getClientNow();
  const pickup = selectCatPickup({
    now,
    photos,
    milestones,
    memories,
    birthdayStatus,
    history: readCatPickupHistory(activeCatId),
  });
  const recentEntries = createCatFootprintEntries({
    photos,
    milestones,
    memories,
    max: 3,
  });
  const yearSummaries = createCatYearSummaries({
    photos,
    memories,
    milestones,
    now,
  }).slice(0, 3);
  const celebrationItems = createCatCelebrationItems({
    familyDuration,
    birthdayStatus,
    takenSleepingPhotoCount,
  });
  void pickupRefreshTick;

  function scrollToMilestones() {
    document
      .getElementById("cats-milestones-heading")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div style={styles.recordOverview}>
      {pickup ? (
        <section
          style={styles.recordBlock}
          aria-labelledby="cats-pickup-heading"
          data-testid="cats-pickup-section"
        >
          <h2 id="cats-pickup-heading" style={styles.recordBlockTitle}>
            <span style={styles.recordBlockTitleMark} aria-hidden="true" />
            今日の1件
          </h2>
          <button
            type="button"
            style={styles.pickupRow}
            onClick={() => {
              markCatPickupSeen(activeCatId, pickup);
              setPickupRefreshTick((value) => value + 1);
              openPickupTarget(pickup, {
                onOpenMemory,
                onOpenPhoto,
                onOpenMilestones: scrollToMilestones,
              });
            }}
          >
            {pickup.src ? (
              <span style={styles.pickupThumb}>
                <StoredPhotoImage
                  src={pickup.src}
                  alt=""
                  style={styles.pickupThumbImage}
                />
              </span>
            ) : (
              <span style={styles.pickupIcon} aria-hidden="true">
                <EnvelopeSmallIcon />
              </span>
            )}
            <span style={styles.pickupText}>
              <span style={styles.pickupTitle}>{pickup.title}</span>
              <span style={styles.pickupBody}>{pickup.body}</span>
            </span>
            <span style={styles.pickupAction}>{pickup.actionLabel}</span>
            <ChevronRightSmallIcon />
          </button>
        </section>
      ) : null}

      <section style={styles.recordBlock} aria-labelledby="cats-milestones-heading">
        <h2 id="cats-milestones-heading" style={styles.recordBlockTitle}>
          <span style={styles.recordBlockTitleMark} aria-hidden="true" />
          記念
        </h2>
        <div style={styles.milestoneRail}>
          {celebrationItems.map((item) => (
            <div key={item.key} style={styles.milestoneItem}>
              <span
                style={{
                  ...styles.milestoneDot,
                  ...getCelebrationToneStyle(item.tone),
                }}
                aria-hidden="true"
              >
                <span
                  style={{
                    ...styles.milestoneDotInner,
                    ...getCelebrationToneInnerStyle(item.tone),
                  }}
                />
              </span>
              <span style={styles.milestoneLabel}>{item.label}</span>
              <span style={styles.milestoneStatus}>{item.status}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={styles.recordBlock} aria-labelledby="cats-recent-heading">
        <h2 id="cats-recent-heading" style={styles.recordBlockTitle}>
          <span style={styles.recordBlockTitleMark} aria-hidden="true" />
          足あと
        </h2>
        <p style={styles.recordMonthLabel}>
          {recentEntries[0]
            ? formatRecordMonth(recentEntries[0].timestamp)
            : formatRecordMonth(now)}
        </p>
        {recentEntries.length > 0 ? (
          <div style={styles.recentTimeline}>
            {recentEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                style={styles.recentTimelineRow}
                onClick={() => {
                  if (entry.memory) {
                    onOpenMemory(entry.memory);
                    return;
                  }
                  if (entry.photo) {
                    onOpenPhoto(entry.photo);
                    return;
                  }
                  onOpenPhotos();
                }}
              >
                <span style={styles.recentTimelineDate}>
                  {formatRecordShortDate(entry.timestamp)}
                </span>
                <span style={styles.recentTimelineTitle}>{entry.title}</span>
                {entry.src ? (
                  <span style={styles.recentTimelineThumb}>
                    <StoredPhotoImage
                      src={entry.src}
                      alt=""
                      style={styles.recentTimelineThumbImage}
                    />
                  </span>
                ) : null}
                <ChevronRightSmallIcon />
              </button>
            ))}
          </div>
        ) : (
          <p style={styles.recordEmptyText}>最近の記録はまだありません。</p>
        )}
      </section>

      <section style={styles.recordBlock} aria-labelledby="cats-archive-heading">
        <h2 id="cats-archive-heading" style={styles.recordBlockTitle}>
          <span style={styles.recordBlockTitleMark} aria-hidden="true" />
          年ごと
        </h2>
        <div style={styles.archiveTable}>
          {yearSummaries.map((row) => (
            <button
              key={row.year}
              type="button"
              style={styles.archiveRow}
              onClick={() => onOpenYear(row)}
            >
              <span style={styles.archiveYear}>{row.year}年</span>
              <span style={styles.archiveSummary}>
                写真 {row.photoCount}枚・記念 {row.milestoneCount}件
              </span>
              <ChevronRightSmallIcon />
            </button>
          ))}
          {yearSummaries.length === 0 ? (
            <p style={styles.recordEmptyText}>これから少しずつたまります。</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function openPickupTarget(
  pickup: CatPickup,
  actions: {
    onOpenMemory: (memory: OmoideMemory) => void;
    onOpenPhoto: (photo: RecordPhotoPreview) => void;
    onOpenMilestones: () => void;
  },
) {
  if (pickup.target.kind === "memory") {
    actions.onOpenMemory(pickup.target.memory);
    return;
  }

  if (pickup.target.kind === "photo") {
    actions.onOpenPhoto(pickup.target.photo);
    return;
  }

  actions.onOpenMilestones();
}

function FootprintCard({ milestone }: { milestone: CatSleepingMilestone }) {
  const isReached = Boolean(milestone.src && milestone.reachedAt);

  return (
    <AppCard
      as="div"
      variant={isReached ? "inset" : "outlined"}
      padding="sm"
      style={isReached ? styles.footprintCard : styles.footprintCardEmpty}
    >
      <div style={styles.footprintHeader}>
        <span style={styles.footprintName}>
          {getFootprintMilestoneTitle(milestone.target)}
        </span>
      </div>
      {isReached ? (
        <>
          <PhotoTile
            src={milestone.src}
            alt=""
            variant="tile"
            aspect="1 / 1"
            style={styles.footprintPhotoRoot}
            imageStyle={styles.footprintPhoto}
          />
          <span style={styles.footprintDate}>
            {formatFootprintDate(milestone.reachedAt)}
          </span>
        </>
      ) : (
        <div style={styles.footprintPlaceholder} aria-hidden="true" />
      )}
    </AppCard>
  );
}

function CatSummaryPanel({
  familyDuration,
  deliveredCount,
  omoideCount,
  birthdayStatus,
}: {
  familyDuration: { primary: string; secondary: string };
  deliveredCount: number;
  omoideCount: number;
  birthdayStatus: { copy: string; isToday: boolean } | null;
}) {
  const familyDaysCopy =
    familyDuration.secondary ||
    (familyDuration.primary === "未設定" ? "未登録" : familyDuration.primary);

  return (
    <AppCard
      as="section"
      variant="section"
      padding="md"
      style={styles.summaryPanel}
    >
      <div style={styles.summaryGrid}>
        <div style={styles.summaryTile}>
          <span style={styles.summaryTileValue}>{deliveredCount}枚</span>
          <span style={styles.summaryTileLabel}>とどけた</span>
        </div>
        <div style={styles.summaryTile}>
          <span style={styles.summaryTileValue}>{omoideCount}通</span>
          <span style={styles.summaryTileLabel}>思い出</span>
        </div>
        <div style={styles.summaryTileWide}>
          <span style={styles.summaryTileLabel}>家族になって</span>
          <span style={styles.summaryTileValueSmall}>{familyDaysCopy}</span>
        </div>
        <div
          style={
            birthdayStatus?.isToday
              ? { ...styles.summaryTileWide, ...styles.summaryTileAccent }
              : styles.summaryTileWide
          }
        >
          <span style={styles.summaryTileLabel}>誕生日</span>
          <span style={styles.summaryTileValueSmall}>
            {birthdayStatus?.copy ?? "未登録"}
          </span>
        </div>
      </div>
    </AppCard>
  );
}

function CatBasicProfilePanel({
  profile,
  onEdit,
  onManage,
}: {
  profile: CatProfile;
  onEdit?: () => void;
  onManage?: () => void;
}) {
  return (
    <div style={styles.basicProfilePanel}>
      <BasicInfoTable profile={profile} onEdit={onEdit} onManage={onManage} />
    </div>
  );
}

function BasicInfoTable({
  profile,
  onEdit,
  onManage,
}: {
  profile: CatProfile;
  onEdit?: () => void;
  onManage?: () => void;
}) {
  const rows = [
    {
      label: "家族になった日",
      value: formatBasicInfoDate(profile.basicInfo?.familySinceDate),
    },
    {
      label: "誕生日",
      value: formatBasicInfoDate(profile.basicInfo?.birthDate),
    },
    {
      label: "性別",
      value: formatGender(profile.basicInfo?.gender),
    },
    {
      label: "猫種・タイプ",
      value: profile.basicInfo?.breed,
    },
    {
      label: "毛色",
      value: profile.appearance?.coat
        ? getCoatLabel(profile.appearance.coat)
        : "",
    },
  ];
  const personalityRows = [
    {
      label: "よく呼ぶ名前",
      value: profile.basicInfo?.personality?.callName,
    },
    {
      label: "好きな場所",
      value: profile.basicInfo?.personality?.favoritePlace,
    },
    {
      label: "好きな遊び",
      value: profile.basicInfo?.personality?.favoritePlay,
    },
    {
      label: "なでられると好きなところ",
      value: profile.basicInfo?.personality?.favoriteTouch,
    },
    {
      label: "苦手なこと",
      value: profile.basicInfo?.personality?.dislikes,
    },
  ];
  const careRows = [
    {
      label: "体重",
      value: formatCareWeight(
        profile.basicInfo?.care?.weightKg,
        profile.basicInfo?.care?.weightMeasuredDate,
      ),
    },
    {
      label: "最後に測った日",
      value: profile.basicInfo?.care?.weightKg
        ? ""
        : formatBasicInfoDate(profile.basicInfo?.care?.weightMeasuredDate),
      countable: false,
    },
    {
      label: "かかりつけ",
      value: profile.basicInfo?.care?.vetClinic,
    },
    {
      label: "気をつけること",
      value: profile.basicInfo?.care?.careNote,
    },
  ];
  const registeredCount = countKnownCatInfo({
    basicRows: rows,
    personalityRows,
    careRows,
  });

  return (
    <div style={styles.basicInfoBlock}>
      <div style={styles.basicInfoHeader}>
        <p style={styles.basicInfoTitle}>基本情報</p>
        <div style={styles.basicInfoHeaderActions}>
          <span style={styles.basicInfoProgress}>
            この子のこと {registeredCount}つ
          </span>
          {onEdit ? (
            <button
              type="button"
              style={styles.basicInfoEditButton}
              onClick={onEdit}
              aria-label="基本情報を編集"
            >
              <PencilSmallIcon />
              <span>編集</span>
            </button>
          ) : null}
        </div>
      </div>
      <div style={styles.basicInfoTable}>
        {rows.map((row) => (
          <div key={row.label} style={styles.basicInfoRow}>
            <span style={styles.basicInfoLabel}>{row.label}</span>
            <span
              style={
                row.value
                  ? styles.basicInfoValue
                  : { ...styles.basicInfoValue, ...styles.basicInfoMissing }
              }
            >
              {row.value || "未登録"}
            </span>
          </div>
        ))}
      </div>
      <BasicInfoSubsection
        title="呼び名・この子らしさ"
        rows={personalityRows}
        emptyCopy="まだありません"
      />
      <BasicInfoSubsection
        title="ケアのメモ"
        rows={careRows}
        emptyCopy="まだありません"
      />
      {onManage ? (
        <button type="button" style={styles.basicInfoManageButton} onClick={onManage}>
          猫を追加・管理
        </button>
      ) : null}
    </div>
  );
}

function BasicInfoSubsection({
  title,
  rows,
  emptyCopy,
}: {
  title: string;
  rows: Array<{ label: string; value?: string }>;
  emptyCopy: string;
}) {
  const hasAnyValue = rows.some((row) => row.value);

  return (
    <section style={styles.basicInfoSubsection}>
      <p style={styles.basicInfoSubsectionTitle}>{title}</p>
      {hasAnyValue ? (
        <div style={styles.basicInfoTable}>
          {rows.map((row) => (
            <div key={row.label} style={styles.basicInfoRow}>
              <span style={styles.basicInfoLabel}>{row.label}</span>
              <span
                style={
                  row.value
                    ? { ...styles.basicInfoValue, ...styles.basicInfoLongValue }
                    : { ...styles.basicInfoValue, ...styles.basicInfoMissing }
                }
              >
                {row.value || "未登録"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p style={styles.basicInfoSubsectionEmpty}>{emptyCopy}</p>
      )}
    </section>
  );
}

function LensPhotoSection({
  title,
  photos,
  emptyCopy,
  onAddPhoto,
  onOpenPhoto,
}: {
  title: string;
  photos: LensPhoto[];
  emptyCopy: string;
  onAddPhoto: () => void;
  onOpenPhoto: (photo: LensPhoto) => void;
}) {
  return (
    <section style={styles.lensPhotoSection}>
      <div style={styles.lensSectionHeader}>
        <div style={styles.lensSectionTitleRow}>
          <p style={styles.lensSectionTitle}>{title}</p>
          <button
            type="button"
            style={styles.lensAddPhotoButton}
            onClick={onAddPhoto}
          >
            写真を残す
          </button>
        </div>
        <p style={styles.lensSectionSub}>
          毎日のねがおとは別に、あとから見返したい写真を選んで残せます。ねこだよりには使われません。100枚まで。
        </p>
      </div>
      <LensPhotoGrid
        photos={photos}
        emptyCopy={emptyCopy}
        showCatNames={false}
        onOpenPhoto={onOpenPhoto}
      />
    </section>
  );
}

function AllCatsLensView({
  photos,
  catCount,
  onOpenPhoto,
}: {
  photos: LensPhoto[];
  catCount: number;
  onOpenPhoto: (photo: LensPhoto) => void;
}) {
  return (
    <section style={styles.allLensCard}>
      <div style={styles.lensSectionHeader}>
        <p style={styles.lensSectionTitle}>ぜんぶの写真</p>
        <p style={styles.lensSectionSub}>
          {catCount}ひきの写真を、日付順に。
        </p>
      </div>
      <LensPhotoGrid
        photos={photos}
        emptyCopy="まだ写真はありません。"
        showCatNames
        onOpenPhoto={onOpenPhoto}
      />
    </section>
  );
}

function UchinokoSectionTabs({
  value,
  onChange,
  options,
}: {
  value: UchinokoSection;
  onChange: (value: UchinokoSection) => void;
  options: { value: UchinokoSection; label: string }[];
}) {
  return (
    <div
      role="radiogroup"
      data-testid="cats-section-tabs"
      aria-label="うちのこの中身"
      style={styles.sectionTabs}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            data-testid={`cats-section-tab-${option.value}`}
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            style={
              selected
                ? { ...styles.sectionTabButton, ...styles.sectionTabButtonActive }
                : styles.sectionTabButton
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function PhotoLensFilter({
  value,
  onChange,
}: {
  value: UchinokoLens;
  onChange: (value: UchinokoLens) => void;
}) {
  const options: { value: UchinokoLens; label: string }[] = [
    { value: "cat", label: "この子" },
    { value: "all", label: "ぜんぶ" },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="写真の見かた"
      style={styles.photoLensFilter}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            style={
              selected
                ? { ...styles.photoLensFilterButton, ...styles.photoLensFilterButtonActive }
                : styles.photoLensFilterButton
            }
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function LensPhotoGrid({
  photos,
  emptyCopy,
  showCatNames,
  onOpenPhoto,
}: {
  photos: LensPhoto[];
  emptyCopy: string;
  showCatNames: boolean;
  onOpenPhoto: (photo: LensPhoto) => void;
}) {
  if (photos.length === 0) {
    return <p style={styles.lensPhotoEmpty}>{emptyCopy}</p>;
  }

  return (
    <div data-testid="cats-lens-photo-grid" style={styles.lensPhotoGrid}>
      {photos.map((photo) => (
        <div key={photo.id} style={styles.lensPhotoItem}>
          <PhotoTile
            src={photo.src}
            alt=""
            variant="tile"
            aspect="1 / 1"
            onClick={() => onOpenPhoto(photo)}
            style={styles.lensPhotoTileRoot}
            imageStyle={styles.lensPhotoTile}
          />
          <span style={styles.lensPhotoDate}>
            {formatLensPhotoDate(photo.createdAt)}
          </span>
          {showCatNames && photo.catNames.length > 0 ? (
            <span style={styles.lensPhotoCats}>
              {photo.catNames.join("・")}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function PhotoListSheet({
  title,
  photos,
  showCatNames,
  onOpenPhoto,
  onClose,
}: {
  title: string;
  photos: LensPhoto[];
  showCatNames: boolean;
  onOpenPhoto: (photo: LensPhoto) => void;
  onClose: () => void;
}) {
  return (
    <AppBottomSheet title={title} onClose={onClose}>
      <div style={styles.photoListSheet}>
        <p style={styles.photoListCount}>{photos.length}枚</p>
        {photos.length === 0 ? (
          <p style={styles.lensPhotoEmpty}>まだ写真はありません。</p>
        ) : (
          <div style={styles.photoListGrid}>
            {photos.map((photo) => (
              <button
                key={photo.id}
                type="button"
                style={styles.photoListItem}
                onClick={() => onOpenPhoto(photo)}
              >
                <PhotoTile
                  src={photo.src}
                  alt=""
                  variant="tile"
                  aspect="1 / 1"
                  style={styles.photoListTileRoot}
                  imageStyle={styles.photoListTile}
                />
                {showCatNames && photo.catNames.length > 0 ? (
                  <span style={styles.photoListCatNames}>
                    {photo.catNames.join("・")}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>
    </AppBottomSheet>
  );
}

function YearSummarySheet({
  summary,
  photos,
  memories,
  milestones,
  onOpenPhoto,
  onClose,
}: {
  summary: CatYearSummary;
  photos: LensPhoto[];
  memories: OmoideMemory[];
  milestones: CatSleepingMilestone[];
  onOpenPhoto: (photo: RecordPhotoPreview) => void;
  onClose: () => void;
}) {
  const [activeDetail, setActiveDetail] =
    useState<YearSummaryDetailKind | null>(null);
  const yearPhotos = photos.filter((photo) =>
    isTimestampInYear(photo.createdAt, summary.year),
  );
  const yearMemories = memories.filter((memory) =>
    isTimestampInYear(memory.openedAt ?? memory.deliveredAt, summary.year),
  );
  const yearMilestones = milestones.filter(
    (milestone) =>
      milestone.reachedAt && isTimestampInYear(milestone.reachedAt, summary.year),
  );

  return (
    <AppBottomSheet title={`${summary.year}年`} onClose={onClose}>
      <div style={styles.yearSummarySheet}>
        {summary.coverSrc ? (
          <div style={styles.yearSummaryCover}>
            <StoredPhotoImage
              src={summary.coverSrc}
              alt=""
              style={styles.yearSummaryCoverImage}
            />
          </div>
        ) : null}
        <div style={styles.yearSummaryStats}>
          <YearSummaryStatButton
            value={summary.photoCount}
            label="写真"
            active={activeDetail === "photos"}
            disabled={yearPhotos.length === 0}
            onClick={() => setActiveDetail("photos")}
          />
          <YearSummaryStatButton
            value={summary.pickupCount}
            label="思い出"
            active={activeDetail === "pickups"}
            disabled={yearMemories.length === 0}
            onClick={() => setActiveDetail("pickups")}
          />
          <YearSummaryStatButton
            value={summary.milestoneCount}
            label="記念"
            active={activeDetail === "milestones"}
            disabled={yearMilestones.length === 0}
            onClick={() => setActiveDetail("milestones")}
          />
        </div>
        {activeDetail ? (
          <YearSummaryDetailList
            kind={activeDetail}
            photos={yearPhotos}
            memories={yearMemories}
            milestones={yearMilestones}
            onOpenPhoto={onOpenPhoto}
          />
        ) : null}
        <div style={styles.yearSummaryBlock}>
          <p style={styles.yearSummaryBlockLabel}>よく撮った月</p>
          <p style={styles.yearSummaryBlockText}>{summary.activeMonthLabel}</p>
        </div>
        <div style={styles.yearSummaryBlock}>
          <p style={styles.yearSummaryBlockLabel}>この年の記念</p>
          {summary.highlights.length > 0 ? (
            <div style={styles.yearSummaryHighlights}>
              {summary.highlights.map((highlight) => (
                <span key={highlight} style={styles.yearSummaryHighlight}>
                  {highlight}
                </span>
              ))}
            </div>
          ) : (
            <p style={styles.yearSummaryBlockText}>これから</p>
          )}
        </div>
      </div>
    </AppBottomSheet>
  );
}

function YearSummaryStatButton({
  value,
  label,
  active,
  disabled,
  onClick,
}: {
  value: number;
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      style={{
        ...styles.yearSummaryStat,
        ...styles.yearSummaryStatButton,
        ...(active ? styles.yearSummaryStatButtonActive : {}),
        ...(disabled ? styles.yearSummaryStatButtonDisabled : {}),
      }}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
    >
      <span style={styles.yearSummaryStatValue}>{value}</span>
      <span style={styles.yearSummaryStatLabel}>{label}</span>
    </button>
  );
}

function YearSummaryDetailList({
  kind,
  photos,
  memories,
  milestones,
  onOpenPhoto,
}: {
  kind: YearSummaryDetailKind;
  photos: LensPhoto[];
  memories: OmoideMemory[];
  milestones: CatSleepingMilestone[];
  onOpenPhoto: (photo: RecordPhotoPreview) => void;
}) {
  if (kind === "photos") {
    return (
      <section style={styles.yearSummaryDetail} aria-label="この年の写真">
        <p style={styles.yearSummaryDetailTitle}>この年の写真</p>
        <div style={styles.yearSummaryPhotoGrid}>
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              style={styles.yearSummaryPhotoButton}
              onClick={() => onOpenPhoto(toRecordPhotoPreview(photo))}
              aria-label={`${formatLensPhotoDate(photo.createdAt)}の写真を開く`}
            >
              <StoredPhotoImage
                src={photo.src}
                alt=""
                style={styles.yearSummaryPhotoImage}
              />
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (kind === "pickups") {
    return (
      <section style={styles.yearSummaryDetail} aria-label="この年の思い出">
        <p style={styles.yearSummaryDetailTitle}>この年の思い出</p>
        <div style={styles.yearSummaryRows}>
          {memories.map((memory) => (
            <button
              key={memory.id}
              type="button"
              style={styles.yearSummaryRow}
              onClick={() =>
                onOpenPhoto({
                  src:
                    memory.photo.displaySrc ??
                    memory.photo.thumbnailSrc ??
                    memory.photo.src,
                  title: memory.title || "思い出",
                  timestamp: memory.openedAt ?? memory.deliveredAt,
                })
              }
            >
              <span style={styles.yearSummaryRowThumb}>
                <StoredPhotoImage
                  src={memory.photo.thumbnailSrc ?? memory.photo.displaySrc ?? memory.photo.src}
                  alt=""
                  style={styles.yearSummaryRowImage}
                />
              </span>
              <span style={styles.yearSummaryRowText}>
                <span style={styles.yearSummaryRowTitle}>{memory.title}</span>
                <span style={styles.yearSummaryRowMeta}>
                  {formatFootprintDate(memory.openedAt ?? memory.deliveredAt)}
                </span>
              </span>
              <ChevronRightSmallIcon />
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section style={styles.yearSummaryDetail} aria-label="この年の記念">
      <p style={styles.yearSummaryDetailTitle}>この年の記念</p>
      <div style={styles.yearSummaryRows}>
        {milestones.map((milestone) => {
          const title = getFootprintMilestoneTitle(milestone.target);
          const hasPhoto = Boolean(milestone.src && milestone.reachedAt);

          return (
            <button
              key={`${milestone.target}-${milestone.reachedAt ?? 0}`}
              type="button"
              style={styles.yearSummaryRow}
              onClick={() => {
                if (!hasPhoto) {
                  return;
                }

                onOpenPhoto({
                  src: milestone.src,
                  title,
                  timestamp: milestone.reachedAt!,
                });
              }}
              disabled={!hasPhoto}
            >
              <span style={styles.yearSummaryRowThumb}>
                {milestone.src ? (
                  <StoredPhotoImage
                    src={milestone.src}
                    alt=""
                    style={styles.yearSummaryRowImage}
                  />
                ) : (
                  <span style={styles.yearSummaryRowFallback} aria-hidden="true" />
                )}
              </span>
              <span style={styles.yearSummaryRowText}>
                <span style={styles.yearSummaryRowTitle}>{title}</span>
                <span style={styles.yearSummaryRowMeta}>
                  {milestone.reachedAt ? formatFootprintDate(milestone.reachedAt) : ""}
                </span>
              </span>
              {hasPhoto ? <ChevronRightSmallIcon /> : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ThumbnailPickerSheet({
  catName,
  photos,
  hasCustomThumbnail,
  onPickPhoto,
  onUpload,
  onReset,
  onClose,
}: {
  catName: string;
  photos: LensPhoto[];
  hasCustomThumbnail: boolean;
  onPickPhoto: (photo: LensPhoto) => void;
  onUpload: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <AppBottomSheet title="サムネイル写真" onClose={onClose}>
      <div style={styles.thumbnailPicker}>
        <div style={styles.thumbnailPickerActions}>
          <AppButton
            type="button"
            variant="secondary"
            fullWidth
            iconStart={<PhotoSmallIcon />}
            onClick={onUpload}
          >
            端末の写真を選ぶ
          </AppButton>
          {hasCustomThumbnail ? (
            <AppButton
              type="button"
              variant="quiet"
              fullWidth
              onClick={onReset}
            >
              自動表示に戻す
            </AppButton>
          ) : null}
        </div>

        <div style={styles.thumbnailPickerSection}>
          <p style={styles.thumbnailPickerTitle}>
            この子の写真・ねがおから選ぶ
          </p>
          {photos.length > 0 ? (
            <div style={styles.thumbnailPickerGrid}>
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  style={styles.thumbnailPickerPhoto}
                  onClick={() => onPickPhoto(photo)}
                  aria-label={`${formatLensPhotoDate(photo.createdAt)}の写真をサムネイルにする`}
                >
                  <PhotoTile
                    src={photo.src}
                    alt=""
                    variant="tile"
                    aspect="1 / 1"
                    style={styles.thumbnailPickerPhotoTileRoot}
                    imageStyle={styles.thumbnailPickerPhotoTile}
                  />
                </button>
              ))}
            </div>
          ) : (
            <p style={styles.thumbnailPickerEmpty}>
              この子の写真やねがおがあると、ここから選べます。
            </p>
          )}
        </div>
      </div>
    </AppBottomSheet>
  );
}

function OmoideBunbako({
  memories,
  controls,
  onOpen,
  onPause,
  onDisable,
}: {
  memories: OmoideMemory[];
  controls: ReturnType<typeof readOmoideMemoryControls>;
  onOpen: (memory: OmoideMemory) => void;
  onPause: () => void;
  onDisable: () => void;
}) {
  const [isControlsOpen, setIsControlsOpen] = useState(false);

  return (
    <AppCard
      id="omoide"
      as="section"
      variant="section"
      padding="md"
      style={styles.bunbakoSection}
      data-testid="omoide-bunbako"
    >
      <div style={styles.bunbakoHeader}>
        <div>
          <p style={styles.bunbakoSectionTitle}>とどいた思い出</p>
        </div>
        <AppButton
          type="button"
          variant="ghost"
          size="icon"
          iconOnly
          onClick={() => setIsControlsOpen(true)}
          aria-label="思い出の設定"
        >
          <MoreDotsIcon />
        </AppButton>
      </div>
      {memories.length > 0 ? (
        <div style={styles.bunbakoScroller}>
          {memories.map((memory) => (
            <button
              key={memory.id}
              type="button"
              style={styles.bunbakoLetter}
              onClick={() => onOpen(memory)}
            >
              <span style={styles.bunbakoPostmark}>{memory.title}</span>
              <span style={styles.bunbakoWindow}>
                <StoredPhotoImage
                  src={
                    memory.photo.thumbnailSrc ??
                    memory.photo.displaySrc ??
                    memory.photo.src
                  }
                  alt=""
                  style={styles.bunbakoPhoto}
                />
              </span>
              <span style={styles.bunbakoSeal} aria-hidden="true" />
            </button>
          ))}
        </div>
      ) : (
        <p style={styles.bunbakoEmpty}>
          はじめての思い出は、これから届きます。
        </p>
      )}
      {isControlsOpen ? (
        <AppBottomSheet
          title="思い出の設定"
          onClose={() => setIsControlsOpen(false)}
        >
          <div style={styles.omoideControls}>
            <AppButton
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => {
                onPause();
                setIsControlsOpen(false);
              }}
            >
              思い出を しばらく お休みする
            </AppButton>
            <AppButton
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => {
                onDisable();
                setIsControlsOpen(false);
              }}
            >
              {controls.disabled
                ? "思い出を 受け取る"
                : "思い出を 受け取らない"}
            </AppButton>
          </div>
        </AppBottomSheet>
      ) : null}
    </AppCard>
  );
}

function OmoideMemorySheet({
  memory,
  onClose,
  onHideDate,
}: {
  memory: OmoideMemory;
  onClose: () => void;
  onHideDate: () => void;
}) {
  return (
    <AppBottomSheet title="思い出が、とどきました" onClose={onClose}>
      <div style={styles.omoideSheet}>
        <p style={styles.omoideSheetTitle}>{memory.title}</p>
        <div style={styles.omoideSheetImageFrame}>
          <StoredPhotoImage
            src={memory.photo.displaySrc ?? memory.photo.src}
            alt=""
            style={styles.omoideSheetImage}
          />
        </div>
        <p style={styles.omoideSheetVoice}>{memory.voice}</p>
        <p style={styles.omoideSheetBridge}>{memory.bridge}</p>
        <AppButton
          type="button"
          variant="secondary"
          fullWidth
          onClick={onHideDate}
        >
          この日を 見せない
        </AppButton>
      </div>
    </AppBottomSheet>
  );
}

function PhotoFullscreenViewer({
  photo,
  canDelete = false,
  onRequestDelete,
  onClose,
}: {
  photo: RecordPhotoPreview;
  canDelete?: boolean;
  onRequestDelete?: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={photo.title}
      style={styles.photoViewerOverlay}
      onClick={onClose}
    >
      <div style={styles.photoViewerChrome} onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          style={styles.photoViewerCloseButton}
          onClick={onClose}
          aria-label="写真を閉じる"
        >
          ×
        </button>
        <div style={styles.photoViewerImageFrame}>
          <StoredPhotoImage
            src={photo.src}
            alt=""
            style={styles.photoViewerImage}
          />
        </div>
        <div style={styles.photoViewerMeta}>
          <p style={styles.photoViewerTitle}>{photo.title}</p>
          <p style={styles.photoViewerDate}>{formatFootprintDate(photo.timestamp)}</p>
        </div>
        {canDelete && onRequestDelete ? (
          <button
            type="button"
            style={styles.photoViewerDeleteButton}
            onClick={onRequestDelete}
          >
            この写真を削除
          </button>
        ) : null}
      </div>
    </div>
  );
}

function getFootprintMilestoneTitle(target: CatSleepingMilestone["target"]) {
  if (target === 1) {
    return "はじめてのねがお";
  }

  return `${target}枚目`;
}

function formatFootprintDate(timestamp: number) {
  if (!timestamp) {
    return "";
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}/${String(date.getDate()).padStart(2, "0")}`;
}

function isTimestampInYear(timestamp: number, year: number) {
  if (!timestamp) {
    return false;
  }

  const date = new Date(timestamp);

  return !Number.isNaN(date.getTime()) && date.getFullYear() === year;
}

function formatBasicInfoDate(value?: string) {
  const date = parseLocalDate(value);

  if (!date) {
    return "";
  }

  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}/${String(date.getDate()).padStart(2, "0")}`;
}

function formatCareWeight(weightKg?: number, measuredDate?: string) {
  if (!weightKg) {
    return "";
  }

  const weightCopy = `${formatEditableWeight(weightKg)}kg`;
  const measuredDateCopy = formatBasicInfoDate(measuredDate);

  return measuredDateCopy ? `${weightCopy} / ${measuredDateCopy}` : weightCopy;
}

function formatEditableWeight(weightKg?: number) {
  if (!weightKg || !Number.isFinite(weightKg)) {
    return "";
  }

  return Number.isInteger(weightKg) ? String(weightKg) : weightKg.toFixed(1);
}

function parseEditableWeightKg(value: string): number | "invalid" | undefined {
  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed.replace(",", "."));

  if (!Number.isFinite(parsed) || parsed < 0.5 || parsed > 20) {
    return "invalid";
  }

  return Math.round(parsed * 10) / 10;
}

function buildCatPersonalityInfo(input: {
  callName: string;
  favoritePlace: string;
  favoritePlay: string;
  favoriteTouch: string;
  dislikes: string;
}) {
  const personality = {
    callName: trimToMax(input.callName, 50),
    favoritePlace: trimToMax(input.favoritePlace, 120),
    favoritePlay: trimToMax(input.favoritePlay, 120),
    favoriteTouch: trimToMax(input.favoriteTouch, 120),
    dislikes: trimToMax(input.dislikes, 120),
  };

  return personality.callName ||
    personality.favoritePlace ||
    personality.favoritePlay ||
    personality.favoriteTouch ||
    personality.dislikes
    ? personality
    : undefined;
}

function buildCatCareInfo(input: {
  weightKg: number | undefined;
  weightMeasuredDate: string;
  vetClinic: string;
  careNote: string;
}) {
  const care = {
    weightKg: input.weightKg,
    weightMeasuredDate: input.weightMeasuredDate || undefined,
    vetClinic: trimToMax(input.vetClinic, 80),
    careNote: trimToMax(input.careNote, 180),
  };

  return care.weightKg ||
    care.weightMeasuredDate ||
    care.vetClinic ||
    care.careNote
    ? care
    : undefined;
}

function trimToMax(value: string, maxLength: number) {
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function countKnownCatInfo({
  basicRows,
  personalityRows,
  careRows,
}: {
  basicRows: Array<{ value?: string }>;
  personalityRows: Array<{ value?: string }>;
  careRows: Array<{ value?: string; countable?: boolean }>;
}) {
  return [...basicRows, ...personalityRows, ...careRows].filter((row) => {
    if ("countable" in row && row.countable === false) {
      return false;
    }

    return row.value;
  }).length;
}

function createLocalLensPhotos(catProfiles: CatProfile[]): {
  byCat: Record<string, LensPhoto[]>;
  all: LensPhoto[];
} {
  const profilesById = new Map(
    catProfiles.map((profile) => [profile.id, profile]),
  );
  const byCat = Object.fromEntries(
    catProfiles.map((profile) => [profile.id, [] as LensPhoto[]]),
  );
  const allPhotos: LensPhoto[] = [];

  for (const photo of readOwnSleepingPhotos(null)) {
    const catId = photo.ownerCatId ?? photo.catId;
    const profile = profilesById.get(catId);

    if (!profile) {
      allPhotos.push(createLocalOrphanLensPhoto(photo));
      continue;
    }

    const lensPhoto = createLocalLensPhoto(photo, profile);
    byCat[profile.id].push(lensPhoto);
    allPhotos.push(lensPhoto);
  }

  for (const photo of readCatGalleryPhotos(null)) {
    const profile = profilesById.get(photo.catId);

    if (!profile) {
      continue;
    }

    const lensPhoto = createLocalGalleryLensPhoto(photo, profile);
    byCat[profile.id].push(lensPhoto);
    allPhotos.push(lensPhoto);
  }

  for (const catId of Object.keys(byCat)) {
    byCat[catId] = dedupeLensPhotos(byCat[catId]);
  }

  return {
    byCat,
    all: dedupeLensPhotos(allPhotos),
  };
}

function createLocalLensPhoto(
  photo: OwnSleepingPhoto,
  profile: CatProfile,
): LensPhoto {
  return {
    id: photo.id,
    src: photo.thumbnailSrc ?? photo.displaySrc ?? photo.src,
    createdAt: photo.createdAt,
    catIds: [profile.id],
    catNames: [getCatName(profile)],
    kind: "sleeping",
    deliveryCount: photo.shared ? 1 : 0,
  };
}

function createLocalOrphanLensPhoto(photo: OwnSleepingPhoto): LensPhoto {
  return {
    id: photo.id,
    src: photo.thumbnailSrc ?? photo.displaySrc ?? photo.src,
    createdAt: photo.createdAt,
    catIds: [],
    catNames: [],
    kind: "sleeping",
  };
}

function createLocalGalleryLensPhoto(
  photo: CatGalleryPhoto,
  profile: CatProfile,
): LensPhoto {
  return {
    id: photo.id,
    src: photo.src,
    createdAt: photo.createdAt,
    catIds: [profile.id],
    catNames: [getCatName(profile)],
    kind: "photo",
  };
}

function createRemoteLensPhoto(
  row: CatMomentForCat,
  profile: CatProfile,
): LensPhoto {
  return {
    id: row.localMomentId || row.catMomentId,
    src: row.photoUrl,
    createdAt: parseRemoteLensPhotoDate(row.capturedAt ?? row.createdAt),
    catIds: [profile.id],
    catNames: [getCatName(profile)],
    kind: "sleeping",
    deliveryCount: row.deliveryCount,
  };
}

function mergeLensPhotoSources(
  localByCat: Record<string, LensPhoto[]>,
  remoteByCat: Record<string, LensPhoto[]>,
  hasRemoteLoaded: boolean,
) {
  if (!hasRemoteLoaded) {
    return localByCat;
  }

  const merged: Record<string, LensPhoto[]> = {};
  const catIds = new Set([
    ...Object.keys(localByCat),
    ...Object.keys(remoteByCat),
  ]);

  for (const catId of catIds) {
    const remotePhotos = remoteByCat[catId] ?? [];
    merged[catId] = dedupeLensPhotos([
      ...remotePhotos,
      ...(localByCat[catId] ?? []),
    ]);
  }

  return merged;
}

function mergeAllLensPhotos(remotePhotos: LensPhoto[], localPhotos: LensPhoto[]) {
  return dedupeLensPhotos([...remotePhotos, ...localPhotos]);
}

function dedupeLensPhotos(photos: LensPhoto[]) {
  const photoMap = new Map<string, LensPhoto>();

  for (const photo of photos) {
    const existing = photoMap.get(photo.id);

    if (!existing) {
      photoMap.set(photo.id, {
        ...photo,
        catIds: uniqueStrings(photo.catIds),
        catNames: uniqueStrings(photo.catNames),
      });
      continue;
    }

    photoMap.set(photo.id, {
      ...existing,
      createdAt: Math.max(existing.createdAt, photo.createdAt),
      catIds: uniqueStrings([...existing.catIds, ...photo.catIds]),
      catNames: uniqueStrings([...existing.catNames, ...photo.catNames]),
      deliveryCount: Math.max(
        existing.deliveryCount ?? 0,
        photo.deliveryCount ?? 0,
      ),
    });
  }

  return [...photoMap.values()].sort(
    (left, right) => right.createdAt - left.createdAt,
  );
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function parseRemoteLensPhotoDate(dateValue: string | null) {
  if (!dateValue) {
    return 0;
  }

  const timestamp = new Date(dateValue).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatLensPhotoDate(timestamp: number) {
  if (!timestamp) {
    return "";
  }

  return formatFootprintDate(timestamp);
}

function toRecordPhotoPreview(photo: LensPhoto): RecordPhotoPreview {
  return {
    id: photo.id,
    src: photo.src,
    title: photo.kind === "sleeping" ? "ねがお" : "写真",
    timestamp: photo.createdAt,
    kind: photo.kind,
    catIds: photo.catIds,
  };
}

function isCatGalleryLensPhoto(photo: LensPhoto) {
  return photo.kind === "photo";
}

function getStableSleepingCoverPhoto(photos: LensPhoto[]) {
  return (
    photos
      .filter((photo) => photo.kind === "sleeping")
      .sort((left, right) => left.createdAt - right.createdAt)[0] ?? null
  );
}

function isStoragePhotoReference(src: string | null | undefined) {
  return Boolean(src?.startsWith("storage:") || src?.startsWith("storage://"));
}

function getLensPhotoCountForCat(
  catId: string,
  photosByCat: Record<string, LensPhoto[]>,
) {
  return dedupeLensPhotos(photosByCat[catId] ?? []).length;
}

function getDeliveredPhotoCount(photos: LensPhoto[]) {
  return dedupeLensPhotos(photos).reduce(
    (total, photo) => total + Math.max(0, photo.deliveryCount ?? 0),
    0,
  );
}

function getCatDeletePhotoCount(
  catId: string,
  photosByCat: Record<string, LensPhoto[]>,
) {
  return Math.max(
    getLensPhotoCountForCat(catId, photosByCat),
    countStoredSleepingPhotosForCat(catId),
  );
}

function countStoredSleepingPhotosForCat(catId: string) {
  if (typeof window === "undefined") {
    return 0;
  }

  try {
    const raw = window.localStorage.getItem("nyaruhodo_exchange_own_sleeping_photos");
    const photos = raw ? (JSON.parse(raw) as unknown) : [];

    if (!Array.isArray(photos)) {
      return 0;
    }

    return photos.filter((photo) => {
      if (!photo || typeof photo !== "object") {
        return false;
      }

      const candidate = photo as { ownerCatId?: unknown; catId?: unknown };
      return candidate.ownerCatId === catId || candidate.catId === catId;
    }).length;
  } catch {
    return 0;
  }
}

function formatRecordMonth(timestamp: number) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function getClientNow() {
  if (typeof window === "undefined") {
    return Date.now();
  }

  const testNow = (window as typeof window & { __testNow?: number }).__testNow;
  return typeof testNow === "number" && Number.isFinite(testNow)
    ? testNow
    : Date.now();
}

function formatRecordShortDate(timestamp: number) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getMonth() + 1}/${date.getDate()}`;
}

async function deleteRemoteCatProfile(
  profile: CatProfile,
  fallbackLocalCatId: string,
): Promise<RemoteCatDeleteResult> {
  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return { status: "skipped" };
  }

  const { data: userResult } = await supabase.auth.getUser();
  const userId = userResult.user?.id;

  if (!userId) {
    return { status: "skipped" };
  }

  const { data: remoteCat, error: findError } = await supabase
    .from("cats")
    .select("id, local_cat_id")
    .eq("owner_user_id", userId)
    .eq("local_cat_id", profile.id)
    .maybeSingle();

  if (findError) {
    return { status: "error", message: findError.message };
  }

  const remoteCatId =
    remoteCat && typeof remoteCat === "object" && "id" in remoteCat
      ? String((remoteCat as { id: string }).id)
      : null;

  if (!remoteCatId) {
    return { status: "skipped" };
  }

  const { error: unlinkError } = await supabase
    .from("cat_moment_cats")
    .delete()
    .eq("cat_id", remoteCatId);

  if (unlinkError) {
    return { status: "error", message: unlinkError.message };
  }

  const ownerIdsToRetire = [profile.id, remoteCatId];

  for (const ownerId of ownerIdsToRetire) {
    const { error } = await supabase
      .from("cat_moments")
      .update({ owner_cat_id: fallbackLocalCatId })
      .eq("user_id", userId)
      .eq("owner_cat_id", ownerId);

    if (error) {
      return { status: "error", message: error.message };
    }
  }

  const { error: localCatIdError } = await supabase
    .from("cat_moments")
    .update({ local_cat_id: fallbackLocalCatId })
    .eq("user_id", userId)
    .eq("local_cat_id", profile.id);

  if (localCatIdError) {
    return { status: "error", message: localCatIdError.message };
  }

  const { error: deleteError } = await supabase
    .from("cats")
    .delete()
    .eq("id", remoteCatId);

  if (deleteError) {
    return { status: "error", message: deleteError.message };
  }

  return { status: "deleted" };
}

async function saveRemoteCatProfile(
  profile: CatProfile,
): Promise<RemoteCatSaveResult> {
  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return { status: "skipped" };
  }

  const { data: userResult } = await supabase.auth.getUser();
  const userId = userResult.user?.id;

  if (!userId) {
    return { status: "skipped" };
  }

  const payload = {
    owner_user_id: userId,
    local_cat_id: profile.id,
    name: profile.name,
    basic_info: toJsonObject(profile.basicInfo),
    appearance: toJsonObject(profile.appearance),
    local_created_at: profile.createdAt,
    local_updated_at: profile.updatedAt,
  };

  const { data: remoteCat, error: findError } = await supabase
    .from("cats")
    .select("id")
    .eq("owner_user_id", userId)
    .eq("local_cat_id", profile.id)
    .maybeSingle();

  if (findError) {
    return { status: "error", message: findError.message };
  }

  const remoteCatId =
    remoteCat && typeof remoteCat === "object" && "id" in remoteCat
      ? String((remoteCat as { id: string }).id)
      : null;

  if (remoteCatId) {
    const { error } = await supabase
      .from("cats")
      .update(payload)
      .eq("id", remoteCatId);

    return error
      ? { status: "error", message: error.message }
      : { status: "saved" };
  }

  const { error } = await supabase.from("cats").insert(payload);

  return error
    ? { status: "error", message: error.message }
    : { status: "saved" };
}

function toJsonObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  );
}

function findDuplicateCatName(profiles: CatProfile[], name: string) {
  const normalizedName = normalizeCatNameForMatch(name);

  if (!normalizedName) {
    return null;
  }

  return (
    profiles.find(
      (profile) => normalizeCatNameForMatch(profile.name) === normalizedName,
    ) ?? null
  );
}

function normalizeCatNameForMatch(name: string) {
  return name
    .trim()
    .normalize("NFKC")
    .replace(/[\u3041-\u3096]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) + 0x60),
    )
    .toLocaleLowerCase("ja-JP");
}

function EnvelopeSmallIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      <path
        d="M4.5 7.5h15v10h-15v-10Z"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path
        d="m5.2 8.1 6.8 5.1 6.8-5.1"
        stroke="currentColor"
        strokeWidth="1.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightSmallIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flex: "0 0 auto" }}
    >
      <path
        d="m9.5 6.8 5.2 5.2-5.2 5.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PencilSmallIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path
        d="m5.4 16.9-.8 2.9 2.9-.8 9.7-9.7-2.1-2.1-9.7 9.7Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m13.8 8.5 2.1 2.1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PhotoSmallIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <rect
        x="4.4"
        y="5.4"
        width="15.2"
        height="13.2"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.65"
      />
      <path
        d="m6.7 16.1 3.4-3.5 2.5 2.4 1.4-1.4 3.3 3.5"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="15.8" cy="9.3" r="1.15" fill="currentColor" />
    </svg>
  );
}

function MoreDotsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill="none"
      aria-hidden="true"
      focusable="false"
      style={{ display: "block" }}
    >
      <circle cx="6.5" cy="12" r="1.45" fill="currentColor" />
      <circle cx="12" cy="12" r="1.45" fill="currentColor" />
      <circle cx="17.5" cy="12" r="1.45" fill="currentColor" />
    </svg>
  );
}

function AddSmallIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="19"
      height="19"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path
        d="M12 6.5v11M6.5 12h11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CoatSelector({
  currentCoat,
  onSelect,
}: {
  currentCoat?: CatCoat;
  onSelect: (coat: CatCoat) => void;
}) {
  return (
    <AppCard as="div" variant="inset" padding="sm" style={styles.coatSection}>
      <div style={styles.coatHeader}>
        <p style={styles.sectionLabel}>{"毛色"}</p>
      </div>
      <AppSegmented<EditableCoat>
        value={currentCoat ?? ""}
        ariaLabel="毛色"
        onChange={(value) => {
          if (value) {
            onSelect(value);
          }
        }}
        options={COAT_OPTIONS.map((option) => ({
          value: option.value,
          label: option.label,
          leading: (
            <span
              style={{
                ...styles.coatSwatch,
                background:
                  option.value === "calico"
                    ? "linear-gradient(135deg, #faf6ee 0%, #faf6ee 38%, #e4cfb2 39%, #e4cfb2 64%, #d9d6cf 65%, #d9d6cf 100%)"
                    : option.color,
              }}
            />
          ),
        }))}
      />
    </AppCard>
  );
}

function formatFamilyDuration(familySinceDate?: string): {
  primary: string;
  secondary: string;
} {
  const createdDate = parseLocalDate(familySinceDate);
  if (!createdDate) {
    return {
      primary: "未設定",
      secondary: "",
    };
  }

  const today = new Date();
  const todayDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const dayCount = Math.max(
    1,
    Math.floor((todayDate.getTime() - createdDate.getTime()) / 86_400_000) + 1,
  );

  let years = 0;
  while (addYearsSafe(createdDate, years + 1) <= todayDate) {
    years += 1;
  }

  const milestoneDate = addYearsSafe(createdDate, years);
  const extraDays = Math.floor(
    (todayDate.getTime() - milestoneDate.getTime()) / 86_400_000,
  );

  let secondary = "";
  if (years > 0) {
    secondary = `${years}年`;
    if (extraDays > 0) {
      secondary = `${years}年と${extraDays}日`;
    }
  }

  return {
    primary: `${dayCount}日`,
    secondary,
  };
}

function getCurrentSeasonName() {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return "春";
  if (month >= 6 && month <= 8) return "夏";
  if (month >= 9 && month <= 11) return "秋";
  return "冬";
}

function getCurrentSeasonCountLabel(familySinceDate?: string) {
  const start = parseLocalDate(familySinceDate);
  if (!start) {
    return `1回目の${getCurrentSeasonName()}`;
  }

  const now = new Date();
  const count = Math.max(1, now.getFullYear() - start.getFullYear() + 1);
  return `${count}回目の${getCurrentSeasonName()}`;
}

function getDaysThreadIntro(catName: string, familySinceDate?: string) {
  return parseLocalDate(familySinceDate)
    ? `${catName}と過ごしてきた時間を、ここに少しずつ置いていきます。`
    : `ここから、${catName}との 日々が はじまります。`;
}

function getBirthdayStatus(
  birthDate: string | undefined,
): {
  copy: string;
  isToday: boolean;
  phase: "normal" | "upcoming" | "today" | "recent";
} | null {
  const birth = parseLocalDate(birthDate);

  if (!birth) {
    return null;
  }

  const now = new Date(Date.now());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisYearBirthday = new Date(
    today.getFullYear(),
    birth.getMonth(),
    birth.getDate(),
  );
  const daysSinceThisYearBirthday = Math.floor(
    (today.getTime() - thisYearBirthday.getTime()) / 86_400_000,
  );

  if (daysSinceThisYearBirthday > 0 && daysSinceThisYearBirthday <= 7) {
    return {
      copy: "今年も迎えました",
      isToday: false,
      phase: "recent",
    };
  }

  const nextBirthday =
    thisYearBirthday < today
      ? new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate())
      : thisYearBirthday;
  const daysUntil = Math.max(
    0,
    Math.round((nextBirthday.getTime() - today.getTime()) / 86_400_000),
  );

  if (daysUntil === 0) {
    return {
      copy: "きょうは 誕生日",
      isToday: true,
      phase: "today",
    };
  }

  return {
    copy: `誕生日まで あと${daysUntil}日`,
    isToday: false,
    phase: daysUntil <= 30 ? "upcoming" : "normal",
  };
}

function getCelebrationToneStyle(tone: CatCelebrationTone) {
  if (tone === "unset") return styles.milestoneDotUnset;
  if (tone === "progress") return styles.milestoneDotProgress;
  if (tone === "upcoming") return styles.milestoneDotUpcoming;
  if (tone === "today") return styles.milestoneDotToday;
  if (tone === "recent") return styles.milestoneDotRecent;
  return styles.milestoneDotActive;
}

function getCelebrationToneInnerStyle(tone: CatCelebrationTone) {
  if (tone === "unset") return styles.milestoneDotInnerUnset;
  if (tone === "progress") return styles.milestoneDotInnerProgress;
  if (tone === "upcoming") return styles.milestoneDotInnerUpcoming;
  if (tone === "today") return styles.milestoneDotInnerToday;
  if (tone === "recent") return styles.milestoneDotInnerRecent;
  return styles.milestoneDotInnerActive;
}

function addYearsSafe(date: Date, years: number) {
  const year = date.getFullYear() + years;
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const safeDay = Math.min(date.getDate(), lastDay);
  return new Date(year, month, safeDay);
}

function parseLocalDate(value?: string): Date | null {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function formatGender(gender?: string): string {
  if (gender === "male") {
    return "男の子";
  }

  if (gender === "female") {
    return "女の子";
  }

  return "";
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

function getCoatColor(coat: string): string {
  const colors: Record<string, string> = {
    saba: "#d8d2c4",
    gray: "#c8c6c2",
    orange_tabby: "#dfc7a8",
    black: "#625f59",
    white: "#f0eeea",
    calico: "#ded6ca",
    cream: "#d8d2c4",
  };

  return colors[coat] ?? "#d8d2c4";
}

function getCoatLabel(coat: string): string {
  const labels: Record<string, string> = {
    saba: "サバ",
    gray: "グレー",
    orange_tabby: "茶トラ",
    black: "黒",
    white: "白",
    calico: "三毛",
    cream: "サバ",
  };

  return labels[coat] ?? coat;
}

function resizeAndEncode(file: File, maxSize = 800, quality = 0.85): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");

      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const context = canvas.getContext("2d");

      if (!context) {
        URL.revokeObjectURL(url);
        resolve("");
        return;
      }

      context.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    img.src = url;
  });
}

function assertSupportedSourceImage(file: File) {
  if (file.size > MAX_UPLOAD_SOURCE_FILE_BYTES) {
    throw new Error("Image file is too large");
  }

  if (file.type) {
    if (!SUPPORTED_SOURCE_IMAGE_MIME_TYPES.has(file.type.toLowerCase())) {
      throw new Error("Unsupported image file type");
    }

    return;
  }

  if (!/\.(avif|gif|heic|heif|jpe?g|png|webp)$/i.test(file.name)) {
    throw new Error("Unsupported image file type");
  }
}

const styles = {
  page: {
    position: "relative",
    minHeight: "100vh",
    background: "var(--app-paper-background)",
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
    color: CATS_TEXT,
    overflowX: "hidden",
    scrollPaddingBottom:
      "calc(var(--bottom-nav-height) + var(--bottom-nav-safe-offset) + 48px)",
    fontFamily: "var(--font-ui)",
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
      "linear-gradient(115deg, color-mix(in srgb, var(--paper) 8%, transparent) 0%, transparent 44%, color-mix(in srgb, var(--ink-soft) 3%, transparent) 100%)",
  },
  backgroundVeil: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 1,
    pointerEvents: "none" as const,
    background:
      "linear-gradient(to bottom, color-mix(in srgb, var(--paper) 4%, transparent) 0%, transparent 52%, color-mix(in srgb, var(--ink-soft) 3%, transparent) 100%)",
  },
  container: {
    position: "relative",
    zIndex: 2,
    width: "min(100%, 430px)",
    margin: "0 auto",
    fontSynthesis: "none",
    padding:
      "calc(20px + env(safe-area-inset-top)) 24px calc(var(--bottom-nav-height) + var(--bottom-nav-safe-offset) + 24px + env(safe-area-inset-bottom))",
  },
  pageKicker: {
    margin: "0 0 5px",
    color: CATS_MUTED,
    fontSize: CATS_META_SIZE,
    fontWeight: 400,
    letterSpacing: CATS_META_TRACKING,
  },
  pageTitle: {
    fontFamily: CATS_SERIF,
    fontSize: CATS_TITLE_SIZE,
    fontWeight: 400,
    color: CATS_MUTED,
    lineHeight: 1.34,
    letterSpacing: CATS_TITLE_TRACKING,
    margin: 0,
  },
  pageSub: {
    fontSize: CATS_BODY_SIZE,
    color: CATS_MUTED,
    margin: 0,
    lineHeight: 1.6,
    letterSpacing: CATS_BODY_TRACKING,
  },
  onboardingPanel: {
    padding: "20px 18px 18px",
    marginBottom: "22px",
    textAlign: "center",
  },
  onboardingKicker: {
    margin: "0 0 8px",
    color: CATS_MUTED,
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.4,
    letterSpacing: "0.08em",
  },
  onboardingTitle: {
    margin: 0,
    color: CATS_TEXT_STRONG,
    fontFamily: CATS_SERIF,
    fontSize: "24px",
    fontWeight: 400,
    lineHeight: 1.45,
    letterSpacing: "0.08em",
  },
  onboardingText: {
    margin: "10px auto 0",
    maxWidth: "280px",
    color: CATS_MUTED,
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.7,
  },
  onboardingHomeLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "42px",
    marginTop: "18px",
    padding: "0 22px",
    borderRadius: "var(--radius-full)",
    border: "1px solid var(--line)",
    background: "color-mix(in srgb, var(--paper) 66%, transparent)",
    color: CATS_TEXT,
    textDecoration: "none",
    fontSize: "13px",
    fontFamily: "var(--font-display)",
    letterSpacing: "var(--tracking-label)",
    fontWeight: 400,
  },
  onboardingHomeButton: {
    marginTop: "18px",
  },
  profileCard: {
    marginBottom: "12px",
    padding: "12px 16px",
    borderRadius: "28px",
    background: "color-mix(in srgb, var(--paper-card) 46%, transparent)",
    boxShadow: "0 10px 30px -26px color-mix(in srgb, var(--ink) 22%, transparent)",
    backdropFilter: "none",
  },
  profilePlaceCard: {
    marginBottom: "8px",
    padding: 0,
    borderRadius: 0,
    background: "transparent",
    boxShadow: "none",
    backdropFilter: "none",
  },
  sectionSwitch: {
    margin: "0 0 12px",
  },
  sectionTabs: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    alignItems: "center",
    gap: 0,
    boxSizing: "border-box",
    minHeight: "48px",
    margin: "0 0 14px",
    padding: 0,
    borderRadius: 0,
    border: "none",
    borderBottom: "1px solid color-mix(in srgb, var(--line) 72%, transparent)",
    background: "transparent",
    boxShadow: "none",
  },
  sectionTabButton: {
    minWidth: 0,
    minHeight: "47px",
    padding: "0 12px 2px",
    border: "none",
    borderRadius: 0,
    borderBottom: "2px solid transparent",
    background: "transparent",
    color: CATS_MUTED,
    fontFamily: CATS_UI,
    fontSize: "13px",
    fontWeight: 500,
    letterSpacing: CATS_BODY_TRACKING,
    cursor: "pointer",
  },
  sectionTabButtonActive: {
    color: "var(--seal)",
    borderBottom: "2px solid var(--seal)",
    background: "transparent",
    boxShadow: "none",
  },
  profileCoverHero: {
    position: "relative" as const,
    display: "block",
    minHeight: "196px",
  },
  profileCoverFrame: {
    position: "relative" as const,
    display: "block",
    width: "calc(100% + 32px)",
    height: "188px",
    marginLeft: "-16px",
    overflow: "hidden",
    borderRadius: "18px",
    background: "color-mix(in srgb, var(--paper-card) 72%, transparent)",
    border: "1px solid color-mix(in srgb, var(--paper) 72%, transparent)",
    boxShadow:
      "0 1px 0 color-mix(in srgb, var(--paper) 76%, transparent), 0 16px 34px -30px color-mix(in srgb, var(--ink) 30%, transparent)",
  },
  profileCoverTileRoot: {
    display: "block",
    width: "100%",
    height: "100%",
  },
  profileCoverImage: {
    display: "block",
    width: "100%",
    height: "100%",
    border: "none",
    borderRadius: 0,
    boxShadow: "none",
    background: "color-mix(in srgb, var(--paper-card) 80%, transparent)",
  },
  profileCoverEditButton: {
    position: "absolute" as const,
    top: "10px",
    right: "10px",
    zIndex: 2,
    width: "40px",
    height: "40px",
    minWidth: "40px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    borderRadius: "999px",
    border: "1px solid color-mix(in srgb, var(--paper) 70%, transparent)",
    background: "color-mix(in srgb, var(--paper-card) 78%, transparent)",
    color: "color-mix(in srgb, var(--ink) 78%, transparent)",
    boxShadow:
      "0 1px 0 color-mix(in srgb, var(--paper) 64%, transparent), 0 10px 20px -18px color-mix(in srgb, var(--ink) 30%, transparent)",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  },
  profileCoverThumbnailButton: {
    position: "absolute" as const,
    right: "10px",
    bottom: "10px",
    zIndex: 2,
    minHeight: "34px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 12px",
    borderRadius: "999px",
    border: "1px solid color-mix(in srgb, var(--seal) 42%, var(--paper) 58%)",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--paper-card) 92%, transparent), color-mix(in srgb, var(--paper-warm) 88%, transparent))",
    color: "var(--seal)",
    fontFamily: CATS_UI,
    fontSize: CATS_META_SIZE,
    fontWeight: 600,
    lineHeight: 1,
    letterSpacing: "0",
    boxShadow:
      "0 1px 0 color-mix(in srgb, var(--paper) 80%, transparent), 0 12px 24px -16px color-mix(in srgb, var(--seal) 38%, transparent)",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  },
  profileCoverSwitchButton: {
    position: "absolute" as const,
    left: "10px",
    top: "10px",
    zIndex: 2,
    width: "40px",
    height: "40px",
    minWidth: "40px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "7px",
    borderRadius: "999px",
    border: "1px solid color-mix(in srgb, var(--paper) 70%, transparent)",
    background: "color-mix(in srgb, var(--paper-card) 78%, transparent)",
    color: "color-mix(in srgb, var(--ink) 78%, transparent)",
    boxShadow:
      "0 1px 0 color-mix(in srgb, var(--paper) 64%, transparent), 0 10px 20px -18px color-mix(in srgb, var(--ink) 30%, transparent)",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
  },
  profileCoverSwitchIcon: {
    width: "26px",
    height: "26px",
    display: "block",
    objectFit: "contain",
    opacity: 0.82,
  },
  profileHero: {
    display: "grid",
    gridTemplateColumns: "48px 1fr auto",
    alignItems: "center",
    gap: "12px",
  },
  profileHeroAvatar: {
    width: "48px",
    height: "48px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    border: "none",
    background: "transparent",
    cursor: "pointer",
  },
  profileHeroAvatarTileRoot: {
    width: "48px",
    height: "48px",
  },
  profileHeroAvatarPhotoTile: {
    width: "48px",
    height: "48px",
    border: "1.5px solid color-mix(in srgb, var(--paper-card) 88%, transparent)",
    boxShadow:
      "0 1px 3px color-mix(in srgb, var(--ink) 8%, transparent), 0 6px 16px -14px color-mix(in srgb, var(--ink) 20%, transparent)",
  },
  profileHeroAvatarIconTile: {
    width: "48px",
    height: "48px",
    padding: "4px",
    boxSizing: "border-box",
    border: "1.5px solid color-mix(in srgb, var(--paper-card) 88%, transparent)",
    boxShadow:
      "0 1px 3px color-mix(in srgb, var(--ink) 8%, transparent), 0 6px 16px -14px color-mix(in srgb, var(--ink) 20%, transparent)",
  },
  profileHeroInfo: {
    minWidth: 0,
    display: "grid",
    gap: "4px",
  },
  profileNameRow: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  profileName: {
    fontFamily: CATS_SERIF,
    fontSize: CATS_TITLE_SIZE,
    fontWeight: 400,
    color: CATS_TEXT_STRONG,
    letterSpacing: CATS_TITLE_TRACKING,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  profileHeroActions: {
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-end",
    gap: "8px",
  },
  catIconSwitcher: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "8px",
    minWidth: 0,
  },
  catIconSwitchButton: {
    width: "32px",
    height: "32px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "4px",
    borderRadius: "999px",
    border: "1px solid color-mix(in srgb, var(--control-border) 74%, transparent)",
    background: "color-mix(in srgb, var(--paper-card) 64%, transparent)",
    color: CATS_MUTED,
    boxShadow: "none",
    cursor: "pointer",
    opacity: 0.78,
  },
  catIconSwitchButtonActive: {
    opacity: 1,
    border: "1px solid color-mix(in srgb, var(--seal) 44%, transparent)",
    background: "color-mix(in srgb, var(--paper-card) 88%, transparent)",
    boxShadow:
      "0 0 0 2px color-mix(in srgb, var(--seal) 10%, transparent), 0 6px 16px -15px color-mix(in srgb, var(--ink) 28%, transparent)",
  },
  catIconSwitchImage: {
    width: "22px",
    height: "22px",
    display: "block",
    objectFit: "contain",
  },
  catIconSwitchMore: {
    width: "32px",
    height: "32px",
    minWidth: "32px",
  },
  familyHero: {
    display: "grid",
    justifyItems: "center",
    gap: "4px",
    marginBottom: "14px",
  },
  familyHeroLabel: {
    color: CATS_MUTED,
    fontFamily: CATS_SERIF,
    fontSize: CATS_META_SIZE,
    fontWeight: 400,
    lineHeight: 1.3,
    letterSpacing: CATS_META_TRACKING,
  },
  familyHeroDays: {
    color: CATS_TEXT_STRONG,
    fontFamily: CATS_SERIF,
    fontSize: CATS_TITLE_SIZE,
    fontWeight: 400,
    lineHeight: 1.45,
    letterSpacing: CATS_TITLE_TRACKING,
  },
  catDayNote: {
    display: "grid",
    gap: "3px",
    margin: "10px 0 0",
  },
  catDayNoteToday: {
    color: "var(--seal)",
  },
  catDayText: {
    color: CATS_MUTED,
    fontFamily: CATS_SERIF,
    fontSize: CATS_META_SIZE,
    fontWeight: 400,
    lineHeight: 1.45,
    letterSpacing: CATS_META_TRACKING,
  },
  recordList: {
    display: "grid",
  },
  recordRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "center",
    gap: "12px",
    minHeight: "38px",
    borderBottom: "1px solid color-mix(in srgb, var(--line-strong) 58%, transparent)",
  },
  recordRowLast: {
    borderBottom: "none",
  },
  recordLabel: {
    color: CATS_MUTED,
    fontFamily: CATS_UI,
    fontSize: CATS_META_SIZE,
    fontWeight: 400,
    lineHeight: 1.35,
    letterSpacing: "0.02em",
  },
  recordMetricValue: {
    color: CATS_TEXT,
    fontFamily: CATS_UI,
    fontSize: CATS_BODY_SIZE,
    fontWeight: 400,
    lineHeight: 1.35,
    textAlign: "right",
    letterSpacing: "0.01em",
  },
  recordMetricValueGroup: {
    display: "grid",
    justifyItems: "end",
    gap: "2px",
  },
  recordMetricSub: {
    color: CATS_FAINT,
    fontFamily: CATS_UI,
    fontSize: CATS_META_SIZE,
    fontWeight: 400,
    lineHeight: 1.2,
    letterSpacing: "0.02em",
  },
  recordPanel: {
    marginTop: "24px",
    marginBottom: "24px",
    background: CATS_PANEL_BACKGROUND,
    backdropFilter: "none",
  },
  recordOverview: {
    display: "grid",
    gap: "24px",
    padding: "0 0 24px",
  },
  recordBlock: {
    display: "grid",
    gap: "9px",
  },
  recordBlockTitle: {
    margin: 0,
    color: CATS_TEXT,
    fontFamily: CATS_UI,
    fontSize: "15px",
    fontWeight: 500,
    lineHeight: 1.35,
    letterSpacing: "0.02em",
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
  },
  recordBlockTitleMark: {
    width: "7px",
    height: "7px",
    borderRadius: "999px",
    background: "var(--seal)",
    boxShadow:
      "0 0 0 4px color-mix(in srgb, var(--seal) 10%, transparent)",
  },
  recordMonthLabel: {
    margin: "-2px 0 2px",
    color: CATS_MUTED,
    fontFamily: CATS_UI,
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.4,
    letterSpacing: "0",
  },
  nowMemoryRow: {
    width: "100%",
    minHeight: "64px",
    display: "grid",
    gridTemplateColumns: "28px minmax(0, 1fr) auto 18px",
    alignItems: "center",
    gap: "12px",
    padding: "0 16px",
    borderRadius: "10px",
    border: "1px solid color-mix(in srgb, var(--line-strong) 78%, transparent)",
    background: "color-mix(in srgb, var(--paper-card) 36%, transparent)",
    color: "var(--seal)",
    boxShadow: "none",
    cursor: "pointer",
    textAlign: "left",
    WebkitTapHighlightColor: "transparent",
  },
  nowMemoryRowDisabled: {
    color: CATS_MUTED,
    cursor: "default",
    opacity: 0.72,
  },
  nowMemoryText: {
    minWidth: 0,
    color: CATS_TEXT_STRONG,
    fontFamily: CATS_UI,
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: 1.45,
    letterSpacing: "0",
  },
  nowMemoryAction: {
    color: "var(--seal)",
    fontFamily: CATS_UI,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: "0.02em",
    whiteSpace: "nowrap",
  },
  pickupRow: {
    width: "100%",
    minHeight: "76px",
    display: "grid",
    gridTemplateColumns: "52px minmax(0, 1fr) auto 18px",
    alignItems: "center",
    gap: "12px",
    padding: "10px 14px 10px 10px",
    borderRadius: "14px",
    border: "1px solid color-mix(in srgb, var(--line-strong) 78%, transparent)",
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--paper-card) 50%, transparent), color-mix(in srgb, var(--seal) 7%, var(--paper-card)))",
    color: "var(--seal)",
    boxShadow: "0 10px 22px color-mix(in srgb, var(--shadow) 28%, transparent)",
    cursor: "pointer",
    textAlign: "left",
    WebkitTapHighlightColor: "transparent",
  },
  pickupThumb: {
    width: "52px",
    height: "52px",
    overflow: "hidden",
    borderRadius: "12px",
    background: CATS_PANEL_BACKGROUND_SOFT,
    boxShadow: "0 0 0 1px color-mix(in srgb, var(--paper) 65%, transparent)",
  },
  pickupThumbImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "12px",
  },
  pickupIcon: {
    width: "52px",
    height: "52px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "12px",
    background: "color-mix(in srgb, var(--paper-card) 74%, transparent)",
    color: "var(--seal)",
  },
  pickupText: {
    minWidth: 0,
    display: "grid",
    gap: "3px",
  },
  pickupTitle: {
    color: CATS_TEXT_STRONG,
    fontFamily: CATS_UI,
    fontSize: "14px",
    fontWeight: 600,
    lineHeight: 1.35,
    letterSpacing: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  pickupBody: {
    color: CATS_MUTED,
    fontFamily: CATS_UI,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.35,
    letterSpacing: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  pickupAction: {
    color: "var(--seal)",
    fontFamily: CATS_UI,
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: "0",
    whiteSpace: "nowrap",
  },
  recentTimeline: {
    position: "relative" as const,
    display: "grid",
    paddingLeft: 0,
  },
  recentTimelineRow: {
    position: "relative" as const,
    width: "100%",
    minHeight: "56px",
    display: "grid",
    gridTemplateColumns: "54px minmax(0, 1fr) auto 18px",
    alignItems: "center",
    gap: "12px",
    padding: "0 0 0 0",
    border: "none",
    borderBottom: "1px solid color-mix(in srgb, var(--line) 84%, transparent)",
    background: "transparent",
    color: CATS_TEXT,
    font: "inherit",
    textAlign: "left",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  recentTimelineDate: {
    color: CATS_TEXT,
    fontFamily: CATS_UI,
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: 1.35,
    letterSpacing: "0",
  },
  recentTimelineTitle: {
    minWidth: 0,
    color: CATS_TEXT_STRONG,
    fontFamily: CATS_UI,
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: 1.35,
    letterSpacing: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  recentTimelineThumb: {
    width: "56px",
    height: "40px",
    overflow: "hidden",
    borderRadius: "8px",
    background: CATS_PANEL_BACKGROUND_SOFT,
  },
  recentTimelineThumbImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "8px",
  },
  milestoneRail: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    alignItems: "start",
    gap: "8px",
    padding: 0,
  },
  milestoneItem: {
    position: "relative" as const,
    display: "grid",
    justifyItems: "start",
    gap: "5px",
    minWidth: 0,
    minHeight: "76px",
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid color-mix(in srgb, var(--line) 78%, transparent)",
    background: "color-mix(in srgb, var(--paper-card) 28%, transparent)",
    textAlign: "left",
  },
  milestoneDot: {
    position: "relative" as const,
    zIndex: 1,
    width: "20px",
    height: "20px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "999px",
    border: "1px solid color-mix(in srgb, var(--line-strong) 76%, transparent)",
    background: "color-mix(in srgb, var(--paper-card) 78%, transparent)",
    boxShadow: "0 1px 2px color-mix(in srgb, var(--ink) 8%, transparent)",
  },
  milestoneDotInner: {
    width: "7px",
    height: "7px",
    borderRadius: "999px",
    background: "color-mix(in srgb, var(--ink-soft) 46%, transparent)",
  },
  milestoneDotActive: {
    borderColor: "color-mix(in srgb, var(--seal) 34%, var(--line-strong))",
  },
  milestoneDotProgress: {
    borderColor: "color-mix(in srgb, var(--seal) 42%, var(--line-strong))",
    background:
      "linear-gradient(180deg, color-mix(in srgb, var(--paper-card) 82%, transparent), color-mix(in srgb, var(--seal) 10%, var(--paper-card)))",
  },
  milestoneDotUpcoming: {
    borderColor: "color-mix(in srgb, var(--seal) 46%, var(--line-strong))",
    background:
      "color-mix(in srgb, var(--seal) 8%, var(--paper-card))",
  },
  milestoneDotToday: {
    borderColor: "var(--seal)",
    background: "var(--seal)",
    boxShadow:
      "0 0 0 3px color-mix(in srgb, var(--seal) 13%, transparent), 0 8px 18px -16px var(--seal)",
  },
  milestoneDotRecent: {
    borderColor: "color-mix(in srgb, var(--seal) 38%, var(--line-strong))",
    background:
      "color-mix(in srgb, var(--paper-warm) 64%, var(--paper-card))",
  },
  milestoneDotUnset: {
    borderStyle: "dashed",
    opacity: 0.72,
  },
  milestoneDotInnerActive: {
    background: "color-mix(in srgb, var(--seal) 64%, var(--ink-soft))",
  },
  milestoneDotInnerProgress: {
    width: "10px",
    height: "4px",
    borderRadius: "999px",
    background: "color-mix(in srgb, var(--seal) 72%, var(--ink-soft))",
  },
  milestoneDotInnerUpcoming: {
    background: "var(--seal)",
  },
  milestoneDotInnerToday: {
    width: "8px",
    height: "8px",
    background: "var(--paper)",
  },
  milestoneDotInnerRecent: {
    background: "color-mix(in srgb, var(--seal) 58%, var(--paper-warm))",
  },
  milestoneDotInnerUnset: {
    background: "transparent",
  },
  milestoneLabel: {
    marginTop: "2px",
    color: CATS_TEXT_STRONG,
    fontFamily: CATS_UI,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.35,
    letterSpacing: "0.01em",
  },
  milestoneStatus: {
    color: CATS_TEXT,
    fontFamily: CATS_UI,
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.35,
    letterSpacing: "0",
  },
  archiveTable: {
    overflow: "hidden",
    border: "1px solid color-mix(in srgb, var(--line-strong) 72%, transparent)",
    borderRadius: "10px",
    background: "color-mix(in srgb, var(--paper-card) 34%, transparent)",
  },
  archiveRow: {
    width: "100%",
    minHeight: "56px",
    display: "grid",
    gridTemplateColumns: "minmax(90px, auto) minmax(0, 1fr) 18px",
    alignItems: "center",
    gap: "12px",
    padding: "0 14px",
    border: "none",
    borderBottom: "1px solid color-mix(in srgb, var(--line) 84%, transparent)",
    background: "transparent",
    color: CATS_TEXT,
    font: "inherit",
    textAlign: "left",
    cursor: "pointer",
  },
  archiveYear: {
    color: CATS_TEXT_STRONG,
    fontFamily: CATS_UI,
    fontSize: "17px",
    fontWeight: 500,
    lineHeight: 1.35,
    letterSpacing: "0",
  },
  archiveSummary: {
    minWidth: 0,
    color: CATS_MUTED,
    fontFamily: CATS_UI,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.35,
    letterSpacing: "0",
    textAlign: "right" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  recordEmptyText: {
    margin: 0,
    color: CATS_MUTED,
    fontFamily: CATS_UI,
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.6,
  },
  photoLensFilter: {
    display: "inline-flex",
    alignItems: "center",
    justifySelf: "start",
    gap: "6px",
    minHeight: "36px",
    margin: "-2px 0 10px",
    padding: "2px",
    borderRadius: "999px",
    background: "color-mix(in srgb, var(--paper-card) 34%, transparent)",
  },
  photoLensFilterButton: {
    minHeight: "32px",
    padding: "0 12px",
    border: "none",
    borderRadius: "999px",
    background: "transparent",
    color: CATS_MUTED,
    fontFamily: CATS_UI,
    fontSize: "12px",
    fontWeight: 500,
    letterSpacing: "0.02em",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  photoLensFilterButtonActive: {
    background: "color-mix(in srgb, var(--paper-card) 76%, transparent)",
    color: CATS_TEXT_STRONG,
    boxShadow: "0 0 0 1px color-mix(in srgb, var(--line) 72%, transparent)",
  },
  photoViewerOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 80,
    display: "grid",
    alignItems: "center",
    justifyItems: "center",
    padding:
      "calc(18px + env(safe-area-inset-top)) 18px calc(22px + env(safe-area-inset-bottom))",
    background:
      "color-mix(in srgb, var(--app-night-ink, #1d1a18) 78%, transparent)",
    backdropFilter: "blur(10px)",
  },
  photoViewerChrome: {
    width: "min(100%, 540px)",
    maxHeight: "100%",
    display: "grid",
    gap: "12px",
    alignContent: "center",
  },
  photoViewerCloseButton: {
    justifySelf: "end",
    width: "44px",
    height: "44px",
    border: "1px solid color-mix(in srgb, var(--paper) 72%, transparent)",
    borderRadius: "50%",
    background: "color-mix(in srgb, var(--paper) 86%, transparent)",
    color: CATS_TEXT,
    fontFamily: CATS_UI,
    fontSize: "24px",
    fontWeight: 300,
    lineHeight: 1,
    cursor: "pointer",
    boxShadow: "var(--shadow-e1)",
    WebkitTapHighlightColor: "transparent",
  },
  photoViewerImageFrame: {
    width: "100%",
    maxHeight: "min(72dvh, 720px)",
    display: "grid",
    alignItems: "center",
    justifyItems: "center",
    overflow: "hidden",
    borderRadius: "18px",
    background: "color-mix(in srgb, var(--paper-card) 18%, transparent)",
    boxShadow: "0 18px 52px rgba(0,0,0,0.24)",
  },
  photoViewerImage: {
    width: "100%",
    maxHeight: "min(72dvh, 720px)",
    objectFit: "contain",
    borderRadius: "18px",
  },
  photoViewerMeta: {
    display: "grid",
    gap: "2px",
    padding: "0 4px",
  },
  photoViewerTitle: {
    margin: 0,
    color: "var(--paper)",
    fontFamily: CATS_SERIF,
    fontSize: "14px",
    fontWeight: 400,
    lineHeight: 1.5,
  },
  photoViewerDate: {
    margin: 0,
    color: "color-mix(in srgb, var(--paper) 72%, transparent)",
    fontFamily: CATS_UI,
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.5,
  },
  photoViewerDeleteButton: {
    justifySelf: "start",
    border: "none",
    background: "transparent",
    color: "color-mix(in srgb, var(--danger) 72%, var(--paper))",
    fontFamily: CATS_UI,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.5,
    padding: "4px",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  recordPhotoSheet: {
    display: "grid",
    gap: "12px",
  },
  recordPhotoFrame: {
    width: "100%",
    overflow: "hidden",
    borderRadius: "16px",
    background: CATS_PANEL_BACKGROUND_SOFT,
  },
  recordPhotoImage: {
    width: "100%",
    aspectRatio: "4 / 3",
    objectFit: "cover",
    borderRadius: "16px",
  },
  recordPhotoDate: {
    margin: 0,
    color: CATS_MUTED,
    fontFamily: CATS_UI,
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.5,
  },
  footprintsPanel: {
    marginBottom: "22px",
    overflow: "hidden",
    background: CATS_PANEL_BACKGROUND,
    backdropFilter: "none",
  },
  summaryPanel: {
    marginBottom: "12px",
    background: CATS_PANEL_BACKGROUND,
  },
  summaryHeader: {
    display: "grid",
    justifyItems: "start",
    gap: "3px",
    padding: "2px 0 12px",
  },
  summaryKicker: {
    margin: 0,
    color: CATS_MUTED,
    fontFamily: CATS_SERIF,
    fontSize: CATS_META_SIZE,
    fontWeight: 400,
    lineHeight: 1.35,
    letterSpacing: CATS_META_TRACKING,
  },
  summaryMain: {
    margin: 0,
    color: CATS_TEXT_STRONG,
    fontFamily: CATS_SERIF,
    fontSize: CATS_DISPLAY_SIZE,
    fontWeight: 400,
    lineHeight: 1.25,
    letterSpacing: CATS_TITLE_TRACKING,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },
  summaryTile: {
    minHeight: "64px",
    display: "grid",
    alignContent: "center",
    justifyItems: "start",
    gap: "4px",
    padding: "12px",
    borderRadius: "var(--radius-lg)",
    border: "1px solid color-mix(in srgb, var(--line-strong) 66%, transparent)",
    background: "color-mix(in srgb, var(--paper) 46%, transparent)",
  },
  summaryTileWide: {
    minHeight: "56px",
    display: "grid",
    alignContent: "center",
    justifyItems: "start",
    gap: "4px",
    padding: "8px 12px",
    borderRadius: "var(--radius-lg)",
    border: "1px solid color-mix(in srgb, var(--line-strong) 58%, transparent)",
    background: "color-mix(in srgb, var(--paper) 40%, transparent)",
  },
  summaryTileAccent: {
    borderColor: "color-mix(in srgb, var(--seal) 34%, var(--line))",
    background: "color-mix(in srgb, var(--seal) 6%, var(--paper))",
  },
  summaryTileValue: {
    color: CATS_TEXT_STRONG,
    fontFamily: CATS_UI,
    fontSize: CATS_TITLE_SIZE,
    fontWeight: 400,
    lineHeight: 1.25,
    letterSpacing: "0.01em",
  },
  summaryTileValueSmall: {
    color: CATS_TEXT,
    fontFamily: CATS_UI,
    fontSize: CATS_BODY_SIZE,
    fontWeight: 400,
    lineHeight: 1.45,
    letterSpacing: "0.01em",
  },
  summaryTileLabel: {
    color: CATS_MUTED,
    fontFamily: CATS_UI,
    fontSize: CATS_TINY_SIZE,
    fontWeight: 400,
    lineHeight: 1.35,
    letterSpacing: "0.04em",
  },
  footprintsSection: {
    minWidth: 0,
  },
  footprintsTitle: {
    margin: "0 0 12px",
    color: CATS_TEXT,
    fontFamily: CATS_SERIF,
    fontSize: CATS_TITLE_SIZE,
    fontWeight: 400,
    lineHeight: 1.45,
    letterSpacing: CATS_TITLE_TRACKING,
  },
  footprintsScroller: {
    display: "flex",
    gap: "8px",
    overflowX: "auto",
    padding: "0 2px 2px 0",
    scrollSnapType: "x proximity",
    scrollbarWidth: "none",
  },
  footprintCard: {
    width: "132px",
    minHeight: "128px",
    display: "grid",
    gap: "8px",
    flex: "0 0 auto",
    scrollSnapAlign: "start",
  },
  footprintCardEmpty: {
    width: "132px",
    minHeight: "128px",
    display: "grid",
    gap: "8px",
    flex: "0 0 auto",
    scrollSnapAlign: "start",
  },
  footprintHeader: {
    display: "grid",
    gap: "4px",
  },
  footprintName: {
    color: CATS_TEXT,
    fontFamily: CATS_SERIF,
    fontSize: CATS_META_SIZE,
    fontWeight: 400,
    lineHeight: 1.35,
    letterSpacing: CATS_META_TRACKING,
  },
  footprintPhoto: {
    width: "100%",
    height: "auto",
    aspectRatio: "1 / 1",
  },
  footprintPhotoRoot: {
    width: "100%",
  },
  footprintDate: {
    color: CATS_MUTED,
    fontFamily: CATS_SERIF,
    fontSize: CATS_META_SIZE,
    fontWeight: 400,
    lineHeight: 1,
    letterSpacing: CATS_META_TRACKING,
  },
  footprintPlaceholder: {
    width: "100%",
    aspectRatio: "1 / 1",
    minHeight: "64px",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--line)",
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--paper) 22%, transparent), color-mix(in srgb, var(--paper-warm) 28%, transparent))",
  },
  basicInfoBlock: {
    display: "grid",
    gap: "9px",
  },
  basicProfilePanel: {
    display: "grid",
    gap: "0",
  },
  basicInfoPanel: {
    marginBottom: "22px",
    background: CATS_PANEL_BACKGROUND,
    backdropFilter: "none",
  },
  basicInfoHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  basicInfoHeaderActions: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "8px",
    minWidth: 0,
  },
  basicInfoTitle: {
    margin: 0,
    color: CATS_TEXT,
    fontFamily: CATS_SERIF,
    fontSize: CATS_TITLE_SIZE,
    fontWeight: 400,
    lineHeight: 1.45,
    letterSpacing: CATS_TITLE_TRACKING,
  },
  basicInfoProgress: {
    flex: "0 0 auto",
    color: CATS_FAINT,
    fontFamily: CATS_SERIF,
    fontSize: CATS_TINY_SIZE,
    fontWeight: 400,
    lineHeight: 1.35,
    letterSpacing: CATS_META_TRACKING,
  },
  basicInfoEditButton: {
    minHeight: "32px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "0 10px",
    borderRadius: "999px",
    border: "1px solid color-mix(in srgb, var(--line-strong) 60%, transparent)",
    background: "color-mix(in srgb, var(--paper-card) 50%, transparent)",
    color: CATS_MUTED,
    fontFamily: CATS_UI,
    fontSize: CATS_META_SIZE,
    fontWeight: 600,
    lineHeight: 1,
    letterSpacing: "0",
    cursor: "pointer",
  },
  basicInfoTable: {
    display: "grid",
    borderRadius: "var(--radius-lg)",
    border: "1px solid color-mix(in srgb, var(--line-strong) 62%, transparent)",
    overflow: "hidden",
    background: "color-mix(in srgb, var(--paper) 34%, transparent)",
  },
  basicInfoSubsection: {
    display: "grid",
    gap: "8px",
    paddingTop: "4px",
  },
  basicInfoSubsectionTitle: {
    margin: 0,
    color: CATS_MUTED,
    fontFamily: CATS_SERIF,
    fontSize: CATS_BODY_SIZE,
    fontWeight: 400,
    lineHeight: 1.4,
    letterSpacing: CATS_BODY_TRACKING,
  },
  basicInfoSubsectionEmpty: {
    margin: 0,
    padding: "11px 12px",
    borderRadius: "var(--radius-lg)",
    border: "1px solid color-mix(in srgb, var(--line-strong) 52%, transparent)",
    background: "color-mix(in srgb, var(--paper) 25%, transparent)",
    color: CATS_FAINT,
    fontFamily: CATS_SERIF,
    fontSize: CATS_META_SIZE,
    fontWeight: 400,
    lineHeight: 1.45,
    letterSpacing: CATS_META_TRACKING,
  },
  basicInfoRow: {
    display: "grid",
    gridTemplateColumns: "92px minmax(0, 1fr)",
    alignItems: "center",
    gap: "12px",
    minHeight: "38px",
    padding: "0 12px",
    borderBottom: "1px solid color-mix(in srgb, var(--line-strong) 46%, transparent)",
  },
  basicInfoLabel: {
    color: CATS_MUTED,
    fontFamily: CATS_UI,
    fontSize: CATS_META_SIZE,
    fontWeight: 400,
    lineHeight: 1.35,
    letterSpacing: "0.03em",
  },
  basicInfoValue: {
    minWidth: 0,
    color: CATS_TEXT,
    fontFamily: CATS_UI,
    fontSize: CATS_BODY_SIZE,
    fontWeight: 400,
    lineHeight: 1.35,
    letterSpacing: "0.01em",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  basicInfoMissing: {
    color: CATS_FAINT,
  },
  basicInfoEditLink: {
    width: "fit-content",
    minHeight: "34px",
    padding: "0 10px",
    border: "none",
    borderRadius: "var(--radius-full)",
    background: "transparent",
    color: "var(--seal)",
    fontFamily: CATS_SERIF,
    fontSize: CATS_META_SIZE,
    fontWeight: 400,
    letterSpacing: CATS_META_TRACKING,
    cursor: "pointer",
  },
  basicInfoManageButton: {
    width: "fit-content",
    minHeight: "34px",
    padding: "0 10px",
    border: "none",
    borderRadius: "var(--radius-full)",
    background: "transparent",
    color: CATS_MUTED,
    fontFamily: CATS_SERIF,
    fontSize: CATS_META_SIZE,
    fontWeight: 400,
    letterSpacing: CATS_META_TRACKING,
    cursor: "pointer",
  },
  catManageSheet: {
    display: "grid",
    gap: "9px",
    minWidth: 0,
    overflowX: "hidden",
  },
  catManageEditor: {
    display: "grid",
    gap: "18px",
    minWidth: 0,
  },
  catManageEditorIntro: {
    display: "grid",
    gap: "5px",
    minWidth: 0,
    padding: "2px 2px 6px",
  },
  catManageEditorHero: {
    display: "grid",
    gridTemplateColumns: "44px minmax(0, 1fr)",
    alignItems: "center",
    gap: "12px",
    padding: "10px 12px",
    borderRadius: "var(--radius-lg)",
    background:
      "linear-gradient(135deg, color-mix(in srgb, var(--paper) 72%, transparent), color-mix(in srgb, var(--paper-warm) 48%, transparent))",
    boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--line) 52%, transparent)",
  },
  catManageEditorAvatar: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    objectFit: "cover",
    background: "var(--paper-card)",
    boxShadow:
      "0 0 0 3px color-mix(in srgb, var(--paper-card) 82%, transparent), var(--shadow-e1)",
  },
  catManageAddAvatar: {
    width: "44px",
    height: "44px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    color: CATS_MUTED,
    background: "color-mix(in srgb, var(--paper-card) 84%, transparent)",
    boxShadow:
      "0 0 0 2px color-mix(in srgb, var(--paper-card) 78%, transparent), var(--shadow-e1)",
  },
  catManageEditorHeroText: {
    display: "grid",
    gap: "2px",
    minWidth: 0,
  },
  catManageEditorKicker: {
    margin: 0,
    color: CATS_FAINT,
    fontFamily: CATS_UI,
    fontSize: CATS_TINY_SIZE,
    fontWeight: 400,
    lineHeight: 1.2,
    letterSpacing: CATS_META_TRACKING,
  },
  catManageEditorName: {
    margin: 0,
    color: CATS_TEXT_STRONG,
    fontFamily: CATS_SERIF,
    fontSize: "20px",
    fontWeight: 400,
    lineHeight: 1.35,
    letterSpacing: CATS_TITLE_TRACKING,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  catManageEditorIntroTitle: {
    margin: 0,
    color: CATS_TEXT_STRONG,
    fontFamily: CATS_SERIF,
    fontSize: "21px",
    fontWeight: 400,
    lineHeight: 1.38,
    letterSpacing: CATS_TITLE_TRACKING,
  },
  catManageEditorIntroText: {
    margin: 0,
    color: CATS_MUTED,
    fontFamily: CATS_SERIF,
    fontSize: CATS_BODY_SIZE,
    fontWeight: 400,
    lineHeight: 1.65,
    letterSpacing: CATS_BODY_TRACKING,
  },
  catManageFormSection: {
    display: "grid",
    gap: "12px",
    minWidth: 0,
    padding: "18px 2px 0",
    borderTop: "1px solid color-mix(in srgb, var(--line) 62%, transparent)",
  },
  catManageFormHeading: {
    display: "grid",
    gap: "4px",
    minWidth: 0,
  },
  catManageFormTitle: {
    margin: 0,
    color: CATS_TEXT_STRONG,
    fontFamily: CATS_SERIF,
    fontSize: "16px",
    fontWeight: 400,
    lineHeight: 1.45,
    letterSpacing: CATS_TITLE_TRACKING,
  },
  catManageFormNote: {
    margin: 0,
    color: CATS_MUTED,
    fontFamily: CATS_SERIF,
    fontSize: CATS_META_SIZE,
    fontWeight: 400,
    lineHeight: 1.55,
    letterSpacing: CATS_META_TRACKING,
  },
  catManageDateGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: "10px",
    minWidth: 0,
  },
  catManageEditorActions: {
    position: "sticky",
    bottom: "-1px",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    margin: "2px -2px 0",
    padding: "10px 2px 2px",
    background:
      "linear-gradient(180deg, transparent, color-mix(in srgb, var(--paper-card) 92%, transparent) 42%)",
  },
  deleteCatConfirm: {
    display: "grid",
    gap: "16px",
  },
  deleteCatConfirmTitle: {
    margin: 0,
    color: CATS_TEXT_STRONG,
    fontFamily: CATS_SERIF,
    fontSize: "18px",
    fontWeight: 400,
    lineHeight: 1.45,
  },
  deleteCatConfirmText: {
    margin: 0,
    color: CATS_MUTED,
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.7,
  },
  deleteCatConfirmActions: {
    display: "grid",
    gap: "8px",
  },
  profileMetaLine: {
    color: CATS_MUTED,
    fontFamily: CATS_SERIF,
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.35,
    letterSpacing: "var(--tracking-body)",
  },
  lensPhotoSection: {
    margin: "0 -8px 20px",
    padding: "0 8px",
  },
  allLensCard: {
    margin: "0 -8px 24px",
    padding: "0 8px",
  },
  lensSectionHeader: {
    display: "grid",
    gap: "4px",
    margin: "0 8px 12px",
  },
  lensSectionTitleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  lensSectionTitle: {
    margin: 0,
    color: CATS_TEXT,
    fontFamily: CATS_SERIF,
    fontSize: CATS_TITLE_SIZE,
    fontWeight: 400,
    lineHeight: 1.45,
    letterSpacing: CATS_TITLE_TRACKING,
  },
  lensAddPhotoButton: {
    flex: "0 0 auto",
    minHeight: "34px",
    padding: "0 12px",
    border: "1px solid color-mix(in srgb, var(--control-border) 76%, transparent)",
    borderRadius: "999px",
    background: "color-mix(in srgb, var(--paper) 72%, transparent)",
    color: CATS_TEXT,
    fontFamily: CATS_UI,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1,
    cursor: "pointer",
    boxShadow: "var(--shadow-e0)",
    WebkitTapHighlightColor: "transparent",
  },
  lensSectionSub: {
    margin: 0,
    color: CATS_MUTED,
    fontFamily: CATS_SERIF,
    fontSize: CATS_BODY_SIZE,
    fontWeight: 400,
    lineHeight: 1.6,
    letterSpacing: CATS_BODY_TRACKING,
  },
  lensPhotoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "4px",
    overflow: "hidden",
    borderRadius: "8px",
  },
  lensPhotoItem: {
    display: "grid",
    gap: 0,
    minWidth: 0,
  },
  lensPhotoTileRoot: {
    width: "100%",
  },
  lensPhotoTile: {
    width: "100%",
    height: "auto",
    aspectRatio: "1 / 1",
    border: "0",
    borderRadius: "8px",
    boxShadow: "none",
  },
  lensPhotoDate: {
    display: "none",
    color: CATS_MUTED,
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.2,
    letterSpacing: 0,
  },
  lensPhotoCats: {
    display: "none",
    color: CATS_FAINT,
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.3,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  lensPhotoEmpty: {
    margin: 0,
    color: CATS_MUTED,
    fontFamily: CATS_SERIF,
    fontSize: CATS_BODY_SIZE,
    fontWeight: 400,
    lineHeight: 1.7,
    letterSpacing: CATS_BODY_TRACKING,
  },
  lensPhotoMore: {
    margin: 0,
    color: CATS_MUTED,
    fontFamily: CATS_SERIF,
    fontSize: CATS_TINY_SIZE,
    fontWeight: 400,
    lineHeight: 1.45,
    letterSpacing: CATS_META_TRACKING,
  },
  lensPhotoMoreRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    minHeight: "44px",
    margin: "8px 8px 0",
    padding: 0,
  },
  lensPhotoMoreButton: {
    flex: "0 0 auto",
    minHeight: "40px",
    padding: "0 16px",
    border: "1px solid color-mix(in srgb, var(--control-border) 76%, transparent)",
    background: "color-mix(in srgb, var(--paper) 70%, transparent)",
    color: CATS_TEXT,
  },
  photoListSheet: {
    display: "grid",
    gap: "10px",
    minWidth: 0,
  },
  photoListCount: {
    margin: "0 2px",
    color: CATS_MUTED,
    fontFamily: CATS_UI,
    fontSize: CATS_META_SIZE,
    fontWeight: 400,
    lineHeight: 1.4,
    letterSpacing: CATS_META_TRACKING,
  },
  photoListGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "2px",
    minWidth: 0,
  },
  photoListItem: {
    position: "relative",
    minWidth: 0,
    aspectRatio: "1 / 1",
    overflow: "hidden",
    padding: 0,
    border: "none",
    background: "color-mix(in srgb, var(--paper-warm) 34%, transparent)",
    color: "inherit",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  photoListTileRoot: {
    width: "100%",
    height: "100%",
    display: "block",
  },
  photoListTile: {
    width: "100%",
    height: "100%",
    border: "none",
    borderRadius: "0",
    boxShadow: "none",
  },
  photoListCatNames: {
    position: "absolute",
    left: "4px",
    bottom: "4px",
    maxWidth: "calc(100% - 8px)",
    padding: "2px 5px",
    borderRadius: "var(--radius-full)",
    background: "color-mix(in srgb, var(--paper-card) 78%, transparent)",
    color: CATS_MUTED,
    fontFamily: CATS_UI,
    fontSize: "10px",
    fontWeight: 400,
    lineHeight: 1.25,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  basicInfoLongValue: {
    overflow: "visible",
    textOverflow: "clip",
    whiteSpace: "normal",
    padding: "9px 0",
  },
  yearSummarySheet: {
    display: "grid",
    gap: "14px",
  },
  yearSummaryCover: {
    width: "100%",
    aspectRatio: "16 / 9",
    overflow: "hidden",
    borderRadius: "14px",
    background: CATS_PANEL_BACKGROUND_SOFT,
  },
  yearSummaryCoverImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "14px",
  },
  yearSummaryStats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
  },
  yearSummaryStat: {
    display: "grid",
    gap: "3px",
    minHeight: "68px",
    alignContent: "center",
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid color-mix(in srgb, var(--line) 78%, transparent)",
    background: "color-mix(in srgb, var(--paper-card) 32%, transparent)",
  },
  yearSummaryStatButton: {
    width: "100%",
    textAlign: "left" as const,
    color: "inherit",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  yearSummaryStatButtonActive: {
    borderColor: "color-mix(in srgb, var(--seal) 38%, var(--line))",
    background: "color-mix(in srgb, var(--seal) 8%, var(--paper-card) 34%)",
  },
  yearSummaryStatButtonDisabled: {
    cursor: "default",
    opacity: 0.56,
  },
  yearSummaryStatValue: {
    color: CATS_TEXT_STRONG,
    fontFamily: CATS_UI,
    fontSize: "20px",
    fontWeight: 500,
    lineHeight: 1.2,
    letterSpacing: "0",
  },
  yearSummaryStatLabel: {
    color: CATS_MUTED,
    fontFamily: CATS_UI,
    fontSize: "11px",
    fontWeight: 500,
    lineHeight: 1.3,
    letterSpacing: "0",
  },
  yearSummaryDetail: {
    display: "grid",
    gap: "9px",
    padding: "12px",
    borderRadius: "14px",
    border: "1px solid color-mix(in srgb, var(--line) 78%, transparent)",
    background: "color-mix(in srgb, var(--paper-card) 28%, transparent)",
  },
  yearSummaryDetailTitle: {
    margin: 0,
    color: CATS_TEXT_STRONG,
    fontFamily: CATS_UI,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.35,
    letterSpacing: "0",
  },
  yearSummaryPhotoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "6px",
  },
  yearSummaryPhotoButton: {
    width: "100%",
    aspectRatio: "1 / 1",
    overflow: "hidden",
    padding: 0,
    border: "1px solid color-mix(in srgb, var(--line) 74%, transparent)",
    borderRadius: "12px",
    background: CATS_PANEL_BACKGROUND_SOFT,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  yearSummaryPhotoImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "11px",
  },
  yearSummaryRows: {
    display: "grid",
    gap: "7px",
  },
  yearSummaryRow: {
    display: "grid",
    gridTemplateColumns: "44px minmax(0, 1fr) auto",
    alignItems: "center",
    gap: "10px",
    minHeight: "56px",
    width: "100%",
    padding: "6px",
    border: "1px solid color-mix(in srgb, var(--line) 72%, transparent)",
    borderRadius: "12px",
    background: "color-mix(in srgb, var(--paper-card) 42%, transparent)",
    color: "inherit",
    textAlign: "left" as const,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  yearSummaryRowThumb: {
    width: "44px",
    height: "44px",
    overflow: "hidden",
    borderRadius: "10px",
    background: CATS_PANEL_BACKGROUND_SOFT,
  },
  yearSummaryRowImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "10px",
  },
  yearSummaryRowFallback: {
    display: "block",
    width: "100%",
    height: "100%",
    background: "color-mix(in srgb, var(--seal) 10%, transparent)",
  },
  yearSummaryRowText: {
    display: "grid",
    gap: "2px",
    minWidth: 0,
  },
  yearSummaryRowTitle: {
    color: CATS_TEXT_STRONG,
    fontFamily: CATS_UI,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.35,
    letterSpacing: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  yearSummaryRowMeta: {
    color: CATS_MUTED,
    fontFamily: CATS_UI,
    fontSize: "11px",
    fontWeight: 400,
    lineHeight: 1.3,
    letterSpacing: "0",
  },
  yearSummaryBlock: {
    display: "grid",
    gap: "5px",
    padding: "12px 0",
    borderTop: "1px solid color-mix(in srgb, var(--line) 84%, transparent)",
  },
  yearSummaryBlockLabel: {
    margin: 0,
    color: CATS_MUTED,
    fontFamily: CATS_UI,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.35,
    letterSpacing: "0",
  },
  yearSummaryBlockText: {
    margin: 0,
    color: CATS_TEXT_STRONG,
    fontFamily: CATS_UI,
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: 1.45,
    letterSpacing: "0",
  },
  yearSummaryHighlights: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "6px",
  },
  yearSummaryHighlight: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "28px",
    padding: "0 10px",
    borderRadius: "999px",
    background: "color-mix(in srgb, var(--seal) 10%, transparent)",
    color: "var(--seal)",
    fontFamily: CATS_UI,
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: "0",
  },
  thumbnailPicker: {
    display: "grid",
    gap: "18px",
    minWidth: 0,
  },
  thumbnailPickerActions: {
    display: "grid",
    gap: "8px",
  },
  thumbnailPickerSection: {
    display: "grid",
    gap: "9px",
    minWidth: 0,
  },
  thumbnailPickerTitle: {
    margin: "0 2px",
    color: CATS_MUTED,
    fontFamily: CATS_SERIF,
    fontSize: CATS_META_SIZE,
    fontWeight: 400,
    lineHeight: 1.45,
    letterSpacing: CATS_META_TRACKING,
  },
  thumbnailPickerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "6px",
    minWidth: 0,
  },
  thumbnailPickerPhoto: {
    position: "relative",
    minWidth: 0,
    aspectRatio: "1 / 1",
    padding: 0,
    border: "1px solid color-mix(in srgb, var(--paper-card) 82%, transparent)",
    borderRadius: "14px",
    overflow: "hidden",
    background: "color-mix(in srgb, var(--paper-warm) 34%, transparent)",
    boxShadow:
      "0 1px 0 color-mix(in srgb, var(--paper) 80%, transparent), 0 10px 20px -18px color-mix(in srgb, var(--ink) 28%, transparent)",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  thumbnailPickerPhotoTileRoot: {
    display: "block",
    width: "100%",
    height: "100%",
  },
  thumbnailPickerPhotoTile: {
    width: "100%",
    height: "100%",
    border: "none",
    borderRadius: 0,
    boxShadow: "none",
  },
  thumbnailPickerEmpty: {
    margin: 0,
    color: CATS_FAINT,
    fontFamily: CATS_SERIF,
    fontSize: CATS_BODY_SIZE,
    fontWeight: 400,
    lineHeight: 1.7,
    letterSpacing: CATS_BODY_TRACKING,
  },
  zukanHint: {
    margin: "8px 0 0",
    color: CATS_FAINT,
    fontFamily: CATS_SERIF,
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.4,
    letterSpacing: "var(--tracking-body)",
  },
  homePhotoSection: {
    display: "flex",
    gap: "11px",
    alignItems: "center",
    padding: "1px 0",
  },
  sectionTitle: {
    margin: "0 0 9px",
    color: CATS_FAINT,
    fontFamily: CATS_SERIF,
    fontSize: CATS_META_SIZE,
    fontWeight: 400,
    letterSpacing: CATS_META_TRACKING,
  },
  homePhotoPreview: {
    width: "76px",
    height: "98px",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    ...CATS_SURFACE_SOFT,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  homePhotoPreviewImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  homePhotoPreviewText: {
    fontSize: "12px",
    color: CATS_FAINT,
  },
  homePhotoInfo: {
    flex: 1,
    minWidth: 0,
  },
  homePhotoTitle: {
    fontFamily: CATS_SERIF,
    fontSize: CATS_BODY_SIZE,
    fontWeight: 400,
    letterSpacing: CATS_BODY_TRACKING,
    color: CATS_TEXT,
    margin: "0 0 4px",
  },
  homePhotoSub: {
    fontSize: CATS_META_SIZE,
    color: CATS_MUTED,
    fontFamily: CATS_SERIF,
    lineHeight: 1.6,
    letterSpacing: CATS_META_TRACKING,
    margin: "0 0 10px",
  },
  homePhotoActions: {
    display: "flex",
    alignItems: "center",
  },
  homePhotoButton: {
    width: "fit-content",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-full)",
    background: "color-mix(in srgb, var(--paper) 46%, transparent)",
    color: CATS_MUTED,
    fontSize: "12px",
    fontWeight: 500,
    padding: "6px 11px",
    cursor: "pointer",
  },
  divider: {
    border: "none",
    borderTop: "1px solid color-mix(in srgb, var(--line) 75%, transparent)",
    margin: "15px -16px",
  },
  infoRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 0",
  },
  infoLabel: {
    fontSize: "12px",
    color: CATS_FAINT,
    fontFamily: CATS_UI,
    letterSpacing: "0.03em",
  },
  infoValue: {
    fontSize: CATS_BODY_SIZE,
    color: CATS_TEXT,
    fontFamily: CATS_UI,
    fontWeight: 400,
    letterSpacing: "0.01em",
  },
  emptyInfoText: {
    margin: "2px 0 0",
    color: CATS_MUTED,
    fontSize: "12px",
    lineHeight: 1.6,
    fontFamily: CATS_SERIF,
    letterSpacing: "0.06em",
  },
  coatRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  coatDot: {
    width: "14px",
    height: "14px",
    borderRadius: "50%",
  },
  sectionLabel: {
    margin: "0 0 5px",
    color: CATS_MUTED,
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.5,
  },
  coatSection: {
    marginTop: "10px",
  },
  coatHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "8px",
  },
  coatSwatch: {
    display: "inline-block",
    width: "14px",
    height: "14px",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-full)",
    flex: "0 0 auto",
  },
  editor: {
    marginTop: "10px",
    display: "grid",
    gap: "10px",
  },
  duplicateCatWarning: {
    margin: "-2px 0 0",
    color: CATS_MUTED,
    fontSize: "12px",
    lineHeight: 1.6,
  },
  actions: {
    display: "flex",
    gap: "10px",
    marginTop: "2px",
  },
  bunbakoSection: {
    marginTop: "22px",
    marginBottom: "28px",
    background: CATS_PANEL_BACKGROUND,
    backdropFilter: "none",
  },
  bunbakoHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "12px",
  },
  bunbakoSectionTitle: {
    margin: 0,
    color: CATS_TEXT,
    fontFamily: CATS_SERIF,
    fontSize: CATS_TITLE_SIZE,
    fontWeight: 400,
    letterSpacing: CATS_TITLE_TRACKING,
  },
  sectionLead: {
    margin: "4px 0 14px",
    color: CATS_MUTED,
    fontFamily: CATS_UI,
    fontSize: CATS_META_SIZE,
    fontWeight: 400,
    letterSpacing: "0.02em",
    lineHeight: 1.6,
  },
  bunbakoScroller: {
    display: "flex",
    gap: "12px",
    overflowX: "auto",
    padding: "4px 2px 8px",
    WebkitOverflowScrolling: "touch",
  },
  bunbakoLetter: {
    position: "relative",
    flex: "0 0 152px",
    minHeight: "118px",
    display: "grid",
    gridTemplateRows: "auto 1fr",
    gap: "8px",
    padding: "12px",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-md)",
    background: "var(--paper-card)",
    color: CATS_TEXT,
    boxShadow: "var(--shadow-e1)",
    textAlign: "left",
    transform: "rotate(-1deg)",
  },
  bunbakoPostmark: {
    color: CATS_MUTED,
    fontFamily: CATS_SERIF,
    fontSize: CATS_META_SIZE,
    letterSpacing: CATS_META_TRACKING,
    lineHeight: 1.45,
  },
  bunbakoWindow: {
    width: "72px",
    height: "54px",
    alignSelf: "end",
    overflow: "hidden",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-md)",
    background: CATS_PAPER,
  },
  bunbakoPhoto: {
    width: "100%",
    height: "100%",
    borderRadius: "var(--radius-md)",
  },
  bunbakoSeal: {
    position: "absolute",
    right: "14px",
    bottom: "18px",
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    background: "var(--seal)",
  },
  bunbakoEmpty: {
    margin: "4px 0 12px",
    color: CATS_MUTED,
    fontFamily: CATS_SERIF,
    fontSize: CATS_BODY_SIZE,
    letterSpacing: CATS_BODY_TRACKING,
    lineHeight: 1.7,
  },
  omoideControls: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "12px",
  },
  daysThread: {
    marginTop: "24px",
    marginBottom: "12px",
    background: CATS_PANEL_BACKGROUND_SOFT,
    backdropFilter: "none",
  },
  threadLine: {
    display: "grid",
    gap: "12px",
    marginTop: "12px",
    paddingLeft: "14px",
    borderLeft: "1px solid var(--line)",
  },
  threadNode: {
    display: "grid",
    gap: "4px",
  },
  threadNodeTitle: {
    color: CATS_TEXT,
    fontFamily: CATS_SERIF,
    fontSize: CATS_BODY_SIZE,
    letterSpacing: CATS_BODY_TRACKING,
  },
  threadNodeText: {
    color: CATS_MUTED,
    fontFamily: CATS_UI,
    fontSize: CATS_META_SIZE,
    lineHeight: 1.7,
    letterSpacing: "0.02em",
  },
  omoideSheet: {
    display: "grid",
    gap: "12px",
    justifyItems: "center",
  },
  omoideSheetTitle: {
    margin: 0,
    color: CATS_TEXT,
    fontFamily: CATS_SERIF,
    fontSize: CATS_TITLE_SIZE,
    letterSpacing: CATS_TITLE_TRACKING,
  },
  omoideSheetImageFrame: {
    width: "min(70vw, 260px)",
    aspectRatio: "1 / 1",
    padding: "8px",
    borderRadius: "var(--radius-xl)",
    background: CATS_PAPER,
    boxShadow: "var(--shadow-e1)",
  },
  omoideSheetImage: {
    width: "100%",
    height: "100%",
    borderRadius: "var(--radius-lg)",
  },
  omoideSheetVoice: {
    margin: 0,
    color: CATS_TEXT,
    fontFamily: CATS_SERIF,
    fontSize: "13px",
    letterSpacing: "var(--tracking-body)",
  },
  omoideSheetBridge: {
    margin: 0,
    color: CATS_MUTED,
    fontSize: "12px",
  },
  message: {
    margin: "10px 0 0",
    color: CATS_MUTED,
    fontSize: "13px",
    lineHeight: 1.6,
  },
} satisfies Record<string, CSSProperties>;
