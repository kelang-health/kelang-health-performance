import {runtime} from '../../config/runtime.js';
import {request} from '../request.js';
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
export function currentSession(){return session;}
export function onSession(fn){sessionListeners.push(fn);}
let refreshJob=null;
export async function refreshSession(){
 if(!session)return null;
 if(session.expires_at>Date.now()/1000+60)return session;
 const original=session;
 if(refreshJob?.original===original)return refreshJob.promise;
 const job={original,promise:null};
 job.promise=(async()=>{try{
  const s=await request(`${runtime.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,{method:'POST',headers:{apikey:runtime.supabaseKey,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:original.refresh_token})});
  if(session===original)save({...s,expires_at:Date.now()/1000+s.expires_in});
  return session;
 }catch(error){
  if(session!==original)return session;
  if([400,401,403].includes(error.status)){save(null);return null;}
  if(original.expires_at>Date.now()/1000)return original;
  throw error;
 }finally{if(refreshJob===job)refreshJob=null;}})();
 refreshJob=job;return job.promise;
}
export async function login(email,password){const s=await request(`${runtime.supabaseUrl}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:runtime.supabaseKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});save({...s,expires_at:Date.now()/1000+s.expires_in});return s;}
export async function logout(){const original=session;save(null);if(original)await request(`${runtime.supabaseUrl}/auth/v1/logout`,{method:'POST',headers:{apikey:runtime.supabaseKey,Authorization:`Bearer ${original.access_token}`}});}
export async function rest(table,query='',method='GET',body){if(!/^hp_[a-z_]+$/.test(table))throw new Error('ไม่อนุญาตให้เข้าถึงตารางนี้');const params=new URLSearchParams(query);if(reportColumns[table]&&(!params.has('select')||params.get('select')==='*'))params.set('select',reportColumns[table]);query=params.toString();await refreshSession();if(method!=='GET'&&!session)throw new Error('กรุณาเข้าสู่ระบบก่อนบันทึกข้อมูล');return request(`${runtime.supabaseUrl}/rest/v1/${table}${query?'?'+query:''}`,{method,headers:{apikey:runtime.supabaseKey,...(session?{Authorization:`Bearer ${session.access_token}`}:{ }),'Content-Type':'application/json',Prefer:'return=representation'},...(body!==undefined?{body:JSON.stringify(body)}:{})},method==='GET'?1:0);}
export async function readAll(table){let rows=[];for(let offset=0;offset<100000;offset+=1000){const page=await rest(table,`select=*&limit=1000&offset=${offset}`);rows.push(...page);if(page.length<1000)return rows;}throw new Error('ข้อมูลเกินขีดจำกัด กรุณาใช้ตัวกรอง');}
export async function loadProfile(){const names=['hp_facilities','hp_unit_public_info','hp_personnel','hp_facility_profiles','hp_population','hp_staff','hp_volunteers','hp_budget_monthly','hp_finance_monthly','hp_ncd_monthly','hp_cd_monthly','hp_service_stats','hp_settings','hp_data_quality'];const results=await Promise.allSettled(names.map(readAll));return {tables:Object.fromEntries(results.map((r,i)=>[names[i],r.status==='fulfilled'?r.value:[]])),errors:results.flatMap((r,i)=>r.status==='rejected'?[{table:names[i],error:r.reason.message}]:[]),fetched_at:new Date().toISOString()};}
