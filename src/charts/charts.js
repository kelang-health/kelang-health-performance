import {escapeHtml as e} from '../utils/core.js';
export function bars(items,target=null,format=v=>v===null?'—':v.toLocaleString('th-TH',{maximumFractionDigits:1})){
 const max=Math.max(1,...items.map(r=>r.value??0),target??0);
 return items.map(r=>`<div class="bar-row"><div class="bar-name" title="${e(r.label)}">${e(r.label)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0,(r.value??0)/max*100)}%"></div>${target!==null?`<span class="target-line" style="left:${target/max*100}%" title="เป้าหมาย ${target}"></span>`:''}</div><div class="bar-value">${e(format(r.value))}</div></div>`).join('')+(target!==null?`<div class="subtle">เส้นประ: เป้าหมาย ${e(format(target))}</div>`:'');
}
export function lineChart(datasets,labels,target=null){
 const valid=datasets.flatMap(d=>d.values).filter(v=>v!==null&&Number.isFinite(v));
 if(!valid.length)return '<div class="empty">แหล่งข้อมูลไม่มีผลงานรายเดือนสำหรับรายการนี้</div>';
 const max=Math.max(1,target??0,...valid)*1.1;const colors=['#268a70','#688cb9','#b68b4b','#a47398','#62a7af','#887dbc','#8bac61','#c07867'];
 const x=i=>45+i*(615/Math.max(1,labels.length-1));const y=v=>230-v/max*190;
 let svg=`<svg class="chart" role="img" aria-label="กราฟแนวโน้มรายเดือน แสดงรายละเอียดในตารางถัดไป" viewBox="0 0 700 280"><title>แนวโน้มรายเดือน</title>`;
 for(let i=0;i<=4;i++){const v=max*i/4;svg+=`<path d="M45 ${y(v)} H665" stroke="#e5ede9"/><text x="38" y="${y(v)+4}" text-anchor="end">${Math.round(v).toLocaleString()}</text>`;}
 if(target!==null)svg+=`<path d="M45 ${y(target)} H665" stroke="#b98d43" stroke-dasharray="5 4"/><text x="665" y="${y(target)-5}" text-anchor="end">เป้า ${target}</text>`;
 datasets.forEach((d,index)=>{const c=colors[index%colors.length];let segment=[];const flush=()=>{if(segment.length)svg+=`<polyline points="${segment.join(' ')}" fill="none" stroke="${c}" stroke-width="2.5"/>`;segment=[];};d.values.forEach((v,i)=>{if(v===null||!Number.isFinite(v)){flush();return;}segment.push(`${x(i)},${y(v)}`);svg+=`<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${c}"><title>${e(d.label)} ${e(labels[i])}: ${v.toLocaleString('th-TH',{maximumFractionDigits:2})}</title></circle>`;});flush();});
 labels.forEach((label,i)=>svg+=`<text x="${x(i)}" y="258" text-anchor="middle">${e(label)}</text>`);
 return svg+'</svg><div class="legend">'+datasets.map((d,i)=>`<span><i style="background:${colors[i%colors.length]}"></i>${e(d.label)}</span>`).join('')+'</div>';
}
