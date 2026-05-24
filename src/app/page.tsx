"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { STORAGE_KEYS } from "../lib/storage";

const ATTRIBUTION_PARAMS = [
  "source",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "campaign",
] as const;

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    const completed =
      window.localStorage.getItem(STORAGE_KEYS.onboardingCompleted) === "true";
    const pathname = completed ? "/home" : "/diagnosis-onboarding";

    router.replace(buildRedirectTarget(pathname));
  }, [router]);

  return null;
}

function buildRedirectTarget(pathname: "/home" | "/diagnosis-onboarding") {
  const currentParams = new URLSearchParams(window.location.search);
  const nextParams = new URLSearchParams();

  for (const key of ATTRIBUTION_PARAMS) {
    const value = currentParams.get(key);
    if (value) {
      nextParams.set(key, value.slice(0, 120));
    }
  }

  const query = nextParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}
