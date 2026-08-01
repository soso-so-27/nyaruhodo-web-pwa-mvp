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
import {
  color,
  radius,
  spacing,
  typography,
} from "../ui/designTokens";

export type CatProfileSharePurpose = "everyday" | "emergency";

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
  title: string;
  rows: Array<{ label: string; value: string }>;
};

const PURPOSES: ReadonlyArray<{
  value: CatProfileSharePurpose;
  label: string;
  testId: string;
}> = [
  {
    value: "everyday",
    label: "お世話をお願いする",
    testId: "cats-profile-share-purpose-everyday",
  },
  {
    value: "emergency",
    label: "もしものために保存",
    testId: "cats-profile-share-purpose-emergency",
  },
];

export function CatProfileShareSheet({
  cat,
  open,
  onClose,
}: CatProfileShareSheetProps) {
  const [purpose, setPurpose] = useState<CatProfileSharePurpose | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [feedback, setFeedback] = useState<ShareFeedback>(null);
  const catName = normalizeCatName(cat.name);
  const shareTitle = purpose ? getShareTitle(catName, purpose) : "";
  const shareText = useMemo(
    () => (purpose ? buildCatProfileShareText(cat, purpose) : ""),
    [cat, purpose],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setPurpose(null);
    setIsSharing(false);
    setFeedback(null);
  }, [open]);

  if (!open) {
    return null;
  }

  function selectPurpose(nextPurpose: CatProfileSharePurpose) {
    setPurpose(nextPurpose);
    setFeedback(null);
    trackProductEvent(
      "cat_profile_share_purpose_selected",
      { purpose: nextPurpose },
      { localCatId: cat.localCatId },
    );
  }

  async function handleShare() {
    if (!purpose || !shareText || isSharing) {
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
            { method: "native_share", purpose },
            { localCatId: cat.localCatId },
          );
          onClose();
          return;
        } catch (error) {
          if (isShareCancellation(error)) {
            trackProductEvent(
              "cat_profile_share_cancelled",
              { method: "native_share", purpose },
              { localCatId: cat.localCatId },
            );
            onClose();
            return;
          }
        }
      }

      await copyText(shareText);
      trackProductEvent(
        "cat_profile_share_completed",
        { method: "clipboard", purpose },
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
        title="プロフィールを共有"
        onClose={onClose}
        closeLabel="閉じる"
        size="content"
        footer={
          purpose ? (
            <AppButton
              type="button"
              variant="primary"
              fullWidth
              iconStart={<SendIcon size={18} />}
              loading={isSharing}
              loadingLabel="準備しています"
              data-testid="cats-profile-share-submit"
              onClick={() => {
                void handleShare();
              }}
            >
              共有する
            </AppButton>
          ) : undefined
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
              <p style={styles.intro}>
                必要なときに、その子のことを渡せるように。
              </p>
            </div>
          </div>

          <fieldset style={styles.purposeFieldset}>
            <legend style={styles.purposeLegend}>用途を選ぶ</legend>
            <div
              role="radiogroup"
              aria-label="プロフィールを共有する用途"
              style={styles.purposeList}
            >
              {PURPOSES.map((option) => {
                const selected = purpose === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    data-testid={option.testId}
                    data-app-pressable="card"
                    style={{
                      ...styles.purposeButton,
                      ...(selected ? styles.purposeButtonSelected : null),
                    }}
                    onClick={() => selectPurpose(option.value)}
                  >
                    <span style={styles.purposeLabel}>{option.label}</span>
                    <span
                      aria-hidden="true"
                      style={{
                        ...styles.radioMark,
                        ...(selected ? styles.radioMarkSelected : null),
                      }}
                    >
                      {selected ? <span style={styles.radioMarkInner} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {purpose ? (
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
                写真やねこだよりは含まれません。
              </p>
            </section>
          ) : null}

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
  purpose: CatProfileSharePurpose,
): string {
  const catName = normalizeCatName(cat.name);
  const basicInfo = cat.basicInfo;
  const basicRows =
    purpose === "everyday"
      ? compactRows([["性別", formatGender(basicInfo?.gender)]])
      : compactRows([
          ["家族になった日", formatSavedDate(basicInfo?.familySinceDate)],
          ["誕生日", formatSavedDate(basicInfo?.birthDate)],
          ["性別", formatGender(basicInfo?.gender)],
          ["毛柄", formatCoat(cat.appearance?.coat)],
          ["猫種", basicInfo?.breed],
        ]);
  const sections: ShareTextSection[] = [
    {
      title: "基本情報",
      rows: basicRows,
    },
    {
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
      title: "ケアのメモ",
      rows: compactRows([
        ["体重", formatWeight(basicInfo?.care?.weightKg)],
        [
          "体重を測った日",
          formatSavedDate(basicInfo?.care?.weightMeasuredDate),
        ],
        ["かかりつけ", basicInfo?.care?.vetClinic],
        ["気をつけること", basicInfo?.care?.careNote],
        [
          "ワクチンを打った日",
          formatSavedDate(basicInfo?.care?.vaccineDate),
        ],
        ["ワクチンのメモ", basicInfo?.care?.vaccineNote],
      ]),
    },
  ];
  const lines = [getShareTextHeading(catName, purpose), "", `名前：${catName}`];

  for (const section of sections) {
    if (section.rows.length === 0) {
      continue;
    }

    lines.push("", `［${section.title}］`);
    for (const row of section.rows) {
      lines.push(`${row.label}：${row.value}`);
    }
  }

  return lines.join("\n");
}

function getShareTitle(
  catName: string,
  purpose: CatProfileSharePurpose,
): string {
  return purpose === "everyday"
    ? `${catName}のお世話メモ`
    : `${catName}のプロフィール`;
}

function getShareTextHeading(
  catName: string,
  purpose: CatProfileSharePurpose,
): string {
  return purpose === "everyday"
    ? `${catName}のお世話メモ（お世話をお願いする）`
    : `${catName}のプロフィール（もしものために保存）`;
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
    return normalized;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  const isValid =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  return isValid ? `${year}年${month}月${day}日` : normalized;
}

function formatGender(gender?: CatBasicInfo["gender"]): string {
  if (gender === "male") {
    return "男の子";
  }

  if (gender === "female") {
    return "女の子";
  }

  return gender === "unknown" ? "不明" : "";
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
  if (!weightKg || !Number.isFinite(weightKg)) {
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
  purposeFieldset: {
    minWidth: 0,
    margin: 0,
    padding: 0,
    border: 0,
  },
  purposeLegend: {
    marginBottom: spacing.sm,
    padding: 0,
    color: color.text,
    fontFamily: typography.fontUi,
    fontSize: typography.caption.fontSize,
    fontWeight: 500,
    lineHeight: 1.5,
  },
  purposeList: {
    display: "grid",
    gap: spacing.sm,
  },
  purposeButton: {
    boxSizing: "border-box",
    width: "100%",
    minHeight: 68,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    margin: 0,
    padding: `${spacing.md}px ${spacing.lg}px`,
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    borderRadius: radius.lg,
    background: "color-mix(in srgb, var(--paper) 72%, transparent)",
    color: color.text,
    textAlign: "left",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
    transition:
      "transform var(--app-press-duration, var(--dur-press-out)) var(--ease-settle), background var(--dur-instant) var(--ease-gentle), border-color var(--dur-instant) var(--ease-gentle)",
  },
  purposeButtonSelected: {
    borderColor: "var(--control-border-selected)",
    background: "var(--control-surface-selected)",
  },
  purposeLabel: {
    fontFamily: typography.fontUi,
    fontSize: typography.body.fontSize,
    fontWeight: 500,
    lineHeight: 1.4,
  },
  radioMark: {
    boxSizing: "border-box",
    width: 20,
    minWidth: 20,
    height: 20,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: color.border,
    borderRadius: radius.circle,
    color: color.text,
  },
  radioMarkSelected: {
    borderColor: color.textStrong,
  },
  radioMarkInner: {
    width: 10,
    height: 10,
    borderRadius: radius.circle,
    background: color.textStrong,
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
