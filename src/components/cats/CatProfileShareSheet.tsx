"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type {
  CatAppearance,
  CatBasicInfo,
} from "../home/homeInputHelpers";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import { AppSheet } from "../ui/AppBottomSheet";
import { AppButton } from "../ui/AppButton";
import { AppCard } from "../ui/AppCard";
import { CatIcon, SendIcon } from "../ui/AppIcons";
import { PhotoTile } from "../ui/PhotoTile";
import { AppTextField } from "../ui/AppTextField";
import {
  color,
  radius,
  spacing,
  typography,
} from "../ui/designTokens";

export type CatProfileShareSectionKey =
  | "personality"
  | "care_note"
  | "clinic"
  | "health"
  | "basic";

export type CatProfileShareCat = {
  localCatId?: string | null;
  name: string;
  photo?: string | null;
  basicInfo?: CatBasicInfo;
  appearance?: CatAppearance;
};

export type CatProfileShareSheetProps = {
  cat: CatProfileShareCat;
  open: boolean;
  onClose: () => void;
};

type ShareFeedback =
  | { tone: "success"; message: string }
  | { tone: "error"; message: string }
  | null;

type ShareTextSection = {
  key: CatProfileShareSectionKey;
  title: string;
  rows: Array<{ label: string; value: string }>;
};

const DEFAULT_SHARE_SECTION_KEYS = new Set<CatProfileShareSectionKey>([
  "personality",
  "care_note",
  "clinic",
]);

