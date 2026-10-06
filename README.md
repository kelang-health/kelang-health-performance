# Kelang Health Performance

ระบบติดตามและเปรียบเทียบผลงานสุขภาพ หน่วยบริการสังกัดเทศบาลเมืองเขลางค์นคร

เว็บไซต์: https://kelang-health.github.io/kelang-health-performance/

Repository: https://github.com/kelang-health/kelang-health-performance

## แหล่งข้อมูลและสถาปัตยกรรม

- KPI → HDC Open Data MOPH `POST https://opendata.moph.go.th/api/report_data`
- นิยาม/เกณฑ์ → `https://api-center-hdc.moph.go.th/v1/report-public/detail`
- Hospital Profile → Supabase `med-device-sharing` (`txjuiaiwffsxfcrxpkvd`) ในตาราง `hp_*`
- หน้าเว็บ → Vanilla JavaScript modules, HTML, CSS, SVG charts; hash routes รองรับ GitHub Pages reload
- GitHub Actions → ทดสอบ, ดึง HDC แบบจำกัด concurrency, สร้าง public aggregate snapshot, deploy GitHub Pages ทุกวัน 06:00 น. ประเทศไทย และเมื่อ push main

ระบบเป็น Single Source of View: ไม่เก็บ HDC ใน Supabase การดึง HDC ผ่าน Actions ช่วยลด rate limit จากหลายผู้ใช้ หน้าเว็บแสดงวันที่ `date_com` จาก HDC แยกจากเวลาที่ดึงสำเร็จ และบอกสถานะแคชเมื่อ refresh ต้นทางไม่สำเร็จ ปุ่มรีเฟรชหน้าเว็บอ่าน snapshot ที่เผยแพร่ล่าสุดและข้อมูล Supabase ใหม่ ไม่เรียก HDC ทุก endpoint จากแต่ละเบราว์เซอร์

## ระบบเดิมและการเก็บรักษาข้อมูล

ตรวจ source `D:\AppServ\www\hdc-app` พร้อมการเปลี่ยนแปลงที่ยังไม่ commit โดยไม่แก้ไขระบบนั้น ใช้ API payload, report identifiers, นิยาม KPI และ port การรวมตัวตั้ง/ตัวหารมาเป็น master กลาง เก็บ PHP analyzer เดิมใน `vendor/hdc/` และเรียกจาก `scripts/analyze-hdc.php` สำหรับผลวิเคราะห์ประกอบใน snapshot

ตรวจ Hospital Profile จาก repository `apiwatmeethong-pixel/kelangnakorn-hospitalprofile` commit `75c46a51a41577675a2db452e09757319aba99c9` มี 4 source files: index.html, script.js, style.css, README.md และ Google Apps Script backend ที่ repository ไม่ได้แนบ source ไว้ ได้สำรอง `getAllDatabase` ก่อนย้ายข้อมูล ระบบเดิมยังเปิดได้ที่ https://apiwatmeethong-pixel.github.io/kelangnakorn-hospitalprofile/

นำเข้าข้อมูลพื้นฐาน 8 แห่ง, การเงิน 89 แถว, NCD 157 แถว, โรคติดต่อ 44 แถว, settings 14 แถว เก็บ raw fields และ source keys เพื่อตรวจย้อนกลับ `backups/` อยู่เฉพาะเครื่อง ไม่ commit และไม่เผยแพร่ ข้อมูลใหม่เขียนลง Supabase เท่านั้น ไม่เขียนย้อนกลับ Google Sheets เดิม

## หน่วยบริการ

| รหัส | ชื่อ | AREA | SERVICE |
|---|---|---|---|
| 06116 | ศบส.บ้านโทกหัวช้าง | ใช่ | ใช่ |
| 06117 | ศบส.บ้านฟ่อน | ใช่ | ใช่ |
| 06118 | ศบส.บ้านศรีหมวดเกล้า | ใช่ | ใช่ |
| 06119 | ศบส.บ้านกล้วยแพะ | ใช่ | ใช่ |
| 06120 | ศบส.บ้านกล้วยม่วง | ใช่ | ใช่ |
| 06121 | ศบส.บ้านกาด | ใช่ | ใช่ |
| 06122 | ศบส.บ้านแม่กืย | ใช่ | ใช่ |
| 45030 | ศบส.เขลางค์นคร | N/A | ใช่ |

