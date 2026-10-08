import {escapeHtml as e} from '../utils/core.js';

// ตารางที่ผู้ดูแลยืนยันจากภาพต้นฉบับสำหรับ ศบส.บ้านกล้วยม่วง
export const serviceSchedules={
 '06120':{
  rows:[
   ['จันทร์','ตรวจรักษาโรคทั่วไป','เยี่ยมบ้าน'],
   ['อังคาร','คลินิกโรคไม่ติดต่อเรื้อรัง','เยี่ยมบ้าน'],
   ['พุธ','คลินิกสุขภาพเด็กดี/ตรวจพัฒนาการเด็ก','เยี่ยมบ้าน'],
   ['พฤหัสบดี','คลินิกสุขภาพโรคไม่ติดต่อเรื้อรัง','เยี่ยมบ้าน'],
   ['ศุกร์','ตรวจรักษาโรคทั่วไป','Telemed ผู้ป่วยจิตเวช และเยี่ยมบ้าน']
  ],
  notes:[
   'คลินิกโรคไม่ติดต่อเรื้อรัง (แพทย์, เภสัช ลงตรวจ) ทุกวันอังคารของเดือน',
   'คลินิกโรคไม่ติดต่อเรื้อรัง (พบพยาบาล) วันพฤหัสบดี สัปดาห์ที่ 1 และ 3 ของเดือน',
   'คลินิกสุขภาพเด็กดี/ตรวจพัฒนาการเด็ก วันพุธ สัปดาห์ที่ 2 ของเดือน',
   'คลินิกเจาะเลือดประจำปีผู้ป่วยโรคไม่ติดต่อเรื้อรัง วันศุกร์ สัปดาห์ที่ 2 และ 4 ของเดือน',
   'Telemed ผู้ป่วยจิตเวช วันศุกร์ สัปดาห์ที่ 2 ของเดือน'
  ]
 }
};

export function serviceSchedule(code){
 const schedule=serviceSchedules[code];if(!schedule)return '';
 return `<section class="panel unit-service-schedule"><h2>ตารางการให้บริการ</h2><div class="table-wrap"><table><caption>ตารางบริการประจำสัปดาห์ — ศบส.บ้านกล้วยม่วง</caption><thead><tr><th scope="col">วัน</th><th scope="col">ช่วงเช้า<br>08.30–12.00 น.</th><th scope="col">ช่วงบ่าย<br>13.00–16.00 น.</th></tr></thead><tbody>${schedule.rows.map(([day,morning,afternoon])=>`<tr><th scope="row">${e(day)}</th><td>${e(morning)}</td><td>${e(afternoon)}</td></tr>`).join('')}</tbody></table></div><p class="subtle">พักกลางวันระหว่างช่วงบริการ</p><h3>หมายเหตุ</h3><ul>${schedule.notes.map(note=>`<li>${e(note)}</li>`).join('')}</ul></section>`;
}
