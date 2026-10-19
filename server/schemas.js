import { z } from "zod";
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value
    );
  }, "Use a valid calendar date YYYY-MM-DD (Europe/Athens)");
export const categorySchema = z.enum([
  "Πρωινό",
  "Μεσημεριανό",
  "Βραδινό",
  "Σνακ",
  "Τροφοδοσία προπόνησης",
]);
const macro = z.number().finite().min(0).max(10000);
export const mealFields = {
  date: dateSchema,
  name: z.string().trim().min(1).max(120),
  category: categorySchema,
  calories: z.number().finite().positive().max(100000),
  protein: macro,
  carbs: macro,
  fat: macro,
  meal_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .optional()
    .describe(
      "Optional meal time HH:MM in Europe/Athens. Null clears the time; omitted updates preserve it.",
    ),
};
const target = z
  .object({
    calories: z.number().finite().positive().max(100000),
    protein: z.number().finite().positive().max(10000),
    carbs: macro,
    fat: macro,
  })
  .strict();
const workoutFields = {
  date: dateSchema,
  name: z.string().trim().min(1).max(120),
  calories_burned: z
    .number()
    .finite()
    .positive()
    .max(20000)
    .describe(
      "Active exercise kcal only, excluding resting energy during the workout; not total daily expenditure.",
    ),
};
export const writes = {
  setDayType: z
    .object({
      request_id: z.string().uuid(),
      date: dateSchema,
      day_type: z.enum(["rest", "training"]),
    })
    .strict(),
  saveMealTemplate: z
    .object({
      request_id: z.string().uuid(),
      template_id: z.string().uuid().optional(),
      ...Object.fromEntries(
        Object.entries(mealFields).filter(
          ([key]) => !["date", "meal_time"].includes(key),
        ),
      ),
    })
    .strict(),
  deleteMealTemplate: z
    .object({ request_id: z.string().uuid(), template_id: z.string().uuid() })
    .strict(),
  addMeal: z.object({ request_id: z.string().uuid(), ...mealFields }).strict(),
  updateMeal: z
    .object({
      request_id: z.string().uuid(),
      meal_id: z.string().uuid(),
      ...mealFields,
    })
    .strict(),
  deleteMeal: z
    .object({ request_id: z.string().uuid(), meal_id: z.string().uuid() })
    .strict(),
  addWeight: z
    .object({
      request_id: z.string().uuid(),
      date: dateSchema,
      weight_kg: z.number().finite().min(20).max(500),
    })
    .strict(),
  updateNutritionTargets: z
    .object({ request_id: z.string().uuid(), rest: target, training: target })
    .strict(),
  addWorkout: z
    .object({ request_id: z.string().uuid(), ...workoutFields })
    .strict(),
  updateWorkout: z
    .object({
      request_id: z.string().uuid(),
      workout_id: z.string().uuid(),
      ...workoutFields,
    })
    .strict(),
  deleteWorkout: z
    .object({ request_id: z.string().uuid(), workout_id: z.string().uuid() })
    .strict(),
  updateEnergySettings: z
    .object({
      request_id: z.string().uuid(),
      maintenance_calories: z
        .number()
        .finite()
        .min(500)
        .max(10000)
        .nullable()
        .describe(
          "Estimated daily maintenance kcal including normal activity but EXCLUDING separately logged workouts. Not BMR, intake target, or exercise-inclusive TDEE. Null clears the estimate. Changing this recalculates all historical balances.",
        ),
    })
    .strict(),
};
export const rangeSchema = z
  .object({
    date: dateSchema.optional(),
    start_date: dateSchema.optional(),
    end_date: dateSchema.optional(),
  })
  .strict()
  .refine(
    (v) =>
      Boolean(v.date) !== Boolean(v.start_date && v.end_date) &&
      !(v.date && (v.start_date || v.end_date)),
    "Provide date or start_date and end_date",
  )
  .refine(
    (v) =>
      !v.start_date ||
      (v.start_date <= v.end_date &&
        (new Date(v.end_date) - new Date(v.start_date)) / 86400000 <= 366),
    "Range must be ordered and at most 366 days",
  );
export function rangeBounds(args) {
  return {
    start: args.date || args.start_date,
    end: args.date || args.end_date,
  };
}
