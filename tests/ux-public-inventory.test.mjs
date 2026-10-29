import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {buildPublicInventory}=require('../.github/scripts/ux-public-inventory.cjs');

const screen=(controls)=>({
  device:'S25',edition:'essential',screen:'login',
  viewport:{width:412,height:915},layout:{overflowPx:0},
  tapTargets:{total:controls.length,smallCount:0},controls
});

test('inventory includes every control, even controls below the fold',()=>{
  const result=buildPublicInventory([screen([
    {index:0,element:'button',id:'go',name:'Se connecter',inViewport:true,tabIndex:0},
    {index:1,element:'button',id:'end',name:'Aide',inViewport:false,tabIndex:0}
  ])]);
  assert.equal(result.screens,1);
  assert.equal(result.controls,2);
  assert.equal(result.results[0].visibleControls,1);
  assert.equal(result.findings.length,0);
  assert.match(result.scope,/Public logged-out/);
});

test('reports missing name, duplicate id and unreachable role-button instead of hiding defects',()=>{
  const result=buildPublicInventory([screen([
    {index:0,element:'button',id:'repeat',name:'',inViewport:true,tabIndex:0},
    {index:1,element:'role-button',id:'repeat',name:'Options',inViewport:true,tabIndex:-1}
  ])]);
  assert.deepEqual(result.findings.map(f=>f.code),[
    'missing-accessible-name','duplicate-id','role-button-not-keyboard-reachable'
  ]);
});

test('fails closed when a screen is absent from the audit data',()=>{
  assert.throws(()=>buildPublicInventory([{}]),/missing its control inventory/);
});
