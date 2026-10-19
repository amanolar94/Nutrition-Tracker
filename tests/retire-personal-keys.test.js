import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { database, identity, userA, userB, meal } from "./helpers/database.js";
import { databaseClient } from "./helpers/client.js";
import { nutritionService } from "../server/nutrition-service.js";

test("retirement blocks all personal-key entry points and new keys, preserves records, MCP and browser access", async () => {
  const db = await database();
  const token = "nt_" + "a".repeat(64);
  const signature =
    "public.add_chatgpt_meal(text,uuid,date,text,text,double precision,double precision)";
  const signatureV2 =
    "public.add_chatgpt_meal_v2(text,uuid,date,text,text,double precision,double precision,double precision,double precision)";
  async function migrate(file) {
    await db.exec("reset role");
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + file, import.meta.url),
        "utf8",
      ),
    );
  }
  const tables = [
    "meals",
    "goals",
    "weights",
    "workouts",
    "energy_settings",
    "chatgpt_keys",
    "nutrition_mutations",
    "nutrition_mcp_clients",
  ];
  async function snapshot() {
    await db.exec("reset role");
    const result = {};
    for (const table of tables)
      result[table] = (
        await db.query(
          `select to_jsonb(t) as row from public.${table} t order by to_jsonb(t)::text`,
        )
      ).rows;
    return result;
  }
  try {
    for (const file of [
      "20261014_direct_mcp_writes.sql",
      "20261019_workout_energy.sql",
      "20261019_function_privileges.sql",
    ])
      await migrate(file);
    await db.query(
      "insert into public.chatgpt_keys(user_id,token_hash) values($1,encode(extensions.digest($2,'sha256'),'hex')),($3,$4)",
      [userA, token, userB, "b".repeat(64)],
    );
    await db.query(
      "insert into public.nutrition_mcp_clients(client_id) values($1)",
      [userA],
    );
    const a = nutritionService(databaseClient(db, userA), userA),
      b = nutritionService(databaseClient(db, userB), userB);
    const payload = meal(),
      saved = await a.write("addMeal", payload);
    await a.write("addWeight", {
      request_id: meal().request_id,
      date: payload.date,
      weight_kg: 100,
    });
    await a.write("addWorkout", {
      request_id: meal().request_id,
      date: payload.date,
      name: "Τρέξιμο",
      calories_burned: 500,
    });
    await a.write("updateEnergySettings", {
      request_id: meal().request_id,
      maintenance_calories: 2000,
    });
    await a.write("updateNutritionTargets", {
      request_id: meal().request_id,
      rest: { calories: 2200, protein: 180, carbs: 220, fat: 67 },
      training: { calories: 2700, protein: 180, carbs: 320, fat: 78 },
    });
    const before = await snapshot();
    await migrate("20261019_retire_personal_keys.sql");
    await migrate("20261019_retire_personal_keys.sql");
    assert.deepEqual(await snapshot(), before);
    for (const role of ["anon", "authenticated"]) {
      for (const fn of [signature, signatureV2])
        assert.equal(
          (
            await db.query(
              "select has_function_privilege($1,$2,'EXECUTE') as allowed",
              [role, fn],
            )
          ).rows[0].allowed,
          false,
        );
    }
    assert.equal(
      (
        await db.query(
          "select has_function_privilege('anon','public.write_nutrition(text,jsonb)','EXECUTE') as allowed",
        )
      ).rows[0].allowed,
      false,
    );
    assert.equal(
      (
        await db.query(
          "select has_function_privilege('authenticated','public.write_nutrition(text,jsonb)','EXECUTE') as allowed",
        )
      ).rows[0].allowed,
      true,
    );
    for (const user of [null, userA]) {
      await identity(db, user, false);
      for (const v2 of [false, true]) {
        const values = [
          token,
          meal().request_id,
          payload.date,
          payload.name,
          payload.category,
          payload.calories,
          payload.protein,
          ...(v2 ? [payload.carbs, payload.fat] : []),
        ];
        await assert.rejects(
          db.query(
            `select public.${v2 ? "add_chatgpt_meal_v2" : "add_chatgpt_meal"}(${values.map((_, i) => "$" + (i + 1)).join(",")})`,
            values,
          ),
          (e) => e.code === "42501",
        );
      }
    }
    for (const oauth of [false, true]) {
      await identity(db, userA, oauth);
      await assert.rejects(
        db.query(
          "insert into public.chatgpt_keys(user_id,token_hash) values($1,$2)",
          [userA, "c".repeat(64)],
        ),
        (e) => e.code === "42501",
      );
    }
    assert.deepEqual(await a.write("addMeal", payload), saved); // Original receipt still works.
    assert.equal(
      (await a.getDailySummary({ date: payload.date })).energy_balance
        .balance_calories,
      -2200,
    );
    assert.equal(
      (await a.getWeeklySummary({ date: payload.date })).energy_balance
        .balance_calories,
      -2200,
    );
    assert.equal((await a.getNutritionTargets()).rest.calories, 2200);
    assert.equal(
      (await a.getWeightHistory({ date: payload.date }))[0].weight_kg,
      100,
    );
    const next = await a.write("addMeal", meal());
    assert.ok(next.id);
    assert.deepEqual(await b.getMeals({ date: payload.date }), []);
    await assert.rejects(
      b.write("deleteMeal", {
        request_id: meal().request_id,
        meal_id: saved.id,
      }),
      (e) => e.code === "P0002",
    );
    await identity(db, null);
    await assert.rejects(
      db.query("select public.write_nutrition($1,$2::jsonb)", [
        "addMeal",
        JSON.stringify(meal()),
      ]),
      (e) => e.code === "42501",
    );
    // Existing browser diary writes and owner-only cleanup continue to work.
    await identity(db, userA, false);
    assert.equal(
      (await db.query("select id from public.chatgpt_keys")).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query(
          "delete from public.chatgpt_keys where user_id=$1 returning id",
          [userB],
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "delete from public.chatgpt_keys where user_id=$1 returning id",
          [userA],
        )
      ).rows.length,
      1,
    );
    await db.query(
      "insert into public.meals(user_id,date,name,category,calories,protein,carbs,fat) values($1,$2,'Χειροκίνητο','Σνακ',100,5,10,2)",
      [userA, payload.date],
    );
    assert.equal(
      (await db.query("select id from public.meals")).rows.length,
      3,
    );
  } finally {
    await db.close();
  }
});
