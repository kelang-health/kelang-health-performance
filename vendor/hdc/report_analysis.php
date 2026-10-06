<?php

function hdc_analysis_numeric($value, &$valid)
{
    $valid = false;
    if (is_int($value) || is_float($value)) {
        $valid = true;
        return (float) $value;
    }
    if (is_string($value)) {
        $normalized = str_replace(',', '', trim($value));
        if ($normalized !== '' && is_numeric($normalized)) {
            $valid = true;
            return (float) $normalized;
        }
    }
    return 0.0;
}

function hdc_analysis_field_exists($rows, $field)
{
    foreach ($rows as $row) {
        if (is_array($row) && array_key_exists($field, $row)) {
            $valid = false;
            hdc_analysis_numeric($row[$field], $valid);
            if ($valid) {
                return true;
            }
        }
    }
    return false;
}

function hdc_analysis_first_field($rows, $candidates)
{
    foreach ($candidates as $candidate) {
        if (hdc_analysis_field_exists($rows, $candidate)) {
            return $candidate;
        }
    }
    return null;
}

function hdc_analysis_sum_field($rows, $field, &$present)
{
    $present = false;
    $sum = 0.0;
    if ($field === null) {
        return $sum;
    }

    foreach ($rows as $row) {
        if (!is_array($row) || !array_key_exists($field, $row)) {
            continue;
        }
        $valid = false;
        $number = hdc_analysis_numeric($row[$field], $valid);
        if ($valid) {
            $present = true;
            $sum += $number;
        }
    }
    return $sum;
}

