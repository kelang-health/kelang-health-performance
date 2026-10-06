<?php

function hdc_report_definitions()
{
    static $definitions = null;
    if ($definitions !== null) {
        return $definitions;
    }
    $definitions = array(
        's_ht_screen_follow' => array(
            'b57439ff27302ade8c38d1dd189644a4' => array(
                'title' => 'ร้อยละการตรวจติดตามยืนยันวินิจฉัยกลุ่มสงสัยป่วยโรคความดันโลหิตสูง',
                'category' => 'ข้อมูลตอบสนอง Service Plan / ข้อมูลเพื่อตอบสนอง Service Plan สาขาโรคไม่ติดต่อ (NCD DM,HT,CVD)',
                'report_id' => 'b57439ff27302ade8c38d1dd189644a4',
                'subcatalog_id' => 'b2b59e64c4e6c92d4b1ec16a599d882b',
                'target_label' => 'จำนวนประชากรอายุ 35 ปี ขึ้นไป ในเขตรับผิดชอบที่ยังไม่ได้รับการวินิจฉัยว่าเป็นโรคความดันโลหิตสูง ได้รับการคัดกรองโรคความดันโลหิตสูงและเป็นกลุ่มสงสัยป่วยโรคความดันโลหิตสูง (สะสมตั้งแต่วันที่ 1 ตุลาคม - 30 มิถุนายน)',
                'result_label' => 'จำนวนประชากรใน B ที่ได้รับการตรวจติดตามยืนยันวินิจฉัยโดยทำ HBPM หรือ OBPM ภายใน 1 - 90 วัน ก่อนสิ้นปีงบประมาณ (ไม่นับซ้ำ)',
                'percentage_label' => 'ร้อยละการตรวจติดตามยืนยัน',
                'threshold' => 85.0,
                'direction' => 'higher',
                'rate' => 100.0,
                'formula' => '(#{result}/#{target})*100',
                'period' => 'annual',
                'derive_quarters' => false,
                'source_table' => 's_ht_screen_follow',
                'display_levels' => array('zone', 'province', 'ampur', 'tambon', 'moo', 'hospital', 'provider', 'cup', 'service_plan', 'service_plan_hospital'),
                'source_url' => 'https://hdc.moph.go.th/lpg/public/standard-report-detail/b57439ff27302ade8c38d1dd189644a4?subcatalogId=b2b59e64c4e6c92d4b1ec16a599d882b',
                'note' => 'A = ผู้สงสัยป่วย HT ใน B ที่ได้รับการตรวจติดตามยืนยันวินิจฉัยด้วย HBPM หรือ OBPM ภายใน 1-90 วัน และไม่นับซ้ำ. เกณฑ์ตัวชี้วัดไม่น้อยกว่าร้อยละ 85.',
                'verified_at' => '2026-09-08T10:42:00+07:00',
            ),
        ),
        's_epi_complete' => array(
            '28dd2c7955ce926456240b2ff0100bde' => array(
                'title' => 'ความครอบคลุมการได้รับวัคซีนครบตามเกณฑ์ในเด็กอายุครบ 1 ปี',
                'category' => 'แม่ เด็ก และวัยรุ่น',
                'report_id' => '28dd2c7955ce926456240b2ff0100bde',
                'target_label' => 'เด็กอายุครบ 1 ปีในพื้นที่รับผิดชอบ (B)',
                'result_label' => 'ได้รับวัคซีนครบตามเกณฑ์ (A)',
                'percentage_label' => 'ความครอบคลุม',
                'threshold' => 90.0,
                'direction' => 'higher',
                'rate' => 100.0,
                'formula' => '(#{result}/#{target})*100',
                'period' => 'monthly',
                'derive_quarters' => true,
                'source_table' => 's_epi_complete',
                'display_levels' => array('zone', 'province', 'ampur', 'tambon', 'moo', 'hospital', 'provider', 'cup', 'service_plan', 'service_plan_hospital'),
                'source_url' => 'https://hdc.moph.go.th/lpg/public/standard-report-detail/28dd2c7955ce926456240b2ff0100bde?subcatalogId=4df360514655f79f13901ef1181ca1c7',
                'note' => 'A = เด็กที่ได้รับวัคซีนครบตามเกณฑ์, B = เด็กอายุครบ 1 ปีในเขตรับผิดชอบ (Typearea 1 และ 3)',
                'verified_at' => '2026-08-27T00:00:00+07:00',
            ),
        ),
    );

    $path = __DIR__ . '/../data/hdc_kpi_verified.json';
    if (is_readable($path)) {
        $audit = json_decode(file_get_contents($path), true);
        $reports = isset($audit['reports']) && is_array($audit['reports']) ? $audit['reports'] : array();
        foreach ($reports as $report) {
            if (empty($report['table']) || empty($report['report_id'])) {
                continue;
            }
            $definitions[$report['table']][$report['report_id']] = $report;
        }
    }
    return $definitions;
}

