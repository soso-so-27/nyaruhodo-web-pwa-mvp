"use client";

import { useEffect, useState } from "react";

import { CollectionPage } from "../collection/CollectionPage";
import { AppBottomSheet } from "../ui/AppBottomSheet";
import { SettingsIcon } from "../ui/AppIcons";
import {
  DEFAULT_BOARD_V2_PROTOTYPE_OPTIONS,
  readBoardV2PrototypeOptions,
  type BoardV2PrototypeOptions,
} from "../../lib/collection/boardV2Prototype";

const BOARD_V2_OPTIONS_STORAGE_KEY = "neteruneko_board_v2_prototype_options";

const optionGroups = [
  {
    key: "mode",
    label: "アルゴリズム",
    options: [
      { value: "v2", label: "v2" },
      { value: "current", label: "現行" },
    ],
  },
  {
    key: "layout",
    label: "写真の見せ方",
    options: [
      { value: "crop", label: "crop型" },
      { value: "natural", label: "原寸型" },
    ],
  },
  {
    key: "frame",
    label: "フチ",
    options: [
      { value: "f1", label: "f1 現行" },
      { value: "f2", label: "f2 細フチ" },
      { value: "f3", label: "f3 ほぼなし" },
    ],
  },
  {
    key: "order",
    label: "並び",
    options: [
      { value: "newest", label: "新しい順" },
      { value: "brightest", label: "明るい順" },
    ],
  },
] as const;

export function BoardV2Prototype({
  options = DEFAULT_BOARD_V2_PROTOTYPE_OPTIONS,
}: {
  options?: BoardV2PrototypeOptions;
}) {
  const [selectedOptions, setSelectedOptions] = useState(options);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hasExplicitQuery = optionGroups.some(({ key }) => searchParams.has(key));

    if (!hasExplicitQuery) {
      try {
        const stored = window.localStorage.getItem(BOARD_V2_OPTIONS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as Record<string, unknown>;
          setSelectedOptions(
            readBoardV2PrototypeOptions({
              mode: typeof parsed.mode === "string" ? parsed.mode : undefined,
              layout: typeof parsed.layout === "string" ? parsed.layout : undefined,
              frame: typeof parsed.frame === "string" ? parsed.frame : undefined,
              order: typeof parsed.order === "string" ? parsed.order : undefined,
            }),
          );
        }
      } catch {
        // A prototype preference must never prevent the comparison screen opening.
      }
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        BOARD_V2_OPTIONS_STORAGE_KEY,
        JSON.stringify(selectedOptions),
      );
    } catch {
      // Keep the in-memory selection when storage is unavailable.
    }

    const url = new URL(window.location.href);
    url.searchParams.set("mode", selectedOptions.mode);
    url.searchParams.set("layout", selectedOptions.layout);
    url.searchParams.set("frame", selectedOptions.frame);
    url.searchParams.set("order", selectedOptions.order);
    window.history.replaceState(null, "", url);
  }, [selectedOptions]);

  const updateOption = <Key extends keyof BoardV2PrototypeOptions>(
    key: Key,
    value: BoardV2PrototypeOptions[Key],
  ) => {
    setSelectedOptions((current) => ({ ...current, [key]: value }));
  };

  return (
    <>
      <CollectionPage boardV2Prototype={selectedOptions} />
      <button
        type="button"
        aria-label="ボード表示の設定"
        data-testid="board-v2-settings-button"
        onClick={() => setIsSheetOpen(true)}
        style={styles.settingsButton}
      >
        <SettingsIcon size={21} />
      </button>
      {isSheetOpen ? (
        <AppBottomSheet
          title="ボードの比較"
          onClose={() => setIsSheetOpen(false)}
          style={styles.sheet}
        >
          <div style={styles.sheetBody}>
            {optionGroups.map((group) => (
              <section key={group.key} style={styles.optionGroup}>
                <p style={styles.optionLabel}>{group.label}</p>
                <div style={styles.optionChoices}>
                  {group.options.map((option) => {
                    const isSelected = selectedOptions[group.key] === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        data-testid={`board-v2-option-${group.key}-${option.value}`}
                        aria-pressed={isSelected}
                        onClick={() =>
                          updateOption(
                            group.key,
                            option.value as BoardV2PrototypeOptions[typeof group.key],
                          )
                        }
                        style={{
                          ...styles.optionButton,
                          ...(isSelected ? styles.optionButtonSelected : {}),
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
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
  sheetBody: {
    display: "grid",
    gap: "18px",
    padding: "4px 0 12px",
  },
  optionGroup: {
    display: "grid",
    gap: "8px",
  },
  optionLabel: {
    margin: 0,
    color: "var(--ink-soft)",
    fontFamily: "var(--font-ui)",
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "0.08em",
  },
  optionChoices: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "7px",
  },
  optionButton: {
    minHeight: "40px",
    border: "1px solid color-mix(in srgb, var(--line) 74%, transparent)",
    borderRadius: "var(--radius-full)",
    background: "color-mix(in srgb, var(--paper-card) 72%, transparent)",
    color: "var(--ink-soft)",
    padding: "0 13px",
    fontFamily: "var(--font-ui)",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    WebkitTapHighlightColor: "transparent",
  },
  optionButtonSelected: {
    borderColor: "color-mix(in srgb, var(--seal) 58%, var(--line) 42%)",
    background: "color-mix(in srgb, var(--seal) 14%, var(--paper-card) 86%)",
    color: "color-mix(in srgb, var(--seal) 76%, var(--ink) 24%)",
  },
};
