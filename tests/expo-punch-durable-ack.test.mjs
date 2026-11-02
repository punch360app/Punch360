import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hasUnsafePunchJournalEntries,normalizeFreshPunchFix} from '../web/live/journal.js';
const api=readFileSync(new URL('../src/punch/api.ts',import.meta.url),'utf8');
const a=api.indexOf('async function punchWithLocation('),b=api.indexOf('export const punchIn=',a);
assert.ok(a>0&&b>a);
const source=api.slice(a,b)
 .replace("async function punchWithLocation(companyId:string,action:'in'|'out'|'transfer'|'break_start'|'break_end',jobId?:string,paid=false):Promise<LocationCheckResult>{",
  "async function punchWithLocation(companyId,action,jobId,paid=false){")
 .replace('let latitude:number|null=null,longitude:number|null=null,accuracy:number|null=null;',
  'let latitude=null,longitude=null,accuracy=null;')
 .replace('new Promise<never>','new Promise')
 .replace('longitude!','longitude')
 .replace('let events:LocalPunchEvent[]|null=null;','let events=null;')
 .replaceAll(' as LocationCheckResult','');
function fixture({flush='pending',read='pending',noAppend=false,bad=false,gpsFix=null}={}){
 const sent=[];let appendedFix;const row={id:'E1',company:'A',user:'U',action:'in',job:'J',fix:null,
  occurredAt:'2026-11-02T12:00:00Z',previous:null,status:'pending',offline:true};
 const response={sync_status:'synced',session_id:'S',review_status:'pending'};
 const stored=status=>({...row,status,...(status==='synced'?{result:response}:
  status==='conflict'?{result:{message:'Validation'}}:{})});
 const journal={company:'A',user:'U',
  append:async(action,job,fix)=>{appendedFix=fix;sent.push('append');if(noAppend)throw Error('échec stockage');return row},
  flush:async()=>{sent.push('flush');if(flush==='throw')throw Error('réseau');return {events:flush==='missing'?[]:[stored(flush)]}},
  read:async()=>{sent.push('read');if(read==='throw')throw Error('illisible');
   return read==='missing'?[]:[bad?{...stored(read),company:'B'}:stored(read)]}
 };
 const go=new Function('Network','Location','getPunchJournal','hasUnsafePunchJournalEntries','normalizeFreshPunchFix',source+'\nreturn punchWithLocation;')(
  {getNetworkStateAsync:async()=>({isConnected:false,isInternetReachable:false})},
  {Accuracy:{High:1},requestForegroundPermissionsAsync:async()=>({status:gpsFix?'granted':'denied'}),getCurrentPositionAsync:async()=>({coords:gpsFix})},async()=>journal,hasUnsafePunchJournalEntries,normalizeFreshPunchFix);
 return {sent,run:()=>go('A','in','J'),capturedFix:()=>appendedFix};
}
test('durably appended event survives failed flush and reports local pending',async()=>{
 const h=fixture({flush:'throw'}),r=await h.run();
 assert.equal(r.queued,true);assert.equal(r.review_status,'local');
 assert.deepEqual(h.sent,['append','flush','read']);
});
test('missing event in response is checked in local journal',async()=>{
 const h=fixture({flush:'missing'});assert.equal((await h.run()).queued,true);
 assert.equal(h.sent.at(-1),'read');
});
test('synced event is not presented as locally pending or payroll approved',async()=>{
 const r=await fixture({flush:'synced'}).run();assert.equal(r.queued,false);
 assert.equal(r.review_status,'pending');assert.equal(r.session_id,'S');
});
test('server acknowledgment persisted despite flush exception is recovered',async()=>{
 const r=await fixture({flush:'throw',read:'synced'}).run();assert.equal(r.queued,false);assert.equal(r.session_id,'S');
});
test('server conflict remains reviewable, never falsely accepted',async()=>{
 await assert.rejects(fixture({flush:'conflict'}).run(),/Conflit de pointage/);
});
test('local append failure never triggers a network flush',async()=>{
 const h=fixture({noAppend:true});await assert.rejects(h.run(),/échec stockage/);
 assert.deepEqual(h.sent,['append']);
});
test('missing or unreadable local journal refuses false confirmation',async()=>{
 for(const read of ['missing','throw'])await assert.rejects(
  fixture({flush:'throw',read}).run(),/introuvable|illisible/);
});
test('journal containing another company fails closed',async()=>{
 await assert.rejects(fixture({flush:'throw',bad:true}).run(),/Journal local non vérifiable/);
});
test('status resolution uses event ID plus company/user preflight',()=>{
 assert.match(api,/hasUnsafePunchJournalEntries\(events,journal\.company,journal\.user\)/);
 assert.match(api,/const saved=events\.find\(e=>e\.id===event\.id\)/);
 assert.match(api,/if\(saved\.status==='pending'\)/);
});

test('Expo preserves the punch when native GPS is malformed and records missing GPS for review',async()=>{
 for(const sample of [
  {latitude:95,longitude:-71,accuracy:15},
  {latitude:46,longitude:-71,accuracy:-2},
  {latitude:46,longitude:Infinity,accuracy:5}
 ]){
  const f=fixture({gpsFix:sample}),r=await f.run();
  assert.equal(r.queued,true);
  assert.equal(f.capturedFix(),null);
  assert.deepEqual(f.sent,['append','flush']);
 }
});
test('Expo records only valid normalized GPS coordinates without leaking extra device fields',async()=>{
 const f=fixture({gpsFix:{latitude:46.81,longitude:-71.22,accuracy:9,private:'not-stored'}});
 const result=await f.run();
 assert.equal(result.queued,true);
 assert.deepEqual(f.capturedFix(),{latitude:46.81,longitude:-71.22,accuracy:9});
});
