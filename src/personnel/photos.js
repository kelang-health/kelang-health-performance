import {runtime} from '../config/runtime.js';
import {request} from '../api/request.js';
import {currentSession,refreshSession} from '../api/supabase/client.js';
export const PHOTO_LIMIT=102400;
export function canUploadPhoto(p,permissions,links,userId){return !!userId&&p.active&&(permissions.some(a=>a.role==='ADMIN'||a.role==='STAFF'&&a.facility_code===p.facility_code)||links.some(a=>a.personnel_id===p.id&&a.user_id===userId));}
export async function compressPhoto(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('เลือก JPEG, PNG หรือ WebP เท่านั้น');
 if(file.size>10*1024*1024)throw new Error(`ภาพนี้มีขนาด ${(file.size/1024/1024).toFixed(1)} MB เกินขนาดที่รับได้ 10 MB กรุณาลดขนาดภาพหรือบันทึกเป็น JPEG ให้ไม่เกิน 10 MB แล้วเลือกอัปโหลดใหม่ เช่น ใช้เมนูปรับขนาดภาพในแอปรูปภาพหรือ Paint`);
 let image;try{image=await createImageBitmap(file);}catch{throw new Error('อ่านภาพไม่ได้ กรุณาเลือกไฟล์ใหม่');}
 try{if(image.width*image.height>40000000)throw new Error(`ภาพมีความละเอียด ${image.width} × ${image.height} พิกเซล เกิน 40 ล้านพิกเซล กรุณาลดความกว้างและความสูง เช่น ให้ด้านยาวไม่เกิน 2,000 พิกเซล แล้วเลือกอัปโหลดใหม่`);
 const ratio=Math.min(1,400/image.width,500/image.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
 for(const quality of [.82,.7,.55,.4]){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));if(blob?.type==='image/webp'&&blob.size<=PHOTO_LIMIT)return blob;}
 throw new Error('ระบบย่อภาพให้ไม่เกิน 100 KB ไม่สำเร็จ กรุณาลดขนาดภาพ เช่น ให้ด้านยาวไม่เกิน 2,000 พิกเซล หรือบันทึกเป็น JPEG แล้วเลือกอัปโหลดใหม่');
 }finally{image.close();}
}
export async function uploadPhoto(id,file){const blob=await compressPhoto(file);await refreshSession();if(!currentSession())throw new Error('กรุณาเข้าสู่ระบบใหม่');const headers={apikey:runtime.supabaseKey,Authorization:'Bearer '+currentSession().access_token};
 await request(runtime.supabaseUrl+'/storage/v1/object/hp-personnel/'+id+'.webp',{method:'POST',headers:{...headers,'Content-Type':'image/webp','x-upsert':'true','Cache-Control':'max-age=0'},body:blob});
 await request(runtime.supabaseUrl+'/rest/v1/rpc/hp_photo_refresh',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({person_id:id})});return blob.size;
}
export async function signPhotos(paths){await refreshSession();return request(runtime.supabaseUrl+'/storage/v1/object/sign/hp-personnel',{method:'POST',headers:{apikey:runtime.supabaseKey,...(currentSession()?{Authorization:'Bearer '+currentSession().access_token}:{}),'Content-Type':'application/json'},body:JSON.stringify({paths,expiresIn:300})});}
export function signedPhotoUrl(path){return path.startsWith('http')?path:runtime.supabaseUrl+'/storage/v1'+path;}
