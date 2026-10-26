import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {missionDate,personalMissionTour,createPersonalMissionController} from '../web/live/missions.js';
const today=missionDate(),tomorrow=new Date(Date.parse(today+'T12:00:00Z')+86400000).toISOString().slice(0,10);
const one={id:'one',mission_day:today,worker_id:'worker',status:'published',sort_order:2,
 title:'Nettoyage bureaux',client_name:'Clinique Nadine',site_name:'Étage 2',
 address_line:'123 rue des Érables',city:'Saint-Augustin-de-Desmaures',region:'QC',
 country:'CA',access_instructions:'CODE-SECRET-987',internal_notes:'Ne jamais diffuser'};
const two={...one,id:'two',sort_order:1,client_name:'Condo Mathieu',site_name:'Rez-de-chaussée',
 address_line:'456 avenue Royale',city:'Charlesbourg',access_instructions:'Autre code secret'};
const done={...one,id:'done',sort_order:3,status:'completed'};
const foreign={...one,id:'other',worker_id:'other',client_name:'Client confidentiel',address_line:'Secret street'};
const draft={...one,id:'draft',status:'draft'};
const future={...one,id:'tomorrow',mission_day:tomorrow};
const esc=x=>String(x??'').replace(/[&<>"']/g,z=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[z]));

test('personal mission tour is read-only, sorted by published order and excludes coworkers, drafts and tomorrow',()=>{
 const before=[one,two,done,foreign,draft,future];
 const projection=personalMissionTour(before,'worker',25,today);
 assert.equal(projection.total,3);
 assert.deepEqual(projection.rows.map(x=>x.id),['two','one','done']);
 assert.equal(projection.rows[2].status,'completed');
 assert.doesNotMatch(JSON.stringify(projection),/CODE-SECRET|Client confidentiel|Secret street|Autre code secret/);
 assert.equal(Object.hasOwn(projection.rows[0],'worker_id'),false);
 assert.equal(personalMissionTour(before,'unknown').total,0);
 assert.deepEqual(before,[one,two,done,foreign,draft,future]);
});
test('tour caps visible missions instead of implying all are shown, and warns about ambiguous rank',()=>{
 const data=Array.from({length:30},(_,i)=>({...one,id:'id'+i,sort_order:i+1}));
 const limited=personalMissionTour(data,'worker');
 assert.equal(limited.total,30);assert.equal(limited.rows.length,25);assert.equal(limited.hasMore,true);
 const other=personalMissionTour([{...one,id:'first',sort_order:1},{...two,id:'second',sort_order:1}],'worker');
 assert.equal(other.ambiguous,true);
 assert.throws(()=>personalMissionTour(data,'worker',51),/Limite/);
});
test('Web employee can inspect both route destinations and mission statuses without ending the day',async()=>{
 const win=new Window(),calls=[];
 const ui=createPersonalMissionController({document:win.document,escape:esc,redraw(){},notify(){},
  sb:{rpc:async(name,args)=>{calls.push({name,args});return {data:[]}}}});
 Object.assign(ui.state,{company:'tenant',user:'user',worker:'worker',enabled:true,items:[one,two,done,foreign,draft,future],truncated:false});
 win.document.body.innerHTML=ui.render();
 assert.match(win.document.body.textContent,/Voir mes interventions de la journée \(3\)/);
 const details=[...win.document.querySelectorAll('details')];
 assert.ok(details.length>=2);
 const urlElements=[...win.document.querySelectorAll('details a[href*="waze.com/ul"]')];
 assert.equal(urlElements.length,3); // current mission + two published tour entries
 const dest=urlElements.map(el=>new URL(el.href).searchParams.get('q'));
 assert.ok(dest.some(x=>x.includes('Charlesbourg')));
 assert.ok(dest.some(x=>x.includes('Saint-Augustin')));
 assert.doesNotMatch(win.document.body.innerHTML,/CODE-SECRET-987|Autre code secret|Client confidentiel/);
 assert.match(win.document.body.textContent,/Terminée/);
 assert.equal(calls.length,0);
 ui.reset();assert.equal(ui.render(),'');
 await win.happyDOM.close();
});
