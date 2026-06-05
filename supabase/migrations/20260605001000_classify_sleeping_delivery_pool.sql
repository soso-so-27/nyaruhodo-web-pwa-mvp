update public.cat_moments
set metadata = jsonb_set(metadata, '{pool_kind}', '"admin_stock"', true)
where visibility = 'shared'
  and delivery_status = 'available'
  and metadata->>'pool_kind' is null
  and (
    anonymous_id = 'admin-stock'
    or local_cat_id = 'admin-stock'
    or owner_cat_id = 'admin-stock'
    or metadata->>'source' = 'admin-stock'
    or local_moment_id like 'stock-sleeping-%'
  );

update public.cat_moments
set metadata = jsonb_set(metadata, '{pool_kind}', '"user_shared"', true)
where visibility = 'shared'
  and delivery_status = 'available'
  and metadata->>'pool_kind' is null;
