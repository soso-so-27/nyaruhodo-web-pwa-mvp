import { STORAGE_KEYS, getRecordLogKey } from "./storage";
import {
  readCatGalleryPhotos,
  restoreSyncedCatGalleryPhotos,
  type CatGalleryPhoto,
} from "./cats/catGalleryPhotos";
import { createBrowserSupabaseClient } from "./supabase/browser";
import {
  dispatchBoxPhotoStorageEvent,
  readOwnSleepingPhotos,
  readOwnSleepingPhotosForSync,
  readKeptExchangePhotos,
  readKeptExchangePhotosForSync,
  restoreSyncedSleepingPhotos,
  type ExchangePhoto,
  type OwnSleepingPhoto,
} from "./home/sleepingPhotos";
import {
  CAT_PHOTOS_BUCKET,
  getDataUrlExtension,
  getStoragePhotoPath,
  normalizePersistentPhotoSrc,
  sanitizePathSegment,
  toStoragePhotoUrl,
  uploadDataUrl,
} from "./photoStorage";
import { purgeAllPhotoSwCache } from "./photoSwCache";
import { readAnonymousId } from "./identity/anonymousId";
import {
  CAT_GALLERY_COLLECTION_SLOT,
  isReservedCollectionSlotSlug,
} from "./collection/dailyTarget";