function hdc_build_report_analysis_legacy($rows)
{
    $analysis = array(
        'has_analysis' => false,
        'mode' => 'none',
        'target' => null,
        'result' => null,
        'percentage' => null,
        'formula' => '',
        'series' => null,
        'source_fields' => array(),
    );

    if (!$rows) {
        return $analysis;
    }

    $targetPresent = false;
    $resultPresent = false;
    $annualTarget = hdc_analysis_sum_field($rows, 'target', $targetPresent);
    $annualResult = hdc_analysis_sum_field($rows, 'result', $resultPresent);

    $fiscalMonths = array(
        '10' => 'ต.ค.', '11' => 'พ.ย.', '12' => 'ธ.ค.',
        '01' => 'ม.ค.', '02' => 'ก.พ.', '03' => 'มี.ค.',
        '04' => 'เม.ย.', '05' => 'พ.ค.', '06' => 'มิ.ย.',
        '07' => 'ก.ค.', '08' => 'ส.ค.', '09' => 'ก.ย.',
    );
    $monthlyTarget = array();
    $monthlyResult = array();
    $monthlyTargetFields = array();
    $monthlyResultFields = array();
    $hasMonthlyTarget = false;
    $hasMonthlyResult = false;

    foreach ($fiscalMonths as $month => $label) {
        $targetField = hdc_analysis_first_field($rows, array('target' . $month, 'target_' . $month));
        $resultField = hdc_analysis_first_field($rows, array('result' . $month, 'result_' . $month));
        $monthTargetPresent = false;
        $monthResultPresent = false;
        $monthlyTarget[] = hdc_analysis_sum_field($rows, $targetField, $monthTargetPresent);
        $monthlyResult[] = hdc_analysis_sum_field($rows, $resultField, $monthResultPresent);
        $monthlyTargetFields[] = $targetField;
        $monthlyResultFields[] = $resultField;
        $hasMonthlyTarget = $hasMonthlyTarget || $monthTargetPresent;
        $hasMonthlyResult = $hasMonthlyResult || $monthResultPresent;
    }

    $quarterLabels = array('ไตรมาส 1', 'ไตรมาส 2', 'ไตรมาส 3', 'ไตรมาส 4');
    $quarterTarget = array();
    $quarterResult = array();
    $quarterTargetFields = array();
    $quarterResultFields = array();
    $hasQuarterTarget = false;
    $hasQuarterResult = false;

    for ($quarter = 1; $quarter <= 4; $quarter++) {
        $targetField = hdc_analysis_first_field($rows, array(
            'targetq' . $quarter,
            'target_q' . $quarter,
            'target1_q' . $quarter,
            'target1q' . $quarter,
        ));
        $resultField = hdc_analysis_first_field($rows, array(
            'resultq' . $quarter,
            'result_q' . $quarter,
            'result1_q' . $quarter,
            'result1q' . $quarter,
        ));
        $quarterTargetPresent = false;
        $quarterResultPresent = false;
        $quarterTarget[] = hdc_analysis_sum_field($rows, $targetField, $quarterTargetPresent);
        $quarterResult[] = hdc_analysis_sum_field($rows, $resultField, $quarterResultPresent);
        $quarterTargetFields[] = $targetField;
        $quarterResultFields[] = $resultField;
        $hasQuarterTarget = $hasQuarterTarget || $quarterTargetPresent;
        $hasQuarterResult = $hasQuarterResult || $quarterResultPresent;
    }

    if ($hasMonthlyTarget || $hasMonthlyResult) {
        $analysis['series'] = array(
            'type' => 'monthly',
            'labels' => array_values($fiscalMonths),
            'target' => $hasMonthlyTarget ? $monthlyTarget : null,
            'result' => $hasMonthlyResult ? $monthlyResult : null,
        );
        $analysis['source_fields']['monthly_target'] = array_values(array_filter($monthlyTargetFields));
        $analysis['source_fields']['monthly_result'] = array_values(array_filter($monthlyResultFields));
    } elseif ($hasQuarterTarget || $hasQuarterResult) {
        $analysis['series'] = array(
            'type' => 'quarterly',
            'labels' => $quarterLabels,
            'target' => $hasQuarterTarget ? $quarterTarget : null,
            'result' => $hasQuarterResult ? $quarterResult : null,
        );
        $analysis['source_fields']['quarter_target'] = array_values(array_filter($quarterTargetFields));
        $analysis['source_fields']['quarter_result'] = array_values(array_filter($quarterResultFields));
    }

    if ($targetPresent || $resultPresent) {
        $analysis['mode'] = 'annual';
        $analysis['target'] = $targetPresent ? $annualTarget : null;
        $analysis['result'] = $resultPresent ? $annualResult : null;
        $analysis['source_fields']['summary'] = array_values(array_filter(array(
            $targetPresent ? 'target' : null,
            $resultPresent ? 'result' : null,
        )));
    } elseif ($hasMonthlyTarget || $hasMonthlyResult) {
        $analysis['mode'] = 'monthly';
        $analysis['target'] = $hasMonthlyTarget ? array_sum($monthlyTarget) : null;
        $analysis['result'] = $hasMonthlyResult ? array_sum($monthlyResult) : null;
    } elseif ($hasQuarterTarget || $hasQuarterResult) {
        $analysis['mode'] = 'quarterly';
        $analysis['target'] = $hasQuarterTarget ? array_sum($quarterTarget) : null;
        $analysis['result'] = $hasQuarterResult ? array_sum($quarterResult) : null;
    }

    if ($analysis['target'] !== null && $analysis['result'] !== null && $analysis['target'] > 0) {
        $analysis['percentage'] = ($analysis['result'] / $analysis['target']) * 100;
        $analysis['formula'] = '(ผลรวม result ÷ ผลรวม target) × 100';
    }

    $analysis['has_analysis'] = $analysis['target'] !== null
        || $analysis['result'] !== null
        || $analysis['series'] !== null;

    return $analysis;
}

function hdc_analysis_all_fields($rows)
{
    $fields = array();
    foreach ($rows as $row) {
        if (is_array($row)) {
            foreach (array_keys($row) as $field) {
                $fields[$field] = true;
            }
        }
    }
    return array_keys($fields);
}

function hdc_analysis_status($percentage, $threshold, $direction)
{
    if ($percentage === null || $threshold === null || !in_array($direction, array('higher', 'lower'), true)) {
        return 'unknown';
    }
    $passes = $direction === 'lower' ? $percentage <= $threshold : $percentage >= $threshold;
    return $passes ? 'pass' : 'fail';
}

function hdc_analysis_dataset($label, $data, $color)
{
    return array(
        'label' => $label,
        'data' => array_values($data),
        'borderColor' => $color,
        'backgroundColor' => $color,
        'tension' => 0.28,
        'fill' => false,
    );
}

