import {test} from 'node:test';
import assert from 'node:assert/strict';
import {navigationPlatform,navigationProviders,navigationUrl,navigationDestination,
 navigationPreferenceKey,chooseNavigationPreference} from '../web/live/navigation-choices.js';
test('Google and Waze use valid cross-device URL parameters; no address notes or GPS are added',()=>{
 const address='123 rue des Érables, Suite #3 / arrière, Québec (QC), CA';
 const url=navigationUrl('google',address,'android');
 const decoded=new URL(url);
 assert.equal(decoded.origin,'https://www.google.com');assert.equal(decoded.searchParams.get('api'),'1');
 assert.equal(decoded.searchParams.get('destination'),address);
 const waze=new URL(navigationUrl('waze',address,'ios'));
 assert.equal(waze.origin,'https://waze.com');assert.equal(waze.searchParams.get('q'),address);
 assert.equal(waze.searchParams.get('navigate'),'yes');
 for(const value of [url,waze.toString()])assert.doesNotMatch(value,/token|latitude|longitude|access_instructions|Code secret/);
});
test('Apple Maps native link is only selectable on compatible Apple systems',()=>{
 assert.deepEqual(navigationProviders('android').map(x=>x.id),['google','waze','other']);
 assert.deepEqual(navigationProviders('ios').map(x=>x.id),['google','waze','apple']);
 assert.deepEqual(navigationProviders('web').map(x=>x.id),['google','waze']);
 assert.equal(navigationPlatform('web','Mozilla/5.0 (Linux; Android 16)'),'android');
 assert.equal(navigationPlatform('web','Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X)'),'ios');
 assert.equal(navigationPlatform('web','Mozilla/5.0 (Macintosh; Intel Mac OS X 15_5)'),'mac');
 assert.equal(navigationPlatform('web','Mozilla/5.0 (Windows NT 10.0)'),'web');
 assert.equal(new URL(navigationUrl('apple','Rue Côte-du-Palais, Québec','ios')).searchParams.get('daddr'),'Rue Côte-du-Palais, Québec');
 assert.throws(()=>navigationUrl('apple','123 rue du Marché','android'),/non disponible/);
 assert.equal(navigationUrl('other','123 rue du Marché','android').startsWith('geo:0,0?q='),true);
 assert.throws(()=>navigationUrl('other','123 rue du Marché','ios'),/non disponible/);
});
test('real client destination wins; usual branch works without calendar or punch; uncertain results do not fall back incorrectly',()=>{
 const visit={client:'Clinique Nadine',title:'Nettoyage',address:'500 rue Saint-Jean, Québec',
  instructions:'CODE #5432 - NEVER SHARE',internal_notes:'Confidential'};
 const dst=navigationDestination({visit,usualAddress:'100 rue du Commerce, Québec',usualName:'Bureau principal'});
 assert.deepEqual(dst,{kind:'client',title:'Clinique Nadine · Nettoyage',address:'500 rue Saint-Jean, Québec'});
 assert.doesNotMatch(JSON.stringify(dst),/5432|internal_notes|Confidential/);
 assert.deepEqual(navigationDestination({usualAddress:'100 rue du Commerce, Québec',usualName:'Magasin'}),{kind:'fixed',title:'Magasin',address:'100 rue du Commerce, Québec'});
 assert.equal(navigationDestination({usualAddress:'100 rue du Commerce, Québec',incomplete:true}),null);
 assert.equal(navigationDestination({usualAddress:'',usualName:'Télétravail'}),null);
 assert.equal(navigationDestination({usualAddress:'123'}),null);
 assert.equal(navigationDestination({visit:{address:''},usualAddress:'100 rue du Commerce, Québec'}),null);
});
test('navigation preference is per account and compatible provider; invalid URL input is rejected',()=>{
 assert.notEqual(navigationPreferenceKey('user-a','company-a'),navigationPreferenceKey('user-a','company-b'));
 assert.notEqual(navigationPreferenceKey('user-a','company-a'),navigationPreferenceKey('user-b','company-a'));
 assert.equal(chooseNavigationPreference('google','android'),'google');
 assert.equal(chooseNavigationPreference('apple','android'),null);
 assert.equal(chooseNavigationPreference('apple','ios'),'apple');
 assert.equal(chooseNavigationPreference('invalid','ios'),null);
 assert.throws(()=>navigationUrl('google','NO'),/manquante/);
 assert.throws(()=>navigationUrl('google','123 rue\nCode secret'),/manquante/);
});
