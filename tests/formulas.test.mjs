import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {calculate} from '../src/utils/core.js';
const master=JSON.parse(fs.readFileSync(new URL('../src/config/kpi-master.json',import.meta.url)));
test('Healthy-height KPI uses healthy children / measured children, not measurement coverage',()=>{const k=master.find(k=>k.table==='s_kpi_height05');const row={id:k.report_id,target:1};for(let q=1;q<=4;q++){row['targetq'+q]=100;row['resultq'+q]=60;row['totalq'+q]=200;}assert.equal(calculate([row],k).value,60);assert.equal(k.target,72);assert.equal(calculate([row],k,'q1').value,60);});
test('Stunting KPI uses result1_q fields, not normal-height result3_q fields',()=>{const k=master.find(k=>k.table==='s_nutrition_10');const row={id:k.report_id};for(let q=1;q<=4;q++){row['target1_q'+q]=100;row['result1_q'+q]=5;row['result3_q'+q]=90;}assert.equal(calculate([row],k).value,5);assert.equal(k.direction,'LOWER_BETTER');assert.equal(k.target,8.5);});
test('HT follow-up primary cohort uses target_13/result_13 and current official target',()=>{const k=master.find(k=>k.table==='s_ht_screen_follow');assert.equal(calculate([{id:k.report_id,target_13:100,result_13:90,target:1000,result:500}],k).value,90);assert.equal(k.target,80);});
test('Detection of suspected developmental delay follows official higher-is-better criterion',()=>{const k=master.find(k=>k.table==='s_kpi_childdev2');assert.equal(k.direction,'HIGHER_BETTER');assert.equal(k.target,20);});
