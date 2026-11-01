import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canUseEssentialMobilePunch,essentialMobilePunchNotice} from '../web/live/essential-mobile-punch.js';
const worker={company_id:'A',auth_user_id:'u',status:'active',can_mobile_punch:true};
const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
test('An explicitly authorized, current worker may use mobile punch',()=>{
 assert.equal(canUseEssentialMobilePunch('A','u',worker),true);
 assert.equal(canUseEssentialMobilePunch('A','u',{...worker,can_mobile_punch:false}),false);
});
test('Unknown, disabled, foreign-company and foreign-user workers fail closed',()=>{
 for(const candidate of [null,undefined,{}, {...worker,company_id:'B'}, {...worker,auth_user_id:'v'},
 {...worker,status:'disabled'}, {...worker,can_mobile_punch:undefined},
 {...worker,can_mobile_punch:null}, {...worker,can_mobile_punch:'true'}]){
  assert.equal(canUseEssentialMobilePunch('A','u',candidate),false);
 }
 assert.equal(canUseEssentialMobilePunch('B','u',worker),false);
 assert.equal(canUseEssentialMobilePunch('A',null,worker),false);
 assert.match(essentialMobilePunchNotice({...worker,can_mobile_punch:false}),/borne/);
 assert.match(essentialMobilePunchNotice(null),/non confirmé/);
});
test('All three local entry points block Essentiel mobile punch, without hiding other tabs',()=>{
 assert.match(app,/function essentialMobilePunchAllowed\(\)/);
 assert.match(app,/const mobile=essentialMobilePunchAllowed\(\)/);
 assert.match(app,/hidden disabled aria-disabled="true"/);
 assert.match(app,/async function locatedPunch\(action,job,paid=false\)\{if\(isEssential\(\)&&!essentialMobilePunchAllowed\(\)\)throw new Error/);
 assert.match(app,/async function doPunch\(\)\{if\(isEssential\(\)&&!essentialMobilePunchAllowed\(\)\)/);
 assert.match(app,/async function doPause\(paid=false\)\{if\(isEssential\(\)&&!essentialMobilePunchAllowed\(\)\)/);
 assert.match(app,/function essentialHours\(\)/);
 assert.match(app,/function essentialSchedule\(\)/);
});
