# review-extract-2026-07-02

???: 2026-07-02

??: ??????/?????????????????????????

??: secret????????DB????????????

## a. RLS policies

??: `cat_moments` / `collection_photos` / `cats` / `photo_reports` / `subscriptions`?migration?????????????? policy/RLS statement ????

### supabase/migrations/20260524190000_create_account_sync_tables.sql

```sql
alter table public.cats enable row level security;

alter table public.collection_photos enable row level security;

create policy "cats_select_own"
on public.cats
for select
to authenticated
using (owner_user_id = auth.uid());

create policy "cats_insert_own"
on public.cats
for insert
to authenticated
with check (owner_user_id = auth.uid());

create policy "cats_update_own"
on public.cats
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

create policy "cats_delete_own"
on public.cats
for delete
to authenticated
using (owner_user_id = auth.uid());

create policy "record_logs_select_own"
on public.record_logs
for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cats
    where cats.id = record_logs.cat_id
      and cats.owner_user_id = auth.uid()
  )
);

create policy "record_logs_insert_own"
on public.record_logs
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cats
    where cats.id = record_logs.cat_id
      and cats.owner_user_id = auth.uid()
  )
);

create policy "record_logs_update_own"
on public.record_logs
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cats
    where cats.id = record_logs.cat_id
      and cats.owner_user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cats
    where cats.id = record_logs.cat_id
      and cats.owner_user_id = auth.uid()
  )
);

create policy "record_logs_delete_own"
on public.record_logs
for delete
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cats
    where cats.id = record_logs.cat_id
      and cats.owner_user_id = auth.uid()
  )
);

create policy "collection_photos_select_own"
on public.collection_photos
for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cats
    where cats.id = collection_photos.cat_id
      and cats.owner_user_id = auth.uid()
  )
);

create policy "collection_photos_insert_own"
on public.collection_photos
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cats
    where cats.id = collection_photos.cat_id
      and cats.owner_user_id = auth.uid()
  )
);

create policy "collection_photos_update_own"
on public.collection_photos
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cats
    where cats.id = collection_photos.cat_id
      and cats.owner_user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cats
    where cats.id = collection_photos.cat_id
      and cats.owner_user_id = auth.uid()
  )
);

create policy "collection_photos_delete_own"
on public.collection_photos
for delete
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cats
    where cats.id = collection_photos.cat_id
      and cats.owner_user_id = auth.uid()
  )
);
```



### supabase/migrations/20260602093000_create_cat_moment_tables.sql

```sql
alter table public.cat_moments enable row level security;

drop policy if exists "cat_moments_select_own" on public.cat_moments;

create policy "cat_moments_select_own"
on public.cat_moments
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "cat_moments_insert_own" on public.cat_moments;

create policy "cat_moments_insert_own"
on public.cat_moments
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "cat_moments_insert_anonymous_backup" on public.cat_moments;

create policy "cat_moments_insert_anonymous_backup"
on public.cat_moments
for insert
to anon
with check (user_id is null and anonymous_id is not null);

drop policy if exists "cat_moments_update_own" on public.cat_moments;

create policy "cat_moments_update_own"
on public.cat_moments
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "cat_moments_delete_own" on public.cat_moments;

create policy "cat_moments_delete_own"
on public.cat_moments
for delete
to authenticated
using (user_id = auth.uid());
```



### supabase/migrations/20260604180000_allow_shared_delivery_pool.sql

```sql
drop policy if exists "cat_moments_select_shared_available" on public.cat_moments;

create policy "cat_moments_select_shared_available"
on public.cat_moments
for select
to anon, authenticated
using (
  visibility = 'shared'
  and delivery_status = 'available'
);
```



### supabase/migrations/20260607093000_create_subscriptions.sql

```sql
alter table public.subscriptions enable row level security;
```



### supabase/migrations/20260611173000_revoke_anon_cat_moments_select.sql

```sql
-- Close direct anonymous reads of the sleeping delivery pool.
-- Delivery selection now goes through /api/sleeping-delivery/exchange.

drop policy if exists "cat_moments_select_shared_available" on public.cat_moments;
```



### supabase/migrations/20260612093000_create_photo_reports.sql

```sql
alter table public.photo_reports enable row level security;
```



### supabase/migrations/20260617093000_create_cat_moment_cats.sql

```sql
create policy "cat_moment_cats_select_own"
on public.cat_moment_cats
for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cat_moments
    where cat_moments.id = cat_moment_cats.cat_moment_id
      and cat_moments.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.cats
    where cats.id = cat_moment_cats.cat_id
      and cats.owner_user_id = auth.uid()
  )
);

create policy "cat_moment_cats_insert_own"
on public.cat_moment_cats
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cat_moments
    where cat_moments.id = cat_moment_cats.cat_moment_id
      and cat_moments.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.cats
    where cats.id = cat_moment_cats.cat_id
      and cats.owner_user_id = auth.uid()
  )
);

create policy "cat_moment_cats_update_own"
on public.cat_moment_cats
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cat_moments
    where cat_moments.id = cat_moment_cats.cat_moment_id
      and cat_moments.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.cats
    where cats.id = cat_moment_cats.cat_id
      and cats.owner_user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cat_moments
    where cat_moments.id = cat_moment_cats.cat_moment_id
      and cat_moments.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.cats
    where cats.id = cat_moment_cats.cat_id
      and cats.owner_user_id = auth.uid()
  )
);

create policy "cat_moment_cats_delete_own"
on public.cat_moment_cats
for delete
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.cat_moments
    where cat_moments.id = cat_moment_cats.cat_moment_id
      and cat_moments.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.cats
    where cats.id = cat_moment_cats.cat_id
      and cats.owner_user_id = auth.uid()
  )
);
```



### Codex????

- migration??statement????????????????SQL???????????policy??????????????

- `grant` / `revoke` ?policy?????????????????????????

- ??Supabase???????policy?dashboard/SQL editor????????

## b. /api/sleeping-delivery/exchange route??

### exchange route full text

File: `src/app/api/sleeping-delivery/exchange/route.ts`

