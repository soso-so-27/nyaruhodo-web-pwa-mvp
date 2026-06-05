import { NextResponse } from "next/server";

import { getAdminCapabilitiesForRequest } from "../../../../lib/adminAccess";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const capabilities = await getAdminCapabilitiesForRequest(request);

  return NextResponse.json(capabilities);
}
