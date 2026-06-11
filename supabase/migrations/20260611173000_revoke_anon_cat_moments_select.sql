-- Close direct anonymous reads of the sleeping delivery pool.
-- Delivery selection now goes through /api/sleeping-delivery/exchange.

drop policy if exists "cat_moments_select_shared_available" on public.cat_moments;

revoke select on public.cat_moments from anon;