```ts
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CAT_PHOTOS_BUCKET,
  getDataUrlExtension,
  getStoragePhotoPath,
  isUsablePhotoSrc,
  sanitizePathSegment,
  toStoragePhotoUrl,
  uploadDataUrl,
} from "../../../../lib/photoStorage";
import {
  isOwnStoragePath,
  isSafeStoragePath,
} from "../../../../lib/photoStorageAuthorization";
import { getAuthenticatedUserForRequest } from "../../../../lib/adminAccess";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import type { ExchangePhoto } from "../../../../lib/home/sleepingPhotos";
import {
  isBlockedDeliveryPhotoUrl,
  isBlockedDeliveryPoolRow,
} from "../../../../lib/home/deliveryPoolGuards";
import {
  getServerJstDateKey,
  isServerDateKey,
  validateServerDeliveryDateKey,
} from "../../../../lib/home/eveningDeliveryServer";

export const dynamic = "force-dynamic";

type ExchangeRequest = {
  ownPhoto?: {
    id?: string;
    catId?: string;
    ownerCatId?: string;
    src?: string;
    createdAt?: number;
    triggerLabel?: string;
    theme?: string;
  };
  triggerLabel?: string;
  theme?: string;
  category?: string;
  seed?: string;
  deliveryDateKey?: string | null;
  recipientCatId?: string | null;
  anonymousId?: string | null;
  blockedPhotoIds?: string[];
  preferredSourcePhotoId?: string | null;
  debugDryRun?: boolean;
  mode?: "onboarding" | null;
};

type RemoteCatMomentRow = {
  id: string;
  user_id: string | null;
  anonymous_id: string | null;
  local_moment_id: string;
  local_cat_id: string;
  owner_cat_id: string;
  photo_url: string;
  delivery_status: "available" | "hidden" | "reported";
  moderation_status?: "pending" | "approved" | "rejected";
  pool_date?: string | null;
  delivery_count?: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type FastStockCandidateRow = Omit<RemoteCatMomentRow, "photo_url">;

type RemoteDeliveryRow = {
  id: string;
  local_delivery_id: string;
  source_moment_id: string | null;
  source_photo_id: string | null;
  recipient_local_cat_id: string | null;
  photo_url: string;
  status: string;
  metadata: Record<string, unknown> | null;
  delivered_at: string;
};

type Candidate = {
  row: RemoteCatMomentRow;
  src: string;
  tags: string[];
  tier: DeliveryTier;
};

type DeliveryTier = 1 | 2 | 3;

type ExchangeRequestParseResult =
  | { ok: true; input: Required<ExchangeRequest> }
  | {
      ok: false;
      status: 400 | 413;
      error: "invalid_json" | "invalid_exchange_request" | "payload_too_large";
    };

type ExchangeValidationResult =
  | { ok: true }
  | {
      ok: false;
      status: 400 | 401 | 403 | 413 | 415;
      error:
        | "invalid_exchange_request"
        | "payload_too_large"
        | "auth_required"
        | "forbidden_photo"
        | "unsupported_media_type";
    };

type RateLimitBucket = {
  minuteStartedAt: number;
  minuteCount: number;
  hourStartedAt: number;
  hourCount: number;
  updatedAt: number;
};

const MAX_JSON_BODY_LENGTH = 3 * 1024 * 1024;
const MAX_OWN_PHOTO_SRC_LENGTH = 2 * 1024 * 1024;
const MAX_OWN_PHOTO_BYTES = 1536 * 1024;
const MAX_BLOCKED_PHOTO_IDS = 100;
const MAX_ID_LENGTH = 160;
const MAX_TEXT_LENGTH = 120;
const MIN_CREATED_AT = Date.UTC(2020, 0, 1);
const MAX_CREATED_AT_FUTURE_DRIFT_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_PER_MINUTE = 10;
const RATE_LIMIT_PER_HOUR = 60;
const RATE_LIMIT_WINDOW_MINUTE_MS = 60 * 1000;
const RATE_LIMIT_WINDOW_HOUR_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX_BUCKETS = 1000;
const FAST_STORAGE_CANDIDATE_LIMIT = 80;
const FAST_STORAGE_CANDIDATE_PROBE_LIMIT = 12;
const TIERED_CANDIDATE_LIMIT = 240;
const TRANSIENT_DELIVERY_SIGNED_URL_SECONDS = 10 * 60;
const exchangeRateLimitBuckets = new Map<string, RateLimitBucket>();
type FastCandidateMode = "admin_storage" | "tiered";

export async function POST(request: Request) {
  try {
    return await handleExchangePost(request);
  } catch (error) {
    console.error("[sleeping-delivery/exchange] unhandled error", error);
    return NextResponse.json(
      { photo: null, source: "none", error: "exchange_failed" },
      { status: 500 },
    );
  }
}

async function handleExchangePost(request: Request) {
  const timing = createExchangeTiming();
  const parsedInput = await readExchangeRequest(request);
  markExchangeTiming(timing, "read_request");

  if (!parsedInput.ok) {
    return exchangeError(parsedInput.error, parsedInput.status);
  }

  const input = parsedInput.input;
  const inputValidation = validateExchangeRequest(input);

  if (!inputValidation.ok) {
    return exchangeError(inputValidation.error, inputValidation.status);
  }

  const rateLimit = checkExchangeRateLimit(
    buildRateLimitKey(request, input.anonymousId),
  );

  if (!rateLimit.allowed) {
    return exchangeError("too_many_requests", 429);
  }

  if (!isValidOwnPhotoInput(input)) {
    return NextResponse.json(
      { photo: null, source: "none", error: "invalid_exchange_request" },
      { status: 400 },
    );
  }

  const ownPhoto = input.ownPhoto;
  const createdAt = new Date(ownPhoto.createdAt ?? Date.now()).toISOString();
  const ownerCatId = ownPhoto.ownerCatId || ownPhoto.catId;
  const ownPhotoStoragePath = getStoragePhotoPath(ownPhoto.src);
  const shouldAddOwnPhotoToPool =
    !ownPhotoStoragePath && !isBlockedDeliveryPhotoUrl(ownPhoto.src);
  const debugDryRun =
    input.debugDryRun === true && process.env.NODE_ENV !== "production";
  const user = shouldAddOwnPhotoToPool || ownPhotoStoragePath
    ? await getAuthenticatedUserForRequest(request)
    : null;
  markExchangeTiming(timing, "auth");

  if (ownPhotoStoragePath) {
    // Storage-backed own photos are account-owned. Do not accept anonymousId
    // alone here; otherwise a forged anonymousId could send someone else's path.
    if (!isSafeStoragePath(ownPhotoStoragePath)) {
      return exchangeError("invalid_exchange_request", 400);
    }
    if (!user) {
      return exchangeError("auth_required", 401);
    }
    if (!isOwnStoragePath(ownPhotoStoragePath, user.id)) {
      return exchangeError("forbidden_photo", 403);
    }
  }

  const userId = user?.id ?? null;
  const anonymousId = userId ? null : input.anonymousId;
  const adminSupabase = createSupabaseAdminClient();
  const serverSupabase = adminSupabase ? null : await createServerSupabaseClient();
  const supabase = adminSupabase ?? serverSupabase;

  if (!userId && !anonymousId) {
    return NextResponse.json(
      { photo: null, source: "none", error: "invalid_exchange_request" },
      { status: 400 },
    );
  }

  if (!supabase) {
    return NextResponse.json(
      { photo: null, source: "none", error: "server_unavailable" },
      { status: 503 },
    );
  }

  const deliveryDateValidation = await validateExchangeDeliveryDateKey({
    supabase,
    userId,
    anonymousId,
    deliveryDateKey: input.deliveryDateKey,
    mode: input.mode,
    debugDryRun,
  });

  if (!deliveryDateValidation.ok) {
    return NextResponse.json(
      {
        photo: null,
        source: "none",
        error: deliveryDateValidation.error,
        serverDateKey: deliveryDateValidation.serverDateKey,
      },
      { status: 422 },
    );
  }

  const idempotentDeliveryId =
    input.deliveryDateKey && !debugDryRun
      ? buildIdempotentDeliveryId({
          userId,
          anonymousId,
          deliveryDateKey: input.deliveryDateKey,
        })
      : null;

  if (idempotentDeliveryId) {
    const existingDelivery = await readExistingDelivery({
      supabase,
      userId,
      anonymousId,
      localDeliveryId: idempotentDeliveryId,
    });

    if (existingDelivery) {
      markExchangeTiming(timing, "read_existing_delivery");
      logExchangeTiming(timing, {
        result: "existing",
        deliveryDateKey: input.deliveryDateKey,
      });
      const existingPhoto = await attachTransientDeliverySignedUrl(
        toExchangePhotoFromDelivery(existingDelivery, input),
        supabase,
      );
      return NextResponse.json({
        photo: existingPhoto,
        source: "remote",
        diagnostics: {
          ...buildDiagnostics([], new Set(input.blockedPhotoIds ?? [])),
          source: "remote",
          candidateCount: 1,
          normalCandidateCount: 1,
          fallbackCandidateCount: 0,
          fallbackActive: false,
          excludedCount: 0,
          fastPathActive: false,
          fastCandidateCount: 0,
          idempotentReplay: true,
          tier: null,
          timing,
        },
        tier: null,
      });
    }
  }

  if (!debugDryRun && shouldAddOwnPhotoToPool) {
    const ownPhotoUrl = await prepareExchangeMomentPhotoUrl({
      supabase,
      userId,
      anonymousId,
      ownerCatId,
      localMomentId: ownPhoto.id,
      src: ownPhoto.src,
      canUseStorage: Boolean(adminSupabase),
    });

    await deleteExistingMoment({
      supabase,
      userId,
      anonymousId,
      localMomentId: ownPhoto.id,
    });

    const { error: momentError } = await supabase.from("cat_moments").insert({
      user_id: userId,
      anonymous_id: anonymousId,
      local_moment_id: ownPhoto.id,
      local_cat_id: ownPhoto.catId,
      owner_cat_id: ownerCatId,
      photo_url: ownPhotoUrl,
      state: "sleeping",
      visibility: "shared",
      delivery_status: "available",
      source_moment_id: null,
      metadata: {
        source: "user",
        pool_kind: "user_shared",
        trigger_label: input.triggerLabel,
        theme: input.theme,
        category: input.category,
        shared: true,
      },
      captured_at: createdAt,
      created_at: createdAt,
    });

    if (momentError) {
      return NextResponse.json(
        { photo: null, source: "none", error: momentError.message },
        { status: 500 },
      );
    }
  }
  markExchangeTiming(timing, "own_photo");

  const blockedPhotoIds = new Set(input.blockedPhotoIds ?? []);
  const deliveredSourceMomentIds = await readDeliveredSourceMomentIds({
    supabase,
    userId,
    anonymousId,
  });
  markExchangeTiming(timing, "read_delivered_sources");
  const deliverableContext = {
    userId,
    anonymousId,
    recipientCatId: input.recipientCatId,
    excludePhotoId: ownPhoto.id,
    blockedPhotoIds,
    deliveredSourceMomentIds,
  };

  const fastCandidateMode = readFastCandidateMode();
  const fastRows =
    fastCandidateMode === "admin_storage"
      ? await readFastStockCandidateRows(supabase)
      : [];
  markExchangeTiming(timing, "read_fast_storage");
  const fastCandidates = fastRows.filter((row) =>
    isFastStockCandidateDeliverable(row, deliverableContext),
  );
  let diagnosticsBase = buildDiagnostics([], blockedPhotoIds);
  let candidates: RemoteCatMomentRow[] = [];
  let fallbackCandidates: RemoteCatMomentRow[] = [];
  let candidatePool: RemoteCatMomentRow[] = [];
  let selected =
    fastCandidateMode === "admin_storage"
      ? await selectFastStorageCandidate(
          fastCandidates,
          input,
          supabase,
          deliverableContext,
        )
      : null;
  let fastPathActive = Boolean(selected);
  markExchangeTiming(timing, "select_fast_storage");

  if (!selected) {
    const remoteRows = await readRemoteCandidateRows(supabase);
    markExchangeTiming(timing, "read_full_pool");
    diagnosticsBase = buildDiagnostics(remoteRows, blockedPhotoIds);
    const tieredRows = sortTieredCandidates(
      remoteRows.filter((row) => isRowDeliverable(row, deliverableContext)),
      input,
    );
    candidates = tieredRows.filter((row) => getDeliveryTier(row, input) < 3);
    fallbackCandidates = tieredRows.filter(
      (row) => getDeliveryTier(row, input) === 3,
    );
    candidatePool = tieredRows;
    selected = await selectCandidate(candidatePool, input, supabase);
    fastPathActive = false;
    markExchangeTiming(timing, "select_full_pool");
  } else {
    diagnosticsBase = buildDiagnostics([selected.row], blockedPhotoIds);
    candidates = [selected.row];
    candidatePool = [selected.row];
  }

  if (!selected) {
    logExchangeTiming(timing, {
      result: "none",
      fastPathActive,
      fastCandidateCount: fastCandidates.length,
      candidateCount: candidatePool.length,
    });
    return NextResponse.json({
      photo: null,
      source: "none",
      diagnostics: {
        ...diagnosticsBase,
        source: "none",
        candidateCount: candidatePool.length,
        normalCandidateCount: candidates.length,
        fallbackCandidateCount: fallbackCandidates.length,
        fallbackActive: candidates.length === 0 && fallbackCandidates.length > 0,
        excludedCount: Math.max(0, diagnosticsBase.availableCount - candidatePool.length),
        duplicateExcludedCount: deliveredSourceMomentIds.size,
        fastPathActive,
        fastCandidateCount: fastCandidates.length,
        timing,
      },
    });
  }

  const localDeliveryId =
    idempotentDeliveryId ??
    `delivered-sleeping-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const deliveredAt = new Date();
  const deliveryPhotoSrc = await prepareExchangeDeliveryPhotoSrc({
    supabase,
    row: selected.row,
    resolvedSrc: selected.src,
    canUseStorage: Boolean(adminSupabase),
  });
  markExchangeTiming(timing, "delivery_photo");
  const photo: ExchangePhoto = {
    id: localDeliveryId,
    sourcePhotoId: selected.row.local_moment_id,
    src: deliveryPhotoSrc,
    title: "ほかの猫のねがお",
    subtitle: "",
    triggerLabel: input.triggerLabel,
    theme: input.theme,
    deliveredAt: deliveredAt.getTime(),
  };

  if (!debugDryRun) {
    const { error: deliveryError } = await supabase
      .from("cat_moment_deliveries")
      .insert({
        user_id: userId,
        anonymous_id: anonymousId,
        local_delivery_id: localDeliveryId,
        source_moment_id: selected.row.id,
        source_photo_id: selected.row.local_moment_id,
        recipient_local_cat_id: input.recipientCatId,
        photo_url: deliveryPhotoSrc,
        status: "delivered",
        metadata: {
          source: "server_exchange",
          source_pool_kind: readPoolKind(selected.row.metadata),
          trigger_label: input.triggerLabel,
          theme: input.theme,
          category: input.category,
          delivery_date_key: input.deliveryDateKey,
          delivery_tier: selected.tier,
        },
        delivered_at: deliveredAt.toISOString(),
      });

    if (deliveryError) {
      if (idempotentDeliveryId && isUniqueDeliveryError(deliveryError)) {
        const existingDelivery = await readExistingDelivery({
          supabase,
          userId,
          anonymousId,
          localDeliveryId: idempotentDeliveryId,
        });

        if (existingDelivery) {
          markExchangeTiming(timing, "read_duplicate_delivery");
          logExchangeTiming(timing, {
            result: "existing_after_duplicate",
            deliveryDateKey: input.deliveryDateKey,
          });
          const existingPhoto = await attachTransientDeliverySignedUrl(
            toExchangePhotoFromDelivery(existingDelivery, input),
            supabase,
          );
          return NextResponse.json({
            photo: existingPhoto,
            source: "remote",
            diagnostics: {
              ...diagnosticsBase,
              source: "remote",
              candidateCount: candidatePool.length,
              normalCandidateCount: candidates.length,
              fallbackCandidateCount: fallbackCandidates.length,
              fallbackActive:
                candidates.length === 0 && fallbackCandidates.length > 0,
              excludedCount: Math.max(
                0,
                diagnosticsBase.availableCount - candidatePool.length,
              ),
              duplicateExcludedCount: deliveredSourceMomentIds.size,
              fastPathActive,
              fastCandidateCount: fastCandidates.length,
              idempotentReplay: true,
              tier: selected.tier,
              timing,
            },
            tier: selected.tier,
          });
        }
      }

      return NextResponse.json(
        { photo: null, source: "none", error: deliveryError.message },
        { status: 500 },
      );
    }

    await incrementDeliveryCount({
      supabase,
      row: selected.row,
    });
  }
  markExchangeTiming(timing, "insert_delivery");
  logExchangeTiming(timing, {
    result: "remote",
    fastPathActive,
    fastCandidateCount: fastCandidates.length,
    candidateCount: candidatePool.length,
    selectedStorage: Boolean(getStoragePhotoPath(selected.row.photo_url)),
    tier: selected.tier,
  });

  return NextResponse.json({
    photo: await attachTransientDeliverySignedUrl(photo, supabase),
    source: "remote",
    tier: selected.tier,
    diagnostics: {
      ...diagnosticsBase,
      source: "remote",
      candidateCount: candidatePool.length,
      normalCandidateCount: candidates.length,
      fallbackCandidateCount: fallbackCandidates.length,
      fallbackActive: candidates.length === 0 && fallbackCandidates.length > 0,
      excludedCount: Math.max(0, diagnosticsBase.availableCount - candidatePool.length),
      duplicateExcludedCount: deliveredSourceMomentIds.size,
      fastPathActive,
      fastCandidateCount: fastCandidates.length,
      tier: selected.tier,
      timing,
    },
  });
}

async function readExchangeRequest(request: Request): Promise<ExchangeRequestParseResult> {
  const rawBody = await request.text().catch(() => "");

  if (rawBody.length > MAX_JSON_BODY_LENGTH) {
    return { ok: false, status: 413, error: "payload_too_large" };
  }

  let body: ExchangeRequest;

  try {
    body = JSON.parse(rawBody || "{}") as ExchangeRequest;
  } catch {
    return { ok: false, status: 400, error: "invalid_json" };
  }

  if (
    Array.isArray(body.blockedPhotoIds) &&
    body.blockedPhotoIds.length > MAX_BLOCKED_PHOTO_IDS
  ) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  return {
    ok: true,
    input: {
      ownPhoto: body.ownPhoto ?? {},
      triggerLabel: toStringOrDefault(body.triggerLabel, "ねがお"),
      theme: toStringOrDefault(body.theme, "sleeping"),
      category: toStringOrDefault(body.category, "sleeping"),
      seed: toStringOrDefault(body.seed, String(Date.now())),
      deliveryDateKey: toStringOrNull(body.deliveryDateKey),
      recipientCatId: toStringOrNull(body.recipientCatId),
      anonymousId: toStringOrNull(body.anonymousId),
      blockedPhotoIds: Array.isArray(body.blockedPhotoIds)
        ? body.blockedPhotoIds.filter((id) => typeof id === "string")
        : [],
      preferredSourcePhotoId: toStringOrNull(body.preferredSourcePhotoId),
      debugDryRun: body.debugDryRun === true,
      mode: body.mode === "onboarding" ? "onboarding" : null,
    },
  };
}

function isValidOwnPhotoInput(
  input: Required<ExchangeRequest>,
): input is Required<ExchangeRequest> & {
  ownPhoto: {
    id: string;
    catId: string;
    ownerCatId?: string;
    src: string;
    createdAt?: number;
  };
} {
  return Boolean(
    typeof input.ownPhoto.id === "string" &&
      typeof input.ownPhoto.catId === "string" &&
      typeof input.ownPhoto.src === "string" &&
      input.ownPhoto.src,
  );
}

function validateExchangeRequest(
  input: Required<ExchangeRequest>,
): ExchangeValidationResult {
  if (!isValidOwnPhotoInput(input)) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  const ownPhoto = input.ownPhoto;
  const stringFields = [
    ownPhoto.id,
    ownPhoto.catId,
    ownPhoto.ownerCatId,
    input.anonymousId,
    input.recipientCatId,
    input.preferredSourcePhotoId,
  ].filter((value): value is string => typeof value === "string");

  if (stringFields.some((value) => value.length > MAX_ID_LENGTH)) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  const textFields = [
    input.triggerLabel,
    input.theme,
    input.category,
    input.seed,
    input.deliveryDateKey,
    input.mode,
    ownPhoto.triggerLabel,
    ownPhoto.theme,
  ].filter((value): value is string => typeof value === "string");

  if (textFields.some((value) => value.length > MAX_TEXT_LENGTH)) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  if (
    input.blockedPhotoIds.length > MAX_BLOCKED_PHOTO_IDS ||
    input.blockedPhotoIds.some((id) => id.length > MAX_ID_LENGTH)
  ) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  if (
    input.deliveryDateKey &&
    !isServerDateKey(input.deliveryDateKey)
  ) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  if (
    typeof ownPhoto.createdAt === "number" &&
    (!Number.isFinite(ownPhoto.createdAt) ||
      ownPhoto.createdAt < MIN_CREATED_AT ||
      ownPhoto.createdAt > Date.now() + MAX_CREATED_AT_FUTURE_DRIFT_MS)
  ) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  return validateOwnPhotoDataUrl(ownPhoto.src);
}

function validateOwnPhotoDataUrl(src: string): ExchangeValidationResult {
  const storagePath = getStoragePhotoPath(src);

  if (storagePath !== null) {
    return validateOwnPhotoStoragePath(storagePath);
  }

  if (!src || !src.startsWith("data:")) {
    return { ok: false, status: 415, error: "unsupported_media_type" };
  }

  if (src.length > MAX_OWN_PHOTO_SRC_LENGTH) {
    return { ok: false, status: 413, error: "payload_too_large" };
  }

  const match = src.match(
    /^data:(image\/(?:jpeg|png|webp));base64,([a-zA-Z0-9+/]+={0,2})$/,
  );

  if (!match) {
    return { ok: false, status: 415, error: "unsupported_media_type" };
  }

  const mime = match[1];
  const base64 = match[2];
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const byteLength = Math.floor((base64.length * 3) / 4) - padding;

  if (base64.length % 4 !== 0 || byteLength <= 0) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  if (byteLength > MAX_OWN_PHOTO_BYTES) {
    return { ok: false, status: 413, error: "payload_too_large" };
  }

  const header = Buffer.from(base64.slice(0, 32), "base64");

  if (!hasExpectedImageMagicNumber(mime, header)) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  return { ok: true };
}

