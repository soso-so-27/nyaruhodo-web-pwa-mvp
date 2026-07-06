"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
} from "react";

import {
  DISPLAY_SIGNED_URL_SECONDS,
  getStoragePhotoPath,
  type StorageSignedUrlVariant,
} from "../../lib/photoStorage";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import { STORAGE_KEYS } from "../../lib/storage";
import { createBrowserSupabaseClient } from "../../lib/supabase/browser";
import { color, radius, shadow, typography } from "./designTokens";

const signedUrlCache = new Map<string, { expiresAt: number; url: string }>();
const signedUrlPromiseCache = new Map<string, Promise<string | null>>();
const SIGNED_URL_CACHE_REFRESH_RATIO = 0.8;
const EMPTY_FALLBACK_SRCS: string[] = [];

const fallbackFrameStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  background:
    "linear-gradient(180deg, rgba(255,253,248,0.92), rgba(247,241,231,0.72))",
  boxShadow: shadow.soft,
};

const developOverlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  background:
    "linear-gradient(180deg, rgba(251,250,247,0.72), rgba(244,241,234,0.52))",
  transition: "opacity 220ms var(--ease-gentle)",
};

const fallbackOverlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
};

const fallbackTextStyle: CSSProperties = {
  maxWidth: "80%",
  color: color.textMuted,
  fontFamily: typography.fontSans,
  fontSize: typography.caption.fontSize,
  fontWeight: typography.caption.fontWeight,
  letterSpacing: 0,
  lineHeight: typography.caption.lineHeight,
  textAlign: "center",
};

const fallbackHelpStyle: CSSProperties = {
  display: "block",
  marginTop: 4,
  color: color.textFaint,
  fontSize: 12,
  fontWeight: 500,
};

const quietFallbackMarkStyle: CSSProperties = {
  width: "34%",
  maxWidth: 34,
  aspectRatio: "1 / 1",
  borderRadius: "999px",
  background:
    "radial-gradient(circle at 35% 32%, rgba(255,255,255,0.66), transparent 34%), color-mix(in srgb, var(--paper-card, #fffaf2) 72%, rgba(190, 164, 134, 0.26))",
  opacity: 0.58,
};

const imageSelectionLockStyle = {
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitUserDrag: "none",
} as CSSProperties;

