import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { database, identity, userA, userB, meal } from "./helpers/database.js";

const signatures = {
  legacy:
    "public.add_chatgpt_meal(text,uuid,date,text,text,double precision,double precision)",
  v2: "public.add_chatgpt_meal_v2(text,uuid,date,text,text,double precision,double precision,double precision,double precision)",
  mcp: "public.write_nutrition(text,jsonb)",
};

test("historical privilege upgrade preserves key auth before the retirement migration", async () => {
  const db = await database();
  async function migrate(name) {
    await db.exec("reset role");
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + name, import.meta.url),
        "utf8",
      ),
    );
  }
  async function action(version, token, payload) {
    const columns = version === "legacy" ? 7 : 9;
    return (
      await db.query(
        `select public.${version === "legacy" ? "add_chatgpt_meal" : "add_chatgpt_meal_v2"}(${Array.from({ length: columns }, (_, i) => "$" + (i + 1)).join(",")}) as result`,
        [
          token,
          payload.request_id,
          payload.date,
          payload.name,
          payload.category,
          payload.calories,
          payload.protein,
          ...(version === "legacy" ? [] : [payload.carbs, payload.fat]),
        ],
      )
    ).rows[0].result;
  }
  async function write(operation, payload) {
    return (
      await db.query("select public.write_nutrition($1,$2::jsonb) as result", [
        operation,
        JSON.stringify(payload),
      ])
    ).rows[0].result;
  }
  const tokenA = "nt_" + "a".repeat(64),
    tokenB = "nt_" + "b".repeat(64),
    expired = "nt_" + "c".repeat(64),
    revoked = "nt_" + "d".repeat(64);
  try {
    await migrate("20261014_direct_mcp_writes.sql");
    await migrate("20261019_workout_energy.sql");
    // Pre-existing personal keys, records and receipts must survive the upgrade.
    for (const [token, user, expiry] of [
      [tokenA, userA, "1 day"],
      [tokenB, userB, "1 day"],
      [expired, userA, "-1 day"],
    ]) {
      await db.query(
        "insert into public.chatgpt_keys(user_id,token_hash,expires_at) values($1,encode(extensions.digest($2,'sha256'),'hex'),now()+$3::interval)",
        [user, token, expiry],
      );
    }
    await identity(db, userA);
    const original = meal(),
      saved = await write("addMeal", original);
    await migrate("20261019_function_privileges.sql");
    await migrate("20261019_function_privileges.sql");

    for (const [role, allowed] of [
      ["anon", ["legacy", "v2"]],
      ["authenticated", ["mcp"]],
    ]) {
      for (const [name, signature] of Object.entries(signatures)) {
        const value = (
          await db.query(
            "select has_function_privilege($1,$2,'EXECUTE') as allowed",
            [role, signature],
          )
        ).rows[0].allowed;
        assert.equal(value, allowed.includes(name), role + " " + name);
      }
    }
    const functions = (
      await db.query(
        "select p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('add_chatgpt_meal','add_chatgpt_meal_v2','write_nutrition')",
      )
    ).rows;
    assert.equal(functions.length, 3);
    for (const fn of functions) {
      assert.equal(fn.prosecdef, true);
      assert.ok(fn.proconfig.includes('search_path=""'));
    }

    await identity(db, null);
    for (const version of ["legacy", "v2"]) {
      for (const token of [
        null,
        "invalid",
        "nt_" + "f".repeat(64),
        expired,
        revoked,
      ])
        await assert.rejects(
          action(version, token, meal()),
          (e) => e.code === "28000",
        );
    }
    await assert.rejects(
      db.query("select * from public.meals"),
      (e) => e.code === "42501",
    );
    await assert.rejects(
      db.query("select * from public.chatgpt_keys"),
      (e) => e.code === "42501",
    );
    await assert.rejects(write("addMeal", meal()), (e) => e.code === "42501");
    const old = meal();
    const oldSaved = await action("legacy", tokenA, old);
    assert.deepEqual(await action("legacy", tokenA, old), oldSaved);
    const current = meal();
    const currentSaved = await action("v2", tokenA, current);
    assert.deepEqual(await action("v2", tokenA, current), currentSaved);
    assert.equal(currentSaved.carbs, 30);
    await action("v2", tokenB, meal());

    await identity(db, userA);
    assert.equal(
      (await db.query("select id from public.meals")).rows.length,
      3,
    );
    assert.deepEqual(await write("addMeal", original), saved);
    for (const version of ["legacy", "v2"])
      await assert.rejects(
        action(version, tokenA, meal()),
        (e) => e.code === "42501",
      );
    await assert.rejects(
      db.query("select * from public.nutrition_mutations"),
      (e) => e.code === "42501",
    );

    await identity(db, userB);
    assert.equal(
      (await db.query("select id from public.meals")).rows.length,
      1,
    );
    await assert.rejects(
      write("deleteMeal", { request_id: meal().request_id, meal_id: saved.id }),
      (e) => e.code === "P0002",
    );
    const own = await write("addMeal", meal());
    assert.ok(own.id);
    // Revoking a personal key also blocks the publicly callable SQL function.
    await identity(db, userA, false);
    await db.query(
      "delete from public.chatgpt_keys where token_hash=encode(extensions.digest($1,'sha256'),'hex')",
      [tokenA],
    );
    await identity(db, null);
    await assert.rejects(
      action("v2", tokenA, meal()),
      (e) => e.code === "28000",
    );
    // Even an authenticated DB role without a user identity cannot use the RPC.
    await db.exec("set role authenticated");
    await assert.rejects(write("addMeal", meal()), (e) => e.code === "42501");
  } finally {
    await db.close();
  }
});
