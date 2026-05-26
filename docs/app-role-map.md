# App Role Map

This memo defines where each feature should live in nyaruhodo. Use it before adding new UI, storage keys, or routes.

## Core Principle

The app should reduce the owner's hesitation when they notice their cat.

- Immediate capture belongs on Home.
- Knowledge that accumulates over time belongs in Torisetu.
- Photos and visual collecting belong in Collection.
- Cat identity and profile management belong in Cats.
- Account, data, and app-level controls belong in Settings.

## Route Roles

### `/home`

Role: the first screen to open when the owner sees the cat.

Owns:
- Quick actions such as Mikke, care, and photo capture.
- A short recommendation board:
  - Closed state: quick launch for `みっけ`, `おせわ`, and one contextual card.
  - Expanded state: today's small board with `うちの子らしさ` as the main card, then `すぐ残す`, `届いていること`, `次に見つけたい`, and recent memos.
- Cat switching for the current moment.

Should avoid:
- Long explanations.
- Profile editing.
- Reading-heavy knowledge cards.
- Settings or account management.

### `/torisetu`

Role: the shelf of knowledge that grows from records and diagnoses.

Owns:
- Findings from daily Mikke records.
- Results from diagnosis-style questionnaires.
- Locked or unopened knowledge that becomes available later.
- Detail screens for learned results.

Should avoid:
- Acting as the primary input surface.
- Showing raw logs as the main experience.
- Repeating Home recommendations.

### `/collection`

Role: the visual shelf of moments and poses.

Owns:
- Pose and scene collection slots.
- Photos attached to collection targets.
- Daily visual targets such as "today's pose to find".
- Shareable photo moments.

Should avoid:
- Long-form knowledge explanations.
- Cat profile editing.

### `/cats`

Role: cat profile and management.

Owns:
- Cat avatar and home photo setup.
- Basic profile data such as name, birthday, gender, breed, and coat.
- Active cat switching when managing cats.
- Settings entry point.

Should avoid:
- Daily quick recording.
- Knowledge shelf content.

### `/settings`

Role: app-level settings and data/account controls.

Owns:
- Auth status and logout.
- Data reset.
- App version and beta notes.

Should avoid:
- Daily cat interactions.
- Diagnosis content.

### `/account/create`

Role: account connection entry point.

Owns:
- Google Auth start.
- Logged-in state explanation.
- Returning to Home.

Should avoid:
- Claiming DB migration or cross-device sync is complete.
- Moving localStorage data.

### `/diagnosis-onboarding`

Role: first cat creation and initial type diagnosis.

Owns:
- Name, photo, basic info, and initial type diagnosis.
- Creating the first local cat profile.

Should avoid:
- Blocking app use behind auth.
- Long-term knowledge shelf UI.

## Placement Rules

Use these rules when a new idea appears:

- "I want to save what I saw right now" -> Home.
- "I want to understand what this means over time" -> Torisetu.
- "I want to keep a photo of this pose or scene" -> Collection.
- "I want to change who this cat is" -> Cats.
- "I want to manage account or data" -> Settings.

Every new feature should declare:

- Page owner.
- Storage owner.
- Whether it is an input, a result, or a management action.

## Shared Implementation Rules

### Storage

All localStorage keys should be imported from `src/lib/storage`.

- Static keys live in `STORAGE_KEYS`.
- Per-cat dynamic keys use helper functions such as `getRecordLogKey(catId)`.
- New storage keys should not be written inline inside page components.
- If a key will later move to Supabase, keep the local shape stable and add the migration note near the read/write helper, not in the UI.

### Bottom Sheets

Use `AppBottomSheet` for bottom-up panels that temporarily sit over the current page.

Good fits:
- Home quick input sheets.
- Cat switching sheets.
- Collection photo/detail sheets.

Avoid using it for:
- Full-page knowledge reading.
- Permanent navigation.
- Inline cards that should stay visible in the page layout.

### Icons

Use `AppIcon` or named exports from `AppIcons` for common app icons.

Common icons:
- Navigation icons.
- Action icons such as paw, hand, camera, heart, book, lock.
- System icons such as close and chevron.

Keep page-local SVG only when the shape is content-specific, such as collection silhouettes. Those are not generic UI icons.

### Torisetu Diagnosis Catalog

Diagnosis definitions live in `src/lib/torisetu/diagnosisCatalog.ts`.

- `source: "onboarding"` means the result can be shown from existing onboarding diagnosis data.
- `source: "future"` means the card is a locked sample or future diagnostic entry point.
- Unlock logic belongs in the catalog or a Torisetu helper, not in Home.
- Home may recommend a next action, but learned results and diagnosis result cards belong in Torisetu.
- Home should not keep a permanent Torisetu card in the recommendation rail. Surface Torisetu only when there is a concrete new result or unread knowledge.
- The Home recommendation should not simply repeat user-entered records. Convert records into a small observation point under `うちの子らしさ`.

### Checkpoint Before Push

Before pushing a cross-page design/system change:

- Run `npm run typecheck`.
- Run `npm run build`.
- Check that `next-env.d.ts` was not left modified by the build.
- Confirm no raw storage key imports remain from `src/lib/storage/keys`.
