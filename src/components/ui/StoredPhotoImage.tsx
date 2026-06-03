"use client";

import { useEffect, useState, type CSSProperties } from "react";

import {
  createSignedStorageUrl,
  getStoragePhotoPath,
} from "../../lib/photoStorage";
import { createBrowserSupabaseClient } from "../../lib/supabase/browser";

export function StoredPhotoImage({
  src,
  alt,
  style,
}: {
  src: string;
  alt: string;
  style?: CSSProperties;
}) {
  const [displaySrc, setDisplaySrc] = useState(src);

  useEffect(() => {
    let isActive = true;
    const storagePath = getStoragePhotoPath(src);

    if (!storagePath) {
      setDisplaySrc(src);
      return;
    }

    const supabase = createBrowserSupabaseClient();

    if (!supabase) {
      setDisplaySrc("");
      return;
    }

    void createSignedStorageUrl(supabase, storagePath).then((signedUrl) => {
      if (isActive) {
        setDisplaySrc(signedUrl ?? "");
      }
    });

    return () => {
      isActive = false;
    };
  }, [src]);

  if (!displaySrc) {
    return <span aria-hidden="true" style={{ ...style, display: "block" }} />;
  }

  return <img src={displaySrc} alt={alt} style={style} />;
}
