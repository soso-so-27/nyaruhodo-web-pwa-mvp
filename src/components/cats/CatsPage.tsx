"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { BottomNavigation } from "../navigation/BottomNavigation";
import {
  addCatProfile,
  getActiveCatProfile,
  getCatAvatarSrcForCoat,
  getCatName,
  readActiveCatId,
  readCatProfiles,
  saveActiveCatId,
  updateCatProfileCoat,
  updateCatProfileName,
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
const SAMPLE_PROFILE_PHOTO_SRC = "/sample-cats/mugi-portrait.png";

export function CatsPage() {
  const [catProfiles, setCatProfiles] = useState<CatProfile[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [catNameInput, setCatNameInput] = useState("");
  const [newCatNameInput, setNewCatNameInput] = useState("");
  const [isEditingCatName, setIsEditingCatName] = useState(false);
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [message, setMessage] = useState("");

  const activeCatProfile =
    catProfiles.length > 0
      ? getActiveCatProfile(catProfiles, activeCatId)
      : null;
  const catName = getCatName(activeCatProfile);
  const understandingPercent = activeCatProfile?.understanding?.percent;

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
    setMessage("");
  }

  function startAddingCat() {
    setNewCatNameInput("");
    setMessage("");
    setIsAddingCat(true);
    setIsEditingCatName(false);
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

  function startEditingCatName() {
    setCatNameInput(catName);
    setMessage("");
    setIsAddingCat(false);
    setIsEditingCatName(true);
  }

  function cancelEditingCatName() {
    setCatNameInput(catName);
    setMessage("");
    setIsEditingCatName(false);
  }

  function handleCatNameSave() {
    const result = updateCatProfileName(catProfiles, activeCatId, catNameInput);

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
    setIsEditingCatName(false);
    setMessage("保存しました。");
  }

  function handleCoatSelect(coat: CatCoat) {
    const result = updateCatProfileCoat(catProfiles, activeCatId, coat);
    const activeProfile = getActiveCatProfile(
      result.profiles,
      result.activeCatId,
    );

    setCatProfiles(result.profiles);
    setActiveCatId(result.activeCatId);
    setCatNameInput(activeProfile.name);
    setMessage("保存しました。");
  }

  const selectedCoat = activeCatProfile?.appearance?.coat;
  const activeCatAvatarSrc = getCatAvatarSrcForCoat(selectedCoat);
  const activeCatAvatarStyle = getCatCoatAvatarStyle(selectedCoat);

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>{"一緒に暮らしている子"}</h2>
          <div style={styles.profileSummary}>
            <div style={styles.profileSummaryHeader}>
              <div
                style={{ ...styles.profilePhotoFrame, ...activeCatAvatarStyle }}
                aria-hidden="true"
              >
                <img
                  src={SAMPLE_PROFILE_PHOTO_SRC}
                  alt=""
                  style={styles.profilePhoto}
                  onError={(event) => {
                    event.currentTarget.src = activeCatAvatarSrc;
                    event.currentTarget.style.objectFit = "contain";
                  }}
                />
              </div>
              <div style={styles.profileSummaryText}>
                <p style={styles.sectionLabel}>{"いま見ている子"}</p>
                <h3 style={styles.activeCatName}>{catName}</h3>
                <p style={styles.description}>
                  {"今日の記録や見立ては、この子にたまります。"}
                </p>
                {typeof understandingPercent === "number" ? (
                  <p style={styles.understandingPill}>
                    {"理解度 "}
                    {understandingPercent}
                    {"%"}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div style={styles.coatSection}>
            <div style={styles.coatHeader}>
              <p style={styles.sectionLabel}>{"毛色"}</p>
              <p style={styles.coatDescription}>
                {"この子に近い色を選べます。"}
              </p>
            </div>
            <div style={styles.coatOptions}>
              {COAT_OPTIONS.map((option) => {
                const isSelected = option.value === selectedCoat;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleCoatSelect(option.value)}
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

          <div style={styles.catList}>
            {catProfiles.map((profile) => {
              const age = formatAge(profile.basicInfo?.birthDate);
              const gender = formatGender(profile.basicInfo?.gender);
              const meta = [gender, age].filter(Boolean).join("・");
              const understanding = profile.understanding?.percent ?? 0;
              const isActive = profile.id === activeCatId;

              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => handleCatSelect(profile.id)}
                  style={isActive ? styles.catListItemActive : styles.catListItem}
                >
                  <div style={styles.catListAvatar}>
                    <img
                      src={getCatAvatarSrcForCoat(profile.appearance?.coat)}
                      alt=""
                      style={styles.catListAvatarImg}
                    />
                  </div>
                  <div style={styles.catListInfo}>
                    <span style={styles.catListName}>{profile.name}</span>
                    {meta ? <span style={styles.catListMeta}>{meta}</span> : null}
                    <div style={styles.catListProgress}>
                      <div style={styles.catListProgressBar}>
                        <div
                          style={{
                            ...styles.catListProgressFill,
                            width: `${Math.min(100, understanding)}%`,
                          }}
                        />
                      </div>
                      <span style={styles.catListProgressLabel}>
                        {understanding}
                        {"%"}
                      </span>
                    </div>
                  </div>
                  <span style={styles.catListChevron}>›</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={startAddingCat}
            style={styles.addCatListButton}
          >
            ＋ 猫を追加
          </button>

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
              <div style={styles.actions}>
                <button
                  type="button"
                  onClick={handleCatNameSave}
                  style={styles.saveButton}
                >
                  {"保存"}
                </button>
                <button
                  type="button"
                  onClick={cancelEditingCatName}
                  style={styles.cancelButton}
                >
                  {"キャンセル"}
                </button>
              </div>
            </div>
          ) : null}
          {message ? <p style={styles.message}>{message}</p> : null}
        </section>
      </div>
      <BottomNavigation active="cats" />
    </main>
  );
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
    padding: "16px 14px calc(224px + env(safe-area-inset-bottom))",
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
  card: {
    marginBottom: "10px",
    border: "1px solid rgba(228, 225, 218, 0.72)",
    borderRadius: "28px",
    background: "rgba(255, 255, 255, 0.9)",
    padding: "18px 17px",
    boxShadow: "0 10px 24px rgba(44, 42, 38, 0.024)",
  },
  profileSummary: {
    marginBottom: "14px",
    borderBottom: "1px solid rgba(232, 229, 222, 0.72)",
    paddingBottom: "14px",
  },
  profileSummaryHeader: {
    display: "flex",
    alignItems: "center",
    gap: "15px",
  },
  profilePhotoFrame: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "94px",
    height: "94px",
    border: "1px solid rgba(224, 221, 214, 0.78)",
    borderRadius: "999px",
    background: "#f5f4ef",
    flex: "0 0 auto",
    overflow: "hidden",
    boxShadow: "0 10px 24px rgba(43, 40, 34, 0.035)",
  },
  profilePhoto: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
    filter: "saturate(0.92) contrast(0.98) brightness(1.02)",
  },
  profileAvatar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "58px",
    height: "58px",
    border: "1px solid #ddd8cf",
    borderRadius: "20px",
    background: "#f8f7f3",
    flex: "0 0 auto",
    overflow: "hidden",
  },
  profileAvatarIcon: {
    display: "block",
    width: "47px",
    height: "47px",
    objectFit: "contain",
  },
  profileSummaryText: {
    minWidth: 0,
  },
  sectionLabel: {
    margin: "0 0 5px",
    color: "#74756f",
    fontSize: "12px",
    fontWeight: 540,
    lineHeight: 1.5,
  },
  activeCatName: {
    margin: 0,
    fontSize: "25px",
    fontWeight: 680,
    letterSpacing: 0,
  },
  sectionTitle: {
    margin: "0 0 8px",
    fontSize: "19px",
    fontWeight: 620,
    letterSpacing: 0,
  },
  description: {
    margin: "0 0 14px",
    color: "#74756f",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  understandingPill: {
    display: "inline-flex",
    width: "fit-content",
    margin: "2px 0 0",
    border: "1px solid rgba(224, 221, 214, 0.78)",
    borderRadius: "999px",
    background: "#f5f4ef",
    color: "#72746d",
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: 1.5,
    padding: "3px 10px",
  },
  coatSection: {
    marginBottom: "14px",
    borderBottom: "1px solid rgba(232, 229, 222, 0.72)",
    paddingBottom: "14px",
  },
  coatHeader: {
    marginBottom: "8px",
  },
  coatDescription: {
    margin: "2px 0 0",
    color: "#74756f",
    fontSize: "12px",
    lineHeight: 1.5,
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
  catList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    marginTop: "12px",
  },
  catListItem: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minHeight: "64px",
    border: "1px solid #e5e2dc",
    borderRadius: "16px",
    background: "#ffffff",
    padding: "10px 12px",
    cursor: "pointer",
    textAlign: "left",
  },
  catListItemActive: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    minHeight: "64px",
    border: "1px solid #d4d6ce",
    borderRadius: "16px",
    background: "#f0f1ec",
    padding: "10px 12px",
    cursor: "pointer",
    textAlign: "left",
  },
  catListAvatar: {
    width: "44px",
    height: "44px",
    borderRadius: "12px",
    overflow: "hidden",
    flexShrink: 0,
    background: "#f5f3ef",
    border: "0.5px solid #e0ddd6",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  catListAvatarImg: {
    width: "36px",
    height: "36px",
    objectFit: "contain",
  },
  catListInfo: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  catListName: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#27272a",
    lineHeight: 1.3,
  },
  catListMeta: {
    fontSize: "11px",
    color: "#8a8a80",
    lineHeight: 1.3,
  },
  catListProgress: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginTop: "2px",
  },
  catListProgressBar: {
    flex: 1,
    height: "3px",
    background: "#e8e5de",
    borderRadius: "99px",
    overflow: "hidden",
  },
  catListProgressFill: {
    height: "100%",
    background: "#6B9E82",
    borderRadius: "99px",
  },
  catListProgressLabel: {
    fontSize: "10px",
    color: "#8a8a80",
    flexShrink: 0,
  },
  catListChevron: {
    fontSize: "16px",
    color: "#c8c5be",
    flexShrink: 0,
  },
  addCatListButton: {
    width: "100%",
    minHeight: "48px",
    border: "1px dashed #dedbd3",
    borderRadius: "16px",
    background: "transparent",
    color: "#8a8a80",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    marginTop: "6px",
  },
  primaryButton: {
    minHeight: "44px",
    width: "100%",
    border: "1px solid #cdd3c9",
    borderRadius: "14px",
    background: "#f2f3ef",
    color: "#3f433d",
    fontSize: "14px",
    fontWeight: 610,
    letterSpacing: 0,
    cursor: "pointer",
  },
  secondaryButton: {
    minHeight: "44px",
    width: "100%",
    border: "1px solid rgba(222, 219, 211, 0.8)",
    borderRadius: "14px",
    background: "rgba(255, 255, 255, 0.82)",
    color: "#383936",
    fontSize: "14px",
    fontWeight: 560,
    letterSpacing: 0,
    cursor: "pointer",
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

function getCatCoatAvatarStyle(coat?: CatCoat): CSSProperties {
  const stylesByCoat: Record<CatCoat, CSSProperties> = {
    saba: {
      borderColor: "#d8d2c4",
      background: "linear-gradient(180deg, #fffaf2 0%, #e6ded1 100%)",
    },
    cream: {
      borderColor: "#d8d2c4",
      background: "linear-gradient(180deg, #fffaf2 0%, #e6ded1 100%)",
    },
    gray: {
      borderColor: "#d6d3d1",
      background: "linear-gradient(180deg, #f6f5f3 0%, #e5e2de 100%)",
    },
    orange_tabby: {
      borderColor: "#dfc7a8",
      background: "linear-gradient(180deg, #fbf3e7 0%, #e6d0b3 100%)",
    },
    black: {
      borderColor: "#625f59",
      background: "linear-gradient(180deg, #e6e3de 0%, #8d8881 100%)",
    },
    white: {
      borderColor: "#dedbd3",
      background: "linear-gradient(180deg, #ffffff 0%, #f4f4f5 100%)",
    },
    calico: {
      borderColor: "#ded6ca",
      background:
        "linear-gradient(135deg, #faf6ee 0%, #faf6ee 44%, #ead8be 45%, #ead8be 64%, #e1ded8 65%, #e1ded8 100%)",
    },
  };

  return coat ? stylesByCoat[coat] : {};
}