export function StoredPhotoImage({
  src,
  alt,
  style,
  imageStyle,
  loading,
  decoding,
  fetchPriority,
  width,
  height,
  onStorageDataUrl,
  onNaturalSize,
  onLoad,
  onError,
  fallbackSrcs = EMPTY_FALLBACK_SRCS,
  fallbackVariant = "message",
  storageVariant = "display",
}: {
  src: string;
  alt: string;
  style?: CSSProperties;
  imageStyle?: CSSProperties;
  loading?: "eager" | "lazy";
  decoding?: "async" | "sync" | "auto";
  fetchPriority?: "high" | "low" | "auto";
  width?: number;
  height?: number;
  onStorageDataUrl?: (dataUrl: string) => void;
  onNaturalSize?: (size: { width: number; height: number }) => void;
  onLoad?: () => void;
  onError?: () => void;
  fallbackSrcs?: string[];
  fallbackVariant?: "message" | "quiet";
  storageVariant?: StorageSignedUrlVariant;
}) {
  const {
    objectFit,
    objectPosition,
    filter,
    mixBlendMode,
    ...containerStyle
  } = style ?? {};
  const fallbackSrcKey = fallbackSrcs.join("\u0000");
  const sourceQueue = useMemo(
    () => getUniquePhotoSources([src, ...fallbackSrcs]),
    [fallbackSrcKey, src],
  );
  const [sourceIndex, setSourceIndex] = useState(0);
  const currentSource = sourceQueue[sourceIndex] ?? src;
  const [displaySrc, setDisplaySrc] = useState(() =>
    getInitialDisplaySrc(currentSource, storageVariant),
  );
  const [storageDataUrl, setStorageDataUrl] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [signedUrlRetryNonce, setSignedUrlRetryNonce] = useState(0);
  const [activeStorageVariant, setActiveStorageVariant] =
    useState<StorageSignedUrlVariant>(storageVariant);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const loadStartedAtRef = useRef<number>(performance.now());
  const trackedDisplaySrcRef = useRef("");
  const persistedDataUrlRef = useRef("");
  const signedUrlRetryCountsRef = useRef(new Map<string, number>());
  const isInlineImage = displaySrc.startsWith("data:image/");
  const hasNextSource = sourceIndex < sourceQueue.length - 1;
  const frameStyle = useMemo<CSSProperties>(
    () => ({
      ...containerStyle,
      position: containerStyle.position ?? "relative",
      display: "block",
      overflow: containerStyle.overflow ?? "hidden",
      background:
        containerStyle.background ??
        "linear-gradient(180deg, rgba(255,253,248,0.78), rgba(239,229,214,0.42))",
    }),
    [containerStyle],
  );

  useEffect(() => {
    setSourceIndex(0);
    setActiveStorageVariant(storageVariant);
    signedUrlRetryCountsRef.current.clear();
  }, [fallbackSrcKey, src, storageVariant]);

  useEffect(() => {
    let isActive = true;
    const storagePath = getStoragePhotoPath(currentSource);

    loadStartedAtRef.current = performance.now();
    trackedDisplaySrcRef.current = "";
    setIsLoaded(false);
    setHasError(false);
    setStorageDataUrl(null);

    if (!storagePath) {
      setDisplaySrc(currentSource);
      return;
    }

    const cachedUrl = readCachedSignedUrl(storagePath, activeStorageVariant);
    if (cachedUrl) {
      setDisplaySrc(cachedUrl);
      return;
    }

    void getStoragePhotoSignedUrl(currentSource, activeStorageVariant).then((signedUrl) => {
      if (isActive) {
        if (signedUrl) {
          setDisplaySrc(signedUrl);
        } else if (hasNextSource) {
          setSourceIndex((index) => Math.min(index + 1, sourceQueue.length - 1));
        } else {
          setDisplaySrc("");
          setHasError(true);
        }
      }
    });

    return () => {
      isActive = false;
    };
  }, [
    activeStorageVariant,
    currentSource,
    hasNextSource,
    signedUrlRetryNonce,
    sourceQueue.length,
  ]);

  useEffect(() => {
    loadStartedAtRef.current = performance.now();
    trackedDisplaySrcRef.current = "";
  }, [displaySrc]);

  useEffect(() => {
    const image = imageRef.current;

    if (!image) {
      return;
    }

    let isActive = true;
    const updateImageState = () => {
      if (image.naturalWidth > 0) {
        if (isActive) {
          setIsLoaded(true);
        }
      } else {
        if (isActive) {
          setIsLoaded(false);
          setHasError(true);
        }
      }
    };

    if (image.complete) {
      updateImageState();
      return;
    }

    if (typeof image.decode === "function") {
      void image.decode().then(updateImageState).catch(() => {
        if (image.complete) {
          updateImageState();
        }
      });
    }

    return () => {
      isActive = false;
    };
  }, [displaySrc]);

  useEffect(() => {
    if (!onStorageDataUrl || !canReadDisplayDataUrl(displaySrc)) {
      return;
    }

    let isActive = true;
    void readDisplayDataUrl(displaySrc).then((dataUrl) => {
      if (isActive && dataUrl) {
        setStorageDataUrl(dataUrl);
      }
    });

    return () => {
      isActive = false;
    };
  }, [displaySrc, onStorageDataUrl]);

  useEffect(() => {
    if (!storageDataUrl || !onStorageDataUrl) {
      return;
    }

    if (persistedDataUrlRef.current === storageDataUrl) {
      return;
    }

    persistedDataUrlRef.current = storageDataUrl;
    onStorageDataUrl(storageDataUrl);
  }, [onStorageDataUrl, storageDataUrl]);

  if (!displaySrc) {
    return hasError ? (
      <PhotoFallback style={frameStyle} variant={fallbackVariant} />
    ) : (
      <span aria-hidden="true" style={frameStyle} />
    );
  }

  return (
    <span style={frameStyle}>
      <img
        ref={imageRef}
        src={displaySrc}
        alt={alt}
        draggable={false}
        loading={loading ?? (isInlineImage ? "eager" : "lazy")}
        decoding={decoding ?? "async"}
        fetchPriority={fetchPriority}
        width={width}
        height={height}
        onLoad={() => {
          setIsLoaded(true);
          onLoad?.();
          const image = imageRef.current;
          if (image?.naturalWidth && image.naturalHeight) {
            onNaturalSize?.({
              width: image.naturalWidth,
              height: image.naturalHeight,
            });
          }
          trackImageLoadCompleted({
            displaySrc,
            startedAt: loadStartedAtRef.current,
            trackedRef: trackedDisplaySrcRef,
          });
        }}
        onError={() => {
          setIsLoaded(false);
          const storagePath = getStoragePhotoPath(currentSource);

          if (storagePath && activeStorageVariant === "thumbnail") {
            trackTransformFallback();
            deleteCachedSignedUrl(storagePath, "thumbnail");
            setHasError(false);
            setDisplaySrc("");
            setActiveStorageVariant("display");
            return;
          }

          if (storagePath && shouldRetrySignedUrl(storagePath, signedUrlRetryCountsRef)) {
            deleteCachedSignedUrl(storagePath, activeStorageVariant);
            setHasError(false);
            setDisplaySrc("");
            setSignedUrlRetryNonce((value) => value + 1);
            return;
          }

          if (hasNextSource) {
            setHasError(false);
            setSourceIndex((index) => Math.min(index + 1, sourceQueue.length - 1));
          } else {
            setHasError(true);
            onError?.();
          }
        }}
        style={{
          width: "100%",
          height: "100%",
          objectFit: objectFit ?? "cover",
          objectPosition,
          filter,
          mixBlendMode,
          display: "block",
          opacity: hasError || !isLoaded ? 0 : 1,
          transition: "opacity 220ms var(--ease-gentle)",
          ...imageStyle,
          ...imageSelectionLockStyle,
        }}
      />
      {!hasError ? (
        <span
          aria-hidden="true"
          style={{
            ...developOverlayStyle,
            opacity: isLoaded ? 0 : 1,
          }}
        />
      ) : null}
      {hasError ? (
        <PhotoFallback style={fallbackOverlayStyle} variant={fallbackVariant} />
      ) : null}
    </span>
  );
}

