"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { storeAccountPhotoDataUrl } from "../../lib/photoStorageClient";
import { STORAGE_KEYS } from "../../lib/storage";
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
type LensPhoto = {
  id: string;
  src: string;
  createdAt: number;
  catIds: string[];
  catNames: string[];
};
type DeleteCatTarget = {
  profile: CatProfile;
  photoCount: number;
};
type RemoteCatDeleteResult =
  | { status: "deleted" | "skipped" }
  | { status: "error"; message: string };

const UCHINOKO_PHOTO_PREVIEW_LIMIT = 6;
const CATS_TEXT = "var(--ink)";
const CATS_TEXT_STRONG = "var(--ink)";
const CATS_MUTED = "var(--ink-soft)";
const CATS_FAINT = "var(--ink-faint)";
const CATS_PAPER = "var(--paper)";
const CATS_SERIF = "var(--font-display)";
const CATS_UI = "var(--font-ui)";
const CATS_TITLE_SIZE = "18px";
const CATS_DISPLAY_SIZE = "23px";
const CATS_BODY_SIZE = "14px";
const CATS_META_SIZE = "12px";
const CATS_TINY_SIZE = "11px";
const CATS_TITLE_TRACKING = "0.03em";
const CATS_BODY_TRACKING = "0.02em";
const CATS_META_TRACKING = "0.03em";
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
  const [isCatSwitcherOpen, setIsCatSwitcherOpen] = useState(false);
  const [isCatManageOpen, setIsCatManageOpen] = useState(false);
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
  const [message, setMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [omoideRefreshTick, setOmoideRefreshTick] = useState(0);
  const [activeLens, setActiveLens] = useState<UchinokoLens>("cat");
  const [deleteCatTarget, setDeleteCatTarget] =
    useState<DeleteCatTarget | null>(null);
  const [isDeletingCat, setIsDeletingCat] = useState(false);
  const [remoteLensPhotosByCat, setRemoteLensPhotosByCat] = useState<
    Record<string, LensPhoto[]>
  >({});
  const [hasRemoteLensPhotosLoaded, setHasRemoteLensPhotosLoaded] =
    useState(false);
  const [selectedOmoideMemory, setSelectedOmoideMemory] =
    useState<OmoideMemory | null>(null);

  const activeCatProfile =
    catProfiles.length > 0
      ? getActiveCatProfile(catProfiles, activeCatId)
      : null;
  const catName = getCatName(activeCatProfile);
  const activeGender = formatGender(activeCatProfile?.basicInfo?.gender);
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
  const shouldShowSingleCatAdd = catProfiles.length === 1 && canManageCats;
  const shouldShowLensSwitch =
    catProfiles.length > 1 &&
    canManageCats &&
    !isAddingCat &&
    !isEditingProfile;
  const localLensPhotos = useMemo(
    () => createLocalLensPhotos(catProfiles),
    [catProfiles],
  );
  const lensPhotosByCat = mergeLensPhotoSources(
    localLensPhotos.byCat,
    remoteLensPhotosByCat,
    hasRemoteLensPhotosLoaded,
  );
  const activeCatLensPhotos = activeCatId
    ? lensPhotosByCat[activeCatId] ?? []
    : [];
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

  useEffect(() => {
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
    setIsCatSwitcherOpen(false);
    setIsEditingCatName(false);
    setIsEditingProfile(false);
    setIsOnboardingAlbumCreated(false);
    setMessage("");
    setSaveMessage("");
  }

  function startAddingCat() {
    setNewCatNameInput("");
    setDuplicateCatNameToConfirm(null);
    setMessage("");
    setSaveMessage("");
    setIsAddingCat(true);
    setIsCatSwitcherOpen(false);
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
    setMessage("保存しました。");
  }

  function handleStartEdit() {
    setCatNameInput(activeCatProfile?.name ?? catName);
    setEditFamilySinceDate(activeCatProfile?.basicInfo?.familySinceDate ?? "");
    setEditBirthDate(activeCatProfile?.basicInfo?.birthDate ?? "");
    setEditGender(activeCatProfile?.basicInfo?.gender ?? "");
    setEditBreed(activeCatProfile?.basicInfo?.breed ?? "");
    setEditCoat(activeCatProfile?.appearance?.coat ?? "");
    setMessage("");
    setSaveMessage("");
    setIsAddingCat(false);
    setIsEditingCatName(true);
    setIsEditingProfile(true);
  }

  function cancelEditingCatName() {
    setCatNameInput(catName);
    setMessage("");
    setSaveMessage("");
    setIsEditingCatName(false);
    setIsEditingProfile(false);
  }

  function handleSaveProfile() {
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

      const nextProfile = {
        ...profiles[index],
        name: catNameInput.trim() || profiles[index].name,
        basicInfo: {
          familySinceDate: editFamilySinceDate || undefined,
          birthDate: editBirthDate || undefined,
          gender: editGender || undefined,
          breed: editBreed.trim() || undefined,
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

      window.localStorage.setItem(
        STORAGE_KEYS.catProfiles,
        JSON.stringify(nextProfiles),
      );
      setCatProfiles(nextProfiles);
      setActiveCatId(nextProfile.id);
      setCatNameInput(nextProfile.name);
      setIsEditingCatName(false);
      setIsEditingProfile(false);
      if (isOnboardingMode) {
        setIsOnboardingAlbumCreated(true);
        setSaveMessage("");
        return;
      }

      setSaveMessage("保存しました。");
      setTimeout(() => setSaveMessage(""), 2000);
    } catch {
      return;
    }
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
        const dataUrl = await resizeAndEncode(file, 800);
        const photoSrc = await storeAccountPhotoDataUrl({
          dataUrl,
          pathSegments: [targetCatId, "avatar"],
          fileName: "avatar",
        });
        const raw = window.localStorage.getItem(STORAGE_KEYS.catProfiles);

        if (!raw) {
          return;
        }

        const profiles = JSON.parse(raw) as CatProfile[];
        const index = profiles.findIndex((profile) => profile.id === targetCatId);

        if (index === -1) {
          return;
        }

        const nextProfiles = profiles.map((profile, profileIndex) =>
          profileIndex === index
            ? {
                ...profile,
                avatarDataUrl: photoSrc,
                updatedAt: new Date().toISOString(),
              }
            : profile,
        );

        window.localStorage.setItem(
          STORAGE_KEYS.catProfiles,
          JSON.stringify(nextProfiles),
        );
        setCatProfiles(nextProfiles);
      } catch {
        return;
      }
    };

    input.click();
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
    setIsCatSwitcherOpen(false);
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
    <main style={styles.page}>
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

        {isAddingCat && !isOnboardingCompletionView ? (
          <AppCard as="div" variant="inset" padding="sm" style={styles.editor}>
            <AppTextField
              id="new-cat-name"
              type="text"
              label="この子の名前"
              value={newCatNameInput}
              onChange={(event) => {
                setNewCatNameInput(event.target.value);
                setDuplicateCatNameToConfirm(null);
              }}
              placeholder={"例：麦"}
            />
            {duplicateCatNameToConfirm ? (
              <p style={styles.duplicateCatWarning}>
                おなじこかもしれません。別のねことして保存しますか？
              </p>
            ) : null}
            <div style={styles.actions}>
              <AppButton
                type="button"
                onClick={handleAddCatSave}
                variant="primary"
                size="md"
              >
                {duplicateCatNameToConfirm ? "別のねことして保存" : "保存"}
              </AppButton>
              <AppButton
                type="button"
                onClick={cancelAddingCat}
                variant="quiet"
                size="md"
              >
                {"キャンセル"}
              </AppButton>
            </div>
          </AppCard>
        ) : null}

        {activeCatProfile && !isOnboardingCompletionView && activeLens === "cat" ? (
          <AppCard
            variant="section"
            padding="standard"
            style={
              isOnboardingProfileSetup
                ? styles.profileCard
                : styles.profilePlaceCard
            }
          >
            {!isOnboardingProfileSetup ? (
              <>
                <div style={styles.profileHero}>
                  <button
                    type="button"
                    style={styles.profileHeroAvatar}
                    onClick={() => void handleAvatarUpload()}
                    aria-label={`${activeCatProfile.name}のアイコン写真を変更`}
                  >
                    <PhotoTile
                      src={activeAvatarSrc}
                      alt=""
                      variant="avatar"
                      fit={activeCatProfile.avatarDataUrl ? "cover" : "contain"}
                      style={styles.profileHeroAvatarTileRoot}
                      imageStyle={
                        activeCatProfile.avatarDataUrl
                          ? styles.profileHeroAvatarPhotoTile
                          : styles.profileHeroAvatarIconTile
                      }
                    />
                  </button>
                  <div style={styles.profileHeroInfo}>
                    <div style={styles.profileName}>{activeCatProfile.name}</div>
                    {familyDuration.primary !== "未設定" ? (
                      <div style={styles.profileMetaLine}>
                        {familyDuration.secondary || familyDuration.primary}
                      </div>
                    ) : null}
                  </div>
                  <div style={styles.profileHeroActions}>
                    {canManageCats ? (
                      <AppButton
                        type="button"
                        variant="ghost"
                        size="icon"
                        iconOnly
                        onClick={() => setIsCatManageOpen(true)}
                        aria-label="うちのこを管理"
                      >
                        …
                      </AppButton>
                    ) : null}
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
                          label="家に来た日"
                          value={editFamilySinceDate}
                          onChange={(event) =>
                            setEditFamilySinceDate(event.target.value)
                          }
                          max={new Date().toISOString().split("T")[0]}
                        />

                        <AppTextField
                          type="date"
                          label="生年月日"
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
                          label="猫種"
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
          </AppCard>
        ) : null}

        {shouldShowLensSwitch ? (
          <AppSegmented<UchinokoLens>
            value={activeLens}
            ariaLabel="うちのこの見かた"
            columns={2}
            onChange={setActiveLens}
            options={[
              { value: "cat", label: "ねこ" },
              { value: "all", label: "ぜんぶ" },
            ]}
            style={styles.lensSwitch}
          />
        ) : null}

        {activeCatProfile && !isOnboardingCompletionView && activeLens === "cat" ? (
          <CatSummaryPanel
            familyDuration={familyDuration}
            photoCount={takenSleepingPhotoCount}
            omoideCount={omoideMemories.length}
            familySinceDate={activeCatProfile.basicInfo?.familySinceDate}
            birthdayStatus={birthdayStatus}
          />
        ) : null}

        {activeCatProfile && !isOnboardingCompletionView && activeLens === "cat" ? (
          <AppCard
            as="section"
            variant="section"
            padding="md"
            style={styles.basicInfoPanel}
          >
            <BasicInfoTable
              profile={activeCatProfile}
              onEdit={() => {
                setIsEditingProfile(true);
                setIsEditingCatName(true);
              }}
            />
          </AppCard>
        ) : null}

        {activeCatProfile && !isOnboardingCompletionView && activeLens === "cat" ? (
          <LensPhotoSection
            title="最近のすがた"
            photos={activeCatLensPhotos}
            emptyCopy="このこに紐づく ねがおは、まだありません。"
          />
        ) : null}

        {activeCatProfile && !isOnboardingCompletionView && activeLens === "all" ? (
          <AllCatsLensView
            photos={allLensPhotos}
            catCount={catProfiles.length}
          />
        ) : null}

        {activeCatProfile && !isOnboardingCompletionView && activeLens === "cat" ? (
          <>
            <AppCard
              as="section"
              variant="section"
              padding="md"
              style={styles.footprintsPanel}
            >
              <div style={styles.footprintsSection}>
                <p style={styles.footprintsTitle}>あしあと</p>
                <div style={styles.footprintsScroller}>
                  {sleepingMilestones.map((milestone) => (
                    <FootprintCard
                      key={milestone.target}
                      milestone={milestone}
                    />
                  ))}
                </div>
              </div>
            </AppCard>
            <OmoideBunbako
              memories={omoideMemories}
              controls={omoideControls}
              onOpen={(memory) => setSelectedOmoideMemory(memory)}
              onPause={() => {
                pauseOmoideMemories();
                setOmoideRefreshTick((value) => value + 1);
                setMessage("思い出を しばらく お休みします。");
              }}
              onDisable={() => {
                disableOmoideMemories(!omoideControls.disabled);
                setOmoideRefreshTick((value) => value + 1);
              }}
            />
            <AppCard
              as="section"
              variant="section"
              padding="md"
              style={styles.recordPanel}
            >
              <p style={styles.bunbakoSectionTitle}>記録</p>
              <p style={styles.sectionLead}>ねがおと思い出から、自動でたまります。</p>
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
                    迎えた日から
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
            {!activeCatProfile.basicInfo?.familySinceDate &&
            !activeCatProfile.basicInfo?.birthDate &&
            !activeCatProfile.basicInfo?.breed &&
            !activeCatProfile.appearance?.coat &&
            !activeGender ? (
              <p style={styles.emptyInfoText}>
                必要なことだけ、右上からそっと足せます。
              </p>
            ) : null}
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
          title="うちのこを管理"
          onClose={() => setIsCatManageOpen(false)}
        >
          <div style={styles.catManageSheet}>
            {shouldShowCatSwitchButton ? (
              <AppButton
                type="button"
                variant="secondary"
                fullWidth
                iconStart={<CatSwitchIcon />}
                onClick={() => {
                  setIsCatManageOpen(false);
                  setIsCatSwitcherOpen(true);
                }}
              >
                ねこを切り替える
              </AppButton>
            ) : null}
            <AppButton
              type="button"
              variant="secondary"
              fullWidth
              iconStart={<AddSmallIcon />}
              onClick={() => {
                setIsCatManageOpen(false);
                startAddingCat();
              }}
            >
              ねこをふやす
            </AppButton>
            <AppButton
              type="button"
              variant="secondary"
              fullWidth
              iconStart={<PencilSmallIcon />}
              onClick={() => {
                setIsCatManageOpen(false);
                handleStartEdit();
              }}
            >
              名前や記録を編集
            </AppButton>
            <AppButton
              type="button"
              variant="quiet"
              fullWidth
              onClick={() => {
                setIsCatManageOpen(false);
                void handleAvatarUpload();
              }}
            >
              アイコン写真を変える
            </AppButton>
            <AppButton href="/settings" variant="quiet" fullWidth>
              アプリの設定
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
          </div>
        </AppBottomSheet>
      ) : null}
      {isCatSwitcherOpen ? (
        <AppBottomSheet
          title="ねこを選ぶ"
          onClose={() => setIsCatSwitcherOpen(false)}
        >
          <div style={styles.catSheetList}>
            {catProfiles.map((profile) => {
              const isActive = profile.id === activeCatId;
              const avatarSrc =
                profile.avatarDataUrl ?? getCatAvatarSrc(profile.appearance?.coat);

              return (
                <button
                  key={profile.id}
                  type="button"
                  style={
                    isActive
                      ? { ...styles.catSheetOption, ...styles.catSheetOptionActive }
                      : styles.catSheetOption
                  }
                  onClick={() => handleCatSelect(profile.id)}
                  aria-pressed={isActive}
                >
                  <PhotoTile
                    src={avatarSrc}
                    alt=""
                    variant="avatar"
                    fit={profile.avatarDataUrl ? "cover" : "contain"}
                    style={styles.catSheetPhotoTileRoot}
                    imageStyle={
                      profile.avatarDataUrl
                        ? styles.catSheetPhotoTile
                        : styles.catSheetAvatarTile
                    }
                  />
                  <span style={styles.catSheetName}>{profile.name}</span>
                  {isActive ? (
                    <span style={styles.catSheetCurrent}>いま</span>
                  ) : null}
                </button>
              );
            })}
                <AppButton
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={startAddingCat}
                >
                  ねこを ふやす
                </AppButton>
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
  photoCount,
  omoideCount,
  familySinceDate,
  birthdayStatus,
}: {
  familyDuration: { primary: string; secondary: string };
  photoCount: number;
  omoideCount: number;
  familySinceDate?: string;
  birthdayStatus: { copy: string; isToday: boolean } | null;
}) {
  const familyCopy =
    familyDuration.secondary ||
    (familyDuration.primary === "未設定" ? "記録を育てる" : familyDuration.primary);
  const seasonCopy = getCurrentSeasonCountLabel(familySinceDate);

  return (
    <AppCard
      as="section"
      variant="section"
      padding="md"
      style={styles.summaryPanel}
    >
      <div style={styles.summaryHeader}>
        <p style={styles.summaryKicker}>この子のいま</p>
        <p style={styles.summaryMain}>{familyCopy}</p>
      </div>
      <div style={styles.summaryGrid}>
        <div style={styles.summaryTile}>
          <span style={styles.summaryTileValue}>{photoCount}枚</span>
          <span style={styles.summaryTileLabel}>すがた</span>
        </div>
        <div style={styles.summaryTile}>
          <span style={styles.summaryTileValue}>{omoideCount}通</span>
          <span style={styles.summaryTileLabel}>思い出</span>
        </div>
        <div style={styles.summaryTileWide}>
          <span style={styles.summaryTileLabel}>季節</span>
          <span style={styles.summaryTileValueSmall}>{seasonCopy}</span>
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

function BasicInfoTable({
  profile,
  onEdit,
}: {
  profile: CatProfile;
  onEdit?: () => void;
}) {
  const rows = [
    {
      label: "迎えた日",
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
      label: "猫種",
      value: profile.basicInfo?.breed,
    },
    {
      label: "毛色",
      value: profile.appearance?.coat
        ? getCoatLabel(profile.appearance.coat)
        : "",
    },
  ];
  const registeredCount = rows.filter((row) => row.value).length;

  return (
    <div style={styles.basicInfoBlock}>
      <div style={styles.basicInfoHeader}>
        <p style={styles.basicInfoTitle}>基本情報</p>
        <span style={styles.basicInfoProgress}>
          登録済み {registeredCount}/{rows.length}
        </span>
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
      {rows.some((row) => !row.value) && onEdit ? (
        <button type="button" style={styles.basicInfoEditLink} onClick={onEdit}>
          未登録のことを足す
        </button>
      ) : null}
    </div>
  );
}

function LensPhotoSection({
  title,
  photos,
  emptyCopy,
}: {
  title: string;
  photos: LensPhoto[];
  emptyCopy: string;
}) {
  return (
    <section style={styles.lensPhotoSection}>
      <div style={styles.lensSectionHeader}>
        <p style={styles.lensSectionTitle}>{title}</p>
      </div>
      <LensPhotoGrid
        photos={photos}
        emptyCopy={emptyCopy}
        showCatNames={false}
      />
    </section>
  );
}

function AllCatsLensView({
  photos,
  catCount,
}: {
  photos: LensPhoto[];
  catCount: number;
}) {
  return (
    <section style={styles.allLensCard}>
      <div style={styles.lensSectionHeader}>
        <p style={styles.lensSectionTitle}>ぜんぶの ねがお</p>
        <p style={styles.lensSectionSub}>
          {catCount}ひきの ねがおを、日付順に。
        </p>
      </div>
      <LensPhotoGrid
        photos={photos}
        emptyCopy="まだ ねがおはありません。"
        showCatNames
      />
    </section>
  );
}

function LensPhotoGrid({
  photos,
  emptyCopy,
  showCatNames,
}: {
  photos: LensPhoto[];
  emptyCopy: string;
  showCatNames: boolean;
}) {
  if (photos.length === 0) {
    return <p style={styles.lensPhotoEmpty}>{emptyCopy}</p>;
  }

  const visiblePhotos = photos.slice(0, UCHINOKO_PHOTO_PREVIEW_LIMIT);
  const hiddenCount = Math.max(0, photos.length - visiblePhotos.length);

  return (
    <>
      <div style={styles.lensPhotoGrid}>
        {visiblePhotos.map((photo) => (
          <div key={photo.id} style={styles.lensPhotoItem}>
            <PhotoTile
              src={photo.src}
              alt=""
              variant="tile"
              aspect="1 / 1"
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
      {hiddenCount > 0 ? (
        <p style={styles.lensPhotoMore}>
          最近の{visiblePhotos.length}枚を表示中
        </p>
      ) : null}
    </>
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
          …
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
  };
}

function createLocalOrphanLensPhoto(photo: OwnSleepingPhoto): LensPhoto {
  return {
    id: photo.id,
    src: photo.thumbnailSrc ?? photo.displaySrc ?? photo.src,
    createdAt: photo.createdAt,
    catIds: [],
    catNames: [],
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
    merged[catId] = dedupeLensPhotos(
      remotePhotos.length > 0 ? remotePhotos : localByCat[catId] ?? [],
    );
  }

  return merged;
}

function mergeAllLensPhotos(remotePhotos: LensPhoto[], localPhotos: LensPhoto[]) {
  return dedupeLensPhotos(remotePhotos.length > 0 ? remotePhotos : localPhotos);
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

function getLensPhotoCountForCat(
  catId: string,
  photosByCat: Record<string, LensPhoto[]>,
) {
  return dedupeLensPhotos(photosByCat[catId] ?? []).length;
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

function CatSwitchIcon() {
  return <span style={styles.catSwitchMaskIcon} aria-hidden="true" />;
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
): { copy: string; isToday: boolean } | null {
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
    };
  }

  return {
    copy: `誕生日まで あと${daysUntil}日`,
    isToday: false,
  };
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

function resizeAndEncode(file: File, maxSize = 800): Promise<string> {
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
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };

    img.src = url;
  });
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
    padding:
      "calc(20px + env(safe-area-inset-top)) 24px calc(280px + env(safe-area-inset-bottom))",
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
    marginBottom: "10px",
    background: CATS_PANEL_BACKGROUND,
    backdropFilter: "blur(2px)",
  },
  profilePlaceCard: {
    marginBottom: "10px",
    background: CATS_PANEL_BACKGROUND,
    backdropFilter: "blur(2px)",
  },
  lensSwitch: {
    margin: "0 0 12px",
  },
  profileHero: {
    display: "grid",
    gridTemplateColumns: "58px 1fr auto",
    alignItems: "center",
    gap: "12px",
  },
  profileHeroAvatar: {
    width: "58px",
    height: "58px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    border: "none",
    background: "transparent",
    cursor: "pointer",
  },
  profileHeroAvatarTileRoot: {
    width: "58px",
    height: "58px",
  },
  profileHeroAvatarPhotoTile: {
    width: "58px",
    height: "58px",
  },
  profileHeroAvatarIconTile: {
    width: "58px",
    height: "58px",
    padding: "7px",
    boxSizing: "border-box",
  },
  profileHeroInfo: {
    minWidth: 0,
    display: "grid",
    gap: "3px",
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
    gap: "7px",
  },
  catSwitchMaskIcon: {
    width: "20px",
    height: "20px",
    display: "block",
    backgroundColor: "currentColor",
    maskImage: "url('/icons/cat-tab-mask.png')",
    maskPosition: "center",
    maskRepeat: "no-repeat",
    maskSize: "contain",
    WebkitMaskImage: "url('/icons/cat-tab-mask.png')",
    WebkitMaskPosition: "center",
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskSize: "contain",
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
    borderBottom: "1px solid color-mix(in srgb, var(--line) 65%, transparent)",
  },
  recordRowLast: {
    borderBottom: "none",
  },
  recordLabel: {
    color: CATS_MUTED,
    fontFamily: CATS_SERIF,
    fontSize: CATS_META_SIZE,
    fontWeight: 400,
    lineHeight: 1.35,
    letterSpacing: CATS_META_TRACKING,
  },
  recordMetricValue: {
    color: CATS_MUTED,
    fontFamily: CATS_SERIF,
    fontSize: CATS_BODY_SIZE,
    fontWeight: 400,
    lineHeight: 1.35,
    textAlign: "right",
    letterSpacing: CATS_BODY_TRACKING,
  },
  recordMetricValueGroup: {
    display: "grid",
    justifyItems: "end",
    gap: "2px",
  },
  recordMetricSub: {
    color: CATS_FAINT,
    fontFamily: CATS_SERIF,
    fontSize: CATS_META_SIZE,
    fontWeight: 400,
    lineHeight: 1.2,
    letterSpacing: CATS_META_TRACKING,
  },
  recordPanel: {
    marginBottom: "12px",
    background: CATS_PANEL_BACKGROUND,
    backdropFilter: "blur(2px)",
  },
  footprintsPanel: {
    marginBottom: "12px",
    overflow: "hidden",
    background: CATS_PANEL_BACKGROUND,
    backdropFilter: "blur(2px)",
  },
  summaryPanel: {
    marginBottom: "12px",
    background:
      "linear-gradient(145deg, color-mix(in srgb, var(--paper-card) 42%, transparent), color-mix(in srgb, var(--paper-warm) 14%, transparent))",
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
    minHeight: "62px",
    display: "grid",
    alignContent: "center",
    justifyItems: "start",
    gap: "3px",
    padding: "10px 12px",
    borderRadius: "var(--radius-lg)",
    border: "1px solid color-mix(in srgb, var(--line) 72%, transparent)",
    background: "color-mix(in srgb, var(--paper) 24%, transparent)",
  },
  summaryTileWide: {
    minHeight: "54px",
    display: "grid",
    alignContent: "center",
    justifyItems: "start",
    gap: "2px",
    padding: "8px 12px",
    borderRadius: "var(--radius-lg)",
    border: "1px solid color-mix(in srgb, var(--line) 62%, transparent)",
    background: "color-mix(in srgb, var(--paper) 18%, transparent)",
  },
  summaryTileAccent: {
    borderColor: "color-mix(in srgb, var(--seal) 34%, var(--line))",
    background: "color-mix(in srgb, var(--seal) 6%, var(--paper))",
  },
  summaryTileValue: {
    color: CATS_TEXT_STRONG,
    fontFamily: CATS_UI,
    fontSize: CATS_TITLE_SIZE,
    fontWeight: 500,
    lineHeight: 1.25,
    letterSpacing: "0.01em",
  },
  summaryTileValueSmall: {
    color: CATS_TEXT,
    fontFamily: CATS_UI,
    fontSize: CATS_BODY_SIZE,
    fontWeight: 500,
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
    margin: "0 0 8px",
    color: CATS_FAINT,
    fontFamily: CATS_SERIF,
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.35,
    letterSpacing: "0.07em",
  },
  footprintsScroller: {
    display: "flex",
    gap: "9px",
    overflowX: "auto",
    padding: "0 2px 2px 0",
    scrollSnapType: "x proximity",
    scrollbarWidth: "none",
  },
  footprintCard: {
    width: "132px",
    minHeight: "128px",
    display: "grid",
    gap: "7px",
    flex: "0 0 auto",
    scrollSnapAlign: "start",
  },
  footprintCardEmpty: {
    width: "132px",
    minHeight: "128px",
    display: "grid",
    gap: "7px",
    flex: "0 0 auto",
    scrollSnapAlign: "start",
  },
  footprintHeader: {
    display: "grid",
    gap: "3px",
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
  basicInfoPanel: {
    marginBottom: "12px",
    background: CATS_PANEL_BACKGROUND,
    backdropFilter: "blur(2px)",
  },
  basicInfoHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "12px",
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
  basicInfoTable: {
    display: "grid",
    borderRadius: "var(--radius-lg)",
    border: "1px solid color-mix(in srgb, var(--line) 62%, transparent)",
    overflow: "hidden",
    background: "color-mix(in srgb, var(--paper) 12%, transparent)",
  },
  basicInfoRow: {
    display: "grid",
    gridTemplateColumns: "92px minmax(0, 1fr)",
    alignItems: "center",
    gap: "12px",
    minHeight: "38px",
    padding: "0 12px",
    borderBottom: "1px solid color-mix(in srgb, var(--line) 50%, transparent)",
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
    fontWeight: 500,
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
  catManageSheet: {
    display: "grid",
    gap: "9px",
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
    margin: "0 -6px 14px",
    padding: "0 6px",
  },
  allLensCard: {
    margin: "0 -6px 18px",
    padding: "0 6px",
  },
  lensSectionHeader: {
    display: "grid",
    gap: "4px",
    margin: "0 6px 10px",
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
    gap: "3px",
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
    margin: "8px 6px 0",
    color: CATS_FAINT,
    fontFamily: CATS_SERIF,
    fontSize: CATS_TINY_SIZE,
    fontWeight: 400,
    lineHeight: 1.45,
    letterSpacing: CATS_META_TRACKING,
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
  catSheetList: {
    display: "grid",
    gap: "8px",
  },
  catSheetOption: {
    minHeight: "54px",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-lg)",
    background: "color-mix(in srgb, var(--paper) 44%, transparent)",
    color: CATS_TEXT,
    display: "grid",
    gridTemplateColumns: "42px 1fr auto",
    alignItems: "center",
    gap: "10px",
    padding: "7px 11px 7px 7px",
    cursor: "pointer",
    textAlign: "left",
  },
  catSheetOptionActive: {
    background: "color-mix(in srgb, var(--paper-warm) 78%, transparent)",
    border: "1px solid var(--line)",
  },
  catSheetPhotoTileRoot: {
    width: "42px",
    height: "42px",
  },
  catSheetPhotoTile: {
    width: "42px",
    height: "42px",
    border: "3px solid var(--paper)",
  },
  catSheetAvatarTile: {
    width: "42px",
    height: "42px",
    padding: "6px",
    boxSizing: "border-box",
    border: "3px solid var(--paper)",
  },
  catSheetName: {
    fontFamily: CATS_SERIF,
    fontSize: "15px",
    fontWeight: 400,
    color: CATS_TEXT_STRONG,
    letterSpacing: CATS_BODY_TRACKING,
  },
  catSheetCurrent: {
    color: CATS_FAINT,
    fontFamily: CATS_SERIF,
    fontSize: CATS_META_SIZE,
    fontWeight: 400,
    letterSpacing: CATS_META_TRACKING,
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
    fontWeight: 500,
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
    marginTop: "18px",
    background: CATS_PANEL_BACKGROUND,
    backdropFilter: "blur(2px)",
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
    margin: "2px 0 12px",
    color: CATS_MUTED,
    fontFamily: CATS_SERIF,
    fontSize: CATS_META_SIZE,
    fontWeight: 400,
    letterSpacing: CATS_META_TRACKING,
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
    marginTop: "18px",
    background: CATS_PANEL_BACKGROUND_SOFT,
    backdropFilter: "blur(2px)",
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
    fontFamily: CATS_SERIF,
    fontSize: CATS_META_SIZE,
    lineHeight: 1.7,
    letterSpacing: CATS_META_TRACKING,
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