function validateOwnPhotoStoragePath(path: string): ExchangeValidationResult {
  if (
    !path ||
    path.length > 512 ||
    path.includes("\\") ||
    path.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  return { ok: true };
}

function hasExpectedImageMagicNumber(mime: string, header: Buffer) {
  if (mime === "image/jpeg") {
    return header[0] === 0xff && header[1] === 0xd8;
  }

  if (mime === "image/png") {
    return (
      header[0] === 0x89 &&
      header[1] === 0x50 &&
      header[2] === 0x4e &&
      header[3] === 0x47
    );
  }

  if (mime === "image/webp") {
    return (
      header.toString("ascii", 0, 4) === "RIFF" &&
      header.toString("ascii", 8, 12) === "WEBP"
    );
  }

  return false;
}

function buildRateLimitKey(request: Request, anonymousId: string | null) {
  if (anonymousId) {
    return `anon:${anonymousId}`;
  }

  return `ip:${readClientIp(request)}`;
}

function readClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

function checkExchangeRateLimit(key: string) {
  const now = Date.now();
  const existing = exchangeRateLimitBuckets.get(key);
  const bucket: RateLimitBucket = existing
    ? {
        minuteStartedAt:
          now - existing.minuteStartedAt > RATE_LIMIT_WINDOW_MINUTE_MS
            ? now
            : existing.minuteStartedAt,
        minuteCount:
          now - existing.minuteStartedAt > RATE_LIMIT_WINDOW_MINUTE_MS
            ? 0
            : existing.minuteCount,
        hourStartedAt:
          now - existing.hourStartedAt > RATE_LIMIT_WINDOW_HOUR_MS
            ? now
            : existing.hourStartedAt,
        hourCount:
          now - existing.hourStartedAt > RATE_LIMIT_WINDOW_HOUR_MS
            ? 0
            : existing.hourCount,
        updatedAt: now,
      }
    : {
        minuteStartedAt: now,
        minuteCount: 0,
        hourStartedAt: now,
        hourCount: 0,
        updatedAt: now,
      };

  bucket.minuteCount += 1;
  bucket.hourCount += 1;
  exchangeRateLimitBuckets.set(key, bucket);
  pruneRateLimitBuckets(now);

  return {
    allowed:
      bucket.minuteCount <= RATE_LIMIT_PER_MINUTE &&
      bucket.hourCount <= RATE_LIMIT_PER_HOUR,
  };
}

function pruneRateLimitBuckets(now: number) {
  if (exchangeRateLimitBuckets.size <= RATE_LIMIT_MAX_BUCKETS) {
    return;
  }

  for (const [key, bucket] of exchangeRateLimitBuckets) {
    if (now - bucket.updatedAt > RATE_LIMIT_WINDOW_HOUR_MS * 2) {
      exchangeRateLimitBuckets.delete(key);
    }
  }
}

function exchangeError(error: string, status: 400 | 401 | 403 | 413 | 415 | 429) {
  return NextResponse.json({ photo: null, source: "none", error }, { status });
}

async function validateExchangeDeliveryDateKey({
  supabase,
  userId,
  anonymousId,
  deliveryDateKey,
  mode,
  debugDryRun,
}: {
  supabase: SupabaseClient;
  userId: string | null;
  anonymousId: string | null;
  deliveryDateKey: string | null;
  mode: "onboarding" | null;
  debugDryRun: boolean;
}) {
  const serverDateKey = getServerJstDateKey();

  if (debugDryRun) {
    return { ok: true as const };
  }

  const canUseOnboardingException =
    mode === "onboarding" &&
    (await hasNoPriorDeliveries({ supabase, userId, anonymousId }));

  if (canUseOnboardingException) {
    return { ok: true as const };
  }

  if (!deliveryDateKey) {
    return {
      ok: false as const,
      error: "delivery_not_yet" as const,
      serverDateKey,
    };
  }

  return validateServerDeliveryDateKey({ deliveryDateKey });
}

async function hasNoPriorDeliveries({
  supabase,
  userId,
  anonymousId,
}: {
  supabase: SupabaseClient;
  userId: string | null;
  anonymousId: string | null;
}) {
  let query = supabase
    .from("cat_moment_deliveries")
    .select("id", { count: "exact", head: true });

  query = userId
    ? query.eq("user_id", userId)
    : query.is("user_id", null).eq("anonymous_id", anonymousId ?? "");

  const { count, error } = await query;

  if (error) {
    console.warn("[sleeping-delivery/exchange] onboarding delivery count failed", {
      code: error.code,
    });
    return false;
  }

  return (count ?? 0) === 0;
}

function buildIdempotentDeliveryId({
  userId,
  anonymousId,
  deliveryDateKey,
}: {
  userId: string | null;
  anonymousId: string | null;
  deliveryDateKey: string;
}) {
  const recipientIdentity = userId ? `user:${userId}` : `anon:${anonymousId ?? ""}`;
  const digest = hashText(`${recipientIdentity}:${deliveryDateKey}`).toString(36);

  return `delivered-sleeping-${deliveryDateKey}-${digest}`;
}

async function readExistingDelivery({
  supabase,
  userId,
  anonymousId,
  localDeliveryId,
}: {
  supabase: SupabaseClient;
  userId: string | null;
  anonymousId: string | null;
  localDeliveryId: string;
}) {
  let query = supabase
    .from("cat_moment_deliveries")
    .select(
      "id, local_delivery_id, source_moment_id, source_photo_id, recipient_local_cat_id, photo_url, status, metadata, delivered_at",
    )
    .eq("local_delivery_id", localDeliveryId)
    .limit(1);

  query = userId
    ? query.eq("user_id", userId)
    : query.eq("anonymous_id", anonymousId ?? "").is("user_id", null);

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.warn("[sleeping-delivery/exchange] existing delivery lookup failed", {
      code: error.code,
    });
    return null;
  }

  return data as RemoteDeliveryRow | null;
}

async function readDeliveredSourceMomentIds({
  supabase,
  userId,
  anonymousId,
}: {
  supabase: SupabaseClient;
  userId: string | null;
  anonymousId: string | null;
}) {
  let query = supabase
    .from("cat_moment_deliveries")
    .select("source_moment_id")
    .not("source_moment_id", "is", null)
    .limit(1000);

  query = userId
    ? query.eq("user_id", userId)
    : query.is("user_id", null).eq("anonymous_id", anonymousId ?? "");

  const { data, error } = await query;

  if (error) {
    console.warn("[sleeping-delivery/exchange] delivered source lookup failed", {
      code: error.code,
    });
    return new Set<string>();
  }

  return new Set(
    (data ?? [])
      .map((row) =>
        typeof row.source_moment_id === "string" ? row.source_moment_id : null,
      )
      .filter((value): value is string => Boolean(value)),
  );
}

function toExchangePhotoFromDelivery(
  delivery: RemoteDeliveryRow,
  input: Required<ExchangeRequest>,
): ExchangePhoto {
  const metadata = delivery.metadata ?? {};
  const triggerLabel =
    typeof metadata.trigger_label === "string"
      ? metadata.trigger_label
      : input.triggerLabel;
  const theme = typeof metadata.theme === "string" ? metadata.theme : input.theme;
  const deliveredAt = Date.parse(delivery.delivered_at);

  return {
    id: delivery.local_delivery_id,
    sourcePhotoId: delivery.source_photo_id ?? delivery.source_moment_id ?? "",
    src: delivery.photo_url,
    title: "縺ｻ縺九・迪ｫ縺ｮ縺ｭ縺後♀",
    subtitle: "",
    triggerLabel,
    theme,
    deliveredAt: Number.isFinite(deliveredAt) ? deliveredAt : Date.now(),
  };
}

async function attachTransientDeliverySignedUrl(
  photo: ExchangePhoto,
  supabase: SupabaseClient,
) {
  const storagePath = getStoragePhotoPath(photo.src);

  if (!storagePath) {
    return photo;
  }

  const signedUrl = await createTransientDeliverySignedUrl(supabase, storagePath);

  if (!signedUrl) {
    return photo;
  }

  return {
    ...photo,
    thumbnailSrc: signedUrl,
    displaySrc: signedUrl,
    originalSrc: signedUrl,
  };
}

