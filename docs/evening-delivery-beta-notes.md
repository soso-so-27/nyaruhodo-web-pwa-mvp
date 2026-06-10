# Evening Delivery Beta Notes

## Current beta behavior

The beta implementation uses the client to detect the evening delivery boundary.

- A photo taken before 20:00 JST becomes eligible for that evening.
- A photo taken after 20:00 JST becomes eligible for the next evening.
- When the app is opened or active after 20:00 JST, the client creates the pending unopened delivery using the existing delivery candidate API.
- Missed older pending delivery days are not replayed as multiple envelopes.
- If the user was away, the latest missed pending delivery is kept as one waiting envelope on the next open. Older pending delivery days are quietly skipped.

## Known beta tradeoff

The current boundary depends on the device clock. If the device clock is changed, the beta client can appear to advance or delay delivery.

This is an accepted beta-stage tradeoff so the product experience can be validated before adding server-side scheduled delivery. A future server cron / push delivery phase should move the delivery boundary and delivery creation to server time.
