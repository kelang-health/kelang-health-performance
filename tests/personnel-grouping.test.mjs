import test from 'node:test';import assert from 'node:assert/strict';
import {personnelGroups} from '../src/personnel/grouping.js';
test('Unit heads lead despite display order, positions group irrespective of input order',()=>{
 const m=personnelGroups([{full_name:'ข',position_name:'พยาบาลวิชาชีพ',structure_role:'member',display_order:2},{full_name:'ค',position_name:'จ้างเหมา',structure_role:'member',display_order:0},{full_name:'หัวหน้า',position_name:'พยาบาลวิชาชีพ',structure_role:'unit_head',display_order:999},{full_name:'ก',position_name:'พยาบาลวิชาชีพ',structure_role:'member',display_order:1},{full_name:'ง',position_name:'นักวิชาการสาธารณสุข',structure_role:'member'}]);
 assert.equal(m.heads[0].full_name,'หัวหน้า');assert.deepEqual(m.positions.map(g=>g.title),['นักวิชาการสาธารณสุข','พยาบาลวิชาชีพ','จ้างเหมา']);assert.deepEqual(m.positions[1].members.map(p=>p.full_name),['ก','ข']);assert.equal(m.positions.flatMap(g=>g.members).some(p=>p.structure_role==='unit_head'),false);
});
test('Position seniority alone never assigns unit head',()=>{assert.equal(personnelGroups([{position_name:'พยาบาลวิชาชีพ',position_level:'ชำนาญการพิเศษ',structure_role:'member'}]).heads.length,0);});
