import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';
import {database,identity,prepare,execute,userA,meal} from '../tests/helpers/database.js';
const db=await database();const port=5192;const origin=`http://127.0.0.1:${port}`;
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:new URL('..',import.meta.url),env:{...process.env,VITE_SUPABASE_URL:'https://nutrition-test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'public-test-placeholder'},stdio:'ignore'});
let browser;let legacyMode=false;
try{
 for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,100));if(i===99)throw Error('Vite failed to start');}
 const executable=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
 browser=await chromium.launch({executablePath:executable,args:['--no-sandbox']});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://nutrition-test.supabase.co/**',async route=>{const req=route.request(),url=new URL(req.url());let body={},status=200;try{
 if(url.pathname.includes('/auth/v1/token'))body={access_token:'browser-test-token',token_type:'bearer',expires_in:3600,refresh_token:'test-refresh',user:{id:userA,email:'long-account-email-for-mobile-testing@example.com',role:'authenticated',aud:'authenticated'}};
 else if(url.pathname.endsWith('/user/oauth/grants'))body=[];
 else if(url.pathname.includes('/auth/v1/oauth/authorizations/')){body={authorization_id:'test',scope:'openid email',client:{id:'client-id',name:'Nutrition Tracker test'},redirect_uri:'https://chatgpt.com/'};}
 else if(url.pathname.includes('/rest/v1/')){
  if(legacyMode&&(url.pathname.endsWith('/weights')||(url.searchParams.get('select')||'').includes('carbs'))) {await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'42703',message:'missing new schema'})});return;}
  await identity(db,userA,false);
  if(url.pathname.endsWith('/rpc/review_nutrition_draft')){const args=JSON.parse(req.postData());body=(await db.query('select public.review_nutrition_draft($1,$2) as data',[args.p_id,args.p_approve])).rows[0].data;}
  else{const table=url.pathname.split('/').at(-1);if(!['meals','goals','weights','nutrition_drafts','chatgpt_keys'].includes(table))throw Error('Unexpected table');const active=table==='nutrition_drafts'?" and status in ('pending','approved') and expires_at>now()":'';body=(await db.query(`select * from public.${table} where user_id=$1${active}`,[userA])).rows.map(row=>({...row,...(row.date?{date:row.date instanceof Date?row.date.toISOString().slice(0,10):String(row.date).slice(0,10)}:{})}));if(table==='goals')body=body[0]||null;}
 }
 }catch(error){status=400;body={code:error.code||'test_error',message:'Database test failure'};}
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });
 await page.setViewportSize({width:320,height:844});await page.goto(origin);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.locator('[name=email]').fill('test@example.com');await page.locator('[name=password]').fill('test-password');await page.getByRole('button',{name:'Σύνδεση',exact:true}).click();await page.getByRole('heading',{name:'Χειροκίνητη καταχώριση'}).waitFor();await page.getByLabel('Ημερομηνία καταγραφής').fill('2026-10-14');
 async function confirm(operation,payload){await identity(db,userA);const draft=await prepare(db,operation,payload);await page.getByRole('button',{name:'Ανανέωση αιτημάτων'}).click();await page.getByRole('button',{name:'Επιβεβαίωση αλλαγής'}).click();await page.getByRole('button',{name:'Επιβεβαίωση αλλαγής'}).waitFor({state:'detached'});await page.getByText('Εγκρίθηκε. Επέστρεψε στο ChatGPT', {exact:false}).waitFor();await identity(db,userA);return execute(db,operation,payload,draft.confirmation_id);}
 const payload={...meal(),category:'Τροφοδοσία προπόνησης'};const saved=await confirm('addMeal',payload);await page.getByRole('button',{name:'Ανανέωση',exact:true}).click();await page.getByRole('heading',{name:'Γιαούρτι',exact:true}).waitFor();assert.equal(await page.locator('.stat strong').nth(2).innerText(),'30');assert.match(await page.locator('.fueling').innerText(),/300 kcal/);
 for(const width of [320,375,390,768,1280]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);}
 const update={...meal(),meal_id:saved.id,name:'Updated via MCP',calories:450};await confirm('updateMeal',update);await page.getByRole('button',{name:'Ανανέωση',exact:true}).click();await page.getByRole('heading',{name:'Updated via MCP',exact:true}).waitFor();
 await confirm('addWeight',{request_id:meal().request_id,date:'2026-10-14',weight_kg:99.5});await page.getByRole('button',{name:'Ανανέωση',exact:true}).click();await page.getByText('99,5 kg',{exact:true}).waitFor();
 const target={request_id:meal().request_id,rest:{calories:2200,protein:180,carbs:220,fat:67},training:{calories:2700,protein:180,carbs:320,fat:78}};await confirm('updateNutritionTargets',target);await page.getByRole('button',{name:'Ανανέωση',exact:true}).click();await page.getByLabel('Στόχοι ημέρας').selectOption('training');assert.match(await page.locator('.stat').first().innerText(),/2\.700/);
 await confirm('deleteMeal',{request_id:meal().request_id,meal_id:saved.id});await page.getByRole('button',{name:'Ανανέωση',exact:true}).click();await page.getByRole('heading',{name:'Μια νέα αρχή στο πιάτο σου'}).waitFor();
 await page.goto(origin+'/oauth/consent?authorization_id=test');await page.getByRole('heading',{name:'Nutrition Tracker test'}).waitFor();assert.equal(await page.getByRole('button',{name:'Έγκριση πρόσβασης'}).count(),1);
 legacyMode=true;await page.goto(origin);await page.getByText('Η αναβάθμιση MCP εκκρεμεί', {exact:false}).waitFor();assert.equal(await page.locator('input[name=calories]').count(),1);assert.equal(await page.locator('input[name=carbs]').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: actual PostgreSQL writes approved from browser, macro/fueling totals, updates/deletion, weights/targets, mobile 320–1280, OAuth consent rendering, legacy-schema fallback. HTTP auth/REST bridge is simulated; live Supabase OAuth is not verified.');
}finally{await browser?.close();vite.kill('SIGTERM');await db.close();}
