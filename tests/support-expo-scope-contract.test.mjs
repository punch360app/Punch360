import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSupportScope,createSupportAccountScope} from '../src/support/supportScope.js';
const code=readFileSync(new URL('../src/support/SupportPanel.tsx',import.meta.url),'utf8');

test('Expo Support never renders former user or company between prop update and effect',()=>{
 assert.match(code,/const identityMatches=scope\.current\.matches\(account\)/);
 assert.match(code,/if\(!identityMatches\)return <View/);
 assert.match(code,/Changement de compte en cours/);
 assert.match(code,/scope\.current\.enter\(account\)/);
 assert.match(code,/\},\[account\.companyId,account\.userId,account\.role,account\.edition\]\)/);
});

test('Expo Support rejects stale network responses and pending ticket updates',()=>{
 assert.match(code,/const current=\(token:Token\)=>alive\.current&&scope\.current\.allows\(token\)/);
 assert.match(code,/if\(!current\(token\)\)return/);
 assert.match(code,/if\(current\(token\)\)await load/);
 assert.match(code,/scope\.current\.invalidate\(\)/);
 assert.match(code,/actionLock\.current=false;setBusy\(false\)/);
 assert.match(code,/safeSupportTicketPage\(/);
 assert.match(code,/safeSupportTicketDetail\(/);
});

test('a simulated A to B switch invalidates legacy and identity-aware responses',()=>{
 const legacy=createSupportScope('company-A');
 const old=legacy.enter('company-A');
 const current=legacy.enter('company-B');
 assert.equal(legacy.allows('company-A',old),false);
 assert.equal(legacy.allows('company-B',current),true);
 legacy.invalidate();
 assert.equal(legacy.allows('company-B',current),false);

 const alice={companyId:'company-A',userId:'alice',role:'employee',edition:'essential'};
 const scope=createSupportAccountScope(alice);
 const first=scope.enter(alice);
 const anotherUser=scope.enter({...alice,userId:'bob'});
 assert.equal(scope.allows(first),false);
 assert.equal(scope.allows(anotherUser),true);
 const changedRole=scope.enter({...alice,userId:'bob',role:'admin'});
 assert.equal(scope.allows(anotherUser),false);
 scope.enter(alice);
 assert.equal(scope.allows(first),false);
});

test('sensitive Support failures use safe messaging while preserving retry guidance',()=>{
 assert.match(code,/Accès au support expiré ou refusé/);
 assert.match(code,/Impossible de charger ou modifier les demandes/);
 assert.match(code,/Résultat incertain : réessayez le message original/);
 assert.match(code,/accessibilityLiveRegion="polite"/);
 assert.match(code,/minHeight:48/);
});
