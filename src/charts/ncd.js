import {number,sum,percent,ncdSummary,periodMatches,escapeHtml as e} from '../utils/core.js';
import {columnChart} from './charts.js';
const fmt=(v,d=0)=>v===null?'—':v.toLocaleString('th-TH',{maximumFractionDigits:d});
const colors=['#96ccfa','#f58cb4','#ffcf82','#a7d7aa','#cb95d9','#81dce5'];
export function ncdModel({rows,population,units,year,period,rate}){
 const eligible=rate?units.filter(f=>f.area_unit):units;
 const codes=new Set(eligible.map(f=>f.facility_code));
 const selected=rows.filter(r=>codes.has(r.facility_code)&&+r.fiscal_year===year&&(r.case_type==='รายเก่า'||periodMatches(r,year,period)));
 const summary=ncdSummary(selected);
 const pop=code=>number(population.find(r=>r.facility_code===code&&+r.fiscal_year===year)?.population);
 const denominator=eligible.length&&eligible.every(f=>pop(f.facility_code)>0)?sum(eligible.map(f=>pop(f.facility_code))):null;
 const convert=(v,p)=>rate?percent(v,p,100000):v;
 const diseases=[...new Set(summary.map(r=>r.disease))].map(disease=>{
  const records=summary.filter(r=>r.disease===disease);
  const complete=records.length===eligible.length;
  const aggregate=key=>rate&&!complete?null:convert(sum(records.map(r=>r[key])),denominator);
  return {disease,old:aggregate('old'),new:aggregate('new'),total:aggregate('total'),count:sum(records.map(r=>r.total))};
 }).sort((a,b)=>(b.count??-1)-(a.count??-1));
 const unitRows=units.map(f=>({facility:f,values:diseases.map(d=>{const r=summary.find(r=>r.facility_code===f.facility_code&&r.disease===d.disease);return rate&&!f.area_unit?'N/A':convert(r?.total??null,pop(f.facility_code));})}));
 return {diseases,unitRows,denominator,rate};
}
function donut(items){
 const valid=items.filter(r=>r.count!==null&&r.count>0),total=sum(valid.map(r=>r.count));
 if(!total)return '<div class="empty">ยังไม่มีจำนวนผู้ป่วยที่ใช้แสดงสัดส่วนได้</div>';
 let angle=-Math.PI/2;
 const arcs=valid.map(r=>{const start=angle,size=r.count/total*Math.PI*2;angle+=size;const mid=start+size/2,color=colors[items.indexOf(r)%colors.length];const x=a=>180+120*Math.cos(a),y=a=>180+120*Math.sin(a);const path=size>=Math.PI*2-.00001?'<circle cx="180" cy="180" r="120" fill="none" stroke="'+color+'" stroke-width="58"/>':'<path d="M '+x(start)+' '+y(start)+' A 120 120 0 '+(size>Math.PI?1:0)+' 1 '+x(angle)+' '+y(angle)+'" fill="none" stroke="'+color+'" stroke-width="58"/>';return '<g><title>'+e(r.disease)+': '+fmt(r.count)+' ('+fmt(r.count/total*100,1)+'%)</title>'+path+(size>.3?'<text x="'+x(mid)+'" y="'+y(mid)+'" text-anchor="middle" class="ncd-slice-label">'+fmt(r.count)+'<tspan x="'+x(mid)+'" dy="16">('+fmt(r.count/total*100,1)+'%)</tspan></text>':'')+'</g>';}).join('');
 return '<svg class="ncd-donut" viewBox="0 0 360 360" role="img" aria-label="สัดส่วนจำนวนตามประเภทโรค"><title>สัดส่วนจำนวนตามประเภทโรค</title>'+arcs+'</svg><div class="legend">'+items.map((r,i)=>'<span><i style="background:'+colors[i%colors.length]+'"></i>'+e(r.disease)+' '+fmt(r.count)+(r.count!==null?' ('+fmt(r.count/total*100,1)+'%)':'')+'</span>').join('')+'</div>';
}
export function ncdView(context){
 const m=ncdModel(context),{panel,table}=context,unit=context.rate?'ต่อ 100,000 คน':'ราย',digits=context.rate?2:0;
 const controls='<div class="controls"><label>รูปแบบแสดงผล<select id="rate-mode"><option value="count" '+(!context.rate?'selected':'')+'>จำนวนผู้ป่วย (ราย)</option><option value="rate" '+(context.rate?'selected':'')+'>อัตราป่วยต่อ 100,000 คน</option></select></label><button data-export="ncd">ส่งออก CSV</button></div>';
 const comparison=columnChart([{label:'ผู้ป่วยเดิม (รายเก่า) · '+unit,color:colors[0],values:m.diseases.map(d=>d.old)},{label:'ผู้ป่วยรายใหม่ · '+unit,color:colors[1],values:m.diseases.map(d=>d.new)}],m.diseases.map(d=>d.disease));
 const values=m.unitRows.map(r=>['<button class="table-link" data-ncd-unit="'+e(r.facility.facility_code)+'">'+e(r.facility.short_name)+'</button>',...r.values.map(v=>typeof v==='string'?v:fmt(v,digits)),r.values.some(v=>v==='N/A')?'N/A':r.values.some(v=>v===null)?'—':fmt(sum(r.values),digits)]);
 values.push(['<strong>รวมหน่วยที่เลือก</strong>',...m.diseases.map(d=>'<strong>'+fmt(d.total,digits)+'</strong>'),m.diseases.some(d=>d.total===null)?'—':fmt(sum(m.diseases.map(d=>d.total)),digits)]);
 return controls+(context.rate?'<p class="notice">อัตรา = จำนวนตามข้อมูลโรค ÷ ประชากรพื้นที่ปีเดียวกัน × 100,000 ใช้เฉพาะหน่วยที่มีพื้นที่รับผิดชอบ หากข้อมูลโรคหรือประชากรไม่ครบ จะแสดง —; หน่วยไม่มีพื้นที่แสดง N/A</p>':'')+'<div class="ncd-chart-grid">'+panel('เปรียบเทียบผู้ป่วยเดิมและผู้ป่วยรายใหม่ (เรียงจำนวนรวมมากไปน้อย)',comparison,'หน่วย: '+unit)+panel('สัดส่วนจำแนกตามประเภทโรค',donut(m.diseases),'สัดส่วนคำนวณจากจำนวนรายตามข้อมูลโรค')+'</div>'+panel('แจกแจงผู้ป่วยโรคเรื้อรังรายหน่วยบริการ',table(['หน่วยบริการ',...m.diseases.map(d=>d.disease),'รวมทุกโรค'+(context.rate?' (ต่อแสน)':'')],values),'รายเก่าใช้ค่าสูงสุดในปี + รายใหม่รวมตามช่วงที่เลือก; ผลรวมข้ามโรคอาจนับคนเดียวหลายโรค ไม่ใช่จำนวนบุคคลไม่ซ้ำ ข้อมูลขาดแสดง — และค่าศูนย์จริงแสดง 0; คลิกชื่อหน่วยเพื่อกรองกราฟ');
}
