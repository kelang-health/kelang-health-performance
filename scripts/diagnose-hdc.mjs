import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/acer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
for(const url of ['https://opendata.moph.go.th/api/document/','https://api-hdc.moph.go.th/api-docs/']){
 const html=await(await fetch(url)).text();const scripts=[...html.matchAll(/src="([^"]+)"/g)].map(m=>m[1]);
 for(const src of scripts.filter(s=>s.includes('init'))){const script=await(await fetch(new URL(src,url))).text();fs.writeFileSync(`backups/${url.includes('opendata')?'opendata':'hdc'}-swagger.js`,script);console.log(url,script.slice(0,700));}
}
const browser=await chromium.launch({channel:'msedge',headless:true});
try{const page=await browser.newPage();await page.goto('https://kelang-health.github.io/kelang-health-performance/#area');await page.waitForSelector('#kpi-selector');console.log('SELECT',await page.locator('#kpi-selector').getAttribute('id'));await page.selectOption('#kpi-selector','S_AGED9');await page.waitForTimeout(500);console.log('UI', (await page.locator('#view').innerText()).slice(0,1600));console.log('BROWSER API',await page.evaluate(async()=>{try{const r=await fetch('https://opendata.moph.go.th/api/report_data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tableName:'s_aged9',year:'2569',province:'52',type:'json',limit:10000,offset:0})});const d=await r.json();return {status:r.status,total:d.total,rows:d.data?.length,error:d.message};}catch(e){return {error:e.message};}}));}finally{await browser.close();}

