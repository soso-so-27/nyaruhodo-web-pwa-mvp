"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { STORAGE_KEYS } from "../lib/storage";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    const completed =
      window.localStorage.getItem(STORAGE_KEYS.onboardingCompleted) === "true";

    router.replace(completed ? "/home" : "/diagnosis-onboarding");
  }, [router]);

  return null;
}
