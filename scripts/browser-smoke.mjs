import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
import { database, identity, userA, meal } from "../tests/helpers/database.js";
const db = await database();
await db.exec(
  await (
    await import("node:fs/promises")
  ).readFile(
    new URL(
      "../supabase/migrations/20261014_direct_mcp_writes.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await db.exec(
  await (
    await import("node:fs/promises")
  ).readFile(
    new URL(
      "../supabase/migrations/20261019_workout_energy.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
const port = 5192;
const origin = `http://127.0.0.1:${port}`;
const vite = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ],
  {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      VITE_SUPABASE_URL: "https://nutrition-test.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "public-test-placeholder",
    },
    stdio: "ignore",
  },
);
let browser;
let legacyMode = false;
let energyLegacyMode = false;
let loseNextWorkoutResponse = false;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (i === 99) throw Error("Vite failed to start");
  }
  const executable =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
  browser = await chromium.launch({
    executablePath: executable,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("https://nutrition-test.supabase.co/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url());
    let body = {},
      status = 200;
    try {
      if (url.pathname.includes("/auth/v1/token"))
        body = {
          access_token: "browser-test-token",
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: "test-refresh",
          user: {
            id: userA,
            email: "long-account-email-for-mobile-testing@example.com",
            role: "authenticated",
            aud: "authenticated",
          },
        };
      else if (url.pathname.endsWith("/user/oauth/grants")) body = [];
      else if (url.pathname.includes("/auth/v1/oauth/authorizations/")) {
        body = {
          authorization_id: "test",
          scope: "openid email",
          client: { id: "client-id", name: "Nutrition Tracker test" },
          redirect_uri: "https://chatgpt.com/",
        };
      } else if (url.pathname.includes("/rest/v1/")) {
        if (
          (energyLegacyMode &&
            (url.pathname.endsWith("/workouts") ||
              url.pathname.endsWith("/energy_settings"))) ||
          (legacyMode &&
            (url.pathname.endsWith("/workouts") ||
              url.pathname.endsWith("/energy_settings") ||
              url.pathname.endsWith("/weights") ||
              (url.searchParams.get("select") || "").includes("carbs")))
        ) {
          await route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({
              code: "42703",
              message: "missing new schema",
            }),
          });
          return;
        }
        await identity(db, userA, false);
        const table = url.pathname.split("/").at(-1);
        if (url.pathname.endsWith("/rpc/write_nutrition")) {
          const args = JSON.parse(req.postData());
          body = (
            await db.query(
              "select public.write_nutrition($1,$2::jsonb) as result",
              [args.p_operation, JSON.stringify(args.p_payload)],
            )
          ).rows[0].result;
          if (loseNextWorkoutResponse && args.p_operation === "addWorkout") {
            loseNextWorkoutResponse = false;
            await route.fulfill({
              status: 500,
              contentType: "application/json",
              body: JSON.stringify({
                message: "Simulated lost response after commit",
              }),
            });
            return;
          }
        } else if (req.method() === "POST" && table === "meals") {
          const v = JSON.parse(req.postData());
          await db.query(
            "insert into public.meals(id,user_id,date,name,category,calories,protein,carbs,fat) values($1,$2,$3,$4,$5,$6,$7,$8,$9)",
            [
              v.id,
              v.user_id,
              v.date,
              v.name,
              v.category,
              v.calories,
              v.protein,
              v.carbs ?? null,
              v.fat ?? null,
            ],
          );
          body = [];
        } else if (req.method() === "DELETE" && table === "meals") {
          await db.query(
            "delete from public.meals where id=$1 and user_id=$2",
            [url.searchParams.get("id").slice(3), userA],
          );
          body = [];
        } else if (req.method() === "POST" && table === "goals") {
          const v = JSON.parse(req.postData());
          await db.query(
            "insert into public.goals(user_id,calories,protein,carbs,fat,training_calories,training_protein,training_carbs,training_fat) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(user_id) do update set calories=excluded.calories,protein=excluded.protein,carbs=excluded.carbs,fat=excluded.fat,training_calories=excluded.training_calories,training_protein=excluded.training_protein,training_carbs=excluded.training_carbs,training_fat=excluded.training_fat",
            [
              v.user_id,
              v.calories,
              v.protein,
              v.carbs ?? 220,
              v.fat ?? 67,
              v.training_calories ?? 2700,
              v.training_protein ?? 180,
              v.training_carbs ?? 320,
              v.training_fat ?? 78,
            ],
          );
          body = [];
        } else {
          if (
            ![
              "meals",
              "goals",
              "weights",
              "chatgpt_keys",
              "workouts",
              "energy_settings",
            ].includes(table)
          )
            throw Error("Unexpected table");
          const sort =
            table === "weights"
              ? " order by date"
              : table === "meals"
                ? " order by created_at,id"
                : "";
          body = (
            await db.query(
              `select * from public.${table} where user_id=$1${sort} limit ${Number(url.searchParams.get("limit") || 1000)} offset ${Number(url.searchParams.get("offset") || 0)}`,
              [userA],
            )
          ).rows.map((row) => ({
            ...row,
            ...(row.date
              ? {
                  date:
                    row.date instanceof Date
                      ? row.date.toISOString().slice(0, 10)
                      : String(row.date).slice(0, 10),
                }
              : {}),
          }));
          if (table === "goals" || table === "energy_settings")
            body = body[0] || null;
        }
      }
    } catch (error) {
      status = 400;
      body = {
        code: error.code || "test_error",
        message: "Database test failure",
      };
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(origin);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.locator("[name=email]").fill("test@example.com");
  await page.locator("[name=password]").fill("test-password");
  await page.getByRole("button", { name: "Σύνδεση", exact: true }).click();
  await page.getByRole("heading", { name: "Ημερήσια εικόνα" }).waitFor();
  await page.getByLabel("Ημερομηνία καταγραφής").fill("2026-10-14");
  async function confirm(operation, payload) {
    await identity(db, userA);
    return (
      await db.query("select public.write_nutrition($1,$2::jsonb) as result", [
        operation,
        JSON.stringify(payload),
      ])
    ).rows[0].result;
  }
  assert.equal(
    await page.getByRole("button", { name: "Επιβεβαίωση αλλαγής" }).count(),
    0,
  );
  const payload = { ...meal(), category: "Τροφοδοσία προπόνησης" };
  const saved = await confirm("addMeal", payload);
  await page.getByRole("button", { name: "Ανανέωση", exact: true }).click();
  await page.getByRole("heading", { name: "Γιαούρτι", exact: true }).waitFor();
  assert.equal(await page.locator(".stat strong").nth(2).innerText(), "30");
  assert.match(await page.locator(".fueling").innerText(), /300 kcal/);
  // Unset maintenance is explicit; the user-provided 2000 is a proposal until saved.
  assert.match(
    await page.locator(".balance-card").innerText(),
    /Δεν υπάρχει εκτίμηση/,
  );
  await page
    .getByRole("button", { name: "Ρύθμιση συντήρησης", exact: true })
    .click();
  assert.equal(
    await page.locator("[name=maintenance_calories]").inputValue(),
    "2000",
  );
  await page
    .getByRole("button", { name: "Αποθήκευση συντήρησης", exact: true })
    .click();
  await page.getByText("Η συντήρηση αποθηκεύτηκε.", { exact: true }).waitFor();
  await page.getByRole("tab", { name: "Ημέρα", exact: true }).click();
  assert.match(await page.locator(".balance-card").innerText(), /1\.700/);
  // Actual MCP RPC workout, same database and idempotent retry, becomes visible on refresh.
  const workoutPayload = {
    request_id: meal().request_id,
    date: payload.date,
    name: "Τρέξιμο από MCP",
    calories_burned: 500,
  };
  await confirm("addWorkout", workoutPayload);
  await confirm("addWorkout", workoutPayload);
  await page.getByRole("button", { name: "Ανανέωση", exact: true }).click();
  await page
    .getByRole("heading", { name: "Τρέξιμο από MCP", exact: true })
    .waitFor();
  assert.match(await page.locator(".balance-card").innerText(), /2\.200/);
  // A committed request whose response was lost retries with its original UUID.
  await page
    .getByRole("button", { name: "Προσθήκη προπόνησης", exact: true })
    .click();
  await page.locator("[name=workout_name]").fill("Ποδήλατο χειροκίνητα");
  await page.locator("[name=calories_burned]").fill("250");
  loseNextWorkoutResponse = true;
  await page
    .getByRole("button", { name: "Αποθήκευση προπόνησης", exact: true })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Η αλλαγή δεν επιβεβαιώθηκε" })
    .waitFor();
  await page
    .getByRole("button", { name: "Αποθήκευση προπόνησης", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.equal(
    (await db.query("select id from public.workouts")).rows.length,
    2,
  );
  await page
    .getByRole("button", {
      name: "Επεξεργασία προπόνησης Ποδήλατο χειροκίνητα",
      exact: true,
    })
    .click();
  await page.locator("[name=calories_burned]").fill("300");
  await page
    .getByRole("button", { name: "Αποθήκευση προπόνησης", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.match(await page.locator(".balance-card").innerText(), /2\.500/);
  await page
    .getByRole("button", {
      name: "Διαγραφή προπόνησης Ποδήλατο χειροκίνητα",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Ακύρωση", exact: true }).click();
  assert.equal(
    (await db.query("select id from public.workouts")).rows.length,
    2,
  );
  await page
    .getByRole("button", {
      name: "Διαγραφή προπόνησης Ποδήλατο χειροκίνητα",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Διαγραφή προπόνησης", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.equal(
    (await db.query("select id from public.workouts")).rows.length,
    1,
  );
  if (process.env.NUTRITION_SCREENSHOT_DIR) {
    await (
      await import("node:fs/promises")
    ).mkdir(process.env.NUTRITION_SCREENSHOT_DIR, { recursive: true });
    await page.setViewportSize({ width: 375, height: 844 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: process.env.NUTRITION_SCREENSHOT_DIR + "/day-mobile.png",
      fullPage: true,
    });
  }

  // Separate views, keyboard navigation and week-to-day drilldown.
  await page.getByRole("tab", { name: "Ημέρα", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("heading", { name: "Εβδομαδιαία εικόνα" }).waitFor();
  assert.match(await page.locator(".weekly").innerText(), /300/);
  assert.match(await page.locator(".balance-card").innerText(), /2\.200/);
  assert.match(await page.locator(".balance-card").innerText(), /1\/7/);
  assert.match(await page.locator(".weekly-balances").innerText(), /-2\.200/);
  assert.equal(
    await page
      .locator(".balance-day")
      .first()
      .evaluate((el) => getComputedStyle(el).color),
    "rgb(32, 58, 61)",
  );
  if (process.env.NUTRITION_SCREENSHOT_DIR)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: process.env.NUTRITION_SCREENSHOT_DIR + "/week-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: /Τετάρτη.*300 kcal/ }).click();
  await page.getByRole("heading", { name: "Ημερήσια εικόνα" }).waitFor();
  assert.equal(
    await page.getByLabel("Ημερομηνία καταγραφής").inputValue(),
    "2026-10-14",
  );
  await page
    .getByRole("button", { name: "Προηγούμενη ημέρα", exact: true })
    .click();
  assert.equal(
    await page.getByLabel("Ημερομηνία καταγραφής").inputValue(),
    "2026-10-13",
  );
  await page
    .getByRole("button", { name: "Επόμενη ημέρα", exact: true })
    .click();
  // Manual entry is optional and can be dismissed without writing anything.
  await page
    .getByRole("button", { name: "Χειροκίνητη προσθήκη", exact: true })
    .click();
  await page.getByRole("dialog").waitFor();
  await page.locator("input[name=name]").fill("Unsaved meal");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });
  await page
    .getByRole("button", { name: "Διαγραφή Γιαούρτι", exact: true })
    .click();
  await page.getByRole("dialog", { name: "Διαγραφή γεύματος;" }).waitFor();
  await page.getByRole("button", { name: "Ακύρωση", exact: true }).click();
  assert.equal((await db.query("select id from public.meals")).rows.length, 1);
  await page
    .getByRole("button", { name: "Χειροκίνητη προσθήκη", exact: true })
    .click();
  await page.locator("input[name=name]").fill("Χειροκίνητο δοκιμαστικό");
  for (const [key, value] of [
    ["calories", "120"],
    ["protein", "6"],
    ["carbs", "18"],
    ["fat", "3"],
  ])
    await page.locator(`input[name=${key}]`).fill(value);
  await page
    .getByRole("button", { name: "Αποθήκευση γεύματος", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Χειροκίνητο δοκιμαστικό" })
    .waitFor();
  assert.equal((await db.query("select id from public.meals")).rows.length, 2);
  await page
    .getByRole("button", {
      name: "Διαγραφή Χειροκίνητο δοκιμαστικό",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Διαγραφή γεύματος", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "detached" });
  assert.equal((await db.query("select id from public.meals")).rows.length, 1);

  for (const width of [320, 375, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `overflow at ${width}`,
    );
  }

  // Local goal edits survive data refresh and view changes without overwriting
  // untouched settings received from another device.
  await page.getByRole("tab", { name: "Ρυθμίσεις", exact: true }).click();
  await page.locator("input[name=rest_calories]").fill("2300");
  await confirm("updateNutritionTargets", {
    request_id: meal().request_id,
    rest: { calories: 2200, protein: 180, carbs: 220, fat: 67 },
    training: { calories: 3000, protein: 180, carbs: 400, fat: 85 },
  });
  await page.getByRole("button", { name: "Ανανέωση", exact: true }).click();
  assert.equal(
    await page.locator("input[name=rest_calories]").inputValue(),
    "2300",
  );
  await page
    .getByRole("link", { name: "Nutrition Tracker · Ημέρα", exact: true })
    .click();
  await page.getByRole("tab", { name: "Ρυθμίσεις", exact: true }).click();
  assert.equal(
    await page.locator("input[name=rest_calories]").inputValue(),
    "2300",
  );
  if (process.env.NUTRITION_SCREENSHOT_DIR) {
    await page.setViewportSize({ width: 375, height: 844 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: process.env.NUTRITION_SCREENSHOT_DIR + "/settings-mobile.png",
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Αποθήκευση στόχων", exact: true })
    .click();
  await page.getByText("Οι στόχοι αποθηκεύτηκαν.", { exact: true }).waitFor();
  const savedGoals = (
    await db.query("select * from public.goals where user_id=$1", [userA])
  ).rows[0];
  assert.equal(savedGoals.calories, 2300);
  assert.equal(savedGoals.training_calories, 3000);
  await page.getByRole("tab", { name: "Ημέρα", exact: true }).click();

  for (const view of ["Ημέρα", "Εβδομάδα", "Πρόοδος", "Ρυθμίσεις"]) {
    await page.getByRole("tab", { name: view, exact: true }).click();
    for (const width of [320, 375, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `${view} overflow at ${width}`,
      );
    }
  }
  await page.setViewportSize({ width: 375, height: 844 });
  await page.getByRole("tab", { name: "Ημέρα", exact: true }).click();
  const update = {
    ...meal(),
    meal_id: saved.id,
    name: "Updated via MCP",
    calories: 450,
  };
  await confirm("updateMeal", update);
  await page.getByRole("button", { name: "Ανανέωση", exact: true }).click();
  await page
    .getByRole("heading", { name: "Updated via MCP", exact: true })
    .waitFor();
  await confirm("addWeight", {
    request_id: meal().request_id,
    date: "2026-10-13",
    weight_kg: 100,
  });
  await confirm("addWeight", {
    request_id: meal().request_id,
    date: "2026-10-14",
    weight_kg: 99.5,
  });
  await page.getByRole("button", { name: "Ανανέωση", exact: true }).click();
  await page.getByRole("tab", { name: "Πρόοδος", exact: true }).click();
  await page
    .locator(".weight-current>strong")
    .filter({ hasText: "99,5" })
    .waitFor();
  if (process.env.NUTRITION_SCREENSHOT_DIR)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: process.env.NUTRITION_SCREENSHOT_DIR + "/progress-mobile.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "Ημέρα", exact: true }).click();
  const target = {
    request_id: meal().request_id,
    rest: { calories: 2200, protein: 180, carbs: 220, fat: 67 },
    training: { calories: 2700, protein: 180, carbs: 320, fat: 78 },
  };
  await confirm("updateNutritionTargets", target);
  await page.getByRole("button", { name: "Ανανέωση", exact: true }).click();
  await page.getByLabel("Στόχοι ημέρας").selectOption("training");
  assert.match(await page.locator(".stat").first().innerText(), /2\.700/);
  await confirm("deleteMeal", {
    request_id: meal().request_id,
    meal_id: saved.id,
  });
  await page.getByRole("button", { name: "Ανανέωση", exact: true }).click();
  await page
    .getByRole("heading", { name: "Δεν υπάρχουν γεύματα ακόμη" })
    .waitFor();
  await page.goto(origin + "/oauth/consent?authorization_id=test");
  await page.getByRole("heading", { name: "Nutrition Tracker test" }).waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Έγκριση πρόσβασης" }).count(),
    1,
  );
  // History beyond the default PostgREST row cap must not disappear from totals.
  await db.exec("reset role");
  await db.query(
    "insert into public.meals(user_id,date,name,category,calories,protein,carbs,fat) select $1, date '2025-01-01'+(n%300),'History fixture','Σνακ',1,0,0,0 from generate_series(1,1001) as n",
    [userA],
  );
  await confirm("addMeal", { ...meal(), name: "Beyond 1000", calories: 777 });
  await page.goto(origin);
  await page.getByRole("heading", { name: "Ημερήσια εικόνα" }).waitFor();
  await page.getByLabel("Ημερομηνία καταγραφής").fill("2026-10-14");
  await page
    .getByRole("heading", { name: "Beyond 1000", exact: true })
    .waitFor();
  assert.match(await page.locator(".energy-card").innerText(), /777/);
  energyLegacyMode = true;
  await page.goto(origin);
  await page.getByRole("heading", { name: "Ημερήσια εικόνα" }).waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Προσθήκη προπόνησης", exact: true })
      .isDisabled(),
    true,
  );
  await page
    .getByRole("button", { name: "Χειροκίνητη προσθήκη", exact: true })
    .click();
  assert.equal(await page.locator("input[name=carbs]").count(), 1);
  await page.keyboard.press("Escape");
  legacyMode = true;
  await page.goto(origin);
  await page
    .getByText("Κάποιες λειτουργίες δεν είναι διαθέσιμες", { exact: false })
    .waitFor();
  await page
    .getByRole("button", { name: "Χειροκίνητη προσθήκη", exact: true })
    .click();
  assert.equal(await page.locator("input[name=calories]").count(), 1);
  assert.equal(await page.locator("input[name=carbs]").count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: paginated history beyond 1000 records, workout RPC add/edit/delete, saved 2000 maintenance, daily/weekly balance, lost-response retry without duplicates, energy migration fallback, direct PostgreSQL writes without dashboard approval, macro/fueling totals, updates/deletion, weights/targets, mobile 320–1280, OAuth consent rendering, legacy-schema fallback, tab/keyboard navigation, week drilldown, date controls, modal cancellation and unsaved goal preservation. HTTP auth/REST bridge is simulated; live Supabase OAuth is not verified.",
  );
} finally {
  await browser?.close();
  vite.kill("SIGTERM");
  await db.close();
}
