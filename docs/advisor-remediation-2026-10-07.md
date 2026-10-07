# แก้คำเตือน Advisors — 7 ตุลาคม 2569 / รุ่น 1.28

## เสร็จแล้ว
- แยก hp_personnel_admin_write (ALL) เป็น INSERT, UPDATE, DELETE ที่ยังใช้ hp_private.is_admin() เดิม
- แยก hp_personnel_account_write (ALL) เช่นเดียวกัน
- คง read policies เดิม จึงไม่เพิ่ม/ลดผู้มีสิทธิ์ ไม่เปลี่ยนบัญชีหรือรหัสผ่าน และไม่แก้/ลบข้อมูลจริง
- Migration: supabase/migrations/20261007104911_hp_personnel_separate_admin_write_policies.sql
- Advisors หลังแก้ไม่มี multiple_permissive_policies WARN ทั้งสองรายการ
- เปรียบเทียบ digest ของชุดข้อมูลที่อ่านได้ก่อน/หลังด้วย authenticated ที่ไม่มีสิทธิ์, linked owner, ADMIN: ตรงกันทั้งหมด
- SQL ตรวจซ้ำ: supabase/tests/personnel_policy_visibility.sql
- Tests 74/74, build ผ่าน, RLS เอกสาร 12 กรณีผ่านและ rollback

## Auth เสร็จแล้ว
ผู้ดูแลเข้าสู่ Dashboard แล้ว พบแผน PRO เปิด Prevent use of leaked passwords ใน Email provider และบันทึกสำเร็จ ตรวจหน้า Attack Protection แสดง ENABLED
ไม่เปลี่ยนรหัสผ่าน บัญชี วิธี Login ข้อกำหนดความยาวรหัส หรือ Email confirmation
คำเตือน Auth Leaked Password Protection Disabled หายจาก Advisors แล้ว
Security และ Performance ไม่เหลือระดับ WARN/ERROR; เหลือ INFO ของ index/ตารางระบบอื่น
การตั้ง/เปลี่ยนรหัสใหม่จะปฏิเสธรหัสที่เคยรั่วไหล การตรวจนี้ใช้ร่วมทุกแอปที่ใช้ Supabase Auth ของโครงการนี้
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
ภาพยืนยันเก็บเฉพาะเครื่อง artifacts/advisors/leaked-password-protection-enabled.png ไม่เผยแพร่ใน GitHub Pages
Deploy เว็บ 1.28: GitHub Actions run 37610049451 success

## INFO ที่คงไว้
Unused index ไม่ใช่คำเตือนที่ทำให้ Login ล้มเหลว จึงไม่ลบ index ที่ใช้รองรับ ownership/FK
คำแนะนำ/INFO ของตารางระบบอื่นคงไว้ตามขอบเขตโปรเจกต์
