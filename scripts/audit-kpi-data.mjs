import fs from 'node:fs';
import {fetchHdc} from '../src/api/hdc/client.js';
import {facilityResults,organization} from '../src/utils/core.js';
const kpis=JSON.parse(fs.readFileSync('src/config/kpi-master.json'));
const facilities=JSON.parse(fs.readFileSync('src/config/facilities.json'));
const snapshot=await(await fetch('https://kelang-health.github.io/kelang-health-performance/data/hdc-snapshot.json')).json();
const report={checked_at:new Date().toISOString(),snapshot_generated_at:snapshot.generated_at,years:{}};
const summarize=(k,r)=>{const results=facilityResults(r.rows??[],k,facilities).filter(r=>r.eligible);const a=organization(results,k);return {kpi_id:k.kpi_id,name:k.name,table:k.table,scope:k.scope,value:a.value,complete:a.complete,expected:a.expected,rows:r.rows?.length??0,error:r.error??null,source_date:r.source_date,monthly:results.some(r=>r.series.some(p=>p.value!==null)),quarterly:results.some(r=>r.quarters?.some(p=>p.value!==null)),missing_units:results.filter(r=>r.value===null).map(r=>({code:r.facility.facility_code,name:r.facility.short_name,rows:r.row_count,numerator:r.numerator,denominator:r.denominator})),zero_units:results.filter(r=>r.value===0).map(r=>r.facility.short_name)};};
for(const year of [2568,2569,2570]){report.years[year]=kpis.map(k=>summarize(k,snapshot.datasets[`${k.table}|${year}`]??{rows:[],error:'snapshot missing'}));console.log('Snapshot',year,JSON.stringify({total:26,with_values:report.years[year].filter(k=>k.complete>0).length,missing:report.years[year].filter(k=>!k.complete).map(k=>({id:k.kpi_id,rows:k.rows,error:k.error}))}));}
for(const year of [2569,2570,2568])for(const item of report.years[year].filter(k=>!k.complete)){
 const k=kpis.find(k=>k.kpi_id===item.kpi_id);const r=await fetchHdc(k,year,facilities,true);item.live=summarize(k,r);console.log('Live',year,k.kpi_id,JSON.stringify({rows:item.live.rows,complete:item.live.complete,error:item.live.error}));await new Promise(resolve=>setTimeout(resolve,3000));
}
fs.writeFileSync('docs/kpi-data-audit.json',JSON.stringify(report,null,2));
console.log('Audit saved: docs/kpi-data-audit.json');
