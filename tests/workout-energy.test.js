import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { database, identity, userA, userB, meal } from "./helpers/database.js";
import { databaseClient } from "./helpers/client.js";
import { nutritionService } from "../server/nutrition-service.js";
import { writes } from "../server/schemas.js";
import { dailyEnergy } from "../src/energy.js";
import { summarizeWeek } from "../src/summaries.js";

const date = "2026-10-14";
const workout = () => ({
  request_id: meal().request_id,
  date,
  name: "Τρέξιμο",
  calories_burned: 500,
});
async function migrate(db, file) {
  await db.exec("reset role");
  await db.exec(
    await readFile(
      new URL("../supabase/migrations/" + file, import.meta.url),
      "utf8",
    ),
  );
}

test("energy math uses separate maintenance, counts fueling once, excludes unlogged and future dates", () => {
  const meals = [
    { date, calories: 2000 },
    { date, calories: 200, category: "Τροφοδοσία προπόνησης" },
    { date: "2026-10-15", calories: 2500 },
    { date: "2026-10-18", calories: 999 },
  ];
  const workouts = [
    { date, calories_burned: 500 },
    { date, calories_burned: 100 },
    { date: "2026-10-13", calories_burned: 800 },
  ];
  assert.equal(
    dailyEnergy(meals, workouts, date, 2000, date).balance_calories,
    -400,
  );
  assert.equal(
    dailyEnergy(meals, workouts, "2026-10-15", 2000, "2026-10-15")
      .balance_calories,
    500,
  );
  assert.equal(
    dailyEnergy(meals, workouts, date, null, date).balance_calories,
    null,
  );
  assert.equal(
    dailyEnergy(meals, workouts, "2026-10-13", 2000, date).unavailable_reason,
    "no_meals_logged",
  );
  assert.equal(
    dailyEnergy(meals, workouts, "2026-10-18", 2000, date).unavailable_reason,
    "future_date",
  );
  const week = summarizeWeek(meals, date, workouts, 2000, "2026-10-15");
  assert.equal(week.energy_balance.balance_calories, 100);
  assert.equal(week.energy_balance.workout_calories, 1400);
  assert.equal(week.energy_balance.included_workout_calories, 600);
  assert.equal(week.energy_balance.included_days, 2);
  assert.equal(week.energy_balance.daily_average_balance_calories, 50);
  assert.equal(week.energy_balance.is_partial_week, true);
  assert.equal(
    summarizeWeek([], date, workouts, 2000, date).energy_balance
      .balance_calories,
    null,
  );
});

test("workout schemas reject invalid values and require explicit complete updates", () => {
  assert.equal(writes.addWorkout.safeParse(workout()).success, true);
  for (const override of [
    { calories_burned: 0 },
    { calories_burned: -1 },
    { calories_burned: Infinity },
    { calories_burned: 20001 },
    { name: " " },
    { date: "2026-02-30" },
    { user_id: userB },
  ])
    assert.equal(
      writes.addWorkout.safeParse({ ...workout(), ...override }).success,
      false,
    );
  assert.equal(
    writes.updateWorkout.safeParse({
      request_id: meal().request_id,
      workout_id: userA,
      calories_burned: 450,
    }).success,
    false,
  );
  assert.equal(
    writes.updateEnergySettings.safeParse({
      request_id: meal().request_id,
      maintenance_calories: null,
    }).success,
    true,
  );
  for (const maintenance_calories of [0, 499, 10001, NaN])
    assert.equal(
      writes.updateEnergySettings.safeParse({
        request_id: meal().request_id,
        maintenance_calories,
      }).success,
      false,
    );
});

