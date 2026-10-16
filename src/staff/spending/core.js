export const fiscalOrder=[10,11,12,1,2,3,4,5,6,7,8,9];
export const monthLabels=['ต.ค.','พ.ย.','ธ.ค.','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.'];
export const money=n=>n===null||n===undefined?'—':Number(n).toLocaleString('th-TH',{minimumFractionDigits:2,maximumFractionDigits:2});
export const inputRows=plan=>(plan?.payload?.groups??[]).flatMap(g=>g.rows.filter(r=>r.input));
export function cents(v){if(v===null||v===undefined||String(v).trim()==='')return null;if(!/^\d+(\.\d{1,2})?$/.test(String(v))||!Number.isFinite(+v)||+v>999999999.99)throw new Error('กรอกยอดตั้งแต่ 0 ถึง 999,999,999.99 และทศนิยมไม่เกิน 2 ตำแหน่ง');return Math.round(+v*100);}
export function validateAmounts(plan,amounts,complete=false){const allowed=new Set(inputRows(plan).map(r=>r.id));for(const [k,v] of Object.entries(amounts)){if(!allowed.has(k))throw new Error('รายการไม่ตรงกับแผน');cents(v);}if(complete&&[...allowed].some(k=>cents(amounts[k])===null))throw new Error('กรอกให้ครบทุกช่อง หากไม่มีรายจ่ายให้กรอก 0');return Object.fromEntries(Object.entries(amounts).filter(([,v])=>cents(v)!==null).map(([k,v])=>[k,cents(v)/100]));}
export function total(amounts,ids){return (ids??Object.keys(amounts??{})).reduce((s,k)=>s+(cents(amounts?.[k])??0),0)/100;}
export function cumulative(reports,period,ids){const end=fiscalOrder.indexOf(+period);return Math.round(reports.filter(r=>r.status==='confirmed'&&fiscalOrder.indexOf(+r.period)<=end).reduce((s,r)=>s+Math.round(total(r.payload.amounts,ids)*100),0))/100;}
export function periodLabel(year,month){const i=fiscalOrder.indexOf(+month);return monthLabels[i]+' '+(+year-(+month>=10?1:0));}
export function canManage(permissions,code){return permissions.some(p=>p.role==='ADMIN'||['STAFF','MONITOR'].includes(p.role)&&p.facility_code===code);}
export function canView(permissions,code){return permissions.some(p=>p.role==='ADMIN'||p.role==='MONITOR'||p.role==='STAFF'&&p.facility_code===code);}
