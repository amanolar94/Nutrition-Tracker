import { createClient } from "@supabase/supabase-js";
import { readRows } from "./records.js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export const defaultGoals = {
  calories: 2200,
  protein: 180,
  carbs: 220,
  fat: 67,
  training_calories: 2700,
  training_protein: 180,
  training_carbs: 320,
  training_fat: 78,
};
const missingSchema = (error) =>
  ["42703", "PGRST204", "PGRST205", "42P01"].includes(error?.code);
export async function loadDiary(userId) {
  let [meals, goals, weights, workouts, energySettings, dayTypes, templates] =
    await Promise.all([
      readRows(
        supabase
          .from("meals")
          .select("id,date,name,category,calories,protein,carbs,fat,meal_time")
          .eq("user_id", userId)
          .order("created_at")
          .order("id"),
      ),
      supabase
        .from("goals")
        .select(
          "calories,protein,carbs,fat,training_calories,training_protein,training_carbs,training_fat",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      readRows(
        supabase
          .from("weights")
          .select("id,date,weight_kg")
          .eq("user_id", userId)
          .order("date"),
      ),
      readRows(
        supabase
          .from("workouts")
          .select("id,date,name,calories_burned")
          .eq("user_id", userId)
          .order("date")
          .order("created_at")
          .order("id"),
      ),
      supabase
        .from("energy_settings")
        .select("maintenance_calories")
        .eq("user_id", userId)
        .maybeSingle(),
      readRows(
        supabase
          .from("diary_days")
          .select("date,day_type")
          .eq("user_id", userId)
          .order("date"),
      ),
      readRows(
        supabase
          .from("meal_templates")
          .select("id,name,category,calories,protein,carbs,fat")
          .eq("user_id", userId)
          .order("created_at")
          .order("id"),
      ),
    ]);
  let diaryMigrationPending =
    missingSchema(dayTypes.error) || missingSchema(templates.error);
  if (missingSchema(dayTypes.error)) dayTypes = { data: [], error: null };
  if (missingSchema(templates.error)) templates = { data: [], error: null };
  if (missingSchema(meals.error)) {
    diaryMigrationPending = true;
    meals = await readRows(
      supabase
        .from("meals")
        .select("id,date,name,category,calories,protein,carbs,fat")
        .eq("user_id", userId)
        .order("created_at")
        .order("id"),
    );
  }
  let migrationPending = false;
  if (missingSchema(meals.error)) {
    migrationPending = true;
    meals = await readRows(
      supabase
        .from("meals")
        .select("id,date,name,category,calories,protein")
        .eq("user_id", userId)
        .order("created_at")
        .order("id"),
    );
  }
  if (missingSchema(goals.error)) {
    migrationPending = true;
    goals = await supabase
      .from("goals")
      .select("calories,protein")
      .eq("user_id", userId)
      .maybeSingle();
  }
  if (missingSchema(weights.error)) {
    migrationPending = true;
    weights = { data: [], error: null };
  }
  const energyMigrationPending =
    missingSchema(workouts.error) || missingSchema(energySettings.error);
  if (missingSchema(workouts.error)) workouts = { data: [], error: null };
  if (missingSchema(energySettings.error))
    energySettings = { data: null, error: null };
  if (
    meals.error ||
    goals.error ||
    weights.error ||
    workouts.error ||
    energySettings.error ||
    dayTypes.error ||
    templates.error
  )
    throw (
      meals.error ||
      goals.error ||
      weights.error ||
      workouts.error ||
      energySettings.error ||
      dayTypes.error ||
      templates.error
    );
  return {
    meals: meals.data,
    goals: { ...defaultGoals, ...goals.data },
    weights: weights.data,
    migrationPending,
    workouts: workouts.data,
    energySettings: energySettings.data || { maintenance_calories: null },
    energyMigrationPending,
    diaryMigrationPending,
    dayTypes: dayTypes.data,
    templates: templates.data,
  };
}
export async function insertMeal(userId, meal) {
  const { error } = await supabase
    .from("meals")
    .insert({ ...meal, user_id: userId });
  if (error) throw error;
}
export async function deleteMeal(userId, id) {
  const { error } = await supabase
    .from("meals")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}
export async function updateGoals(userId, goals) {
  const { error } = await supabase
    .from("goals")
    .upsert({ ...goals, user_id: userId }, { onConflict: "user_id" });
  if (error) throw error;
}
export async function writeEnergy(operation, payload) {
  const { data, error } = await supabase.rpc("write_nutrition", {
    p_operation: operation,
    p_payload: payload,
  });
  if (error) throw error;
  return data;
}
