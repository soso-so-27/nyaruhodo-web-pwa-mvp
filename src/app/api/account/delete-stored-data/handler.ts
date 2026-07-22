import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Kept outside route.ts so testable helpers are not treated as route exports.

import {
  buildAccountStorageDeletionPlan,
  getArchivedDeliveryStoragePath,
  PRESERVED_DELIVERY_STATUSES,
  type DeliveryStorageReference,
} from "../../../../lib/accountDeletionStorage";
import { cancelAccountDeletionStripeSubscriptions } from "../../../../lib/accountDeletionBilling";
import { CAT_PHOTOS_BUCKET, sanitizePathSegment } from "../../../../lib/photoStorage";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getSupabasePublicConfig } from "../../../../lib/supabase/config";

const STORAGE_LIST_LIMIT = 1000;
const DELETE_CHUNK_SIZE = 100;
const DELIVERY_QUERY_LIMIT = 1000;
const DELETE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const DELETE_RATE_LIMIT_MAX_BUCKETS = 1000;
const deleteRateLimitBuckets = new Map<string, number>();

type AccountDeleteResult = {
  cancelledStripeSubscriptions: number;
  deletedAnonymousIds: string[];
  deletedStoragePaths: number;
  errors: string[];
  preservedDeliveryPhotos: number;
  skippedAnonymousIds: string[];
  status: "deleted" | "error" | "skipped";
};

type CatMomentDeliveryRow = DeliveryStorageReference;
type DeleteStoredDataBody = {
  anonymousId?: unknown;
};

export async function POST(request: Request) {
  const userId = await authenticateUser(request);

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "auth_required" },
      { status: 401 },
    );
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "server_unavailable" },
      { status: 503 },
    );
  }

  if (!checkDeleteRateLimit(userId)) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | DeleteStoredDataBody
    | null;
  const result = await deleteStoredDataForUser(supabase, userId, {
    anonymousId: normalizeAnonymousId(body?.anonymousId),
  });

  return NextResponse.json({
    ok: result.status !== "error",
    ...result,
  }, {
    status: result.status === "error" ? 500 : 200,
  });
}

