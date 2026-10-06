import {escapeHtml as e} from '../utils/core.js';
export function bars(items,target=null,format=v=>v===null?'—':v.toLocaleString('th-TH',{maximumFractionDigits:1})){
 const max=Math.max(1,...items.map(r=>r.value??0),target??0);
 return items.map(r=>`<div class="bar-row"><div class="bar-name" title="${e(r.label)}">${e(r.label)}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0,(r.value??0)/max*100)}%"></div>${target!==null?`<span class="target-line" style="left:${target/max*100}%" title="เป้าหมาย ${target}"></span>`:''}</div><div class="bar-value">${e(format(r.value))}</div></div>`).join('')+(target!==null?`<div class="subtle">เส้นประ: เป้าหมาย ${e(format(target))}</div>`:'');
}
export function columnChart(datasets,labels,target=null){
 const valid=datasets.flatMap(d=>d.values).filter(v=>v!==null&&Number.isFinite(v));
 if(!valid.length)return '<div class="empty">แหล่งข้อมูลไม่มีผลงานรายเดือนสำหรับรายการนี้</div>';
 const colors=['#268a70','#688cb9','#b68b4b','#a47398','#62a7af','#887dbc','#8bac61','#c07867'];
 const groupWidth=Math.max(95,datasets.length*85),width=Math.max(1000,160+labels.length*groupWidth),left=115,right=width-30,top=55,bottom=330;
 const upper=Math.max(1,Number.isFinite(target)?target:0,...valid)*1.2,power=10**Math.floor(Math.log10(upper/5)),tick=[1,2,2.5,5,10].find(v=>v*power>=upper/5)*power;
 const max=Math.ceil(upper/tick)*tick,step=(right-left)/Math.max(1,labels.length),barWidth=Math.min(65,step*.78/datasets.length),y=v=>bottom-v/max*(bottom-top);
 let svg='<svg class="chart" role="img" aria-label="กราฟแท่งพร้อมตัวเลข ดูรายละเอียดในตารางถัดไป" style="min-width:calc('+width+'px * var(--reading-scale))" viewBox="0 0 '+width+' 415"><title>กราฟแท่งเปรียบเทียบผลงาน</title>';
 for(let i=0;i<=5;i++){const v=max*i/5;svg+='<path d="M'+left+' '+y(v)+' H'+right+'" stroke="#e5ede9"/><text x="'+(left-12)+'" y="'+(y(v)+4)+'" text-anchor="end">'+Math.round(v).toLocaleString('th-TH')+'</text>';}
 datasets.forEach((d,j)=>d.values.forEach((v,i)=>{if(v===null||!Number.isFinite(v))return;const x=left+step*(i+.5)+(j-(datasets.length-1)/2)*barWidth;const c=colors[j%colors.length],text=v.toLocaleString('th-TH',{maximumFractionDigits:2});svg+='<rect data-chart-point="true" x="'+(x-barWidth*.44)+'" y="'+y(v)+'" width="'+barWidth*.88+'" height="'+Math.max(0,bottom-y(v))+'" rx="3" fill="'+c+'"><title>'+e(d.label)+' '+e(labels[i])+': '+e(text)+'</title></rect><text class="chart-value" x="'+x+'" y="'+(y(v)-10)+'" text-anchor="middle" style="fill:'+c+'">'+e(text)+'</text>';}));
 if(Number.isFinite(target))svg+='<path class="chart-target" d="M'+left+' '+y(target)+' H'+right+'" stroke="#e03c43" stroke-width="2" stroke-dasharray="6 5"/><text x="'+right+'" y="'+(y(target)-9)+'" text-anchor="end" style="fill:#d52c36;font-weight:700;paint-order:stroke;stroke:white;stroke-width:4px">เป้าหมาย '+e(target.toLocaleString('th-TH'))+'</text>';
 labels.forEach((label,i)=>{const words=String(label).match(/.{1,17}/gu)??[''];svg+='<text x="'+(left+step*(i+.5))+'" y="356" text-anchor="middle">'+words.slice(0,3).map((word,j)=>'<tspan x="'+(left+step*(i+.5))+'" dy="'+(j?18:0)+'">'+e(word)+'</tspan>').join('')+'</text>';});
 return '<div class="chart-scroll">'+svg+'</svg></div><div class="legend">'+datasets.map((d,i)=>'<span><i style="background:'+colors[i%colors.length]+'"></i>'+e(d.label)+'</span>').join('')+'</div>';
}
