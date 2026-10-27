import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createPersonalMissionController,missionDate} from '../web/live/missions.js';
import {nextMissionDay,validateUpcomingMissionDay} from '../web/live/mission-upcoming.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=missionDate(),tomorrow=nextMissionDay();
const stop={id:'future-a',worker_id:'worker-a',mission_day:tomorrow,status:'published',sort_order:1,
 title:'Nettoyage demain',client_name:'Clinique Mathieu',site_name:'Bureau des Érables',
 address_line:'125 rue des Érables',city:'Charlesbourg',country:'CA',
 access_instructions:'CODE-ULTRA-SECRET',internal_notes:'Note privée'};
const foreign={...stop,id:'foreign',worker_id:'worker-b',client_name:'Client interdit',address_line:'Chemin secret'};
const draft={...stop,id:'draft',status:'draft',title:'Brouillon confidentiel'};
function createFixture({future=[stop,foreign,draft],todayRows=[]}={}){
 const win=new Window(),calls=[];let offline=false;
 const sb={rpc:async(name,args)=>{
  calls.push({name,args});
  if(offline)return {error:{message:'Connexion interrompue'}};
  if(name==='list_essential_missions')return {data:{enabled:true,truncated:false,
   items:args.p_day===today?todayRows:future}};
  throw Error('RPC inattendue '+name);
 }};
 const ui=createPersonalMissionController({sb,document:win.document,escape:esc,redraw(){},notify(){}});
 return {win,ui,calls,setOffline:v=>offline=v};
}
test('future date bounds are real calendar dates and max 14 days',()=>{
 const day14=new Date(today+'T12:00:00Z');day14.setUTCDate(day14.getUTCDate()+14);
 const day15=new Date(today+'T12:00:00Z');day15.setUTCDate(day15.getUTCDate()+15);
 assert.equal(validateUpcomingMissionDay(tomorrow,today),tomorrow);
 assert.equal(validateUpcomingMissionDay(day14.toISOString().slice(0,10),today),day14.toISOString().slice(0,10));
 for(const d of [today,'2026-02-31','tomorrow','2024-01-01',day15.toISOString().slice(0,10)])
  assert.throws(()=>validateUpcomingMissionDay(d,today),/journée|date/i);
});
test('worker with no missions today can explicitly inspect only future published company missions',async()=>{
 const f=createFixture();await f.ui.load('company-a','user-a','worker-a');
 assert.match(f.ui.render(),/Aucune mission pour aujourd’hui/);
 assert.match(f.ui.render(),/Consulter mes prochaines interventions/);
 await f.ui.handleUpcoming('toggle');
 f.win.document.body.innerHTML=f.ui.render();
 f.win.document.getElementById('mission-upcoming-day').value=tomorrow;
 assert.equal(await f.ui.handleUpcoming('load'),true);
 f.win.document.body.innerHTML=f.ui.render();
 assert.match(f.win.document.body.textContent,/Nettoyage demain/);
 assert.match(f.win.document.body.textContent,/Charlesbourg/);
 assert.doesNotMatch(f.win.document.body.innerHTML,/CODE-ULTRA-SECRET|Note privée|Client interdit|Chemin secret|Brouillon confidentiel/);
 assert.equal(f.win.document.querySelectorAll('[data-action="mission:finish"]').length,0);
 assert.ok([...f.win.document.querySelectorAll('a[href]')].every(x=>!x.href.includes('CODE-ULTRA-SECRET')));
 assert.equal(f.calls.filter(x=>x.name==='list_essential_missions').length,2);
 assert.equal(f.calls[1].args.p_company,'company-a');assert.equal(f.calls[1].args.p_worker,'worker-a');
 assert.equal(f.calls[1].args.p_include_drafts,false);
 assert.equal(f.calls.filter(x=>/punch|gps|payroll|shift|complete/.test(x.name)).length,0);
 f.ui.reset();assert.equal(f.ui.render(),'');
 await f.win.happyDOM.close();
});
test('network error clears previous future-day result rather than silently retaining a stale address',async()=>{
 const f=createFixture();await f.ui.load('company-a','user-a','worker-a');
 await f.ui.handleUpcoming('toggle');
 f.win.document.body.innerHTML=f.ui.render();
 assert.equal(await f.ui.handleUpcoming('load'),true);
 assert.match(f.ui.render(),/Nettoyage demain/);
 f.setOffline(true);
 f.win.document.body.innerHTML=f.ui.render();
 assert.equal(await f.ui.handleUpcoming('load'),false);
 assert.match(f.ui.render(),/Connexion interrompue/);
 assert.doesNotMatch(f.ui.render(),/Nettoyage demain/);
 await f.win.happyDOM.close();
});
test('late future responses cannot populate another company's employee screen',async()=>{
 const f=createFixture();await f.ui.load('company-a','user-a','worker-a');
 await f.ui.handleUpcoming('toggle');
 f.win.document.body.innerHTML=f.ui.render();
 let release;const initial=f.calls.length;
 const original=f.ui.state.upcoming;
 const deferred=Promise.withResolvers();
 // Override RPC used by the controller to keep the upcoming request in flight.
 const win=new Window();
 const requests=[];
 const sb={rpc:async(name,args)=>{
  requests.push(args);
  if(args.p_company==='company-b')return {data:{enabled:true,truncated:false,items:[]}};
  if(requests.length===1)return {data:{enabled:true,truncated:false,items:[]}};
  return deferred.promise;
 }};
 const ctrl=createPersonalMissionController({sb,document:win.document,escape:esc,redraw(){},notify(){}});
 await ctrl.load('company-a','user-a','worker-a');
 await ctrl.handleUpcoming('toggle');win.document.body.innerHTML=ctrl.render();
 const slow=ctrl.handleUpcoming('load');
 await ctrl.load('company-b','user-b','worker-b');
 deferred.resolve({data:{enabled:true,truncated:false,items:[stop]}});
 await slow;
 assert.equal(ctrl.state.company,'company-b');
 assert.equal(ctrl.state.upcoming.loadedDay,null);
 assert.doesNotMatch(ctrl.render(),/Clinique Mathieu|Nettoyage demain/);
 await win.happyDOM.close();
 await f.win.happyDOM.close();
});
