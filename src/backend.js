import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export const defaultGoals = {calories:2200,protein:180,carbs:220,fat:67,training_calories:2700,training_protein:180,training_carbs:320,training_fat:78};
const missingSchema=error=>['42703','PGRST204','PGRST205','42P01'].includes(error?.code);
export async function loadDiary(userId) {
 let [meals,goals,weights]=await Promise.all([
  supabase.from('meals').select('id,date,name,category,calories,protein,carbs,fat').eq('user_id',userId).order('created_at'),
  supabase.from('goals').select('calories,protein,carbs,fat,training_calories,training_protein,training_carbs,training_fat').eq('user_id',userId).maybeSingle(),
  supabase.from('weights').select('id,date,weight_kg').eq('user_id',userId).order('date'),
 ]);
 let migrationPending=false;
 if(missingSchema(meals.error)){migrationPending=true;meals=await supabase.from('meals').select('id,date,name,category,calories,protein').eq('user_id',userId).order('created_at');}
 if(missingSchema(goals.error)){migrationPending=true;goals=await supabase.from('goals').select('calories,protein').eq('user_id',userId).maybeSingle();}
 if(missingSchema(weights.error)){migrationPending=true;weights={data:[],error:null};}
 if(meals.error||goals.error||weights.error)throw meals.error||goals.error||weights.error;
 return{meals:meals.data,goals:{...defaultGoals,...goals.data},weights:weights.data,migrationPending};
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