function hdc_analysis_period_family($rows, $prefix, $suffixes)
{
    $values = array();
    $fields = array();
    $presentCount = 0;
    foreach ($suffixes as $suffix) {
        $field = hdc_analysis_first_field($rows, array($prefix . $suffix, $prefix . '_' . $suffix));
        $present = false;
        $values[] = hdc_analysis_sum_field($rows, $field, $present);
        $fields[] = $field;
        if ($present) {
            $presentCount++;
        }
    }
    return array('values' => $values, 'fields' => array_values(array_filter($fields)), 'count' => $presentCount);
}

function hdc_analysis_period_family_flexible($rows, $prefix)
{
    $months = array(10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9);
    $values = array();
    $fields = array();
    $count = 0;
    foreach ($months as $month) {
        $plain = (string) $month;
        $padded = str_pad($plain, 2, '0', STR_PAD_LEFT);
        $field = hdc_analysis_first_field($rows, array($prefix . $padded, $prefix . $plain, $prefix . '_' . $padded, $prefix . '_' . $plain));
        $present = false;
        $values[] = hdc_analysis_sum_field($rows, $field, $present);
        if ($field) { $fields[] = $field; }
        if ($present) { $count++; }
    }
    return array('values' => $values, 'fields' => $fields, 'count' => $count);
}

function hdc_analysis_friendly_field($field)
{
    $labels = array(
        'mg' => 'ปริมาณยา (มก.)', 'dd' => 'จำนวนวันจ่ายยา', 'r_death' => 'จำนวนเสียชีวิต',
        'visit' => 'จำนวนครั้งรับบริการ', 'person' => 'จำนวนคน', 'total' => 'รวม',
    );
    return isset($labels[$field]) ? $labels[$field] : str_replace('_', ' ', $field);
}

function hdc_build_facility_comparison($rows, $options, $hospitals, $currentHospcode)
{
    $comparison = array('rows' => array(), 'chart' => null, 'available_count' => 0);
    foreach ($hospitals as $hospcode => $name) {
        $facilityRows = array();
        foreach ($rows as $row) {
            if (isset($row['hospcode']) && str_pad((string) $row['hospcode'], 5, '0', STR_PAD_LEFT) === (string) $hospcode) {
                $facilityRows[] = $row;
            }
        }
        $analysis = hdc_build_report_analysis($facilityRows, $options);
        $comparison['rows'][] = array(
            'hospcode' => (string) $hospcode,
            'name' => (string) $name,
            'has_data' => !empty($facilityRows),
            'target' => $analysis['target'],
            'result' => $analysis['result'],
            'percentage' => $analysis['percentage'],
            'status' => $analysis['status'],
            'is_current' => (string) $hospcode === (string) $currentHospcode,
        );
        if ($facilityRows) {
            $comparison['available_count']++;
        }
    }

    usort($comparison['rows'], function ($left, $right) {
        $leftValue = $left['percentage'] !== null ? $left['percentage'] : ($left['result'] !== null ? $left['result'] : -INF);
        $rightValue = $right['percentage'] !== null ? $right['percentage'] : ($right['result'] !== null ? $right['result'] : -INF);
        return $rightValue <=> $leftValue;
    });
    foreach ($comparison['rows'] as $index => &$row) {
        $row['rank'] = $row['has_data'] ? $index + 1 : null;
    }
    unset($row);

    $hasPercentage = false;
    foreach ($comparison['rows'] as $row) {
        if ($row['percentage'] !== null) { $hasPercentage = true; break; }
    }
    if ($comparison['available_count']) {
        $labels = array();
        $values = array();
        $colors = array();
        foreach ($comparison['rows'] as $row) {
            $labels[] = $row['hospcode'];
            $values[] = $hasPercentage ? $row['percentage'] : $row['result'];
            $colors[] = $row['is_current'] ? '#0d6efd' : '#14b8a6';
        }
        $comparison['chart'] = array(
            'labels' => $labels,
            'label' => $hasPercentage ? (isset($options['percentage_label']) ? $options['percentage_label'] : 'ร้อยละ') : (isset($options['result_label']) ? $options['result_label'] : 'ผลงาน'),
            'data' => $values,
            'colors' => $colors,
            'is_percentage' => $hasPercentage,
        );
    }
    return $comparison;
}

