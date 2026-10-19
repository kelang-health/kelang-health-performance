export const spendingYears=[2570,2569,2568,2567,2571];
export const isAnnualYear=year=>[2567,2568,2569].includes(+year);
export function spendingRoute(hash){
 const [route,query='']=hash.replace(/^#/,'').split('?');
 if(route!=='spending')return null;
 const p=new URLSearchParams(query),year=p.get('year'),unit=p.get('facility');
 return {year:year!==null&&spendingYears.includes(+year)?+year:null,unit:/^\d{5}$/.test(unit??'')?unit:null};
}
