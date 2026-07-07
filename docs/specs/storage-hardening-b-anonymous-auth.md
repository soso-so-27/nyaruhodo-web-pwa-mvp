# STORAGE-HARDENING-B anonymous auth implementation note

Date: 2026-07-07

This note records the first implementation slice for Supabase anonymous auth.
The feature remains gated by `NEXT_PUBLIC_ANON_AUTH_ENABLED`.

## Implemented in this slice

- Anonymous Supabase auth is created only at the first photo persistence point.
  Opening the onboarding page alone does not create a user.
- When the flag is off, photo persistence falls back to the previous behavior.
- When the flag is on and no session exists, `storeAccountPhotoDataUrl()` calls
  `signInAnonymously()` and stores photos under the generated auth uid.
- Sleeping-photo backup sends the current access token as `Authorization: Bearer`.
  The backup API treats this as a normal authenticated user, including anonymous users.
- Onboarding handoff can carry the anonymous session's access/refresh tokens.
  Redeem restores the session before restoring local onboarding data.
- Google continuation uses `linkIdentity()` when the current session is anonymous.
  Without an anonymous session, it keeps the existing `signInWithOAuth()` behavior.
- If Google linking fails because the identity already belongs to another account,
  the app falls back to the existing-account OAuth path. Before switching sessions,
  local Storage references pointing at the anonymous uid are recorded as a small
  path manifest. After the existing account login completes, the server copies
  those objects from `{anonymousUid}/...` to
  `{existingUserId}/anonymous-transfer/{anonymousUid}/...` with the service role,
  then the client rewrites local references to the copied paths.
- Anonymous users are not treated as a completed Google/account connection on
  `/account/create`.

## Q9 conflict fallback decision

The first Q9 fallback briefly considered converting anonymous Storage references
back into `data:` URLs before switching sessions. That was rejected because it
does not scale: a user who stays anonymous for many photos can exceed the
browser `localStorage` quota and lose data during the fallback.

The implemented fallback keeps photo bytes out of `localStorage`:

1. Record only the anonymous Storage paths before signing out of the anonymous
   session. At this moment the anonymous session is still alive, so the client
   first creates a short-lived transfer intent with
   `/api/account/transfer-intent`.
2. Sign in to the existing Google account.
3. Call `/api/account/copy-anonymous-storage` with the new account's access
   token and the transfer nonce. The route derives the target user from the
   token; the client cannot choose another target uid.
4. The route verifies that the nonce is valid, unused, not expired, and belongs
   to the same anonymous uid. This proves the user controlled the anonymous
   session, not merely that they saw a `storage:` path from a delivered photo.
5. The route copies only objects included in the intent's path list and whose
   first path segment matches the anonymous uid. It does not delete the
   anonymous originals.
6. The client rewrites local `storage:` references to the copied paths.

Completed transfer intents are one-time across users, but idempotent for the
same target account: if the browser crashes after the copy succeeds but before
local references are rewritten, a retry by the same signed-in account returns
the saved mappings. A different account cannot reuse the nonce.

The copied path shape is
`{targetUserId}/anonymous-transfer/{anonymousUid}/...`. Signed URL
authorization treats any path under the signed-in user's first path segment as
owned by that user, so this path remains compatible with display and account
sync code that uses storage refs as opaque strings. Code that assumes
`{userId}/{catId}/sleeping/...` must not parse these copied fallback paths.

When the future 90-day anonymous cleanup runs, anonymous-era `cat_moments` rows
that still point at `{anonymousUid}/...` are expected to be cleaned together
with the old anonymous Storage objects. The copied existing-account paths are
separate user-owned objects and must not be removed by anonymous cleanup.

This is the accepted beta implementation. GA can revisit whether the copied
objects should also be deduped or garbage-collected after a longer retention
period.

## Rollout guard

`NEXT_PUBLIC_ANON_AUTH_ENABLED=true` is required before this path activates.
Supabase Anonymous sign-ins must also be enabled in the Supabase dashboard.

Production must not enable the flag until all of the following are true:

- Q6 has been manually verified with two real browsers: browser A creates the
  anonymous session, browser B redeems the handoff, and both A-then-B and B-then-A
  refresh/orderings keep the redeemed browser usable.
- Supabase refresh-token reuse interval/settings have been recorded.
- Q9 has been answered and the Google identity conflict path falls back to an
  existing-account login without showing a dead error page.
- Anonymous Storage references are server-copied and rewritten before the
  anonymous uid is considered safely merged into an existing Google uid.
- Server copy requires a short-lived transfer nonce created while the anonymous
  session is still active.
- Supabase Anonymous sign-ins are enabled.
- Turnstile/CAPTCHA settings are in place or an explicit decision is recorded
  to launch the flag without CAPTCHA.

## Not implemented in this slice

- Turnstile CAPTCHA plumbing for anonymous sign-in.
- A 90-day cleanup job for inactive anonymous auth users.
- A dedicated conflict UI for `linkIdentity()` when the Google identity already
  belongs to another account. The technical fallback exists, but no separate
  explanatory UI exists yet.
- RLS policy rewrites. Existing authenticated uid-scoped storage policies already
  cover anonymous users because they are authenticated users with an auth uid.

## Checks before enabling

- Confirm Supabase Anonymous sign-ins are enabled.
- Confirm Storage policy uses `auth.uid()` folder ownership.
- Confirm handoff restore succeeds across two real browsers with the same uid.
- Confirm Q6 refresh-token handoff behavior manually before enabling production.
- Confirm Google link works for a new Google identity.
- Confirm existing Google identity conflict falls back to the current account
  and copies anonymous Storage references without expanding them to `data:` URLs.
