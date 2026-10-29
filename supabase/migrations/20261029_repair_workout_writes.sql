-- Repair a stale write_nutrition RPC that only permits the original five writes.
-- Apply LAST, after 20261020_diary_usability.sql and all prior migrations.
-- Preserves records, accounts, mutation receipts and retired-key restrictions.
-- Does not insert the reported workout or change any stored nutritional data.
begin;
do $$
declare v_relation text;
begin
 foreach v_relation in array array['nutrition_mutations','workouts','energy_settings','diary_days','meal_templates'] loop
  if to_regclass('public.'||v_relation) is null then
   raise exception using errcode='55000',message='Apply the existing workout and diary migrations before this repair';
  end if;
 end loop;
 if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='meals' and column_name='meal_time') then
  raise exception using errcode='55000',message='Apply 20261020_diary_usability.sql before this repair';
 end if;
end $$;
create or replace function public.write_nutrition(p_operation text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.nutrition_mutations; uid uuid:=auth.uid(); mid uuid; v_result jsonb; r jsonb; t jsonb; issues jsonb; v_calories numeric;
begin
 if uid is null then raise exception using errcode='42501',message='Authentication required';end if;
 if p_operation is null or p_operation not in ('addMeal','updateMeal','deleteMeal','addWeight','updateNutritionTargets','addWorkout','updateWorkout','deleteWorkout','updateEnergySettings','setDayType','saveMealTemplate','deleteMealTemplate') or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>16000 or p_payload->>'request_id' is null then raise exception using errcode='22023',message='Invalid write';end if;
 if p_operation in ('addMeal','updateMeal') and (not(p_payload ?& array['date','name','category','calories','protein','carbs','fat']) or jsonb_typeof(p_payload->'carbs')<>'number' or jsonb_typeof(p_payload->'fat')<>'number') then raise exception using errcode='22023',message='All meal fields required';end if;
 -- Keep runtime checks aligned with the published workout schema. Collect every
 -- field failure before returning; no mutation journal or workout row is written.
 if p_operation in ('addWorkout','updateWorkout') then
  issues:='[]'::jsonb;
  if jsonb_typeof(p_payload->'date') is distinct from 'string' then
   issues:=issues||jsonb_build_array(jsonb_build_object('path','date','code','invalid_type','expected','string','received',coalesce(jsonb_typeof(p_payload->'date'),'undefined')));
  elsif (p_payload->>'date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
   issues:=issues||jsonb_build_array(jsonb_build_object('path','date','code','invalid_format','expected','YYYY-MM-DD','received','string'));
  else
   begin
    perform (p_payload->>'date')::date;
   exception when sqlstate '22007' or sqlstate '22008' then
    issues:=issues||jsonb_build_array(jsonb_build_object('path','date','code','invalid_date','expected','YYYY-MM-DD','received','string'));
   end;
  end if;
  if jsonb_typeof(p_payload->'name') is distinct from 'string' then
   issues:=issues||jsonb_build_array(jsonb_build_object('path','name','code','invalid_type','expected','string','received',coalesce(jsonb_typeof(p_payload->'name'),'undefined')));
  elsif length(trim(p_payload->>'name'))<1 then
   issues:=issues||jsonb_build_array(jsonb_build_object('path','name','code','too_small','minimum',1,'inclusive',true,'received','string','received_length',length(trim(p_payload->>'name'))));
  elsif length(trim(p_payload->>'name'))>120 then
   issues:=issues||jsonb_build_array(jsonb_build_object('path','name','code','too_big','maximum',120,'inclusive',true,'received','string','received_length',length(trim(p_payload->>'name'))));
  end if;
  if jsonb_typeof(p_payload->'calories_burned') is distinct from 'number' then
   issues:=issues||jsonb_build_array(jsonb_build_object('path','calories_burned','code','invalid_type','expected','number','received',coalesce(jsonb_typeof(p_payload->'calories_burned'),'undefined')));
  else
   v_calories:=(p_payload->>'calories_burned')::numeric;
   if v_calories<=0 then
    issues:=issues||jsonb_build_array(jsonb_build_object('path','calories_burned','code','too_small','minimum',0,'inclusive',false,'received','number','received_value',v_calories));
   elsif v_calories>20000 then
    issues:=issues||jsonb_build_array(jsonb_build_object('path','calories_burned','code','too_big','maximum',20000,'inclusive',true,'received','number','received_value',v_calories));
   end if;
  end if;
  if jsonb_array_length(issues)>0 then
   raise exception using errcode='22023',message='Workout validation failed',
    detail=jsonb_build_object('type','nutrition_validation','issues',issues)::text;
  end if;
 end if;
 if p_operation in ('updateWorkout','deleteWorkout') and
   (jsonb_typeof(p_payload->'workout_id') is distinct from 'string' or (p_payload->>'workout_id')::uuid is null)
 then raise exception using errcode='22023',message='workout_id required';end if;
 if p_operation='updateEnergySettings' and (
   not(p_payload ? 'maintenance_calories') or
   (jsonb_typeof(p_payload->'maintenance_calories') is distinct from 'null' and
    (jsonb_typeof(p_payload->'maintenance_calories') is distinct from 'number' or
     (p_payload->>'maintenance_calories')::float8 not between 500 and 10000)))
 then raise exception using errcode='22023',message='Maintenance must be null or 500-10000 kcal';end if;
 if p_operation='setDayType' and (
  jsonb_typeof(p_payload->'date') is distinct from 'string' or
  (p_payload->>'date') !~ '^\d{4}-\d{2}-\d{2}$' or
  jsonb_typeof(p_payload->'day_type') is distinct from 'string' or
  p_payload->>'day_type' not in ('rest','training'))
 then raise exception using errcode='22023',message='Valid date and day_type required';end if;
 if p_operation in ('addMeal','updateMeal') and p_payload ? 'meal_time' and
  jsonb_typeof(p_payload->'meal_time') is distinct from 'null' and
  (jsonb_typeof(p_payload->'meal_time') is distinct from 'string' or
   (p_payload->>'meal_time') !~ '^([01]\d|2[0-3]):[0-5]\d$')
 then raise exception using errcode='22023',message='Invalid meal time';end if;
 if p_operation='saveMealTemplate' then
  if not(p_payload ?& array['name','category','calories','protein','carbs','fat']) or
   jsonb_typeof(p_payload->'name') is distinct from 'string' or
   jsonb_typeof(p_payload->'category') is distinct from 'string' or
   length(trim(p_payload->>'name')) not between 1 and 120 or
   p_payload->>'category' not in ('Πρωινό','Μεσημεριανό','Βραδινό','Σνακ','Τροφοδοσία προπόνησης') or
   jsonb_typeof(p_payload->'calories') is distinct from 'number' or
   jsonb_typeof(p_payload->'protein') is distinct from 'number' or
   jsonb_typeof(p_payload->'carbs') is distinct from 'number' or
   jsonb_typeof(p_payload->'fat') is distinct from 'number'
  then raise exception using errcode='22023',message='Invalid template';end if;
 end if;
 if p_operation='deleteMealTemplate' and jsonb_typeof(p_payload->'template_id') is distinct from 'string'
 then raise exception using errcode='22023',message='template_id required';end if;
 insert into public.nutrition_mutations(user_id,request_id,operation,payload) values(uid,(p_payload->>'request_id')::uuid,p_operation,p_payload) on conflict(user_id,request_id) do nothing;
 select * into d from public.nutrition_mutations where user_id=uid and request_id=(p_payload->>'request_id')::uuid for update;
 if d.operation<>p_operation or d.payload<>p_payload then raise exception using errcode='23505',message='request_id reused with changed content';end if;
 if d.result is not null then return d.result;end if;
 if p_operation='addMeal' then
  -- The same unique request column is also used by the legacy REST API.
  insert into public.meals(user_id,date,name,category,calories,protein,carbs,fat,meal_time,chatgpt_request_id)
  values(uid,(p_payload->>'date')::date,p_payload->>'name',p_payload->>'category',(p_payload->>'calories')::float8,(p_payload->>'protein')::float8,(p_payload->>'carbs')::float8,(p_payload->>'fat')::float8,(p_payload->>'meal_time')::time,d.request_id)
  on conflict(user_id,chatgpt_request_id) do nothing returning id into mid;
  if mid is null then raise exception using errcode='23505',message='request_id already used';end if;
  select to_jsonb(m)-'user_id' into v_result from public.meals m where id=mid and user_id=uid;
 elsif p_operation='updateMeal' then
  update public.meals set date=(p_payload->>'date')::date,name=p_payload->>'name',category=p_payload->>'category',calories=(p_payload->>'calories')::float8,protein=(p_payload->>'protein')::float8,carbs=(p_payload->>'carbs')::float8,fat=(p_payload->>'fat')::float8,meal_time=case when p_payload ? 'meal_time' then (p_payload->>'meal_time')::time else meal_time end
  where id=(p_payload->>'meal_id')::uuid and user_id=uid returning id into mid;
  if mid is null then raise exception using errcode='P0002',message='Meal not found';end if;
  select to_jsonb(m)-'user_id' into v_result from public.meals m where id=mid and user_id=uid;
 elsif p_operation='deleteMeal' then
  delete from public.meals where id=(p_payload->>'meal_id')::uuid and user_id=uid returning id into mid;
  if mid is null then raise exception using errcode='P0002',message='Meal not found';end if;
  v_result:=jsonb_build_object('deleted',true,'meal_id',mid);
 elsif p_operation='addWeight' then
  insert into public.weights(user_id,date,weight_kg) values(uid,(p_payload->>'date')::date,(p_payload->>'weight_kg')::float8)
  on conflict(user_id,date) do update set weight_kg=excluded.weight_kg returning id into mid;
  select to_jsonb(w)-'user_id' into v_result from public.weights w where id=mid and user_id=uid;
 elsif p_operation='updateNutritionTargets' then
  r:=p_payload->'rest';t:=p_payload->'training';
  insert into public.goals(user_id,calories,protein,carbs,fat,training_calories,training_protein,training_carbs,training_fat)
  values(uid,(r->>'calories')::float8,(r->>'protein')::float8,(r->>'carbs')::float8,(r->>'fat')::float8,(t->>'calories')::float8,(t->>'protein')::float8,(t->>'carbs')::float8,(t->>'fat')::float8)
  on conflict(user_id) do update set calories=excluded.calories,protein=excluded.protein,carbs=excluded.carbs,fat=excluded.fat,training_calories=excluded.training_calories,training_protein=excluded.training_protein,training_carbs=excluded.training_carbs,training_fat=excluded.training_fat;
  v_result:=jsonb_build_object('rest',r,'training',t);
 elsif p_operation='addWorkout' then
  insert into public.workouts(user_id,date,name,calories_burned)
  values(uid,(p_payload->>'date')::date,trim(p_payload->>'name'),(p_payload->>'calories_burned')::float8) returning id into mid;
  select to_jsonb(w)-'user_id' into v_result from public.workouts w where id=mid and user_id=uid;
 elsif p_operation='updateWorkout' then
  update public.workouts set date=(p_payload->>'date')::date,name=trim(p_payload->>'name'),calories_burned=(p_payload->>'calories_burned')::float8
  where id=(p_payload->>'workout_id')::uuid and user_id=uid returning id into mid;
  if mid is null then raise exception using errcode='P0002',message='Workout not found';end if;
  select to_jsonb(w)-'user_id' into v_result from public.workouts w where id=mid and user_id=uid;
 elsif p_operation='deleteWorkout' then
  delete from public.workouts where id=(p_payload->>'workout_id')::uuid and user_id=uid returning id into mid;
  if mid is null then raise exception using errcode='P0002',message='Workout not found';end if;
  v_result:=jsonb_build_object('deleted',true,'workout_id',mid);
 elsif p_operation='updateEnergySettings' then
  insert into public.energy_settings(user_id,maintenance_calories)
  values(uid,(p_payload->>'maintenance_calories')::float8)
  on conflict(user_id) do update set maintenance_calories=excluded.maintenance_calories;
  v_result:=jsonb_build_object('maintenance_calories',(p_payload->>'maintenance_calories')::float8);
 elsif p_operation='setDayType' then
  insert into public.diary_days(user_id,date,day_type)
  values(uid,(p_payload->>'date')::date,p_payload->>'day_type')
  on conflict(user_id,date) do update set day_type=excluded.day_type;
  v_result:=jsonb_build_object('date',p_payload->>'date','day_type',p_payload->>'day_type');
 elsif p_operation='saveMealTemplate' then
  if p_payload ? 'template_id' then
   update public.meal_templates set name=trim(p_payload->>'name'),category=p_payload->>'category',
    calories=(p_payload->>'calories')::float8,protein=(p_payload->>'protein')::float8,
    carbs=(p_payload->>'carbs')::float8,fat=(p_payload->>'fat')::float8
   where id=(p_payload->>'template_id')::uuid and user_id=uid returning id into mid;
   if mid is null then raise exception using errcode='P0002',message='Template not found';end if;
  else
   insert into public.meal_templates(user_id,name,category,calories,protein,carbs,fat)
   values(uid,trim(p_payload->>'name'),p_payload->>'category',(p_payload->>'calories')::float8,
    (p_payload->>'protein')::float8,(p_payload->>'carbs')::float8,(p_payload->>'fat')::float8) returning id into mid;
  end if;
  select to_jsonb(m)-'user_id' into v_result from public.meal_templates m where id=mid and user_id=uid;
 elsif p_operation='deleteMealTemplate' then
  delete from public.meal_templates where id=(p_payload->>'template_id')::uuid and user_id=uid returning id into mid;
  if mid is null then raise exception using errcode='P0002',message='Template not found';end if;
  v_result:=jsonb_build_object('deleted',true,'template_id',mid);
 else raise exception using errcode='22023',message='Unknown operation';end if;
 update public.nutrition_mutations set result=v_result where id=d.id;
 return v_result;
end $$;
revoke all on function public.write_nutrition(text,jsonb) from public,anon;
grant execute on function public.write_nutrition(text,jsonb) to authenticated;
commit;
