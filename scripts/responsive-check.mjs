import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/acer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const url=process.env.TEST_URL??'http://127.0.0.1:4173';let checks=0;
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto(url);await page.waitForFunction(()=>document.querySelector('#refresh')?.disabled===false);
 await page.click('#menu-toggle');assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'false');assert.equal(await page.locator('.workspace').evaluate(el=>getComputedStyle(el).marginLeft),'0px');await page.reload();assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'false');await page.click('#menu-toggle');assert.equal(await page.locator('#menu-toggle').getAttribute('aria-expanded'),'true');checks+=4;
 for(const width of [320,390,768,820,1024,1180,1440])for(const size of ['100','150']){
  await page.setViewportSize({width,height:1024});await page.selectOption('#font-size',size);
  for(const route of ['overview','area','heatmap','trend','compare','finance','kpi-admin']){
   await page.goto(url+'/#'+route);await page.waitForSelector('#view .panel');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${width} ${size} ${route}`);checks++;
  }
  if(width<=1024){await page.click('#menu-toggle');await page.waitForFunction(()=>document.querySelector('#sidebar').getBoundingClientRect().left>=0);assert.equal(await page.locator('#overlay').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('#overlay').isVisible(),false);assert.equal(await page.locator('.workspace').evaluate(el=>el.inert),false);checks+=2;}
 }
 await page.setViewportSize({width:820,height:1180});await page.click('#menu-toggle');await page.setViewportSize({width:1180,height:820});await page.waitForFunction(()=>document.querySelector('#overlay').hidden&&!document.querySelector('.workspace').inert);assert.equal(await page.locator('#overlay').isVisible(),false);assert.equal(await page.locator('.workspace').evaluate(el=>el.inert),false);checks+=2;
 console.log(`Responsive checks passed: ${checks}; 7 widths, 100/150% fonts, PC persistence, tablet/mobile drawer, orientation switch.`);
}finally{await browser.close();}
