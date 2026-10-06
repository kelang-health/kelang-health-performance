import {credit,release} from '../src/config/release.js';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
let pw;try{pw=require('playwright');}catch{pw=require('C:/Users/acer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const browser=await pw.chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const url=process.env.TEST_URL??'http://127.0.0.1:4173';
 await page.goto(url);await page.waitForSelector('.kpi-card');
 assert.equal(await page.locator('.brand img').evaluate(img=>img.complete&&img.naturalWidth>0),true,'municipal emblem loaded');
 assert.equal(await page.locator('#developer-credit').innerText(),credit);
 await page.goto(url+'/#manage');await page.waitForSelector('#manage-login');
 assert.match(await page.locator('#view').innerText(),/เวอร์ชันและประวัติการปรับปรุง/);
 assert.ok((await page.locator('#view').innerText()).includes(release.version));
 await page.goto(url+'/#overview');await page.waitForSelector('.kpi-card');
 await page.selectOption('#font-size','150');await page.click('#eye-mode');
 assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).fontSize),'21px');
 await page.reload();await page.waitForSelector('.kpi-card');
 assert.equal(await page.inputValue('#font-size'),'150');assert.equal(await page.getAttribute('#eye-mode','aria-pressed'),'true');
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  for(const route of ['overview','area','service','trend','compare','finance','ncd','cd']){
   await page.goto(url+'/#'+route);await page.waitForSelector('#view .panel');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${route} overflow ${width}`);
   for(const svg of await page.locator('svg.chart').all())assert.equal(await svg.locator('.chart-value').count(),await svg.locator('[data-chart-point]').count(),`${route} all points labeled`);
  }
 }
 await page.screenshot({path:'test-results/display-mobile.png',fullPage:false});
 console.log('Display checks passed: 150% font, eye mode, persistence, 16 route/viewport checks, every bar labeled.');
}finally{await browser.close();}
