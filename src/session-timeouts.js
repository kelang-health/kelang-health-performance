import {currentSession,onSession,checkSessionTime,recordSessionActivity,touchSession,sessionExpiryReason} from './api/supabase/client.js';
import {sessionPolicy,sessionStatus} from './api/supabase/session-policy.js';

export function mountSessionTimeouts(){
 const banner=document.createElement('section');banner.className='session-timeout-banner';banner.hidden=true;banner.setAttribute('role','status');banner.setAttribute('aria-live','polite');
 const message=document.createElement('span'),button=document.createElement('button');button.type='button';button.textContent='ใช้งานต่อ';banner.append(message,button);document.body.append(banner);
 button.addEventListener('click',()=>{recordSessionActivity();touchSession(true).catch(()=>{});update();});
 function update(){checkSessionTime();const s=currentSession();if(!s){button.hidden=true;const reason=sessionExpiryReason();banner.hidden=!reason;message.textContent=reason==='maximum'?'ใช้งานครบ 8 ชั่วโมงแล้ว กรุณาเข้าสู่ระบบใหม่':reason==='idle'?'ออกจากระบบแล้ว เนื่องจากไม่ได้ใช้งาน 30 นาที':reason?'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่':'';return;}
  const status=sessionStatus(s);banner.hidden=status.remaining>sessionPolicy.warningMs;button.hidden=status.reason!=='idle';const minutes=Math.max(1,Math.ceil(status.remaining/60000));message.textContent=status.reason==='maximum'?`จะครบระยะเวลาเข้าสู่ระบบ 8 ชั่วโมงใน ${minutes} นาที กรุณาบันทึกงานและเข้าสู่ระบบใหม่`:`จะออกจากระบบใน ${minutes} นาทีเนื่องจากไม่ได้ใช้งาน กรุณาบันทึกงานหรือเลือกใช้งานต่อ`;
  if(document.visibilityState==='visible'&&Date.now()-s.hp_last_active_at<sessionPolicy.touchMs)touchSession().catch(()=>{});
 }
 const activity=event=>{if(event.isTrusted){recordSessionActivity();update();}};
 for(const name of ['pointerdown','keydown','input','wheel'])document.addEventListener(name,activity,{passive:true,capture:true});
 document.addEventListener('visibilitychange',update);window.addEventListener('focus',update);onSession(()=>{queueMicrotask(update);});setInterval(update,10000);update();
}
