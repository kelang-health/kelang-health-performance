const defaultProfessionOrder=[/^พยาบาล/,/^นักวิชาการ/,/^เจ้าพนักงานสาธารณสุข/,/^ผู้ช่วยเจ้าพนักงานธุรการ/,/^เจ้าหน้าที่สำรวจข้อมูล/,/^พนักงานบริการทั่วไป/];

const kelangNakornProfessionOrder=[
 /^(?:นาย)?แพทย์(?!แผนไทย)/,
 /^ทันตแพทย์/,
 /^เภสัชกร/,
 /^พยาบาลวิชาชีพ/,
 /^แพทย์แผนไทย/,
 /^นักกายภาพบำบัด/,
 /^(?:จพง\.?\s*)?ทันตสาธารณสุข|^เจ้าพนักงานทันตสาธารณสุข/,
 /^เจ้าหน้าที่กู้ชีพ/,
 /^ผู้ช่วยเจ้าพนักงานธุรการ/,
 /^เจ้าหน้าที่สำรวจข้อมูล/
];

const rank=(title,order)=>{const i=order.findIndex(pattern=>pattern.test(title));return i<0?order.length:i;};
const isCivil=p=>/^ข้าราชการ(?:\s|$)/.test(String(p.employment_type??'').trim());
export function workGroupMembers(rows){return personnelGroups(rows).positions.flatMap(g=>g.members).sort((a,b)=>Number(isCivil(b))-Number(isCivil(a)));}

export function personnelGroups(rows){
 const civil=isCivil;
 const name=p=>String(p.full_name??'').trim().replace(/^(นางสาว|นาง|นาย)\s*/, '');
 const order=(a,b)=>Number(civil(b))-Number(civil(a))||name(a).localeCompare(name(b),'th')||String(a.full_name??'').localeCompare(String(b.full_name??''),'th')||String(a.id??'').localeCompare(String(b.id??''));
 const heads=rows.filter(p=>p.structure_role==='unit_head').sort(order),groups=new Map();
 const members=rows.filter(p=>p.structure_role!=='unit_head');
 const kelangNakorn=members.length>0&&members.every(p=>p.facility_code==='45030');
 const sriMuadKlao=members.length>0&&members.every(p=>p.facility_code==='06118');
 const professionOrder=kelangNakorn?kelangNakornProfessionOrder:sriMuadKlao?defaultProfessionOrder.map((pattern,i)=>i===2?/^(?:เจ้าพนักงาน|จพง\.?\s*)สาธารณสุข/:pattern):defaultProfessionOrder;
 for(const p of members){const title=String(p.position_name??'').trim()||'ยังไม่ระบุตำแหน่ง';if(!groups.has(title))groups.set(title,[]);groups.get(title).push(p);}
 return {heads,positions:[...groups].sort(([a],[b])=>rank(a,professionOrder)-rank(b,professionOrder)||a.localeCompare(b,'th')).map(([title,members])=>({title,members:members.sort(order)}))};
}
