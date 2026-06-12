# ねてるねこ Design Canon

Last updated: 2026-06-12

This file is the design source of truth for future UI work. Before changing UI, copy, motion, navigation, product surface hierarchy, or design tokens, compare the change against this file and record any intentional deviation in the PR or task report.

## 0. Inventory

The repository was scanned for:

- `AGENTS.md`
- root `README*`
- every file under `docs/`
- design/concept/worldview/product-principle comments in `src/`, `tests/`, and `scripts/`
- mentions of `日とと記`, `日とと`, `ひととき`, `hitotoki`, and related spellings

Result:

- Root `README*`: none found.
- Design/concept comments in source: no substantive design-canon comments found. Source imports design-token helpers and contains implementation comments, but no independent product canon.
- Previous repository-local text did not say that the app is based on 日とと記.
- Related historical reference: `docs/open-beta-release-checklist.md` contains the branch-name reference `codex/hitotoki-exchange`; that line alone is not a design-canon statement.
- Owner decision on 2026-06-12 now establishes 日とと記 as the design reference. See section 1.

## 1. Design Reference

Owner decision:

> ねてるねこのデザイン参照は「日とと記」(diary.aaaaaso.com)。
> 色のない静けさ / 明朝+字間 / ボタンは文字 / 塗りは1画面1つまで / 特別感は言葉と間で作る、を借りる。
> エネルギー(賑やかさ)は借りない。
> 決定: 中西壮野 2026-06-12

Operational reading:

- The app should feel like paper and ink before it feels like an app surface.
- Color is carried by photos, not by UI chrome.
- UI may use one deep color only: `--seal`, for the wax-seal point and destructive/action warning text. Do not use it as a filled surface.
- Use serif + tracking for labels, dates, and button text. Use sans-serif for practical body copy such as settings explanations.
- Buttons are mostly words or thin-line paper pills. Filled buttons are exceptional and limited to one per screen.

Attached token canon:

- `docs/design/neteruneko-design-tokens-v2.md`
- `src/app/tokens.css`

## 1.1 Home State 2: Daylight And One Evening Line

Owner decision, 2026-06-12:

- The state2 letter/envelope does not fill, swell, grow, pulse, shimmer, or otherwise change with time.
- Time is expressed only through the whole-home ambient paper gradient.
- From 17:00 through 19:59 JST, state2 shows one line below the letter: `もうすぐ、とどく`.
- This line is not guidance copy and must not pass through `shouldShowGuidanceCopy()`.
- Before 17:00, the letter may answer a tap with the temporary `よる8じごろ` hint. From 17:00 onward that tap hint is disabled.
- At 20:00 the existing state3 sealed-letter/opening behavior takes over.

This section supersedes older desk-model prototype and brief text that described state2 letter filling, growing, waterline shimmer, or plump-envelope behavior.

## 2. Canon Priority

When documents conflict, use this order:

1. This file, `docs/design/DESIGN-CANON.md`.
2. `docs/design/neteruneko-design-tokens-v2.md` and `src/app/tokens.css` for visual tokens.
3. `AGENTS.md` for current product, privacy, data, architecture, and testing principles.
4. `docs/design/neteruneko-design-brief.md` and `docs/design/neteruneko-home-v3-desk-model.html` for the home v3 desk model.
5. `docs/decisions.md` for historical product and UI decisions, unless superseded by 1-4.
6. Focused current docs such as `docs/app-role-map.md`, `docs/dev-rules.md`, `docs/open-beta-release-checklist.md`, and `docs/2026-06-11-delivery-incident-postmortem.md`.
7. Older `にゃるほど` / diagnosis / pose-zukan / monetization docs are reference history. They are not allowed to override the sleeping-photo evening-letter model.

## 3. Repository Source Index

### Current Core Canon

- `AGENTS.md`: current project goal, product principles, privacy rules, Supabase boundaries, architecture rules, testing rules, and change-management expectations.
- `docs/design/DESIGN-CANON.md`: current design source of truth.
- `docs/design/neteruneko-design-tokens-v2.md`: paper-and-ink token rules.
- `docs/design/neteruneko-design-brief.md`: home redesign brief and fixed design decisions for the desk model. Verified as UTF-8 readable via Node on 2026-06-12.
- `docs/design/neteruneko-home-v3-desk-model.html`: home v3 visual prototype/reference. Verified as UTF-8 readable via Node on 2026-06-12.
- `docs/design/open-sound-candidates.md`: open-sound candidate list; supporting design asset note, not broad canon.
- `docs/2026-06-11-delivery-incident-postmortem.md`: delivery incident learnings, performance expectations, and storage-reference follow-up.
- `docs/app-role-map.md`: route roles and placement rules.
- `docs/dev-rules.md`: implementation order and quiet paper-like UI direction. It contains older terminology and should defer to `AGENTS.md` and this file where the product has moved on.
- `docs/open-beta-release-checklist.md`: release and real-device QA checklist.
- `docs/s-1-delivery-pool-rls-check.md`: manual RLS verification note for delivery pool privacy.

### Product/Data/Operations References

- `docs/account-db-sync-design.md`
- `docs/account-sharing-db-ux-plan.md`
- `docs/analytics-event-design.md`
- `docs/analytics-reporting-queries.md`
- `docs/analytics-reporting-views.md`
- `docs/custom-domain-rollout.md`
- `docs/db-schema.md`
- `docs/evening-delivery-beta-notes.md`
- `docs/logic-spec.md`
- `docs/monetization-design-memo.md`

