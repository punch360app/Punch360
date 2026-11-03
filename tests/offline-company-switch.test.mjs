import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
const from=app.indexOf('let punchLoadRevision=0;');
const to=app.indexOf('async function reload(',from);
assert.ok(from>=0&&to>from,'punch load function not found');
const source=app.slice(from,to);

function harness(journal){
 const state={account:{company_id:'company-A'},user:{id:'user-A'},
  sessions:[{id:'original'}],segments:[],breaks:[],localPending:0,selected:'old'};
 let projections=0,saves=0;
 const loadData=new Function('state','member','company','punchJournal',
  'navigator','projectPendingPunches','saveOfflineSnapshot','currentSession','localPunchSyncState',`
   ${source}
   return loadData;`)(
  state,()=>!!state.account&&!!state.user,
  ()=>state.account?.company_id,()=>journal,{onLine:false},
  ()=>{projections++;return {sessions:[{id:'foreign'}],segments:[],breaks:[]};},
  ()=>{saves++;},()=>null,()=>({pending:[],conflicts:[]})
 );
 return {state,loadData,counters:()=>({projections,saves})};
}

test('a company switch during offline inspection discards the old request without replacing new company state',async()=>{
 let release;
 const journal={flush:()=>{throw Error('Offline must never flush')},
  inspect:()=>new Promise(resolve=>{release=resolve})};
 const h=harness(journal),pending=h.loadData();
 h.state.account={company_id:'company-B'};
 release({events:[],sent:0,pending:0});await pending;
 assert.deepEqual(h.counters(),{projections:0,saves:0});
 assert.deepEqual(h.state.sessions,[{id:'original'}]);
});

test('a sign-out during offline journal read cannot repopulate the session',async()=>{
 let release;
 const journal={flush:()=>{throw Error('Offline must never flush')},
  inspect:()=>new Promise(resolve=>{release=resolve})};
 const h=harness(journal),pending=h.loadData();
 await Promise.resolve();
 assert.equal(typeof release,'function');
 h.state.account=null;h.state.user=null;
 release({events:[],sent:0,pending:0});await pending;
 assert.deepEqual(h.counters(),{projections:0,saves:0});
 assert.deepEqual(h.state.sessions,[{id:'original'}]);
});

test('a second refresh for the same account invalidates an earlier pending refresh',async()=>{
 let release,count=0;
 const journal={
  flush:()=>{throw Error('Offline must never flush')},
  inspect:()=>++count===1?new Promise(resolve=>{release=resolve}):Promise.resolve({events:[],sent:0,pending:0})
 };
 const h=harness(journal),old=h.loadData();
 await h.loadData();
 assert.deepEqual(h.counters(),{projections:1,saves:1});
 release();await old;
 assert.deepEqual(h.counters(),{projections:1,saves:1});
});

test('online result and segment refreshes are checked against the same captured user/company',()=>{
 assert.match(source,/const companyId=company\(\),userId=state\.user\?\.id,revision=\+\+punchLoadRevision,journal=punchJournal\(\)/);
 assert.match(source,/\]\);if\(!scopeCurrent\(\)\)return;state\.conversationsCompany=null/);
 assert.match(source,/if\(!scopeCurrent\(\)\)return;\s*if\(state\.sessions\.length\)/);
 assert.match(source,/const events=flushed\.events/);
 assert.match(source,/const onlineAtStart=navigator\.onLine===true/);
 assert.match(source,/onlineAtStart\?journal\.flush\(\):journal\.inspect\(\)/);
 assert.doesNotMatch(source,/view\.lastJobId/);
});
