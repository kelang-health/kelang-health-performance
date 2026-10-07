import test from 'node:test';
import assert from 'node:assert/strict';
import {
  staffFormTemplates,
  templateByCode,
  renderStaffWorkspace,
  renderDocumentForm,
  printableDocument
} from '../src/staff/documents.js';

const person={id:'p1',full_name:'นางสาว ตัวอย่าง ทดสอบ',position_name:'พยาบาลวิชาชีพ',position_level:'ชำนาญการ',employment_type:'ข้าราชการ',facility_code:'06118'};
const facility={facility_code:'06118',short_name:'ศบส.ตัวอย่าง'};

test('imports five legacy template capabilities but enables only the first two in this phase',()=>{
  assert.equal(staffFormTemplates.length,5);
  assert.equal(templateByCode('chor11_annual').version,'2569.1');
  assert.equal(templateByCode('chor11_monthly').effectiveFrom,'2025-10-01');
  assert.equal(staffFormTemplates.filter(t=>t.available).length,2);
});

test('annual form excludes citizen id and birth date inputs',()=>{
  const html=renderDocumentForm('chor11_annual',{person,facility,fiscalYear:2569});
  assert.match(html,/แบบ/);
  assert.doesNotMatch(html,/citizen_id|birth_date|date_of_birth|วันเกิด|เลขบัตรประชาชน/i);
  assert.match(html,/เลขใบอนุญาต/);
  assert.match(html,/ที่อยู่ติดต่อ/);
});

test('monthly form provides month, amount, work and leave fields',()=>{
  const html=renderDocumentForm('chor11_monthly',{person,facility,fiscalYear:2569});
  assert.match(html,/name="period_month"/);
  assert.match(html,/name="total_amount"/);
  assert.match(html,/name="work_days"/);
  assert.match(html,/name="leave_days"/);
});

test('workspace shows annual deletion control only when annual data exists',()=>{
  const doc={id:'d1',form_code:'chor11_annual',template_version:'2569.1',fiscal_year:2569,status:'ready',form_data:{},updated_at:'2026-10-07T00:00:00Z'};
  const html=renderStaffWorkspace({documents:[doc],person,facility,fiscalYear:2569});
  assert.match(html,/ล้างข้อมูลของฉัน/);
  assert.match(html,/ทะเบียนแบบพิมพ์ที่นำมาใช้/);
  assert.match(html,/ใบลาป่วย/);
});

test('print document produces A4-friendly HTML without inline print handler',()=>{
  const html=printableDocument({form_code:'chor11_monthly',fiscal_year:2569,period_month:'2025-10-01',form_data:{full_name:person.full_name,position_name:person.position_name,facility_name:facility.short_name,monthly_rate:2000,total_amount:2000}});
  assert.match(html,/@page\{size:A4/);
  assert.match(html,/id="print-button"/);
  assert.doesNotMatch(html,/onclick=/);
});
