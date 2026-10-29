import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { database, identity, userA, userB, meal } from "./helpers/database.js";
import { databaseClient } from "./helpers/client.js";
import { nutritionService } from "../server/nutrition-service.js";
import { makeHandler } from "../api/mcp.js";
import {
  executionError,
  errorContext,
  logDiagnostic,
} from "../server/tool-errors.js";

const exact = {
  request_id: "f4d7e4bd-6f43-4d9b-a8cb-1ceffbbbe270",
  date: "2026-10-29",
  name: "Day 2 unilateral - stabilisation (Hevy, 50:36, estimated active kcal)",
  calories_burned: 220,
};
async function migrate(db, file) {
  await db.exec("reset role");
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/" + file, import.meta.url),
      "utf8",
    ),
  );
}
async function setup() {
  const db = await database();
  for (const file of [
    "20261014_direct_mcp_writes.sql",
    "20261019_workout_energy.sql",
    "20261019_function_privileges.sql",
    "20261019_retire_personal_keys.sql",
    "20261020_diary_usability.sql",
  ])
    await migrate(db, file);
  return db;
}
function visibleError(result) {
  assert.equal(result.isError, true);
  const envelope = JSON.parse(result.content[0].text);
  assert.deepEqual(envelope, result.structuredContent);
  assert.match(envelope.error.correlation_id, /^[0-9a-f-]{36}$/);
  assert.ok(Array.isArray(envelope.error.details));
  return envelope.error;
}

