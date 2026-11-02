import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {essentialCorrectionView,validateEssentialCorrection} from '../web/live/essential-correction.js';

const company='company-A',user='worker-A';
const closed={id:'session-A',company_id:company,user_id:user,started_at:'2026-11-01T12:00:00Z',ended_at:'2026-11-01T20:00:00Z'};
function view(sessions=[closed],requests=[]){
 return essentialCorrectionView({companyId:company,userId:user,snapshotCompanyId:company,snapshot:{sessions},requests});
}

test('correction list requires a matching verified server snapshot',()=>{
 assert.deepEqual(essentialCorrectionView({companyId:company,userId:user,snapshotCompanyId:'company-B',snapshot:{sessions:[closed]}}),{ready:false,sessions:[],requests:[]});
 assert.equal(essentialCorrectionView({companyId:company,userId:user,snapshotCompanyId:company,snapshot:null}).ready,false);
 assert.equal(essentialCorrectionView({companyId:company,userId:'',snapshotCompanyId:company,snapshot:{sessions:[closed]}}).ready,false);
});

test('only completed sessions of the selected worker and company can be corrected',()=>{
 const shown=view([
  {...closed,id:'foreign-company',company_id:'company-B'},
  {...closed,id:'foreign-worker',user_id:'worker-B'},
  {...closed,id:'still-open',ended_at:null},
  {...closed,id:'reverse',ended_at:'2026-11-01T11:00:00Z'},
  closed
 ]);
 assert.deepEqual(shown.sessions.map(s=>s.id),['session-A']);
 for(const sessionId of ['foreign-company','foreign-worker','still-open','reverse']){
  assert.equal(validateEssentialCorrection({view:shown,sessionId,reason:'Erreur de saisie'}).ok,false);
 }
});

test('requests shown to worker are restricted to current identity',()=>{
 const shown=view([closed],[
  {requested_by:user,reason:'À revoir',created_at:'2026-11-01T21:00:00Z'},
  {requested_by:'worker-B',reason:'Donnée étrangère'},
  {requested_by:user,company_id:'company-B',reason:'Autre entreprise'},
  {requested_by:user,company_id:company,reason:'Autre demande',created_at:'2026-11-02T21:00:00Z'}
 ]);
 assert.deepEqual(shown.requests.map(r=>r.reason),['Autre demande','À revoir']);
});

test('valid correction trims reason and converts local time to ISO without altering confirmed hours',()=>{
 const found=validateEssentialCorrection({view:view(),sessionId:closed.id,reason:'  Mauvais départ  ',
  requestedStart:'2026-11-03T08:00',requestedEnd:'2026-11-03T16:30'});
 assert.equal(found.ok,true);
 assert.equal(found.reason,'Mauvais départ');
 assert.equal(found.sessionId,closed.id);
 assert.equal(Date.parse(found.requestedEnd)-Date.parse(found.requestedStart),8.5*3600000);
 assert.equal(view().sessions[0].started_at,closed.started_at);
});

test('invalid dates, reversed hours and short explanations cannot be submitted',()=>{
 for(const input of [
  {reason:'ab'},
  {reason:'x'.repeat(1001)},
  {reason:'Revoir',requestedStart:'2026-02-30T08:00'},
  {reason:'Revoir',requestedStart:'2026-11-03T10:00',requestedEnd:'2026-11-03T09:00'},
  {reason:'Revoir',requestedStart:'2026-11-03 09:00'}
 ]){
  const result=validateEssentialCorrection({view:view(),sessionId:closed.id,...input});
  assert.equal(result.ok,false,JSON.stringify(input));
 }
 assert.equal(validateEssentialCorrection({view:{ready:false,sessions:[]},sessionId:closed.id,reason:'Revoir'}).ok,false);
});

test('Essentiel UI uses the server snapshot and revalidates identity and session before insert',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 assert.match(app,/import \{essentialCorrectionView,validateEssentialCorrection\} from '\.\/essential-correction\.js'/);
 assert.match(app,/const sessions=correction\.sessions/);
 assert.match(app,/correction\.requests\.map/);
 assert.match(app,/validateEssentialCorrection\(\{view,sessionId:sid,reason,requestedStart,requestedEnd\}\)/);
 assert.match(app,/if\(!navigator\.onLine\)return toast\(/);
 assert.match(app,/if\(state\.correctionSubmitting\)return/);
 assert.match(app,/sb\.auth\.getUser\(\)/);
 assert.match(app,/sb\.from\('punch_sessions'\)\.select\('id,company_id,user_id,started_at,ended_at'\)/);
 assert.match(app,/\.eq\('id',checked\.sessionId\)\.eq\('company_id',companyId\)\.eq\('user_id',userId\)/);
 assert.match(app,/requested_start:checked\.requestedStart,requested_end:checked\.requestedEnd/);
 assert.match(app,/Transmission non confirmée/);
});


test('Essentiel correction entry opens a dedicated scoped screen with a real return and disabled submission states',()=>{
 const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
 assert.match(app,/function essentialCorrectionPage\(\)/);
 assert.match(app,/if\(state\.sub==='essentialCorrection'\)return essentialCorrectionPage\(\)/);
 assert.match(app,/button\('Demander une correction','subpage','full','data-id="essentialCorrection"'\)/);
 assert.match(app,/button\('← Retour à mes heures','navigate','full','data-id="hours"'\)/);
 assert.match(app,/correction\.sessions\.length>0&&!state\.correctionSubmitting/);
 assert.match(app,/button\(state\.correctionSubmitting\?'Envoi en cours…':'Soumettre pour approbation'/);
 assert.match(app,/Aucune journée terminée et vérifiée/);
 assert.match(app,/correction\.requests\.slice\(0,30\)/);
});

test('PWA install includes correction module and versions the entry consistently',()=>{
 const html=readFileSync(new URL('../web/live/index.html',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../web/live/sw.js',import.meta.url),'utf8');
 assert.match(html,/app\.js\?v=essential-72-bento/);
 assert.match(sw,/app\.js\?v=essential-72-bento/);
 assert.match(sw,/punch-360-essential-v80-bento/);
 assert.match(sw,/'\.\/essential-correction\.js'/);
});
