# Cats Page Section Structure 2026-07-02

Source: `src/components/cats/CatsPage.tsx`.

This is an extraction only. No CatsPage code was changed for this document.

## State values

| State | Values | Initial value | Meaning |
| --- | --- | --- | --- |
| `activeSection` | `"record"`, `"photos"`, `"basic"` | `"record"` | Top-level section tab in the cat page. |
| `activeLens` | `"cat"`, `"all"` | `"cat"` | Photo lens inside the photos section. Forced back to `"cat"` when there is only one cat. |

## Top-level rendering by state

Common guard for main sections:

- `activeCatProfile` must exist.
- `isOnboardingCompletionView` must be false.

| Condition | Rendered section/component |
| --- | --- |
| `activeSection === "basic"` | `CatBasicProfilePanel` inside an `AppCard` |
| `activeSection === "photos"` and `shouldShowPhotoLensSwitch` | `PhotoLensFilter` |
| `activeSection === "photos" && activeLens === "cat"` | `LensPhotoSection` with `activeCatGalleryLensPhotos` |
| `activeSection === "photos" && activeLens === "all"` | `AllCatsLensView` with `allGalleryLensPhotos` |
| `activeSection === "record"` | `RecordOverview` |
| `activeSection === "record" && SHOW_LEGACY_DETAIL_SECTIONS` | Legacy detail blocks. Currently disabled because `SHOW_LEGACY_DETAIL_SECTIONS = false`. |

## Current user-visible cat tab composition

The currently visible default cat tab is `activeSection === "record"`, rendered by `RecordOverview`.

Display order inside `RecordOverview`:

1. Today item / `cats-pickup-section`
   - Rendered only when `selectCatPickup(...)` returns a pickup.
   - Sources passed into `selectCatPickup`: `photos`, `milestones`, `memories`, `birthdayStatus`, and `readCatPickupHistory(activeCatId)`.
   - A pickup can target:
     - a memory, opened through `onOpenMemory`
     - a photo, opened through `onOpenPhoto`
     - milestones, opened by scrolling to the milestones section

2. Celebrations / milestones
   - Source: `createCatCelebrationItems({ familyDuration, birthdayStatus, takenSleepingPhotoCount })`
   - This is the current visible replacement for the older milestone/detail section.

3. Recent footprints
   - Source: `createCatFootprintEntries({ photos, milestones, memories, max: 3 })`
   - Click behavior:
     - memory entry: `onOpenMemory(entry.memory)`
     - photo entry: `onOpenPhoto(entry.photo)`
     - otherwise: `onOpenPhotos()`

4. Year summaries
   - Source: `createCatYearSummaries({ photos, memories, milestones, now }).slice(0, 3)`
   - Opens `YearSummarySheet`.
   - The sheet has detail tabs for photos, memories, and milestones.

The `photos` section currently shows:

1. Optional `PhotoLensFilter`
2. Current-cat photos through `LensPhotoSection`
3. All-cats photos through `AllCatsLensView`

The `basic` section currently shows:

1. `CatBasicProfilePanel`

## Legacy sections disabled by `SHOW_LEGACY_DETAIL_SECTIONS`

`SHOW_LEGACY_DETAIL_SECTIONS` is currently `false`.

The disabled legacy block currently contains:

1. A record summary panel
   - Current season label
   - Delivered memory count
   - Sleeping photo count
   - Relationship record copy

2. A days/thread panel
   - Current-month relationship copy
   - Total memory count and sleeping photo count

No `<OmoideBunbako />` call site exists inside this legacy block in the current file.

## OmoideBunbako component

`OmoideBunbako` is defined but currently not mounted anywhere in `CatsPage`.

Props required to render it:

```ts
{
  memories: OmoideMemory[];
  controls: ReturnType<typeof readOmoideMemoryControls>;
  onOpen: (memory: OmoideMemory) => void;
  onPause: () => void;
  onDisable: () => void;
}
```

Data and handlers already available in `CatsPage`:

- `omoideMemories = readOmoideMemoriesForCat(activeCatId)`
- `omoideControls = readOmoideMemoryControls()`
- `setSelectedOmoideMemory(memory)` for opening a memory sheet
- `pauseOmoideMemories(...)`
- `disableOmoideMemories(...)`
- `setOmoideRefreshTick(...)`

Therefore, the component can be mounted without inventing new data sources. The missing piece is choosing the correct visual location in the current `RecordOverview` structure.

## Home omoide arrival path

The home arrival letter path is:

1. `HomeInput` calls `ensureOmoideMemoryArrival(...)`.
2. `ensureOmoideMemoryArrival(...)` writes a memory to `neteruneko_omoide_memories`.
3. `HomeInput` reads it with `readLatestArrivedOmoideMemory(activeCatId, homeNow)`.
4. `HomeDeskModel` renders `data-testid="omoide-arrival-letter"`.
5. Clicking it calls `onOpenOmoideMemory?.(memory)` and then `window.location.assign("/cats#omoide")`.
6. `HomeInput` handles `onOpenOmoideMemory` by calling `markOmoideMemoryOpened(memory.id, homeNow)`.
7. `markOmoideMemoryOpened(...)` writes `openedAt` back to `neteruneko_omoide_memories`.

Conclusion:

- The home path already persists the opened memory.
- The cat page currently reads memories, but the dedicated bunbako UI is not mounted.

## Today item vs bunbako relationship

Current code relationship:

- `RecordOverview` passes `memories` into `selectCatPickup(...)`.
- If selected, an omoide memory can appear in the "today item" slot.
- Opening that pickup calls `onOpenMemory(memory)` and shows the `OmoideMemorySheet`.

Missing relationship:

- The "today item" is a single recommendation slot.
- `OmoideBunbako` is meant to be the accumulated archive of opened memories.
- Current code has the recommendation slot, but not the accumulated archive UI.

Design implication:

- If bunbako is restored, it should not replace the "today item".
- It should likely live in the `record` section near footprints/year summaries, because it represents accumulated opened memories rather than the transient current recommendation.
