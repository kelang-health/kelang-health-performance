const allowedOrigin='https://kelang-health.github.io';
export async function handleRequest(req,env,fetcher=fetch){
 const origin=req.headers.get('Origin');const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Origin':allowedOrigin,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
 const out=(status,value)=>new Response(JSON.stringify(value),{status,headers});
 if(origin&&origin!==allowedOrigin)return out(403,{message:'ไม่อนุญาตต้นทางนี้'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return out(405,{message:'ใช้ POST เท่านั้น'});
 const bearer=req.headers.get('Authorization');if(!bearer?.startsWith('Bearer '))return out(401,{message:'กรุณาเข้าสู่ระบบ'});
 const base=env.SUPABASE_URL,key=env.SUPABASE_SERVICE_ROLE_KEY;if(!base||!key)return out(503,{message:'ระบบบัญชียังไม่พร้อม'});
 const call=async(path,method='GET',body,authorization=`Bearer ${key}`)=>{
  const r=await fetcher(base+path,{method,headers:{apikey:key,Authorization:authorization,'Content-Type':'application/json',Prefer:'return=representation'},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  const d=r.status===204?null:await r.json();if(!r.ok){const error=new Error(r.status===422?'อีเมลนี้มีบัญชีอยู่แล้ว หรือรหัสผ่านไม่ผ่านเงื่อนไข':'ดำเนินการไม่สำเร็จ กรุณาตรวจข้อมูลและลองใหม่');error.status=r.status;throw error;}return d;
 };
 try{
  let actor;try{actor=await call('/auth/v1/user','GET',undefined,bearer);}catch{return out(401,{message:'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'});}
  if(Number(req.headers.get('Content-Length')??0)>10000)return out(413,{message:'ข้อมูลเกินขนาดที่กำหนด'});
  const input=await req.json();
  const audit=async(operation,user_id,details)=>call('/rest/v1/hp_audit_logs','POST',{user_id:actor.id,table_name:'hp_account_management',operation,new_data:{user_id,...details}});
  const validatePassword=()=>{if(typeof input.password!=='string'||input.password.length<12||input.password.length>128)throw Object.assign(new Error('รหัสผ่านต้องยาว 12–128 ตัวอักษร'),{status:400});};
  if(input.action==='change_initial_password'){
   validatePassword();
   if(typeof input.confirm_password!=='string'||input.password!==input.confirm_password)return out(400,{message:'ยืนยันรหัสผ่านใหม่ไม่ตรงกัน'});
   const managed=await call('/auth/v1/admin/users/'+encodeURIComponent(actor.id));
   if(managed.app_metadata?.hp_only!==true)return out(403,{message:'บัญชีนี้ไม่ใช่บัญชีเฉพาะ Hospital Profile'});
   if(managed.app_metadata?.hp_must_change_password!==true)return out(409,{message:'บัญชีนี้ไม่อยู่ในสถานะบังคับเปลี่ยนรหัสผ่าน'});
   await call('/auth/v1/admin/users/'+encodeURIComponent(actor.id),'PUT',{password:input.password,app_metadata:{...managed.app_metadata,hp_must_change_password:false,hp_password_changed_at:new Date().toISOString()}});
   await audit('UPDATE',actor.id,{action:'change_initial_password',scope:'hospital_profile'});
   return out(200,{message:'เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่'});
  }
  const permission=await call('/rest/v1/hp_user_facilities?select=role&user_id=eq.'+encodeURIComponent(actor.id)+'&role=eq.ADMIN');
  if(!permission.length)return out(403,{message:'เฉพาะ ADMIN ของ Hospital Profile เท่านั้น'});
  if(input.action==='list'){
   const accounts=[];let exhausted=false;
   for(let page=1;page<=100;page++){const d=await call('/auth/v1/admin/users?page='+page+'&per_page=100');const users=d.users??[];accounts.push(...users.filter(u=>u.app_metadata?.hp_only===true));if(users.length<100){exhausted=true;break;}}
   if(!exhausted)return out(503,{message:'บัญชีเกินขอบเขตการค้นหา กรุณาติดต่อผู้ดูแล'});
   const assignments=await call('/rest/v1/hp_user_facilities?select=user_id,facility_code,role');
   const links=await call('/rest/v1/hp_personnel_accounts?select=user_id,personnel_id');
   const people=await call('/rest/v1/hp_personnel?select=id,full_name,position_name,facility_code,active');
   const personById=new Map(people.map(p=>[p.id,p]));
   return out(200,{accounts:accounts.map(u=>{const link=links.find(p=>p.user_id===u.id);return {id:u.id,email:u.email,name:u.user_metadata?.display_name??'',role:u.app_metadata?.hp_account_role??'USER',disabled:!!u.banned_until&&Date.parse(u.banned_until)>Date.now(),must_change_password:u.app_metadata?.hp_must_change_password===true,permissions:assignments.filter(p=>p.user_id===u.id),personnel:link?personById.get(link.personnel_id)??{id:link.personnel_id}:null};})});
  }
  if(input.action==='create'){
   validatePassword();if(typeof input.email!=='string'||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)||typeof input.name!=='string'||!input.name.trim()||input.name.length>100||!['STAFF','ADMIN','USER'].includes(input.role))return out(400,{message:'ตรวจชื่อ อีเมล และสิทธิ์'});
   let personnel=null;
   if(input.personnel_id!==undefined&&input.personnel_id!==null&&input.personnel_id!==''){
    if(typeof input.personnel_id!=='string'||!/^[0-9a-f-]{36}$/i.test(input.personnel_id))return out(400,{message:'รหัสเจ้าหน้าที่ไม่ถูกต้อง'});
    const people=await call('/rest/v1/hp_personnel?select=id,full_name,position_name,facility_code,active&id=eq.'+encodeURIComponent(input.personnel_id));
    if(people.length!==1||people[0].active!==true)return out(400,{message:'ไม่พบเจ้าหน้าที่ที่ปฏิบัติงานในทะเบียนบุคลากร'});
    const linked=await call('/rest/v1/hp_personnel_accounts?select=user_id&personnel_id=eq.'+encodeURIComponent(input.personnel_id));
    if(linked.length)return out(409,{message:'เจ้าหน้าที่รายนี้ผูกกับบัญชีแล้ว'});
    personnel=people[0];
   }
   const master=await call('/rest/v1/hp_facilities?select=facility_code&active=eq.true');const allowed=master.map(f=>f.facility_code);
   const requested=[...new Set(Array.isArray(input.facilities)?input.facilities:[])];
   if(input.role==='STAFF'&&personnel?.facility_code&&!requested.includes(personnel.facility_code))requested.unshift(personnel.facility_code);
   const codes=input.role==='ADMIN'?allowed:input.role==='USER'?[]:requested;if(input.role!=='USER'&&!codes.length||codes.some(c=>!allowed.includes(c)))return out(400,{message:'เลือกหน่วยบริการที่ได้รับสิทธิ์อย่างน้อย 1 แห่ง'});
   const user=await call('/auth/v1/admin/users','POST',{email:input.email.trim().toLowerCase(),password:input.password,email_confirm:true,user_metadata:{display_name:input.name.trim()},app_metadata:{hp_only:true,hp_created_by:actor.id,hp_account_role:input.role,hp_must_change_password:true}});
   try{
    const profiles=await call('/rest/v1/profiles?select=id,active,role&id=eq.'+encodeURIComponent(user.id));
    if(profiles.length!==1||profiles[0].active!==false||profiles[0].role!=='STAFF')throw new Error('บัญชีไม่ได้ถูกจำกัดสิทธิ์ตามที่กำหนด');
    if(codes.length)await call('/rest/v1/hp_user_facilities','POST',codes.map(facility_code=>({user_id:user.id,facility_code,role:input.role})));
    if(personnel)await call('/rest/v1/hp_personnel_accounts','POST',{personnel_id:personnel.id,user_id:user.id});
    await audit('INSERT',user.id,{action:'create',scope:'hospital_profile',role:input.role,facilities:codes,personnel_id:personnel?.id??null});
   }catch(error){await call('/auth/v1/admin/users/'+user.id,'DELETE');throw error;}
   return out(201,{message:(personnel?'สร้างบัญชีและผูกเจ้าหน้าที่สำเร็จ':'สร้างบัญชีเฉพาะ Hospital Profile สำเร็จ')+' • ผู้ใช้ต้องเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งแรก',user_id:user.id,personnel_id:personnel?.id??null,must_change_password:true});
  }
  if(input.action==='reset_password'){
   validatePassword();if(typeof input.user_id!=='string'||!/^[0-9a-f-]{36}$/i.test(input.user_id))return out(400,{message:'รหัสบัญชีไม่ถูกต้อง'});
   const user=await call('/auth/v1/admin/users/'+input.user_id);if(user.app_metadata?.hp_only!==true)return out(403,{message:'ห้ามเปลี่ยนรหัสผ่านบัญชีร่วมของระบบอื่น'});
   const p=await call('/rest/v1/profiles?select=active&id=eq.'+input.user_id);if(p.length!==1||p[0].active)return out(409,{message:'บัญชีมีสิทธิ์ในระบบอื่น ไม่อนุญาตให้เปลี่ยนผ่านหน้านี้'});
   await call('/auth/v1/admin/users/'+input.user_id,'PUT',{password:input.password,app_metadata:{...user.app_metadata,hp_must_change_password:true,hp_password_reset_at:new Date().toISOString()}});await audit('UPDATE',input.user_id,{action:'reset_password',scope:'hospital_profile'});
   return out(200,{message:'ตั้งรหัสผ่านชั่วคราวสำเร็จ • ผู้ใช้ต้องเปลี่ยนรหัสผ่านเมื่อเข้าสู่ระบบครั้งถัดไป',must_change_password:true});
  }
  return out(400,{message:'ไม่รองรับคำสั่งนี้'});
 }catch(error){return out(error.status>=400&&error.status<500?error.status:500,{message:error.status>=400&&error.status<500?error.message:'ระบบบัญชีขัดข้อง กรุณาลองใหม่'});}
}
