# Public Launch Readiness Inventory

Last updated: 2026-06-28

Scope: small Instagram launch for `https://nyaruhodo.jp/onboarding?source=instagram_story`.

Decision guide:

- P0: confirm or fix before posting publicly.
- P1: soon after launch or before widening traffic.
- P2: later product/ops improvement.

Do not put secrets, signed URLs, photo URLs, storage paths, cat names, emails, or location details in analytics, admin tables, screenshots, logs, or docs.

## 1. Onboarding

- Current state: `/onboarding` resolves the current state by the current onboarding progress, including late-night cases where the normal 8pm delivery target differs from the calendar day. `source` is attribution only. Instagram source changes do not reset state. Existing E2E covers repeated social URL visits, unknown source normalization, date rollover, and Instagram in-app browser home-install suppression.
- Risk: Instagram in-app browser can behave differently from Playwright; Google login may fail inside the in-app browser.
- Priority: P0.
- Current action: implemented and tested. Keep "later" escape path.
- Human confirmation: yes. Run the full URL in iPhone Instagram in-app browser.
- Related files: `src/components/onboarding/OnboardingFlow.tsx`, `src/lib/onboarding/progress.ts`, `tests/e2e/onboarding-delivery-flow.spec.ts`, `docs/instagram-launch-checklist.md`.

## 2. Photo Upload / Image Storage / Signed URL

- Current state: uploads are resized/re-encoded before storage; stored photos use storage paths and short-lived signed URL generation for display. The public UX should not expose signed URLs or storage paths.
- Risk: large images can still be heavy in Instagram browser. `toDataURL` can create memory pressure. Signed URL refresh failures can show image fallback.
- Priority: P0 for privacy and display confirmation, P1 for upload memory optimization.
- Current action: no large refactor. Privacy wording clarified. Display fallback already covered by onboarding E2E.
- Human confirmation: yes. Test a normal iPhone photo and one large image if possible.
- Related files: `src/lib/photoStorageClient.ts`, `src/lib/photoStorage.ts`, `src/components/ui/StoredPhotoImage.tsx`, `src/app/api/photo-storage/signed-url/route.ts`, `src/components/onboarding/OnboardingFlow.tsx`.

## 3. Anonymous Session / Google Login / Account

- Current state: anonymous onboarding can complete without login. Account creation is optional after opening the letter. Google failure has a "later" path.
- Risk: anonymous local state is browser-specific; Instagram browser and Safari/PWA may not share state. Google login in Instagram browser may be unstable.
- Priority: P0.
- Current action: no code change beyond legal copy and analytics events.
- Human confirmation: yes. Confirm Google failure does not trap the user and "later" returns to home.
- Related files: `src/app/account/create/page.tsx`, `src/lib/storage/keys.ts`, `src/lib/accountSync.ts`, `src/lib/supabase/server.ts`.

## 4. Cat Letter Exchange Logic

- Current state: onboarding delivery creates or falls back to a candidate while avoiding returning the same submitted photo where possible. Production test UI and placeholders are suppressed. Reports can move source moments out of the pool.
- Risk: low candidate stock can reduce the feeling of "a cat from somewhere arrived." Fallback candidates should stay high quality.
- Priority: P0 for production no-placeholder check, P1 for candidate stock monitoring.
- Current action: no DB change. Candidate shortage alert is P1.
- Human confirmation: yes. Verify at least one good candidate arrives in production.
- Related files: `src/app/api/sleeping-delivery/exchange/route.ts`, `src/lib/home/deliveryCandidates.ts`, `src/lib/home/sleepingPhotos.ts`, `src/components/onboarding/OnboardingFlow.tsx`.

## 5. Collection / Received / Sent

- Current state: onboarding delivered photos should remain visible in received collection; sent photos show the user's own sleeping photo. Received/sent tab views are tracked.
- Risk: if delivery save or signed URL lookup fails, user may see sent photo only and lose trust.
- Priority: P0.
- Current action: E2E for received fallback exists; analytics added for received tab.
- Human confirmation: yes. After Instagram test, confirm sent and received tabs show different expected photos.
- Related files: `src/components/collection/CollectionPage.tsx`, `src/lib/home/sleepingPhotos.ts`, `tests/e2e/onboarding-delivery-flow.spec.ts`.

## 6. Admin / Analytics

