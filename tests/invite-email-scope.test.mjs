import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createInviteEmailScope,parseInvitationHours} from '../src/workforce/inviteEmailScope.js';

test('company, user, role and unmount invalidate old invite settings and status',()=>{
 const s=createInviteEmailScope('A','alice','boss');
 const a=s.enter('A','alice','boss');
 const b=s.enter('B','alice','boss');
 assert.equal(s.allows(a),false);assert.equal(s.allows(b),true);
 const c=s.enter('B','bob','boss');assert.equal(s.allows(b),false);
 const d=s.enter('B','bob','admin');assert.equal(s.allows(c),false);
 s.invalidate();assert.equal(s.allows(d),false);
});
test('A to B to A invalidates previous A async callbacks',()=>{
 const s=createInviteEmailScope('A','a','boss'),old=s.enter('A','a','boss');
 s.enter('B','a','boss');
 const newer=s.enter('A','a','boss');
 assert.equal(s.allows(old),false);assert.equal(s.allows(newer),true);
});
test('email expiration is a strict integer from 1 to 720 hours',()=>{
 assert.equal(parseInvitationHours('1'),1);
 assert.equal(parseInvitationHours('720'),720);
 for(const invalid of ['','0','721','1.5','1e2','-1',' 20','20 ','abc','999999999999999'])assert.equal(parseInvitationHours(invalid),null);
});
test('late email status response must not show former worker history',async()=>{
 const s=createInviteEmailScope('A','a','boss'),token=s.enter('A','a','boss');
 let release;const pending=new Promise(resolve=>{release=resolve}),values=[];
 const work=pending.then(v=>{if(s.allows(token))values.push(v)});
 s.enter('B','a','boss');release([{email_status:'delivered'}]);await work;
 assert.deepEqual(values,[]);
});
test('panel guards identity, authorized worker selection, and versioned save',async()=>{
 const {readFileSync}=await import('node:fs');
 const src=readFileSync(new URL('../src/workforce/InvitationEmailPanel.tsx',import.meta.url),'utf8');
 assert.match(src,/if\(!identityMatches\)return <View/);
 assert.match(src,/scope\.current\.enter\(account\.companyId,account\.userId,account\.role\)/);
 assert.match(src,/scope\.current\.invalidate\(\)/);
 assert.match(src,/actionLock\.current/);
 assert.match(src,/p_expected_version:settings\.version/);
 assert.match(src,/parseInvitationHours\(hours\)/);
 assert.match(src,/workers\.some\(w=>w\.id===id&&w\.email\)/);
 assert.match(src,/accessibilityRole="alert"/);
 assert.match(src,/Réessayer/);
 assert.match(src,/minHeight:48/);
});
