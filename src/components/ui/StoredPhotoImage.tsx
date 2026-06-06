"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import {
  createSignedStorageUrl,
  getStoragePhotoPath,
} from "../../lib/photoStorage";
import { createBrowserSupabaseClient } from "../../lib/supabase/browser";

const signedUrlCache = new Map<string, string>();
const signedUrlPromiseCache = new Map<string, Promise<string | null>>();

export function StoredPhotoImage({
  src,
  alt,
  style,
}: {
  src: string;
  alt: string;
  style?: CSSProperties;
}) {
  const {
    objectFit,
    filter,
    mixBlendMode,
    ...containerStyle
  } = style ?? {};
  const initialSrc = getInitialDisplaySrc(src);
  const [displaySrc, setDisplaySrc] = useState(initialSrc);
  const [isLoaded, setIsLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
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
        setDisplaySrc(signedUrl ?? "");
      }
    });

    return () => {
      isActive = false;
    };
  }, [src]);

  useEffect(() => {
    const image = imageRef.current;

    if (image?.complete && image.naturalWidth > 0) {
      setIsLoaded(true);
    }
  }, [displaySrc]);

  if (!displaySrc) {
    return <span aria-hidden="true" style={frameStyle} />;
  }

  return (
    <span style={frameStyle}>
      <img
        ref={imageRef}
        src={displaySrc}
        alt={alt}
        loading={isInlineImage ? "eager" : "lazy"}
        decoding={isInlineImage ? "sync" : "async"}
        onLoad={() => setIsLoaded(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: objectFit ?? "cover",
          filter,
          mixBlendMode,
          display: "block",
          opacity: isInlineImage || isLoaded ? 1 : 0,
          transition: "opacity 180ms ease",
        }}
      />
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

  if (supabase) {
    const signedUrl = await createSignedStorageUrl(supabase, storagePath);

    if (signedUrl) {
      return signedUrl;
    }
  }

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
    body: JSON.stringify({ src }),
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
