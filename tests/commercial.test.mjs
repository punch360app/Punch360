import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {renderCommercialDetails,estimatePublicPlanPrice,isPublicPlanOfferComplete,publicPlanHighlights} from '../web/live/commercial.js';
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

// The marketing cards and the signup reminder MUST use this same formula.
test('Shared calculator covers seats, annual discounts and unlimited plans',()=>{
 const p={...plan,active:true,public_visible:true,base_cents:1250,extra_seat_cents:200,included_seats:3,annual_discount:10};
 assert.deepEqual(estimatePublicPlanPrice(p,5,'monthly'),{monthlyCents:1650,annualCents:17820,payableCents:1650});
 assert.deepEqual(estimatePublicPlanPrice(p,5,'yearly'),{monthlyCents:1650,annualCents:17820,payableCents:17820});
 assert.equal(estimatePublicPlanPrice({...p,included_seats_unlimited:true},500,'monthly').payableCents,1250);
 for(const bad of [{...p,active:false},{...p,public_visible:false},{...p,annual_discount:110},{...p,base_cents:-1},{...p,extra_seat_cents:NaN}])
  assert.equal(estimatePublicPlanPrice(bad,5,'monthly'),null);
 for(const seats of [0,-1,100001,1.5])assert.equal(estimatePublicPlanPrice(p,seats,'monthly'),null);
 assert.equal(estimatePublicPlanPrice(p,5,'weekly'),null);
});

test('Bento comparison refuses incomplete catalog prices instead of displaying fake free amounts',async()=>{
 const window=new Window();
 try{
  window.document.body.innerHTML=renderCommercialDetails([
   {...plan,title:'Incomplete',base_cents:null,features:undefined},
   {...plan,title:'Overflow',base_cents:Number.MAX_SAFE_INTEGER,features:'advanced_schedules'}
  ],escape,money,{seats:8,cadence:'yearly'});
  const table=window.document.querySelector('.ess-comparison');
  const rows=[...table.querySelectorAll('tbody tr')].map(row=>[...row.children].map(c=>c.textContent));
  for(const label of ['Tarif estimé · 8 membres · paiement annuel','Économie sur 12 mois','Prix de base mensuel','Membres inclus','Membre supplémentaire / mois','Réduction annuelle']){
   const row=rows.find(r=>r[0]===label);
   assert.ok(row,'missing breakdown: '+label);
   assert.deepEqual(row.slice(1),['À confirmer','À confirmer'],'invalid catalog: '+label);
  }
  assert.deepEqual(rows.find(r=>r[0]==='Horaires avancés').slice(1),['À confirmer','À confirmer']);
  assert.doesNotMatch(table.textContent,/NaN|undefined|Infinity/);
  assert.equal(estimatePublicPlanPrice({...plan,base_cents:Number.MAX_SAFE_INTEGER},8,'yearly'),null);
 }finally{await window.happyDOM.close();}
});

test('Bento uses neutral unknown limits, never negative or missing quotas',async()=>{
 const window=new Window();
 try{
  window.document.body.innerHTML=renderCommercialDetails([
   {...plan,kiosk_limit:-4,establishment_limit:undefined},
   {...plan,kiosk_limit:null,establishment_limit:null}
  ],escape,money,{seats:8});
  const rows=[...window.document.querySelectorAll('tbody tr')].map(row=>[...row.children].map(c=>c.textContent));
  assert.deepEqual(rows.find(r=>r[0]==='Bornes comprises').slice(1),['À confirmer','Illimitées']);
  assert.deepEqual(rows.find(r=>r[0]==='Établissements').slice(1),['À confirmer','Plusieurs']);
  assert.deepEqual(rows.find(r=>r[0]==='Prix de base mensuel').slice(1),[money(1900),money(1900)]);
 }finally{await window.happyDOM.close();}
});


test('public offer selection requires known limits and feature entitlements',()=>{
 assert.equal(isPublicPlanOfferComplete(plan),true);
 assert.equal(isPublicPlanOfferComplete({...plan,kiosk_limit:null,establishment_limit:null}),true);
 for(const invalid of [
  {...plan,kiosk_limit:undefined},
  {...plan,kiosk_limit:-1},
  {...plan,establishment_limit:undefined},
  {...plan,establishment_limit:1.5},
  {...plan,features:null},
  {...plan,features:'advanced_schedules'},
  {...plan,features:[123]}
 ]){
  assert.equal(isPublicPlanOfferComplete(invalid),false);
  assert.notEqual(estimatePublicPlanPrice(invalid,8,'monthly'),null,
   'estimated price may remain calculable while legal offer terms are incomplete');
 }
 assert.equal(isPublicPlanOfferComplete(null),false);
});


test('public pricing cards list only verifiable feature flags, never invented entitlements',()=>{
 assert.deepEqual(publicPlanHighlights({...plan,features:['messages']}),['Messagerie']);
 assert.deepEqual(publicPlanHighlights({...plan,features:['punch','hours','personal_account']}),[
  'Pointage des employés','Suivi des heures'
 ]);
 assert.deepEqual(publicPlanHighlights({...plan,features:[]}),[]);
 assert.deepEqual(publicPlanHighlights({...plan,features:null}),[]);
 assert.deepEqual(publicPlanHighlights({...plan,features:['unknown_future_flag','<img src=x>','messages']}),['Messagerie']);
});
