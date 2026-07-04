# Account Deletion Runbook

Last updated: 2026-07-05

This runbook covers manual deletion requests during the beta period. There is no exposed self-service deletion UI yet; the stored-data deletion API follows the same preservation rule below.

## Request Intake

1. Confirm the user requested deletion with the words `削除希望` through the configured contact channel.
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
- Storage objects under the requester's user id prefix, except delivered photos that must be preserved for recipients

If the user used the app anonymously and cannot be linked to an account, delete only data that can be confidently matched to the requester.

Delivered `ねがお` is recipient data after delivery. Preserve the image for recipients before removing the requester's account data.

## Recommended Order

1. Export a temporary operator-only list of row ids and storage paths needed for deletion. Do not keep this longer than the support task requires.
2. List all Storage objects under the requester's user id prefix in `cat-photos`.
3. Find delivered recipient records that reference requester-owned Storage paths:
   - table: `cat_moment_deliveries`
   - statuses to preserve: `delivered`, `kept`, `dismissed`
   - compare normalized `photo_url` paths, not signed URLs
4. For each preserved delivered photo:
   - copy the Storage object to a neutral path under `delivery-archive/`
   - update all matching `cat_moment_deliveries.photo_url` values to the new `storage:delivery-archive/...` path
   - only after the copy and row update succeed, include the original requester-owned Storage path in the deletion list
5. Delete dependent rows tied to the requester:
   - `photo_reports`
   - `record_logs`
   - `cat_moment_cats`
   - `cat_moment_deliveries` where the requester is the recipient (`user_id`)
   - `cat_moments`
   - `collection_photos`
   - `subscriptions`
6. Delete `cats` rows owned by the user.
7. Delete requester-owned Storage objects after the preservation step. Ignore not-found responses and continue.
8. Delete the `auth.users` row last.
9. Confirm the app no longer shows the account data after logout/login.
10. Confirm preserved delivered photos still render from recipient accounts and no preserved `photo_url` contains the deleted user id.
11. Reply to the user that deletion is complete.

## Notes

- Deletion should complete within 7 days after the request can be verified.
- Do not delete by broad predicates such as only `slot_slug = "__cat_gallery"`. Always include the user id and, where available, cat/photo ids.
- `collection_photos.slot_slug = "__cat_gallery"` is the internal sync slot for `この子のとっておき`; treat it as user photo data.
- Current account sync is additive. It does not propagate deletions. Manual deletion must remove remote rows directly.
- `cat_moment_deliveries` can display delivered photos without the original `cat_moments` row because the delivery row stores `photo_url`. It is acceptable to delete the requester's `cat_moments` after preserving delivered Storage paths.
- If any deletion fails, keep the request open and record the exact table/path that needs follow-up.
