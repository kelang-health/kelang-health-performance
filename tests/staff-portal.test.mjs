import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8');

test('staff menu is placed before data management',()=>{
  const staff=source.indexOf("['staff','♙','สำหรับเจ้าหน้าที่']");
  const manage=source.indexOf("['manage','⚙','จัดการข้อมูล']");
  assert.ok(staff>=0,'staff route should exist');
  assert.ok(manage>staff,'staff route should be before manage');
});

test('staff portal is visible but gated by login',()=>{
  assert.ok(source.includes('function staffPortal()'));
  assert.ok(source.includes("if(!currentSession())return panel('สำหรับเจ้าหน้าที่'"));
  assert.ok(source.includes('id="staff-login"'));
  assert.ok(source.includes('ยังไม่แสดงรายชื่อบุคลากร เอกสาร หรือข้อมูลส่วนตัวก่อนเข้าสู่ระบบ'));
});

test('staff login returns to staff portal after authentication',()=>{
  assert.ok(source.includes("function openLogin(returnRoute='manage')"));
  assert.ok(source.includes("if(b.id==='staff-login'){openLogin('staff');return;}"));
  assert.ok(source.includes("const destination=state.loginReturnRoute||'manage'"));
  assert.ok(source.includes("if(destination==='staff')await loadStaffDocuments()"));
});

test('staff portal loads and manages data-backed documents',()=>{
  assert.ok(source.includes("rest('hp_staff_documents'"));
  assert.ok(source.includes("data-staff-new"));
  assert.ok(source.includes("data-staff-print"));
  assert.ok(source.includes("data-staff-purge"));
  assert.ok(source.includes("documentPayload(form"));
});
