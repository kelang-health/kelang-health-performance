import fs from 'node:fs';
const base=new URL('../',import.meta.url);
const master=JSON.parse(fs.readFileSync(new URL('src/config/kpi-master.json',base)));
const snapshot=JSON.parse(fs.readFileSync(new URL('data/hdc-snapshot.json',base)));
const report=[];
for(const k of master){
 const rows=snapshot.datasets[`${k.table}|2569`]?.rows??[];const ids=[...new Set(rows.map(r=>r.id))];
 const id=k.report_id??(ids.length===1?ids[0]:null);if(!id){report.push({table:k.table,error:'no unambiguous report id'});continue;}
 try{
 const response=await fetch(`https://api-center-hdc.moph.go.th/v1/report-public/detail?reportCode=${id}&byear=2569`,{headers:{domain:'lpg',Authorization:'Bearer null'},signal:AbortSignal.timeout(25000)});const body=await response.json();const d=body.rows;if(!body.ok||!d)throw new Error('No official detail');
 fs.mkdirSync(new URL('backups/hdc-definitions/',base),{recursive:true});fs.writeFileSync(new URL(`backups/hdc-definitions/${k.table}.json`,base),JSON.stringify(d));
 const columns=d.table?.[0]?.json_column??[];
 const formulas=columns.filter(c=>c.type==='F').map(c=>({column:c.column_name,is_chart:c.is_chart,formula:c.formula}));
 const fields=columns.filter(c=>c.type!=='F').map(c=>({column:c.column_name,label:c.column_label??c.column_title??c.name??c.label}));
 const item={table:k.table,report_id:id,aname:d.aname,bname:d.bname,rate:d.rate,charts:d.chart?.map(c=>({target:c.target_chart,type:c.target_type,column:c.column_name,field:c.field})),formulas,fields};report.push(item);console.log(JSON.stringify(item));
 }catch(error){console.log(k.table,error.message);report.push({table:k.table,error:error.message});}
}
fs.writeFileSync(new URL('docs/official-kpi-definitions.json',base),JSON.stringify(report,null,2));
