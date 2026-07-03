# Home Envelope Rive Candidates

The production goal is not to use Codex-made SVG art. The target is a real Rive-authored envelope opening animation that can make the home delivery moment feel rewarding enough to replay.

## Current Direction

Use Rive Marketplace / Rive Editor assets as the base, then restyle the art inside Rive or with proper layered raster/vector artwork. The app already supports a runtime asset at:

```text
public/animations/home-envelope-open.riv
```

Current production status:

```text
No Marketplace candidate is connected to home production.
The current candidates are comparison references only.
The home screen falls back to the existing envelope UI until:
public/animations/home-envelope-open.riv
is exported from Rive Editor with the contract below.
```

## Important Finding

The public Marketplace preview API exposes Editor revision data, not a runtime-ready `.riv` export. Those preview binaries fail in the React runtime with a bad-header load error.

The usable Marketplace runtime files are exposed separately from `public.rive.app/community/runtime-files/...`. Candidate runtime files are now downloaded into:

```text
public/animations/prototypes/
```

The production path is:

```text
Rive Marketplace / Editor remix -> Export for runtime -> public/animations/home-envelope-open.riv
```

Do not copy `api.rive.app/api/preview/...` responses into `public/animations/*.riv`.

Candidate sources:

```text
Open Letter
https://rive.app/marketplace/17262-32384-open-letter/
License: CC BY 4.0
Use: closest interaction model; visual style needs replacement

Interactive Letter
https://rive.app/marketplace/15937-30013-interactive-letter/
License: CC BY 4.0
Use: drag/press behavior reference; author says graphics are placeholders

Envelope Study
https://rive.app/marketplace/542-1020-envelope-study/
License: CC BY 4.0
Use: clean flap motion reference

OTP Envelope
https://rive.app/marketplace/8990-17167-otp-envelope/
License: CC BY 4.0
Use: reward-star concept reference; may need cleanup in Rive Editor

Envelope 19611
https://rive.app/marketplace/19611-36899-envelope/
Use: rich candidate; too heavy at 17MB unless edited down

Envelop & Circles
https://rive.app/marketplace/21114-39688-envelop-and-circles/
Use: decorative envelope reference; circles likely need removal

Email Icon
https://rive.app/marketplace/485-912-email-icon/
Use: lightweight envelope icon motion reference
```

Local prototype route:

```text
/prototypes/rive-envelope
```

Downloaded runtime candidates:

```text
public/animations/prototypes/open-letter.riv
public/animations/prototypes/interactive-letter.riv
public/animations/prototypes/envelope-study.riv
public/animations/prototypes/envelope.riv
public/animations/prototypes/otp-envelope.riv
public/animations/prototypes/market-envelope.riv
public/animations/prototypes/envelop-and-circles.riv
public/animations/prototypes/email-icon.riv
```

## Local Runtime Inspection

Run this whenever a candidate is added or replaced:

```text
npm run inspect:rive-prototypes
```

It writes:

```text
artifacts/rive-prototype-previews/inspection.json
artifacts/rive-prototype-previews/*.png
```

Current inspection result:

| Candidate | Size | Runtime metadata | Product fit |
| --- | ---: | --- | --- |
| `open-letter.riv` | 64KB | Artboard `Envelope`, state machine `State Machine 1`, no inputs | Reject. Generic envelope, visible English text, not app-specific, no `open` trigger. |
| `interactive-letter.riv` | 64KB | Artboard `Envelope`, state machine `State Machine 1`, no inputs | Reject. Blue stage and placeholder text are far from the quiet paper home world. |
| `envelop-and-circles.riv` | 4KB | Artboard `Envelop & Circles`, state machine `State Machine 1`, no inputs | Reject. Decorative/abstract and not a tactile letter-opening moment. |
| `otp-envelope.riv` | 4KB | Artboard `New Artboard`, state machine `otp`, no inputs | Reject. OTP/reward-star language is the wrong mental model. |
| `email-icon.riv` | 10KB | Artboard `New Artboard`, state machine `State Machine 1`, no inputs | Reject as production. Useful only as tiny icon motion reference. |
| `envelope-study.riv` | 1KB | Artboard `Envelope Artboard`, no state machine | Motion reference only. Too primitive as final art. |
| `envelope.riv` | 1KB | Artboard `New Artboard`, state machine `State Machine 1`, no inputs | Motion reference only. Too primitive as final art. |
| `market-envelope.riv` | 17MB | State machine string `SM_envelope` appears in file | Reject for app bundle unless heavily edited down. Over the 1MB hard stop. |

Important: none of the downloaded candidates currently satisfy the app runtime contract:

```text
Artboard: HomeEnvelopeOpen
State Machine: EnvelopeOpenMachine
Trigger input: open
```

They should not be copied into `public/animations/home-envelope-open.riv` as-is.

## Product-Fit Criteria

The final asset should:

- Match the loading screen paper/envelope world.
- Avoid generic web-game or OTP visual language.
- Use an intimate reward style: wax split, soft paper glow, tiny motes, photo peeking out.
- Avoid loud confetti, saturated purple, or tech-product icon styling.
- Work on night backgrounds.
- Keep the real delivered photo as DOM, not baked into the Rive file.

## Next Rive Editor Work

1. Open the best candidate in Rive Editor via Marketplace remix.
2. Replace the visual art with app-specific paper/wax/photo-placeholder layers.
3. Keep or rebuild the successful motion beats:

```text
press -> seal break -> flap open -> photo peek -> reward settle
```

4. Export final runtime file:

```text
public/animations/home-envelope-open.riv
```

5. Match the app runtime contract, or update `homeEnvelopeRiveConfig.ts`:

```text
Artboard: HomeEnvelopeOpen
State Machine: EnvelopeOpenMachine
Input: open
```

6. Verify:

```text
npm run typecheck
npx playwright test tests/e2e/home-desk-model.spec.ts -g "opens the delivered envelope after a tap animation"
npm run build
```
