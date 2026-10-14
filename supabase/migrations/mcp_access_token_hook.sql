-- OPTIONAL CONFIGURATION: review/merge with any existing custom access token hook.
-- Then enable this function as the Supabase Custom Access Token Hook.
-- Register the existing ChatGPT connection's OAuth client ID in this allowlist.
-- Other OAuth clients retain their original audience.
create table if not exists public.nutrition_mcp_clients(client_id uuid primary key);
alter table public.nutrition_mcp_clients enable row level security;
revoke all on public.nutrition_mcp_clients from public,anon,authenticated;
grant select on public.nutrition_mcp_clients to supabase_auth_admin;
drop policy if exists hook_read on public.nutrition_mcp_clients;
create policy hook_read on public.nutrition_mcp_clients for select to supabase_auth_admin using(true);
-- OAuth resource/audience binding; direct browser session audiences are unchanged.
create or replace function public.nutrition_mcp_access_token_hook(event jsonb)
returns jsonb language plpgsql stable set search_path='' as $$
declare claims jsonb:=event->'claims'; client text;
begin
 client:=coalesce(event->>'client_id',claims->>'client_id');
 if client is not null and client<>'' and exists(select 1 from public.nutrition_mcp_clients where client_id::text=client) then
  claims:=jsonb_set(claims,'{aud}','"https://nutrition-tracker-gamma-flax.vercel.app/mcp"'::jsonb);
 end if;
 return jsonb_build_object('claims',claims);
end $$;
revoke all on function public.nutrition_mcp_access_token_hook(jsonb) from public,anon,authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.nutrition_mcp_access_token_hook(jsonb) to supabase_auth_admin;
