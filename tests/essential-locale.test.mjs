import test from 'node:test';
import assert from 'node:assert/strict';
import {createEssentialLocale,ESSENTIAL_LANGUAGES,LOCALE_STRINGS} from '../web/live/essential-locale.js';

test('ten languages have complete, nonblank navigation translations',()=>{
 assert.equal(ESSENTIAL_LANGUAGES.length,10);
 const keys=Object.keys(LOCALE_STRINGS.fr);
 for(const lang of ESSENTIAL_LANGUAGES){
  assert.deepEqual(Object.keys(LOCALE_STRINGS[lang.code]),keys);
  assert.ok(Object.values(LOCALE_STRINGS[lang.code]).every(v=>typeof v==='string'&&v.trim().length>0));
 }
});
test('Arabic uses RTL and all other languages preserve LTR',()=>{
 const c=createEssentialLocale();
 c.select('ar');assert.equal(c.dir,'rtl');assert.equal(c.t('schedule'),'الجدول');
 c.select('en');assert.equal(c.dir,'ltr');assert.equal(c.t('schedule'),'Schedule');
 assert.equal(ESSENTIAL_LANGUAGES.filter(l=>l.dir==='rtl').length,1);
});
test('selection is scoped to personal user ID and unknown locales fall back to French',()=>{
 const map=new Map(),storage={getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value)};
 const c=createEssentialLocale({storage});
 c.setUser('A');c.select('es');assert.equal(c.t('hours'),'Horas');
 c.setUser('B');assert.equal(c.code,'fr');c.select('zh');
 c.setUser('A');assert.equal(c.code,'es');
 c.select('random');assert.equal(c.code,'fr');assert.equal(map.get('punch-locale:B'),'zh');
 c.setUser(null);c.select('ar');assert.equal(map.has('punch-locale:null'),false);
 c.setUser('B');assert.equal(c.code,'zh');
});
test('missing translation always falls back safely without echoing HTML',()=>{
 const c=createEssentialLocale();
 c.select('tl');assert.equal(c.t('myHours'),'Aking oras');
 assert.equal(c.t('unknown-key'),'unknown-key');
});
