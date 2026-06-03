import { STORAGE_KEYS, getRecordLogKey } from "./storage";
import { createBrowserSupabaseClient } from "./supabase/browser";
import {
  readKeptExchangePhotos,
  readOwnSleepingPhotos,
  restoreSyncedSleepingPhotos,
  type ExchangePhoto,
  type OwnSleepingPhoto,
} from "./home/sleepingPhotos";

type LocalCatProfile = {
  id: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
  homePhotoDataUrl?: string;
  homePhotoPosition?: string;
  avatarDataUrl?: string;
  basicInfo?: Record<string, unknown>;
  appearance?: Record<string, unknown>;
  typeKey?: string;
  typeLabel?: string;
  typeTagline?: string;
  typeScores?: Record<string, unknown>;
  axisScores?: Record<string, unknown>;
  activityPattern?: Record<string, unknown>;
  modifiers?: unknown[];
  onboarding?: Record<string, unknown>;
  understanding?: Record<string, unknown>;
};

type LocalRecordLogItem = {
  id?: string;
  type?: string;
  value?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
};

type LocalCollectionStore = Record<string, Record<string, string[] | string>>;

type LocalSnapshot = {
  activeCatId: string | null;
  profiles: LocalCatProfile[];
  recordLogsByCatId: Map<string, LocalRecordLogItem[]>;
  collectionPhotos: LocalCollectionStore;
  ownSleepingPhotos: OwnSleepingPhoto[];
  keptExchangePhotos: ExchangePhoto[];
  hasCompletedOnboarding: boolean;
};

