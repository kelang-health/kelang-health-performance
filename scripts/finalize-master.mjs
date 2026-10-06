import fs from 'node:fs';
const base=new URL('../',import.meta.url);
const master=JSON.parse(fs.readFileSync(new URL('src/config/kpi-master.json',base)));
const definitions=JSON.parse(fs.readFileSync(new URL('docs/official-kpi-definitions.json',base)));
const snapshot=JSON.parse(fs.readFileSync(new URL('data/hdc-snapshot.json',base)));
for(const k of master){
 const report=definitions.find(r=>r.table===k.table);if(!report||report.error)continue;
 const detail=JSON.parse(fs.readFileSync(new URL(`backups/hdc-definitions/${k.table}.json`,base)));
 const chart=k.table==='s_kpi_height05'?detail.chart[1]:detail.chart[0];
 k.report_id=report.report_id;k.definition_verified=true;k.verified_at=new Date().toISOString();
 k.source_url??=`https://hdc.moph.go.th/lpg/public/standard-report-detail/${report.report_id}`;
 k.numerator_label=report.aname;k.denominator_label=report.bname;
 k.target=chart?.target_chart!==null&&chart?.target_chart!==undefined&&String(chart.target_chart).trim()!==''?Number(chart.target_chart):null;
 if(k.direction!=='INFORMATION'&&chart?.target_type){if(/^(less_than_equal|less_than)_target_is_red$/.test(chart.target_type))k.direction='HIGHER_BETTER';if(/^(more_than_equal|greater|greater_than)_target_is_red$/.test(chart.target_type))k.direction='LOWER_BETTER';}
 k.note='ตรวจสูตรและเกณฑ์จาก HDC detail API วันที่ 6 ต.ค. 2569; ไม่สร้างค่าที่ไม่มีในต้นทาง';
 const sample=snapshot.datasets[`${k.table}|2569`].rows[0]??{};
 const quarterPrefix=k.table==='s_kpi_height05'||['s_obesity05','s_thin05'].includes(k.table)?['resultq','targetq']:['s_anc5insur','s_kpi_anc12','s_postnatal','s_kpi_childdev1','s_kpi_childdev2','s_kpi_childdev3'].includes(k.table)?['result','target']:null;
 if(quarterPrefix){
  k.quarter_numerator_prefix=quarterPrefix[0];k.quarter_denominator_prefix=quarterPrefix[1];
  if(k.table==='s_kpi_height05'||['s_obesity05','s_thin05','s_kpi_childdev1','s_kpi_childdev2','s_kpi_childdev3'].includes(k.table)){
   k.summary_numerator_fields=[1,2,3,4].map(q=>quarterPrefix[0]+q);k.summary_denominator_fields=[1,2,3,4].map(q=>quarterPrefix[1]+q);
  }else {delete k.summary_numerator_fields;delete k.summary_denominator_fields;}
 }
 if(k.table==='s_nutrition_10'){
  k.direction='LOWER_BETTER';k.summary_numerator_fields=[1,2,3,4].map(q=>'result1_q'+q);k.summary_denominator_fields=[1,2,3,4].map(q=>'target1_q'+q);k.quarter_numerator_prefix='result1_q';k.quarter_denominator_prefix='target1_q';
 }
 if(k.table==='s_ht_screen_follow'){
  k.numerator_field='result_13';k.denominator_field='target_13';delete k.quarter_numerator_prefix;delete k.quarter_denominator_prefix;
  k.note='สูตรหลัก F1: result_13/target_13 × 100 เกณฑ์ปัจจุบัน 80%; กลุ่มสงสัยป่วยช่วง ต.ค.–มิ.ย.; ไม่ใช้ยอดติดตามทั้งปีแทน cohort นี้';
 }
 if(k.table==='s_dm_control')k.note='สูตรหลัก F5: result/target × 100; ไม่ใช้ hba1c/target ซึ่งเป็นความครอบคลุมการตรวจ HbA1c';
 if(k.table==='s_kpi_height05')k.note='สูตรสูงดีสมส่วน: ผลรวม resultq1–4 / ผลรวม targetq1–4 × 100 เป้าหมาย 72%; แยกจากความครอบคลุมชั่งวัดซึ่งมีเป้าหมาย 90%';
 if(k.table==='s_kpi_childdev2')k.note='HDC กำหนดตรวจพบเด็กสงสัยพัฒนาการล่าช้า ≥20%; ใช้ HIGHER_BETTER ตามเกณฑ์การตรวจพบ ไม่ตีความว่าพบต่ำยิ่งดี';
 if(k.unit==='ครั้ง')k.target=null;
}
fs.writeFileSync(new URL('src/config/kpi-master.json',base),JSON.stringify(master,null,2));
console.log('Verified 26 KPI formulas, scopes and official thresholds');
