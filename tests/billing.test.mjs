import {test} from 'node:test';
import assert from 'node:assert/strict';
import {quote,accessState} from '../src/billing/policy.ts';
import {essentialPlanSeeds,proposedPlans} from '../src/billing/plans.ts';
test('three Essential tiers: exact CAD cents, annual discount on base and every seat',()=>{
 assert.equal(essentialPlanSeeds.length,3);
 essentialPlanSeeds.forEach((plan,i)=>{
 const q=quote(5,plan.pricing,'yearly');assert.equal(q.annualCents,[19380,39780,70380][i]);
 const six=quote(6,plan.pricing,'yearly');assert.equal(six.annualCents-q.annualCents,[3060,4080,5100][i]);
 assert.equal(quote(1,plan.pricing).monthlyCents,plan.pricing.baseCents);
 });
 assert.equal(proposedPlans.construction.pricing.baseCents,4900);
 assert.equal(essentialPlanSeeds.filter(x=>x.recommended).length,1);
});
test('invalid prices, discount NaN and unsafe arithmetic fail closed',()=>{
 const p=essentialPlanSeeds[0].pricing;
 for(const config of [{...p,annualDiscountPercent:NaN},{...p,annualDiscountPercent:Infinity},{...p,baseCents:-1},{...p,extraSeatCents:0.5},{...p,graceDays:-1},{...p,baseCents:Number.MAX_SAFE_INTEGER}])assert.throws(()=>quote(5,config));
 assert.throws(()=>quote(0,p));
});
test('editing the catalogue does not mutate an existing contractual price snapshot',()=>{
 const contract=structuredClone(essentialPlanSeeds[0].pricing);
 const revised={...essentialPlanSeeds[0].pricing,baseCents:2500};
 assert.equal(quote(5,contract,'yearly').dueCents,19380);assert.equal(quote(5,revised).dueCents,2500);
});
test('30-day grace expires at the boundary; cancellation does not renew grace',()=>{
 const s={paidThrough:'2026-10-01T00:00:00Z',firstUnpaidAt:'2026-10-01T00:00:00Z',canceled:false};
 assert.equal(accessState(s,'2026-10-30T23:59:59Z'),'grace');assert.equal(accessState(s,'2026-10-31T00:00:00Z'),'restricted');assert.equal(accessState({...s,canceled:true},'2026-10-02T00:00:00Z'),'restricted');
});