type RemoteCatRow = {
  id: string;
  local_cat_id: string | null;
  name: string;
  type_key: string | null;
  type_label: string | null;
  type_tagline: string | null;
  basic_info: Record<string, unknown> | null;
  appearance: Record<string, unknown> | null;
  axis_scores: Record<string, unknown> | null;
  activity_pattern: Record<string, unknown> | null;
  type_scores: Record<string, unknown> | null;
  modifiers: unknown[] | null;
  onboarding: Record<string, unknown> | null;
  understanding: Record<string, unknown> | null;
  avatar_storage_path: string | null;
  home_photo_storage_path: string | null;
  home_photo_position: string | null;
  local_created_at: string | null;
  local_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

type RemoteRecordLogRow = {
  id: string;
  cat_id: string;
  local_cat_id: string | null;
  local_record_id: string | null;
  record_type: "yousu" | "mugi" | "reaction" | "photo";
  value: string;
  metadata: Record<string, unknown> | null;
  occurred_at: string;
};

type RemoteCollectionPhotoRow = {
  id: string;
  cat_id: string;
  local_cat_id: string | null;
  local_photo_id: string | null;
  slot_slug: string;
  storage_path: string;
  captured_at: string | null;
  created_at: string;
};

type RemoteCatMomentRow = {
  id: string;
  local_moment_id: string;
  local_cat_id: string;
  owner_cat_id: string;
  photo_url: string;
  state: "sleeping";
  visibility: "private" | "shared";
  delivery_status: "available" | "hidden" | "reported";
  source_moment_id: string | null;
  metadata: Record<string, unknown> | null;
  captured_at: string | null;
  created_at: string;
};

type RemoteCatMomentDeliveryRow = {
  id: string;
  local_delivery_id: string;
  source_moment_id: string | null;
  source_photo_id: string | null;
  recipient_local_cat_id: string | null;
  photo_url: string;
  status: "delivered" | "kept" | "dismissed" | "hidden" | "reported";
  metadata: Record<string, unknown> | null;
  delivered_at: string;
};

type SyncStatus = "skipped" | "synced" | "restored" | "error";

export type AccountSyncResult = {
  status: SyncStatus;
  pushedCats: number;
  pushedRecords: number;
  pushedCollectionPhotos: number;
  pushedOwnSleepingPhotos: number;
  pushedKeptExchangePhotos: number;
  restoredCats: number;
  restoredRecords: number;
  restoredCollectionPhotos: number;
  restoredOwnSleepingPhotos: number;
  restoredKeptExchangePhotos: number;
  errors: string[];
};

export type AccountSyncOverview = {
  isLoggedIn: boolean;
  hasLocalData: boolean;
  localCats: number;
  remoteCats: number;
  remoteRecords: number;
  remoteCollectionPhotos: number;
  remoteOwnSleepingPhotos: number;
  remoteKeptExchangePhotos: number;
  lastPushAt: string | null;
  lastPullAt: string | null;
  shouldSuggestRestore: boolean;
};

const CAT_PHOTOS_BUCKET = "cat-photos";
const SYNC_METADATA = { source: "localStorage-v1" };

export async function getAccountSyncOverview(): Promise<AccountSyncOverview> {
  const emptyOverview: AccountSyncOverview = {
    isLoggedIn: false,
    hasLocalData: false,
    localCats: 0,
    remoteCats: 0,
    remoteRecords: 0,
    remoteCollectionPhotos: 0,
    remoteOwnSleepingPhotos: 0,
    remoteKeptExchangePhotos: 0,
    lastPushAt: null,
    lastPullAt: null,
    shouldSuggestRestore: false,
  };

  if (typeof window === "undefined") {
    return emptyOverview;
  }

  const snapshot = readLocalSnapshot();
  const localCats = snapshot.profiles.length;
  const hasLocalData = hasMeaningfulLocalData(snapshot);
  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return { ...emptyOverview, hasLocalData, localCats };
  }

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return { ...emptyOverview, hasLocalData, localCats };
  }

  const userId = data.user.id;
  const [
    catsResult,
    recordsResult,
    collectionResult,
    ownSleepingResult,
    keptExchangeResult,
    syncStateResult,
  ] =
    await Promise.all([
      supabase
        .from("cats")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", userId),
      supabase
        .from("record_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("collection_photos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("cat_moments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("cat_moment_deliveries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "kept"),
      supabase
        .from("account_sync_state")
        .select("last_push_at,last_pull_at")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  const remoteCats = catsResult.count ?? 0;
  const remoteRecords = recordsResult.count ?? 0;
  const remoteCollectionPhotos = collectionResult.count ?? 0;
  const remoteOwnSleepingPhotos = ownSleepingResult.count ?? 0;
  const remoteKeptExchangePhotos = keptExchangeResult.count ?? 0;
  const syncState = syncStateResult.data as
    | { last_push_at?: string | null; last_pull_at?: string | null }
    | null;

  return {
    isLoggedIn: true,
    hasLocalData,
    localCats,
    remoteCats,
    remoteRecords,
    remoteCollectionPhotos,
    remoteOwnSleepingPhotos,
    remoteKeptExchangePhotos,
    lastPushAt: syncState?.last_push_at ?? null,
    lastPullAt: syncState?.last_pull_at ?? null,
    shouldSuggestRestore:
      remoteCats > 0 &&
      (!hasLocalData ||
        remoteCats > localCats ||
        remoteOwnSleepingPhotos > snapshot.ownSleepingPhotos.length ||
        remoteKeptExchangePhotos > snapshot.keptExchangePhotos.length),
  };
}

export async function syncLocalDataWithAccount(options?: {
  restoreIfLocalEmpty?: boolean;
  forceRestore?: boolean;
}): Promise<AccountSyncResult> {
  const result = createEmptyResult();

  if (typeof window === "undefined") {
    return { ...result, status: "skipped" };
  }

  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return { ...result, status: "skipped" };
  }

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return {
      ...result,
      status: error ? "error" : "skipped",
      errors: error ? [error.message] : [],
    };
  }

  const snapshot = readLocalSnapshot();
  const shouldPush = hasMeaningfulLocalData(snapshot);
  const shouldRestore = options?.restoreIfLocalEmpty ?? true;
  const shouldForceRestore = options?.forceRestore ?? false;

  try {
    await ensureRemoteProfile(supabase, data.user.id, data.user.user_metadata);

    if (shouldForceRestore) {
      await restoreRemoteSnapshot(supabase, data.user.id, result, {
        mergeLocal: false,
      });
      if (hasRestoredAccountData(result)) {
        await saveSyncState(supabase, data.user.id, {
          last_pull_at: new Date().toISOString(),
        });
        return { ...result, status: "restored" };
      }
      return { ...result, status: "skipped" };
    }

    if (shouldPush) {
      await pushLocalSnapshot(supabase, data.user.id, snapshot, result);
      await restoreRemoteSnapshot(supabase, data.user.id, result, {
        mergeLocal: true,
      });
      await saveSyncState(supabase, data.user.id, {
        last_push_at: new Date().toISOString(),
        ...(hasRestoredAccountData(result)
          ? { last_pull_at: new Date().toISOString() }
          : {}),
      });
      return { ...result, status: "synced" };
    }

    if (shouldRestore) {
      await restoreRemoteSnapshot(supabase, data.user.id, result, {
        mergeLocal: false,
      });
      if (hasRestoredAccountData(result)) {
        await saveSyncState(supabase, data.user.id, {
          last_pull_at: new Date().toISOString(),
        });
        return { ...result, status: "restored" };
      }
    }

    return { ...result, status: "skipped" };
  } catch (syncError) {
    return {
      ...result,
      status: "error",
      errors: [
        syncError instanceof Error ? syncError.message : "Unknown account sync error",
      ],
    };
  }
}

