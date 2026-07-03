# Home Envelope Rive Authoring Options

## Current Decision

The final `public/animations/home-envelope-open.riv` should be authored in Rive Editor, using the Rive AI Agent or manual Rive Editor work.

Do not generate the production file from Codex-authored SVG.

## Why

The app requires this runtime contract:

```text
Artboard: HomeEnvelopeOpen
State Machine: EnvelopeOpenMachine
Input: open
Input type: Trigger
```

The official Rive web packages in this repo are runtimes. They load and control `.riv` files, but they are not production authoring tools for this animation.

The older Rive MCP integration exists in documentation, but Rive now labels that MCP integration as deprecated and directs users to the Rive AI Agent for editor-side AI work.

## Local Environment Check

Run:

```text
npm run check:rive-authoring
```

This checks:

- whether `public/animations/home-envelope-open.riv` exists
- whether a local `rive` command is available
- whether a Rive process appears to be running
- whether the local Rive MCP endpoint is reachable

On this machine, there is currently no reachable local Rive MCP/editor server:

```text
http://127.0.0.1:9791/mcp
```

The Rive Editor process is also not currently running, and no `rive` CLI command is available. That means Codex cannot directly write the final `.riv` through Rive Editor in this session.

## Non-Official Generator Check

`@stevysmith/rive-generator@0.1.1` was inspected because it claims to generate `.riv` files programmatically.

It is not suitable for this production file because its exposed API is limited to:

```text
artboards
nodes
basic vector shapes
fills/strokes/gradients
linear animations
simple keyed properties
```

It does not expose the pieces this app needs:

```text
image asset import
state machine creation
trigger inputs
the exact EnvelopeOpenMachine / open contract
```

Using it would create a narrower, incompatible animation and would move away from the requested end state.

## Best Path

1. Run `npm run check:rive-envelope-assets`.
2. Open Rive Editor.
3. Use `docs/design/home-envelope-rive-editor-agent-prompt.md` with the Rive AI Agent, or author manually from the same brief.
4. Import only:

```text
public/animations/reference/home-envelope-rive-layers-v2/transparent/*.png
```

5. Use:

```text
public/animations/reference/home-envelope-rive-keyframes-v2.json
```

for layer placement, timing, and named contract.

6. Export:

```text
public/animations/home-envelope-open.riv
```

7. Run:

```text
npm run check:rive-envelope
npm run typecheck
npm run build
npx playwright test tests/e2e/home-desk-model.spec.ts -g "opens the delivered envelope after a tap animation"
```
