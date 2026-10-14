import { rangeBounds } from './schemas.js';
export const mealColumns='id,date,name,category,calories,protein,carbs,fat';
export const provisionalTargets={rest:{calories:2200,protein:180,carbs:220,fat:67},training:{calories:2700,protein:180,carbs:320,fat:78}};
function checked(result){if(result.error)throw result.error;return result.data;}
export function mapTargets(row){return row ? {rest:{calories:row.calories,protein:row.protein,carbs:row.carbs,fat:row.fat},training:{calories:row.training_calories,protein:row.training_protein,carbs:row.training_carbs,fat:row.training_fat}} : provisionalTargets;}
export function summarizeMeals(meals,date){
 const total={calories:0,protein:0,carbs:0,fat:0};const fueling={...total};let incomplete=0;
 for(const meal of meals){if(meal.carbs==null || meal.fat==null)incomplete++;for(const key of Object.keys(total)){total[key]+=meal[key]??0;if(meal.category==='Τροφοδοσία προπόνησης')fueling[key]+=meal[key]??0;}}
 return {date,timezone:'Europe/Athens',totals:total,workout_fueling:fueling,meal_count:meals.length,incomplete_macro_records:incomplete};
}
export function nutritionService(client,userId){return {
 async getMeals(args){const {start,end}=rangeBounds(args);return checked(await client.from('meals').select(mealColumns).eq('user_id',userId).gte('date',start).lte('date',end).order('date').order('created_at').limit(1001));},
 async getDailySummary({date}){const meals=await this.getMeals({date});if(meals.length>1000)throw Error('Too many records; use a narrower range');return summarizeMeals(meals,date);},
 async getWeightHistory(args){const {start,end}=rangeBounds(args);return checked(await client.from('weights').select('id,date,weight_kg').eq('user_id',userId).gte('date',start).lte('date',end).order('date').limit(1001));},
 async getNutritionTargets(){return {...mapTargets(checked(await client.from('goals').select('*').eq('user_id',userId).maybeSingle())),provisional_starting_weight_kg:100,timezone:'Europe/Athens'};},
 async prepareWrite({operation,payload}){return checked(await client.rpc('prepare_nutrition_write',{p_operation:operation,p_payload:payload}));},
 async getWriteDraft({confirmation_id}){return checked(await client.from('nutrition_drafts').select('id,operation,payload,status,expires_at').eq('user_id',userId).eq('id',confirmation_id).single());},
 async write(operation,args){const {confirmation_id,...payload}=args;return checked(await client.rpc('execute_nutrition_write',{p_operation:operation,p_payload:payload,p_confirmation_id:confirmation_id}));},
};}
