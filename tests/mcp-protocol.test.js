import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {generateKeyPair,SignJWT,exportJWK,createLocalJWKSet} from 'jose';
import {makeHandler} from '../api/mcp.js';
import {verifyOAuthToken,protectedMetadata} from '../server/auth.js';
import {summarizeMeals} from '../server/nutrition-service.js';
import {rangeSchema,writes} from '../server/schemas.js';
const uid='11111111-1111-4111-8111-111111111111';
test('official MCP SDK initialization, tool discovery, validation and anonymous rejection over Streamable HTTP',async()=>{
 const calls=[];const db={async rpc(name,args){calls.push({name,args});if(name==='prepare_nutrition_write')return{data:{confirmation_id:uid,status:'pending'}};return{error:{code:'42501'}};}};
 const handler=makeHandler(async token=>{if(token!=='test-oauth-token')throw Error('invalid');return{client:db,userId:uid};});
 const httpServer=http.createServer(async(req,res)=>{if(req.method==='POST'){let raw='';for await(const chunk of req)raw+=chunk;req.body=JSON.parse(raw);}await handler(req,res);});
 await new Promise(resolve=>httpServer.listen(0,'127.0.0.1',resolve));const url=new URL(`http://127.0.0.1:${httpServer.address().port}/mcp`);
 const client=new Client({name:'nutrition-test',version:'1.0.0'});
 try{
 const unauth=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})});assert.equal(unauth.status,401);assert.match(unauth.headers.get('www-authenticate'),/oauth-protected-resource\/mcp/);
 const hostile=await fetch(url,{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'});assert.equal(hostile.status,403);
 await client.connect(new StreamableHTTPClientTransport(url,{requestInit:{headers:{Authorization:'Bearer test-oauth-token'}}}));
 const {tools}=await client.listTools();const names=tools.map(t=>t.name);for(const name of ['addMeal','getMeals','getDailySummary','getWeeklySummary','updateMeal','deleteMeal','addWeight','getWeightHistory','getNutritionTargets','updateNutritionTargets'])assert.ok(names.includes(name));
 assert.equal(names.includes('prepareWrite'),false);assert.equal(names.includes('getWriteDraft'),false);
 const add=tools.find(t=>t.name==='addMeal');assert.equal(add.annotations.readOnlyHint,false);assert.equal(add.annotations.destructiveHint,true);assert.equal(add.inputSchema.properties.confirmation_id,undefined);assert.ok(add.inputSchema.required.includes('carbs'));assert.ok(add.inputSchema.required.includes('fat'));
 const payload={request_id:uid,date:'2026-10-14',name:'meal',category:'Πρωινό',calories:200,protein:20,carbs:10,fat:5};
 const blocked=await client.callTool({name:'addMeal',arguments:payload});assert.equal(calls.at(-1).name,'write_nutrition');assert.equal(blocked.isError,true);assert.match(blocked.content[0].text,/Access denied/);
 const bad=await client.callTool({name:'addMeal',arguments:{...payload,calories:-1}});assert.equal(bad.isError,true);
 }finally{await client.close();await new Promise(resolve=>httpServer.close(resolve));}
});
test('real JWT signature, issuer, resource audience, expiration and OAuth-only identity checks',async()=>{
 const {publicKey,privateKey}=await generateKeyPair('ES256');const jwk=await exportJWK(publicKey);jwk.kid='test-key';const keys=createLocalJWKSet({keys:[jwk]});const cfg={url:'https://project.supabase.co',resource:'https://app.example/mcp'};
 const claims={sub:uid,client_id:'oauth-client',role:'authenticated',session_id:uid};
 async function sign(extra={},aud=cfg.resource,issuer=cfg.url+'/auth/v1',expiry='1h'){return new SignJWT({...claims,...extra}).setProtectedHeader({alg:'ES256',kid:'test-key'}).setIssuer(issuer).setAudience(aud).setExpirationTime(expiry).sign(privateKey);}
 assert.equal((await verifyOAuthToken(await sign(),cfg,keys)).sub,uid);
 for(const token of [await sign({},'authenticated'),await sign({},cfg.resource,'https://other.supabase.co/auth/v1'),await sign({client_id:null}),await sign({role:'service_role'})])await assert.rejects(verifyOAuthToken(token,cfg,keys));
 const expired=await new SignJWT(claims).setProtectedHeader({alg:'ES256',kid:'test-key'}).setIssuer(cfg.url+'/auth/v1').setAudience(cfg.resource).setExpirationTime(Math.floor(Date.now()/1000)-10).sign(privateKey);await assert.rejects(verifyOAuthToken(expired,cfg,keys));
 const tampered=(await sign()).split('.');tampered[1]=Buffer.from(JSON.stringify({...claims,sub:'attacker'})).toString('base64url');await assert.rejects(verifyOAuthToken(tampered.join('.'),cfg,keys));
 assert.equal(protectedMetadata({...cfg,site:'https://app.example'}).resource,cfg.resource);
});
test('ranges and summary include fueling once and flag unknown legacy macros',()=>{
 assert.equal(rangeSchema.safeParse({date:'2026-02-30'}).success,false);assert.equal(rangeSchema.safeParse({start_date:'2026-10-15',end_date:'2026-10-14'}).success,false);assert.equal(rangeSchema.safeParse({date:'2026-10-14',start_date:'2026-10-14',end_date:'2026-10-15'}).success,false);
 assert.equal(writes.addMeal.safeParse({request_id:uid,date:'2026-10-14',name:'test',category:'Πρωινό',calories:10,protein:2}).success,false);
 const s=summarizeMeals([{calories:100,protein:5,carbs:null,fat:null,category:'Σνακ'},{calories:200,protein:0,carbs:50,fat:0,category:'Τροφοδοσία προπόνησης'}],'2026-10-14');assert.equal(s.totals.calories,300);assert.equal(s.workout_fueling.calories,200);assert.equal(s.totals.carbs,50);assert.equal(s.incomplete_macro_records,1);
});
