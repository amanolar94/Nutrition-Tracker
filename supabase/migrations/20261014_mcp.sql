-- Additive migration, after schema.sql and 20261014_chatgpt_actions.sql.
-- Preserves existing records. Legacy meals have unknown (NULL) carbs/fat.
begin;
alter table public.meals add column if not exists carbs double precision check(carbs>=0 and carbs<'Infinity'::float8);
alter table public.meals add column if not exists fat double precision check(fat>=0 and fat<'Infinity'::float8);
alter table public.meals drop constraint if exists meals_category_check;
alter table public.meals add constraint meals_category_check check(category in ('Πρωινό','Μεσημεριανό','Βραδινό','Σνακ','Τροφοδοσία προπόνησης'));
alter table public.goals add column if not exists carbs double precision not null default 220 check(carbs>=0 and carbs<'Infinity'::float8);
alter table public.goals add column if not exists fat double precision not null default 67 check(fat>=0 and fat<'Infinity'::float8);
alter table public.goals add column if not exists training_calories double precision not null default 2700 check(training_calories>0 and training_calories<'Infinity'::float8);
alter table public.goals add column if not exists training_protein double precision not null default 180 check(training_protein>=0 and training_protein<'Infinity'::float8);
alter table public.goals add column if not exists training_carbs double precision not null default 320 check(training_carbs>=0 and training_carbs<'Infinity'::float8);
alter table public.goals add column if not exists training_fat double precision not null default 78 check(training_fat>=0 and training_fat<'Infinity'::float8);
create table if not exists public.weights(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 date date not null,weight_kg double precision not null check(weight_kg between 20 and 500),
 unique(user_id,date)
);
alter table public.weights enable row level security;
create table if not exists public.nutrition_drafts(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,operation text not null check(operation in ('addMeal','updateMeal','deleteMeal','addWeight','updateNutritionTargets')),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 status text not null default 'pending' check(status in ('pending','approved','rejected','executed')),
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '15 minutes',
 result jsonb,unique(user_id,request_id)
);
alter table public.nutrition_drafts enable row level security;
-- OAuth tokens may read their owner's records, but table writes require a direct
-- browser session. MCP writes must go through the approved-draft RPC below.
drop policy if exists meals_owner on public.meals;
drop policy if exists goals_owner on public.goals;
drop policy if exists chatgpt_keys_owner on public.chatgpt_keys;
DO $$ declare t text; begin
 foreach t in array array['meals','goals','weights'] loop
  execute format('drop policy if exists own_read on public.%I',t);
  execute format('create policy own_read on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
  execute format('drop policy if exists browser_write on public.%I',t);
  execute format('create policy browser_write on public.%I for all to authenticated using ((select auth.uid())=user_id and (select auth.jwt()->>''client_id'') is null) with check ((select auth.uid())=user_id and (select auth.jwt()->>''client_id'') is null)',t);
 end loop;
end $$;
drop policy if exists browser_keys on public.chatgpt_keys;
create policy browser_keys on public.chatgpt_keys for all to authenticated
 using ((select auth.uid())=user_id and (select auth.jwt()->>'client_id') is null)
 with check ((select auth.uid())=user_id and (select auth.jwt()->>'client_id') is null and expires_at>now() and expires_at<=now()+interval '90 days');
drop policy if exists own_drafts on public.nutrition_drafts;
create policy own_drafts on public.nutrition_drafts for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.weights,public.nutrition_drafts from anon,authenticated;
grant select,insert,update,delete on public.weights to authenticated;
grant select on public.nutrition_drafts to authenticated;

create or replace function public.prepare_nutrition_write(p_operation text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.nutrition_drafts; uid uuid:=auth.uid(); rid uuid;
begin
 if uid is null then raise exception using errcode='42501',message='Authentication required'; end if;
 if p_operation is null or p_operation not in ('addMeal','updateMeal','deleteMeal','addWeight','updateNutritionTargets') or p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>16000 then raise exception using errcode='22023',message='Invalid draft';end if;

 if p_operation in ('addMeal','updateMeal') and (not(p_payload ?& array['date','name','category','calories','protein','carbs','fat']) or jsonb_typeof(p_payload->'calories')<>'number' or jsonb_typeof(p_payload->'protein')<>'number' or jsonb_typeof(p_payload->'carbs')<>'number' or jsonb_typeof(p_payload->'fat')<>'number' or jsonb_typeof(p_payload->'date')<>'string' or jsonb_typeof(p_payload->'name')<>'string' or jsonb_typeof(p_payload->'category')<>'string') then raise exception using errcode='22023',message='All meal fields are required';end if;
 rid:=(p_payload->>'request_id')::uuid;
 if rid is null then raise exception using errcode='22023',message='request_id required';end if;
 insert into public.nutrition_drafts(user_id,request_id,operation,payload) values(uid,rid,p_operation,p_payload) on conflict(user_id,request_id) do nothing;
 select * into d from public.nutrition_drafts where user_id=uid and request_id=rid for update;
 if d.operation<>p_operation or d.payload<>p_payload then raise exception using errcode='23505',message='request_id reused with changed content';end if;
 return jsonb_build_object('confirmation_id',d.id,'status',d.status,'expires_at',d.expires_at,'approval_required',true,'instruction','Approve this exact draft in the existing website dashboard before calling the write tool.');
end $$;

create or replace function public.review_nutrition_draft(p_id uuid,p_approve boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.nutrition_drafts;
begin
 if auth.uid() is null or auth.jwt()->>'client_id' is not null then raise exception using errcode='42501',message='Direct user session required for approval';end if;
 select * into d from public.nutrition_drafts where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception using errcode='P0002',message='Draft not found';end if;
 if d.status<>'pending' or d.expires_at<=now() or p_approve is null then raise exception using errcode='22023',message='Draft cannot be reviewed';end if;
 update public.nutrition_drafts set status=case when p_approve then 'approved' else 'rejected' end where id=d.id;
 return jsonb_build_object('id',d.id,'status',case when p_approve then 'approved' else 'rejected' end);
end $$;

create or replace function public.execute_nutrition_write(p_operation text,p_payload jsonb,p_confirmation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.nutrition_drafts; uid uuid:=auth.uid(); mid uuid; v_result jsonb; r jsonb; t jsonb;
begin
 if uid is null then raise exception using errcode='42501',message='Authentication required';end if;
 select * into d from public.nutrition_drafts where id=p_confirmation_id and user_id=uid for update;
 if not found then raise exception using errcode='42501',message='Confirmation not found';end if;
 if p_operation is null or p_payload is null or d.operation<>p_operation or d.payload<>p_payload then raise exception using errcode='22023',message='Confirmation content mismatch';end if;
 if d.status='executed' then return d.result;end if;
 if d.status<>'approved' then raise exception using errcode='42501',message='Explicit dashboard approval required';end if;
 if d.expires_at<=now() then raise exception using errcode='22023',message='Confirmation expired';end if;
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
 update public.nutrition_drafts set status='executed',result=v_result where id=d.id;
 return v_result;
end $$;
revoke all on function public.prepare_nutrition_write(text,jsonb),public.review_nutrition_draft(uuid,boolean),public.execute_nutrition_write(text,jsonb,uuid) from public,anon;
grant execute on function public.prepare_nutrition_write(text,jsonb),public.review_nutrition_draft(uuid,boolean),public.execute_nutrition_write(text,jsonb,uuid) to authenticated;

-- Legacy private GPT Action keeps its personal-key authentication and add-only
-- scope. Optional carbs/fat are now supported without breaking old payloads.
create or replace function public.add_chatgpt_meal_v2(
 p_token text,p_request_id uuid,p_date date,p_name text,p_category text,p_calories double precision,p_protein double precision,p_carbs double precision,p_fat double precision
) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid; result jsonb;
begin
 if p_token is null or p_token !~ '^nt_[0-9a-f]{64}$' then raise exception using errcode='28000',message='Invalid action key';end if;
 select user_id into owner_id from public.chatgpt_keys where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and expires_at>now();
 if owner_id is null then raise exception using errcode='28000',message='Invalid or expired action key';end if;
 if p_request_id is null or p_date is null or p_name is null or length(trim(p_name)) not between 1 and 120 or p_category is null or p_category not in ('Πρωινό','Μεσημεριανό','Βραδινό','Σνακ','Τροφοδοσία προπόνησης') or p_calories is null or not(p_calories>0 and p_calories<'Infinity'::float8) or p_protein is null or not(p_protein>=0 and p_protein<'Infinity'::float8) then raise exception using errcode='22023',message='Invalid meal';end if;
 insert into public.meals(user_id,date,name,category,calories,protein,carbs,fat,chatgpt_request_id)
 values(owner_id,p_date,trim(p_name),p_category,p_calories,p_protein,p_carbs,p_fat,p_request_id)
 on conflict(user_id,chatgpt_request_id) do nothing;
 select jsonb_build_object('id',id,'date',date,'name',name,'category',category,'calories',calories,'protein',protein,'carbs',carbs,'fat',fat) into result from public.meals where user_id=owner_id and chatgpt_request_id=p_request_id;
 return result;
end $$;
revoke all on function public.add_chatgpt_meal_v2(text,uuid,date,text,text,double precision,double precision,double precision,double precision) from public;
grant execute on function public.add_chatgpt_meal_v2(text,uuid,date,text,text,double precision,double precision,double precision,double precision) to anon,authenticated;

commit;
