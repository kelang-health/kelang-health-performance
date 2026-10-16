const day=86400000;
function parse(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value??''))return null;const date=new Date(value+'T00:00:00Z');return Number.isFinite(+date)&&date.toISOString().slice(0,10)===value?date:null;}
// Calendar duration includes both the first and final working dates.
export function historyDuration(start,end){
 const from=parse(start),last=parse(end);if(!from||!last)return null;if(last<from)throw new Error('วันที่สิ้นสุดประวัติการปฏิบัติงานต้องไม่ก่อนวันที่เริ่ม');
 const until=new Date(+last+day);
 const anchor=months=>{const first=new Date(Date.UTC(from.getUTCFullYear(),from.getUTCMonth()+months,1));const max=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();first.setUTCDate(Math.min(from.getUTCDate(),max));return first;};
 let months=(until.getUTCFullYear()-from.getUTCFullYear())*12+until.getUTCMonth()-from.getUTCMonth();if(anchor(months)>until)months--;
 return {duration_years:Math.floor(months/12),duration_months:months%12,duration_days:Math.round((until-anchor(months))/day)};
}
export function withHistoryDuration(row){const result={...row};for(const key of ['duration_years','duration_months','duration_days'])delete result[key];return {...result,...historyDuration(row.start_date,row.end_date)};}
export function refreshHistoryDuration(form,index){const start=form.elements.namedItem('history_'+index+'_start_date'),end=form.elements.namedItem('history_'+index+'_end_date');if(!start||!end)return;let result=null;end.setCustomValidity('');try{result=historyDuration(start.value,end.value);}catch(error){end.setCustomValidity(error.message);}for(const key of ['duration_years','duration_months','duration_days']){const el=form.elements.namedItem('history_'+index+'_'+key);if(el)el.value=result?.[key]??'';}}
if(typeof document!=='undefined')for(const event of ['input','change'])document.addEventListener(event,ev=>{const match=ev.target.name?.match(/^history_(\d+)_(?:start|end)_date$/);if(match&&ev.target.form)refreshHistoryDuration(ev.target.form,match[1]);});