- Current state: `app_events` exists in Supabase. `/admin/analytics` page and API are guarded by `ADMIN_EMAILS`. API checks admin before service-role querying. Admin response shows counts and shortened IDs only.
- Risk: anon insert to `app_events` can be spammed. Admin data is empty until production users generate events. If env is missing, admin page/API show an error.
- Priority: P0 for guard and privacy, P1 for rate limiting/event whitelist.
- Current action: implemented. `app_error` capture added.
- Human confirmation: yes. Confirm admin can view; non-admin cannot; empty table does not crash; `source=instagram_story` appears.
- Related files: `src/app/admin/analytics/page.tsx`, `src/app/admin/analytics/AdminAnalyticsClient.tsx`, `src/app/api/admin/analytics/route.ts`, `src/lib/adminAccess.ts`, `supabase/migrations/20260628120000_create_app_events.sql`, `docs/analytics-kpi-inventory.md`.

## 7. Privacy / Terms / Contact

- Current state: `/privacy`, `/terms`, `/contact`, `/commercial-transactions`, and `/cancellation` exist. Settings links to legal/contact pages. Privacy now mentions anonymous ID, onboarding progress, app events, photo use, no automatic SNS publishing, deletion requests, and external services.
- Risk: formal contact method is still operationally weak if only the Instagram account is used. Legal text is a beta draft and should be reviewed by a human.
- Priority: P0.
- Current action: minimal legal copy updated.
- Human confirmation: yes. Decide final contact channel before posting wider than a small test.
- Related files: `src/components/legal/LegalPage.tsx`, `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/app/contact/page.tsx`, `src/components/settings/SettingsPage.tsx`.

## 8. Reports / Delete / Withdrawal

- Current state: delivered photos can be reported from home/collection; report API verifies actual delivered photos and deduplicates reports. Some local photo/cat deletion exists. Full account deletion is not automated.
- Risk: users may ask to delete a specific submitted photo or all account data. Manual operation may be needed.
- Priority: P0 for contact/deletion request wording, P1 for self-serve deletion.
- Current action: legal/contact copy clarified that deletion requests can be made through contact.
- Human confirmation: yes. Prepare a manual deletion response template.
- Related files: `src/app/api/reports/route.ts`, `src/components/collection/CollectionPage.tsx`, `src/components/home/HomeInput.tsx`, `src/components/cats/CatsPage.tsx`, `supabase/migrations/20260612093000_create_photo_reports.sql`, `supabase/migrations/20260628093000_harden_photo_reports.sql`.

## 9. Content Moderation

- Current state: report threshold can exclude source moments; admin/test panels can view moderation/report state when enabled. Terms prohibit non-cat, large person, sexual, violent, gory, rights-infringing, advertising, and spam content.
- Risk: first public traffic can receive bad content before enough reports arrive. No automated moderation is in place.
- Priority: P0 for prohibited-content wording, P1 for candidate management/moderation operations.
- Current action: terms wording expanded.
- Human confirmation: yes. Confirm admin can review reports and candidate pool before posting.
- Related files: `src/app/api/moderation/queue/route.ts`, `src/app/api/moderation/decide/route.ts`, `src/components/settings/SettingsPage.tsx`, `src/app/api/reports/route.ts`.

## 10. Vercel / Supabase / Cost

- Current state: Supabase Pro is in use. Vercel deployment to `main` triggers Production. Supabase migrations local/remote match through `20260628120000`. `cat-photos` bucket is created private by migration and storage object policies restrict users to own folders.
- Risk: Instagram traffic may increase Vercel/Supabase bandwidth, function, or egress. Human must confirm Supabase advisor, Vercel usage/spend notifications, and production alias.
- Priority: P0 for migration/production alias confirmation, P1 for cost guardrails.
- Current action: migration list confirmed. No dashboard changes performed.
- Human confirmation: yes. Check Vercel Production Ready, `nyaruhodo.jp` alias, Supabase Usage, Security Advisor, Performance Advisor, MFA, and spend notifications.
- Related files: `supabase/migrations/20260524190000_create_account_sync_tables.sql`, `supabase/migrations/20260628120000_create_app_events.sql`, `scripts/check-release-readiness.mjs`, `.env.example`.

## 11. Instagram In-App Browser / PWA

- Current state: Instagram in-app browser should not show PWA home install guide. PWA install prompt is not part of first onboarding. Manifest exists with standalone display.
- Risk: Instagram browser UI can reduce vertical space and affect photo picker/login behavior.
- Priority: P0 for Instagram onboarding test, P1/P2 for PWA install optimization.
- Current action: E2E covers install-guide suppression.
- Human confirmation: yes. Test in Instagram app, not only Safari/Chrome.
- Related files: `src/components/onboarding/OnboardingFlow.tsx`, `src/app/manifest.ts`, `tests/e2e/onboarding-delivery-flow.spec.ts`.

