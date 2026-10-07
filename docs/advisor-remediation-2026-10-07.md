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

## ยังเหลือ
Leaked Password Protection Disabled: connector ที่เชื่อมมี SQL/DDL/advisors แต่ไม่มี Auth configuration endpoint และแท็บ Dashboard ยังไม่ได้ Login
ต้อง Login Supabase Dashboard เพื่อตรวจแผนและเปิดใช้ใน Attack Protection/Password Security ฟังก์ชันนี้รองรับ Pro ขึ้นไป ไม่อัปเกรดแผนหรือเพิ่มค่าใช้จ่ายเอง
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
ไม่ใช่เหตุผลที่จะปิด RLS หรือลดความปลอดภัยเพื่อซ่อนคำเตือน และไม่ได้ยืนยันว่าบัญชีบุคลากรทุกบัญชี Login สำเร็จด้วยรหัสจริง เพราะไม่ได้รับรหัสผู้ใช้จริงมาทดสอบ

## INFO ที่คงไว้
Unused index ไม่ใช่คำเตือนที่ทำให้ Login ล้มเหลว จึงไม่ลบ index ที่ใช้รองรับ ownership/FK
คำแนะนำ/INFO ของตารางระบบอื่นคงไว้ตามขอบเขตโปรเจกต์
