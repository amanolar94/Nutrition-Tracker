-- Run AFTER schema.sql. Additive migration; safe to rerun.
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.chatgpt_keys (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null default 'ChatGPT' check(length(name) between 1 and 80),
 token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default (now()+interval '90 days')
);
alter table public.chatgpt_keys enable row level security;
drop policy if exists chatgpt_keys_owner on public.chatgpt_keys;
create policy chatgpt_keys_owner on public.chatgpt_keys for all to authenticated
 using ((select auth.uid())=user_id)
 with check ((select auth.uid())=user_id and expires_at>now() and expires_at<=now()+interval '90 days');
revoke all on public.chatgpt_keys from anon, authenticated;
grant select,insert,delete on public.chatgpt_keys to authenticated;
alter table public.meals add column if not exists chatgpt_request_id uuid;
create unique index if not exists meals_chatgpt_request on public.meals(user_id,chatgpt_request_id);
-- The key determines ownership. There is no caller-supplied user_id.
create or replace function public.add_chatgpt_meal(
 p_token text,p_request_id uuid,p_date date,p_name text,p_category text,p_calories double precision,p_protein double precision
) returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid; meal_id uuid; result jsonb;
begin
 if p_token is null or p_token !~ '^nt_[0-9a-f]{64}$' then
  raise exception using errcode='28000',message='Invalid action key';
 end if;
 select user_id into owner_id from public.chatgpt_keys
 where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and expires_at>now();
 if owner_id is null then raise exception using errcode='28000',message='Invalid or expired action key'; end if;
 if p_request_id is null or p_date is null or p_name is null or length(trim(p_name)) not between 1 and 120
 or p_category is null or p_category not in ('Πρωινό','Μεσημεριανό','Βραδινό','Σνακ')
 or p_calories is null or not(p_calories>0 and p_calories<'Infinity'::float8)
 or p_protein is null or not(p_protein>=0 and p_protein<'Infinity'::float8) then
  raise exception using errcode='22023',message='Invalid meal';
 end if;
 insert into public.meals(user_id,date,name,category,calories,protein,chatgpt_request_id)
 values(owner_id,p_date,trim(p_name),p_category,p_calories,p_protein,p_request_id)
 on conflict(user_id,chatgpt_request_id) do nothing;
 select jsonb_build_object('id',id,'date',date,'name',name,'category',category,'calories',calories,'protein',protein)
 into result from public.meals where user_id=owner_id and chatgpt_request_id=p_request_id;
 return result;
end;
$$;
revoke all on function public.add_chatgpt_meal(text,uuid,date,text,text,double precision,double precision) from public;
grant execute on function public.add_chatgpt_meal(text,uuid,date,text,text,double precision,double precision) to anon,authenticated;
