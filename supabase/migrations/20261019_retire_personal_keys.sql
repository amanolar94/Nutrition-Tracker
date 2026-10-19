-- Apply LAST, after the existing ChatGPT/MCP and function-privilege migrations.
-- Personal-key Actions are retired; OAuth MCP and browser sessions remain active.
begin;

revoke all on function public.add_chatgpt_meal(text,uuid,date,text,text,double precision,double precision)
 from public,anon,authenticated;
revoke all on function public.add_chatgpt_meal_v2(text,uuid,date,text,text,double precision,double precision,double precision,double precision)
 from public,anon,authenticated;

-- Keep existing hashes/history and owner-only SELECT/DELETE for cleanup in the
-- dashboard, but prevent creation of new keys even by an older browser client.
revoke insert,update on public.chatgpt_keys from public,anon,authenticated;

-- Do not change write_nutrition, OAuth clients/hooks, RLS, or any stored records.
commit;
