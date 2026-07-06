# Neteruneko Design Brief

Date: 2026-07-06

## Product Core

`ねてるねこ` is a quiet daily ritual:

- Take one sleeping cat photo.
- At night, receive one sleeping cat letter.
- Keep the user's own cat as the emotional center.
- Keep sharing and public exposure intentionally narrow.

## Home Canon

The home screen is not an album collage. It is the daily stage for the user's
cat.

- Before capture: the main action is `ねがおを とる`.
- After capture, before 20:00: show the user's own sleeping photo as the home
  photo frame.
- Unopened delivery: show the unopened letter as the only notification.
- Opened delivery: return to the normal home photo frame.
- Opened delivery must not stay in the notification tray.
- Tapping the opened home frame may reopen the delivered photo viewer.

## Hard No

Do not restore the old home stamp-pair layout.

- Do not mount `StampPair` on `/home` state4.
- Do not show a permanent delivered-photo stamp on the home frame.
- Do not use a stamp slot as the close-animation target.
- Do not add opened delivery rows back into the notification card.

`StampPair` can remain for prototypes or album experiments, but it is not the
home opened-state design.

## Visual Tone

- Paper is quiet and warm, not decorative clutter.
- The user's own cat should stay visually primary.
- Motion should confirm a state change, not become the content.
- Avoid UI that makes the product feel like an old postcard/stamp collection
  unless that direction has a new reviewed spec and screenshots.

## Required Regression Check

For any change touching home delivery/opening:

- `tests/e2e/home-desk-model.spec.ts` must keep asserting that
  `home-stamp-pair` and `home-stamp-pair-stamp` are absent in opened home.
- A screenshot of opened home should be reviewed if the visual state changes.
