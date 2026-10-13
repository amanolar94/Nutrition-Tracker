import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export const defaultGoals = { calories: 2000, protein: 100 };
export async function loadDiary(userId) {
  const [meals, goals] = await Promise.all([
    supabase.from('meals').select('id,date,name,category,calories,protein').eq('user_id', userId).order('created_at'),
    supabase.from('goals').select('calories,protein').eq('user_id', userId).maybeSingle(),
  ]);
  if (meals.error || goals.error) throw meals.error || goals.error;
  return { meals: meals.data, goals: goals.data || defaultGoals };
}
export async function insertMeal(userId, meal) {
  const {error} = await supabase.from('meals').insert({...meal, user_id: userId});
  if (error) throw error;
}
export async function deleteMeal(userId, id) {
  const {error} = await supabase.from('meals').delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}
export async function updateGoals(userId, goals) {
  const {error} = await supabase.from('goals').upsert({...goals, user_id: userId}, {onConflict: 'user_id'});
  if (error) throw error;
}
