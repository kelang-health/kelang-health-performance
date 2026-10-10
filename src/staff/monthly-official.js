import {paginateMonthlyDocument} from './monthly-pagination.js';
import {monthlyLayoutCSS,monthlyLayoutBody} from './monthly-layout.js';
import {validateMonthlySnapshot} from './monthly-period.js';
// Prescribed wording, with the 16 pt field layout requested from the legacy system.
export const officialMonthlyCSS='@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#ddd;font-family:"TH Sarabun New",Sarabun,sans-serif}.official-monthly{position:relative;width:210mm;height:297mm;margin:12px auto;background:#fff;overflow:hidden}.official-background{position:absolute;inset:0;width:100%;height:100%}.template-field{position:absolute;height:18pt;line-height:18pt;display:flex;justify-content:center;align-items:center;font-size:16pt;white-space:nowrap}.template-value{display:inline-block;background:#fff;padding:0 1pt;line-height:1.05}.toolbar{position:fixed;top:12px;right:20px;z-index:5;font:14px Tahoma}.toolbar button{padding:9px 14px}.toolbar-note{display:block;background:#fff7db;padding:6px;margin-top:5px}@media print{body{background:white}.official-monthly{margin:0}.toolbar,.print-system-meta{display:none!important}}'+monthlyLayoutCSS;
export function officialMonthlyBody(record,f){
 let history=[];try{history=JSON.parse(f.service_history||'[]');}catch{throw new Error('ประวัติการปฏิบัติงานไม่ถูกต้อง');}
 if(!Array.isArray(history)||history.length>12)throw new Error('รองรับประวัติไม่เกิน 12 รายการ โดยแยกหน้าต่อเมื่อเกิน 6 รายการ');
 validateMonthlySnapshot(record.period_month,f);
 let printNames=[];try{printNames=JSON.parse(f.history_print_names||'[]');}catch{throw new Error('ชื่อที่ใช้พิมพ์ไม่ถูกต้อง');}if(!Array.isArray(printNames)||printNames.length>12||printNames.some(n=>typeof n!=='string'||n.length>60))throw new Error('ชื่อที่ใช้พิมพ์ไม่ถูกต้อง');
 return monthlyLayoutBody(record,f,history,printNames);
}
export async function preparePrintableDocument(doc){await doc.fonts.ready;await Promise.all([...doc.images].map(img=>img.decode()));for(const el of doc.querySelectorAll('.template-field')){const value=el.firstElementChild;for(let size=16;size>=8;size-=0.25){el.style.fontSize=size+'pt';if(value.getBoundingClientRect().width<=el.getBoundingClientRect().width)break;}if(value.getBoundingClientRect().width>el.getBoundingClientRect().width)value.style.transform='scaleX('+(el.getBoundingClientRect().width/value.getBoundingClientRect().width)+')';}paginateMonthlyDocument(doc);}
