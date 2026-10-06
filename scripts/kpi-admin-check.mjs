import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/acer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
const url=process.env.TEST_URL??'http://127.0.0.1:4173';
const settings=[];const facilities=JSON.parse(fs.readFileSync('src/config/facilities.json'));
const session={access_token:'ui-fixture',refresh_token:'fixture',expires_at:Date.now()/1000+3600,user:{id:'00000000-0000-0000-0000-000000000001'}};
try{
 const page=await browser.newPage();await page.addInitScript(s=>sessionStorage.setItem('khp-session',JSON.stringify(s)),session);
 await page.route('**/rest/v1/**',async route=>{const u=new URL(route.request().url()),table=u.pathname.split('/').at(-1),method=route.request().method();let rows=[];
  if(table==='hp_facilities')rows=facilities;
  if(table==='hp_user_facilities')rows=[{user_id:session.user.id,facility_code:'06116',role:'ADMIN'}];
  if(table==='hp_settings'){
   const key=u.searchParams.get('setting_key')?.replace(/^eq\./,'');
   if(method==='POST')settings.push(route.request().postDataJSON());
   if(method==='PATCH')Object.assign(settings.find(s=>s.setting_key===key),route.request().postDataJSON());
   rows=key?settings.filter(s=>s.setting_key===key):settings;
  }
  await route.fulfill({status:method==='POST'?201:200,contentType:'application/json',body:JSON.stringify(rows)});
 });
 await page.goto(url+'/#kpi-admin');await page.waitForSelector('[data-publish-kpi]');await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);await page.selectOption('#year','2569');await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
 assert.equal(await page.locator('[data-publish-kpi]').count(),26);
 await page.locator('[data-publish-kpi="S_DM_CONTROL"]').uncheck();await page.waitForFunction(()=>document.querySelector('#view').textContent.includes('บันทึกการแสดงผลแล้ว'));
 assert.equal(settings.find(s=>s.setting_key==='kpi_publication:2569:S_DM_CONTROL').value.mode,'hide');
 await page.goto(url+'/#overview');assert.equal(await page.locator('.kpi-card[data-kpi="S_DM_CONTROL"]').count(),0);
 await page.reload();await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);await page.selectOption('#year','2569');await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);assert.equal(await page.locator('.kpi-card[data-kpi="S_DM_CONTROL"]').count(),0);
 await page.goto(url+'/#kpi-admin');await page.locator('[data-publish-kpi="S_DM_CONTROL"]').check();await page.waitForFunction(()=>document.querySelector('#view').textContent.includes('บันทึกการแสดงผลแล้ว'));
 await page.goto(url+'/#overview');assert.equal(await page.locator('.kpi-card[data-kpi="S_DM_CONTROL"]').count(),1);
 await page.goto(url+'/#kpi-admin');
 const sourceRows=JSON.parse(fs.readFileSync('data/hdc-snapshot.json')).datasets['s_aged9|2569'].rows;
 await page.route('https://opendata.moph.go.th/api/report_data',route=>route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({data:sourceRows,total:sourceRows.length})}));
 await page.click('[data-check-kpi="S_AGED9"]');await page.waitForFunction(()=>document.querySelector('#view').textContent.includes('ตรวจเสร็จแล้ว'));
 assert.equal(settings.find(s=>s.setting_key==='kpi_publication:2569:S_AGED9').value.last_check.error,null);
 assert.equal(settings.find(s=>s.setting_key==='kpi_publication:2569:S_AGED9').value.last_check.available_units,7);
 assert.equal(settings.find(s=>s.setting_key==='kpi_publication:2569:S_AGED9').value.mode,'auto');
 await page.selectOption('#year','2570');await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);assert.equal(await page.locator('.kpi-card').count(),0);
 await page.goto(url+'/#area');assert.match(await page.locator('#view').innerText(),/อยู่ระหว่างรอข้อมูลปีงบประมาณ 2570/);
 const publicPage=await browser.newPage();await publicPage.goto(url+'/#kpi-admin');await publicPage.waitForSelector('#manage-login');assert.equal(await publicPage.locator('[data-publish-kpi]').count(),0);
 console.log('Admin UI fixtures passed: 26 toggles, hide/show persists and changes public cards, year-specific empty state, public has no edit controls.');
}finally{await browser.close();}
