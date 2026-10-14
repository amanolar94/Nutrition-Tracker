import {createRemoteJWKSet,jwtVerify} from 'jose';
import {createClient} from '@supabase/supabase-js';
export function config(){const supabaseUrl=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;const key=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.VITE_SUPABASE_PUBLISHABLE_KEY;const site=process.env.MCP_SITE_URL||'https://nutrition-tracker-gamma-flax.vercel.app';return{url:supabaseUrl?.replace(/\/$/,''),key,site:site.replace(/\/$/,''),resource:site.replace(/\/$/,'')+'/mcp'};}
const jwksCache=new Map();
export async function authenticate(token,cfg=config()){
 if(!cfg.url||!cfg.key)throw Error('Not configured');
 let jwks=jwksCache.get(cfg.url);if(!jwks){jwks=createRemoteJWKSet(new URL(cfg.url+'/auth/v1/.well-known/jwks.json'));jwksCache.set(cfg.url,jwks);}
 const payload=await verifyOAuthToken(token,cfg,jwks);
 const allowed=process.env.MCP_ALLOWED_CLIENT_IDS?.split(',').map(v=>v.trim()).filter(Boolean);
 if(allowed?.length&&!allowed.includes(payload.client_id))throw Error('Client not allowed');
 const client=createClient(cfg.url,cfg.key,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await client.auth.getUser(token);
 if(error||data.user?.id!==payload.sub)throw Error('Inactive OAuth session');
 return {client,userId:payload.sub};
}
export function protectedMetadata(cfg=config()){if(!cfg.url)return null;return {resource:cfg.resource,authorization_servers:[cfg.url+'/auth/v1'],bearer_methods_supported:['header'],scopes_supported:['openid','email','profile'],resource_name:'Nutrition Tracker'};}

export async function verifyOAuthToken(token,cfg,jwks){
 const {payload}=await jwtVerify(token,jwks,{issuer:cfg.url+'/auth/v1',audience:cfg.resource,algorithms:['ES256','RS256']});
 if(typeof payload.sub!=='string'||typeof payload.client_id!=='string'||!payload.client_id||payload.role!=='authenticated'||!payload.exp||typeof payload.session_id!=='string')throw Error('Invalid OAuth token');
 return payload;
}