### Historical / Legacy Product Documents

These are useful context, but they mostly describe earlier `にゃるほど`, diagnosis, collection, pose-zukan, or monetization directions. Do not let them silently pull the current app away from `ねてるねこ`.

- `docs/cat-avatar-generation-ux-plan.md`
- `docs/collection-completion-plan.md`
- `docs/collection-share-feed-design.md`
- `docs/design-direction-prep.md`
- `docs/diagnosis-onboarding-data-alignment.md`
- `docs/diagnosis-onboarding-questions.md`
- `docs/diagnosis-onboarding-usage-audit.md`
- `docs/mvp-current-spec.md`
- `docs/mvp-ux-review.md`
- `docs/mvp-v0.2.1-test-guide.md`
- `docs/mvp-v0.2.3-current-state.md`
- `docs/mvp-v0.2.3-test-plan.md`
- `docs/mvp-validation-v0.2.md`
- `docs/navigation-collection-restructure.md`
- `docs/open-beta-qa-checklist.md`
- `docs/pose-zukan-category-and-wireframe-v1.md`
- `docs/pose-zukan-product-direction.md`
- `docs/product-spec.md`
- `docs/together-tab-pose-zukan-redesign.md`
- `docs/ui-spec.md`
- `docs/uiux-value-audit-2026-05-25.md`
- `docs/ux-risk-detection-framework.md`
- `docs/ux-scenario-copy-audit.md`

## 4. Canon Quotes

### From `AGENTS.md`

Current product model:

> This repository implements `ねてるねこ`, a quiet Web/PWA where a user takes a cat sleeping photo, leaves it with the app, and receives another sleeping photo around 8pm.

Core loop:

> Take a sleeping photo.
> Keep the user's own photo locally and, when account sync is enabled, in the user's account.
> Share only the server-selected delivery flow through `/api/sleeping-delivery/exchange`.
> Deliver one sleeping photo as a small evening letter.
> Let the user keep the delivered photo in the album.

Product tone:

> The app should feel calm, private, and small. Avoid adding loud engagement loops, feed-like browsing, public galleries, or growth mechanics.

Copy principle:

> Write user-facing copy in natural Japanese. Do not over-hiraganize text unless the specific screen intentionally uses a childlike voice.

ねてるねこ copy exception:

- User-facing `ねてるねこ` screens intentionally use a quiet, hiragana-forward voice. This is the explicit-design exception allowed by the AGENTS copy principle.
- Do not over-apply this voice to settings, legal, diagnostics, or admin surfaces where clarity matters more.

Privacy boundary:

> Photos are sensitive. Treat every photo URL, data URL, storage path, and signed URL as private unless the current flow explicitly shares it into the delivery pool.

Delivery pool boundary:

> Browser anon clients must not directly read the shared delivery pool from `cat_moments`.
> Delivery selection must go through `/api/sleeping-delivery/exchange`.

## 5. Five Principles

These are the current design principles for `ねてるねこ`.

1. 色のない静けさ。
   UI chrome is paper and ink only. No rose surfaces, no colored cards, no colorful buttons. Photos carry color.

2. 明朝+字間で特別感を作る。
   Labels, dates, and button text use serif type with tracking. Avoid heavy weights; emphasis comes from spacing, position, and silence.

3. ボタンは文字。
   Most actions should read as words or thin-line paper pills. A filled action is rare and limited to one per screen.

4. 8時の手紙がプロダクトモデル。
   The product is a small exchange: leave one sleeping photo, receive one evening letter. Do not replace this with feed, gallery, growth, or public-browsing mechanics.

5. 紙とインクのみ。色は写真が運ぶ。
   `--seal` is the only deep UI color, used for wax-seal points and destructive/action warning text only. No beige time ramps, no rose delivery surfaces, and no colored UI fills.

## 6. UI Change Self-Check

Every future UI PR or task report should answer:

- Which canon document did this change touch?
- Does it preserve the 8pm letter model?
- Does it preserve the desk model: two slots, today's frame + night's letter + quiet presence line?
- Does it avoid loud engagement, public-feed, or gallery mechanics?
- Does it keep photos/private paths/signed URLs protected?
- Does it use `src/app/tokens.css` instead of raw component-local color, shadow, radius, and easing values?
- Does it avoid colored surfaces outside photos?
- Is `--seal` limited to wax-seal points and destructive/action warning text?
- Are labels/dates/button text serif + tracked, with no unnecessary bold?
- Does it respect `prefers-reduced-motion`?
- Does it keep user-facing copy quiet and hiragana-forward where appropriate, while keeping settings/legal/admin clear?
- If it changes delivery-adjacent UI, did it avoid coupling presentation changes to delivery detection logic?

## 7. Known Cleanup Needed

- Continue token v2 sweep beyond the first implementation pass.
- Separate current `ねてるねこ` canon from historical `にゃるほど` diagnosis documents more explicitly.
- Keep `docs/design/neteruneko-design-brief.md` and `docs/design/neteruneko-home-v3-desk-model.html` UTF-8 readable; terminal mojibake alone is not evidence of file corruption.
