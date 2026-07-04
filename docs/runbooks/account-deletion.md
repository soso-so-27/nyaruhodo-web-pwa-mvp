# Account Deletion Runbook

Last updated: 2026-07-05

This runbook covers manual deletion requests during the beta period. There is no exposed self-service deletion UI yet; the stored-data deletion API follows the same preservation and billing rules below.

## Request Intake

1. Confirm the user requested deletion through the configured contact channel.
2. Confirm the account identity using the login email or another operator-approved identifier.
3. Record the request date and the operator handling the request.
4. Do not ask the user to send signed URLs, storage paths, passwords, or secrets.

## Deletion Scope

Delete data tied to the requester from:

- `auth.users`
- `cats`
- `cat_moments`
- `cat_moment_deliveries`
- `cat_moment_cats`
- `collection_photos`
- `record_logs`
- `photo_reports`
- `subscriptions`
- `app_events`
- `referral_codes`
- `referral_claims`
- `beta_feedback`
- Storage objects under the requester's user id prefix, except delivered photos that must be preserved for recipients

If the user used the app anonymously and cannot be linked to an account, delete only data that can be confidently matched to the requester.

Delivered `ねがお` is recipient data after delivery. Preserve the image for recipients before removing the requester's account data.

If the requester has an active Stripe subscription, cancel it in Stripe before deleting local account rows. Deleting the `subscriptions` row alone does not stop billing.

## Recommended Order

1. Export a temporary operator-only list of row ids and storage paths needed for deletion. Do not keep this longer than the support task requires.
2. Check the `subscriptions` row. If it has a non-terminal `stripe_subscription_id`, cancel that Stripe subscription immediately before continuing.
   - Terminal statuses that do not require cancellation: `canceled`, `incomplete_expired`, `none`
   - If Stripe cancellation fails or Stripe credentials are unavailable, stop the deletion and keep the support task open.
   - Do not delete the local `subscriptions` row until Stripe cancellation has succeeded or is confirmed unnecessary.
3. List all Storage objects under the requester's user id prefix in `cat-photos`.
4. Find delivered recipient records that reference requester-owned Storage paths:
   - table: `cat_moment_deliveries`
   - statuses to preserve: `delivered`, `kept`, `dismissed`
   - compare normalized `photo_url` paths, not signed URLs
5. For each preserved delivered photo:
   - copy the Storage object to a neutral path under `delivery-archive/`
   - update all matching `cat_moment_deliveries.photo_url` values to the new `storage:delivery-archive/...` path
   - only after the copy and row update succeed, include the original requester-owned Storage path in the deletion list
6. Delete dependent rows tied to the requester:
   - `photo_reports`
   - `record_logs`
   - `cat_moment_cats`
   - `cat_moment_deliveries` where the requester is the recipient (`user_id`)
   - `cat_moments`
   - `collection_photos`
   - `app_events`
   - `referral_claims`
   - `referral_codes`
   - `beta_feedback`
   - `account_sync_state`
   - `subscriptions`
7. Delete `cats` rows owned by the user.
8. Delete requester-owned Storage objects after the preservation step. Ignore not-found responses and continue.
9. Delete the `auth.users` row last.
10. Confirm the app no longer shows the account data after logout/login.
11. Confirm preserved delivered photos still render from recipient accounts and no preserved `photo_url` contains the deleted user id.
12. Confirm Stripe no longer has an active subscription for the deleted account.
13. Reply to the user that deletion is complete.

## Notes

- Deletion should complete within 7 days after the request can be verified.
- Do not delete by broad predicates such as only `slot_slug = "__cat_gallery"`. Always include the user id and, where available, cat/photo ids.
- `collection_photos.slot_slug = "__cat_gallery"` is the internal sync slot for `この子のとっておき`; treat it as user photo data.
- Current account sync is additive. It does not propagate deletions. Manual deletion must remove remote rows directly.
- `cat_moment_deliveries` can display delivered photos without the original `cat_moments` row because the delivery row stores `photo_url`. It is acceptable to delete the requester's `cat_moments` after preserving delivered Storage paths.
- If any deletion fails, keep the request open and record the exact table/path that needs follow-up.
