import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { writes, rangeSchema, dateSchema } from "./schemas.js";
export const MCP_VERSION = "3.1.0";
const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const writeDetails = {
  addMeal:
    "Save the confirmed meal with macros for the total portion consumed.",
  updateMeal: "Replace a meal; retrieve it first and confirm all final fields.",
  deleteMeal:
    "Permanently delete the specified meal from the signed-in account.",
  addWeight:
    "Record weight in kg; replaces any existing measurement for the same date.",
  updateNutritionTargets:
    "Update rest/training intake goals. These are not maintenance expenditure.",
  addWorkout:
    "Log active exercise calories only, excluding resting energy. Supports multiple workouts per day. Never use total daily burn or workout fueling as exercise calories.",
  updateWorkout:
    "Replace a workout; retrieve it first and confirm full date, name and active exercise calories.",
  deleteWorkout:
    "Permanently delete a workout; its burned calories are removed from the energy balance.",
  updateEnergySettings:
    "Set daily maintenance excluding separately logged exercise, or null to clear it. Not BMR, intake target, or exercise-inclusive TDEE. This recalculates historical balances with the new baseline. Never infer this from intake goals.",
};
export function makeMcpServer(service) {
  const server = new McpServer(
    { name: "nutrition-tracker", version: MCP_VERSION },
    {
      instructions:
        "Use Europe/Athens dates. Explain nutritional estimates and ask for corrections. NEVER perform a write before explicit user confirmation such as καταχώρισέ το. After explicit confirmation, call the write tool directly. No website approval or confirmation_id is needed. Reuse request_id on retries. Never claim a write succeeded without a successful result. Include workout fueling in intake.",
    },
  );
  function register(name, schema, description, annotations, run) {
    server.registerTool(
      name,
      { inputSchema: schema, description, annotations },
      async (args) => {
        try {
          const result = await run(args);
          if (Array.isArray(result) && result.length > 1000)
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: "Too many records. Request a narrower date range.",
                },
              ],
            };
          return {
            content: [{ type: "text", text: JSON.stringify(result) }],
            structuredContent: { result },
          };
        } catch (error) {
          const code = error?.code;
          const message =
            code === "42501"
              ? "Access denied."
              : ["42P01", "42703", "PGRST204", "PGRST205"].includes(code)
                ? "Database setup is pending. Apply the workout/energy migration in the existing Supabase project. No successful storage is confirmed."
                : code === "22023"
                  ? "Invalid input."
                  : code === "23505"
                    ? "request_id already used for different content."
                    : code === "P0002"
                      ? "Record not found in your account."
                      : "Operation failed. No successful storage is confirmed. Check database setup and retry with the same request_id.";
          return { isError: true, content: [{ type: "text", text: message }] };
        }
      },
    );
  }
  register(
    "getMeals",
    rangeSchema,
    "Read meals for one date or an inclusive range (max 366 days, max 1000 records).",
    readAnnotations,
    (args) => service.getMeals(args),
  );
  register(
    "getDailySummary",
    z.object({ date: dateSchema }).strict(),
    "Daily macros, fueling and estimated energy balance: food minus (maintenance excluding exercise + logged active workout calories). Negative balance means deficit. Based on logged records, not guaranteed complete. Null balance when maintenance is unset, no meals exist, or date is in the future. setup_required means the energy migration is pending.",
    readAnnotations,
    (args) => service.getDailySummary(args),
  );
  register(
    "getWeeklySummary",
    z.object({ date: dateSchema }).strict(),
    "Monday–Sunday macros, fueling and estimated energy balance with daily breakdown. Balance includes only non-future days with logged meals and configured maintenance. Report included_days, excluded_dates and partial coverage, never treat unlogged days as zero intake. Historical balances use the current maintenance setting.",
    readAnnotations,
    (args) => service.getWeeklySummary(args),
  );
  register(
    "getWorkouts",
    rangeSchema,
    "Read workouts and active exercise calories for one date or inclusive range. Multiple workouts per date are supported. Workout fueling is food intake, not calories burned.",
    readAnnotations,
    (args) => service.getWorkouts(args),
  );
  register(
    "getWeightHistory",
    rangeSchema,
    "Read recorded weights in kg. Provisional starting weight is not an invented record.",
    readAnnotations,
    (args) => service.getWeightHistory(args),
  );
  register(
    "getNutritionTargets",
    z.object({}).strict(),
    "Read editable rest-day/training-day intake targets and energy_settings.maintenance_calories (daily maintenance excluding logged exercise, null until explicitly set). Intake targets are not maintenance.",
    readAnnotations,
    () => service.getNutritionTargets(),
  );
  for (const [name, schema] of Object.entries(writes)) {
    register(
      name,
      schema,
      `${writeDetails[name]} Execute ONLY after the user explicitly confirms this exact change in ChatGPT. Save immediately without dashboard approval. Reuse request_id and identical values on retries.`,
      {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
      (args) => service.write(name, args),
    );
  }
  return server;
}

export async function describeMcp() {
  const server = makeMcpServer({});
  const client = new Client({ name: "public-version-check", version: "1" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(b);
    await client.connect(a);
    const { tools } = await client.listTools();
    return {
      server_version: MCP_VERSION,
      tool_count: tools.length,
      tools: tools.map((t) => ({
        name: t.name,
        required: t.inputSchema.required || [],
      })),
      dashboard_approval_required: tools.some(
        (t) =>
          t.name === "addMeal" &&
          t.inputSchema.required?.includes("confirmation_id"),
      ),
    };
  } finally {
    await client.close();
    await server.close();
  }
}
