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

  const selectedCoat = activeCatProfile?.appearance?.coat;

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.pageHeader}>
          <div>
            <h1 style={styles.pageTitle}>ねこ</h1>
            <p style={styles.pageSub}>一緒に暮らしている子</p>
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
            <span style={{ ...styles.catGridName, color: "#b0ada6" }}>追加</span>
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
            <div style={styles.profileHeader}>
              <div>
                <div style={styles.profileName}>
                  {activeCatProfile.name}
                  {activeCatProfile.basicInfo?.gender ? (
                    <span style={styles.genderBadge}>
                      {formatGender(activeCatProfile.basicInfo.gender)}
                    </span>
                  ) : null}
                </div>
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

            {!isEditingProfile &&
            (activeCatProfile.typeLabel ||
              (activeCatProfile.modifiers?.length ?? 0) > 0) ? (
              <>
                <hr style={styles.divider} />
                <div style={styles.traitSection}>
                  <p style={styles.traitLabel}>この子のこと</p>
                  <div style={styles.traitPills}>
                    {activeCatProfile.typeLabel ? (
                      <span style={styles.traitPill}>
                        {activeCatProfile.typeLabel}
                      </span>
                    ) : null}
                    {(activeCatProfile.modifiers ?? [])
                      .slice(0, 2)
                      .map((modifier) => (
                        <span key={modifier} style={styles.traitModifier}>
                          {modifier}
                        </span>
                      ))}
                  </div>
                </div>
              </>
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

        <div style={styles.futureRow}>
          <div style={styles.futureCard}>
            <i
              className="ti ti-clipboard-heart"
              style={{ fontSize: "20px", color: "#9a9890" }}
              aria-hidden="true"
            />
            <div>
              <p style={styles.futureTitle}>健康メモ</p>
              <p style={styles.futureSub}>準備中</p>
            </div>
          </div>
          <div style={styles.futureCard}>
            <i
              className="ti ti-chart-line"
              style={{ fontSize: "20px", color: "#9a9890" }}
              aria-hidden="true"
            />
            <div>
              <p style={styles.futureTitle}>成長の記録</p>
              <p style={styles.futureSub}>準備中</p>
            </div>
          </div>
        </div>

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
    minHeight: "100vh",
    background: "linear-gradient(180deg, #fdfcf9 0%, #f7f5ef 100%)",
    color: "#242522",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
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
    marginBottom: "20px",
    paddingTop: "8px",
  },
  pageTitle: {
    fontSize: "26px",
    fontWeight: 700,
    color: "#2a2a28",
    margin: "0 0 4px",
  },
  pageSub: {
    fontSize: "13px",
    color: "#8a8a80",
    margin: 0,
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
    background: "#f5f3ef",
    border: "3px solid transparent",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  catAvatarActive: {
    border: "3px solid #6B9E82",
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
    border: "1.5px dashed #d0cdc6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  catAvatarAddMark: {
    fontSize: "22px",
    color: "#b0ada6",
  },
  catGridName: {
    fontSize: "12px",
    color: "#4a4a42",
    fontWeight: 500,
  },
  profileCard: {
    background: "#ffffff",
    border: "0.5px solid #e5e2dc",
    borderRadius: "24px",
    padding: "20px",
    marginBottom: "12px",
  },
  profileHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "14px",
  },
  profileName: {
    fontSize: "22px",
    fontWeight: 600,
    color: "#2a2a28",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  genderBadge: {
    fontSize: "11px",
    color: "#3d6650",
    background: "rgba(107,158,130,0.1)",
    border: "0.5px solid rgba(107,158,130,0.25)",
    borderRadius: "99px",
    padding: "2px 8px",
  },
  editBtn: {
    fontSize: "12px",
    color: "#6a6a62",
    background: "#f5f3ef",
    border: "0.5px solid #e0ddd6",
    borderRadius: "99px",
    padding: "4px 12px",
    cursor: "pointer",
  },
  divider: {
    border: "none",
    borderTop: "0.5px solid #e8e5de",
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
    color: "#8a8a80",
  },
  infoValue: {
    fontSize: "13px",
    color: "#2a2a28",
    fontWeight: 500,
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
  traitSection: {
    marginTop: "4px",
  },
  traitLabel: {
    fontSize: "12px",
    color: "#9a9890",
    margin: "0 0 8px",
  },
  traitPills: {
    display: "flex",
    flexWrap: "wrap",
    gap: "5px",
  },
  traitPill: {
    fontSize: "12px",
    background: "rgba(107,158,130,0.1)",
    color: "#3d6650",
    border: "0.5px solid rgba(107,158,130,0.25)",
    borderRadius: "99px",
    padding: "4px 12px",
  },
  traitModifier: {
    fontSize: "11px",
    background: "#f5f3ef",
    color: "#6a6a62",
    border: "0.5px solid #e0ddd6",
    borderRadius: "99px",
    padding: "3px 10px",
  },
  futureRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
    marginTop: "8px",
  },
  futureCard: {
    background: "#f8f7f3",
    border: "0.5px solid #e8e5de",
    borderRadius: "16px",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    opacity: 0.55,
  },
  futureIcon: {
    fontSize: "20px",
    flexShrink: 0,
  },
  futureTitle: {
    fontSize: "13px",
    fontWeight: 500,
    color: "#6a6a62",
    margin: "0 0 2px",
  },
  futureSub: {
    fontSize: "12px",
    color: "#9a9890",
    margin: 0,
  },
  settingsSection: {
    marginTop: "16px",
  },
  settingsSectionLabel: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#9a9890",
    margin: "0 0 8px 4px",
    letterSpacing: "0.04em",
  },
  settingsCard: {
    background: "#ffffff",
    border: "0.5px solid #e5e2dc",
    borderRadius: "16px",
    overflow: "hidden",
  },
  settingsRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px",
    textDecoration: "none",
    color: "#2a2a28",
  },
  settingsRowLabel: {
    fontSize: "14px",
    fontWeight: 500,
    color: "#2a2a28",
  },
  settingsRowChevron: {
    fontSize: "18px",
    color: "#c8c5be",
  },
  header: {
    marginBottom: "12px",
    border: "0",
    borderRadius: "0",
    background: "transparent",
    padding: "4px 2px 0",
  },
  eyebrow: {
    margin: "0 0 4px",
    color: "#71717a",
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: 0,
  },
  title: {
    margin: 0,
    fontSize: "30px",
    fontWeight: 690,
    letterSpacing: 0,
    lineHeight: 1.2,
  },
  lead: {
    margin: "8px 0 0",
    color: "#71717a",
    fontSize: "13px",
    lineHeight: 1.7,
  },
  sectionLabel: {
    margin: "0 0 5px",
    color: "#74756f",
    fontSize: "12px",
    fontWeight: 540,
    lineHeight: 1.5,
  },
  coatSection: {
    marginBottom: "14px",
    borderBottom: "1px solid rgba(232, 229, 222, 0.72)",
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
    color: "#8a8a80",
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
    border: "1px solid rgba(224, 221, 214, 0.76)",
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.78)",
    color: "#4e514b",
    fontSize: "13px",
    fontWeight: 540,
    letterSpacing: 0,
    padding: "0 11px",
    cursor: "pointer",
  },
  coatButtonActive: {
    borderColor: "#c9cec4",
    background: "#f2f3ef",
    color: "#3f433d",
  },
  coatSwatch: {
    display: "inline-block",
    width: "14px",
    height: "14px",
    border: "1px solid rgba(63, 63, 70, 0.16)",
    borderRadius: "999px",
    flex: "0 0 auto",
  },
  editor: {
    marginTop: "10px",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#74756f",
    fontSize: "13px",
    fontWeight: 560,
    letterSpacing: 0,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: "48px",
    border: "1px solid rgba(222, 219, 211, 0.86)",
    borderRadius: "12px",
    background: "rgba(255, 255, 255, 0.86)",
    color: "#242522",
    fontSize: "15px",
    fontWeight: 500,
    letterSpacing: 0,
    padding: "0 14px",
  },
  editLabel: {
    fontSize: "12px",
    fontWeight: 500,
    color: "#6a6a62",
    margin: "0 0 6px",
  },
  editInput: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: "48px",
    border: "1px solid #dedbd3",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#27272a",
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
    border: "1px solid #dedbd3",
    borderRadius: "10px",
    background: "#ffffff",
    color: "#27272a",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
  },
  genderBtnActive: {
    border: "1px solid #aeb5a8",
    background: "#e8e9e4",
    color: "#3f433d",
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
    border: "1px solid #cdd3c9",
    borderRadius: "12px",
    background: "#f2f3ef",
    color: "#3f433d",
    fontSize: "14px",
    fontWeight: 610,
    letterSpacing: 0,
    cursor: "pointer",
  },
  cancelButton: {
    minHeight: "40px",
    padding: "0 18px",
    border: "1px solid rgba(222, 219, 211, 0.8)",
    borderRadius: "12px",
    background: "rgba(255, 255, 255, 0.82)",
    color: "#383936",
    fontSize: "14px",
    fontWeight: 560,
    letterSpacing: 0,
    cursor: "pointer",
  },
  message: {
    margin: "10px 0 0",
    color: "#74756f",
    fontSize: "13px",
    lineHeight: 1.6,
  },
} satisfies Record<string, CSSProperties>;
