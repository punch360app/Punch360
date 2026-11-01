import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFileSync} from 'node:fs';
import {togglePublicPasswordVisibility} from '../web/live/password-visibility.js';
const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');

test('Each password toggle keeps the field, value and accessible state',async()=>{
 const window=new Window({url:'https://fixture.invalid'});
 try{
  window.document.body.innerHTML=['password','signupPasswordConfirm','newPassword','confirmPassword'].map((id,i)=>
   '<label for="'+id+'">Mot de passe '+i+'</label><input id="'+id+'" type="password"><button type="button" data-action="togglePassword" data-id="'+id+'" aria-controls="'+id+'" aria-pressed="false">Afficher</button>'
  ).join('');
  for(const id of ['password','signupPasswordConfirm','newPassword','confirmPassword']){
   const input=window.document.getElementById(id);
   const button=window.document.querySelector('[data-id="'+id+'"]');
   input.value='fixture-secret-'+id;
   assert.equal(togglePublicPasswordVisibility(window.document,id,button),true);
   assert.equal(input.type,'text');
   assert.equal(input.value,'fixture-secret-'+id);
   assert.equal(input,window.document.getElementById(id));
   assert.equal(button.getAttribute('aria-pressed'),'true');
   assert.match(button.getAttribute('aria-label'),/^Masquer /);
   assert.equal(togglePublicPasswordVisibility(window.document,id,button),true);
   assert.equal(input.type,'password');
   assert.equal(input.value,'fixture-secret-'+id);
   assert.equal(button.getAttribute('aria-pressed'),'false');
   assert.match(button.getAttribute('aria-label'),/^Afficher /);
  }
 }finally{await window.happyDOM.close()}
});

test('Forged visibility events cannot target non-password fields',async()=>{
 const window=new Window({url:'https://fixture.invalid'});
 try{
  window.document.body.innerHTML='<input id="employeeEmail" type="text"><button type="button" data-action="togglePassword" data-id="employeeEmail" aria-controls="employeeEmail">Afficher</button>'+
   '<input id="password" type="password"><button type="button" data-action="togglePassword" data-id="password" aria-controls="wrong">Afficher</button>';
  assert.equal(togglePublicPasswordVisibility(window.document,'employeeEmail',window.document.querySelector('[data-id="employeeEmail"]')),false);
  assert.equal(togglePublicPasswordVisibility(window.document,'password',window.document.querySelector('[data-id="password"]')),false);
  assert.equal(window.document.getElementById('password').type,'password');
  assert.equal(togglePublicPasswordVisibility(window.document,'password',null),false);
 }finally{await window.happyDOM.close()}
});

test('All public auth password controls are labelled and do not submit or redraw',()=>{
 assert.match(app,/function passwordField\(/);
 assert.match(app,/data-action="togglePassword"/);
 assert.match(app,/aria-controls="/);
 assert.match(app,/aria-pressed="false"/);
 assert.match(app,/signup\?passwordField\('Confirmer le mot de passe','signupPasswordConfirm'/);
 assert.match(app,/passwordField\('Nouveau mot de passe','newPassword'/);
 assert.match(app,/if\(a==='togglePassword'\)\{togglePublicPasswordVisibility\(document,id,el\);return;\}/);
 assert.doesNotMatch(app,/localStorage\.setItem\('password'/);
});
