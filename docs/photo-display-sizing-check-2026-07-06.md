# Photo Display Sizing Check 2026-07-06

Purpose: confirm the root cause of enlarged or soft-looking photo display before
changing image sizing.

Method:

- Local Next.js app with Playwright.
- Viewport: 390 x 844 CSS px.
- `deviceScaleFactor`: 3.
- Signed URL APIs were intercepted to return controlled image URLs.
- Thumbnail variant initially returned `width=400&quality=75`.
- Display variant returned `width=1200`.

Before fix:

| Screen | Src variant | Natural size | Render size | DPR | Physical px needed | Result |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Collection grid | thumbnail width=400 | 400 x 300 | 178.1 x 178.1 | 3 | 534.3 x 534.3 | Thumbnail width too small on DPR3 |
| Cats profile cover | thumbnail width=400 | 400 x 300 | 372 x 186 | 3 | 1116 x 558 | Wrong variant for large cover |
| Cats photo grid | thumbnail width=400 | 400 x 300 / 400 x 533 | 111.3 x 111.3 | 3 | 334 x 334 | OK |

CSS observed on the problematic profile cover image:

- `object-fit: cover`
- `aspect-ratio: auto 112 / 112` from the `img` attributes
- Rendered through a parent frame of `372 x 186`
- The root issue was not a remaining global `512 x 512` default; that had already
  been removed.

Fix:

- Thumbnail transformation width changed from `400` to `800` while keeping
  `quality=75`.
- `PhotoTile` now accepts `storageVariant`.
- The large cats profile cover uses `storageVariant="display"` and the detail /
  display source instead of the thumbnail source.
- Photo grids continue to use the thumbnail variant.

