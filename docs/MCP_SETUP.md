# Remote MCP for the existing Nutrition Tracker

Endpoint after deployment: **https://nutrition-tracker-gamma-flax.vercel.app/mcp**.
This extends the existing Vite/React app, Vercel project and Supabase database.
It does not create another website or plugin.

## What has and has not been verified

The official MCP SDK runs in stateless Streamable HTTP mode with JSON responses,
so it does not rely on in-memory sessions surviving Vercel invocations. Local tests
use the official SDK client over HTTP, signed JWTs and PostgreSQL (PGlite) with
Supabase-compatible role/claim fixtures. Browser tests exercise the actual SQL
functions and dashboard through a simulated Supabase HTTP bridge.

These tests do **not** prove the live Supabase OAuth configuration, Vercel deployment,
or the private ChatGPT plugin connection works. Those require the setup and live
checks below. The cloud proxy has returned 403 for the deployed hostname.

## 1. Apply additive database changes

In the existing Supabase project's SQL Editor, with `schema.sql` and
`20261014_chatgpt_actions.sql` already applied, run:

- `supabase/migrations/20261014_mcp.sql`
- `supabase/migrations/mcp_access_token_hook.sql`
- `supabase/migrations/20261014_direct_mcp_writes.sql`
- `supabase/migrations/20261019_workout_energy.sql` (workouts and energy balance)

The migration preserves meals/goals and existing user sign-in. Carbs/fat on old
meals remain NULL (unknown), not invented nutritional values. The UI flags incomplete
macro totals. There is no fabricated 100 kg measurement; 100 kg is the initial
reference, and actual weight history starts with confirmed entries.

Default rest targets: 2200 kcal / 180 g protein / 220 g carbs / 67 g fat.
Default training targets: 2700 kcal / 180 g protein / 320 g carbs / 78 g fat.
Existing saved calorie/protein goals are preserved. Both target sets are editable.

OAuth sessions can read only their user's rows, but cannot directly write meal,
goal, weight or personal-key tables. Direct writes use a transaction RPC with explicit owner checks and a locked,
user-scoped request_id journal storing retry results. Old drafts remain archived.
The existing personal-key REST Action remains add-only and separate from MCP.

## 2. Enable Supabase OAuth 2.1

In Authentication → OAuth Server:

1. Enable OAuth Server.
2. Set Authorization Path to `/oauth/consent`.
3. Set Site URL in URL Configuration to `https://nutrition-tracker-gamma-flax.vercel.app`.
4. Use asymmetric JWT signing keys (ES256 or RS256). MCP rejects HS256 and
   resource-unbound tokens; no JWT signing secret is copied to Vercel.
5. Register an OAuth client for the existing Nutrition Tracker ChatGPT connection.
   Use the exact callback/redirect URI shown by ChatGPT's connection editor.
   Prefer a public client with mandatory PKCE when the editor supports it. If it
   requires a confidential client, store its secret only in ChatGPT's secure OAuth
   client configuration. Never put it in frontend variables or conversation text.
6. Register this client ID for the resource audience hook:

```sql
insert into public.nutrition_mcp_clients(client_id)
values ('YOUR-OAUTH-CLIENT-UUID') on conflict do nothing;
```

7. In Authentication → Hooks, enable `public.nutrition_mcp_access_token_hook`
   as the Custom Access Token Hook. If another hook exists, **merge the audience
   rule into it**, retaining the existing logic; do not blindly replace it.
   Only allowlisted client IDs receive `aud = https://nutrition-tracker-gamma-flax.vercel.app/mcp`.
   Direct website sessions and other OAuth clients retain their original audiences.

Supabase handles authorization codes, PKCE, token issuance, refresh rotation and
client registration. The app only implements the consent UI and protected resource.
Scopes `openid email profile` describe identity; database authorization is enforced
by ownership/RLS, not those scopes.

Optional dynamic registration: Supabase supports DCR, but each resulting ChatGPT
client ID still needs to be allowlisted above before its token can access this MCP
resource. Pre-registration avoids that extra step. Do not expose a registration
proxy or grant unrestricted clients an audience automatically.

