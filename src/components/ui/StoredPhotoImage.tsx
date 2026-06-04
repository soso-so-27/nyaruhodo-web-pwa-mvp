"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

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

    const supabase = createBrowserSupabaseClient();

    if (!supabase) {
      setDisplaySrc("");
      return;
    }

    const cachedUrl = signedUrlCache.get(storagePath);
    if (cachedUrl) {
      setDisplaySrc(cachedUrl);
      return;
    }

    const signedUrlPromise =
      signedUrlPromiseCache.get(storagePath) ??
      createSignedStorageUrl(supabase, storagePath).then(
        (signedUrl) => signedUrl ?? null,
      );
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

  if (!displaySrc) {
    return <span aria-hidden="true" style={frameStyle} />;
  }

  return (
    <span style={frameStyle}>
      <img
        src={displaySrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setIsLoaded(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: objectFit ?? "cover",
          filter,
          mixBlendMode,
          display: "block",
          opacity: isLoaded ? 1 : 0,
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
