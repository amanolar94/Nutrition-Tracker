import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {z} from 'zod';
import {writes,rangeSchema,dateSchema} from './schemas.js';
const readAnnotations={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false};
export function makeMcpServer(service){
 const server=new McpServer({name:'nutrition-tracker',version:'3.0.0'},{instructions:'Use Europe/Athens dates. Explain nutritional estimates and ask for corrections. NEVER perform a write before explicit user confirmation such as καταχώρισέ το. After explicit confirmation, call the write tool directly. No website approval or confirmation_id is needed. Reuse request_id on retries. Never claim a write succeeded without a successful result. Include workout fueling in intake.'});
 function register(name,schema,description,annotations,run){server.registerTool(name,{inputSchema:schema,description,annotations},async args=>{try{const result=await run(args);if(Array.isArray(result)&&result.length>1000)return {isError:true,content:[{type:'text',text:'Too many records. Request a narrower date range.'}]};return{content:[{type:'text',text:JSON.stringify(result)}],structuredContent:{result}};}catch(error){const code=error?.code;const message=code==='42501'?'Access denied.':code==='22023'?'Invalid input.':code==='23505'?'request_id already used for different content.':code==='P0002'?'Record not found in your account.':'Operation failed. No successful storage is confirmed. Check database setup and retry with the same request_id.';return{isError:true,content:[{type:'text',text:message}]};}});}
 register('getMeals',rangeSchema,'Read meals for one date or an inclusive range (max 366 days, max 1000 records).',readAnnotations,args=>service.getMeals(args));
 register('getDailySummary',z.object({date:dateSchema}).strict(),'Daily totals for calories, protein, carbs and fat, with workout fueling and missing legacy macro counts.',readAnnotations,args=>service.getDailySummary(args));
 register('getWeeklySummary',z.object({date:dateSchema}).strict(),'Monday–Sunday summary of the week containing date, with daily breakdown, all macros, daily averages and workout fueling included once.',readAnnotations,args=>service.getWeeklySummary(args));
 register('getWeightHistory',rangeSchema,'Read recorded weights in kg. Provisional starting weight is not an invented record.',readAnnotations,args=>service.getWeightHistory(args));
 register('getNutritionTargets',z.object({}).strict(),'Read editable rest-day and training-day targets.',readAnnotations,()=>service.getNutritionTargets());
 for(const [name,schema] of Object.entries(writes)){register(name,schema,`Execute ${name} ONLY after the user explicitly confirms this exact change in ChatGPT. Save immediately without dashboard approval. Reuse request_id on retries. Full replacement fields are required for updateMeal.`,{readOnlyHint:false,destructiveHint:true,idempotentHint:true,openWorldHint:false},args=>service.write(name,args));}
 return server;
}