export function CatProfileShareSheet({
  cat,
  open,
  onClose,
}: CatProfileShareSheetProps) {
  const sections = useMemo(() => buildCatProfileShareSections(cat), [cat]);
  const defaultSelectionSignature = useMemo(
    () => getDefaultSelectedSectionKeys(sections).join("|"),
    [sections],
  );
  const [selectedKeys, setSelectedKeys] = useState<
    CatProfileShareSectionKey[]
  >([]);
  const [temporaryNote, setTemporaryNote] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [feedback, setFeedback] = useState<ShareFeedback>(null);
  const catName = normalizeCatName(cat.name);
  const shareTitle = `${catName}の共有メモ`;
  const shareText = useMemo(
    () => buildCatProfileShareText(cat, selectedKeys, temporaryNote),
    [cat, selectedKeys, temporaryNote],
  );
  const canShare =
    selectedKeys.length > 0 || normalizeTemporaryNote(temporaryNote) !== "";

  useEffect(() => {
    if (!open) {
      return;
    }

    setSelectedKeys(
      defaultSelectionSignature
        ? (defaultSelectionSignature.split(
            "|",
          ) as CatProfileShareSectionKey[])
        : [],
    );
    setTemporaryNote("");
    setIsSharing(false);
    setFeedback(null);
  }, [defaultSelectionSignature, open]);

  if (!open) {
    return null;
  }

  function toggleSection(key: CatProfileShareSectionKey) {
    setSelectedKeys((current) =>
      current.includes(key)
        ? current.filter((currentKey) => currentKey !== key)
        : [...current, key],
    );
    setFeedback(null);
  }

  function closeSheet() {
    setSelectedKeys([]);
    setTemporaryNote("");
    setIsSharing(false);
    setFeedback(null);
    onClose();
  }

  async function handleShare() {
    if (!canShare || !shareText || isSharing) {
      return;
    }

    setIsSharing(true);
    setFeedback(null);

    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({
            title: shareTitle,
            text: shareText,
          });
          trackProductEvent(
            "cat_profile_share_completed",
            {
              method: "native_share",
              selected_sections_count: selectedKeys.length,
              has_temporary_note: normalizeTemporaryNote(temporaryNote) !== "",
            },
            { localCatId: cat.localCatId },
          );
          closeSheet();
          return;
        } catch (error) {
          if (isShareCancellation(error)) {
            trackProductEvent(
              "cat_profile_share_cancelled",
              {
                method: "native_share",
                selected_sections_count: selectedKeys.length,
                has_temporary_note:
                  normalizeTemporaryNote(temporaryNote) !== "",
              },
              { localCatId: cat.localCatId },
            );
            closeSheet();
            return;
          }
        }
      }

      await copyText(shareText);
      trackProductEvent(
        "cat_profile_share_completed",
        {
          method: "clipboard",
          selected_sections_count: selectedKeys.length,
          has_temporary_note: normalizeTemporaryNote(temporaryNote) !== "",
        },
        { localCatId: cat.localCatId },
      );
      setFeedback({
        tone: "success",
        message: "共有するテキストをコピーしました。",
      });
    } catch {
      setFeedback({
        tone: "error",
        message:
          "共有できませんでした。プレビューを長押ししてコピーしてください。",
      });
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <div data-testid="cats-profile-share-dialog" style={styles.dialogRoot}>
      <AppSheet
        open
        title={`${catName}の共有メモ`}
        onClose={closeSheet}
        closeLabel="閉じる"
        size="content"
        footer={
          <AppButton
            type="button"
            variant="primary"
            fullWidth
            iconStart={<SendIcon size={18} />}
            loading={isSharing}
            loadingLabel="準備しています"
            disabled={!canShare}
            data-testid="cats-profile-share-submit"
            onClick={() => {
              void handleShare();
            }}
          >
            この内容を共有
          </AppButton>
        }
      >
        <div style={styles.content}>
          <div style={styles.catSummary}>
            <PhotoTile
              src={cat.photo ?? undefined}
              alt={cat.photo ? `${catName}のプロフィール写真` : ""}
              variant="bare"
              shape="circle"
              size="sm"
              loading="eager"
              style={styles.photoRoot}
              frameStyle={styles.photoFrame}
            >
              <CatIcon size={26} />
            </PhotoTile>
            <div style={styles.catSummaryCopy}>
              <p style={styles.catName}>{catName}</p>
              <p style={styles.intro}>伝えたいことを選べます。</p>
            </div>
          </div>

          <fieldset style={styles.sectionFieldset}>
            <legend style={styles.sectionLegend}>共有する項目</legend>
            {sections.length > 0 ? (
              <div style={styles.sectionList}>
                {sections.map((section) => {
                  const checked = selectedKeys.includes(section.key);

                  return (
                    <label key={section.key} style={styles.sectionOption}>
                      <input
                        type="checkbox"
                        checked={checked}
                        data-testid={`cats-profile-share-section-${section.key}`}
                        style={styles.checkbox}
                        onChange={() => toggleSection(section.key)}
                      />
                      <span style={styles.sectionOptionCopy}>
                        <span style={styles.sectionOptionLabel}>
                          {getShareSectionLabel(section.key)}
                        </span>
                        <span style={styles.sectionOptionSummary}>
                          {summarizeSection(section)}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p style={styles.noSavedSections}>
                選べるプロフィール情報は、まだありません。
              </p>
            )}
          </fieldset>

          <AppTextField
            id="cat-profile-share-temporary-note"
            as="textarea"
            label="今回だけ伝えること"
            value={temporaryNote}
            maxLength={180}
            rows={3}
            placeholder="例：ごはんは冷蔵庫にあります"
            hint="プロフィールには保存されません。"
            data-testid="cats-profile-share-temporary-note"
            fieldStyle={styles.temporaryNoteField}
            onChange={(event) => {
              setTemporaryNote(event.target.value);
              setFeedback(null);
            }}
          />

          <section aria-labelledby="cat-profile-share-preview-heading">
            <div style={styles.previewHeadingRow}>
              <h3
                id="cat-profile-share-preview-heading"
                style={styles.previewHeading}
              >
                共有する内容
              </h3>
              <span style={styles.textOnlyLabel}>テキストのみ</span>
            </div>
            <AppCard variant="inset" padding="md">
              <pre
                data-testid="cats-profile-share-preview"
                style={styles.preview}
              >
                {shareText}
              </pre>
            </AppCard>
            <p style={styles.privacyNote}>
              写真やねこだよりは含まれません。送信・コピー後の内容は、
              アプリから取り消せません。
            </p>
          </section>

          <p
            role={feedback?.tone === "error" ? "alert" : "status"}
            aria-live="polite"
            style={{
              ...styles.feedback,
              ...(feedback?.tone === "error" ? styles.feedbackError : null),
            }}
          >
            {feedback?.message ?? ""}
          </p>
        </div>
      </AppSheet>
    </div>
  );
}

export function buildCatProfileShareText(
  cat: CatProfileShareCat,
  selectedKeys: ReadonlyArray<CatProfileShareSectionKey>,
  temporaryNote = "",
): string {
  const catName = normalizeCatName(cat.name);
  const selectedKeySet = new Set(selectedKeys);
  const sections = buildCatProfileShareSections(cat).filter((section) =>
    selectedKeySet.has(section.key),
  );
  const note = normalizeTemporaryNote(temporaryNote);
  const lines = [`${catName}の共有メモ`, "", `名前：${catName}`];

  for (const section of sections) {
    lines.push("", `［${section.title}］`);
    for (const row of section.rows) {
      lines.push(`${row.label}：${row.value}`);
    }
  }

  if (note) {
    lines.push("", "［今回だけ伝えること］", note);
  }

  return lines.join("\n");
}

export function buildCatProfileShareSections(
  cat: CatProfileShareCat,
): ShareTextSection[] {
  const basicInfo = cat.basicInfo;
  const sections: ShareTextSection[] = [
    {
      key: "personality",
      title: "この子らしさ",
      rows: compactRows([
        ["呼び名", basicInfo?.personality?.callName],
        ["好きな場所", basicInfo?.personality?.favoritePlace],
        ["好きな遊び", basicInfo?.personality?.favoritePlay],
        ["なでると喜ぶ場所", basicInfo?.personality?.favoriteTouch],
        ["苦手なこと", basicInfo?.personality?.dislikes],
      ]),
    },
    {
      key: "care_note",
      title: "気をつけること",
      rows: compactRows([["気をつけること", basicInfo?.care?.careNote]]),
    },
    {
      key: "clinic",
      title: "かかりつけ",
      rows: compactRows([["かかりつけ", basicInfo?.care?.vetClinic]]),
    },
    {
      key: "health",
      title: "体重・ワクチン",
      rows: compactRows([
        ["体重", formatWeight(basicInfo?.care?.weightKg)],
        [
          "体重を測った日",
          formatSavedDate(basicInfo?.care?.weightMeasuredDate),
        ],
        [
          "ワクチンを打った日",
          formatSavedDate(basicInfo?.care?.vaccineDate),
        ],
        ["ワクチンのメモ", basicInfo?.care?.vaccineNote],
      ]),
    },
    {
      key: "basic",
      title: "基本情報",
      rows: compactRows([
        ["家族になった日", formatSavedDate(basicInfo?.familySinceDate)],
        ["誕生日", formatSavedDate(basicInfo?.birthDate)],
        ["性別", formatGender(basicInfo?.gender)],
        ["毛柄", formatCoat(cat.appearance?.coat)],
        ["猫種", basicInfo?.breed],
      ]),
    },
  ];

  return sections.filter((section) => section.rows.length > 0);
}

function getDefaultSelectedSectionKeys(
  sections: ReadonlyArray<ShareTextSection>,
): CatProfileShareSectionKey[] {
  const preferred = sections
    .filter((section) => DEFAULT_SHARE_SECTION_KEYS.has(section.key))
    .map((section) => section.key);

  if (preferred.length > 0) {
    return preferred;
  }

  return sections[0] ? [sections[0].key] : [];
}

function getShareSectionLabel(key: CatProfileShareSectionKey): string {
  const labels: Record<CatProfileShareSectionKey, string> = {
    personality: "この子らしさ",
    care_note: "気をつけること",
    clinic: "かかりつけ",
    health: "体重・ワクチン",
    basic: "基本情報",
  };

  return labels[key];
}

function summarizeSection(section: ShareTextSection): string {
  return section.rows
    .slice(0, 2)
    .map((row) => row.value)
    .join("・");
}

function normalizeTemporaryNote(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

function compactRows(
  rows: ReadonlyArray<readonly [label: string, value?: string | null]>,
): Array<{ label: string; value: string }> {
  return rows.flatMap(([label, value]) => {
    const normalizedValue = value?.trim();
    return normalizedValue ? [{ label, value: normalizedValue }] : [];
  });
}

function normalizeCatName(name: string): string {
  return name.trim() || "この子";
}

function formatSavedDate(value?: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    return "";
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) {
    return "";
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  const isValid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  return isValid ? `${year}年${month}月${day}日` : "";
}

function formatGender(gender?: CatBasicInfo["gender"]): string {
  if (gender === "male") {
    return "男の子";
  }

  if (gender === "female") {
    return "女の子";
  }

  return gender === "unknown" ? "わからない" : "";
}

function formatCoat(coat?: string): string {
  if (!coat) {
    return "";
  }

  const labels: Record<string, string> = {
    saba: "サバトラ",
    cream: "サバトラ",
    kiji_tabby: "キジトラ",
    gray: "グレー",
    orange_tabby: "茶トラ",
    black: "黒",
    white: "白",
    hachiware: "ハチワレ",
    calico: "三毛",
    tortoiseshell: "サビ",
  };

  return labels[coat] ?? coat.trim();
}

function formatWeight(weightKg?: number): string {
  if (
    !weightKg ||
    !Number.isFinite(weightKg) ||
    weightKg < 0.5 ||
    weightKg > 20
  ) {
    return "";
  }

  const value = Number.isInteger(weightKg) ? String(weightKg) : weightKg.toFixed(1);
  return `${value} kg`;
}

function isShareCancellation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

async function copyText(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Older iOS versions can expose Clipboard API but reject the call.
    }
  }

  if (typeof document === "undefined") {
    throw new Error("Clipboard is not available");
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  textArea.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("Copy command failed");
    }
  } finally {
    textArea.remove();
  }
}

const styles = {
  dialogRoot: {
    position: "fixed",
    inset: 0,
    zIndex: 200,
  },
  content: {
    display: "grid",
    gap: spacing.lg,
    paddingBottom: spacing.sm,
  },
  catSummary: {
    display: "grid",
    gridTemplateColumns: "56px minmax(0, 1fr)",
    alignItems: "center",
    gap: spacing.md,
  },
  photoRoot: {
    width: 56,
  },
  photoFrame: {
    width: 56,
    height: 56,
    borderRadius: radius.circle,
    background: "color-mix(in srgb, var(--paper-card) 84%, transparent)",
    color: color.textMuted,
  },
  catSummaryCopy: {
    minWidth: 0,
    display: "grid",
    gap: spacing.xs,
  },
  catName: {
    margin: 0,
    color: color.textStrong,
    fontFamily: typography.fontDisplay,
    fontSize: 18,
    fontWeight: 500,
    lineHeight: 1.35,
    overflowWrap: "anywhere",
  },
  intro: {
    margin: 0,
    color: color.textMuted,
    fontFamily: typography.fontUi,
    fontSize: typography.caption.fontSize,
    lineHeight: 1.55,
  },
  sectionFieldset: {
    minWidth: 0,
    margin: 0,
    padding: 0,
    border: 0,
  },
  sectionLegend: {
    marginBottom: spacing.sm,
    padding: 0,
    color: color.text,
    fontFamily: typography.fontUi,
    fontSize: typography.caption.fontSize,
    fontWeight: 500,
    lineHeight: 1.5,
  },
  sectionList: {
    display: "grid",
    borderTop: `1px solid ${color.border}`,
  },
  sectionOption: {
    boxSizing: "border-box",
    width: "100%",
    minHeight: 58,
    display: "grid",
    gridTemplateColumns: "24px minmax(0, 1fr)",
    alignItems: "center",
    gap: spacing.sm,
    margin: 0,
    padding: `${spacing.sm}px 2px`,
    borderBottom: `1px solid ${color.border}`,
    color: color.text,
    textAlign: "left",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  checkbox: {
    width: 20,
    height: 20,
    margin: 0,
    accentColor: "var(--seal)",
    cursor: "pointer",
  },
  sectionOptionCopy: {
    minWidth: 0,
    display: "grid",
    gap: 2,
  },
  sectionOptionLabel: {
    fontFamily: typography.fontUi,
    fontSize: typography.body.fontSize,
    fontWeight: 500,
    lineHeight: 1.45,
  },
  sectionOptionSummary: {
    color: color.textMuted,
    fontFamily: typography.fontUi,
    fontSize: 12,
    fontWeight: 400,
    lineHeight: 1.5,
    overflowWrap: "anywhere",
  },
  noSavedSections: {
    margin: 0,
    color: color.textMuted,
    fontFamily: typography.fontUi,
    fontSize: typography.caption.fontSize,
    lineHeight: 1.65,
  },
  temporaryNoteField: {
    minHeight: 92,
    resize: "vertical",
  },
  previewHeadingRow: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  previewHeading: {
    margin: 0,
    color: color.text,
    fontFamily: typography.fontUi,
    fontSize: typography.caption.fontSize,
    fontWeight: 500,
    lineHeight: 1.5,
  },
  textOnlyLabel: {
    color: color.textFaint,
    fontFamily: typography.fontUi,
    fontSize: 12,
    lineHeight: 1.5,
  },
  preview: {
    margin: 0,
    color: color.text,
    fontFamily: typography.fontUi,
    fontSize: typography.caption.fontSize,
    fontWeight: 400,
    lineHeight: 1.7,
    letterSpacing: "0.01em",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    userSelect: "text",
  },
  privacyNote: {
    margin: `${spacing.sm}px 0 0`,
    color: color.textFaint,
    fontFamily: typography.fontUi,
    fontSize: 12,
    lineHeight: 1.5,
  },
  feedback: {
    minHeight: 20,
    margin: 0,
    color: color.textMuted,
    fontFamily: typography.fontUi,
    fontSize: typography.caption.fontSize,
    lineHeight: 1.5,
  },
  feedbackError: {
    color: color.danger,
  },
} satisfies Record<string, CSSProperties>;
