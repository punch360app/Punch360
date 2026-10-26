import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
const original=await readFile(new URL('../web/live/kiosk.js',import.meta.url),'utf8');
const kioskLocaleSource=(await readFile(new URL('../web/live/kiosk-locale.js',import.meta.url),'utf8')).replace(/^export /gm,'');
const src="const createKioskOffline=()=>({list:async()=>[],prune:async()=>{},forget:async()=>{},remember:async()=>{},unlock:async()=>{throw Error('No cached identity')},sync:async()=>[]});\n"+kioskLocaleSource+'\n'+original.replace(/^import .*;\n/gm,'');
const wait=()=>new Promise(r=>setTimeout(r,25));
test('kiosk hides PIN, retries one immutable event after ambiguous network failure and clears personal state',async()=>{
 const w=new Window({url:'https://punch.test/kiosk.html',settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true}});w.document.body.innerHTML='<main id="kiosk"></main>';const calls=[];let fail=true;
 w.fetch=async(_url,options)=>{const p=JSON.parse(options.body);calls.push(p);if(p.action==='in'&&fail){fail=false;throw Error('network timeout');}return {json:async()=>p.action==='identify'?{ok:true,name:'Alexandre',active:false,paused:false}:{ok:true,action:p.action}};};
 w.eval(src.slice(0,src.indexOf('(async()=>{try{state.device='))+`state.device={device_id:'device',token:'limited-device-token',company_name:'Atelier',name:'Réception'};draw();window.__kiosk={state,clearPerson};`);
 assert.equal(w.document.querySelector('#pin').type,'password');assert.equal(w.document.querySelectorAll('[data-action="out"]').length,0);
 w.document.querySelector('#number').value='AB-0248';w.document.querySelector('#pin').value='829471';w.document.querySelector('[data-key="OK"]').click();await wait();assert.match(w.document.body.textContent,/Bonjour, Alexandre/);assert.equal(w.document.querySelector('#pin'),null);
 w.document.querySelector('[data-action="in"]').click();await wait();assert.match(w.document.body.textContent,/Résultat non confirmé/);
 w.document.querySelector('[data-action="in"]').click();await wait();const events=calls.filter(x=>x.action==='in');assert.equal(events.length,2);assert.equal(events[0].eventId,events[1].eventId);assert.match(w.document.body.textContent,/Pointage enregistré et synchronisé/);assert.equal(w.__kiosk.state.pin,'');assert.equal(w.__kiosk.state.person,null);assert.equal(w.localStorage.length,0);assert.equal(w.sessionStorage.length,0);
 await w.happyDOM.close();
});
test('kiosk erases identity on hide and ignores a late identify response',async()=>{
 const w=new Window({url:'https://punch.test/kiosk.html',settings:{enableJavaScriptEvaluation:true,suppressInsecureJavaScriptEnvironmentWarning:true}});w.document.body.innerHTML='<main id="kiosk"></main>';let release;const pending=new Promise(r=>{release=r});w.fetch=async()=>{await pending;return {json:async()=>({ok:true,name:'Private person',active:true})};};
 w.eval(src.slice(0,src.indexOf('(async()=>{try{state.device='))+`state.device={device_id:'device',token:'limited',company_name:'Atelier',name:'Reception'};draw();window.__kiosk={state,clearPerson};`);
 w.document.querySelector('#number').value='AB-0248';w.document.querySelector('#pin').value='829471';w.document.querySelector('[data-key="OK"]').click();await wait();w.dispatchEvent(new w.Event('pagehide'));release();await wait();assert.equal(w.__kiosk.state.person,null);assert.equal(w.__kiosk.state.pin,'');assert.doesNotMatch(w.document.body.textContent,/Private person/);await w.happyDOM.close();
});
