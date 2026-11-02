import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {localPunchSyncState} from '../web/live/punch-sync-state.js';

const own={id:'evt-a',company:'business-A',user:'worker-A',status:'pending',
 action:'in',occurredAt:'2026-11-01T10:00:00Z',fix:{latitude:47,longitude:-71},
 job:'private-job',result:{secret:'no-show'}};

test('only pending punches of the authenticated company and employee appear',()=>{
 const found=localPunchSyncState([
  {...own,company:'business-B',id:'foreign-business'},
  {...own,user:'worker-B',id:'foreign-user'},
  own,{...own,id:'evt-b',action:'break_start',occurredAt:'2026-11-01T11:00:00Z'}
 ],'business-A','worker-A');
 assert.deepEqual(found.pending,[
  {label:'Entrée',occurredAt:'2026-11-01T10:00:00Z'},
  {label:'Début de pause',occurredAt:'2026-11-01T11:00:00Z'}
 ]);
 assert.deepEqual(found.conflicts,[]);
 assert.doesNotMatch(JSON.stringify(found),/private-job|secret|latitude|longitude/);
});

test('server conflicts remain separate from pending transmissions',()=>{
 const found=localPunchSyncState([
  {...own,id:'already-synced',status:'synced'},
  {...own,id:'server-conflict',status:'conflict',action:'out'},
  {...own,id:'pending-transfer',action:'transfer'}
 ],'business-A','worker-A');
 assert.deepEqual(found.pending,[{label:'Changement de chantier',occurredAt:own.occurredAt}]);
 assert.deepEqual(found.conflicts,[{label:'Sortie',occurredAt:own.occurredAt}]);
});

test('bad data and unknown actions never leak raw event details',()=>{
 for(const value of [null,{},'oops',[],[null],[
  {...own,status:'pending',id:''},
  {...own,id:'legacy',action:'malicious <img onerror=alert(1)>',occurredAt:'not a date'}
 ]]){
  const s=localPunchSyncState(value,'business-A','worker-A');
  assert.ok(Array.isArray(s.pending)&&Array.isArray(s.conflicts));
  assert.doesNotMatch(JSON.stringify(s),/<img|alert\(/);
 }
 const legacy=localPunchSyncState([{...own,id:'legacy',action:'not-listed',occurredAt:'invalid'}],'business-A','worker-A');
 assert.deepEqual(legacy.pending,[{label:'Action inconnue',occurredAt:null}]);
 assert.deepEqual(localPunchSyncState([own],'business-A','other-worker'),{pending:[],conflicts:[]});
});

test('employee UI shares a scoped journal status on home and hours, with manual retry',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 assert.match(app,/import \{localPunchSyncState\} from '\.\/punch-sync-state\.js';/);
 assert.match(app,/function essentialPunchSyncPanel\(\)/);
 assert.match(app,/essentialPunchSyncPanel\(\)/);
 assert.match(app,/data-action="syncPendingPunches"|button\('Synchroniser maintenant','syncPendingPunches'/);
 assert.match(app,/if\(a==='syncPendingPunches'\)/);
 assert.match(app,/state\.localPunchEvents=events/);
 assert.match(app,/state\.localPunchEvents=\[\]/);
});
