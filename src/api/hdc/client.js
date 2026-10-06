import {runtime} from '../../config/runtime.js';
import {request} from '../request.js';
import {normalizeCode,sourceDate} from '../../utils/core.js';
const memory=new Map();const inflight=new Map();let snapshotPromise;
function cached(key){if(memory.has(key))return memory.get(key);try{return JSON.parse(localStorage.getItem(key)??'null');}catch{return null;}}
function remember(key,value){memory.set(key,value);try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
export function clearCache(){memory.clear();try{Object.keys(localStorage).filter(k=>k.startsWith('khp-hdc-')).forEach(k=>localStorage.removeItem(k));}catch{}}
export async function fetchHdc(kpi,year,facilities,force=false){
 if(typeof window!=='undefined'&&runtime.hdcMode==='snapshot'){
  try{snapshotPromise??=request(new URL('../../../data/hdc-snapshot.json',import.meta.url),{cache:'no-store'});const snapshot=await snapshotPromise;const dataset=snapshot.datasets?.[`${kpi.table}|${year}`];if(!dataset)return {rows:[],year:+year,table:kpi.table,error:'ยังไม่มีชุดข้อมูล HDC ปีที่เลือก',source_date:null,fetched_at:null};return {...dataset,from_cache:true,delivery:'scheduled_snapshot'};}
  catch(error){return {rows:[],year:+year,table:kpi.table,error:'อ่านชุดข้อมูล HDC ล่าสุดไม่สำเร็จ: '+error.message,source_date:null,fetched_at:null};}
 }
 const key=`khp-hdc-v1-${kpi.table}-${year}`;
 if(inflight.has(key))return inflight.get(key);
 const previous=cached(key);if(!force&&previous&&Date.now()-Date.parse(previous.fetched_at)<runtime.cacheSeconds*1000)return {...previous,from_cache:true};
 const job=(async()=>{try{
   let rows=[];let expected=null;
   for(let offset=0;offset<100000;offset+=10000){
    const payload={tableName:kpi.table,year:String(year),province:runtime.province,type:'json',limit:10000,offset};
    const decoded=await request(runtime.hdcUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)},1);
    const page=Array.isArray(decoded)?decoded:decoded.data;if(!Array.isArray(page))throw new Error('HDC ส่งโครงสร้างข้อมูลที่ระบบอ่านไม่ได้');rows.push(...page);expected=Number(decoded.total??rows.length);if(page.length<10000||rows.length>=expected)break;
   }
   if(expected!==null&&rows.length<expected)throw new Error('ข้อมูล HDC ยังไม่ครบตามจำนวนต้นทาง');
   const allowed=new Set(facilities.map(f=>f.facility_code));rows=rows.filter(r=>allowed.has(normalizeCode(r.hospcode))&&(!kpi.report_id||r.id===kpi.report_id));
   if(!kpi.report_id&&new Set(rows.map(r=>r.id).filter(Boolean)).size>1)throw new Error('ตาราง HDC มีหลายรายงาน ต้องยืนยันรหัสรายงานก่อนรวมยอด');
   const duplicateRows=[];const seen=new Map();for(const r of rows){const id=`${r.id}|${r.hospcode}|${r.areacode}|${r.yymm??''}`;if(seen.has(id)){duplicateRows.push(id);throw new Error('HDC มีแถวซ้ำในหน่วยบริการ/พื้นที่ ต้องตรวจสอบก่อนรวมยอด');}seen.set(id,r);}
   const result={rows,year:+year,table:kpi.table,fetched_at:new Date().toISOString(),source_date:sourceDate(rows),stale:false,error:null,duplicate_rows:duplicateRows};remember(key,result);return result;
 }catch(e){
   if(previous)return {...previous,stale:true,error:e.message,from_cache:true};
   if(typeof window!=='undefined')try{snapshotPromise??=request(new URL('../../../data/hdc-snapshot.json',import.meta.url));const snapshot=await snapshotPromise;const available=snapshot.datasets?.[`${kpi.table}|${year}`];if(available)return {...available,stale:true,error:e.message,from_cache:true};}catch{}
   return {rows:[],year:+year,table:kpi.table,fetched_at:null,source_date:null,stale:false,error:e.message};
 }})();
 inflight.set(key,job);try{return await job;}finally{inflight.delete(key);}
}
export async function fetchGroup(kpis,year,facilities,force=false){
 if(typeof window!=='undefined'&&runtime.hdcMode==='snapshot'&&force)snapshotPromise=undefined;
 const results=[];const batchSize=typeof window==='undefined'?2:4;
 for(let i=0;i<kpis.length;i+=batchSize){
  const group=await Promise.allSettled(kpis.slice(i,i+batchSize).map(k=>fetchHdc(k,year,facilities,force)));group.forEach((r,j)=>results.push([kpis[i+j].kpi_id,r.status==='fulfilled'?r.value:{rows:[],error:r.reason.message}]));
  if(typeof window==='undefined'&&kpis.length>4&&i+batchSize<kpis.length)await new Promise(resolve=>setTimeout(resolve,1000));
 }
 return Object.fromEntries(results);
}