test("additive PostgreSQL upgrade preserves meals, targets and idempotency receipts; exercises are isolated and authenticated", async () => {
  const db = await database();
  try {
    await migrate(db, "20261014_direct_mcp_writes.sql");
    const a = nutritionService(databaseClient(db, userA), userA),
      b = nutritionService(databaseClient(db, userB), userB);
    const food = {
      ...meal(),
      calories: 2200,
      category: "Τροφοδοσία προπόνησης",
    };
    const savedMeal = await a.write("addMeal", food);
    assert.equal(
      (await a.getNutritionTargets()).energy_settings.setup_required,
      true,
    );
    assert.equal((await a.getDailySummary({ date })).totals.calories, 2200);
    assert.equal(
      (await a.getDailySummary({ date })).energy_balance.setup_required,
      true,
    );
    assert.equal((await a.getWeeklySummary({ date })).totals.calories, 2200);
    await migrate(db, "20261019_workout_energy.sql");
    assert.deepEqual(await a.write("addMeal", food), savedMeal);
    assert.equal((await a.getNutritionTargets()).rest.calories, 2200);
    assert.equal(
      (await a.getNutritionTargets()).energy_settings.maintenance_calories,
      null,
    );
    const settings = {
      request_id: meal().request_id,
      maintenance_calories: 2000,
    };
    await a.write("updateEnergySettings", settings);
    assert.deepEqual(await a.write("updateEnergySettings", settings), {
      maintenance_calories: 2000,
    });
    assert.equal(
      (await b.getNutritionTargets()).energy_settings.maintenance_calories,
      null,
    );
    const input = workout();
    assert.deepEqual(await a.getWorkouts({ date }), []); // Analysis alone writes nothing.
    const saved = await a.write("addWorkout", input);
    assert.deepEqual(await a.write("addWorkout", input), saved);
    await assert.rejects(
      a.write("addWorkout", { ...input, calories_burned: 600 }),
      (e) => e.code === "23505",
    );
    assert.equal((await a.getWorkouts({ date })).length, 1);
    assert.deepEqual(await b.getWorkouts({ date }), []);
    assert.equal(
      (await a.getDailySummary({ date })).energy_balance.balance_calories,
      -300,
    );
    assert.equal(
      (await a.getWeeklySummary({ date })).energy_balance.balance_calories,
      -300,
    );
    const second = await a.write("addWorkout", {
      ...workout(),
      name: "Κολύμπι",
      calories_burned: 200,
    });
    assert.equal(
      (await a.getDailySummary({ date })).energy_balance.workout_calories,
      700,
    );
    const edit = { ...workout(), workout_id: saved.id, calories_burned: 450 };
    await assert.rejects(
      b.write("updateWorkout", edit),
      (e) => e.code === "P0002",
    );
    await a.write("updateWorkout", edit);
    assert.equal((await a.write("updateWorkout", edit)).calories_burned, 450);
    assert.equal(
      (await a.getDailySummary({ date })).energy_balance.balance_calories,
      -450,
    );
    const del = { request_id: meal().request_id, workout_id: second.id };
    await assert.rejects(
      b.write("deleteWorkout", del),
      (e) => e.code === "P0002",
    );
    await a.write("deleteWorkout", del);
    await a.write("deleteWorkout", del);
    assert.equal((await a.getWorkouts({ date })).length, 1);
    await a.write("updateEnergySettings", {
      request_id: meal().request_id,
      maintenance_calories: 1800,
    });
    assert.equal(
      (await a.getDailySummary({ date })).energy_balance.balance_calories,
      -50,
    );
    await identity(db, null);
    for (const table of ["workouts", "energy_settings"])
      await assert.rejects(
        db.query(`select * from public.${table}`),
        (e) => e.code === "42501",
      );
    for (const operation of [
      "addWorkout",
      "updateWorkout",
      "deleteWorkout",
      "updateEnergySettings",
    ])
      await assert.rejects(
        db.query("select public.write_nutrition($1,$2::jsonb)", [
          operation,
          JSON.stringify(input),
        ]),
        (e) => e.code === "42501",
      );
    for (const oauth of [false, true]) {
      await identity(db, userB, oauth);
      assert.equal(
        (
          await db.query("select id from public.workouts where user_id=$1", [
            userA,
          ])
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query(
            "select * from public.energy_settings where user_id=$1",
            [userA],
          )
        ).rows.length,
        0,
      );
      await assert.rejects(
        db.query(
          "insert into public.workouts(user_id,date,name,calories_burned) values($1,$2,'bypass',10)",
          [userB, date],
        ),
        (e) => e.code === "42501",
      );
    }
    for (const bad of [
      { ...workout(), calories_burned: -1 },
      { ...workout(), calories_burned: "500" },
      { ...workout(), name: "" },
      { ...workout(), date: "2026-02-30" },
    ])
      await assert.rejects(a.write("addWorkout", bad));
    await assert.rejects(
      a.write("updateEnergySettings", {
        request_id: meal().request_id,
        maintenance_calories: 10001,
      }),
    );
    await a.write("updateEnergySettings", {
      request_id: meal().request_id,
      maintenance_calories: null,
    });
    assert.equal(
      (await a.getDailySummary({ date })).energy_balance.balance_calories,
      null,
    );
    await identity(db, null);
    await db.exec("reset role");
    await migrate(db, "20261019_workout_energy.sql");
    assert.equal((await a.getWorkouts({ date })).length, 1);
    assert.deepEqual(await a.write("addMeal", food), savedMeal);
    // Bounded MCP reads must detect overflow despite PostgREST's usual 1000-row cap.
    await db.exec("reset role");
    await db.query(
      "insert into public.workouts(user_id,date,name,calories_burned) select $1,$2,'History '||n,1 from generate_series(1,1001) n",
      [userB, date],
    );
    assert.equal((await b.getWorkouts({ date })).length, 1001);
    assert.equal((await a.getWorkouts({ date })).length, 1);
    await assert.rejects(b.getDailySummary({ date }), /Too many records/);
  } finally {
    await db.close();
  }
});

