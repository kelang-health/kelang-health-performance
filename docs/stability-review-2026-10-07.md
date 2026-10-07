# รายงานตรวจระบบและความเสถียร — รุ่น 1.27

ตรวจวันที่ 7 ตุลาคม 2569

## ปัญหาที่พบและแก้
1. การอ่านหลายตารางพร้อมกันอาจต่ออายุ session ด้วย refresh token เดียวหลายครั้ง: รวมเป็นหนึ่งคำขอร่วมกัน และไม่รับผลเก่าหลังออกจากระบบ/เปลี่ยน session
2. เมื่อเครือข่ายต่ออายุ session ขัดข้อง ไม่ล้าง refresh token ที่ยังใช้กู้คืนได้; หาก access token หมดอายุจะหยุดคำขอและให้ลองใหม่ เมื่อ refresh token ถูกปฏิเสธ 400/401/403 จึงล้าง session
3. ออกจากระบบล้าง session ในเครื่องทันที แม้ API logout ขัดข้อง และล้างสิทธิ์/รายการเอกสาร/ข้อมูลบุคลากรในหน้าเว็บ การยกเลิก session ฝั่งเซิร์ฟเวอร์ยังต้องอาศัยการเชื่อมต่อ
4. หน้าเจ้าหน้าที่เดิมเก็บข้อความโหลดผิดพลาดแต่ไม่แสดง ทำให้เข้าใจว่าไม่มีรายการ: แสดง error และปุ่มลองโหลดอีกครั้ง โดยไม่แสดงปุ่มสร้างเมื่อยังอ่านรายการไม่ได้
5. ไฟล์ snapshot HDC ล้มเหลวเคยทำให้ข้าม cache เดิม และจำ Promise ที่ล้มเหลวตลอด: ใช้ cache ของปี/ตารางนั้น พร้อม stale/error และลองอ่านไฟล์ใหม่ในคำขอถัดไป
6. การอ่านสิทธิ์ล้มเหลวจะปิดสิทธิ์แก้ไขและแจ้งปัญหา โดยไม่หยุดการอ่าน HDC ทั้งหน้า

## ผลทดสอบ
- npm test 73/73 ผ่าน รวม 7 กรณีจำลอง refresh พร้อมกัน, logout ขณะ refresh, token ถูกปฏิเสธ, outage/recovery และ HDC snapshot outage/recovery
- npm run build ผ่าน ไม่มี secret ใน public build ตามตัวตรวจ build
- Browser Edge/Chromium: หน้า overview/finance/ncd/cd/unit/06116/team/staff/manage ที่ viewport 1440, 390, 768 พิกเซล รวม 21 กรณี ไม่พบ JavaScript pageerror, หน้าว่าง หรือหน้ากว้างเกิน viewport
- Browser fixture Login: hp_staff_documents ตอบ 503 แสดง error ไม่มีปุ่มสร้าง -> ลองโหลดใหม่สำเร็จ -> logout ล้าง controls เอกสาร
- RLS ฐานจริงผ่าน 12 กรณีใน transaction แล้ว rollback ไม่มีรายการทดสอบค้าง ไม่ลบข้อมูลจริง
- hp_staff_documents เปิด RLS และมี 4 policies; ก่อนทดสอบ 0 รายการ ขนาดรวม index ประมาณ 144 KiB ไม่ใช่ขนาดทั้งโปรเจกต์
- ไม่มี schema/RLS migration ในรอบนี้ และไม่เพิ่มตาราง

## Advisors
ไม่มี security finding ของ hp_staff_documents
Auth เดิมยังมี Leaked Password Protection Disabled:
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
Performance: index เอกสารยัง unused ระดับ INFO; personnel/accounts มีหลาย permissive SELECT policy เดิม ระดับ WARN ไม่เปลี่ยนตารางอื่น:
https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies

## ขอบเขตผลตรวจ
เป็นการตรวจการทำงานและจำลองเครือข่ายล้มเหลว ไม่ใช่การทดสอบผู้ใช้จำนวนมากพร้อมกันหรือรับรอง uptime ตลอดเวลา
Login fixture ใช้ข้อมูลจำลอง ไม่ใช้รหัสผ่านบุคลากรจริง; สิทธิ์ตรวจด้วย SQL role/claims และ rollback
PC/มือถือ/แท็บเล็ตทดสอบด้วยขนาด viewport ใน Edge ไม่ได้ทดสอบ Safari/iOS บนอุปกรณ์จริง
เมื่อ Supabase ล่ม การบันทึก/เข้าสู่ระบบยังต้องรอเชื่อมต่อ แต่ข้อมูล HDC ที่มีไฟล์หรือ cache สำรองยังแสดงได้
เมื่อ API logout ล่ม ล้างข้อมูลในเครื่องสำเร็จ แต่การเพิกถอน token ฝั่ง server อาจไม่สำเร็จจนกว่าเชื่อมต่อได้
