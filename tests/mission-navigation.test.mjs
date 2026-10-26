import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createPersonalMissionController,missionNavigationOptions} from '../web/live/missions.js';

const a={id:'a',status:'published',sort_order:1,title:'Ménage',client_name:'Maison Nadine',
 site_name:'Étape matin',address_line:'123 rue des Érables',unit:'Bureau 3',
 city:'Saint-Augustin-de-Desmaures',region:'Québec',postal_code:'G3A 1B2',country:'CA',
 access_instructions:'CODE-SECRET-3412',internal_notes:'gestionnaire seulement',contact_phone:'418-555-0110'};
const b={...a,id:'b',sort_order:2,site_name:'Étape après-midi',client_name:'Condo Mathieu',
 address_line:'456 boulevard de l’Ormière',unit:'',city:'Charlesbourg'};
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

test('two independent missions produce destinations matching their actual addresses, never secret notes',()=>{
 const one=missionNavigationOptions(a,'ios');
 const two=missionNavigationOptions(b,'ios');
 assert.deepEqual(one.choices.map(x=>x.id),['google','waze','apple']);
 assert.deepEqual(two.choices.map(x=>x.id),['google','waze','apple']);
 assert.ok(one.choices.every(route=>decodeURIComponent(route.url).includes('Saint-Augustin-de-Desmaures')));
 assert.ok(two.choices.every(route=>decodeURIComponent(route.url).includes('Charlesbourg')));
 assert.notEqual(one.choices[0].url,two.choices[0].url);
 for(const {url} of [...one.choices,...two.choices])assert.doesNotMatch(decodeURIComponent(url),/CODE-SECRET|gestionnaire seulement|418-555/);
 assert.equal(one.preferred,null);
 assert.deepEqual(missionNavigationOptions(a,'android').choices.map(x=>x.id),['google','waze','other']);
 assert.equal(missionNavigationOptions(a,'android','apple').preferred,null);
 assert.equal(missionNavigationOptions(a,'ios','apple').preferred.label,'Plans Apple');
});
test('mission without full valid address cannot start a route; no fallback to unrelated office',()=>{
 assert.deepEqual(missionNavigationOptions({...a,address_line:''},'ios'),{choices:[],preferred:null});
 assert.deepEqual(missionNavigationOptions({...a,city:''},'ios'),{choices:[],preferred:null});
 assert.deepEqual(missionNavigationOptions({...a,address_line:'12'},'ios'),{choices:[],preferred:null});
 assert.deepEqual(missionNavigationOptions({...a,address_line:'123 rue\nCODE-SECRET'},'web'),{choices:[],preferred:null});
 assert.deepEqual(missionNavigationOptions(null,'android'),{choices:[],preferred:null});
});
test('Web mission card shows voluntary provider chooser without changing punch or mission order',async()=>{
 const win=new Window(),calls=[];
 const model=createPersonalMissionController({sb:{rpc:async(name,args)=>{calls.push({name,args});return {data:[]}}},
  document:win.document,escape,redraw(){},notify(){}});
 Object.assign(model.state,{company:'business-a',user:'user-a',worker:'worker-a',enabled:true,items:[{...a},{...b}],truncated:false});
 win.document.body.innerHTML=model.render();
 const links=[...win.document.querySelectorAll('a[href]')];
 assert.equal(links.length,2);
 assert.equal(new URL(links[0].href).searchParams.get('destination').includes('Saint-Augustin'),true);
 assert.equal(new URL(links[1].href).searchParams.get('q').includes('Saint-Augustin'),true);
 assert.match(win.document.body.textContent,/Choisir l’application d’itinéraire/);
 assert.doesNotMatch(win.document.body.innerHTML,/CODE-SECRET|418-555-0110|gestionnaire seulement/);
 assert.equal(calls.length,0);
 assert.equal(model.state.items[0].id,'a');assert.equal(model.state.items[1].id,'b');
 win.localStorage.setItem('punch-navigation:user-a:business-a','waze');
 win.document.body.innerHTML=model.render();
 assert.match(win.document.body.textContent,/Itinéraire avec Waze/);
 assert.match(win.document.body.textContent,/Changer d’application d’itinéraire/);
 model.reset();assert.equal(model.render(),'');
 await win.happyDOM.close();
});
