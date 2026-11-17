# Nutrition Tracker

A nutrition and workout tracking application built with React, Supabase Auth and
PostgreSQL. Log meals and workouts through ChatGPT using a remote MCP server, then
review your results in a responsive dashboard available in Greek and English.

[Live application](https://nutrition-tracker-gamma-flax.vercel.app/) — sign-in required.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` once in the SQL Editor. It creates the base tables and
   Row Level Security policies so users can access only their own records. For the
   current nutrition fields, workouts, favorites and MCP integration, also apply
   the migrations in the order specified in [MCP_SETUP.md](docs/MCP_SETUP.md).
   Apply `20261029_repair_workout_writes.sql` last; do not rerun older migrations
   that replace `write_nutrition` after it.
3. Under **Authentication → Sign In / Providers → Email**, enable email/password
   sign-in and disable **Allow new users to sign up**. The application supports
   sign-in for existing users only. Create accounts under **Authentication → Users
   → Add user → Create new user**, setting an email and password and confirming
   the email where needed.
4. Under **Authentication → URL Configuration**, set the Site URL and allowed
   redirect URL to `https://nutrition-tracker-gamma-flax.vercel.app/`. Add
   `http://localhost:5173/` for local development.
5. Copy `.env.example` to `.env.local` and enter your project URL and **publishable
   key**. Never put a `service_role` or secret key in the frontend. Variables
   prefixed with `VITE_` are public and included in the build. Configure the same
   variables under **Environment Variables** in Vercel.
6. Restart the development server or rebuild after changing environment variables.
   Google OAuth credentials are not required for email/password sign-in.

Requires Node.js **22.12+ or 24**.

```sh
npm ci --cache /tmp/nutrition-npm-cache
npm run dev
```

`npm run dev` serves the frontend. See the MCP setup guide for serverless API
routing, backend environment variables and OAuth configuration.

## Verification

```sh
npm test
npm run build
npm run test:browser
```

For live acceptance testing, sign in with an existing email/password account, add
a meal, update targets and reload. Check the same data in another browser. Use a
second account to verify that it cannot read or modify the first account's
records, including through direct API requests.

Local tests use PostgreSQL/PGlite fixtures and simulated Supabase HTTP/OAuth.
They do not establish that the live ChatGPT connection, Supabase OAuth settings
or Vercel deployment are configured correctly.

## Data storage

Meals, targets, weight measurements, workouts, maintenance settings, favorites
and day types are stored per user in Supabase. The Supabase SDK keeps the sign-in
session in the browser. Email/password authentication is handled by Supabase Auth;
the password is sent to Supabase for verification and is not stored in meal tables
or the application's localStorage.

Records from the first version remain in localStorage under
`nutrition-tracker-v1`. They are not automatically transferred to an account or
deleted by the current version.

If Supabase is not configured, the application displays a message that sign-in
has not been enabled. Default nutrition targets are provisional. Meals can be
entered through the configured ChatGPT connection or manually in the dashboard.

## Logging through ChatGPT

The application uses the existing Nutrition Tracker MCP/OAuth connection.
The old GPT Action using personal keys has been retired: `/api/meals` returns
HTTP 410, and the legacy OpenAPI specification no longer exposes write operations.

The `supabase/migrations/20261019_retire_personal_keys.sql` migration disables
legacy Supabase RPCs and personal-key creation. Apply it after the earlier grant
migrations, followed by the newer diary and workout repair migrations in the
setup guide. Existing meals and stored key hashes are preserved. Personal-key
controls have been removed from the website. Revoke OAuth app access under
**Settings → Account → Connected apps**.

## Remote MCP server on the same site

The `/mcp` endpoint uses the official MCP SDK, stateless Streamable HTTP and
Supabase OAuth 2.1. Its 20 tools cover meals with all macronutrients, workout
fueling, workouts, weight history, favorites, day types and rest/training targets.
Writes require explicit confirmation in ChatGPT, with no second approval step in
the dashboard. A per-user `request_id` makes retries idempotent.

- [Migration, OAuth, Vercel and existing-plugin setup; live acceptance checks](docs/MCP_SETUP.md)
- [MCP input schemas](docs/mcp-tools.json)
- [Instructions for the existing plugin](docs/plugin-instructions.md)
- [Upgrading an existing MCP integration to direct writes without drafts](docs/DIRECT_WRITES_UPGRADE.md)

Apply the required migrations to enable the newer fields and tools. While database
setup is pending, the dashboard falls back to legacy queries to preserve sign-in,
meal records and calorie/protein targets where supported.

## Mobile dashboard

The dashboard has **Day**, **Week**, **Progress** and **Settings** views. Mobile
navigation sits at the bottom of the screen. Meals are grouped by category,
weekly bars open the corresponding day's diary, and the **+** button opens manual
entry. See [UX_NOTES.md](docs/UX_NOTES.md) for design choices and verification.

## Workout calories and energy balance

Add, edit and delete workouts through ChatGPT/MCP or the dashboard, recording
active exercise calories only. Daily and weekly views show an estimated deficit
or surplus relative to maintenance excluding logged exercise, independently of
food intake targets. Days without meals do not create an artificial deficit.

This requires `20261019_workout_energy.sql`, the subsequent migrations and an
explicitly saved maintenance estimate from Settings or MCP. See
[WORKOUT_ENERGY.md](docs/WORKOUT_ENERGY.md) for setup, tools and calculations.

## Supabase Security Advisor

The `20261019_retire_personal_keys.sql` migration removes access to the legacy
REST functions and disables personal-key creation. `write_nutrition` remains
available only to authenticated users, with ownership checks and idempotency.
Its associated SECURITY DEFINER warning is expected. Leaked password protection
is enabled separately in Supabase Auth. See
[SECURITY_ADVISOR.md](docs/SECURITY_ADVISOR.md) for findings and configuration steps.

## Diary and favorites — MCP 3.2.0

The diary includes a compact overview, daily/weekly energy balance, meal filters,
optional meal times, editing, favorites and repeat-meal drafts for review before
saving. Day types are stored per date, and rest/training targets can be compared
side by side. Favorites and day types are also available through MCP.

These features require `20261020_diary_usability.sql`, followed by the latest
workout repair migration. See [DIARY_USABILITY.md](docs/DIARY_USABILITY.md) for
activation instructions and tool details.

## addWorkout repair — MCP 3.2.1

An outdated `write_nutrition` function could reject valid workouts with
`22023 / Invalid write`. The `20261029_repair_workout_writes.sql` migration restores
the current operations while preserving stored data. MCP errors now return
structured validation details and a correlation ID in JSON. See
[WORKOUT_VALIDATION_FIX.md](docs/WORKOUT_VALIDATION_FIX.md) for the confirmed cause,
repair instructions and test results.

## Greek / English

Switch with **EN / EL** in the header, sign-in screens or forms. The language is
remembered on each device. All dashboard views, forms, errors, OAuth consent and
privacy information are available in English. Dates and numbers follow the
selected locale; saved data and the Europe/Athens tracking calendar stay the same.
No database migration is needed for language support. See
[LANGUAGES.md](docs/LANGUAGES.md) for the translation guide and tests.
