"use client";

import { useEffect, useSyncExternalStore } from "react";

export type CatIllustrationVariant =
  | "current"
  | "theme-a"
  | "theme-b"
  | "theme-c";

export type CatIllustrationAssetKey =
  | "homeEmptyCat"
  | "todayNavIcon"
  | "uchinokoNavIcon"
  | "catSwitcherIcon"
  | "deliveryFallback";

export type CatIllustrationAssets = Record<CatIllustrationAssetKey, string>;

export const CAT_ILLUSTRATION_STORAGE_KEY =
  "neteruneko_cat_illustration_variant";
export const CAT_ILLUSTRATION_VARIANTS: readonly CatIllustrationVariant[] = [
  "current",
  "theme-a",
  "theme-b",
  "theme-c",
];

const VARIANT_CHANGE_EVENT = "neteruneko_cat_illustration_variant_changed";

export const CURRENT_CAT_ILLUSTRATION_ASSETS: CatIllustrationAssets = {
  homeEmptyCat: "/illustrations/sleeping-cat-empty.webp",
  todayNavIcon: "/icons/bottom-nav-today.webp",
  uchinokoNavIcon: "/icons/bottom-nav-uchinoko.webp",
  catSwitcherIcon: "/icons/cat-switch-generated.webp",
  deliveryFallback: "/illustrations/sleeping-cat-empty.webp",
};

const CANDIDATE_FILENAMES = {
  homeEmptyCat: "home-empty-cat.webp",
  todayNavIcon: "nav-today.webp",
  uchinokoNavIcon: "nav-uchinoko.webp",
  catSwitcherIcon: "cat-switcher.webp",
} as const;

export function isCatIllustrationVariant(
  value: unknown,
): value is CatIllustrationVariant {
  return CAT_ILLUSTRATION_VARIANTS.includes(
    value as CatIllustrationVariant,
  );
}

export function getCatIllustrationAssets(
  variant: CatIllustrationVariant,
): CatIllustrationAssets {
  if (variant === "current") {
    return CURRENT_CAT_ILLUSTRATION_ASSETS;
  }

  const base = `/illustrations/candidates/${variant}`;
  return {
    homeEmptyCat: `${base}/${CANDIDATE_FILENAMES.homeEmptyCat}`,
    todayNavIcon: `${base}/${CANDIDATE_FILENAMES.todayNavIcon}`,
    uchinokoNavIcon: `${base}/${CANDIDATE_FILENAMES.uchinokoNavIcon}`,
    catSwitcherIcon: `${base}/${CANDIDATE_FILENAMES.catSwitcherIcon}`,
    deliveryFallback: CURRENT_CAT_ILLUSTRATION_ASSETS.deliveryFallback,
  };
}

export function readCatIllustrationVariant(): CatIllustrationVariant {
  if (typeof window === "undefined") return "current";

  const queryVariant = new URLSearchParams(window.location.search).get("illust");
  if (isCatIllustrationVariant(queryVariant)) return queryVariant;

  try {
    const stored = window.localStorage.getItem(CAT_ILLUSTRATION_STORAGE_KEY);
    return isCatIllustrationVariant(stored) ? stored : "current";
  } catch {
    return "current";
  }
}

export function setCatIllustrationVariant(
  variant: CatIllustrationVariant,
  options: { updateUrl?: boolean } = {},
) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(CAT_ILLUSTRATION_STORAGE_KEY, variant);
  } catch {
    // The in-page event still applies the prototype choice for this session.
  }

  if (options.updateUrl !== false) {
    const url = new URL(window.location.href);
    url.searchParams.set("illust", variant);
    window.history.replaceState(null, "", url);
  }

  window.dispatchEvent(new Event(VARIANT_CHANGE_EVENT));
}

function subscribeToVariant(onStoreChange: () => void) {
  window.addEventListener(VARIANT_CHANGE_EVENT, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("popstate", onStoreChange);
  return () => {
    window.removeEventListener(VARIANT_CHANGE_EVENT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("popstate", onStoreChange);
  };
}

export function useCatIllustrationVariant() {
  const variant = useSyncExternalStore(
    subscribeToVariant,
    readCatIllustrationVariant,
    () => "current" as const,
  );

  useEffect(() => {
    const queryVariant = new URLSearchParams(window.location.search).get("illust");
    if (isCatIllustrationVariant(queryVariant)) {
      setCatIllustrationVariant(queryVariant, { updateUrl: false });
    }
  }, []);

  return variant;
}

export function useCatIllustrationAssets() {
  return getCatIllustrationAssets(useCatIllustrationVariant());
}

export function fallBackCatIllustrationImage(
  image: HTMLImageElement,
  key: CatIllustrationAssetKey,
) {
  const fallback = CURRENT_CAT_ILLUSTRATION_ASSETS[key];
  if (image.src.endsWith(fallback)) return;
  image.src = fallback;
}
