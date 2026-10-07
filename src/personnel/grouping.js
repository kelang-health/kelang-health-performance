const professionOrder=[/^พยาบาล/,/^นักวิชาการ/,/^ผู้ช่วยเจ้าพนักงานธุรการ/,/^เจ้าหน้าที่สำรวจข้อมูล/,/^พนักงานบริการทั่วไป/];
const rank=title=>{const i=professionOrder.findIndex(pattern=>pattern.test(title));return i<0?professionOrder.length:i;};
export function personnelGroups(rows){
 const civil=p=>/^ข้าราชการ(?:\s|$)/.test(String(p.employment_type??'').trim());
 const name=p=>String(p.full_name??'').trim().replace(/^(นางสาว|นาง|นาย)\s*/, '');
 const order=(a,b)=>Number(civil(b))-Number(civil(a))||name(a).localeCompare(name(b),'th')||String(a.full_name??'').localeCompare(String(b.full_name??''),'th')||String(a.id??'').localeCompare(String(b.id??''));
 const heads=rows.filter(p=>p.structure_role==='unit_head').sort(order),groups=new Map();
 for(const p of rows.filter(p=>p.structure_role!=='unit_head')){const title=String(p.position_name??'').trim()||'ยังไม่ระบุตำแหน่ง';if(!groups.has(title))groups.set(title,[]);groups.get(title).push(p);}

 return {heads,positions:[...groups].sort(([a],[b])=>rank(a)-rank(b)||a.localeCompare(b,'th')).map(([title,members])=>({title,members:members.sort(order)}))};
}
