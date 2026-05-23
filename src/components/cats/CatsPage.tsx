"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { BottomNavigation } from "../navigation/BottomNavigation";
import {
  addCatProfile,
  getActiveCatProfile,
  getCatName,
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

const CATS_TEXT = "rgba(255,255,255,0.94)";
const CATS_TEXT_STRONG = "rgba(255,255,255,0.98)";
const CATS_MUTED = "rgba(255,255,255,0.62)";
const CATS_SURFACE: CSSProperties = {
  position: "relative",
  background: "rgba(34,29,28,0.58)",
  backdropFilter: "blur(28px)",
  WebkitBackdropFilter: "blur(28px)",
  border: "0.5px solid rgba(255,255,255,0.18)",
  boxShadow: [
    "0 14px 34px rgba(0,0,0,0.22)",
    "inset 0 1px 0 rgba(255,255,255,0.16)",
  ].join(", "),
};
const CATS_SURFACE_SOFT: CSSProperties = {
  ...CATS_SURFACE,
  background: "rgba(255,255,255,0.10)",
  boxShadow: [
    "0 10px 24px rgba(0,0,0,0.18)",
    "inset 0 1px 0 rgba(255,255,255,0.12)",
  ].join(", "),
};

export function CatsPage() {
  const [catProfiles, setCatProfiles] = useState<CatProfile[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [catNameInput, setCatNameInput] = useState("");
  const [newCatNameInput, setNewCatNameInput] = useState("");
  const [isEditingCatName, setIsEditingCatName] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAddingCat, setIsAddingCat] = useState(false);
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
  const activeAge = formatAge(activeCatProfile?.basicInfo?.birthDate);
  const activeMeta = [activeGender, activeAge].filter(Boolean).join("・");
  const activeAvatarSrc =
    activeCatProfile?.avatarDataUrl ??
    getCatAvatarSrc(activeCatProfile?.appearance?.coat);

  useEffect(() => {
    const savedCatProfiles = readCatProfiles();
    const savedActiveCatId = readActiveCatId();
    const activeProfile = getActiveCatProfile(
      savedCatProfiles,
      savedActiveCatId,
    );

    setCatProfiles(savedCatProfiles);
    setActiveCatId(activeProfile.id);
    setCatNameInput(getCatName(activeProfile));
    saveActiveCatId(activeProfile.id);
  }, []);

  function handleCatSelect(catId: string) {
    const nextActiveProfile = getActiveCatProfile(catProfiles, catId);

    saveActiveCatId(nextActiveProfile.id);
    setActiveCatId(nextActiveProfile.id);
    setCatNameInput(getCatName(nextActiveProfile));
    setIsAddingCat(false);
    setIsEditingCatName(false);
    setIsEditingProfile(false);
    setMessage("");
    setSaveMessage("");
  }

  function startAddingCat() {
    setNewCatNameInput("");
    setMessage("");
    setSaveMessage("");
    setIsAddingCat(true);
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
      const raw = window.localStorage.getItem("cat_profiles");

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

      window.localStorage.setItem("cat_profiles", JSON.stringify(nextProfiles));
      setCatProfiles(nextProfiles);
      setActiveCatId(nextProfile.id);
      setCatNameInput(nextProfile.name);
      setIsEditingCatName(false);
      setIsEditingProfile(false);
      setSaveMessage("保存しました。");
      setTimeout(() => setSaveMessage(""), 2000);
    } catch {
      return;
    }
  }

  async function handleAvatarUpload() {
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
        const raw = window.localStorage.getItem("cat_profiles");

        if (!raw) {
          return;
        }

        const profiles = JSON.parse(raw) as CatProfile[];
        const index = profiles.findIndex((profile) => profile.id === activeCatId);

        if (index === -1) {
          return;
        }

        const nextProfiles = profiles.map((profile, profileIndex) =>
          profileIndex === index
            ? {
                ...profile,
                avatarDataUrl: dataUrl,
                updatedAt: new Date().toISOString(),
              }
            : profile,
        );

        window.localStorage.setItem("cat_profiles", JSON.stringify(nextProfiles));
        setCatProfiles(nextProfiles);
      } catch {
        return;
      }
    };

    input.click();
  }

  async function handleHomePhotoUpload() {
    const input = document.createElement("input");

    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];

      if (!file) {
        return;
      }

      try {
        const dataUrl = await resizeAndEncode(file, 1600);
        const raw = window.localStorage.getItem("cat_profiles");

        if (!raw) {
          return;
        }

        const profiles = JSON.parse(raw) as CatProfile[];
        const index = profiles.findIndex((profile) => profile.id === activeCatId);

        if (index === -1) {
          return;
        }

        const nextProfiles = profiles.map((profile, profileIndex) =>
          profileIndex === index
            ? {
                ...profile,
                homePhotoDataUrl: dataUrl,
                homePhotoPosition: profile.homePhotoPosition ?? "center 38%",
                updatedAt: new Date().toISOString(),
              }
            : profile,
        );

        window.localStorage.setItem("cat_profiles", JSON.stringify(nextProfiles));
        setCatProfiles(nextProfiles);
        setSaveMessage("ホーム写真を保存しました。");
        setTimeout(() => setSaveMessage(""), 2000);
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
        <div style={styles.pageHeader}>
          <div>
            <p style={styles.pageKicker}>CATS</p>
            <h1 style={styles.pageTitle}>ねこ</h1>
            <p style={styles.pageSub}>
              プロフィールとホーム写真を整える場所
            </p>
          </div>
        </div>

        <div style={styles.catGrid}>
          {catProfiles.map((profile) => {
            const isActive = profile.id === activeCatId;

            return (
              <button
                key={profile.id}
                type="button"
                style={styles.catGridItem}
                onClick={() => handleCatSelect(profile.id)}
              >
                <div
                  style={
                    isActive
                      ? { ...styles.catAvatar, ...styles.catAvatarActive }
                      : styles.catAvatar
                  }
                  onClick={
                    isActive
                      ? (event) => {
                          event.stopPropagation();
                          void handleAvatarUpload();
                        }
                      : undefined
                  }
                >
                  {profile.avatarDataUrl ? (
                    <img
                      src={profile.avatarDataUrl}
                      alt={profile.name}
                      style={styles.catAvatarPhoto}
                    />
                  ) : (
                    <img
                      src={getCatAvatarSrc(profile.appearance?.coat)}
                      alt={profile.name}
                      style={styles.catAvatarImg}
                    />
                  )}
                </div>
                <span style={styles.catGridName}>{profile.name}</span>
              </button>
            );
          })}

          <button type="button" style={styles.catGridItem} onClick={startAddingCat}>
            <div style={styles.catAvatarAdd}>
              <span style={styles.catAvatarAddMark}>＋</span>
            </div>
            <span style={{ ...styles.catGridName, color: CATS_MUTED }}>追加</span>
          </button>
        </div>

        {isAddingCat ? (
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

        {activeCatProfile ? (
          <div style={styles.profileCard}>
            <div style={styles.profileHero}>
              <button
                type="button"
                style={styles.profileHeroAvatar}
                onClick={() => void handleAvatarUpload()}
                aria-label={`${activeCatProfile.name}のアイコン写真を変更`}
              >
                <img
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
                <p style={styles.profileKicker}>いま見ている子</p>
                <div style={styles.profileName}>{activeCatProfile.name}</div>
                {activeMeta ? (
                  <p style={styles.profileMeta}>{activeMeta}</p>
                ) : (
                  <p style={styles.profileMeta}>基本情報はあとで追加できます</p>
                )}
              </div>
              <button
                type="button"
                style={styles.editBtn}
                onClick={handleStartEdit}
              >
                編集
              </button>
            </div>

            <hr style={styles.divider} />

            <p style={styles.sectionTitle}>ホーム写真</p>
            <div style={styles.homePhotoSection}>
              <div style={styles.homePhotoPreview}>
                {activeCatProfile.homePhotoDataUrl ? (
                  <img
                    src={activeCatProfile.homePhotoDataUrl}
                    alt=""
                    style={styles.homePhotoPreviewImg}
                  />
                ) : (
                  <span style={styles.homePhotoPreviewText}>ホーム写真</span>
                )}
              </div>
              <div style={styles.homePhotoInfo}>
                <p style={styles.homePhotoTitle}>ホームに出る写真</p>
                <p style={styles.homePhotoSub}>
                  ホームを開いたときに大きく表示されます。
                </p>
                <div style={styles.homePhotoActions}>
                  <button
                    type="button"
                    onClick={() => void handleHomePhotoUpload()}
                    style={styles.homePhotoButton}
                  >
                    写真を選ぶ
                  </button>
                </div>
              </div>
            </div>

            <hr style={styles.divider} />

            <p style={styles.sectionTitle}>基本情報</p>
            {activeCatProfile.basicInfo?.birthDate ? (
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>誕生日</span>
                <span style={styles.infoValue}>
                  {formatBirthDate(activeCatProfile.basicInfo.birthDate)}
                </span>
              </div>
            ) : null}
            {activeCatProfile.basicInfo?.birthDate ? (
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>年齢</span>
                <span style={styles.infoValue}>
                  {formatAge(activeCatProfile.basicInfo.birthDate)}
                </span>
              </div>
            ) : null}
            {activeCatProfile.basicInfo?.breed ? (
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>猫種</span>
                <span style={styles.infoValue}>
                  {activeCatProfile.basicInfo.breed}
                </span>
              </div>
            ) : null}
            {activeCatProfile.appearance?.coat ? (
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>毛色</span>
                <div style={styles.coatRow}>
                  <div
                    style={{
                      ...styles.coatDot,
                      background: getCoatColor(activeCatProfile.appearance.coat),
                    }}
                  />
                  <span style={styles.infoValue}>
                    {getCoatLabel(activeCatProfile.appearance.coat)}
                  </span>
                </div>
              </div>
            ) : null}
            {!activeCatProfile.basicInfo?.birthDate &&
            !activeCatProfile.basicInfo?.breed &&
            !activeCatProfile.appearance?.coat ? (
              <p style={styles.emptyInfoText}>
                編集から誕生日・猫種・毛色を追加できます。
              </p>
            ) : null}

            {isEditingProfile ? (
              <>
                <hr style={styles.divider} />
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
                      placeholder={"例：ミケ"}
                      style={styles.input}
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

                    <div style={styles.actions}>
                      <button type="button" onClick={handleSaveProfile} style={styles.saveButton}>
                        {"保存"}
                      </button>
                      <button type="button" onClick={cancelEditingCatName} style={styles.cancelButton}>
                        {"キャンセル"}
                      </button>
                    </div>
                  </div>
                ) : null}

                <CoatSelector
                  currentCoat={editCoat || selectedCoat}
                  onSelect={setEditCoat}
                  onClose={() => {
                    setIsEditingProfile(false);
                    setIsEditingCatName(false);
                  }}
                />
              </>
            ) : null}
          </div>
        ) : null}

        <div style={styles.settingsSection}>
          <p style={styles.settingsSectionLabel}>設定</p>
          <div style={styles.settingsCard}>
            <a href="/settings" style={styles.settingsRow}>
              <span style={styles.settingsRowLabel}>アカウントと設定</span>
              <span style={styles.settingsRowChevron}>›</span>
            </a>
          </div>
        </div>

        {message ? <p style={styles.message}>{message}</p> : null}
        {saveMessage ? <p style={styles.message}>{saveMessage}</p> : null}
      </div>
      <BottomNavigation active="cats" />
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

function CoatSelector({
  currentCoat,
  onSelect,
  onClose,
}: {
  currentCoat?: CatCoat;
  onSelect: (coat: CatCoat) => void;
  onClose: () => void;
}) {
  return (
    <div style={styles.coatSection}>
      <div style={styles.coatHeader}>
        <p style={styles.sectionLabel}>{"毛色"}</p>
        <button type="button" onClick={onClose} style={styles.closeEditBtn}>
          閉じる
        </button>
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
    background: "#1a1a18",
    color: CATS_TEXT,
    overflowX: "hidden",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  ambientBackground: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 0,
    background: [
      "radial-gradient(circle at 20% 10%, rgba(148,136,118,0.30) 0%, rgba(148,136,118,0.08) 22%, rgba(148,136,118,0) 45%)",
      "radial-gradient(circle at 84% 18%, rgba(192,132,80,0.22) 0%, rgba(192,132,80,0.08) 20%, rgba(192,132,80,0) 42%)",
      "radial-gradient(ellipse at 50% 82%, rgba(74,65,58,0.62) 0%, rgba(39,34,32,0.78) 48%, rgba(20,18,17,0.96) 100%)",
      "linear-gradient(145deg, #2f3438 0%, #5e514a 38%, #342c29 70%, #171615 100%)",
    ].join(", "),
  },
  ambientHighlight: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 0,
    pointerEvents: "none" as const,
    background:
      "linear-gradient(115deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 30%, rgba(255,210,150,0.07) 64%, rgba(255,255,255,0) 100%)",
  },
  backgroundVeil: {
    position: "fixed" as const,
    inset: 0,
    zIndex: 1,
    pointerEvents: "none" as const,
    background: [
      "linear-gradient(to bottom, rgba(12,10,9,0.20) 0%, rgba(12,10,9,0.04) 34%, rgba(12,10,9,0.40) 100%)",
      "radial-gradient(circle at 72% 8%, rgba(255,200,130,0.16) 0%, rgba(255,200,130,0.05) 24%, rgba(255,200,130,0) 52%)",
    ].join(", "),
  },
  container: {
    position: "relative",
    zIndex: 2,
    width: "min(100%, 430px)",
    margin: "0 auto",
    padding:
      "calc(16px + env(safe-area-inset-top)) 14px calc(224px + env(safe-area-inset-bottom))",
  },
  pageHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "18px",
    paddingTop: "2px",
  },
  pageKicker: {
    margin: "0 0 5px",
    color: CATS_MUTED,
    fontSize: "11px",
    fontWeight: 620,
    letterSpacing: "0.12em",
  },
  pageTitle: {
    fontSize: "30px",
    fontWeight: 640,
    color: CATS_TEXT_STRONG,
    lineHeight: 1.15,
    margin: "0 0 6px",
  },
  pageSub: {
    fontSize: "13px",
    color: CATS_MUTED,
    margin: 0,
    lineHeight: 1.6,
  },
  catGrid: {
    display: "flex",
    gap: "16px",
    overflowX: "auto",
    paddingBottom: "8px",
    scrollbarWidth: "none",
    marginBottom: "24px",
  },
  catGridItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "5px",
    position: "relative",
    flexShrink: 0,
    cursor: "pointer",
    border: "none",
    background: "transparent",
    padding: 0,
    font: "inherit",
  },
  catAvatar: {
    position: "relative",
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.12)",
    border: "3px solid rgba(255,255,255,0.14)",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  catAvatarActive: {
    border: "3px solid rgba(255,255,255,0.78)",
    cursor: "pointer",
  },
  catAvatarImg: {
    width: "60px",
    height: "60px",
    objectFit: "contain",
  },
  catAvatarPhoto: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "50%",
  },
  catAvatarAdd: {
    width: "72px",
    height: "72px",
    borderRadius: "50%",
    border: "1.5px dashed rgba(255,255,255,0.28)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  catAvatarAddMark: {
    fontSize: "22px",
    color: CATS_MUTED,
  },
  catGridName: {
    fontSize: "13px",
    color: CATS_TEXT,
    fontWeight: 560,
  },
  profileCard: {
    ...CATS_SURFACE,
    borderRadius: "24px",
    padding: "20px",
    marginBottom: "12px",
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
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.28)",
    background: "rgba(255,255,255,0.12)",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    cursor: "pointer",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.16)",
  },
  profileHeroAvatarPhoto: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  profileHeroAvatarImg: {
    width: "52px",
    height: "52px",
    objectFit: "contain",
  },
  profileHeroInfo: {
    minWidth: 0,
  },
  profileKicker: {
    margin: "0 0 4px",
    color: CATS_MUTED,
    fontSize: "11px",
    fontWeight: 560,
  },
  profileName: {
    fontSize: "21px",
    fontWeight: 560,
    color: CATS_TEXT_STRONG,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  profileMeta: {
    margin: "4px 0 0",
    color: CATS_MUTED,
    fontSize: "12px",
    lineHeight: 1.45,
  },
  editBtn: {
    fontSize: "12px",
    color: CATS_TEXT,
    ...CATS_SURFACE_SOFT,
    borderRadius: "99px",
    padding: "4px 12px",
    cursor: "pointer",
  },
  homePhotoSection: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    padding: "2px 0",
  },
  sectionTitle: {
    margin: "0 0 10px",
    color: CATS_MUTED,
    fontSize: "12px",
    fontWeight: 620,
    letterSpacing: "0.06em",
  },
  homePhotoPreview: {
    width: "86px",
    height: "112px",
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
    color: CATS_MUTED,
  },
  homePhotoInfo: {
    flex: 1,
    minWidth: 0,
  },
  homePhotoTitle: {
    fontSize: "14px",
    fontWeight: 560,
    color: CATS_TEXT_STRONG,
    margin: "0 0 4px",
  },
  homePhotoSub: {
    fontSize: "11px",
    color: CATS_MUTED,
    lineHeight: 1.5,
    margin: "0 0 10px",
  },
  homePhotoActions: {
    display: "flex",
    alignItems: "center",
  },
  homePhotoButton: {
    width: "fit-content",
    border: "0.5px solid rgba(255,255,255,0.16)",
    borderRadius: "99px",
    background: "rgba(255,255,255,0.10)",
    color: CATS_TEXT,
    fontSize: "12px",
    fontWeight: 560,
    padding: "6px 12px",
    cursor: "pointer",
  },
  divider: {
    border: "none",
    borderTop: "0.5px solid rgba(255,255,255,0.14)",
    margin: "14px 0",
  },
  infoRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 0",
  },
  infoLabel: {
    fontSize: "13px",
    color: CATS_MUTED,
  },
  infoValue: {
    fontSize: "14px",
    color: CATS_TEXT,
    fontWeight: 500,
  },
  emptyInfoText: {
    margin: "2px 0 0",
    color: CATS_MUTED,
    fontSize: "12px",
    lineHeight: 1.6,
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
  settingsSection: {
    marginTop: "16px",
  },
  settingsSectionLabel: {
    fontSize: "12px",
    fontWeight: 540,
    color: CATS_MUTED,
    margin: "0 0 8px 4px",
    letterSpacing: "0.04em",
  },
  settingsCard: {
    ...CATS_SURFACE,
    borderRadius: "16px",
    overflow: "hidden",
  },
  settingsRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    textDecoration: "none",
    color: CATS_TEXT,
  },
  settingsRowLabel: {
    fontSize: "14px",
    fontWeight: 500,
    color: CATS_TEXT,
  },
  settingsRowChevron: {
    fontSize: "18px",
    color: CATS_MUTED,
  },
  sectionLabel: {
    margin: "0 0 5px",
    color: CATS_MUTED,
    fontSize: "12px",
    fontWeight: 540,
    lineHeight: 1.5,
  },
  coatSection: {
    marginBottom: "14px",
    borderBottom: "1px solid rgba(255,255,255,0.12)",
    paddingBottom: "14px",
  },
  coatHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "8px",
  },
  closeEditBtn: {
    border: "none",
    background: "transparent",
    color: CATS_MUTED,
    fontSize: "12px",
    cursor: "pointer",
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
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.08)",
    color: CATS_TEXT,
    fontSize: "13px",
    fontWeight: 540,
    letterSpacing: 0,
    padding: "0 11px",
    cursor: "pointer",
  },
  coatButtonActive: {
    borderColor: "rgba(255,255,255,0.42)",
    background: "rgba(255,255,255,0.92)",
    color: "#2a2a28",
  },
  coatSwatch: {
    display: "inline-block",
    width: "14px",
    height: "14px",
    border: "1px solid rgba(255,255,255,0.24)",
    borderRadius: "999px",
    flex: "0 0 auto",
  },
  editor: {
    marginTop: "10px",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: CATS_MUTED,
    fontSize: "13px",
    fontWeight: 520,
    letterSpacing: 0,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: "48px",
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.10)",
    color: CATS_TEXT,
    fontSize: "15px",
    fontWeight: 500,
    letterSpacing: 0,
    padding: "0 14px",
  },
  editLabel: {
    fontSize: "12px",
    fontWeight: 500,
    color: CATS_MUTED,
    margin: "0 0 6px",
  },
  editInput: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: "48px",
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.10)",
    color: CATS_TEXT,
    fontSize: "15px",
    padding: "0 14px",
  },
  genderButtons: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "6px",
    marginBottom: "12px",
  },
  genderBtn: {
    minHeight: "40px",
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: "10px",
    background: "rgba(255,255,255,0.10)",
    color: CATS_TEXT,
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
  },
  genderBtnActive: {
    border: "1px solid rgba(255,255,255,0.42)",
    background: "rgba(255,255,255,0.92)",
    color: "#2a2a28",
    fontWeight: 600,
  },
  actions: {
    display: "flex",
    gap: "10px",
    marginTop: "10px",
  },
  saveButton: {
    minHeight: "40px",
    padding: "0 18px",
    border: "1px solid rgba(255,255,255,0.42)",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.92)",
    color: "#2a2a28",
    fontSize: "14px",
    fontWeight: 560,
    letterSpacing: 0,
    cursor: "pointer",
  },
  cancelButton: {
    minHeight: "40px",
    padding: "0 18px",
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.10)",
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
