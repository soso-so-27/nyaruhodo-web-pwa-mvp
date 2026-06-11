# AGENTS.md

## Project Goal

This repository implements `ねてるねこ`, a quiet Web/PWA where a user takes a cat sleeping photo, leaves it with the app, and receives another sleeping photo around 8pm.

The core product model is:

- Take a sleeping photo.
- Keep the user's own photo locally and, when account sync is enabled, in the user's account.
- Share only the server-selected delivery flow through `/api/sleeping-delivery/exchange`.
- Deliver one sleeping photo as a small evening letter.
- Let the user keep the delivered photo in the album.

The app should feel calm, private, and small. Avoid adding loud engagement loops, feed-like browsing, public galleries, or growth mechanics.

## Tech Stack

- Next.js App Router
- TypeScript
- Supabase
- Vercel
- Browser localStorage as the primary MVP client store
- Optional account sync for persistence across installs/devices

There is currently no Service Worker. The PWA is manifest-only, so do not assume offline support or push notification handling exists.

## Product Principles

- The home screen answers three questions only:
  - What do I do now? Heading + camera button.
  - How far did today progress? Day-cycle motif.
  - Am I alone? Quiet presence line.
- Night delivery is centered around the 8pm letter model.
- Do not expose the delivery pool directly to the browser. Use server APIs for selection.
- Do not turn supporter/payment features into functional restrictions. Supporter copy may explain what support helps sustain, but core features remain available.
- Write user-facing copy in natural Japanese. Do not over-hiraganize text unless the specific screen intentionally uses a childlike voice.

## Data And Privacy Rules

- Photos are sensitive. Treat every photo URL, data URL, storage path, and signed URL as private unless the current flow explicitly shares it into the delivery pool.
- Browser anon clients must not directly read the shared delivery pool from `cat_moments`.
- Delivery selection must go through `/api/sleeping-delivery/exchange`.
- Do not reintroduce `/api/sleeping-delivery/candidate` or any direct browser-readable candidate route.
- Account data must remain scoped to the authenticated user's own rows through RLS.
- Avoid adding destructive delete actions to ordinary settings unless the product explicitly asks for them again.

## Supabase Rules

- Browser/client Supabase access is acceptable only for authenticated self-owned data, anon inserts explicitly covered by RLS, or storage operations covered by the bucket policy.
- Server-side delivery/admin/billing routes may use server/admin clients where the route performs its own validation and privacy filtering.
- Before running remote DB operations, migrations, RLS changes, SQL scripts, or destructive data operations, ask the user for confirmation.
- Never run `supabase db reset`.

## Architecture Rules

- Keep domain logic in `src/lib` or focused helper modules, not inside large UI components when it can be reasonably separated.
- Keep UI components aligned with existing app patterns before adding new abstractions.
- Prefer existing storage keys/constants over hard-coded localStorage strings.
- If a test seeds app state, prefer shared helpers/constants so key renames fail loudly.

## Testing Rules

- Time-sensitive behavior must be tested with fixed clocks or explicit time overrides.
- Delivery flow tests should cover `/api/sleeping-delivery/exchange`, not removed candidate routes.
- Security/privacy changes need API-level tests where possible, plus a documented manual verification step when a live Supabase policy must be checked.
- Before release, run `npm run build` and at least one full E2E pass. For public release candidates, also run one E2E pass against `next start`.

## Change Management

- Keep important product, privacy, schema, RLS, and architecture decisions documented in `docs/decisions.md` or a focused doc.
- Leave historical migrations intact; add new migrations for DB/RLS changes.
- Do not commit generated review bundles under `artifacts/`.