function hasRestoredAccountData(result: AccountSyncResult) {
  return (
    result.restoredCats > 0 ||
    result.restoredRecords > 0 ||
    result.restoredCollectionPhotos > 0 ||
    result.restoredOwnSleepingPhotos > 0 ||
    result.restoredKeptExchangePhotos > 0
  );
}

function createEmptyResult(): AccountSyncResult {
  return {
    status: "skipped",
    pushedCats: 0,
    pushedRecords: 0,
    pushedCollectionPhotos: 0,
    pushedOwnSleepingPhotos: 0,
    pushedKeptExchangePhotos: 0,
    restoredCats: 0,
    restoredRecords: 0,
    restoredCollectionPhotos: 0,
    restoredOwnSleepingPhotos: 0,
    restoredKeptExchangePhotos: 0,
    errors: [],
  };
}

function readLocalSnapshot(): LocalSnapshot {
  const profiles = normalizeProfiles(
    readJson<LocalCatProfile[] | Record<string, LocalCatProfile>>(
      STORAGE_KEYS.catProfiles,
    ),
  );
  const collectionPhotos =
    readJson<LocalCollectionStore>(STORAGE_KEYS.collectionPhotos) ?? {};
  const ownSleepingPhotos = readOwnSleepingPhotos();
  const keptExchangePhotos = readKeptExchangePhotos();
  const recordLogsByCatId = new Map<string, LocalRecordLogItem[]>();

  for (const profile of profiles) {
    recordLogsByCatId.set(
      profile.id,
      readJson<LocalRecordLogItem[]>(getRecordLogKey(profile.id)) ?? [],
    );
  }

  return {
    activeCatId: window.localStorage.getItem(STORAGE_KEYS.activeCatId),
    profiles,
    recordLogsByCatId,
    collectionPhotos,
    ownSleepingPhotos,
    keptExchangePhotos,
    hasCompletedOnboarding:
      window.localStorage.getItem(STORAGE_KEYS.onboardingCompleted) === "true",
  };
}

function normalizeProfiles(
  value: LocalCatProfile[] | Record<string, LocalCatProfile> | null,
): LocalCatProfile[] {
  if (!value) {
    return [];
  }

  const profiles = Array.isArray(value)
    ? value
    : Object.entries(value).map(([id, profile]) => ({ ...profile, id: profile.id ?? id }));

  return profiles.filter((profile): profile is LocalCatProfile =>
    Boolean(profile && typeof profile.id === "string" && profile.id),
  );
}

function hasMeaningfulLocalData(snapshot: LocalSnapshot) {
  if (snapshot.profiles.length === 0) {
    return false;
  }

  if (snapshot.hasCompletedOnboarding) {
    return true;
  }

  if (
    snapshot.profiles.some(
      (profile) =>
        profile.typeKey ||
        profile.typeLabel ||
        profile.avatarDataUrl ||
        profile.homePhotoDataUrl ||
        profile.basicInfo ||
        profile.onboarding ||
        profile.understanding,
    )
  ) {
    return true;
  }

  for (const records of snapshot.recordLogsByCatId.values()) {
    if (records.length > 0) {
      return true;
    }
  }

  return Object.values(snapshot.collectionPhotos).some((catPhotos) =>
    Object.values(catPhotos).some((photos) =>
      Array.isArray(photos) ? photos.length > 0 : Boolean(photos),
    ),
  ) || snapshot.ownSleepingPhotos.length > 0 || snapshot.keptExchangePhotos.length > 0;
}

async function ensureRemoteProfile(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
  metadata: Record<string, unknown> | null | undefined,
) {
  const displayName =
    typeof metadata?.name === "string"
      ? metadata.name
      : typeof metadata?.full_name === "string"
        ? metadata.full_name
        : null;

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, display_name: displayName }, { onConflict: "id" });

  if (error) {
    throw new Error(`Profile sync failed: ${error.message}`);
  }
}

