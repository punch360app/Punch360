import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {essentialLeaveView,validateEssentialLeaveRequest,essentialLeaveApprovalView} from '../web/live/essential-leave.js';

const companyId='company-A',userId='employee-A';
const request={id:'leave-1',company_id:companyId,user_id:userId,leave_type:'vacation',begins_on:'2026-11-12',ends_on:'2026-11-14',status:'pending',created_at:'2026-11-01T11:00:00Z'};
const view=(requests=[request],loaded=true)=>essentialLeaveView({companyId,userId,loaded,requests});
const check=(input={})=>validateEssentialLeaveRequest({view:view(),companyId,userId,type:'vacation',from:'2026-11-12',to:'2026-11-14',reason:'Demande de vacances',...input});

test('only verified requests of the employee and company are visible',()=>{
 const found=view([
  request,{...request,id:'other-company',company_id:'company-B'},
  {...request,id:'other-worker',user_id:'employee-B'},
  {...request,id:'broken',begins_on:'2026-02-30'},
  {...request,id:'recent',created_at:'2026-11-02T12:00:00Z'}
 ]);
 assert.deepEqual(found.requests.map(x=>x.id),['recent','leave-1']);
 assert.deepEqual(view([request],false),{ready:false,requests:[]});
 assert.deepEqual(essentialLeaveView({companyId,userId,loaded:true,requests:null}),{ready:false,requests:[]});
});

test('valid request retains date-only calendar days and normalized note',()=>{
 assert.deepEqual(check({reason:'  Rendez-vous  '}),{ok:true,companyId,userId,type:'vacation',from:'2026-11-12',to:'2026-11-14',reason:'Rendez-vous'});
 assert.equal(check({reason:'   '}).reason,null);
 assert.equal(check({from:'2026-11-14',to:'2026-11-14'}).ok,true);
});

test('invalid types, non-existing dates, reverse ranges and oversized notes are refused',()=>{
 for(const entry of [
  {type:'admin'}, {type:''},{from:'2026-02-30'},
  {from:'2026-11-15',to:'2026-11-14'}, {from:'2026-11-12T00:00'},
  {to:'not-a-date'}, {reason:'a'.repeat(1001)}
 ])assert.equal(check(entry).ok,false,JSON.stringify(entry));
 assert.equal(check({view:{ready:false,requests:[]}}).ok,false);
 for(const type of ['vacation','personal','sick','other'])assert.equal(check({type}).ok,true);
});

test('Essentiel leave flow uses server identity, request validation and separate history',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 assert.match(app,/import \{essentialLeaveView,validateEssentialLeaveRequest,essentialLeaveApprovalView\} from '\.\/essential-leave\.js'/);
 assert.match(app,/if\(state\.sub==='leave'\)return essentialLeavePage\(\)/);
 assert.match(app,/function essentialLeavePage\(\)/);
 assert.match(app,/canSubmit=online&&view\.ready&&!state\.leaveSubmitting/);
 assert.match(app,/validateEssentialLeaveRequest\(\{view,companyId,userId,type,from,to,reason\}\)/);
 assert.match(app,/if\(state\.leaveSubmitting\)return/);
 assert.match(app,/sb\.auth\.getUser\(\)/);
 assert.match(app,/company_id:companyId,user_id:userId,leave_type:checked\.type/);
 assert.match(app,/state\.leavesLoaded=!calls\[4\]\.error/);
 assert.match(app,/function essentialApprovals\(\)\{\s*if\(!manager\(\)\)/);
 assert.match(app,/if\(state\.sub==='approvals'\)return manager\(\)\?essentialApprovals\(\)/);
 assert.match(app,/let refreshAttempted=false/);
 assert.match(app,/if\(refreshAttempted&&sameIdentity\(\)&&state\.section==='sub'&&state\.sub==='leave'\)draw\(\)/);
 assert.match(app,/\.eq\('company_id',companyId\)\.eq\('user_id',userId\)/);
});