`src/config/facilities.json` และ Supabase `hp_facilities` เป็น master กลาง AREA ไม่รวม 45030 ในตัวหาร ค่าเฉลี่ย และอันดับ SERVICE แสดงครบ 8 หน่วย ถ้าต้นทางไม่มีข้อมูลหน่วยที่ 8 จะแสดง — ไม่สร้าง 0

## KPI และสูตร

26 ตัวชี้วัดอยู่ใน `src/config/kpi-master.json`; รายละเอียด API ที่ตรวจสอบอยู่ใน `docs/official-kpi-definitions.json` รายการ HDC เดิมที่ค้นได้ 101 รายการอยู่ใน `src/config/report-inventory.json` รายการนอก 26 ตัวหลักมีลิงก์นิยาม HDC และไม่ได้เดา scope หรือสูตรเพื่อรวมยอด

รองรับ HIGHER_BETTER, LOWER_BETTER, RANGE, INFORMATION; ค่าองค์กรคำนวณรวมตัวตั้ง/รวมตัวหาร ไม่เฉลี่ยร้อยละรายหน่วย สถานะใกล้เป้าคือห่างไม่เกิน 10% ของค่าเกณฑ์ เป้าหมายที่ HDC ไม่ระบุคงไว้เป็น null และไม่ประเมินผ่าน/ไม่ผ่าน

แก้ข้อผิดพลาดจากนิยามเดิมที่ตรวจพบ:

- DM Control ใช้ `result/target` ไม่ใช้ `hba1c/target`
- สูงดีสมส่วนใช้ `resultq/targetq` เกณฑ์ 72%; ไม่ใช้สูตรชั่งวัด `targetq/totalq` เกณฑ์ 90%
- ภาวะเตี้ยใช้ `result1_q/target1_q`; ไม่ใช้ result3_q ซึ่งเป็นสูงตามเกณฑ์
- ตรวจพบพัฒนาการสงสัยล่าช้าใช้ HIGHER_BETTER ≥20 ตามเกณฑ์ HDC
- HT follow-up ใช้ cohort `result_13/target_13` เกณฑ์ HDC ปัจจุบัน 80%; ไม่ใช้ยอด cohort ทั้งปีแทน

รายเดือน/ไตรมาสคำนวณเมื่อมีฟิลด์จริงเท่านั้น ข้อมูลขาด, ตัวหาร 0, และ N/A เป็นคนละสถานะ รายไตรมาสบางรายการเป็นจำนวนการประเมินรวมหลายไตรมาส ไม่ใช่คนไม่ซ้ำทั้งปี NCD ใช้รายเก่าสูงสุดในปี + รายใหม่สะสมตามสูตรเดิม ผลรวมหลายโรคไม่ใช่จำนวนบุคคลไม่ซ้ำ

## Hospital Profile และสิทธิ์

15 ตาราง: hp_facilities, hp_facility_profiles, hp_population, hp_staff, hp_volunteers, hp_budget_monthly, hp_finance_monthly, hp_ncd_monthly, hp_cd_monthly, hp_service_stats, hp_settings, hp_user_facilities, hp_audit_logs, hp_import_records, hp_data_quality

- PUBLIC อ่านเฉพาะ aggregate; ไม่มีสิทธิ์เขียน
- STAFF แก้เฉพาะ facility ที่ได้รับมอบหมาย
- ADMIN แก้ทุกหน่วยและกำหนดสิทธิ์บัญชีที่มีอยู่
- สิทธิ์อยู่ใน hp_user_facilities; ไม่ใช้ user_metadata
- UPDATE มี USING และ WITH CHECK; ทุกตารางเปิด RLS
- `hp_private` เก็บ permission helpers ที่จำเป็นต้องอ่าน permission table โดยไม่เกิด recursive RLS; มี auth.uid check, empty search_path, revoke PUBLIC/anon, ไม่ exposed ผ่าน Data API
- `hp_save_profile` เป็น SECURITY INVOKER RPC บันทึก population/staff/volunteers/profile ใน transaction เดียว
- Audit trigger เก็บก่อน/หลังการเปลี่ยนแปลง; public อ่าน Audit Log ไม่ได้