Discovery:

- App protected resource: `/.well-known/oauth-protected-resource/mcp`
- Supabase issuer: `https://PROJECT.supabase.co/auth/v1`
- AS metadata: `https://PROJECT.supabase.co/.well-known/oauth-authorization-server/auth/v1`
- Authorize: `https://PROJECT.supabase.co/auth/v1/oauth/authorize`
- Token: `https://PROJECT.supabase.co/auth/v1/oauth/token`
- JWKS: `https://PROJECT.supabase.co/auth/v1/.well-known/jwks.json`

MCP checks JWT signature, issuer, resource audience, expiry, OAuth client and user
identity, then calls Supabase Auth `getUser` to validate the live session. A
user-scoped Supabase client forwards this project's OAuth token only to this
project's Supabase APIs. No service-role key or personal action key is accepted
as MCP authentication.

## 3. Vercel settings and deployment

The existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` work for both
frontend and server configuration. Optional server overrides:
`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.

`MCP_SITE_URL` defaults to the existing production URL; if changed, also change
the resource audience in the token hook and OAuth settings to match exactly.
Optional `MCP_ALLOWED_CLIENT_IDS` is a comma-separated additional server allowlist.
Never set these server-only options with a VITE_ prefix.

`vercel.json` routes `/mcp` to the Node serverless function, publishes resource
metadata, and serves `/oauth/consent` from the existing SPA. Deploy this repository
to the existing Vercel project. No new infrastructure is required. If your Supabase
project does not offer OAuth Server, stop here: personal bearer keys do not substitute
for a ChatGPT OAuth connection. Another authorization server would be a separate
architecture decision; it has not been introduced.

## 4. Connect the existing private ChatGPT Nutrition Tracker plugin

Edit **that existing plugin's MCP server configuration**; do not create a new
Nutrition Tracker plugin. Add the remote URL above and choose OAuth authentication.
Provide the pre-registered OAuth client ID (and secure secret only if the editor
requires it). Resource/authorization metadata is discovered from the endpoint.
Sign in with the same email/password used on the website and review the app's
consent screen. The editor's precise controls depend on your ChatGPT workspace;
if the existing plugin editor cannot attach remote MCP servers, that UI capability
must be enabled by the workspace owner. Code cannot modify an unavailable editor.

Update the existing plugin skill with `docs/plugin-instructions.md`: the old skill
says carbs/fat cannot be saved, which is now obsolete. Keep the same plugin identity.
The old REST GPT Action can remain for compatibility, but use MCP for this workflow
for the direct-write tools and host confirmation safeguards. Do not put a personal REST key in the
MCP connection.

## 5. Confirmation workflow (single confirmation in ChatGPT)

1. Discuss food/photos and quantities; show calories/protein/carbs/fat and uncertainty.
2. Ask for corrections and wait for explicit confirmation, e.g. **καταχώρισέ το**.
3. Call the corresponding write tool directly with a fresh UUID request_id.
4. On success the data is immediately saved. The dashboard updates on tab return
   or refresh. There is no draft or website approval.
5. Reuse the same request_id and identical content on retries. Changed content
   with an existing request_id is rejected. Editing, deleting, weights and targets
   require their own explicit confirmation too.

The host/model must enforce conversational confirmation. The server does not
receive the conversation and cannot independently prove that a user said “save”.
Write tools are marked readOnlyHint=false, destructiveHint=true,
idempotentHint=true so the host can apply confirmation safeguards. The plugin
instructions forbid writes during analysis and before explicit confirmation.
Authentication, ownership, strict validation and request_id idempotency are still
server/database-enforced. Do not claim conversational confirmation was verified
by local protocol tests or by SQL.

## Tools and schemas

Full machine-readable input schemas and annotations: `docs/mcp-tools.json`
(regenerate with `npm run mcp:schemas`). Dates use Europe/Athens.

