import {
  getStoragePhotoPath,
  isUsablePhotoSrc,
  type StorageSignedUrlVariant,
} from "./photoStorage";

export type PhotoSourceContext = "list" | "board" | "cover" | "detail";

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
  cover: {
    fit: "cover",
    source: "display",
    storageVariant: "display",
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
};

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
