import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {showKioskProcessing} from '../web/live/kiosk-processing.js';
import {createKioskLocale,KIOSK_LANGUAGES} from '../web/live/kiosk-locale.js';

test('verification feedback disables every kiosk control but preserves typed fields',async()=>{
 const w=new Window();
 w.document.body.innerHTML='<main id="kiosk"><header></header>'+
 '<div class="kiosk-notice" role="status"></div>'+
 '<section class="kiosk-content"><input id="number" value="TEST-001">'+
 '<input id="pin" type="password" value="123456"><button data-key="OK">OK</button>'+
 '<select id="language"><option>Français</option></select></section></main>';
 const root=w.document.querySelector('#kiosk');
 showKioskProcessing(root,'Traitement en cours…');
 assert.equal(root.querySelector('.kiosk-notice').textContent,'Traitement en cours…');
 assert.equal(root.querySelector('.kiosk-notice').getAttribute('data-pending'),'true');
 assert.equal(root.querySelector('.kiosk-content').getAttribute('aria-busy'),'true');
 assert.ok([...root.querySelectorAll('button,input,select')].every(x=>x.disabled));
 assert.equal(root.querySelector('#number').value,'TEST-001');
 assert.equal(root.querySelector('#pin').value,'123456');
 assert.equal(root.querySelector('.kiosk-notice').closest('.kiosk-content'),null);
 await w.happyDOM.close();
});

test('kiosk loading state supports all ten official languages',()=>{
 const locale=createKioskLocale();
 assert.equal(KIOSK_LANGUAGES.length,10);
 for(const language of KIOSK_LANGUAGES){
  locale.select(language.code);
  const translation=locale.t('processing');
  assert.equal(typeof translation,'string');
  assert.ok(translation.length>5,language.code+' processing translation is missing');
  assert.notEqual(translation,'processing');
 }
});

test('an invalid kiosk target fails closed rather than masking a runtime error',()=>{
 assert.throws(()=>showKioskProcessing(null,'Traitement en cours'),/root required/);
});
