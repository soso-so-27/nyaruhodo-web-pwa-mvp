# Service Worker Image Cache Design

Date: 2026-07-06

Status: design only. Do not implement until reviewed.

Related investigation: `docs/photo-first-load-cache-check-2026-07-06.md`

## 1. Purpose

The goal is to avoid downloading the same private cat photo repeatedly when Supabase signed URL tokens change or expire.

Supabase Storage must stay private. This cache is an optimization for photos that the current browser profile has already fetched through a valid signed URL.

## 2. Non-goals

- Do not make the Storage bucket public.
- Do not provide full offline photo support.
- Do not cache API responses.
- Do not expand the precache list.
- Do not cache arbitrary remote images.
- Do not revalidate cached images with ETag or stale-while-revalidate.

## 3. Current Service Worker State

`public/sw.js` is a hand-written service worker, not Workbox or `next-pwa`.

Current behavior:

- precaches only `/offline`, favicon, and app icons
- caches same-origin static app assets
- uses network-first for navigation
- explicitly skips `/api/*`
- explicitly skips `/storage/v1/object/sign/*`
- explicitly skips any request with a `token` query parameter

Therefore, signed Storage images currently pass through the service worker and rely only on browser HTTP cache plus the in-memory signed URL cache in `StoredPhotoImage`.

## 4. Cache Eligibility

Only image responses from the configured Supabase Storage signed object/render endpoints are eligible.

Eligible request examples:

- `/storage/v1/object/sign/cat-photos/...`
- `/storage/v1/render/image/sign/cat-photos/...`

Required checks before storing:

1. Request method is `GET`.
2. Request destination is `image`, or the response `content-type` starts with `image/`.
3. URL belongs to the Supabase project origin.
4. URL path identifies the `cat-photos` bucket.
5. Network response status is 2xx.
6. Response type is not an opaque third-party response that cannot be inspected.

Never cache:

- `/api/*`
- auth/API JSON responses
- images outside the `cat-photos` bucket
- non-image responses
- failed/redirect/error responses

## 5. Cache Key Design

The cache key must remove signed URL tokens and expiry query params, but must not collapse different image variants into one entry.

### 5.1 Normalized Object Path

Extract the object path from the signed URL path after the bucket segment.

Example normalized object path:

```txt
user-id/cat-id/sleeping/display.webp
```

Do not include:

- `token`
- `expires`
- `expires_at`
- `signature`
- any signed-auth query parameter

### 5.2 Variant Key

Transform parameters may live in the query string rather than the path, so a path-only key would collide.

Use a separate variant key built from whitelisted, non-auth transform parameters:

- `width`
- `height`
- `quality`
- `resize`
- `format`

If none are present, use `plain`.

Examples:

```txt
plain
w800-q75
w1200-q80
w400-q75-resize-cover
```

The final logical key:

```txt
cat-photo:${variantKey}:${objectPath}
```

This prevents thumbnail 800, display 1200, and plain display from overwriting each other.

### 5.3 Cache Request URL

Cache API keys should be synthetic same-origin requests so tokens never become the key:

```txt
/__sw-photo-cache/cat-photo/<encoded logical key>
```

The actual signed URL is never stored in analytics metadata and never used as the cache lookup key.

## 6. Fetch Flow

Pseudo flow:

```txt
on fetch GET image:
  if feature flag disabled:
    return fetch(request)

  if not eligible signed Storage image:
    fall through to existing SW behavior

  logicalKey = normalize(request.url)
  cached = await imageCache.match(syntheticRequest(logicalKey))

  if cached and not expired(cached.metadata.createdAt):
    update lastUsedAt metadata
    emit photo_sw_cache_hit
    return cached response

  if cached but expired:
    delete cached response and metadata

  try:
    response = await fetch(request)
  catch:
    return fetch(request) failure as normal

  if response is not 2xx image:
    return response

  store response clone with metadata
  enforce LRU limits
  emit photo_sw_cache_miss
  return response
```

Failure rule: if SW cache logic throws at any point, fall back to plain network fetch. The service worker must not be the reason an image fails to display.

