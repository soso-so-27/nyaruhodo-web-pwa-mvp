# Service Role / RLS Inventory 2026-07-02

This document records the local Supabase state after applying:

- `20260702114500_grant_service_role_cat_moment_tables.sql`
- `20260702115500_grant_service_role_photo_reports.sql`
- `20260702120000_grant_service_role_api_tables.sql`

All listed app tables have RLS enabled. The service role bypasses RLS, but PostgREST still needs table grants. A table with only `REFERENCES, TRIGGER, TRUNCATE` does not have normal API read/write grants for `SELECT`, `INSERT`, `UPDATE`, or `DELETE`.

## Actual service_role grants

| Table | RLS | Current service_role grants | API usage found | Assessment |
| --- | --- | --- | --- | --- |
| `cat_moments` | enabled | `SELECT, INSERT, UPDATE, DELETE` | sleeping delivery exchange/backup/stock/diagnostics, moderation queue/decide, reports auto-exclude, presence | OK after `20260702114500` |
| `cat_moment_deliveries` | enabled | `SELECT, INSERT, UPDATE, DELETE` | exchange delivery creation/read, signed URL authorization, reports delivered-target verification | OK after `20260702114500` |
| `cat_moment_cats` | enabled | no normal read/write grants | account sync reads via user Supabase client | No immediate service_role API need found |
| `collection_photos` | enabled | no normal read/write grants | account sync reads/writes via user Supabase client | No immediate service_role API need found |
| `cats` | enabled | no normal read/write grants | account sync reads/writes via user Supabase client | No immediate service_role API need found |
| `record_logs` | enabled | no normal read/write grants | account sync reads/writes via user Supabase client | No immediate service_role API need found |
| `photo_reports` | enabled | `SELECT, INSERT` | `/api/reports` GET/POST, duplicate check, report count | OK for product API after `20260702115500`; `DELETE` is still not granted and is only used by local E2E cleanup |
| `subscriptions` | enabled | `SELECT, INSERT, UPDATE` | billing checkout/status/portal APIs and Stripe webhook read/upsert/update subscription rows through the admin client | OK after `20260702120000` |
| `app_events` | enabled | `SELECT` | `/api/admin/analytics` reads recent app event rows through the admin client; product analytics insertion uses browser/client path | OK after `20260702120000` for admin analytics |
| `referral_codes` | enabled | `SELECT, INSERT` | referral summary and claim APIs read existing codes and create missing code rows through the admin client | OK after `20260702120000` |
| `referral_claims` | enabled | `SELECT, INSERT` | referral summary and claim APIs read existing claims and create claim rows through the admin client | OK after `20260702120000` |
| `beta_feedback` | enabled | `INSERT` | `/api/beta/feedback` inserts feedback rows through the admin client when service role is configured | OK after `20260702120000` |
| `beta_participants` | enabled | `SELECT, UPDATE` | beta access checks read participant status; referral claim can update `invited_by` | OK after `20260702120000` |

## Fixed in this change

`photo_reports` was missing service role table grants after the table was hardened:

- `SELECT` is required by `/api/reports` GET, duplicate report lookup, and distinct reporter counting.
- `INSERT` is required by `/api/reports` POST.
- `UPDATE` is not used on `photo_reports`.
- `DELETE` is not used by product API; local E2E cleanup calls it but does not require it for product behavior.

Migration added:

```sql
grant select, insert on public.photo_reports to service_role;
```

Verification:

- Before fix, delivered report API returned HTTP 200 with `{ "ok": false }`.
- Direct service-role access failed with `42501 permission denied for table photo_reports`.
- After fix, targeted E2E `accepts only delivered photo reports and counts distinct reporters` passed and exercises `/api/reports` POST returning `{ ok: true }`.

## Candidate follow-up grants applied in `20260702120000`

The following omissions were applied after review because the current API paths use `createSupabaseAdminClient()`.

| Area | Tables | Likely grants |
| --- | --- | --- |
| Billing / Stripe webhook / portal | `subscriptions` | `SELECT, INSERT, UPDATE` |
| Admin analytics | `app_events` | `SELECT` |
| Referrals | `referral_codes`, `referral_claims`, `beta_participants` | `referral_codes`: `SELECT, INSERT`; `referral_claims`: `SELECT, INSERT`; `beta_participants`: `UPDATE` |
| Beta access / feedback | `beta_participants`, `beta_feedback` | `beta_participants`: `SELECT`; `beta_feedback`: `INSERT` |

## Omoide bunbako investigation

Observed failing path:

1. Home creates an arrived memory via `ensureOmoideMemoryArrival()`.
2. Clicking `data-testid="omoide-arrival-letter"` calls `onOpenOmoideMemory?.(memory)` and then navigates to `/cats#omoide`.
3. `HomeInput` handles `onOpenOmoideMemory` by calling `markOmoideMemoryOpened(memory.id, homeNow)`.
4. `markOmoideMemoryOpened()` writes the memory back to `neteruneko_omoide_memories` with `openedAt`.

Conclusion for persistence:

- The real data path does write the opened memory; this does not appear to be a missing write.

Where it is cut:

- `CatsPage` reads memories with `readOmoideMemoriesForCat(activeCatId)`.
- `activeSection` defaults to `record`, so `/cats#omoide` is not obviously blocked by the tab state.
- `OmoideBunbako` is defined with `data-testid="omoide-bunbako"`, but there is no `<OmoideBunbako ...>` call site in `CatsPage`.
- The legacy detail sections are also disabled by `SHOW_LEGACY_DETAIL_SECTIONS = false`.

Classification:

- Product bug / implementation drift.
- The opened memory is persisted, but the specific bunbako UI expected by the E2E is no longer mounted in the current `CatsPage` tree.

No omoide code was changed in this pass.
