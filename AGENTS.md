# AGENTS.md

## Project Goal

This repository implements `ねてるねこ`, a quiet Web/PWA where a user leaves one cat sleeping photo, receives four server-selected sleeping cats around 8pm, and chooses one ねこだより to keep.

The core product model is:

- Take or choose one sleeping photo.
- Keep the user's own photo locally and, when account sync is enabled, in the user's account.
- Share only the server-selected delivery flow through `/api/sleeping-delivery/exchange`.
- Deliver four sleeping-cat candidates as the evening ねこだより.
- Let the user choose one to keep; choosing none is also valid.
- Grow the user's own-cat record without requiring a separate organizing task.

The user's own cat is the product center. The four-cat exchange is the reason to return, not the final purpose. The app should feel calm, private, and small. Avoid adding loud engagement loops, feed-like browsing, public galleries, task-management burdens, or growth mechanics.

## Permanent Rules (owner-approved 2026-07-07)

These rules are permanent. Specs do not restate them. If a spec or doc conflicts with this section, this section wins; report the conflict instead of silently resolving it.

### Vocabulary lock (user-facing copy)

- Use: `ねがお` / `ねがおを とる` / `ねこだより` / `とどく` / `ひらく` / `たば` (hiragana forms).
- `ねこだより` names both the arriving letter and the small received photo that remains after opening. `たば` names the collection of received ねこだより (owner decision 2026-07-07, successor wording to the banned 切手). Do not invent new nouns for these.
- Never use `切手` at any layer — user copy, spec wording, aria-labels, or metaphors behind component names. The receiving-world motifs are 封蝋 (wax seal) and 便箋 (stationery).
- Never use `手紙` / `おてがみ` in user-facing copy. The name is `ねこだより`. Envelope, wax seal, and stationery exist only as visuals of the opening gesture and are not named in copy.
- Never use SNS vocabulary: いいね, フォロワー, ランキング, ストリーク, 連続記録, ポイント, ランク, 達成.
- Never use `一生` or words evoking a cat's death (最期, 見送る, 虹の橋, 天国, etc.) anywhere in the product or its communications.
- Time notation in user-facing copy is `よる8時` (not `よる8じ`, not `夜8時`).

### Product principles (immutable)

- Give-to-receive: taking today's ねがお is what brings tonight's ねこだより. A day without taking simply has no letter tonight — never stage punishment, streak loss, or guilt, and never empty the home screen to pressure the user.
- Originals are never hostages: viewing one's own photos and received ねこだより stays free after cancellation. Never build a reduced storage plan.
- The daily exchange (receiving ねこだより) stays free forever.
- No loss-aversion copy ("消えてしまいます" etc.) and no retention dialogs.

### Billing rules (owner decisions 2026-07-06 and latest 2026-07-23)

- During beta, payment is support (応援) with no feature differences; the beta-supporter page copy is canonical.
- Post-launch business validation targets a separate digital plan at ¥980 (tax included) per household, but the paying user, paid value, and entitlement bundle are UNDECIDED.
- Family sharing, no per-cat surcharge for a household, digital booklets/albums, PDF export, exchange enhancements, and automatic photo insights are hypotheses, not approved promises.
- The daily exchange, the user's originals, kept ねこだより, cat-specific photo lists, and existing year views stay free. Existing cats, originals, and kept ねこだより must never be hidden or locked.
- Physical products may be tested later as optional, separately priced offers. They are not the substitute for proving digital recurring value and must not be promised before vendor, margin, and operations validation.
- Paid-plan prototypes are owner-facing internal hypothesis artifacts. They are not customer-facing price pages, applications, reservations, votes, or evidence that a plan will ship.
- Do not build live checkout, terms changes, production entitlements, or paid-plan data architecture until one concrete value experience and ¥980 willingness are separately validated and the owner approves release readiness.

### Fixed values

- Delivery: daily 20:00 JST. Exchange opens at server time 19:55:00 (5-minute tolerance). Moderation cutoff is 19:55; the review-schedule canon is `docs/MODERATION-CANON.md` §4.
- Beta-supporter price: ¥1,500 (tax excluded) = ¥1,650 (tax included) per month.
- Post-launch digital-plan validation target: ¥980 (tax included) per household per month. This fixes the test price, not the contents.

### Operational discipline

- Migration always precedes code deploy (procedure canon: `docs/DEPLOY-CHECKLIST.md`).
- No deploys between 19:00 and 21:00 JST (review window + 20:00 delivery + opening time).
- Production data DELETE / bulk UPDATE / TRUNCATE / DDL / data moves require prior report and approval (procedure canon: `docs/PROD-OPERATIONS.md`). Only read-only SQL is allowed before approval.
- History rewrite (reset/rebase/amend) is allowed only for unpushed commits. Never rewrite pushed history.

### Document priority

- Canon priority follows `docs/BRAND-GUIDELINE.md` §10, which includes this file.

### Reporting rule

- Every completion report must attach evidence per change: a grep of the changed lines, or the name of the test that verifies the behavior.

## Tech Stack

- Next.js App Router
- TypeScript
- Supabase
- Vercel
- Browser localStorage as the primary MVP client store
- Optional account sync for persistence across installs/devices

`public/sw.js` is an active Service Worker. It provides the offline fallback and, when `NEXT_PUBLIC_ENABLE_SW_IMAGE_CACHE=true`, caches signed photo responses through the photo cache controller.
Photo SW cache purges are wired for own-photo deletion, cat-gallery photo deletion, reported/hidden photos, logout, account deletion, account switch, and feature-disabled transitions. Do not assume push notification handling exists.

## Product Principles

- The home screen answers three questions only:
  - What do I do now? The two-slot desk model: today's frame + night's letter.
  - How far did today progress? The state of those two slots.
  - Am I alone? Quiet presence line.
- The current home v3 model has no standalone heading, no central camera button, and no separate day-cycle motif.
- Night delivery is centered around the 8pm letter model.
- Do not expose the delivery pool directly to the browser. Use server APIs for selection.
- Do not turn the beta-supporter payment into functional restrictions. Supporter copy may explain what support helps sustain, but beta core features remain available.
- Write user-facing copy in natural Japanese. `ねてるねこ` user-facing screens intentionally use a quiet, hiragana-forward voice; settings, legal, diagnostics, and admin surfaces should stay clearer and less childlike.
- The design reference is 日とと記 (`diary.aaaaaso.com`): colorless quiet, serif + tracking, buttons as words, at most one filled surface per screen, and specialness made by copy and spacing rather than decoration. Use paper and ink only; photos carry color.

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
