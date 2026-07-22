import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { isPublicProductionDeployment } from "../../lib/deploymentEnvironment";

// Prototype routes are review-only references. Vercel Preview and local dev
// can show them, but the public production domain must never expose them.
export default function PrototypesLayout({ children }: { children: ReactNode }) {
  if (isPublicProductionDeployment()) {
    notFound();
  }
  return <>{children}</>;
}
