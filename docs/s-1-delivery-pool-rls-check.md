# S-1 delivery pool RLS check

## Purpose

`cat_moments` delivery pool rows must not be directly enumerable from the browser anon key.
Sleeping-photo delivery should use `/api/sleeping-delivery/exchange`, which performs server-side pool selection.

## Manual verification

After applying `20260611173000_revoke_anon_cat_moments_select.sql` in Supabase:

1. Use the public anon key, not the service role key.
2. Run a direct REST or Supabase client select against `public.cat_moments`.
3. Verify the result is either a permission error or zero readable rows.
4. Run the normal app delivery flow and verify `/api/sleeping-delivery/exchange` still returns a delivery response.

Example browser-console shape:

```ts
const { data, error } = await supabase
  .from("cat_moments")
  .select("id")
  .limit(1);

console.log({ data, error });
```

Expected result:

- `error` is present due to RLS/permission denial, or
- `data` is an empty array.

Any readable row from anon direct select means S-1 is still open.