async function authenticateUser(request: Request) {
  const bearerToken = getBearerToken(request);

  if (!bearerToken) {
    return null;
  }

  const config = getSupabasePublicConfig();

  if (!config) {
    return null;
  }

  const supabase = createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { data, error } = await supabase.auth.getUser(bearerToken);

  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

export async function deleteStoredDataForUser(
  supabase: SupabaseClient,
  userId: string,
  options: { anonymousId?: string | null } = {},
): Promise<AccountDeleteResult> {
  const errors: string[] = [];
  const skippedAnonymousIds: string[] = [];
  const deletedAnonymousIds: string[] = [];
  const billingResult = await cancelAccountDeletionStripeSubscriptions({
    supabase,
    userId,
  });

  if (billingResult.errors.length > 0) {
    return {
      cancelledStripeSubscriptions: billingResult.cancelledStripeSubscriptions,
      deletedAnonymousIds,
      deletedStoragePaths: 0,
      errors: billingResult.errors,
      preservedDeliveryPhotos: 0,
      skippedAnonymousIds,
      status: "error",
    };
  }

  const authorizedAnonymousIds = await resolveAuthorizedAnonymousIds({
    anonymousId: options.anonymousId,
    supabase,
    userId,
    errors,
    skippedAnonymousIds,
  });
  const storagePrefixes = [
    userId,
    ...authorizedAnonymousIds.map(
      (anonymousId) => `anonymous/${sanitizePathSegment(anonymousId)}`,
    ),
  ];
  const storagePlans = await Promise.all(
    storagePrefixes.map(async (prefix) => {
      const storagePaths = await listStoragePaths(supabase, prefix, errors);
      const deliveryRows = await readPreservedDeliveryRowsForPrefix(
        supabase,
        prefix,
        errors,
      );

      return buildAccountStorageDeletionPlan({
        archivePathForSource: (sourcePath) =>
          getArchivedDeliveryStoragePath(sourcePath, randomUUID()),
        deliveryRows,
        ownerPrefix: prefix,
        storagePaths,
      });
    }),
  );
  const copiedSourcePaths = await copyPreservedDeliveryPhotos(
    supabase,
    storagePlans.flatMap((plan) => plan.copies),
    errors,
  );
  const deletablePaths = [
    ...storagePlans.flatMap((plan) => plan.deletablePaths),
    ...copiedSourcePaths,
  ];

  await deleteStoragePaths(supabase, deletablePaths, errors);
  await deleteEveningChoiceResolutions({
    supabase,
    userId,
    anonymousIds: authorizedAnonymousIds,
    errors,
  });

  // Intentionally out of scope: admin-only seed/stock rows, aggregate views, and
  // handoff/transfer audit rows. Handoffs are cleaned by their cron GC; admin
  // stock is operational content, not account-owned user data.
  const deleteSteps = [
    supabase.from("cat_moment_cats").delete().eq("user_id", userId),
    supabase.from("cat_moment_deliveries").delete().eq("user_id", userId),
    supabase.from("cat_moments").delete().eq("user_id", userId),
    supabase.from("collection_photos").delete().eq("user_id", userId),
    supabase.from("photo_assets").delete().eq("user_id", userId),
    supabase.from("photo_reports").delete().eq("reporter_user_id", userId),
    supabase.from("record_logs").delete().eq("user_id", userId),
    supabase.from("subscriptions").delete().eq("user_id", userId),
    supabase.from("app_events").delete().eq("user_id", userId),
    supabase.from("referral_claims").delete().or(
      `referrer_user_id.eq.${userId},referred_user_id.eq.${userId}`,
    ),
    supabase.from("referral_codes").delete().eq("user_id", userId),
    supabase.from("beta_feedback").delete().eq("user_id", userId),
    supabase.from("account_sync_state").delete().eq("user_id", userId),
    supabase.from("account_local_state").delete().eq("user_id", userId),
    supabase.from("product_analytics_events").delete().eq("user_id", userId),
    supabase.from("mikke_window_answers").delete().eq("user_id", userId),
    supabase.from("profiles").delete().eq("id", userId),
    supabase.from("cats").delete().eq("owner_user_id", userId),
    ...buildAnonymousDeleteSteps(supabase, authorizedAnonymousIds),
  ];
  const results = await Promise.all(deleteSteps);

  results.forEach((result, index) => {
    if (result.error) {
      errors.push(`delete step ${index + 1}: ${result.error.message}`);
    }
  });

  if (errors.length > 0) {
    return {
      cancelledStripeSubscriptions: billingResult.cancelledStripeSubscriptions,
      deletedAnonymousIds,
      deletedStoragePaths: deletablePaths.length,
      errors,
      preservedDeliveryPhotos: copiedSourcePaths.length,
      skippedAnonymousIds,
      status: "error",
    };
  }

  deletedAnonymousIds.push(...authorizedAnonymousIds);

  const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);

  if (authDeleteError) {
    errors.push(`auth delete: ${authDeleteError.message}`);
  }

  return {
    cancelledStripeSubscriptions: billingResult.cancelledStripeSubscriptions,
    deletedAnonymousIds,
    deletedStoragePaths: deletablePaths.length,
    errors,
    preservedDeliveryPhotos: copiedSourcePaths.length,
    skippedAnonymousIds,
    status: errors.length > 0 ? "error" : "deleted",
  };
}

function buildAnonymousDeleteSteps(
  supabase: SupabaseClient,
  anonymousIds: string[],
) {
  return anonymousIds.flatMap((anonymousId) => [
    supabase.from("cat_moment_deliveries").delete().eq("anonymous_id", anonymousId),
    supabase.from("cat_moments").delete().eq("anonymous_id", anonymousId),
    supabase.from("photo_reports").delete().eq("reporter_anonymous_id", anonymousId),
    supabase.from("app_events").delete().eq("anonymous_id", anonymousId),
    supabase.from("product_analytics_events").delete().eq("anonymous_id", anonymousId),
    supabase.from("mikke_window_answers").delete().eq("anonymous_id", anonymousId),
    supabase.from("referral_claims").delete().eq("anonymous_id", anonymousId),
  ]);
}

