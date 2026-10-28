import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {MISSION_STATES,missionDayReview,missionDayReviewCsv} from '../web/live/mission-day-review.js';
import {createMissionManager} from '../web/live/missions.js';
const missions=[
 {id:'draft',worker_id:'alice',mission_day:'2026-11-03',sort_order:1,title:'Préparer',
   first_name:'Alice',last_name:'A',client_name:'Clinique Nadine',site_name:'Saint-Augustin',city:'Québec',status:'draft',instructions:'Code 1234'},
 {id:'done',worker_id:'alice',mission_day:'2026-11-03',sort_order:2,title:'Terminé A',
   first_name:'Alice',last_name:'A',client_name:'Clinique Nadine',site_name:'Saint-Augustin',city:'Québec',status:'completed',
   completed_at:'2026-11-03T15:20:00Z'},
 {id:'pending',worker_id:'bob',mission_day:'2026-11-03',sort_order:3,title:'Visite B',
   first_name:'Bob',last_name:'B',client_name:'Condo Mathieu',site_name:'Charlesbourg',city:'Québec',status:'published'},
 {id:'cancelled',worker_id:'alice',mission_day:'2026-11-03',sort_order:4,title:'Retour annulé',
   first_name:'Alice',last_name:'A',client_name:'Condo Mathieu',site_name:'Charlesbourg',city:'Québec',status:'cancelled'}
];
test('daily scorecard uses already authorized rows, counts and filters without making an absence or retard claim',()=>{
 const all=missionDayReview(missions);
 assert.equal(all.scopedTotal,4);assert.equal(all.counts.draft,1);assert.equal(all.counts.published,1);
 assert.equal(all.counts.completed,1);assert.equal(all.counts.cancelled,1);
 assert.equal(all.shown,4);assert.deepEqual(all.visible.map(x=>x.id),['draft','done','pending','cancelled']);
 const scoped=missionDayReview(missions,{worker:'alice',client:'CLINIQUE',status:'completed'});
 assert.equal(scoped.scopedTotal,2);assert.equal(scoped.shown,1);assert.equal(scoped.visible[0].id,'done');
 assert.equal(scoped.counts.published,0);assert.equal(scoped.counts.completed,1);
 assert.equal(Object.hasOwn(scoped,'absence'),false);
 assert.throws(()=>missionDayReview(missions,{status:'late'}),/inconnu/);
});
test('CSV exports selected rows only, escapes formula injection, and excludes private instructions',()=>{
 const rows=[{...missions[0],client_name:'=WEBSERVICE("evil")',title:'"+SUM(1,2)'}];
 const report=missionDayReview(rows);
 const csv=missionDayReviewCsv(report,'2026-11-03');
 assert.match(csv,/^\uFEFF/);
 assert.match(csv,/'=WEBSERVICE/);
 assert.match(csv,/Date","Employé","Client"/);
 assert.doesNotMatch(csv,/Code 1234|instructions|access_instructions|private_note/);
 const count=csv.trim().split('\r\n').length;
 assert.equal(count,2,'one header, one mission, no hidden data');
 assert.equal(missionDayReviewCsv(missionDayReview(missions,{status:'completed'}),'2026-11-03').includes('Visite B'),false);
});
test('truncated and invalid source always forbid a misleading CSV',()=>{
 const summary=missionDayReview(missions,{},true);
 assert.equal(summary.truncated,true);assert.equal(summary.exportable,false);
 assert.throws(()=>missionDayReviewCsv(summary,'2026-11-03'),/incomplète/);
 assert.throws(()=>missionDayReviewCsv(missionDayReview(missions),'invalid'),/invalide/);
 assert.throws(()=>missionDayReview(null),/invalide/);
});
test('real manager Web controller renders count filters and applies employee/status restrictions',async()=>{
 const window=new Window();window.confirm=()=>true;
 const escape=x=>String(x??'').replace(/[&<>"']/g,z=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[z]));
 const calls=[];
 const sb={rpc:async(name,args)=>{calls.push({name,args});
  if(name==='essential_missions_configuration')return {data:{enabled:true}};
  if(name==='list_essential_client_sites')return {data:{items:[],has_more:false}};
  if(name==='list_essential_missions')return {data:{items:missions,truncated:false}};
  throw Error('Unexpected '+name);
 }};
 const ctrl=createMissionManager({sb,document:window.document,escape,redraw(){},notify(){}});
 await ctrl.load('company',[{id:'alice',name:'Alice',status:'active'},{id:'bob',name:'Bob',status:'active'}]);
 let html=ctrl.render();
 assert.match(html,/Suivi des missions/);assert.match(html,/À faire : 1/);
 assert.match(html,/Exporter les missions affichées/);
 window.document.body.innerHTML=html;
 window.document.getElementById('mission-review-worker').value='alice';
 window.document.getElementById('mission-review-status').value='completed';
 window.document.getElementById('mission-review-client').value='Clinique';
 await ctrl.handle('review-apply',{dataset:{}});
 html=ctrl.render();
 assert.match(html,/1 mission\(s\) affichée\(s\) sur 2/);
 const section=html.split('aria-label="Suivi quotidien des missions"')[1].split('</section>')[0];
 assert.match(section,/Terminé A/);
 assert.doesNotMatch(section,/Visite B/);
 assert.equal(calls.filter(x=>x.name==='list_essential_missions').length,1,
  'filtering an authorized snapshot adds no server or GPS request');
 await window.happyDOM.close();
});

test('CSV download is refused after Auth revocation, before any private file is generated',async()=>{
 const win=new Window(),calls=[];
 const sb={
  auth:{async getUser(){return{error:{message:'revoked'},data:{user:null}}}},
  async rpc(name,args){calls.push({name,args});
   if(name==='essential_missions_configuration')return{data:{enabled:true}};
   if(name==='list_essential_client_sites')return{data:{items:[]}};
   if(name==='list_essential_missions')return{data:{enabled:true,items:missions,truncated:false}};
   throw Error('Unexpected '+name);
  }
 };
 const ctrl=createMissionManager({sb,document:win.document,escape:x=>String(x),redraw(){},notify(){}});
 await ctrl.load('company-A',[]);
 await ctrl.handle('review-csv',{dataset:{}});
 assert.match(ctrl.state.error,/Session non confirmée/);
 assert.equal(calls.filter(x=>x.name==='list_essential_missions').length,1,
  'stale dashboard must never trigger a second export read after auth revocation');
 await win.happyDOM.close();
});
test('CSV download performs a fresh scoped RPC and refuses truncated or cross-company results',async()=>{
 for(const variant of ['truncated','cross-company','changed-day']){
  const win=new Window(),calls=[];
  const sb={auth:{async getUser(){return{data:{user:{id:'user-A'}},error:null}}},
   async rpc(name,args){calls.push({name,args});
    if(name==='essential_missions_configuration')return{data:{enabled:true}};
    if(name==='list_essential_client_sites')return{data:{items:[]}};
    if(name==='list_essential_missions'){
     const isExport=calls.filter(x=>x.name==='list_essential_missions').length>1;
     if(!isExport)return{data:{enabled:true,truncated:false,items:missions}};
     if(variant==='truncated')return{data:{enabled:true,truncated:true,items:missions}};
     if(variant==='cross-company')return{data:{enabled:true,truncated:false,
       items:[{...missions[0],company_id:'company-B'}]}};
     return{data:{enabled:true,truncated:false,
       items:[{...missions[0],mission_day:'2027-01-01'}]}};
    }
    throw Error('Unexpected '+name);
   }};
  const ctrl=createMissionManager({sb,document:win.document,escape:x=>String(x),redraw(){},notify(){}});
  await ctrl.load('company-A',[]);
  await ctrl.handle('review-csv',{dataset:{}});
  assert.match(ctrl.state.error,/refusé/);
  assert.equal(calls.filter(x=>x.name==='list_essential_missions').length,2);
  const req=calls.filter(x=>x.name==='list_essential_missions').at(-1).args;
  assert.equal(req.p_company,'company-A');assert.equal(req.p_worker,null);
  assert.equal(req.p_include_drafts,true);
  await win.happyDOM.close();
 }
});
test('CSV never exports an old company after context changes during server request',async()=>{
 const win=new Window(),calls=[];
 let changeContext=null,requestedExport=false;
 const sb={auth:{async getUser(){return{data:{user:{id:'user-A'}},error:null}}},
  async rpc(name,args){calls.push({name,args});
   if(name==='essential_missions_configuration')return{data:{enabled:true}};
   if(name==='list_essential_client_sites')return{data:{items:[]}};
   if(name==='list_essential_missions'){
    if(!requestedExport)return{data:{enabled:true,truncated:false,items:missions}};
    requestedExport=false;
    await changeContext();
    return{data:{enabled:true,truncated:false,items:missions}};
   }
   throw Error('Unexpected '+name);
  }};
 const ctrl=createMissionManager({sb,document:win.document,escape:x=>String(x),redraw(){},notify(){}});
 await ctrl.load('company-A',[]);
 changeContext=()=>ctrl.load('company-B',[]);
 requestedExport=true;
 await ctrl.handle('review-csv',{dataset:{}});
 assert.equal(ctrl.state.company,'company-B');
 assert.doesNotMatch(ctrl.state.error||'',/exporté/);
 await win.happyDOM.close();
});