function hdc_analysis_area_rows($rows, $targetField, $resultField)
{
    $areas = array();
    foreach ($rows as $row) {
        if (!is_array($row) || !isset($row['areacode']) || trim((string) $row['areacode']) === '') {
            continue;
        }
        $code = (string) $row['areacode'];
        if (!isset($areas[$code])) {
            $areas[$code] = array('areacode' => $code, 'target' => 0.0, 'result' => 0.0, 'target_present' => false, 'result_present' => false);
        }
        foreach (array('target' => $targetField, 'result' => $resultField) as $key => $field) {
            if ($field === null || !array_key_exists($field, $row)) {
                continue;
            }
            $valid = false;
            $number = hdc_analysis_numeric($row[$field], $valid);
            if ($valid) {
                $areas[$code][$key] += $number;
                $areas[$code][$key . '_present'] = true;
            }
        }
    }
    ksort($areas, SORT_NATURAL);
    $result = array();
    foreach ($areas as $area) {
        $area['percentage'] = $area['target_present'] && $area['target'] > 0 && $area['result_present']
            ? ($area['result'] / $area['target']) * 100 : null;
        $area['label'] = strlen($area['areacode']) >= 2 ? 'หมู่ ' . (int) substr($area['areacode'], -2) : $area['areacode'];
        $result[] = $area;
    }
    return count($result) > 1 ? $result : array();
}

