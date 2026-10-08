import {runtime} from '../../config/runtime.js';
import {request} from '../request.js';
import {sessionPolicy,sessionStatus} from './session-policy.js';
let session=null;try{session=JSON.parse(sessionStorage.getItem('khp-session')??'null');}catch{}
const sessionListeners=[];
// Public reporting columns. Source payloads stay in the database for audits.
export const reportColumns=Object.freeze({
 hp_facility_profiles:'facility_code,address,notes,source_updated_at,updated_at',
 hp_population:'id,facility_code,fiscal_year,population,male,female,households,communities,source_updated_at,updated_at',
 hp_staff:'id,facility_code,fiscal_year,profession,staff_count,support_count,updated_at',
 hp_volunteers:'id,facility_code,fiscal_year,volunteer_count,updated_at',
 hp_budget_monthly:'id,source_key,facility_code,fiscal_year,period,kind,amount,review_status,updated_at',
 hp_finance_monthly:'id,source_key,facility_code,fiscal_year,period,amount,review_status,updated_at',
 hp_ncd_monthly:'id,source_key,facility_code,fiscal_year,period,disease,case_type,case_count,updated_at',
 hp_cd_monthly:'id,source_key,facility_code,fiscal_year,period,disease,case_count,updated_at'
});
function save(value){session=value;if(typeof sessionStorage!=='undefined'){if(value)sessionStorage.setItem('khp-session',JSON.stringify(value));else sessionStorage.removeItem('khp-session');}sessionListeners.forEach(fn=>fn(value));}
let identityGeneration=0,expiryReason='',touchJob=null,lastTouch=0;
export function sessionExpiryReason(){return expiryReason;}
export function checkSessionTime(){const status=sessionStatus(session);if(session&&status.remaining<=0){const original=session;expiryReason=status.reason;identityGeneration++;save(null);request(`${runtime.supabaseUrl}/auth/v1/logout?scope=local`,{method:'POST',headers:{apikey:runtime.supabaseKey,Authorization:`Bearer ${original.access_token}`}}).catch(()=>{});}return status;}
export function currentSession(){checkSessionTime();return session;}
export function onSession(fn){sessionListeners.push(fn);}
let refreshJob=null;
export async function refreshSession(){
 checkSessionTime();
 if(!session)return null;
 if(session.expires_at>Date.now()/1000+60)return session;
 const original=session;
 const generation=identityGeneration;
 if(refreshJob?.generation===generation)return refreshJob.promise;
 const job={original,generation,promise:null};
 job.promise=(async()=>{try{
  const s=await request(`${runtime.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:runtime.supabaseKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:original.refresh_token})});
  if(identityGeneration===generation&&session){checkSessionTime();if(session)save({...s,hp_started_at:session.hp_started_at,hp_last_active_at:session.hp_last_active_at,expires_at:Date.now()/1000+s.expires_in});}
  return session;
 }catch(error){
  if(identityGeneration!==generation)return session;
  if([400,401,403].includes(error.status)){expiryReason='server';identityGeneration++;save(null);return null;}
  if(original.expires_at>Date.now()/1000)return original;
  throw error;
 }finally{if(refreshJob===job)refreshJob=null;}})();
 refreshJob=job;return job.promise;
}
export async function login(email,password){const s=await request(`${runtime.supabaseUrl}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:runtime.supabaseKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});try{const limit=await request(`${runtime.supabaseUrl}/rest/v1/rpc/hp_touch_session`,{method:'POST',headers:{apikey:runtime.supabaseKey,Authorization:`Bearer ${s.access_token}`,'Content-Type':'application/json'},body:'{}'},0);const start=Date.parse(limit.started_at);if(!Number.isFinite(start))throw new Error('ไม่สามารถยืนยันระยะเวลาเซสชัน');identityGeneration++;expiryReason='';lastTouch=Date.now();save({...s,hp_started_at:start,hp_last_active_at:Date.now(),expires_at:Date.now()/1000+s.expires_in});return s;}catch(error){await request(`${runtime.supabaseUrl}/auth/v1/logout?scope=local`,{method:'POST',headers:{apikey:runtime.supabaseKey,Authorization:`Bearer ${s.access_token}`}},0).catch(()=>{});throw error;}}
export async function logout(){const original=session;identityGeneration++;expiryReason='';save(null);if(original)await request(`${runtime.supabaseUrl}/auth/v1/logout?scope=local`,{method:'POST',headers:{apikey:runtime.supabaseKey,Authorization:`Bearer ${original.access_token}`}},0);}
export async function touchSession(force=false){checkSessionTime();if(!session)return null;if(touchJob)return touchJob;if(!force&&Date.now()-lastTouch<sessionPolicy.touchMs)return session;const generation=identityGeneration;touchJob=(async()=>{await refreshSession();if(!session||generation!==identityGeneration)return null;try{await request(`${runtime.supabaseUrl}/rest/v1/rpc/hp_touch_session`,{method:'POST',headers:{apikey:runtime.supabaseKey,Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:'{}'},0);if(generation===identityGeneration)lastTouch=Date.now();return session;}catch(error){if(generation===identityGeneration&&[400,401,403].includes(error.status)){expiryReason='server';identityGeneration++;save(null);}throw error;}})();try{return await touchJob;}finally{touchJob=null;}}
export function recordSessionActivity(){checkSessionTime();if(!session)return;session={...session,hp_last_active_at:Date.now()};if(typeof sessionStorage!=='undefined')sessionStorage.setItem('khp-session',JSON.stringify(session));touchSession().catch(()=>{});}
export async function rest(table,query='',method='GET',body){if(!/^hp_[a-z_]+$/.test(table))throw new Error('ไม่อนุญาตให้เข้าถึงตารางนี้');const params=new URLSearchParams(query);if(reportColumns[table]&&(!params.has('select')||params.get('select')==='*'))params.set('select',reportColumns[table]);query=params.toString();await refreshSession();if(method!=='GET'&&!session)throw new Error('กรุณาเข้าสู่ระบบก่อนบันทึกข้อมูล');const generation=identityGeneration,authenticated=!!session;const result=await request(`${runtime.supabaseUrl}/rest/v1/${table}${query?'?'+query:''}`,{method,headers:{apikey:runtime.supabaseKey,...(session?{Authorization:`Bearer ${session.access_token}`}:{ }),'Content-Type':'application/json',Prefer:'return=representation'},...(body!==undefined?{body:JSON.stringify(body)}:{})},method==='GET'?1:0);checkSessionTime();if(authenticated&&identityGeneration!==generation)throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');return result;}
export async function readAll(table){let rows=[];for(let offset=0;offset<100000;offset+=1000){const page=await rest(table,`select=*&limit=1000&offset=${offset}`);rows.push(...page);if(page.length<1000)return rows;}throw new Error('ข้อมูลเกินขีดจำกัด กรุณาใช้ตัวกรอง');}
export async function loadProfile(){const names=['hp_facilities','hp_unit_public_info','hp_personnel','hp_facility_profiles','hp_population','hp_staff','hp_volunteers','hp_budget_monthly','hp_finance_monthly','hp_ncd_monthly','hp_cd_monthly','hp_service_stats','hp_settings','hp_data_quality'];const results=await Promise.allSettled(names.map(readAll));return {tables:Object.fromEntries(results.map((r,i)=>[names[i],r.status==='fulfilled'?r.value:[]])),errors:results.flatMap((r,i)=>r.status==='rejected'?[{table:names[i],error:r.reason.message}]:[]),fetched_at:new Date().toISOString()};}
