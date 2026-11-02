import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const construction=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const essential=readFileSync(new URL('../src/workforce/EssentialWorkspace.tsx',import.meta.url),'utf8');
function sourceSlice(content,from,to){
 const a=content.indexOf(from),b=content.indexOf(to,a);
 assert.ok(a>=0&&b>a,'Missing source boundaries: '+from);
 return content.slice(a,b);
}
const constructionSync=sourceSlice(construction,'async function syncConstructionPunches(){',' useEffect(()=>{refresh();');
const essentialSync=sourceSlice(essential,' async function syncLocalPunches(){',' useEffect(',);
function actualGate(src,variable){
 const match=src.match(new RegExp('if\\(('+variable+'\\.isConnected[^\\n]*?'+variable+'\\.isInternetReachable[^\\n]*?)\\)\\{'));
 assert.ok(match,'Missing real connectivity gate for '+variable);
 const guard=match[1];
 const test=new Function(variable,'return '+guard+';');
 return {test,guard};
}
const constructionGate=actualGate(constructionSync,'net');
const essentialGate=actualGate(essentialSync,'network');

test('Construction PUNCH sync requires both connectivity signals positively verified',()=>{
 for(const network of [{isConnected:false,isInternetReachable:false},
  {isConnected:true,isInternetReachable:null},
  {isConnected:true,isInternetReachable:undefined},
  {isConnected:undefined,isInternetReachable:true},
  {isConnected:true,isInternetReachable:false}]){
  assert.equal(constructionGate.test(network),true,JSON.stringify(network));
 }
 assert.equal(constructionGate.test({isConnected:true,isInternetReachable:true}),false);
 assert.ok(constructionSync.indexOf('if(net.isConnected')<
  constructionSync.indexOf('await loadPunchState(account.companyId)'),
 'Network preflight must happen before a journal flush or server reload');
});

test('Essential PUNCH manual sync uses the same verified Internet preflight',()=>{
 for(const network of [{isConnected:false,isInternetReachable:false},
  {isConnected:true,isInternetReachable:null},
  {isConnected:null,isInternetReachable:true},
  {isConnected:true,isInternetReachable:undefined}]){
  assert.equal(essentialGate.test(network),true,JSON.stringify(network));
 }
 assert.equal(essentialGate.test({isConnected:true,isInternetReachable:true}),false);
 assert.ok(essentialSync.indexOf('if(network.isConnected')<
  essentialSync.indexOf('await loadPunchState(account.companyId)'));
});

test('Construction refresh treats unknown Internet as offline before other live reads',()=>{
 const section=sourceSlice(construction,' async function refresh(){',' async function syncConstructionPunches(){');
 const match=section.match(/offline=(net\.isConnected[^;]+);/);
 assert.ok(match,'Construction refresh must have an explicit offline decision');
 const isOffline=new Function('net','return '+match[1]+';');
 assert.equal(isOffline({isConnected:true,isInternetReachable:null}),true);
 assert.equal(isOffline({isConnected:true,isInternetReachable:undefined}),true);
 assert.equal(isOffline({isConnected:true,isInternetReachable:true}),false);
 assert.ok(section.indexOf('offline=net.isConnected')<
  section.indexOf('supabase.from(\'material_orders\')'));
});

test('mobile reconnection listeners trigger passive refresh only on confirmed Internet',()=>{
 assert.match(construction,/state\.isConnected===true&&state\.isInternetReachable===true\)refresh\(\)/);
 assert.match(essential,/s\.isConnected===true&&s\.isInternetReachable===true\)load\(\)/);
 assert.doesNotMatch(construction,/state\.isInternetReachable!==false\)refresh\(\)/);
 assert.doesNotMatch(essential,/s\.isInternetReachable!==false\)load\(\)/);
});

test('native TSX sources still parse after connectivity hardening',()=>{
 for(const [name,source] of [['App.tsx',construction],['EssentialWorkspace.tsx',essential]]){
  const ast=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  assert.equal(ast.parseDiagnostics.length,0,name+' parse errors');
 }
});
