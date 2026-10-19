import { localDate } from "./nutrition.js";

// Maintenance includes normal daily activity but excludes separately logged exercise.
// A food target may already encode a deficit, so it is never used as maintenance.
export function dailyEnergy(
  meals,
  workouts,
  date,
  maintenance,
  today = localDate(),
) {
  const food = meals.filter((m) => m.date === date);
  const exercise = workouts.filter((w) => w.date === date);
  const intake = food.reduce((n, m) => n + m.calories, 0);
  const burned = exercise.reduce((n, w) => n + w.calories_burned, 0);
  const baseline =
    Number.isFinite(maintenance) && maintenance > 0 ? maintenance : null;
  const reason =
    baseline === null
      ? "maintenance_not_set"
      : date > today
        ? "future_date"
        : !food.length
          ? "no_meals_logged"
          : null;
  const expenditure = baseline === null ? null : baseline + burned;
  return {
    intake_calories: intake,
    workout_calories: burned,
    workout_count: exercise.length,
    maintenance_calories: baseline,
    estimated_expenditure_calories: expenditure,
    balance_calories: reason ? null : intake - expenditure,
    unavailable_reason: reason,
    is_estimate: true,
    basis: "current_maintenance_setting",
    tracking_basis: "logged_meals_and_workouts_only",
  };
}

export function weeklyEnergy(daily, workouts, start, end) {
  const included = daily.filter(
    (d) => d.energy_balance.balance_calories !== null,
  );
  const sum = (key) => included.reduce((n, d) => n + d.energy_balance[key], 0);
  return {
    // Workout totals include workout-only days; balance totals exclude those days.
    workout_calories: workouts
      .filter((w) => w.date >= start && w.date <= end)
      .reduce((n, w) => n + w.calories_burned, 0),
    included_days: included.length,
    included_dates: included.map((d) => d.date),
    excluded_dates: daily
      .filter((d) => d.energy_balance.balance_calories === null)
      .map((d) => ({
        date: d.date,
        reason: d.energy_balance.unavailable_reason,
      })),
    intake_calories: sum("intake_calories"),
    included_workout_calories: sum("workout_calories"),
    estimated_expenditure_calories: included.length
      ? sum("estimated_expenditure_calories")
      : null,
    balance_calories: included.length ? sum("balance_calories") : null,
    daily_average_balance_calories: included.length
      ? sum("balance_calories") / included.length
      : null,
    is_partial_week: included.length < 7,
    is_estimate: true,
    basis: "current_maintenance_setting",
    tracking_basis: "logged_meals_and_workouts_only",
  };
}
