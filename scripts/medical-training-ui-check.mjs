import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {renderDocumentForm} from '../src/staff/documents.js';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/acer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage();
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});
  for(const position_name of ['พยาบาลวิชาชีพ','นายแพทย์']){
   await page.setContent(renderDocumentForm('chor11_monthly',{person:{full_name:'ผู้ทดสอบ ระบบ',position_name}}));
   const inputs=page.locator('[name^="training_"]');
   assert.equal(await inputs.count(),13);
   for(const input of await inputs.all())assert.equal(await input.isDisabled(),position_name!=='นายแพทย์');
   assert.equal(await page.locator('[name="history_0_facility_name"]').isEnabled(),true);
   const formData=await page.locator('form').evaluate(form=>Object.fromEntries(new FormData(form)));
   assert.equal(Object.keys(formData).some(k=>k.startsWith('training_')),position_name==='นายแพทย์');
  }
 }
 console.log('PASS: desktop/mobile native disabled controls, FormData exclusion, and editable history');
}finally{await browser.close();}
