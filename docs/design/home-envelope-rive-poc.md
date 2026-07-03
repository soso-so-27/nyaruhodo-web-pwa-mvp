# Home Envelope Rive PoC

## Goal

Make the delivered-letter opening feel like a small reward moment: clear anticipation, tactile release, photo reveal, and a soft settle into the existing opened-delivery UI.

The production asset path is:

```text
public/animations/home-envelope-open.riv
```

The app checks this file at runtime. If it exists, the Rive overlay plays during opening. If it does not exist, the current PNG/CSS opening remains the fallback.

Candidate notes:

```text
docs/design/home-envelope-rive-candidates.md
```

Production brief:

```text
docs/design/home-envelope-rive-production-brief.md
```

Storyboard reference:

```text
docs/design/assets/home-envelope-rive-storyboard.png
public/animations/reference/home-envelope-rive-storyboard.png
```

## Rive Contract

Use these exact names so the React runtime can control the animation:

```text
Artboard: HomeEnvelopeOpen
State Machine: EnvelopeOpenMachine
Trigger input: open
```

Canvas target:

```text
Aspect: 1.946:1 base envelope, with extra vertical motion padding
Recommended artboard: 1200 x 760
Safe visual envelope area: x 90-1110, y 230-610
```

## Motion Beats

Total duration should feel around 2.2 seconds, matching `ENVELOPE_OPEN_MS`.

```text
0-120ms     press squash: envelope compresses 2-3%, seal dimples
120-360ms   seal break: wax splits, tiny paper/wax motes pop outward
360-720ms   flap open: flap rotates upward with a soft overshoot
720-1120ms  pocket breath: envelope body settles, inner paper glow appears
1120-1660ms photo peek: central photo rises 18-28%, slightly blurred at first
1660-2200ms reward settle: photo eases forward, motes fade, envelope stabilizes
```

## Visual Direction

- Warm ivory washi paper, same family as the loading splash.
- No text inside the Rive asset.
- No brand marks.
- No realistic heavy shadow. Use soft painted depth.
- Seal color should stay close to the app seal tone: muted terracotta.
- Tiny sleeping-cat face on the seal is acceptable, but keep it quiet.
- Avoid confetti overload. The reward should feel intimate, not arcade-like.

## Layering With DOM

Do not bake the delivered cat photo into the Rive file. The app keeps the real photo as DOM so loading, storage data URLs, moderation/reporting, and accessibility remain intact.

Rive owns:

```text
envelope body
flap
wax seal
paper/wax particles
subtle inner glow
```

React/DOM owns:

```text
real delivered photo
tap handling
sound timing
opened-delivery UI transition
reduced-motion fallback
```

## State Machine Design

Minimal state machine:

```text
Idle -> Opening -> Done
```

Inputs:

```text
open: Trigger
```

Optional future inputs:

```text
timeTone: Number 0-4 for dawn/morning/noon/evening/night tint
intensity: Number 0-1 for reduced reward intensity
```

Do not use Rive OpenUrl events or any implicit browser actions.

## Acceptance Criteria

- The first visible reaction starts within 100ms of tap.
- The seal break is legible on iPhone width.
- The flap motion is readable, not a single-frame swap.
- The real photo can be seen emerging before the opened-delivery UI replaces the scene.
- The Rive asset still looks good on the night background.
- Reduced-motion users keep the non-Rive fallback.
