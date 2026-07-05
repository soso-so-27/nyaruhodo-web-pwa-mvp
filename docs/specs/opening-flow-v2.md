# Opening Flow v2 - ひらくは静止、しまうが動く

Date: 2026-07-05

Prerequisite inventory: `docs/opening-flow-inventory-2026-07.md`

## Summary

1. At 20:00, the letter arrives through the existing delivery flow.
2. Tapping opens it through the existing simplified reveal: the envelope disappears after 180ms and the delivered photo appears as a quiet full-screen overlay.
3. Closing the overlay is the only new motion. The full-screen photo shrinks and moves into the StampPair stamp slot, landing at `rotate(4deg)`.
4. The home state after opening is state4: the user's own sleeping photo as the large postcard plus the delivered photo as the stamp.

Long-press opening is not part of v2. Opening stays tap-based.

## State4 StampPair

- Home state4 renders `src/components/ui/StampPair.tsx`.
- Own photo: today's own sleeping photo, large postcard position.
- Delivered photo: stamp position at the upper right, `rotate(4deg)`.
- If the own photo is missing, the existing StampPair fallback frame remains and the delivered stamp is still shown.
- System-opened deliveries after 05:00 render state4 directly with no close/stow motion.
- Album-side layout is not force-merged in this task; visual consistency uses the shared `StampPair` component where practical.

## Delivered Photo Decode

- When `EveningHomeState.kind === "delivered"`, the delivered photo starts preloading.
- Source order follows the visible image path: `displaySrc`, `originalSrc`, `thumbnailSrc`, `src`.
- Storage references are resolved through `getStoragePhotoSignedUrl()`.
- The resolved source is decoded with `new Image()` and `img.decode()`.
- On tap, opening waits for decode for at most 1500ms. If decode is still not ready, the overlay opens and falls back to the existing `StoredPhotoImage` loading/fallback behavior.
- Signed URLs may expire between preload and open; the tap path keeps the normal signed URL resolution/retry path.

## Stow Motion

Trigger paths:

- Close button
- Scrim tap
- Browser back

Motion:

- Before closing, home is already committed to opened state, so the StampPair exists behind the overlay.
- The overlay photo frame rect is measured as the source.
- The home StampPair stamp slot rect is measured as the target.
- A single fixed-position duplicate photo animates with `transform`.
- Overlay backdrop and chrome fade with `opacity`.
- After the animation completes, the duplicate is removed and the real StampPair stamp becomes visible.

Parameters:

- Duration: 520ms
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)`
- Animated properties: `transform`, `opacity`
- No animated `blur`, `filter`, or `box-shadow`
- `will-change: transform` is applied only to the temporary duplicate
- Rotation is part of the transform: `0deg -> 4deg`

Fallbacks:

- `prefers-reduced-motion: reduce`: no flyer; overlay closes immediately and state4 is shown.
- Missing source/target rect: same immediate close path.

## Verification

Automated E2E coverage:

1. Opening state4 renders StampPair with own photo and rotated stamp.
2. State4 renders StampPair when today's own photo is missing.
3. Delivered state starts photo decode while the unopened letter is visible.
4. Reduced motion close skips the flyer and shows state4 immediately.
5. System-opened state4 shows StampPair without overlay/motion.
6. Normal close creates the flyer and ends on state4.

Manual verification still required:

- iPhone Safari/PWA real-device video of the stow motion.
- Check smoothness, no duplicate/blank landing frame, scrim/back parity, and no delayed photo reveal.
