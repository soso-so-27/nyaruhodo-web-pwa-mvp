# Logic Spec

## Ownership

All diagnosis logic, scoring, shared types, and comprehension/confidence calculations belong in `/core`.

UI components must not contain diagnosis logic.

## Cause Categories

- `food`
- `play`
- `social`
- `stress`
- `health`

## Input Signals

Behavior signals:

- `meowing`
- `following`
- `restless`
- `low_energy`
- `fighting`

Time signals:

- `morning`
- `night`
- `late_night`

History signals:

- `after_food`
- `after_play`

Environment signals:

- `external_stimulus`

Health signal:

- `health_flag`

## Base Scores

### meowing

- `food` +30
- `play` +20
- `social` +20

### following

- `social` +50

### restless

- `play` +40
- `stress` +30

### low_energy

- `health` +60
- Enables health override

### fighting

- `stress` +50

## Time Adjustments

### morning

- `food` +20
- `social` +10

### night

- `play` +20

### late_night

- `food` -20
- `social` +10
- `stress` +10

## History Adjustments

### after_food

- `food` -50

### after_play

- `play` -30

## Environment Adjustments

### external_stimulus

- `stress` +30

## Result Selection

1. Calculate category scores.
2. If `health_flag` exists, prioritize `health`.
3. Sort categories by score descending.
4. If the difference between the top two categories is less than 10, present both.
5. Otherwise, present only the top category.

## Health Override

Health-related signals must be handled conservatively.

If a health override is active:

- `health` is prioritized in the result.
- The UI should avoid definitive medical claims.
- The result should suggest careful observation or professional consultation depending on copy rules.

## Determinism

The same inputs must always produce the same scores and selected categories.

AI-generated explanation text must not change category ranking.

## Expected Core Modules

The initial implementation should likely include:

- `/core/types`
- `/core/scoring`
- `/core/diagnosis`

Exact filenames can follow the project's TypeScript conventions once the app structure exists.
