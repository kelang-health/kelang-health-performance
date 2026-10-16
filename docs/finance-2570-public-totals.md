# วงเงินอนุมัติและรายจ่ายปี 2570

หน้า #finance และสรุปการเงินในภาพรวม ใช้วงเงินอนุมัติจากแผนทั้ง 8 หน่วยใน hp_spending_reports โดยเก็บเฉพาะยอดรวมที่เผยแพร่ได้ใน hp_budget_monthly เดิม ไม่เพิ่มตาราง

Trigger หลังการบันทึกรายงานจะเผยแพร่ยอดรวมไป hp_finance_monthly เฉพาะสถานะ confirmed เมื่อเปิดเดือนเป็นร่างยอดเดิมจะเปลี่ยนเป็น pending และไม่นับ เมื่อยืนยันใหม่อัปเดตรายการเดิมไม่เพิ่มซ้ำ เมื่อ deleted เปลี่ยนเป็น rejected

ชื่อรายการ รายละเอียดแผน รายการย่อย หมายเหตุ และตัวเลขในร่างไม่ถูกคัดลอกไปตารางสาธารณะ raw_data ของยอดรวมมีแค่ source=spending_tracker, report_id, revision ใช้ private trigger function แบบ SECURITY DEFINER เพื่อเขียนเฉพาะ projection นี้ ไม่มีสิทธิ์ EXECUTE ให้ PUBLIC/anon/authenticated และตรวจสิทธิ์ผู้ทำรายการผ่าน session+spending_manager ก่อนทำงาน

Trigger ในตารางยอดรวมป้องกันผู้ใช้ authenticated แก้/ลบ/เพิ่มยอดรวมปี 2570 ขึ้นไปเอง ต้องใช้หน้าติดตามแผนใช้เงิน เจ้าของฐานข้อมูลและ service_role ยังทำงานบำรุงรักษาได้ ปี 2569 คง workflow เดิม

ไม่มีรายงานยืนยันแสดง — ไม่แทนด้วยศูนย์ รายงานยืนยันศูนย์แสดง 0.00 คงเหลือคิดจากวงเงินอนุมัติลบเฉพาะยอดที่ยืนยันแล้ว พร้อมคำอธิบายบนหน้าเว็บ

ทดสอบ Cloud ผ่าน transaction แล้ว rollback ใน supabase/tests/spending_public_totals.sql ครอบคลุม draft/confirm/reopen/reconfirm และการห้ามแก้ยอดรวมด้วยมือ