## 12. Error Monitoring / Rollback / Pause

- Current state: analytics records `app_error`, `photo_upload_error`, and key funnel events. Vercel deployment rollback can be used manually. Existing flags include `ENABLE_TEST_TOOLS`, `ENABLE_STOCK_ADMIN`, and `ENABLE_BETA_SUPPORTER_BILLING`.
- Risk: there is no single public kill switch for onboarding, photo submission, or delivery. Error instrumentation is still lightweight.
- Priority: P0 for manual rollback readiness, P1 for feature flags.
- Current action: `app_error` browser capture added. No kill switch added to avoid broad behavior change.
- Human confirmation: yes. Know where to redeploy/rollback in Vercel.
- Related files: `src/components/analytics/AppAnalyticsTracker.tsx`, `src/lib/adminAccess.ts`, `src/lib/billing/stripe.ts`, `docs/instagram-launch-checklist.md`.

## 13. Billing / Beta Supporter

- Current state: beta supporter billing is gated by `ENABLE_BETA_SUPPORTER_BILLING`. Stripe routes exist; settings/beta pages link to terms/privacy/contact/cancellation.
- Risk: accidental checkout visibility if env is enabled unexpectedly. Billing copy and legal display should be verified by a human.
- Priority: P0 if checkout is visible in production, otherwise P1.
- Current action: no billing setting changes.
- Human confirmation: yes. Confirm intended `ENABLE_BETA_SUPPORTER_BILLING` state before Instagram post.
- Related files: `src/app/beta-supporter/page.tsx`, `src/lib/billing/stripe.ts`, `src/app/api/billing/create-checkout-session/route.ts`, `src/app/api/stripe/webhook/route.ts`.

## 14. Post-Launch Operations

- Current state: analytics dashboard can show funnel and source breakdown. Existing launch checklist covers Instagram browser flow.
- Risk: without a daily review rhythm, issues may be missed. Manual deletion/report handling needs an owner.
- Priority: P1.
- Current action: no product change.
- Human confirmation: yes. Set a post-launch review time after the first Story.
- Related files: `docs/instagram-launch-checklist.md`, `docs/analytics-kpi-inventory.md`, `docs/public-launch-readiness-inventory.md`.

## P0 Checklist Before Posting

- [ ] Vercel Production is Ready.
- [ ] `nyaruhodo.jp` points to the latest Production deployment.
- [ ] Supabase migrations Local/Remote match, including `20260628120000`.
- [ ] `/privacy`, `/terms`, `/contact` open from Settings.
- [ ] `/admin/analytics` opens for admin and does not expose sensitive values.
- [ ] Non-admin cannot view `/admin/analytics` data.
- [ ] Instagram in-app browser flow works: intro -> photo -> arrived -> opened -> account prompt -> later/home.
- [ ] `source=instagram_story` appears in `app_events`/admin analytics.
- [ ] Sent tab shows the submitted photo; received tab shows the delivered cat letter.
- [ ] No PWA install guide appears in Instagram in-app browser.
- [ ] Candidate/fallback photo quality is acceptable.
- [ ] Human has a deletion/contact response path ready.

## P1 TODO

- Add self-serve photo deletion for all submitted/delivered states.
- Add account deletion or structured deletion request flow.
- Add candidate photo management and candidate shortage alert.
- Add `app_events` rate limit, event-name whitelist, metadata size limit, and retention/pruning.
- Expand `signed_url_error`, `delivery_error`, and `photo_compress_error` instrumentation.
- Move image upload processing from `toDataURL` toward `toBlob`.
- Add public pause flags: `NEXT_PUBLIC_ENABLE_ONBOARDING`, `NEXT_PUBLIC_ENABLE_PHOTO_SUBMISSION`, `NEXT_PUBLIC_ENABLE_BETA_SUPPORTER`.
- Create an Instagram post-launch review template.

## P2 TODO

- Optimize PWA home-screen prompt timing.
- Add notification permissions and delivery reminders.
- Add A/B testing for onboarding copy.
- Improve beta supporter conversion experience.
- Explore rescue-cat collaboration.
- Add monthly summaries.
- Add custom email/form support.
- Add external monitoring/alerting.
- Add automated moderation.
