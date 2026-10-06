<?php
// Original HDC App analyzer, isolated from its production config and sessions.
require_once __DIR__ . '/../vendor/hdc/report_analysis.php';
$input = json_decode(stream_get_contents(STDIN), true);
$output = array();
foreach ($input as $dataset) {
    $output[$dataset['key']] = hdc_build_report_analysis($dataset['rows']);
}
echo json_encode($output, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
