import test from 'node:test';import assert from 'node:assert/strict';import {webcrypto as crypto} from 'node:crypto';import {missingDayPayload,createMissingDaysController,employeeMissingDaysSummary} from '../web/live/missing-days.js';
import {readFileSync} from 'node:fs';
const form={worker:'worker',job:'job',start:'2026-11-01T00:00:00-04:00',end:'2026-11-01T04:00:00-05:00',reason:'Forgot overnight day',breaks:[]};
test('missing day uses explicit offsets across DST and refuses calendar errors or overlapping pauses',()=>{const p=missingDayPayload('company',form);assert.equal(Date.parse(p.p_end)-Date.parse(p.p_start),5*3600000);assert.throws(()=>missingDayPayload('company',{...form,start:'2026-02-31T08:00:00-05:00'}),/calendrier/);assert.throws(()=>missingDayPayload('company',{...form,start:'2026-11-01T00:00:00'}),/fuseau/);assert.throws(()=>missingDayPayload('company',{...form,breaks:[{start:'2026-11-01T01:00:00-04:00',end:'2026-11-01T02:00:00-05:00',paid:false},{start:'2026-11-01T01:30:00-04:00',end:'2026-11-01T02:30:00-05:00',paid:true}]}),/chevauchement/)});
const escape=s=>String(s??'').replaceAll('<','&lt;');const store=()=>{const m=new Map();return {getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
function table(){const q={data:[],error:null};for(const k of ['select','eq','order','limit'])q[k]=()=>q;return q}
test('lost response retains request identity; retry cannot create another official day',async()=>{const calls=[];let fail=true;const ui=createMissingDaysController({sb:{from:table,rpc:async(name,p)=>{calls.push({name,p});if(fail){fail=false;return {error:Error('network')}}return {data:'request'}}},redraw(){},escape,crypto,storage:store()});await ui.load({company_id:'company',role:'employee'},'user',[{id:'worker',auth_user_id:'user'}]);ui.state.form={...form};await ui.handle({dataset:{action:'missing:submit'}});assert.match(ui.state.error,/network/);await ui.handle({dataset:{action:'missing:submit'}});assert.equal(calls.length,2);assert.equal(calls[0].p.p_request,calls[1].p.p_request);assert.ok(calls.every(c=>c.name==='request_essential_missing_day'));assert.equal(ui.state.form.start,'')});
test('employee selection excludes other workers and logout clears request state',async()=>{const ui=createMissingDaysController({sb:{from:table},redraw(){},escape,crypto,storage:store()});await ui.load({company_id:'company',role:'employee'},'user',[{id:'mine',auth_user_id:'user',first_name:'Mine'},{id:'other',auth_user_id:'someone',first_name:'Private'}]);assert.deepEqual(ui.state.workers.map(w=>w.id),['mine']);assert.ok(!ui.render().includes('Private'));ui.reset();assert.equal(ui.state.company,null);assert.deepEqual(ui.state.requests,[])});

test('My Hours shows only the selected company and authenticated worker requests',()=>{
 const own={id:'req1',company_id:'company',worker_id:'mine',status:'pending',starts_at:'2026-10-27T12:00:00Z',ends_at:'2026-10-27T20:00:00Z',created_at:'2026-10-28T12:00:00Z'};
 const source={company:'company',user:'user',loaded:true,workers:[{id:'mine',auth_user_id:'user'},{id:'other',auth_user_id:'other'}],
  requests:[own,{...own,id:'req2',worker_id:'other',reason:'private colleague'},
   {...own,id:'req3',company_id:'other',reason:'private company'},
   {...own,id:'req4',status:'approved',created_at:'2026-10-29T12:00:00Z'}]};
 const actual=employeeMissingDaysSummary({companyId:'company',userId:'user',source});
 assert.equal(actual.ready,true);assert.deepEqual(actual.requests.map(x=>x.id),['req4','req1']);
 assert.deepEqual(actual.requests.map(x=>x.label),['Approuvée','En attente']);
 assert.doesNotMatch(JSON.stringify(actual),/private colleague|private company|other/);
 for(const mismatch of [
  {companyId:'other',userId:'user',source},{companyId:'company',userId:'other',source},
  {companyId:'company',userId:'user',source:{...source,loaded:false}},
  {companyId:'company',userId:'user',source:{...source,workers:[]}}
 ]){const result=employeeMissingDaysSummary(mismatch);assert.equal(result.requests.length,0);}
});
test('employee missing-day inbox is queried by worker id and reset on account change',async()=>{
 const filters=[];const sb={from:name=>{const q={data:[],error:null};
  q.select=()=>q;q.eq=(k,v)=>{filters.push([name,k,v]);return q};
  q.order=()=>q;q.limit=()=>q;return q;}};
 const ui=createMissingDaysController({sb,redraw(){},escape,crypto,storage:store()});
 await ui.load({company_id:'company',role:'employee'},'user',[{id:'mine',auth_user_id:'user'},{id:'other',auth_user_id:'else'}]);
 assert.ok(filters.some(([table,key,value])=>table==='essential_missing_days'&&key==='worker_id'&&value==='mine'));
 assert.equal(ui.state.loaded,true);
 ui.reset();assert.equal(ui.state.loaded,false);
 assert.equal(employeeMissingDaysSummary({companyId:'company',userId:'user',source:ui.state}).ready,false);
});
test('My Hours links to missing-day workflow without treating requests as payable hours',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 const begin=app.indexOf('function essentialHours()'),end=app.indexOf('function essentialCorrectionPage()',begin);
 const hours=app.slice(begin,end);
 assert.match(app,/import \{employeeMissingDaysSummary\} from '\.\/missing-days\.js'/);
 assert.match(hours,/employeeMissingDaysSummary\(\{companyId:company\(\),userId:state\.user\?\.id/);
 assert.match(hours,/data-id="missingDays"/);
 assert.match(hours,/Une demande en attente ne constitue pas des heures confirmées/);
 assert.match(hours,/Suivi de mes demandes/);
 assert.match(hours,/forgotten\.ready/);
});
