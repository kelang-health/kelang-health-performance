import test from 'node:test';
import assert from 'node:assert/strict';
import {missingReadyFields,expectedDocumentRevision} from '../src/staff/document-workflow.js';
import {printableDocument as frozenPrint} from '../src/staff/renderers/1.74/print.js';
import {renderDocumentForm,renderStaffWorkspace} from '../src/staff/documents.js';
const person={id:'p',full_name:'นาย เปลี่ยนชื่อ ใหม่',position_name:'นักวิชาการสาธารณสุข',facility_code:'06116'};
test('ready validation keeps zero attendance distinct from absent attendance',()=>{
 const r={form_code:'chor11_monthly',form_data:{position_name:'พยาบาลวิชาชีพ',work_days:0,leave_days:0,calendar_work_days:0}};
 const missing=missingReadyFields(r);assert.ok(!missing.includes('วันปฏิบัติงาน'));assert.ok(missing.includes('วันที่ยื่น'));assert.ok(missing.includes('ยืนยันวันทำงานและวันลา'));delete r.form_data.work_days;assert.ok(missingReadyFields(r).includes('วันปฏิบัติงาน'));
});
test('revision rejects absent, fractional and unsafe values',()=>{for(const v of ['',0,-1,1.5,'x',Number.MAX_SAFE_INTEGER+1])assert.throws(()=>expectedDocumentRevision(v));assert.equal(expectedDocumentRevision('7'),7);});
test('confirmed renderer preserves captured identity despite changes to personnel master',()=>{
 const record={form_code:'chor11_monthly',status:'ready',period_month:'2026-10-01',form_data:{full_name:'นาย เก็บชื่อ เดิม',applicant_first_name:'นาย เก็บชื่อ',applicant_last_name:'เดิม',facility_name:'ศูนย์บริการสาธารณสุขเดิม',position_name:'พยาบาลวิชาชีพ'}};
 const html=frozenPrint(record,{person,facility:{facility_name:'หน่วยเปลี่ยนใหม่'}});assert.match(html,/เก็บชื่อ/);assert.doesNotMatch(html,/เปลี่ยนชื่อ|หน่วยเปลี่ยนใหม่/);assert.match(html,/assets\/fonts\//);
});
test('confirmation requires an explicit manager option and carries original revision',()=>{
 const options={person,fiscalYear:2570,record:{id:'d',revision:4,form_data:{}}};
 assert.doesNotMatch(renderDocumentForm('chor11_monthly',options),/name="review_confirmed"/);
 const html=renderDocumentForm('chor11_monthly',{...options,canConfirm:true});assert.match(html,/name="review_confirmed"/);assert.match(html,/name="expected_revision" value="4"/);
});
test('issued annual history stays accessible and cannot be purged from the workspace',()=>{
 const html=renderStaffWorkspace({person,fiscalYear:2570,documents:[{id:'d',personnel_id:'p',form_code:'chor11_annual',fiscal_year:2570,status:'ready',issue_count:1,updated_at:'2026-10-11'}]});assert.match(html,/data-staff-history="d"/);assert.doesNotMatch(html,/data-staff-purge/);
});
