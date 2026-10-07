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
  assert.match(source,/function staffPortal()/);
  assert.match(source,/if(!currentSession())return panel('สำหรับเจ้าหน้าที่'/);
  assert.match(source,/id="staff-login"/);
  assert.match(source,/ยังไม่แสดงรายชื่อบุคลากร เอกสาร หรือข้อมูลส่วนตัวก่อนเข้าสู่ระบบ/);
});

test('staff login returns to staff portal after authentication',()=>{
  assert.match(source,/function openLogin(returnRoute='manage')/);
  assert.match(source,/if(b.id==='staff-login'){openLogin('staff');return;}/);
  assert.match(source,/const destination=state.loginReturnRoute||'manage'/);
  assert.match(source,/state.route=destination;location.hash=destination;state.loginReturnRoute=null/);
});

test('staff portal reserves compensation and leave services without exposing forms yet',()=>{
  assert.match(source,/แบบคำขอรับเงินค่าตอบแทนประจำปี/);
  assert.match(source,/ใบขอรับเงินเบี้ยเลี้ยงเหมาจ่ายรายเดือน/);
  assert.match(source,/พื้นที่สำหรับยื่นใบลา ตรวจสถานะ และดูประวัติการลาในอนาคต/);
});
