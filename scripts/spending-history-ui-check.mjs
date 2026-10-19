import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/acer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const source=JSON.parse(fs.readFileSync('backups/spending-history-review-20261019/import-records.json','utf8'));
const plans=JSON.parse(fs.readFileSync('backups/spending/spending-plans-2570.json','utf8'));
const actor='00000000-0000-0000-0000-000000000001',url=process.env.TEST_URL??'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true,channel:'msedge'});fs.mkdirSync('test-results',{recursive:true});
try{for(const role of ['STAFF','ADMIN','MONITOR','READER','PUBLIC','USER']){
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);let rejectNext=false;const errors=[];page.on('pageerror',err=>errors.push(err.message));page.on('dialog',d=>{if(rejectNext){rejectNext=false;return d.dismiss();}return d.type()==='prompt'?d.accept('ทดสอบเปิดแก้พร้อมหลักฐาน'):d.accept();});
 const rows=structuredClone(source).map((r,i)=>({...r,id:'history-'+i,updated_at:'2026-10-19T00:00:00Z'}));let writes=0;
 for(const r of rows.filter(r=>r.facility_code==='06117'&&r.fiscal_year>=2568)){r.status='confirmed';r.coverage_start=`${r.fiscal_year-544}-10-01`;r.coverage_end=`${r.fiscal_year-543}-08-31`;r.payload.groups.forEach(g=>{g.amount=r.fiscal_year===2568?100:125;});}
 if(role==='ADMIN')rows.find(r=>r.facility_code==='06116'&&r.fiscal_year===2569).status='confirmed';
 if(role!=='PUBLIC')await page.addInitScript(id=>sessionStorage.setItem('khp-session',JSON.stringify({access_token:'fixture',expires_at:Date.now()/1000+3600,hp_started_at:Date.now(),hp_last_active_at:Date.now(),user:{id}})),actor);
 await page.route('**/rest/v1/**',async route=>{const req=route.request(),u=new URL(req.url()),table=u.pathname.split('/').at(-1),method=req.method();let result=[];
  if(table==='hp_facilities')result=JSON.parse(fs.readFileSync('src/config/facilities.json','utf8'));
  if(table==='hp_user_facilities'&&['STAFF','ADMIN','MONITOR','READER'].includes(role))result=[{user_id:actor,role:role==='READER'?'MONITOR':role,facility_code:role==='READER'?null:'06116'}];
  if(table==='hp_spending_history'){
   if(method==='GET')result=['STAFF'].includes(role)?rows.filter(r=>r.facility_code==='06116'):['ADMIN','MONITOR','READER'].includes(role)?rows:[];
   else{assert.ok(['STAFF','ADMIN','MONITOR'].includes(role));const row=rows.find(r=>r.id===u.searchParams.get('id')?.slice(3));assert.equal(row.revision,+u.searchParams.get('revision')?.slice(3));if(role!=='ADMIN')assert.equal(row.facility_code,'06116');Object.assign(row,req.postDataJSON());result=[row];writes++;}
  }
  if(table==='hp_spending_reports'){const code=u.searchParams.get('facility_code')?.slice(3),fy=+u.searchParams.get('fiscal_year')?.slice(3);assert.equal(method,'GET');result=plans.filter(r=>r.facility_code===code&&r.fiscal_year===fy).map((r,i)=>({...r,id:'plan-'+i,revision:1}));}
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
 });
 await page.goto(url+'/#spending-history');await page.waitForFunction(()=>document.querySelector('#refresh')?.disabled===false);
 if(['PUBLIC','USER'].includes(role)){assert.match(await page.locator('#view').innerText(),role==='PUBLIC'?/กรุณาเข้าสู่ระบบ/:/ยังไม่มีสิทธิ์/);assert.equal(await page.locator('[data-history="save"]').count(),0);await page.close();continue;}
 await page.waitForSelector('.history-panel table');
 assert.equal(await page.locator('#history-year').inputValue(),'2569');assert.ok(await page.locator('.filters').isHidden());
 assert.match(await page.locator('.history-panel').innerText(),/ยังเปรียบเทียบไม่ได้/);
 if(role!=='STAFF'){await page.selectOption('#history-unit','06117');await page.selectOption('#history-category','7');assert.match(await page.locator('.history-panel table').innerText(),/25%/);assert.equal(await page.locator('.history-chart').count(),1);await page.selectOption('#history-unit','all');}
 assert.equal(await page.locator('[data-history="save"]').count(),0);await page.locator('[data-history-entry]').click();await page.waitForSelector('#history-start');assert.equal(await page.locator('#spending-month').count(),0);assert.equal(await page.locator('.spending-periods').count(),0);assert.match(await page.locator('.history-panel').innerText(),/บันทึกรายจ่ายย้อนหลังแบบรายปี/);
 if(role==='READER'){assert.ok(await page.locator('[data-history="save"]').isDisabled());assert.equal(await page.locator('#spending-unit option').count(),8);}
 else if(role==='ADMIN'){await page.getByRole('button',{name:'เปิดแก้ไข (ADMIN)',exact:true}).click();await page.getByText('เปิดแก้ไขแล้ว',{exact:true}).waitFor();assert.equal(writes,1);assert.ok(await page.locator('[data-history="save"]').isEnabled());}
 else{
  assert.equal(await page.locator('#spending-unit option').count(),role==='STAFF'?1:8);
  if(role==='MONITOR'){await page.selectOption('#spending-unit','06117');assert.ok(await page.locator('[data-history="save"]').isDisabled());await page.selectOption('#spending-unit','06116');}
  await page.locator('.history-group').first().locator('summary').click();const input=page.locator('[data-hgroup="1"][data-hfield="amount"]:not([data-hdetail])');await input.fill('-1');await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();assert.match(await page.locator('.history-panel').innerText(),/กรอกยอด/);assert.equal(writes,0);await page.locator('.history-group').first().locator('summary').click();await input.fill('123.45');rejectNext=true;await page.evaluate(()=>location.hash='finance');await page.waitForFunction(()=>location.hash.startsWith('#spending?'));assert.equal(await input.inputValue(),'123.45');await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await page.getByText('บันทึกร่างแล้ว',{exact:true}).waitFor();assert.equal(writes,1);
  await page.selectOption('#spending-year','2568');await page.locator('.history-group').first().locator('summary').click();await page.locator('[data-hgroup="1"][data-hfield="amount"]:not([data-hdetail])').fill('999.01');rejectNext=true;await page.selectOption('#spending-year','2570');assert.equal(await page.locator('#spending-year').inputValue(),'2568');assert.equal(await page.locator('[data-hgroup="1"][data-hfield="amount"]:not([data-hdetail])').inputValue(),'999.01');await page.selectOption('#spending-year','2570');await page.waitForSelector('#spending-month');await page.selectOption('#spending-year','2568');assert.notEqual(await page.locator('[data-hgroup="1"][data-hfield="amount"]:not([data-hdetail])').inputValue(),'999.01');await page.locator('[data-history="confirm"]').click();assert.match(await page.locator('.history-panel').innerText(),/ระบุช่วงเวลา/);assert.equal(writes,1);
  await page.fill('#history-start','2024-10-01');await page.fill('#history-end','2025-08-31');
  for(const details of await page.locator('.history-group').all())await details.locator('summary').click();
  for(const input of await page.locator('[data-hgroup][data-hfield="amount"]:not([data-hdetail])').all())if(await input.inputValue()==='')await input.fill('0');
  await page.locator('[data-hgroup="3"][data-hdetail][data-hfield="amount"]').fill('12.50');assert.equal(await page.locator('[data-hgroup="3"][data-hfield="amount"]:not([data-hdetail])').inputValue(),'12.5');
  for(const note of await page.locator('[data-hgroup][data-hfield="note"]').all())await note.fill('ตรวจยอดรวมจากทะเบียนจ่ายและหลักฐานประกอบแล้ว');
  await page.fill('#history-review','ตรวจสอบช่วงเวลาและข้อสังเกตกับหลักฐานของหน่วยแล้ว');
  await page.fill('#history-end','2025-09-30');assert.match(await page.locator('#history-coverage-status').innerText(),/ครอบคลุมทั้งปี/);assert.equal(await page.locator('[data-history="confirm"]').innerText(),'ยืนยันข้อมูลครบปี');await page.fill('#history-end','2025-08-31');assert.match(await page.locator('#history-coverage-status').innerText(),/ข้อมูลบางช่วงของปี/);await page.locator('[data-history="confirm"]').click();await page.getByText('ยืนยันข้อมูลย้อนหลังแล้ว',{exact:true}).waitFor();assert.equal(writes,2);assert.ok(await page.locator('[data-history="save"]').isDisabled());assert.equal(await page.getByRole('button',{name:'เปิดแก้ไข (ADMIN)',exact:true}).count(),0);
 }
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'page overflow at '+width);}
 await page.screenshot({path:'test-results/spending-history-'+role.toLowerCase()+'.png',fullPage:true});
 await page.selectOption('#spending-year','2570');await page.waitForSelector('#spending-month');assert.equal(await page.locator('#spending-year').inputValue(),'2570');await page.selectOption('#spending-year','2571');await page.goto(url+'/#spending-history');await page.waitForSelector('#history-year');await page.goto(url+'/#spending');await page.waitForSelector('#spending-year');assert.equal(await page.locator('#spending-year').inputValue(),'2571');
 if(role==='ADMIN'){await page.goto(url+'/#spending?year=2568&facility=06120');await page.waitForSelector('#history-start');assert.equal(await page.locator('#spending-unit').inputValue(),'06120');await page.reload();await page.waitForFunction(()=>document.querySelector('#refresh')?.disabled===false);await page.waitForSelector('#history-start');assert.equal(await page.locator('#spending-unit').inputValue(),'06120');assert.equal(await page.locator('#spending-year').inputValue(),'2568');}
 assert.deepEqual(errors,[]);await page.close();
}console.log('History UI passed: role scopes, review/draft/confirm/reopen, matching period comparison, annual entry from spending, mobile and preserved FY2570 monthly filters. Mock REST only.');}finally{await browser.close();}