## 7. TTL and No Revalidation

TTL: 7 days from first successful cache write.

On hit:

- do not revalidate
- do not issue a new signed URL
- do not perform ETag checks

On TTL expiry:

- delete the cached entry
- fetch through the normal signed URL request path
- store the fresh response if eligible

Reason: revalidation would require fresh authorization/signing and would make the SW layer much more complex. A short TTL plus explicit purge paths is safer.

## 8. Cache Limits and LRU

Use a dedicated cache namespace:

```txt
neteruneko-photo-images-v1
neteruneko-photo-image-meta-v1
```

Proposed limits:

- max entries: 200
- max estimated bytes: 50 MB
- max age: 7 days

Metadata per logical key:

```ts
type PhotoImageCacheMetadata = {
  key: string;
  objectPath: string;
  variantKey: string;
  createdAt: number;
  lastUsedAt: number;
  estimatedBytes: number;
};
```

Byte estimate:

- prefer `content-length` if present
- otherwise store `0` and rely on entry-count cap

LRU cleanup:

1. Read all metadata entries.
2. Remove expired entries first.
3. If entry count or byte estimate exceeds cap, delete oldest `lastUsedAt` entries until under both caps.

## 9. Delete, Reject, Logout, and Account Switch Purge

The cache must not make deleted or rejected photos linger forever.

### 9.1 Client to SW Messages

Use `navigator.serviceWorker.controller?.postMessage(...)`.

Message types:

```ts
type PhotoCachePurgeMessage =
  | {
      type: "NN_PHOTO_CACHE_PURGE";
      paths: string[];
      variants?: "all" | string[];
      reason:
        | "own_photo_deleted"
        | "cat_gallery_photo_deleted"
        | "account_deleted"
        | "retroactive_reject"
        | "reported_hidden";
    }
  | {
      type: "NN_PHOTO_CACHE_PURGE_ALL";
      reason: "logout" | "account_switch" | "feature_disabled";
    };
```

Each path should be a normalized Storage object path, not a signed URL.

### 9.2 Required Purge Call Sites

Implementation must wire purge calls into:

- own sleeping photo deletion
- cat gallery photo deletion
- account deletion flow before local session is removed
- logout
- Google account switch / active account replacement
- retroactive reject/hide path when the affected Storage path is known

If retroactive reject is discovered only server-side and the client does not know the path, TTL 7 days is the fallback. A server-driven push purge is out of scope.

### 9.3 Logout and Account Switch Are Mandatory

Because a SW cache hit bypasses live signed URL validation, logout and account switch must purge all photo image cache entries.

This is the main privacy boundary.

## 10. Authorization and Threat Model

### 10.1 What Cache Hits Bypass

A cache hit means the SW returns the cached image without asking Supabase to validate the current signed URL token.

This is acceptable only under this assumption:

> The same browser profile, on the same device, previously fetched the image through a valid signed URL, and is viewing it again within 7 days.

### 10.2 Risks

Risk: shared device after logout.

- Mitigation: purge all cached photos on logout/account switch.

Risk: deleted photo still visible from cache.

- Mitigation: explicit purge on delete/reject paths plus TTL 7 days.

Risk: another user on same browser profile after account switch sees cached image.

- Mitigation: mandatory purge on account switch, not only on logout.

Risk: signed URL leaked.

- This design does not store signed URLs as cache keys or analytics values.

Risk: admin retroactive moderation action cannot reach existing client caches.

- Mitigation: TTL 7 days; explicit client purge when the app learns the path. Server push invalidation is out of scope.

## 11. Feature Flag and Rollout

The SW image cache must be controllable by a kill switch.

Recommended design:

1. Default disabled inside the SW.
2. On app boot, client reads `NEXT_PUBLIC_ENABLE_SW_IMAGE_CACHE`.
3. Client posts:

```ts
{
  type: "NN_PHOTO_CACHE_CONFIG",
  enabled: boolean
}
```

4. SW stores the enabled flag in memory and optionally in the metadata cache.
5. If disabled, SW bypasses image caching and may purge all photo image cache entries with reason `feature_disabled`.

