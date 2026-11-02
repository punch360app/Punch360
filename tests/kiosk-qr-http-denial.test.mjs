import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseKioskQrEnvelope} from '../supabase/functions/essential-kiosk/qr-contract.js';

const source=readFileSync(new URL('../supabase/functions/essential-kiosk/index.ts',import.meta.url),'utf8');
// The production handler is Deno TypeScript. Only strip its exact TS syntax
// for this isolated Node HTTP test; do not replace or mock its logic.
const executable=source.replace(/^import .*;\n/gm,'')
 .replace('status:number,data:unknown','status,data')
 .replace('req:Request','req')
 .replace(/Deno\.env\.get\('SUPABASE_(URL|SERVICE_ROLE_KEY)'\)!/g,"Deno.env.get('SUPABASE_$1')");
const deviceId='11111111-1111-4111-8111-111111111111';
const eventId='22222222-2222-4222-8222-222222222222';
const qr=()=>({action:'qr_identify',deviceId,token:'a'.repeat(64),cardCode:'P360C1.'+'b'.repeat(64),pin:'829471'});
function harness(){
 const calls=[],database=[],secretReads=[];
 let request;
 const Deno={serve(callback){request=callback},env:{get(key){secretReads.push(key);return 'synthetic-test-only';}}};
 const createClient=()=>{database.push('initialized');return {rpc:async(name,p)=>{calls.push({name,p});return {data:{ok:true,name:'Synthetic worker',active:false},error:null}}}};
 new Function('Deno','Response','createClient','parseKioskQrEnvelope',executable)(Deno,Response,createClient,parseKioskQrEnvelope);
 const invoke=async(payload,{origin='https://punch360app.github.io',method='POST'}={})=>{
  const response=await request(new Request('https://localhost.test/functions/v1/essential-kiosk',{method,headers:{origin,'content-type':'application/json'},body:method==='POST'?JSON.stringify(payload):undefined}));
  return {status:response.status,body:await response.json()};
 };
 return {invoke,calls,database,secretReads};
}

test('QR identification is explicitly refused without calling Supabase or leaking the QR',async()=>{
 const h=harness(),request=qr(),answer=await h.invoke(request);
 assert.equal(answer.status,403);
 assert.deepEqual(answer.body,{ok:false,error:'OPERATION_REFUSED'});
 assert.deepEqual(h.database,[]);
 assert.deepEqual(h.secretReads,[]);
 assert.deepEqual(h.calls,[]);
 assert.doesNotMatch(JSON.stringify(answer),/P360C1|829471|Synthetic worker/);
});
test('QR punch is refused before a database client, including valid event/action/PIN',async()=>{
 const h=harness(),input={...qr(),action:'qr_execute',eventId,eventAction:'in'},answer=await h.invoke(input);
 assert.equal(answer.status,403);assert.deepEqual(h.database,[]);
 assert.deepEqual(h.secretReads,[]);
 assert.deepEqual(h.calls,[]);
});
test('malformed QR input fails closed with a generic error and zero privileged RPC calls',async()=>{
 for(const bad of [
  {...qr(),pin:''},
  {...qr(),cardCode:'copied-employee-number'},
  {...qr(),companyId:deviceId},
  {...qr(),role:'boss'},
  {...qr(),action:'qr_execute',eventId,eventAction:'enroll'},
  {...qr(),action:'qr_execute',eventAction:'out'}
 ]){
  const h=harness(),r=await h.invoke(bad);
  assert.equal(r.status,400);assert.equal(r.body.ok,false);assert.deepEqual(h.database,[]);
 }
});
test('foreign site cannot use the QR or standard PIN endpoint',async()=>{
 const h=harness(),r=await h.invoke(qr(),{origin:'https://not-punch.invalid'});
 assert.equal(r.status,403);assert.equal(r.body.error,'ORIGIN_DENIED');assert.deepEqual(h.database,[]);
});
test('the existing employee-number PIN identification still reaches the original kiosk RPC',async()=>{
 const h=harness(),input={action:'identify',deviceId,token:'a'.repeat(64),number:'SYNTH-001',pin:'829471'};
 const r=await h.invoke(input);
 assert.equal(r.status,200);
 assert.equal(r.body.name,'Synthetic worker');
 assert.equal(h.calls.length,1);
 assert.equal(h.calls[0].name,'kiosk_execute');
 assert.equal(h.calls[0].p.p_action,'identify');
 assert.equal(h.calls[0].p.p_number,'SYNTH-001');
 assert.deepEqual(h.secretReads,['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'],'the PIN path must still load server credentials');
});
