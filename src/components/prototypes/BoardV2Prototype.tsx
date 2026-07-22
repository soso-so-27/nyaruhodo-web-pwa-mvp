"use client";

import { useEffect, useState } from "react";

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
  "e5-muted": "彩度控えめ（採用・ナビcurrent）",
  "e5-mono": "単色（ナビ用）",
};

const E_NAV_VARIANTS = [
  "e-nav-rainbow",
  "e-nav-sumi",
  "e-nav-seal",
] as const;
type ENavVariant = (typeof E_NAV_VARIANTS)[number];

const eNavLabels: Record<ENavVariant, string> = {
  "e-nav-rainbow": "虹",
  "e-nav-sumi": "墨",
  "e-nav-seal": "赤茶",
};

const eNavIconPaths: Record<ENavVariant, string> = {
  "e-nav-rainbow": "/illustrations/candidates/theme-e-nav/nav-rainbow.webp",
  "e-nav-sumi": "/illustrations/candidates/theme-e-nav/nav-sumi.webp",
  "e-nav-seal": "/illustrations/candidates/theme-e-nav/nav-seal.webp",
};

export function BoardV2Prototype() {
  const selectedVariant = useCatIllustrationVariant();
  const [selectedENavVariant, setSelectedENavVariant] =
    useState<ENavVariant | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("illust");
    setSelectedENavVariant(
      E_NAV_VARIANTS.includes(query as ENavVariant)
        ? (query as ENavVariant)
        : null,
    );
  }, []);

  function selectENavVariant(variant: ENavVariant) {
    setSelectedENavVariant(variant);
    const url = new URL(window.location.href);
    url.searchParams.set("illust", variant);
    window.history.replaceState(null, "", url);
  }

  function selectExistingVariant(variant: CatIllustrationVariant) {
    setSelectedENavVariant(null);
    setCatIllustrationVariant(variant);
  }

  return (
    <>
      {selectedENavVariant ? (
        <ThemeEHomePreview variant={selectedENavVariant} />
      ) : (
        <CollectionPage />
      )}
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
                    onClick={() => selectExistingVariant(variant)}
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
                    onClick={() => selectExistingVariant(variant)}
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
                    onClick={() => selectExistingVariant(variant)}
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
                    onClick={() => selectExistingVariant(variant)}
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
                    onClick={() => selectExistingVariant(variant)}
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
            <p style={styles.optionLabel}>E ナビ比較</p>
            <div style={styles.detailChoices}>
              {E_NAV_VARIANTS.map((variant) => {
                const isSelected = selectedENavVariant === variant;
                return (
                  <button
                    key={variant}
                    type="button"
                    data-testid={`cat-illustration-variant-${variant}`}
                    aria-label={`E ナビ ${eNavLabels[variant]}`}
                    aria-pressed={isSelected}
                    onClick={() => selectENavVariant(variant)}
                    style={{
                      ...styles.detailButton,
                      ...(isSelected ? styles.optionButtonSelected : {}),
                    }}
                  >
                    <img
                      src={eNavIconPaths[variant]}
                      alt=""
                      width={54}
                      height={54}
                      style={styles.detailPreview}
                    />
                    <span>{eNavLabels[variant]}</span>
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

function ThemeEHomePreview({ variant }: { variant: ENavVariant }) {
  const [ambient, setAmbient] = useState<"day" | "night">("day");
  const navIcon = eNavIconPaths[variant];

  return (
    <main
      data-testid="theme-e-home-preview"
      data-ambient={ambient}
      style={{
        ...styles.homePreview,
        ...(ambient === "night"
          ? styles.homePreviewNight
          : styles.homePreviewDay),
      }}
    >
      <div style={styles.ambientSwitch} aria-label="背景の時間帯">
        {(["day", "night"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={ambient === value}
            onClick={() => setAmbient(value)}
            style={{
              ...styles.ambientButton,
              ...(ambient === value ? styles.ambientButtonSelected : {}),
            }}
          >
            {value === "day" ? "昼" : "夜"}
          </button>
        ))}
      </div>
      <section style={styles.homePreviewStage}>
        <p style={styles.homePreviewDate}>7月12日</p>
        <img
          src="/illustrations/candidates/theme-e-nav/home-empty-cat.png"
          alt="眠っている虹色のねこ"
          width={152}
          height={152}
          style={styles.homePreviewCat}
        />
        <button type="button" style={styles.homePreviewCapture}>
          ねがおを とる
        </button>
        <p style={styles.homePreviewPromise}>
          きょうの一枚を、よる8時のねこだよりに。
        </p>
      </section>
      <nav style={styles.previewNav} aria-label="比較用ナビゲーション">
        <PreviewNavItem label="きょう" src={navIcon} active />
        <PreviewNavItem
          label="ねこだより"
          src="/icons/bottom-nav-mainichi.webp"
        />
        <PreviewNavItem label="うちのこ" src={navIcon} />
      </nav>
    </main>
  );
}

function PreviewNavItem({
  label,
  src,
  active = false,
}: {
  label: string;
  src: string;
  active?: boolean;
}) {
  return (
    <div
      data-testid={`theme-e-preview-nav-${label}`}
      style={{
        ...styles.previewNavItem,
        ...(active ? styles.previewNavItemActive : {}),
      }}
    >
      <img src={src} alt="" width={44} height={44} style={styles.previewNavIcon} />
      <span>{label}</span>
    </div>
  );
}

const styles = {
  homePreview: {
    minHeight: "100svh",
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
    justifyItems: "center",
    padding:
      "calc(12px + env(safe-area-inset-top)) 16px calc(14px + env(safe-area-inset-bottom))",
    color: "var(--ink)",
    transition: "background 220ms ease, color 220ms ease",
  },
  homePreviewDay: {
    background:
      "radial-gradient(circle at 76% 18%, rgba(255,229,199,0.52), transparent 38%), linear-gradient(180deg, #fbf7ed 0%, #f4ecdf 100%)",
  },
  homePreviewNight: {
    background:
      "radial-gradient(circle at 24% 16%, rgba(179,153,191,0.2), transparent 42%), linear-gradient(180deg, #5d5767 0%, #3f3b49 100%)",
    color: "#f4eee4",
  },
  ambientSwitch: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "2px",
    padding: "2px",
    borderRadius: "999px",
    background: "color-mix(in srgb, var(--paper-card) 76%, transparent)",
  },
  ambientButton: {
    minWidth: "52px",
    minHeight: "32px",
    border: 0,
    borderRadius: "999px",
    background: "transparent",
    color: "inherit",
    font: "inherit",
  },
  ambientButtonSelected: {
    background: "color-mix(in srgb, var(--paper-card) 94%, transparent)",
    color: "var(--ink)",
  },
  homePreviewStage: {
    alignSelf: "center",
    display: "grid",
    justifyItems: "center",
    gap: "12px",
    width: "min(100%, 390px)",
  },
  homePreviewDate: {
    margin: 0,
    fontSize: "13px",
    opacity: 0.72,
  },
  homePreviewCat: {
    width: "152px",
    height: "152px",
    objectFit: "contain" as const,
  },
  homePreviewCapture: {
    minWidth: "176px",
    minHeight: "48px",
    border: "1px solid color-mix(in srgb, var(--seal) 32%, transparent)",
    borderRadius: "999px",
    background: "var(--seal)",
    color: "white",
    fontFamily: "var(--font-ui)",
    fontSize: "15px",
    fontWeight: 600,
  },
  homePreviewPromise: {
    margin: 0,
    fontSize: "12px",
    opacity: 0.7,
  },
  previewNav: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "4px",
    width: "min(calc(100% - 16px), 410px)",
    minHeight: "68px",
    padding: "4px",
    overflow: "hidden",
    border: "1px solid color-mix(in srgb, var(--control-border) 92%, transparent)",
    borderRadius: "999px",
    background: "color-mix(in srgb, var(--paper) 86%, transparent)",
    boxShadow: "0 14px 34px -22px rgba(70, 50, 30, 0.24)",
    color: "var(--ink)",
  },
  previewNavItem: {
    minWidth: 0,
    display: "grid",
    placeItems: "center",
    alignContent: "center",
    gap: 0,
    borderRadius: "999px",
    fontFamily: "var(--font-ui)",
    fontSize: "10px",
  },
  previewNavItemActive: {
    background: "color-mix(in srgb, var(--paper-card) 82%, transparent)",
  },
  previewNavIcon: {
    width: "44px",
    height: "44px",
    objectFit: "contain" as const,
  },
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
