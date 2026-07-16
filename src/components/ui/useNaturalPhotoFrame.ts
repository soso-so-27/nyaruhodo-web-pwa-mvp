"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

const DEFAULT_VIEWPORT_WIDTH = 390;
const DEFAULT_VIEWPORT_HEIGHT = 844;
const MIN_FRAME_HEIGHT = 180;

export function useNaturalPhotoFrame({
  horizontalInsetPx,
  maxWidthPx,
  verticalChromePx,
  initialAspect,
  photoKey,
}: {
  horizontalInsetPx: number;
  maxWidthPx: number;
  verticalChromePx: number;
  initialAspect?: number | null;
  photoKey?: string | null;
}) {
  const normalizedInitialAspect = normalizePhotoAspect(initialAspect);
  const [photoAspect, setPhotoAspect] = useState(normalizedInitialAspect);
  const [viewportSize, setViewportSize] = useState({
    width: DEFAULT_VIEWPORT_WIDTH,
    height: DEFAULT_VIEWPORT_HEIGHT,
  });

  useLayoutEffect(() => {
    setPhotoAspect(normalizedInitialAspect);
  }, [normalizedInitialAspect, photoKey]);

  useEffect(() => {
    let frameId: number | null = null;

    const updateViewportSize = () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        setViewportSize({
          width: window.visualViewport?.width ?? window.innerWidth,
          height: window.visualViewport?.height ?? window.innerHeight,
        });
      });
    };

    updateViewportSize();
    window.addEventListener("resize", updateViewportSize);
    window.visualViewport?.addEventListener("resize", updateViewportSize);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("resize", updateViewportSize);
      window.visualViewport?.removeEventListener("resize", updateViewportSize);
    };
  }, []);

  const frameStyle = useMemo<CSSProperties>(() => {
    const maxFrameHeight = Math.max(
      MIN_FRAME_HEIGHT,
      viewportSize.height - verticalChromePx,
    );
    const maxFrameWidth = Math.max(
      1,
      Math.min(maxWidthPx, viewportSize.width - horizontalInsetPx),
    );
    const frameWidth = Math.min(maxFrameWidth, maxFrameHeight * photoAspect);
    const frameHeight = frameWidth / photoAspect;

    return {
      width: `${Math.round(frameWidth)}px`,
      height: `${Math.round(frameHeight)}px`,
      maxWidth: "100%",
      aspectRatio: `${photoAspect} / 1`,
      justifySelf: "center",
    };
  }, [
    horizontalInsetPx,
    maxWidthPx,
    photoAspect,
    verticalChromePx,
    viewportSize,
  ]);

  const handleNaturalSize = useCallback(
    ({ width, height }: { width: number; height: number }) => {
      if (width > 0 && height > 0) {
        setPhotoAspect(width / height);
      }
    },
    [],
  );

  const resetPhotoAspect = useCallback(
    () => setPhotoAspect(normalizedInitialAspect),
    [normalizedInitialAspect],
  );

  return {
    frameStyle,
    handleNaturalSize,
    photoAspect,
    resetPhotoAspect,
  };
}

function normalizePhotoAspect(aspect: number | null | undefined) {
  return Number.isFinite(aspect) && Number(aspect) > 0 ? Number(aspect) : 1;
}
