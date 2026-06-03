# Dev Rules

## Implementation Order

Follow this order:

1. Create `AGENTS.md` and docs.
2. Create the Next.js directory structure.
3. Implement only the Home UI.
4. Implement `/core` scoring functions.
5. Connect `鳴いてる` to the diagnosis result flow.

Do not implement everything at once.

## Architecture

- `/core` contains domain logic, scoring, diagnosis selection, shared types, and future comprehension/confidence calculations.
- `/lib/supabase` contains Supabase clients and data access helpers.
- UI components must call app/domain services, not embed scoring rules.
- Keep platform-independent code free from browser-only APIs.

## TypeScript

- Prefer explicit domain types for cat, photo, account sync, and album data.
- Avoid stringly typed logic when a union type is practical.
- Run `npm.cmd run typecheck` before handing off TypeScript changes.

## Tests

- Run `npm.cmd run typecheck` after code changes.
- Run `npm.cmd run check:release` when account sync, Supabase, or release readiness changes.
- Run `npm.cmd run build` for larger UI, routing, or data changes.

## UI

- Keep the `とる` screen focused on taking one sleeping face photo.
- Keep album sections photo-first; titles and counts should stay quiet.
- Keep `ねこ` as the cat profile and record surface.
- Follow the paper-like quiet design direction.
- Keep buttons flat, rounded, and spacious.

## Logic

- Implement scoring in `/core`.
- Do not implement scoring inside React components.
- Health override takes priority.
- If the top two scores differ by less than 10, return two candidates.
- Otherwise return one candidate.

## Supabase

- Access Supabase only from `/lib/supabase`.
- Ask before creating or running migrations.
- Ask before creating RLS policies.
- Ask before running SQL against a database.
- Do not commit `.env.local`.
- Use only the public anon key in frontend code.
- Never put the service role key in frontend code.
- Do not run destructive DB commands.
- Never run `supabase db reset`.

## Documentation

- Update `docs/decisions.md` whenever product, logic, UI, schema, or architecture decisions change.
- Keep specs aligned with implementation.
- Prefer small documentation updates at the time a decision is made.

## Future Native Migration

- Keep `/core` portable.
- Avoid coupling core logic to Next.js.
- Avoid coupling data models to UI labels.
- Keep UI text mapping separate from internal logic identifiers where practical.
