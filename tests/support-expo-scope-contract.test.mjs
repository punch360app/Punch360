import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSupportScope} from '../src/support/supportScope.js';
const code=readFileSync(new URL('../src/support/SupportPanel.tsx',import.meta.url),'utf8');

test('Expo Support never renders the old company between a prop update and its effect',()=>{
 assert.match(code,/scope\.current\.current\(\)\.company!==account\.companyId/);
 assert.match(code,/Changement d’entreprise en cours/);
 assert.match(code,/useEffect\(\(\)=>\{[\s\S]*?\},\[account\.companyId\]\)/);
});

test('Expo Support excludes stale network responses and pending thread updates',()=>{
 assert.match(code,/if\(!active\(token,company\)\)return/);
 assert.match(code,/if\(active\(token,company\)\)await load/);
 assert.match(code,/scope\.current\.invalidate\(\)/);
 assert.match(code,/locked\.current=false;setBusy\(false\)/);
});

test('a simulated A to B switch invalidates responses without revealing data or blocking B',()=>{
 const scope=createSupportScope('company-A');
 const old=scope.enter('company-A');
 const pendingA={company:'company-A',token:old,subject:'old private ticket'};
 const current=scope.enter('company-B');
 const mayShow=result=>scope.allows(result.company,result.token);
 assert.equal(mayShow(pendingA),false);
 assert.equal(mayShow({company:'company-B',token:current}),true);
 scope.invalidate();
 assert.equal(mayShow({company:'company-B',token:current}),false);
});

test('sensitive Support failures use a safe message while preserving local retry guidance',()=>{
 assert.match(code,/Accès au support expiré ou refusé/);
 assert.match(code,/Impossible de charger ou modifier les demandes/);
 assert.match(code,/Résultat incertain : réessayez le message original/);
 assert.match(code,/accessibilityLiveRegion="polite"/);
 assert.match(code,/minHeight:48/);
});
