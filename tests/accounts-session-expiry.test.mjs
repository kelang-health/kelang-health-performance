import test from 'node:test';import assert from 'node:assert/strict';
import {handleRequest} from '../supabase/functions/hp-accounts/core.js';
test('revoked/expired session cannot reach account administration even with a valid user response',async()=>{
 const calls=[];const fetcher=async(url,options)=>{const path=new URL(url).pathname;calls.push({path,authorization:options.headers.Authorization});return Response.json(path==='/auth/v1/user'?{id:'test-user'}:false);};
 const req=new Request('https://test.invalid/hp-accounts',{method:'POST',headers:{Authorization:'Bearer test-user-token','Content-Type':'application/json'},body:JSON.stringify({action:'list'})});
 const response=await handleRequest(req,{SUPABASE_URL:'https://test.invalid',SUPABASE_SERVICE_ROLE_KEY:'test-server-key'},fetcher);
 assert.equal(response.status,401);assert.deepEqual(calls.map(x=>x.path),['/auth/v1/user','/rest/v1/rpc/hp_check_session']);assert.equal(calls[1].authorization,'Bearer test-user-token');
});
