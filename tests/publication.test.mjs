import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationSetting,dataStatus,shouldPublish} from '../src/utils/kpi-publication.js';
const records=v=>[{eligible:true,value:v},{eligible:false,value:null}];
test('Publication is scoped by KPI and fiscal year',()=>{const rows=[{setting_key:'kpi_publication:2569:DM',value:{mode:'hide'}}];assert.equal(publicationSetting(rows,'DM',2569).mode,'hide');assert.equal(publicationSetting(rows,'DM',2570).mode,'auto');});
test('A real zero is shown; manual hide overrides data availability',()=>{const s=dataStatus({rows:[{}]},records(0));assert.equal(shouldPublish({mode:'auto'},s),true);assert.equal(shouldPublish({mode:'hide'},s),false);});
test('Confirmed empty data hides temporarily even when enabled',()=>{const s=dataStatus({rows:[]},records(null));assert.equal(s.key,'empty');assert.equal(shouldPublish({mode:'show'},s),false);});
test('API errors are distinct from empty data and preserve usable cache',()=>{const s=dataStatus({rows:[{}],error:'HTTP 429'},records(45));assert.equal(s.key,'cached');assert.equal(shouldPublish({mode:'auto'},s),true);assert.equal(dataStatus({rows:[],error:'HTTP 429'},records(null)).key,'error');});
test('Missing denominator/period is not reported as no source rows',()=>{assert.equal(dataStatus({rows:[{target:0}]},records(null)).key,'unusable');});
