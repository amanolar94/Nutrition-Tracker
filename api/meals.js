import { createClient } from '@supabase/supabase-js';
const categories = new Set(['Πρωινό','Μεσημεριανό','Βραδινό','Σνακ']);
export function validActionMeal(m) {
 if (!m || typeof m !== 'object' || Array.isArray(m)) return false;
 if (typeof m.request_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(m.request_id)) return false;
 if (typeof m.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(m.date)) return false;
 const date=new Date(m.date+'T00:00:00Z');
 if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==m.date) return false;
 return typeof m.name==='string' && m.name.trim().length>0 && m.name.trim().length<=120 && categories.has(m.category) && Number.isFinite(m.calories) && m.calories>0 && Number.isFinite(m.protein) && m.protein>=0;
}
// Injectable dependency supports tests without credentials or a live database.
export function makeHandler(getClient = () => {
 const url=process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
 const key=process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
 return url && key ? createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}):null;
}) {
 return async function handler(req,res) {
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'method_not_allowed'});}
 const auth=req.headers.authorization;
 if(typeof auth!=='string'||!/^Bearer nt_[0-9a-f]{64}$/.test(auth))return res.status(401).json({error:'invalid_action_key'});
 let meal=req.body;
 if(typeof meal==='string'){if(Buffer.byteLength(meal)>16384)return res.status(413).json({error:'payload_too_large'});try{meal=JSON.parse(meal);}catch{return res.status(400).json({error:'invalid_json'});}}
 if(!validActionMeal(meal))return res.status(400).json({error:'invalid_meal'});
 try {
 const client=getClient();if(!client)return res.status(503).json({error:'service_not_configured'});
 const {data,error}=await client.rpc('add_chatgpt_meal',{p_token:auth.slice(7),p_request_id:meal.request_id,p_date:meal.date,p_name:meal.name.trim(),p_category:meal.category,p_calories:meal.calories,p_protein:meal.protein});
 if(error){if(error.code==='28000')return res.status(401).json({error:'invalid_or_expired_action_key'});if(['22023','23514','22007','22008'].includes(error.code))return res.status(400).json({error:'invalid_meal'});return res.status(503).json({error:'meal_storage_unavailable'});}
 return res.status(200).json({meal:data});
 }catch{return res.status(503).json({error:'meal_storage_unavailable'});}
 };
}
export default makeHandler();
