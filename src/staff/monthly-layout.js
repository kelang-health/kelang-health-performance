// Spacing and dotted fields follow compensation/print_monthly.php; wording follows the supplied PDF.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const digits=v=>String(v??'').replace(/[0-9]/g,d=>'๐๑๒๓๔๕๖๗๘๙'[Number(d)]);
const months=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const date=v=>v?digits(Number(v.slice(8,10)))+' '+months[Number(v.slice(5,7))-1]+' '+digits(Number(v.slice(0,4))+543):'';
const field=(key,v,extra='')=>`<span class="monthly-field ${extra}" ${v==null||v===''?'':`data-print-field="${key}"`}><span>${esc(digits(v))}</span></span>`;
export const monthlyLayoutCSS=`
.monthly-sheet{width:210mm;min-height:297mm;margin:12px auto;padding:10mm 16mm 12mm;background:white;color:black;font-family:"TH Sarabun New",Sarabun,sans-serif;font-size:16pt;line-height:1.14;box-shadow:0 2px 12px #999}
.monthly-sheet h1{font-size:18pt;line-height:1.15;text-align:center;margin:0 0 12px}
.monthly-sheet .monthly-meta{width:58%;margin:0 0 10px auto}
.monthly-row{display:flex;align-items:baseline;gap:5px;margin:3px 0}
.monthly-field{display:inline-block;flex:1;min-width:0;border-bottom:1px dotted #111;padding:0 3px 1px;text-align:center;line-height:1.14;overflow-wrap:anywhere}
.monthly-field.short{flex:0 0 48px}.monthly-field.medium{flex:0 0 72px}
.monthly-field:empty{min-height:1.14em}.monthly-field>span:empty:before{content:" "}
.monthly-name{display:grid;grid-template-columns:auto fit-content(24%) auto fit-content(20%) auto minmax(0,1fr);gap:4px;align-items:baseline;margin:3px 0}
.monthly-name .monthly-field{text-align:left;min-width:2em;padding-left:3px;padding-right:5px}.monthly-work .monthly-field,.monthly-primary .monthly-field{text-align:left}
.monthly-work{display:grid;grid-template-columns:auto 1.5fr auto .5fr auto .9fr;gap:4px;align-items:baseline;margin:3px 0}
.monthly-history-title{margin:7px 0 4px}.monthly-training{margin-left:20px}.monthly-training p{margin:2px 0}
.monthly-training-row{display:grid;grid-template-columns:auto 1fr auto .6fr auto .9fr auto .9fr;gap:4px;align-items:baseline;margin:3px 0}
.monthly-history{margin:5px 0;break-inside:avoid}
.monthly-primary{display:grid;grid-template-columns:auto minmax(0,1.6fr) auto minmax(0,.5fr) auto minmax(0,.85fr);gap:4px;align-items:baseline}
.monthly-secondary{display:grid;grid-template-columns:auto 1fr auto 1fr auto .25fr auto .25fr auto .25fr auto;gap:4px;align-items:baseline;padding-left:20px;margin-top:2px}
.monthly-summary{margin-top:7px}.monthly-certify{text-indent:32px;margin:12px 0 0}.monthly-signature{text-align:center;width:48%;margin:28px 0 0 auto;break-inside:avoid}.monthly-signature p{margin:2px 0}
@media print{.monthly-sheet{min-height:0;margin:0;box-shadow:none}.monthly-field{border-bottom:1px dotted black}}
`;
export function monthlyLayoutBody(record,f,history,printNames){
 const month=months[Number(record.period_month?.slice(5,7))-1]||'';
 const position=[f.position_name,f.position_level].filter(Boolean).join(' ');
 let body=`<main class="monthly-sheet"><h1>ใบขอรับเงินค่าตอบแทนเบี้ยเลี้ยงเหมาจ่ายสำหรับเจ้าหน้าที่<br>ที่ปฏิบัติงานในหน่วยบริการสังกัดเทศบาลเมืองเขลางค์นคร</h1>
 <div class="monthly-meta"><div class="monthly-row">หน่วยบริการ${field('facility_name',f.facility_name)}</div><div class="monthly-row">ประจำเดือน${field('month',month)}พ.ศ.${field('calendar_year',Number(record.period_month?.slice(0,4))+543,'medium')}</div></div>
 <div class="monthly-name">ข้าพเจ้าชื่อ${field('first_name',f.applicant_first_name)}นามสกุล${field('last_name',f.applicant_last_name)}ตำแหน่ง${field('position',position)}</div>
 <div class="monthly-work">ปัจจุบันปฏิบัติงานที่${field('current_facility',f.facility_name)}จังหวัด${field('province',f.unit_province)}ระดับ/กลุ่ม${field('area_level',f.level_name)}</div>
 <div class="monthly-row">ปฏิบัติงานในหน่วยบริการ${field('service_years',f.service_years,'short')}ปี${field('service_months',f.service_months,'short')}เดือน (นับถึงสิ้นเดือนที่เบิกจ่าย)</div>
 <p class="monthly-history-title">โดยมีรายละเอียดการปฏิบัติงาน ดังนี้ (เฉพาะสายแพทย์ตอบข้อ ๑ ด้วย)</p>
 <div class="monthly-training"><p>๑. ฝึกเพิ่มพูนทักษะ (ปีที่ ๑) รวมระยะเวลาการปฏิบัติงาน ปี เดือน ดังนี้</p>`;
 for(const [kind,label] of [['regional','รพศ./รพท.'],['district','รพช.']]){const selected=Number(f.training_status)===2&&Number(f['training_'+kind+'_selected'])===1;const val=s=>selected?f['training_'+kind+'_'+s]:'';body+=`<div class="monthly-training-row"><span ${selected?`data-print-field="training_${kind}_checked"`:""}>${selected?'☑':'☐'} ${label}</span>${field('training_'+kind+'_facility',val('facility'))}จังหวัด${field('training_'+kind+'_province',val('province'))}ตั้งแต่${field('training_'+kind+'_from',date(val('from_date')))}ถึง${field('training_'+kind+'_to',date(val('to_date')))}</div>`;}
 body+='</div>';
 for(let i=0;i<6;i++){const h=history[i]||{};const name=printNames[i]||String(h.facility_name||'').replace(/^โรงพยาบาล/,'');body+=`<div class="monthly-history"><div class="monthly-primary"><span>${digits(i+2)}. ปฏิบัติงานที่โรงพยาบาล</span>${field('history_'+i+'_facility',name)}จังหวัด${field('history_'+i+'_province',h.province)}จัดระดับ${field('history_'+i+'_level',h.level_name)}</div><div class="monthly-secondary">ตั้งแต่วันที่${field('history_'+i+'_from',date(h.start_date))}ถึงวันที่${field('history_'+i+'_to',date(h.end_date))}รวม${field('history_'+i+'_years',h.duration_years)}ปี${field('history_'+i+'_months',h.duration_months)}เดือน${field('history_'+i+'_days',h.duration_days)}วัน</div></div>`;}
 body+=`<div class="monthly-row monthly-summary">รวมทั้งสิ้น${field('total_years',f.service_years,'medium')}ปี${field('total_months',f.service_months,'medium')}เดือน${field('total_days',f.service_days,'medium')}วัน</div><p class="monthly-certify">ข้าพเจ้าขอรับรองว่า ข้อมูลดังกล่าวเป็นความจริงทุกประการ และหากมีการเรียกเงินคืน ข้าพเจ้าขอรับผิดชอบ คืนเงินแต่เพียงผู้เดียว</p><div class="monthly-signature"><p>(${field('signature_name',f.full_name)})</p><p class="monthly-row">ตำแหน่ง${field('signature_position',position)}</p></div></main>`;
 const pdf=new URL('../../assets/forms/chor11-monthly-official.pdf',import.meta.url).href;
 const svg=new URL('../../assets/forms/chor11-monthly-official.svg',import.meta.url).href;
 return body+`<p class="print-system-meta" style="text-align:center"><a href="${pdf}">PDF แบบต้นฉบับ</a> · <a href="${svg}">ภาพแบบต้นฉบับ</a></p>`;
}
