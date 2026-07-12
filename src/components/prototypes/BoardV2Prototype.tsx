"use client";

import { useState } from "react";

import {
  CAT_ILLUSTRATION_B_DETAIL_VARIANTS,
  CAT_ILLUSTRATION_D_SILHOUETTE_VARIANTS,
  CAT_ILLUSTRATION_E_SPLASH_PALETTE_VARIANTS,
  CAT_ILLUSTRATION_E5_DIRECTION_VARIANTS,
  CAT_ILLUSTRATION_PRIMARY_VARIANTS,
  getCatIllustrationAssets,
  setCatIllustrationVariant,
  useCatIllustrationVariant,
  type CatIllustrationVariant,
} from "../../lib/assets/catIllustrationAssets";
import { CollectionPage } from "../collection/CollectionPage";
import { AppBottomSheet } from "../ui/AppBottomSheet";
import { SettingsIcon } from "../ui/AppIcons";

const variantLabels: Record<CatIllustrationVariant, string> = {
  current: "current",
  "theme-a": "A 水彩",
  "theme-b": "B 線画・判子",
  "theme-c": "C 色鉛筆",
  b1: "b1",
  b2: "b2",
  b3: "b3",
  b4: "b4",
  b5: "b5",
  b6: "b6",
  b7: "b7",
  b8: "b8",
  b9: "b9",
  b10: "b10",
  "b3-ink": "b3 墨色連動",
  d1: "d1",
  d2: "d2",
  d3: "d3",
  d4: "d4",
  d5: "d5",
  d6: "d6",
  d7: "d7",
  d8: "d8",
  d9: "d9",
  d10: "d10",
  "d1-ink": "d1 墨色連動",
  e1: "e1",
  e2: "e2",
  e3: "e3",
  e4: "e4",
  e5: "e5",
  e6: "e6",
  e7: "e7",
  e8: "e8",
  "e5-original": "原案",
  "e5-muted": "彩度控えめ",
  "e5-mono": "単色（ナビ用）",
};

export function BoardV2Prototype() {
  const selectedVariant = useCatIllustrationVariant();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  return (
    <>
      <CollectionPage />
      <button
        type="button"
        aria-label="プロトタイプの設定"
        data-testid="board-v2-settings-button"
        onClick={() => setIsSheetOpen(true)}
        style={styles.settingsButton}
      >
        <SettingsIcon size={21} />
      </button>
      {isSheetOpen ? (
        <AppBottomSheet
          title="表示の比較"
          onClose={() => setIsSheetOpen(false)}
          style={styles.sheet}
        >
          <section style={styles.optionGroup} aria-label="イラストのテーマ">
            <p style={styles.optionLabel}>イラスト</p>
            <div style={styles.optionChoices}>
              {CAT_ILLUSTRATION_PRIMARY_VARIANTS.map((variant) => {
                const isSelected = selectedVariant === variant;
                const assets = getCatIllustrationAssets(variant);
                return (
                  <button
                    key={variant}
                    type="button"
                    data-testid={`cat-illustration-variant-${variant}`}
                    aria-pressed={isSelected}
                    onClick={() => setCatIllustrationVariant(variant)}
                    style={{
                      ...styles.optionButton,
                      ...(isSelected ? styles.optionButtonSelected : {}),
                    }}
                  >
                    <img
                      src={assets.uchinokoNavIcon}
                      alt=""
                      width={32}
                      height={32}
                      style={styles.optionPreview}
                    />
                    <span>{variantLabels[variant]}</span>
                  </button>
                );
              })}
            </div>
            <p style={styles.optionLabel}>B詳細</p>
            <div style={styles.detailChoices}>
              {CAT_ILLUSTRATION_B_DETAIL_VARIANTS.map((variant) => {
                const isSelected = selectedVariant === variant;
                const assets = getCatIllustrationAssets(variant);
                return (
                  <button
                    key={variant}
                    type="button"
                    data-testid={`cat-illustration-variant-${variant}`}
                    aria-label={`B詳細 ${variantLabels[variant]}`}
                    aria-pressed={isSelected}
                    onClick={() => setCatIllustrationVariant(variant)}
                    style={{
                      ...styles.detailButton,
                      ...(isSelected ? styles.optionButtonSelected : {}),
                    }}
                  >
                    <img
                      src={assets.homeEmptyCat}
                      alt=""
                      width={54}
                      height={54}
                      style={styles.detailPreview}
                    />
                    <span>{variantLabels[variant]}</span>
                  </button>
                );
              })}
            </div>
            <p style={styles.optionLabel}>D シルエット</p>
            <div style={styles.detailChoices}>
              {CAT_ILLUSTRATION_D_SILHOUETTE_VARIANTS.map((variant) => {
                const isSelected = selectedVariant === variant;
                const assets = getCatIllustrationAssets(variant);
                return (
                  <button
                    key={variant}
                    type="button"
                    data-testid={`cat-illustration-variant-${variant}`}
                    aria-label={`Dシルエット ${variantLabels[variant]}`}
                    aria-pressed={isSelected}
                    onClick={() => setCatIllustrationVariant(variant)}
                    style={{
                      ...styles.detailButton,
                      ...(isSelected ? styles.optionButtonSelected : {}),
                    }}
                  >
                    <img
                      src={assets.homeEmptyCat}
                      alt=""
                      width={54}
                      height={54}
                      style={styles.detailPreview}
                    />
                    <span>{variantLabels[variant]}</span>
                  </button>
                );
              })}
            </div>
            <p style={styles.optionLabel}>E 起動画面パレット</p>
            <div style={styles.detailChoices}>
              {CAT_ILLUSTRATION_E_SPLASH_PALETTE_VARIANTS.map((variant) => {
                const isSelected = selectedVariant === variant;
                const assets = getCatIllustrationAssets(variant);
                return (
                  <button
                    key={variant}
                    type="button"
                    data-testid={`cat-illustration-variant-${variant}`}
                    aria-label={`E 起動画面パレット ${variantLabels[variant]}`}
                    aria-pressed={isSelected}
                    onClick={() => setCatIllustrationVariant(variant)}
                    style={{
                      ...styles.detailButton,
                      ...(isSelected ? styles.optionButtonSelected : {}),
                    }}
                  >
                    <img
                      src={assets.homeEmptyCat}
                      alt=""
                      width={54}
                      height={54}
                      style={styles.detailPreview}
                    />
                    <span>{variantLabels[variant]}</span>
                  </button>
                );
              })}
            </div>
            <p style={styles.optionLabel}>E5 方針比較</p>
            <div style={styles.detailChoices}>
              {CAT_ILLUSTRATION_E5_DIRECTION_VARIANTS.map((variant) => {
                const isSelected = selectedVariant === variant;
                const assets = getCatIllustrationAssets(variant);
                return (
                  <button
                    key={variant}
                    type="button"
                    data-testid={`cat-illustration-variant-${variant}`}
                    aria-label={`E5 方針比較 ${variantLabels[variant]}`}
                    aria-pressed={isSelected}
                    onClick={() => setCatIllustrationVariant(variant)}
                    style={{
                      ...styles.detailButton,
                      ...(isSelected ? styles.optionButtonSelected : {}),
                    }}
                  >
                    <img
                      src={assets.homeEmptyCat}
                      alt=""
                      width={54}
                      height={54}
                      style={styles.detailPreview}
                    />
                    <span>{variantLabels[variant]}</span>
                  </button>
                );
              })}
            </div>
            <p style={styles.optionHint}>
              選択はこの端末に残ります。通常画面でも同じ候補が表示されます。
            </p>
          </section>
        </AppBottomSheet>
      ) : null}
    </>
  );
}