| Tool | Input |
| --- | --- |
| addMeal | request_id, date, name, category, calories, protein, carbs, fat |
| getMeals | date OR start_date + end_date |
| getDailySummary | date |
| getWeeklySummary | date (Monday–Sunday week containing it) |
| updateMeal | request_id, meal_id, full meal fields |
| deleteMeal | request_id, meal_id |
| addWeight | request_id, date, weight_kg (20–500) |
| getWeightHistory | date OR start_date + end_date |
| getNutritionTargets | empty object; includes energy_settings.maintenance_calories |
| getWorkouts | date OR start_date + end_date |
| addWorkout | request_id, date, name, calories_burned (active exercise kcal, >0 and ≤20,000) |
| updateWorkout | request_id, workout_id, date, name, calories_burned |
| deleteWorkout | request_id, workout_id |
| updateEnergySettings | request_id, maintenance_calories (500–10,000 or null); excludes logged exercise |
| updateNutritionTargets | request_id, rest, training; each target set has calories/protein/carbs/fat |

Categories preserve the existing Greek values: `Πρωινό`, `Μεσημεριανό`, `Βραδινό`,
`Σνακ`, plus `Τροφοδοσία προπόνησης` for gels/drinks/other workout fuel. Fueling is
included in totals exactly once and returned as a separate breakdown.
Read ranges are inclusive, at most 366 days and 1000 records. Narrow larger queries.
`updateMeal` replaces the full meal; fetch the record first and confirm exact values.
`addWeight` upserts the user's measurement for the date, rather than storing duplicates.
Writes have readOnlyHint=false, destructiveHint=true, idempotentHint=true.

Workout setup, energy balance semantics and additional acceptance checks:
[WORKOUT_ENERGY.md](WORKOUT_ENERGY.md). Maintenance is unset until explicitly saved;
the user-provided 2000 kcal is a form proposal. Food goals are not maintenance.

## 6. Required live acceptance checks

Use a dedicated **test account**, not existing personal meal history. Do not paste
tokens or passwords into chat or logs.

1. Request resource metadata and unauthenticated `/mcp`: valid metadata and 401
   with WWW-Authenticate are expected.
2. Connect using the official MCP client or ChatGPT; initialize and list all 15 tools.
3. Sign in to two test accounts. Verify each sees only its own meals,
   weights and targets. Wrong-project/audience, expired, revoked and anonymous
   tokens must fail.
4. Analyze/display a meal without invoking a write; verify no new row exists.
   After explicit ChatGPT confirmation, call addMeal directly and verify all four
   macros in getMeals and the dashboard, without any website approval.
5. Repeat the same request_id; verify only one row exists. Reuse it with changed
   content and verify rejection.
6. Retrieve meals, daily/weekly summaries; verify workout fuel counted once.
7. Confirm and execute updateMeal and deleteMeal; verify dashboard changes.
8. Confirm weight and rest/training targets; verify dashboard and read tools.
9. Anonymous writes and attempts to update/delete another user's meal must fail.
   OAuth tokens still cannot directly write tables, only authenticated mutation RPCs.
10. Revoke OAuth access from the dashboard; refreshed/session access must fail.

Read-only deployed smoke check: `npm run mcp:verify-live`. It checks metadata and anonymous rejection. Authenticated discovery requires a test OAuth token supplied securely in MCP_TEST_ACCESS_TOKEN; this script never writes records or prints tokens. It does not replace the live write/isolation checklist.

Local verification:

```sh
npm ci --cache /tmp/nutrition-npm-cache
npm test
npm run build
npm run test:browser
```

Browser tests use system Chromium if present. Otherwise run `npx playwright install
chromium` first; set PLAYWRIGHT_CHROMIUM_EXECUTABLE for a custom browser location.
`npm run dev` serves only the frontend. Use `vercel dev` for the complete serverless
routing or test the existing production deployment. Apply database migrations before using new features. The dashboard falls back to
legacy meal/goal queries until the new columns/tables exist, keeping old login and
manual calories/protein entry working. MCP remains unavailable until its migration.
