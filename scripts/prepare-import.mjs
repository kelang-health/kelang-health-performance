import fs from 'node:fs';
import crypto from 'node:crypto';
const base=new URL('../',import.meta.url);
const original=fs.readFileSync(new URL('backups/hospital-profile-original.json',base),'utf8').replace(/^\uFEFF/,'');
const data=JSON.parse(original).data;
const facilities=JSON.parse(fs.readFileSync(new URL('src/config/facilities.json',base)));
const num=v=>v===null||v===undefined||String(v).trim()===''?null:Number(String(v).replace(/,/g,''));
const sql=v=>v===null||v===undefined?'null':typeof v==='number'||typeof v==='boolean'?String(v):`'${String(typeof v==='object'?JSON.stringify(v):v).replace(/'/g,"''")}'`;
const period=v=>{const m=String(v??'').match(/(\d{1,2})\/(\d{4})/);if(!m)return null;let y=+m[2];if(y>2400)y-=543;return `${y}-${m[1].padStart(2,'0')}-01`;};
const fy=d=>{if(!d)return null;const [y,m]=d.split('-').map(Number);return y+543+(m>=10?1:0);};
const statements=[];const counts={};const issues=[];
function insert(table,row,conflict='do nothing'){const keys=Object.keys(row); statements.push(`insert into public.${table} (${keys.join(',')}) values (${keys.map(k=>sql(row[k])).join(',')}) on conflict ${conflict};`);counts[table]=(counts[table]??0)+1;}
for(const f of facilities)insert('hp_facilities',f);
for(const r of data.hospital){
 const code=String(r.hcode).padStart(5,'0');
 insert('hp_facility_profiles',{facility_code:code,raw_data:r,source_updated_at:null});
 insert('hp_population',{facility_code:code,fiscal_year:2569,population:num(r['ประชากร']),male:num(r['ชาย']),female:num(r['หญิง']),households:num(r['หลังคาเรือน']),communities:num(r['หมู่บ้าน/ชุมชน']),source_updated_at:null,raw_data:r});
 insert('hp_staff',{facility_code:code,fiscal_year:2569,profession:'รวมบุคลากร',staff_count:num(r['บุคลากร']),support_count:num(r['บุคลากรสนับสนุน']),raw_data:r});
 insert('hp_volunteers',{facility_code:code,fiscal_year:2569,volunteer_count:num(r['อสม.']),raw_data:r});
}
const seenPlans=new Set();const seenMonthly=new Map();
for(const sheet of ['money','ncd','cd','settings']) for(const [i,r] of data[sheet].entries()){
 const sourceKey=`legacy-${sheet}-${r._rowIndex??i+2}`;
 const code=r.hcode?String(r.hcode).padStart(5,'0'):null;
 insert('hp_import_records',{source_key:sourceKey,sheet_name:sheet,facility_code:code,raw_data:r});
 if(sheet==='settings'){insert('hp_settings',{setting_key:sourceKey,category:r['ประเภท'],value:r});continue;}
 if(!facilities.some(f=>f.facility_code===code)){issues.push({code,sourceKey,type:'unknown_facility',detail:'ไม่พบรหัสหน่วยบริการใน master'});continue;}
 const date=period(sheet==='money'?r['รายการ']:r['เดือน']);
 if(sheet==='money'&&r['รายการ']==='แผนจ่ายเงิน'){
   const duplicate=seenPlans.has(code);seenPlans.add(code);
   insert('hp_budget_monthly',{source_key:sourceKey,facility_code:code,fiscal_year:2569,period:null,kind:'annual_plan',amount:num(r['วงเงินทั้งปี']),review_status:duplicate?'pending':'accepted',raw_data:r});
   if(duplicate)issues.push({code,sourceKey,type:'duplicate_budget',detail:'แผนจ่ายเงินซ้ำ ยอดนี้รอตรวจสอบ ไม่รวมยอดที่ยืนยันแล้ว'});
 }else if(sheet==='money'){
   if(!date){issues.push({code,sourceKey,type:'invalid_period',detail:'ไม่สามารถแปลงเดือนการเงิน'});continue;}
   const key=`${code}|${date}`;const duplicate=seenMonthly.has(key);seenMonthly.set(key,true);
   insert('hp_finance_monthly',{source_key:sourceKey,facility_code:code,fiscal_year:fy(date),period:date,amount:num(r['วงเงินทั้งปี']),review_status:duplicate?'pending':'accepted',raw_data:r});
   if(duplicate)issues.push({code,sourceKey,type:'duplicate_month',detail:'ยอดจ่ายหน่วยบริการและเดือนซ้ำ รอตรวจสอบก่อนรวมยอด'});
 }else{
   if(!date){issues.push({code,sourceKey,type:'invalid_period',detail:'ไม่มีเดือนที่แปลงได้'});continue;}
   insert(sheet==='ncd'?'hp_ncd_monthly':'hp_cd_monthly',{source_key:sourceKey,facility_code:code,fiscal_year:fy(date),period:date,disease:sheet==='ncd'?r['รายการหลัก']:r['โรคติดต่อ'],...(sheet==='ncd'?{case_type:r['รายการย่อย']}:{}),case_count:num(r['จำนวน']),raw_data:r});
 }
}
for(const issue of issues)insert('hp_data_quality',{source_key:issue.sourceKey,facility_code:issue.code,issue_type:issue.type,detail:issue.detail});
insert('hp_settings',{setting_key:'migration_provenance',category:'migration',value:{source:'Google Apps Script getAllDatabase',source_commit:'75c46a51a41577675a2db452e09757319aba99c9',backup_sha256:crypto.createHash('sha256').update(original).digest('hex'),source_counts:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.length])),imported_at:new Date().toISOString(),assumed_fiscal_year:2569,source_updated_at:null,notes:'ปีของแผนรายปีและข้อมูลพื้นฐานอนุมานจากชุดรายเดือน FY2569; วันที่อัปเดตต้นทางไม่มีให้ ไม่ใช้เวลาย้ายข้อมูลแทนวันที่ต้นทาง'}});
fs.writeFileSync(new URL('backups/import.sql',base),'begin;\n'+statements.join('\n')+'\ncommit;\n');
fs.writeFileSync(new URL('docs/import-summary.json',base),JSON.stringify({counts,issues,originalCounts:Object.fromEntries(Object.entries(data).map(([k,v])=>[k,v.length]))},null,2));
console.log(JSON.stringify({counts,issues}));
