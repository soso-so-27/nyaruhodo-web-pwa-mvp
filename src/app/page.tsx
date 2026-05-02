"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    const completed =
      window.localStorage.getItem("onboarding_completed") === "true";

    router.replace(completed ? "/home" : "/onboarding");
  }, [router]);

  return null;
}
