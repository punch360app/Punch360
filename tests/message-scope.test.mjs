import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMessagesScope} from '../src/messages/messageScope.js';

test('a late response from company A cannot update company B',()=>{
 const scope=createMessagesScope('A','user','boss');
 const old=scope.enter('A','user','boss');
 const next=scope.enter('B','user','boss');
 assert.equal(scope.allowsWorkspace(old),false);
 assert.equal(scope.allowsWorkspace(next),true);
 assert.equal(scope.matches('A','user','boss'),false);
});

test('user, role and session transitions invalidate previous responses',()=>{
 const scope=createMessagesScope('A','user-1','employee');
 const first=scope.enter('A','user-1','employee');
 scope.enter('A','user-2','employee');
 assert.equal(scope.allowsWorkspace(first),false);
 const second=scope.current();
 scope.enter('A','user-2','admin');
 assert.equal(scope.allowsWorkspace(second),false);
 const admin=scope.current();
 scope.invalidate();scope.enter('A','user-2','admin');
 assert.equal(scope.allowsWorkspace(admin),false);
});

test('switching thread A -> B -> A cannot revive an old A response',()=>{
 const scope=createMessagesScope('A','u','boss');
 scope.enter('A','u','boss');
 const a1=scope.selectThread('thread-A');
 const b=scope.selectThread('thread-B');
 assert.equal(scope.allowsThread(a1),false);
 assert.equal(scope.allowsThread(b),true);
 const a2=scope.selectThread('thread-A');
 assert.equal(scope.allowsThread(a1),false);
 assert.equal(scope.allowsThread(b),false);
 assert.equal(scope.allowsThread(a2),true);
 scope.selectThread('');
 assert.equal(scope.allowsThread(a2),false);
});

test('same thread ID in a different company remains isolated',()=>{
 const scope=createMessagesScope('A','u','boss');
 scope.enter('A','u','boss');
 const old=scope.selectThread('same-id');
 scope.enter('B','u','boss');scope.selectThread('same-id');
 assert.equal(scope.allowsThread(old),false);
});

test('a workspace token cannot authorize thread operations without a selection',()=>{
 const scope=createMessagesScope('A','u','lead');
 const token=scope.enter('A','u','lead');
 assert.equal(scope.allowsWorkspace(token),true);
 assert.equal(scope.allowsThread(token),false);
});
