import {professionalLicenseChoices} from './print.js';
import {renderOfficialFields,officialPayload} from './official-fields.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

export const staffFormTemplates=Object.freeze([
  {code:'chor11_annual',title:'แบบคำขอรับเงินค่าตอบแทนประจำปี',version:'2569.1',effectiveFrom:'2025-10-01',mode:'หน้าเว็บจัดพิมพ์',sourceActive:true,available:true,storage:'ผู้ใช้เลือกเก็บหรือล้าง'},
  {code:'chor11_monthly',title:'ใบขอรับเงินค่าตอบแทนเบี้ยเลี้ยงเหมาจ่ายรายเดือน',version:'2569.1',effectiveFrom:'2025-10-01',mode:'หน้าเว็บจัดพิมพ์',sourceActive:true,available:true,storage:'เก็บรายการรายเดือน'},
  {code:'leave_sick',title:'ใบลาป่วย',version:'2569.1',effectiveFrom:'2025-10-01',mode:'หน้าเว็บจัดพิมพ์',sourceActive:true,available:false,storage:'ระยะถัดไป'},
  {code:'leave_vacation',title:'ใบลาพักผ่อน',version:'2569.1',effectiveFrom:'2025-10-01',mode:'หน้าเว็บจัดพิมพ์',sourceActive:true,available:false,storage:'ระยะถัดไป'},
  {code:'work_certificate',title:'ใบรับรองวันทำงานประกอบเบิก ฉ.11',version:'2569.1',effectiveFrom:'2025-10-01',mode:'หน้าเว็บจัดพิมพ์',sourceActive:true,available:true,storage:'พิมพ์จากรายการรายเดือน ไม่เพิ่มตาราง'}
]);

export function templateByCode(code){return staffFormTemplates.find(t=>t.code===code)??null;}

function badge(text,kind='info'){return '<span class="badge '+kind+'">'+esc(text)+'</span>';}

function thaiMonthLabel(date){
  if(!date)return '—';
  const months=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const d=new Date(date+'T00:00:00');
  return months[d.getMonth()]+' '+(d.getFullYear()+543);
}

function formatDate(date){
  if(!date)return '—';
  const d=new Date(date+'T00:00:00');
  if(Number.isNaN(d.getTime()))return esc(date);
  return d.toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'});
}

function fiscalMonthOptions(fiscalYear,selected=''){
  const startYear=fiscalYear-543-1;
  const dates=[];
  for(let i=0;i<12;i++){
    const d=new Date(startYear,9+i,1);
    const value=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01';
    dates.push('<option value="'+value+'" '+(value===selected?'selected':'')+'>'+esc(thaiMonthLabel(value))+'</option>');
  }
  return dates.join('');
}

