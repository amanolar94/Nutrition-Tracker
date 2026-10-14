import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {database,identity,prepare,execute,approve,userA,userB,meal} from './helpers/database.js';
let counter=1000;const uuid=()=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(counter++).padStart(12,'0')}`;
test('actual PostgreSQL migrations, ownership, confirmation, idempotency and all write operations',async()=>{
 const db=await database();try{
 // Migration repeatability must preserve existing tables.
 await db.exec(await readFile(new URL('../supabase/migrations/20261014_mcp.sql',import.meta.url),'utf8'));
 await identity(db,userA);const payload=meal();const draft=await prepare(db,'addMeal',payload);
 await assert.rejects(execute(db,'addMeal',payload,draft.confirmation_id),e=>e.code==='42501');
 await assert.rejects(db.query('select public.review_nutrition_draft($1,true)',[draft.confirmation_id]),e=>e.code==='42501');
 await assert.rejects(db.query("insert into public.meals(user_id,date,name,category,calories,protein) values($1,'2026-10-14','bypass','Πρωινό',200,20)",[userA]),e=>e.code==='42501');
 await approve(db,userA,draft.confirmation_id);
 await assert.rejects(execute(db,'addMeal',{...payload,calories:999},draft.confirmation_id),e=>e.code==='22023');
 const saved=await execute(db,'addMeal',payload,draft.confirmation_id);assert.equal(saved.carbs,30);assert.equal(saved.fat,10);
 assert.deepEqual(await execute(db,'addMeal',payload,draft.confirmation_id),saved);
 assert.equal((await db.query('select * from public.meals')).rows.length,1);
 await assert.rejects(prepare(db,'addMeal',{...payload,calories:999}),e=>e.code==='23505');
 await identity(db,userB);assert.equal((await db.query('select * from public.meals')).rows.length,0);
 await assert.rejects(execute(db,'addMeal',payload,draft.confirmation_id),e=>e.code==='42501');
 const foreignUpdate={...meal(),meal_id:saved.id};const foreignDraft=await prepare(db,'updateMeal',foreignUpdate);await approve(db,userB,foreignDraft.confirmation_id);await assert.rejects(execute(db,'updateMeal',foreignUpdate,foreignDraft.confirmation_id),e=>e.code==='P0002');
 await identity(db,null);await assert.rejects(db.query('select * from public.meals'),e=>e.code==='42501');await assert.rejects(prepare(db,'addMeal',meal()),e=>e.code==='42501');
 await identity(db,userA);
 const update={...meal(),meal_id:saved.id,calories:450,category:'Τροφοδοσία προπόνησης'};const ud=await prepare(db,'updateMeal',update);await approve(db,userA,ud.confirmation_id);assert.equal((await execute(db,'updateMeal',update,ud.confirmation_id)).calories,450);
 const weight={request_id:uuid(),date:'2026-10-14',weight_kg:100};const wd=await prepare(db,'addWeight',weight);await approve(db,userA,wd.confirmation_id);await execute(db,'addWeight',weight,wd.confirmation_id);await execute(db,'addWeight',weight,wd.confirmation_id);assert.equal((await db.query('select * from public.weights')).rows.length,1);
 const targets={request_id:uuid(),rest:{calories:2200,protein:180,carbs:220,fat:67},training:{calories:2700,protein:180,carbs:320,fat:78}};const td=await prepare(db,'updateNutritionTargets',targets);await approve(db,userA,td.confirmation_id);await execute(db,'updateNutritionTargets',targets,td.confirmation_id);assert.equal((await db.query('select * from public.goals')).rows[0].training_carbs,320);
 const del={request_id:uuid(),meal_id:saved.id};const dd=await prepare(db,'deleteMeal',del);await approve(db,userA,dd.confirmation_id);assert.equal((await execute(db,'deleteMeal',del,dd.confirmation_id)).deleted,true);assert.equal((await execute(db,'deleteMeal',del,dd.confirmation_id)).deleted,true);assert.equal((await db.query('select * from public.meals')).rows.length,0);
 const expiredPayload=meal();const expired=await prepare(db,'addMeal',expiredPayload);await approve(db,userA,expired.confirmation_id);await db.exec('reset role');await db.query("update public.nutrition_drafts set expires_at=now()-interval '1 minute' where id=$1",[expired.confirmation_id]);await identity(db,userA);await assert.rejects(execute(db,'addMeal',expiredPayload,expired.confirmation_id),e=>e.code==='22023');

 const rejectedPayload=meal();const rejected=await prepare(db,'addMeal',rejectedPayload);await identity(db,userA,false);await db.query('select public.review_nutrition_draft($1,false)',[rejected.confirmation_id]);await identity(db,userA);await assert.rejects(execute(db,'addMeal',rejectedPayload,rejected.confirmation_id),e=>e.code==='42501');
 await assert.rejects(prepare(db,'addMeal',{request_id:uuid(),date:'2026-10-14'}),e=>e.code==='22023');
 // Confirm browser sign-in and ownership policies still permit existing UI writes.
 await identity(db,userA,false);await db.query("insert into public.meals(user_id,date,name,category,calories,protein) values($1,'2026-10-14','legacy','Σνακ',100,5)",[userA]);
 assert.equal((await db.query('select carbs from public.meals')).rows[0].carbs,null);
 await identity(db,userB,false);assert.equal((await db.query('select * from public.weights')).rows.length,0);

 await db.exec('reset role');await db.query('insert into public.nutrition_mcp_clients values($1)',[userA]);await db.exec('set role supabase_auth_admin');
 const event={client_id:userA,claims:{aud:'authenticated',sub:userA,role:'authenticated'}};
 const hook=async e=>(await db.query('select public.nutrition_mcp_access_token_hook($1::jsonb) as value',[JSON.stringify(e)])).rows[0].value;
 assert.equal((await hook(event)).claims.aud,'https://nutrition-tracker-gamma-flax.vercel.app/mcp');
 assert.equal((await hook({...event,client_id:userB})).claims.aud,'authenticated');
 assert.equal((await hook({claims:{aud:'authenticated',sub:userA}})).claims.aud,'authenticated');
 }finally{await db.close();}
});