async function pushLocalSnapshot(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
  snapshot: LocalSnapshot,
  result: AccountSyncResult,
) {
  const remoteCatIds = new Map<string, string>();

  for (const profile of snapshot.profiles) {
    const remoteCatId = await syncCatProfile(supabase, userId, profile);
    remoteCatIds.set(profile.id, remoteCatId);
    result.pushedCats += 1;
  }

  await syncRecordLogs(supabase, userId, snapshot.recordLogsByCatId, remoteCatIds, result);
  await syncCollectionPhotos(
    supabase,
    userId,
    snapshot.collectionPhotos,
    remoteCatIds,
    result,
  );
  await syncSleepingPhotos(supabase, userId, snapshot, result);
}

async function syncCatProfile(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
  profile: LocalCatProfile,
) {
  const payload = {
    owner_user_id: userId,
    local_cat_id: profile.id,
    name: profile.name || "ねこ",
    type_key: profile.typeKey ?? null,
    type_label: profile.typeLabel ?? null,
    type_tagline: profile.typeTagline ?? null,
    basic_info: toJsonObject(profile.basicInfo),
    appearance: toJsonObject(profile.appearance),
    axis_scores: toJsonObject(profile.axisScores),
    activity_pattern: toJsonObject(profile.activityPattern),
    type_scores: toJsonObject(profile.typeScores),
    modifiers: Array.isArray(profile.modifiers) ? profile.modifiers : [],
    onboarding: toJsonObject(profile.onboarding),
    understanding: toJsonObject(profile.understanding),
    home_photo_position: profile.homePhotoPosition ?? null,
    metadata: SYNC_METADATA,
    local_created_at: toIsoStringOrNull(profile.createdAt),
    local_updated_at: toIsoStringOrNull(profile.updatedAt),
  };

  const { data: existing, error: findError } = await supabase
    .from("cats")
    .select("id")
    .eq("owner_user_id", userId)
    .eq("local_cat_id", profile.id)
    .maybeSingle();

  if (findError) {
    throw new Error(`Cat lookup failed: ${findError.message}`);
  }

  let remoteCatId = (existing as { id?: string } | null)?.id ?? null;

  if (remoteCatId) {
    const { error } = await supabase.from("cats").update(payload).eq("id", remoteCatId);
    if (error) {
      throw new Error(`Cat update failed: ${error.message}`);
    }
  } else {
    const { data, error } = await supabase
      .from("cats")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      throw new Error(`Cat insert failed: ${error.message}`);
    }

    remoteCatId = (data as { id: string }).id;
  }

  const photoUpdates: Record<string, string | null> = {};

  if (profile.avatarDataUrl?.startsWith("data:")) {
    photoUpdates.avatar_storage_path = await uploadDataUrl(
      supabase,
      `${userId}/${remoteCatId}/avatar/avatar.${getDataUrlExtension(profile.avatarDataUrl)}`,
      profile.avatarDataUrl,
    );
  }

  if (profile.homePhotoDataUrl?.startsWith("data:")) {
    photoUpdates.home_photo_storage_path = await uploadDataUrl(
      supabase,
      `${userId}/${remoteCatId}/home/home.${getDataUrlExtension(profile.homePhotoDataUrl)}`,
      profile.homePhotoDataUrl,
    );
  }

  if (Object.keys(photoUpdates).length > 0) {
    const { error } = await supabase
      .from("cats")
      .update(photoUpdates)
      .eq("id", remoteCatId);

    if (error) {
      throw new Error(`Cat photo update failed: ${error.message}`);
    }
  }

  return remoteCatId;
}

async function syncRecordLogs(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
  recordLogsByCatId: Map<string, LocalRecordLogItem[]>,
  remoteCatIds: Map<string, string>,
  result: AccountSyncResult,
) {
  const rows = [...recordLogsByCatId.entries()].flatMap(([localCatId, records]) => {
    const remoteCatId = remoteCatIds.get(localCatId);
    if (!remoteCatId) {
      return [];
    }

    return records
      .filter(isSyncableRecord)
      .map((record) => ({
        user_id: userId,
        cat_id: remoteCatId,
        local_cat_id: localCatId,
        local_record_id: record.id ?? null,
        record_type: record.type,
        value: record.value,
        metadata: { ...SYNC_METADATA, ...(record.metadata ?? {}) },
        occurred_at: new Date(record.timestamp ?? Date.now()).toISOString(),
      }));
  });

  const missingRows = await filterRowsMissingByLocalId(
    supabase,
    "record_logs",
    userId,
    rows,
    "local_record_id",
  );

  if (missingRows.length === 0) {
    return;
  }

  const { error } = await supabase.from("record_logs").insert(missingRows);

  if (error) {
    throw new Error(`Record log sync failed: ${error.message}`);
  }

  result.pushedRecords += missingRows.length;
}

