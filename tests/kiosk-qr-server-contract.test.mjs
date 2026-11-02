import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseKioskQrEnvelope,checkKioskQrTrustedPreconditions,KIOSK_QR_REQUEST_ACTIONS} from '../supabase/functions/essential-kiosk/qr-contract.js';

const uuid='11111111-1111-4111-8111-111111111111';
const uuid2='22222222-2222-4222-8222-222222222222';
const valid=()=>({action:'qr_identify',deviceId:uuid,token:'a'.repeat(64),cardCode:'P360C1.'+'b'.repeat(64),pin:'829471'});
const checked=()=>({
 devicePaired:true,deviceNotRevoked:true,deviceTokenMatched:true,deviceNotLocked:true,
 siteEnabled:true,companyActiveForPunch:true,cardHashMatched:true,
 cardNotRevoked:true,cardNotExpired:true,cardBoundToWorker:true,cardBoundToCompany:true,
 phoneEnrollmentActive:true,workerActive:true,workerCanPunch:true,
 workerBelongsToCompany:true,independentPinMatched:true,pinNotLocked:true
});
test('QR identification accepts only opaque format with an independent PIN; no secret in result',()=>{
 const input=valid();
 const response=parseKioskQrEnvelope(input);
 assert.deepEqual(response,{ok:true,operation:'identify'});
 assert.doesNotMatch(JSON.stringify(response),new RegExp(input.cardCode));
 assert.doesNotMatch(JSON.stringify(response),new RegExp(input.pin));
 assert.equal(KIOSK_QR_REQUEST_ACTIONS.includes('qr_identify'),true);
});
test('QR punch shape requires an explicit idempotency event and only approved actions',()=>{
 for(const eventAction of ['in','out','break_start','break_start_paid','break_end']){
  const input={...valid(),action:'qr_execute',eventId:uuid2,eventAction};
  assert.deepEqual(parseKioskQrEnvelope(input),{ok:true,operation:'execute',eventAction});
 }
 for(const eventAction of ['enroll','identify','qr_identify','admin','erase','',null,0]){
  assert.deepEqual(parseKioskQrEnvelope({...valid(),action:'qr_execute',eventId:uuid2,eventAction}),{ok:false});
 }
 assert.deepEqual(parseKioskQrEnvelope({...valid(),action:'qr_execute',eventAction:'in'}),{ok:false});
 assert.deepEqual(parseKioskQrEnvelope({...valid(),action:'qr_execute',eventId:'stale',eventAction:'in'}),{ok:false});
});
test('QR only, empty code, fake number, or wrong device credentials cannot pass parsing',()=>{
 const input=valid();
 for(const [field,bad] of [['cardCode',''],['cardCode','AB-0248'],['cardCode','https://example.invalid/employee'],['cardCode','P360C1.'+'z'.repeat(64)],['cardCode','P360C1.'+'b'.repeat(63)],['cardCode','P360C1.'+'b'.repeat(65)],['deviceId','other-tenant'],['token','not-a-secret'],['pin',''],['pin','123'],['pin','12abc890'],['pin','1'.repeat(13)],['pin',null],['action','qr_pair']])
  assert.deepEqual(parseKioskQrEnvelope({...input,[field]:bad}),{ok:false},field+':'+String(bad).slice(0,12));
 assert.deepEqual(parseKioskQrEnvelope(null),{ok:false});
 assert.deepEqual(parseKioskQrEnvelope([]),{ok:false});
 assert.deepEqual(parseKioskQrEnvelope('P360C1.'+'b'.repeat(64)),{ok:false});
});
test('client cannot smuggle tenant, employee, site, authority or bypass flags into the QR request',()=>{
 for(const attribute of ['workerId','companyId','siteId','role','userId','isAdmin','verified','authorized','force','offline','allowRevoked','qrHash','expectedVersion'])
  assert.deepEqual(parseKioskQrEnvelope({...valid(),[attribute]:true}),{ok:false},attribute);
 const req={...valid(),action:'qr_execute',eventId:uuid2,eventAction:'in'};
 assert.deepEqual(parseKioskQrEnvelope({...req,companyId:uuid}),{ok:false});
});
test('trusted decision refuses absent evidence and false or truthy nonboolean proofs',()=>{
 assert.equal(checkKioskQrTrustedPreconditions(null),false);
 assert.equal(checkKioskQrTrustedPreconditions({}),false);
 assert.equal(checkKioskQrTrustedPreconditions([]),false);
 assert.equal(checkKioskQrTrustedPreconditions(checked()),true);
 for(const key of Object.keys(checked())){
  for(const bad of [false,undefined,'true',1,null]){
   const v=checked();v[key]=bad;
   assert.equal(checkKioskQrTrustedPreconditions(v),false,`Expected refusal for ${key}=${bad}`);
  }
 }
});
test('a copied credential with revoked phone, foreign company or PIN failure never passes preflight',()=>{
 for(const property of ['phoneEnrollmentActive','cardNotRevoked','cardBoundToCompany','workerBelongsToCompany','independentPinMatched','deviceNotRevoked','deviceTokenMatched']){
  const proof=checked();proof[property]=false;
  assert.equal(checkKioskQrTrustedPreconditions(proof),false,property);
 }
});
test('legacy kiosk Edge Function cannot accept or execute QR authorization before database transaction is implemented',()=>{
 const server=readFileSync(new URL('../supabase/functions/essential-kiosk/index.ts',import.meta.url),'utf8');
 assert.match(server,/\['identify','enroll','in','out','break_start','break_start_paid','break_end'\]\.includes\(p\.action\)/);
 assert.match(server,/parseKioskQrEnvelope\(p\)\.ok/);
 assert.match(server,/return reply\(403,\{ok:false,error:'OPERATION_REFUSED'\}\);/);
 assert.ok(server.indexOf("parseKioskQrEnvelope(p).ok")<server.indexOf("const client=createClient("),"QR must be rejected before privileged RPC");
 assert.doesNotMatch(server,/rpc\(['"]kiosk_qr_execute['"]/);
 const camera=readFileSync(new URL('../web/live/kiosk-qr-camera.js',import.meta.url),'utf8');
 assert.doesNotMatch(camera,/(?:fetch\(|\.rpc\(|localStorage|sessionStorage|console\.log|sendBeacon)/);
});
