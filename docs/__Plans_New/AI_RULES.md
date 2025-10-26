# AI Development Rules (Strings)

## Type Hierarchy
1. `lib/types.ts` — Chat types
2. `lib/database.types.ts` — Generated (READ-ONLY)

## Supabase Integration
- Server: `utils/supabase/server.ts` (createServerClient + cookies getAll/setAll)
- Client: `utils/supabase/client.ts` (singleton)
- No `exec_sql`; use typed RPCs or typed selects with RLS

## Performance & Structure
- Use service layer for non-trivial logic
- Memoize callbacks/selectors; avoid heavy work in render
- Keep logs minimal and string-based

## Execution Order
1) Read architecture and AI rules
2) Verify constraints (effects/types/SSR)
3) Implement
4) `npx tsc --noEmit` and `npm run lint`


