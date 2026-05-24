# Custom Domain Rollout

Last updated: 2026-05-24

Primary domain:

- `https://nyaruhodo.jp`

Keep the Vercel domain available as a fallback during the transition:

- `https://nyaruhodo-web-pwa-mvp.vercel.app`

## 1. DNS

In Xserver Domain:

- Nameservers: `ns1.xdomain.ne.jp`, `ns2.xdomain.ne.jp`, `ns3.xdomain.ne.jp`
- Root record: `A @ 216.198.79.1`

In Vercel:

- Add `nyaruhodo.jp` to the production project.
- Wait until the domain shows `Valid Configuration`.

## 2. Vercel Environment Variables

After the Vercel domain is valid, update production:

```txt
NEXT_PUBLIC_SITE_URL=https://nyaruhodo.jp
```

Then redeploy production.

## 3. Supabase Auth

Authentication URL configuration:

```txt
Site URL: https://nyaruhodo.jp
Redirect URL: https://nyaruhodo.jp/auth/callback
```

Keep the old callback during transition:

```txt
https://nyaruhodo-web-pwa-mvp.vercel.app/auth/callback
```

## 4. Google OAuth

Add authorized redirect URI:

```txt
https://nyaruhodo.jp/auth/callback
```

Keep the old Vercel callback during transition if users may still enter from the old domain.

## 5. Open Beta Links

Use attribution URLs from the new domain:

```txt
https://nyaruhodo.jp/?utm_source=instagram&utm_campaign=open_beta_01
```

## 6. QA

Check:

- `https://nyaruhodo.jp`
- `/diagnosis-onboarding`
- `/home`
- `/account/create`
- Google login returns to `/home`
- `cat_profiles`, `active_cat_id`, records, and photos remain in localStorage
- PWA install uses the correct app name and icon
- `manifest.webmanifest` returns Japanese app name and dark launch background

Expected analytics:

- `app_opened`
- `route_viewed`
- `diagnosis_onboarding_started` with `source = sns` when using SNS URL
- `properties->>'utm_campaign' = open_beta_01`
