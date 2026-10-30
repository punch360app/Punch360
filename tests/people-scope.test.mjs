import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPeopleScope} from '../src/workforce/peopleScope.js';

test('company switch invalidates the previous employee directory response',()=>{
 const scope=createPeopleScope('A','alice','boss'),a=scope.enter('A','alice','boss');
 const b=scope.enter('B','alice','boss');
 assert.equal(scope.allows(a),false);assert.equal(scope.allows(b),true);
 assert.equal(scope.matches('A','alice','boss'),false);
});
test('user and role changes and unmount invalidate old employee or invitation responses',()=>{
 const scope=createPeopleScope('A','alice','boss'),a=scope.enter('A','alice','boss');
 const b=scope.enter('A','bob','boss');
 assert.equal(scope.allows(a),false);
 const c=scope.enter('A','bob','employee');
 assert.equal(scope.allows(b),false);
 scope.invalidate();assert.equal(scope.allows(c),false);
});
test('A to B to A does not revive an old request from first A',()=>{
 const scope=createPeopleScope('A','alice','boss'),old=scope.enter('A','alice','boss');
 scope.enter('B','alice','boss');
 const next=scope.enter('A','alice','boss');
 assert.equal(scope.allows(old),false);assert.equal(scope.allows(next),true);
});
test('late invitation callback does not open old account activation link',async()=>{
 const scope=createPeopleScope('A','alice','boss'),token=scope.enter('A','alice','boss');
 let deliver;const request=new Promise(resolve=>{deliver=resolve});let shareCount=0;
 const response=request.then(()=>{if(scope.allows(token))shareCount++});
 scope.enter('B','alice','boss');deliver('old invitation');
 await response;assert.equal(shareCount,0);
});
test('Expo employee screen includes identity, loading and double-submit guards',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../src/workforce/EssentialPeoplePanel.tsx',import.meta.url),'utf8');
 assert.match(source,/if\(!identityMatches\)return <View/);
 assert.match(source,/scope\.current\.enter\(account\.companyId,account\.userId,account\.role\)/);
 assert.match(source,/scope\.current\.invalidate\(\)/);
 assert.match(source,/if\(!current\(token\)\)return/);
 assert.match(source,/actionLock\.current/);
 assert.match(source,/setWorkers\(\[\]\)/);
 assert.match(source,/accessibilityRole="alert"/);
 assert.match(source,/Réessayer/);
 assert.match(source,/minHeight:48/);
});
