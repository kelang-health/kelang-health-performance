import {rateToggle} from './rate-toggle.js';
import {number,sum,percent,periodMatches,fiscalMonths,monthNames,escapeHtml as e} from '../utils/core.js';
import {columnChart} from './charts.js';
const colors=['#cc1260','#ff8300','#328b39','#187bd9','#85209e','#009cac'];
const fmt=v=>v===null?'—':v.toLocaleString('th-TH',{maximumFractionDigits:2});
export function cdModel({rows,population,units,year,period,rate}){
 const eligible=rate?units.filter(f=>f.area_unit):units,codes=new Set(eligible.map(f=>f.facility_code));
 const selected=rows.filter(r=>codes.has(r.facility_code)&&periodMatches(r,year,period));
 const months=fiscalMonths.filter(m=>period==='all'||({q1:[10,11,12],q2:[1,2,3],q3:[4,5,6],q4:[7,8,9]}[period]??fiscalMonths).includes(m));
 const pop=code=>number(population.find(r=>r.facility_code===code&&+r.fiscal_year===year)?.population);
 const denominator=eligible.length&&eligible.every(f=>pop(f.facility_code)>0)?sum(eligible.map(f=>pop(f.facility_code))):null;
 const aggregate=records=>{const value=sum(records.map(r=>r.case_count));return rate?eligible.every(f=>records.some(r=>r.facility_code===f.facility_code&&number(r.case_count)!==null))?percent(value,denominator,100000):null:value;};
 const diseases=[...new Set(selected.map(r=>r.disease))].map(disease=>{const records=selected.filter(r=>r.disease===disease);return {disease,count:sum(records.map(r=>r.case_count)),total:aggregate(records),values:months.map(m=>aggregate(records.filter(r=>r.period&&+r.period.slice(5,7)===m)))};}).sort((a,b)=>(b.count??-1)-(a.count??-1));
 const unitRows=units.map(f=>({facility:f,values:diseases.map(d=>{if(rate&&!f.area_unit)return 'N/A';const value=sum(selected.filter(r=>r.facility_code===f.facility_code&&r.disease===d.disease).map(r=>r.case_count));return rate?percent(value,pop(f.facility_code),100000):value;})}));
 return {diseases,months,unitRows};
}
export function diseaseLines(datasets,labels){
 const valid=datasets.flatMap(d=>d.values).filter(v=>v!==null&&Number.isFinite(v));
 if(!valid.length)return '<div class="empty">ยังไม่มีข้อมูลรายเดือนที่คำนวณได้ในช่วงที่เลือก</div>';
 const width=Math.max(1000,140+labels.length*115),left=90,right=width-40,top=60,bottom=340,max=Math.max(1,...valid)*1.2,x=i=>left+i*(right-left)/Math.max(1,labels.length-1),y=v=>bottom-v/max*(bottom-top);
 let svg='<svg class="chart" role="img" aria-label="แนวโน้มโรคติดต่อรายเดือนพร้อมตัวเลข" viewBox="0 0 '+width+' 410" style="min-width:calc('+width+'px * var(--reading-scale))"><title>แนวโน้มโรคติดต่อรายเดือน</title>';
 for(let i=0;i<=5;i++){const v=max*i/5;svg+='<path d="M'+left+' '+y(v)+' H'+right+'" stroke="#e5ede9"/><text x="'+(left-12)+'" y="'+(y(v)+4)+'" text-anchor="end">'+fmt(v)+'</text>';}
 datasets.forEach((d,j)=>{const c=colors[j%colors.length];let previous=null;d.values.forEach((v,i)=>{if(v===null||!Number.isFinite(v)){previous=null;return;}if(previous!==null)svg+='<path data-line-segment d="M'+x(previous)+' '+y(d.values[previous])+' L'+x(i)+' '+y(v)+'" fill="none" stroke="'+c+'" stroke-width="2.5"/>';svg+='<circle data-line-point cx="'+x(i)+'" cy="'+y(v)+'" r="5" fill="'+c+'"><title>'+e(d.label)+' '+e(labels[i])+': '+fmt(v)+'</title></circle><text class="chart-value" x="'+x(i)+'" y="'+(y(v)-12-j%3*17)+'" text-anchor="middle" style="fill:'+c+'">'+fmt(v)+'</text>';previous=i;});});
 labels.forEach((label,i)=>svg+='<text x="'+x(i)+'" y="375" text-anchor="middle">'+e(label)+'</text>');
 return '<div class="chart-scroll">'+svg+'</svg></div><div class="legend">'+datasets.map((d,j)=>'<span><i style="background:'+colors[j%colors.length]+'"></i>'+e(d.label)+'</span>').join('')+'</div>';
}
export function cdView(context){
 const {panel,table}=context,m=cdModel(context),unit=context.rate?'ต่อ 100,000 คน':'ราย',labels=m.months.map(month=>monthNames[fiscalMonths.indexOf(month)]);
 const controls='<div class="controls">'+rateToggle(context.rate)+'<button data-export="cd">ส่งออก CSV</button></div>';
 const rows=m.unitRows.map(r=>[e(r.facility.short_name),...r.values.map(v=>typeof v==='string'?v:fmt(v))]);rows.push(['<strong>รวมหน่วยที่เลือก</strong>',...m.diseases.map(d=>'<strong>'+fmt(d.total)+'</strong>')]);
 return controls+panel('แนวโน้มการเกิดโรคติดต่อรายเดือน (การเฝ้าระวังทางระบาดวิทยา)',diseaseLines(m.diseases.map(d=>({label:d.disease,values:d.values})),labels),'หน่วย: '+unit+' • ข้อมูลเดือนที่ขาดจะเว้นช่วงเส้น ไม่แทนด้วย 0')+panel(context.rate?'อัตราป่วยสะสมแยกตามโรค':'จำนวนผู้ป่วยสะสมแยกตามโรค',columnChart([{label:unit,color:'#ffa88e',values:m.diseases.map(d=>d.total)}],m.diseases.map(d=>d.disease)),'เรียงตามจำนวนผู้ป่วยมากไปน้อย • สะสมเฉพาะช่วงเวลาที่เลือก')+panel('ข้อมูลโรคติดต่อรายหน่วยบริการ',table(['หน่วยบริการ',...m.diseases.map(d=>d.disease)],rows),'อัตรา = จำนวนตามข้อมูลโรค ÷ ประชากรพื้นที่ปีเดียวกัน × 100,000 ใช้เฉพาะหน่วยมีพื้นที่รับผิดชอบ ข้อมูลหรือประชากรขาดแสดง —; หน่วยไม่มีพื้นที่แสดง N/A; จำนวนเป็นรายตามโรค ไม่ใช่บุคคลไม่ซ้ำ')+panel('รายละเอียดแนวโน้มรายเดือน',table(['โรค',...labels],m.diseases.map(d=>[e(d.disease),...d.values.map(fmt)])));
}
