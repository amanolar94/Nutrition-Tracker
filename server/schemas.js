import { z } from 'zod';
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
 const date = new Date(`${value}T00:00:00Z`);
 return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===value;
}, 'Use a valid calendar date YYYY-MM-DD (Europe/Athens)');
export const categorySchema = z.enum(['Πρωινό','Μεσημεριανό','Βραδινό','Σνακ','Τροφοδοσία προπόνησης']);
const macro = z.number().finite().min(0).max(10000);
export const mealFields = {date:dateSchema,name:z.string().trim().min(1).max(120),category:categorySchema,calories:z.number().finite().positive().max(100000),protein:macro,carbs:macro,fat:macro};
const target = z.object({calories:z.number().finite().positive().max(100000),protein:z.number().finite().positive().max(10000),carbs:macro,fat:macro}).strict();
export const writes = {
 addMeal:z.object({request_id:z.string().uuid(),...mealFields}).strict(),
 updateMeal:z.object({request_id:z.string().uuid(),meal_id:z.string().uuid(),...mealFields}).strict(),
 deleteMeal:z.object({request_id:z.string().uuid(),meal_id:z.string().uuid()}).strict(),
 addWeight:z.object({request_id:z.string().uuid(),date:dateSchema,weight_kg:z.number().finite().min(20).max(500)}).strict(),
 updateNutritionTargets:z.object({request_id:z.string().uuid(),rest:target,training:target}).strict(),
};
export const draftInput = z.object({operation:z.enum(Object.keys(writes)),payload:z.union(Object.values(writes))}).strict().superRefine((value,ctx)=>{
 const result=writes[value.operation].safeParse(value.payload);
 if(!result.success)for(const issue of result.error.issues)ctx.addIssue({...issue,path:['payload',...issue.path]});
});
export const rangeSchema = z.object({date:dateSchema.optional(),start_date:dateSchema.optional(),end_date:dateSchema.optional()}).strict().refine(v=> Boolean(v.date) !== Boolean(v.start_date && v.end_date) && !(v.date&&(v.start_date||v.end_date)), 'Provide date or start_date and end_date').refine(v=>!v.start_date || (v.start_date<=v.end_date && (new Date(v.end_date)-new Date(v.start_date))/86400000<=366),'Range must be ordered and at most 366 days');
export function rangeBounds(args){return {start:args.date || args.start_date,end:args.date || args.end_date};}
