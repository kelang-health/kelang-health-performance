import {cents} from '../staff/spending/core.js';
export const years=[2567,2568,2569];
export const categoryLabels=['ค่ายาและเวชภัณฑ์','ค่าวัสดุ','ค่าตอบแทนทางการแพทย์','ค่าบริการทางการแพทย์','ค่าครุภัณฑ์ ที่ดินและสิ่งก่อสร้าง','ค่าใช้สอย','ค่าสาธารณูปโภค','ค่าจ้างลูกจ้างชั่วคราว','ค่าตอบแทนการปฏิบัติงานนอกเวลาราชการ','ค่าใช้จ่ายในการเดินทางไปราชการ','ค่าใช้จ่ายอื่นที่เกี่ยวข้องกับการสาธารณสุข'];
export const amount=v=>cents(v)===null?null:cents(v)/100;
export const canAddDetails=year=>[2568,2569].includes(+year);
export function withDefaultCoverage(row){
 const draft=structuredClone(row);
 // Existing partial periods and locked records retain their recorded coverage.
 if(draft.status==='draft'&&years.includes(draft.fiscal_year)&&!draft.coverage_start&&!draft.coverage_end){
  draft.coverage_start=`${draft.fiscal_year-544}-10-01`;
  draft.coverage_end=`${draft.fiscal_year-543}-09-30`;
 }
 return draft;
}
export function addDetail(group,{id,label,amount:value,commitment=null}){
 if(!/^m_[a-f0-9]{24}$/.test(id)||group.details.some(d=>d.id===id))throw new Error('รหัสรายการใหม่ไม่ถูกต้อง');
 const name=String(label??'').trim();if(!name||name.length>500)throw new Error('ระบุชื่อรายการ 1–500 ตัวอักษร');
 if(group.details.length>=250)throw new Error('รายการย่อยเกิน 250 รายการต่อหมวด');
 const paid=amount(value);if(paid===null)throw new Error('ระบุจ่ายจริงของรายการใหม่ หากไม่มีให้กรอก 0');
 const before=knownTotal(group.details),previous=amount(group.amount);
 group.details.push({id,label:name,amount:paid,commitment:amount(commitment),planned:null});
 // Preserve an independently documented category total when details are incomplete.
 const t=knownTotal(group.details);if(t.complete&&(previous===null||previous===0&&group.details.length===1||before.complete&&before.value===previous))group.amount=t.value;
 return group.details.at(-1);
}
export function knownTotal(groups,field='amount'){const values=groups.map(g=>{try{return amount(g[field]);}catch{return null;}});return {value:values.some(v=>v!==null)?values.reduce((s,v)=>s+Math.round((v??0)*100),0)/100:null,complete:values.length>0&&values.every(v=>v!==null),count:values.filter(v=>v!==null).length};}
export function coverageError(year,start,end){
 if(!start&&!end)return '';
 const valid=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 if(!valid(start)||!valid(end)||start>end||start<`${year-544}-10-01`||end>`${year-543}-09-30`)return 'ระบุวันที่เริ่ม–สิ้นสุดภายในปีงบประมาณเดียวกันให้ครบ';return '';
}
export function coverageKind(row){
 if(!row?.coverage_start||!row?.coverage_end||coverageError(row.fiscal_year,row.coverage_start,row.coverage_end))return 'unknown';
 return row.coverage_start===`${row.fiscal_year-544}-10-01`&&row.coverage_end===`${row.fiscal_year-543}-09-30`?'full':'partial';
}
export function coverageLabel(row){
 const kind=coverageKind(row);
 if(kind==='unknown')return 'ยังไม่ยืนยันช่วงเวลา';
 if(kind==='partial')return 'ข้อมูลบางช่วงของปี';
 if(!knownTotal(row.payload.groups).complete)return 'ช่วงเวลาทั้งปี · ข้อมูลยังไม่ครบ';
 return row.status==='confirmed'?'ยืนยันข้อมูลครบปี':'ครอบคลุมทั้งปี · รอตรวจยืนยัน';
}
export function comparison(a,b,id='all'){
 const groups=r=>(r?.payload.groups??[]).filter(g=>id==='all'||g.id===id);
 const x=knownTotal(groups(a)),y=knownTotal(groups(b));
 const out={a:x.value,b:y.value,difference:null,percent:null,label:'ยังเปรียบเทียบไม่ได้'};
 if(!a||!b||a.fiscal_year===b.fiscal_year||a.status!=='confirmed'||b.status!=='confirmed'||!x.complete||!y.complete||!a.coverage_start||!b.coverage_start||!a.coverage_end||!b.coverage_end)return out;
 if(a.coverage_start.slice(5)!==b.coverage_start.slice(5)||a.coverage_end.slice(5)!==b.coverage_end.slice(5))return {...out,label:'ช่วงเวลาไม่ตรงกัน'};
 out.difference=(Math.round(y.value*100)-Math.round(x.value*100))/100;
 out.percent=x.value===0?null:out.difference/x.value*100;
 out.label=x.value===0?(y.value>0?'เริ่มมีรายจ่าย':'ไม่มีรายจ่ายทั้งสองปี'):out.difference>0?'เพิ่มขึ้น':out.difference<0?'ลดลง':'เท่าเดิม';return out;
}
// Describe every confirmation blocker so a long, folded form can point to each field.
export function confirmationIssues(row){
 const issues=[],add=(target,message)=>issues.push({target,message});
 const dates=coverageError(row.fiscal_year,row.coverage_start??'',row.coverage_end??'');
 if(dates||!row.coverage_start||!row.coverage_end)add('dates',dates||'ระบุช่วงเวลาของจ่ายจริงก่อนยืนยัน');
 for(const g of row.payload.groups){
  let paid;try{paid=amount(g.amount);}catch{add('amount:'+g.id,'หมวด '+g.id+' '+g.label+': กรอกยอดจ่ายจริงเป็นจำนวนไม่ติดลบ ทศนิยมไม่เกิน 2 ตำแหน่ง');continue;}
  if(paid===null)add('amount:'+g.id,'หมวด '+g.id+' '+g.label+': กรอกจ่ายจริงให้ครบทุกหมวด หากไม่มีให้กรอก 0 หลังตรวจสอบแล้ว');
  const t=knownTotal(g.details??[]);
  if(paid!==null&&g.details?.length&&(!t.complete||t.value!==paid)&&!(g.note?.trim().length>=5))add('note:'+g.id,'หมวด '+g.id+' '+g.label+': ระบุเหตุผลอย่างน้อย 5 ตัวอักษร เนื่องจากรายละเอียดไม่ครบหรือยอดต่างจากยอดหมวด');
 }
 if(row.source?.issues?.length&&!(row.review_note?.trim().length>=10))add('review','บันทึกผลตรวจข้อสังเกตจากต้นฉบับอย่างน้อย 10 ตัวอักษรก่อนยืนยัน');
 return issues;
}
export function validateSnapshot(row,confirm=false){
 const p=structuredClone(row.payload);
 if(p.groups?.length!==11||new Set(p.groups.map(g=>g.id)).size!==11||p.groups.some(g=>!/^([1-9]|10|11)$/.test(g.id)))throw new Error('ข้อมูลหมวดไม่ครบ 11 หมวด');
 const issue=coverageError(row.fiscal_year,row.coverage_start??'',row.coverage_end??'');if(issue)throw new Error(issue);
 if(confirm&&(!row.coverage_start||!row.coverage_end))throw new Error('ระบุช่วงเวลาของจ่ายจริงก่อนยืนยัน');
 for(const g of p.groups){
  if(!Array.isArray(g.details)||g.details.length>250||new Set(g.details.map(d=>d.id)).size!==g.details.length)throw new Error('รายการย่อยซ้ำหรือเกินจำนวนที่กำหนด');
  for(const d of g.details){if(!/^[a-zA-Z0-9_-]{1,30}$/.test(d.id)||!String(d.label??'').trim()||String(d.label).length>500)throw new Error('ชื่อหรือรหัสรายการย่อยไม่ถูกต้อง');}
  for(const k of ['amount','commitment','planned'])g[k]=amount(g[k]);
  for(const d of g.details??[])for(const k of ['amount','commitment','planned'])d[k]=amount(d[k]);
  if(confirm&&g.amount===null)throw new Error('กรอกจ่ายจริงให้ครบทุกหมวด หากไม่มีให้กรอก 0');
  const t=knownTotal(g.details??[]);
  if(confirm&&g.details?.length&&(!t.complete||t.value!==g.amount)&&!(g.note?.trim().length>=5))throw new Error('หมวด '+g.id+' ระบุเหตุผลที่ยอดหมวดต่างจากรายละเอียดหรือรายละเอียดไม่ครบ');
 }
 if(confirm&&row.source?.issues?.length&&!(row.review_note?.trim().length>=10))throw new Error('บันทึกผลตรวจข้อสังเกตจากต้นฉบับก่อนยืนยัน');
 return p;
}
