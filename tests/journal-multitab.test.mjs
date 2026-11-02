import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PunchJournal,projectPendingPunches} from '../web/live/journal.js';

// Use two distinct journal instances with the same Web Locks-style mutex
// and localStorage backing. No database or real employee data is involved.
function pairedJournals(send){
 const memory=new Map();let lock=Promise.resolve(),counter=0;
 const withLock=fn=>{const next=lock.then(fn);lock=next.catch(()=>{});return next;};
 const options={company:'tenant-A',user:'employee-A',storage:{
  get:async key=>memory.get(key)||null,set:async(key,value)=>{memory.set(key,value);}
 },uuid:()=>String(++counter),withLock,send};
 return {first:new PunchJournal(options),second:new PunchJournal(options),memory};
}
test('two tabs flushing the same queue send each event exactly once',async()=>{
 const deliveries=[];
 const {first,second}=pairedJournals(async event=>{
  deliveries.push(event.id);return {sync_status:'synced',event_id:event.id};
 });
 await first.append('in','job-1',null,'2026-11-01T08:00:00Z');
 await second.append('out',null,null,'2026-11-01T17:00:00Z');
 await Promise.all([first.flush(),second.flush()]);
 assert.deepEqual(deliveries,['1','2']);
 assert.deepEqual((await first.read()).map(e=>e.status),['synced','synced']);
});

test('a second tab can append while first tab flush is blocked, without losing order',async()=>{
 let unblock,started;
 const sent=[],startedPromise=new Promise(resolve=>{started=resolve;});
 const {first,second}=pairedJournals(async event=>{
  sent.push(event.action);
  if(event.action==='in'){started();await new Promise(resolve=>{unblock=resolve;});}
  return {sync_status:'synced'};
 });
 await first.append('in','job-1',null,'2026-11-01T08:00:00Z');
 const firstFlush=first.flush();
 await startedPromise;
 const append=second.append('out',null,null,'2026-11-01T17:00:00Z');
 const secondFlush=second.flush();
 unblock();
 await Promise.all([firstFlush,append,secondFlush]);
 const after=await first.read();
 assert.deepEqual(after.map(e=>e.action),['in','out']);
 assert.deepEqual(after.map(e=>e.status),['synced','synced']);
 assert.deepEqual(sent,['in','out']);
 assert.equal(after[1].previous,after[0].id);
});

test('a lost server response keeps the same event ID across tab handover and reconnection',async()=>{
 let tries=0;const delivered=[];
 const {first,second}=pairedJournals(async event=>{
  delivered.push([event.id,event.offline]);
  if(!tries++)throw new Error('lost acknowledgment');
  return {sync_status:'synced'};
 });
 await first.append('in','job-1',null,'2026-11-01T08:00:00Z');
 await first.flush();
 assert.equal((await second.pending()).length,1);
 await second.flush();
 assert.deepEqual(delivered,[['1',false],['1',true]]);
 assert.equal((await second.pending()).length,0);
});

test('native Expo persists the offline state and shares the same append signature',()=>{
 const native=readFileSync(new URL('../src/punch/api.ts',import.meta.url),'utf8');
 const declaration=readFileSync(new URL('../web/live/journal.d.ts',import.meta.url),'utf8');
 assert.match(native,/offline=network\.isConnected===false\|\|network\.isInternetReachable===false/);
 assert.match(native,/catch\{offline=true;\}/);
 assert.match(native,/journal\.append\(action,jobId,[\s\S]*?,occurredAt,paid,offline\)/);
 assert.match(declaration,/occurredAt\?:string,paid\?:boolean,offline\?:boolean/);
});