export function renderStaffWorkspace({documents=[],person=null,facility=null,fiscalYear=2569}={}){
  if(!person){
    return '<div class="notice">บัญชีนี้ยังไม่ได้ผูกกับทะเบียนบุคลากร จึงยังไม่สามารถจัดทำเอกสารส่วนบุคคลได้ กรุณาให้ผู้ดูแลระบบผูกบัญชีกับรายชื่อบุคลากรก่อน</div>'+renderTemplateTable();
  }
  const annual=documents.find(d=>d.form_code==='chor11_annual'&&+d.fiscal_year===+fiscalYear);
  const monthly=documents.filter(d=>d.form_code==='chor11_monthly'&&+d.fiscal_year===+fiscalYear).sort((a,b)=>(b.period_month??'').localeCompare(a.period_month??''));
  const identity='<div class="notice success"><strong>'+esc(person.full_name)+'</strong> • '+esc(person.position_name||'ไม่ระบุตำแหน่ง')+' • '+esc(facility?.short_name||facility?.facility_name||person.facility_code||'')+'</div>';
  const actions='<div class="grid two-columns">'+
    '<section class="panel"><div class="panel-heading"><div><h2>แบบคำขอประจำปี</h2><p class="subtle">1 คน / 1 ปีงบประมาณ • หลังพิมพ์เลือกเก็บหรือล้างข้อมูลของตนเองได้</p></div>'+badge(annual?'มีข้อมูลแล้ว':'ยังไม่ได้จัดทำ',annual?'pass':'near')+'</div>'+
      '<div class="controls"><button class="primary" data-staff-new="chor11_annual">'+(annual?'แก้ไขคำขอปี '+fiscalYear:'จัดทำคำขอปี '+fiscalYear)+'</button>'+
      (annual?'<button data-staff-print="'+annual.id+'">พิมพ์</button><button class="danger" data-staff-purge="'+annual.id+'">ล้างข้อมูลของฉัน</button>':'')+'</div>'+
      (annual?'<p class="subtle">รุ่น '+esc(annual.template_version)+' • บันทึกล่าสุด '+esc(new Date(annual.updated_at).toLocaleString('th-TH'))+(annual.printed_at?' • เคยเปิดพิมพ์ '+esc(new Date(annual.printed_at).toLocaleString('th-TH')):'')+'</p>':'')+
    '</section>'+
    '<section class="panel"><div class="panel-heading"><div><h2>ใบขอรับเงินรายเดือน</h2><p class="subtle">เก็บรายการรายเดือนใน Supabase เพื่อเรียกใช้และพิมพ์ซ้ำได้</p></div>'+badge(monthly.length+' รายการ','info')+'</div>'+
      '<div class="controls"><button class="primary" data-staff-new="chor11_monthly">จัดทำใบขอรายเดือน</button></div>'+
      (monthly.length?'<div class="table-wrap"><table><thead><tr><th>เดือน</th><th>จำนวนเงิน</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>'+monthly.map(d=>'<tr><td>'+esc(thaiMonthLabel(d.period_month))+'</td><td>'+Number(d.form_data?.total_amount??0).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2})+' บาท</td><td>'+badge(d.status==='ready'?'พร้อมพิมพ์':'ฉบับร่าง',d.status==='ready'?'pass':'near')+'</td><td><button data-staff-edit="'+d.id+'">แก้ไข</button> <button data-staff-print="'+d.id+'">พิมพ์ใบขอ</button> <button data-staff-certificate="'+d.id+'">พิมพ์ใบรับรอง</button></td></tr>').join('')+'</tbody></table></div>':'<div class="empty">ยังไม่มีใบขอรายเดือน</div>')+
    '</section>'+
  '</div>';
  return identity+'<h2>ค่าตอบแทนและสิทธิประโยชน์</h2>'+actions+'<section class="panel"><h2>การลา</h2><p>เตรียมเปิดใช้งานในระยะถัดไป</p></section>'+renderTemplateTable();
}

export function renderTemplateTable(){
  return '<section class="panel"><div class="panel-heading"><div><h2>ทะเบียนแบบพิมพ์ที่นำมาใช้</h2><p class="subtle">อ้างอิงความสามารถจากระบบ compensation เดิม โดยไม่สร้างตารางรุ่นแบบพิมพ์ซ้ำใน Supabase</p></div></div><div class="table-wrap"><table><thead><tr><th>แบบพิมพ์</th><th>รุ่น</th><th>เริ่มใช้</th><th>วิธีสร้าง</th><th>ต้นทาง</th><th>เว็บนี้</th></tr></thead><tbody>'+
    staffFormTemplates.map(t=>'<tr><td><strong>'+esc(t.title)+'</strong><div class="subtle">'+esc(t.code)+'</div></td><td>'+esc(t.version)+'</td><td>'+esc(t.effectiveFrom)+'</td><td>'+esc(t.mode)+'</td><td>'+badge(t.sourceActive?'ใช้งาน':'เก็บประวัติ',t.sourceActive?'pass':'missing')+'</td><td>'+badge(t.available?'พร้อมใช้':'เตรียมระยะถัดไป',t.available?'pass':'info')+'</td></tr>').join('')+
  '</tbody></table></div></section>';
}

