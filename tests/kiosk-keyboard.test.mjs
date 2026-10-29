import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {kioskEnterTarget} from '../web/live/kiosk-keyboard.js';

const fixture=()=>{
  const w=new Window();
  w.document.body.innerHTML='<main id="kiosk">'+
    '<input id="pairCode"><button data-action="pair">Pair</button>'+
    '<input id="number"><input id="pin" type="password">'+
    '<input id="enrollment"><input id="pinConfirm" type="password">'+
    '<button data-key="OK">OK</button>'+
    '<select id="kiosk-language"><option>Français</option></select>'+
    '<button data-action="in">Punch</button></main>';
  return {w,root:w.document.getElementById('kiosk')};
};
const enter=(target,props={})=>({key:'Enter',target,...props});

test('Enter in the unpaired code field targets pairing instead of nonexistent OK',async()=>{
  const {w,root}=fixture();
  assert.equal(kioskEnterTarget(root,enter(root.querySelector('#pairCode'))),
    root.querySelector('[data-action="pair"]'));
  assert.equal(kioskEnterTarget(root,enter(root.querySelector('#number'))),null);
  await w.happyDOM.close();
});

test('Enter in paired identity fields targets OK, but never a punch action',async()=>{
  const {w,root}=fixture();
  for(const id of ['number','pin','enrollment','pinConfirm']){
    assert.equal(kioskEnterTarget(root,enter(root.querySelector('#'+id)),{paired:true}),
      root.querySelector('[data-key="OK"]'));
  }
  assert.equal(kioskEnterTarget(root,enter(root.querySelector('#pin')),{paired:true,identified:true}),null);
  assert.equal(kioskEnterTarget(root,enter(root.querySelector('[data-action="in"]')),{paired:true,identified:true}),null);
  await w.happyDOM.close();
});

test('language selector, buttons, external fields and composition retain native Enter',async()=>{
  const {w,root}=fixture();
  const pair=root.querySelector('#pairCode');
  assert.equal(kioskEnterTarget(root,enter(root.querySelector('#kiosk-language'))),null);
  assert.equal(kioskEnterTarget(root,enter(root.querySelector('[data-action="pair"]'))),null);
  assert.equal(kioskEnterTarget(root,enter(pair,{isComposing:true})),null);
  assert.equal(kioskEnterTarget(root,enter(pair,{repeat:true})),null);
  assert.equal(kioskEnterTarget(root,enter(pair,{key:' '})),null);
  assert.equal(kioskEnterTarget(root,enter(pair),{busy:true}),null);
  const foreign=w.document.createElement('input');
  w.document.body.appendChild(foreign);foreign.id='pairCode';
  assert.equal(kioskEnterTarget(root,enter(foreign)),null);
  pair.disabled=true;
  assert.equal(kioskEnterTarget(root,enter(pair)),null);
  pair.disabled=false;
  root.querySelector('[data-action="pair"]').disabled=true;
  assert.equal(kioskEnterTarget(root,enter(pair)),null);
  await w.happyDOM.close();
});
