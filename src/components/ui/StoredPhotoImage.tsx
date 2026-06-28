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
} from "../../lib/photoStorage";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import { STORAGE_KEYS } from "../../lib/storage";
import { createBrowserSupabaseClient } from "../../lib/supabase/browser";
import { color, radius, shadow, typography } from "./designTokens";

const signedUrlCache = new Map<string, { expiresAt: number; url: string }>();
const signedUrlPromiseCache = new Map<string, Promise<string | null>>();
const SIGNED_URL_CACHE_SAFETY_MS = 5 * 60 * 1000;
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
    "linear-gradient(180deg, rgba(251,250,247,0.28), rgba(244,241,234,0.18))",
  transition: "opacity 420ms var(--ease-gentle)",
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
  onStorageDataUrl,
  onNaturalSize,
  onLoad,
  onError,
  fallbackSrcs = EMPTY_FALLBACK_SRCS,
}: {
  src: string;
  alt: string;
  style?: CSSProperties;
  imageStyle?: CSSProperties;
  loading?: "eager" | "lazy";
  onStorageDataUrl?: (dataUrl: string) => void;
  onNaturalSize?: (size: { width: number; height: number }) => void;
  onLoad?: () => void;
  onError?: () => void;
  fallbackSrcs?: string[];
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
  const initialSrc = getInitialDisplaySrc(currentSource);
  const [displaySrc, setDisplaySrc] = useState(initialSrc);
  const [storageDataUrl, setStorageDataUrl] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const loadStartedAtRef = useRef<number>(performance.now());
  const trackedDisplaySrcRef = useRef("");
  const persistedDataUrlRef = useRef("");
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
  }, [fallbackSrcKey, src]);

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

    const cachedUrl = readCachedSignedUrl(storagePath);
    if (cachedUrl) {
      setDisplaySrc(cachedUrl);
      return;
    }

    const signedUrlPromise =
      signedUrlPromiseCache.get(storagePath) ??
      resolveStoragePhotoForDisplay(currentSource);
    signedUrlPromiseCache.set(storagePath, signedUrlPromise);

    void signedUrlPromise.then((signedUrl) => {
      if (signedUrl) {
        writeCachedSignedUrl(storagePath, signedUrl);
      } else {
        signedUrlPromiseCache.delete(storagePath);
      }

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
  }, [currentSource, hasNextSource, sourceQueue.length]);

  useEffect(() => {
    loadStartedAtRef.current = performance.now();
    trackedDisplaySrcRef.current = "";
  }, [displaySrc]);

  useEffect(() => {
    const image = imageRef.current;

    if (!image) {
      return;
    }

    const updateImageState = () => {
      if (!image.complete) {
        return false;
      }

      if (image.naturalWidth > 0) {
        setIsLoaded(true);
      } else {
        setIsLoaded(false);
        setHasError(true);
      }

      return true;
    };

    if (updateImageState()) {
      return;
    }

    let checkCount = 0;
    const checkTimer = window.setInterval(() => {
      checkCount += 1;

      if (updateImageState() || checkCount >= 25) {
        if (!image.complete || image.naturalWidth === 0) {
          setIsLoaded(false);
          setHasError(true);
        }
        window.clearInterval(checkTimer);
      }
    }, 400);

    return () => window.clearInterval(checkTimer);
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
      <PhotoFallback style={frameStyle} />
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
        decoding={isInlineImage ? "sync" : "async"}
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
          filter: buildDevelopFilter(filter, isLoaded, hasError),
          mixBlendMode,
          display: "block",
          opacity: hasError ? 0 : 1,
          transform: isLoaded ? "scale(1)" : "scale(1.018)",
          transition:
            "filter 420ms var(--ease-gentle), opacity 180ms var(--ease-gentle), transform 420ms var(--ease-gentle)",
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
      {hasError ? <PhotoFallback style={fallbackOverlayStyle} /> : null}
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

function buildDevelopFilter(
  baseFilter: CSSProperties["filter"],
  isLoaded: boolean,
  hasError: boolean,
) {
  const filters = [
    baseFilter,
    !hasError && !isLoaded ? "blur(14px) saturate(0.9)" : null,
  ].filter(Boolean);

  return filters.length > 0 ? filters.join(" ") : undefined;
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

function PhotoFallback({ style }: { style: CSSProperties }) {
  return (
    <span style={{ ...fallbackFrameStyle, ...style }}>
      <span style={fallbackTextStyle}>
        写真を表示できません
        <span style={fallbackHelpStyle}>もう一度開いてみてください</span>
      </span>
    </span>
  );
}

function getInitialDisplaySrc(src: string) {
  const storagePath = getStoragePhotoPath(src);
  if (!storagePath) {
    return src;
  }

  return readCachedSignedUrl(storagePath) ?? "";
}

function readCachedSignedUrl(storagePath: string) {
  const cached = signedUrlCache.get(storagePath);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    signedUrlCache.delete(storagePath);
    return null;
  }

  return cached.url;
}

function writeCachedSignedUrl(storagePath: string, url: string) {
  signedUrlCache.set(storagePath, {
    expiresAt:
      Date.now() +
      Math.max(0, DISPLAY_SIGNED_URL_SECONDS * 1000 - SIGNED_URL_CACHE_SAFETY_MS),
    url,
  });
}

async function resolveStoragePhotoForDisplay(src: string) {
  const supabase = createBrowserSupabaseClient();

  return readSignedUrlFromApi(src, supabase);
}

async function readSignedUrlFromApi(
  src: string,
  supabase: ReturnType<typeof createBrowserSupabaseClient>,
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
