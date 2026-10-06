# บัญชีเฉพาะ Hospital Profile — Ver.1.9

ADMIN เปิด **จัดการข้อมูล → สร้างบัญชีเฉพาะ Hospital Profile** กรอกชื่อ อีเมล รหัสผ่านอย่างน้อย 12 ตัวอักษร และเลือก STAFF/หน่วยบริการ หรือ ADMIN ทุกหน่วยภายในเว็บนี้ บัญชีใหม่เข้าสู่ระบบด้วยอีเมลและรหัสผ่านนี้

กด **โหลดรายชื่อบัญชีเว็บนี้** เพื่อดูเฉพาะบัญชีที่สร้างผ่านส่วนนี้ และตั้งรหัสผ่านใหม่ได้ ไม่แสดงบัญชีร่วมเดิม และ backend ปฏิเสธการ reset บัญชีร่วม แม้ส่งคำขอเอง

ใช้ Auth ของ Supabase เดิมแต่แยก **สิทธิ์ข้อมูล**: บัญชีใหม่มี app_metadata.hp_only=true (กำหนดโดย backend เท่านั้น) และ profiles.active=false ตาม trigger เดิม สิทธิ์เว็บนี้เก็บใน hp_user_facilities จึงไม่ให้สิทธิ์ STAFF/ADMIN ของระบบยืมอุปกรณ์ เพิ่ม trigger hp_only_profile_scope เพื่อห้ามเปิด profiles.active=true สำหรับบัญชีที่ทำเครื่องหมายไว้ บัญชีร่วมเดิมไม่ถูกเปลี่ยนรหัสผ่านหรือสิทธิ์

Edge Function hp-accounts ตรวจ access token กับ Supabase Auth ทุกคำขอ แล้วตรวจสิทธิ์ ADMIN จาก hp_user_facilities ก่อนเรียก Admin Auth API ไม่รับ role จาก user_metadata และไม่ส่ง server key ให้ frontend verify_jwt gateway ปิดเฉพาะ function นี้เพราะตรวจ token และ ADMIN ใน function body รองรับ signing key ใหม่ ไม่ได้ปิด Auth ของ project

เก็บ audit การสร้าง/ตั้งรหัสผ่านใหม่ โดยไม่บันทึกรหัสผ่าน ไม่ส่งรหัสผ่านทางอีเมล ไม่เก็บรหัสผ่านใน hp_* ถ้าการมอบหมายสิทธิ์ล้มเหลวจะลบบัญชีที่เพิ่งสร้างเพื่อไม่ทิ้งบัญชีครึ่งสมบูรณ์ ไม่มีตารางใหม่ รวม hp_* ยังคง 15 ตาราง

การจำกัดนี้คือสิทธิ์ข้อมูล/การจัดการของเว็บ ไม่ได้แยกฐาน Auth เป็นอีก project และการเปิดหน้าเว็บสาธารณะของระบบอื่นยังเป็นไปตามสิทธิ์ Public ของระบบนั้น

ทดสอบ: 29 unit/integration tests, SQL transaction rollback จำลองบัญชี HP-only ให้แก้เฉพาะหน่วยได้ ห้ามอ่าน equipments/borrowers/borrow_logs และห้ามเปิดสิทธิ์อื่น; browser fixture สร้างบัญชี/ตั้งรหัสผ่านใหม่/มือถือ; deployed Edge Function ปฏิเสธ unauthenticated/invalid token ไม่ได้สร้างบัญชีจริงให้บุคคลหรือทดสอบรหัสผ่าน ADMIN จริงเนื่องจากไม่ได้รับบัญชีทดสอบ
