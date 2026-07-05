# Instagram Launch Checklist

Target URL:

```txt
https://nyaruhodo.jp/onboarding?source=instagram_story
```

## Before Posting

- Confirm Vercel Production is Ready and `nyaruhodo.jp` points to the latest Production deployment.
- Confirm Supabase migrations are applied with `supabase migration list`.
- Confirm Google login succeeds in Safari/Chrome/PWA. If it fails there too, fix Google Cloud OAuth redirect URI / Supabase callback settings before testing Instagram handoff.
- Confirm `npm run check:release`, `npm run typecheck`, and `npm run build` pass locally or in CI.
- Local `npm run check:release` needs a valid `.env.local`. Pull Preview/Production env from Vercel or fill the required values first; empty values stop with `Missing NEXT_PUBLIC_SUPABASE_URL.` and no secret values are printed.
- Confirm Vercel plan, spend limit, and alert emails with the project owner before posting broadly.
- Confirm Supabase Pro usage dashboard: Egress, Storage, Database Size, and Auth MAU.

## iPhone Instagram Browser

- Open the Story URL inside the Instagram iPhone app.
- Confirm the intro screen appears for a new anonymous session.
- Select one cat photo and confirm upload does not freeze.
- Confirm one `ねこだより` arrives and can be opened.
- Confirm `うちのこのアルバムをつくる` appears after opening.
- Confirm Google login is not the main path inside Instagram; the handoff link path appears and continues in Safari/Chrome/PWA.
- Reopen the same URL and confirm the flow resumes instead of restarting.
- Open `?source=instagram_bio` after submitting and confirm state is not reset.

## Production UI Safety

Confirm none of these appear in Production:

- Candidate-empty test copy.
- Test candidate add controls.
- Red/blue placeholder images.
- Debug source, anonymous ID, submission ID, or deployment URL.
- PWA home-screen prompt during the first onboarding flow.

## Privacy

- Uploaded user photos are resized/re-encoded before app storage use.
- New saved photos do not store the original File/Blob as-is.
- EXIF/location metadata is not preserved in newly saved app variants.
- Delivered `ねこだより` does not show sender name, location, account, or external SNS identity.
- No automatic sharing to Instagram or other external SNS occurs.
- Supabase `cat-photos` bucket remains private.
- Photo display uses signed URLs only, with short-lived display URLs.

## Cost Controls

- User-generated photos are rendered with normal image tags or signed URLs, not Next Image Optimization.
- Cache Storage does not contain API responses, signed URLs, Supabase Storage responses, or personal JSON.
- Vercel usage and Supabase egress should be checked after the first small Story test.
- Start with a limited/private Story or DM test before broad posting.

## Manual Browser Checks

- Chrome DevTools Console: no repeated CSP Report-Only violations.
- Application > Service Workers: current SW active, no unexpected old worker controlling the app.
- Application > Cache Storage: only static public app assets/offline page are cached.
- Network: `/api/*` and Supabase signed URL responses are not served from Cache Storage.
