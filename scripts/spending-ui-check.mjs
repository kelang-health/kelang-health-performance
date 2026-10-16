import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/acer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const source=JSON.parse(fs.readFileSync('backups/spending/spending-plans-2570.json','utf8'));
const actor='00000000-0000-0000-0000-000000000001',url=process.env.TEST_URL??'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true,channel:'msedge'});fs.mkdirSync('test-results',{recursive:true});
try{for(const role of ['STAFF','ADMIN','PUBLIC','USER']){
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(12000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.type()==='prompt'?d.accept('เหตุผลทดสอบ'):d.accept());
 let rows=source.map((r,i)=>({...r,id:'plan-'+i,revision:1})),writes=0;
 if(role!=='PUBLIC')await page.addInitScript(id=>sessionStorage.setItem('khp-session',JSON.stringify({access_token:'fixture',expires_at:Date.now()/1000+3600,hp_started_at:Date.now(),hp_last_active_at:Date.now(),user:{id}})),actor);
 await page.route('**/rest/v1/**',async route=>{const req=route.request(),u=new URL(req.url()),t=u.pathname.split('/').at(-1),method=req.method();let result=[];
  if(t==='hp_facilities')result=JSON.parse(fs.readFileSync('src/config/facilities.json','utf8'));
  if(t==='hp_user_facilities'&&['STAFF','ADMIN'].includes(role))result=[{user_id:actor,role,facility_code:'06116'}];
  if(t==='hp_spending_reports'){
   if(method==='GET'){const code=u.searchParams.get('facility_code')?.slice(3),fy=+u.searchParams.get('fiscal_year')?.slice(3);result=rows.filter(r=>r.facility_code===code&&r.fiscal_year===fy);}
   else{assert.ok(['STAFF','ADMIN'].includes(role));writes++;const body=req.postDataJSON();if(method==='POST'){assert.equal(body.facility_code,'06116');result=[{...body,id:'month-'+writes}];rows.push(result[0]);}else{const row=rows.find(r=>r.id===u.searchParams.get('id')?.slice(3));assert.equal(row.revision,+u.searchParams.get('revision')?.slice(3));Object.assign(row,body);result=[row];}}
  }
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(result)});
 });
 await page.goto(url+'/#spending');await page.waitForFunction(()=>document.querySelector('#refresh')?.disabled===false);
 if(['PUBLIC','USER'].includes(role)){assert.equal(await page.locator('[data-spending-item]').count(),0);assert.match(await page.locator('#view').innerText(),role==='PUBLIC'?/กรุณาเข้าสู่ระบบ/:/ยังไม่มีสิทธิ์/);await page.close();continue;}
 await page.waitForSelector('[data-spending-item]',{state:'attached'});
 assert.equal(await page.locator('#spending-unit option').count(),role==='STAFF'?1:8);
 assert.equal(await page.locator('details[data-spending-group][open]').count(),0);
 await page.getByRole('button',{name:'เปิดทั้งหมด',exact:true}).click();
 const first=page.locator('[data-spending-item]').first();await first.fill('123.45');
 await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await page.getByText('บันทึกร่างแล้ว',{exact:true}).waitFor();
 assert.equal(rows.find(r=>r.period===10).status,'draft');assert.equal(Object.values(rows.find(r=>r.period===10).payload.amounts)[0],123.45);
 await page.getByRole('button',{name:'ยืนยันรายงานประจำเดือน',exact:true}).click();await page.getByText(/กรอกให้ครบทุกช่อง/).waitFor();assert.equal(rows.find(r=>r.period===10).status,'draft');
 await page.getByRole('button',{name:'กำหนดช่องว่างเป็น 0',exact:true}).click();await page.getByRole('button',{name:'ยืนยันรายงานประจำเดือน',exact:true}).click();await page.getByText('ยืนยันรายงานประจำเดือนแล้ว',{exact:true}).waitFor();assert.equal(rows.find(r=>r.period===10).status,'confirmed');assert.equal(await page.locator('[data-spending-item]:not([disabled])').count(),0);
 assert.equal(await page.getByRole('button',{name:'เปิดเดือนเพื่อแก้ไข (ADMIN)',exact:true}).count(),role==='ADMIN'?1:0);
 if(role==='ADMIN'){await page.getByRole('button',{name:'เปิดเดือนเพื่อแก้ไข (ADMIN)',exact:true}).click();await page.getByText('บันทึกร่างแล้ว',{exact:true}).waitFor();await page.getByRole('button',{name:'ลบรายงานเดือนนี้',exact:true}).click();await page.getByText('ลบรายงานแล้ว สามารถนำข้อมูลเดิมกลับมาบันทึกเป็นร่างได้',{exact:true}).waitFor();assert.equal(rows.find(r=>r.period===10).status,'deleted');await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await page.getByText('บันทึกร่างแล้ว',{exact:true}).waitFor();assert.equal(rows.find(r=>r.period===10).status,'draft');}
 await page.getByRole('button',{name:'พับทั้งหมด',exact:true}).click();await page.locator('details[data-spending-group="2"] summary').click();await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'test-results/spending-'+role.toLowerCase()+'.png',fullPage:false});
 await page.getByRole('button',{name:'ดูภาพรวมทั้งปี',exact:true}).click();assert.equal(await page.locator('.spending-panel table thead th').count(),15);
 await page.getByRole('button',{name:'กลับหน้ากรอกเดือนนี้',exact:true}).click();
 for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,role+' overflow '+width);}
 await page.setViewportSize({width:390,height:1000});await page.screenshot({path:'test-results/spending-mobile.png',fullPage:true});
 await page.selectOption('#spending-month','11');assert.equal(await page.locator('[data-spending-item]').first().inputValue(),'');
 await page.selectOption('#spending-year','2569');await page.getByText(/ยังไม่มีแผนรายละเอียดสำหรับปีนี้/).waitFor();assert.equal(await page.locator('[data-spending-item]').count(),0);
 assert.deepEqual(errors,[]);assert.ok(writes>=2);await page.close();
}console.log('Spending UI passed: STAFF/ADMIN/PUBLIC/USER, monthly draft, completeness, zero, confirm lock, admin reopen/delete/restore, annual view, 390/768/1440px, missing-year plan. Mock REST only; no live monthly reports written.');}finally{await browser.close();}
