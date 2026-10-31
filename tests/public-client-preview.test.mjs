import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Window} from 'happy-dom';
import {renderPublicWelcomeIntro,renderPublicPlanCards} from '../web/live/public-client-components.js';
import {createPublicClientPreviewController} from '../web/live/public-client-preview.js';

const app=readFileSync(new URL('../web/live/app.js',import.meta.url),'utf8');
const review=readFileSync(new URL('../web/live/annotations.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../web/live/annotations.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../web/live/public-client-preview.css',import.meta.url),'utf8');
const shared=readFileSync(new URL('../web/live/public-client-components.js',import.meta.url),'utf8');
const preview=readFileSync(new URL('../web/live/public-client-preview.js',import.meta.url),'utf8');

function click(controller,action,id){
 return controller.handle({dataset:{action,id}});
}

test('production and Atelier review use the same public welcome and card functions',()=>{
 assert.match(app,/import \{renderPublicWelcomeIntro,renderPublicPlanCards\} from '\.\/public-client-components\.js'/);
 assert.match(app,/function welcomeIntro\(\)\{return renderPublicWelcomeIntro\(state\.creationEdition\)\}/);
 assert.match(app,/function planCards\(\)\{return renderPublicPlanCards\(state\.creationEdition\)\}/);
 assert.match(preview,/from '\.\/public-client-components\.js'/);
 for(const edition of ['essential','construction']){
  const welcome=renderPublicWelcomeIntro(edition);
  const cards=renderPublicPlanCards(edition);
  assert.match(welcome,/welcome-intro/);
  assert.match(cards,/PUNCH Essentiel/);
  assert.match(cards,/PUNCH Construction/);
  assert.equal((cards.match(/class="plan-card/g)||[]).length,2);
  assert.equal((cards.match(/data-action="chooseEdition"/g)||[]).length,2);
  const chosen=new Window().document.createElement('div');
  chosen.innerHTML=cards;
  assert.equal(chosen.querySelector('.plan-card.chosen')?.dataset.id,edition);
 }
});

test('review screens include the public client without querying production auth or prices',()=>{
 assert.match(review,/client:'Page client — vitrine publique'/);
 assert.match(review,/createPublicClientPreviewController\(\{redraw\}\)/);
 assert.match(review,/if\(view\.screen==='client'\)\{draw\(view\);return;\}/);
 assert.match(review,/view\.screen!=='client'/);
 assert.match(html,/<option value="client">/);
 assert.match(html,/public-client-preview\.css\?v=1/);
 assert.match(css,/@container punch-screen \(max-width:700px\)/);
 assert.doesNotMatch(preview+shared,/createClient\(|sb\.auth|sb\.rpc|localStorage|sessionStorage|\bfetch\(|window\.location/);
 assert.doesNotMatch(preview+shared,/Stripe|submit\(|onSubmit\(/);
});

test('client public preview offers working, independent interactions in the same DOM',async()=>{
 const win=new Window({url:'https://example.test/review'});
 const doc=win.document;
 const first=doc.createElement('section'),second=doc.createElement('section');
 doc.body.append(first,second);
 let updatesA=0,updatesB=0;
 const a=createPublicClientPreviewController({redraw:()=>{updatesA++;first.innerHTML=a.render();}});
 const b=createPublicClientPreviewController({redraw:()=>{updatesB++;second.innerHTML=b.render();}});
 first.innerHTML=a.render();second.innerHTML=b.render();
 assert.match(first.textContent,/Vos chantiers/);
 assert.equal(first.querySelectorAll('[data-punch-client-page]').length,1);
 assert.equal(click(a,'chooseEdition','essential'),true);
 assert.equal(updatesA,1);
 assert.equal(updatesB,0);
 assert.match(first.textContent,/Vos heures/);
 assert.match(second.textContent,/Vos chantiers/);
 assert.match(first.textContent,/Trois forfaits disponibles/);
 assert.equal(a.state.edition,'essential');
 assert.equal(b.state.edition,'construction');
 assert.equal(click(a,'chooseEdition','invalid-company'),false);
 assert.equal(a.state.edition,'essential');
 assert.equal(click(a,'continueSignup'),true);
 assert.match(first.textContent,/Aucun compte ni paiement/);
 assert.doesNotMatch(first.innerHTML,/<form|type="submit"/);
 assert.equal(click(a,'authBack'),true);
 assert.match(first.textContent,/Vos heures/);
 assert.equal(click(b,'openLogin'),true);
 assert.match(second.textContent,/Se connecter/);
 assert.equal(click(b,'authBack'),true);
 assert.match(second.textContent,/Vos chantiers/);
 assert.equal(click(b,'unknown'),false);
 a.reset();
 assert.equal(a.state.edition,'construction');
 assert.equal(a.state.mode,'welcome');
 await win.happyDOM.close();
});

test('preview does not introduce a second device renderer, auth tokens or unscoped styles',()=>{
 assert.doesNotMatch(preview,/iframe|document\.body|new Worker|serviceWorker/i);
 assert.doesNotMatch(css,/^\.ap-device|^\.ap-content|^\.device-frame/m);
 assert.match(css,/\.punch-client-preview/);
 assert.match(css,/\.punch-client-essential/);
 assert.match(html,/script type="module" src="\.\/annotations\.js\?v=5"/);
});
