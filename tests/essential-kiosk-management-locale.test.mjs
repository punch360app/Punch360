import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createEssentialController} from '../web/live/essential.js';
import {createEssentialLocale,ESSENTIAL_LANGUAGES,LOCALE_STRINGS} from '../web/live/essential-locale.js';

const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const keys=['kiosksManageTitle','kiosksPairTablet','kiosksLocation','kiosksDeviceName','kiosksPairInstruction','kiosksPageLink','kiosksGenerateCode','kiosksPairCode','kiosksRevoked','kiosksPaired','kiosksWaiting','kiosksLastSeen','kiosksNever','kiosksOpen','kiosksCopy','kiosksIdle','kiosksSeconds','kiosksRevoke','kiosksNone','kiosksSafety'];

test('Boss/Admin device-management glossary is present in all ten existing Essentiel locales',()=>{
 assert.equal(ESSENTIAL_LANGUAGES.length,10);
 for(const {code} of ESSENTIAL_LANGUAGES)for(const key of keys){
  assert.ok(LOCALE_STRINGS[code][key]?.trim(),code+' / '+key);
 }
});

test('kiosk Boss page follows personal language without leaking codes into public URLs',async()=>{
 const w=new Window();
 const locale=createEssentialLocale();
 const ui=createEssentialController({sb:{rpc:async()=>({data:[]})},redraw(){},notify(){},escape,document:w.document,getLocale:()=>locale.code});
 ui.state.devices=[{id:'kiosk-1',name:'Réception <script>',paired_at:'2026-10-26T12:00:00Z',revoked_at:null,last_seen_at:'2026-10-26T12:30:00Z',idle_seconds:10}];
 ui.state.pairCode='TEST-SECRET-PAIRING-CODE';
 locale.select('en');
 w.document.body.innerHTML=ui.renderKiosks();
 assert.match(w.document.body.textContent,/Time clock kiosks/);
 assert.match(w.document.body.textContent,/Pair a tablet/);
 assert.match(w.document.body.textContent,/Copy link/);
 assert.match(w.document.body.textContent,/Last connection/);
 assert.equal(w.document.querySelector('script'),null);
 assert.equal(w.document.querySelectorAll('a').length,2);
 for(const link of w.document.querySelectorAll('a')){
  assert.equal(new URL(link.getAttribute('href'),'https://punch.test/').search.includes('TEST-SECRET-PAIRING-CODE'),false);
  assert.equal(new URL(link.getAttribute('href'),'https://punch.test/').hash.includes('TEST-SECRET-PAIRING-CODE'),false);
 }
 assert.ok(w.document.querySelector('[data-action="ess:revoke-device"]'));
 locale.select('ar');
 w.document.body.innerHTML=ui.renderKiosks();
 assert.match(w.document.body.textContent,/أجهزة تسجيل الوقت/);
 assert.match(w.document.body.textContent,/إلغاء الترخيص/);
 assert.ok(w.document.querySelector('bdi[dir="ltr"]'));
 assert.doesNotMatch(w.document.body.textContent,/Générer le code|Dernière connexion/);
 assert.equal(w.document.querySelector('script'),null);
 await w.happyDOM.close();
});

test('kiosk page retains existing actions in every language',()=>{
 const locale=createEssentialLocale();
 const ui=createEssentialController({sb:{},redraw(){},notify(){},escape,getLocale:()=>locale.code});
 ui.state.devices=[{id:'kiosk-1',name:'Tablet',paired_at:null,revoked_at:null}];
 for(const lang of ESSENTIAL_LANGUAGES){
  locale.select(lang.code);
  const html=ui.renderKiosks();
  for(const action of ['ess:pair-code','ess:copy-kiosk-link','ess:kiosk-idle','ess:revoke-device']){
   assert.ok(html.includes('data-action="'+action+'"'),lang.code+' / '+action);
  }
 }
});
