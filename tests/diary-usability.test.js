import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { database, identity, userA, userB, meal } from "./helpers/database.js";
import { databaseClient } from "./helpers/client.js";
import { nutritionService } from "../server/nutrition-service.js";
import { writes } from "../server/schemas.js";
import { summarizeWeek } from "../src/summaries.js";
async function setup() {
  const db = await database();
  for (const name of [
    "20261014_direct_mcp_writes.sql",
    "20261019_workout_energy.sql",
    "20261019_function_privileges.sql",
    "20261019_retire_personal_keys.sql",
    "20261020_diary_usability.sql",
  ])
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + name, import.meta.url),
        "utf8",
      ),
    );
  return db;
}
test("additive diary migration preserves records/receipts, owner-scoped favorites/day types/time and idempotent repeat", async () => {
  const db = await setup();
  const a = nutritionService(databaseClient(db, userA), userA),
    b = nutritionService(databaseClient(db, userB), userB);
  try {
    const original = meal();
    const saved = await a.write("addMeal", original);
    await db.exec("reset role");
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/20261020_diary_usability.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    assert.deepEqual(await a.write("addMeal", original), saved);
    const { request_id, date, ...fields } = meal();
    const favorite = { request_id, ...fields };
    const template = await a.write("saveMealTemplate", favorite);
    assert.deepEqual(await a.write("saveMealTemplate", favorite), template);
    assert.equal((await a.getMealTemplates()).length, 1);
    assert.equal(
      (await a.getMeals({ date })).length,
      1,
      "saving a favorite never logs a meal",
    );
    assert.deepEqual(await b.getMealTemplates(), []);
    const edit = {
      ...favorite,
      request_id: meal().request_id,
      template_id: template.id,
      name: "Συνηθισμένο πρωινό",
    };
    await assert.rejects(
      b.write("saveMealTemplate", edit),
      (e) => e.code === "P0002",
    );
    await a.write("saveMealTemplate", edit);
    await assert.rejects(
      a.write("saveMealTemplate", { ...edit, calories: 1 }),
      (e) => e.code === "23505",
    );
    const repeat = { ...meal(), meal_time: "08:30" };
    const logged = await a.write("addMeal", repeat);
    assert.deepEqual(await a.write("addMeal", repeat), logged);
    assert.equal((await a.getMeals({ date })).length, 2);
    assert.equal((await a.getMeals({ date }))[1].meal_time, "08:30:00");
    const updated = await a.write("updateMeal", {
      ...meal(),
      meal_id: logged.id,
    });
    assert.equal(
      updated.meal_time,
      "08:30:00",
      "older MCP clients preserve time when omitted",
    );
    assert.equal(
      (
        await a.write("updateMeal", {
          ...meal(),
          meal_id: logged.id,
          meal_time: null,
        })
      ).meal_time,
      null,
    );
    const day = { request_id: meal().request_id, date, day_type: "training" };
    await a.write("setDayType", day);
    await a.write("setDayType", day);
    assert.deepEqual(await a.getDayTypes({ date }), [
      { date, day_type: "training" },
    ]);
    assert.deepEqual(await b.getDayTypes({ date }), []);
    assert.equal((await a.getDailySummary({ date })).day_type, "training");
    assert.equal(
      (await a.getWeeklySummary({ date })).daily.find((d) => d.date === date)
        .day_type,
      "training",
    );
    assert.equal(
      (await a.getDailySummary({ date: "2026-10-15" })).day_type,
      "rest",
    );
    const del = { request_id: meal().request_id, template_id: template.id };
    await assert.rejects(
      b.write("deleteMealTemplate", del),
      (e) => e.code === "P0002",
    );
    await a.write("deleteMealTemplate", del);
    await a.write("deleteMealTemplate", del);
    assert.deepEqual(await a.getMealTemplates(), []);
    assert.equal(
      (await a.getMeals({ date })).length,
      2,
      "removing template preserves history",
    );
    for (const [operation, payload] of [
      ["setDayType", day],
      ["saveMealTemplate", favorite],
      ["deleteMealTemplate", del],
    ]) {
      await identity(db, null);
      await assert.rejects(
        db.query("select public.write_nutrition($1,$2::jsonb)", [
          operation,
          JSON.stringify(payload),
        ]),
        (e) => e.code === "42501",
      );
    }
    await identity(db, userA);
    for (const table of ["meal_templates", "diary_days"])
      await assert.rejects(
        db
          .query(`select * from public.${table} where user_id=$1`, [userB])
          .then((r) => {
            assert.equal(r.rows.length, 0);
            return db.query(`delete from public.${table}`);
          }),
        (e) => e.code === "42501",
      );
    await assert.rejects(
      db.query("select public.write_nutrition($1,$2::jsonb)", [
        "saveMealTemplate",
        JSON.stringify({
          ...favorite,
          request_id: meal().request_id,
          carbs: -1,
        }),
      ]),
    );
    await assert.rejects(
      db.query("select public.write_nutrition($1,$2::jsonb)", [
        "setDayType",
        JSON.stringify({
          ...day,
          request_id: meal().request_id,
          day_type: "invalid",
        }),
      ]),
      (e) => e.code === "22023",
    );
    await assert.rejects(
      db.query("select public.write_nutrition($1,$2::jsonb)", [
        "addMeal",
        JSON.stringify({ ...meal(), meal_time: "25:99" }),
      ]),
      (e) => e.code === "22023",
    );
  } finally {
    await db.close();
  }
});
test("new schemas reject invalid dates, times, macros and injected ownership", () => {
  assert.ok(
    writes.addMeal.safeParse({ ...meal(), meal_time: "23:59" }).success,
  );
  for (const meal_time of ["24:00", "8:30", "20:60", 5])
    assert.ok(!writes.addMeal.safeParse({ ...meal(), meal_time }).success);
  for (const extra of [
    { date: "2026-02-30" },
    { day_type: "auto" },
    { user_id: userB },
  ])
    assert.ok(
      !writes.setDayType.safeParse({
        request_id: userA,
        date: "2026-10-14",
        day_type: "training",
        ...extra,
      }).success,
    );
  const { date, request_id, ...fields } = meal();
  assert.ok(
    writes.saveMealTemplate.safeParse({ request_id, ...fields }).success,
  );
  assert.ok(
    !writes.saveMealTemplate.safeParse({
      request_id,
      ...fields,
      protein: Infinity,
    }).success,
  );
  assert.ok(
    !writes.saveMealTemplate.safeParse({ request_id, ...fields, date }).success,
  );
});
test("weekly recorded-day averages exclude missing days while legacy seven-day average remains compatible", () => {
  const summary = summarizeWeek(
    [
      { date: "2026-10-12", calories: 100, protein: 10, carbs: 20, fat: 2 },
      { date: "2026-10-14", calories: 300, protein: 20, carbs: 30, fat: 3 },
    ],
    "2026-10-14",
  );
  assert.equal(summary.recorded_days, 2);
  assert.equal(summary.recorded_day_average.calories, 200);
  assert.equal(summary.daily_average.calories, 400 / 7);
  assert.equal(
    summarizeWeek([], "2026-10-14").recorded_day_average.calories,
    null,
  );
});

