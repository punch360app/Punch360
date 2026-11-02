import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localPunchSyncState} from '../web/live/punch-sync-state.js';
import {hasUnsafePunchJournalEntries} from '../web/live/journal.js';

const journal=readFileSync(new URL('../src/punch/journal.ts',import.meta.url),'utf8');
const screen=readFileSync(new URL('../src/workforce/EssentialWorkspace.tsx',import.meta.url),'utf8');
const summarySource=journal.slice(journal.indexOf('export async function journalSummary(company:string){'))
 .replace('export async function journalSummary(company:string){','async function journalSummary(company){');
const own=(id,action,status='pending')=>({id,company:'A',user:'U',action,status,job:'PRIVATE-SITE',
 occurredAt:'2026-11-02T10:00:00Z',previous:null,fix:{latitude:49,longitude:-71},
 offline:false,result:{message:'Private result'}});
function fixture(queue){
 const j={company:'A',user:'U',read:async()=>{if(queue instanceof Error)throw queue;return queue}};
 const get=new Function('getPunchJournal','localPunchSyncState','hasUnsafePunchJournalEntries',
  summarySource+'\nreturn journalSummary;')(
  async()=>j,localPunchSyncState,hasUnsafePunchJournalEntries);
 return get('A');
}
test('Native detailed timeline returns sanitized labels and dates, without jobs or GPS',async()=>{
 const summary=await fixture([own('x','in'),{...own('y','break_start'),occurredAt:'2026-11-02T12:00:00Z'},own('z','out','conflict')]);
 assert.equal(summary.pending,2);assert.equal(summary.conflicts,1);assert.equal(summary.blocked,false);
 assert.deepEqual(summary.pendingItems.map(x=>x.label),['Entrée','Début de pause']);
 assert.deepEqual(summary.conflictItems.map(x=>x.label),['Sortie']);
 assert.doesNotMatch(JSON.stringify(summary),/PRIVATE-SITE|latitude|longitude|Private result/);
});
test('Native timeline limits list to five but retains full exact counts',async()=>{
 const queue=Array.from({length:9},(_,i)=>({...own(String(i),'transfer'),occurredAt:'2026-11-02T10:0'+i+':00Z'}));
 const summary=await fixture(queue);
 assert.equal(summary.pending,9);assert.equal(summary.pendingItems.length,5);
 assert.equal(summary.pendingItems[0].occurredAt,'2026-11-02T10:04:00Z');
});
test('Native timeline never leaks another worker or company when journal is mixed',async()=>{
 const summary=await fixture([own('own','in'),{...own('foreign','out'),company:'B'}]);
 assert.deepEqual(summary,{pending:0,conflicts:0,blocked:true,pendingItems:[],conflictItems:[]});
});
test('Native malformed historical journal rows do not become a fake punch',async()=>{
 for(const rows of [null,[null],[{...own('bad','in'),user:'V'}],new Error('Corrupt JSON')]){
  assert.deepEqual(await fixture(rows),{pending:0,conflicts:0,blocked:true,pendingItems:[],conflictItems:[]});
 }
});
test('Native details ignore synced events and separate pending from conflicts',async()=>{
 const summary=await fixture([own('a','in','synced'),own('b','out','conflict'),own('c','in')]);
 assert.equal(summary.pending,1);assert.equal(summary.conflicts,1);
 assert.equal(summary.pendingItems[0].label,'Entrée');assert.equal(summary.conflictItems[0].label,'Sortie');
});
test('Native hours UI renders time-safe read-only items, truncation and recovery states',()=>{
 assert.match(screen,/pendingItems\.map\(\(item,i\)=>/);
 assert.match(screen,/conflictItems\.map\(\(item,i\)=>/);
 assert.match(screen,/new Date\(item\.occurredAt\)\.toLocaleString\('fr-CA'/);
 assert.match(screen,/!journalBlocked\?<>/);
 assert.match(screen,/setJournalBlocked\(!!updated\.localJournalBlocked\|\|summary\.blocked\)/);
 assert.match(screen,/pending>pendingItems\.length/);
 assert.match(screen,/conflicts>conflictItems\.length/);
 assert.match(screen,/setPendingItems\(summary\.pendingItems\);setConflictItems\(summary\.conflictItems\)/);
 assert.doesNotMatch(screen,/item\.job|item\.fix|item\.result/);
});
