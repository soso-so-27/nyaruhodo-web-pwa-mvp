"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import {
  getStoragePhotoPath,
} from "../../lib/photoStorage";
import { STORAGE_KEYS } from "../../lib/storage";
import { createBrowserSupabaseClient } from "../../lib/supabase/browser";
import { color, radius, shadow, typography } from "./designTokens";

const signedUrlCache = new Map<string, string>();
const signedUrlPromiseCache = new Map<string, Promise<string | null>>();

const fallbackFrameStyle: CSSProperties = {
  display: "grid",
  placeItems: "center",
  border: `1px solid ${color.border}`,
  borderRadius: radius.lg,
  background:
    "linear-gradient(180deg, rgba(255,253,248,0.92), rgba(247,241,231,0.72))",
  boxShadow: shadow.soft,
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
  fontSize: 11,
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
  onStorageDataUrl,
}: {
  src: string;
  alt: string;
  style?: CSSProperties;
  onStorageDataUrl?: (dataUrl: string) => void;
}) {
  const {
    objectFit,
    filter,
    mixBlendMode,
    ...containerStyle
  } = style ?? {};
  const initialSrc = getInitialDisplaySrc(src);
  const [displaySrc, setDisplaySrc] = useState(initialSrc);
  const [storageDataUrl, setStorageDataUrl] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const persistedDataUrlRef = useRef("");
  const isInlineImage = displaySrc.startsWith("data:image/");
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
    let isActive = true;
    const storagePath = getStoragePhotoPath(src);

    setIsLoaded(false);
    setHasError(false);
    setStorageDataUrl(null);

    if (!storagePath) {
      setDisplaySrc(src);
      return;
    }

    const cachedUrl = signedUrlCache.get(storagePath);
    if (cachedUrl) {
      setDisplaySrc(cachedUrl);
      return;
    }

    const signedUrlPromise =
      signedUrlPromiseCache.get(storagePath) ??
      resolveStoragePhotoForDisplay(src, storagePath);
    signedUrlPromiseCache.set(storagePath, signedUrlPromise);

    void signedUrlPromise.then((signedUrl) => {
      if (signedUrl) {
        signedUrlCache.set(storagePath, signedUrl);
      } else {
        signedUrlPromiseCache.delete(storagePath);
      }

      if (isActive) {
        if (signedUrl) {
          setDisplaySrc(signedUrl);
        } else {
          setDisplaySrc("");
          setHasError(true);
        }
      }
    });

    return () => {
      isActive = false;
    };
  }, [src]);

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
        loading={isInlineImage ? "eager" : "lazy"}
        decoding={isInlineImage ? "sync" : "async"}
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          setIsLoaded(false);
          setHasError(true);
        }}
        style={{
          width: "100%",
          height: "100%",
          objectFit: objectFit ?? "cover",
          filter,
          mixBlendMode,
          display: "block",
          opacity: !hasError && (isInlineImage || isLoaded) ? 1 : 0,
          transition: "opacity 180ms ease",
          ...imageSelectionLockStyle,
        }}
      />
      {hasError ? <PhotoFallback style={fallbackOverlayStyle} /> : null}
    </span>
  );
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

  return signedUrlCache.get(storagePath) ?? "";
}

async function resolveStoragePhotoForDisplay(src: string, storagePath: string) {
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
