-- subscriptions: billing checkout/status/portal APIs and Stripe webhook read/upsert/update subscription rows through the admin client.
grant select, insert, update on public.subscriptions to service_role;

-- app_events: /api/admin/analytics reads recent app event rows through the admin client.
grant select on public.app_events to service_role;

-- referral_codes/referral_claims: referral summary and claim APIs read existing rows and create missing code/claim rows through the admin client.
grant select, insert on public.referral_codes to service_role;
grant select, insert on public.referral_claims to service_role;

-- beta_participants: beta access checks read participant status, and referral claim can set invited_by through the admin client.
grant select, update on public.beta_participants to service_role;

-- beta_feedback: /api/beta/feedback inserts feedback rows through the admin client when service role is configured.
grant insert on public.beta_feedback to service_role;
