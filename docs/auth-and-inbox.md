## Gmail / Inbox OAuth Checklist

1. **Google Cloud Project**
   - Use the same Google Cloud project as Calendar (Strings project) so credentials are shared.
   - Consent Screen: External → Testing. Add your personal Gmail account under *Test users*.
   - Enable the **Gmail API** for this project.

2. **OAuth Client**
   - Reuse the existing *Web application* OAuth client used for Calendar.
   - Authorized redirect URIs must include:
     - `https://<site>/api/integrations/gmail/callback`
     - `http://localhost:3000/api/integrations/gmail/callback` for local dev.
   - Client ID / secret are already wired via:
     - `Google_Client_ID`
     - `Google_secret`

3. **App Configuration**
   - Gmail scopes are kept read-only by default for safety:
     - `https://www.googleapis.com/auth/gmail.readonly`
   - The frontend uses:
     - `POST /api/integrations/gmail/auth-url` → generates the OAuth URL and stores a short‑lived `gmail_oauth_state` cookie.
     - `GET /api/integrations/gmail/callback` → exchanges the code, stores tokens under `user_preferences.nudge_settings.assistant.gmail`, and redirects back with `?gmail=connected|error`.
   - Tokens are stored alongside Calendar in the assistant state as `{ accessToken, refreshToken, scope, tokenType, expiryDate }`.

4. **Validation Flow**
   - Sign in, then click the **Email Inbox** tile or Gmail connect button in the UI.
   - Approve the Gmail read‑only scope and return to the app.
   - Call `GET /api/integrations/gmail/status`:
     - Expect `{ connected: true, canRead: true }` when everything is configured.
   - Fetch a small inbox sample with:
     - `GET /api/integrations/gmail/threads?max=5&unreadOnly=true`
   - Fetch a specific message with:
     - `GET /api/integrations/gmail/messages/:id`

5. **Rotation & Reconnect**
   - To revoke access from the app side, call:
     - `DELETE /api/integrations/gmail/status` (this drops stored tokens from `assistant.gmail`).
   - To rotate credentials in Google Cloud:
     - Create a new client secret on the same OAuth client.
     - Update `Google_Client_ID` / `Google_secret` in `.env`.
     - Restart the dev / deployment environment.
     - Users will be asked to reconnect Gmail on next use.




