import {createRequire} from 'node:module';
import fs from 'node:fs';
const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright');}catch{playwright=require('C:/Users/acer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');}
const {chromium}=playwright;
const url=process.env.TEST_URL??'http://127.0.0.1:4173';
let browser;try{browser=await chromium.launch({headless:true,channel:'msedge'});}catch{browser=await chromium.launch({headless:true,channel:'chrome'});}
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];const results=[];page.on('pageerror',err=>errors.push(err.message));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
fs.mkdirSync('test-results',{recursive:true});
await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForSelector('.kpi-card',{timeout:60000});
await page.waitForFunction(()=>document.querySelector('#refresh')?.disabled===false,{},{timeout:120000});
results.push({check:'load',population:await page.locator('#view').innerText(),source:await page.locator('#freshness').innerText()});
await page.screenshot({path:'test-results/desktop.png',fullPage:false});
for(const route of ['area','service','heatmap','trend','compare','profile','finance','ncd','cd','quality','manage']){
 await page.goto(url+'/#'+route,{waitUntil:'domcontentloaded'});await page.waitForSelector('#view .panel',{timeout:30000});
 results.push({check:route,title:await page.locator('h1').innerText(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
}
await page.goto(url+'/#heatmap');await page.waitForSelector('.heat-cell');await page.locator('.heat-cell').first().click();await page.waitForSelector('dialog[open]');results.push({check:'heatmap detail',open:await page.locator('dialog').isVisible()});await page.locator('#dialog-close').click();
await page.goto(url+'/#finance');await page.waitForSelector('[data-finance]');await page.locator('[data-finance]').first().click();await page.waitForSelector('dialog[open]');results.push({check:'finance drilldown',open:await page.locator('dialog').isVisible()});await page.locator('#dialog-close').click();
await page.setViewportSize({width:390,height:844});await page.goto(url+'/#overview');await page.waitForSelector('.stat');await page.waitForFunction(()=>document.querySelector('#sidebar').getBoundingClientRect().right<=0);
await page.screenshot({path:'test-results/mobile.png',fullPage:false});
for(const route of ['overview','area','service','heatmap','trend','compare','profile','finance','ncd','cd','quality','manage']){
 await page.goto(url+'/#'+route);await page.waitForSelector('#view');await page.waitForFunction(()=>document.querySelector('#sidebar').getBoundingClientRect().right<=0);results.push({check:'mobile '+route,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),offenders:await page.evaluate(()=>Array.from(document.querySelectorAll('main *')).filter(el=>el.getBoundingClientRect().right>innerWidth+1&&!el.closest('.table-wrap')).map(el=>({tag:el.tagName,class:el.className,text:el.textContent.slice(0,50),width:el.getBoundingClientRect().width})).slice(0,10))});
}
await page.locator('#menu-toggle').click();results.push({check:'mobile drawer',expanded:await page.locator('#menu-toggle').getAttribute('aria-expanded')});await page.locator('#overlay').click({position:{x:350,y:400}});
await page.goto(url+'/#area');await page.waitForSelector('#view .panel');const areaOptions=await page.locator('#facility option').count();results.push({check:'AREA facility filter',count:areaOptions-1});if(areaOptions!==8)errors.push('AREA facility selector must contain 7 units');
await page.goto(url+'/#service');await page.waitForSelector('#view .panel');const serviceOptions=await page.locator('#facility option').count();results.push({check:'SERVICE facility filter',count:serviceOptions-1});if(serviceOptions!==9)errors.push('SERVICE facility selector must contain 8 units');
await page.reload();await page.waitForSelector('#page-title');results.push({check:'hash route reload',title:await page.locator('#page-title').innerText()});
await page.goto(url+'/#manage');await page.waitForSelector('#manage-login');await page.locator('#manage-login').click();await page.waitForSelector('#login-form');results.push({check:'public login form',email:await page.locator('input[name=email]').isVisible()});
fs.writeFileSync('test-results/ui-report.json',JSON.stringify({url,results:results.map(r=>r.check==='load'?{...r,population:r.population.slice(0,300)}:r),errors},null,2));
await browser.close();console.log(JSON.stringify({checks:results.length,errors,overflows:results.filter(r=>r.overflow)}));if(errors.length||results.some(r=>r.overflow))process.exitCode=1;
