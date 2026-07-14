"use client";

import { useEffect } from "react";

import { startOriginalPhotoPreservationQueue } from "../../lib/photoOriginals";

export function OriginalPhotoPreservationController() {
  useEffect(() => startOriginalPhotoPreservationQueue(), []);

  return null;
}
