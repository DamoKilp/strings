# /review — Code Review with Architecture Enforcement

## Baseline
- Read docs/__Plans_New/architecture-spec-v4.md and docs/__Plans_New/AI_RULES.md

## Checklist
- Hooks: stable deps; no object literals in deps
- Size: < 1500 LOC per component
- Types: no duplication; import from lib/types.ts or generated db types
- Supabase: SSR via @supabase/ssr; client singleton on client
- API: stream responses correctly; errors surfaced to UI
- UI: liquid-glass classes; responsive layout

## Output
- Summary with PASS/FAIL per item; specific files/lines; suggested diffs



