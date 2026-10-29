import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import {
  errorContext,
  validationDetails,
  toolError,
  executionError,
  logDiagnostic,
  defaultLogger,
} from "./tool-errors.js";
import { writes, rangeSchema, dateSchema } from "./schemas.js";
export const MCP_VERSION = "3.2.1";
const readAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};
const writeDetails = {
  setDayType:
    "Save rest/training day type for this date. Changes intake target selection, never maintenance or workout calories.",
  saveMealTemplate:
    "Save a favorite meal and its whole-portion macros for future reuse; pass template_id only to replace an existing favorite. Does NOT log a consumed meal. To repeat a favorite, read getMealTemplates, present portions/date/macros, obtain explicit confirmation, then call addMeal with a fresh request_id.",
  deleteMealTemplate:
    "Delete a favorite template. Previously logged meals are preserved.",
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
export function makeMcpServer(
  service,
  { correlationId, logger = defaultLogger } = {},
) {
  const handlers = new Map();
  const server = new McpServer(
    { name: "nutrition-tracker", version: MCP_VERSION },
    {
      instructions:
        "Use Europe/Athens dates. Explain nutritional estimates and ask for corrections. NEVER perform a write before explicit user confirmation such as καταχώρισέ το. After explicit confirmation, call the write tool directly. No website approval or confirmation_id is needed. Reuse request_id on retries. Never claim a write succeeded without a successful result. Include workout fueling in intake.",
    },
  );
  function register(name, schema, description, annotations, run) {
    async function invoke(
      rawArgs,
      context = errorContext(name, rawArgs, correlationId),
    ) {
      try {
        const parsed = await schema.safeParseAsync(rawArgs ?? {});
        if (!parsed.success) {
          const details = validationDetails(parsed.error.issues, rawArgs);
          logDiagnostic(logger, context, "input", {
            name: "ZodError",
            code: "VALIDATION_ERROR",
            details: JSON.stringify(details),
          });
          return toolError(
            context,
            "VALIDATION_ERROR",
            ["addWorkout", "updateWorkout"].includes(name)
              ? "Workout validation failed"
              : "Input validation failed",
            details,
            "input",
          );
        }
        const result = await run(parsed.data);
        if (Array.isArray(result) && result.length > 1000) {
          logDiagnostic(
            logger,
            context,
            "execution",
            new Error("Too many records."),
          );
          return toolError(
            context,
            "RESULT_LIMIT_EXCEEDED",
            "Too many records. Request a narrower date range.",
          );
        }
        return {
          content: [{ type: "text", text: JSON.stringify(result) }],
          structuredContent: { result },
        };
      } catch (error) {
        logDiagnostic(
          logger,
          context,
          error?.code ? "database" : "execution",
          error,
        );
        return executionError(context, error);
      }
    }
    handlers.set(name, invoke);
    server.registerTool(
      name,
      { inputSchema: schema, description, annotations },
      (args) => invoke(args),
    );
  }
  register(
    "getMealTemplates",
    z.object({}).strict(),
    "Read your favorite meal templates and portion macros. This never records intake. Present the selected template and any quantity changes, ask for explicit confirmation, then use addMeal to log it.",
    readAnnotations,
    () => service.getMealTemplates(),
  );
  register(
    "getDayTypes",
    rangeSchema,
    "Read saved rest/training selections for dates. Unspecified dates default to rest; workout logging does not automatically change day type.",
    readAnnotations,
    (args) => service.getDayTypes(args),
  );
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
  // Use the SDK's documented lower-level handler API: its high-level pre-validator
  // otherwise converts Zod failures to plain text before our callback can format them.
  // Discovery and execution both use exactly the same strict Zod schemas above.
  server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const args = request.params.arguments ?? {};
    const invoke = handlers.get(request.params.name);
    const context = errorContext(
      invoke ? request.params.name : "unknown",
      args,
      correlationId,
    );
    if (!invoke)
      return toolError(
        context,
        "TOOL_NOT_FOUND",
        "Tool not found.",
        [],
        "input",
      );
    if (request.params.task)
      return toolError(
        context,
        "INVALID_ARGUMENT",
        "This tool does not support task execution.",
        [],
        "input",
      );
    return invoke(args, context);
  });
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
