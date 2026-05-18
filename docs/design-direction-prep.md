# Design Direction Prep

## Purpose

This note prepares the design direction decision for Nyaruhodo before applying broad UI changes.

The current app has a strong new visual direction on Home: user photo as the environment, gradual light, glass controls, and small daily recording actions. Other screens still mostly use earlier warm card layouts. The next step should decide how much of the Home atmosphere becomes the app-wide design language.

## Current State

### Home

Role:
- The emotional center of the app.
- User-selected cat photo fills the screen.
- Light score changes photo treatment, overlays, bulb color, card glass, and discovery affordance.
- Primary actions are two cards: current state and care action.

Current visual language:
- Full-screen photo background.
- Multi-layer light system:
  - main diagonal overlay
  - right-top corner light
  - ambient center air
  - cold overlay for low levels
  - lower warmth
  - optional golden bloom
- Glass-like cards and pills.
- Sage green for action identity.
- Gold for light and understanding.

What works:
- Strongest expression of the product concept.
- Feels less like a dashboard and more like being near the cat.
- Light level has a sensory role instead of only being a number.

Risks:
- Arbitrary user photos vary heavily in crop, brightness, and contrast.
- If overlays are too strong, the user's cat photo gets lost.
- If cards are too transparent, content becomes flat and hard to read.
- Current light/card values live only inside `HomeInput.tsx`, so other pages cannot share them.

### Torisetu

Role:
- Explains what the app is learning about the cat.
- Should feel like knowledge gradually becoming visible.

Current visual language:
- Warm page background.
- White cards.
- Progress bar.
- Locked/unlocked cards.

Mismatch with Home:
- More conventional app-card style.
- Does not yet inherit the light/glass language.
- Locked cards read as disabled UI rather than "still in the mist."

Opportunity:
- Make Torisetu the "knowledge layer" of the Home light system.
- Reuse light/progress colors and card treatment, but keep it calmer than Home.

### Cats

Role:
- Profile management and cat switching.
- Home photo and avatar setup.

Current visual language:
- Warm neutral background.
- Profile card and avatar grid.
- Mostly solid cards.

Mismatch with Home:
- Functional and separate from the atmospheric Home.
- That is acceptable, but spacing, card radius, icon tone, and action hierarchy should be aligned.

Opportunity:
- Keep Cats more utilitarian.
- Use the same tokens for card radius, borders, labels, and soft surfaces.
- Make the home-photo setting visually connected to the Home background concept.

### Collection

Role:
- Photo collection and memory shelf.

Current visual language:
- Warm neutral page.
- Grid cards with icons/photos.
- Bottom sheet for detail.

Mismatch with Home:
- Still closer to a static collection grid.
- Does not share Home's glass or light language.

Opportunity:
- Treat empty collection cards as "unlit slots" and filled cards as memories.
- Avoid full Home atmosphere here; use a quieter shelf metaphor.

### Settings

Role:
- Account, data, app information.

Current visual language:
- Simple warm settings list.

Mismatch with Home:
- Fine. Settings should stay functional and quiet.
- It only needs token alignment, not atmosphere.

### BottomNavigation

Role:
- Persistent app navigation.

Current visual language:
- Floating white glass nav.
- Four tabs.

Fit:
- Already close to the Home direction.
- It should remain stable while other screens align around it.

## Existing Design Assets

### Present

- `docs/ui-spec.md`
  - Exists, but reflects an older "quiet flat MVP" direction.
  - Contains encoding-corrupted Japanese text in several places.
  - No longer matches the current Home concept.

- `src/components/ui/`
  - Directory exists.
  - Currently empty.

- Home-only light tokens
  - `LIGHT_LEVELS` exists inside `HomeInput.tsx`.
  - Includes photo correction, overlays, glass card values, bulb state, and bar values.

### Missing

- Shared design tokens.
- Shared card/pill/button/sheet components or style helpers.
- A current design spec that reflects the new direction.
- A page-by-page migration checklist.

## Product-Level Design Thesis

Recommended thesis:

> Nyaruhodo is not a dashboard. It is a quiet room around the cat. The app should make the cat feel closer through small records, light, and gradual discovery.

Implications:
- Home can be highly atmospheric.
- Torisetu can be gently mysterious and progressive.
- Cats, Collection, and Settings should be calmer, but still use the same material language.
- User photos are sacred: do not over-darken, over-blur, or force a specific crop.
- Readability should mostly be solved by surfaces and local gradients, not by crushing the full photo.

## Design Decisions To Make

### 1. App-Wide Material

