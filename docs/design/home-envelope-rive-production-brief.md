# Home Envelope Rive Production Brief

## Decision

Do not ship the Marketplace candidates as-is. They are useful for motion reference, but they do not match the app:

- Open Letter: correct interaction idea, but too small and contains unwanted lettering.
- Interactive Letter: same base, but the purple stage is wrong for the product.
- Envelope Study: readable flap, but the dark stage and simple geometry feel too technical.
- Envelope 19611: visually richer, but too branded and too heavy for this moment.
- Email Icon / OTP Envelope: too icon-like or product-auth flavored.

The production Rive file should be custom-authored in Rive Editor from the storyboard reference. Do not treat Codex-generated SVG as a production source. The acceptable source paths are either editable Rive vector shapes drawn in the editor or high-quality transparent PNG layers imported into Rive.

```text
docs/design/assets/home-envelope-rive-storyboard.png
public/animations/reference/home-envelope-rive-storyboard.png
public/animations/reference/home-envelope-rive-storyboard-v2.png
public/animations/reference/home-envelope-rive-frames/01-closed.png
public/animations/reference/home-envelope-rive-frames/02-seal-break.png
public/animations/reference/home-envelope-rive-frames/03-flap-open.png
public/animations/reference/home-envelope-rive-frames/04-photo-peek.png
public/animations/reference/home-envelope-rive-frames-v2/01-closed.png
public/animations/reference/home-envelope-rive-frames-v2/02-seal-crack.png
public/animations/reference/home-envelope-rive-frames-v2/03-flap-open.png
public/animations/reference/home-envelope-rive-frames-v2/04-photo-peek.png
public/animations/reference/home-envelope-rive-timeline.json
public/animations/reference/home-envelope-rive-keyframes-v2.json
public/animations/reference/home-envelope-rive-layers-v2/source-layer-sheet-green.png
public/animations/reference/home-envelope-rive-layers-v2/source-layer-sheet.png
public/animations/reference/home-envelope-rive-layers-v2/layer-preview.png
public/animations/reference/home-envelope-rive-layers-v2/layer-manifest.json
public/animations/reference/home-envelope-rive-layers-v2/transparent/*.png
docs/design/home-envelope-rive-editor-agent-prompt.md
```

## Runtime Contract

Export the final runtime file to:

```text
public/animations/home-envelope-open.riv
```

Use this exact Rive contract unless the React config is intentionally changed:

```text
Artboard: HomeEnvelopeOpen
State Machine: EnvelopeOpenMachine
Input: open
Input type: Trigger
```

Recommended artboard:

```text
Size: 1200 x 760
Primary envelope area: x 90-1110, y 260-610
Motion safe area: x 40-1160, y 80-700
Base envelope aspect: 1.946 / 1
```

## Visual Target

Prefer the v2 storyboard as the art-quality target:

```text
public/animations/reference/home-envelope-rive-storyboard-v2.png
public/animations/reference/home-envelope-rive-frames-v2/
```

The earlier storyboard is useful only as background context. The older transparent layer set should not be used for production art because it is below the current quality bar.

Prefer the v2 transparent layer set for Rive import:

```text
public/animations/reference/home-envelope-rive-layers-v2/transparent/
public/animations/reference/home-envelope-rive-layers-v2/layer-manifest.json
```

The original layer set can remain as a historical timing reference for the DOM prototype, but it is not a valid production source for the final `.riv`.

The animation should feel like receiving a quiet personal letter, not opening a game reward chest.

Use:

- warm ivory washi paper
- muted terracotta wax seal
- tiny sleeping-cat face pressed into the wax
- soft paper fibers and low-contrast folds
- warm inner glow only after the seal breaks
- a photo card peeking out, but no real photo baked into Rive
- a few tiny motes, not confetti

Avoid:

- written text inside the envelope
- hard black, saturated purple, neon gradients
- loud confetti or arcade reward language
- heavy realistic drop shadows
- logos or source-candidate marks

## Layer Plan

Create separate Rive layers so the motion is editable:

```text
bg_glow
envelope_shadow
envelope_back_panel
envelope_front_left
envelope_front_right
envelope_front_bottom
flap_closed
flap_open_inner
inner_glow
wax_left
wax_right
wax_crumbs_01-05
paper_motes_01-08
photo_card_placeholder
photo_card_highlight
```

Keep the real delivered cat photo in DOM. The Rive `photo_card_placeholder` is only a warm card silhouette that aligns with the DOM photo reveal.

## Motion Timeline

Target duration:

```text
2200ms
```

Use these beats:

```text
0ms      Idle. Closed envelope, seal intact.
0-110ms  Tap reaction. Envelope scales to 0.982y / 1.008x, seal dimples.
110-280ms Seal tension. Wax glow appears, hairline crack grows vertically.
280-430ms Seal break. Wax halves separate 18px, crumbs fall 8-16px.
430-780ms Flap open. Top flap rotates from 0deg to -112deg with overshoot.
780-1040ms Pocket breath. Front panels lift 5px then settle, inner glow expands.
1040-1580ms Photo peek. Placeholder card rises from y 470 to y 245, opacity 0.0 to 1.0.
1580-1900ms Reward pulse. Glow peaks, motes drift outward 24-42px.
1900-2200ms Settle. Flap rests at -104deg, motes fade, envelope shadow softens.
```

Curve guidance:

```text
tap: cubic 0.24, 0.88, 0.32, 1.00
seal break: cubic 0.18, 0.82, 0.22, 1.00
flap open: cubic 0.16, 0.96, 0.24, 1.00 with one overshoot key
photo rise: cubic 0.20, 0.82, 0.18, 1.00
settle: cubic 0.32, 0.00, 0.20, 1.00
```