async function syncCollectionPhotos(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
  collectionPhotos: LocalCollectionStore,
  remoteCatIds: Map<string, string>,
  result: AccountSyncResult,
) {
  const rows = [];

  for (const [localCatId, photosBySlot] of Object.entries(collectionPhotos)) {
    const remoteCatId = remoteCatIds.get(localCatId);

    if (!remoteCatId) {
      continue;
    }

    for (const [slotSlug, rawPhotos] of Object.entries(photosBySlot)) {
      const photos = Array.isArray(rawPhotos) ? rawPhotos : [rawPhotos];

      for (const [index, src] of photos.entries()) {
        if (!src?.startsWith("data:")) {
          continue;
        }

        const localPhotoId = `${localCatId}:${slotSlug}:${index}`;
        const storagePath = await uploadDataUrl(
          supabase,
          `${userId}/${remoteCatId}/collection/${sanitizePathSegment(
            slotSlug,
          )}/${sanitizePathSegment(localPhotoId)}.${getDataUrlExtension(src)}`,
          src,
        );

        rows.push({
          user_id: userId,
          cat_id: remoteCatId,
          local_cat_id: localCatId,
          local_photo_id: localPhotoId,
          slot_slug: slotSlug,
          storage_path: storagePath,
          metadata: SYNC_METADATA,
        });
      }
    }
  }

  const missingRows = await filterRowsMissingByLocalId(
    supabase,
    "collection_photos",
    userId,
    rows,
    "local_photo_id",
  );

  if (missingRows.length === 0) {
    return;
  }

  const { error } = await supabase.from("collection_photos").insert(missingRows);

  if (error) {
    throw new Error(`Collection photo sync failed: ${error.message}`);
  }

  result.pushedCollectionPhotos += missingRows.length;
}

async function syncSleepingPhotos(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
  snapshot: LocalSnapshot,
  result: AccountSyncResult,
) {
  const momentRows = snapshot.ownSleepingPhotos.map((photo) => ({
    user_id: userId,
    anonymous_id: null,
    local_moment_id: photo.id,
    local_cat_id: photo.catId,
    owner_cat_id: photo.ownerCatId,
    photo_url: photo.src,
    state: photo.state,
    visibility: photo.visibility,
    delivery_status: photo.deliveryStatus,
    source_moment_id: photo.sourceMomentId ?? null,
    metadata: {
      ...SYNC_METADATA,
      trigger_label: photo.triggerLabel,
      theme: photo.theme,
      shared: photo.shared,
    },
    captured_at: new Date(photo.createdAt).toISOString(),
    created_at: new Date(photo.createdAt).toISOString(),
  }));

  if (momentRows.length > 0) {
    const localMomentIds = momentRows.map((row) => row.local_moment_id);
    const { error: deleteError } = await supabase
      .from("cat_moments")
      .delete()
      .eq("user_id", userId)
      .in("local_moment_id", localMomentIds);

    if (deleteError) {
      throw new Error(`Sleeping photo cleanup failed: ${deleteError.message}`);
    }

    const { error } = await supabase.from("cat_moments").insert(momentRows);

    if (error) {
      throw new Error(`Sleeping photo sync failed: ${error.message}`);
    }

    result.pushedOwnSleepingPhotos += momentRows.length;
  }

  const deliveryRows = snapshot.keptExchangePhotos.map((photo) => ({
    user_id: userId,
    anonymous_id: null,
    local_delivery_id: photo.id,
    source_moment_id: null,
    source_photo_id: photo.sourcePhotoId ?? null,
    recipient_local_cat_id: null,
    photo_url: photo.src,
    status: "kept",
    metadata: {
      ...SYNC_METADATA,
      title: photo.title,
      subtitle: photo.subtitle,
      trigger_label: photo.triggerLabel,
      theme: photo.theme,
    },
    delivered_at: new Date(photo.deliveredAt).toISOString(),
  }));

  if (deliveryRows.length === 0) {
    return;
  }

  const localDeliveryIds = deliveryRows.map((row) => row.local_delivery_id);
  const { error: deleteError } = await supabase
    .from("cat_moment_deliveries")
    .delete()
    .eq("user_id", userId)
    .in("local_delivery_id", localDeliveryIds);

  if (deleteError) {
    throw new Error(`Kept photo cleanup failed: ${deleteError.message}`);
  }

  const { error } = await supabase.from("cat_moment_deliveries").insert(deliveryRows);

  if (error) {
    throw new Error(`Kept photo sync failed: ${error.message}`);
  }

  result.pushedKeptExchangePhotos += deliveryRows.length;
}