function getUniquePhotoSources(sources: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const source of sources) {
    const value = typeof source === "string" ? source.trim() : "";
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    values.push(value);
  }

  return values;
}

function trackImageLoadCompleted({
  displaySrc,
  startedAt,
  trackedRef,
}: {
  displaySrc: string;
  startedAt: number;
  trackedRef: MutableRefObject<string>;
}) {
  if (!displaySrc || trackedRef.current === displaySrc) {
    return;
  }

  trackedRef.current = displaySrc;
  trackProductEvent("image_load_completed", {
    source_kind: getImageSourceKind(displaySrc),
    elapsed_ms: Math.max(0, Math.round(performance.now() - startedAt)),
  });
}

function getImageSourceKind(displaySrc: string) {
  if (displaySrc.startsWith("data:image/")) {
    return "data";
  }
  if (displaySrc.startsWith("blob:")) {
    return "blob";
  }
  if (displaySrc.startsWith("http://") || displaySrc.startsWith("https://")) {
    return "remote";
  }
  return "other";
}

function shouldRetrySignedUrl(
  storagePath: string,
  retryCountsRef: MutableRefObject<Map<string, number>>,
) {
  const currentCount = retryCountsRef.current.get(storagePath) ?? 0;

  if (currentCount >= 2) {
    return false;
  }

  retryCountsRef.current.set(storagePath, currentCount + 1);
  return true;
}

function PhotoFallback({
  style,
  variant,
}: {
  style: CSSProperties;
  variant: "message" | "quiet";
}) {
  if (variant === "quiet") {
    return (
      <span style={{ ...fallbackFrameStyle, ...style }} aria-hidden="true">
        <span style={quietFallbackMarkStyle} />
      </span>
    );
  }

  return (
    <span style={{ ...fallbackFrameStyle, ...style }}>
      <span style={fallbackTextStyle}>
        写真を表示できません
        <span style={fallbackHelpStyle}>もう一度開いてみてください</span>
      </span>
    </span>
  );
}

function getInitialDisplaySrc(
  src: string,
  variant: StorageSignedUrlVariant = "display",
) {
  const storagePath = getStoragePhotoPath(src);
  if (!storagePath) {
    return src;
  }

  return readCachedSignedUrl(storagePath, variant) ?? "";
}

function getSignedUrlCacheKey(
  storagePath: string,
  variant: StorageSignedUrlVariant,
) {
  return `${variant}\u0000${storagePath}`;
}

function readCachedSignedUrl(
  storagePath: string,
  variant: StorageSignedUrlVariant,
) {
  const cacheKey = getSignedUrlCacheKey(storagePath, variant);
  const cached = signedUrlCache.get(cacheKey);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    signedUrlCache.delete(cacheKey);
    return null;
  }

  return cached.url;
}

function writeCachedSignedUrl(
  storagePath: string,
  url: string,
  variant: StorageSignedUrlVariant,
) {
  signedUrlCache.set(getSignedUrlCacheKey(storagePath, variant), {
    expiresAt:
      Date.now() +
      Math.max(0, DISPLAY_SIGNED_URL_SECONDS * 1000 * SIGNED_URL_CACHE_REFRESH_RATIO),
    url,
  });
}

