"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { storeAccountPhotoDataUrl } from "../../lib/photoStorageClient";
import { STORAGE_KEYS } from "../../lib/storage";
import {
  readCatSleepingMilestones,
  readOwnSleepingPhotoCount,
  type CatSleepingMilestone,
} from "../../lib/home/sleepingPhotos";
import { BottomNavigation } from "../navigation/BottomNavigation";
import { AppButton } from "../ui/AppButton";
import { AppBottomSheet } from "../ui/AppBottomSheet";
import { AppCard } from "../ui/AppCard";
import { AppHeader } from "../ui/AppHeader";
import { AppIcon } from "../ui/AppIcons";
import { StoredPhotoImage } from "../ui/StoredPhotoImage";
import {
  addCatProfile,
  getActiveCatProfile,
  getCatName,
  isCatProfileNameUnset,
  readActiveCatId,
  readCatProfiles,
  saveActiveCatId,
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

const CATS_TEXT = "#2d2b27";
const CATS_TEXT_STRONG = "#1f1d1a";
const CATS_MUTED = "#777166";
const CATS_FAINT = "#a49b8f";
const CATS_PAPER = "#fffdf8";
const CATS_BORDER = "#e8ddd0";
const CATS_SERIF =
  '"Shippori Mincho B1", "Hiragino Mincho ProN", "Yu Mincho", serif';
const CATS_SURFACE: CSSProperties = {
  position: "relative",
  background: "rgba(255,253,248,0.86)",
  border: "1px solid rgba(120,108,94,0.12)",
  boxShadow: "0 8px 18px rgba(90,76,60,0.045)",
};
const CATS_SURFACE_SOFT: CSSProperties = {
  ...CATS_SURFACE,
  background: "rgba(255,253,248,0.54)",
  boxShadow: "0 6px 14px rgba(90,76,60,0.035)",
};
const ONBOARDING_ALBUM_COMPLETION_READY_KEY =
  "neteruneko_onboarding_album_completion_ready";

export function CatsPage() {
  const [catProfiles, setCatProfiles] = useState<CatProfile[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [catNameInput, setCatNameInput] = useState("");
  const [newCatNameInput, setNewCatNameInput] = useState("");
  const [isEditingCatName, setIsEditingCatName] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [isCatSwitcherOpen, setIsCatSwitcherOpen] = useState(false);
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

  const activeCatProfile =
    catProfiles.length > 0
      ? getActiveCatProfile(catProfiles, activeCatId)
      : null;
  const catName = getCatName(activeCatProfile);
  const activeGender = formatGender(activeCatProfile?.basicInfo?.gender);
  const familyDays = formatFamilyDays(
    activeCatProfile?.basicInfo?.familySinceDate,
  );
  const takenSleepingPhotoCount = activeCatId
    ? readOwnSleepingPhotoCount(activeCatId)
    : 0;
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
    setMessage("");
    setSaveMessage("");
    setIsAddingCat(true);
    setIsCatSwitcherOpen(false);
    setIsEditingCatName(false);
    setIsEditingProfile(false);
  }

  function cancelAddingCat() {
    setNewCatNameInput("");
    setIsAddingCat(false);
  }

  function handleAddCatSave() {
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

  const selectedCoat = activeCatProfile?.appearance?.coat;

  return (
    <main style={styles.page}>
      <PageBackdrop />
      <div style={styles.container}>
        <AppHeader
          title="ねてるねこ"
          style={styles.pageHeader}
          right={
            !isOnboardingCompletionView ? (
              <a href="/settings" style={styles.headerIconLink} aria-label="設定">
                <AppIcon name="settings" size={24} />
              </a>
            ) : null
          }
        />

        {isOnboardingMode ? (
          <AppCard
            variant="soft"
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
          <div style={styles.editor}>
            <label style={styles.label} htmlFor="new-cat-name">
              {"この子の名前"}
            </label>
            <input
              id="new-cat-name"
              type="text"
              value={newCatNameInput}
              onChange={(event) => setNewCatNameInput(event.target.value)}
              placeholder={"例：麦"}
              style={styles.input}
            />
            <div style={styles.actions}>
              <button
                type="button"
                onClick={handleAddCatSave}
                style={styles.saveButton}
              >
                {"保存"}
              </button>
              <button
                type="button"
                onClick={cancelAddingCat}
                style={styles.cancelButton}
              >
                {"キャンセル"}
              </button>
            </div>
          </div>
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
                <div style={styles.profileHero}>
                  <button
                    type="button"
                    style={styles.profileHeroAvatar}
                    onClick={() => void handleAvatarUpload()}
                    aria-label={`${activeCatProfile.name}のアイコン写真を変更`}
                  >
                    <StoredPhotoImage
                      src={activeAvatarSrc}
                      alt=""
                      style={
                        activeCatProfile.avatarDataUrl
                          ? styles.profileHeroAvatarPhoto
                          : styles.profileHeroAvatarImg
                      }
                    />
                  </button>
                  <div style={styles.profileHeroInfo}>
                    <div style={styles.profileName}>{activeCatProfile.name}</div>
                  </div>
                  <div style={styles.profileHeroActions}>
                    {shouldShowCatSwitchButton ? (
                      <button
                        type="button"
                        style={styles.iconActionBtn}
                        onClick={() => setIsCatSwitcherOpen(true)}
                        aria-label="ほかのねこを見る"
                      >
                        <CatSwitchIcon />
                      </button>
                    ) : null}
                    {shouldShowSingleCatAdd ? (
                      <button
                        type="button"
                        style={styles.iconActionBtn}
                        onClick={startAddingCat}
                        aria-label="ねこを追加"
                      >
                        <AddSmallIcon />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      style={
                        isEditingProfile
                          ? { ...styles.iconActionBtn, ...styles.iconActionBtnActive }
                          : styles.iconActionBtn
                      }
                      onClick={
                        isEditingProfile ? cancelEditingCatName : handleStartEdit
                      }
                      aria-label={
                        isEditingProfile
                          ? `${activeCatProfile.name}の編集を閉じる`
                          : `${activeCatProfile.name}を編集`
                      }
                      aria-pressed={isEditingProfile}
                    >
                      <PencilSmallIcon />
                    </button>
                  </div>
                </div>

                <hr style={styles.divider} />

                <div style={styles.recordList}>
                  <div style={styles.recordRow}>
                    <span style={styles.recordLabel}>家族になって</span>
                    <span style={styles.recordMetricValue}>{familyDays}</span>
                  </div>
                  <div style={styles.recordRow}>
                    <span style={styles.recordLabel}>とったねがお</span>
                    <span style={styles.recordMetricValue}>
                      {takenSleepingPhotoCount}枚
                    </span>
                  </div>
                  <div style={styles.recordRow}>
                    <span style={styles.recordLabel}>誕生日</span>
                    <span style={styles.recordMetricValue}>
                      {activeCatProfile.basicInfo?.birthDate
                        ? formatBirthDate(activeCatProfile.basicInfo.birthDate)
                        : "未設定"}
                    </span>
                  </div>
                  <div style={{ ...styles.recordRow, ...styles.recordRowLast }}>
                    <span style={styles.recordLabel}>年齢</span>
                    <span style={styles.recordMetricValue}>
                      {activeCatProfile.basicInfo?.birthDate
                        ? formatAge(activeCatProfile.basicInfo.birthDate)
                        : "未設定"}
                    </span>
                  </div>
                </div>
                <div style={styles.profileNotes}>
                  {activeGender ? (
                    <span style={styles.profileNote}>{activeGender}</span>
                  ) : null}
                  {activeCatProfile.basicInfo?.breed ? (
                    <span style={styles.profileNote}>
                      {activeCatProfile.basicInfo.breed}
                    </span>
                  ) : null}
                  {activeCatProfile.appearance?.coat ? (
                    <span style={styles.profileNote}>
                      {getCoatLabel(activeCatProfile.appearance.coat)}
                    </span>
                  ) : null}
                </div>
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
                {!activeCatProfile.basicInfo?.familySinceDate &&
                !activeCatProfile.basicInfo?.birthDate &&
                !activeCatProfile.basicInfo?.breed &&
                !activeCatProfile.appearance?.coat &&
                !activeGender ? (
                  <p style={styles.emptyInfoText}>
                    右上から誕生日などを追加できます。
                  </p>
                ) : null}
              </>
            ) : null}

            {isEditingProfile ? (
              <>
                {!isOnboardingProfileSetup ? <hr style={styles.divider} /> : null}
                {isEditingCatName ? (
                  <div style={styles.editor}>
                    <label style={styles.label} htmlFor="cat-name">
                      {"この子の名前"}
                    </label>
                    <input
                      id="cat-name"
                      type="text"
                      value={catNameInput}
                      onChange={(event) => setCatNameInput(event.target.value)}
                      placeholder={isOnboardingProfileSetup ? "例：むぎ" : "例：ミケ"}
                      style={styles.input}
                    />
                    {!isOnboardingProfileSetup ? (
                      <>
                        <p style={styles.editLabel}>家に来た日</p>
                        <input
                          type="date"
                          value={editFamilySinceDate}
                          onChange={(event) =>
                            setEditFamilySinceDate(event.target.value)
                          }
                          max={new Date().toISOString().split("T")[0]}
                          style={styles.editInput}
                        />

                        <p style={styles.editLabel}>生年月日</p>
                        <input
                          type="date"
                          value={editBirthDate}
                          onChange={(event) => setEditBirthDate(event.target.value)}
                          max={new Date().toISOString().split("T")[0]}
                          style={styles.editInput}
                        />

                        <p style={styles.editLabel}>性別</p>
                        <div style={styles.genderButtons}>
                          {[
                            { value: "male", label: "男の子" },
                            { value: "female", label: "女の子" },
                            { value: "unknown", label: "わからない" },
                          ].map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() =>
                                setEditGender(option.value as EditableGender)
                              }
                              style={
                                editGender === option.value
                                  ? { ...styles.genderBtn, ...styles.genderBtnActive }
                                  : styles.genderBtn
                              }
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>

                        <p style={styles.editLabel}>猫種</p>
                        <input
                          type="text"
                          value={editBreed}
                          onChange={(event) => setEditBreed(event.target.value)}
                          placeholder="例：サバトラ、雑種・ミックス"
                          style={styles.editInput}
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
                        <button type="button" onClick={handleSaveProfile} style={styles.saveButton}>
                          保存
                        </button>
                      )}
                    </div>
                  </div>
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

        {message ? <p style={styles.message}>{message}</p> : null}
        {saveMessage ? <p style={styles.message}>{saveMessage}</p> : null}
      </div>
      {!isOnboardingProfileSetup && !isOnboardingCompletionView ? (
        <BottomNavigation active="cats" />
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
                  <StoredPhotoImage
                    src={avatarSrc}
                    alt=""
                    style={
                      profile.avatarDataUrl
                        ? styles.catSheetPhoto
                        : styles.catSheetAvatar
                    }
                  />
                  <span style={styles.catSheetName}>{profile.name}</span>
                  {isActive ? (
                    <span style={styles.catSheetCurrent}>いま</span>
                  ) : null}
                </button>
              );
            })}
            <button
              type="button"
              style={styles.catSheetAdd}
              onClick={startAddingCat}
            >
              追加
            </button>
          </div>
        </AppBottomSheet>
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
    <div style={isReached ? styles.footprintCard : styles.footprintCardEmpty}>
      <div style={styles.footprintHeader}>
        <span style={styles.footprintMark}>あしあと</span>
        <span style={styles.footprintName}>
          {getFootprintMilestoneTitle(milestone.target)}
        </span>
      </div>
      {isReached ? (
        <>
          <StoredPhotoImage
            src={milestone.src}
            alt=""
            style={styles.footprintPhoto}
          />
          <span style={styles.footprintDate}>
            {formatFootprintDate(milestone.reachedAt)}
          </span>
        </>
      ) : (
        <div style={styles.footprintPlaceholder} aria-hidden="true" />
      )}
    </div>
  );
}

function getFootprintMilestoneTitle(target: CatSleepingMilestone["target"]) {
  if (target === 1) {
    return "はじめてとった";
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
    <div style={styles.coatSection}>
      <div style={styles.coatHeader}>
        <p style={styles.sectionLabel}>{"毛色"}</p>
      </div>
      <div style={styles.coatOptions}>
        {COAT_OPTIONS.map((option) => {
          const isSelected = option.value === currentCoat;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onSelect(option.value)}
              style={
                isSelected
                  ? {
                      ...styles.coatButton,
                      ...styles.coatButtonActive,
                    }
                  : styles.coatButton
              }
              aria-pressed={isSelected}
            >
              <span
                style={{
                  ...styles.coatSwatch,
                  background:
                    option.value === "calico"
                      ? "linear-gradient(135deg, #faf6ee 0%, #faf6ee 38%, #e4cfb2 39%, #e4cfb2 64%, #d9d6cf 65%, #d9d6cf 100%)"
                      : option.color,
                }}
                aria-hidden="true"
              />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatBirthDate(birthDate: string): string {
  const date = new Date(birthDate);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

function formatFamilyDays(familySinceDate?: string): string {
  const createdDate = parseLocalDate(familySinceDate);

  if (!createdDate) {
    return "未設定";
  }

  const today = new Date();
  const todayDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const elapsedDays = Math.floor(
    (todayDate.getTime() - createdDate.getTime()) / 86_400_000,
  );

  return `${Math.max(1, elapsedDays + 1)}日`;
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

function formatAge(birthDate?: string): string {
  if (!birthDate) {
    return "";
  }

  const birth = new Date(birthDate);

  if (Number.isNaN(birth.getTime())) {
    return "";
  }

  const now = new Date();
  let totalMonths =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());

  if (now.getDate() < birth.getDate()) {
    totalMonths -= 1;
  }

  if (totalMonths < 0) {
    return "";
  }

  if (totalMonths < 12) {
    return `${totalMonths}ヶ月`;
  }

  if (totalMonths < 24) {
    return "1歳";
  }

  return `${Math.floor(totalMonths / 12)}歳`;
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
    background: "#f7f1e7",
    color: CATS_TEXT,
    overflowX: "hidden",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  ambientBackground: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 0,
    background:
      "linear-gradient(180deg, #fffdf8 0%, #f8f2e8 52%, #f2e8d9 100%)",
  },
  ambientHighlight: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 0,
    pointerEvents: "none" as const,
    background:
      "linear-gradient(115deg, rgba(255,255,255,0.46) 0%, rgba(255,255,255,0) 42%, rgba(180,156,120,0.09) 100%)",
  },
  backgroundVeil: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 1,
    pointerEvents: "none" as const,
    background:
      "linear-gradient(to bottom, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 46%, rgba(180,158,126,0.08) 100%)",
  },
  container: {
    position: "relative",
    zIndex: 2,
    width: "min(100%, 430px)",
    margin: "0 auto",
    padding:
      "calc(20px + env(safe-area-inset-top)) 24px calc(156px + env(safe-area-inset-bottom))",
  },
  pageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    marginBottom: "24px",
    paddingTop: "2px",
    position: "relative",
  },
  pageKicker: {
    margin: "0 0 5px",
    color: CATS_MUTED,
    fontSize: "11px",
    fontWeight: 620,
    letterSpacing: "0.12em",
  },
  pageTitle: {
    fontFamily: CATS_SERIF,
    fontSize: "18px",
    fontWeight: 400,
    color: CATS_MUTED,
    lineHeight: 1.34,
    letterSpacing: "0.18em",
    margin: 0,
  },
  headerIconLink: {
    position: "absolute",
    right: 0,
    top: "50%",
    transform: "translateY(-50%)",
    width: "34px",
    height: "34px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: CATS_MUTED,
    textDecoration: "none",
    borderRadius: "50%",
  },
  pageSub: {
    fontSize: "13px",
    color: CATS_MUTED,
    margin: 0,
    lineHeight: 1.6,
  },
  onboardingPanel: {
    ...CATS_SURFACE_SOFT,
    borderRadius: "24px",
    padding: "20px 18px 18px",
    marginBottom: "22px",
    textAlign: "center",
    boxShadow: "0 8px 18px rgba(90,76,60,0.045)",
  },
  onboardingKicker: {
    margin: "0 0 8px",
    color: CATS_MUTED,
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: 1.4,
    letterSpacing: "0.08em",
  },
  onboardingTitle: {
    margin: 0,
    color: CATS_TEXT_STRONG,
    fontFamily: CATS_SERIF,
    fontSize: "22px",
    fontWeight: 500,
    lineHeight: 1.45,
    letterSpacing: "0.08em",
  },
  onboardingText: {
    margin: "10px auto 0",
    maxWidth: "280px",
    color: CATS_MUTED,
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.7,
  },
  onboardingHomeLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "42px",
    marginTop: "18px",
    padding: "0 22px",
    borderRadius: "999px",
    border: "1px solid rgba(120,108,94,0.12)",
    background: "rgba(255,253,248,0.66)",
    color: CATS_TEXT,
    textDecoration: "none",
    fontSize: "13px",
    fontWeight: 650,
  },
  onboardingHomeButton: {
    marginTop: "18px",
  },
  profileCard: {
    ...CATS_SURFACE,
    borderRadius: "21px",
    padding: "18px 17px",
    marginBottom: "12px",
  },
  profilePlaceCard: {
    ...CATS_SURFACE_SOFT,
    borderRadius: "24px",
    padding: "17px 16px 16px",
    marginBottom: "12px",
    boxShadow: "0 6px 14px rgba(90,76,60,0.035)",
  },
  profileHero: {
    display: "grid",
    gridTemplateColumns: "64px 1fr auto",
    alignItems: "center",
    gap: "13px",
  },
  profileHeroAvatar: {
    width: "64px",
    height: "64px",
    borderRadius: "19px",
    border: "1px solid rgba(120,108,94,0.10)",
    background: "rgba(255,253,248,0.46)",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    cursor: "pointer",
    boxShadow: "0 4px 10px rgba(90,76,60,0.028)",
  },
  profileHeroAvatarPhoto: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  profileHeroAvatarImg: {
    width: "50px",
    height: "50px",
    objectFit: "contain",
  },
  profileHeroInfo: {
    minWidth: 0,
  },
  profileName: {
    fontFamily: CATS_SERIF,
    fontSize: "20px",
    fontWeight: 500,
    color: CATS_TEXT_STRONG,
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
  iconActionBtn: {
    width: "32px",
    height: "32px",
    color: CATS_FAINT,
    border: "1px solid rgba(120,108,94,0.08)",
    background: "rgba(255,253,248,0.28)",
    borderRadius: "999px",
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  iconActionBtnActive: {
    color: CATS_MUTED,
    border: "1px solid rgba(120,108,94,0.16)",
    background: "rgba(255,253,248,0.62)",
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
  recordList: {
    borderRadius: "18px",
    border: "1px solid rgba(120,108,94,0.09)",
    background: "rgba(255,253,248,0.40)",
    padding: "6px 13px",
  },
  recordRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "center",
    gap: "12px",
    minHeight: "38px",
    borderBottom: "1px solid rgba(120,108,94,0.065)",
  },
  recordRowLast: {
    borderBottom: "none",
  },
  recordLabel: {
    color: CATS_FAINT,
    fontFamily: CATS_SERIF,
    fontSize: "11px",
    fontWeight: 400,
    lineHeight: 1.35,
    letterSpacing: "0.06em",
  },
  recordMetricValue: {
    color: CATS_TEXT,
    fontSize: "14px",
    fontWeight: 560,
    lineHeight: 1.35,
    textAlign: "right",
    letterSpacing: 0,
  },
  footprintsSection: {
    marginTop: "13px",
    marginRight: "-16px",
  },
  footprintsTitle: {
    margin: "0 0 8px",
    color: CATS_FAINT,
    fontFamily: CATS_SERIF,
    fontSize: "11px",
    fontWeight: 400,
    lineHeight: 1.35,
    letterSpacing: "0.07em",
  },
  footprintsScroller: {
    display: "flex",
    gap: "9px",
    overflowX: "auto",
    padding: "0 16px 2px 0",
    scrollSnapType: "x proximity",
    scrollbarWidth: "none",
  },
  footprintCard: {
    width: "132px",
    minHeight: "128px",
    border: "1px solid rgba(120,108,94,0.09)",
    borderRadius: "17px",
    background: "rgba(255,253,248,0.38)",
    padding: "9px",
    display: "grid",
    gap: "7px",
    flex: "0 0 auto",
    scrollSnapAlign: "start",
  },
  footprintCardEmpty: {
    width: "132px",
    minHeight: "128px",
    border: "1px dashed rgba(120,108,94,0.12)",
    borderRadius: "17px",
    background: "rgba(255,253,248,0.20)",
    padding: "9px",
    display: "grid",
    gap: "7px",
    flex: "0 0 auto",
    scrollSnapAlign: "start",
  },
  footprintHeader: {
    display: "grid",
    gap: "3px",
  },
  footprintMark: {
    color: CATS_FAINT,
    fontSize: "9.5px",
    fontWeight: 500,
    lineHeight: 1,
  },
  footprintName: {
    color: CATS_TEXT,
    fontFamily: CATS_SERIF,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.35,
    letterSpacing: "0.04em",
  },
  footprintPhoto: {
    width: "100%",
    aspectRatio: "1 / 1",
    minHeight: "64px",
    borderRadius: "13px",
    objectFit: "cover",
    background: "rgba(255,253,248,0.56)",
  },
  footprintDate: {
    color: CATS_MUTED,
    fontSize: "10.5px",
    fontWeight: 500,
    lineHeight: 1,
  },
  footprintPlaceholder: {
    width: "100%",
    aspectRatio: "1 / 1",
    minHeight: "64px",
    borderRadius: "13px",
    border: "1px solid rgba(120,108,94,0.08)",
    background:
      "linear-gradient(135deg, rgba(255,253,248,0.22), rgba(247,241,231,0.28))",
  },
  profileNotes: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "12px",
  },
  profileNote: {
    border: "1px solid rgba(120,108,94,0.10)",
    borderRadius: "999px",
    background: "rgba(255,253,248,0.32)",
    color: CATS_MUTED,
    fontSize: "11px",
    fontWeight: 500,
    lineHeight: 1,
    padding: "6px 9px",
  },
  catSheetList: {
    display: "grid",
    gap: "8px",
  },
  catSheetOption: {
    minHeight: "54px",
    border: "1px solid rgba(120,108,94,0.09)",
    borderRadius: "17px",
    background: "rgba(255,253,248,0.44)",
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
    background: "rgba(247,241,231,0.78)",
    border: "1px solid rgba(120,108,94,0.16)",
  },
  catSheetPhoto: {
    width: "42px",
    height: "42px",
    borderRadius: "13px",
    objectFit: "cover",
    background: "rgba(255,253,248,0.58)",
  },
  catSheetAvatar: {
    width: "42px",
    height: "42px",
    borderRadius: "13px",
    objectFit: "contain",
    background: "rgba(255,253,248,0.58)",
    padding: "5px",
    boxSizing: "border-box",
  },
  catSheetName: {
    fontFamily: CATS_SERIF,
    fontSize: "15px",
    fontWeight: 500,
    color: CATS_TEXT_STRONG,
  },
  catSheetCurrent: {
    color: CATS_FAINT,
    fontSize: "11px",
    fontWeight: 500,
  },
  catSheetAdd: {
    minHeight: "42px",
    border: "1px dashed rgba(120,108,94,0.14)",
    borderRadius: "15px",
    background: "rgba(255,253,248,0.24)",
    color: CATS_MUTED,
    fontSize: "12px",
    fontWeight: 560,
    cursor: "pointer",
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
    fontSize: "11px",
    fontWeight: 400,
    letterSpacing: "0.07em",
  },
  homePhotoPreview: {
    width: "76px",
    height: "98px",
    borderRadius: "16px",
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
    fontSize: "11px",
    color: CATS_FAINT,
  },
  homePhotoInfo: {
    flex: 1,
    minWidth: 0,
  },
  homePhotoTitle: {
    fontFamily: CATS_SERIF,
    fontSize: "13.5px",
    fontWeight: 500,
    letterSpacing: "0.06em",
    color: CATS_TEXT,
    margin: "0 0 4px",
  },
  homePhotoSub: {
    fontSize: "11px",
    color: CATS_MUTED,
    fontFamily: CATS_SERIF,
    lineHeight: 1.6,
    letterSpacing: "0.06em",
    margin: "0 0 10px",
  },
  homePhotoActions: {
    display: "flex",
    alignItems: "center",
  },
  homePhotoButton: {
    width: "fit-content",
    border: "1px solid rgba(120,108,94,0.12)",
    borderRadius: "99px",
    background: "rgba(255,253,248,0.46)",
    color: CATS_MUTED,
    fontSize: "11.5px",
    fontWeight: 520,
    padding: "6px 11px",
    cursor: "pointer",
  },
  divider: {
    border: "none",
    borderTop: "1px solid rgba(120,108,94,0.075)",
    margin: "15px -16px",
  },
  infoRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 0",
  },
  infoLabel: {
    fontSize: "11.5px",
    color: CATS_FAINT,
    fontFamily: CATS_SERIF,
    letterSpacing: "0.06em",
  },
  infoValue: {
    fontSize: "12.5px",
    color: CATS_MUTED,
    fontWeight: 500,
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
    fontWeight: 500,
    lineHeight: 1.5,
  },
  coatSection: {
    marginTop: "10px",
    border: "1px solid rgba(120,108,94,0.08)",
    borderRadius: "18px",
    background: "rgba(255,253,248,0.30)",
    padding: "12px 13px",
  },
  coatHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "8px",
  },
  coatOptions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  coatButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    minHeight: "34px",
    border: `1px solid ${CATS_BORDER}`,
    borderRadius: "999px",
    background: "rgba(255,253,248,0.64)",
    color: CATS_TEXT,
    fontSize: "13px",
    fontWeight: 540,
    letterSpacing: 0,
    padding: "0 11px",
    cursor: "pointer",
  },
  coatButtonActive: {
    borderColor: "rgba(120,108,94,0.42)",
    background: CATS_PAPER,
    color: "#2a2a28",
  },
  coatSwatch: {
    display: "inline-block",
    width: "14px",
    height: "14px",
    border: "1px solid rgba(120,108,94,0.2)",
    borderRadius: "999px",
    flex: "0 0 auto",
  },
  editor: {
    marginTop: "10px",
    border: "1px solid rgba(120,108,94,0.08)",
    borderRadius: "18px",
    background: "rgba(255,253,248,0.36)",
    padding: "13px",
    display: "grid",
    gap: "10px",
  },
  label: {
    display: "block",
    margin: 0,
    color: CATS_MUTED,
    fontSize: "12px",
    fontWeight: 520,
    letterSpacing: 0,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: "48px",
    border: "1px solid rgba(120,108,94,0.14)",
    borderRadius: "13px",
    background: "rgba(255,253,248,0.72)",
    color: CATS_TEXT,
    fontSize: "14px",
    fontWeight: 500,
    letterSpacing: 0,
    padding: "0 14px",
  },
  editLabel: {
    fontSize: "11.5px",
    fontWeight: 500,
    color: CATS_MUTED,
    margin: "2px 0 -4px",
  },
  editInput: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: "44px",
    border: "1px solid rgba(120,108,94,0.14)",
    borderRadius: "13px",
    background: "rgba(255,253,248,0.72)",
    color: CATS_TEXT,
    fontSize: "14px",
    padding: "0 14px",
  },
  genderButtons: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "6px",
  },
  genderBtn: {
    minHeight: "36px",
    border: "1px solid rgba(120,108,94,0.12)",
    borderRadius: "999px",
    background: "rgba(255,253,248,0.42)",
    color: CATS_TEXT,
    fontSize: "11.5px",
    fontWeight: 500,
    cursor: "pointer",
  },
  genderBtnActive: {
    border: "1px solid rgba(120,108,94,0.42)",
    background: CATS_PAPER,
    color: "#2a2a28",
    fontWeight: 600,
  },
  actions: {
    display: "flex",
    gap: "10px",
    marginTop: "2px",
  },
  saveButton: {
    minHeight: "42px",
    padding: "0 20px",
    border: "1px solid rgba(120,108,94,0.16)",
    borderRadius: "999px",
    background: "rgba(255,253,248,0.72)",
    color: "#2a2a28",
    fontSize: "13px",
    fontWeight: 560,
    letterSpacing: 0,
    cursor: "pointer",
  },
  cancelButton: {
    minHeight: "40px",
    padding: "0 18px",
    border: `1px solid ${CATS_BORDER}`,
    borderRadius: "12px",
    background: "rgba(255,253,248,0.5)",
    color: CATS_TEXT,
    fontSize: "14px",
    fontWeight: 520,
    letterSpacing: 0,
    cursor: "pointer",
  },
  message: {
    margin: "10px 0 0",
    color: CATS_MUTED,
    fontSize: "13px",
    lineHeight: 1.6,
  },
} satisfies Record<string, CSSProperties>;