test("exact production RPC drift is reproduced and repaired; official HTTP client sees structured validation, safe errors and idempotency", async () => {
  const db = await setup(),
    logs = [];
  const service = nutritionService(databaseClient(db, userA), userA);
  const oldMeal = meal();
  const preserved = await service.write("addMeal", oldMeal);
  // Reproduce the function definition supplied from production: original five writes.
  await migrate(db, "20261014_direct_mcp_writes.sql");
  const handler = makeHandler(
    async (token) => {
      const userId =
        token === "test-a" ? userA : token === "test-b" ? userB : null;
      if (!userId) throw Error("Invalid OAuth token");
      return { userId, client: databaseClient(db, userId) };
    },
    { logger: (event) => logs.push(event) },
  );
  const server = http.createServer(async (req, res) => {
    if (req.method === "POST") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      req.body = JSON.parse(raw);
    }
    await handler(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = new URL(`http://127.0.0.1:${server.address().port}/mcp`);
  const a = new Client({ name: "validation-a", version: "1" }),
    b = new Client({ name: "validation-b", version: "1" });
  const call = (client, name, args) =>
    client.callTool({ name, arguments: args });
  try {
    for (const tool of ["addWorkout", "updateWorkout", "deleteWorkout"]) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: tool, arguments: exact },
        }),
      });
      assert.equal(response.status, 401);
      const result = await response.json();
      assert.equal(result.code, "AUTHENTICATION_ERROR");
      assert.equal(
        result.correlation_id,
        response.headers.get("X-Correlation-ID"),
      );
    }
    for (const [client, token] of [
      [a, "test-a"],
      [b, "test-b"],
    ])
      await client.connect(
        new StreamableHTTPClientTransport(url, {
          requestInit: { headers: { Authorization: `Bearer ${token}` } },
        }),
      );
    const tools = (await a.listTools()).tools;
    assert.equal(tools.length, 20);
    const schema = tools.find((t) => t.name === "addWorkout").inputSchema;
    assert.deepEqual(schema.required, [
      "request_id",
      "date",
      "name",
      "calories_burned",
    ]);
    assert.equal(schema.properties.calories_burned.type, "number");
    assert.equal(schema.properties.calories_burned.maximum, 20000);
    assert.equal(schema.properties.name.maxLength, 120);
    const stale = visibleError(await call(a, "addWorkout", exact));
    assert.equal(stale.code, "DATABASE_SCHEMA_MISMATCH");
    const staleRetry = visibleError(await call(a, "addWorkout", exact));
    assert.equal(staleRetry.code, "DATABASE_SCHEMA_MISMATCH");
    assert.equal(staleRetry.request_id, stale.request_id);
    assert.notEqual(staleRetry.correlation_id, stale.correlation_id);
    assert.equal(stale.stage, "database");
    assert.equal(stale.request_id, exact.request_id);
    assert.equal(logs.at(-1).diagnostic.message, "Invalid write");
    assert.equal(logs.at(-1).diagnostic.code, "22023");
    assert.deepEqual(
      (await call(a, "getWorkouts", { date: exact.date })).structuredContent
        .result,
      [],
    );
    await db.exec("reset role");
    assert.equal(
      (
        await db.query(
          "select * from public.nutrition_mutations where request_id=$1",
          [exact.request_id],
        )
      ).rows.length,
      0,
    );

    await migrate(db, "20261029_repair_workout_writes.sql");
    await migrate(db, "20261029_repair_workout_writes.sql"); // Repeatable; preserve existing receipts.
    assert.deepEqual(await service.write("addMeal", oldMeal), preserved);
    const saved = await call(a, "addWorkout", exact);
    assert.ok(!saved.isError, JSON.stringify(saved));
    assert.equal(saved.structuredContent.result.calories_burned, 220);
    assert.deepEqual(await call(a, "addWorkout", exact), saved);
    const reads = (await call(a, "getWorkouts", { date: exact.date }))
      .structuredContent.result;
    assert.equal(reads.length, 1);
    assert.equal(reads[0].name, exact.name);
    assert.equal(
      (await call(a, "getWorkouts", { date: exact.date })).structuredContent
        .result.length,
      1,
    );
    assert.deepEqual(
      (await call(b, "getWorkouts", { date: exact.date })).structuredContent
        .result,
      [],
    );
    const conflict = visibleError(
      await call(a, "addWorkout", { ...exact, calories_burned: 221 }),
    );
    assert.equal(conflict.code, "CONFLICT");
    assert.equal(conflict.request_id, exact.request_id);

    const cases = [
      [
        { ...exact, request_id: "invalid-uuid" },
        "request_id",
        "invalid_format",
      ],
      [{ ...exact, date: "2026-02-30" }, "date", "custom"],
      [{ ...exact, date: "29/10/2026" }, "date", "invalid_format"],
      [{ ...exact, name: " " }, "name", "too_small"],
      [{ ...exact, name: "a".repeat(121) }, "name", "too_big"],
      [{ ...exact, calories_burned: 0 }, "calories_burned", "too_small"],
      [{ ...exact, calories_burned: -1 }, "calories_burned", "too_small"],
      [{ ...exact, calories_burned: "220" }, "calories_burned", "invalid_type"],
      [{ ...exact, calories_burned: 20001 }, "calories_burned", "too_big"],
      [{ ...exact, calories_burned: null }, "calories_burned", "invalid_type"],
      [{ request_id: exact.request_id }, "name", "invalid_type"],
      [{}, "request_id", "invalid_type"],
    ];
    for (const [args, path, code] of cases) {
      const result = await call(a, "addWorkout", args),
        error = visibleError(result);
      assert.equal(error.code, "VALIDATION_ERROR");
      assert.equal(error.stage, "input");
      assert.ok(
        error.details.some((d) => d.path === path && d.code === code),
        JSON.stringify(error),
      );
      assert.equal(
        error.request_id,
        args.request_id === exact.request_id ? exact.request_id : null,
      );
      assert.equal(error.correlation_id, logs.at(-1).correlation_id);
      if (args.calories_burned === "220") {
        const issue = error.details.find((d) => d.path === "calories_burned");
        assert.equal(issue.expected, "number");
        assert.equal(issue.received, "string");
        if (process.env.NUTRITION_ERROR_EXAMPLE)
          await writeFile(
            process.env.NUTRITION_ERROR_EXAMPLE,
            JSON.stringify(result, null, 2) + "\n",
          );
      }
    }
    const multi = visibleError(
      await call(a, "addWorkout", {
        ...exact,
        date: "2026-02-30",
        name: "",
        calories_burned: -1,
      }),
    );
    assert.deepEqual(
      new Set(multi.details.map((d) => d.path)),
      new Set(["date", "name", "calories_burned"]),
    );
    // A raw JSON-RPC response retains the same error envelope and HTTP correlation ID.
    const raw = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer test-a",
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 91,
        method: "tools/call",
        params: {
          name: "addWorkout",
          arguments: { ...exact, calories_burned: "220" },
        },
      }),
    });
    assert.equal(raw.status, 200);
    const rawError = visibleError((await raw.json()).result);
    assert.equal(rawError.correlation_id, raw.headers.get("X-Correlation-ID"));

    // A real PostgreSQL insert failure rolls back both workout and mutation receipt.
    await db.exec("reset role");
    await db.exec(
      `create function public.test_insert_failure() returns trigger language plpgsql as $$ begin raise exception using errcode='XX000',message='private diagnostic sentinel',detail='password=super-secret postgresql://user:password@db/private',hint='Bearer fake-token';end $$;create trigger test_insert_failure before insert on public.workouts for each row execute function public.test_insert_failure();`,
    );
    const second = {
      ...exact,
      request_id: meal().request_id,
      name: "Second safe test workout",
    };
    const failure = await call(a, "addWorkout", second),
      error = visibleError(failure);
    assert.equal(error.code, "INTERNAL_ERROR");
    assert.equal(error.stage, "database");
    assert.equal(error.request_id, second.request_id);
    assert.ok(!JSON.stringify(failure).includes("private diagnostic sentinel"));
    assert.ok(!JSON.stringify(failure).includes("super-secret"));
    assert.ok(!JSON.stringify(failure).includes("stack"));
    const diagnostic = logs.at(-1);
    assert.equal(diagnostic.correlation_id, error.correlation_id);
    assert.equal(diagnostic.diagnostic.message, "private diagnostic sentinel");
    assert.ok(!JSON.stringify(diagnostic).includes("super-secret"));
    assert.ok(!JSON.stringify(diagnostic).includes("fake-token"));
    await db.exec("reset role");
    assert.equal(
      (
        await db.query(
          "select * from public.nutrition_mutations where request_id=$1",
          [second.request_id],
        )
      ).rows.length,
      0,
    );
    await db.exec(
      "drop trigger test_insert_failure on public.workouts;drop function public.test_insert_failure();",
    );
    assert.ok(!(await call(a, "addWorkout", second)).isError);
    assert.equal(
      (await call(a, "getWorkouts", { date: exact.date })).structuredContent
        .result.length,
      2,
    );
    const owned = {
      request_id: meal().request_id,
      workout_id: saved.structuredContent.result.id,
    };
    assert.equal(
      visibleError(await call(b, "deleteWorkout", owned)).code,
      "NOT_FOUND",
    );
    assert.ok(!(await call(a, "deleteWorkout", owned)).isError);
    assert.ok(!(await call(a, "deleteWorkout", owned)).isError);
  } finally {
    await a.close();
    await b.close();
    await new Promise((resolve) => server.close(resolve));
    await db.close();
  }
});

