# ADMIN จัดการข้อมูลวันลา — 1.87

ADMIN มีปุ่มแก้ไขทุกสถานะในส่วนการลาและวันทำการ ภายใต้หน้าเจ้าหน้าที่ เมื่อแก้รายการ approved/rejected/cancelled ระบบคงสถานะเดิม คงข้อมูลอ้างอิงการอนุมัติ ชื่อผู้อนุมัติ และวันที่อนุมัติไว้ ไม่เปลี่ยนกลับ pending โดยอัตโนมัติ

ข้อจำกัดเดิมเรื่องตัวบุคคล หน่วย ปีงบประมาณ ช่วงวันที่ วันซ้อน และปฏิทินยืนยันก่อนใช้ผลอนุมัติยังคงอยู่ STAFF/ผู้ใช้ทั่วไปยังแก้รายการที่รอผลได้ตามสิทธิ์เดิม แต่แก้รายการปิดแล้วไม่ได้

ปุ่มลบแสดงเฉพาะ ADMIN และเฉพาะ status=cancelled ต้องยืนยันผู้ลาและช่วงวันที่ก่อนส่ง DELETE ด้วย id+revision+status กันลบข้อมูลที่มีผู้เปลี่ยนก่อน หน้าเว็บโหลดทะเบียนและสรุปใหม่หลังลบ

ฐานข้อมูลให้ DELETE ผ่าน policy is_admin AND cancelled พร้อม trigger ตรวจซ้ำ ไม่มีการลบข้อมูลจริงระหว่างการพัฒนา มีเพียง fixture ใน transaction แล้ว ROLLBACK การใช้งานจริงลบแถวออกจากทะเบียน แต่เก็บข้อมูลก่อนลบไว้ใน hp_audit_logs ที่ควบคุมสิทธิ์อยู่แล้ว ไม่เพิ่มตาราง

Cloud test: supabase/tests/admin_leave_maintenance.sql ตรวจ ADMIN แก้ approved/cancelled, STAFF ถูกปฏิเสธการแก้ closed/ลบ, ADMIN ลบ approved ไม่ได้, revision เก่าลบไม่ได้ และมี snapshot ก่อนลบใน audit

UI fixture: scripts/admin-leave-ui-check.mjs ตรวจแก้ approved คง status/reference และ ADMIN ลบ cancelled พร้อมยืนยัน ส่วน STAFF ไม่มีปุ่มแก้ปิด/ลบ Unit tests รวม 161 tests ผ่าน
