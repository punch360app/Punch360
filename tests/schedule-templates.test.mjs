import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scheduleTemplateConfiguration,scheduleTemplateForm} from '../web/live/schedule-templates.js';
test('schedule templates keep only reusable cycle inputs, never dates or worker identities',()=>{
 const config=scheduleTemplateConfiguration({mode:'rotate2',days:'1,3,5',startTime:'23:00',endTime:'07:00',startTime2:'07:00',endTime2:'15:00',worker:'private-worker',first:'2026-11-02',weeks:8,note:'Nuit'});
 assert.deepEqual(config.days,[1,3,5]);assert.equal(config.worker,undefined);assert.equal(config.first,undefined);assert.equal(config.weeks,undefined);
 const form=scheduleTemplateForm({name:'Cycle',location_id:'site',department_id:null,configuration:config});assert.equal(form.days,'1,3,5');assert.equal(form.department,'');assert.equal(form.startTime,'23:00');
});
test('templates reject duplicate days, malformed hours and unique shifts',()=>{
 const good={mode:'weekly',days:'1,2',startTime:'07:00',endTime:'15:00'};
 for(const bad of [{days:'1,1'},{days:'0,8'},{startTime:'24:00'},{endTime:'07:00'},{mode:'single'}])assert.throws(()=>scheduleTemplateConfiguration({...good,...bad}));
});