test("official MCP HTTP workout workflow saves once, reads balances, edits and deletes without dashboard approval", async () => {
  const { default: http } = await import("node:http");
  const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
  const { StreamableHTTPClientTransport } =
    await import("@modelcontextprotocol/sdk/client/streamableHttp.js");
  const { makeHandler } = await import("../api/mcp.js");
  const db = await database();
  await migrate(db, "20261014_direct_mcp_writes.sql");
  await migrate(db, "20261019_workout_energy.sql");
  await migrate(db, "20261019_function_privileges.sql");
  await migrate(db, "20261019_retire_personal_keys.sql");
  const handler = makeHandler(async (token) => {
    const user =
      token === "test-user-a" ? userA : token === "test-user-b" ? userB : null;
    if (!user) throw Error("Unauthorized");
    return { userId: user, client: databaseClient(db, user) };
  });
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
  const a = new Client({ name: "workout-test-a", version: "1" }),
    b = new Client({ name: "workout-test-b", version: "1" });
  const call = async (client, name, args) => {
    const result = await client.callTool({ name, arguments: args });
    assert.ok(!result.isError, JSON.stringify(result));
    return result.structuredContent.result;
  };
  try {
    for (const name of [
      "addWorkout",
      "updateWorkout",
      "deleteWorkout",
      "updateEnergySettings",
    ]) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name, arguments: workout() },
        }),
      });
      assert.equal(response.status, 401);
    }
    await a.connect(
      new StreamableHTTPClientTransport(url, {
        requestInit: { headers: { Authorization: "Bearer test-user-a" } },
      }),
    );
    await b.connect(
      new StreamableHTTPClientTransport(url, {
        requestInit: { headers: { Authorization: "Bearer test-user-b" } },
      }),
    );
    const { tools } = await a.listTools();
    assert.equal(tools.length, 20);
    for (const name of [
      "addWorkout",
      "updateWorkout",
      "deleteWorkout",
      "updateEnergySettings",
    ]) {
      const tool = tools.find((t) => t.name === name);
      assert.equal(tool.annotations.readOnlyHint, false);
      assert.equal(tool.annotations.destructiveHint, true);
      assert.equal(tool.annotations.idempotentHint, true);
      assert.ok(tool.inputSchema.required.includes("request_id"));
      assert.ok(!tool.inputSchema.required.includes("confirmation_id"));
    }
    assert.deepEqual(await call(a, "getWorkouts", { date }), []);
    await call(a, "updateEnergySettings", {
      request_id: meal().request_id,
      maintenance_calories: 2000,
    });
    await call(a, "addMeal", { ...meal(), calories: 2200 });
    const payload = workout();
    const saved = await call(a, "addWorkout", payload);
    assert.deepEqual(await call(a, "addWorkout", payload), saved);
    assert.equal((await call(a, "getWorkouts", { date })).length, 1);
    assert.equal(
      (await call(a, "getDailySummary", { date })).energy_balance
        .balance_calories,
      -300,
    );
    assert.equal(
      (await call(a, "getWeeklySummary", { date })).energy_balance
        .included_days,
      1,
    );
    assert.equal(
      (await call(a, "getWeeklySummary", { date })).energy_balance
        .balance_calories,
      -300,
    );
    assert.deepEqual(await call(b, "getWorkouts", { date }), []);
    assert.equal(
      (await call(b, "getNutritionTargets", {})).energy_settings
        .maintenance_calories,
      null,
    );
    const edit = { ...workout(), workout_id: saved.id, calories_burned: 450 };
    assert.equal(
      (await b.callTool({ name: "updateWorkout", arguments: edit })).isError,
      true,
    );
    await call(a, "updateWorkout", edit);
    assert.equal(
      (await call(a, "getDailySummary", { date })).energy_balance
        .balance_calories,
      -250,
    );
    const del = { request_id: meal().request_id, workout_id: saved.id };
    assert.equal(
      (await b.callTool({ name: "deleteWorkout", arguments: del })).isError,
      true,
    );
    await call(a, "deleteWorkout", del);
    await call(a, "deleteWorkout", del);
    assert.deepEqual(await call(a, "getWorkouts", { date }), []);
    assert.equal(
      (await call(a, "getDailySummary", { date })).energy_balance
        .balance_calories,
      200,
    );
  } finally {
    await a.close();
    await b.close();
    await new Promise((resolve) => server.close(resolve));
    await db.close();
  }
});
