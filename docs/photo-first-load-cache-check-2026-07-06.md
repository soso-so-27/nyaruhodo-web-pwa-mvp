# Photo First Load Cache Check - 2026-07-06

## Scope

This note records the C-1 investigation for first photo load performance. It covers Supabase Storage signed URLs for the private `cat-photos` bucket. Storage public access remains out of scope and must stay disabled.

## Production Header Sample

Measured with a production signed URL for one existing `cat-photos` object. URL tokens and full paths were not recorded.

| Variant | Cache-Control | ETag | Age | CDN header | Content-Type | Content-Length |
|---|---:|---:|---:|---:|---:|---:|
| plain | none | present | none | `cf-cache-status: MISS` | `image/jpeg` | 516 |
| transform width=800 quality=75 | none | present | none | `cf-cache-status: MISS` | `image/jpeg` | 689 |

Two signed URLs generated more than one second apart for the same path were different for both plain and transform variants.

## Browser Cache Probe

Chromium image loads were attempted for:

- same plain signed URL twice
- a new-token plain signed URL for the same path
- same transformed signed URL twice
- a new-token transformed signed URL for the same path

Resource Timing did not expose transfer bytes for these cross-origin image responses (`transferSize`, `encodedBodySize`, and `decodedBodySize` were reported as `0`), so byte-level browser cache proof is not available from this probe without server timing/TAO changes. Timing still showed the second identical URL load as faster than the first, while new-token URLs still performed a separate request.

## Service Worker State

`public/sw.js` currently does not cache Supabase signed storage images:

- `/api/*` is never cached
- `/storage/v1/object/sign/*` is never cached
- requests with a `token` query parameter are never cached
- only same-origin static app assets and navigation/offline fallback are handled

This means signed storage image caching is currently left to the browser HTTP cache and the in-memory signed URL cache in `StoredPhotoImage`.

## Judgment

The hypothesis is substantially true: signed URL tokens change for the same object path, and the response does not provide a durable `Cache-Control` policy. Same-token reloads can benefit from browser cache, but token churn weakens cache reuse for first display after URL refresh.

C-4 has performance value, but should remain a separate reviewed change. A service-worker image cache must be path-keyed, size-limited, TTL-limited, and explicitly cleared on delete/reject paths before implementation.
