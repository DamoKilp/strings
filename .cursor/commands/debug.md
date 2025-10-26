# /debug — Targeted Issue Investigation (Strings)

## Read Before Debugging
- docs/__Plans_New/architecture-spec-v4.md
- docs/__Specifications/09_SupabaseDataRetrieval_specification.md

## Steps
1. Reproduce the issue with minimal steps; capture inputs, outputs, logs
2. Check server route/SSR usage of Supabase (ensure @supabase/ssr pattern)
3. Validate types: run `npx tsc --noEmit`
4. Lint for hooks/rules issues: `npm run lint`
5. Isolate failing module; propose fix with minimal edits, preserving interfaces

## Output
- Root cause, proposed fix, affected files/lines, acceptance criteria
- If DB-related: SQL and RLS reasoning, test query, and rollback note


