export const fiscalMonths=[10,11,12,1,2,3,4,5,6,7,8,9];
export const monthNames=['ต.ค.','พ.ย.','ธ.ค.','ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.'];
export function number(value){if(value===null||value===undefined||String(value).trim()==='')return null;const n=Number(String(value).replace(/,/g,''));return Number.isFinite(n)?n:null;}
export function sum(values){const valid=values.map(number).filter(v=>v!==null);return valid.length?valid.reduce((a,b)=>a+b,0):null;}
export function fiscalYear(year,month){return Number(year)+(Number(year)<2400?543:0)+(Number(month)>=10?1:0);}
export function normalizeCode(code){return /^\d{1,5}$/.test(String(code))?String(code).padStart(5,'0'):null;}
export function eligible(kpi,facility){if(!facility.active)return false;if(kpi.scope==='AREA')return facility.area_unit;if(kpi.scope==='SERVICE')return facility.service_unit;if(kpi.scope==='QUALITY')return kpi.eligible_units?.includes(facility.facility_code)??false;return kpi.scope==='ORGANIZATION';}
export function percent(a,b,rate=100){a=number(a);b=number(b);return a===null||b===null||b<=0?null:a/b*rate;}
export function kpiStatus(value,kpi){
 if(value===null||!Number.isFinite(value))return {key:'missing',text:'— ไม่มีข้อมูล'};
 if(kpi.direction==='INFORMATION'||kpi.target===null||kpi.target===undefined)return {key:'info',text:'ข้อมูลประกอบ'};
 if(kpi.direction==='RANGE'){const [low,high]=kpi.target;return value>=low&&value<=high?{key:'pass',text:'✓ ผ่านเป้า'}:{key:'low',text:'! ต่ำกว่าเป้า'};}
 const pass=kpi.direction==='LOWER_BETTER'?value<=kpi.target:value>=kpi.target;
 if(pass)return {key:'pass',text:'✓ ผ่านเป้า'};
 const gap=Math.abs(value-kpi.target);const near=gap<=Math.abs(kpi.target)*.1;
 return near?{key:'near',text:'↗ ใกล้เป้า'}:{key:'low',text:'! ต่ำกว่าเป้า'};
}
export function rank(records,kpi){return records.filter(r=>r.eligible&&r.value!==null).sort((a,b)=>kpi.direction==='LOWER_BETTER'?a.value-b.value:kpi.direction==='RANGE'?Math.abs(a.value-(kpi.target[0]+kpi.target[1])/2)-Math.abs(b.value-(kpi.target[0]+kpi.target[1])/2):b.value-a.value);}
export function sourceDate(rows){return rows.map(r=>String(r.date_com??r.date_update??'')).filter(Boolean).sort().at(-1)??null;}
export function formatSourceDate(value){if(!value)return '— ไม่ระบุวันที่ต้นทาง';const m=String(value).match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?/);if(m)return `${m[3]}/${m[2]}/${+m[1]+543}${m[4]?` ${m[4]}:${m[5]??'00'}`:''}`;const d=new Date(value);return Number.isNaN(d.getTime())?String(value):d.toLocaleString('th-TH',{timeZone:'Asia/Bangkok'});}
export function monthsForPeriod(period){if(period==='all')return fiscalMonths;if(period.startsWith('q'))return fiscalMonths.slice((+period.slice(1)-1)*3,+period.slice(1)*3);return [+period];}
export function series(rows,kpi){return fiscalMonths.map(month=>{const suffix=String(month).padStart(2,'0');const a=sum(rows.map(r=>r[`${kpi.numerator_field}${suffix}`]));const b=kpi.denominator_field?sum(rows.map(r=>r[`${kpi.denominator_field}${suffix}`])):null;return {month,numerator:a,denominator:b,value:kpi.unit==='%'?percent(a,b,kpi.rate??100):a};});}
export function calculate(rows,kpi,period='all'){
 const selected=rows.filter(r=>!kpi.report_id||String(r.id)===kpi.report_id);
 let numerator,denominator;
 if(period==='all'){
  numerator=sum(selected.map(r=>r[kpi.numerator_field]));denominator=kpi.denominator_field?sum(selected.map(r=>r[kpi.denominator_field])):null;
  if(kpi.summary_numerator_fields)numerator=sum(kpi.summary_numerator_fields.flatMap(field=>selected.map(r=>r[field])));
  if(kpi.summary_denominator_fields)denominator=sum(kpi.summary_denominator_fields.flatMap(field=>selected.map(r=>r[field])));
 }
 else if(period.startsWith('q')&&kpi.quarter_numerator_prefix){const q=period.slice(1);numerator=sum(selected.map(r=>r[kpi.quarter_numerator_prefix+q]));denominator=sum(selected.map(r=>r[kpi.quarter_denominator_prefix+q]));}
 else {const points=series(selected,kpi).filter(p=>monthsForPeriod(period).includes(p.month));numerator=points.every(p=>p.numerator!==null)?sum(points.map(p=>p.numerator)):null;denominator=points.every(p=>p.denominator!==null)?sum(points.map(p=>p.denominator)):null;}
 const quarters=kpi.quarter_numerator_prefix?[1,2,3,4].map(q=>{const a=sum(selected.map(r=>r[kpi.quarter_numerator_prefix+q]));const b=sum(selected.map(r=>r[kpi.quarter_denominator_prefix+q]));return {quarter:q,numerator:a,denominator:b,value:kpi.unit==='%'?percent(a,b,kpi.rate??100):a};}):[];
 return {numerator,denominator,value:kpi.unit==='%'?percent(numerator,denominator,kpi.rate??100):numerator,source_date:sourceDate(selected),series:series(selected,kpi),quarters,row_count:selected.length,missing_denominator:kpi.unit==='%'&&(denominator===null||denominator===0)};
}
export function facilityResults(rows,kpi,facilities,period='all') {return facilities.map(f=>({facility:f,eligible:eligible(kpi,f),...(eligible(kpi,f)?calculate(rows.filter(r=>normalizeCode(r.hospcode)===f.facility_code),kpi,period):{value:null,numerator:null,denominator:null,source_date:null,series:[]}),status:eligible(kpi,f)?null:'N/A – ไม่อยู่ในกลุ่มประเมิน'}));}
export function organization(records,kpi){const evaluated=records.filter(r=>r.eligible);const complete=evaluated.filter(r=>r.value!==null);const numerator=sum(complete.map(r=>r.numerator));const denominator=sum(complete.map(r=>r.denominator));return {value:kpi.unit==='%'?percent(numerator,denominator,kpi.rate??100):sum(complete.map(r=>r.value)),numerator,denominator,complete:complete.length,expected:evaluated.length,partial:complete.length!==evaluated.length};}
export function periodMatches(row,year,period){return +row.fiscal_year===+year&&(!row.period||monthsForPeriod(period).includes(+row.period.slice(5,7)));}
export function ncdSummary(rows){const keys=new Map();for(const r of rows){const key=`${r.facility_code}|${r.disease}`;const item=keys.get(key)??{facility_code:r.facility_code,disease:r.disease,old:null,new:null};const n=number(r.case_count);if(n!==null){if(r.case_type==='รายเก่า')item.old=item.old===null?n:Math.max(item.old,n);if(r.case_type==='รายใหม่')item.new=(item.new??0)+n;}keys.set(key,item);}return [...keys.values()].map(r=>({...r,total:sum([r.old,r.new])}));}
export function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
