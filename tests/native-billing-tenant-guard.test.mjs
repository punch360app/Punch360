import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const file=readFileSync(new URL('../src/billing/nativeBillingOperationGuard.ts',import.meta.url),'utf8');
const js=ts.transpileModule(file,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createNativeBillingOperationGuard,billingGuardedResult}=await import(
 'data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa:user-a';
const b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:user-b';
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};

test('new Boss/company view invalidates old operation scope',()=>{
 const guard=createNativeBillingOperationGuard();
 assert.equal(guard.begin(a)(),false,'not active until mounted');
 guard.activate(a);
 const first=guard.begin(a);
 assert.equal(first(),true);
 assert.equal(guard.begin(b)(),false);
 guard.invalidate();
 assert.equal(first(),false,'signout or unmount closes the operation');
 guard.activate(b);
 assert.equal(first(),false,'former Boss never regains authority');
 assert.equal(guard.begin(b)(),true);
 assert.equal(guard.begin(a)(),false);
 guard.activate(b);
 assert.equal(guard.begin(b)(),true);
 assert.equal(first(),false);
});

test('late Stripe portal response cannot navigate after logout',async()=>{
 const guard=createNativeBillingOperationGuard();guard.activate(a);
 const current=guard.begin(a),pending=deferred(),opened=[];
 const flow=(async()=>{
  const response=await billingGuardedResult(current,()=>pending.promise);
  await billingGuardedResult(current,async()=>{opened.push(response.url);});
 })();
 guard.invalidate();
 pending.resolve({url:'https://billing.stripe.com/old-company'});
 await assert.rejects(flow,/STALE_BILLING_VIEW/);
 assert.deepEqual(opened,[]);
});

test('late offer order does not trigger a Stripe preview for the next company',async()=>{
 const guard=createNativeBillingOperationGuard();guard.activate(a);
 const current=guard.begin(a),pending=deferred(),calls=[];
 const flow=(async()=>{
  const id=await billingGuardedResult(current,()=>pending.promise);
  await billingGuardedResult(current,async()=>{calls.push({action:'preview',orderId:id});});
 })();
 guard.invalidate();guard.activate(b);
 pending.resolve('order-for-a');
 await assert.rejects(flow,/STALE_BILLING_VIEW/);
 assert.equal(calls.length,0);
});

test('Alert confirmation triggered after component unmount never initiates provider action',async()=>{
 const guard=createNativeBillingOperationGuard();guard.activate(a);
 let providerCalls=0;
 guard.invalidate();
 const current=guard.begin(a);
 assert.equal(current(),false);
 await assert.rejects(billingGuardedResult(current,async()=>{providerCalls++;}),/STALE_BILLING_VIEW/);
 assert.equal(providerCalls,0);
});

test('a current scope permits legitimate Stripe portal navigation',async()=>{
 const guard=createNativeBillingOperationGuard();guard.activate(a);
 const current=guard.begin(a),opened=[];
 const response=await billingGuardedResult(current,async()=>({url:'https://billing.stripe.com/this-company'}));
 await billingGuardedResult(current,async()=>{opened.push(response.url);});
 assert.deepEqual(opened,['https://billing.stripe.com/this-company']);
});

test('native BillingPanel consistently guards RPC, Stripe operations, redirects and stale UI updates',()=>{
 const src=readFileSync(new URL('../src/billing/BillingPanel.tsx',import.meta.url),'utf8');
 const ast=ts.createSourceFile('BillingPanel.tsx',src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,ast.parseDiagnostics.map(d=>String(d.messageText)).join('; '));
 assert.match(src,/createNativeBillingOperationGuard\(\)/);
 assert.match(src,/operationGuard\.current\.activate\(scopeKey\)/);
 assert.match(src,/operationGuard\.current\.invalidate\(\)/);
 assert.match(src,/const scopeKey=account\.companyId\+':'\+account\.userId/);
 assert.match(src,/const current=operationGuard\.current\.begin\(scopeKey\)/);
 assert.match(src,/if\(!current\(\)\)return; \/\/ e\.g\. Alert callback fired after sign-out/);
 assert.match(src,/const checked:Checked=operation=>billingGuardedResult\(current,operation\)/);
 assert.match(src,/catch\(e:any\)\{if\(current\(\)\&\&e\?\.message!=='STALE_BILLING_QUOTE'\)setError/);
 assert.match(src,/finally\{if\(current\(\)\)\{busyRef\.current=false;setBusy\(false\);\}\}/);
 assert.match(src,/await quoteGuard\.current\.read\(ticket,\(\)=>checked\(\(\)=>rpc\('essential_company_price_order'/);
 assert.match(src,/await quoteGuard\.current\.read\(ticket,\(\)=>checked\(\(\)=>rpc\('essential_billing_order'/);
 assert.match(src,/await quoteGuard\.current\.read\(ticket,\(\)=>checked\(\(\)=>call\('preview'/);
 assert.match(src,/await checked\(\(\)=>call\('portal'\)\)/);
 assert.match(src,/await checked\(\(\)=>open\(portal\.url\)\)/);
 assert.match(src,/await quoteGuard\.current\.read\(ticket,\(\)=>checked\(\(\)=>open\(r\.url\)\)/);
 assert.match(src,/onPress:\(\)=>run\(async checked=>/);
 assert.match(src,/await checked\(\(\)=>call\(action,\{requestId:id\}\)\)/);
 assert.match(src,/await checked\(\(\)=>open\(i\.url\)\)/);
});
