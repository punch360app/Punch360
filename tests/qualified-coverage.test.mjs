import {test} from 'node:test';
import assert from 'node:assert/strict';
import {coverageLocal,createQualifiedCoverageController,summarizeCoverageDemand} from '../web/live/qualified-coverage.js';
const escape=v=>String(v??'').replaceAll('<','&lt;');
function fixture(){const calls=[];let resolve,delay=false;const rule={id:'r',department_id:'d',title:'<Night>',certificate_title:'First aid',starts_at:'2026-11-01T03:00:00Z',ends_at:'2026-11-01T08:00:00Z',version:2,minimum_staff:1,active:true};const ui=createQualifiedCoverageController({escape,redraw(){},sb:{from(){return{select(){return this},eq(){return this},order(){return this},limit(){return Promise.resolve({data:[rule]})}}},async rpc(name,args){calls.push({name,args});if(name==='essential_entitlements')return{data:{features:['minimum_coverage']}};if(name==='essential_hr_access')return{data:{certifications:true}};if(name==='qualified_coverage_report'){if(delay)await new Promise(r=>resolve=r);return{data:{rules:1,gap_count:1,truncated:true,notice:'<Review>',gaps:[{...rule,department_name:'<Team>',staffed:0,timezone:'America/Toronto'}]}}}if(name==='essential_planning_report')return{data:{vacant_shifts:2,planned_gross_ms:36000000,coverage_gaps:[{name:'Team'}]}};return{data:'r'}}}});return{ui,calls,delay(){delay=true},release(){resolve()}}}
const load=ui=>ui.load({company_id:'c',role:'boss'},[{id:'d',name:'Team',active:true,location_id:'l'}],[{id:'l',timezone:'America/Toronto'}]);
test('qualification coverage edits preserve department local wall times across DST and expected versions',async()=>{const{ui,calls}=fixture();assert.equal(coverageLocal('2026-11-01T03:00:00Z','America/Toronto'),'2026-10-31T23:00');await load(ui);await ui.handle({dataset:{action:'qualified:edit',id:'r'}});ui.input({id:'qualified-reason',value:'Updated staffing'});await ui.handle({dataset:{action:'qualified:save'}});const args=calls.find(c=>c.name==='save_qualified_coverage').args;assert.equal(args.p_start_local,'2026-10-31T23:00');assert.equal(args.p_end_local,'2026-11-01T03:00');assert.equal(args.p_version,2);assert.equal(args.p_department,'d');ui.input({id:'qualified-minimum',value:'1.5'});await ui.handle({dataset:{action:'qualified:save'}});assert.equal(calls.filter(c=>c.name==='save_qualified_coverage').length,1)});
test('coverage renders incomplete interval totals and escaped qualification labels',async()=>{const{ui}=fixture();await load(ui);await ui.handle({dataset:{action:'qualified:report',id:'r'}});assert.match(ui.render(),/2000 premiers/);assert.match(ui.render(),/&lt;Night>/);assert.match(ui.render(),/&lt;Team>/);assert.match(ui.render(),/0\/1/)});
test('coverage report rejects duplicate submissions and discards late response on logout',async()=>{const{ui,calls,delay,release}=fixture();await load(ui);delay();const pending=ui.handle({dataset:{action:'qualified:report',id:'r'}});await ui.handle({dataset:{action:'qualified:report',id:'r'}});assert.equal(calls.filter(c=>c.name==='qualified_coverage_report').length,1);ui.reset();release();await pending;assert.equal(ui.state.report,null);assert.deepEqual(ui.state.rules,[])});

test('manager gets real qualification gaps plus independently computed vacant shifts and planned hours',async()=>{
 const {ui,calls}=fixture();
 await load(ui);
 await ui.handle({dataset:{action:'qualified:report',id:'r'}});
 assert.equal(calls.filter(x=>x.name==='qualified_coverage_report').length,1);
 const plan=calls.find(x=>x.name==='essential_planning_report');
 assert.equal(plan.args.p_company,'c');
 assert.equal(plan.args.p_start,'2026-11-01T03:00:00Z');
 const summary=summarizeCoverageDemand(ui.state.report,ui.state.planningReport);
 assert.equal(summary.gapCount,1);
 assert.equal(summary.missingStaffHours,5);
 assert.equal(summary.vacantShifts,2);
 assert.equal(summary.plannedHours,10);
 assert.equal(summary.departmentGaps,1);
 assert.equal(summary.truncated,true);
 const html=ui.render();
 assert.match(html,/Besoins et couverture consolidés/);
 assert.match(html,/Quarts à combler dans la période/);
 assert.match(html,/Heures planifiées affectées/);
 assert.match(html,/Copier la plage/);
});
test('copying an existing requirement reuses its times but creates a new row without modifying original',async()=>{
 const {ui,calls}=fixture();
 await load(ui);
 await ui.handle({dataset:{action:'qualified:copy',id:'r'}});
 assert.equal(ui.state.editing,null);
 assert.equal(ui.state.title,'<Night>');
 assert.equal(ui.state.certificate,'First aid');
 assert.equal(ui.state.start,'2026-10-31T23:00');
 assert.equal(ui.state.reason,'');
 ui.input({id:'qualified-reason',value:'Another morning coverage window'});
 ui.input({id:'qualified-start',value:'2026-11-02T07:00'});
 ui.input({id:'qualified-end',value:'2026-11-02T12:00'});
 await ui.handle({dataset:{action:'qualified:save'}});
 const save=calls.find(x=>x.name==='save_qualified_coverage');
 assert.equal(save.args.p_id,null);
 assert.equal(save.args.p_version,0);
 assert.equal(save.args.p_start_local,'2026-11-02T07:00');
 assert.equal(save.args.p_end_local,'2026-11-02T12:00');
 assert.equal(save.args.p_title,'<Night>');
 assert.equal(save.args.p_minimum,1);
});
test('summary never calls incomplete coverage numbers zero and respects truncation',()=>{
 assert.equal(summarizeCoverageDemand(null,{vacant_shifts:2}),null);
 const s=summarizeCoverageDemand({gap_count:3,truncated:true,gaps:[
  {starts_at:'2026-11-02T08:00:00Z',ends_at:'2026-11-02T10:00:00Z',staffed:1,minimum_staff:3},
  {starts_at:'bad',ends_at:'2026-11-02T10:00:00Z',staffed:0,minimum_staff:2}
 ]},null);
 assert.equal(s.missingStaffHours,4);
 assert.equal(s.vacantShifts,null);
 assert.equal(s.truncated,true);
});
