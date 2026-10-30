import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPushDevicesScope} from '../src/workforce/pushDevicesScope.js';

test('switching company, user or role invalidates device queries and RPC replies',()=>{
 const s=createPushDevicesScope('companyA','alice','employee');
 const a=s.enter('companyA','alice','employee');
 const b=s.enter('companyB','alice','employee');
 assert.equal(s.allows(a),false);assert.equal(s.allows(b),true);
 assert.equal(s.matches('companyA','alice','employee'),false);
 const u=s.enter('companyB','bob','employee');
 assert.equal(s.allows(b),false);
 const role=s.enter('companyB','bob','admin');
 assert.equal(s.allows(u),false);
 s.invalidate();assert.equal(s.allows(role),false);
});

test('A B A transition cannot revive response of first A',()=>{
 const s=createPushDevicesScope('A','u','lead'),a=s.enter('A','u','lead');
 s.enter('B','u','lead');
 const next=s.enter('A','u','lead');
 assert.equal(s.allows(a),false);assert.equal(s.allows(next),true);
});

test('late push token after logout cannot be submitted to server',async()=>{
 const s=createPushDevicesScope('A','alice','employee');
 const token=s.enter('A','alice','employee');
 let finish;const platformResponse=new Promise(resolve=>{finish=resolve});
 let attempted=0;
 const request=platformResponse.then(()=>{if(s.allows(token))attempted++});
 s.invalidate();finish('ExpoPushToken[not-real]');
 await request;
 assert.equal(attempted,0);
});

test('device screen guards identity and every asynchronous permission stage',async()=>{
 const {readFileSync}=await import('node:fs');
 const src=readFileSync(new URL('../src/workforce/PushDevicesPanel.tsx',import.meta.url),'utf8');
 assert.match(src,/if\(!identityMatches\)return <View/);
 assert.match(src,/scope\.current\.enter\(account\.companyId,account\.userId,account\.role\)/);
 assert.match(src,/scope\.current\.invalidate\(\)/);
 assert.match(src,/if\(!current\(token\)\)return;/);
 assert.match(src,/Notifications\.requestPermissionsAsync/);
 assert.match(src,/Notifications\.getExpoPushTokenAsync/);
 assert.match(src,/actionLock\.current/);
 assert.match(src,/accessibilityRole="alert"/);
 assert.match(src,/Réessayer le chargement/);
 assert.match(src,/minHeight:48/);
});
