import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {renderCommercialDetails} from '../web/live/commercial.js';
const escape=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const money=cents=>new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD'}).format(cents/100);
const plan={active:true,public_visible:true,title:'Essentiel',base_cents:1900,extra_seat_cents:300,included_seats:5,annual_discount:15,kiosk_limit:1,establishment_limit:1,features:[]};
test('public comparison follows changed catalog amounts, limits and feature flags',async()=>{
 const window=new Window();const render=p=>{window.document.body.innerHTML=renderCommercialDetails([p],escape,money);return [...window.document.querySelectorAll('tbody tr')].map(row=>[...row.children].map(c=>c.textContent))};
 let rows=render(plan);assert.deepEqual(rows.find(r=>r[0]==='Horaires avancés'),['Horaires avancés','—']);
 rows=render({...plan,base_cents:4275,included_seats:17,kiosk_limit:null,establishment_limit:4,features:['advanced_schedules']});
 assert.equal(rows.find(r=>r[0]==='Prix de base mensuel')[1],money(4275));assert.equal(rows.find(r=>r[0]==='Membres inclus')[1],'17');assert.equal(rows.find(r=>r[0]==='Bornes comprises')[1],'Illimitées');assert.equal(rows.find(r=>r[0]==='Établissements')[1],'4');assert.equal(rows.find(r=>r[0]==='Horaires avancés')[1],'Inclus');await window.happyDOM.close();
});
test('hidden and inactive plans never appear publicly and catalog names are escaped',async()=>{
 const window=new Window();window.document.body.innerHTML=renderCommercialDetails([{...plan,title:'<img src=x onerror=alert(1)>'},{...plan,title:'Private',public_visible:false},{...plan,title:'Inactive',active:false}],escape,money);
 assert.equal(window.document.querySelectorAll('thead th').length,2);assert.equal(window.document.querySelector('img'),null);assert.ok(window.document.querySelector('thead').textContent.includes('<img'));assert.ok(!window.document.querySelector('table').textContent.includes('Private'));assert.ok(!window.document.querySelector('table').textContent.includes('Inactive'));assert.equal(window.document.querySelectorAll('summary').length,8);assert.equal(window.document.querySelector('[role="region"]').tabIndex,0);await window.happyDOM.close();
});

test('SACATALOG-016 unlimited is represented explicitly without a fake seat count',async()=>{
 const window=new Window();
 window.document.body.innerHTML=renderCommercialDetails([{...plan,included_seats:20,included_seats_unlimited:true,extra_seat_cents:200}],escape,money);
 const rows=[...window.document.querySelectorAll('tbody tr')].map(r=>[...r.children].map(c=>c.textContent));
 assert.equal(rows.find(r=>r[0]==='Membres inclus')[1],'Illimité');
 assert.equal(rows.find(r=>r[0]==='Membre supplémentaire / mois')[1],'Aucun supplément');
 await window.happyDOM.close();
});
