import {officialFields} from './official-fields.js';
import {isMedicalDoctor} from './medical-training.js';
export const documentRenderVersion='1.74';
export function missingReadyFields(record){
 const f=record.form_data||{},missing=[],labels={...officialFields.common,...officialFields.annual,...officialFields.monthly,written_at:'เขียนที่',license_type:'ประเภทใบอนุญาต',license_number:'เลขใบอนุญาต'};
 const need=(key,label=labels[key]||key)=>{if(f[key]==null||String(f[key]).trim()==='')missing.push(label);};
 for(const [k,l]of [['full_name','ชื่อผู้ยื่น'],['position_name','ตำแหน่ง'],['facility_name','หน่วยบริการ'],['request_date','วันที่ยื่น'],['work_date_from','วันเริ่มช่วงเบิก'],['work_date_to','วันสิ้นสุดช่วงเบิก'],['monthly_rate','อัตราต่อเดือน'],['total_amount','จำนวนเงิน'],['service_as_of','วันนับอายุงาน'],['service_years','อายุงานปี'],['service_months','อายุงานเดือน'],['service_days','อายุงานวัน'],['unit_province','จังหวัดหน่วยบริการ'],['level_name','ระดับพื้นที่']])need(k,l);
 if(record.form_code==='chor11_monthly'){
  for(const [k,l]of [['applicant_first_name','คำนำหน้าและชื่อ'],['applicant_last_name','นามสกุล'],['calendar_work_days','วันทำการ'],['work_days','วันปฏิบัติงาน'],['leave_days','วันลา'],['head_name','ชื่อหัวหน้าหน่วย'],['head_position','ตำแหน่งหัวหน้าหน่วย'],['director_name','ชื่อผู้อำนวยการกอง'],['director_position','ตำแหน่งผู้อำนวยการกอง']])need(k,l);
  if(Number(f.certificate_verified)!==1)missing.push('ยืนยันวันทำงานและวันลา');
  if(isMedicalDoctor(f.position_name)&&![1,2].includes(Number(f.training_status)))missing.push('ยืนยันการฝึกเพิ่มพูนทักษะของแพทย์');
  let history=[];try{history=JSON.parse(f.service_history||'[]');}catch{}if(!Array.isArray(history)||!history.length)missing.push('ประวัติการปฏิบัติงาน');else history.forEach((h,i)=>{for(const key of ['facility_name','province','level_name','start_date','end_date','duration_years','duration_months','duration_days'])if(h[key]==null||String(h[key]).trim()==='')missing.push('ประวัติ '+(i+1)+': '+({facility_name:'หน่วยบริการ',province:'จังหวัด',level_name:'ระดับพื้นที่',start_date:'วันเริ่ม',end_date:'วันสิ้นสุด',duration_years:'จำนวนปี',duration_months:'จำนวนเดือน',duration_days:'จำนวนวัน'}[key]||key));});
 }else{
  for(const key of ['written_at','bureau','unit_moo','unit_subdistrict','unit_district','address_no','address_subdistrict','address_district','address_province','postcode','duration_years','duration_months','duration_hours','amount_in_words'])need(key);
  if(Number(f.no_professional_license)!==1)for(const key of ['license_type','license_number','license_issue_date'])need(key);
 }
 return missing;
}
export function assertReadyDocument(record){const missing=missingReadyFields(record);if(missing.length)throw new Error('ยังยืนยันพร้อมใช้ไม่ได้ กรุณาตรวจ: '+missing.join(' / '));}
export function expectedDocumentRevision(value){const n=Number(value);if(!Number.isSafeInteger(n)||n<1)throw new Error('รุ่นข้อมูลไม่ถูกต้อง กรุณาโหลดเอกสารใหม่');return n;}
export const documentListFields='id,owner_user_id,personnel_id,facility_code,form_code,template_version,fiscal_year,period_month,status,form_data,revision,render_version,confirmed_at,confirmed_by,issue_count,preview_opened_at,printed_at,created_at,updated_at';
