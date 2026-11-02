import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNotificationPreferencesController} from '../web/live/notification-preferences.js';
const escape=s=>String(s??'');
function setup(){const calls=[];let finish;const sb={from(){const q={select(){return q},eq(){return Promise.resolve({data:[{category:'decisions',version:4,push_enabled:true,email_enabled:false}]})}};return q},rpc:async(name,args)=>{calls.push({name,args});return {data:5}}};return {calls,sb,ui:createNotificationPreferencesController({sb,redraw(){},escape})}}
test('notification preferences use own version and preserve independent channels',async()=>{const {ui,calls}=setup();await ui.load('company');ui.input({id:'notification-pref-decisions-email',checked:true});await ui.handle({dataset:{action:'notification-pref:save',category:'decisions'}});assert.deepEqual(calls.find(x=>x.name==='set_notification_preference').args,{p_company:'company',p_category:'decisions',p_push:true,p_email:true,p_expected_version:4});assert.equal(ui.state.rows[0].version,5);assert.match(ui.render(),/ne confirme pas une livraison/);});
test('preferences ignore response arriving after company change or logout',async()=>{const {ui,sb}=setup();let complete;sb.from=()=>({select(){return this},eq:()=>new Promise(resolve=>{complete=resolve})});const pending=ui.load('old');ui.reset();complete({data:[{category:'decisions',push_enabled:true}]});await pending;assert.deepEqual(ui.state.rows,[]);assert.equal(ui.state.company,null)});


test('unchanged categories disable save and avoid redundant server writes',async()=>{
 const {ui,calls}=setup();await ui.load('company');
 assert.match(ui.render(),/Annuler les modifications/);
 assert.match(ui.render(),/data-action="notification-pref:save" data-category="decisions" disabled/);
 await ui.handle({dataset:{action:'notification-pref:save',category:'decisions'}});
 assert.equal(calls.filter(c=>c.name==='set_notification_preference').length,0);
});
test('editing a choice enables review, discard returns to saved state without RPC',async()=>{
 const {ui,calls}=setup();await ui.load('company');
 ui.input({id:'notification-pref-decisions-email',checked:true});
 assert.match(ui.render(),/Modifications non enregistrées/);
 assert.match(ui.render(),/data-action="notification-pref:save" data-category="decisions" >/);
 await ui.handle({dataset:{action:'notification-pref:discard',category:'decisions'}});
 assert.equal(ui.state.draft.decisions,undefined);
 assert.equal(ui.state.rows.find(r=>r.category==='decisions').email_enabled,false);
 assert.match(ui.state.status,/annulées/);
 assert.equal(calls.filter(c=>c.name==='set_notification_preference').length,0);
});
test('successful save shows accessible confirmation without claiming push delivery',async()=>{
 const {ui,calls}=setup();await ui.load('company');
 ui.input({id:'notification-pref-decisions-email',checked:true});
 await ui.handle({dataset:{action:'notification-pref:save',category:'decisions'}});
 assert.equal(calls.filter(c=>c.name==='set_notification_preference').length,1);
 assert.equal(ui.state.draft.decisions,undefined);
 assert.match(ui.render(),/Préférences enregistrées/);
 assert.match(ui.render(),/livraison des notifications n’est pas confirmée/);
 assert.match(ui.render(),/data-notification-save-status/);
});
test('a failure keeps unsaved changes, shows no SQL error and allows a safe retry',async()=>{
 const {ui,sb,calls}=setup();await ui.load('company');
 let fail=true;const prior=sb.rpc;
 sb.rpc=async(name,args)=>name==='set_notification_preference'&&fail?
  {error:{message:'private SQL account details'}}:prior(name,args);
 ui.input({id:'notification-pref-decisions-email',checked:true});
 await ui.handle({dataset:{action:'notification-pref:save',category:'decisions'}});
 assert.match(ui.render(),/Impossible d’enregistrer ces préférences/);
 assert.doesNotMatch(ui.render(),/private SQL/);
 assert.equal(ui.state.draft.decisions.email_enabled,true);
 fail=false;await ui.handle({dataset:{action:'notification-pref:save',category:'decisions'}});
 assert.equal(ui.state.rows[0].email_enabled,true);
 assert.equal(ui.state.draft.decisions,undefined);
});
test('old account save response cannot update newly loaded notification preferences',async()=>{
 const {ui,sb}=setup();await ui.load('old');
 let resolveSave;const pending=new Promise(resolve=>{resolveSave=resolve});
 const initialRpc=sb.rpc;
 sb.rpc=async(name,args)=>name==='set_notification_preference'?pending:initialRpc(name,args);
 ui.input({id:'notification-pref-decisions-email',checked:true});
 const saving=ui.handle({dataset:{action:'notification-pref:save',category:'decisions'}});
 await ui.load('new');
 resolveSave({data:7});
 await saving;
 assert.equal(ui.state.company,'new');
 assert.equal(ui.state.status,'');
 assert.equal(ui.state.rows[0].email_enabled,false);
 assert.equal(ui.state.draft.decisions,undefined);
});
