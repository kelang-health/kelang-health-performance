// Prevent a prior month's service snapshot from being saved or printed in another period.
export function monthEnd(period){if(!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(period||''))throw new Error('เดือนที่เบิกไม่ถูกต้อง');const y=Number(period.slice(0,4)),m=Number(period.slice(5,7));return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);}
export function validateMonthlySnapshot(period,data){
 const cutoff=monthEnd(period);let history=[];try{history=JSON.parse(data.service_history||'[]');}catch{throw new Error('รูปแบบประวัติงานไม่ถูกต้อง');}
 if(!Array.isArray(history))throw new Error('รูปแบบประวัติงานไม่ถูกต้อง');
 const hasService=history.length>0||['service_years','service_months','service_days'].some(k=>data[k]!=null&&data[k]!=='');
 if((hasService&&!data.service_as_of)||(data.service_as_of&&data.service_as_of!==cutoff))throw new Error('วันที่นับอายุงานต้องตรงวันสิ้นเดือนที่เบิก '+cutoff+' กรุณาตรวจอายุงานและประวัติใหม่เมื่อเปลี่ยนเดือน');
 if(data.work_date_to&&data.work_date_to!==cutoff)throw new Error('วันที่สิ้นสุดการปฏิบัติงานต้องตรงวันสิ้นเดือนที่เบิก '+cutoff);
 if(data.work_date_from&&data.work_date_from>cutoff)throw new Error('วันเริ่มปฏิบัติงานอยู่หลังเดือนที่เบิก');
 for(const row of history){if(row.start_date&&row.end_date&&row.start_date>row.end_date)throw new Error('วันที่ในประวัติการปฏิบัติงานสลับลำดับ');if((row.start_date&&row.start_date>cutoff)||(row.end_date&&row.end_date>cutoff))throw new Error('ประวัติการปฏิบัติงานเกินวันสิ้นเดือนที่เบิก');}
 return cutoff;
}
