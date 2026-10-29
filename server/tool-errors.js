import { randomUUID } from "node:crypto";
import { z } from "zod";

const uuid = z.string().uuid();
const valueType = (value) =>
  value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
const knownPaths = new Set([
  "date",
  "name",
  "calories_burned",
  "workout_id",
  "request_id",
]);
const issueCodes = new Set([
  "invalid_type",
  "invalid_format",
  "too_small",
  "too_big",
  "invalid_date",
]);

export function errorContext(tool, args, correlationId = randomUUID()) {
  return {
    tool,
    request_id: uuid.safeParse(args?.request_id).success
      ? args.request_id
      : null,
    correlation_id: correlationId,
  };
}

export function validationDetails(issues, args) {
  return issues.map((issue) => {
    const value = issue.path.reduce((current, key) => current?.[key], args);
    const detail = {
      path: issue.path.join(".") || "$",
      code: issue.code,
      message:
        issue.code === "unrecognized_keys"
          ? "Remove fields that are not declared in this tool's input schema."
          : issue.message,
      received: valueType(value),
    };
    if (issue.expected) detail.expected = issue.expected;
    else if (issue.format) detail.expected = issue.format;
    for (const key of ["minimum", "maximum", "inclusive"])
      if (issue[key] !== undefined) detail[key] = issue[key];
    // Numeric bounds/lengths are useful without echoing food names or unknown fields.
    if (typeof value === "number" && Number.isFinite(value))
      detail.received_value = value;
    if (typeof value === "string") detail.received_length = value.length;
    return detail;
  });
}

export function toolError(
  context,
  code,
  message,
  details = [],
  stage = "execution",
) {
  const error = {
    code,
    message,
    details,
    request_id: context.request_id,
    correlation_id: context.correlation_id,
    stage,
  };
  // Keep JSON in TextContent too: some hosts discard structuredContent on tool errors.
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify({ error }) }],
    structuredContent: { error },
  };
}

function databaseDetails(error) {
  // Only accept our own bounded validation envelope. Never expose raw PostgREST details
  // (e.g. a failing row), SQL queries, internal constraint names or arbitrary messages.
  let parsed;
  try {
    parsed = JSON.parse(error.details || error.detail || "");
  } catch {
    return [];
  }
  if (parsed?.type !== "nutrition_validation" || !Array.isArray(parsed.issues))
    return [];
  return parsed.issues
    .slice(0, 20)
    .filter(
      (issue) =>
        issue &&
        typeof issue === "object" &&
        knownPaths.has(issue.path) &&
        issueCodes.has(issue.code),
    )
    .map((issue) => {
      const result = {
        path: issue.path,
        code: issue.code,
        message: `${issue.path}: ${
          {
            invalid_type: "unexpected value type",
            invalid_format: "invalid format",
            invalid_date: "use a valid YYYY-MM-DD calendar date",
            too_small: "value is below the permitted minimum",
            too_big: "value exceeds the permitted maximum",
          }[issue.code]
        }`,
      };
      for (const key of ["expected", "received"])
        if (
          [
            "string",
            "number",
            "object",
            "array",
            "null",
            "boolean",
            "undefined",
            "YYYY-MM-DD",
            "uuid",
          ].includes(issue[key])
        )
          result[key] = issue[key];
      for (const key of [
        "minimum",
        "maximum",
        "received_value",
        "received_length",
      ])
        if (Number.isFinite(issue[key])) result[key] = issue[key];
      if (typeof issue.inclusive === "boolean")
        result.inclusive = issue.inclusive;
      return result;
    });
}

export function executionError(context, error) {
  const code = error?.code;
  if (code === "42501")
    return toolError(context, "FORBIDDEN", "Access denied.", [], "database");
  if (
    ["42P01", "42703", "42883", "PGRST202", "PGRST204", "PGRST205"].includes(
      code,
    )
  )
    return toolError(
      context,
      "DATABASE_SETUP_REQUIRED",
      "Apply the latest migrations in the existing Supabase project. No successful storage is confirmed.",
      [],
      "database",
    );
  if (code === "22023") {
    if (error.message === "Invalid write")
      return toolError(
        context,
        "DATABASE_SCHEMA_MISMATCH",
        "The database rejected an operation supported by the published tool schema. Apply 20261029_repair_workout_writes.sql after the existing migrations.",
        [
          {
            path: "$",
            code: "unsupported_database_operation",
            message: `The installed write_nutrition RPC rejected ${context.tool} before insertion (SQLSTATE 22023).`,
          },
        ],
        "database",
      );
    const details = databaseDetails(error);
    return toolError(
      context,
      "VALIDATION_ERROR",
      details.length
        ? "Workout validation failed"
        : "The database rejected schema-valid input. Check the installed write_nutrition function and latest migrations using this correlation_id.",
      details.length
        ? details
        : [
            {
              path: "$",
              code: "database_validation",
              message:
                error.message === "Invalid workout"
                  ? "The database's workout checks rejected the supplied fields (SQLSTATE 22023)."
                  : "Database validation rejected the operation (SQLSTATE 22023); consult server diagnostics.",
            },
          ],
      "database",
    );
  }
  if (["22P02", "22007", "22008", "22003", "23502", "23514"].includes(code))
    return toolError(
      context,
      "DATABASE_VALIDATION_ERROR",
      "Database types or constraints rejected the write. Consult server diagnostics with this correlation_id.",
      [],
      "database",
    );
  if (code === "23505")
    return toolError(
      context,
      "CONFLICT",
      error.message?.includes("request_id")
        ? "request_id already used for different content. Retry identical content with the same ID, or confirm a new change with a new ID."
        : "The write conflicts with an existing record. Consult server diagnostics with this correlation_id.",
      [],
      "database",
    );
  if (code === "P0002")
    return toolError(
      context,
      "NOT_FOUND",
      "Record not found in your account.",
      [],
      "database",
    );
  return toolError(
    context,
    "INTERNAL_ERROR",
    "Operation failed. No successful storage is confirmed. Retry with the same request_id and consult server diagnostics with this correlation_id.",
    [],
    code ? "database" : "execution",
  );
}

function redact(text) {
  return String(text)
    .replace(/\bBearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
    .replace(/\beyJ[\w-]+\.[\w-]+\.[\w-]+\b/g, "[REDACTED_JWT]")
    .replace(/\b(?:postgres(?:ql)?):\/\/[^\s"']+/gi, "[REDACTED_DATABASE_URL]")
    .replace(/\bsb_(?:secret|publishable)_[\w-]+\b/g, "[REDACTED_KEY]")
    .replace(
      /\b(authorization|password|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret)\b(["'\s:=]+)[^\s,"'}]+/gi,
      "$1$2[REDACTED]",
    );
}

export function logDiagnostic(logger, context, stage, error) {
  const diagnostic = {};
  for (const key of [
    "name",
    "code",
    "message",
    "details",
    "detail",
    "hint",
    "where",
    "stack",
  ])
    if (error?.[key] !== undefined) diagnostic[key] = redact(error[key]);
  // Do not log Authorization, credentials or raw tool input.
  // Error context/stack remain server-side; redact credential-like strings defensively.
  try {
    logger({ event: "mcp_tool_error", ...context, stage, diagnostic });
  } catch {
    /* logging must not change mutation semantics */
  }
}

export const defaultLogger = (event) => console.error(JSON.stringify(event));
