// Annual original: pages 5–6 of the user-selected Ministry of Interior PDF.
// Fixed text, circles, boxes and signatures are preserved as vector paths.
import {officialMonthlyCSS} from './monthly-official.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const months=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
const digits=v=>String(v??'').replace(/[0-9]/g,d=>'๐๑๒๓๔๕๖๗๘๙'[Number(d)]);
const date=v=>v?digits(Number(v.slice(8,10)))+' '+months[Number(v.slice(5,7))-1]+' '+digits(Number(v.slice(0,4))+543):'';
const amount=v=>v==null||v===''?'':digits(Number(v).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}));
function field(key,value,x,y,width){return value==null||value===''?'':`<span class="template-field" data-print-field="${key}" style="left:${x}pt;top:${y}pt;width:${width}pt"><span class="template-value">${esc(value)}</span></span>`;}
function dateParts(key,value,y,slots){if(!value)return '';return field(key+'_day',digits(Number(value.slice(8,10))),slots[0][0],y,slots[0][1])+field(key+'_month',months[Number(value.slice(5,7))-1],slots[1][0],y,slots[1][1])+field(key+'_year',digits(Number(value.slice(0,4))+543),slots[2][0],y,slots[2][1]);}
export const annualLicenseSlots=Object.freeze({medical:[71,345],dental:[71,363.4],nursing:[71,381.8],applied_thai:[71,400.2],physical_therapy:[112,418.6],other:[71,437],medical_practice:[354.5,345],pharmacy:[354.5,363.4],thai_medicine:[354.5,381.8],technical:[354.5,400.2]});
export const officialAnnualCSS=officialMonthlyCSS+' @page{size:595.32pt 841.92pt;margin:0}.official-annual{width:595.32pt;height:841.92pt}.official-annual .template-field{height:17pt;line-height:17pt;font-size:16pt}.official-annual .template-mark{position:absolute;width:10pt;height:12pt;line-height:12pt;text-align:center;font:12pt Arial;color:#000;background:transparent}@media print{.official-annual{break-after:page;page-break-after:always}.official-annual:last-of-type{break-after:auto;page-break-after:auto}}';
export function officialAnnualBody(record,f){
 if(f.license_type&&!Object.hasOwn(annualLicenseSlots,f.license_type))throw new Error('ประเภทใบอนุญาตเดิมไม่มีในแบบต้นฉบับหน้า 5–6 กรุณาตรวจสอบก่อนพิมพ์');
 if(f.license_type&&Number(f.no_professional_license)===1)throw new Error('ข้อมูลใบอนุญาตขัดกัน กรุณาเลือกประเภทหรือไม่มีใบอนุญาตอย่างใดอย่างหนึ่ง');
 const category=f.compensation_category||'LUMP_SUM_ALLOWANCE';
 if(category!=='LUMP_SUM_ALLOWANCE')throw new Error('แบบนี้เชื่อมข้อมูลเฉพาะเบี้ยเลี้ยงเหมาจ่าย ฉ.11');
 let page1=field('written_at',f.written_at,401,109,149)+dateParts('request_date',f.request_date,133,[[351,23],[397,90],[509,43]]);
 const slots={full_name:[174,199.5,176],position_name:[393,199.5,157],level_name:[95,217.5,116],service_years:[269,217.5,43],bureau:[402,217.5,149],facility_name:[258,235.6,291],unit_moo:[91,253.7,41],unit_subdistrict:[157,253.7,136],unit_district:[321,253.7,107],unit_province:[457,253.7,93],work_date_from:[113,271.7,147],work_date_to:[293,271.7,124],duration_years:[478,271.7,20],duration_months:[505,271.7,23],address_no:[163,289.9,98],road:[281,289.9,113],address_subdistrict:[446,289.9,106],address_district:[118,308,144],address_province:[293,308,102],postcode:[452,308,93],license_other:[246,437.5,303],license_number:[157,472.8,104]};
 for(const [key,[x,y,w]] of Object.entries(slots)){const value=key==='work_date_from'||key==='work_date_to'?date(f[key]):['service_years','duration_years','duration_months'].includes(key)?digits(f[key]):f[key];page1+=field(key,value,x,y,w);}
 page1+=dateParts('license_issue_date',f.license_issue_date,472.8,[[328,21],[379,95],[500,51]]);
 // A dot inside the prescribed circle selects it without replacing the circle.
 if(f.license_type){const [x,y]=annualLicenseSlots[f.license_type];page1+=`<span class="template-mark" data-license="${f.license_type}" style="left:${x}pt;top:${y}pt">●</span>`;}
 if(Number(f.no_professional_license)===1)page1+='<span class="template-mark" data-license="none" style="left:71pt;top:455.4pt">●</span>';
 page1+='<span class="template-mark" data-category="LUMP_SUM_ALLOWANCE" style="left:142pt;top:680.8pt">✓</span>';
 page1+=field('claim_from',date(f.work_date_from),113,716.6,114)+field('claim_to',date(f.work_date_to),260,716.6,109)+field('claim_years',digits(f.duration_years),428,716.6,21)+field('claim_months',digits(f.duration_months),456,716.6,23)+field('claim_hours',digits(f.duration_hours),502,716.6,23);
 page1+=field('monthly_rate',amount(f.monthly_rate),276,734.6,86)+field('total_amount',amount(f.total_amount),469,734.6,60)+field('amount_in_words',f.amount_in_words,74,752.7,239);
 const page2=field('signature_name',f.full_name,326,191.1,122);
 const page=(n,body)=>'<article class="official-monthly official-annual" aria-label="แบบคำขอประจำปี ต้นฉบับระเบียบ 2562 หน้า '+n+'"><img class="official-background" src="'+new URL('../../assets/forms/chor11-annual-official-'+n+'.svg',import.meta.url).href+'" alt="หน้า '+n+' ของแบบราชการต้นฉบับ"><div class="template-data">'+body+'</div></article>';
 const original=new URL('../../assets/forms/chor11-annual-official.pdf',import.meta.url).href;
 return page(1,page1)+page(2,page2)+'<p class="print-system-meta" style="text-align:center"><a href="'+original+'" target="_blank" rel="noopener">เปิด PDF ต้นฉบับหน้า 5–6 ที่ผู้ใช้กำหนด</a></p>';
}
