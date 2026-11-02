import test from 'node:test';import assert from 'node:assert/strict';import {Window} from 'happy-dom';
import {breakCorrectionPayload,createBreakCorrectionsController,breakCorrectionInbox} from '../web/live/break-corrections.js';
import {readFileSync} from 'node:fs';
const escape=s=>String(s??'').replaceAll('<','&lt;').replaceAll('"','&quot;');
const form={session:'s',breakId:'b',start:'2026-10-20T12:00:00-04:00',end:'2026-10-20T12:30:00-04:00',paid:true,reason:' Correction justifiée '};
test('break requests reject ambiguous local dates and normalize explicit offsets',()=>{const p=breakCorrectionPayload(form);assert.equal(p.p_start,'2026-10-20T16:00:00.000Z');assert.equal(p.p_paid,true);assert.equal(p.p_reason,'Correction justifiée');assert.throws(()=>breakCorrectionPayload({...form,start:'2026-10-20T12:00:00'}),/fuseau/);assert.throws(()=>breakCorrectionPayload({...form,end:form.start}),/fin/);});
test('submitting a pause only calls the checked request RPC with a persisted id',async()=>{const window=new Window(),calls=[],cache=new Map();let persisted=false;const ui=createBreakCorrectionsController({sb:{rpc:async(name,args)=>{assert.equal(persisted,true);calls.push({name,args});throw Error('Connexion interrompue')}},redraw(){},escape,document:window.document,storage:{getItem:k=>cache.get(k)||null,setItem:(k,v)=>{cache.set(k,v);persisted=true},removeItem:k=>cache.delete(k)},crypto:{randomUUID:()=> 'request-uuid',subtle:{digest:async()=>new Uint8Array([1,2,3]).buffer}}});Object.assign(ui.state,{company:'c',user:'u',role:'employee',loaded:true,sessions:[{id:'s',user_id:'u'}],breaks:[{id:'b',session_id:'s',ended_at:form.end}],form:{...form}});await ui.handle({dataset:{action:'breakfix:submit'}});await ui.handle({dataset:{action:'breakfix:submit'}});assert.equal(calls.length,2);assert.equal(calls[0].name,'request_essential_break_correction');assert.equal(calls[0].args.p_request,calls[1].args.p_request);assert.equal(cache.size,1);await window.happyDOM.close();});
test('own requests show cancellation and preserve original paid state in history',async()=>{const window=new Window(),ui=createBreakCorrectionsController({sb:{},redraw(){},escape,document:window.document});Object.assign(ui.state,{company:'c',role:'boss',user:'self',loaded:true,requests:[{id:'req',company_id:'c',requested_by:'self',status:'pending',reason:'Pause payée',original_break:{started_at:form.start,ended_at:form.end,is_paid:false},requested_start:form.start,requested_end:form.end,requested_paid:true}]});window.document.body.innerHTML=ui.render();assert.ok(window.document.querySelector('[data-action="breakfix:cancel"]'));assert.equal(window.document.querySelector('[data-action="breakfix:approve"]'),null);assert.match(window.document.body.textContent,/Avant :.*Non payée/);ui.reset();assert.equal(ui.state.requests.length,0);assert.equal(ui.state.user,null);await window.happyDOM.close();});
test('a late load cannot restore private pause data after signout',async()=>{let release;const pending=new Promise(r=>release=r);const query={select(){return this},eq(){return this},not(){return this},order(){return this},limit(){return pending}};const ui=createBreakCorrectionsController({sb:{from:()=>query},redraw(){},escape});const loading=ui.load({company_id:'private',role:'employee'},'u');ui.reset();release({data:[{id:'private-session'}]});await loading;assert.equal(ui.state.company,null);assert.deepEqual(ui.state.sessions,[]);assert.deepEqual(ui.state.requests,[]);});

