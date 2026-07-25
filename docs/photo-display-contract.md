# Photo display contract

This document is the source of truth for user-visible photo display.

The app has three user-visible display contexts and one compatibility-only
context. New photo UI must choose one of the user-visible contexts instead of
inventing a local `src` / `object-fit` rule.

| Context | Use | Fit | Source order | Storage signing |
|---|---|---|---|---|
| `list` | square tiles, small thumbnails, and the compact cat profile card | `cover` | `thumbnailSrc -> displaySrc -> originalSrc -> src` | `thumbnail` transform |
| `board` | nekodayori board cards | `cover` | `displaySrc -> originalSrc -> thumbnailSrc -> src` | `thumbnail` transform |
| `cover` | compatibility for stored representative-photo crop data; no normal UI | `cover` | `displaySrc -> originalSrc -> thumbnailSrc -> src` | no normal-UI request |
| `detail` | detail/fullscreen viewer | `contain` | `displaySrc -> originalSrc -> thumbnailSrc -> src` | plain `display` |

## Board context

`board` replaces the old internal name `large`.

The rule is intentionally a little counterintuitive: board cards choose the
larger display/original asset, then ask Storage for the `thumbnail` transform.
That means the server shrinks a large source to width 800 instead of upscaling a
saved 512px thumbnail asset.

## Compact cat profile card

The compact card at the top of `うちのこ > プロフィール` uses the `list`
context. Its photo is automatically selected from photos already associated
with the active cat; it is not a user-configurable representative photo. If no
photo is available, render the cat fallback icon.

The card must not read the legacy `coverPhotoDataUrl` / `coverCrop` as a visible
profile setting. Those values remain stored and synced only for compatibility.

## Cover context

The page-wide cat profile cover and the compact representative-photo setting
were retired from the normal UI on 2026-07-25. Existing
`coverPhotoDataUrl` / `coverCrop` values remain stored and synced for backward
compatibility; removing the UI must not erase them.

The internal `cover` context remains only as a compatibility contract in case
stored data is read by a recovery or future migration path:

- if a user crop exists, the crop always wins
- if a custom representative photo exists without a crop, use centered `cover`

Normal profile rendering must not fetch or render a representative photo.

## Detail context

Detail viewers use `contain` so the full photo can be inspected without hidden
edges. This is different from list, board, and cover, where cropping is a
deliberate layout choice.

## Deprecated notes

Older docs may mention `thumb width=400` or a `large` display context. Those are
deprecated. The active implementation uses thumbnail transform width 800 and the
`board` context above.