async function restoreRemoteSnapshot(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
  result: AccountSyncResult,
  options: { mergeLocal: boolean },
) {
  const { data: cats, error: catsError } = await supabase
    .from("cats")
    .select("*")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true });

  if (catsError) {
    throw new Error(`Cat restore failed: ${catsError.message}`);
  }

  const remoteCats = ((cats ?? []) as RemoteCatRow[]).filter(Boolean);
  const remoteIdToLocalId = new Map<string, string>();

  if (remoteCats.length === 0) {
    await restoreSleepingPhotos(supabase, userId, remoteIdToLocalId, result, options);
    return;
  }

  const localProfiles = options.mergeLocal
    ? normalizeProfiles(
        readJson<LocalCatProfile[] | Record<string, LocalCatProfile>>(
          STORAGE_KEYS.catProfiles,
        ),
      )
    : [];
  const profiles: LocalCatProfile[] = [...localProfiles];
  const remoteLocalCatIds: string[] = [];

  for (const cat of remoteCats) {
    const localCatId = cat.local_cat_id ?? `remote-cat-${cat.id}`;
    remoteIdToLocalId.set(cat.id, localCatId);
    remoteLocalCatIds.push(localCatId);

    const restoredProfile = {
      id: localCatId,
      name: cat.name,
      createdAt: cat.local_created_at ?? cat.created_at,
      updatedAt: cat.local_updated_at ?? cat.updated_at,
      homePhotoDataUrl: cat.home_photo_storage_path
        ? await downloadStoragePath(supabase, cat.home_photo_storage_path)
        : undefined,
      homePhotoPosition: cat.home_photo_position ?? undefined,
      avatarDataUrl: cat.avatar_storage_path
        ? await downloadStoragePath(supabase, cat.avatar_storage_path)
        : undefined,
      basicInfo: cat.basic_info ?? undefined,
      appearance: cat.appearance ?? undefined,
      typeKey: cat.type_key ?? undefined,
      typeLabel: cat.type_label ?? undefined,
      typeTagline: cat.type_tagline ?? undefined,
      typeScores: cat.type_scores ?? undefined,
      axisScores: cat.axis_scores ?? undefined,
      activityPattern: cat.activity_pattern ?? undefined,
      modifiers: cat.modifiers ?? undefined,
      onboarding: cat.onboarding ?? undefined,
      understanding: cat.understanding ?? undefined,
    };
    const existingIndex = profiles.findIndex((profile) => profile.id === localCatId);

    if (existingIndex >= 0) {
      profiles[existingIndex] = {
        ...profiles[existingIndex],
        ...restoredProfile,
      };
    } else {
      profiles.push(restoredProfile);
    }
  }

  window.localStorage.setItem(STORAGE_KEYS.catProfiles, JSON.stringify(profiles));
  const previousActiveCatId = window.localStorage.getItem(STORAGE_KEYS.activeCatId);
  const nextActiveCatId =
    options.mergeLocal &&
    previousActiveCatId &&
    remoteLocalCatIds.includes(previousActiveCatId)
      ? previousActiveCatId
      : remoteLocalCatIds[0] ?? profiles[0].id;

  window.localStorage.setItem(STORAGE_KEYS.activeCatId, nextActiveCatId);
  window.localStorage.setItem(STORAGE_KEYS.onboardingCompleted, "true");
  result.restoredCats = profiles.length;

  await restoreRecordLogs(supabase, userId, remoteIdToLocalId, result, options);
  await restoreCollectionPhotos(supabase, userId, remoteIdToLocalId, result, options);
  await restoreSleepingPhotos(supabase, userId, remoteIdToLocalId, result, options);
}

