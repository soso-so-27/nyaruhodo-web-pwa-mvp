import type { NextRequest } from "next/server";

import { isPublicProductionDeployment } from "./lib/deploymentEnvironment";
import { updateSupabaseSession } from "./lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  if (
    request.nextUrl.pathname.startsWith("/prototypes/") &&
    isPublicProductionDeployment()
  ) {
    return new Response(null, {
      status: 404,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  return updateSupabaseSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-180.png|icon-192.png|icon-512.png|icon-1024.png|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
  ],
};
