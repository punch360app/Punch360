import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlatformPriceProposalsController} from '../web/live/platform-price-proposals.js';

const COMPANY='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const setup=()=>{
 const calls=[],sb={rpc:async(name,args)=>{calls.push({name,args});return {data:{company_id:COMPANY,version:1,items:[]}}}};
 const ctrl=createPlatformPriceProposalsController({sb,redraw(){},escape:s=>String(s)});
 ctrl.choose(COMPANY);
 ctrl.input({id:'platform-price-reason',value:'Vérification des tarifs propriétaire'});
 return {ctrl,calls};
};
const defaults=[
 ['essential','20','1900','20','200'],
 ['essential_plus','25','3900','25','200'],
 ['essential_pro','50','6900','50','200']
];
test('Super Admin draft opens at owner-approved Essentiel defaults, never historic five seats',()=>{
 const {ctrl}=setup();
 const state=ctrl.state;
 assert.deepEqual([state.plan,state.seats,state.base,state.included,state.extra,state.discount],
 ['essential','20','1900','20','200','15']);
 assert.match(ctrl.render(),/Essentiel 19 \$ \/ 20 places/);
});
test('selecting each plan with untouched values prefills ONLY that owner-approved tier',()=>{
 const {ctrl}=setup();
 for(const [plan,seats,base,included,extra] of defaults){
  ctrl.input({id:'platform-price-plan',value:plan});
  const s=ctrl.state;
  assert.deepEqual([s.seats,s.base,s.included,s.extra,s.discount],
   [seats,base,included,extra,'15']);
 }
 ctrl.reset();
 assert.equal(ctrl.state.seats,'20');
});
test('negotiated edits survive changing plan, never silently overwrite a custom quote',()=>{
 const {ctrl}=setup();
 ctrl.input({id:'platform-price-seats',value:'29'});
 ctrl.input({id:'platform-price-base',value:'2750'});
 ctrl.input({id:'platform-price-extra',value:'150'});
 ctrl.input({id:'platform-price-plan',value:'essential_pro'});
 assert.equal(ctrl.state.plan,'essential_pro');
 assert.deepEqual([ctrl.state.seats,ctrl.state.base,ctrl.state.extra],['29','2750','150']);
 assert.match(ctrl.state.notice,/Valeurs négociées conservées/);
 assert.match(ctrl.render(),/Les contrats|les contrats|Les contrats et prix Stripe/);
});
test('server quote parameters use correct selected plan and cannot create a Stripe mutation',async()=>{
 const {ctrl,calls}=setup();
 ctrl.input({id:'platform-price-plan',value:'essential_plus'});
 await ctrl.handle({dataset:{action:'platform-price:load'}});
 const payload=calls.find(x=>x.name==='platform_company_price_list');
 assert.equal(payload.args.p_company,COMPANY);
 assert.equal(calls.some(x=>x.name.includes('stripe')||x.name.includes('billing')),false);
 assert.equal(ctrl.state.base,'3900');
 assert.equal(ctrl.state.included,'25');
});