function fakeTables({rows=[],pending=[],sessions=[],breaks=[],failPending=false}={}){
 const logs=[],from=(name)=>{
  const filters=[],q={error:null};
  q.select=()=>q;
  q.eq=(key,value)=>{filters.push([key,value]);return q};
  q.not=()=>q;q.in=(key,ids)=>{filters.push([key,ids]);return q};q.order=()=>q;
  q.limit=limit=>{
   logs.push({name,filters:filters.slice(),limit});
   if(name==='punch_sessions')q.data=sessions;
   else if(name==='punch_breaks')q.data=breaks;
   else if(filters.some(([key,value])=>key==='status'&&value==='pending')){
    q.data=pending;
    if(failPending)q.error=Error('Pending inbox offline');
   }else q.data=rows;
   return q;
  };
  return q;
 };
 return {from,logs};
}
test('employee history query is scoped to requester and invisible after an account change',async()=>{
 const own={id:'mine',company_id:'company',requested_by:'employee',status:'pending',
  reason:'Correct personal break',requested_start:form.start,requested_end:form.end};
 const foreign={...own,id:'foreign',requested_by:'someone-else',reason:'PRIVATE EMPLOYEE'};
 const tables=fakeTables({rows:[own,foreign],sessions:[{id:'s',user_id:'employee',started_at:form.start,ended_at:form.end}]});
 const ui=createBreakCorrectionsController({sb:tables,redraw(){},escape});
 await ui.load({company_id:'company',role:'employee'},'employee');
 assert.ok(tables.logs.some(x=>x.name==='essential_break_corrections'&&
  x.filters.some(([key,value])=>key==='requested_by'&&value==='employee')));
 assert.equal(ui.state.loaded,true);
 assert.deepEqual(breakCorrectionInbox({companyId:'company',userId:'employee',role:'employee',source:ui.state}).requests.map(r=>r.id),['mine']);
 assert.doesNotMatch(ui.render(),/PRIVATE EMPLOYEE/);
 ui.reset();
 assert.deepEqual(breakCorrectionInbox({companyId:'company',userId:'employee',role:'employee',source:ui.state}),
  {ready:false,requests:[],pendingCount:0});
});
test('manager sees pending break corrections separately from recent resolved history',async()=>{
 const request={id:'old-pending',company_id:'company',requested_by:'worker',status:'pending',
  reason:'Old unresolved',requested_start:form.start,requested_end:form.end};
 const history=Array.from({length:100},(_,i)=>({...request,id:'approved-'+i,status:'approved'}));
 const tables=fakeTables({rows:history,pending:[request]});
 const ui=createBreakCorrectionsController({sb:tables,redraw(){},escape});
 await ui.load({company_id:'company',role:'boss'},'manager');
 const result=breakCorrectionInbox({companyId:'company',userId:'manager',role:'boss',source:ui.state});
 assert.equal(result.ready,true);assert.equal(result.pendingCount,1);
 assert.ok(result.requests.some(r=>r.id==='old-pending'));
 assert.ok(tables.logs.some(x=>x.name==='essential_break_corrections'&&x.limit===200&&
  x.filters.some(([key,value])=>key==='status'&&value==='pending')));
 assert.match(ui.render(),/Old unresolved/);
});
test('manager and employee actions reject another requester or stale status without an RPC',async()=>{
 const calls=[],tables=fakeTables();
 const ui=createBreakCorrectionsController({sb:{from:tables.from,rpc:async(name,args)=>{calls.push({name,args});return {data:'ok'}}},
  redraw(){},escape});
 await ui.load({company_id:'company',role:'boss'},'manager');
 const row={id:'pending',company_id:'company',requested_by:'worker',status:'pending',
  reason:'New request',requested_start:form.start,requested_end:form.end};
 ui.state.pendingRequests=[row,{...row,id:'foreign',company_id:'foreign'},
  {...row,id:'own',requested_by:'manager'},
  {...row,id:'approved',status:'approved'}];
 for(const id of ['foreign','own','approved','unknown']){
  await ui.handle({dataset:{action:'breakfix:approve',id}});
  assert.equal(calls.length,0);
 }
 await ui.handle({dataset:{action:'breakfix:cancel',id:'pending'}});
 assert.equal(calls.length,0);
 ui.reset();Object.assign(ui.state,{company:'company',user:'worker',role:'employee',loaded:true,
  pendingRequests:[],requests:[row,{...row,id:'someone-else',requested_by:'other'}]});
 await ui.handle({dataset:{action:'breakfix:cancel',id:'someone-else'}});
 assert.equal(calls.length,0);
 await ui.handle({dataset:{action:'breakfix:cancel',id:'pending'}});
 assert.equal(calls.length,1);assert.equal(calls[0].name,'cancel_essential_break_correction');
});
test('a late digest cannot send a pause correction after changing companies',async()=>{
 let releaseHash,noticeDigest;
 const hashing=new Promise(r=>{releaseHash=r}),started=new Promise(r=>{noticeDigest=r}),calls=[];
 const ui=createBreakCorrectionsController({sb:{rpc:async(name,args)=>{calls.push({name,args});return {data:'ok'}}},
  redraw(){},escape,storage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
  crypto:{randomUUID:()=> 'request-uuid',subtle:{digest:async()=>{noticeDigest();return hashing;}}}});
 Object.assign(ui.state,{company:'a',user:'employee',role:'employee',loaded:true,
  sessions:[{id:'s',user_id:'employee'}],breaks:[{id:'b',session_id:'s',ended_at:form.end}],form:{...form}});
 const ongoing=ui.handle({dataset:{action:'breakfix:submit'}});
 await started;ui.reset();releaseHash(new Uint8Array(32).buffer);await ongoing;
 assert.equal(calls.length,0);assert.equal(ui.state.company,null);
});
test('failed manager pending inbox read shows no verified prior HR data',async()=>{
 const tables=fakeTables({failPending:true});
 const ui=createBreakCorrectionsController({sb:tables,redraw(){},escape});
 await ui.load({company_id:'company',role:'boss'},'manager');
 assert.equal(ui.state.loaded,false);
 assert.match(ui.state.error,/Pending inbox offline/);
 assert.match(ui.render(),/Historique non vérifié/);
 assert.match(ui.render(),/breakfix:submit[^>]*data-id=""[^>]*disabled/);
});