async function createTransientDeliverySignedUrl(
  supabase: SupabaseClient,
  storagePath: string,
) {
  const { data, error } = await supabase.storage
    .from(CAT_PHOTOS_BUCKET)
    .createSignedUrl(storagePath, TRANSIENT_DELIVERY_SIGNED_URL_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

function isUniqueDeliveryError(error: { code?: string; message?: string }) {
  return (
    error.code === "23505" ||
    /cat_moment_deliveries_(?:user|anonymous)_local_delivery_uidx/i.test(
      error.message ?? "",
    )
  );
}

async function deleteExistingMoment({
  supabase,
  userId,
  anonymousId,
  localMomentId,
}: {
  supabase: SupabaseClient;
  userId: string | null;
  anonymousId: string | null;
  localMomentId: string;
}) {
  let query = supabase.from("cat_moments").delete().eq("local_moment_id", localMomentId);

  if (userId) {
    query = query.eq("user_id", userId);
  } else {
    query = query.is("user_id", null).eq("anonymous_id", anonymousId);
  }

  await query;
}

async function readRemoteCandidateRows(
  supabase: SupabaseClient,
) {
  const { data } = await supabase
    .from("cat_moments")
    .select(
      "id, user_id, anonymous_id, local_moment_id, local_cat_id, owner_cat_id, photo_url, delivery_status, moderation_status, pool_date, delivery_count, metadata, created_at",
    )
    .eq("visibility", "shared")
    .eq("delivery_status", "available")
    .eq("moderation_status", "approved")
    .order("delivery_count", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(TIERED_CANDIDATE_LIMIT);

  return (data ?? []) as RemoteCatMomentRow[];
}

async function readFastStockCandidateRows(
  supabase: SupabaseClient,
) {
  const mode = readFastCandidateMode();

  if (mode !== "admin_storage") {
    return [];
  }

  const { data } = await supabase
    .from("cat_moments")
    .select(
      "id, user_id, anonymous_id, local_moment_id, local_cat_id, owner_cat_id, delivery_status, moderation_status, pool_date, delivery_count, metadata, created_at",
    )
    .eq("visibility", "shared")
    .eq("delivery_status", "available")
    .eq("moderation_status", "approved")
    .like("local_moment_id", "stock-sleeping-%")
    .order("created_at", { ascending: false })
    .limit(FAST_STORAGE_CANDIDATE_LIMIT);

  return (data ?? []) as FastStockCandidateRow[];
}

function readFastCandidateMode(): FastCandidateMode {
  const raw = process.env.SLEEPING_DELIVERY_FAST_CANDIDATES;

  if (raw === "admin_storage") {
    return "admin_storage";
  }

  return "tiered";
}

function isFastStockCandidateDeliverable(
  row: FastStockCandidateRow,
  {
    userId,
    anonymousId,
    recipientCatId,
    excludePhotoId,
    blockedPhotoIds,
    deliveredSourceMomentIds,
  }: {
    userId: string | null;
    anonymousId: string | null;
    recipientCatId: string | null;
    excludePhotoId: string;
    blockedPhotoIds: Set<string>;
    deliveredSourceMomentIds: Set<string>;
  },
) {
  if (userId && row.user_id === userId) {
    return false;
  }
  if (!userId && anonymousId && row.anonymous_id === anonymousId) {
    return false;
  }
  if (
    recipientCatId &&
    (row.local_cat_id === recipientCatId || row.owner_cat_id === recipientCatId)
  ) {
    return false;
  }
  if (row.id === excludePhotoId || row.local_moment_id === excludePhotoId) {
    return false;
  }
  if (
    deliveredSourceMomentIds.has(row.id) ||
    deliveredSourceMomentIds.has(row.local_moment_id)
  ) {
    return false;
  }

  return !blockedPhotoIds.has(row.id) && !blockedPhotoIds.has(row.local_moment_id);
}

function isRowDeliverable(
  row: RemoteCatMomentRow,
  {
    userId,
    anonymousId,
    recipientCatId,
    excludePhotoId,
    blockedPhotoIds,
    deliveredSourceMomentIds,
  }: {
    userId: string | null;
    anonymousId: string | null;
    recipientCatId: string | null;
    excludePhotoId: string;
    blockedPhotoIds: Set<string>;
    deliveredSourceMomentIds: Set<string>;
  },
) {
  if (isBlockedDeliveryPoolRow(row)) {
    return false;
  }
  if (row.moderation_status !== "approved") {
    return false;
  }
  if (!isUsablePhotoSrc(row.photo_url) || row.delivery_status !== "available") {
    return false;
  }
  if (userId && row.user_id === userId) {
    return false;
  }
  if (!userId && anonymousId && row.anonymous_id === anonymousId) {
    return false;
  }
  if (
    recipientCatId &&
    (row.local_cat_id === recipientCatId || row.owner_cat_id === recipientCatId)
  ) {
    return false;
  }
  if (row.id === excludePhotoId || row.local_moment_id === excludePhotoId) {
    return false;
  }
  if (
    deliveredSourceMomentIds.has(row.id) ||
    deliveredSourceMomentIds.has(row.local_moment_id)
  ) {
    return false;
  }

  return !blockedPhotoIds.has(row.id) && !blockedPhotoIds.has(row.local_moment_id);
}

async function resolvePhotoUrl(photoUrl: string, supabase: SupabaseClient) {
  const storagePath = getStoragePhotoPath(photoUrl);

  if (storagePath) {
    const { data, error } = await supabase.storage
      .from(CAT_PHOTOS_BUCKET)
      .createSignedUrl(storagePath, TRANSIENT_DELIVERY_SIGNED_URL_SECONDS);

    if (error || !data?.signedUrl) {
      return null;
    }

    return data.signedUrl;
  }

  return photoUrl;
}

async function prepareExchangeMomentPhotoUrl({
  supabase,
  userId,
  anonymousId,
  ownerCatId,
  localMomentId,
  src,
  canUseStorage,
}: {
  supabase: SupabaseClient;
  userId: string | null;
  anonymousId: string | null;
  ownerCatId: string;
  localMomentId: string;
  src: string;
  canUseStorage: boolean;
}) {
  if (!src.startsWith("data:image/") || !canUseStorage) {
    return src;
  }

  const ownerKey = userId ?? anonymousId ?? "anonymous";
  try {
    const storagePath = await uploadDataUrl(
      supabase,
      `${sanitizePathSegment(ownerKey)}/${sanitizePathSegment(ownerCatId)}/sleeping/${sanitizePathSegment(
        localMomentId,
      )}.${getDataUrlExtension(src)}`,
      src,
    );

    return toStoragePhotoUrl(storagePath);
  } catch {
    return src;
  }
}

async function prepareExchangeDeliveryPhotoSrc({
  supabase,
  row,
  resolvedSrc,
  canUseStorage,
}: {
  supabase: SupabaseClient;
  row: RemoteCatMomentRow;
  resolvedSrc: string;
  canUseStorage: boolean;
}) {
  if (getStoragePhotoPath(row.photo_url)) {
    return row.photo_url;
  }

  if (!row.photo_url.startsWith("data:image/") || !canUseStorage) {
    return resolvedSrc;
  }

  try {
    const storagePath = await uploadDataUrl(
      supabase,
      `delivery-cache/${sanitizePathSegment(row.local_moment_id)}.${getDataUrlExtension(
        row.photo_url,
      )}`,
      row.photo_url,
    );

    return toStoragePhotoUrl(storagePath);
  } catch {
    return resolvedSrc;
  }
}

async function incrementDeliveryCount({
  supabase,
  row,
}: {
  supabase: SupabaseClient;
  row: RemoteCatMomentRow;
}) {
  const nextDeliveryCount = Math.max(0, row.delivery_count ?? 0) + 1;
  const { error } = await supabase
    .from("cat_moments")
    .update({ delivery_count: nextDeliveryCount })
    .eq("id", row.id);

  if (error) {
    console.warn("[sleeping-delivery/exchange] delivery_count update failed", {
      code: error.code,
    });
  }
}

function sortTieredCandidates(
  rows: RemoteCatMomentRow[],
  input: Required<ExchangeRequest>,
) {
  return [...rows].sort((a, b) => {
    const tierDelta = getDeliveryTier(a, input) - getDeliveryTier(b, input);

    if (tierDelta !== 0) {
      return tierDelta;
    }

    const countDelta = (a.delivery_count ?? 0) - (b.delivery_count ?? 0);

    if (countDelta !== 0) {
      return countDelta;
    }

    return (
      hashText(`${input.seed}:${a.id}:${a.local_moment_id}`) -
      hashText(`${input.seed}:${b.id}:${b.local_moment_id}`)
    );
  });
}

function getDeliveryTier(
  row: RemoteCatMomentRow,
  input: Required<ExchangeRequest>,
): DeliveryTier {
  if (readPoolKind(row.metadata) === "admin_stock") {
    return 3;
  }

  return input.deliveryDateKey && row.pool_date === input.deliveryDateKey ? 1 : 2;
}

async function selectCandidate(
  rows: RemoteCatMomentRow[],
  input: Required<ExchangeRequest>,
  supabase: SupabaseClient,
) {
  if (rows.length === 0) {
    return null;
  }

  if (input.preferredSourcePhotoId) {
    const preferredRow = rows.find(
      (row) =>
        row.id === input.preferredSourcePhotoId ||
        row.local_moment_id === input.preferredSourcePhotoId,
    );

    const preferredCandidate = preferredRow
      ? await toResolvedCandidate(preferredRow, supabase, getDeliveryTier(preferredRow, input))
      : null;

    if (preferredCandidate) {
      return preferredCandidate;
    }
  }

  const startIndex =
    hashText(`${input.seed}:${input.triggerLabel}:${input.theme}`) %
    rows.length;

  for (let offset = 0; offset < rows.length; offset += 1) {
    const row = rows[(startIndex + offset) % rows.length];
    const candidate = await toResolvedCandidate(row, supabase, getDeliveryTier(row, input));

    if (candidate) {
      return candidate;
    }
  }

  return null;
}

async function selectFastStorageCandidate(
  rows: FastStockCandidateRow[],
  input: Required<ExchangeRequest>,
  supabase: SupabaseClient,
  deliverableContext: Parameters<typeof isRowDeliverable>[1],
) {
  if (rows.length === 0) {
    return null;
  }

  if (input.preferredSourcePhotoId) {
    const preferredRow = rows.find(
      (row) =>
        row.id === input.preferredSourcePhotoId ||
        row.local_moment_id === input.preferredSourcePhotoId,
    );
    const preferredCandidate = preferredRow
      ? await fetchFastStorageCandidate(preferredRow, supabase, deliverableContext)
      : null;

    if (preferredCandidate) {
      return preferredCandidate;
    }
  }

  const startIndex =
    hashText(`${input.seed}:${input.triggerLabel}:${input.theme}`) %
    rows.length;
  const probeCount = Math.min(rows.length, FAST_STORAGE_CANDIDATE_PROBE_LIMIT);

  for (let offset = 0; offset < probeCount; offset += 1) {
    const row = rows[(startIndex + offset) % rows.length];
    const candidate = await fetchFastStorageCandidate(
      row,
      supabase,
      deliverableContext,
    );

    if (candidate) {
      return candidate;
    }
  }

  return null;
}

async function fetchFastStorageCandidate(
  row: FastStockCandidateRow,
  supabase: SupabaseClient,
  deliverableContext: Parameters<typeof isRowDeliverable>[1],
) {
  const { data } = await supabase
    .from("cat_moments")
    .select(
      "id, user_id, anonymous_id, local_moment_id, local_cat_id, owner_cat_id, photo_url, delivery_status, moderation_status, pool_date, delivery_count, metadata, created_at",
    )
    .eq("id", row.id)
    .maybeSingle();
  const fullRow = data as RemoteCatMomentRow | null;

  if (
    !fullRow ||
    !getStoragePhotoPath(fullRow.photo_url) ||
    !isRowDeliverable(fullRow, deliverableContext)
  ) {
    return null;
  }

  return toResolvedCandidate(fullRow, supabase, 3);
}

async function toResolvedCandidate(
  row: RemoteCatMomentRow,
  supabase: SupabaseClient,
  tier: DeliveryTier,
): Promise<Candidate | null> {
  if (getStoragePhotoPath(row.photo_url)) {
    return {
      row,
      src: row.photo_url,
      tags: readTags(row.metadata),
      tier,
    };
  }

  const src = await resolvePhotoUrl(row.photo_url, supabase);

  if (!src || !isUsablePhotoSrc(src)) {
    return null;
  }

  return {
    row,
    src,
    tags: readTags(row.metadata),
    tier,
  };
}

function buildDiagnostics(
  rows: RemoteCatMomentRow[],
  blockedPhotoIds: Set<string>,
) {
  const availableRows = rows.filter((row) => row.delivery_status === "available");
  const usableAvailableRows = availableRows.filter((row) =>
    isUsablePhotoSrc(row.photo_url),
  );
  const approvedRows = rows.filter((row) => row.moderation_status === "approved");
  const pendingRows = rows.filter((row) => row.moderation_status === "pending");
  const rejectedRows = rows.filter((row) => row.moderation_status === "rejected");
  const tier1Rows = usableAvailableRows.filter(
    (row) => readPoolKind(row.metadata) !== "admin_stock" && row.pool_date,
  );
  const tier3Rows = usableAvailableRows.filter(
    (row) => readPoolKind(row.metadata) === "admin_stock",
  );

  return {
    source: "none" as const,
    availableCount: availableRows.length,
    candidateCount: usableAvailableRows.length,
    normalCandidateCount: usableAvailableRows.length,
    fallbackCandidateCount: 0,
    fallbackActive: false,
    excludedCount: 0,
    unusableCount: Math.max(0, availableRows.length - usableAvailableRows.length),
    blockedCount: availableRows.filter(
      (row) => blockedPhotoIds.has(row.id) || blockedPhotoIds.has(row.local_moment_id),
    ).length,
    adminStockCount: availableRows.filter(
      (row) => readPoolKind(row.metadata) === "admin_stock",
    ).length,
    userSharedCount: availableRows.filter(
      (row) => readPoolKind(row.metadata) === "user_shared",
    ).length,
    hiddenCount: rows.filter((row) => row.delivery_status === "hidden").length,
    reportedCount: rows.filter((row) => row.delivery_status === "reported").length,
    moderationPendingCount: pendingRows.length,
    moderationApprovedCount: approvedRows.length,
    moderationRejectedCount: rejectedRows.length,
    tier1CandidateCount: tier1Rows.length,
    tier2CandidateCount: Math.max(
      0,
      usableAvailableRows.length - tier1Rows.length - tier3Rows.length,
    ),
    tier3CandidateCount: tier3Rows.length,
    rlsReadable: true,
    checkedAt: new Date().toISOString(),
  };
}

function readTags(metadata: Record<string, unknown> | null) {
  const tags = ["sleeping", "ねてる"];
  const theme = metadata?.theme;
  const triggerLabel = metadata?.trigger_label;

  if (typeof theme === "string" && theme) {
    tags.push(theme);
  }
  if (typeof triggerLabel === "string" && triggerLabel) {
    tags.push(triggerLabel);
  }

  return [...new Set(tags)];
}

function readPoolKind(metadata: Record<string, unknown> | null) {
  const poolKind = metadata?.pool_kind;

  if (poolKind === "admin_stock" || poolKind === "user_shared") {
    return poolKind;
  }

  return "unknown";
}

function hashText(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function createExchangeTiming() {
  return {
    startedAt: Date.now(),
    marks: [] as { label: string; elapsedMs: number }[],
  };
}

function markExchangeTiming(
  timing: ReturnType<typeof createExchangeTiming>,
  label: string,
) {
  timing.marks.push({ label, elapsedMs: Date.now() - timing.startedAt });
}

function logExchangeTiming(
  timing: ReturnType<typeof createExchangeTiming>,
  details: Record<string, unknown>,
) {
  console.info("[sleeping-delivery/exchange] timing", {
    ...details,
    totalMs: Date.now() - timing.startedAt,
    marks: timing.marks,
  });
}

function toStringOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" && value ? value : fallback;
}

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

```



### Codex????

- route???????/??????/???????????????????????????????????????????

- delivery?????????signed URL???????route???????????????????????

## c. /api/photo-storage/signed-url route??

???????? `authorizeStoragePath` ??`POST` ???????????????????

### signed-url route full text

File: `src/app/api/photo-storage/signed-url/route.ts`

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import {
  CAT_PHOTOS_BUCKET,
  DISPLAY_SIGNED_URL_SECONDS,
  createSignedStorageUrl,
  getStoragePhotoPath,
} from "../../../../lib/photoStorage";
import {
  getStoragePhotoUrlVariants,
  hasDeliveredStoragePhoto,
  isAuthorizedStoragePhotoPath,
  isSafeStoragePath,
  normalizeAnonymousId,
} from "../../../../lib/photoStorageAuthorization";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { getSupabasePublicConfig } from "../../../../lib/supabase/config";

export const dynamic = "force-dynamic";

type SignedUrlRequest = {
  anonymousId?: unknown;
  src?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as SignedUrlRequest | null;
  const storagePath = getStoragePhotoPath(typeof body?.src === "string" ? body.src : "");

  if (!storagePath || !isSafeStoragePath(storagePath)) {
    return NextResponse.json({ signedUrl: null, error: "invalid_photo" }, { status: 400 });
  }

  const bearerToken = getBearerToken(request);
  const anonymousId = normalizeAnonymousId(body?.anonymousId);

  if (!bearerToken) {
    if (!anonymousId) {
      return NextResponse.json({ signedUrl: null, error: "auth_required" }, { status: 401 });
    }

    const signingSupabase = createSupabaseAdminClient();

    if (!signingSupabase) {
      return NextResponse.json({ signedUrl: null, error: "server_unavailable" }, { status: 503 });
    }

    const isDeliveredToAnonymousSession = await hasDeliveredStoragePhoto({
      supabase: signingSupabase,
      photoUrlVariants: getStoragePhotoUrlVariants(storagePath),
      userId: "",
      anonymousId,
    });

    if (!isDeliveredToAnonymousSession) {
      return NextResponse.json({ signedUrl: null, error: "forbidden_photo" }, { status: 403 });
    }

    return createStorageSignedUrlResponse(storagePath, signingSupabase);
  }

  const config = getSupabasePublicConfig();

  if (!config) {
    return NextResponse.json({ signedUrl: null, error: "server_unavailable" }, { status: 503 });
  }

  const authSupabase = createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { data, error } = await authSupabase.auth.getUser(bearerToken);
  const userId = data.user?.id ?? null;

  if (error || !userId) {
    return NextResponse.json({ signedUrl: null, error: "auth_required" }, { status: 401 });
  }

  const signingSupabase =
    createSupabaseAdminClient() ??
    createClient(config.url, config.anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          authorization: `Bearer ${bearerToken}`,
        },
      },
    });
  const isAuthorized = await isAuthorizedStoragePhotoPath({
    storagePath,
    userId,
    anonymousId,
    hasDeliveredPhoto: (photoUrlVariants, checkedUserId, anonymousId) =>
      hasDeliveredStoragePhoto({
        supabase: signingSupabase,
        photoUrlVariants,
        userId: checkedUserId,
        anonymousId,
      }),
  });

  if (!isAuthorized) {
    return NextResponse.json({ signedUrl: null, error: "forbidden_photo" }, { status: 403 });
  }

  return createStorageSignedUrlResponse(storagePath, signingSupabase);
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

async function createStorageSignedUrlResponse(
  storagePath: string,
  signingSupabase: SupabaseClient,
) {
  const signedUrl = await createSignedStorageUrl(signingSupabase, storagePath);

  if (!signedUrl) {
    return NextResponse.json({ signedUrl: null, error: "photo_unavailable" }, { status: 404 });
  }

  return NextResponse.json({
    bucket: CAT_PHOTOS_BUCKET,
    expiresIn: DISPLAY_SIGNED_URL_SECONDS,
    signedUrl,
  });
}

```



### ?????????

### authorizeStoragePath and call-site context

File: `src/app/api/photo-storage/signed-url/route.ts`

??????????????????

### Codex????

- `storagePath` ??????own/delivered/onboarding????????????????

- signed URL??????????????path???????????????????????

## d. admin guard: /admin/analytics ? moderation API ????????

### /api/admin/analytics route

File: `src/app/api/admin/analytics/route.ts`

```ts
import { NextResponse } from "next/server";

import { requireAdminAccess } from "../../../../lib/adminAccess";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

const CARD_EVENTS = [
  "app_opened",
  "onboarding_intro_view",
  "onboarding_photo_submitted",
  "cat_name_prompt_view",
  "cat_name_entered",
  "cat_name_skipped",
  "onboarding_delivery_opened",
  "onboarding_album_prompt_view",
  "album_prompt_view_with_name",
  "album_prompt_view_without_name",
  "onboarding_google_continue_click",
  "onboarding_skip_click",
  "album_created_with_name",
  "album_created_without_name",
  "home_photo_submitted",
  "delivery_opened",
  "delivery_reveal_started",
  "delivery_reveal_completed",
  "delivery_reveal_photo_loaded",
  "delivery_reveal_photo_error",
  "delivery_reveal_skipped",
  "collection_view",
  "cat_album_created",
] as const;

const FUNNEL_EVENTS = [
  "onboarding_intro_view",
  "onboarding_photo_submitted",
  "cat_name_prompt_view",
  "onboarding_delivery_opened",
  "onboarding_album_prompt_view",
  "onboarding_google_continue_click",
  "onboarding_completed",
] as const;

const SOURCE_EVENTS = [
  "onboarding_intro_view",
  "onboarding_photo_submitted",
  "cat_name_prompt_view",
  "cat_name_entered",
  "cat_name_skipped",
  "onboarding_delivery_opened",
  "onboarding_album_prompt_view",
  "album_prompt_view_with_name",
  "album_prompt_view_without_name",
  "onboarding_google_continue_click",
  "onboarding_skip_click",
] as const;

const APP_KPI_EVENTS = [
  "home_view",
  "home_photo_submitted",
  "delivery_opened",
  "delivery_reveal_started",
  "delivery_reveal_completed",
  "delivery_reveal_photo_loaded",
  "delivery_reveal_photo_error",
  "delivery_reveal_skipped",
  "collection_view",
  "collection_sent_tab_view",
  "collection_received_tab_view",
  "cat_album_created",
  "album_created_with_name",
  "album_created_without_name",
] as const;

type PeriodKey = "today" | "yesterday" | "7d" | "28d";

type AppEventRow = {
  event_name: string;
  source: string | null;
  anonymous_id: string | null;
  user_id: string | null;
  session_id: string | null;
  submission_id: string | null;
  route: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
};

export async function GET(request: Request) {
  const access = await requireAdminAccess(request);

  if (!access.allowed) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "admin_config_missing" },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const period = readPeriod(url.searchParams.get("period"));
  const range = buildPeriodRange(period);
  const { data, error } = await supabase
    .from("app_events")
    .select(
      "event_name, source, anonymous_id, user_id, session_id, submission_id, route, error_code, error_message, created_at",
    )
    .gte("created_at", range.from.toISOString())
    .lt("created_at", range.to.toISOString())
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    return NextResponse.json(
      { error: "analytics_query_failed" },
      { status: 500 },
    );
  }

  const events = ((data ?? []) as AppEventRow[]).filter((event) =>
    Boolean(event.event_name),
  );

  return NextResponse.json({
    period,
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    },
    cards: buildCards(events),
    funnel: buildEventCounts(events, FUNNEL_EVENTS),
    sourceBreakdown: buildSourceBreakdown(events),
    appKpis: buildEventCounts(events, APP_KPI_EVENTS),
    retention: buildRetention(events),
    recentErrors: events
      .filter((event) => event.event_name.endsWith("_error") || event.error_code)
      .slice(0, 30)
      .map(toSafeEvent),
    recentEvents: events.slice(0, 50).map(toSafeEvent),
  });
}

function buildCards(events: AppEventRow[]) {
  const counts = buildEventCountMap(events);
  const errorCount = events.filter(
    (event) => event.event_name.endsWith("_error") || event.error_code,
  ).length;

  return [
    ...CARD_EVENTS.map((eventName) => ({
      eventName,
      count: counts.get(eventName) ?? 0,
    })),
    { eventName: "error", count: errorCount },
  ];
}

function buildEventCounts(
  events: AppEventRow[],
  eventNames: readonly string[],
) {
  const counts = buildEventCountMap(events);

  return eventNames.map((eventName) => ({
    eventName,
    count: counts.get(eventName) ?? 0,
    users: countUniqueUsers(events.filter((event) => event.event_name === eventName)),
  }));
}

function buildSourceBreakdown(events: AppEventRow[]) {
  const sourceMap = new Map<string, Map<string, Set<string>>>();

  for (const event of events) {
    if (!SOURCE_EVENTS.includes(event.event_name as (typeof SOURCE_EVENTS)[number])) {
      continue;
    }

    const source = event.source ?? "unknown";
    const sourceEvents = sourceMap.get(source) ?? new Map<string, Set<string>>();
    const users = sourceEvents.get(event.event_name) ?? new Set<string>();
    const actorId = getActorId(event);

    if (actorId) {
      users.add(actorId);
    }

    sourceEvents.set(event.event_name, users);
    sourceMap.set(source, sourceEvents);
  }

  return [...sourceMap.entries()]
    .map(([source, sourceEvents]) => ({
      source,
      events: SOURCE_EVENTS.map((eventName) => ({
        eventName,
        users: sourceEvents.get(eventName)?.size ?? 0,
      })),
    }))
    .sort((a, b) => a.source.localeCompare(b.source));
}

function buildRetention(events: AppEventRow[]) {
  const activeUsers = new Set<string>();
  const submitCountByActor = new Map<string, number>();
  const submitDaysByActor = new Map<string, Set<string>>();

  for (const event of events) {
    const actorId = getActorId(event);

    if (!actorId) {
      continue;
    }

    activeUsers.add(actorId);

    if (!isPhotoSubmitEvent(event.event_name)) {
      continue;
    }

    submitCountByActor.set(actorId, (submitCountByActor.get(actorId) ?? 0) + 1);
    const day = toJstDateKey(new Date(event.created_at));
    const days = submitDaysByActor.get(actorId) ?? new Set<string>();
    days.add(day);
    submitDaysByActor.set(actorId, days);
  }

  let d1ReturnSubmitters = 0;
  for (const days of submitDaysByActor.values()) {
    const sortedDays = [...days].sort();
    if (
      sortedDays.some((day, index) =>
        index > 0 ? isNextJstDay(sortedDays[index - 1]!, day) : false,
      )
    ) {
      d1ReturnSubmitters += 1;
    }
  }

  return {
    uniqueActiveUsers: activeUsers.size,
    repeatSubmitters: [...submitCountByActor.values()].filter((count) => count >= 2)
      .length,
    d1ReturnSubmitters,
  };
}

function buildEventCountMap(events: AppEventRow[]) {
  const counts = new Map<string, number>();

  for (const event of events) {
    counts.set(event.event_name, (counts.get(event.event_name) ?? 0) + 1);
  }

  return counts;
}

function countUniqueUsers(events: AppEventRow[]) {
  return new Set(events.map(getActorId).filter(Boolean)).size;
}

function toSafeEvent(event: AppEventRow) {
  return {
    createdAt: event.created_at,
    eventName: event.event_name,
    source: event.source ?? "unknown",
    route: event.route,
    errorCode: event.error_code,
    errorMessage: event.error_message,
    anonymousId: shortenId(event.anonymous_id),
    userId: shortenId(event.user_id),
    submissionId: shortenId(event.submission_id),
  };
}

function readPeriod(value: string | null): PeriodKey {
  return value === "yesterday" || value === "7d" || value === "28d"
    ? value
    : "today";
}

function buildPeriodRange(period: PeriodKey) {
  const now = new Date();
  const todayStart = getJstDayStart(now);

  if (period === "yesterday") {
    const from = addDays(todayStart, -1);
    return { from, to: todayStart };
  }

  if (period === "7d") {
    return { from: addDays(todayStart, -6), to: now };
  }

  if (period === "28d") {
    return { from: addDays(todayStart, -27), to: now };
  }

  return { from: todayStart, to: now };
}

function getJstDayStart(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [year, month, day] = formatter.format(date).split("-").map(Number);

  return new Date(Date.UTC(year!, month! - 1, day!, -9, 0, 0, 0));
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function toJstDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isNextJstDay(previous: string, current: string) {
  const previousDate = new Date(`${previous}T00:00:00+09:00`);
  const currentDate = new Date(`${current}T00:00:00+09:00`);

  return currentDate.getTime() - previousDate.getTime() === 24 * 60 * 60 * 1000;
}

function isPhotoSubmitEvent(eventName: string) {
  return (
    eventName === "onboarding_photo_submitted" ||
    eventName === "home_photo_submitted" ||
    eventName === "photo_submitted"
  );
}

function getActorId(event: AppEventRow) {
  return event.user_id ? `user:${event.user_id}` : event.anonymous_id;
}

function shortenId(value: string | null) {
  if (!value) {
    return null;
  }

  return value.length <= 10 ? value : `${value.slice(0, 6)}...${value.slice(-4)}`;
}

```



### /api/moderation/queue route

File: `src/app/api/moderation/queue/route.ts`

```ts
import { NextResponse } from "next/server";

import { getAdminCapabilitiesForRequest } from "../../../../lib/adminAccess";
import {
  CAT_PHOTOS_BUCKET,
  getStoragePhotoPath,
} from "../../../../lib/photoStorage";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

type PendingMomentRow = {
  id: string;
  local_moment_id: string;
  local_cat_id: string;
  owner_cat_id: string;
  photo_url: string;
  moderation_status: string;
  delivery_status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export async function GET(request: Request) {
  const capabilities = await getAdminCapabilitiesForRequest(request);

  if (!capabilities.isAdmin) {
    return NextResponse.json({ moments: [] }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ moments: [] }, { status: 503 });
  }

  const { data, error, count } = await supabase
    .from("cat_moments")
    .select(
      "id, local_moment_id, local_cat_id, owner_cat_id, photo_url, moderation_status, delivery_status, metadata, created_at",
      { count: "exact" },
    )
    .eq("moderation_status", "pending")
    .eq("visibility", "shared")
    .eq("delivery_status", "available")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ moments: [], pendingCount: 0 }, { status: 200 });
  }

  const moments = await Promise.all(
    ((data ?? []) as PendingMomentRow[]).map(async (row) => ({
      id: row.id,
      localMomentId: row.local_moment_id,
      localCatId: row.local_cat_id,
      ownerCatId: row.owner_cat_id,
      photoSrc: await resolveModerationPhotoSrc(row.photo_url),
      moderationStatus: row.moderation_status,
      deliveryStatus: row.delivery_status,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
    })),
  );

  return NextResponse.json({ moments, pendingCount: count ?? moments.length });
}

async function resolveModerationPhotoSrc(photoUrl: string) {
  const storagePath = getStoragePhotoPath(photoUrl);

  if (!storagePath) {
    return photoUrl.startsWith("data:image/") ? photoUrl : null;
  }

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(CAT_PHOTOS_BUCKET)
    .createSignedUrl(storagePath, 60 * 10);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

```



### /api/moderation/decide route

File: `src/app/api/moderation/decide/route.ts`

```ts
import { NextResponse } from "next/server";

import {
  getAdminCapabilitiesForRequest,
  getAuthenticatedUserForRequest,
} from "../../../../lib/adminAccess";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

type DecideRequest = {
  momentId?: string;
  decision?: string;
};

const DECISIONS = new Set(["approved", "rejected"]);

export async function POST(request: Request) {
  const capabilities = await getAdminCapabilitiesForRequest(request);

  if (!capabilities.isAdmin) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as DecideRequest | null;
  const momentId = sanitizeId(body?.momentId);
  const decision = DECISIONS.has(body?.decision ?? "") ? body!.decision! : null;

  if (!momentId || !decision) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const user = await getAuthenticatedUserForRequest(request);
  const moderatedBy = user?.email ?? user?.id ?? "admin";
  const patch =
    decision === "approved"
      ? {
          moderation_status: "approved",
          moderated_at: new Date().toISOString(),
          moderated_by: moderatedBy,
        }
      : {
          moderation_status: "rejected",
          delivery_status: "hidden",
          moderated_at: new Date().toISOString(),
          moderated_by: moderatedBy,
        };

  const { error } = await supabase.from("cat_moments").update(patch).eq("id", momentId);

  if (error) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}

function sanitizeId(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed || trimmed.length > 160 || /[\r\n]/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

```



### Codex????

- admin???DB query????????service role????????????????

- `ADMIN_EMAILS` ????????env??/????/???????????

## e. accountSync ????????

??: local/remote??????collection? `__cat_gallery` ????restore/push?????????????????? `accountSync.ts` ??????

### accountSync full text

File: `src/lib/accountSync.ts`

```ts
import { STORAGE_KEYS, getRecordLogKey } from "./storage";
import {
  readCatGalleryPhotos,
  restoreSyncedCatGalleryPhotos,
  type CatGalleryPhoto,
} from "./cats/catGalleryPhotos";
import { createBrowserSupabaseClient } from "./supabase/browser";
import {
  dispatchBoxPhotoStorageEvent,
  readAllOwnSleepingPhotos,
  readKeptExchangePhotos,
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

export async function clearAccountCatAvatar(localCatId: string) {
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
    .update({ avatar_storage_path: null })
    .eq("owner_user_id", data.user.id)
    .eq("local_cat_id", localCatId);

  if (error) {
    throw new Error(`Cat avatar clear failed: ${error.message}`);
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
  const ownSleepingPhotos = readAllOwnSleepingPhotos();
  const keptExchangePhotos = readKeptExchangePhotos();
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
  } else if (profile.avatarDataUrl) {
    const storagePath = getStoragePhotoPath(profile.avatarDataUrl);
    if (storagePath) {
      photoUpdates.avatar_storage_path = storagePath;
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
      avatarDataUrl: cat.avatar_storage_path
        ? toStoragePhotoUrl(cat.avatar_storage_path)
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
      const existingProfile = profiles[existingIndex];

      profiles[existingIndex] = {
        ...existingProfile,
        ...restoredProfile,
        avatarDataUrl:
          restoredProfile.avatarDataUrl ?? existingProfile.avatarDataUrl,
        homePhotoDataUrl:
          restoredProfile.homePhotoDataUrl ?? existingProfile.homePhotoDataUrl,
        homePhotoPosition:
          restoredProfile.homePhotoPosition ?? existingProfile.homePhotoPosition,
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

```



### Codex????

- `collection_photos` ???slot? `__cat_gallery` ??????query?????????????

- remote????local???????????????????remote/local??????????

- account reconnect??local-first/remote-first????????????????????????????????????

## f. catGalleryPhotos ??????????

87067a7???????? `restoreCatGalleryPhotosFromAccount` ????? `/cats` ???????????????????

### HomeInput Google sync / catGallery restore context

File: `src/components/home/HomeInput.tsx` lines 1-792

```tsx
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode, TouchEvent } from "react";
import {
  getAccountSyncOverview,
  restoreCatGalleryPhotosFromAccount,
  syncLocalDataWithAccount,
} from "../../lib/accountSync";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import {
  CAT_GALLERY_PHOTO_LIMIT,
  readCatGalleryPhotos,
  saveCatGalleryPhoto,
} from "../../lib/cats/catGalleryPhotos";
import { writeAuthDebugEvent } from "../../lib/authDebug";
import {
  storeAccountPhotoDataUrl,
} from "../../lib/photoStorageClient";
import {
  getCollectionSlotPhotoSlug,
  getDailyCollectionTarget,
  isReservedCollectionSlotSlug,
  readStoredCollectionPhotos,
} from "../../lib/collection/dailyTarget";
import {
  COLLECTION_GROUPS,
  type CollectionSlot,
} from "../../lib/collection/poses";
import {
  buildMikkeWindowResult,
  getCurrentMikkeWindow,
  getMikkeWindowOption,
  getMikkeWindowOptions,
  MIKKE_WINDOW_QUESTIONS,
  readStoredMikkeWindowAnswer,
  saveStoredMikkeWindowAnswer,
  type MikkeWindowCategory,
  type MikkeWindow,
  type MikkeWindowCount,
  type MikkeWindowOption,
  type MikkeWindowResult,
  type StoredMikkeWindowAnswer,
} from "../../lib/home/mikkeWindows";
import {
  fetchMikkeWindowCounts,
  submitMikkeWindowAnswer,
} from "../../lib/home/mikkeWindowResults";
import {
  saveRemoteDeliveryStockPhoto,
} from "../../lib/home/deliveryCandidates";
import {
  buildEveningHomeState,
  getJstDateKey,
  isTodaySleepingCounterVisible,
  markEveningDeliveryKept,
  readEveningDeliveryStore,
  recordEveningDeliveryTarget,
  setEveningDeliveredPhoto,
  shouldShowGuidanceCopy,
  updateEveningDeliveredPhotoDataUrl,
  type EveningHomeState,
} from "../../lib/home/eveningDelivery";
import {
  ensureOmoideMemoryArrival,
  markOmoideMemoryDismissed,
  markOmoideMemoryOpened,
  readLatestArrivedOmoideMemory,
} from "../../lib/home/omoideDelivery";
import { useEveningDelivery } from "../../lib/home/useEveningDelivery";
import {
  BOX_PHOTO_STORAGE_EVENT,
  dismissExchangePhoto,
  keepExchangePhoto,
  readAllOwnSleepingPhotos,
  readKeptExchangePhotoCount,
  readOwnSleepingPhotos,
  readOwnSleepingPhotoCount,
  reportExchangePhoto,
  saveOwnSleepingPhoto,
  updateKeptExchangePhotoDataUrl,
  writeOwnSleepingPhotosWithFallback,
  type ExchangePhoto,
  type ExchangePhotoReportReason,
  type OwnSleepingPhoto,
} from "../../lib/home/sleepingPhotos";
import { backupOwnSleepingPhotoMoment } from "../../lib/home/sleepingPhotoBackup";
import {
  STORAGE_KEYS,
  getDiscoveryLogKey,
  getLockDataKey,
  getRecordLogKey,
} from "../../lib/storage";
import type { RecentEvent } from "../../lib/supabase/queries";
import { createBrowserSupabaseClient } from "../../lib/supabase/browser";
import { BottomNavigation } from "../navigation/BottomNavigation";
import { HomeDeskModel } from "./HomeDeskModel";
import {
  getActiveCatProfile,
  getCatName,
  readActiveCatId,
  readCatProfiles,
  saveActiveCatId,
  saveCatProfiles,
} from "./homeInputHelpers";
import type { CatProfile } from "./homeInputHelpers";
import { AppBottomSheet, AppSheet } from "../ui/AppBottomSheet";
import {
  AppIcon,
  type AppIconName,
} from "../ui/AppIcons";
import { AppButton } from "../ui/AppButton";
import { AppCard } from "../ui/AppCard";
import { StoredPhotoImage } from "../ui/StoredPhotoImage";

type HomeInputProps = {
  recentEvents: RecentEvent[];
  initialNow: number;
};

type LockData = {
  yousuLockedUntil?: number;
  mugiLockedUntil?: number;
  sleepingCounterLockedUntil?: number;
  mikkeCategoryLockedUntil?: Partial<Record<MikkeWindowCategory, number>>;
};

type LockType = "yousu" | "mugi";

const MIKKE_CATEGORIES: MikkeWindowCategory[] = ["place", "pose", "sign"];
const MIKKE_LOCK_MS = 60 * 60 * 1000;
const PRESENCE_SESSION_STORAGE_KEY = "neteruneko_presence_count";

const PHOTO_SAVE_FAILURE_MESSAGE =
  "写真を保存できませんでした。少し時間をおいて、もう一度試してください";
const PHOTO_INPUT_FAILURE_MESSAGE =
  "写真を読み込めませんでした。JPEGやPNGの写真で、もう一度試してください";

const MAX_UPLOAD_SOURCE_FILE_BYTES = 20 * 1024 * 1024;
const SUPPORTED_SOURCE_IMAGE_MIME_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type RecordLogItem = {
  id: string;
  type: "yousu" | "mugi" | "reaction";
  value: string;
  timestamp: number;
  metadata?: {
    mikkeWindowId?: string;
    mikkeQuestionId?: string;
    mikkeCategory?: string;
    mikkeAnswerId?: string;
    homeCounterId?: string;
  };
};

type HomeBoardAction =
  | "open_mikke"
  | "open_photo"
  | "open_collection_photo"
  | "open_discovery"
  | "open_recent_change"
  | "go_torisetu"
  | "go_collection"
  | "add_sleeping";

type HomeBoardItem = {
  id: string;
  kind: "mission" | "notice" | "insight" | "tip" | "collection" | "account";
  priority: number;
  title: string;
  body: string;
  icon: "paw" | "sleep" | "hand" | "heart" | "bell" | "camera" | "book";
  actionLabel: string;
  actionType: HomeBoardAction;
  isUnread?: boolean;
  isDisabled?: boolean;
  surfaceText?: string;
  cooldownProgress?: number;
};

type HomeBoardCompletion = {
  itemId: string;
  title: string;
  surfaceText: string;
};

type HomeBoardTransitionSource = {
  itemId: string;
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  title: string;
  surfaceText: string;
  icon: HomeBoardItem["icon"];
};

type HomeBoardActionHandler = (
  actionType: HomeBoardAction,
  source?: HomeBoardTransitionSource,
) => void;

type PersonalityInsight = {
  title: string;
  body: string;
  surfaceText: string;
  sheetBody: string;
};

const YOUSU_OPTIONS = [
  "ねてる",
  "毛づくろい",
  "遊んでる",
  "ごはん",
  "トイレ",
  "ゴロゴロ",
  "ついてくる",
  "鳴いてる",
  "落ち着かない",
  "窓の外",
  "ふみふみ",
  "その他",
];

const HOME_NAV_FRAME_WIDTH = "min(calc(100% - 28px), 410px)";
const HOME_NAV_EDGE_INSET = "max(14px, calc((100vw - 410px) / 2))";

type BoardShelfStat = {
  icon: AppIconName;
  label: string;
  value: string;
  unit: string;
  detail: string;
};

type HomeCatCounter = {
  id: "sleeping" | "window" | "loaf";
  label: string;
  count: number;
};

type PendingExchangeSharePhoto = {
  src: string;
  exchangeSrc: string;
  thumbnailSrc?: string;
  displaySrc?: string;
  originalSrc?: string;
  triggerLabel: string;
  theme: string;
  fileSizeBucket: string;
};

type SleepingPhotoSource = "camera";

const SLEEPING_SAFETY_ACCEPTED_STORAGE_KEY =
  "nyaruhodo_sleeping_safety_accepted";
const HOME_INSTALL_HINT_DISMISSED_STORAGE_KEY =
  "neteruneko_home_install_hint_dismissed";
const HOME_TODAY_CAT_SELECTION_STORAGE_KEY =
  "neteruneko_home_today_cat_selection";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type HomeInstallPlatform = "ios" | "android";

export function HomeInput({
  recentEvents: _recentEvents,
  initialNow,
}: HomeInputProps) {
  const [catProfiles, setCatProfiles] = useState<CatProfile[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<CatProfile | null>(null);
  const [hasHydratedHomeState, setHasHydratedHomeState] = useState(false);
  const [lockData, setLockData] = useState<LockData>({});
  const [tick, setTick] = useState(initialNow);
  const isHomeClockReady = tick > 0;
  const homeNow = isHomeClockReady ? tick : 0;
  const [isYousuOpen, setIsYousuOpen] = useState(false);
  const [isCollectionPhotoSheetOpen, setIsCollectionPhotoSheetOpen] =
    useState(false);
  const [isCollectionPhotoAdding, setIsCollectionPhotoAdding] = useState(false);
  const [isAccountRestoreSheetOpen, setIsAccountRestoreSheetOpen] =
    useState(false);
  const [isAccountRestoring, setIsAccountRestoring] = useState(false);
  const [accountRestoreSummary, setAccountRestoreSummary] = useState<{
    remoteCats: number;
    remoteRecords: number;
    remoteCatGalleryPhotos: number;
    remoteCollectionPhotos: number;
    remoteOwnSleepingPhotos: number;
    remoteKeptExchangePhotos: number;
  } | null>(null);
  const [isDiscoverySheetOpen, setIsDiscoverySheetOpen] = useState(false);
  const [isRecentChangeSheetOpen, setIsRecentChangeSheetOpen] = useState(false);
  const [selectedYousu, setSelectedYousu] = useState<string | null>(null);
  const [recordLog, setRecordLog] = useState<RecordLogItem[]>([]);
  const [mikkeRefreshTick, setMikkeRefreshTick] = useState(0);
  const [mikkeResult, setMikkeResult] = useState<MikkeWindowResult | null>(null);
  const [isMikkeResultLoading, setIsMikkeResultLoading] = useState(false);
  const [toastText, setToastText] = useState("");
  const [boardCompletion, setBoardCompletion] =
    useState<HomeBoardCompletion | null>(null);
  const [boardSheetSource, setBoardSheetSource] =
    useState<HomeBoardTransitionSource | null>(null);
  const [boardSheetReturn, setBoardSheetReturn] =
    useState<HomeBoardCompletion | null>(null);
  const [isBoardSheetReturning, setIsBoardSheetReturning] = useState(false);
  const [deliveredExchangePhoto, setDeliveredExchangePhoto] =
    useState<ExchangePhoto | null>(null);
  const [openingEveningDelivery, setOpeningEveningDelivery] =
    useState<Extract<EveningHomeState, { kind: "delivered" }> | null>(null);
  const [pendingExchangeSharePhoto, setPendingExchangeSharePhoto] =
    useState<PendingExchangeSharePhoto | null>(null);
  const [pendingExchangeCatId, setPendingExchangeCatId] = useState<string | null>(
    null,
  );
  const [isExchangePhotoAdding, setIsExchangePhotoAdding] = useState(false);
  const [hasAcceptedSleepingSafety, setHasAcceptedSleepingSafety] =
    useState(false);
  const [isSleepingSafetySheetOpen, setIsSleepingSafetySheetOpen] =
    useState(false);
  const [isSleepingSafetyChecked, setIsSleepingSafetyChecked] = useState(false);
  const [pendingSleepingPhotoSource, setPendingSleepingPhotoSource] =
    useState<SleepingPhotoSource>("camera");
  const [homeInstallPlatform, setHomeInstallPlatform] =
    useState<HomeInstallPlatform | null>(null);
  const [homeInstallPrompt, setHomeInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isHomeInstallHintVisible, setIsHomeInstallHintVisible] = useState(false);
  const [isHomeInstallGuideOpen, setIsHomeInstallGuideOpen] = useState(false);
  const [collectionRefreshTick, setCollectionRefreshTick] = useState(0);
  const [eveningRefreshTick, setEveningRefreshTick] = useState(0);
  const [omoideRefreshTick, setOmoideRefreshTick] = useState(0);
  const [discoveryDismissedToday, setDiscoveryDismissedToday] = useState(false);
  const hasTrackedHomeView = useRef(false);
  const hasTrackedGoogleAuthSuccess = useRef(false);
  const toastTimerRef = useRef<number | null>(null);
  const completedBoardTimerRef = useRef<number | null>(null);
  const boardSheetReturnTimerRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const profiles = readCatProfiles();
    const activeId = readActiveCatId();
    const active = getActiveCatProfile(profiles, activeId);

    setCatProfiles(profiles);
    setActiveCatId(active.id);
    setActiveCat(active);
    saveActiveCatId(active.id);
    hydrateCatState(active.id);
    setHasAcceptedSleepingSafety(hasAcceptedSleepingSafetyNotice());
    setHasHydratedHomeState(true);
  }, []);

  useEffect(() => {
    function refreshTick() {
      setTick(Date.now());
    }

    refreshTick();

    const intervalId = window.setInterval(refreshTick, 1000);
    window.addEventListener("focus", refreshTick);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshTick();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshTick);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    function refreshEveningDeliveryState() {
      setEveningRefreshTick((value) => value + 1);
    }

    window.addEventListener("neteruneko_evening_delivery_updated", refreshEveningDeliveryState);
    window.addEventListener("storage", refreshEveningDeliveryState);

    return () => {
      window.removeEventListener(
        "neteruneko_evening_delivery_updated",
        refreshEveningDeliveryState,
      );
      window.removeEventListener("storage", refreshEveningDeliveryState);
    };
  }, []);

  useEffect(() => {
    function refreshOmoideState() {
      setOmoideRefreshTick((value) => value + 1);
    }

    window.addEventListener("neteruneko_omoide_memories_updated", refreshOmoideState);
    window.addEventListener("storage", refreshOmoideState);

    return () => {
      window.removeEventListener(
        "neteruneko_omoide_memories_updated",
        refreshOmoideState,
      );
      window.removeEventListener("storage", refreshOmoideState);
    };
  }, []);

  useEffect(() => {
    if (isStandaloneDisplay()) {
      void requestDeliveryNotificationPermission();
      dismissHomeInstallHint();
      return;
    }

    if (isInAppBrowser()) {
      dismissHomeInstallHint();
      return;
    }

    if (
      window.localStorage.getItem(HOME_INSTALL_HINT_DISMISSED_STORAGE_KEY) ===
        "true" ||
      window.localStorage.getItem(STORAGE_KEYS.onboardingCompleted) !== "true"
    ) {
      return;
    }

    const platform = getHomeInstallPlatform();
    if (!platform) {
      return;
    }

    setHomeInstallPlatform(platform);
    setIsHomeInstallHintVisible(true);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setHomeInstallPrompt(event as BeforeInstallPromptEvent);
      if (getHomeInstallPlatform() === "android" && !isStandaloneDisplay()) {
        setHomeInstallPlatform("android");
        setIsHomeInstallHintVisible(
          window.localStorage.getItem(HOME_INSTALL_HINT_DISMISSED_STORAGE_KEY) !==
            "true",
        );
      }
    };
    const handleAppInstalled = () => {
      void requestDeliveryNotificationPermission();
      dismissHomeInstallHint();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.style.setProperty("--home-bg-image", "none");
    body.style.setProperty("--home-bg-image", "none");
    body.style.removeProperty("background-image");
    body.style.removeProperty("background-position");
    body.style.removeProperty("background-size");
    body.style.removeProperty("background-repeat");

    return () => {
      root.style.removeProperty("--home-bg-image");
      body.style.removeProperty("--home-bg-image");
    };
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (completedBoardTimerRef.current) {
        window.clearTimeout(completedBoardTimerRef.current);
      }
      if (boardSheetReturnTimerRef.current) {
        window.clearTimeout(boardSheetReturnTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shouldOpenMikke = params.get("mikke") === "1";
    const authStatus = params.get("auth");
    const authCode = params.get("code");
    const hasPendingGoogleAuth = Boolean(
      window.localStorage.getItem(STORAGE_KEYS.authGooglePending),
    );

    async function handleUrlState() {
      let shouldTrackGoogleAuth =
        authStatus === "google_success" || hasPendingGoogleAuth;

      if (authCode) {
        const supabase = createBrowserSupabaseClient();

        if (!supabase) {
          writeAuthDebugEvent("home_auth_missing_supabase_client", {
            hasCode: true,
            hasPendingGoogleAuth,
          });
          trackProductEvent("auth_google_failed", {
            error_type: "missing_supabase_client",
          });
          window.location.replace("/account/create?error=auth");
          return;
        }

        writeAuthDebugEvent("home_auth_code_exchange_started", {
          hasPendingGoogleAuth,
          origin: window.location.origin,
          path: window.location.pathname,
        });
        const { error } = await supabase.auth.exchangeCodeForSession(authCode);

        params.delete("code");
        params.delete("error");
        params.delete("error_code");
        params.delete("error_description");

        if (error) {
          window.localStorage.removeItem(STORAGE_KEYS.authGooglePending);
          writeAuthDebugEvent("home_auth_code_exchange_failed", {
            message: error.message,
          });
          trackProductEvent("auth_google_failed", {
            error_type: "code_exchange_failed",
            error_message: error.message,
          });
          window.location.replace("/account/create?error=auth");
          return;
        }

        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();
        writeAuthDebugEvent("home_auth_code_exchange_succeeded", {
          hasSession: Boolean(sessionData.session),
          hasSessionUser: Boolean(sessionData.session?.user),
          sessionError: sessionError?.message ?? null,
        });
        shouldTrackGoogleAuth = true;
      }

      if (shouldTrackGoogleAuth) {
        await trackGoogleAuthSuccess(
          authStatus === "google_success" || authCode
            ? "callback_marker"
            : "pending_marker",
        );
        params.delete("auth");
      }

      if (shouldOpenMikke) {
        setIsYousuOpen(true);
        params.delete("mikke");
      }

      if (
        !shouldOpenMikke &&
        authStatus !== "google_success" &&
        !authCode &&
        !hasPendingGoogleAuth
      ) {
        return;
      }

      const nextSearch = params.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
      window.history.replaceState(null, "", nextUrl);
    }

    void handleUrlState();
  }, []);

  async function trackGoogleAuthSuccess(trigger: "callback_marker" | "pending_marker") {
    if (hasTrackedGoogleAuthSuccess.current) {
      return;
    }

    const supabase = createBrowserSupabaseClient();
    const localCatId = readActiveCatId();

    if (!supabase) {
      return;
    }

    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id ?? null;

    if (!userId) {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      writeAuthDebugEvent("home_auth_success_without_user", {
        trigger,
        hasSession: Boolean(sessionData.session),
        hasSessionUser: Boolean(sessionData.session?.user),
        sessionError: sessionError?.message ?? null,
      });
      return;
    }

    hasTrackedGoogleAuthSuccess.current = true;
    window.localStorage.removeItem(STORAGE_KEYS.authGooglePending);
    writeAuthDebugEvent("home_auth_user_confirmed", {
      trigger,
      userId,
      email: data.user?.email ?? null,
    });
    trackProductEvent(
      "auth_google_succeeded",
      {
        route_after: "/home",
        trigger,
      },
      {
        localCatId,
        userId,
      },
    );

    const syncResult = await syncLocalDataWithAccount({
      restoreIfLocalEmpty: false,
    });
    const catGalleryLocalBefore = readCatGalleryPhotos(null).length;

    trackProductEvent(
      "cat_gallery_restore_started",
      {
        route: "/home",
        local_count: catGalleryLocalBefore,
        has_session: true,
      },
      {
        localCatId,
        userId,
      },
    );

    const catGalleryRestoreResult = await restoreCatGalleryPhotosFromAccount();
    const catGalleryRestoreEvent =
      catGalleryRestoreResult.status === "restored"
        ? "cat_gallery_restore_completed"
        : catGalleryRestoreResult.status === "empty"
          ? "cat_gallery_remote_empty"
          : catGalleryRestoreResult.status === "error"
            ? "cat_gallery_restore_failed"
            : "cat_gallery_local_merged";

    trackProductEvent(
      catGalleryRestoreEvent,
      {
        route: "/home",
        local_count: catGalleryRestoreResult.localBefore,
        remote_count: catGalleryRestoreResult.remoteCount,
        restored_count: catGalleryRestoreResult.restoredCount,
        merged_count: Math.max(
          0,
          catGalleryRestoreResult.localAfter - catGalleryRestoreResult.localBefore,
        ),
        has_session: catGalleryRestoreResult.hasSession,
        error_count: catGalleryRestoreResult.errors.length,
      },
      {
        localCatId,
        userId,
      },
    );

    trackProductEvent(
      "account_data_sync_completed",
      {
        status: syncResult.status,
        pushed_cats: syncResult.pushedCats,
        pushed_records: syncResult.pushedRecords,
        pushed_cat_gallery_photos: syncResult.pushedCatGalleryPhotos,
        pushed_collection_photos: syncResult.pushedCollectionPhotos,
        pushed_own_sleeping_photos: syncResult.pushedOwnSleepingPhotos,
        pushed_kept_exchange_photos: syncResult.pushedKeptExchangePhotos,
        restored_cats: syncResult.restoredCats,
        restored_records: syncResult.restoredRecords,
        restored_cat_gallery_photos:
          syncResult.restoredCatGalleryPhotos +
          catGalleryRestoreResult.restoredCount,
        restored_collection_photos: syncResult.restoredCollectionPhotos,
        restored_own_sleeping_photos: syncResult.restoredOwnSleepingPhotos,
        restored_kept_exchange_photos: syncResult.restoredKeptExchangePhotos,
        error_count:
          syncResult.errors.length + catGalleryRestoreResult.errors.length,
      },
      {
        localCatId,
        userId,
      },
    );

    if (
      syncResult.status === "synced" ||
      (syncResult.status === "restored" &&
        (syncResult.restoredCats > 0 ||
          syncResult.restoredCatGalleryPhotos > 0 ||
          syncResult.restoredCollectionPhotos > 0 ||
          syncResult.restoredOwnSleepingPhotos > 0 ||
          syncResult.restoredKeptExchangePhotos > 0)) ||
      catGalleryRestoreResult.restoredCount > 0
    ) {
      refreshHomeFromLocalStorage();
    }
  }

  const activeCatName = activeCat ? getCatName(activeCat) : "ねこ";
  const homeDateKey = isHomeClockReady ? getJstDateKey(homeNow) : "";
  const allOwnSleepingPhotos = useMemo(
    () => readAllOwnSleepingPhotos(),
    [collectionRefreshTick, eveningRefreshTick],
  );
  const homeDisplayCat = useMemo(
    () =>
      selectTodayHomeCat({
        profiles: catProfiles,
        activeCatId,
        photos: allOwnSleepingPhotos,
        dateKey: homeDateKey,
      }),
    [activeCatId, allOwnSleepingPhotos, catProfiles, homeDateKey],
  );
  const homeDisplayCatId = homeDisplayCat?.id ?? activeCatId;
  const homeCatName = homeDisplayCat ? getCatName(homeDisplayCat) : activeCatName;
  const catName = activeCatName;
  const mikkeCategoryRemaining = getMikkeCategoryRemainingMap(lockData, tick);
  const mikkeAllRemaining = getAllMikkeCategoriesLockedRemaining(lockData, tick);
  const mikkeWindowKey = Math.floor(tick / (60 * 60 * 1000));
  const mikkeWindow = useMemo(
    () => getCurrentMikkeWindow(tick),
    [mikkeWindowKey],
  );
  const mikkeAnswer = useMemo(
    () =>
      activeCatId
        ? readStoredMikkeWindowAnswer(activeCatId, mikkeWindow.id)
        : null,
    [activeCatId, mikkeRefreshTick, mikkeWindow.id],
  );
  const mikkeSelectedOption = mikkeAnswer
    ? getMikkeWindowOption(mikkeWindow.question, mikkeAnswer.answerId)
    : null;
  const mikkeWindowRemaining = mikkeAnswer
    ? formatRemainingMs(mikkeWindow.endsAt - tick)
    : null;
  const sleepingCounterRemaining = null;
  const sleepingCounterCooldownProgress = null;
  const ownSleepingPhotosForHome = useMemo(
    () =>
      homeDisplayCatId
        ? allOwnSleepingPhotos
            .filter((photo) => (photo.ownerCatId ?? photo.catId) === homeDisplayCatId)
            .slice(0, 24)
        : readOwnSleepingPhotos(null),
    [allOwnSleepingPhotos, homeDisplayCatId],
  );
  const ownSleepingPhotosForDelivery = useMemo(
    () => readOwnSleepingPhotos(activeCatId),
    [activeCatId, collectionRefreshTick, eveningRefreshTick],
  );
  const eveningDelivery = useEveningDelivery({
```



### CatsPage session restore guard and restore call

File: `src/components/cats/CatsPage.tsx` lines 1-280

```tsx
"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import {
  clearAccountCatAvatar,
  deleteAccountCatGalleryPhoto,
  restoreCatGalleryPhotosFromAccount,
} from "../../lib/accountSync";
import { storeAccountPhotoDataUrl } from "../../lib/photoStorageClient";
import { STORAGE_KEYS } from "../../lib/storage";
import {
  markCatPickupSeen,
  readCatPickupHistory,
  selectCatPickup,
  type CatPickup,
} from "../../lib/cats/pickup";
import { createCatFootprintEntries } from "../../lib/cats/footprints";
import { createCatCelebrationItems } from "../../lib/cats/celebrations";
import type { CatCelebrationTone } from "../../lib/cats/celebrations";
import {
  createCatYearSummaries,
  type CatYearSummary,
} from "../../lib/cats/yearSummary";
import {
  CAT_GALLERY_PHOTO_LIMIT,
  deleteCatGalleryPhoto,
  readCatGalleryPhotos,
  saveCatGalleryPhoto,
  type CatGalleryPhoto,
} from "../../lib/cats/catGalleryPhotos";
import {
  readCatSleepingMilestones,
  readOwnSleepingPhotos,
  readOwnSleepingPhotoCount,
  type CatSleepingMilestone,
  type OwnSleepingPhoto,
} from "../../lib/home/sleepingPhotos";
import {
  readCatMomentsForCat,
  type CatMomentForCat,
} from "../../lib/supabase/catMomentCats";
import { createBrowserSupabaseClient } from "../../lib/supabase/browser";
import {
  disableOmoideMemories,
  hideOmoideDate,
  pauseOmoideMemories,
  readOmoideMemoriesForCat,
  readOmoideMemoryControls,
  type OmoideMemory,
} from "../../lib/home/omoideDelivery";
import { BottomNavigation } from "../navigation/BottomNavigation";
import { AppButton } from "../ui/AppButton";
import { AppBottomSheet } from "../ui/AppBottomSheet";
import { AppCard } from "../ui/AppCard";
import { AppSegmented } from "../ui/AppSegmented";
import { AppTextField } from "../ui/AppTextField";
import { PhotoTile } from "../ui/PhotoTile";
import { StoredPhotoImage } from "../ui/StoredPhotoImage";
import {
  addCatProfile,
  getActiveCatProfile,
  getCatName,
  isCatProfileNameUnset,
  readActiveCatId,
  readCatProfiles,
  saveActiveCatId,
  saveCatProfiles,
} from "../home/homeInputHelpers";
import type { CatCoat, CatProfile } from "../home/homeInputHelpers";

const COAT_OPTIONS: { value: CatCoat; label: string; color: string }[] = [
  { value: "saba", label: "サバ", color: "#d8d2c4" },
  { value: "gray", label: "グレー", color: "#d6d3d1" },
  { value: "orange_tabby", label: "茶トラ", color: "#d8bd9a" },
  { value: "black", label: "黒", color: "#625f59" },
  { value: "white", label: "白", color: "#fafafa" },
  { value: "calico", label: "三毛", color: "#f0c28b" },
];
type EditableGender = "male" | "female" | "unknown" | "";
type EditableCoat = CatCoat | "";
type UchinokoLens = "cat" | "all";
type UchinokoSection = "record" | "photos" | "basic";
const MAX_UPLOAD_SOURCE_FILE_BYTES = 20 * 1024 * 1024;
const SUPPORTED_SOURCE_IMAGE_MIME_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type LensPhoto = {
  id: string;
  src: string;
  createdAt: number;
  catIds: string[];
  catNames: string[];
  kind: "sleeping" | "photo";
  deliveryCount?: number;
};
type DeleteCatTarget = {
  profile: CatProfile;
  photoCount: number;
};
type RemoteCatDeleteResult =
  | { status: "deleted" | "skipped" }
  | { status: "error"; message: string };
type RemoteCatSaveResult =
  | { status: "saved" | "skipped" }
  | { status: "error"; message: string };
type PhotoSheetLens = "cat" | "all";
type YearSummaryDetailKind = "photos" | "pickups" | "milestones";
type RecordPhotoPreview = {
  id?: string;
  src: string;
  title: string;
  timestamp: number;
  kind?: LensPhoto["kind"];
  catIds?: string[];
};

const CATS_TEXT = "var(--ink)";
const CATS_TEXT_STRONG = "var(--ink)";
const CATS_MUTED = "var(--ink-soft)";
const CATS_FAINT = "var(--ink-faint)";
const CATS_PAPER = "var(--paper)";
const CATS_UI = "var(--font-ui)";
const CATS_SERIF = CATS_UI;
const CATS_TITLE_SIZE = "20px";
const CATS_DISPLAY_SIZE = "25px";
const CATS_BODY_SIZE = "13px";
const CATS_META_SIZE = "12px";
const CATS_TINY_SIZE = "11px";
const CATS_TITLE_TRACKING = "0.02em";
const CATS_BODY_TRACKING = "0.01em";
const CATS_META_TRACKING = "0.015em";
const CATS_PANEL_BACKGROUND = "var(--app-page-surface-strong)";
const CATS_PANEL_BACKGROUND_SOFT = "var(--app-page-surface)";
const CATS_SURFACE: CSSProperties = {
  position: "relative",
  background: "var(--app-page-surface)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-e1)",
};
const CATS_SURFACE_SOFT: CSSProperties = {
  ...CATS_SURFACE,
  background: "var(--app-page-surface-soft)",
  boxShadow: "var(--shadow-e1)",
};
const ONBOARDING_ALBUM_COMPLETION_READY_KEY =
  "neteruneko_onboarding_album_completion_ready";
const CAT_GALLERY_RESTORE_SESSION_KEY =
  "neteruneko_cat_gallery_restore_checked";
const SHOW_LEGACY_DETAIL_SECTIONS = false;

export function CatsPage() {
  const [catProfiles, setCatProfiles] = useState<CatProfile[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [catNameInput, setCatNameInput] = useState("");
  const [newCatNameInput, setNewCatNameInput] = useState("");
  const [duplicateCatNameToConfirm, setDuplicateCatNameToConfirm] =
    useState<string | null>(null);
  const [isEditingCatName, setIsEditingCatName] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAddingCat, setIsAddingCat] = useState(false);
  const [isCatManageOpen, setIsCatManageOpen] = useState(false);
  const [isCatManageEditing, setIsCatManageEditing] = useState(false);
  const [isThumbnailPickerOpen, setIsThumbnailPickerOpen] = useState(false);
  const [isOnboardingMode, setIsOnboardingMode] = useState(false);
  const [isOnboardingCompletionReady, setIsOnboardingCompletionReady] =
    useState(false);
  const [isOnboardingExistingCat, setIsOnboardingExistingCat] = useState(false);
  const [isOnboardingAlbumCreated, setIsOnboardingAlbumCreated] = useState(false);
  const [editFamilySinceDate, setEditFamilySinceDate] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editGender, setEditGender] = useState<EditableGender>("");
  const [editBreed, setEditBreed] = useState("");
  const [editCoat, setEditCoat] = useState<EditableCoat>("");
  const [editCallName, setEditCallName] = useState("");
  const [editFavoritePlace, setEditFavoritePlace] = useState("");
  const [editFavoritePlay, setEditFavoritePlay] = useState("");
  const [editFavoriteTouch, setEditFavoriteTouch] = useState("");
  const [editDislikes, setEditDislikes] = useState("");
  const [editWeightKg, setEditWeightKg] = useState("");
  const [editWeightMeasuredDate, setEditWeightMeasuredDate] = useState("");
  const [editVetClinic, setEditVetClinic] = useState("");
  const [editCareNote, setEditCareNote] = useState("");
  const [message, setMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [omoideRefreshTick, setOmoideRefreshTick] = useState(0);
  const [galleryRefreshTick, setGalleryRefreshTick] = useState(0);
  const isCatGalleryRestoreCheckRunningRef = useRef(false);
  const [activeLens, setActiveLens] = useState<UchinokoLens>("cat");
  const [activeSection, setActiveSection] =
    useState<UchinokoSection>("record");
  const [deleteCatTarget, setDeleteCatTarget] =
    useState<DeleteCatTarget | null>(null);
  const [isDeletingCat, setIsDeletingCat] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [photoSheetLens, setPhotoSheetLens] = useState<PhotoSheetLens | null>(
    null,
  );
  const [remoteLensPhotosByCat, setRemoteLensPhotosByCat] = useState<
    Record<string, LensPhoto[]>
  >({});
  const [hasRemoteLensPhotosLoaded, setHasRemoteLensPhotosLoaded] =
    useState(false);
  const [selectedOmoideMemory, setSelectedOmoideMemory] =
    useState<OmoideMemory | null>(null);
  const [selectedRecordPhoto, setSelectedRecordPhoto] =
    useState<RecordPhotoPreview | null>(null);
  const [deleteGalleryPhotoTarget, setDeleteGalleryPhotoTarget] =
    useState<RecordPhotoPreview | null>(null);
  const [isDeletingGalleryPhoto, setIsDeletingGalleryPhoto] = useState(false);
  const [selectedYearSummary, setSelectedYearSummary] =
    useState<CatYearSummary | null>(null);

  const activeCatProfile =
    catProfiles.length > 0
      ? getActiveCatProfile(catProfiles, activeCatId)
      : null;
  const catName = getCatName(activeCatProfile);
  const familyDuration = formatFamilyDuration(
    activeCatProfile?.basicInfo?.familySinceDate,
  );
  const birthdayStatus = getBirthdayStatus(activeCatProfile?.basicInfo?.birthDate);
  const takenSleepingPhotoCount = activeCatId
    ? readOwnSleepingPhotoCount(activeCatId)
    : 0;
  const omoideMemories = readOmoideMemoriesForCat(activeCatId);
  const omoideControls = readOmoideMemoryControls();
  void omoideRefreshTick;
  const sleepingMilestones = readCatSleepingMilestones(activeCatId);
  const activeAvatarSrc =
    activeCatProfile?.avatarDataUrl ??
    getCatAvatarSrc(activeCatProfile?.appearance?.coat);
  const isOnboardingProfileSetup = isOnboardingMode && isEditingProfile;
  const isOnboardingCompletionView =
    isOnboardingMode && isOnboardingCompletionReady && !isEditingProfile;
  const canManageCats = !isOnboardingProfileSetup && !isOnboardingCompletionView;
  const shouldShowCatSwitchButton = catProfiles.length > 1 && canManageCats;
  const shouldShowPhotoLensSwitch =
    catProfiles.length > 1 &&
    canManageCats &&
    !isAddingCat &&
    !isEditingProfile;
  const localLensPhotos = useMemo(
    () => createLocalLensPhotos(catProfiles),
    [catProfiles, galleryRefreshTick],
  );
  const lensPhotosByCat = mergeLensPhotoSources(
    localLensPhotos.byCat,
    remoteLensPhotosByCat,
    hasRemoteLensPhotosLoaded,
  );
  const activeCatLensPhotos = activeCatId
    ? lensPhotosByCat[activeCatId] ?? []
    : [];
  const activeCatGalleryLensPhotos = useMemo(
    () => activeCatLensPhotos.filter(isCatGalleryLensPhoto),
    [activeCatLensPhotos],
  );
  const stableSleepingCoverPhoto = useMemo(
    () => getStableSleepingCoverPhoto(activeCatLensPhotos),
    [activeCatLensPhotos],
  );
  const hasCustomThumbnail = Boolean(activeCatProfile?.avatarDataUrl);
  const activeCoverPhoto =
    activeCatGalleryLensPhotos[0] ?? stableSleepingCoverPhoto;
  const activeCoverSrc =
    activeCatProfile?.avatarDataUrl ?? activeCoverPhoto?.src ?? activeAvatarSrc;
  const activeCoverFit =
    hasCustomThumbnail || activeCoverPhoto ? "cover" : "contain";
  const allLensPhotos = useMemo(
    () =>
      mergeAllLensPhotos(
```



### catGalleryPhotos storage helpers

File: `src/lib/cats/catGalleryPhotos.ts` lines 1-189

```ts
import { isUsablePhotoSrc, normalizePersistentPhotoSrc } from "../photoStorage";
import { STORAGE_KEYS } from "../storage";

export type CatGalleryPhoto = {
  id: string;
  catId: string;
  src: string;
  createdAt: number;
};

export const CAT_GALLERY_PHOTOS_UPDATED_EVENT =
  "neteruneko_cat_gallery_photos_updated";
export const CAT_GALLERY_PHOTO_LIMIT = 100;

export function readCatGalleryPhotos(activeCatId: string | null = null) {
  const photos = readStorageArray<CatGalleryPhoto>(STORAGE_KEYS.catGalleryPhotos)
    .filter(isValidCatGalleryPhoto)
    .map(normalizeCatGalleryPhoto)
    .sort((left, right) => right.createdAt - left.createdAt);

  return activeCatId
    ? photos.filter((photo) => photo.catId === activeCatId)
    : photos;
}

export function saveCatGalleryPhoto({
  catId,
  src,
}: {
  catId: string;
  src: string;
}) {
  const normalizedSrc = normalizePersistentPhotoSrc(src) || src;

  if (!catId || !isUsablePhotoSrc(normalizedSrc)) {
    return null;
  }

  const createdAt = Date.now();
  const photo: CatGalleryPhoto = {
    id: createCatGalleryPhotoId(createdAt),
    catId,
    src: normalizedSrc,
    createdAt,
  };

  try {
    const saved = readCatGalleryPhotos(null);
    const savedForCat = saved.filter((savedPhoto) => savedPhoto.catId === catId);
    if (savedForCat.length >= CAT_GALLERY_PHOTO_LIMIT) {
      return null;
    }

    writeStorageArray(
      STORAGE_KEYS.catGalleryPhotos,
      limitCatGalleryPhotosPerCat([photo, ...saved]),
    );
    dispatchCatGalleryPhotosUpdated();
    return photo;
  } catch {
    return null;
  }
}

export function deleteCatGalleryPhoto(photoId: string) {
  if (!photoId) {
    return null;
  }

  const saved = readCatGalleryPhotos(null);
  const target = saved.find((photo) => photo.id === photoId) ?? null;

  if (!target) {
    return null;
  }

  writeStorageArray(
    STORAGE_KEYS.catGalleryPhotos,
    saved.filter((photo) => photo.id !== photoId),
  );
  dispatchCatGalleryPhotosUpdated();

  return target;
}

export function restoreSyncedCatGalleryPhotos({
  photos,
  mergeLocal,
}: {
  photos: CatGalleryPhoto[];
  mergeLocal: boolean;
}) {
  const existing = mergeLocal ? readCatGalleryPhotos(null) : [];
  const photoMap = new Map<string, CatGalleryPhoto>();
  const existingIds = new Set(existing.map((photo) => photo.id));
  let restoredCount = 0;

  for (const photo of [...existing, ...photos]) {
    if (!isValidCatGalleryPhoto(photo)) {
      continue;
    }

    const normalized = normalizeCatGalleryPhoto(photo);
    if (!existingIds.has(normalized.id)) {
      restoredCount += 1;
    }
    photoMap.set(normalized.id, normalized);
  }

  const nextPhotos = limitCatGalleryPhotosPerCat([...photoMap.values()]);

  writeStorageArray(STORAGE_KEYS.catGalleryPhotos, nextPhotos);
  dispatchCatGalleryPhotosUpdated();

  return restoredCount;
}

function normalizeCatGalleryPhoto(photo: CatGalleryPhoto): CatGalleryPhoto {
  return {
    id: photo.id,
    catId: photo.catId,
    src: normalizePersistentPhotoSrc(photo.src) || photo.src,
    createdAt: photo.createdAt,
  };
}

function isValidCatGalleryPhoto(
  photo: Partial<CatGalleryPhoto>,
): photo is CatGalleryPhoto {
  return Boolean(
    typeof photo.id === "string" &&
      typeof photo.catId === "string" &&
      typeof photo.src === "string" &&
      isUsablePhotoSrc(photo.src) &&
      typeof photo.createdAt === "number" &&
      Number.isFinite(photo.createdAt),
  );
}

function limitCatGalleryPhotosPerCat(photos: CatGalleryPhoto[]) {
  const countByCatId = new Map<string, number>();

  return photos
    .sort((left, right) => right.createdAt - left.createdAt)
    .filter((photo) => {
      const count = countByCatId.get(photo.catId) ?? 0;
      if (count >= CAT_GALLERY_PHOTO_LIMIT) {
        return false;
      }

      countByCatId.set(photo.catId, count + 1);
      return true;
    });
}

function createCatGalleryPhotoId(createdAt: number) {
  const random =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2);

  return `cat-gallery-${createdAt}-${random}`;
}

function dispatchCatGalleryPhotosUpdated() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(CAT_GALLERY_PHOTOS_UPDATED_EVENT));
}

function readStorageArray<T>(key: string) {
  if (typeof window === "undefined") {
    return [] as T[];
  }

  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];

    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [] as T[];
  }
}

function writeStorageArray<T>(key: string, value: T[]) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

```



### Codex????

- `/cats` ????restore?????????????????????????????????????????

- remote??catId? `__cat_gallery` ?????????????????????????

- restore????UI????storage event/custom event??????????????????????

## E2E baseline note

`npm run e2e` ?2026-07-02???????20??????????????????????????????????????/timeout?????WebServer?? `Supabase client is not configured` ??????????

??????????????????green/??red??????????????????Supabase???????????????

?????green??????????? `.env.local` ?????Supabase env???????????????