test('manager queue includes only pending valid leave requests from the selected company',()=>{
 const pending={...request},otherCompany={...request,id:'foreign',company_id:'company-B'};
 const approved={...request,id:'approved',status:'approved'};
 const otherWorker={...request,id:'other-worker',user_id:'employee-B',begins_on:'2026-11-10'};
 const badDate={...request,id:'bad-date',ends_on:'2026-02-30'};
 const found=essentialLeaveApprovalView({companyId,reviewerId:'boss-A',manager:true,loaded:true,requests:[
  pending,approved,otherCompany,otherWorker,badDate
 ]});
 assert.equal(found.ready,true);
 assert.deepEqual(found.requests.map(r=>r.id),['other-worker','leave-1']);
 assert.deepEqual(essentialLeaveApprovalView({companyId,reviewerId:userId,manager:true,loaded:true,requests:[pending,otherWorker]}).requests.map(r=>r.id),['other-worker']);
 assert.deepEqual(essentialLeaveApprovalView({companyId,manager:true,loaded:true,requests:[pending]}),{ready:false,requests:[]});
 assert.deepEqual(essentialLeaveApprovalView({companyId,reviewerId:'boss-A',manager:false,loaded:true,requests:[pending]}),{ready:false,requests:[]});
 assert.deepEqual(essentialLeaveApprovalView({companyId,reviewerId:'boss-A',manager:true,loaded:false,requests:[pending]}),{ready:false,requests:[]});
 assert.deepEqual(essentialLeaveApprovalView({companyId:'',reviewerId:'boss-A',manager:true,loaded:true,requests:[pending]}),{ready:false,requests:[]});
});

test('leave approvals route through a dedicated manager-only server-revalidated handler',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 assert.match(app,/import \{essentialLeaveView,validateEssentialLeaveRequest,essentialLeaveApprovalView\}/);
 assert.match(app,/essentialLeaveApprovalView\(\{companyId:company\(\),manager:manager\(\),loaded:state\.leaveApprovalsLoaded,requests:state\.leaveApprovals,reviewerId:state\.user\?\.id\}\)/);
 assert.match(app,/if\(!isEssential\(\)\|\|!manager\(\)\)return toast\(/);
 assert.match(app,/if\(state\.leaveReviewSubmitting\)return/);
 assert.match(app,/\.eq\('id',id\)\.eq\('company_id',companyId\)\.eq\('status','pending'\)/);
 assert.match(app,/sb\.rpc\('review_leave',\{p_request:id,p_approve:approve,p_note:reason\}\)/);
 assert.match(app,/if\(result\.error\)\{/);
 assert.match(app,/if\(!sameScope\(\)\)throw Error\('Review scope changed'\)/);
 assert.match(app,/err\?\.message==='shift_conflict'/);
 assert.match(app,/state\.leaveApprovalsLoaded=!queue\.error/);
 assert.match(app,/\.eq\('status','pending'\)\.order\('created_at',\{ascending:false\}\)\.limit\(200\)/);
 assert.match(app,/state\.leaveApprovals=queue\.error\?\[\]:queue\.data\|\|\[\]/);
 assert.match(app,/state\.leaveApprovalsLoaded=false;state\.leaveApprovals=\[\]/);
 assert.match(app,/else if\(a==='reviewLeave'\)await \(isEssential\(\)\?reviewEssentialLeave\(/);
});

test('PWA version includes the new leave module and updated app.js',()=>{
 const html=readFileSync(new URL('../web/live/index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../web/live/sw.js',import.meta.url),'utf8');
 assert.match(html,/app\.js\?v=essential-82-bento/);
 assert.match(sw,/app\.js\?v=essential-82-bento/);
 assert.match(sw,/punch-360-essential-v91-bento/);
 assert.match(sw,/'\.\/essential-leave\.js'/);
});
