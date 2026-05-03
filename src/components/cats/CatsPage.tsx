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
  updateCatProfileName,
} from "../home/homeInputHelpers";
import type { CatProfile } from "../home/homeInputHelpers";

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

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <p style={styles.eyebrow}>{"ねこ"}</p>
          <h1 style={styles.title}>{"ねこの設定"}</h1>
          <p style={styles.lead}>
            {"猫の追加や名前の変更はここからできます。"}
          </p>
        </header>

        <section style={styles.card}>
          <p style={styles.sectionLabel}>{"いま見ている猫"}</p>
          <h2 style={styles.activeCatName}>{catName}</h2>
          <p style={styles.description}>
            {"ホームでは、この子の記録や診断を見ます。"}
          </p>
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>{"猫一覧"}</h2>
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
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>{"猫を追加"}</h2>
          <p style={styles.description}>
            {"一緒に暮らしている猫を追加できます。"}
          </p>
          {!isAddingCat ? (
            <button
              type="button"
              onClick={startAddingCat}
              style={styles.primaryButton}
            >
              {"猫を追加"}
            </button>
          ) : (
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
          )}
        </section>

        <section style={styles.card}>
          <h2 style={styles.sectionTitle}>{"名前を変更"}</h2>
          <p style={styles.description}>
            {"現在選択中の猫の名前を変更できます。"}
          </p>
          {!isEditingCatName ? (
            <button
              type="button"
              onClick={startEditingCatName}
              style={styles.secondaryButton}
            >
              {"名前を変更"}
            </button>
          ) : (
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
          )}
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
    padding: "18px 16px 16px",
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
  catList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
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
