import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validatePublicSignupPassword} from '../web/live/public-signup-validation.js';
const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');

test('Signup requires a second matching password before an authentication call',()=>{
 assert.match(validatePublicSignupPassword('abc','abc'),/8 caractères/);
 assert.match(validatePublicSignupPassword('long-passphrase','wrong-value'),/ne correspondent pas/);
 assert.match(validatePublicSignupPassword('long-passphrase',undefined),/ne correspondent pas/);
 assert.equal(validatePublicSignupPassword('long-passphrase','long-passphrase'),null);
 assert.equal(validatePublicSignupPassword('éèa23456','éèa23456'),null);
});

test('Signup shows the confirmation field, preserves it across redraws and does not store it',()=>{
 assert.match(app,/signup\?passwordField\('Confirmer le mot de passe','signupPasswordConfirm'/);
 assert.match(app,/validatePublicSignupPassword\(password,\$\('signupPasswordConfirm'\)\?\.value\)/);
 assert.match(app,/\['email','password','signupPasswordConfirm','companyName'/);
 assert.match(app,/if\(signupError\)return authMessage\(signupError,true\);state\.authBusy=true/);
 assert.doesNotMatch(app,/sessionStorage\.setItem\('signupPasswordConfirm'/);
 assert.doesNotMatch(app,/localStorage\.setItem\('signupPasswordConfirm'/);
});

test('Email confirmation is prefixed from the current signup, not device storage',()=>{
 assert.match(app,/confirmationEmail:''/);
 assert.match(app,/state\.confirmationEmail=email;state\.authMode='confirmation'/);
 assert.match(app,/mode==='confirmation'\?state\.confirmationEmail:''/);
 assert.match(app,/state\.confirmationEmail='';state\.authMode='welcome'/);
 assert.match(app,/if\(err\?\.code==='email_not_confirmed'\)state\.confirmationEmail=email/);
 assert.match(app,/state\.confirmationEmail=email;authMessage\('Lien de confirmation demandé/);
 assert.doesNotMatch(app,/localStorage\.setItem\('confirmationEmail'/);
 assert.doesNotMatch(app,/sessionStorage\.setItem\('confirmationEmail'/);
});
