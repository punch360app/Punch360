import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {KIOSK_LANGUAGES,createKioskLocale} from '../web/live/kiosk-locale.js';

test('kiosk has 10 nonempty translations for every action, including clock in/out',()=>{
 assert.equal(KIOSK_LANGUAGES.length,10);
 for(const lang of KIOSK_LANGUAGES){
  const l=createKioskLocale();l.select(lang.code);
  for(const key of ['pairTitle','pairCode','personalPin','ready','breakEnd','breakPaid','breakUnpaid','startDay','endDay','privacy','cancelReturn']){
   assert.ok(l.t(key).trim().length>0&&l.t(key)!==key,lang.code+' missing '+key);
  }
 }
 const rtl=createKioskLocale();rtl.select('ar');assert.equal(rtl.dir,'rtl');
 rtl.select('en');assert.equal(rtl.dir,'ltr');
 rtl.select('unknown');assert.equal(rtl.code,'fr');
});
test('changing kiosk language never persists or clears private PIN and resets to French after session',async()=>{
 const kiosk=(await readFile(new URL('../web/live/kiosk.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
 const lang=(await readFile(new URL('../web/live/kiosk-locale.js',import.meta.url),'utf8')).replace(/^export /gm,'');
 const w=new Window({url:'https://punch.test/kiosk.html',settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true}});
 w.document.body.innerHTML='<main id="kiosk"></main>';
 const offlineMock='const createKioskOffline=()=>({list:async()=>[],prune:async()=>{},forget:async()=>{},remember:async()=>{},unlock:async()=>{throw Error("no private grant")},sync:async()=>[]});';
 w.eval(offlineMock+'\n'+lang+'\n'+kiosk.slice(0,kiosk.indexOf('(async()=>{try{state.device='))+`state.device={device_id:'test',token:'not-persisted',company_name:'Atelier',name:'Entrée'};draw();window.__clear=clearPerson;`);
 w.document.querySelector('#number').value='EMP-023';
 w.document.querySelector('#pin').value='829471';
 const choice=w.document.querySelector('#kiosk-language');
 choice.value='ar';choice.dispatchEvent(new w.Event('change',{bubbles:true}));
 assert.equal(w.document.querySelector('#number').value,'EMP-023');
 assert.equal(w.document.querySelector('#pin').value,'829471');
 assert.equal(w.document.getElementById('kiosk').getAttribute('dir'),'rtl');
 assert.equal(w.localStorage.length,0);
 assert.equal(w.sessionStorage.length,0);
 w.__clear();
 assert.equal(w.document.querySelector('#kiosk-language').value,'fr');
 assert.equal(w.document.querySelector('#pin').value,'');
 await w.happyDOM.close();
});
