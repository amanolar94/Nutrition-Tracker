# addWorkout rejection — confirmed cause and repair (MCP 3.2.1)

The exact request supplied on 2026-10-29 is valid: UUID request_id, a real calendar
date, a name within the 120-character limit, and 220 numeric active kcal. The
installed function definition supplied from the production Supabase project has
this whitelist:

```sql
p_operation not in ('addMeal','updateMeal','deleteMeal','addWeight','updateNutritionTargets')
```

It has no addWorkout/updateWorkout/deleteWorkout branches. This is the original
five-operation implementation, matching 20261014_direct_mcp_writes.sql, even though
the application advertises the newer tools and the workouts table exists. Its
first guard raises SQLSTATE 22023 / `Invalid write` before inserting a mutation
receipt or workout. The former MCP handler replaced that with `Invalid input.`,
hiding the distinction between a bad field and an outdated database RPC.

This is a database/application version mismatch, not an invalid date, UUID, calorie
value or name in the reported request. The function definition alone cannot establish
when or how it was replaced. Reapplying the old direct-write migration reproduces
this state in the test database; this does not prove that it was the production cause.

## Apply the repair

In the existing Supabase SQL Editor, apply
[20261029_repair_workout_writes.sql](../supabase/migrations/20261029_repair_workout_writes.sql)
**last**, after the existing workout, key-retirement and diary migrations.

The migration restores all current write operations, not just addWorkout. It does
not insert the historical workout, replace a database, delete records, reset targets,
change accounts or clear mutation receipts. It preserves owner checks, SECURITY DEFINER
with an empty search_path, and authenticated-only execution. Retired personal-key
RPCs remain retired. It is repeatable. A preflight check stops without changes if
prerequisite tables or the diary time column are missing.

The workout field checks collect actual database validation issues and report them
as a bounded JSON DETAIL envelope. Positive numeric active exercise kcal remain
limited to 20,000. Multiple workouts per date are allowed. Date validation uses
explicit digit classes and an actual date cast. No restrictions are weakened.

Deploy the code to the existing Vercel project. The same `/mcp/status` should show
`server_version: 3.2.1`, 20 tools and no dashboard approval. No new environment
variables, OAuth app, connection URL or authentication hook are needed. Server
status is a code check; it does not certify that the database migration was applied.
Do not rerun older migrations which replace write_nutrition after this repair.

Read-only inspection (no user records are read or written):

```sql
SELECT
  position('''addWorkout''' in p.prosrc) > 0 AS supports_add_workout,
  position('''updateWorkout''' in p.prosrc) > 0 AS supports_update_workout,
  position('''deleteWorkout''' in p.prosrc) > 0 AS supports_delete_workout,
  position('''setDayType''' in p.prosrc) > 0 AS supports_day_type,
  position('''saveMealTemplate''' in p.prosrc) > 0 AS supports_favorites,
  p.prosecdef AS security_definer,
  p.proconfig AS function_settings,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anonymous_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p
WHERE p.oid = to_regprocedure('public.write_nutrition(text,jsonb)');
```

Expected: the five support flags and authenticated_can_execute true;
anonymous_can_execute false; empty search_path. Code presence flags alone are not
a substitute for an authenticated controlled write/read test.

## Client-visible errors

The official SDK's high-level pre-validator creates plain-text errors before a
registered tool callback runs. The server now uses the SDK's documented underlying
`server.setRequestHandler(CallToolRequestSchema, ...)` API for invocation. The
same strict Zod objects are used for both advertised schemas and execution. No
validation is bypassed, coerced or duplicated in a divergent transport schema.

Expected tool failures return HTTP 200 JSON-RPC results with `isError: true`,
`structuredContent.error`, and the **same JSON envelope in TextContent**. This
keeps details usable when a host wraps tool errors or only preserves text.
[Captured official HTTP client response](workout-validation-response.json) is
from the controlled test with calories_burned deliberately changed to the string
`"220"`. That variation demonstrates invalid_type; it is not the cause of the
original valid request failing.

Each tool error includes code, message, details, request_id, correlation_id and
stage (`input`, `database` or `execution`). Multiple issues include field paths,
validation codes, expected/received types, applicable bounds and numeric values
or string lengths. Raw workout/meal names, arbitrary unknown fields, SQL details,
credentials and stack traces are not echoed. A valid originating UUID is retained;
a missing/malformed request_id returns null and still has a generated correlation ID.

| Code | Meaning |
| --- | --- |
| VALIDATION_ERROR | Actual schema/field failures; inspect stage and details |
| DATABASE_SCHEMA_MISMATCH | RPC rejected a declared operation with `Invalid write`; apply the repair |
| DATABASE_SETUP_REQUIRED | Required relation, column or function is missing |
| DATABASE_VALIDATION_ERROR | Other database type/constraint failure after schema validation |
| CONFLICT | request_id reused with changed content, or another database conflict |
| FORBIDDEN | Authenticated operation denied by permissions |
| NOT_FOUND | Record not present in the caller's account |
| INTERNAL_ERROR | Unexpected failure; storage unconfirmed, consult server logs |
| RESULT_LIMIT_EXCEEDED | Read needs a narrower date range |

Missing/invalid/revoked OAuth sessions continue to get HTTP 401 and the existing
WWW-Authenticate resource metadata challenge. The JSON body retains OAuth
`error: invalid_token` and adds `code: AUTHENTICATION_ERROR` and correlation_id.
`X-Correlation-ID` links HTTP requests to tool errors and server diagnostics.

Server logs contain error code/message, available database details/hint/context
and stack, with correlation/request IDs and stage. Raw tool input and Authorization
are not logged; credential-like strings in diagnostics are redacted. Client
responses never include raw database exceptions. Logging failure cannot turn a
committed write into a failed response.

## Verification

`npm test` includes tests that reproduce the exact production function whitelist,
observe 22023/Invalid write with no receipt, apply the repair twice, preserve an
old receipt, save/read the **exact original payload** in PGlite and retry it without
duplicates. It checks two-user isolation, changed-payload conflict, all requested
invalid field cases, multiple issues, and actual PostgreSQL insertion failure
using a test-only trigger. A failed insertion rolls back its receipt, and retrying
the same ID succeeds after the test fault is removed.

The official Streamable HTTP client and a raw JSON-RPC request verify actual
client-visible envelopes and matching HTTP correlation IDs. Database JSON DETAIL
parsing, safe fallback for legacy errors and secret redaction are also covered.
Existing meal/weight/target/day-type/favorite/energy tests remain required.

Tests use only safe local fixtures. The historical workout has **not** been added
to production. Production migration application and live deployment verification
remain separate from these local results; no Supabase admin tools are exposed to
this cloud session and the deployment hostname is blocked by the egress proxy.
