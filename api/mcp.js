import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {makeMcpServer,describeMcp} from '../server/mcp-server.js';
import {nutritionService} from '../server/nutrition-service.js';
import {authenticate,config,protectedMetadata} from '../server/auth.js';
export function makeHandler(authenticateRequest=authenticate){return async(req,res)=>{
 const cfg=config();res.setHeader('Cache-Control','no-store');
 const origin=req.headers.origin;
 const allowedOrigins=new Set([cfg.site,'https://chatgpt.com','https://chat.openai.com']);
 if(origin && !allowedOrigins.has(origin)){res.statusCode=403;return res.end('Origin not allowed');}
 if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Origin',origin||cfg.site);res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type,MCP-Protocol-Version,Accept');res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');res.statusCode=204;return res.end();}
 if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
 if(req.method==='GET'&&req.query?.status==='1'){res.setHeader('Content-Type','application/json');try{const status=await describeMcp();const commit=process.env.VERCEL_GIT_COMMIT_SHA;res.statusCode=200;return res.end(JSON.stringify({...status,commit:typeof commit==='string'&&/^[0-9a-f]{40}$/i.test(commit)?commit:null}));}catch{res.statusCode=503;return res.end(JSON.stringify({error:'status_unavailable'}));}}
 if(req.query?.metadata==='1'){const metadata=protectedMetadata(cfg);res.statusCode=metadata?200:503;res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(metadata||{error:'not_configured'}));}
 if(!['GET','POST','DELETE'].includes(req.method)){res.statusCode=405;res.setHeader('Allow','GET,POST,DELETE,OPTIONS');return res.end();}
 if(Number(req.headers['content-length'])>32768||(req.body&&Buffer.byteLength(JSON.stringify(req.body))>32768)){res.statusCode=413;return res.end(JSON.stringify({error:'request_too_large'}));}
 const bearer=req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];let identity;
 try{if(!bearer)throw Error('Missing token');identity=await authenticateRequest(bearer,cfg);}catch{res.setHeader('WWW-Authenticate',`Bearer resource_metadata="${cfg.site}/.well-known/oauth-protected-resource/mcp"`);res.statusCode=401;res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({error:'invalid_token'}));}
 const server=makeMcpServer(nutritionService(identity.client,identity.userId));
 const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
 try{await server.connect(transport);await transport.handleRequest(req,res,req.body);}catch{if(!res.headersSent){res.statusCode=500;res.end(JSON.stringify({error:'mcp_request_failed'}));}}finally{await server.close();}
};}
export default makeHandler();
