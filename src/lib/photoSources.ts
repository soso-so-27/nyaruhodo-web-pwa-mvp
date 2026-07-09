import {
  getStoragePhotoPath,
  isUsablePhotoSrc,
  type StorageSignedUrlVariant,
} from "./photoStorage";

export type PhotoSourceContext = "list" | "large" | "cover" | "detail";

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

  if (context === "large") {
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

function firstUsablePhotoSrc(sources: Array<string | undefined>) {
  return sources.find((source) => source && isUsablePhotoSrc(source));
}

function uniquePhotoSources(sources: Array<string | undefined>) {
  return Array.from(
    new Set(sources.filter((source): source is string => Boolean(source))),
  ).filter(isUsablePhotoSrc);
}