test('break-correction inbox ignores requests from other companies and non-managers',()=>{
 const row={id:'req-1',company_id:'company',requested_by:'employee',status:'pending'};
 const source={company:'company',user:'boss',role:'boss',loaded:true,
  requests:[row,{...row,id:'foreign',company_id:'other'}],
  pendingRequests:[row,{...row,id:'self',requested_by:'boss'},{...row,id:'resolved',status:'approved'}]};
 const allowed=breakCorrectionInbox({companyId:'company',userId:'boss',role:'boss',source});
 assert.equal(allowed.ready,true);assert.equal(allowed.pendingCount,1);
 assert.deepEqual(allowed.requests.map(r=>r.id),['req-1','self','resolved']);
 assert.deepEqual(breakCorrectionInbox({companyId:'company',userId:'boss',role:'employee',source}),
  {ready:false,requests:[],pendingCount:0});
 assert.deepEqual(breakCorrectionInbox({companyId:'other',userId:'boss',role:'boss',source}),
  {ready:false,requests:[],pendingCount:0});
 assert.deepEqual(breakCorrectionInbox({companyId:'company',userId:'different',role:'boss',source}),
  {ready:false,requests:[],pendingCount:0});
});
test('an employee cannot send a pause correction for another employee session',async()=>{
 let calls=0;
 const ui=createBreakCorrectionsController({sb:{rpc:async()=>{calls++;return {data:'ok'}}},
  redraw(){},escape,crypto:{randomUUID:()=> 'id',subtle:{digest:async()=>new Uint8Array(32).buffer}}});
 Object.assign(ui.state,{company:'company',user:'employee',role:'employee',loaded:true,
  sessions:[{id:'s',user_id:'other'}],breaks:[{id:'b',session_id:'s',ended_at:form.end}],form:{...form}});
 await ui.handle({dataset:{action:'breakfix:submit'}});
 assert.equal(calls,0);assert.match(ui.state.error,/Journée indisponible/);
});
test('manager approvals show the scoped break correction queue without parallel RPC',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 const start=app.indexOf('function essentialApprovals()');
 const end=app.indexOf('function essentialPage()',start);
 const view=app.slice(start,end);
 assert.match(app,/import \{breakCorrectionInbox\} from '\.\/break-corrections\.js'/);
 assert.match(view,/breakCorrectionInbox\(\{companyId:company\(\),userId:state\.user\?\.id/);
 assert.match(view,/pauses\.pendingCount/);
 assert.match(view,/Corrections de pauses à examiner/);
 assert.match(view,/data-id="breakCorrections"/);
 assert.doesNotMatch(view,/request_essential_break_correction|review_essential_break_correction/);
});