const styles = {
  settingsButton: {
    position: "fixed" as const,
    zIndex: 45,
    right: "16px",
    bottom: "calc(env(safe-area-inset-bottom, 0px) + 82px)",
    width: "44px",
    height: "44px",
    display: "grid",
    placeItems: "center",
    border: "1px solid color-mix(in srgb, var(--line) 78%, transparent)",
    borderRadius: "50%",
    background: "color-mix(in srgb, var(--paper-card) 92%, transparent)",
    color: "var(--ink-soft)",
    boxShadow: "0 8px 18px rgba(70, 50, 34, 0.16)",
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  sheet: {
    zIndex: 70,
  },
  optionGroup: {
    display: "grid",
    gap: "10px",
    padding: "4px 0 12px",
  },
  optionLabel: {
    margin: 0,
    color: "var(--ink-soft)",
    fontFamily: "var(--font-ui)",
    fontSize: "12px",
    fontWeight: 500,
    letterSpacing: 0,
  },
  optionChoices: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
  },
  detailChoices: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "7px",
  },
  optionButton: {
    minHeight: "54px",
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "8px",
    border: "1px solid color-mix(in srgb, var(--line) 74%, transparent)",
    borderRadius: "8px",
    background: "color-mix(in srgb, var(--paper-card) 72%, transparent)",
    color: "var(--ink-soft)",
    padding: "7px 10px",
    fontFamily: "var(--font-ui)",
    fontSize: "12px",
    fontWeight: 500,
    letterSpacing: 0,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  optionButtonSelected: {
    border: "1px solid color-mix(in srgb, var(--seal) 58%, var(--line) 42%)",
    background: "color-mix(in srgb, var(--seal) 10%, var(--paper-card) 90%)",
    color: "color-mix(in srgb, var(--seal) 76%, var(--ink) 24%)",
  },
  detailButton: {
    minHeight: "78px",
    display: "grid",
    placeItems: "center",
    gap: "2px",
    border: "1px solid color-mix(in srgb, var(--line) 74%, transparent)",
    borderRadius: "8px",
    background: "color-mix(in srgb, var(--paper-card) 72%, transparent)",
    color: "var(--ink-soft)",
    padding: "5px",
    fontFamily: "var(--font-ui)",
    fontSize: "10px",
    fontWeight: 500,
    letterSpacing: 0,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  detailPreview: {
    width: "54px",
    height: "54px",
    objectFit: "contain" as const,
  },
  optionPreview: {
    width: "32px",
    height: "32px",
    flex: "0 0 32px",
    objectFit: "contain" as const,
  },
  optionHint: {
    margin: 0,
    color: "var(--ink-faint)",
    fontFamily: "var(--font-ui)",
    fontSize: "11px",
    lineHeight: 1.7,
    letterSpacing: 0,
  },
};
