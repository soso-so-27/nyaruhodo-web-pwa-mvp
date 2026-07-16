import {
  getStoragePhotoPath,
  isUsablePhotoSrc,
  normalizePersistentPhotoSrc,
  type StorageSignedUrlVariant,
} from "./photoStorage";

export type PhotoSourceContext = "list" | "board" | "hero" | "cover" | "detail";

export const PHOTO_DISPLAY_CONTRACT = {
  list: {
    fit: "cover",
    source: "thumbnail",
    storageVariant: "thumbnail",
    usage: "square tiles",
  },
  board: {
    fit: "cover",
    source: "display",
    storageVariant: "thumbnail",
    usage: "nekodayori board cards",
  },
  hero: {
    fit: "contain",
    source: "display",
    storageVariant: "hero",
    usage: "large home photo",
  },
  cover: {
    fit: "cover",
    source: "display",
    storageVariant: "hero",
    usage: "cat profile cover",
  },
  detail: {
    fit: "contain",
    source: "display",
    storageVariant: "display",
    usage: "full/detail viewer",
  },
} as const;

export type PhotoSourceSet = {
  src: string;
  thumbnailSrc?: string;
  displaySrc?: string;
  originalSrc?: string;
  offlineSrc?: string;
};

export function getPhotoContentIdentityKeys(photo: PhotoSourceSet) {
  const keys = new Set<string>();

  for (const source of [
    photo.src,
    photo.thumbnailSrc,
    photo.displaySrc,
    photo.originalSrc,
    photo.offlineSrc,
  ]) {
    if (!source) {
      continue;
    }

    const normalized = normalizePersistentPhotoSrc(source);
    if (!normalized) {
      continue;
    }

    const storagePath = getStoragePhotoPath(normalized);
    if (storagePath) {
      keys.add(`content-storage:${storagePath}`);

      const onboardingSourcePath = getOnboardingSourcePath(storagePath);
      if (onboardingSourcePath) {
        keys.add(`content-onboarding:${onboardingSourcePath}`);
      }
      continue;
    }

    if (normalized.startsWith("data:image/")) {
      keys.add(`content-data:${normalized}`);
    }
  }

  return [...keys];
}

export function resolvePhotoSrc(
  photo: PhotoSourceSet,
  context: PhotoSourceContext,
) {
  const orderedSources =
    context === "list"
      ? [photo.thumbnailSrc, photo.displaySrc, photo.originalSrc, photo.src]
      : [photo.displaySrc, photo.originalSrc, photo.thumbnailSrc, photo.src];

  return firstUsablePhotoSrc(orderedSources) ?? photo.src;
}

export function resolvePhotoStorageVariant(
  photo: PhotoSourceSet,
  context: PhotoSourceContext,
): StorageSignedUrlVariant {
  const resolvedSrc = resolvePhotoSrc(photo, context);

  if (!getStoragePhotoPath(resolvedSrc)) {
    return "display";
  }

  if (context === "board") {
    // Board cards should sign the larger display/original asset with the
    // thumbnail transform. This shrinks a large source to width=800 instead of
    // upscaling a saved 512px thumbnail asset.
    return "thumbnail";
  }

  if (context === "hero" || context === "cover") {
    return "hero";
  }

  if (context !== "list") {
    return "display";
  }

  const thumbnailSrc = firstUsablePhotoSrc([photo.thumbnailSrc]);
  const largeSrc = firstUsablePhotoSrc([photo.displaySrc, photo.originalSrc, photo.src]);

  // Transform only large/original storage assets. Saved thumbnail assets are
  // already small and should not be upscaled by the image transformation API.
  return thumbnailSrc && thumbnailSrc !== largeSrc ? "display" : "thumbnail";
}

export function resolvePhotoFallbackSrcs(photo: PhotoSourceSet) {
  return uniquePhotoSources([
    photo.displaySrc,
    photo.thumbnailSrc,
    photo.originalSrc,
    photo.src,
    photo.offlineSrc,
  ]);
}

export function completePhotoSourceSet<T extends PhotoSourceSet>(
  photo: T,
): T & Required<Pick<PhotoSourceSet, "thumbnailSrc" | "displaySrc" | "originalSrc">> {
  const fallbackSrc = resolvePhotoSrc(photo, "detail");

  return {
    ...photo,
    thumbnailSrc: photo.thumbnailSrc ?? fallbackSrc,
    displaySrc: photo.displaySrc ?? fallbackSrc,
    originalSrc: photo.originalSrc ?? fallbackSrc,
  };
}

function firstUsablePhotoSrc(sources: Array<string | undefined>) {
  return sources.find((source) => source && isUsablePhotoSrc(source));
}

function uniquePhotoSources(sources: Array<string | undefined>) {
  return Array.from(
    new Set(sources.filter((source): source is string => Boolean(source))),
  ).filter(isUsablePhotoSrc);
}

function getOnboardingSourcePath(storagePath: string) {
  const match = storagePath.match(
    /^(.*\/onboarding\/[^/]+)\/(?:display|thumbnail)\/([^/]+)$/,
  );

  return match ? `${match[1]}/${match[2]}` : null;
}
