# /plan — Create a Concrete, Enforceable Implementation Plan

## Inputs
- Read completely: docs/__Plans_New/architecture-spec-v4.md, docs/__Plans_New/AI_RULES.md
- If provided, use docs/__Plans_New/plan_template.md as the scaffold

## Output
- A concise, step-by-step, verifiable plan:
  - Objectives and non-goals
  - Files to edit/create (with paths)
  - API/routes/services/hooks involved
  - Order of execution (1..N) with acceptance criteria per step
  - Risks and mitigations
  - Type/lint and SSR constraints

## Constraints
- No dev server auto-start; prefer type-checks (`npx tsc --noEmit`) and lint (`npm run lint`).
- Preserve type hierarchy; no duplication
- Stable effects; components < 1500 LOC
- Supabase SSR via @supabase/ssr only

