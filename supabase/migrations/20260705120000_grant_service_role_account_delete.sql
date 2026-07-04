-- /api/account/delete-stored-data uses the service-role admin client to remove
-- account-owned records after deriving the target user from the authenticated
-- bearer token. Delivered recipient records are preserved separately.
grant select, delete on public.cat_moment_cats to service_role;
grant select, delete on public.cat_moment_deliveries to service_role;
grant select, delete on public.cat_moments to service_role;
grant select, delete on public.collection_photos to service_role;
grant select, delete on public.photo_reports to service_role;
grant select, delete on public.record_logs to service_role;
grant select, delete on public.subscriptions to service_role;
grant select, delete on public.app_events to service_role;
grant select, delete on public.referral_claims to service_role;
grant select, delete on public.referral_codes to service_role;
grant select, delete on public.beta_feedback to service_role;
grant select, delete on public.account_sync_state to service_role;
grant select, delete on public.cats to service_role;
