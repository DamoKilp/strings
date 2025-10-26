## Supabase + Next.js 15 SSR Integration Rules (Strings)

### 1) SSR Client Pattern
- Use `@supabase/ssr` only
- Server: `utils/supabase/server.ts` via `cookies().getAll()/setAll()`
- Client singleton: `utils/supabase/client.ts`

### 2) Auth
- Prefer `supabase.auth.getUser()` on server
- Do not parse/modify cookies manually

### 3) Middleware
- Use `updateSession(request)` to refresh tokens and redirect auth flows

### 4) Typed RPCs (No exec_sql)
- Use installed, typed RPCs when needed; otherwise typed selects

### 5) Types
- Regenerate with Supabase CLI → `lib/database.types.ts`

