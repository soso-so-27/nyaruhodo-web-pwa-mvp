-- Account deletion API explicitly removes these account-owned rows through the
-- service-role admin client. Client-side access remains governed by RLS.
grant select, delete on public.account_local_state to service_role;
grant select, delete on public.product_analytics_events to service_role;
grant select, delete on public.mikke_window_answers to service_role;
grant select, delete on public.profiles to service_role;
