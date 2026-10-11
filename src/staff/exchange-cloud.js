import {createStaffExchange,profileFields,documentDraft,canonical} from './exchange.js';
import {leaveTransferRpc,rest} from '../api/supabase/client.js';
import {signPhotos,signedPhotoUrl,uploadPhoto} from '../personnel/photos.js';
const pick=p=>Object.fromEntries(profileFields.map(k=>[k,p[k]||'']));
async function photo(person){if(!person.photo_bytes)return null;const signed=await signPhotos([person.id+'.webp']);const path=signed?.[0]?.signedURL||signed?.[0]?.signedUrl;if(!path)throw new Error('อ่านรูปบุคลากรไม่สำเร็จ จึงไม่ส่งออกแฟ้มที่รูปขาด');const response=await fetch(signedPhotoUrl(path));if(!response.ok)throw new Error('ดาวน์โหลดรูปไม่สำเร็จ');const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>102400)throw new Error('รูปเกิน 100 KB');return {type:'image/webp',data:btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''))};}
export function cloudExchange(options){
 const docs=c=>rest('hp_staff_documents','select=id,form_code,template_version,fiscal_year,period_month,status,form_data,revision,issue_count,updated_at&personnel_id=eq.'+c.person.id+'&fiscal_year=eq.'+c.year+'&order=form_code,period_month&limit=14');
 createStaffExchange({...options,adapter:{
  async snapshot(c){const [leave,documents,people]=await Promise.all([leaveTransferRpc('snapshot',{pid:c.person.id,fy:c.year}),docs(c),rest('hp_personnel','select=id,full_name,position_name,position_level,employment_type,facility_code,photo_bytes,photo_updated_at,updated_at&id=eq.'+c.person.id+'&limit=1')]);if(documents.length>13||!people[0])throw new Error('จำนวนเอกสารหรือบุคลากรไม่ถูกต้อง');return {leave,staff:{profile:pick(people[0]),documents,photo:await photo(people[0])},revision:people[0].updated_at};},
  async trusted(p,c){if(p.source_instance==='cloud:txjuiaiwffsxfcrxpkvd')return true;const rows=await rest('hp_leave_transfer_sources','select=instance_id&instance_id=eq.'+encodeURIComponent(p.source_instance)+'&facility_code=eq.'+c.person.facility_code+'&active=eq.true&limit=1');return !!rows.length;},
  prepare:packet=>leaveTransferRpc('plan',{packet}),
  async apply(part,p,before,c,prepared){
   if(part==='profile'){if(canonical(before.staff.profile)===canonical(p.staff_data.profile))return 'ชื่อ/ตำแหน่ง/ระดับ: เหมือนเดิม';const rows=await rest('hp_personnel','id=eq.'+c.person.id+'&updated_at=eq.'+encodeURIComponent(before.revision),'PATCH',pick(p.staff_data.profile));if(!rows.length)throw new Error('บุคลากรมีผู้แก้ไขก่อนแล้ว');return 'ชื่อ/ตำแหน่ง/ระดับ: บันทึกแล้ว';}
   if(part==='photo'){if(!p.staff_data.photo)return 'รูป: ต้นทางไม่มีรูป คงรูปเดิม';const bytes=Uint8Array.from(atob(p.staff_data.photo.data),x=>x.charCodeAt(0));await uploadPhoto(c.person.id,new File([bytes],'portrait.webp',{type:'image/webp'}));return 'รูป: บันทึกแล้ว';}
   if(part==='leave'){const plan=prepared;if(!plan)throw new Error('ต้องตรวจแผนทะเบียนลาก่อน');if(plan.duplicate)return 'วันลา/ปฏิทิน: เคยรับแฟ้มนี้แล้ว';if(plan.items.some(i=>i.action==='conflict'))throw new Error('วันลามีความขัดแย้ง ให้ใช้เมนูรับส่งทะเบียนลาเพื่อเลือกเป็นรายการ');const selected=plan.items.filter(i=>['add','update'].includes(i.action)).map(i=>i.id);if(!selected.length)return 'วันลา/ปฏิทิน: เหมือนเดิม';const result=await leaveTransferRpc('apply',{packet:p,expected_token:plan.token,selected});return 'วันลา/ปฏิทิน: รับ '+result.imported+' รายการ';}
   if(part==='documents'){
    const current=before.staff.documents;let saved=0,skipped=0;for(const d of p.staff_data.documents){const old=current.find(x=>x.form_code===d.form_code&&(x.period_month||null)===(d.period_month||null));const body=documentDraft(d,part==='profile'?p.staff_data.profile:c.person,c.facility);if(old?.status==='ready'||old?.issue_count>0){skipped++;continue;}if(old&&canonical(old.form_data)===canonical(body.form_data)){skipped++;continue;}const result=await rest('hp_staff_documents',old?'id=eq.'+old.id+'&revision=eq.'+old.revision:'',old?'PATCH':'POST',{...body,...(!old?{id:d.id,owner_user_id:c.userId,personnel_id:c.person.id,facility_code:c.person.facility_code}:{}),revision:old?old.revision+1:1});if(!result.length)throw new Error('เอกสารมีผู้แก้ก่อนแล้ว; รับก่อนหน้านี้ '+saved+' ใบ');saved++;}return 'ฉ.11: รับเป็นร่าง '+saved+' ใบ · ข้ามรายการเดิม/ยืนยันแล้ว '+skipped+' ใบ';
   }
   throw new Error('ชนิดข้อมูลไม่รองรับ');
  }
 }});
}
