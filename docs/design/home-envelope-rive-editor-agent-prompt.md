# Home Envelope Rive Editor Agent Prompt

Use this prompt in Rive Editor AI Agent or with a connected Rive MCP. The goal is to produce the actual runtime file, not another Codex-made SVG mock.

## Prompt

Create a custom Rive animation for a mobile pet diary app home interaction.

The moment is: the user receives a quiet personal cat diary letter. It should feel warm, intimate, and rewarding enough to tap again, but not like a game chest, mail marketing animation, login OTP, or confetti reward.

Target output:

```text
public/animations/home-envelope-open.riv
```

This file must be a real Rive runtime export, not SVG, Lottie, GIF, video, or a Codex-generated approximation.

Do not generate or rely on Codex-made SVG art. Build the animation in Rive using clean editable Rive shapes or the supplied v2 transparent PNG layers. If any supplied layer looks below the desired quality bar, redraw that piece in Rive instead of tracing or importing a rough SVG.

Use these imported PNG references and layers:

```text
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
public/animations/reference/home-envelope-rive-layers-v2/layer-preview.png
public/animations/reference/home-envelope-rive-layers-v2/layer-manifest.json
public/animations/reference/home-envelope-rive-layers-v2/transparent/*.png
public/animations/reference/home-envelope-rive-keyframes-v2.json
```

Create this runtime contract exactly:

```text
Artboard: HomeEnvelopeOpen
Size: 1200 x 760
State machine: EnvelopeOpenMachine
Trigger input: open
Animation: open_sequence
States: Idle, Opening, Done
```

Visual direction:

- Use `home-envelope-rive-storyboard-v2.png` as the primary art-quality reference.
- Use `home-envelope-rive-layers-v2/transparent/*.png` as the primary import layer set.
- Do not use the older transparent layer PNGs as final art. They are historical reference only.
- horizontal ivory washi envelope, approximately 1.95:1
- muted terracotta wax seal with a tiny sleeping-cat impression
- low-contrast paper folds and soft fibers
- warm inner glow after the seal breaks
- a soft blank photo-card placeholder peeking out
- a few paper motes only, no confetti
- no text inside the Rive art
- no logos, hard black outlines, neon colors, purple stages, or OTP/mail-product styling

Motion:

```text
0ms      Idle, closed envelope, seal intact
0-110ms  tap squash, envelope scaleX 1.008 / scaleY 0.982
110-280ms seal tension, glow begins, vertical crack becomes readable
280-430ms seal break, wax halves separate about 18px, tiny crumbs drop
430-780ms flap opens with visible overshoot, not a single-frame swap
780-1040ms front pocket breathes upward 3-5px and settles
1040-1580ms photo placeholder rises from inside the envelope
1580-1900ms warm reward pulse, motes drift outward subtly
1900-2200ms settle, open pose remains stable for React handoff
```

Use these curves as a guide:

```text
tap: cubic 0.24, 0.88, 0.32, 1.00
seal break: cubic 0.18, 0.82, 0.22, 1.00
flap open: cubic 0.16, 0.96, 0.24, 1.00 with one overshoot key
photo rise: cubic 0.20, 0.82, 0.18, 1.00
settle: cubic 0.32, 0.00, 0.20, 1.00
```

The app background changes by time. Preview against dawn, morning, noon, evening, and night paper backgrounds. The silhouette, wax seal, glow, and card must remain readable on all five.

Use `home-envelope-rive-keyframes-v2.json` for the first pass of layer placement, timing, curves, and transform targets. It mirrors the DOM motion preview and should be treated as the implementation reference, not just a loose mood board.

Use `public/animations/reference/home-envelope-rive-authoring-manifest.json` as the machine-readable source of truth for output path, allowed layer sources, contract names, duration, motion beats, and acceptance commands.

Export the final runtime file as:

```text
public/animations/home-envelope-open.riv
```

After export, run:

```text
npm run check:rive-envelope-assets
npm run check:rive-envelope-handoff
npm run check:rive-envelope
npm run typecheck
npm run build
npx playwright test tests/e2e/home-desk-model.spec.ts -g "opens the delivered envelope after a tap animation"
```
