# Supabase Security Advisor: personal-key Action retirement

The user confirmed that the old GPT Action with personal keys is no longer used.
The application now uses the existing OAuth MCP connection for ChatGPT writes.

## Apply the retirement

In the existing Supabase SQL Editor, run
[`20261019_retire_personal_keys.sql`](../supabase/migrations/20261019_retire_personal_keys.sql)
**last**, after the earlier ChatGPT/MCP/function-privilege migrations. It revokes
`PUBLIC`, `anon` and `authenticated` execution of both legacy `add_chatgpt_meal*`
functions and revokes INSERT/UPDATE on `chatgpt_keys`. Older browser clients also
lose the ability to create keys. Do not rerun earlier migrations that grant these
permissions afterwards.

Deploy the same repository through the existing Vercel project. `/api/meals`
returns **410 Gone** without inspecting credentials/payloads or accessing storage.
It does not redirect old writes to MCP. The old public Action schema has no
operations, and its instructions direct users to the existing OAuth MCP connection.
The site no longer shows personal-key controls or requests key metadata. Existing
owner-only SELECT/DELETE table permissions are retained for administrative cleanup.
Current app access can be revoked under Account → Connected apps.

The migration preserves meals, workouts, weights, goals, maintenance settings,
personal-key hashes, mutation receipts and OAuth configuration. It does not change
`write_nutrition`, MCP tools, browser sign-in or ownership policies. No new site,
plugin, OAuth client or environment variables are required.

## Expected Advisor results

| Finding | Current behavior |
| --- | --- |
| `anon` or `authenticated` can execute `add_chatgpt_meal*` | These warnings should disappear after the final migration. Even a valid old personal key cannot execute either function through those roles. |
| `authenticated` can execute `write_nutrition` | Intentional and required. The RPC requires `auth.uid()`, checks ownership and uses a private, per-user idempotency journal. `PUBLIC`/`anon` execution remains revoked. SECURITY INVOKER would prevent journal-backed writes. |
| Leaked Password Protection disabled | Enable separately in Supabase Authentication password/security settings if supported by the current plan. SQL cannot change this Auth setting. It concerns checks of new/changed passwords against known leaks. |

The original six-warning report was first reduced to four by
`20261019_function_privileges.sql`, which retained the then-supported REST Action.
That is a historical migration. The new retirement migration removes the remaining
two legacy-function warnings, leaving the intentional MCP function warning and,
if still disabled, the leaked-password warning. This does not establish that the
whole Supabase project is free from security issues.

## Verification

`npm test`, `npm run build`, `npm run test:browser`.

Tests use PostgreSQL/PGlite with Supabase-compatible roles and claims, the official
MCP SDK and Chromium with a simulated Supabase HTTP bridge. They cover 410 without
storage access, legacy RPC denial even with valid keys, prevention of key creation,
owner-only database cleanup, preserved records/receipts, anonymous rejection, per-user
isolation and working MCP meal/workout workflows and dashboard updates after the
retirement migration. The older grant test verifies historical SQL behavior before
retirement; current behavior is covered in `retire-personal-keys.test.js`.

This environment has no callable Supabase management connector or management
credentials. Live migration application, password-setting changes and refreshed
Advisor results require the existing Supabase dashboard. Local tests do not verify
live OAuth, Vercel publication or ChatGPT host confirmation.
