# Account Deletion Runbook

Last updated: 2026-07-03

This runbook covers manual deletion requests during the beta period. There is no self-service deletion API yet.

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
- Storage objects referenced by the deleted rows

If the user used the app anonymously and cannot be linked to an account, delete only data that can be confidently matched to the requester.

## Recommended Order

1. Export a temporary operator-only list of row ids and storage paths needed for deletion. Do not keep this longer than the support task requires.
2. List Storage paths from:
   - `cat_moments.storage_path`, `display_storage_path`, `thumbnail_storage_path`
   - `cat_moment_deliveries.storage_path`, `display_storage_path`, `thumbnail_storage_path`
   - `collection_photos.storage_path`, `display_storage_path`, `thumbnail_storage_path`
   - `cats.avatar_storage_path`
3. Delete dependent rows first:
   - `photo_reports`
   - `record_logs`
   - `cat_moment_cats`
   - `cat_moment_deliveries`
   - `cat_moments`
   - `collection_photos`
   - `subscriptions`
4. Delete `cats` rows owned by the user.
5. Delete Storage objects collected in step 2. Ignore not-found responses and continue.
6. Delete the `auth.users` row last.
7. Confirm the app no longer shows the account data after logout/login.
8. Reply to the user that deletion is complete.

## Notes

- Deletion should complete within 7 days after the request can be verified.
- Do not delete by broad predicates such as only `slot_slug = "__cat_gallery"`. Always include the user id and, where available, cat/photo ids.
- `collection_photos.slot_slug = "__cat_gallery"` is the internal sync slot for `この子のとっておき`; treat it as user photo data.
- Current account sync is additive. It does not propagate deletions. Manual deletion must remove remote rows directly.
- If any deletion fails, keep the request open and record the exact table/path that needs follow-up.
