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
export const number = (value) =>
  Number(value).toLocaleString("el-GR", { maximumFractionDigits: 1 });
export function shiftDate(value, days) {
  const date = new Date(value + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
export function dateLabel(value, options = { day: "numeric", month: "long" }) {
  return new Intl.DateTimeFormat("el-GR", {
    timeZone: "Europe/Athens",
    ...options,
  }).format(new Date(value + "T12:00:00Z"));
}
export function budgetLabel(value, target, unit) {
  const gap = target - value;
  return gap > 0
    ? `${number(gap)} ${unit} έως τον στόχο`
    : gap < 0
      ? `${number(-gap)} ${unit} πάνω από τον στόχο`
      : "Ακριβώς στον στόχο";
}
export function relativeDay(value, today) {
  return value === today
    ? "Σήμερα"
    : value === shiftDate(today, -1)
      ? "Χθες"
      : dateLabel(value, { weekday: "long" });
}