function deleteCachedSignedUrl(
  storagePath: string,
  variant: StorageSignedUrlVariant,
) {
  const cacheKey = getSignedUrlCacheKey(storagePath, variant);
  signedUrlCache.delete(cacheKey);
  signedUrlPromiseCache.delete(cacheKey);
}

async function resolveStoragePhotoForDisplay(
  src: string,
  variant: StorageSignedUrlVariant,
) {
  const supabase = createBrowserSupabaseClient();

  return readSignedUrlFromApi(src, supabase, variant);
}

export function getCachedStoragePhotoSignedUrl(
  src: string,
  variant: StorageSignedUrlVariant = "display",
) {
  const storagePath = getStoragePhotoPath(src);
  return storagePath ? readCachedSignedUrl(storagePath, variant) : null;
}

export async function getStoragePhotoSignedUrl(
  src: string,
  variant: StorageSignedUrlVariant = "display",
) {
  const storagePath = getStoragePhotoPath(src);

  if (!storagePath) {
    return src || null;
  }

  const cachedUrl = readCachedSignedUrl(storagePath, variant);
  if (cachedUrl) {
    return cachedUrl;
  }

  const cacheKey = getSignedUrlCacheKey(storagePath, variant);
  const signedUrlPromise =
    signedUrlPromiseCache.get(cacheKey) ??
    resolveStoragePhotoForDisplay(src, variant);
  signedUrlPromiseCache.set(cacheKey, signedUrlPromise);

  const signedUrl = await signedUrlPromise;
  if (signedUrl) {
    writeCachedSignedUrl(storagePath, signedUrl, variant);
  } else {
    signedUrlPromiseCache.delete(cacheKey);
  }

  return signedUrl;
}

export async function preloadStoragePhotoSignedUrls(
  sources: string[],
  variant: StorageSignedUrlVariant = "thumbnail",
) {
  const paths = Array.from(
    new Set(
      sources
        .map((source) => getStoragePhotoPath(source))
        .filter((path): path is string =>
          Boolean(path && !readCachedSignedUrl(path, variant)),
        ),
    ),
  );

  if (paths.length === 0) {
    return;
  }

  const supabase = createBrowserSupabaseClient();
  const accessToken = supabase
    ? (await supabase.auth.getSession()).data.session?.access_token
    : null;

  const response = await fetch("/api/photo-storage/signed-urls", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      anonymousId: readAnalyticsAnonymousId(),
      paths,
      variant,
    }),
  }).catch(() => null);

  if (!response?.ok) {
    return;
  }

  const body = (await response.json().catch(() => null)) as {
    signedUrls?: unknown;
  } | null;
  const signedUrls =
    body?.signedUrls && typeof body.signedUrls === "object"
      ? (body.signedUrls as Record<string, unknown>)
      : {};

  for (const path of paths) {
    const signedUrl = signedUrls[path];
    if (typeof signedUrl === "string" && signedUrl) {
      writeCachedSignedUrl(path, signedUrl, variant);
    }
  }
}

async function readSignedUrlFromApi(
  src: string,
  supabase: ReturnType<typeof createBrowserSupabaseClient>,
  variant: StorageSignedUrlVariant,
) {
  const accessToken = supabase
    ? (await supabase.auth.getSession()).data.session?.access_token
    : null;

  const response = await fetch("/api/photo-storage/signed-url", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({
      anonymousId: readAnalyticsAnonymousId(),
      src,
      variant,
    }),
  }).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const body = (await response.json().catch(() => null)) as {
    signedUrl?: unknown;
  } | null;

  return typeof body?.signedUrl === "string" && body.signedUrl
    ? body.signedUrl
    : null;
}

function trackTransformFallback() {
  trackProductEvent("photo_transform_fallback", {
    variant: "thumbnail",
  });
}

async function readDisplayDataUrl(displaySrc: string) {
  if (displaySrc.startsWith("data:image/")) {
    return displaySrc;
  }

  const response = await fetch(displaySrc).catch(() => null);

  if (!response?.ok) {
    return null;
  }

  const blob = await response.blob().catch(() => null);

  if (!blob?.type.startsWith("image/")) {
    return null;
  }

  return blobToDataUrl(blob);
}

function canReadDisplayDataUrl(displaySrc: string) {
  return (
    displaySrc.startsWith("data:image/") ||
    displaySrc.startsWith("https://") ||
    displaySrc.startsWith("http://")
  );
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

function readAnalyticsAnonymousId() {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.analyticsAnonymousId);
  } catch {
    return null;
  }
}
