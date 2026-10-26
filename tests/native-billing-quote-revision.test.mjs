import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../src/billing/nativeBillingQuoteGuard.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createNativeBillingQuoteGuard}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve};};

test('native quote guard permits the latest unchanged Boss choice',async()=>{
 const guard=createNativeBillingQuoteGuard(),ticket=guard.capture();
 assert.equal((await guard.read(ticket,async()=>({amount:3900,plan:'essential_plus'}))).amount,3900);
 assert.equal(guard.isCurrent(ticket),true);
});
test('native quote guard rejects a pending order after the user edits seats',async()=>{
 const guard=createNativeBillingQuoteGuard(),pending=deferred(),ticket=guard.capture();
 const response=guard.read(ticket,()=>pending.promise);
 guard.invalidate();
 pending.resolve({id:'obsolete-order'});
 await assert.rejects(response,/STALE_BILLING_QUOTE/);
 assert.equal(guard.isCurrent(ticket),false);
});
test('stale ticket cannot start a second Stripe provider call',async()=>{
 const guard=createNativeBillingQuoteGuard(),ticket=guard.capture();
 guard.invalidate();let providerCalls=0;
 await assert.rejects(guard.read(ticket,async()=>{providerCalls++;}),/STALE_BILLING_QUOTE/);
 assert.equal(providerCalls,0);
});
test('native previous confirm result cannot authorize a payment redirect after a plan edit',async()=>{
 const guard=createNativeBillingQuoteGuard(),pending=deferred(),ticket=guard.capture();
 const opened=[];
 const flow=(async()=>{
  const r=await guard.read(ticket,()=>pending.promise);
  await guard.read(ticket,async()=>opened.push(r.url));
 })();
 guard.invalidate();
 pending.resolve({url:'https://checkout.stripe.com/old-selection'});
 await assert.rejects(flow,/STALE_BILLING_QUOTE/);
 assert.deepEqual(opened,[]);
});
test('renewing an order uses a new revision instead of reviving the prior one',async()=>{
 const guard=createNativeBillingQuoteGuard();
 const previous=guard.capture(),latest=guard.invalidate();
 assert.equal(guard.isCurrent(previous),false);
 assert.equal(guard.isCurrent(latest),true);
 assert.equal(await guard.read(latest,async()=>42),42);
});
test('Expo BillingPanel wires every form edit and async quote through quote revisions',()=>{
 const mobile=readFileSync(new URL('../src/billing/BillingPanel.tsx',import.meta.url),'utf8');
 const ast=ts.createSourceFile('BillingPanel.tsx',mobile,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,ast.parseDiagnostics.map(d=>String(d.messageText)).join('; '));
 assert.match(mobile,/const quoteGuard=useRef\(createNativeBillingQuoteGuard\(\)\)/);
 assert.match(mobile,/const invalidateQuote=\(\)=>\{quoteGuard\.current\.invalidate\(\);setOrder\(null\);setPreview\(null\);\}/);
 assert.match(mobile,/onPress=\{\(\)=>\{setPlan\(p\.id\);invalidateQuote\(\);\}\}/);
 assert.match(mobile,/onPress=\{\(\)=>\{setCadence\(c\);invalidateQuote\(\);\}\}/);
 assert.match(mobile,/onChangeText=\{v=>\{setSeats\(v\);invalidateQuote\(\);\}\}/);
 assert.ok((mobile.match(/quoteGuard\.current\.read\(ticket/g)||[]).length>=6,
  'all offer/order/preview/confirm operations should check the quote revision');
 assert.match(mobile,/if\(!order\)throw Error\('Prévisualisation requise\.'\)/);
 assert.match(mobile,/e\?\.message!=='STALE_BILLING_QUOTE'/);
 assert.match(mobile,/\[seats,setSeats\]=useState\('20'\)/);
});
