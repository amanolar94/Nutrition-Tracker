export function weekBounds(date) {
  const day = new Date(date + "T00:00:00Z");
  const offset = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - offset);
  const start_date = day.toISOString().slice(0, 10);
  day.setUTCDate(day.getUTCDate() + 6);
  return { start_date, end_date: day.toISOString().slice(0, 10) };
}
import { dailyEnergy, weeklyEnergy } from "./energy.js";
export function summarizeWeek(
  meals,
  date,
  workouts = [],
  maintenance = null,
  today,
  dayTypes = [],
) {
  const { start_date, end_date } = weekBounds(date);
  const selected = meals.filter(
    (m) => m.date >= start_date && m.date <= end_date,
  );
  const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 },
    workout_fueling = { ...totals };
  let incomplete_macro_records = 0;
  const daily = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(start_date + "T00:00:00Z");
    day.setUTCDate(day.getUTCDate() + i);
    const date = day.toISOString().slice(0, 10);
    const records = selected.filter((m) => m.date === date);
    const sum = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (const m of records) {
      if (m.carbs == null || m.fat == null) incomplete_macro_records++;
      for (const key of Object.keys(totals)) {
        sum[key] += m[key] ?? 0;
        totals[key] += m[key] ?? 0;
        if (m.category === "Τροφοδοσία προπόνησης")
          workout_fueling[key] += m[key] ?? 0;
      }
    }
    daily.push({
      date,
      day_type: dayTypes.find((d) => d.date === date)?.day_type || "rest",
      totals: sum,
      meal_count: records.length,
      energy_balance: dailyEnergy(records, workouts, date, maintenance, today),
    });
  }
  return {
    start_date,
    end_date,
    timezone: "Europe/Athens",
    totals,
    workout_fueling,
    daily,
    daily_average: Object.fromEntries(
      Object.entries(totals).map(([k, v]) => [k, v / 7]),
    ),
    recorded_days: daily.filter((d) => d.meal_count > 0).length,
    recorded_day_average: Object.fromEntries(
      Object.entries(totals).map(([k, v]) => [
        k,
        daily.some((d) => d.meal_count > 0)
          ? v / daily.filter((d) => d.meal_count > 0).length
          : null,
      ]),
    ),
    meal_count: selected.length,
    incomplete_macro_records,
    energy_balance: weeklyEnergy(daily, workouts, start_date, end_date),
  };
}
