export const categories={
 population:{title:'ประชากรและพื้นที่',table:'hp_population',annual:true,dimensions:[],fields:{population:'ประชากรรวม',male:'ชาย',female:'หญิง',households:'หลังคาเรือน',communities:'ชุมชน'}},
 volunteers:{title:'อสม.',table:'hp_volunteers',annual:true,dimensions:[],fields:{volunteer_count:'จำนวน อสม.'}},
 staff:{title:'บุคลากรแยกวิชาชีพ',table:'hp_staff',annual:true,dimensions:['profession'],fields:{staff_count:'บุคลากร',support_count:'สนับสนุน'}},
 ncd:{title:'ผู้ป่วย NCD รายเดือน',table:'hp_ncd_monthly',dimensions:['disease','case_type'],fields:{case_count:'จำนวนราย'}},
 cd:{title:'โรคติดต่อรายเดือน',table:'hp_cd_monthly',dimensions:['disease'],fields:{case_count:'จำนวนราย'}},
 services:{title:'สถิติบริการรายเดือน',table:'hp_service_stats',dimensions:['service_name'],fields:{visit_count:'จำนวนครั้ง'}}
};
export const monthOrder=[10,11,12,1,2,3,4,5,6,7,8,9];
export const dimensionLabels={profession:'วิชาชีพ',disease:'โรค',case_type:'ประเภทราย',service_name:'บริการ'};
export function periodOf(year,month){if(!Number.isInteger(year)||year<2500||year>2700||!monthOrder.includes(Number(month)))throw new Error('ปีหรือเดือนไม่ถูกต้อง');return `${year-543-(month>=10?1:0)}-${String(month).padStart(2,'0')}-01`;}
const ascii=s=>String(s).replace(/[๐-๙]/g,d=>String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d)));
export function countValue(value){if(value===null||value===undefined||String(value).trim()==='')return null;const text=ascii(value).trim();if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(text))throw new Error('จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป ใช้ช่องว่างเมื่อยังไม่มีข้อมูล');const n=Number(text.replaceAll(',',''));if(!Number.isSafeInteger(n)||n>2147483647)throw new Error('จำนวนมากเกินที่ระบบรองรับ');return n;}
export function normalize(category,input,{code,year,month}){
 const c=categories[category];if(!c)throw new Error('ไม่รองรับหมวดนี้');if(!/^\d{5}$/.test(code)||!Number.isInteger(year)||year<2500||year>2700)throw new Error('หน่วยหรือปีไม่ถูกต้อง');
 const out={facility_code:code,fiscal_year:year,...(!c.annual?{period:periodOf(year,Number(month))}:{})};
 for(const key of c.dimensions){const text=String(input[key]??'').trim();if(!text||text.length>200)throw new Error('ต้องระบุ '+dimensionLabels[key]+' ไม่เกิน 200 ตัวอักษร');if(key==='case_type'&&!['รายเก่า','รายใหม่'].includes(text))throw new Error('ประเภทรายต้องเป็น รายเก่า หรือ รายใหม่');out[key]=text;}
 for(const key of Object.keys(c.fields))out[key]=countValue(input[key]);
 if(Object.keys(c.fields).every(k=>out[k]===null))throw new Error('ยังไม่ได้กรอกตัวเลข ไม่บันทึกช่องว่างเป็นศูนย์');
 if(category==='population'&&out.population!==null&&out.male!==null&&out.female!==null&&out.male+out.female!==out.population)throw new Error('ชาย + หญิง ต้องเท่ากับประชากรรวม');
 return out;
}
export function naturalKey(category,row){const c=categories[category];return JSON.stringify([row.facility_code,Number(row.fiscal_year),...(c.annual?[]:[row.period]),...c.dimensions.map(k=>String(row[k]??'').trim())]);}
export function valuesEqual(category,a,b){const c=categories[category];return Object.keys(c.fields).every(k=>(a?.[k]==null?null:Number(a[k]))===(b?.[k]==null?null:Number(b[k])));}
export function comparison(current,previous){if(current===null||current===undefined||previous===null||previous===undefined)return {delta:null,percent:null};const delta=Number(current)-Number(previous);return {delta,percent:Number(previous)===0?null:delta/Number(previous)*100};}
export function gridRows(category,rows,scope){
 const c=categories[category],selected=rows.filter(r=>r.facility_code===scope.code&&[scope.year,scope.year-1].includes(Number(r.fiscal_year))&&(c.annual||r.period===periodOf(Number(r.fiscal_year),scope.month)));
 const dimensions=new Map();if(!c.dimensions.length)dimensions.set('[]',{});for(const r of selected){const dims=Object.fromEntries(c.dimensions.map(k=>[k,r[k]]));dimensions.set(JSON.stringify(c.dimensions.map(k=>r[k])),dims);}
 return [...dimensions.values()].map(dims=>{const match=r=>c.dimensions.every(k=>r[k]===dims[k]);const current=selected.filter(r=>+r.fiscal_year===scope.year&&match(r)),previous=selected.filter(r=>+r.fiscal_year===scope.year-1&&match(r));return {dimensions:dims,current:current.length===1?current[0]:null,previous:previous.length===1?previous[0]:null,duplicate:current.length>1||previous.length>1,currentCount:current.length,previousCount:previous.length};}).sort((a,b)=>JSON.stringify(a.dimensions).localeCompare(JSON.stringify(b.dimensions),'th'));
}
export function classify(category,body,rows){const matches=rows.filter(r=>naturalKey(category,r)===naturalKey(category,body));if(matches.length>1)return {action:'conflict',before:null,error:'พบรายการซ้ำในฐานเดิม ต้องตรวจที่จัดการข้อมูลก่อน'};const before=matches[0]||null;return {action:before?(valuesEqual(category,before,body)?'skip':'update'):'add',before};}
export function parseCsv(text){
 if(new TextEncoder().encode(text).length>1024*1024)throw new Error('CSV ต้องไม่เกิน 1 MB');if(text.includes('\uFFFD'))throw new Error('อ่านภาษาไทยไม่ครบ กรุณาบันทึกไฟล์เป็น CSV UTF-8 แล้วนำเข้าใหม่');text=text.replace(/^\uFEFF/,'');const records=[];let row=[],cell='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const ch=text[i];if(quoted){if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(ch==='"'){quoted=false;closed=true;}else cell+=ch;continue;}if(ch==='"'){if(cell||closed)throw new Error('เครื่องหมายคำพูด CSV ไม่ถูกต้อง');quoted=true;}else if(ch===','||ch==='\n'||ch==='\r'){row.push(cell);cell='';closed=false;if(ch!==','){if(ch==='\r'&&text[i+1]==='\n')i++;if(row.some(v=>v.trim()!==''))records.push(row);row=[];}}else{if(closed)throw new Error('มีข้อความหลังเครื่องหมายปิด CSV');cell+=ch;}}
 if(quoted)throw new Error('CSV ปิดเครื่องหมายคำพูดไม่ครบ');row.push(cell);if(row.some(v=>v.trim()!==''))records.push(row);if(records.length<2||records.length>301)throw new Error('CSV ต้องมี 1–300 แถวข้อมูล');const headers=records.shift().map(h=>h.trim());if(new Set(headers).size!==headers.length||headers.some(h=>!h))throw new Error('ชื่อคอลัมน์ว่างหรือซ้ำ');return records.map((r,i)=>{if(r.length!==headers.length)throw new Error('จำนวนคอลัมน์ไม่ตรงที่แถว '+(i+2));return Object.fromEntries(headers.map((h,j)=>[h,r[j]]));});
}
export function csvText(rows,columns){const escape=v=>'"'+String(v??'').replace(/^[=+\-@]/,"'$&").replaceAll('"','""')+'"';return '\uFEFF'+[columns,...rows.map(r=>columns.map(k=>r[k]??''))].map(r=>r.map(escape).join(',')).join('\r\n');}
export function importPreview(category,raw,scope,existing){
 const c=categories[category],seen=new Set(),allowed=['facility_code','fiscal_year',...(c.annual?[]:['period']),...c.dimensions,...Object.keys(c.fields),...Object.keys(c.fields).map(k=>'reference_'+k)];
 return raw.map((r,i)=>{try{if(allowed.filter(k=>!k.startsWith('reference_')).some(k=>!Object.hasOwn(r,k)))throw new Error('คอลัมน์ไม่ครบ กรุณาใช้แม่แบบจากหน้าที่เลือก');if(Object.keys(r).some(k=>!allowed.includes(k)))throw new Error('มีคอลัมน์ที่ไม่รองรับ กรุณาใช้แม่แบบของหมวดนี้');if(String(r.facility_code).trim().padStart(5,'0')!==scope.code||Number(ascii(r.fiscal_year))!==scope.year)throw new Error('หน่วยหรือปีไม่ตรงกับหน้าที่เลือก');if(!c.annual&&r.period!==periodOf(scope.year,scope.month))throw new Error('เดือนในแฟ้มไม่ตรงกับหน้าที่เลือก');const body=normalize(category,r,scope),key=naturalKey(category,body);if(seen.has(key))throw new Error('รายการซ้ำในแฟ้ม');seen.add(key);return {line:i+2,body,...classify(category,body,existing)};}catch(error){return {line:i+2,action:'conflict',error:error.message};}});
}