Options:
- A. Glass everywhere.
- B. Glass only over photos; warm paper elsewhere.
- C. Hybrid: Home uses glass, Torisetu uses translucent paper, management pages use solid warm cards.

Recommendation:
- C. Hybrid.

Reason:
- Full glass everywhere can become noisy.
- Home needs atmosphere.
- Settings and editing flows need clarity.

### 2. Light Language Scope

Options:
- A. Only Home has light levels.
- B. Home and Torisetu share light/progress language.
- C. Every page reacts to light level.

Recommendation:
- B. Home and Torisetu.

Reason:
- Light is about "understanding this cat."
- Torisetu is the natural place to extend that concept.
- Collection/Cats should not become visually unstable.

### 3. Photo Usage

Options:
- A. Avatar photo doubles as Home background.
- B. Dedicated Home photo only.
- C. Dedicated Home photo preferred, fallback to avatar, then sample.

Recommendation:
- C now, B later.

Reason:
- The app already supports `homePhotoDataUrl`.
- Avatar crop and Home background crop are different needs.
- Fallbacks keep the MVP usable.

### 4. Text Hierarchy

Decision needed:
- Should Home use more central emotional copy or stay minimal?

Current leaning:
- Stay minimal.
- The user already rejected a large central emotional copy direction.
- Keep the light text near the action area or photo lower edge.

### 5. Icon Style

Decision needed:
- One icon system for all pages.

Recommendation:
- Use simple stroke SVGs for app UI.
- Avoid emoji in UI surfaces.
- Use collection PNGs only for collection-specific empty states.

## Proposed Design System Files

Create:

- `src/components/ui/designTokens.ts`
  - color tokens
  - radius tokens
  - typography sizes
  - shadows
  - glass/paper surface presets

- `src/components/ui/lightTheme.ts`
  - `LIGHT_LEVELS`
  - light level helpers
  - Home/Torisetu light semantics

- `src/components/ui/surfaceStyles.ts`
  - `getGlassSurface(level)`
  - `getPaperSurface()`
  - `getPillSurface(level)`

Later optional:

- `GlassCard.tsx`
- `PillButton.tsx`
- `BottomSheet.tsx`
- `SectionLabel.tsx`

Start with style helpers before components to avoid over-refactoring.

## Surface Model

Use three surface roles instead of one generic glass treatment.

### Liquid Glass

Use for:
- Cat switch pill.
- Light meter pill.
- Bottom navigation.
- Small floating controls.

Behavior:
- More translucent.
- Strong blur and light saturation.
- Thin border.
- Should feel like controls floating over the photo.

### Frosted Paper Glass

Use for:
- Home primary action cards.
- Discovery card.
- Torisetu unlocked knowledge cards.

Behavior:
- More readable than Liquid Glass.
- Still translucent, but with a paper-like milky layer.
- Card readability is handled by the surface, not by over-darkening the photo.

### Solid Warm

Use for:
- Settings.
- Editing forms.
- Destructive actions.
- Detail sheets where accuracy matters.

Behavior:
- Minimal transparency.
- Warm paper surface.
- Prioritizes legibility and confidence over atmosphere.

## Migration Order

### Phase 1: Consolidate The Source Of Truth

- Move Home light/material values out of `HomeInput.tsx`.
- Keep visual output unchanged.
- Replace old `docs/ui-spec.md` or add a new current spec.
- Fix or avoid relying on encoding-corrupted UI spec text.

### Phase 2: Align Torisetu

- Apply shared progress/light colors.
- Make locked cards feel "not yet visible" rather than disabled.
- Keep content readable and calm.

### Phase 3: Align Collection

- Normalize page spacing, labels, bottom sheet, and card surfaces.
- Make empty slots feel quieter and filled slots more precious.

### Phase 4: Align Cats

- Normalize profile card, settings section, edit form, and photo controls.
- Make Home-photo setup clearly connected to Home.

### Phase 5: Settings And Navigation Polish

- Settings remains solid and functional.
- BottomNav remains stable; only tune if tokens require it.

## Immediate Prep Checklist

- Confirm whether to use the hybrid material model.
- Decide whether `docs/ui-spec.md` should be replaced or preserved as historical.
- Decide whether to extract `LIGHT_LEVELS` before touching Torisetu.
- Decide whether to fix encoding-corrupted strings in the same design cleanup or separately.

## Suggested Next Step

Do not redesign every page at once.

Recommended next implementation:

1. Add shared design token/style helper files.
2. Move Home light/surface values into those helpers with no visual change.
3. Update documentation to the new design thesis.
4. Then apply the helpers to Torisetu as the first non-Home page.
