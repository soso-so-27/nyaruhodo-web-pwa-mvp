import { NextResponse } from "next/server";

import { getBetaCapabilitiesForRequest } from "../../../../lib/betaAccess";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const capabilities = await getBetaCapabilitiesForRequest(request);

  return NextResponse.json(capabilities);
}