function hdc_verified_report_audit()
{
    $path = __DIR__ . '/../data/hdc_kpi_verified.json';
    if (!is_readable($path)) {
        return array('summary' => array(), 'reports' => array(), 'unmatched' => array());
    }
    $decoded = json_decode(file_get_contents($path), true);
    return is_array($decoded) ? $decoded : array('summary' => array(), 'reports' => array(), 'unmatched' => array());
}

function hdc_reference_only_reports()
{
    return array(
        's_labor1014' => array(
            'title' => 'การเฝ้าระวังอัตราการคลอดมีชีพในหญิงอายุ 10-14 ปี (adjusted)',
            'report_id' => '782a6749bd5608ecaf7ab67f0e3f3abd',
            'source_table' => 's_labor1014n',
            'source_url' => 'https://hdc.moph.go.th/lpg/public/standard-report-detail/782a6749bd5608ecaf7ab67f0e3f3abd?subcatalogId=1ed90bc32310b503b7ca9b32af425ae5',
            'reason' => 'HDC หลักใช้ตารางรุ่นปรับแล้ว s_labor1014n และสูตรอัตราส่วนปรับ (adjusted) จึงไม่ควรใช้เกณฑ์กับตาราง s_labor1014 เดิมโดยตรง',
        ),
        's_labor1519' => array(
            'title' => 'การเฝ้าระวังอัตราการคลอดมีชีพในหญิงอายุ 15-19 ปี (adjusted)',
            'report_id' => 'eefd31ab993640a98206360a843fbe37',
            'source_table' => 's_labor1519n',
            'source_url' => 'https://hdc.moph.go.th/lpg/public/standard-report-detail/eefd31ab993640a98206360a843fbe37?subcatalogId=1ed90bc32310b503b7ca9b32af425ae5',
            'reason' => 'HDC หลักใช้ตารางรุ่นปรับแล้ว s_labor1519n และสูตรอัตราส่วนปรับ (adjusted) จึงไม่ควรใช้เกณฑ์กับตาราง s_labor1519 เดิมโดยตรง',
        ),
        's_dm_hba1c_35year' => array(
            'title' => 'ร้อยละผู้ป่วยเบาหวานที่ได้รับการตรวจ HbA1c อย่างน้อย 1 ครั้ง/ปี',
            'report_id' => 'fdc28cd7317936b7b734cec34103524c',
            'source_table' => 's_dm_hba1c',
            'source_url' => 'https://hdc.moph.go.th/lpg/public/standard-report-detail/fdc28cd7317936b7b734cec34103524c?subcatalogId=b2b59e64c4e6c92d4b1ec16a599d882b',
            'reason' => 'HDC หลักใช้ตาราง s_dm_hba1c ขณะที่ API นี้เป็น s_dm_hba1c_35year แม้สูตร A/B × 100 และเกณฑ์อ้างอิง 70% จะสอดคล้องกัน จึงแสดงเป็นข้อมูลอ้างอิง ไม่ตัดสินผ่าน/ไม่ผ่านอัตโนมัติ',
        ),
    );
}

function hdc_report_definition($table, $reportId = '')
{
    $definitions = hdc_report_definitions();
    if (!isset($definitions[$table])) {
        return array();
    }
    if ($reportId !== '' && isset($definitions[$table][$reportId])) {
        return $definitions[$table][$reportId];
    }
    if (count($definitions[$table]) === 1) {
        return reset($definitions[$table]);
    }
    return array();
}

function hdc_supplemental_catalog_reports()
{
    $items = array();
    $specs = array(
        array('table'=>'s_ht_screen_follow','report_id'=>'b57439ff27302ade8c38d1dd189644a4','row_count'=>1,'field_count'=>33),
        array('table'=>'s_epi_complete','report_id'=>'28dd2c7955ce926456240b2ff0100bde','row_count'=>8,'field_count'=>32),
    );
    foreach ($specs as $spec) {
        $definition = hdc_report_definition($spec['table'], $spec['report_id']);
        if (!$definition) continue;
        $items[] = array(
            'table' => $spec['table'],
            'report_id' => $definition['report_id'],
            'title' => $definition['title'],
            'category' => $definition['category'],
            'row_count' => $spec['row_count'],
            'field_count' => $spec['field_count'],
            'latest_date' => '',
            'dataset_url' => $definition['source_url'],
            'metadata_modified' => '',
            'verified_source' => true,
        );
    }
    return $items;
}