async function deleteEveningChoiceResolutions({
  supabase,
  userId,
  anonymousIds,
  errors,
}: {
  supabase: SupabaseClient;
  userId: string;
  anonymousIds: string[];
  errors: string[];
}) {
  const results = await Promise.all([
    supabase
      .from("evening_delivery_choice_resolutions")
      .delete()
      .eq("user_id", userId),
    ...anonymousIds.map((anonymousId) =>
      supabase
        .from("evening_delivery_choice_resolutions")
        .delete()
        .eq("anonymous_id", anonymousId),
    ),
  ]);

  for (const result of results) {
    if (result.error && !isMissingEveningChoiceResolutionTable(result.error)) {
      errors.push(`choice resolution delete: ${result.error.message}`);
    }
  }
}

function isMissingEveningChoiceResolutionTable(error: {
  code?: string;
  message?: string;
}) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /evening_delivery_choice_resolutions.*(?:not exist|schema cache)/i.test(
      error.message ?? "",
    )
  );
}

async function resolveAuthorizedAnonymousIds({
  anonymousId,
  errors,
  skippedAnonymousIds,
  supabase,
  userId,
}: {
  anonymousId?: string | null;
  errors: string[];
  skippedAnonymousIds: string[];
  supabase: SupabaseClient;
  userId: string;
}) {
  if (!anonymousId) {
    return [];
  }

  const hasContact = await hasAnonymousUserContact({
    anonymousId,
    errors,
    supabase,
    userId,
  });

  if (!hasContact) {
    skippedAnonymousIds.push(anonymousId);
    console.info("[account/delete-stored-data] skipped anonymous id cleanup", {
      reason: "no_user_contact",
      userId,
    });
    return [];
  }

  return [anonymousId];
}

