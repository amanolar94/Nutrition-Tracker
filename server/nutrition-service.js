import { weekBounds, summarizeWeek } from "../src/summaries.js";
import { rangeBounds } from "./schemas.js";
import { dailyEnergy } from "../src/energy.js";
import { readRows } from "../src/records.js";
export const mealColumns = "id,date,name,category,calories,protein,carbs,fat";
export const provisionalTargets = {
  rest: { calories: 2200, protein: 180, carbs: 220, fat: 67 },
  training: { calories: 2700, protein: 180, carbs: 320, fat: 78 },
};
function checked(result) {
  if (result.error) throw result.error;
  return result.data;
}
const missingSchema = (error) =>
  ["42P01", "42703", "PGRST204", "PGRST205"].includes(error?.code);
export function mapTargets(row) {
  return row
    ? {
        rest: {
          calories: row.calories,
          protein: row.protein,
          carbs: row.carbs,
          fat: row.fat,
        },
        training: {
          calories: row.training_calories,
          protein: row.training_protein,
          carbs: row.training_carbs,
          fat: row.training_fat,
        },
      }
    : provisionalTargets;
}
export function summarizeMeals(meals, date) {
  const total = { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const fueling = { ...total };
  let incomplete = 0;
  for (const meal of meals) {
    if (meal.carbs == null || meal.fat == null) incomplete++;
    for (const key of Object.keys(total)) {
      total[key] += meal[key] ?? 0;
      if (meal.category === "Τροφοδοσία προπόνησης")
        fueling[key] += meal[key] ?? 0;
    }
  }
  return {
    date,
    timezone: "Europe/Athens",
    totals: total,
    workout_fueling: fueling,
    meal_count: meals.length,
    incomplete_macro_records: incomplete,
  };
}
export function nutritionService(client, userId) {
  return {
    async getMeals(args) {
      const { start, end } = rangeBounds(args);
      return checked(
        await readRows(
          client
            .from("meals")
            .select(mealColumns)
            .eq("user_id", userId)
            .gte("date", start)
            .lte("date", end)
            .order("date")
            .order("created_at")
            .order("id"),
          1001,
        ),
      );
    },
    async getDailySummary({ date }) {
      const meals = await this.getMeals({ date }),
        { workouts, settings, setup_required } = await this.energyContext({
          date,
        });
      if (meals.length > 1000 || workouts.length > 1000)
        throw Error("Too many records; use a narrower range");
      return {
        ...summarizeMeals(meals, date),
        energy_balance: {
          ...dailyEnergy(meals, workouts, date, settings.maintenance_calories),
          setup_required,
        },
      };
    },
    async getWeeklySummary({ date }) {
      const { start_date, end_date } = weekBounds(date);
      const meals = await this.getMeals({ start_date, end_date }),
        { workouts, settings, setup_required } = await this.energyContext({
          start_date,
          end_date,
        });
      if (meals.length > 1000 || workouts.length > 1000)
        throw Error("Too many records");
      const summary = summarizeWeek(
        meals,
        date,
        workouts,
        settings.maintenance_calories,
      );
      summary.energy_balance.setup_required = setup_required;
      return summary;
    },
    async energyContext(args) {
      try {
        return {
          workouts: await this.getWorkouts(args),
          settings: await this.getEnergySettings(),
          setup_required: false,
        };
      } catch (error) {
        if (!missingSchema(error)) throw error;
        return {
          workouts: [],
          settings: { maintenance_calories: null },
          setup_required: true,
        };
      }
    },
    async getWorkouts(args) {
      const { start, end } = rangeBounds(args);
      return checked(
        await readRows(
          client
            .from("workouts")
            .select("id,date,name,calories_burned")
            .eq("user_id", userId)
            .gte("date", start)
            .lte("date", end)
            .order("date")
            .order("created_at")
            .order("id"),
          1001,
        ),
      );
    },
    async getEnergySettings() {
      return (
        checked(
          await client
            .from("energy_settings")
            .select("maintenance_calories")
            .eq("user_id", userId)
            .maybeSingle(),
        ) || { maintenance_calories: null }
      );
    },
    async getWeightHistory(args) {
      const { start, end } = rangeBounds(args);
      return checked(
        await readRows(
          client
            .from("weights")
            .select("id,date,weight_kg")
            .eq("user_id", userId)
            .gte("date", start)
            .lte("date", end)
            .order("date"),
          1001,
        ),
      );
    },
    async getNutritionTargets() {
      return {
        ...mapTargets(
          checked(
            await client
              .from("goals")
              .select("*")
              .eq("user_id", userId)
              .maybeSingle(),
          ),
        ),
        energy_settings: await this.getEnergySettings().catch((error) => {
          if (!missingSchema(error)) throw error;
          return { maintenance_calories: null, setup_required: true };
        }),
        provisional_starting_weight_kg: 100,
        timezone: "Europe/Athens",
      };
    },
    async write(operation, payload) {
      return checked(
        await client.rpc("write_nutrition", {
          p_operation: operation,
          p_payload: payload,
        }),
      );
    },
  };
}
