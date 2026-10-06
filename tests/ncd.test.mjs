import test from 'node:test';
import assert from 'node:assert/strict';
import {ncdModel} from '../src/charts/ncd.js';
const units=[{facility_code:'A',area_unit:true},{facility_code:'B',area_unit:true},{facility_code:'C',area_unit:false}];
const population=[{facility_code:'A',fiscal_year:2569,population:1000},{facility_code:'B',fiscal_year:2569,population:3000}];
const row=(code,type,count,period='2025-10-01')=>({facility_code:code,disease:'HT',fiscal_year:2569,case_type:type,case_count:count,period});
const rows=[row('A','รายเก่า',100),row('A','รายเก่า',90,'2025-11-01'),row('A','รายใหม่',10),row('A','รายใหม่',5,'2026-01-01'),row('B','รายเก่า',300),row('B','รายใหม่',0),row('C','รายเก่า',500)];
test('NCD count ranks and preserves max annual baseline, period new totals and real zero',()=>{const m=ncdModel({rows,population,units,year:2569,period:'q1',rate:false});assert.equal(m.diseases[0].old,900);assert.equal(m.diseases[0].new,10);assert.equal(m.unitRows[0].values[0],110);assert.equal(m.unitRows[1].values[0],300);});
test('NCD rates use weighted population, exclude non-area unit and preserve missing denominators',()=>{const c={rows,population,units,year:2569,period:'all',rate:true};const m=ncdModel(c);assert.equal(m.diseases[0].total,415/4000*100000);assert.equal(m.unitRows[2].values[0],'N/A');assert.equal(ncdModel({...c,population:population.slice(0,1)}).diseases[0].total,null);assert.equal(ncdModel({...c,rows:rows.filter(r=>r.facility_code!=='B')}).diseases[0].total,115/4000*100000);assert.equal(ncdModel({...c,population:[{...population[0],population:0},population[1]]}).unitRows[0].values[0],null);});
