## Supabase Auth PKCE Notes

- All clients use `@supabase/ssr` with `flowType="pkce"` which means Supabase sets a transient `sb-*-code-verifier` cookie when sign-in/sign-up emails are requested.
- The redirect URL embedded in Supabase emails **must resolve to the exact host that created the code verifier cookie** (same scheme + host + port). Otherwise the callback cannot read the verifier and Supabase returns `400 both auth code and code verifier should be non-empty`.
- `resolveSiteUrl()` now normalises the active host (prefers the runtime host when it differs from `NEXT_PUBLIC_SITE_URL`) before we hand it to Supabase. This keeps preview deployments and localhost flows working without editing `.env`.
- If the PKCE cookie is missing (stale link, wrong profile, etc.) `/auth/callback` now logs the absence and automatically falls back to `verifyOtp` for all email-link types (`signup`, `magiclink`, `invite`, `email_change`, `recovery`). You will still see the “request a new link” hint if both strategies fail.
- When running locally always set `NEXT_PUBLIC_SITE_URL=http://localhost:3000` to avoid remote domains leaking into auth emails. For Vercel previews the helper automatically uses the preview host.
- Troubleshooting:
  - In DevTools → Application → Cookies, confirm a cookie named `sb-<project>-code-verifier` exists before opening the email link.
  - If it’s missing, trigger a fresh link from the same browser (or sign in with email/password) so Supabase can store the verifier.
  - If the cookie exists yet exchange still fails, grab console logs (`[AuthCallback]` lines) and the offending query params so we can reproduce.

## Google Calendar OAuth Checklist

1. **Google Cloud Project**
   - Use the Strings project (not the legacy KilpoAi project).
   - Consent Screen: External → Testing. Add your Gmail account under *Test users*.
   - Enable the Google Calendar API.

2. **OAuth Client**
   - Create a *Web application* credential.
   - Authorized redirect URI must be `https://<site>/api/integrations/google/callback` and `http://localhost:3000/api/integrations/google/callback` for local dev.
   - Copy the client ID/secret into `.env` as `Google_Client_ID` and `Google_secret`. Restart the dev server after changes.

3. **App Configuration**
   - `/api/integrations/google/auth-url` now only accepts same-origin redirect targets and stores the state cookie for 10 minutes.
   - `/api/integrations/google/callback` resolves the base URL at runtime, so preview deployments send you back to the page you started from.
   - Successful connects set `?googleCalendar=connected`; failures set `?googleCalendar=error&reason=...`, which surfaces through the routines UI.

4. **Validation Flow**
   - Sign in, connect the calendar, then call `GET /api/integrations/google/status` to confirm `connected: true`.
   - Run Morning Briefing / Proactive Check-in; they should mention upcoming events.
   - To reset access run `DELETE /api/integrations/google/status`, then reconnect.