type LocalCatProfile = {
  id: string;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
  homePhotoDataUrl?: string;
  homePhotoPosition?: string;
  coverPhotoDataUrl?: string;
  coverCrop?: {
    scale?: number;
    offsetX?: number;
    offsetY?: number;
  };
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

type LegacyLocalCatProfile = LocalCatProfile & {
  avatarDataUrl?: string;
  avatarCrop?: LocalCatProfile["coverCrop"];
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
  catGalleryPhotos: CatGalleryPhoto[];
  collectionPhotos: LocalCollectionStore;
  ownSleepingPhotos: OwnSleepingPhoto[];
  keptExchangePhotos: ExchangePhoto[];
  localState: LocalStateItem[];
  hasCompletedOnboarding: boolean;
};

type LocalStateItem = {
  key: string;
  value: unknown;
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
  cover_storage_path: string | null;
  cover_crop: Record<string, unknown> | null;
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

type RemoteLocalStateRow = {
  state_key: string;
  value: unknown;
};

type SyncStatus = "skipped" | "synced" | "restored" | "error";

export type AccountSyncResult = {
  status: SyncStatus;
  pushedCats: number;
  pushedRecords: number;
  pushedCatGalleryPhotos: number;
  pushedCollectionPhotos: number;
  pushedOwnSleepingPhotos: number;
  pushedKeptExchangePhotos: number;
  pushedLocalState: number;
  restoredCats: number;
  restoredRecords: number;
  restoredCatGalleryPhotos: number;
  restoredCollectionPhotos: number;
  restoredOwnSleepingPhotos: number;
  restoredKeptExchangePhotos: number;
  restoredLocalState: number;
  errors: string[];
};

export type AccountSyncOverview = {
  isLoggedIn: boolean;
  hasLocalData: boolean;
  localCats: number;
  localRecords: number;
  localCatGalleryPhotos: number;
  localCollectionPhotos: number;
  localOwnSleepingPhotos: number;
  localKeptExchangePhotos: number;
  localStateItems: number;
  remoteCats: number;
  remoteRecords: number;
  remoteCatGalleryPhotos: number;
  remoteCollectionPhotos: number;
  remoteOwnSleepingPhotos: number;
  remoteKeptExchangePhotos: number;
  remoteLocalStateItems: number;
  lastPushAt: string | null;
  lastPullAt: string | null;
  shouldSuggestRestore: boolean;
  errors: string[];
};

export type CatGalleryAccountRestoreResult = {
  status: "skipped" | "empty" | "restored" | "error";
  hasSession: boolean;
  localBefore: number;
  localAfter: number;
  remoteCount: number;
  restoredCount: number;
  errors: string[];
};

export type AccountDeleteResult = {
  status: "deleted" | "skipped" | "error";
  errors: string[];
};

const SYNC_METADATA = { source: "localStorage-v1" };
const CAT_GALLERY_COLLECTION_METADATA = {
  ...SYNC_METADATA,
  domain: "cat_gallery",
};
const LOCAL_STATE_SOURCE = "account-local-state-v1";
const SYNCABLE_LOCAL_STATE_KEYS = new Set([
  STORAGE_KEYS.activeCatId,
  STORAGE_KEYS.currentCatHintSuppression,
  STORAGE_KEYS.eveningDeliveryDays,
  STORAGE_KEYS.omoideMemories,
  STORAGE_KEYS.omoideMemoryControls,
  STORAGE_KEYS.onboardingCompleted,
  "neteruneko_cat_sleeping_stats",
  "neteruneko_cat_sleeping_milestones",
  "neteruneko_open_sound_enabled",
  "neteruneko_open_sound_candidate",
  "nyaruhodo_exchange_dismissed_photos",
  "nyaruhodo_exchange_reported_photos",
  "nyaruhodo_sleeping_safety_accepted",
  "neteruneko_home_install_hint_dismissed",
]);
const SYNCABLE_LOCAL_STATE_PREFIXES = [
  "discovery_log_",
  "light_data_",
  "lock_data_",
  "active_cat_id_mikke_window_answers_",
];
const LOCAL_STATE_SKIP_KEYS = new Set([
  STORAGE_KEYS.accountCreatePromptDismissed,
  STORAGE_KEYS.accountRestorePromptDismissed,
  STORAGE_KEYS.analyticsAnonymousId,
  STORAGE_KEYS.analyticsEventQueue,
  STORAGE_KEYS.analyticsSession,
  STORAGE_KEYS.authGooglePending,
  STORAGE_KEYS.catProfiles,
  STORAGE_KEYS.collectionPhotos,
  STORAGE_KEYS.legacyCatProfile,
  STORAGE_KEYS.lastContext,
  STORAGE_KEYS.lastInputSignal,
  STORAGE_KEYS.lastPrimaryCategory,
  STORAGE_KEYS.latestHypothesis,
  "nyaruhodo_exchange_own_sleeping_photos",
  "nyaruhodo_exchange_kept_photos",
  "neteruneko_mainichi_seen_photo_keys",
]);

export async function getAccountSyncOverview(): Promise<AccountSyncOverview> {
  const emptyOverview: AccountSyncOverview = {
    isLoggedIn: false,
    hasLocalData: false,
    localCats: 0,
    localRecords: 0,
    localCatGalleryPhotos: 0,
    localCollectionPhotos: 0,
    localOwnSleepingPhotos: 0,
    localKeptExchangePhotos: 0,
    localStateItems: 0,
    remoteCats: 0,
    remoteRecords: 0,
    remoteCatGalleryPhotos: 0,
    remoteCollectionPhotos: 0,
    remoteOwnSleepingPhotos: 0,
    remoteKeptExchangePhotos: 0,
    remoteLocalStateItems: 0,
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
  const localCatGalleryPhotos = snapshot.catGalleryPhotos.length;
  const localCollectionPhotos = countLocalCollectionPhotos(snapshot.collectionPhotos);
  const localOwnSleepingPhotos = snapshot.ownSleepingPhotos.length;
  const localKeptExchangePhotos = snapshot.keptExchangePhotos.length;
  const localStateItems = snapshot.localState.length;
  const hasLocalData = hasMeaningfulLocalData(snapshot);
  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return {
      ...emptyOverview,
      hasLocalData,
      localCats,
      localRecords,
      localCatGalleryPhotos,
      localCollectionPhotos,
      localOwnSleepingPhotos,
      localKeptExchangePhotos,
      localStateItems,
    };
  }

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return {
      ...emptyOverview,
      hasLocalData,
      localCats,
      localRecords,
      localCatGalleryPhotos,
      localCollectionPhotos,
      localOwnSleepingPhotos,
      localKeptExchangePhotos,
      localStateItems,
      errors: error ? [error.message] : [],
    };
  }

  const userId = data.user.id;
  const [
    catsResult,
    recordsResult,
    catGalleryResult,
    collectionResult,
    ownSleepingResult,
    keptExchangeResult,
    localStateResult,
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
        .eq("user_id", userId)
        .eq("slot_slug", CAT_GALLERY_COLLECTION_SLOT),
      supabase
        .from("collection_photos")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .neq("slot_slug", CAT_GALLERY_COLLECTION_SLOT),
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
        .from("account_local_state")
        .select("state_key", { count: "exact", head: true })
        .eq("user_id", userId),
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
  const remoteCatGalleryPhotos = catGalleryResult.count ?? 0;
  const remoteCollectionPhotos = collectionResult.count ?? 0;
  const remoteOwnSleepingPhotos = ownSleepingResult.count ?? 0;
  const remoteKeptExchangePhotos = keptExchangeResult.count ?? 0;
  const remoteLocalStateItems = localStateResult.count ?? 0;
  const errors = [
    catsResult.error ? `cats: ${catsResult.error.message}` : null,
    recordsResult.error ? `records: ${recordsResult.error.message}` : null,
    catGalleryResult.error
      ? `cat_gallery_photos: ${catGalleryResult.error.message}`
      : null,
    collectionResult.error ? `collection_photos: ${collectionResult.error.message}` : null,
    ownSleepingResult.error ? `cat_moments: ${ownSleepingResult.error.message}` : null,
    keptExchangeResult.error
      ? `cat_moment_deliveries: ${keptExchangeResult.error.message}`
      : null,
    localStateResult.error
      ? `account_local_state: ${localStateResult.error.message}`
      : null,
    syncStateResult.error ? `account_sync_state: ${syncStateResult.error.message}` : null,
  ].filter((message): message is string => Boolean(message));
  const syncState = syncStateResult.data as
    | { last_push_at?: string | null; last_pull_at?: string | null }
    | null;
  const hasRemoteData =
    remoteCats > 0 ||
    remoteRecords > 0 ||
    remoteCatGalleryPhotos > 0 ||
    remoteCollectionPhotos > 0 ||
    remoteOwnSleepingPhotos > 0 ||
    remoteKeptExchangePhotos > 0 ||
    remoteLocalStateItems > 0;

  return {
    isLoggedIn: true,
    hasLocalData,
    localCats,
    localRecords,
    localCatGalleryPhotos,
    localCollectionPhotos,
    localOwnSleepingPhotos,
    localKeptExchangePhotos,
    localStateItems,
    remoteCats,
    remoteRecords,
    remoteCatGalleryPhotos,
    remoteCollectionPhotos,
    remoteOwnSleepingPhotos,
    remoteKeptExchangePhotos,
    remoteLocalStateItems,
    lastPushAt: syncState?.last_push_at ?? null,
    lastPullAt: syncState?.last_pull_at ?? null,
    shouldSuggestRestore:
      hasRemoteData &&
      (!hasLocalData ||
        remoteCats > localCats ||
        remoteRecords > localRecords ||
        remoteCatGalleryPhotos > localCatGalleryPhotos ||
        remoteCollectionPhotos > localCollectionPhotos ||
        remoteOwnSleepingPhotos > localOwnSleepingPhotos ||
        remoteKeptExchangePhotos > localKeptExchangePhotos ||
        remoteLocalStateItems > localStateItems),
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
        replaceLocalState: true,
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

export async function mergeAccountDataWithAccount(): Promise<AccountSyncResult> {
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

  try {
    await ensureRemoteProfile(supabase, data.user.id, data.user.user_metadata);

    // Settings sync is intentionally additive: remote rows are merged into
    // localStorage first, then the merged local snapshot is pushed back.
    // This path does not propagate deletions or treat remote-empty as a command
    // to clear local data.
    await restoreRemoteSnapshot(supabase, data.user.id, result, {
      mergeLocal: true,
    });
    if (result.errors.length > 0) {
      return { ...result, status: "error" };
    }

    const snapshot = readLocalSnapshot();

    if (hasMeaningfulLocalData(snapshot)) {
      await pushLocalSnapshot(supabase, data.user.id, snapshot, result);
      if (result.errors.length > 0) {
        return { ...result, status: "error" };
      }
    }

    const now = new Date().toISOString();
    await saveSyncState(supabase, data.user.id, {
      last_pull_at: now,
      last_push_at: now,
    });

    return {
      ...result,
      status: hasRestoredAccountData(result) ? "restored" : "synced",
    };
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

export async function restoreCatGalleryPhotosFromAccount(): Promise<CatGalleryAccountRestoreResult> {
  const localBefore = readCatGalleryPhotos(null).length;
  const emptyResult: CatGalleryAccountRestoreResult = {
    status: "skipped",
    hasSession: false,
    localBefore,
    localAfter: localBefore,
    remoteCount: 0,
    restoredCount: 0,
    errors: [],
  };

  if (typeof window === "undefined") {
    return emptyResult;
  }

  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return emptyResult;
  }

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return {
      ...emptyResult,
      status: error ? "error" : "skipped",
      hasSession: false,
      errors: error ? [error.message] : [],
    };
  }

  const result = createEmptyResult();

  try {
    const { data: cats, error: catsError } = await supabase
      .from("cats")
      .select("id, local_cat_id")
      .eq("owner_user_id", data.user.id);

    if (catsError) {
      throw new Error(`Cat lookup failed: ${catsError.message}`);
    }

    const remoteIdToLocalId = new Map<string, string>();

    for (const cat of (cats ?? []) as { id: string; local_cat_id: string | null }[]) {
      if (!cat.id) {
        continue;
      }

      remoteIdToLocalId.set(cat.id, cat.local_cat_id ?? `remote-cat-${cat.id}`);
    }

    const stats = await restoreCatGalleryPhotos(
      supabase,
      data.user.id,
      remoteIdToLocalId,
      result,
      { mergeLocal: true },
    );
    const localAfter = readCatGalleryPhotos(null).length;

    if (stats.restoredCount > 0) {
      await saveSyncState(supabase, data.user.id, {
        last_pull_at: new Date().toISOString(),
      });
    }

    return {
      status:
        stats.remoteCount === 0
          ? "empty"
          : stats.restoredCount > 0
            ? "restored"
            : "skipped",
      hasSession: true,
      localBefore,
      localAfter,
      remoteCount: stats.remoteCount,
      restoredCount: stats.restoredCount,
      errors: result.errors,
    };
  } catch (restoreError) {
    return {
      status: "error",
      hasSession: true,
      localBefore,
      localAfter: readCatGalleryPhotos(null).length,
      remoteCount: 0,
      restoredCount: 0,
      errors: [
        restoreError instanceof Error
          ? restoreError.message
          : "Unknown cat gallery restore error",
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
    .eq("local_photo_id", localPhotoId)
    .neq("slot_slug", CAT_GALLERY_COLLECTION_SLOT);

  if (error) {
    throw new Error(`Collection photo delete failed: ${error.message}`);
  }
}

export async function deleteAccountCatGalleryPhoto(localPhotoId: string) {
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
    .eq("local_photo_id", localPhotoId)
    .eq("slot_slug", CAT_GALLERY_COLLECTION_SLOT);

  if (error) {
    throw new Error(`Cat gallery photo delete failed: ${error.message}`);
  }
}

export async function clearAccountCatCoverPhoto(localCatId: string) {
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
    .from("cats")
    .update({ cover_storage_path: null, cover_crop: null, avatar_storage_path: null })
    .eq("owner_user_id", data.user.id)
    .eq("local_cat_id", localCatId);

  if (error) {
    throw new Error(`Cat cover clear failed: ${error.message}`);
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

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (sessionError || !accessToken) {
    return {
      status: "error",
      errors: [sessionError?.message ?? "Account delete auth token missing"],
    };
  }

  const response = await fetch("/api/account/delete-stored-data", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ anonymousId: readAnonymousId() }),
  }).catch((error) => {
    throw new Error(
      error instanceof Error ? error.message : "Account delete request failed",
    );
  });
  const result = await response.json().catch(() => null) as
    | { errors?: unknown; status?: unknown }
    | null;
  const errors = Array.isArray(result?.errors)
    ? result.errors.filter((error): error is string => typeof error === "string")
    : [];

  if (!response.ok || result?.status === "error") {
    return {
      status: "error",
      errors: errors.length > 0 ? errors : [`Account delete failed: ${response.status}`],
    };
  }

  if (result?.status === "deleted") {
    purgeAllPhotoSwCache("account_deleted");
  }

  return {
    status: result?.status === "deleted" ? "deleted" : "skipped",
    errors,
  };
}

function hasRestoredAccountData(result: AccountSyncResult) {
  return (
    result.restoredCats > 0 ||
    result.restoredRecords > 0 ||
    result.restoredCatGalleryPhotos > 0 ||
    result.restoredCollectionPhotos > 0 ||
    result.restoredOwnSleepingPhotos > 0 ||
    result.restoredKeptExchangePhotos > 0 ||
    result.restoredLocalState > 0
  );
}

function createEmptyResult(): AccountSyncResult {
  return {
    status: "skipped",
    pushedCats: 0,
    pushedRecords: 0,
    pushedCatGalleryPhotos: 0,
    pushedCollectionPhotos: 0,
    pushedOwnSleepingPhotos: 0,
    pushedKeptExchangePhotos: 0,
    pushedLocalState: 0,
    restoredCats: 0,
    restoredRecords: 0,
    restoredCatGalleryPhotos: 0,
    restoredCollectionPhotos: 0,
    restoredOwnSleepingPhotos: 0,
    restoredKeptExchangePhotos: 0,
    restoredLocalState: 0,
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
  const catGalleryPhotos = readCatGalleryPhotos(null);
  const ownSleepingPhotos = readOwnSleepingPhotosForSync();
  const keptExchangePhotos = readKeptExchangePhotosForSync();
  const localState = readSyncableLocalState();
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
    catGalleryPhotos,
    collectionPhotos,
    ownSleepingPhotos,
    keptExchangePhotos,
    localState,
    hasCompletedOnboarding:
      window.localStorage.getItem(STORAGE_KEYS.onboardingCompleted) === "true",
  };
}

function normalizeProfiles(
  value: LegacyLocalCatProfile[] | Record<string, LegacyLocalCatProfile> | null,
): LocalCatProfile[] {
  if (!value) {
    return [];
  }

  const profiles = Array.isArray(value)
    ? value
    : Object.entries(value).map(([id, profile]) => ({ ...profile, id: profile.id ?? id }));

  return profiles
    .filter((profile): profile is LegacyLocalCatProfile =>
      Boolean(profile && typeof profile.id === "string" && profile.id),
    )
    .map((profile) => {
      const { avatarDataUrl, avatarCrop, ...rest } = profile;

      return {
        ...rest,
        coverPhotoDataUrl: profile.coverPhotoDataUrl ?? avatarDataUrl,
        coverCrop: normalizeCoverCrop(profile.coverCrop ?? avatarCrop),
      };
    });
}

function hasMeaningfulLocalData(snapshot: LocalSnapshot) {
  const meaningfulProfiles = snapshot.profiles.filter(
    (profile) => !isLocalDefaultCatProfile(profile),
  );

  if (meaningfulProfiles.length === 0) {
    return (
      snapshot.catGalleryPhotos.length > 0 ||
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
    snapshot.catGalleryPhotos.length > 0 ||
    hasLocalCollectionPhotos(snapshot.collectionPhotos) ||
    snapshot.ownSleepingPhotos.length > 0 ||
    snapshot.keptExchangePhotos.length > 0
  );
}

function hasMeaningfulCatProfileDetails(profile: LocalCatProfile) {
  return Boolean(
    profile.typeKey ||
      profile.typeLabel ||
      profile.coverPhotoDataUrl ||
      profile.homePhotoDataUrl ||
      !isEmptyObject(profile.basicInfo) ||
      !isEmptyObject(profile.appearance) ||
      !isEmptyObject(profile.onboarding) ||
      !isEmptyObject(profile.understanding),
  );
}

function hasLocalCollectionPhotos(collectionPhotos: LocalCollectionStore) {
  return Object.values(collectionPhotos).some((catPhotos) =>
    Object.entries(catPhotos).some(
      ([slug, photos]) =>
        !isReservedCollectionSlotSlug(slug) &&
        normalizeCollectionPhotoEntries(photos).length > 0,
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
    for (const [slug, photos] of Object.entries(catPhotos)) {
      if (isReservedCollectionSlotSlug(slug)) {
        continue;
      }

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
  await syncCatGalleryPhotos(
    supabase,
    userId,
    snapshot.catGalleryPhotos,
    remoteCatIds,
    result,
  );
  await syncCollectionPhotos(
    supabase,
    userId,
    snapshot.collectionPhotos,
    remoteCatIds,
    result,
  );
  await syncSleepingPhotos(supabase, userId, snapshot, remoteCatIds, result);
  await syncLocalState(supabase, userId, snapshot.localState, result);
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
    cover_crop: profile.coverCrop ? toJsonObject(profile.coverCrop) : null,
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

  if (profile.coverPhotoDataUrl?.startsWith("data:")) {
    photoUpdates.cover_storage_path = await uploadDataUrl(
      supabase,
      `${userId}/${remoteCatId}/cover/cover.${getDataUrlExtension(profile.coverPhotoDataUrl)}`,
      profile.coverPhotoDataUrl,
    );
  } else if (profile.coverPhotoDataUrl) {
    const storagePath = getStoragePhotoPath(profile.coverPhotoDataUrl);
    if (storagePath) {
      photoUpdates.cover_storage_path = storagePath;
    }
  }

  if (profile.homePhotoDataUrl?.startsWith("data:")) {
    photoUpdates.home_photo_storage_path = await uploadDataUrl(
      supabase,
      `${userId}/${remoteCatId}/home/home.${getDataUrlExtension(profile.homePhotoDataUrl)}`,
      profile.homePhotoDataUrl,
    );
  } else if (profile.homePhotoDataUrl) {
    const storagePath = getStoragePhotoPath(profile.homePhotoDataUrl);
    if (storagePath) {
      photoUpdates.home_photo_storage_path = storagePath;
    }
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

async function syncCatGalleryPhotos(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
  catGalleryPhotos: CatGalleryPhoto[],
  remoteCatIds: Map<string, string>,
  result: AccountSyncResult,
) {
  const rows = [];

  for (const photo of catGalleryPhotos) {
    const remoteCatId = remoteCatIds.get(photo.catId);

    if (!remoteCatId) {
      continue;
    }

    const src = photo.src;
    const existingStoragePath = getStoragePhotoPath(src);

    if (!src.startsWith("data:") && !existingStoragePath) {
      continue;
    }

    const storagePath =
      existingStoragePath ??
      (await uploadDataUrl(
        supabase,
        `${userId}/${remoteCatId}/cat-gallery/${sanitizePathSegment(
          photo.id,
        )}.${getDataUrlExtension(src)}`,
        src,
      ));

    rows.push({
      user_id: userId,
      cat_id: remoteCatId,
      local_cat_id: photo.catId,
      local_photo_id: photo.id,
      slot_slug: CAT_GALLERY_COLLECTION_SLOT,
      storage_path: storagePath,
      captured_at: new Date(photo.createdAt).toISOString(),
      metadata: CAT_GALLERY_COLLECTION_METADATA,
    });
  }

  const missingRows = await filterRowsMissingByLocalId(
    supabase,
    "collection_photos",
    userId,
    rows,
    "local_photo_id",
    { slotSlug: CAT_GALLERY_COLLECTION_SLOT },
  );

  if (missingRows.length === 0) {
    return;
  }

  const { error } = await supabase.from("collection_photos").insert(missingRows);

  if (error) {
    throw new Error(`Cat gallery photo sync failed: ${error.message}`);
  }

  result.pushedCatGalleryPhotos += missingRows.length;
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
      if (isReservedCollectionSlotSlug(slotSlug)) {
        continue;
      }

      const photos = normalizeCollectionPhotoEntries(rawPhotos);

      for (const [index, photo] of photos.entries()) {
        const src = photo.src;

        const existingStoragePath = getStoragePhotoPath(src);

        if (!src.startsWith("data:") && !existingStoragePath) {
          continue;
        }

        const localPhotoId = photo.id || `${localCatId}:${slotSlug}:${index}`;
        const storagePath =
          existingStoragePath ??
          (await uploadDataUrl(
            supabase,
            `${userId}/${remoteCatId}/collection/${sanitizePathSegment(
              slotSlug,
            )}/${sanitizePathSegment(localPhotoId)}.${getDataUrlExtension(src)}`,
            src,
          ));

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
    { excludeReservedCollectionSlots: true },
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
  remoteCatIds: Map<string, string>,
  result: AccountSyncResult,
) {
  try {
    const momentRows = (
      await Promise.all(
        snapshot.ownSleepingPhotos.map(async (photo) => {
          const photoUrl = await prepareRemoteSleepingPhotoUrl(
            supabase,
            userId,
            "sleeping",
            photo.ownerCatId,
            photo.id,
            photo.src,
          );

          if (!photoUrl) {
            return null;
          }

          return {
            user_id: userId,
            anonymous_id: null,
            local_moment_id: photo.id,
            local_cat_id: photo.catId,
            owner_cat_id: photo.ownerCatId,
            photo_url: photoUrl,
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
          };
        }),
      )
    ).filter((row): row is NonNullable<typeof row> => Boolean(row));

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

      await syncCatMomentCatLinks(supabase, userId, momentRows, remoteCatIds);
    }

    const deliveryRows = (
      await Promise.all(
        snapshot.keptExchangePhotos.map(async (photo) => {
          const photoUrl = await prepareRemoteSleepingPhotoUrl(
            supabase,
            userId,
            "deliveries",
            "kept",
            photo.id,
            photo.src,
          );

          if (!photoUrl) {
            return null;
          }

          return {
            user_id: userId,
            anonymous_id: null,
            local_delivery_id: photo.id,
            source_moment_id: null,
            source_photo_id: photo.sourcePhotoId ?? null,
            recipient_local_cat_id: null,
            photo_url: photoUrl,
            status: "kept",
            metadata: {
              ...SYNC_METADATA,
              title: photo.title,
              subtitle: photo.subtitle,
              trigger_label: photo.triggerLabel,
              theme: photo.theme,
            },
            delivered_at: new Date(photo.deliveredAt).toISOString(),
          };
        }),
      )
    ).filter((row): row is NonNullable<typeof row> => Boolean(row));

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

async function syncCatMomentCatLinks(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
  momentRows: {
    local_moment_id: string;
    local_cat_id: string | null | undefined;
    owner_cat_id: string | null | undefined;
  }[],
  remoteCatIds: Map<string, string>,
) {
  const localMomentIds = momentRows
    .map((row) => row.local_moment_id)
    .filter((id) => id.length > 0);

  if (localMomentIds.length === 0) {
    return;
  }

  const remoteMomentIds = await fetchRemoteMomentIdsByLocalId(
    supabase,
    userId,
    localMomentIds,
  );
  const rows = momentRows
    .map((row) => {
      const catMomentId = remoteMomentIds.get(row.local_moment_id);
      const remoteCatId =
        (row.local_cat_id ? remoteCatIds.get(row.local_cat_id) : undefined) ??
        (row.owner_cat_id ? remoteCatIds.get(row.owner_cat_id) : undefined) ??
        null;

      if (!catMomentId || !remoteCatId) {
        return null;
      }

      return {
        user_id: userId,
        cat_moment_id: catMomentId,
        cat_id: remoteCatId,
        is_primary: true,
        metadata: SYNC_METADATA,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (rows.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("cat_moment_cats")
    .upsert(rows, { onConflict: "cat_moment_id,cat_id" });

  if (error) {
    throw new Error(`Cat moment link sync failed: ${error.message}`);
  }
}

async function fetchRemoteMomentIdsByLocalId(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
  localMomentIds: string[],
) {
  const byLocalId = new Map<string, string>();
  const chunkSize = 500;

  for (let start = 0; start < localMomentIds.length; start += chunkSize) {
    const chunk = localMomentIds.slice(start, start + chunkSize);
    const { data, error } = await supabase
      .from("cat_moments")
      .select("id,local_moment_id")
      .eq("user_id", userId)
      .in("local_moment_id", chunk);

    if (error) {
      throw new Error(`Cat moment link lookup failed: ${error.message}`);
    }

    for (const row of (data ?? []) as {
      id: string | null;
      local_moment_id: string | null;
    }[]) {
      if (row.id && row.local_moment_id) {
        byLocalId.set(row.local_moment_id, row.id);
      }
    }
  }

  return byLocalId;
}

async function syncLocalState(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
  localState: LocalStateItem[],
  result: AccountSyncResult,
) {
  if (localState.length === 0) {
    return;
  }

  const rows = localState.map((item) => ({
    user_id: userId,
    state_key: item.key,
    value: {
      source: LOCAL_STATE_SOURCE,
      value: item.value,
    },
  }));

  const { error } = await supabase
    .from("account_local_state")
    .upsert(rows, { onConflict: "user_id,state_key" });

  if (error) {
    throw new Error(`Local state sync failed: ${error.message}`);
  }

  result.pushedLocalState += rows.length;
}

async function prepareRemoteSleepingPhotoUrl(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
  group: "sleeping" | "deliveries",
  catId: string,
  photoId: string,
  src: string,
) {
  const persistentSrc = normalizePersistentPhotoSrc(src);

  if (!persistentSrc) {
    return null;
  }

  if (!persistentSrc.startsWith("data:")) {
    return persistentSrc;
  }

  const storagePath = await uploadDataUrl(
    supabase,
    `${userId}/${sanitizePathSegment(catId)}/${group}/${sanitizePathSegment(
      photoId,
    )}.${getDataUrlExtension(persistentSrc)}`,
    persistentSrc,
  );

  return toStoragePhotoUrl(storagePath);
}

async function restoreRemoteSnapshot(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
  result: AccountSyncResult,
  options: {
    mergeLocal: boolean;
    replaceLocalCats?: boolean;
    replaceLocalState?: boolean;
  },
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
    await restoreLocalState(supabase, userId, result, options);
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
        ? toStoragePhotoUrl(cat.home_photo_storage_path)
        : undefined,
      homePhotoPosition: cat.home_photo_position ?? undefined,
      coverPhotoDataUrl: (cat.cover_storage_path ?? cat.avatar_storage_path)
        ? toStoragePhotoUrl(cat.cover_storage_path ?? cat.avatar_storage_path ?? "")
        : undefined,
      coverCrop: normalizeCoverCrop(cat.cover_crop),
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
      const existingProfile = profiles[existingIndex];

      profiles[existingIndex] = {
        ...existingProfile,
        ...restoredProfile,
        coverPhotoDataUrl:
          restoredProfile.coverPhotoDataUrl ?? existingProfile.coverPhotoDataUrl,
        homePhotoDataUrl:
          restoredProfile.homePhotoDataUrl ?? existingProfile.homePhotoDataUrl,
        homePhotoPosition:
          restoredProfile.homePhotoPosition ?? existingProfile.homePhotoPosition,
        coverCrop: restoredProfile.coverCrop ?? existingProfile.coverCrop,
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
  await restoreCatGalleryPhotos(supabase, userId, remoteIdToLocalId, result, options);
  await restoreCollectionPhotos(supabase, userId, remoteIdToLocalId, result, options);
  await restoreSleepingPhotos(supabase, userId, remoteIdToLocalId, result, options);
  await restoreLocalState(supabase, userId, result, options);
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

async function restoreCatGalleryPhotos(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
  remoteIdToLocalId: Map<string, string>,
  result: AccountSyncResult,
  options: { mergeLocal: boolean },
): Promise<{ remoteCount: number; restoredCount: number }> {
  const { data, error } = await supabase
    .from("collection_photos")
    .select("id, cat_id, local_cat_id, local_photo_id, slot_slug, storage_path, captured_at, created_at")
    .eq("user_id", userId)
    .eq("slot_slug", CAT_GALLERY_COLLECTION_SLOT)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Cat gallery restore failed: ${error.message}`);
  }

  const remoteCount = data?.length ?? 0;
  const photos: CatGalleryPhoto[] = [];

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

    const createdAt = new Date(photo.captured_at ?? photo.created_at).getTime();

    if (Number.isNaN(createdAt)) {
      continue;
    }

    photos.push({
      id: photo.local_photo_id ?? photo.id,
      catId: localCatId,
      src: photoSrc,
      createdAt,
    });
  }

  if (photos.length === 0) {
    return { remoteCount, restoredCount: 0 };
  }

  const restoredCount = restoreSyncedCatGalleryPhotos({
    photos,
    mergeLocal: options.mergeLocal,
  });

  result.restoredCatGalleryPhotos += restoredCount;

  return { remoteCount, restoredCount };
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
    .neq("slot_slug", CAT_GALLERY_COLLECTION_SLOT)
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
  const { moments, deliveries, errors } = await fetchAllSleepingPhotoRows(
    supabase,
    userId,
  );

  if (errors.length > 0) {
    result.errors.push(...errors);
    return;
  }

  const ownPhotos = (
    await Promise.all(
      moments.map(
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
      deliveries.map(
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

async function fetchAllSleepingPhotoRows(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
) {
  const [momentsResult, deliveriesResult] = await Promise.all([
    fetchAllCatMomentRows(supabase, userId),
    fetchAllKeptDeliveryRows(supabase, userId),
  ]);

  return {
    moments: momentsResult.rows,
    deliveries: deliveriesResult.rows,
    errors: [...momentsResult.errors, ...deliveriesResult.errors],
  };
}

async function fetchAllCatMomentRows(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
) {
  const rows: RemoteCatMomentRow[] = [];
  const errors: string[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("cat_moments")
      .select(
        "id, local_moment_id, local_cat_id, owner_cat_id, photo_url, state, visibility, delivery_status, source_moment_id, metadata, captured_at, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      errors.push(`Sleeping photo restore skipped: ${error.message}`);
      break;
    }

    const page = ((data ?? []) as RemoteCatMomentRow[]).filter(Boolean);
    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return { rows, errors };
}

async function fetchAllKeptDeliveryRows(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
) {
  const rows: RemoteCatMomentDeliveryRow[] = [];
  const errors: string[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("cat_moment_deliveries")
      .select(
        "id, local_delivery_id, source_moment_id, source_photo_id, recipient_local_cat_id, photo_url, status, metadata, delivered_at",
      )
      .eq("user_id", userId)
      .eq("status", "kept")
      .order("delivered_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      errors.push(`Kept photo restore skipped: ${error.message}`);
      break;
    }

    const page = ((data ?? []) as RemoteCatMomentDeliveryRow[]).filter(Boolean);
    rows.push(...page);

    if (page.length < pageSize) {
      break;
    }
  }

  return { rows, errors };
}

async function restoreLocalState(
  supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>,
  userId: string,
  result: AccountSyncResult,
  options: { mergeLocal: boolean; replaceLocalState?: boolean },
) {
  const { data, error } = await supabase
    .from("account_local_state")
    .select("state_key,value")
    .eq("user_id", userId);

  if (error) {
    result.errors.push(`Local state restore skipped: ${error.message}`);
    return;
  }

  let restoredCount = 0;

  for (const row of (data ?? []) as RemoteLocalStateRow[]) {
    if (!isSyncableLocalStateKey(row.state_key)) {
      continue;
    }

    if (
      options.mergeLocal &&
      !options.replaceLocalState &&
      window.localStorage.getItem(row.state_key) !== null
    ) {
      continue;
    }

    const value = unwrapRemoteLocalStateValue(row.value);

    try {
      window.localStorage.setItem(row.state_key, serializeLocalStateValue(value));
      restoredCount += 1;
    } catch {
      result.errors.push(`Local state restore skipped: ${row.state_key}`);
    }
  }

  result.restoredLocalState += restoredCount;
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
  options: {
    slotSlug?: string;
    excludeReservedCollectionSlots?: boolean;
  } = {},
) {
  const localIds = rows
    .map((row) => row[idField])
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (localIds.length === 0) {
    return rows;
  }

  let query = supabase
    .from(table)
    .select(idField)
    .eq("user_id", userId)
    .in(idField, localIds);

  if (table === "collection_photos" && options.slotSlug) {
    query = query.eq("slot_slug", options.slotSlug);
  } else if (
    table === "collection_photos" &&
    options.excludeReservedCollectionSlots
  ) {
    query = query.neq("slot_slug", CAT_GALLERY_COLLECTION_SLOT);
  }

  const { data, error } = await query;

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
    !profile.coverPhotoDataUrl &&
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
    !cat.cover_storage_path &&
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

function readSyncableLocalState(): LocalStateItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  const items: LocalStateItem[] = [];

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);

    if (!key || !isSyncableLocalStateKey(key)) {
      continue;
    }

    const raw = window.localStorage.getItem(key);

    if (raw === null) {
      continue;
    }

    items.push({
      key,
      value: parseLocalStateValue(raw),
    });
  }

  return items;
}

function isSyncableLocalStateKey(key: string) {
  if (LOCAL_STATE_SKIP_KEYS.has(key)) {
    return false;
  }

  return (
    SYNCABLE_LOCAL_STATE_KEYS.has(key) ||
    SYNCABLE_LOCAL_STATE_PREFIXES.some((prefix) => key.startsWith(prefix))
  );
}

function parseLocalStateValue(raw: string) {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

function unwrapRemoteLocalStateValue(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const wrapped = value as { source?: unknown; value?: unknown };

  if (wrapped.source === LOCAL_STATE_SOURCE && "value" in wrapped) {
    return wrapped.value;
  }

  return value;
}

function serializeLocalStateValue(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value ?? null);
}

function writeCollectionStoreWithFallback(collectionStore: LocalCollectionStore) {
  for (const maxPhotosPerSlot of [Number.POSITIVE_INFINITY, 24, 12, 8, 4, 2, 1]) {
    const trimmedStore = Number.isFinite(maxPhotosPerSlot)
      ? trimCollectionStore(collectionStore, maxPhotosPerSlot)
      : collectionStore;

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

function normalizeCoverCrop(
  crop: Record<string, unknown> | LocalCatProfile["coverCrop"] | null | undefined,
): LocalCatProfile["coverCrop"] | undefined {
  if (!crop || typeof crop !== "object" || Array.isArray(crop)) {
    return undefined;
  }

  const scale = Number(crop.scale);
  const offsetX = Number(crop.offsetX);
  const offsetY = Number(crop.offsetY);

  if (
    !Number.isFinite(scale) ||
    !Number.isFinite(offsetX) ||
    !Number.isFinite(offsetY)
  ) {
    return undefined;
  }

  return {
    scale: Math.min(2.8, Math.max(1, scale)),
    offsetX: Math.min(48, Math.max(-48, offsetX)),
    offsetY: Math.min(48, Math.max(-48, offsetY)),
  };
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
