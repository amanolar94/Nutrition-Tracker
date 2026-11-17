import { t, getLanguage, getLocale } from "./i18n.js";
export const metrics = [
  ["calories", "Θερμίδες", "kcal"],
  ["protein", "Πρωτεΐνη", "g"],
  ["carbs", "Υδατάνθρακες", "g"],
  ["fat", "Λιπαρά", "g"],
];
export const categories = [
  "Πρωινό",
  "Μεσημεριανό",
  "Βραδινό",
  "Σνακ",
  "Τροφοδοσία προπόνησης",
];
export const number = (value, language = getLanguage()) =>
  Number(value).toLocaleString(getLocale(language), {
    maximumFractionDigits: 1,
  });
export function shiftDate(value, days) {
  const date = new Date(value + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function dateLabel(
  value,
  options = { day: "numeric", month: "long" },
  language = getLanguage(),
) {
  return new Intl.DateTimeFormat(getLocale(language), {
    timeZone: "Europe/Athens",
    ...options,
  }).format(new Date(value + "T12:00:00Z"));
}
export function budgetLabel(value, target, unit, language = getLanguage()) {
  const gap = target - value;
  return gap > 0
    ? t(
        "{v0} {v1} έως τον στόχο",
        { v0: number(gap, language), v1: unit },
        language,
      )
    : gap < 0
      ? t(
          "{v0} {v1} πάνω από τον στόχο",
          { v0: number(-gap, language), v1: unit },
          language,
        )
      : t("Ακριβώς στον στόχο", {}, language);
}
export function relativeDay(value, today, language = getLanguage()) {
  return value === today
    ? t("Σήμερα", {}, language)
    : value === shiftDate(today, -1)
      ? t("Χθες", {}, language)
      : dateLabel(value, { weekday: "long" }, language);
}
