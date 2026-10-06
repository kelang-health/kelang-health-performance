# รายงาน Kelang Health Performance

วันที่ดำเนินการ: 6 ตุลาคม 2569

เว็บไซต์เป้าหมาย: [Kelang Health Performance](https://kelang-health.github.io/kelang-health-performance/)

Repository: [kelang-health/kelang-health-performance](https://github.com/kelang-health/kelang-health-performance)

## Phase 1 — Discovery: เสร็จ

ตรวจ HDC App แบบอ่านอย่างเดียว พบระบบ PHP, API Open Data MOPH ไม่มี secret สำหรับรายงานที่ใช้, จังหวัด 52, master พื้นที่ 06116–06122, report catalog/นิยาม/ตัววิเคราะห์/แคช 15 นาที และโค้ดเดิมที่ปิด TLS verification ระบบใหม่เปิด TLS verification ตามมาตรฐาน fetch และไม่โหลด config เดิมที่ผูก session กับระบบอื่น

ตรวจ Hospital Profile repository ครบ 4 ไฟล์ พบ Vanilla JS/Bootstrap/Chart.js และ GAS backend อ่าน Google Sheets, session token, login, CRUD money/NCD/CD, profile editing, monthly finance pivot, NCD max-old+new, CD trend, rate per 100,000 และ UI permissions ไม่มี GAS backend source ใน repository

สำรอง CSV และผล getAllDatabase ที่ `backups/` ในเครื่อง ตรวจเงิน CSV กับผลต้นทางจำนวน 89 แถว พบ 1 แผนซ้ำที่ต้องทบทวน ไม่เปลี่ยน source production

เพิ่ม: docs, backups ที่ไม่ commit, source clone แยก `kelang-health-performance-source`, vendor/hdc analyzer และนิยามประกอบ

แก้ไฟล์ระบบเดิม: ไม่มี

ฐานข้อมูล: ขั้นนี้อ่าน schema และ Advisor เดิมเท่านั้น

## Phase 2 — Core: เสร็จ

สร้างโครงการแยก `D:\AppServ\www\kelang-health-performance`, Git branch `codex/initial-implementation`, master facility/KPI, responsive shell, hash navigation, adapter HDC/Supabase, caching, bounded retry, timeout/AbortController, Promise.allSettled, script build ที่เลือกเฉพาะไฟล์สาธารณะ

เพิ่ม: index.html, assets/, src/config/, src/api/, src/utils/, src/charts/, package.json, .gitignore, .env.example, scripts/build.mjs, scripts/serve.mjs

ผล: ตัวเลือก AREA มี 7 แห่ง SERVICE 8 แห่ง ค่า 0/null/N/A แยกกันและ October rollover ผ่าน

## Phase 3 — HDC Dashboard: เสร็จสำหรับ 26 ตัวชี้วัดหลัก

สร้างภาพรวม, AREA, SERVICE, Ranking, Heatmap drilldown, Trend รายเดือน/ไตรมาส/ปีก่อน, เปรียบเทียบ 2–8 แห่ง, CSV export และหน้าคุณภาพข้อมูล ตรวจ definition API ของ 26 รายการและทำ snapshot FY2568–2570

เพิ่ม: src/app.js, src/config/kpi-master.json, src/config/report-inventory.json, scripts/sync-hdc.mjs, scripts/verify-master.mjs, scripts/finalize-master.mjs, docs/official-kpi-definitions.json, docs/hdc-validation.json

ผล: FY2569 ตัวชี้วัด AREA 24 รายการมีค่าครบ 7 หน่วย; SERVICE 2 รายการมีข้อมูล 7/8 หน่วย ที่ 45030 ไม่มีข้อมูลจาก HDC จะแสดง — ไม่สร้าง 0

ปัญหาที่พบและแก้: สูตร DM Control, สูงดีสมส่วน, ภาวะเตี้ย, ทิศทาง child development detection และ cohort/เกณฑ์ HT follow-up; รายละเอียดใน README

ทะเบียนนิยาม HDC เดิม 101 รายการยังเข้าถึงลิงก์นิยามได้ รายการนอก 26 KPI หลักยังไม่ถูกนำมาประเมินใน dashboard เพื่อไม่เดา scope/สูตร

## Phase 4 — Hospital Profile: เสร็จ

ย้ายข้อมูล aggregate เข้า med-device-sharing ในตาราง hp_* แยกจากระบบยืมอุปกรณ์ ไม่มีการแก้ไขตารางระบบเดิม และไม่สร้าง Supabase project เพิ่ม

| ข้อมูล | จำนวนต้นทาง | จำนวนที่เก็บ |
|---|---:|---:|
| ข้อมูลพื้นฐาน | 8 | 8 profiles/population/staff/volunteers |
| การเงิน | 89 | 9 แผน + 80 ยอดจ่าย |
| NCD | 157 | 157 |
| โรคติดต่อ | 44 | 44 |
| Settings | 14 | 14 + migration provenance |

hp_import_records เก็บ raw 304 แถวของ money/NCD/CD/settings; raw ข้อมูลพื้นฐานอยู่ใน profile/population/staff/volunteers จึงรักษาข้อมูลต้นทางครบ

15 ตารางเพิ่ม:

`hp_facilities`, `hp_facility_profiles`, `hp_population`, `hp_staff`, `hp_volunteers`, `hp_budget_monthly`, `hp_finance_monthly`, `hp_ncd_monthly`, `hp_cd_monthly`, `hp_service_stats`, `hp_settings`, `hp_user_facilities`, `hp_audit_logs`, `hp_import_records`, `hp_data_quality`

มี RLS ทุกตาราง, Public SELECT aggregate เท่านั้น, STAFF ตาม assignment, ADMIN ทุกหน่วย, UPDATE USING + WITH CHECK, private permission functions, audit trigger และ SECURITY INVOKER hp_save_profile RPC สำหรับบันทึก profile หลายตารางแบบ atomic

SQL ที่ใช้: docs/schema.sql, docs/profile-rpc.sql, docs/audit-permissions.sql, docs/policy-performance.sql

ข้อมูลปีพื้นฐาน/แผนรายปีอนุมาน FY2569 จากชุดเดือนเก่าเพราะต้นทางไม่ให้ปี เก็บหมายเหตุไว้ใน provenance ไม่ใช้เวลานำเข้าเป็น source_updated_at

แผนบ้านฟ่อน 194,062.45 บาทเก็บ pending, ไม่รวมยอดยืนยันแล้วจนกว่าจะตรวจสอบ ยอดยืนยันแล้ว 18,891,173.00 บาท ยอดเบิกจ่าย 8,646,658.98 บาท ประชากรพื้นที่ 51,561 คน

บัญชี Supabase ADMIN เดิมที่ active 2 บัญชีใช้ระบบใหม่ได้; บัญชี Staff ต้องได้รับ assignment ในหน้าจัดการข้อมูล ไม่ย้ายรหัสผ่าน GAS ไม่ตั้งรหัสผ่านใหม่ให้เอง

## Phase 5 — Integration: เสร็จ

ข้อมูลรายหน่วยรวม resource/population/finance/NCD/CD/HDC ในหน้าจอเดียว หน้าภาพรวมไม่บวกประชากร 45030, comparison แสดงตัวตั้ง/ตัวหารและแยกหน่วย N/A, finance pivot แยกปีและแปลง พ.ศ./ค.ศ. แก้ปัญหาการรวมเดือนข้ามปีของระบบเดิม

Admin/Staff เพิ่ม แก้ ลบข้อมูลและกรอกวิชาชีพ/บริการอื่นได้ พร้อม export/audit ใช้ Supabase เป็นแหล่งจริงสำหรับการบันทึกใหม่

## Phase 6 — Quality: เสร็จ

- Unit/integration tests: 19 ผ่าน ครอบคลุม 7/8, weighted average/ranking, 0/null/N/A, denominator 0, fiscal rollover, source field mappings, bounded endpoint failure และ stale cache date
- Browser checks: 31 ผ่าน บน Edge headless เดสก์ท็อป 1440 px / มือถือ 390 px ทุก 12 หน้าหลัก, modal, drawer, filter, reload hash route และ login form
- RLS live SQL: STAFF own edit ผ่าน; other facility edit/reassignment/escalation ถูกปฏิเสธ; atomic profile RPC ผ่าน; ADMIN 8 units ผ่าน; PUBLIC read-only และห้าม save RPC ผ่าน; ทดสอบใน transaction rollback
- ไม่มี JavaScript console error ในชุด UI test หลังใช้ scheduled HDC snapshot
- Mobile ไม่มี document horizontal overflow; ตารางกว้างเลื่อนภายในกล่องได้
- Build ไม่มี secret/service_role/private key; frontend มีเฉพาะ publishable key
- ตรวจ Advisor ก่อน/หลัง: ไม่มี Security finding ใหม่บน hp_*; warning เดิม leaked-password protection disabled และ INFO no-policy ในตารางระบบอื่นยังอยู่
- แก้ multiple-permissive-policy warnings ที่เกิดบน hp_* โดยแยก INSERT/UPDATE/DELETE; เพิ่ม FK indexes และลด index ซ้ำกับ UNIQUE

ข้อจำกัดของการตรวจ: ทดสอบสิทธิ์ database จริงและ RPC จริงแบบ rollback แต่ไม่ได้เข้าสู่ระบบเบราว์เซอร์ด้วยรหัสผ่านของผู้ใช้งานจริง เพราะไม่ได้รับรหัสผ่าน ทดสอบฟอร์ม login และเส้นทาง Public แล้ว

## Phase 7 — Production: กำลังตรวจ deployment ครั้งแรก

ตั้ง GitHub Pages source เป็น GitHub Actions, workflow test/build/sync/deploy, schedule 06:00 น. ประเทศไทยทุกวัน ต้องตรวจ run สำเร็จและ production browser ก่อนยืนยันขั้นนี้

## Architecture และ endpoints

HDC MOPH → payload/report mappings จาก HDC App → GitHub Actions scheduled public aggregate snapshot → Static web

Hospital Profile Google Sheets/GAS → สำรองและ migration → Supabase med-device-sharing hp_* → Static web

HDC ไม่เก็บใน Supabase และไม่ใช้ credentials ของระบบ PHP เดิม Browser ไม่ดึงทุก endpoint HDC เพื่อหลีกเลี่ยง rate limit

Endpoints: `POST https://opendata.moph.go.th/api/report_data` (tableName/year/province/type/limit/offset), `GET https://api-center-hdc.moph.go.th/v1/report-public/detail` (นิยาม), Supabase `/rest/v1/hp_*`, `/rest/v1/rpc/hp_save_profile`, `/auth/v1/token`, `/auth/v1/logout`

## KPI ที่รองรับ

AREA 24 รายการ: DM screening 35+, HT screening 35+, DM control, HT control, HT confirmation follow-up, vaccine complete age 1, ANC 5 visits, ANC ≤12 weeks, postnatal 3 visits, low birthweight, child development screening, suspected delay detection, delay follow-up, healthy height age 0–5, iron age 6mo–5yr, iron age 6–12yr, weight-for-age, stunting, obesity, thinness, exclusive breastfeeding, breast screening, elderly ADL, elderly 9-domain screening

SERVICE 2 รายการ: OPD visits, dental visits

ข้อมูลบริการอื่นจาก Hospital Profile แสดงแยก source และมีฟอร์มกรอก hp_service_stats; ไม่สร้าง HDC แพทย์แผนไทย/กายภาพเมื่อไม่พบ endpoint ที่ยืนยันใน source

## หน่วย AREA และ SERVICE

AREA 7: 06116 บ้านโทกหัวช้าง, 06117 บ้านฟ่อน, 06118 บ้านศรีหมวดเกล้า, 06119 บ้านกล้วยแพะ, 06120 บ้านกล้วยม่วง, 06121 บ้านกาด, 06122 บ้านแม่กืย

SERVICE 8: AREA ทั้ง 7 + 45030 ศบส.เขลางค์นคร

## Usage และ performance

วัดฐานข้อมูลหลัง migration: ทั้งโครงการ 20,024,467 bytes (~19.10 MiB), ตาราง hp_* รวม indexes/TOAST 1,392,640 bytes (~1.33 MiB)

Storage เดิม 58 objects, 8,760,738 bytes (~8.35 MiB); งานนี้ไม่เพิ่ม Storage object และไม่สร้าง project เพิ่ม

HDC snapshot ประมาณ 0.69 MB, 78 datasets ของ 26 KPI × 3 FY มี analyzer เดิมประกอบ; หน้าเว็บโหลด snapshot เดียวและ Supabase tables แบบ allSettled การดึง API มี timeout, pagination bound, concurrency limit และ cache fallback ภาพ SVG ไม่ใช้ dependency chart library

## งานที่ต้องติดตามจากข้อมูลต้นทาง

1. เจ้าของข้อมูลตรวจแผนเงินบ้านฟ่อนรายการ pending ว่าเป็นแผนเพิ่มจริงหรือบันทึกผิด
2. ผู้ดูแลมอบหมาย Staff และสร้างบัญชี Supabase สำหรับเจ้าหน้าที่ที่ยังไม่มี โดยไม่คัดลอกรหัสผ่าน GAS
3. ยืนยันปีของข้อมูลพื้นฐาน/แผนรายปีที่ต้นทางไม่มีปี และบันทึก source update date เมื่อมี
4. ตรวจการส่ง HDC ของ 45030 เพราะ OPD/ทันตกรรมยังไม่มีข้อมูลใน FY2569
5. ขยายรายงานในทะเบียน 101 รายการเมื่อยืนยัน scope/สูตร และเชื่อมแพทย์แผนไทย/กายภาพเมื่อได้ endpoint จริง
6. หากต้องย้าย Apps Script workflow ที่ไม่ได้อยู่ใน repository เพิ่มเติม ต้องมี source/backend specification เพื่อเทียบครบ

ระบบเดิมยังเปิดได้และไม่ได้ถูกแก้ไขหรือปิด
