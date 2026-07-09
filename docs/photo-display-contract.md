# Photo display contract

This document is the source of truth for user-visible photo display.

The app has four display contexts. New photo UI must choose one of these
contexts instead of inventing a local `src` / `object-fit` rule.

| Context | Use | Fit | Source order | Storage signing |
|---|---|---|---|---|
| `list` | square tiles and small thumbnails | `cover` | `thumbnailSrc -> displaySrc -> originalSrc -> src` | `thumbnail` transform |
| `board` | nekodayori board cards | `cover` | `displaySrc -> originalSrc -> thumbnailSrc -> src` | `thumbnail` transform |
| `cover` | cat profile cover | `cover` | `displaySrc -> originalSrc -> thumbnailSrc -> src` | plain `display` |
| `detail` | detail/fullscreen viewer | `contain` | `displaySrc -> originalSrc -> thumbnailSrc -> src` | plain `display` |

## Board context

`board` replaces the old internal name `large`.

The rule is intentionally a little counterintuitive: board cards choose the
larger display/original asset, then ask Storage for the `thumbnail` transform.
That means the server shrinks a large source to width 800 instead of upscaling a
saved 512px thumbnail asset.

## Cover context

Profile cover has one extra rule:

- if a user crop exists, the crop always wins
- if a custom cover photo exists without a crop, fall back to `cover` with
  `object-position: 50% 30%`
- automatic cover photos use the same `cover` fallback

## Detail context

Detail viewers use `contain` so the full photo can be inspected without hidden
edges. This is different from list, board, and cover, where cropping is a
deliberate layout choice.

## Deprecated notes

Older docs may mention `thumb width=400` or a `large` display context. Those are
deprecated. The active implementation uses thumbnail transform width 800 and the
`board` context above.
