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
  { value: "orange_tabby", label: "茶トラ", color: "#efbd79" },
  { value: "black", label: "黒", color: "#57534e" },
  { value: "white", label: "白", color: "#fafafa" },
  { value: "calico", label: "三毛", color: "#f0c28b" },
];

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

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <p style={styles.eyebrow}>{"ねこ"}</p>
          <h1 style={styles.title}>{"ねこ"}</h1>
          <p style={styles.lead}>
            {"一緒に暮らしている子を見られます。"}
          </p>
        </header>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>{"一緒に暮らしている子"}</h2>
          <div style={styles.profileSummary}>
            <div style={styles.profileSummaryHeader}>
              <div style={styles.profileAvatar} aria-hidden="true">
                <img src={activeCatAvatarSrc} alt="" style={styles.profileAvatarIcon} />
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
                            ? "linear-gradient(135deg, #fff7e8 0%, #fff7e8 36%, #efbd79 37%, #efbd79 66%, #d6d3d1 67%, #d6d3d1 100%)"
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
            {catProfiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => handleCatSelect(profile.id)}
                style={
                  profile.id === activeCatId
                    ? styles.activeCatButton
                    : styles.catButton
                }
              >
                {profile.name}
              </button>
            ))}
          </div>

          <div style={styles.managementActions}>
            <button
              type="button"
              onClick={startAddingCat}
              style={styles.outlineActionButton}
            >
              {"猫を追加"}
            </button>
            <button
              type="button"
              onClick={startEditingCatName}
              style={styles.outlineActionButton}
            >
              {"名前を変える"}
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

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f7f3ee",
    color: "#27272a",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
    width: "min(100%, 430px)",
    margin: "0 auto",
    padding: "14px 14px calc(248px + env(safe-area-inset-bottom))",
  },
  header: {
    marginBottom: "10px",
    border: "1px solid #ebe2d6",
    borderRadius: "24px",
    background: "linear-gradient(180deg, #fffdf9 0%, #fff7ec 100%)",
    padding: "16px",
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
    fontWeight: 750,
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
    border: "1px solid #e4e4e7",
    borderRadius: "22px",
    background: "#ffffff",
    padding: "17px 16px",
  },
  profileSummary: {
    marginBottom: "14px",
    borderBottom: "1px solid #f0e6dc",
    paddingBottom: "14px",
  },
  profileSummaryHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  profileAvatar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "58px",
    height: "58px",
    border: "1px solid #eadbca",
    borderRadius: "20px",
    background: "#fffaf3",
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
    color: "#71717a",
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: 1.5,
  },
  activeCatName: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 750,
    letterSpacing: 0,
  },
  sectionTitle: {
    margin: "0 0 8px",
    fontSize: "19px",
    fontWeight: 700,
    letterSpacing: 0,
  },
  description: {
    margin: "0 0 14px",
    color: "#71717a",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  understandingPill: {
    display: "inline-flex",
    width: "fit-content",
    margin: "2px 0 0",
    border: "1px solid #eadbca",
    borderRadius: "999px",
    background: "#fffaf3",
    color: "#6b5f54",
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1.5,
    padding: "3px 10px",
  },
  coatSection: {
    marginBottom: "14px",
    borderBottom: "1px solid #f0e6dc",
    paddingBottom: "14px",
  },
  coatHeader: {
    marginBottom: "8px",
  },
  coatDescription: {
    margin: "2px 0 0",
    color: "#71717a",
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
    border: "1px solid #d4d4d8",
    borderRadius: "999px",
    background: "#ffffff",
    color: "#3f3f46",
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: 0,
    padding: "0 11px",
    cursor: "pointer",
  },
  coatButtonActive: {
    borderColor: "#a58b6f",
    background: "#fff7ec",
    color: "#27272a",
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
    flexWrap: "wrap",
    gap: "8px",
  },
  managementActions: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
    marginTop: "14px",
  },
  catButton: {
    minHeight: "38px",
    padding: "0 14px",
    border: "1px solid #d4d4d8",
    borderRadius: "999px",
    background: "#ffffff",
    color: "#27272a",
    fontSize: "14px",
    fontWeight: 600,
    letterSpacing: 0,
    cursor: "pointer",
  },
  activeCatButton: {
    minHeight: "38px",
    padding: "0 14px",
    border: "1px solid #a1a1aa",
    borderRadius: "999px",
    background: "#3f3f46",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 700,
    letterSpacing: 0,
    cursor: "pointer",
  },
  primaryButton: {
    minHeight: "44px",
    width: "100%",
    border: "1px solid #3f3f46",
    borderRadius: "14px",
    background: "#3f3f46",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 700,
    letterSpacing: 0,
    cursor: "pointer",
  },
  secondaryButton: {
    minHeight: "44px",
    width: "100%",
    border: "1px solid #d4d4d8",
    borderRadius: "14px",
    background: "#ffffff",
    color: "#27272a",
    fontSize: "14px",
    fontWeight: 700,
    letterSpacing: 0,
    cursor: "pointer",
  },
  outlineActionButton: {
    minHeight: "42px",
    border: "1px solid #d4d4d8",
    borderRadius: "14px",
    background: "#ffffff",
    color: "#27272a",
    fontSize: "14px",
    fontWeight: 700,
    letterSpacing: 0,
    cursor: "pointer",
  },
  editor: {
    marginTop: "10px",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    color: "#71717a",
    fontSize: "13px",
    fontWeight: 600,
    letterSpacing: 0,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: "48px",
    border: "1px solid #d4d4d8",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#27272a",
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
    border: "1px solid #a1a1aa",
    borderRadius: "12px",
    background: "#3f3f46",
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: 700,
    letterSpacing: 0,
    cursor: "pointer",
  },
  cancelButton: {
    minHeight: "40px",
    padding: "0 18px",
    border: "1px solid #d4d4d8",
    borderRadius: "12px",
    background: "#ffffff",
    color: "#27272a",
    fontSize: "14px",
    fontWeight: 600,
    letterSpacing: 0,
    cursor: "pointer",
  },
  message: {
    margin: "10px 0 0",
    color: "#71717a",
    fontSize: "13px",
    lineHeight: 1.6,
  },
} satisfies Record<string, CSSProperties>;