async function hasAnonymousUserContact({
  anonymousId,
  errors,
  supabase,
  userId,
}: {
  anonymousId: string;
  errors: string[];
  supabase: SupabaseClient;
  userId: string;
}) {
  const checks = [
    countRows(
      supabase
        .from("app_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("anonymous_id", anonymousId),
      "anonymous contact app_events",
      errors,
    ),
    countRows(
      supabase
        .from("product_analytics_events")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("anonymous_id", anonymousId),
      "anonymous contact product_analytics_events",
      errors,
    ),
    countRows(
      supabase
        .from("mikke_window_answers")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("anonymous_id", anonymousId),
      "anonymous contact mikke_window_answers",
      errors,
    ),
    countRows(
      supabase
        .from("referral_claims")
        .select("id", { count: "exact", head: true })
        .eq("referred_user_id", userId)
        .eq("anonymous_id", anonymousId),
      "anonymous contact referral_claims",
      errors,
    ),
  ];

  return (await Promise.all(checks)).some((count) => count > 0);
}

async function countRows(
  query: PromiseLike<{ count: number | null; error: { message: string } | null }>,
  label: string,
  errors: string[],
) {
  const { count, error } = await query;

  if (error) {
    errors.push(`${label}: ${error.message}`);
    return 0;
  }

  return count ?? 0;
}

export async function copyPreservedDeliveryPhotos(
  supabase: SupabaseClient,
  copies: ReturnType<typeof buildAccountStorageDeletionPlan>["copies"],
  errors: string[],
) {
  const copiedSourcePaths: string[] = [];

  for (const copy of copies) {
    const { error: copyError } = await supabase.storage
      .from(CAT_PHOTOS_BUCKET)
      .copy(copy.sourcePath, copy.archivePath);

    if (copyError) {
      errors.push(`storage preserve ${copy.sourcePath}: ${copyError.message}`);
      continue;
    }

    const { data: updateData, error: updateError } = await supabase
      .from("cat_moment_deliveries")
      .update({ photo_url: copy.targetPhotoUrl })
      .in("photo_url", copy.sourceUrlVariants)
      .in("status", [...PRESERVED_DELIVERY_STATUSES])
      .select("id");

    if (updateError) {
      errors.push(`delivery preserve ${copy.sourcePath}: ${updateError.message}`);
      continue;
    }

    if ((updateData?.length ?? 0) === 0) {
      errors.push(`delivery preserve ${copy.sourcePath}: no rows updated`);
      continue;
    }

    copiedSourcePaths.push(copy.sourcePath);
  }

  return copiedSourcePaths;
}

async function deleteStoragePaths(
  supabase: SupabaseClient,
  paths: string[],
  errors: string[],
) {
  for (let index = 0; index < paths.length; index += DELETE_CHUNK_SIZE) {
    const chunk = paths.slice(index, index + DELETE_CHUNK_SIZE);

    if (chunk.length === 0) {
      continue;
    }

    const { error } = await supabase.storage.from(CAT_PHOTOS_BUCKET).remove(chunk);

    if (error) {
      errors.push(`storage remove: ${error.message}`);
    }
  }
}

async function readPreservedDeliveryRowsForPrefix(
  supabase: SupabaseClient,
  prefix: string,
  errors: string[],
) {
  const rows: CatMomentDeliveryRow[] = [];

  for (let from = 0; ; from += DELIVERY_QUERY_LIMIT) {
    const to = from + DELIVERY_QUERY_LIMIT - 1;
    const { data, error } = await supabase
      .from("cat_moment_deliveries")
      .select("photo_url, status")
      .in("status", [...PRESERVED_DELIVERY_STATUSES])
      .or(`photo_url.like.storage:${prefix}/%,photo_url.like.storage://${prefix}/%`)
      .range(from, to);

    if (error) {
      errors.push(`delivery storage refs: ${error.message}`);
      return rows;
    }

    rows.push(...((data ?? []) as CatMomentDeliveryRow[]));

    if ((data?.length ?? 0) < DELIVERY_QUERY_LIMIT) {
      return rows;
    }
  }
}

async function listStoragePaths(
  supabase: SupabaseClient,
  prefix: string,
  errors: string[],
  depth = 0,
): Promise<string[]> {
  if (depth > 8) {
    return [];
  }

  const { data, error } = await supabase.storage
    .from(CAT_PHOTOS_BUCKET)
    .list(prefix, { limit: STORAGE_LIST_LIMIT });

  if (error) {
    errors.push(`storage list ${prefix}: ${error.message}`);
    return [];
  }

  const paths: string[] = [];

  for (const item of data ?? []) {
    const itemPath = `${prefix}/${item.name}`;

    if (item.id) {
      paths.push(itemPath);
    } else {
      paths.push(...(await listStoragePaths(supabase, itemPath, errors, depth + 1)));
    }
  }

  return paths;
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(/\s+/);

  return scheme?.toLowerCase() === "bearer" ? token : null;
}

function normalizeAnonymousId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0 || trimmed.length > 120) {
    return null;
  }

  return /^[a-zA-Z0-9._:-]+$/.test(trimmed) ? trimmed : null;
}

function checkDeleteRateLimit(userId: string) {
  const now = Date.now();

  for (const [bucketUserId, resetAt] of deleteRateLimitBuckets) {
    if (resetAt <= now) {
      deleteRateLimitBuckets.delete(bucketUserId);
    }
  }

  if (deleteRateLimitBuckets.size > DELETE_RATE_LIMIT_MAX_BUCKETS) {
    const oldestKey = deleteRateLimitBuckets.keys().next().value;
    if (oldestKey) {
      deleteRateLimitBuckets.delete(oldestKey);
    }
  }

  const resetAt = deleteRateLimitBuckets.get(userId);

  if (resetAt && resetAt > now) {
    return false;
  }

  deleteRateLimitBuckets.set(userId, now + DELETE_RATE_LIMIT_WINDOW_MS);
  return true;
}
