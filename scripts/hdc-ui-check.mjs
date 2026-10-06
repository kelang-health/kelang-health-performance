import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/acer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage();const url=process.env.TEST_URL??'http://127.0.0.1:4173';
 await page.goto(url+'/#area');await page.waitForSelector('#kpi-selector');await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);
 await page.selectOption('#kpi-selector','S_AGED9');
 const rows=JSON.parse(fs.readFileSync('data/hdc-snapshot.json')).datasets['s_aged9|2569'].rows;
 let count=0,fail=false;
 await page.route('https://opendata.moph.go.th/api/report_data',async route=>{
  const body=route.request().postDataJSON();assert.equal(body.tableName,'s_aged9');assert.equal(body.year,'2569');assert.equal(body.province,'52');count++;
  await route.fulfill({status:fail?429:201,contentType:'application/json',body:JSON.stringify(fail?{message:'HTTP 429 rate limit'}:{data:rows,total:rows.length})});
 });
 await page.click('[data-live-hdc]');await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('API สดสำเร็จ'));assert.equal(count,1);
 assert.match(await page.locator('#view').innerText(),/88\.6/);
 fail=true;await page.click('[data-live-hdc]');await page.waitForFunction(()=>document.querySelector('#message').textContent.includes('API สดไม่สำเร็จ'));
 assert.equal(count,2);assert.match(await page.locator('#message').innerText(),/429/);assert.match(await page.locator('#view').innerText(),/88\.6/);
 await page.reload();await page.waitForSelector('#kpi-selector');await page.waitForFunction(()=>!document.querySelector('#refresh').disabled);await page.selectOption('#kpi-selector','S_AGED9');assert.match(await page.locator('#view').innerText(),/88\.6/);
 console.log('HDC UI passed: one selected API request, HTTP201 data, HTTP429 fallback, and reload retains real data.');
}finally{await browser.close();}
