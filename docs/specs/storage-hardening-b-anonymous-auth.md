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
- Anonymous users are not treated as a completed Google/account connection on
  `/account/create`.

## Rollout guard

`NEXT_PUBLIC_ANON_AUTH_ENABLED=true` is required before this path activates.
Supabase Anonymous sign-ins must also be enabled in the Supabase dashboard.

## Not implemented in this slice

- Turnstile CAPTCHA plumbing for anonymous sign-in.
- A 90-day cleanup job for inactive anonymous auth users.
- A dedicated conflict UI for `linkIdentity()` when the Google identity already
  belongs to another account.
- RLS policy rewrites. Existing authenticated uid-scoped storage policies already
  cover anonymous users because they are authenticated users with an auth uid.

## Checks before enabling

- Confirm Supabase Anonymous sign-ins are enabled.
- Confirm Storage policy uses `auth.uid()` folder ownership.
- Confirm handoff restore succeeds across two real browsers with the same uid.
- Confirm Google link works for a new Google identity.
- Confirm existing Google identity conflict falls back to the current account-sync path.