ใช้บัญชี Supabase เดิมของ med-device-sharing ผู้ดูแลเดิม 2 บัญชีที่ active ถูกตั้งสิทธิ์ ADMIN สำหรับ Hospital Profile บุคลากรต้องได้รับมอบหมายจากผู้ดูแลผ่านหน้าจัดการข้อมูล รหัสผ่าน Google Apps Script เดิมไม่ได้ย้ายหรือคัดลอก; ระบบเดิมยังใช้บัญชีเดิมได้

## ประเด็นข้อมูลที่ต้องตรวจโดยเจ้าของข้อมูล

- แผนเงินบ้านฟ่อน 194,062.45 บาทซ้ำกับแผน 2,700,000 บาทและตรงกับยอดจ่ายเดือน ส.ค. 2569: เก็บทุกแถว แต่แผนซ้ำสถานะ pending ไม่นับในยอดที่ยืนยันแล้ว
- ข้อมูลแผนรายปีและข้อมูลพื้นฐานไม่ระบุปี: อนุมาน FY2569 จากชุดรายเดือน และบันทึกที่มาไว้ใน hp_settings
- ไม่มีวันที่อัปเดตต้นทาง Hospital Profile: แสดงไม่ระบุ ไม่เอาเวลาย้ายข้อมูลมาแทน
- ไม่มีข้อมูลบุคลากรแยกวิชาชีพ/ที่อยู่ละเอียดใน public getAllDatabase: เก็บค่ารวมจริงและเปิดกรอกเพิ่มเติม
- HDC OPD/ทันตกรรม FY2569 มีข้อมูล 7/8 หน่วย; ศบส.เขลางค์นครแสดงไม่มีข้อมูล จนกว่าต้นทาง HDC จะมีข้อมูล
- ไม่พบ dataset แพทย์แผนไทยและกายภาพที่ยืนยันได้ใน source เดิมที่ตรวจ: ไม่สร้างตัวเลขจำลอง สามารถบันทึก aggregate ใน hp_service_stats

## พัฒนาและทดสอบ

ต้องใช้ Node.js 22+ และ PHP 7.3+ สำหรับ analyzer ประกอบ ไม่ต้องติดตั้ง npm package สำหรับ production

```
npm test
node scripts/sync-hdc.mjs
npm run build
npm run dev
```

Preview http://127.0.0.1:4173 เปิดจาก dist allowlist เท่านั้น ไม่เสิร์ฟ backups, SQL, script tools หรือไฟล์ตั้งค่า private

UI test ใช้ Playwright ที่ติดตั้งไว้ในเครื่องและ Chrome/Edge: `node scripts/ui-check.mjs` มี desktop, mobile 390 px, ทุกหน้า, drawer, modal, 7/8 filter, hash reload, public login form ทดสอบ production โดยตั้ง TEST_URL

RLS test อยู่ใน `docs/rls-tests.sql`: ทดสอบ STAFF/ADMIN/anon ใน transaction แล้ว rollback ไม่ทิ้ง test records

## Deployment และความปลอดภัย

GitHub Pages ใช้ workflow `.github/workflows/pages.yml` ไม่ใช้ Sites hosting ตั้ง source เป็น GitHub Actions Build เลือกเฉพาะ index.html/assets/src/data snapshot; ไม่มี backend secret หรือ service_role ใน public build Browser มีเฉพาะ publishable key

GitHub Actions GITHUB_TOKEN มี contents:read/pages:write/id-token:write ไม่ใช้ credential จากเครื่องทำงาน ไม่มี production .env ใน Git การสำรอง Google Sheets และไฟล์ CSV อยู่ใน backups/ ที่ .gitignore กันไว้

ดูรายงานงานและข้อจำกัดที่ `docs/implementation-report.md`
