import {sum,escapeHtml as e} from '../utils/core.js';
const colors=['#c51260','#eb7900','#288036','#187bd9','#85209e','#009cac'];
const fmt=(v,rate)=>v===null?'—':v.toLocaleString('th-TH',{minimumFractionDigits:rate?2:0,maximumFractionDigits:rate?2:0});
export function diseaseSummary(items,rate,selected){
 const active=items.some(d=>d.disease===selected)?selected:'';
 const button=(name,value,label,i)=>'<button type="button" class="disease-summary-card" data-disease="'+e(name)+'" aria-pressed="'+(active===name)+'" style="--disease-color:'+colors[i%colors.length]+'"><span>'+e(label)+'</span><strong>'+fmt(value,rate)+'</strong><small>'+(rate?'ต่อแสนประชากร':'รายตามข้อมูลโรค')+'</small></button>';
 return '<div class="disease-summary" aria-label="สรุปข้อมูลโรคตามตัวกรอง">'+button('',active?items.find(d=>d.disease===active).total:sum(items.map(d=>d.total)),active?'รวมโรคที่เลือก':'รวมรายการทุกโรค',0)+items.map((d,i)=>button(d.disease,d.total,d.disease,i)).join('')+'</div><p class="subtle">'+(active?'กำลังแสดงโรค: '+e(active)+' • กดกล่องรวมเพื่อแสดงทุกโรค':'กดกล่องโรคเพื่อกรองกราฟและตาราง')+' • กล่องทั้งหมดใช้หน่วย ปี ช่วงเวลา และโหมดเดียวกับกราฟ • รวมข้ามโรคอาจนับคนเดียวหลายครั้ง</p>';
}
export function filterDisease(model,selected){
 const index=model.diseases.findIndex(d=>d.disease===selected);
 if(index<0)return model;
 return {...model,diseases:[model.diseases[index]],unitRows:model.unitRows.map(r=>({...r,values:[r.values[index]]}))};
}
