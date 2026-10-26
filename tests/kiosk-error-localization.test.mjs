import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {KIOSK_LANGUAGES,createKioskLocale} from '../web/live/kiosk-locale.js';

const keys=['errorInput','errorPinMismatch','errorDenied','errorRate','errorPinPolicy','errorActive','errorNoSession','errorOperation','errorOfflineIdentity','errorOfflineConflict','errorNetwork','errorPending','errorRetry','errorPolicy','errorClock'];

test('kiosk incident catalog is complete in 10 languages and does not fall back to a raw code',()=>{
 for(const language of KIOSK_LANGUAGES){
  const locale=createKioskLocale();
  locale.select(language.code);
  for(const key of keys){
   const translated=locale.t(key);
   assert.ok(translated.trim().length>4,language.code+' / '+key);
   assert.notEqual(translated,key);
  }
 }
});

test('server and offline errors are translated without leaking backend descriptions',async()=>{
 const kiosk=(await readFile(new URL('../web/live/kiosk.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
 const localeScript=(await readFile(new URL('../web/live/kiosk-locale.js',import.meta.url),'utf8')).replace(/^export /gm,'');
 const w=new Window({url:'https://punch.test/kiosk.html',settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true}});
 w.document.body.innerHTML='<main id="kiosk"></main>';
 const offlineMock='const createKioskOffline=()=>({list:async()=>[],prune:async()=>{},forget:async()=>{},remember:async()=>{},unlock:async()=>{throw Error("offline")},sync:async()=>[]});';
 w.eval(offlineMock+'\n'+localeScript+'\n'+kiosk.slice(0,kiosk.indexOf('(async()=>{try{state.device='))+'\nwindow.__api={request,offlineRequest,localizedError,locale};');
 for(const language of KIOSK_LANGUAGES){
  w.__api.locale.select(language.code);
  w.fetch=async()=>({json:async()=>({ok:false,error:'DEVICE_DENIED',internal:'private server stack trace'})});
  await assert.rejects(w.__api.request({action:'identify'}),err=>{
   assert.equal(err.message,w.__api.locale.t('errorDenied'));
   assert.doesNotMatch(err.message,/private server stack trace|DEVICE_DENIED/);
   return true;
  });
  w.fetch=async()=>({json:async()=>({ok:false,error:'CHAIN_CONFLICT',internal:'private audit data'})});
  await assert.rejects(w.__api.offlineRequest({action:'receive'}),err=>{
   assert.equal(err.message,w.__api.locale.t('errorOfflineConflict'));
   assert.doesNotMatch(err.message,/private audit data|CHAIN_CONFLICT/);
   return true;
  });
  assert.equal(w.__api.localizedError(new Error('Horloge incohérente')),w.__api.locale.t('errorClock'));
  assert.equal(w.__api.localizedError(new Error('internal SQL error: company secret')),w.__api.locale.t('errorOperation'));
 }
 await w.happyDOM.close();
});

test('ambiguous network result in English is not presented as a confirmed punch',()=>{
 const locale=createKioskLocale();locale.select('en');
 assert.match(locale.t('errorNetwork'),/unconfirmed/i);
 assert.match(locale.t('errorRetry'),/same action/i);
 assert.match(locale.t('errorOfflineConflict'),/Do not delete/i);
});
