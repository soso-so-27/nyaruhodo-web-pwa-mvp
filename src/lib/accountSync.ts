import { STORAGE_KEYS, getRecordLogKey } from "./storage";
import { createBrowserSupabaseClient } from "./supabase/browser";
import {
  dispatchBoxPhotoStorageEvent,
  readKeptExchangePhotos,
  readOwnSleepingPhotos,
  restoreSyncedSleepingPhotos,
  type ExchangePhoto,
  type OwnSleepingPhoto,
} from "./home/sleepingPhotos";
import {
  CAT_PHOTOS_BUCKET,
  downloadStoragePath,
  getDataUrlExtension,
  sanitizePathSegment,
  toStoragePhotoUrl,
  uploadDataUrl,
} from "./photoStorage";

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

type LocalCollectionPhoto = string | { id?: string; src?: string; createdAt?: string };
type LocalCollectionStore = Record<
  string,
  Record<string, LocalCollectionPhoto[] | LocalCollectionPhoto>
>;

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
  localRecords: number;
  localCollectionPhotos: number;
  localOwnSleepingPhotos: number;
  localKeptExchangePhotos: number;
  remoteCats: number;
  remoteRecords: number;
  remoteCollectionPhotos: number;
  remoteOwnSleepingPhotos: number;
  remoteKeptExchangePhotos: number;
  lastPushAt: string | null;
  lastPullAt: string | null;
  shouldSuggestRestore: boolean;
  errors: string[];
};

export type AccountDeleteResult = {
  status: "deleted" | "skipped" | "error";
  errors: string[];
};

const SYNC_METADATA = { source: "localStorage-v1" };

export async function getAccountSyncOverview(): Promise<AccountSyncOverview> {
  const emptyOverview: AccountSyncOverview = {
    isLoggedIn: false,
    hasLocalData: false,
    localCats: 0,
    localRecords: 0,
    localCollectionPhotos: 0,
    localOwnSleepingPhotos: 0,
    localKeptExchangePhotos: 0,
    remoteCats: 0,
    remoteRecords: 0,
    remoteCollectionPhotos: 0,
    remoteOwnSleepingPhotos: 0,
    remoteKeptExchangePhotos: 0,
    lastPushAt: null,
    lastPullAt: null,
    shouldSuggestRestore: false,
    errors: [],
  };

  if (typeof window === "undefined") {
    return emptyOverview;
  }

  const snapshot = readLocalSnapshot();
  const localCats = snapshot.profiles.length;
  const localRecords = countLocalRecords(snapshot.recordLogsByCatId);
  const localCollectionPhotos = countLocalCollectionPhotos(snapshot.collectionPhotos);
  const localOwnSleepingPhotos = snapshot.ownSleepingPhotos.length;
  const localKeptExchangePhotos = snapshot.keptExchangePhotos.length;
  const hasLocalData = hasMeaningfulLocalData(snapshot);
  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return {
      ...emptyOverview,
      hasLocalData,
      localCats,
      localRecords,
      localCollectionPhotos,
      localOwnSleepingPhotos,
      localKeptExchangePhotos,
    };
  }

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return {
      ...emptyOverview,
      hasLocalData,
      localCats,
      localRecords,
      localCollectionPhotos,
      localOwnSleepingPhotos,
      localKeptExchangePhotos,
      errors: error ? [error.message] : [],
    };
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
        .select("*")
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

  const remoteCats = filterRestorableRemoteCats(
    ((catsResult.data ?? []) as RemoteCatRow[]).filter(Boolean),
  ).length;
  const remoteRecords = recordsResult.count ?? 0;
  const remoteCollectionPhotos = collectionResult.count ?? 0;
  const remoteOwnSleepingPhotos = ownSleepingResult.count ?? 0;
  const remoteKeptExchangePhotos = keptExchangeResult.count ?? 0;
  const errors = [
    catsResult.error ? `cats: ${catsResult.error.message}` : null,
    recordsResult.error ? `records: ${recordsResult.error.message}` : null,
    collectionResult.error ? `collection_photos: ${collectionResult.error.message}` : null,
    ownSleepingResult.error ? `cat_moments: ${ownSleepingResult.error.message}` : null,
    keptExchangeResult.error
      ? `cat_moment_deliveries: ${keptExchangeResult.error.message}`
      : null,
    syncStateResult.error ? `account_sync_state: ${syncStateResult.error.message}` : null,
  ].filter((message): message is string => Boolean(message));
  const syncState = syncStateResult.data as
    | { last_push_at?: string | null; last_pull_at?: string | null }
    | null;
  const hasRemoteData =
    remoteCats > 0 ||
    remoteRecords > 0 ||
    remoteCollectionPhotos > 0 ||
    remoteOwnSleepingPhotos > 0 ||
    remoteKeptExchangePhotos > 0;

  return {
    isLoggedIn: true,
    hasLocalData,
    localCats,
    localRecords,
    localCollectionPhotos,
    localOwnSleepingPhotos,
    localKeptExchangePhotos,
    remoteCats,
    remoteRecords,
    remoteCollectionPhotos,
    remoteOwnSleepingPhotos,
    remoteKeptExchangePhotos,
    lastPushAt: syncState?.last_push_at ?? null,
    lastPullAt: syncState?.last_pull_at ?? null,
    shouldSuggestRestore:
      hasRemoteData &&
      (!hasLocalData ||
        remoteCats > localCats ||
        remoteRecords > localRecords ||
        remoteCollectionPhotos > localCollectionPhotos ||
        remoteOwnSleepingPhotos > localOwnSleepingPhotos ||
        remoteKeptExchangePhotos > localKeptExchangePhotos),
    errors,
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
        mergeLocal: true,
        replaceLocalCats: true,
      });
      if (result.errors.length > 0) {
        return { ...result, status: "error" };
      }
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
      if (result.errors.length > 0) {
        return { ...result, status: "error" };
      }
      await saveSyncState(supabase, data.user.id, {
        last_push_at: new Date().toISOString(),
      });
      return { ...result, status: "synced" };
    }

    if (shouldRestore) {
      await restoreRemoteSnapshot(supabase, data.user.id, result, {
        mergeLocal: true,
      });
      if (result.errors.length > 0) {
        return { ...result, status: "error" };
      }
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

export async function deleteAccountSleepingPhoto(photoId: string) {
  if (typeof window === "undefined") {
    return;
  }

  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return;
  }

  const { data, error: authError } = await supabase.auth.getUser();

  if (authError || !data.user) {
    return;
  }

  const { error } = await supabase
    .from("cat_moments")
    .delete()
    .eq("user_id", data.user.id)
    .eq("local_moment_id", photoId);

  if (error) {
    throw new Error(`Sleeping photo delete failed: ${error.message}`);
  }
}

