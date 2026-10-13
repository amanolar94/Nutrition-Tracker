-- Run once in the Supabase SQL editor. Identity is enforced by Postgres RLS.
create table public.meals (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 date date not null,
 name text not null check (length(trim(name)) between 1 and 120),
 category text not null check (category in ('Πρωινό','Μεσημεριανό','Βραδινό','Σνακ')),
 calories double precision not null check (calories > 0 and calories < 'Infinity'::float8),
 protein double precision not null check (protein >= 0 and protein < 'Infinity'::float8),
 created_at timestamptz not null default now()
);
create index meals_user_date on public.meals(user_id,date);
create table public.goals (
 user_id uuid primary key references auth.users(id) on delete cascade,
 calories double precision not null check (calories > 0 and calories < 'Infinity'::float8),
 protein double precision not null check (protein > 0 and protein < 'Infinity'::float8)
);
alter table public.meals enable row level security;
alter table public.goals enable row level security;
create policy meals_owner on public.meals for all to authenticated
 using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy goals_owner on public.goals for all to authenticated
 using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.meals, public.goals from anon;
grant select, insert, update, delete on public.meals, public.goals to authenticated;
