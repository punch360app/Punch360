import test from 'node:test';
import assert from 'node:assert/strict';
import {createEssentialLocale,ESSENTIAL_LANGUAGES,LOCALE_STRINGS} from '../web/live/essential-locale.js';
import {createOfflineReviewController} from '../web/live/kiosk-offline-review.js';

const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reviewKeys=['reviewTitle','reviewHelp','reviewReason','reviewRefresh','reviewApprove','reviewReject','reviewEmpty','reviewLimit','reviewReasonRequired','reviewLoadFailed','reviewSaveFailed','reviewEntryIn','reviewEntryOut','reviewBreakUnpaid','reviewBreakPaid','reviewBreakEnd','reviewPending','reviewApproved','reviewRejected','reviewConflict'];

test('offline review uses all ten native Essentiel languages without a second preference store',()=>{
 assert.equal(ESSENTIAL_LANGUAGES.length,10);
 for(const {code} of ESSENTIAL_LANGUAGES)for(const key of reviewKeys){
  assert.ok(LOCALE_STRINGS[code][key]?.trim() && LOCALE_STRINGS[code][key]!==key,code+' / '+key);
 }
});

test('Boss kiosk offline review changes language and keeps decisions under server RPC',async()=>{
 const locale=createEssentialLocale();const calls=[];let redraws=0;
 const data=[{id:'grant-1',worker:'Pat <script>',device:'Entry station',closed_at:null,events:[{at:'2026-10-26T12:30:00Z',action:'in',state:'pending',note:'Note <img>'},{at:'2026-10-26T13:00:00Z',action:'break_start_paid',state:'conflict'}]}];
 const sb={rpc:async(name,params)=>{calls.push({name,params});return name==='list_kiosk_offline'?{data,error:null}:{data:{ok:true},error:null}}};
 const controller=createOfflineReviewController({sb,redraw:()=>redraws++,escape,getLocale:()=>locale.code});
 await controller.load('company-A');
 locale.select('en');
 const en=controller.render();
 assert.match(en,/Review offline time entries/);
 assert.match(en,/Clock in/);
 assert.match(en,/Paid break/);
 assert.match(en,/Pending/);
 assert.match(en,/<bdi dir="ltr">/);
 assert.doesNotMatch(en,/<script>|<img>/);
 assert.match(en,/Pat &lt;script&gt;/);
 locale.select('ar');
 const ar=controller.render();
 assert.match(ar,/مراجعة سجلات الوقت/);
 assert.match(ar,/استراحة مدفوعة/);
 assert.match(ar,/بدي|<bdi dir="ltr">/);
 assert.doesNotMatch(ar,/Review offline time entries/);
 controller.input({id:'offreview-note',value:'no'});
 await controller.handle({dataset:{action:'offreview:approve',id:'grant-1'}});
 assert.equal(controller.state.error,'reviewReasonRequired');
 assert.equal(calls.filter(c=>c.name==='review_kiosk_offline').length,0);
 controller.input({id:'offreview-note',value:'Verified against published shifts'});
 await controller.handle({dataset:{action:'offreview:approve',id:'grant-1'}});
 const decisions=calls.filter(c=>c.name==='review_kiosk_offline');
 assert.equal(decisions.length,1);
 assert.deepEqual(decisions[0].params,{p_grant:'grant-1',p_approve:true,p_note:'Verified against published shifts'});
 assert.equal(controller.state.error,'');
 assert.ok(redraws>=2);
});

test('review errors never leak sensitive server diagnostics or mutate without an explicit reason',async()=>{
 let attempts=0;
 const sb={rpc:async(name)=>{attempts++;return {data:null,error:{message:'internal SQL error: private tenant key'}}}};
 const controller=createOfflineReviewController({sb,redraw:()=>{},escape});
 await controller.load('company-A');
 assert.equal(controller.state.error,'reviewLoadFailed');
 assert.match(controller.render(),/Impossible de charger les observations/);
 assert.doesNotMatch(controller.render(),/private tenant key/);
 controller.input({id:'offreview-note',value:'verified reason'});
 await controller.handle({dataset:{action:'offreview:reject',id:'grant-2'}});
 assert.equal(controller.state.error,'reviewSaveFailed');
 assert.doesNotMatch(controller.render(),/internal SQL error|private tenant key/);
 assert.equal(attempts,2);
});
