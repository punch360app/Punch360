import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeEssentialLanguages,nativeEssentialText,nativeManagementLabel,nativeLocaleDirection,readNativeLocale,writeNativeLocale,nativeLocaleKey,validateNativeLocale} from '../src/i18n/essential-native-locale.js';
import {LOCALE_STRINGS} from '../web/live/essential-locale.js';

test('Expo and Web share the identical ten-language vocabulary, including extended management navigation',()=>{
 assert.equal(nativeEssentialLanguages.length,10);
 const keys=Object.keys(LOCALE_STRINGS.fr);
 for(const lang of nativeEssentialLanguages){
  assert.deepEqual(Object.keys(LOCALE_STRINGS[lang.code]),keys);
  assert.ok(keys.every(k=>nativeEssentialText(lang.code,k)===LOCALE_STRINGS[lang.code][k]&&nativeEssentialText(lang.code,k).trim().length>0));
  assert.notEqual(nativeManagementLabel(lang.code,'organization','untranslated'), 'untranslated');
 }
 assert.match(nativeManagementLabel('ar','bossHandoff',''),/نقل/);
 assert.equal(nativeEssentialText('en','companyManagement'),'Administration');
 assert.equal(nativeLocaleDirection('ar'),'rtl');
 assert.equal(nativeLocaleDirection('zh'),'ltr');
});

test('Expo locale preference is isolated by account and reads nothing without an authenticated user',async()=>{
 const saved=new Map(),calls=[];
 const store={getItem:async k=>{calls.push(['read',k]);return saved.get(k)??null;},setItem:async(k,v)=>{calls.push(['save',k,v]);saved.set(k,v);}};
 await writeNativeLocale(store,'user-A','ar');
 await writeNativeLocale(store,'user-B','de');
 assert.equal(await readNativeLocale(store,'user-A'),'ar');
 assert.equal(await readNativeLocale(store,'user-B'),'de');
 assert.equal(nativeLocaleKey('user-A'),'punch-locale:user-A');
 assert.equal(await readNativeLocale(store,null),'fr');
 assert.equal(await writeNativeLocale(store,null,'es'),'es');
 assert.equal(calls.filter(c=>c[0]==='save').length,2);
});

test('Unknown preference never activates arbitrary RTL or escapes outside a supported language',async()=>{
 const store={getItem:async()=>'<img src=x onerror=alert(1)>',setItem:async()=>{}};
 assert.equal(await readNativeLocale(store,'user-A'),'fr');
 assert.equal(validateNativeLocale('broken'),'fr');
 assert.equal(nativeLocaleDirection('broken'),'ltr');
 assert.equal(nativeEssentialText('broken','schedule'),'Horaire');
});
test('Storage failures fall back to French, without affecting other users',async()=>{
 const bad={getItem:async()=>{throw Error('unavailable')},setItem:async()=>{throw Error('unavailable')}};
 assert.equal(await readNativeLocale(bad,'A'),'fr');
 await assert.rejects(()=>writeNativeLocale(bad,'A','ar'));
});
