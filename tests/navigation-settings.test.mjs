import {test} from 'node:test';
import assert from 'node:assert/strict';
import {navigationPreferenceKey,chooseNavigationPreference,writeNavigationPreference,navigationProviders} from '../web/live/navigation-choices.js';
function localStorageFixture(){
 const values=new Map(),calls=[];
 return {values,calls,
  getItem(key){calls.push(['get',key]);return values.get(key)??null},
  setItem(key,value){calls.push(['set',key,value]);values.set(key,value)},
  removeItem(key){calls.push(['remove',key]);values.delete(key)}
 };
}
test('navigation settings save provider with no assigned shift, punch or destination',async()=>{
 const db=localStorageFixture();
 assert.equal(await writeNavigationPreference(db,'worker-1','company-a','waze','android'),'waze');
 assert.equal(db.getItem(navigationPreferenceKey('worker-1','company-a')),'waze');
 assert.equal(chooseNavigationPreference(db.getItem(navigationPreferenceKey('worker-1','company-a')),'android'),'waze');
 assert.equal(db.calls.some(([method])=>method==='get'),true);
 assert.deepEqual(db.calls.find(([method])=>method==='set'),['set','punch-navigation:worker-1:company-a','waze']);
 assert.equal(db.calls.some(x=>JSON.stringify(x).includes('address')),false);
});
test('preferences cannot bleed across people, companies or incompatible devices',async()=>{
 const db=localStorageFixture();
 await writeNavigationPreference(db,'nadine','cleaning','google','android');
 await writeNavigationPreference(db,'nadine','retail','waze','android');
 await writeNavigationPreference(db,'mathieu','cleaning','waze','android');
 assert.equal(db.getItem(navigationPreferenceKey('nadine','cleaning')),'google');
 assert.equal(db.getItem(navigationPreferenceKey('nadine','retail')),'waze');
 assert.equal(db.getItem(navigationPreferenceKey('mathieu','cleaning')),'waze');
 await assert.rejects(()=>writeNavigationPreference(db,'nadine','cleaning','apple','android'),/incompatible/);
 assert.equal(db.getItem(navigationPreferenceKey('nadine','cleaning')),'google');
 assert.ok(navigationProviders('ios').some(p=>p.id==='apple'));
 assert.ok(!navigationProviders('android').some(p=>p.id==='apple'));
});
test('clearing a preference restores ask-each-time mode without affecting another company',async()=>{
 const db=localStorageFixture();
 await writeNavigationPreference(db,'u','a','google','web');
 await writeNavigationPreference(db,'u','b','waze','web');
 assert.equal(await writeNavigationPreference(db,'u','a',null,'web'),null);
 assert.equal(db.getItem(navigationPreferenceKey('u','a')),null);
 assert.equal(db.getItem(navigationPreferenceKey('u','b')),'waze');
 assert.equal(chooseNavigationPreference(db.getItem(navigationPreferenceKey('u','a')),'web'),null);
});
test('asynchronous storage failure does not report a successful change',async()=>{
 const asyncStore={setItem:async()=>{throw Error('no-storage')},removeItem:async()=>{throw Error('no-storage')}};
 await assert.rejects(()=>writeNavigationPreference(asyncStore,'u','c','google','ios'),/no-storage/);
 await assert.rejects(()=>writeNavigationPreference(asyncStore,'u','c',null,'ios'),/no-storage/);
 await assert.rejects(()=>writeNavigationPreference(localStorageFixture(),'', 'c','google','web'),/Compte et compagnie/);
});
