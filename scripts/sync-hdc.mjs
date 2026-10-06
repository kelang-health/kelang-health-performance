import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fetchGroup} from '../src/api/hdc/client.js';
import {facilityResults,organization} from '../src/utils/core.js';
const base=new URL('../',import.meta.url);
const kpis=JSON.parse(fs.readFileSync(new URL('src/config/kpi-master.json',base)));
const facilities=JSON.parse(fs.readFileSync(new URL('src/config/facilities.json',base)));
const currentYear=Number(new Intl.DateTimeFormat('en-US',{year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date()));
const currentMonth=Number(new Intl.DateTimeFormat('en-US',{month:'numeric',timeZone:'Asia/Bangkok'}).format(new Date()));
const currentFy=currentYear+543+(currentMonth>=10?1:0);
let snapshot={generated_at:new Date().toISOString(),source:'HDC Open Data MOPH',datasets:{},summary:{}};
try{snapshot.datasets=JSON.parse(fs.readFileSync(new URL('data/hdc-snapshot.json',base))).datasets??{};}catch{}
// Carry forward the most recent deployed successful datasets, rather than reverting to the original repository snapshot.
try{const response=await fetch('https://kelang-health.github.io/kelang-health-performance/data/hdc-snapshot.json',{signal:AbortSignal.timeout(15000)});if(response.ok){const deployed=await response.json();for(const [key,value] of Object.entries(deployed.datasets??{})){if(Array.isArray(value.rows)&&(!snapshot.datasets[key]||Date.parse(value.fetched_at)>Date.parse(snapshot.datasets[key].fetched_at)))snapshot.datasets[key]=value;}}}catch(e){console.log('Previous deployment unavailable; using repository snapshot.');}
const years=process.env.HDC_SKIP_REFRESH==='1'?[]:process.env.HDC_YEARS?process.env.HDC_YEARS.split(',').map(Number):[currentFy-1,currentFy,currentFy-2];
let successful=0;
for(const year of years){
 const responses=await fetchGroup(kpis,year,facilities,true);
 for(const k of kpis){const key=`${k.table}|${year}`;const r=responses[k.kpi_id];if(!r.error){snapshot.datasets[key]=r;successful++;}else if(snapshot.datasets[key]){snapshot.datasets[key].stale=true;snapshot.datasets[key].error=r.error;}const displayed=snapshot.datasets[key]??r;const results=facilityResults(displayed.rows,k,facilities);snapshot.summary[key]={...organization(results,k),error:r.error,source_date:displayed.source_date};}
 console.log(`FY${year}: ${Object.values(responses).filter(r=>!r.error).length}/${kpis.length} API responses; `+JSON.stringify(Object.entries(responses).filter(([,r])=>r.error).map(([id,r])=>({id,error:r.error}))));
}
if(!successful&&!Object.values(snapshot.datasets).some(d=>d.rows?.length))throw new Error('All HDC endpoints failed and no valid previous data is available');
if(!successful&&years.length)console.log('All endpoints failed; publishing the existing real-data fallback with explicit stale status.');
if(!years.length)console.log('Application update: carry forward latest HDC data without unnecessary upstream API calls.');
for(const [key,dataset] of Object.entries(snapshot.datasets)){const k=kpis.find(k=>key.startsWith(k.table+'|'));if(k)snapshot.summary[key]={...organization(facilityResults(dataset.rows,k,facilities),k),error:dataset.error,source_date:dataset.source_date};}
// Reuse the existing PHP report-analysis code for supplementary audit output.
if(process.env.SKIP_PHP_ANALYSIS!=='1')try{
 const input=Object.entries(snapshot.datasets).map(([key,r])=>({key,rows:r.rows}));
 const output=execFileSync(process.env.PHP_BINARY??'php',['scripts/analyze-hdc.php'],{cwd:base.pathname.replace(/^\/([A-Za-z]:)/,'$1'),input:JSON.stringify(input),encoding:'utf8',maxBuffer:20*1024*1024});
 snapshot.legacy_analysis=JSON.parse(output);
}catch(e){console.log('Supplementary PHP analysis unavailable; browser calculations use verified KPI master.');}
fs.writeFileSync(new URL('data/hdc-snapshot.json',base),JSON.stringify(snapshot));
fs.writeFileSync(new URL('docs/hdc-validation.json',base),JSON.stringify({generated_at:snapshot.generated_at,summary:snapshot.summary},null,2));
console.log(`Snapshot: ${Object.keys(snapshot.datasets).length} datasets, ${fs.statSync(new URL('data/hdc-snapshot.json',base)).size} bytes`);
