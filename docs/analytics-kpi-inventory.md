# Analytics KPI Inventory

## Purpose

Instagram launch traffic should answer one question first: did a first-time visitor put in one sleeping cat photo and open one cat letter?

North star KPI:

- `completed_delivery_user_count`: unique users on the same JST date who have both `photo_submitted` and `delivery_opened`.

Analytics must never block the product experience. If event collection fails, the app should continue silently.

## Privacy Rules

Do not store these in analytics events:

- photo URLs
- signed URLs
- storage paths
- cat names
- user names
- locations
- email addresses
- raw secrets or tokens

Only IDs, safe counters, route names, surfaces, source labels, and sanitized error codes/messages should be stored.

## Source Values

Allowed values:

- `instagram`
- `instagram_story`
- `instagram_bio`
- `instagram_dm`
- `direct`
- `unknown`

Unknown or unsupported source values should be rounded to `unknown`. `source` is attribution only and must not reset onboarding state.

## P0 Events

| Event | Screen / Action | Priority | Notes |
| --- | --- | --- | --- |
| `app_opened` | App shell loaded | P0 | Includes route, display mode, in-app browser, PWA state. |
| `onboarding_intro_view` | Onboarding intro displayed | P0 | First Instagram funnel step. |
| `onboarding_photo_select_click` | User taps first photo select CTA | P0 | Measures CTA intent before OS picker. |
| `onboarding_photo_submitted` | Onboarding photo saved | P0 | Includes `submission_id`; no photo URL. |
| `photo_submitted` | Generic photo submitted | P0 | Used for cross-surface north star calculations. |
| `onboarding_delivery_arrived` | Onboarding letter becomes available | P0 | Delivery exists before open. |
| `onboarding_delivery_opened` | Onboarding letter opened | P0 | Includes delivered photo ID only. |
| `onboarding_album_prompt_view` | Account/album prompt displayed | P0 | Alias of older prompt event for KPI. |
| `onboarding_google_continue_click` | Google continue clicked or credential callback received | P0 | External Google button clicks can be hard to observe, so callback is also counted. |
| `onboarding_skip_click` | User chooses later/skip | P0 | Keeps drop-off measurable. |
| `onboarding_completed` | Onboarding marked complete | P0 | Fired after delivered photo keep or album/account continuation. |
| `home_view` | Home screen viewed | P0 | Alias of older `home_viewed`. |
| `home_photo_submit_click` | Home sleeping-photo CTA tapped | P0 | Before picker/safety gate. |
| `home_photo_submitted` | Home sleeping photo selected and stored | P0 | No image URL. |
| `delivery_opened` | A delivered cat letter is opened | P0 | Generic delivery event for app KPI. |
| `collection_view` | Cat letter/collection screen viewed | P0 | Alias of older `collection_viewed`. |
| `collection_sent_tab_view` | Sent side displayed | P0 | Tracks board side. |
| `collection_received_tab_view` | Received side displayed | P0 | Tracks empty received-side problem. |
| `cat_album_created` | Cat album/profile created | P0 | No cat name. |
| `cat_name_saved` | Cat name/profile save happened | P0 | Name value is not sent. |
| `app_error` | Generic app error | P0 | Not fully implemented yet. |
| `photo_upload_error` | Photo save/upload error | P0 | Implemented for onboarding/home photo save failure. |
| `photo_compress_error` | Compression-specific error | P0 | Not fully implemented yet; currently grouped into upload error. |
| `signed_url_error` | Signed URL generation/display error | P0 | Not fully implemented yet. |
| `delivery_error` | Delivery creation/opening error | P0 | Not fully implemented yet. |

## P1 Events

Inventory only for launch; implement when improving each surface:

- `pwa_install_prompt_view`
- `pwa_install_prompt_click`
- `settings_view`
- `beta_supporter_page_view`
- `beta_supporter_checkout_click`
- `report_photo_click`
- `report_photo_submitted`
- `notification_permission_prompt_view`
- `notification_permission_accepted`
- `notification_permission_denied`
- `share_card_view`
- `share_card_click`

## P2 Events

Future quality signals:

- animation start/end events for the opening letter
- tab switch animation completion
- image load retry count
- offline recovery success
- repeat weekly active submitter
- paid supporter conversion source

## Admin KPI Page

Admin URL:

- `/admin/analytics`

Periods:

- today
- yesterday
- last 7 days
- last 28 days

Minimum displayed sections:

- event count cards
- onboarding funnel
- source breakdown
- app KPI table
- recent errors
- recent events with shortened IDs
- rough retention: active users, repeat submitters, D1 return submitters

## Known Gaps

- `app_error`, `photo_compress_error`, `signed_url_error`, and `delivery_error` need broader instrumentation.
- The north star is implemented as a view-level definition over `app_events`; it should be validated against production data after launch.
- D1 retention is rough and based on local event IDs, not a fully modeled user table.