Reason: `public/sw.js` is a static file, so an env-only runtime switch cannot directly alter SW behavior unless the client communicates the flag.

This gives production an immediate off-ramp if image caching behaves badly.

## 12. SW Update Strategy

Keep image cache across normal SW updates.

Reason:

- the cache is path-keyed and TTL-limited
- deleting it on every deploy would remove most of the performance benefit
- normal deploys do not imply photo authorization changes

Delete image cache when:

- photo cache schema version changes
- feature flag is disabled
- logout/account switch occurs
- cache metadata is unreadable/corrupt

The existing static/runtime cache cleanup can continue deleting old static cache versions. The image cache should use its own versioned prefix and cleanup rules.

## 13. Trace Events

The SW cannot call React-side analytics directly. It should post trace messages to controlled clients, and the client should forward them to `trackProductEvent`.

Events:

```txt
photo_sw_cache_hit
photo_sw_cache_miss
photo_sw_cache_purge
photo_sw_cache_error
```

Allowed metadata:

- `variant`
- `age_ms`
- `estimated_bytes`
- `entry_count`
- `reason`
- `purged_count`
- `enabled`

Forbidden metadata:

- signed URL
- token
- raw Storage path
- cat name
- email
- user id

If a per-photo debugging handle is needed, use a non-reversible short hash of the normalized path, not the raw path.

## 14. Testing Plan

### 14.1 Automated Tests

Playwright can cover the main mechanics on localhost:

1. Register SW and enable image cache via config message.
2. Load fake signed Storage image URL for object path A.
3. Verify network request count is 1.
4. Load a second fake signed URL with the same object path but a different token.
5. Verify image renders and network request count remains 1.
6. Load the same object path with a different transform variant.
7. Verify it uses a different cache entry.
8. Send `NN_PHOTO_CACHE_PURGE` for path A.
9. Load again and verify network request count increments.
10. Send `NN_PHOTO_CACHE_PURGE_ALL` and verify cache storage is empty.

Test caveat: `page.route` can be bypassed by service worker fetches in some Playwright modes. Use a local fake Storage endpoint or disable route reliance where needed.

### 14.2 Manual / Real Device Checks

Must be checked on iPhone Safari/PWA and Android Chrome/PWA:

- first view downloads image normally
- second view after route change is visibly faster
- logout removes cached photos
- account switch does not show previous account photos
- deleting a photo removes it from visible UI and does not reappear from cache
- feature flag off makes app fall back to current network behavior

### 14.3 Regression Checks

- existing photo display E2E remains green
- reporting/hide/delete flows still behave normally
- app still shows images if SW throws or cache is unavailable

## 15. Implementation Boundaries

Do not implement this design in the same change that approves it.

Suggested implementation order after review:

1. Add SW config message and disabled-by-default gate.
2. Add cache key normalization and eligibility checks.
3. Add hit/miss/store path with limits.
4. Add purge messages and logout/account switch purge.
5. Add trace forwarding.
6. Add E2E for hit/miss/purge.
7. Enable behind `NEXT_PUBLIC_ENABLE_SW_IMAGE_CACHE=false` by default.
8. Turn on in preview/staging first.

## 16. Open Trade-offs

### Authorization bypass on hit

This is the main trade-off. The design accepts same-device reuse for up to 7 days after a valid fetch, but requires logout/account-switch purge to preserve the privacy boundary.

### Retroactive moderation

Client caches cannot be instantly purged for a server-only reject unless the client receives the affected path. TTL 7 days is the fallback. If this becomes unacceptable, add a server-provided moderation invalidation list later.

### Byte accounting accuracy

`content-length` may be absent. Entry count cap is reliable; byte cap is best effort unless implementation pays the cost of reading response clones to measure exact size.

## 17. Review Decision Needed

Before implementation, reviewers should explicitly approve:

- same-device cached access for 7 days after a valid fetch
- logout/account switch as mandatory full purge boundary
- 200 entries / 50 MB proposed caps
- feature flag default-off rollout
- no stale-while-revalidate
