import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const audit=JSON.parse(fs.readFileSync(new URL('data/hdc_kpi_verified.json',root)));
const inputs=[
 ['s_dm_screen_risk','คัดกรองเบาหวาน อายุ 35 ปีขึ้นไป','NCD','AREA'],
 ['s_ht_screen_risk','คัดกรองความดันโลหิตสูง อายุ 35 ปีขึ้นไป','NCD','AREA'],
 ['s_dm_control','ผู้ป่วยเบาหวานควบคุมน้ำตาลได้ดี','NCD','AREA'],
 ['s_ht_control','ผู้ป่วยความดันโลหิตสูงควบคุมได้ดี','NCD','AREA'],
 ['s_ht_screen_follow','ติดตามยืนยันกลุ่มสงสัยความดันโลหิตสูง','NCD','AREA'],
 ['s_epi_complete','วัคซีนครบตามเกณฑ์ เด็กอายุ 1 ปี','แม่และเด็ก','AREA'],
 ['s_anc5insur','ฝากครรภ์ครบ 5 ครั้ง','แม่และเด็ก','AREA'],
 ['s_kpi_anc12','ฝากครรภ์ครั้งแรกภายใน 12 สัปดาห์','แม่และเด็ก','AREA'],
 ['s_postnatal','ดูแลหลังคลอดครบ 3 ครั้ง','แม่และเด็ก','AREA'],
 ['s_child','ทารกแรกเกิดน้ำหนักน้อย','แม่และเด็ก','AREA','LOWER_BETTER'],
 ['s_kpi_childdev1','คัดกรองพัฒนาการเด็ก','แม่และเด็ก','AREA'],
 ['s_kpi_childdev2','เด็กสงสัยพัฒนาการล่าช้า','แม่และเด็ก','AREA','LOWER_BETTER'],
 ['s_kpi_childdev3','ติดตามเด็กสงสัยพัฒนาการล่าช้า','แม่และเด็ก','AREA'],
 ['s_kpi_height05','เด็ก 0–5 ปี สูงดีสมส่วน','โภชนาการ','AREA'],
 ['s_ferrous6_5','เด็ก 6 เดือน–5 ปีได้รับธาตุเหล็ก','โภชนาการ','AREA'],
 ['s_ferrous6_12','เด็ก 6–12 ปีได้รับธาตุเหล็ก','โภชนาการ','AREA'],
 ['s_nutrition_09','น้ำหนักตามเกณฑ์อายุเด็ก 0–5 ปี','โภชนาการ','AREA'],
 ['s_nutrition_10','เด็ก 0–5 ปีมีภาวะเตี้ย','โภชนาการ','AREA','LOWER_BETTER'],
 ['s_obesity05','เด็กปฐมวัยมีภาวะอ้วน','โภชนาการ','AREA','LOWER_BETTER'],
 ['s_thin05','เด็กปฐมวัยมีภาวะผอม','โภชนาการ','AREA','LOWER_BETTER'],
 ['s_kpi_food','เด็กอายุต่ำกว่า 6 เดือนกินนมแม่','แม่และเด็ก','AREA'],
 ['s_breast_screen','คัดกรองมะเร็งเต้านม','NCD','AREA'],
 ['s_ageing','ประเมินกิจวัตรประจำวันผู้สูงอายุ','ผู้สูงอายุ','AREA'],
 ['s_aged9','คัดกรองผู้สูงอายุ 9 ด้าน','ผู้สูงอายุ','AREA'],
 ['s_opd_all','ผู้รับบริการผู้ป่วยนอก (OPD)','บริการ','SERVICE','INFORMATION','ครั้ง'],
 ['s_dental_2','บริการทันตกรรม','บริการ','SERVICE','INFORMATION','ครั้ง']
];
const quarterTables=['s_anc5insur','s_kpi_anc12','s_postnatal'];
const mapped={
 s_kpi_childdev1:{summary_denominator_fields:['target1','target2','target3','target4'],summary_numerator_fields:['result1','result2','result3','result4']},
 s_kpi_childdev2:{summary_denominator_fields:['target1','target2','target3','target4'],summary_numerator_fields:['result1','result2','result3','result4']},
 s_kpi_childdev3:{summary_denominator_fields:['target1','target2','target3','target4'],summary_numerator_fields:['result1','result2','result3','result4']},
 s_kpi_height05:{summary_denominator_fields:['totalq1','totalq2','totalq3','totalq4'],summary_numerator_fields:['targetq1','targetq2','targetq3','targetq4'],quarter_denominator_prefix:'totalq',quarter_numerator_prefix:'targetq'},
 s_ferrous6_12:{summary_denominator_fields:['target1','target2'],summary_numerator_fields:['result1','result2']},
 s_nutrition_09:{summary_denominator_fields:['target1_q1','target1_q2','target1_q3','target1_q4'],summary_numerator_fields:['result3_q1','result3_q2','result3_q3','result3_q4'],quarter_denominator_prefix:'target1_q',quarter_numerator_prefix:'result3_q'}
};
const master=inputs.map(([table,name,category,scope,direction,unit])=>{
 const verified=audit.reports.find(r=>r.table===table);
 const result={kpi_id:table.toUpperCase(),name,category,scope,unit:unit??'%',direction:direction??'HIGHER_BETTER',target:verified?.threshold??null,source:'HDC',table,report_id:verified?.report_id??null,numerator_field:'result',denominator_field:unit==='ครั้ง'?null:'target',rate:100,source_url:verified?.source_url??null,definition_verified:!!verified,note:verified?.note??'สูตรอ้างอิงการแสดงผลระบบ HDC เดิม; ไม่ประเมินผ่านเป้าจนกว่าจะมีเกณฑ์ยืนยัน',...(mapped[table]??{})};
 if(table==='s_ht_screen_follow'){result.report_id='b57439ff27302ade8c38d1dd189644a4';result.target=85;result.definition_verified=true;result.source_url='https://hdc.moph.go.th/lpg/public/standard-report-detail/b57439ff27302ade8c38d1dd189644a4?subcatalogId=b2b59e64c4e6c92d4b1ec16a599d882b';result.quarter_numerator_prefix='r_q';result.quarter_denominator_prefix='t_q';}
 if(quarterTables.includes(table)){result.quarter_numerator_prefix='resultq';result.quarter_denominator_prefix='targetq';result.summary_numerator_fields=[1,2,3,4].map(q=>'resultq'+q);result.summary_denominator_fields=[1,2,3,4].map(q=>'targetq'+q);}
 if(table==='s_dm_control')result.note='ตรวจ detail API จริง: ใช้ F5 is_chart=1 result/target*rate; F3 hba1c/target เป็นการตรวจ HbA1c ไม่ใช่ผลควบคุม';
 return result;
});
fs.writeFileSync(new URL('src/config/kpi-master.json',root),JSON.stringify(master,null,2));
fs.writeFileSync(new URL('src/config/report-inventory.json',root),JSON.stringify(audit.reports.map(r=>({table:r.table,title:r.title,source_url:r.source_url,integrated:master.some(k=>k.table===r.table)})),null,2));
console.log(`${master.length} KPI master entries; ${audit.reports.length} report inventory entries`);
