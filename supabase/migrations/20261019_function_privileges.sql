-- Apply after the existing ChatGPT/MCP migrations. Does not modify user data.
begin;

-- /api/meals uses a stateless publishable-key client, i.e. the anon DB role.
-- These functions authenticate the *personal Action key*, not a browser JWT.
-- Keep that path working, but remove the redundant authenticated-role grants.
revoke all on function public.add_chatgpt_meal(text,uuid,date,text,text,double precision,double precision)
 from public,authenticated;
revoke all on function public.add_chatgpt_meal_v2(text,uuid,date,text,text,double precision,double precision,double precision,double precision)
 from public,authenticated;
grant execute on function public.add_chatgpt_meal(text,uuid,date,text,text,double precision,double precision),
 public.add_chatgpt_meal_v2(text,uuid,date,text,text,double precision,double precision,double precision,double precision)
 to anon;

-- MCP/browser mutations authenticate with auth.uid(), enforce ownership and use
-- a private idempotency journal. SECURITY DEFINER + authenticated EXECUTE is
-- intentional; SECURITY INVOKER would prevent access to that journal.
revoke all on function public.write_nutrition(text,jsonb) from public,anon;
grant execute on function public.write_nutrition(text,jsonb) to authenticated;

commit;
