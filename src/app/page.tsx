"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppLoadingScreen } from "../components/loading/AppLoadingScreen";

const ATTRIBUTION_PARAMS = [
  "source",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "campaign",
  "ref",
  "referral",
  "invite",
] as const;

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    router.replace(buildRedirectTarget("/home"));
  }, [router]);

  return <AppLoadingScreen variant="startup" />;
}

function buildRedirectTarget(pathname: "/home") {
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
