import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSupportScope} from '../src/support/supportScope.js';

test('responses from another company are always rejected after switching scope',()=>{
 const scope=createSupportScope('company-A'),a=scope.enter('company-A');
 assert.equal(scope.allows('company-A',a),true);
 const b=scope.enter('company-B');
 assert.equal(scope.allows('company-A',a),false);
 assert.equal(scope.allows('company-B',a),false);
 assert.equal(scope.allows('company-B',b),true);
 assert.equal(scope.current().company,'company-B');
});

test('logout and reentry into the same company cannot revive a stale response',()=>{
 const scope=createSupportScope('same-company');
 const first=scope.enter('same-company');
 scope.invalidate();
 const later=scope.enter('same-company');
 assert.equal(scope.allows('same-company',first),false);
 assert.equal(scope.allows('same-company',later),true);
 assert.ok(later>first);
});

test('a different company ID never passes even when epoch matches',()=>{
 const scope=createSupportScope('A');
 const token=scope.enter('A');
 assert.equal(scope.allows('B',token),false);
 assert.equal(scope.allows('',token),false);
});
