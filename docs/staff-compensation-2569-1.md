# สำหรับเจ้าหน้าที่: ค่าตอบแทน รุ่น 2569.1 / เว็บ 1.26

วันที่ตรวจ: 7 ตุลาคม 2569

## การใช้งาน
เข้าสู่เมนู สำหรับเจ้าหน้าที่ แล้ว Login ด้วยบัญชีที่ผูก hp_personnel_accounts เลือกปีงบประมาณด้านบน แยกค่าตอบแทนและสิทธิประโยชน์ กับการลาที่เตรียมเปิดในระยะถัดไป
- ประจำปี: จัดทำ/แก้ไข/พิมพ์/ล้างข้อมูลของฉัน (มี confirm)
- รายเดือน: 1 คนต่อเดือน ตารางเฉพาะปีที่เลือก ไม่มีปุ่มลบ และไม่เขียนทับรายการเดือนเดิมจากปุ่มสร้างใหม่
- พิมพ์ / บันทึก PDF เปิดหน้าต่างใหม่ โหลดฟอนต์ Sarabun ที่เก็บในเว็บก่อนพิมพ์ เลือก A4 ขนาดจริง และปิด header/footer ของเบราว์เซอร์

## เทียบ compensation เดิม
อ่าน print.php, print_monthly.php และ document_templates.php เป็นแหล่ง layout/ถ้อยคำเท่านั้น ไม่แก้ระบบเดิม
ประจำปีใช้หัวเรื่อง เรียน นายกฯ ประเภทค่าตอบแทน 9 ข้อ โดยเลือกเฉพาะเบี้ยเลี้ยงเหมาจ่าย คำรับรอง และช่องความเห็น/ลายเซ็น 5 ส่วน สองหน้า A4
รายเดือนใช้หัวเรื่อง หน่วย เดือน ชื่อ ตำแหน่ง ช่วงทำงาน คำรับรอง และลายเซ็น หนึ่งหน้า A4 เพิ่มตารางอัตรา/วันทำงาน/วันลา/ยอดเบิกตามคำขอ
ไม่มีเลขบัตรประชาชน วันเกิด หรือ verification token ระบบเดิม ไม่มีข้อมูลประวัติการรับราชการ/การฝึกอบรมจากตาราง compensation จึงไม่สร้างข้อมูลส่วนนี้ขึ้นเอง การอนุมัติและลายเซ็นเป็นช่องกรอกบนเอกสาร ไม่มี workflow อนุมัติอิเล็กทรอนิกส์ในระยะนี้
CSS ใช้ฟอนต์ Sarabun (OFL) เพื่อให้ GitHub Pages แสดงเหมือนกัน ไม่เรียก PHP
ข้อความยาวมากอาจทำให้จำนวนหน้าเพิ่ม ควรดูตัวอย่างก่อนพิมพ์

## ฐานข้อมูล
ใช้ public.hp_staff_documents ตารางเดิมเท่านั้น ไม่มีตารางถาวรใหม่ และไม่มีการแก้/ลบข้อมูลจริง
Migration: supabase/migrations/20261007_staff_documents_hardening.sql
- เพิ่ม unique บุคลากร/ปี annual และบุคลากร/เดือน monthly เสริม unique เจ้าของเดิม
- กำหนด template_version 2569.1
- DELETE เฉพาะเจ้าของ annual (ADMIN ไม่ลบ monthly หรือ annual ผู้อื่น)
- คง SELECT เจ้าของหรือ ADMIN, INSERT/UPDATE ตามการผูกบุคลากรเดิม
- guard BEFORE INSERT/UPDATE ตรวจ whitelist JSON ชนิด/ความยาว ค่าตัวเลข วันที่ ช่วงงาน ระยะเวลา และเดือนตรง record
- ห้ามเปลี่ยน owner_user_id/personnel_id/facility_code/form_code
- แทนชื่อ/ตำแหน่ง/ระดับ/ประเภทการจ้าง/หน่วย ด้วย master ฝั่งฐานข้อมูล
- คง check ปีงบประมาณกับเดือน, ขนาด JSON 50KB, ห้าม sensitive keys ที่มีอยู่
- ไม่มี audit ที่คัดลอกข้อมูลส่วนบุคคล ไม่มี service_role ในเว็บ ไม่ใช้ user_metadata ให้สิทธิ์

## ผลตรวจ
npm test: 66/66 ผ่าน; npm run build ผ่าน
RLS ทดสอบ SQL transaction แล้ว rollback: 12 กรณีผ่าน (guest, ADMIN, owner/cross-owner, duplicates, sensitive keys, immutable identity, fiscal mismatch, monthly no-delete, own annual delete)
ไฟล์ supabase/tests/staff_documents_rls.sql ใช้บัญชีที่ผูกจริงสองบัญชีและ ADMIN อ่าน identity ID โดยไม่พิมพ์ข้อมูลบุคคล ต้องมี fixture identity ตามเงื่อนไข และไม่มีเอกสารที่ชนปี/เดือน fixture; ใช้บนฐานทดสอบเมื่อมีข้อมูลจริงแล้ว
Browser Edge/Chromium viewport 390x844: guest เห็นเมนูและ Login ไม่เห็น controls เอกสาร; fixture Login เห็นข้อมูลตนเองและเปิดแก้ไขได้ ไม่มีช่อง sensitive
PDF ตัวอย่างไม่ใช้ข้อมูลจริง: annual 2 หน้า, monthly 1 หน้า A4 ตรวจตำแหน่ง footer ไม่มีทับกับเนื้อหา
artifacts/staff-print เก็บ PDF/PNG ตัวอย่างเฉพาะเครื่อง ไม่อยู่ใน deploy allowlist

## Supabase advisors
Security: ไม่มี finding ของ hp_staff_documents; มีคำเตือนเดิม Auth Leaked Password Protection Disabled ไม่เปลี่ยน setting ส่วนกลางที่กระทบระบบอื่น
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
Performance: hp_staff_documents_owner_idx/person_idx/facility_idx รายงาน unused_index ระดับ INFO เพราะยังไม่มีข้อมูลใช้งานจริง จึงคง index สำหรับกรองและ FK
https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index
hp_personnel และ hp_personnel_accounts มี multiple_permissive_policies เดิม ไม่เปลี่ยน RLS ของตารางอื่น
https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies

## งานระยะถัดไป
ใบลา/ใบรับรองวันทำงานไม่เปิดใช้งานตามขอบเขตที่กำหนด ผู้ใช้งานควรตรวจถ้อยคำและยอดเงินก่อนลงนาม เอกสารไม่ได้คำนวณสิทธิ์หรือยอดเบิกอัตโนมัติจากระบบ compensation
