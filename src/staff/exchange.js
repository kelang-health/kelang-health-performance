import {makePacket,encryptPacket,decryptPacket,digest,canonical,maxBytes,validatePacket} from './leave/transfer.js';
export const profileFields=['full_name','position_name','position_level','employment_type'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function checkStaff(p){
 validatePacket(p);const s=p.staff_data;
 if(s?.version!==1||!s.profile||!Array.isArray(s.documents)||s.documents.length>13)throw new Error('ชุดข้อมูลเจ้าหน้าที่ไม่ถูกต้อง');
 for(const k of profileFields)if(typeof s.profile[k]!=='string'||s.profile[k].length>(k==='full_name'||k==='position_name'?200:100))throw new Error('ชื่อ/ตำแหน่งยาวเกินกำหนด');
 if(!s.profile.full_name.trim())throw new Error('ต้องระบุชื่อ');
 const keys=new Set();for(const d of s.documents){
  const key=d.form_code+':'+(d.period_month||'');
  if(!uuid.test(d.id)||!['chor11_annual','chor11_monthly'].includes(d.form_code)||d.template_version!=='2569.1'||Number(d.fiscal_year)!==p.fiscal_year||keys.has(key)||!d.form_data||Array.isArray(d.form_data)||typeof d.form_data!=='object'||new TextEncoder().encode(JSON.stringify(d.form_data)).length>20000)throw new Error('เอกสารซ้ำ/ผิดปี/ไม่รองรับแบบหรือข้อมูลเกิน 20 KB');
  if(d.form_code==='chor11_annual'&&d.period_month!=null)throw new Error('คำขอประจำปีต้องไม่มีเดือน');
  if(d.form_code==='chor11_monthly'&&(!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(d.period_month)||!((+d.period_month.slice(0,4)+543-(+d.period_month.slice(5,7)<10?0:-1))===p.fiscal_year)))throw new Error('เดือนเอกสารอยู่นอกปีงบประมาณ');
  keys.add(key);
 }
 if(s.photo!==null){if(s.photo?.type!=='image/webp'||typeof s.photo.data!=='string'||s.photo.data.length>136536||!/^[A-Za-z0-9+/]*={0,2}$/.test(s.photo.data))throw new Error('รูปต้องเป็น WebP ไม่เกิน 100 KB');const bytes=Uint8Array.from(atob(s.photo.data),x=>x.charCodeAt(0));if(bytes.length>102400||bytes.length<16||String.fromCharCode(...bytes.slice(0,4))!=='RIFF'||String.fromCharCode(...bytes.slice(8,12))!=='WEBP')throw new Error('ไฟล์รูปไม่ใช่ WebP');}
 return p;
}
export async function staffPacket(snapshot,staff){const p=await makePacket(snapshot);p.staff_data={version:1,...staff};checkStaff(p);p.staff_sha256=await digest(p.staff_data);return p;}
export async function readStaff(text,password){const p=checkStaff(await decryptPacket(text,password));if(p.staff_sha256!==await digest(p.staff_data))throw new Error('Checksum ข้อมูลเจ้าหน้าที่ไม่ตรง');return p;}
export {encryptPacket,maxBytes,canonical};
export function documentDraft(d,person,facility){return {form_code:d.form_code,template_version:'2569.1',fiscal_year:d.fiscal_year,period_month:d.period_month||null,status:'draft',form_data:{...d.form_data,full_name:person.full_name,position_name:person.position_name||'',position_level:person.position_level||'',employment_type:person.employment_type||'',facility_name:facility?.facility_name||d.form_data.facility_name||'',...(d.form_code==='chor11_monthly'?{certificate_verified:0}:{})}};}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
// Every destination write is checked independently. A partial run lists successes and can be retried.
export function createStaffExchange({getContext,adapter,openDialog,onImported=async()=>{}}){
 let opened='',packet=null,preview=null,prepared=null,password='',busy=false;
 const scope=()=>{const c=getContext();if(!c.manager||!c.person||!c.userId)throw new Error('เฉพาะ STAFF หน่วยตนเอง/ADMIN');return c;};
 const key=c=>c.userId+'|'+c.person.id+'|'+c.year;
 const current=()=>{const c=scope();if(key(c)!==opened)throw new Error('บุคลากร/ปี/บัญชีเปลี่ยน กรุณาเปิดเมนูใหม่');return c;};
 const say=t=>{const el=document.getElementById('staff-exchange-result');if(el)el.textContent=t;};
 async function snapshot(c){const s=await adapter.snapshot(c);current();return s;}
 document.addEventListener('click',async e=>{const b=e.target.closest('[data-staff-exchange],[data-staff-exchange-apply]');if(!b||busy)return;busy=true;b.disabled=true;try{
  if(b.hasAttribute('data-staff-exchange')){const c=scope();opened=key(c);packet=preview=null;password='';openDialog('รับส่งข้อมูลเจ้าหน้าที่ · ฉ.11 / วันลา / รูป','<p>'+esc(c.person.full_name)+' · '+c.person.facility_code+' · ปี '+c.year+'</p><p>แฟ้มเข้ารหัสไม่เกิน 2 MB ต่อคนต่อปี รวมข้อมูลพิมพ์ ฉ.11 ประวัติงานในแบบ ชื่อ ตำแหน่ง ระดับ รูปจริง และทะเบียนลา ไม่ส่งบัญชีหรือรหัสผ่าน ไม่มีการซิงค์</p><form id="staff-exchange-export"><label>รหัสผ่านแฟ้ม 12–256 ตัว<input type="password" name="password" minlength="12" maxlength="256" required autocomplete="new-password"></label><label>ยืนยันรหัสผ่าน<input type="password" name="confirm" required autocomplete="new-password"></label><button>ส่งออกครบชุด</button></form><form id="staff-exchange-import"><input type="file" name="file" accept=".kelang" required><input type="password" name="password" placeholder="รหัสผ่านแฟ้ม" required autocomplete="off"><button>ตรวจแฟ้มก่อนนำเข้า</button></form><div id="staff-exchange-preview"></div><p id="staff-exchange-result" role="status"></p>');return;}
  const c=current();if(!packet||!preview||!document.getElementById('staff-exchange-reviewed')?.checked)throw new Error('ต้องตรวจและยืนยันรายการก่อน');
  const selected=Array.from(document.querySelectorAll('[name=staff-exchange-select]:checked'),x=>x.value);if(!selected.length)throw new Error('เลือกอย่างน้อยหนึ่งส่วน');
  const fresh=await snapshot(c);if(canonical(fresh)!==canonical(preview))throw new Error('ข้อมูลเปลี่ยนระหว่างตรวจ กรุณาตรวจแฟ้มใหม่');
  // Download an encrypted before-image before the first write; no personal data in localStorage.
  const backup=await staffPacket(fresh.leave,fresh.staff);download(await encryptPacket(backup,password),'before-import-'+backup.package_id+'.kelang');current();
  const messages=[];for(const part of selected){try{current();messages.push(await adapter.apply(part,packet,preview,c,prepared));say(messages.join('\n'));}catch(err){messages.push('หยุดที่ '+part+': '+err.message+' — ส่วนก่อนหน้าที่รายงานว่าสำเร็จถูกบันทึกแล้ว ตรวจแฟ้มใหม่เพื่อทำต่อ');break;}}
  password='';packet=preview=null;document.getElementById('staff-exchange-preview').replaceChildren();say(messages.join('\n'));await onImported();
 }catch(err){say(err.message);}finally{busy=false;b.disabled=false;}});
 document.addEventListener('submit',async e=>{const f=e.target;if(!['staff-exchange-export','staff-exchange-import'].includes(f.id))return;e.preventDefault();if(busy)return;busy=true;const b=e.submitter;b.disabled=true;try{
  const c=current(),fd=new FormData(f),secret=String(fd.get('password'));if(f.id==='staff-exchange-export'){if(secret!==fd.get('confirm'))throw new Error('รหัสผ่านยืนยันไม่ตรง');const s=await snapshot(c),p=await staffPacket(s.leave,s.staff);const text=await encryptPacket(p,secret);current();download(text,'staff-'+c.person.facility_code+'-'+c.year+'-'+p.package_id+'.kelang');f.reset();say('ส่งออกแล้ว: ฉ.11 '+p.staff_data.documents.length+' ใบ · รูป '+(p.staff_data.photo?'1':'0')+' · วันลา/ปฏิทิน/สิทธิ '+p.records.length+' รายการ');return;}
  packet=preview=null;password='';const file=fd.get('file');if(!file?.size||file.size>maxBytes*1.4+2000)throw new Error('แฟ้มใหญ่เกินกำหนด');const p=await readStaff(await file.text(),secret);current();if(p.person.id!==c.person.id||p.facility_code!==c.person.facility_code||p.fiscal_year!==c.year)throw new Error('UUID บุคลากร/หน่วย/ปีไม่ตรง ห้ามจับคู่จากชื่ออัตโนมัติ');if(!await adapter.trusted(p,c))throw new Error('แหล่งข้อมูลยังไม่ได้รับอนุญาต');const s=await snapshot(c);prepared=adapter.prepare?await adapter.prepare(p,c):null;current();packet=p;preview=s;password=secret;f.reset();
  document.getElementById('staff-exchange-preview').innerHTML='<p>นำเข้าเป็นร่าง ไม่ใช้ผลลงนามต้นทางแทนการตรวจ เอกสารที่ปลายทางยืนยันแล้วจะไม่ถูกเขียนทับ แต่ละส่วนบันทึกแยกกัน หากล้มเหลวจะแจ้งส่วนที่สำเร็จแล้ว</p>'+[['profile','ชื่อ / ตำแหน่ง / ระดับ',s.staff.profile,p.staff_data.profile],['documents','ฉ.11 และข้อมูลประกอบ',s.staff.documents,p.staff_data.documents],['photo','รูปจริง',s.staff.photo?{type:s.staff.photo.type,bytes:s.staff.photo.data.length}:null,p.staff_data.photo?{type:p.staff_data.photo.type,bytes:p.staff_data.photo.data.length}:null],['leave','วันหยุด / วันลา / สิทธิ',s.leave.records,p.records]].map(([id,label,before,after])=>'<details><summary><input type="checkbox" name="staff-exchange-select" value="'+id+'"> '+label+'</summary><p>ข้อมูลเดิม</p><pre style="white-space:pre-wrap">'+esc(JSON.stringify(before,null,2))+'</pre><p>ข้อมูลต้นทาง</p><pre style="white-space:pre-wrap">'+esc(JSON.stringify(after,null,2))+'</pre></details>').join('')+'<label><input type="checkbox" id="staff-exchange-reviewed"> ตรวจข้อมูลและรายการที่เลือกแล้ว เก็บแฟ้มสำรองก่อนนำเข้าไว้ในเครื่อง</label><button data-staff-exchange-apply>นำเข้าเฉพาะส่วนที่เลือก</button>';say('ตรวจแฟ้มครบแล้ว กรุณาเปิดดูความต่างและเลือกส่วนที่จะรับ');
 }catch(err){packet=preview=null;password='';say(err.message);}finally{busy=false;b.disabled=false;}});
}
