import type { ReactNode } from "react";
import { notFound } from "next/navigation";

// Prototype routes are review-only references. Vercel Preview and local dev
// can show them, but the public production domain must never expose them.
export default function PrototypesLayout({ children }: { children: ReactNode }) {
  const isPublicProduction =
    process.env.VERCEL_ENV === "production" ||
    (!process.env.VERCEL_ENV && process.env.NODE_ENV === "production");

  if (isPublicProduction) {
    notFound();
  }
  return <>{children}</>;
}