async function restoreRecordLogs(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
  remoteIdToLocalId: Map<string, string>,
  result: AccountSyncResult,
  options: { mergeLocal: boolean },
) {
  const { data, error } = await supabase
    .from("record_logs")
    .select(
      "id, cat_id, local_cat_id, local_record_id, record_type, value, metadata, occurred_at",
    )
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false });

  if (error) {
    throw new Error(`Record restore failed: ${error.message}`);
  }

  const recordsByCat = new Map<string, LocalRecordLogItem[]>();

  for (const record of (data ?? []) as RemoteRecordLogRow[]) {
    if (!["yousu", "mugi", "reaction"].includes(record.record_type)) {
      continue;
    }

    const localCatId =
      record.local_cat_id ?? remoteIdToLocalId.get(record.cat_id) ?? null;

    if (!localCatId) {
      continue;
    }

    const records = recordsByCat.get(localCatId) ?? [];
    records.push({
      id: record.local_record_id ?? record.id,
      type: record.record_type,
      value: record.value,
      metadata: record.metadata ?? undefined,
      timestamp: new Date(record.occurred_at).getTime(),
    });
    recordsByCat.set(localCatId, records);
  }

  for (const [localCatId, records] of recordsByCat.entries()) {
    const mergedRecords = options.mergeLocal
      ? mergeRecordLogs(
          readJson<LocalRecordLogItem[]>(getRecordLogKey(localCatId)) ?? [],
          records,
        )
      : records;

    window.localStorage.setItem(
      getRecordLogKey(localCatId),
      JSON.stringify(mergedRecords),
    );
    result.restoredRecords += records.length;
  }
}

async function restoreCollectionPhotos(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
  remoteIdToLocalId: Map<string, string>,
  result: AccountSyncResult,
  options: { mergeLocal: boolean },
) {
  const { data, error } = await supabase
    .from("collection_photos")
    .select("id, cat_id, local_cat_id, local_photo_id, slot_slug, storage_path, captured_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Collection restore failed: ${error.message}`);
  }

  const collectionStore: LocalCollectionStore = options.mergeLocal
    ? readJson<LocalCollectionStore>(STORAGE_KEYS.collectionPhotos) ?? {}
    : {};

  for (const photo of (data ?? []) as RemoteCollectionPhotoRow[]) {
    const localCatId =
      photo.local_cat_id ?? remoteIdToLocalId.get(photo.cat_id) ?? null;

    if (!localCatId) {
      continue;
    }

    const dataUrl = await downloadStoragePath(supabase, photo.storage_path);

    if (!dataUrl) {
      continue;
    }

    collectionStore[localCatId] ??= {};
    const current = collectionStore[localCatId][photo.slot_slug];
    const photos = Array.isArray(current) ? current : current ? [current] : [];
    photos.push(dataUrl);
    collectionStore[localCatId][photo.slot_slug] = photos;
    result.restoredCollectionPhotos += 1;
  }

  if (Object.keys(collectionStore).length > 0) {
    window.localStorage.setItem(
      STORAGE_KEYS.collectionPhotos,
      JSON.stringify(collectionStore),
    );
  }
}

