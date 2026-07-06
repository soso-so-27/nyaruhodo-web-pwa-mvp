# Opening Flow v2 - Current Canon

Date: 2026-07-06

This file supersedes the earlier state4 StampPair direction. The previous idea
that the opened home should render a permanent `StampPair` is explicitly
rejected for the current product.

## Canon

1. At 20:00, an unopened letter appears on the home screen.
2. Tapping the letter opens the delivered photo in the quiet full-screen opening
   overlay.
3. Closing the overlay returns to the normal home photo frame.
4. Opened deliveries do not appear in the notification tray.
5. Re-access to the delivered photo is through tapping the normal home frame.
6. The old home `StampPair` / stamp UI must not be mounted on state4.

## Explicit Non-Goals

- Do not render `src/components/ui/StampPair.tsx` on the home opened state.
- Do not add `home-stamp-pair` or `home-stamp-pair-stamp` back to `/home`.
- Do not use a stamp slot as the close-animation target.
- Do not show opened delivery copy inside the notification tray.

`StampPair` may still exist for historical prototypes or album-side experiments,
but it is not the canonical home opened-state UI.

## Current Opened State

State4 (`EveningHomeState.kind === "opened"`) uses:

- `data-testid="desk-home-frame"` as the visible home photo frame.
- no `home-stamp-pair`.
- no `home-stamp-pair-stamp`.
- no notification tray row for the opened delivery.

The frame tap opens `DeskPhotoViewer` for the delivered photo so the user can
see the letter again without restoring the old stamp layout.

## Verification

Automated E2E coverage in `tests/e2e/home-desk-model.spec.ts` must include:

1. Opened home renders the normal `desk-home-frame`.
2. `home-stamp-pair` is absent.
3. `home-stamp-pair-stamp` is absent.
4. System-opened deliveries also render the normal frame.
5. Tapping the opened home frame opens the delivered photo viewer.

If any future design work wants to reintroduce a paired/two-photo layout on
home, it needs a new reviewed spec and screenshots. Do not infer it from older
opening-flow documents.
