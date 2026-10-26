import test from 'node:test';
import assert from 'node:assert/strict';
import {listVerifiedWorkspaces,chooseVerifiedWorkspace} from '../web/live/company-workspaces.js';
const user={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'test@company.invalid'};
function member(id,role,opts={}){
 return {user_id:user.id,company_id:id,role,status:'active',companies:{name:'Compagnie '+id.slice(0,2),product_edition:'essential',billing_status:'active'},...opts};
}
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
test('one user receives two independent company roles and tenants',()=>{
 const rows=[member(a,'employee'),member(b,'boss',{companies:{name:'Commerce B',product_edition:'construction',billing_status:'active'}})];
 const verified=listVerifiedWorkspaces(rows,user);
 assert.equal(verified.length,2);
 assert.equal(verified.find(x=>x.companyId===a).role,'employee');
 assert.equal(verified.find(x=>x.companyId===b).role,'boss');
 assert.equal(chooseVerifiedWorkspace(verified,a).companyId,a);
 assert.equal(chooseVerifiedWorkspace(verified,b).edition,'construction');
});
test('active status, identity, roles and tenant identifiers are mandatory',()=>{
 const items=[member(a,'employee'),member(b,'admin',{status:'revoked'}),
 member('not-a-uuid','boss'),member('33333333-3333-4333-8333-333333333333','super_admin'),
 member('44444444-4444-4444-8444-444444444444','boss',{user_id:'other'}),
 member('55555555-5555-4555-8555-555555555555','boss',{companies:null})];
 const verified=listVerifiedWorkspaces(items,user);
 assert.deepEqual(verified.map(x=>x.companyId),[a]);
});
test('stale company choice cannot select unrelated account, multiple options require explicit choice',()=>{
 const verified=listVerifiedWorkspaces([member(a,'employee'),member(b,'admin')],user);
 assert.equal(chooseVerifiedWorkspace(verified,'00000000-0000-4000-8000-000000000000'),null);
 assert.equal(chooseVerifiedWorkspace(verified,null),null);
 assert.equal(chooseVerifiedWorkspace([verified[0]],null).companyId,a);
});
test('server result cannot duplicate a tenant or elevate by a later injected row',()=>{
 const verified=listVerifiedWorkspaces([member(a,'employee'),member(a,'boss')],user);
 assert.equal(verified.length,1);assert.equal(verified[0].role,'employee');
});
test('empty or unauthenticated responses never recover roles from arbitrary metadata',()=>{
 assert.deepEqual(listVerifiedWorkspaces([member(a,'boss')],null),[]);
 assert.deepEqual(listVerifiedWorkspaces(null,user),[]);
});
