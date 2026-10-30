import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createNotificationScope} from '../src/workforce/notificationScope.js';

test('account, user, role, and unmount invalidate previous preference requests',()=>{
 const scope=createNotificationScope('A','alice','employee');
 const a=scope.enter('A','alice','employee');
 const b=scope.enter('B','alice','employee');
 assert.equal(scope.allows(a),false);assert.equal(scope.allows(b),true);
 assert.equal(scope.matches('A','alice','employee'),false);
 const c=scope.enter('B','bob','employee');assert.equal(scope.allows(b),false);
 const d=scope.enter('B','bob','lead');assert.equal(scope.allows(c),false);
 scope.invalidate();assert.equal(scope.allows(d),false);
});

test('A-B-A cannot revive a stale preferences response with identical identity',()=>{
 const scope=createNotificationScope('A','alice','admin');
 const old=scope.enter('A','alice','admin');
 scope.enter('B','alice','admin');
 const newest=scope.enter('A','alice','admin');
 assert.equal(scope.allows(old),false);assert.equal(scope.allows(newest),true);
});

test('late RPC reply after account change does not update displayed preferences',async()=>{
 const scope=createNotificationScope('A','alice','employee'),token=scope.enter('A','alice','employee');
 let deliver;const request=new Promise(resolve=>{deliver=resolve});
 const displayed=[];
 const settled=request.then(v=>{if(scope.allows(token))displayed.push(v)});
 scope.enter('B','alice','employee');deliver({push_enabled:true});
 await settled;
 assert.deepEqual(displayed,[]);
});

test('pref UI keeps token gating and loading/error controls',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../src/workforce/NotificationPreferencesPanel.tsx',import.meta.url),'utf8');
 assert.match(source,/if\(!identityMatches\)return <View/);
 assert.match(source,/setRows\(\[\]\);setDraft\(\{\}\)/);
 assert.match(source,/setLoading\(true\)/);
 assert.match(source,/scope\.current\.invalidate\(\)/);
 assert.match(source,/if\(!current\(token\)\|\|!loaded\|\|actionLock\.current\|\|!draft\[category\]\)return/);
 assert.match(source,/accessibilityRole="alert"/);
 assert.match(source,/Réessayer le chargement/);
 assert.match(source,/minHeight:48/);
});
