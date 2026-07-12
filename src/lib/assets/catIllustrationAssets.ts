"use client";

import { useEffect, useSyncExternalStore } from "react";

export type CatIllustrationVariant =
  | "current"
  | "theme-a"
  | "theme-b"
  | "theme-c"
  | BDetailVariant
  | DSilhouetteVariant
  | ESplashPaletteVariant
  | E5DirectionVariant;

export type BDetailVariant =
  | "b1"
  | "b2"
  | "b3"
  | "b4"
  | "b5"
  | "b6"
  | "b7"
  | "b8"
  | "b9"
  | "b10"
  | "b3-ink";

export type DSilhouetteVariant =
  | "d1"
  | "d2"
  | "d3"
  | "d4"
  | "d5"
  | "d6"
  | "d7"
  | "d8"
  | "d9"
  | "d10"
  | "d1-ink";

export type ESplashPaletteVariant =
  | "e1"
  | "e2"
  | "e3"
  | "e4"
  | "e5"
  | "e6"
  | "e7"
  | "e8";

export type E5DirectionVariant =
  | "e5-original"
  | "e5-muted"
  | "e5-mono";

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
  "b1",
  "b2",
  "b3",
  "b4",
  "b5",
  "b6",
  "b7",
  "b8",
  "b9",
  "b10",
  "b3-ink",
  "d1",
  "d2",
  "d3",
  "d4",
  "d5",
  "d6",
  "d7",
  "d8",
  "d9",
  "d10",
  "d1-ink",
  "e1",
  "e2",
  "e3",
  "e4",
  "e5",
  "e6",
  "e7",
  "e8",
  "e5-original",
  "e5-muted",
  "e5-mono",
];

export const CAT_ILLUSTRATION_PRIMARY_VARIANTS = [
  "current",
  "theme-a",
  "theme-b",
  "theme-c",
] as const;

export const CAT_ILLUSTRATION_B_DETAIL_VARIANTS = [
  "b1",
  "b2",
  "b3",
  "b4",
  "b5",
  "b6",
  "b7",
  "b8",
  "b9",
  "b10",
  "b3-ink",
] as const satisfies readonly BDetailVariant[];

export const CAT_ILLUSTRATION_D_SILHOUETTE_VARIANTS = [
  "d1",
  "d2",
  "d3",
  "d4",
  "d5",
  "d6",
  "d7",
  "d8",
  "d9",
  "d10",
  "d1-ink",
] as const satisfies readonly DSilhouetteVariant[];

export const CAT_ILLUSTRATION_E_SPLASH_PALETTE_VARIANTS = [
  "e1",
  "e2",
  "e3",
  "e4",
  "e5",
  "e6",
  "e7",
  "e8",
] as const satisfies readonly ESplashPaletteVariant[];

export const CAT_ILLUSTRATION_E5_DIRECTION_VARIANTS = [
  "e5-original",
  "e5-muted",
  "e5-mono",
] as const satisfies readonly E5DirectionVariant[];

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

  if (variant.startsWith("b")) {
    const homeFilename = variant === "b3-ink" ? "b3-ink.svg" : `${variant}.webp`;
    return {
      homeEmptyCat: `/illustrations/candidates/theme-b-variants/${homeFilename}`,
      todayNavIcon: "/illustrations/candidates/theme-b/nav-today.webp",
      uchinokoNavIcon: "/illustrations/candidates/theme-b/nav-uchinoko.webp",
      catSwitcherIcon: "/illustrations/candidates/theme-b/cat-switcher.webp",
      deliveryFallback: CURRENT_CAT_ILLUSTRATION_ASSETS.deliveryFallback,
    };
  }

  if (variant.startsWith("d")) {
    const homeFilename = variant === "d1-ink" ? "d1-ink.svg" : `${variant}.webp`;
    return {
      homeEmptyCat: `/illustrations/candidates/theme-d-silhouette/${homeFilename}`,
      todayNavIcon: "/illustrations/candidates/theme-b/nav-today.webp",
      uchinokoNavIcon: "/illustrations/candidates/theme-b/nav-uchinoko.webp",
      catSwitcherIcon: "/illustrations/candidates/theme-b/cat-switcher.webp",
      deliveryFallback: CURRENT_CAT_ILLUSTRATION_ASSETS.deliveryFallback,
    };
  }

  if (variant.startsWith("e")) {
    if (variant.startsWith("e5-")) {
      const navigationAssets =
        variant === "e5-muted"
          ? CURRENT_CAT_ILLUSTRATION_ASSETS
          : {
              todayNavIcon: "/illustrations/candidates/theme-b/nav-today.webp",
              uchinokoNavIcon:
                "/illustrations/candidates/theme-b/nav-uchinoko.webp",
              catSwitcherIcon:
                "/illustrations/candidates/theme-b/cat-switcher.webp",
            };
      return {
        homeEmptyCat: `/illustrations/candidates/theme-e5-direction/${variant.slice(3)}.webp`,
        todayNavIcon: navigationAssets.todayNavIcon,
        uchinokoNavIcon: navigationAssets.uchinokoNavIcon,
        catSwitcherIcon: navigationAssets.catSwitcherIcon,
        deliveryFallback: CURRENT_CAT_ILLUSTRATION_ASSETS.deliveryFallback,
      };
    }
    return {
      homeEmptyCat: `/illustrations/candidates/theme-e-splash-palette/${variant}.webp`,
      todayNavIcon: "/illustrations/candidates/theme-b/nav-today.webp",
      uchinokoNavIcon: "/illustrations/candidates/theme-b/nav-uchinoko.webp",
      catSwitcherIcon: "/illustrations/candidates/theme-b/cat-switcher.webp",
      deliveryFallback: CURRENT_CAT_ILLUSTRATION_ASSETS.deliveryFallback,
    };
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
