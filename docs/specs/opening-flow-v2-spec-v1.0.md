# Opening Flow v2 Spec v1.0 - Deprecated

Date: 2026-07-06

This file used to describe a home state4 `StampPair` direction. That direction
caused the opened home to regress to the old stamp-pair look and is no longer
valid.

Use `docs/specs/opening-flow-v2.md` as the canonical spec.

## Deprecated Direction

The following ideas from the original v1.0 spec are rejected:

- The opened home mounts the old paired/stamp layout.
- The delivered photo is permanently shown as a stamp on the home screen.
- The close animation targets a stamp slot.
- System-opened deliveries render the opened `StampPair` directly.

## Current Rule

Opened home returns to the normal home photo frame. The old stamp pair must not
be mounted on `/home`.

See:

- `docs/specs/opening-flow-v2.md`
- `tests/e2e/home-desk-model.spec.ts`