export async function hideAccountKeptExchangePhoto(
  photoId: string,
  reason: "hide" | "report",
) {
  if (typeof window === "undefined") {
    return;
  }

  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return;
  }

  const { data, error: authError } = await supabase.auth.getUser();

  if (authError || !data.user) {
    return;
  }

  const { error } = await supabase
    .from("cat_moment_deliveries")
    .update({ status: reason === "report" ? "reported" : "hidden" })
    .eq("user_id", data.user.id)
    .eq("local_delivery_id", photoId);

  if (error) {
    throw new Error(`Kept photo hide failed: ${error.message}`);
  }
}

export async function deleteAccountCollectionPhoto(localPhotoId: string) {
  if (typeof window === "undefined") {
    return;
  }

  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return;
  }

  const { data, error: authError } = await supabase.auth.getUser();

  if (authError || !data.user) {
    return;
  }

  const { error } = await supabase
    .from("collection_photos")
    .delete()
    .eq("user_id", data.user.id)
    .eq("local_photo_id", localPhotoId);

  if (error) {
    throw new Error(`Collection photo delete failed: ${error.message}`);
  }
}

export async function deleteAccountStoredData(): Promise<AccountDeleteResult> {
  if (typeof window === "undefined") {
    return { status: "skipped", errors: [] };
  }

  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return { status: "skipped", errors: [] };
  }

  const { data, error: authError } = await supabase.auth.getUser();

  if (authError || !data.user) {
    return {
      status: authError ? "error" : "skipped",
      errors: authError ? [authError.message] : [],
    };
  }

  const userId = data.user.id;
  const errors: string[] = [];

  await deleteStorageFolder(supabase, userId, errors);

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
    status: errors.length > 0 ? "error" : "deleted",
    errors,
  };
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
  const meaningfulProfiles = snapshot.profiles.filter(
    (profile) => !isLocalDefaultCatProfile(profile),
  );

  if (meaningfulProfiles.length === 0) {
    return (
      hasLocalCollectionPhotos(snapshot.collectionPhotos) ||
      snapshot.ownSleepingPhotos.length > 0 ||
      snapshot.keptExchangePhotos.length > 0 ||
      [...snapshot.recordLogsByCatId.values()].some((records) => records.length > 0)
    );
  }

  if (snapshot.profiles.length === 0) {
    return false;
  }

  if (snapshot.hasCompletedOnboarding) {
    return true;
  }

  if (
    meaningfulProfiles.some((profile) => hasMeaningfulCatProfileDetails(profile))
  ) {
    return true;
  }

  for (const records of snapshot.recordLogsByCatId.values()) {
    if (records.length > 0) {
      return true;
    }
  }

  return (
    hasLocalCollectionPhotos(snapshot.collectionPhotos) ||
    snapshot.ownSleepingPhotos.length > 0 ||
    snapshot.keptExchangePhotos.length > 0
  );
}

