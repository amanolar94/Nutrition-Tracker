import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
export const userA='11111111-1111-4111-8111-111111111111';export const userB='22222222-2222-4222-8222-222222222222';
let counter=1;
const uuid=()=>`aaaaaaaa-aaaa-4aaa-8aaa-${String(counter++).padStart(12,'0')}`;
export const meal=()=>({request_id:uuid(),date:'2026-10-14',name:'Γιαούρτι',category:'Πρωινό',calories:300,protein:20,carbs:30,fat:10});
export async function database(){const db=new PGlite({extensions:{pgcrypto}});await db.exec(`
 create role anon;create role authenticated;create role supabase_auth_admin;
 create schema auth;create schema extensions;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;`);
 await db.exec(`create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;grant usage on schema auth,public,extensions to anon,authenticated;grant execute on function auth.uid(),auth.jwt() to anon,authenticated;insert into auth.users values('${userA}'),('${userB}');`);
 for(const file of ['supabase/schema.sql','supabase/migrations/20261014_chatgpt_actions.sql','supabase/migrations/20261014_mcp.sql','supabase/migrations/mcp_access_token_hook.sql'])await db.exec(await readFile(new URL('../../'+file,import.meta.url),'utf8'));
 return db;}
export async function identity(db,user,oauth=true){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(user?{sub:user,role:'authenticated',...(oauth?{client_id:'test-client'}:{})}:{})]);await db.exec('set role '+(user?'authenticated':'anon'));}
export async function prepare(db,operation,payload){return(await db.query('select public.prepare_nutrition_write($1,$2::jsonb) as result',[operation,JSON.stringify(payload)])).rows[0].result;}
export async function execute(db,operation,payload,id){return(await db.query('select public.execute_nutrition_write($1,$2::jsonb,$3::uuid) as result',[operation,JSON.stringify(payload),id])).rows[0].result;}
export async function approve(db,user,id){await identity(db,user,false);await db.query('select public.review_nutrition_draft($1,true)',[id]);await identity(db,user);}
