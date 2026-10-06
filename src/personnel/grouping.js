const priority=['นักบริหารงานสาธารณสุข','นักวิชาการสาธารณสุข','พยาบาลวิชาชีพ','นักจัดการงานทั่วไป','เจ้าพนักงานสาธารณสุข','ผู้ช่วยนักวิชาการสาธารณสุข','ผู้ช่วยเจ้าพนักงานธุรการ'];
export function personnelGroups(rows){
 const order=(a,b)=>(Number(a.display_order)||0)-(Number(b.display_order)||0)||String(a.full_name).localeCompare(String(b.full_name),'th');
 const heads=rows.filter(p=>p.structure_role==='unit_head').sort(order),groups=new Map();
 for(const p of rows.filter(p=>p.structure_role!=='unit_head')){const title=String(p.position_name??'').trim()||'ยังไม่ระบุตำแหน่ง';if(!groups.has(title))groups.set(title,[]);groups.get(title).push(p);}
 const rank=title=>{const i=priority.findIndex(p=>title===p||title.startsWith(p+' '));return i<0?priority.length:i;};
 return {heads,positions:[...groups].sort(([a],[b])=>rank(a)-rank(b)||a.localeCompare(b,'th')).map(([title,members])=>({title,members:members.sort(order)}))};
}
