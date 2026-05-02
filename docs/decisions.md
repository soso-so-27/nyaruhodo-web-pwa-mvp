# Decisions

This file records product, logic, UI, schema, and architecture decisions.

Any change to the agreed specification must be recorded here.

## 2026-05-01

### Start With Web/PWA

Decision: Validate the MVP as a Next.js Web/PWA before native development.

Reason: Web/PWA is faster for MVP validation and can still support a future Expo React Native migration if logic and UI remain separated.

### Separate UI And Logic

Decision: Diagnosis logic, scoring, comprehension/confidence calculation, and shared types belong in `/core`.

Reason: This keeps the domain layer reusable for future native implementation and prevents UI components from becoming decision makers.

### Supabase Access Boundary

Decision: Supabase access must go through `/lib/supabase`.

Reason: A single access boundary keeps data access portable, testable, and easier to adapt.

### MVP Screen Scope

Decision: The MVP starts with only Home, meowing diagnosis flow, diagnosis result, and result feedback.

Reason: The first product risk is whether users can quickly input a concern and receive a useful interpretation.

### Home Is Input Only

Decision: Home contains only `いまの様子` and `気になること`.

Reason: Home should stay simple and focused. Action recommendations belong only on diagnosis result screens.

### Deterministic Diagnosis

Decision: Cause ranking is determined by deterministic scoring logic.

Reason: This keeps results explainable and stable. AI may help with wording but does not decide the category ranking.

### Health Override

Decision: Health-related flags prioritize `health`.

Reason: Health concerns should be handled conservatively and should not be hidden by ordinary scoring.

### Database Safety

Decision: DB migrations, RLS creation, SQL operations, and destructive changes require confirmation before execution.

Reason: Database changes can have durable effects. `supabase db reset` is prohibited.

### Memory Feedback Weights

Decision: Feedback is first reflected through in-memory category weights.

Reason: This lets the MVP feel slightly adaptive without introducing database persistence or complex learning logic. `resolved` adds 10 to the selected category weight, and `unresolved` subtracts 10.

### Elapsed Time Context

Decision: Diagnosis context can include `lastFoodMinutes` and `lastPlayMinutes` for core scoring.

Reason: Scenario tests need to distinguish recent food/play from long elapsed time without adding database persistence. Recent food reduces `food`, long elapsed time increases `food`, and recent play reduces `play`.

### Recent Events Context Fallback

Decision: Diagnosis pages may try to read recent `events` to derive `lastFoodMinutes` and `lastPlayMinutes`, but must fall back to fixed context if reads fail or no matching events exist.

Reason: MVP RLS currently allows anon insert only, so select is expected to fail until a later authenticated read policy is designed.