async function restoreSleepingPhotos(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
  remoteIdToLocalId: Map<string, string>,
  result: AccountSyncResult,
  options: { mergeLocal: boolean },
) {
  const [momentsResult, deliveriesResult] = await Promise.all([
    supabase
      .from("cat_moments")
      .select(
        "id, local_moment_id, local_cat_id, owner_cat_id, photo_url, state, visibility, delivery_status, source_moment_id, metadata, captured_at, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(24),
    supabase
      .from("cat_moment_deliveries")
      .select(
        "id, local_delivery_id, source_moment_id, source_photo_id, recipient_local_cat_id, photo_url, status, metadata, delivered_at",
      )
      .eq("user_id", userId)
      .eq("status", "kept")
      .order("delivered_at", { ascending: false })
      .limit(50),
  ]);

  if (momentsResult.error) {
    throw new Error(`Sleeping photo restore failed: ${momentsResult.error.message}`);
  }

  if (deliveriesResult.error) {
    throw new Error(`Kept photo restore failed: ${deliveriesResult.error.message}`);
  }

  const ownPhotos = ((momentsResult.data ?? []) as RemoteCatMomentRow[])
    .map((moment): OwnSleepingPhoto | null => {
      const localCatId =
        moment.local_cat_id ||
        remoteIdToLocalId.get(moment.owner_cat_id) ||
        moment.owner_cat_id;
      const metadata = moment.metadata ?? {};
      const createdAt = new Date(moment.captured_at ?? moment.created_at).getTime();

      if (!localCatId || !moment.photo_url || Number.isNaN(createdAt)) {
        return null;
      }

      return {
        id: moment.local_moment_id || moment.id,
        ownerCatId: localCatId,
        catId: localCatId,
        src: moment.photo_url,
        state: "sleeping",
        visibility: moment.visibility,
        deliveryStatus: moment.delivery_status,
        sourceMomentId: moment.source_moment_id ?? undefined,
        triggerLabel:
          typeof metadata.trigger_label === "string" ? metadata.trigger_label : "",
        theme: typeof metadata.theme === "string" ? metadata.theme : "sleeping",
        shared: moment.visibility === "shared" || metadata.shared === true,
        createdAt,
      };
    })
    .filter((photo): photo is OwnSleepingPhoto => Boolean(photo));

  const keptPhotos = ((deliveriesResult.data ?? []) as RemoteCatMomentDeliveryRow[])
    .map((delivery): ExchangePhoto | null => {
      const metadata = delivery.metadata ?? {};
      const deliveredAt = new Date(delivery.delivered_at).getTime();

      if (!delivery.photo_url || Number.isNaN(deliveredAt)) {
        return null;
      }

      return {
        id: delivery.local_delivery_id || delivery.id,
        sourcePhotoId:
          delivery.source_photo_id ?? delivery.source_moment_id ?? undefined,
        src: delivery.photo_url,
        title: typeof metadata.title === "string" ? metadata.title : "とどいたねがお",
        subtitle: typeof metadata.subtitle === "string" ? metadata.subtitle : "",
        triggerLabel:
          typeof metadata.trigger_label === "string" ? metadata.trigger_label : "",
        theme: typeof metadata.theme === "string" ? metadata.theme : "sleeping",
        deliveredAt,
      };
    })
    .filter((photo): photo is ExchangePhoto => Boolean(photo));

  const restored = restoreSyncedSleepingPhotos({
    ownPhotos,
    keptPhotos,
    mergeLocal: options.mergeLocal,
  });

  result.restoredOwnSleepingPhotos += restored.ownCount;
  result.restoredKeptExchangePhotos += restored.keptCount;
}

async function saveSyncState(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
  timestamps: { last_push_at?: string; last_pull_at?: string },
) {
  const { error } = await supabase.from("account_sync_state").upsert(
    {
      user_id: userId,
      metadata: SYNC_METADATA,
      ...timestamps,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(`Sync state update failed: ${error.message}`);
  }
}

async function filterRowsMissingByLocalId<T extends Record<string, unknown>>(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  table: "record_logs" | "collection_photos",
  userId: string,
  rows: T[],
  idField: "local_record_id" | "local_photo_id",
) {
  const localIds = rows
    .map((row) => row[idField])
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (localIds.length === 0) {
    return rows;
  }

  const { data, error } = await supabase
    .from(table)
    .select(idField)
    .eq("user_id", userId)
    .in(idField, localIds);

  if (error) {
    throw new Error(`Existing ${table} lookup failed: ${error.message}`);
  }

  const existingIds = new Set(
    ((data ?? []) as Record<string, string | null>[]).map((row) => row[idField]),
  );

  return rows.filter((row) => {
    const localId = row[idField];
    return !(typeof localId === "string" && existingIds.has(localId));
  });
}

async function uploadDataUrl(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  path: string,
  dataUrl: string,
) {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const { error } = await supabase.storage
    .from(CAT_PHOTOS_BUCKET)
    .upload(path, blob, {
      cacheControl: "3600",
      contentType: blob.type || "image/jpeg",
      upsert: true,
    });

  if (error) {
    throw new Error(`Photo upload failed: ${error.message}`);
  }

  return path;
}

async function downloadStoragePath(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  path: string,
) {
  const { data, error } = await supabase.storage
    .from(CAT_PHOTOS_BUCKET)
    .download(path);

  if (error || !data) {
    return undefined;
  }

  return blobToDataUrl(data);
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function mergeRecordLogs(
  existingRecords: LocalRecordLogItem[],
  restoredRecords: LocalRecordLogItem[],
) {
  const byId = new Map<string, LocalRecordLogItem>();

  for (const record of [...existingRecords, ...restoredRecords]) {
    const key = record.id ?? `${record.type}:${record.value}:${record.timestamp}`;
    byId.set(key, record);
  }

  return [...byId.values()].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
}

function readJson<T>(key: string): T | null {
  const raw = window.localStorage.getItem(key);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function toJsonObject(value: Record<string, unknown> | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function toIsoStringOrNull(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isSyncableRecord(
  record: LocalRecordLogItem,
): record is Required<Pick<LocalRecordLogItem, "type" | "value" | "timestamp">> &
  LocalRecordLogItem {
  return (
    Boolean(record.value) &&
    typeof record.timestamp === "number" &&
    (record.type === "yousu" ||
      record.type === "mugi" ||
      record.type === "reaction")
  );
}

function getDataUrlExtension(dataUrl: string) {
  const mime = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);/)?.[1];

  if (mime === "image/png") {
    return "png";
  }

  if (mime === "image/webp") {
    return "webp";
  }

  return "jpg";
}

function sanitizePathSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || "item";
}
