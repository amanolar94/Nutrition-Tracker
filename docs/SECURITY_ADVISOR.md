# Supabase Security Advisor: function permissions

The report supplied on 2026-10-19 contains six warnings, not evidence of a confirmed
compromise. Check the authorization implemented inside each SECURITY DEFINER
function before changing its grants or execution mode.

Apply `supabase/migrations/20261019_function_privileges.sql` after the previous
ChatGPT/MCP migrations in the existing Supabase SQL Editor. It is repeatable and
preserves records, keys, accounts, OAuth and mutation receipts. No application
redeployment is required for this permissions-only migration.

| Finding | Resolution |
| --- | --- |
| `authenticated` can execute `add_chatgpt_meal` and `add_chatgpt_meal_v2` (two warnings) | Removed. `/api/meals` uses a stateless publishable-key client under `anon`; it does not forward a browser JWT. The authenticated-role grants are unnecessary for this supported path. |
| `anon` can execute `add_chatgpt_meal*` (two warnings) | Intentional for the existing personal-key REST Action. These functions require a valid, unexpired personal `nt_…` key, match its SHA-256 hash and derive ownership from that key. An anonymous Supabase role does not imply an unauthenticated application write. Invalid/expired/revoked keys cannot write; no meal/key table reads are granted. |
| `authenticated` can execute `write_nutrition` (one warning) | Intentional. This RPC requires `auth.uid()`, scopes every mutation/receipt to that user and prevents duplicate requests. It needs SECURITY DEFINER to access the private journal. `PUBLIC`/`anon` execution stays revoked. Switching to SECURITY INVOKER would break journal-backed writes. |
| Leaked password protection disabled (one warning) | Enable in the existing Supabase dashboard: Authentication → Settings/Security and Protection → Password Security → Leaked Password Protection (labels may vary). Supabase offers this setting on eligible paid plans; if unavailable on the current plan, the SQL migration cannot enable it. It checks new/changed passwords against known leaks; it does not mean that a leak was detected or that all existing passwords were scanned. |

After applying the permissions migration, rerun Security Advisor. The two
authenticated legacy-function warnings should disappear. The three intentional
function warnings remain while both supported authentication paths exist. Record
them as reviewed if the dashboard offers that option; keep their required grants.
Do not disable the REST functions merely to clear the warning list while clients
still use personal-key Actions. Retiring that integration is a separate change.

The SQL migration cannot change Supabase Auth password settings. This environment
has no callable Supabase management connector or management credentials, so the
live migration, Auth setting and refreshed Advisor results require dashboard access.

Verification uses PostgreSQL/PGlite with Supabase-compatible roles and claims:
function grants/search_path, missing/invalid/expired/revoked keys, real REST handler
through a SQL-backed adapter, per-user ownership, unauthenticated MCP rejection,
idempotency, mutation-journal privacy and preservation of existing records/receipts.
Run `node --test tests/function-privileges.test.js` or `npm test`.
