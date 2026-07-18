# Onboarding Server Ledger v1

Status: implementation phase 1 / default off
Date: 2026-07-18

## Purpose

The onboarding exchange currently spans browser file APIs, localStorage,
IndexedDB, Storage, `cat_moments`, and `cat_moment_deliveries`. A server-side
photo or delivery can succeed while the browser progress write fails. The
server ledger records the durable facts needed to distinguish that partial
success from a true submission failure.

This phase is additive. It does not replace the existing onboarding UI,
exchange response, albums, or browser progress cache.

## Invariants

1. `submission_id` identifies one onboarding attempt and is unique.
2. Stages only advance: `selected -> uploading -> submitted -> delivered -> opened -> completed`.
3. Repeating the same stage update is idempotent. An older retry cannot move a
   submission backward.
4. A photo ID, delivery ID, or source photo ID cannot be replaced once set.
5. The ledger stores IDs and state only. It never stores photo bytes, data URLs,
   signed URLs, cat names, or captions.
6. An anonymous browser ID is not treated as a secret. Status access requires a
   separate random resume token whose SHA-256 hash is stored server-side.
7. Ledger failure must never turn a successful exchange into a failed exchange.
8. Legacy clients that do not send ledger fields continue through the existing
   exchange path unchanged.

## Phase 1 behavior

- Migration creates `public.onboarding_submissions` with service-role-only
  access and row-level security.
- `PUT /api/onboarding/submission` creates or advances a submission.
- `POST /api/onboarding/submission` reads safe status fields with the resume
  token.
- When `NEXT_PUBLIC_ENABLE_ONBOARDING_SERVER_LEDGER=true`, browser progress
  writes are mirrored to the endpoint without blocking local progress.
- The onboarding exchange request includes the ledger credentials. On a new,
  replayed, or duplicate-race delivery, the exchange route advances the ledger
  to `delivered` before returning. A ledger write error is logged but does not
  change the delivery response.

## Rollout gate

1. Apply the migration before code that enables the flag.
2. Keep the production flag off for the first deploy.
3. Enable in preview and run a complete onboarding on iPhone Safari, Android
   Chrome, and one embedded browser.
4. Enable for a daytime production canary outside 19:00-21:00 JST.
5. Compare `onboarding_submissions.stage` with `cat_moments` and
   `cat_moment_deliveries`; no duplicate delivery rows or stage regressions are
   allowed.
6. Roll back by setting the flag to `false`. Keep the table and endpoint so
   already issued resume tokens remain harmless and old clients remain valid.

## Later phases

- Reconcile local progress from the status endpoint during boot.
- Return an idempotent delivery view from server IDs without requiring local
  photo metadata.
- Move upload/finalization into a single server-owned submission transaction.
- Retain the current exchange endpoint until cached PWA clients have aged out.
