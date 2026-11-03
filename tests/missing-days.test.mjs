import test from 'node:test';import assert from 'node:assert/strict';import {webcrypto as crypto} from 'node:crypto';import {missingDayPayload,createMissingDaysController,employeeMissingDaysSummary,managerMissingDayApprovalSummary} from '../web/live/missing-days.js';
import {readFileSync} from 'node:fs';
const form={worker:'worker',job:'job',start:'2026-11-01T00:00:00-04:00',end:'2026-11-01T04:00:00-05:00',reason:'Forgot overnight day',breaks:[]};
test('missing day uses explicit offsets across DST and refuses calendar errors or overlapping pauses',()=>{const p=missingDayPayload('company',form);assert.equal(Date.parse(p.p_end)-Date.parse(p.p_start),5*3600000);assert.throws(()=>missingDayPayload('company',{...form,start:'2026-02-31T08:00:00-05:00'}),/calendrier/);assert.throws(()=>missingDayPayload('company',{...form,start:'2026-11-01T00:00:00'}),/fuseau/);assert.throws(()=>missingDayPayload('company',{...form,breaks:[{start:'2026-11-01T01:00:00-04:00',end:'2026-11-01T02:00:00-05:00',paid:false},{start:'2026-11-01T01:30:00-04:00',end:'2026-11-01T02:30:00-05:00',paid:true}]}),/chevauchement/)});
const escape=s=>String(s??'').replaceAll('<','&lt;');const store=()=>{const m=new Map();return {getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}};
function table(name){const q={data:name==='jobs'?[{id:'job',name:'Établissement'}]:[],error:null};for(const k of ['select','eq','order','limit'])q[k]=()=>q;return q}
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
test('all requests can display more than eight scoped missing-day requests',()=>{
 const base={id:'request-0',company_id:'company',worker_id:'mine',status:'pending',
  starts_at:'2026-10-27T12:00:00Z',ends_at:'2026-10-27T20:00:00Z'};
 const own=Array.from({length:20},(_,i)=>({...base,id:'request-'+i,
  created_at:new Date(Date.parse('2026-10-28T12:00:00Z')+i*60000).toISOString()}));
 const source={company:'company',user:'user',loaded:true,
  workers:[{id:'mine',auth_user_id:'user'},{id:'colleague',auth_user_id:'someone-else'}],
  requests:[...own,{...base,id:'foreign-worker',worker_id:'colleague'},
   {...base,id:'foreign-company',company_id:'another'}]};
 const opts={companyId:'company',userId:'user',source};
 assert.equal(employeeMissingDaysSummary(opts).requests.length,8);
 const all=employeeMissingDaysSummary({...opts,limit:100});
 assert.equal(all.ready,true);assert.equal(all.requests.length,20);
 assert.equal(all.requests[0].id,'request-19');
 assert.equal(all.requests[19].id,'request-0');
 assert.doesNotMatch(JSON.stringify(all),/foreign-worker|foreign-company/);
 assert.equal(employeeMissingDaysSummary({...opts,limit:0}).requests.length,0);
 assert.equal(employeeMissingDaysSummary({...opts,limit:NaN}).requests.length,8);
 assert.equal(employeeMissingDaysSummary({...opts,limit:1000}).requests.length,20);
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 assert.ok(app.includes('const tracking=myRequestsTimeline(100)'));
 assert.ok(app.includes('missingView:employeeMissingDaysSummary({companyId,userId,source:essentialUI.missingDays.state,limit})'));
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
 assert.match(app,/import \{employeeMissingDaysSummary,managerMissingDayApprovalSummary\} from '\.\/missing-days\.js'/);
 assert.match(app,/missingView:employeeMissingDaysSummary\(\{companyId,userId,source:essentialUI\.missingDays\.state,limit\}/);
 assert.match(hours,/myRequestsTimeline\(\)/);
 assert.match(hours,/data-id="missingDays"/);
 assert.match(hours,/Une demande approuvée ne confirme pas, à elle seule, votre paie/);
 assert.match(hours,/Mes demandes et absences/);
 assert.match(app,/missingView:employeeMissingDaysSummary/);
});

test('employee form rejects an unrelated worker or unavailable facility before mutation',async()=>{
 let calls=0;
 const ui=createMissingDaysController({sb:{from:table,rpc:async()=>{calls++;return {data:'ok'}}},
  redraw(){},escape,crypto,storage:store()});
 await ui.load({company_id:'company',role:'employee'},'user',
  [{id:'worker',auth_user_id:'user'},{id:'foreign',auth_user_id:'different'}]);
 ui.state.form={...form,worker:'foreign'};
 await ui.handle({dataset:{action:'missing:submit'}});
 assert.match(ui.state.error,/Dossier salarié non autorisé/);assert.equal(calls,0);
 ui.state.form={...form,job:'unlisted'};
 await ui.handle({dataset:{action:'missing:submit'}});
 assert.match(ui.state.error,/Établissement indisponible/);assert.equal(calls,0);
});
test('employee missing-day history never renders a contaminated company or worker response',async()=>{
 const ui=createMissingDaysController({sb:{from:table},redraw(){},escape,crypto,storage:store()});
 await ui.load({company_id:'company',role:'employee'},'user',
  [{id:'worker',auth_user_id:'user',first_name:'Own'}]);
 ui.state.requests=[
  {id:'a',company_id:'company',worker_id:'worker',status:'pending',
   requested_by:'user',starts_at:'2026-10-21T08:00:00Z',ends_at:'2026-10-21T16:00:00Z',reason:'Correct request',breaks:[]},
  {id:'b',company_id:'other-company',worker_id:'worker',status:'pending',
   requested_by:'different',starts_at:'2026-10-21T08:00:00Z',ends_at:'2026-10-21T16:00:00Z',reason:'PRIVATE COMPANY',breaks:[]},
  {id:'c',company_id:'company',worker_id:'foreign',status:'pending',
   requested_by:'different',starts_at:'2026-10-21T08:00:00Z',ends_at:'2026-10-21T16:00:00Z',reason:'PRIVATE WORKER',breaks:[]}
 ];
 const html=ui.render();
 assert.match(html,/Correct request/);
 assert.doesNotMatch(html,/PRIVATE COMPANY|PRIVATE WORKER/);
});

test('manager approval summary is company and reviewer scoped, without self-approval',()=>{
 const row={id:'a',company_id:'company',worker_id:'worker-a',status:'pending',
  starts_at:'2026-11-01T12:00:00Z',ends_at:'2026-11-01T20:00:00Z',created_at:'2026-11-02T12:00:00Z',requested_by:'employee-a'};
 const source={company:'company',user:'manager',role:'boss',loaded:true,
  workers:[{id:'worker-a',auth_user_id:'employee-a',first_name:'Alex',last_name:'Nord'},
           {id:'manager-worker',auth_user_id:'manager',first_name:'Owner'},
           {id:'worker-b',auth_user_id:'employee-b'}],
  pendingRequests:[row,{...row,id:'other-company',company_id:'another'},
   {...row,id:'self',worker_id:'manager-worker',requested_by:'employee-b'},
   {...row,id:'requester-self',requested_by:'manager'},
   {...row,id:'unknown-worker',worker_id:'unknown'},
   {...row,id:'approved',status:'approved'},
   {...row,id:'other-worker',worker_id:'worker-b',created_at:'2026-11-02T13:00:00Z'}]};
 const actual=managerMissingDayApprovalSummary({companyId:'company',reviewerId:'manager',source});
 assert.equal(actual.ready,true);assert.equal(actual.count,2);
 assert.deepEqual(actual.requests.map(x=>x.id),['other-worker','a']);
 assert.equal(actual.requests[1].workerName,'Alex Nord');
 assert.doesNotMatch(JSON.stringify(actual),/another|unknown|Owner|employee-a|employee-b/);
});
test('manager queue fails closed after account, role or network snapshot changes',()=>{
 const source={company:'company',user:'manager',role:'boss',loaded:true,workers:[],requests:[],pendingRequests:[]};
 for(const changes of [{companyId:'another'}, {reviewerId:'different'},
  {source:{...source,role:'employee'}},
  {source:{...source,loaded:false}},
  {source:{...source,requests:null,pendingRequests:null}}]){
  const actual=managerMissingDayApprovalSummary({companyId:'company',reviewerId:'manager',source,...changes});
  assert.deepEqual(actual,{ready:false,count:0,requests:[]});
 }
});
test('manager approvals link to the existing missing-day review, not a parallel RPC',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 const first=app.indexOf('function essentialApprovals()');
 const last=app.indexOf('function essentialPage()',first);
 const view=app.slice(first,last);
 assert.match(app,/import \{employeeMissingDaysSummary,managerMissingDayApprovalSummary\} from '\.\/missing-days\.js'/);
 assert.match(view,/managerMissingDayApprovalSummary\(\{companyId:company\(\),reviewerId:state\.user\?\.id/);
 assert.match(view,/Journées entièrement oubliées à examiner/);
 assert.match(view,/data-id="missingDays"/);
 assert.match(view,/Les heures restent non confirmées avant décision serveur/);
 assert.doesNotMatch(view,/review_essential_missing_day|\.rpc\(/);
});

test('manager review handler refuses stale and cross-company requests before RPC',async()=>{
 const calls=[];
 const ui=createMissingDaysController({sb:{from:table,rpc:async(name,args)=>{calls.push({name,args});return {data:'ok'}}},
  redraw(){},escape,crypto,storage:store()});
 await ui.load({company_id:'company',role:'boss'},'manager',[
  {id:'worker',auth_user_id:'employee',first_name:'Employee'},
  {id:'own-worker',auth_user_id:'manager',first_name:'Boss'}]);
 const req={id:'valid',company_id:'company',worker_id:'worker',requested_by:'employee',
  status:'pending',starts_at:'2026-10-21T08:00:00Z',ends_at:'2026-10-21T16:00:00Z',breaks:[],reason:'Forgot'};
 ui.state.requests=[req,{...req,id:'foreign',company_id:'another'},
  {...req,id:'my-worker',worker_id:'own-worker'},
  {...req,id:'my-request',requested_by:'manager'},
  {...req,id:'already-reviewed',status:'approved'},
  {...req,id:'unknown-worker',worker_id:'missing'}];
 ui.state.note='Valid reason';
 for(const id of ['foreign','my-worker','my-request','already-reviewed','unknown-worker','absent']){
  await ui.handle({dataset:{action:'missing:approve',id}});
  assert.equal(calls.length,0);
 }
 await ui.handle({dataset:{action:'missing:approve',id:'valid'}});
 assert.equal(calls.length,1);assert.equal(calls[0].name,'review_essential_missing_day');
 assert.equal(calls[0].args.p_request,'valid');
});

test('employee cancellation accepts only own pending request in selected company',async()=>{
 const calls=[];
 const ui=createMissingDaysController({sb:{from:table,rpc:async(name,args)=>{calls.push({name,args});return {data:'ok'}}},
  redraw(){},escape,crypto,storage:store()});
 await ui.load({company_id:'company',role:'employee'},'user',[{id:'worker',auth_user_id:'user'}]);
 const req={id:'own',company_id:'company',worker_id:'worker',requested_by:'user',status:'pending'};
 ui.state.requests=[req,{...req,id:'other-author',requested_by:'other'},
  {...req,id:'other-company',company_id:'different'},
  {...req,id:'approved',status:'approved'}];
 for(const id of ['other-author','other-company','approved','missing']){
  await ui.handle({dataset:{action:'missing:cancel',id}});
  assert.equal(calls.length,0);
 }
 await ui.handle({dataset:{action:'missing:cancel',id:'own'}});
 assert.equal(calls.length,1);assert.equal(calls[0].name,'cancel_essential_missing_day');
});

test('manager forgotten-day form hides a foreign company even if the response is mixed',async()=>{
 const ui=createMissingDaysController({sb:{from:table},redraw(){},escape,crypto,storage:store()});
 await ui.load({company_id:'company',role:'boss'},'manager',[{id:'worker',auth_user_id:'employee',first_name:'Employee'}]);
 ui.state.requests=[
  {id:'allowed',company_id:'company',worker_id:'worker',requested_by:'employee',status:'pending',starts_at:'2026-10-21T08:00:00Z',ends_at:'2026-10-21T16:00:00Z',breaks:[],reason:'Allowed'},
  {id:'foreign',company_id:'different',worker_id:'worker',requested_by:'employee',status:'pending',starts_at:'2026-10-21T08:00:00Z',ends_at:'2026-10-21T16:00:00Z',breaks:[],reason:'PRIVATE OTHER TENANT'}
 ];
 const html=ui.render();assert.match(html,/Allowed/);assert.doesNotMatch(html,/PRIVATE OTHER TENANT/);
});

test('account change during hashing never submits a forgotten day to the former company',async()=>{
 let releaseHash,notifyHash;
 const hashing=new Promise(resolve=>{releaseHash=resolve});
 const started=new Promise(resolve=>{notifyHash=resolve});
 let rpcCalls=0;
 const holdCrypto={randomUUID:()=>'durable-request',subtle:{digest:async()=>{
  notifyHash();return hashing;
 }}};
 const ui=createMissingDaysController({sb:{from:table,rpc:async()=>{rpcCalls++;return {data:'ok'}}},
  redraw(){},escape,crypto:holdCrypto,storage:store()});
 await ui.load({company_id:'company',role:'employee'},'user',[{id:'worker',auth_user_id:'user'}]);
 ui.state.form={...form};
 const pending=ui.handle({dataset:{action:'missing:submit'}});
 await started;ui.reset();releaseHash(new Uint8Array(32).buffer);await pending;
 assert.equal(rpcCalls,0);assert.equal(ui.state.user,null);assert.equal(ui.state.company,null);
});

test('a failed refresh hides formerly loaded requests and disables unverified submissions',async()=>{
 let shouldFail=false;
 const sb={from:name=>{
  const q={data:name==='jobs'?[{id:'job',name:'Site'}]:[],error:null};
  q.select=()=>q;q.eq=()=>q;q.order=()=>q;
  q.limit=()=>{if(name==='essential_missing_days'&&shouldFail)q.error=Error('offline');return q;};
  return q;
 }};
 const ui=createMissingDaysController({sb,redraw(){},escape,crypto,storage:store()});
 await ui.load({company_id:'company',role:'employee'},'user',[{id:'worker',auth_user_id:'user',first_name:'Alex'}]);
 ui.state.requests=[{id:'old',company_id:'company',worker_id:'worker',requested_by:'user',status:'pending',
  starts_at:'2026-10-01T08:00:00Z',ends_at:'2026-10-01T16:00:00Z',reason:'STALE OLD RECORD',breaks:[]}];
 shouldFail=true;await ui.handle({dataset:{action:'missing:refresh'}});
 assert.equal(ui.state.loaded,false);
 assert.doesNotMatch(ui.render(),/STALE OLD RECORD/);
 assert.match(ui.render(),/Historique non vérifié/);
 assert.match(ui.render(),/missing:submit[^>]*disabled/);
 assert.doesNotMatch(ui.render(),/missing:refresh[^>]*disabled/);
});

test('manager reads pending missing-day inbox independently from the 100 latest history rows',async()=>{
 const reads=[];
 const pending={id:'older-pending',company_id:'company',worker_id:'worker',requested_by:'employee',
  status:'pending',starts_at:'2026-10-02T08:00:00Z',ends_at:'2026-10-02T16:00:00Z',breaks:[],reason:'Still unresolved'};
 const archived=Array.from({length:100},(_,i)=>({...pending,id:'archived-'+i,status:'approved'}));
 const sb={from:tableName=>{
  const filters=[],q={error:null};let result=null;
  q.select=()=>q;q.eq=(field,value)=>{filters.push([field,value]);return q};
  q.order=()=>q;q.limit=limit=>{
   if(tableName==='jobs')q.data=[{id:'job',name:'Site'}];
   else q.data=filters.some(([field,value])=>field==='status'&&value==='pending')?[pending]:archived;
   reads.push({table:tableName,filters:filters.slice(),limit});
   return q;
  };
  return q;
 }};
 const ui=createMissingDaysController({sb,redraw(){},escape,crypto,storage:store()});
 await ui.load({company_id:'company',role:'boss'},'manager',[{id:'worker',auth_user_id:'employee',first_name:'Alex'}]);
 assert.equal(ui.state.requests.length,100);
 assert.equal(ui.state.pendingRequests.length,1);
 const approval=managerMissingDayApprovalSummary({companyId:'company',reviewerId:'manager',source:ui.state});
 assert.equal(approval.ready,true);assert.equal(approval.count,1);
 assert.equal(approval.requests[0].id,'older-pending');
 assert.ok(reads.some(read=>read.table==='essential_missing_days'&&read.limit===200&&
  read.filters.some(([field,value])=>field==='status'&&value==='pending')&&
  read.filters.some(([field,value])=>field==='company_id'&&value==='company')));
 assert.match(ui.render(),/Still unresolved/);
});
test('manager pending inbox fails closed if its separate server query fails',async()=>{
 const sb={from:name=>{
  const filters=[],q={data:[],error:null};
  q.select=()=>q;q.eq=(key,value)=>{filters.push([key,value]);return q};
  q.order=()=>q;q.limit=()=>{
   if(name==='essential_missing_days'&&filters.some(([key,value])=>key==='status'&&value==='pending'))
    q.error=Error('Pending queue unavailable');
   return q;
  };
  return q;
 }};
 const ui=createMissingDaysController({sb,redraw(){},escape,crypto,storage:store()});
 await ui.load({company_id:'company',role:'boss'},'manager',[{id:'worker',auth_user_id:'employee'}]);
 assert.equal(ui.state.loaded,false);
 assert.match(ui.state.error,/Pending queue unavailable/);
 assert.equal(managerMissingDayApprovalSummary({companyId:'company',reviewerId:'manager',source:ui.state}).ready,false);
 assert.doesNotMatch(ui.render(),/missing:approve[^>]*data-id="old"/);
});

test('personal missing-day summary retains its verified scope for downstream account switches',()=>{
 const source={company:'company',user:'user',loaded:true,
  workers:[{id:'own-worker',auth_user_id:'user'}],
  requests:[{id:'own-request',company_id:'company',worker_id:'own-worker',
   status:'pending',starts_at:'2026-11-01T10:00:00Z'}]};
 const current=employeeMissingDaysSummary({companyId:'company',userId:'user',source});
 assert.equal(current.ready,true);
 assert.equal(current.companyId,'company');
 assert.equal(current.userId,'user');
 assert.deepEqual(current.requests.map(r=>r.id),['own-request']);
 const switched=employeeMissingDaysSummary({companyId:'other-company',userId:'user',source});
 assert.equal(switched.ready,false);
 assert.deepEqual(switched.requests,[]);
 assert.equal(switched.companyId,undefined);
});