function hasMeaningfulCatProfileDetails(profile: LocalCatProfile) {
  return Boolean(
    profile.typeKey ||
      profile.typeLabel ||
      profile.avatarDataUrl ||
      profile.homePhotoDataUrl ||
      !isEmptyObject(profile.basicInfo) ||
      !isEmptyObject(profile.appearance) ||
      !isEmptyObject(profile.onboarding) ||
      !isEmptyObject(profile.understanding),
  );
}

function hasLocalCollectionPhotos(collectionPhotos: LocalCollectionStore) {
  return Object.values(collectionPhotos).some((catPhotos) =>
    Object.values(catPhotos).some(
      (photos) => normalizeCollectionPhotoEntries(photos).length > 0,
    ),
  );
}

function countLocalRecords(recordLogsByCatId: Map<string, LocalRecordLogItem[]>) {
  let count = 0;

  for (const records of recordLogsByCatId.values()) {
    count += records.length;
  }

  return count;
}

function countLocalCollectionPhotos(collectionPhotos: LocalCollectionStore) {
  let count = 0;

  for (const catPhotos of Object.values(collectionPhotos)) {
    for (const photos of Object.values(catPhotos)) {
      count += normalizeCollectionPhotoEntries(photos).length;
    }
  }

  return count;
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
      const photos = normalizeCollectionPhotoEntries(rawPhotos);

      for (const [index, photo] of photos.entries()) {
        const src = photo.src;

        if (!src.startsWith("data:")) {
          continue;
        }

        const localPhotoId = photo.id || `${localCatId}:${slotSlug}:${index}`;
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
          captured_at: toIsoStringOrNull(photo.createdAt),
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
  try {
    const momentRows = await Promise.all(
      snapshot.ownSleepingPhotos.map(async (photo) => ({
        user_id: userId,
        anonymous_id: null,
        local_moment_id: photo.id,
        local_cat_id: photo.catId,
        owner_cat_id: photo.ownerCatId,
        photo_url: await prepareRemoteSleepingPhotoUrl(
          supabase,
          userId,
          "sleeping",
          photo.ownerCatId,
          photo.id,
          photo.src,
        ),
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
      })),
    );

    if (momentRows.length > 0) {
      const localMomentIds = momentRows.map((row) => row.local_moment_id);
      const existingMomentIds = await findExistingLocalIds(
        supabase,
        "cat_moments",
        userId,
        "local_moment_id",
        localMomentIds,
      );
      const momentRowsToInsert = momentRows.filter(
        (row) => !existingMomentIds.has(row.local_moment_id),
      );
      const momentRowsToUpdate = momentRows.filter((row) =>
        existingMomentIds.has(row.local_moment_id),
      );

      await updateCatMomentRows(supabase, userId, momentRowsToUpdate);

      const { error } =
        momentRowsToInsert.length > 0
          ? await supabase.from("cat_moments").insert(momentRowsToInsert)
          : { error: null };

      if (error) {
        throw new Error(`Sleeping photo sync failed: ${error.message}`);
      }

      result.pushedOwnSleepingPhotos +=
        momentRowsToInsert.length + momentRowsToUpdate.length;
    }

    const deliveryRows = await Promise.all(
      snapshot.keptExchangePhotos.map(async (photo) => ({
        user_id: userId,
        anonymous_id: null,
        local_delivery_id: photo.id,
        source_moment_id: null,
        source_photo_id: photo.sourcePhotoId ?? null,
        recipient_local_cat_id: null,
        photo_url: await prepareRemoteSleepingPhotoUrl(
          supabase,
          userId,
          "deliveries",
          "kept",
          photo.id,
          photo.src,
        ),
        status: "kept",
        metadata: {
          ...SYNC_METADATA,
          title: photo.title,
          subtitle: photo.subtitle,
          trigger_label: photo.triggerLabel,
          theme: photo.theme,
        },
        delivered_at: new Date(photo.deliveredAt).toISOString(),
      })),
    );

    if (deliveryRows.length === 0) {
      return;
    }

    const localDeliveryIds = deliveryRows.map((row) => row.local_delivery_id);
    const existingDeliveryIds = await findExistingLocalIds(
      supabase,
      "cat_moment_deliveries",
      userId,
      "local_delivery_id",
      localDeliveryIds,
    );
    const deliveryRowsToInsert = deliveryRows.filter(
      (row) => !existingDeliveryIds.has(row.local_delivery_id),
    );
    const deliveryRowsToUpdate = deliveryRows.filter((row) =>
      existingDeliveryIds.has(row.local_delivery_id),
    );

    await updateCatMomentDeliveryRows(supabase, userId, deliveryRowsToUpdate);

    const { error } =
      deliveryRowsToInsert.length > 0
        ? await supabase.from("cat_moment_deliveries").insert(deliveryRowsToInsert)
        : { error: null };

    if (error) {
      throw new Error(`Kept photo sync failed: ${error.message}`);
    }

    result.pushedKeptExchangePhotos +=
      deliveryRowsToInsert.length + deliveryRowsToUpdate.length;
  } catch (error) {
    result.errors.push(
      error instanceof Error ? error.message : "Sleeping photo sync failed",
    );
  }
}

async function prepareRemoteSleepingPhotoUrl(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
  group: "sleeping" | "deliveries",
  catId: string,
  photoId: string,
  src: string,
) {
  if (!src.startsWith("data:")) {
    return src;
  }

  const storagePath = await uploadDataUrl(
    supabase,
    `${userId}/${sanitizePathSegment(catId)}/${group}/${sanitizePathSegment(
      photoId,
    )}.${getDataUrlExtension(src)}`,
    src,
  );

  return toStoragePhotoUrl(storagePath);
}

async function restoreRemoteSnapshot(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
  result: AccountSyncResult,
  options: { mergeLocal: boolean; replaceLocalCats?: boolean },
) {
  const { data: cats, error: catsError } = await supabase
    .from("cats")
    .select("*")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true });

  if (catsError) {
    throw new Error(`Cat restore failed: ${catsError.message}`);
  }

  const fetchedRemoteCats = ((cats ?? []) as RemoteCatRow[]).filter(Boolean);
  await deleteAccidentalDefaultRemoteCats(supabase, fetchedRemoteCats, result);
  const remoteCats = filterRestorableRemoteCats(fetchedRemoteCats);
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
  const profiles: LocalCatProfile[] =
    options.replaceLocalCats || shouldReplaceLocalDefaultCats(localProfiles)
    ? []
    : [...localProfiles];
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
    profiles.some((profile) => profile.id === previousActiveCatId)
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

    const photoSrc = toStoragePhotoUrl(photo.storage_path);

    if (!photoSrc) {
      continue;
    }

    collectionStore[localCatId] ??= {};
    const current = collectionStore[localCatId][photo.slot_slug];
    const photos = normalizeCollectionPhotoEntries(current);
    const restoredPhoto = {
      id: photo.local_photo_id ?? photo.id,
      src: photoSrc,
      createdAt: photo.captured_at ?? photo.created_at,
    };

    if (!photos.some((storedPhoto) => storedPhoto.id === restoredPhoto.id)) {
      photos.push(restoredPhoto);
    }
    collectionStore[localCatId][photo.slot_slug] = photos;
  }

  if (Object.keys(collectionStore).length > 0) {
    const restoredCount = writeCollectionStoreWithFallback(collectionStore);

    if (restoredCount > 0) {
      result.restoredCollectionPhotos += restoredCount;
      dispatchBoxPhotoStorageEvent();
    }
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

  if (momentsResult.error || deliveriesResult.error) {
    if (momentsResult.error) {
      result.errors.push(
        `Sleeping photo restore skipped: ${momentsResult.error.message}`,
      );
    }
    if (deliveriesResult.error) {
      result.errors.push(`Kept photo restore skipped: ${deliveriesResult.error.message}`);
    }
    return;
  }

  const ownPhotos = (
    await Promise.all(
      ((momentsResult.data ?? []) as RemoteCatMomentRow[]).map(
        async (moment): Promise<OwnSleepingPhoto | null> => {
      const localCatId =
        moment.local_cat_id ||
        remoteIdToLocalId.get(moment.owner_cat_id) ||
        moment.owner_cat_id;
      const metadata = moment.metadata ?? {};
      const createdAt = new Date(moment.captured_at ?? moment.created_at).getTime();
      const photoSrc = moment.photo_url || undefined;

      if (!localCatId || !photoSrc || Number.isNaN(createdAt)) {
        return null;
      }

      return {
        id: moment.local_moment_id || moment.id,
        ownerCatId: localCatId,
        catId: localCatId,
        src: photoSrc,
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
        },
      ),
    )
  ).filter((photo): photo is OwnSleepingPhoto => Boolean(photo));

  const keptPhotos = (
    await Promise.all(
      ((deliveriesResult.data ?? []) as RemoteCatMomentDeliveryRow[]).map(
        async (delivery): Promise<ExchangePhoto | null> => {
      const metadata = delivery.metadata ?? {};
      const deliveredAt = new Date(delivery.delivered_at).getTime();
      const photoSrc = delivery.photo_url || undefined;

      if (!photoSrc || Number.isNaN(deliveredAt)) {
        return null;
      }

      return {
        id: delivery.local_delivery_id || delivery.id,
        sourcePhotoId:
          delivery.source_photo_id ?? delivery.source_moment_id ?? undefined,
        src: photoSrc,
        title: typeof metadata.title === "string" ? metadata.title : "とどいたねがお",
        subtitle: typeof metadata.subtitle === "string" ? metadata.subtitle : "",
        triggerLabel:
          typeof metadata.trigger_label === "string" ? metadata.trigger_label : "",
        theme: typeof metadata.theme === "string" ? metadata.theme : "sleeping",
        deliveredAt,
      };
        },
      ),
    )
  ).filter((photo): photo is ExchangePhoto => Boolean(photo));

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

async function findExistingLocalIds(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  table: "cat_moments" | "cat_moment_deliveries",
  userId: string,
  idField: "local_moment_id" | "local_delivery_id",
  localIds: string[],
) {
  const ids = localIds.filter((id) => id.length > 0);

  if (ids.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await supabase
    .from(table)
    .select(idField)
    .eq("user_id", userId)
    .in(idField, ids);

  if (error) {
    throw new Error(`Existing ${table} lookup failed: ${error.message}`);
  }

  return new Set(
    ((data ?? []) as Record<string, string | null>[])
      .map((row) => row[idField])
      .filter((id): id is string => typeof id === "string"),
  );
}

async function updateCatMomentRows(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
  rows: {
    local_moment_id: string;
    [key: string]: unknown;
  }[],
) {
  for (const row of rows) {
    const { error } = await supabase
      .from("cat_moments")
      .update(row)
      .eq("user_id", userId)
      .eq("local_moment_id", row.local_moment_id);

    if (error) {
      throw new Error(`Sleeping photo update failed: ${error.message}`);
    }
  }
}

async function updateCatMomentDeliveryRows(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
  rows: {
    local_delivery_id: string;
    [key: string]: unknown;
  }[],
) {
  for (const row of rows) {
    const { error } = await supabase
      .from("cat_moment_deliveries")
      .update(row)
      .eq("user_id", userId)
      .eq("local_delivery_id", row.local_delivery_id);

    if (error) {
      throw new Error(`Kept photo update failed: ${error.message}`);
    }
  }
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

function shouldReplaceLocalDefaultCats(profiles: LocalCatProfile[]) {
  if (profiles.length !== 1) {
    return false;
  }

  const [profile] = profiles;

  return isLocalDefaultCatProfile(profile);
}

function isLocalDefaultCatProfile(profile: LocalCatProfile) {
  return (
    typeof profile.id === "string" &&
    profile.id.startsWith("local-cat-") &&
    (profile.name === "ミケ" || !profile.name) &&
    !profile.homePhotoDataUrl &&
    !profile.avatarDataUrl &&
    !profile.basicInfo &&
    !profile.appearance &&
    !profile.typeKey &&
    !profile.typeLabel
  );
}

function filterRestorableRemoteCats(cats: RemoteCatRow[]) {
  if (cats.length <= 1) {
    return cats;
  }

  return cats.filter((cat) => !isAccidentalDefaultRemoteCat(cat));
}

async function deleteAccidentalDefaultRemoteCats(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  cats: RemoteCatRow[],
  result: AccountSyncResult,
) {
  if (cats.length <= 1) {
    return;
  }

  const defaultCatIds = cats
    .filter((cat) => isAccidentalDefaultRemoteCat(cat))
    .map((cat) => cat.id);

  if (defaultCatIds.length === 0) {
    return;
  }

  const { error } = await supabase.from("cats").delete().in("id", defaultCatIds);

  if (error) {
    result.errors.push(`Default cat cleanup failed: ${error.message}`);
  }
}

function isAccidentalDefaultRemoteCat(cat: RemoteCatRow) {
  return (
    cat.name === "ミケ" &&
    typeof cat.local_cat_id === "string" &&
    cat.local_cat_id.startsWith("local-cat-") &&
    !cat.avatar_storage_path &&
    !cat.home_photo_storage_path &&
    !cat.type_key &&
    !cat.type_label &&
    isEmptyObject(cat.basic_info) &&
    isEmptyObject(cat.appearance) &&
    isEmptyObject(cat.onboarding) &&
    isEmptyObject(cat.understanding)
  );
}

function isEmptyObject(value: Record<string, unknown> | null | undefined) {
  return !value || Object.keys(value).length === 0;
}

async function deleteStorageFolder(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  prefix: string,
  errors: string[],
) {
  const paths = await listStoragePaths(supabase, prefix, errors);

  for (let index = 0; index < paths.length; index += 100) {
    const chunk = paths.slice(index, index + 100);

    if (chunk.length === 0) {
      continue;
    }

    const { error } = await supabase.storage.from(CAT_PHOTOS_BUCKET).remove(chunk);

    if (error) {
      errors.push(`storage remove: ${error.message}`);
    }
  }
}

async function listStoragePaths(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  prefix: string,
  errors: string[],
  depth = 0,
): Promise<string[]> {
  if (depth > 8) {
    return [];
  }

  const { data, error } = await supabase.storage
    .from(CAT_PHOTOS_BUCKET)
    .list(prefix, { limit: 1000 });

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

function writeCollectionStoreWithFallback(collectionStore: LocalCollectionStore) {
  for (const maxPhotosPerSlot of [12, 8, 4, 2, 1]) {
    const trimmedStore = trimCollectionStore(collectionStore, maxPhotosPerSlot);

    try {
      window.localStorage.setItem(
        STORAGE_KEYS.collectionPhotos,
        JSON.stringify(trimmedStore),
      );
      return countLocalCollectionPhotos(trimmedStore);
    } catch {
      // Try again with fewer photos when iOS PWA storage is tight.
    }
  }

  return 0;
}

function trimCollectionStore(
  collectionStore: LocalCollectionStore,
  maxPhotosPerSlot: number,
) {
  const trimmedStore: LocalCollectionStore = {};

  for (const [catId, photosBySlot] of Object.entries(collectionStore)) {
    trimmedStore[catId] = {};

    for (const [slotSlug, rawPhotos] of Object.entries(photosBySlot)) {
      const photos = normalizeCollectionPhotoEntries(rawPhotos);
      trimmedStore[catId][slotSlug] = photos.slice(0, maxPhotosPerSlot);
    }
  }

  return trimmedStore;
}

function normalizeCollectionPhotoEntries(
  value: LocalCollectionPhoto[] | LocalCollectionPhoto | null | undefined,
) {
  const list = Array.isArray(value) ? value : value ? [value] : [];

  return list
    .map((photo): { id?: string; src: string; createdAt?: string } | null => {
      if (typeof photo === "string") {
        return photo ? { src: photo } : null;
      }

      if (photo && typeof photo.src === "string" && photo.src) {
        return { id: photo.id, src: photo.src, createdAt: photo.createdAt };
      }

      return null;
    })
    .filter((photo): photo is { id?: string; src: string; createdAt?: string } => Boolean(photo));
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