## Motion Preview

The prototype route includes a DOM/CSS motion preview using the same transparent layer assets:

```text
/prototypes/rive-envelope
```

Use the "Motion prototype" section to tune the feel before rebuilding the motion in Rive Editor. The preview is not the final implementation; it is a timing reference for:

- press squash
- seal split
- flap reveal
- photo-card rise
- glow and mote fade

Rive should reproduce the same beats with the layer assets from:

```text
public/animations/reference/home-envelope-rive-layers-v2/transparent/
```

If using Rive Editor AI Agent or a connected Rive MCP, start from:

```text
docs/design/home-envelope-rive-editor-agent-prompt.md
```

Current authoring notes and tool checks are recorded in:

```text
docs/design/home-envelope-rive-authoring-options.md
```

Prefer Rive Editor AI Agent or manual editor authoring for the final `.riv`. Do not rely on non-official code generators unless they can prove support for image assets, state machines, and trigger inputs matching the runtime contract.

For layer-specific placement and timeline values, use:

```text
public/animations/reference/home-envelope-rive-keyframes-v2.json
```

For a machine-readable authoring handoff that points to the exact source layers, contract, motion beats, and acceptance commands, use:

```text
public/animations/reference/home-envelope-rive-authoring-manifest.json
```

To prepare a self-contained folder for a Rive designer or Rive Editor session, run:

```text
npm run prepare:rive-envelope-handoff
```

This writes:

```text
artifacts/home-envelope-rive-handoff/
```

The generated folder contains the v2 PNG layers, storyboard, keyframes, editor prompt, production brief, authoring notes, README, and SHA-256 checksums.

To prepare a shareable zip for handoff, run:

```text
npm run pack:rive-envelope-handoff
```

This verifies the handoff folder, creates:

```text
artifacts/home-envelope-rive-handoff.zip
artifacts/home-envelope-rive-handoff.zip.sha256
```

and then expands the zip into a temporary verification folder to confirm required files and checksums.

Before rebuilding the motion in Rive Editor, open:

```text
artifacts/home-envelope-rive-handoff/preview.html
```

Use it to check the intended layer order, 2200ms timing, replay feel, and dawn/morning/noon/evening/night background safety. This browser preview is only a handoff aid; the production deliverable remains `public/animations/home-envelope-open.riv`.

## State Machine

Minimal state machine:

```text
Idle -> Opening -> Done
```

Input:

```text
open: Trigger
```

Rules:

- `open` starts from Idle.
- Re-triggering during Opening should restart only if that feels good in Rive preview; otherwise ignore until Done.
- Done should preserve the final open-envelope pose until React transitions to the delivered photo UI.
- Do not use OpenUrl events or any browser-side Rive events.

## Time-Of-Day Safety

The home background changes by time. The Rive should not depend on one background color.

Check against:

```text
dawn: pale warm gray
morning: cream paper
noon: brighter ivory
evening: dusty rose / tan
night: cool gray lavender
```

Required contrast:

- envelope silhouette remains visible on night background
- terracotta seal remains visible on warm backgrounds
- inner glow does not wash out the photo placeholder
- motes are visible but not noisy

The prototype route includes a "Background safety" section that previews the same layer motion against these five tone families before the final `.riv` is authored.

## Acceptance Checklist

The final `.riv` is acceptable only when:

- the first visible reaction starts within 100ms after tap
- seal break is readable on iPhone width
- flap opening is visible for at least 300ms and not a single-frame swap
- photo-card rise starts before the DOM opened state replaces the scene
- the asset looks intentional on night background
- file size is small enough for a home interaction; target under 500KB, hard stop at 1MB unless there is a strong reason
- `npm run check:rive-envelope` passes after `public/animations/home-envelope-open.riv` is exported. This loads the file through the Rive runtime and verifies:
  - valid `RIVE` header
  - file size under the hard stop
  - artboard `HomeEnvelopeOpen`
  - state machine `EnvelopeOpenMachine`
  - trigger input `open`
- `npm run check:rive-envelope-assets` passes before Rive authoring and before any layer replacement. This verifies:
  - every v2 transparent PNG referenced by `layer-manifest.json` exists
  - layer dimensions match the manifest
  - cutouts contain real transparency and visible pixels
  - no green-screen residue remains in visible pixels
  - `home-envelope-rive-keyframes-v2.json` references the same layer files
- `npm run check:rive-envelope-handoff` passes before sending the pack to a designer or opening it in Rive Editor. This regenerates `artifacts/home-envelope-rive-handoff/` and verifies README contents, checksums, layer count, `preview.html`, broken images, replay button, and 2200ms preview duration.
- `npm run typecheck` passes
- `npx playwright test tests/e2e/home-desk-model.spec.ts -g "opens the delivered envelope after a tap animation"` passes
- `npm run build` passes

## Editor Handoff Steps

1. Open Rive Editor.
2. Create artboard `HomeEnvelopeOpen` at `1200 x 760`.
3. Build the layer plan above using `home-envelope-rive-storyboard-v2.png` as the visual reference.
4. Import only the v2 transparent layer PNGs from `public/animations/reference/home-envelope-rive-layers-v2/transparent/`, or redraw those pieces directly in Rive at equal or better quality.
5. Use `layer-manifest.json` for initial placement and transform-origin notes.
6. Create animation `open_sequence` with the timeline above.
7. Create state machine `EnvelopeOpenMachine`.
8. Add trigger input `open`.
9. Transition `Idle -> Opening` on `open`.
10. Export runtime `.riv`.
11. Save to `public/animations/home-envelope-open.riv`.
12. Run the acceptance checklist, including `npm run check:rive-envelope-assets` and `npm run check:rive-envelope`.