test("database workout validation aggregates actual issues safely, without writing journal entries", async () => {
  const db = await setup();
  try {
    await migrate(db, "20261029_repair_workout_writes.sql");
    await identity(db, userA);
    const service = nutritionService(databaseClient(db, userA), userA);
    let failure;
    try {
      await service.write("addWorkout", {
        ...exact,
        date: "2026-02-30",
        name: "",
        calories_burned: "220",
      });
    } catch (error) {
      failure = error;
    }
    assert.equal(failure.code, "22023");
    const result = executionError(errorContext("addWorkout", exact), failure);
    const error = visibleError(result);
    assert.equal(error.stage, "database");
    assert.equal(error.code, "VALIDATION_ERROR");
    assert.deepEqual(
      new Set(error.details.map((d) => d.path)),
      new Set(["date", "name", "calories_burned"]),
    );
    assert.ok(
      error.details.some(
        (d) =>
          d.path === "calories_burned" &&
          d.expected === "number" &&
          d.received === "string",
      ),
    );
    await db.exec("reset role");
    assert.equal(
      (
        await db.query(
          "select * from public.nutrition_mutations where request_id=$1",
          [exact.request_id],
        )
      ).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});

test("error serialization ignores arbitrary database details and redacts credentials in diagnostics", () => {
  const context = errorContext("addWorkout", exact),
    logs = [];
  const unknown = {
    code: "22023",
    message: "arbitrary secret message",
    details: JSON.stringify({
      type: "nutrition_validation",
      issues: [
        {
          path: "password",
          code: "invalid_type",
          message: "leak",
          received: "secret",
        },
        {
          path: "name",
          code: "too_big",
          message: "private input",
          received: "super-secret",
          maximum: 120,
        },
      ],
    }),
  };
  const error = visibleError(executionError(context, unknown));
  assert.equal(error.details.length, 1);
  assert.equal(error.details[0].path, "name");
  assert.ok(!JSON.stringify(error).includes("secret"));
  assert.ok(!JSON.stringify(error).includes("private input"));
  logDiagnostic((event) => logs.push(event), context, "database", {
    message:
      'Bearer abc.def.xyz password="hidden" api_key=hidden2 client_secret=hidden3 sb_secret_hidden4',
    stack:
      "postgresql://user:pass@host/db eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.signature",
  });
  for (const value of [
    "abc.def.xyz",
    "hidden",
    "hidden2",
    "hidden3",
    "hidden4",
    "user:pass",
    "eyJhbGci",
  ])
    assert.ok(!JSON.stringify(logs).includes(value));
});