test("official HTTP discovery and confirmed favorite/day-type tools share authenticated, isolated storage", async () => {
  const { default: http } = await import("node:http");
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StreamableHTTPClientTransport } = await import(
    "@modelcontextprotocol/sdk/client/streamableHttp.js"
  );
  const { makeHandler } = await import("../api/mcp.js");
  const db = await setup();
  const handler = makeHandler(async (token) => {
    const user = token === "test-a" ? userA : token === "test-b" ? userB : null;
    if (!user) throw Error("Unauthorized");
    return { userId: user, client: databaseClient(db, user) };
  });
  const server = http.createServer(async (req, res) => {
    if (req.method === "POST") {
      let raw = "";
      for await (const part of req) raw += part;
      req.body = JSON.parse(raw);
    }
    await handler(req, res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = new URL(`http://127.0.0.1:${server.address().port}/mcp`);
  const a = new Client({ name: "diary-a", version: "1" }),
    b = new Client({ name: "diary-b", version: "1" });
  const call = async (client, name, args) => {
    const r = await client.callTool({ name, arguments: args });
    assert.ok(!r.isError, JSON.stringify(r));
    return r.structuredContent.result;
  };
  try {
    for (const name of [
      "saveMealTemplate",
      "deleteMealTemplate",
      "setDayType",
      "getMealTemplates",
      "getDayTypes",
    ]) {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name, arguments: {} },
        }),
      });
      assert.equal(r.status, 401);
    }
    await a.connect(
      new StreamableHTTPClientTransport(url, {
        requestInit: { headers: { Authorization: "Bearer test-a" } },
      }),
    );
    await b.connect(
      new StreamableHTTPClientTransport(url, {
        requestInit: { headers: { Authorization: "Bearer test-b" } },
      }),
    );
    const { tools } = await a.listTools();
    assert.equal(tools.length, 20);
    for (const name of [
      "saveMealTemplate",
      "deleteMealTemplate",
      "setDayType",
    ]) {
      const tool = tools.find((t) => t.name === name);
      assert.equal(tool.annotations.destructiveHint, true);
      assert.equal(tool.annotations.idempotentHint, true);
      assert.ok(tool.inputSchema.required.includes("request_id"));
      assert.ok(!tool.inputSchema.required.includes("confirmation_id"));
    }
    const { date, ...fields } = meal();
    const t = await call(a, "saveMealTemplate", fields);
    assert.deepEqual(await call(a, "saveMealTemplate", fields), t);
    assert.equal((await call(a, "getMealTemplates", {})).length, 1);
    assert.deepEqual(await call(a, "getMeals", { date }), []);
    assert.deepEqual(await call(b, "getMealTemplates", {}), []);
    await call(a, "setDayType", {
      request_id: meal().request_id,
      date,
      day_type: "training",
    });
    assert.equal(
      (await call(a, "getDayTypes", { date }))[0].day_type,
      "training",
    );
    assert.deepEqual(await call(b, "getDayTypes", { date }), []);
    const input = { ...meal(), meal_time: "12:45" };
    await call(a, "addMeal", input);
    await call(a, "addMeal", input);
    const records = await call(a, "getMeals", { date });
    assert.equal(records.length, 1);
    assert.equal(records[0].meal_time, "12:45:00");
    assert.equal(
      (await call(a, "getDailySummary", { date })).day_type,
      "training",
    );
    assert.equal(
      (
        await b.callTool({
          name: "deleteMealTemplate",
          arguments: { request_id: meal().request_id, template_id: t.id },
        })
      ).isError,
      true,
    );
    await call(a, "deleteMealTemplate", {
      request_id: meal().request_id,
      template_id: t.id,
    });
    assert.equal((await call(a, "getMeals", { date })).length, 1);
  } finally {
    await a.close();
    await b.close();
    await new Promise((resolve) => server.close(resolve));
    await db.close();
  }
});
