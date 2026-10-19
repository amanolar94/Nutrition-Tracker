# Upgrade the existing MCP: no dashboard approval

OAuth clients, hooks, user accounts, endpoint and existing records stay unchanged.

1. Run **only** `supabase/migrations/20261014_direct_mcp_writes.sql` in the existing
   Supabase SQL Editor (after the earlier MCP migration). It adds an idempotency
   journal and the authenticated write_nutrition RPC. No user data is deleted.
   Old draft functions are retired; historical drafts remain stored.
2. Deploy this commit through the existing Vercel project.
3. Refresh the existing plugin's MCP tool discovery (reconnect if needed) to remove
   prepareWrite/getWriteDraft and confirmation_id. Update the EXISTING plugin skill
   using `docs/plugin-instructions.md`; do not create a second plugin.
4. In ChatGPT, analyze a meal and inspect estimates without saving. After explicit
   “καταχώρισέ το”, call addMeal directly. Verify getMeals and the dashboard show it.

All five write tools require request_id and host/user confirmation, but no dashboard
approval. Read tools are unchanged and getWeeklySummary was added. Weekly summaries
cover Monday–Sunday in the Europe/Athens calendar, include daily averages, all macros
and a separate fueling subtotal (already included once in total intake).

The API cannot inspect the ChatGPT transcript; explicit conversational confirmation
is enforced by plugin instructions and host tool safeguards, not fabricated evidence
in a request field. The server continues enforcing OAuth identity, ownership,
validation and idempotency. Tests simulate invocation after confirmation; they do
not establish that a real ChatGPT host requested it. Live tests still require access
to the deployed endpoint and a dedicated test account.

## Diagnose a stale tool list

Open `https://nutrition-tracker-gamma-flax.vercel.app/mcp/status` after deployment.
The response derives its tool names and required fields from actual MCP SDK discovery
in that running server, without reading user data. With the workout upgrade: server_version 3.1.0,
tool_count 15, dashboard_approval_required false. commit is the Vercel Git commit SHA
when provided by the platform. This checks deployed code, not migration readiness.
If it is 404/401 or older, verify the active Vercel Production deployment and root
URL. If it is current but ChatGPT still lists prepareWrite, check the configured MCP
URL and refresh/reconnect the existing connection in a new conversation. Plugin
package version 0.2.3 is independent from server_version and is not evidence of
which code is serving /mcp. A database migration cannot change tools/list schemas.

For the current workout/energy feature, also apply the new additive migration
after the direct-write upgrade: [WORKOUT_ENERGY.md](WORKOUT_ENERGY.md).
