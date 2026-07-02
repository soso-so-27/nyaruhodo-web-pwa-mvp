# S4判定用抽出 2026-07-02

## isRowDeliverable

```ts
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
```

## isFastStockCandidateDeliverable

```ts
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
```

## readRemoteCandidateRows クエリ部

```ts
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
```

## readFastStockCandidateRows クエリ部

```ts
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
```

## cat_moments.moderation_status デフォルト

`supabase/migrations/20260613090000_spec_v1_3_delivery_moderation.sql`

```sql
alter table public.cat_moments
  add column if not exists moderation_status text not null default 'pending'
    check (moderation_status in ('pending', 'approved', 'rejected')),
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by text,
  add column if not exists delivery_count integer not null default 0;
```

## 結論

`rejected` / `pending` は通常候補・fast stock候補ともDBクエリ段階の `moderation_status = 'approved'` で除外され、fast pathのfull row再取得後も `isRowDeliverable()` の `row.moderation_status !== "approved"` で再確認されます。
