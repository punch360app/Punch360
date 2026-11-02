import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {essentialManagerApprovalsSummary} from '../web/live/essential-manager-approvals-summary.js';

const companyId='company-a',reviewerId='manager-a';
const row=(id,requester='employee-a')=>({id,company_id:companyId,status:'pending',
 requested_by:requester,user_id:requester});
const base=()=>({
 companyId,reviewerId,role:'boss',
 correctionView:{ready:true,requests:[row('correction-a'),row('other-tenant'),row('own',reviewerId),
  {...row('approved'),status:'approved'}, {...row('foreign'),company_id:'company-b'}]},
 leaveView:{ready:true,requests:[row('leave-a'),row('own-leave',reviewerId)]},
 breakView:{ready:true,requests:[row('break-a'),{...row('other-break'),company_id:'company-b'}]},
 missingView:{ready:true,count:2,requests:[]}
});
test('counts only loaded pending company requests without manager self-approval',()=>{
 const s=base();
 s.correctionView.requests[1].company_id='company-b';
 const v=essentialManagerApprovalsSummary(s);
 assert.equal(v.authorized,true);assert.equal(v.complete,true);
 assert.deepEqual(v.sections.map(r=>r.count),[1,1,1,2]);
 assert.equal(v.total,5);
 assert.doesNotMatch(JSON.stringify(v),/employee-a|company-b|other-tenant/);
});
test('partial reads remain unverified and never become a false all-clear',()=>{
 const s=base();
 s.correctionView={ready:false,requests:[row('stale')]};
 s.missingView={ready:false,count:99};
 const v=essentialManagerApprovalsSummary(s);
 assert.equal(v.complete,false);
 assert.equal(v.total,2);
 assert.deepEqual(v.sections.map(r=>r.count),[null,1,1,null]);
 assert.deepEqual(v.sections.map(r=>r.ready),[false,true,true,false]);
});
test('employee and switched company or identity have no manager access',()=>{
 for(const invalid of [{role:'employee'},{role:'chef'},{role:''},
  {companyId:''},{reviewerId:''}]){
  assert.deepEqual(essentialManagerApprovalsSummary({...base(),...invalid}),
   {authorized:false,complete:false,total:null,sections:[]});
 }
});
test('malformed count and cross-company records never become approval candidates',()=>{
 const s=base();
 s.correctionView.requests=[{...row('foreign'),company_id:'other'},row('self',reviewerId)];
 s.leaveView.requests=[{...row('foreign-leave'),company_id:'other'},row('self',reviewerId)];
 s.breakView.requests=[{...row('foreign-break'),company_id:'other'},row('self',reviewerId)];
 s.missingView={ready:true,count:-1};
 const v=essentialManagerApprovalsSummary(s);
 assert.deepEqual(v.sections.map(x=>x.count),[0,0,0,null]);
 assert.equal(v.complete,false);assert.equal(v.total,0);
});
function renderPanel(model){
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 const from=app.indexOf('function essentialManagerApprovalsHomePanel()');
 const to=app.indexOf('function adminHome()',from);
 assert.ok(from>=0&&to>from);
 const state={user:{id:reviewerId},account:{role:'boss'},
  correctionApprovalsLoaded:true,correctionApprovals:[],leaveApprovalsLoaded:true,leaveApprovals:[]};
 const essentialUI={breakCorrections:{state:{}},missingDays:{state:{}}};
 const call=[];
 const build=new Function('manager','company','state','essentialUI',
  'essentialManagerApprovalsSummary','essentialCorrectionApprovalView','essentialLeaveApprovalView',
  'breakCorrectionInbox','managerMissingDayApprovalSummary','e','button',
  app.slice(from,to)+'\nreturn essentialManagerApprovalsHomePanel');
 const fun=build(()=>true,()=>companyId,state,essentialUI,args=>{call.push(args);return model},
  ()=>({ready:true,requests:[]}),()=>({ready:true,requests:[]}),
  ()=>({ready:true,requests:[]}),()=>({ready:true,count:0}),
  x=>String(x), (label,action,style,attrs)=>'<button data-action="'+action+'" '+attrs+'>'+label+'</button>');
 return {html:fun(),call};
}
test('manager dashboard highlights loaded approvals without claiming payroll confirmation',()=>{
 const model={authorized:true,complete:true,total:3,sections:[
  {title:'Congés et absences',count:2,ready:true},
  {title:'Journées oubliées',count:1,ready:true}]};
 const {html,call}=renderPanel(model);
 assert.match(html,/Demandes à examiner/);
 assert.match(html,/3 demande\(s\) en attente dans les files chargées/);
 assert.match(html,/data-id="approvals"/);
 assert.match(html,/Congés et absences/);
 assert.doesNotMatch(html,/paie approuvée|toutes les heures validées/i);
 assert.equal(call[0].companyId,companyId);
 assert.equal(call[0].reviewerId,reviewerId);
 assert.equal(call[0].role,'boss');
});
test('empty complete manager inbox stays compact, unavailable inbox is visibly partial',()=>{
 const empty={authorized:true,complete:true,total:0,sections:[]};
 assert.equal(renderPanel(empty).html,'');
 const partial={authorized:true,complete:false,total:0,sections:[
  {title:'Corrections de pauses',ready:false,count:null}]};
 const {html}=renderPanel(partial);
 assert.match(html,/Suivi partiel/);
 assert.match(html,/Demandes non vérifiées/);
 assert.doesNotMatch(html,/0 demande\(s\) en attente/);
});
test('manager home uses the shared Essential dashboard and adds the scoped summary only there',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 assert.match(app,/if\(isEssential\(\)\)return essentialUI\.renderDashboard\(state\.account\)\+essentialManagerApprovalsHomePanel\(\)/);
 assert.match(app,/import \{essentialManagerApprovalsSummary\} from '\.\/essential-manager-approvals-summary\.js'/);
});
