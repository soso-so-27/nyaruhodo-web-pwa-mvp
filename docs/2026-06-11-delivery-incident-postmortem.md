# 2026-06-11 delivery incident follow-up

## P1-1 fast candidate flag

Current production behavior is preserved by default:

- `SLEEPING_DELIVERY_FAST_CANDIDATES` unset: `admin_storage`
- `SLEEPING_DELIVERY_FAST_CANDIDATES=off`: skip the fast storage-only candidate path and use the full pool path

`admin_storage` is still the temporary behavior: the fast path only reads admin stock rows identified by `local_moment_id like 'stock-sleeping-%'`, then fetches the selected row's `photo_url`. This keeps the 6/11 fix fast without changing the pool back to user-shared candidates yet.

### Design to restore user-shared candidates

Do not restore by reading every `photo_url` from the full pool. The safe design is:

1. Add a new mode after review, for example `SLEEPING_DELIVERY_FAST_CANDIDATES=storage_pool`.
2. Query only lightweight rows that are already storage references:
   - `visibility = 'shared'`
   - `delivery_status = 'available'`
   - `metadata->>'pool_kind' in ('admin_stock', 'user_shared')`
   - `photo_url like 'storage:%' or photo_url like 'storage://%'`
3. Select only short fields plus the short storage ref: `id, user_id, anonymous_id, local_moment_id, local_cat_id, owner_cat_id, photo_url, delivery_status, metadata, created_at`.
4. Keep the same exclusion rules: self photo, same recipient cat, blocked, hidden, reported, known test/debug/fallback rows.
5. Return the selected `storage:` ref directly. Do not resolve, sign, fetch, convert, or upload image bytes inside exchange.
6. Keep legacy data URL candidates only on the slower fallback path until existing rows are migrated or expire.

This restores fairness for user-shared storage photos while keeping the hot path byte-light.

## P1-3 performance record

Exchange now logs timing marks for: `read_request`, `auth`, `read_existing_delivery`, `own_photo`, `read_fast_storage`, `select_fast_storage`, `read_full_pool`, `select_full_pool`, `delivery_photo`, `insert_delivery`, plus total duration. These logs are emitted as `[sleeping-delivery/exchange] timing`.

From the 6/11 screenshots, the slow failing path was 13.13s to 20.24s at Vercel function duration. After the storage fast path landed, one successful production request was observed at 3.08s in Vercel, and the client trace showed 3467ms. The exact 13s internal split is not recoverable from screenshots because timing marks were added during the incident, not before it. The most likely slow work removed was full candidate photo scanning and image-byte handling: resolving storage photos, converting/compressing payloads, and uploading delivery-cache bytes in the exchange request path.

Current local regression check: `sleeping-delivery-pool-guards.spec.ts` has a 3s exchange latency budget. In the latest focused run it completed in about 1.4s. Production p50/p95 are not available from this local environment; compute them from Vercel logs by aggregating `totalMs` in `[sleeping-delivery/exchange] timing` after deployment.

STEP 0 result: no `AbortController`, `signal`, or client-side timeout exists around `/api/sleeping-delivery/exchange`. The only nearby AbortController is for `/api/presence`. The 4.7s iOS `TypeError: Load failed` is therefore not explained by a client timeout in this codebase and remains unresolved.

## P1-4 commit shelf

| commit | change | classification | note |
|---|---|---|---|
| 7e57cb9 | Send data image variant for evening exchange | Keep | Still useful as fallback for data URL photos. |
| 4d4afbf | Resolve storage photo before evening exchange | Redesign later | Superseded for the hot path by direct `storage:` exchange; keep only as fallback behavior. |
| b0fe62f | Compress storage photo before evening exchange | Redesign later | Avoid quality loss on storage hot path; compression should remain fallback-only. |
| 59949cd | Prefer compact exchange upload payloads | Keep | Reduces request size for data URL fallback. |
| 884461d | Use storage references for evening exchange | Keep | Core fix: avoids sending image bytes. |
| 2e5aefa | Resolve only selected exchange candidate | Keep | Removes full-pool image resolution. |
| b6b70be | Avoid auth blocking storage exchange | Returned | The anonymous storage bypass is removed by `3b9c524`; storage own photos now require auth and own path. |
| ea095c0 | Return storage refs for exchange deliveries | Keep | Required for fast response and signed-url display path. |
| 9f63c15 | Prefer fast storage exchange path | Keep behind flag | Now controlled by `SLEEPING_DELIVERY_FAST_CANDIDATES`. |
| b307b2d | Speed up storage delivery exchange | Keep | Reduced production route duration to roughly 3s in the observed request. |
| 098a8f4 | Avoid heavy exchange candidate photo scans | Keep | Prevents large `photo_url` data URL reads in the hot path. |
| 4b9d140 | Allow delivered admin stock photos to render | Returned/redesigned | The unauthenticated signing shortcut was removed by `3b9c524`; rendering now requires own/delivered authorization. |
| 6524b73 | Keep same-day kept delivery visible on home | Keep | Fixes the post-delivery home state. |
| 3b9c524 | Harden delivery photo storage access | Keep | P0 security and idempotency hardening. |

No additional revert target is identified after P0/P1. The remaining design item is restoring user-shared storage candidates through the reviewed `storage_pool` fast mode.

## R-1 anonymous storage delivery check