export function renderDocumentForm(code,{record=null,person,facility,fiscalYear=2569}={}){
  const t=templateByCode(code);if(!t||!t.available)throw new Error('แบบพิมพ์นี้ยังไม่เปิดใช้งานในเว็บนี้');
  const f=record?.form_data??{};fiscalYear=record?.fiscal_year??fiscalYear;
  const common='<div class="notice success"><strong>'+esc(person.full_name)+'</strong> • '+esc(person.position_name||'ไม่ระบุตำแหน่ง')+' • '+esc(facility?.short_name||facility?.facility_name||person.facility_code||'')+'</div>'+
    '<input type="hidden" name="record_id" value="'+esc(record?.id??'')+'"><input type="hidden" name="form_code" value="'+esc(code)+'"><input type="hidden" name="template_version" value="'+esc(t.version)+'"><input type="hidden" name="fiscal_year" value="'+esc(fiscalYear)+'">';
  if(code==='chor11_annual'){
    return '<form id="staff-document-form">'+common+'<div class="form-grid">'+
      '<label>ปีงบประมาณ<input value="'+esc(fiscalYear)+'" readonly></label>'+
      '<label>วันที่ยื่นคำขอ<input name="request_date" type="date" value="'+esc(f.request_date??new Date().toISOString().slice(0,10))+'" required></label>'+
      '<label>เขียนที่<input name="written_at" value="'+esc(f.written_at??facility?.short_name??facility?.facility_name??'')+'" maxlength="200"></label>'+
      '<label>อัตราค่าตอบแทนต่อเดือน (บาท)<input name="monthly_rate" type="number" min="0" step="0.01" value="'+esc(f.monthly_rate??'')+'" required></label>'+
      '<label>ระยะเวลาปฏิบัติงาน (ปี)<input name="service_years" type="number" min="0" max="60" value="'+esc(f.service_years??0)+'"></label>'+
      '<label>เดือน<input name="service_months" type="number" min="0" max="11" value="'+esc(f.service_months??0)+'"></label>'+
      '<label>วัน<input name="service_days" type="number" min="0" max="31" value="'+esc(f.service_days??0)+'"></label>'+
      '<label>เริ่มปฏิบัติงาน<input name="work_date_from" type="date" value="'+esc(f.work_date_from??'')+'"></label>'+
      '<label>ถึงวันที่<input name="work_date_to" type="date" value="'+esc(f.work_date_to??'')+'"></label>'+
      '<label>ประเภทใบอนุญาตประกอบวิชาชีพ<select name="license_type"><option value="">ยังไม่ระบุ</option>'+Object.entries(professionalLicenseChoices).map(([key,label])=>'<option value="'+key+'" '+(f.license_type===key?'selected':'')+'>'+esc(label)+'</option>').join('')+'</select></label>'+
      '<label>เลขใบอนุญาต<input name="license_number" value="'+esc(f.license_number??'')+'" maxlength="100" placeholder="เว้นว่างได้"></label>'+
      '<label style="grid-column:1/-1">ที่อยู่ติดต่อ<textarea name="contact_address" rows="3" maxlength="1000">'+esc(f.contact_address??'')+'</textarea></label>'+
      '<label style="grid-column:1/-1">หมายเหตุ<textarea name="note" rows="2" maxlength="1000">'+esc(f.note??'')+'</textarea></label>'+
    '</div>'+renderOfficialFields(code,f)+'<p class="subtle">ระบบไม่เก็บเลขบัตรประชาชน 13 หลักหรือวันเกิดในเอกสารนี้ • ชื่อ ตำแหน่ง และหน่วยงานดึงจากทะเบียนบุคลากร</p><div class="form-error" id="staff-document-error"></div><div class="form-actions"><button type="submit" class="primary">บันทึกข้อมูล</button></div></form>';
  }
  const selected=record?.period_month??f.period_month??'';
  return '<form id="staff-document-form">'+common+'<div class="form-grid">'+
    '<label>เดือนที่เบิก<select name="period_month" required><option value="">เลือกเดือน</option>'+fiscalMonthOptions(fiscalYear,selected)+'</select></label>'+
    '<label>วันที่ยื่นคำขอ<input name="request_date" type="date" value="'+esc(f.request_date??new Date().toISOString().slice(0,10))+'" required></label>'+
    '<label>เริ่มปฏิบัติงาน<input name="work_date_from" type="date" value="'+esc(f.work_date_from??'')+'"></label>'+
    '<label>ถึงวันที่<input name="work_date_to" type="date" value="'+esc(f.work_date_to??'')+'"></label>'+
    '<label>อัตราเบี้ยเลี้ยงเหมาจ่าย (บาท)<input name="monthly_rate" type="number" min="0" step="0.01" value="'+esc(f.monthly_rate??'')+'" required></label>'+
    '<label>วันปฏิบัติงาน<input name="work_days" type="number" min="0" step="0.5" value="'+esc(f.work_days??'')+'"></label>'+
    '<label>วันลา/ขาดงาน<input name="leave_days" type="number" min="0" step="0.5" value="'+esc(f.leave_days??0)+'"></label>'+
    '<label>จำนวนเงินที่ขอเบิก (บาท)<input name="total_amount" type="number" min="0" step="0.01" value="'+esc(f.total_amount??f.monthly_rate??'')+'" required></label>'+
    '<label style="grid-column:1/-1">หมายเหตุ<textarea name="note" rows="2" maxlength="1000">'+esc(f.note??'')+'</textarea></label>'+
  '</div>'+renderOfficialFields(code,f)+'<p class="subtle">รายการรายเดือนจะเก็บใน Supabase เพื่อใช้ติดตามและพิมพ์ซ้ำ • ไม่มีเลขบัตรประชาชนหรือวันเกิด</p><div class="form-error" id="staff-document-error"></div><div class="form-actions"><button type="submit" class="primary">บันทึกข้อมูล</button></div></form>';
}

