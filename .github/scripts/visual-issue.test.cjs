const test=require('node:test');
const assert=require('node:assert/strict');
const {buildIssue}=require('./visual-issue.cjs');
const base={
  generatedAt:'2026-10-27T00:00:00Z',
  screenshots:24,approvedBaselines:0,failures:0,
  results:[{image:'punch-S25-logged-out.png',status:'awaiting-approved-baseline'}],
  feedback:{state:'awaiting-approved-reference',issues:[
    {priority:'P2',device:'24 ecrans',code:'reference-pending',
      finding:'References Figma a approuver',nextStep:'Revoir les captures publiques'}
  ]}
};
test('no Figma approval does not become a passed comparison',()=>{
  const issue=buildIssue(base,{repo:'punch360app/Punch360',runId:'12345'});
  assert.match(issue.body,/AUCUNE CONFORMITE FIGMA/);
  assert.match(issue.body,/awaiting-approved-reference/);
  assert.match(issue.body,/actions\/runs\/12345/);
  assert.match(issue.body,/Work ne demarre PAS automatiquement/);
});
test('same findings do not trigger a new issue update on every scheduled run',()=>{
  const a=buildIssue(base,{repo:'punch360app/Punch360',runId:'12345'});
  const b=buildIssue({...base,generatedAt:'2026-10-28T00:00:00Z'},
    {repo:'punch360app/Punch360',runId:'98765'});
  assert.equal(a.fingerprint,b.fingerprint);
});
test('new failures change the fingerprint',()=>{
  const a=buildIssue(base,{repo:'punch360app/Punch360',runId:'12345'});
  const b=buildIssue({...base,failures:1},{repo:'punch360app/Punch360',runId:'12345'});
  assert.notEqual(a.fingerprint,b.fingerprint);
});
test('reject malformed report and unsafe repository links',()=>{
  assert.throws(()=>buildIssue({}, {repo:'punch360app/Punch360',runId:'42'}));
  assert.throws(()=>buildIssue(base,{repo:'punch360app/Punch360]malformed',runId:'42'}));
  assert.throws(()=>buildIssue(base,{repo:'punch360app/Punch360',runId:'x'}));
});
