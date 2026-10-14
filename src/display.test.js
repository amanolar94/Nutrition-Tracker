import test from "node:test";
import assert from "node:assert/strict";
import { shiftDate, relativeDay, budgetLabel } from "./display.js";
test("calendar navigation crosses months and Athens DST without skipping days", () => {
  assert.equal(shiftDate("2026-10-25", 1), "2026-10-26");
  assert.equal(shiftDate("2026-03-29", -1), "2026-03-28");
  assert.equal(shiftDate("2026-01-01", -1), "2025-12-31");
  assert.equal(shiftDate("2026-10-14", 7), "2026-10-21");
});
test("day and budget labels describe deficits and excess without negative remaining values", () => {
  assert.equal(relativeDay("2026-10-14", "2026-10-14"), "Σήμερα");
  assert.equal(relativeDay("2026-10-13", "2026-10-14"), "Χθες");
  assert.equal(budgetLabel(2500, 2200, "kcal"), "300 kcal πάνω από τον στόχο");
  assert.equal(budgetLabel(2200, 2200, "kcal"), "Ακριβώς στον στόχο");
  assert.equal(budgetLabel(1900, 2200, "kcal"), "300 kcal έως τον στόχο");
});
