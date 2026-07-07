import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

export function authorizeAdminTaskRequest(request: Request) {
  const expectedSecret =
    process.env.STORAGE_HARDENING_SECRET ??
    process.env.CRON_SECRET ??
    process.env.ADMIN_TASK_SECRET ??
    "";

  if (!expectedSecret) {
    return NextResponse.json(
      { ok: false, error: "admin_task_secret_unconfigured" },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  const headerSecret =
    request.headers.get("x-storage-hardening-secret") ??
    request.headers.get("x-cron-secret") ??
    "";

  if (
    !isAdminTaskSecretMatch(bearer, expectedSecret) &&
    !isAdminTaskSecretMatch(headerSecret, expectedSecret)
  ) {
    return NextResponse.json(
      { ok: false, error: "forbidden" },
      { status: 403 },
    );
  }

  return null;
}

function isAdminTaskSecretMatch(candidate: string, expected: string) {
  const candidateDigest = createHash("sha256").update(candidate).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();

  return timingSafeEqual(candidateDigest, expectedDigest);
}
