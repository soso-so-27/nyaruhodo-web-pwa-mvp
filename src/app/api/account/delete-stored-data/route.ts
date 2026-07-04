import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  buildAccountStorageDeletionPlan,
  getArchivedDeliveryStoragePath,
  PRESERVED_DELIVERY_STATUSES,
  type DeliveryStorageReference,
} from "../../../../lib/accountDeletionStorage";
import { CAT_PHOTOS_BUCKET } from "../../../../lib/photoStorage";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getSupabasePublicConfig } from "../../../../lib/supabase/config";

const STORAGE_LIST_LIMIT = 1000;
const DELETE_CHUNK_SIZE = 100;
const DELIVERY_QUERY_LIMIT = 1000;

type AccountDeleteResult = {
  deletedStoragePaths: number;
  errors: string[];
  preservedDeliveryPhotos: number;
  status: "deleted" | "error" | "skipped";
};

type CatMomentDeliveryRow = DeliveryStorageReference;

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

  const result = await deleteStoredDataForUser(supabase, userId);

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

async function deleteStoredDataForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<AccountDeleteResult> {
  const errors: string[] = [];
  const storagePaths = await listStoragePaths(supabase, userId, errors);
  const deliveryRows = await readPreservedDeliveryRowsForPrefix(
    supabase,
    userId,
    errors,
  );
  const deletionPlan = buildAccountStorageDeletionPlan({
    archivePathForSource: (sourcePath) =>
      getArchivedDeliveryStoragePath(sourcePath, randomUUID()),
    deliveryRows,
    ownerPrefix: userId,
    storagePaths,
  });
  const copiedSourcePaths = await copyPreservedDeliveryPhotos(
    supabase,
    deletionPlan.copies,
    errors,
  );
  const deletablePaths = [
    ...deletionPlan.deletablePaths,
    ...copiedSourcePaths,
  ];

  await deleteStoragePaths(supabase, deletablePaths, errors);

  const deleteSteps = [
    supabase.from("cat_moment_deliveries").delete().eq("user_id", userId),
    supabase.from("cat_moments").delete().eq("user_id", userId),
    supabase.from("collection_photos").delete().eq("user_id", userId),
    supabase.from("record_logs").delete().eq("user_id", userId),
    supabase.from("account_sync_state").delete().eq("user_id", userId),
    supabase.from("cats").delete().eq("owner_user_id", userId),
  ];
  const results = await Promise.all(deleteSteps);

  results.forEach((result, index) => {
    if (result.error) {
      errors.push(`delete step ${index + 1}: ${result.error.message}`);
    }
  });

  return {
    deletedStoragePaths: deletablePaths.length,
    errors,
    preservedDeliveryPhotos: copiedSourcePaths.length,
    status: errors.length > 0 ? "error" : "deleted",
  };
}

async function copyPreservedDeliveryPhotos(
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

    const { error: updateError } = await supabase
      .from("cat_moment_deliveries")
      .update({ photo_url: copy.targetPhotoUrl })
      .in("photo_url", copy.sourceUrlVariants)
      .in("status", [...PRESERVED_DELIVERY_STATUSES]);

    if (updateError) {
      errors.push(`delivery preserve ${copy.sourcePath}: ${updateError.message}`);
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