function hdc_build_report_analysis($rows, $options = array())
{
    $analysis = array(
        'has_analysis' => false, 'mode' => 'none', 'target' => null, 'result' => null,
        'percentage' => null, 'formula' => '', 'series' => null, 'source_fields' => array(),
        'charts' => array(), 'area_rows' => array(), 'threshold' => null,
        'direction' => isset($options['direction']) ? $options['direction'] : 'higher',
        'status' => 'unknown', 'target_label' => isset($options['target_label']) ? $options['target_label'] : 'กลุ่มเป้าหมาย',
        'result_label' => isset($options['result_label']) ? $options['result_label'] : 'ผลงาน',
        'percentage_label' => isset($options['percentage_label']) ? $options['percentage_label'] : 'ร้อยละ',
    );
    if (!$rows) {
        return $analysis;
    }

    $targetField = hdc_analysis_first_field($rows, array('target', 'denominator', 'b'));
    $resultField = hdc_analysis_first_field($rows, array('result', 'numerator', 'a'));
    $targetPresent = false;
    $resultPresent = false;
    $annualTarget = hdc_analysis_sum_field($rows, $targetField, $targetPresent);
    $annualResult = hdc_analysis_sum_field($rows, $resultField, $resultPresent);

    $monthSuffixes = array('10', '11', '12', '01', '02', '03', '04', '05', '06', '07', '08', '09');
    $monthLabels = array('ต.ค.', 'พ.ย.', 'ธ.ค.', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.');
    $targetMonthly = hdc_analysis_period_family($rows, 'target', $monthSuffixes);
    $resultMonthly = hdc_analysis_period_family($rows, 'result', $monthSuffixes);
    $hasMonthlyPair = $targetMonthly['count'] >= 6 || $resultMonthly['count'] >= 6;

    if ($hasMonthlyPair) {
        $datasets = array();
        if ($targetMonthly['count'] > 0) {
            $datasets[] = hdc_analysis_dataset($analysis['target_label'], $targetMonthly['values'], '#94a3b8');
        }
        if ($resultMonthly['count'] > 0) {
            $datasets[] = hdc_analysis_dataset($analysis['result_label'], $resultMonthly['values'], '#0f766e');
        }
        $analysis['charts'][] = array('type' => 'monthly', 'chart_type' => 'line', 'title' => 'แนวโน้มรายเดือน (ปีงบประมาณ)', 'labels' => $monthLabels, 'datasets' => $datasets);
        $analysis['series'] = array(
            'type' => 'monthly', 'labels' => $monthLabels,
            'target' => $targetMonthly['count'] > 0 ? $targetMonthly['values'] : null,
            'result' => $resultMonthly['count'] > 0 ? $resultMonthly['values'] : null,
        );
        $analysis['source_fields']['monthly_target'] = $targetMonthly['fields'];
        $analysis['source_fields']['monthly_result'] = $resultMonthly['fields'];
    }

    $monthlyPrefixes = array();
    foreach (hdc_analysis_all_fields($rows) as $field) {
        if (preg_match('/^(.+?)(?:_)?(0[1-9]|1[0-2]|[1-9])$/', $field, $match)) {
            $prefix = rtrim($match[1], '_');
            if (!in_array($prefix, array('target', 'result'), true)) {
                $monthlyPrefixes[$prefix] = true;
            }
        }
    }
    $extraMonthlyCharts = 0;
    foreach (array_keys($monthlyPrefixes) as $prefix) {
        $family = hdc_analysis_period_family_flexible($rows, $prefix);
        if ($family['count'] < 6 || $extraMonthlyCharts >= 3) {
            continue;
        }
        $analysis['charts'][] = array(
            'type' => 'monthly', 'chart_type' => 'line',
            'title' => 'แนวโน้มรายเดือน: ' . hdc_analysis_friendly_field($prefix),
            'labels' => $monthLabels,
            'datasets' => array(hdc_analysis_dataset(hdc_analysis_friendly_field($prefix), $family['values'], '#7c3aed')),
        );
        $analysis['source_fields']['monthly_' . $prefix] = $family['fields'];
        $extraMonthlyCharts++;
    }

    $quarterLabels = array('ไตรมาส 1', 'ไตรมาส 2', 'ไตรมาส 3', 'ไตรมาส 4');
    $quarterTarget = array();
    $quarterResult = array();
    $quarterFields = array('target' => array(), 'result' => array());
    $hasQuarterTarget = false;
    $hasQuarterResult = false;
    for ($q = 1; $q <= 4; $q++) {
        $qt = hdc_analysis_first_field($rows, array('targetq' . $q, 'target_q' . $q, 'target1q' . $q, 'target1_q' . $q));
        $qr = hdc_analysis_first_field($rows, array('resultq' . $q, 'result_q' . $q, 'result1q' . $q, 'result1_q' . $q));
        $tp = false;
        $rp = false;
        $quarterTarget[] = hdc_analysis_sum_field($rows, $qt, $tp);
        $quarterResult[] = hdc_analysis_sum_field($rows, $qr, $rp);
        if ($qt) { $quarterFields['target'][] = $qt; }
        if ($qr) { $quarterFields['result'][] = $qr; }
        $hasQuarterTarget = $hasQuarterTarget || $tp;
        $hasQuarterResult = $hasQuarterResult || $rp;
    }
    if (!$hasQuarterTarget && !$hasQuarterResult && !$hasMonthlyPair) {
        $fallbackTarget = array();
        $fallbackResult = array();
        $fallbackTargetPresent = 0;
        $fallbackResultPresent = 0;
        for ($q = 1; $q <= 4; $q++) {
            $qt = hdc_analysis_first_field($rows, array('target' . $q, 'target_' . $q));
            $qr = hdc_analysis_first_field($rows, array('result' . $q, 'result_' . $q));
            $tp = false;
            $rp = false;
            $fallbackTarget[] = hdc_analysis_sum_field($rows, $qt, $tp);
            $fallbackResult[] = hdc_analysis_sum_field($rows, $qr, $rp);
            if ($tp) { $fallbackTargetPresent++; $quarterFields['target'][] = $qt; }
            if ($rp) { $fallbackResultPresent++; $quarterFields['result'][] = $qr; }
        }
        if ($fallbackTargetPresent === 4 || $fallbackResultPresent === 4) {
            $quarterTarget = $fallbackTarget;
            $quarterResult = $fallbackResult;
            $hasQuarterTarget = $fallbackTargetPresent === 4;
            $hasQuarterResult = $fallbackResultPresent === 4;
        }
    }
    if (!$hasQuarterTarget && !$hasQuarterResult && $hasMonthlyPair && !empty($options['derive_quarters'])) {
        for ($q = 0; $q < 4; $q++) {
            $quarterTarget[$q] = array_sum(array_slice($targetMonthly['values'], $q * 3, 3));
            $quarterResult[$q] = array_sum(array_slice($resultMonthly['values'], $q * 3, 3));
        }
        $hasQuarterTarget = $targetMonthly['count'] > 0;
        $hasQuarterResult = $resultMonthly['count'] > 0;
    }
    if ($hasQuarterTarget || $hasQuarterResult) {
        $datasets = array();
        if ($hasQuarterTarget) { $datasets[] = hdc_analysis_dataset($analysis['target_label'], $quarterTarget, '#94a3b8'); }
        if ($hasQuarterResult) { $datasets[] = hdc_analysis_dataset($analysis['result_label'], $quarterResult, '#2563eb'); }
        $analysis['charts'][] = array('type' => 'quarterly', 'chart_type' => 'bar', 'title' => 'ผลงานรายไตรมาส', 'labels' => $quarterLabels, 'datasets' => $datasets);
        $analysis['source_fields']['quarter_target'] = $quarterFields['target'];
        $analysis['source_fields']['quarter_result'] = $quarterFields['result'];
        if ($analysis['series'] === null) {
            $analysis['series'] = array('type' => 'quarterly', 'labels' => $quarterLabels, 'target' => $hasQuarterTarget ? $quarterTarget : null, 'result' => $hasQuarterResult ? $quarterResult : null);
        }
    }

    if ($targetPresent || $resultPresent) {
        $analysis['mode'] = 'annual';
        $analysis['target'] = $targetPresent ? $annualTarget : null;
        $analysis['result'] = $resultPresent ? $annualResult : null;
        $analysis['source_fields']['summary'] = array_values(array_filter(array($targetField, $resultField)));
    } elseif ($hasMonthlyPair) {
        $analysis['mode'] = 'monthly';
        $analysis['target'] = $targetMonthly['count'] ? array_sum($targetMonthly['values']) : null;
        $analysis['result'] = $resultMonthly['count'] ? array_sum($resultMonthly['values']) : null;
    } elseif ($hasQuarterTarget || $hasQuarterResult) {
        $analysis['mode'] = 'quarterly';
        $analysis['target'] = $hasQuarterTarget ? array_sum($quarterTarget) : null;
        $analysis['result'] = $hasQuarterResult ? array_sum($quarterResult) : null;
    }

    if ($analysis['target'] !== null && $analysis['result'] !== null && $analysis['target'] > 0) {
        $analysis['percentage'] = ($analysis['result'] / $analysis['target']) * 100;
        $analysis['formula'] = !empty($options['formula']) ? (string) $options['formula'] : '(A ÷ B) × 100';
    }
    $analysis['threshold'] = isset($options['threshold']) && is_numeric($options['threshold']) ? (float) $options['threshold'] : null;
    $analysis['status'] = hdc_analysis_status($analysis['percentage'], $analysis['threshold'], $analysis['direction']);
    $analysis['area_rows'] = hdc_analysis_area_rows($rows, $targetField, $resultField);
    if ($analysis['area_rows']) {
        $labels = array();
        $values = array();
        $hasAreaPercentage = false;
        foreach ($analysis['area_rows'] as $area) {
            if ($area['percentage'] !== null) { $hasAreaPercentage = true; break; }
        }
        foreach ($analysis['area_rows'] as $area) {
            $labels[] = $area['label'];
            $values[] = $hasAreaPercentage ? $area['percentage'] : ($area['result_present'] ? $area['result'] : ($area['target_present'] ? $area['target'] : null));
        }
        $analysis['charts'][] = array(
            'type' => 'area', 'chart_type' => 'bar', 'title' => 'เปรียบเทียบผลงานรายหมู่บ้าน',
            'labels' => $labels, 'datasets' => array(hdc_analysis_dataset($hasAreaPercentage ? $analysis['percentage_label'] : $analysis['result_label'], $values, '#f59e0b')),
        );
    }
    $analysis['has_analysis'] = $analysis['target'] !== null || $analysis['result'] !== null || $analysis['series'] !== null || !empty($analysis['charts']);
    return $analysis;
}

function hdc_analysis_number($value, $decimals)
{
    if ($value === null) {
        return 'ไม่มีข้อมูล';
    }
    $decimals = $decimals === null ? 0 : (int) $decimals;
    return number_format((float) $value, $decimals);
}
