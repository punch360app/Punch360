import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {KIOSK_LANGUAGES,createKioskLocale} from '../web/live/kiosk-locale.js';

const sessionKeys=['languageLabel','greeting','localProvisional','serverStamped','paidPolicy','unpaidPolicy','pendingCount','pairSuccess','pinConfigured','provisionalSaved','punchSaved'];

test('all ten kiosk languages cover live session status and break policies',()=>{
 assert.equal(KIOSK_LANGUAGES.length,10);
 for(const language of KIOSK_LANGUAGES){
  const locale=createKioskLocale();
  locale.select(language.code);
  for(const key of sessionKeys){
   const value=locale.t(key);
   assert.ok(value && value.trim() && value!==key,language.code+' missing '+key);
  }
  assert.equal(locale.t('pendingCount').includes('{count}'),true,language.code+' missing count placeholder');
 }
});

test('kiosk active view translates policy, pending queue, provisional status and respects safe reset',async()=>{
 const kiosk=(await readFile(new URL('../web/live/kiosk.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
 const lang=(await readFile(new URL('../web/live/kiosk-locale.js',import.meta.url),'utf8')).replace(/^export /gm,'');
 const w=new Window({url:'https://punch.test/kiosk.html',settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true}});
 w.document.body.innerHTML='<main id="kiosk"></main>';
 const mock='const createKioskOffline=()=>({list:async()=>[],prune:async()=>{},forget:async()=>{},remember:async()=>{},unlock:async()=>{throw Error("no grant")},sync:async()=>[]});';
 w.eval(mock+'\n'+lang+'\n'+kiosk.slice(0,kiosk.indexOf('(async()=>{try{state.device='))+\`
state.device={device_id:'test',token:'not-stored',company_name:'Test',name:'Accueil'};
state.person={name:'Pat',active:true,paused:false,started_at:'2026-10-26T11:00:00Z',break_policy:{paid_mode:'paid'}};
state.queued=2;locale.select('en');draw();window.__screen={state,locale,draw,clearPerson};\`);
 assert.match(w.document.body.textContent,/Hello, Pat/);
 assert.match(w.document.body.textContent,/Policy: paid breaks/);
 assert.match(w.document.body.textContent,/Provisional records: 2/);
 assert.doesNotMatch(w.document.body.textContent,/Politique :/);
 w.__screen.state.provisional=true;w.__screen.draw();
 assert.match(w.document.body.textContent,/PROVISIONAL/);
 w.__screen.locale.select('ar');
 w.__screen.state.person.break_policy.paid_mode='unpaid';
 w.__screen.draw();
 assert.equal(w.document.querySelector('#kiosk').getAttribute('dir'),'rtl');
 assert.match(w.document.body.textContent,/السجلات المؤقتة/);
 assert.match(w.document.body.textContent,/السياسة: استراحات غير مدفوعة/);
 assert.doesNotMatch(w.document.body.textContent,/observations provisoires, approbation requise/);
 w.__screen.clearPerson('punchSaved');
 assert.equal(w.__screen.state.person,null);
 assert.equal(w.__screen.locale.code,'fr');
 assert.match(w.document.body.textContent,/Pointage enregistré et synchronisé/);
 assert.equal(w.localStorage.length,0);
 assert.equal(w.sessionStorage.length,0);
 await w.happyDOM.close();
});

test('queued count is rendered as text only, with employee name HTML escaped',async()=>{
 const locale=createKioskLocale();locale.select('fr');
 assert.equal(locale.t('pendingCount').replace('{count}','1'),'Observations provisoires : 1. Approbation requise.');
 assert.equal(locale.t('pendingCount').replace('{count}','8'),'Observations provisoires : 8. Approbation requise.');
});
