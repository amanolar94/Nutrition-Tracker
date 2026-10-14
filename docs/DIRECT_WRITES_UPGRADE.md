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
