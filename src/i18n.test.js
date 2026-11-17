import test from "node:test";
import assert from "node:assert/strict";
import { english } from "./translations/en.js";
import {
  t,
  getLanguage,
  getLocale,
  setLanguage,
  subscribeLanguage,
  LANGUAGE_STORAGE_KEY,
} from "./i18n.js";
import {
  number,
  dateLabel,
  budgetLabel,
  relativeDay,
  categories,
} from "./display.js";
import { localDate } from "./nutrition.js";

test("English catalog preserves interpolation fields and provides plain-text translations", () => {
  for (const [source, translated] of Object.entries(english)) {
    assert.ok(translated.trim(), source);
    assert.deepEqual(
      [...source.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(),
      [...translated.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(),
      source,
    );
    assert.doesNotMatch(translated, /[\u0370-\u03ff\u1f00-\u1fff]/, source);
  }
  assert.equal(t("Ημερήσια εικόνα", {}, "en"), "Daily overview");
  assert.equal(t("Ημερήσια εικόνα", {}, "el"), "Ημερήσια εικόνα");
  assert.equal(t(" Προπόνηση ", {}, "en"), " Training ");
  assert.equal(t("  ", {}, "en"), "  ");
  assert.equal(
    t("Επεξεργασία {v0}", { v0: "<meal>{v1}" }, "en"),
    "Edit <meal>{v1}",
  );
  assert.equal(t("Unknown message", {}, "en"), "Unknown message");
});
test("display locales change numbers and date labels without changing Athens dates or category values", () => {
  assert.equal(number(2000.5, "en"), "2,000.5");
  assert.equal(number(2000.5, "el"), "2.000,5");
  assert.equal(dateLabel("2026-10-29", { weekday: "long" }, "en"), "Thursday");
  assert.equal(
    budgetLabel(1900, 2200, "kcal", "en"),
    "300 kcal remaining to target",
  );
  assert.equal(budgetLabel(2500, 2200, "kcal", "en"), "300 kcal above target");
  assert.equal(budgetLabel(2200, 2200, "kcal", "en"), "Target reached");
  assert.equal(relativeDay("2026-10-29", "2026-10-29", "en"), "Today");
  assert.equal(relativeDay("2026-10-28", "2026-10-29", "en"), "Yesterday");
  assert.equal(localDate(new Date("2026-11-17T22:30:00Z")), "2026-11-18");
  assert.equal(categories[0], "Πρωινό");
  assert.equal(t(categories[0], {}, "en"), "Breakfast");
});
test("language changes notify subscribers and work when preference storage is blocked", () => {
  const originalWindow = globalThis.window;
  const events = new Map(),
    saved = new Map();
  globalThis.window = {
    localStorage: { setItem: (key, value) => saved.set(key, value) },
    addEventListener: (name, fn) => events.set(name, fn),
    removeEventListener: (name) => events.delete(name),
  };
  let count = 0;
  const unsubscribe = subscribeLanguage(() => count++);
  try {
    setLanguage("en");
    assert.equal(getLanguage(), "en");
    assert.equal(getLocale(), "en-GB");
    assert.equal(saved.get(LANGUAGE_STORAGE_KEY), "en");
    assert.equal(count, 1);
    setLanguage("fr");
    assert.equal(getLanguage(), "en");
    assert.equal(count, 1);
    setLanguage("en");
    assert.equal(count, 1);
    events.get("storage")({ key: LANGUAGE_STORAGE_KEY, newValue: "el" });
    assert.equal(getLanguage(), "el");
    assert.equal(count, 2);
    window.localStorage.setItem = () => {
      throw Error("Storage blocked");
    };
    setLanguage("en");
    assert.equal(t("Σήμερα"), "Today");
    assert.equal(count, 3);
    events.get("storage")({ key: null, newValue: null });
    assert.equal(getLanguage(), "el");
  } finally {
    unsubscribe();
    globalThis.window = originalWindow;
    setLanguage("el");
  }
});
