import type { ReactNode } from "react";
import { notFound } from "next/navigation";

// Prototype routes are development-only references (old stamp/letter layout
// comparisons). They must not be reachable in production builds.
export default function PrototypesLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <>{children}</>;
}