Before this follow-up, `/api/photo-storage/signed-url` required a Bearer token before it checked `anonymousId` delivery ownership. That means an anonymous user who received a `storage:` delivery could not use the signed-url API, even though the delivery row itself was correctly tied to their anonymous id.

The fix keeps the signed-url API strict. Anonymous access is handled only in `/api/sleeping-delivery/exchange`: after a delivery is created or replayed idempotently, the API may attach a short-lived signed URL to that one returned `ExchangePhoto` as `displaySrc` / `thumbnailSrc` / `originalSrc`, while leaving persistent `src` as the `storage:` reference. The client immediately converts the displayed image to a data URL and writes it back to the evening delivery store / kept photos, so reload and offline album display do not depend on anonymous signed-url access.

## R-2 orphan delivery investigation SQL

Run this first in the Supabase SQL Editor. It is read-only and lists exchange deliveries from 2026-06-11 11:00-14:30 UTC, grouped by recipient identity and delivery date. Rows with `duplicate_count > 1` or a non-idempotent `local_delivery_id` are the likely client-unreceived/orphan candidates from the incident window.

```sql
with incident_deliveries as (
  select
    id,
    user_id,
    anonymous_id,
    coalesce('user:' || user_id::text, 'anon:' || anonymous_id) as recipient_key,
    local_delivery_id,
    source_moment_id,
    source_photo_id,
    recipient_local_cat_id,
    photo_url,
    status,
    metadata,
    coalesce(
      metadata->>'delivery_date_key',
      to_char(delivered_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD')
    ) as delivery_date_key,
    delivered_at
  from public.cat_moment_deliveries
  where delivered_at >= timestamptz '2026-06-11 11:00:00+00'
    and delivered_at < timestamptz '2026-06-11 14:30:00+00'
    and coalesce(metadata->>'source', '') = 'server_exchange'
),
ranked as (
  select
    *,
    count(*) over (partition by recipient_key, delivery_date_key) as duplicate_count,
    row_number() over (
      partition by recipient_key, delivery_date_key
      order by delivered_at desc, id desc
    ) as keep_rank,
    local_delivery_id !~ ('^delivered-sleeping-' || delivery_date_key || '-')
      as non_idempotent_local_id
  from incident_deliveries
)
select
  recipient_key,
  delivery_date_key,
  duplicate_count,
  keep_rank,
  non_idempotent_local_id,
  id,
  local_delivery_id,
  source_photo_id,
  recipient_local_cat_id,
  photo_url,
  status,
  delivered_at,
  metadata
from ranked
where duplicate_count > 1
   or non_idempotent_local_id
order by recipient_key, delivery_date_key, keep_rank, delivered_at;
```

Do not run the update until the SELECT result has been reviewed. This version keeps the newest delivery per recipient/date and marks older duplicate rows as `hidden` with metadata explaining the cleanup. It does not delete rows.

```sql
-- Preview the exact rows that would be marked hidden.
with incident_deliveries as (
  select
    id,
    coalesce('user:' || user_id::text, 'anon:' || anonymous_id) as recipient_key,
    coalesce(
      metadata->>'delivery_date_key',
      to_char(delivered_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD')
    ) as delivery_date_key,
    local_delivery_id,
    status,
    metadata,
    delivered_at
  from public.cat_moment_deliveries
  where delivered_at >= timestamptz '2026-06-11 11:00:00+00'
    and delivered_at < timestamptz '2026-06-11 14:30:00+00'
    and coalesce(metadata->>'source', '') = 'server_exchange'
),
ranked as (
  select
    *,
    count(*) over (partition by recipient_key, delivery_date_key) as duplicate_count,
    row_number() over (
      partition by recipient_key, delivery_date_key
      order by delivered_at desc, id desc
    ) as keep_rank
  from incident_deliveries
)
select *
from ranked
where duplicate_count > 1
  and keep_rank > 1
  and status = 'delivered'
order by recipient_key, delivery_date_key, keep_rank;

-- If the preview is correct, run the status update.
with incident_deliveries as (
  select
    id,
    coalesce('user:' || user_id::text, 'anon:' || anonymous_id) as recipient_key,
    coalesce(
      metadata->>'delivery_date_key',
      to_char(delivered_at at time zone 'Asia/Tokyo', 'YYYY-MM-DD')
    ) as delivery_date_key,
    local_delivery_id,
    status,
    metadata,
    delivered_at
  from public.cat_moment_deliveries
  where delivered_at >= timestamptz '2026-06-11 11:00:00+00'
    and delivered_at < timestamptz '2026-06-11 14:30:00+00'
    and coalesce(metadata->>'source', '') = 'server_exchange'
),
ranked as (
  select
    *,
    count(*) over (partition by recipient_key, delivery_date_key) as duplicate_count,
    row_number() over (
      partition by recipient_key, delivery_date_key
      order by delivered_at desc, id desc
    ) as keep_rank
  from incident_deliveries
),
targets as (
  select id
  from ranked
  where duplicate_count > 1
    and keep_rank > 1
    and status = 'delivered'
)
update public.cat_moment_deliveries d
set
  status = 'hidden',
  metadata = coalesce(d.metadata, '{}'::jsonb)
    || jsonb_build_object(
      'cleanup_reason', '2026-06-11-client-unreceived-duplicate',
      'cleanup_at', now()
    )
from targets
where d.id = targets.id
returning
  d.id,
  d.local_delivery_id,
  d.status,
  d.metadata,
  d.delivered_at;
```
