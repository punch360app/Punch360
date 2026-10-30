import test from 'node:test';
import assert from 'node:assert/strict';
import {createGeofenceScope,geofenceIdentity,canAdministerGeofence,geofenceJobAllowed,canReviewLocation,canReviewOfflineBreak,canReadNotification,geofenceRadiusPayload,geofenceReviewPayload} from '../src/workforce/geofenceScope.js';

const a={companyId:'A',userId:'alice',role:'admin',edition:'essential'};
const check={id:'c1',company_id:'A',user_id:'bob',review_status:'pending'};
const receipt={event_id:'e1',company_id:'A',user_id:'bob',action:'break_start',result:{review_status:'pending',sync_status:'synced'}};
test('account/role/edition switches and A-B-A invalidate all old tokens',()=>{
 const s=createGeofenceScope(a),one=s.enter(a);assert.equal(s.allows(one),true);
 const b=s.enter({...a,companyId:'B'});assert.equal(s.allows(one),false);
 const role=s.enter({...a,companyId:'B',role:'employee'});assert.equal(s.allows(b),false);
 s.enter({...a,companyId:'B',edition:'construction'});assert.equal(s.allows(role),false);
 s.enter(a);assert.equal(s.allows(one),false);const beforeInvalidate=s.current();s.invalidate();assert.equal(s.allows(beforeInvalidate),false);
 assert.notEqual(geofenceIdentity(a),geofenceIdentity({...a,userId:'charlie'}));
});
test('response from previous company cannot render or trigger UI',async()=>{
 const s=createGeofenceScope(a),old=s.enter(a);let release;const network=new Promise(resolve=>release=resolve);
 let rendered=0;const task=network.then(()=>{if(s.allows(old))rendered++});
 s.enter({...a,userId:'bob'});release({private:true});await task;assert.equal(rendered,0);
});
test('manager-only, current pending checks and breaks; no self-review',()=>{
 assert.equal(canAdministerGeofence(a),true);
 assert.equal(canAdministerGeofence({...a,role:'lead'}),false);
 assert.equal(canReviewLocation(check,a,[check]),true);
 assert.equal(canReviewLocation({...check,user_id:'alice'},a,[{...check,user_id:'alice'}]),false);
 assert.equal(canReviewLocation({...check,review_status:'accepted'},a,[check]),false);
 assert.equal(canReviewLocation({...check,company_id:'B'},a,[check]),false);
 assert.equal(canReviewLocation(check,{...a,role:'employee'},[check]),false);
 assert.equal(canReviewOfflineBreak(receipt,a,[receipt]),true);
 assert.equal(canReviewOfflineBreak({...receipt,user_id:'alice'},a,[{...receipt,user_id:'alice'}]),false);
 assert.equal(canReviewOfflineBreak({...receipt,result:{review_status:'pending',sync_status:'conflict'}},a,[receipt]),false);
 assert.equal(canReviewOfflineBreak(receipt,{...a,role:'lead'},[receipt]),false);
});
test('notification belongs to active receiver; job selection validated',()=>{
 const n={id:'n',company_id:'A',recipient_id:'alice'};
 assert.equal(canReadNotification(n,a,[n]),true);
 assert.equal(canReadNotification(n,{...a,userId:'bob'},[n]),false);
 assert.equal(canReadNotification({...n,company_id:'B'},a,[n]),false);
 assert.equal(geofenceJobAllowed('jobA',[{id:'jobA'}]),true);
 assert.equal(geofenceJobAllowed('jobB',[{id:'jobA'}]),false);
});
test('coordinate and radius bounds before mutation',()=>{
 assert.deepEqual(geofenceRadiusPayload('46.8','-71.2','200'),{latitude:46.8,longitude:-71.2,punch_radius_m:200});
 assert.throws(()=>geofenceRadiusPayload('91','0','200'),/invalides/);
 assert.throws(()=>geofenceRadiusPayload('44','-181','200'),/invalides/);
 assert.throws(()=>geofenceRadiusPayload('44','-71','5'),/invalides/);
 assert.throws(()=>geofenceRadiusPayload('','-71','200'),/nécessaires/);
 assert.throws(()=>geofenceRadiusPayload('NaN','-71','200'),/invalides/);
});
test('GPS correction dates need explicit offsets and reason; acceptance contains no correction',()=>{
 assert.deepEqual(geofenceReviewPayload('motif valide','','',false),{p_note:'motif valide',p_start:null,p_end:null});
 assert.equal(geofenceReviewPayload('motif','2026-11-01T01:30:00-04:00','2026-11-01T02:30:00-05:00',true).p_start,'2026-11-01T05:30:00.000Z');
 assert.throws(()=>geofenceReviewPayload('a','','',false),/Motif/);
 assert.throws(()=>geofenceReviewPayload('motif','','',true),/heure/);
 assert.throws(()=>geofenceReviewPayload('motif','2026-11-01T01:30:00','',true),/fuseau/);
 assert.throws(()=>geofenceReviewPayload('motif','2026-11-01T02:30:00-05:00','2026-11-01T01:30:00-04:00',true),/Sortie/);
});
test('Expo screen protects render, RPC, decisions and accessible control state',async()=>{
 const {readFileSync}=await import('node:fs');
 const src=readFileSync(new URL('../src/workforce/GeofencePanel.tsx',import.meta.url),'utf8');
 assert.match(src,/if\(!identityMatches\)return <View/);
 assert.match(src,/scope\.current\.enter\(account\)/);
 assert.match(src,/scope\.current\.invalidate\(\)/);
 assert.match(src,/actionLock\.current/);
 assert.match(src,/canReviewLocation\(check,account,checks\)/);
 assert.match(src,/canReviewOfflineBreak\(receipt,account,receipts\)/);
 assert.match(src,/canReadNotification\(notification,account,notifications\)/);
 assert.match(src,/geofenceRadiusPayload/);
 assert.match(src,/geofenceReviewPayload/);
 assert.match(src,/if\(!current\(token\)\)throw/);
 assert.match(src,/minHeight:48/);
 assert.match(src,/accessibilityRole="alert"/);
 assert.match(src,/Réessayer/);
});
