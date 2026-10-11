const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Suggestions remain editable; never infer a signed declaration or an amount.
export function withStaffChoices(html,{facilities=[],people=[],documents=[]}={}){
 const saved=key=>documents.flatMap(d=>{const match=/^history_\d+_(facility_name|province|level_name)$/.exec(key);if(!match)return [d.form_data?.[key]].filter(Boolean);try{return JSON.parse(d.form_data?.service_history||'[]').map(r=>r[match[1]]).filter(Boolean);}catch{return [];}});
 const units=facilities.map(f=>f.facility_name||f.short_name).filter(Boolean);
 const names=people.map(p=>p.full_name).filter(Boolean);
 const groups=['พื้นที่ชุมชนเมือง','ปกติ ๑','ปกติ ๒'];
 const lists={bureau:['กองสาธารณสุขและสิ่งแวดล้อม'],province:['ลำปาง'],district:['เมืองลำปาง'],subdistrict:['ชมพู','กล้วยแพะ','ปงแสนทอง','พระบาท'],level:groups,facility:units,head_name:names,director_name:names,head_position:['หัวหน้าศูนย์บริการสาธารณสุข','หัวหน้าหน่วยบริการสาธารณสุข'],director_position:['ผู้อำนวยการกองสาธารณสุขและสิ่งแวดล้อม']};
 const used=new Map();
 html=html.replace(/<input\b[^>]*\bname="([^"]+)"[^>]*>/g,(tag,key)=>{
  let group=key==='written_at'?'facility':key==='level_name'||/^history_\d+_level_name$/.test(key)?'level':key.endsWith('_province')||/^history_\d+_province$/.test(key)?'province':key.endsWith('_district')?'district':key.endsWith('_subdistrict')?'subdistrict':/^history_\d+_facility_name$/.test(key)||/^training_.*_facility$/.test(key)?'facility':Object.hasOwn(lists,key)?key:null;
  if(!group||tag.includes('type="hidden"'))return tag;
  const id='staff-choice-'+group;
  const values=used.get(id)||new Set(lists[group]);
  for(const value of saved(key))values.add(String(value));
  used.set(id,values);
  return tag.slice(0,-1)+' list="'+id+'" autocomplete="off">';
 });
 return html+[...used].map(([id,values])=>'<datalist id="'+id+'">'+[...values].map(v=>'<option value="'+esc(v)+'"></option>').join('')+'</datalist>').join('');
}

