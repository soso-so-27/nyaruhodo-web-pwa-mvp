"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { readOwnSleepingPhotos } from "../lib/home/sleepingPhotos";
import { hasCompletedOnboardingState } from "../lib/onboarding/completion";
import { readCachedJson, STORAGE_KEYS } from "../lib/storage";

export function EntryRouter() {
  const router = useRouter();

  useEffect(() => {
    if (hasCompletedOnboardingState() || hasCredibleExistingAppEvidence()) {
      router.replace("/home");
      return;
    }

    const query = window.location.search;
    router.replace(`/onboarding${query}`);
  }, [router]);

  return (
    <main
      aria-label="開始画面を確認中"
      style={{
        alignItems: "center",
        display: "flex",
        justifyContent: "center",
        minHeight: "100dvh",
        padding: 24,
      }}
    >
      <p aria-live="polite" style={{ color: "var(--ink-muted)", margin: 0 }}>
        ひらいています…
      </p>
    </main>
  );
}

function hasCredibleExistingAppEvidence() {
  if (readOwnSleepingPhotos().length > 0) {
    return true;
  }

  const profiles = readCachedJson<unknown[]>(STORAGE_KEYS.catProfiles);
  return Boolean(
    Array.isArray(profiles) &&
      profiles.some(
        (profile) =>
          profile &&
          typeof profile === "object" &&
          typeof (profile as { id?: unknown }).id === "string" &&
          (profile as { id: string }).id.length > 0,
      ),
  );
}