export function documentPayload(form,{person,facility}={}){
  const fd=new FormData(form),code=String(fd.get('form_code')||''),fiscalYear=Number(fd.get('fiscal_year'));
  if(!['chor11_annual','chor11_monthly'].includes(code)||!templateByCode(code)?.available)throw new Error('แบบพิมพ์ไม่เปิดใช้งาน');
  if(!Number.isInteger(fiscalYear)||fiscalYear<2500||fiscalYear>2700)throw new Error('ปีงบประมาณไม่ถูกต้อง');
  const month=String(fd.get('period_month')||'');
  if(code==='chor11_monthly'&&(!/^\d{4}-\d{2}-01$/.test(month)||Number(month.slice(0,4))+543+(Number(month.slice(5,7))>=10?1:0)!==fiscalYear||Number(month.slice(5,7))<1||Number(month.slice(5,7))>12))throw new Error('เดือนที่เบิกไม่ตรงปีงบประมาณ');
  for(const key of ['monthly_rate','total_amount','work_days','leave_days','service_years','service_months','service_days']){const value=fd.get(key);if(value!==null&&(!Number.isFinite(Number(value))||Number(value)<0))throw new Error('ตัวเลขต้องเป็นจำนวนที่ไม่ติดลบ');}
  if(fd.get('work_date_from')&&fd.get('work_date_to')&&fd.get('work_date_from')>fd.get('work_date_to'))throw new Error('ช่วงปฏิบัติงานไม่ถูกต้อง');
  const details=officialPayload(fd,code);
  const base={
    full_name:person.full_name,
    position_name:person.position_name||'',
    position_level:person.position_level||'',
    employment_type:person.employment_type||'',
    facility_name:facility?.short_name||facility?.facility_name||person.facility_code||'',
    request_date:String(fd.get('request_date')||'')
  };
  if(code==='chor11_annual'){
    return {
      record_id:String(fd.get('record_id')||''),form_code:code,template_version:'2569.1',fiscal_year:fiscalYear,period_month:null,status:'ready',
      form_data:{...base,...details,work_date_from:String(fd.get('work_date_from')||''),work_date_to:String(fd.get('work_date_to')||''),written_at:String(fd.get('written_at')||''),monthly_rate:Number(fd.get('monthly_rate')||0),service_years:Number(fd.get('service_years')||0),service_months:Number(fd.get('service_months')||0),service_days:Number(fd.get('service_days')||0),license_type:String(fd.get('license_type')||''),license_number:String(fd.get('license_number')||''),contact_address:String(fd.get('contact_address')||''),note:String(fd.get('note')||''),compensation_category:'LUMP_SUM_ALLOWANCE'}
    };
  }
  return {
    record_id:String(fd.get('record_id')||''),form_code:code,template_version:'2569.1',fiscal_year:fiscalYear,period_month:String(fd.get('period_month')||''),status:'ready',
    form_data:{...base,...details,period_month:String(fd.get('period_month')||''),work_date_from:String(fd.get('work_date_from')||''),work_date_to:String(fd.get('work_date_to')||''),monthly_rate:Number(fd.get('monthly_rate')||0),work_days:Number(fd.get('work_days')||0),leave_days:Number(fd.get('leave_days')||0),total_amount:Number(fd.get('total_amount')||0),note:String(fd.get('note')||''),compensation_category:'LUMP_SUM_ALLOWANCE'}
  };
}

export {printableDocument,printableCertificate} from './print.js';
