export const publicationKey=(id,year)=>`kpi_publication:${year}:${id}`;
export function publicationSetting(settings,id,year){return settings.find(r=>r.setting_key===publicationKey(id,year))?.value??{mode:'auto'};}
export function dataStatus(response,records){
 const eligible=records.filter(r=>r.eligible);const available=eligible.filter(r=>r.value!==null&&Number.isFinite(r.value)).length;
 if(!response)return {key:'pending',text:'ยังไม่ได้ตรวจ',available,expected:eligible.length};
 if(response.error)return {key:available?'cached':'error',text:available?'API ขัดข้อง • มีข้อมูลล่าสุด':'API ขัดข้อง • ยังยืนยันไม่ได้',available,expected:eligible.length};
 if(!response.rows?.length)return {key:'empty',text:'ไม่พบข้อมูลของหน่วยบริการ',available,expected:eligible.length};
 if(!available)return {key:'unusable',text:'มีแถวข้อมูล • คำนวณช่วงนี้ไม่ได้',available,expected:eligible.length};
 return {key:'ready',text:available===eligible.length?'มีข้อมูลครบ':'มีข้อมูลบางหน่วย',available,expected:eligible.length};
}
export function shouldPublish(setting,status){
 if(setting.mode==='hide')return false;
 // A real zero is usable data. A cache with an API error remains usable.
 return status.key==='pending'||status.available>0;
}
