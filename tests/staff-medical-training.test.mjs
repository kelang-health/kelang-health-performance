import test from 'node:test';
import assert from 'node:assert/strict';
import {isMedicalDoctor} from '../src/staff/medical-training.js';
import {renderDocumentForm} from '../src/staff/documents.js';
import {officialPayload} from '../src/staff/official-fields.js';
import {officialMonthlyBody} from '../src/staff/monthly-official.js';
const stale={training_status:2,training_regional_selected:1,training_regional_facility:'โรงพยาบาลทดสอบ',training_months:99};
test('medical eligibility excludes other professions including Thai medicine and dentistry',()=>{
 for(const title of ['นายแพทย์ ชำนาญการ','แพทย์หญิง','แพทย์ปฏิบัติการ','นพ.','พญ.'])assert.equal(isMedicalDoctor(title),true,title);
 for(const title of ['พยาบาลวิชาชีพ','นักวิชาการสาธารณสุข','แพทย์แผนไทย','ทันตแพทย์','นายสัตวแพทย์','ผู้ช่วยแพทย์แผนไทย',''])assert.equal(isMedicalDoctor(title),false,title);
});
test('non doctor editor locks every training control and retains work history controls',()=>{
 const html=renderDocumentForm('chor11_monthly',{person:{full_name:'ผู้ทดสอบ',position_name:'พยาบาลวิชาชีพ'},record:{form_data:stale}});
 const controls=html.match(/<(?:input|select)\b[^>]*name="training_[^"]+"[^>]*>/g);
 assert.ok(controls.length>10);for(const tag of controls)assert.match(tag,/disabled/);
 assert.match(html,/ตำแหน่งของท่านไม่ต้องกรอก/);assert.doesNotMatch(html,/โรงพยาบาลทดสอบ/);
 assert.doesNotMatch(html.match(/<input[^>]*name="history_0_facility_name"[^>]*>/)[0],/disabled/);
 const doctor=renderDocumentForm('chor11_monthly',{person:{full_name:'แพทย์ทดสอบ',position_name:'นายแพทย์'}});
 for(const tag of doctor.match(/<(?:input|select)\b[^>]*name="training_[^"]+"[^>]*>/g))assert.doesNotMatch(tag,/disabled/);
});
test('non doctor save ignores even invalid stale training values; annual and doctor remain unchanged',()=>{
 const fd={get:key=>stale[key]??null};
 const result=officialPayload(fd,'chor11_monthly',{person:{position_name:'พยาบาลวิชาชีพ'}});
 assert.deepEqual(Object.keys(result).filter(k=>k.startsWith('training_')),['training_status']);assert.equal(result.training_status,1);
 assert.throws(()=>officialPayload(fd,'chor11_monthly',{person:{position_name:'นายแพทย์'}}),/เดือนฝึก/);
 assert.equal(Object.hasOwn(officialPayload(fd,'chor11_annual',{person:{position_name:'พยาบาลวิชาชีพ'}}),'training_status'),false);
});
test('non doctor print cannot carry old training selections while doctor can',()=>{
 const record={period_month:'2026-10-01'};
 const nurse=officialMonthlyBody(record,{...stale,position_name:'พยาบาลวิชาชีพ'});
 assert.doesNotMatch(nurse,/โรงพยาบาลทดสอบ|training_regional_checked/);
 const doctor=officialMonthlyBody(record,{...stale,position_name:'นายแพทย์'});
 assert.match(doctor,/โรงพยาบาลทดสอบ/);assert.match(doctor,/training_regional_checked/);
});
