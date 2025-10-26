# DataWorkbench/Strings Architecture Specification (Minimal)

## Critical Rules
- Component size: target ≤1000 LOC, hard limit 1500
- Infinite loop prevention: stable `useEffect` deps; memoize objects/handlers
- Type safety: never duplicate types; import from `lib/types.ts` and generated `lib/database.types.ts`
- Business logic in services, not components

## Supabase SSR Pattern
- Use `@supabase/ssr`:
  - Server: `utils/supabase/server.ts` via `cookies().getAll()/setAll()`
  - Client: `utils/supabase/client.ts` singleton
- Do not use deprecated cookie API; do not expose service keys

## AI/Streaming
- Stream via Vercel AI SDK; line-delimited `0:"delta"` format
- Validate params per model; avoid unsupported options (e.g., GPT‑5 temperature=1.0)

## UI/Design
- Liquid-glass containers and overlays via `app/styles/liquid-glass.css`
- Responsive layout; sidebar on desktop, sheet/modal on mobile

## Enforcement Checklist
- [ ] No object literals in effect deps
- [ ] Types imported; no `any` unless justified
- [ ] SSR Supabase pattern followed
- [ ] Components < 1500 LOC
- [ ] API routes handle errors gracefully

