import { NextResponse } from "next/server";

import {
  isBlockedDeliveryPoolRow,
  isStorageDeliveryPhotoUrl,
} from "../../../lib/home/deliveryPoolGuards";
import { isUsablePhotoSrc } from "../../../lib/photoStorage";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

type PresenceRow = {
  id: string;
  user_id: string | null;
  anonymous_id: string | null;
  local_moment_id: string;
  local_cat_id: string;
  owner_cat_id: string;
  photo_url: string;
  metadata: Record<string, unknown> | null;
};

const PRESENCE_THRESHOLD = 30;
const PRESENCE_CACHE_MS = 60 * 60 * 1000;
const PRESENCE_RESPONSE_CACHE_SECONDS = 5 * 60;
const PRESENCE_PAGE_SIZE = 1000;
const PRESENCE_MAX_ROWS = 5000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const RATE_LIMIT_MAX_BUCKETS = 1000;
const PRESENCE_SELECT =
  "id, user_id, anonymous_id, local_moment_id, local_cat_id, owner_cat_id, photo_url, metadata";

let cachedPresence: { count: number | null; expiresAt: number } | null = null;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

export async function GET(request: Request) {
  const now = Date.now();
  const rateLimit = checkPresenceRateLimit(buildRateLimitKey(request));

  if (!rateLimit.allowed) {
    return presenceResponse(null);
  }

  if (cachedPresence && cachedPresence.expiresAt > now) {
    return presenceResponse(cachedPresence.count);
  }

  const count = await readPresenceCount().catch(() => null);
  const visibleCount =
    typeof count === "number" && count >= PRESENCE_THRESHOLD ? count : null;

  cachedPresence = {
    count: visibleCount,
    expiresAt: now + PRESENCE_CACHE_MS,
  };

  return presenceResponse(visibleCount);
}

async function readPresenceCount() {
  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const rows: PresenceRow[] = [];

  for (let from = 0; from < PRESENCE_MAX_ROWS; from += PRESENCE_PAGE_SIZE) {
    const to = from + PRESENCE_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("cat_moments")
      .select(PRESENCE_SELECT)
      .eq("visibility", "shared")
      .eq("delivery_status", "available")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      return null;
    }

    const pageRows = (data ?? []) as PresenceRow[];
    rows.push(...pageRows);

    if (pageRows.length < PRESENCE_PAGE_SIZE) {
      break;
    }
  }

  const sourceCatIds = new Set<string>();

  for (const row of rows) {
    if (!isPresenceEligibleRow(row)) {
      continue;
    }

    const ownerKey = row.user_id ?? row.anonymous_id;
    const catKey = row.owner_cat_id || row.local_cat_id;

    if (!ownerKey || !catKey) {
      continue;
    }

    sourceCatIds.add(`${ownerKey}:${catKey}`);
  }

  return sourceCatIds.size;
}

function isPresenceEligibleRow(row: PresenceRow) {
  if (isBlockedDeliveryPoolRow(row)) {
    return false;
  }

  if (readPoolKind(row.metadata) === "admin_stock") {
    return false;
  }

  if (isStorageDeliveryPhotoUrl(row.photo_url)) {
    return false;
  }

  return isUsablePhotoSrc(row.photo_url);
}

function readPoolKind(metadata: Record<string, unknown> | null) {
  const poolKind = metadata?.pool_kind;

  if (poolKind === "admin_stock" || poolKind === "user_shared") {
    return poolKind;
  }

  if (poolKind === "admin-stock") {
    return "admin_stock";
  }

  if (metadata?.source === "admin-stock") {
    return "admin_stock";
  }

  return "unknown";
}

function presenceResponse(count: number | null) {
  return NextResponse.json(
    { count },
    {
      status: 200,
      headers: {
        "Cache-Control": `public, max-age=${PRESENCE_RESPONSE_CACHE_SECONDS}`,
      },
    },
  );
}

function buildRateLimitKey(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();

  return forwardedFor || realIp || "unknown";
}

function checkPresenceRateLimit(key: string) {
  const now = Date.now();

  for (const [bucketKey, bucket] of rateLimitBuckets) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(bucketKey);
    }
  }

  if (rateLimitBuckets.size > RATE_LIMIT_MAX_BUCKETS) {
    const oldestKey = rateLimitBuckets.keys().next().value;
    if (oldestKey) {
      rateLimitBuckets.delete(oldestKey);
    }
  }

  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true };
  }

  bucket.count += 1;

  return { allowed: bucket.count <= RATE_LIMIT_MAX_REQUESTS };
}
