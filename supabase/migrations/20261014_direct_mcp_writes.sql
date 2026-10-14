-- Apply AFTER 20261014_mcp.sql. Preserves all user records and old draft history.
begin;
create table if not exists public.nutrition_mutations(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,operation text not null,payload jsonb not null,result jsonb,
 created_at timestamptz not null default now(),unique(user_id,request_id)
);
alter table public.nutrition_mutations enable row level security;
revoke all on public.nutrition_mutations from public,anon,authenticated;
create or replace function public.write_nutrition(p_operation text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.nutrition_mutations; uid uuid:=auth.uid(); mid uuid; v_result jsonb; r jsonb; t jsonb;
begin
 if uid is null then raise exception using errcode='42501',message='Authentication required';end if;
 if p_operation is null or p_operation not in ('addMeal','updateMeal','deleteMeal','addWeight','updateNutritionTargets') or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>16000 or p_payload->>'request_id' is null then raise exception using errcode='22023',message='Invalid write';end if;
 if p_operation in ('addMeal','updateMeal') and (not(p_payload ?& array['date','name','category','calories','protein','carbs','fat']) or jsonb_typeof(p_payload->'carbs')<>'number' or jsonb_typeof(p_payload->'fat')<>'number') then raise exception using errcode='22023',message='All meal fields required';end if;
 insert into public.nutrition_mutations(user_id,request_id,operation,payload) values(uid,(p_payload->>'request_id')::uuid,p_operation,p_payload) on conflict(user_id,request_id) do nothing;
 select * into d from public.nutrition_mutations where user_id=uid and request_id=(p_payload->>'request_id')::uuid for update;
 if d.operation<>p_operation or d.payload<>p_payload then raise exception using errcode='23505',message='request_id reused with changed content';end if;
 if d.result is not null then return d.result;end if;
 if p_operation='addMeal' then
  -- The same unique request column is also used by the legacy REST API.
  insert into public.meals(user_id,date,name,category,calories,protein,carbs,fat,chatgpt_request_id)
  values(uid,(p_payload->>'date')::date,p_payload->>'name',p_payload->>'category',(p_payload->>'calories')::float8,(p_payload->>'protein')::float8,(p_payload->>'carbs')::float8,(p_payload->>'fat')::float8,d.request_id)
  on conflict(user_id,chatgpt_request_id) do nothing returning id into mid;
  if mid is null then raise exception using errcode='23505',message='request_id already used';end if;
  select to_jsonb(m)-'user_id' into v_result from public.meals m where id=mid and user_id=uid;
 elsif p_operation='updateMeal' then
  update public.meals set date=(p_payload->>'date')::date,name=p_payload->>'name',category=p_payload->>'category',calories=(p_payload->>'calories')::float8,protein=(p_payload->>'protein')::float8,carbs=(p_payload->>'carbs')::float8,fat=(p_payload->>'fat')::float8
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
 else raise exception using errcode='22023',message='Unknown operation';end if;
 update public.nutrition_mutations set result=v_result where id=d.id;
 return v_result;
end $$;
revoke all on function public.write_nutrition(text,jsonb) from public,anon;
grant execute on function public.write_nutrition(text,jsonb) to authenticated;
-- Retain historical drafts but retire the old approval protocol.
revoke execute on function public.prepare_nutrition_write(text,jsonb),public.review_nutrition_draft(uuid,boolean),public.execute_nutrition_write(text,jsonb,uuid) from authenticated;
commit;
