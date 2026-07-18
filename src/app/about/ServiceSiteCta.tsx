"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { trackProductEvent } from "../../lib/analytics/productAnalytics";

const ATTRIBUTION_KEYS = [
  "src",
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

type ServiceSiteCtaProps = {
  children: React.ReactNode;
  className: string;
  placement: "header" | "hero" | "footer";
};

export function ServiceSiteCta({
  children,
  className,
  placement,
}: ServiceSiteCtaProps) {
  const [href, setHref] = useState("/onboarding");

  useEffect(() => {
    const current = new URLSearchParams(window.location.search);
    const next = new URLSearchParams();

    for (const key of ATTRIBUTION_KEYS) {
      const value = current.get(key)?.trim();
      if (value) {
        next.set(key, value.slice(0, 160));
      }
    }

    const query = next.toString();
    setHref(query ? `/onboarding?${query}` : "/onboarding");
  }, []);

  return (
    <Link
      href={href}
      className={className}
      data-app-pressable="button"
      data-app-button-variant="primary"
      onClick={() =>
        trackProductEvent("service_site_cta_clicked", { placement })
      }
    >
      {children}
    </Link>
  );
}
