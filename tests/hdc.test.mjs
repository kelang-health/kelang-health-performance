import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchGroup,clearCache} from '../src/api/hdc/client.js';
const facilities=[{facility_code:'06116'}];
test('A failed endpoint does not reject the complete dashboard batch',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{const payload=JSON.parse(options.body);if(payload.tableName==='s_failed')throw new Error('upstream unavailable');return new Response(JSON.stringify({data:[{hospcode:'06116',id:'ok',result:0}],total:1}),{status:201,headers:{'Content-Type':'application/json'}});};
 try{clearCache();const results=await fetchGroup([{kpi_id:'OK',table:'s_ok',report_id:'ok'},{kpi_id:'FAILED',table:'s_failed'}],2569,facilities,true);assert.equal(results.OK.rows[0].result,0);assert.match(results.FAILED.error,/unavailable/);}finally{globalThis.fetch=original;}
});
test('Endpoint failure returns stale cache with original source date, never a fake fresh date',async()=>{
 const original=globalThis.fetch;let fail=false;
 globalThis.fetch=async()=>{if(fail)throw new Error('offline');return new Response(JSON.stringify({data:[{hospcode:'06116',date_com:'202609011200',result:0}],total:1}),{status:201});};
 try{clearCache();const k=[{kpi_id:'CACHE',table:'s_cache'}];const first=(await fetchGroup(k,2569,facilities,true)).CACHE;fail=true;const second=(await fetchGroup(k,2569,facilities,true)).CACHE;assert.equal(second.stale,true);assert.equal(second.source_date,'202609011200');assert.equal(second.fetched_at,first.fetched_at);assert.equal(second.rows[0].result,0);}finally{globalThis.fetch=original;}
});
