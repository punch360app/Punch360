import {resolvePublicEdition,isPublicEdition} from '../web/live/public-edition.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const read = path => readFileSync(new URL('../web/live/'+path,import.meta.url),'utf8');
const app=read('app.js'),essential=read('essential.js'),css=read('public-bento.css');
const html=read('index.html'),sw=read('sw.js');

test('selected Bento layout is scoped to welcome; logged-in account flows remain unchanged',()=>{
 assert.match(app,/mode==='welcome'\?' punch-public-bento':''/);
 assert.match(css,/\.essential-public \.punch-public-bento/);
 assert.match(css,/html\.auth-screen:not\(\.essential-public\) \.punch-public-bento/);
 assert.match(app,/Une équipe\.<br><em>Un seul espace\.<\/em>/);
 assert.match(app,/class="bento-proof"/);
 assert.match(app,/Pointer/);
 assert.match(app,/Planifier/);
 assert.match(app,/Valider/);
 assert.doesNotMatch(css,/\.ess-platform\b/);
 assert.doesNotMatch(css,/\.management-shell\b/);
});

test('Bento has the real dynamic public plans, the original handlers and separate editions',()=>{
 assert.match(app,/essentialUI\.renderPricing\(\)/);
 assert.match(app,/data-action="chooseEdition"/);
 assert.match(app,/data-id="essential"/);
 assert.match(app,/data-id="construction"/);
 assert.match(app,/continueSignup/);
 assert.match(app,/openLogin/);
 assert.match(essential,/s\.plans\.filter\(p=>p\.active&&p\.public_visible\)/);
 assert.match(essential,/estimatePublicPlanPrice\(p,s\.seats,s\.cadence\)/);
 assert.match(essential,/p\.annual_discount/);
 assert.match(essential,/btn\('Choisir ce forfait','choose'/);
 assert.match(essential,/ess-market-details/);
 assert.doesNotMatch(css,/19\s*\$|39\s*\$|69\s*\$|\.base_cents|annual_discount/);
});

test('Unavailable public catalog is explicit and never exposes technical API errors or fake prices',()=>{
 assert.match(essential,/Tarifs temporairement indisponibles/);
 assert.match(essential,/ess-pricing-status/);
 assert.doesNotMatch(essential,/e\(s\.error\|\|'Chargement des tarifs/);
 assert.match(css,/\.ess-pricing>\.ess-pricing-status/);
 assert.match(css,/\.ess-seats-status/);
 const visual=readFileSync(new URL('../.github/scripts/visual-bento-five.cjs',import.meta.url),'utf8');
 assert.match(visual,/No invented prices should be rendered without the real catalog/);
 assert.match(visual,/TypeError\|Failed to fetch\|NetworkError/);
});

test('Recommended plan badge precedes its selection button on compact phones',()=>{
 const mobile=css.slice(css.indexOf('@media(max-width:680px)'));
 assert.match(mobile,/\.ess-price>\.ess-badge\{[\s\S]*?grid-row:3/);
 assert.match(mobile,/\.ess-price>\.ess-btn\{[\s\S]*?grid-row:4/);
});
test('320px compact Bento preserves 44px selection while reducing card height',()=>{
 const narrow=css.slice(css.indexOf('@media(max-width:360px)'));
 assert.match(narrow,/grid-template-columns:minmax\(0,1fr\) 108px/);
 assert.match(narrow,/\.ess-price>\.ess-btn\{[\s\S]*?grid-column:2;grid-row:3;min-height:44px/);
 assert.match(narrow,/\.ess-price>\.ess-badge\{[\s\S]*?grid-column:1;grid-row:2/);
});
test('320px viewport recovers 9px with no text or CTA shrinkage',()=>{
 const narrow=css.slice(css.indexOf('@media(max-width:360px)'));
 assert.match(narrow,/\.onboard-main\{padding:4px 10px 10px/);
 assert.match(narrow,/\.ess-price-grid\{gap:2px/);
 assert.match(narrow,/\.ess-price>\.ess-btn\{[\s\S]*?min-height:44px/);
});
test('Bento CSS and PWA references are versioned and responsive',()=>{
 assert.match(html,/public-bento\.css\?v=bento-05-7/);
 assert.match(html,/app\.js\?v=essential-75-bento/);
 assert.match(sw,/public-bento\.css\?v=bento-05-7/);
 assert.match(sw,/app\.js\?v=essential-75-bento/);
 assert.match(css,/@media\(max-width:1100px\)/);
 assert.match(css,/@media\(max-width:680px\)/);
 assert.match(css,/@media\(max-width:360px\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/focus-visible/);
 assert.match(css,/min-height:44px/);
 assert.match(css,/overflow-x:hidden/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
});

test('Fresh public visitors see Essentiel Bento; explicit and saved Construction choices are respected',()=>{
 assert.equal(resolvePublicEdition('',null),'essential');
 assert.equal(resolvePublicEdition('?edition=essential',null),'essential');
 assert.equal(resolvePublicEdition('?edition=construction',null),'construction');
 assert.equal(resolvePublicEdition('', 'construction'),'construction');
 assert.equal(resolvePublicEdition('', 'essential'),'essential');
 assert.equal(resolvePublicEdition('?edition=essential','construction'),'essential');
 assert.equal(resolvePublicEdition('?edition=construction','essential'),'construction');
 assert.equal(resolvePublicEdition('?edition=invalid','construction'),'construction');
 assert.equal(resolvePublicEdition('?edition=invalid',null),'essential');
 assert.equal(isPublicEdition('essential'),true);
 assert.equal(isPublicEdition('construction'),true);
 for(const invalid of ['',undefined,null,'invalid','__proto__'])assert.equal(isPublicEdition(invalid),false);
 assert.match(app,/if\(!isPublicEdition\(id\)\)return/);
 assert.match(app,/creationEdition:resolvePublicEdition\(location\.search,localStorage\.getItem\('punch-creation-edition'\)\)/);
 assert.match(sw,/\.\/public-edition\.js/);
 assert.match(sw,/punch-360-essential-v83-bento/);
});

test('Selected Essentiel offer is a nonbinding reminder in signup and setup',()=>{
 assert.match(app,/beginPublicEssentialSignup\(sessionStorage,localStorage/);
 assert.match(app,/renderPublicPlanReminder\(sessionStorage/);
 assert.match(app,/clearSavedPublicPlanSelection\(sessionStorage/);
 assert.match(app,/Modifier mon forfait/);
 assert.match(app,/Modifier mon choix/);
 assert.match(sw,/\.\/public-plan-intent\.js/);
});

// The app needs to restore the remembered estimate before showing public
// pricing, including after an email-auth redirect or a browser reload.
test('Essential signup restores a valid saved seat estimate without claiming payment',()=>{
 assert.match(app,/readPublicPlanEstimate\(sessionStorage\)/);
 assert.match(app,/Object\.assign\(essentialUI\.state,savedPublicEstimate\)/);
 assert.match(app,/url\.searchParams\.set\('edition','essential'\)/);
 assert.match(app,/state\.creationEdition==='essential'/);
});

// Stale public selections must be removed only after a successful company
// creation or signout, while a failed company RPC can be retried.
test('Signup clears per-tab plan intent on company success and logout',()=>{
 assert.match(app,/function clearPublicPlanSelection\(\)/);
 assert.match(read('public-plan-intent.js'),/const first=forgetPublicPlanIntent\(storage\)/);
 assert.match(app,/clearSavedPublicPlanSelection\(sessionStorage\)/);
 assert.match(app,/if\(r\.error\)throw r\.error;clearPublicPlanSelection\(\);await initialize\(\);toast\('Ton espace PUNCH est prêt'\)/);
 assert.match(app,/await sb\.auth\.signOut\(\);clearPublicPlanSelection\(\)/);
 assert.match(essential,/s\.seats=5;s\.seatDraft=null;s\.cadence='monthly';s\.checkout=null/);
});

// Browser smoke must not hang on a broken root module. Parse the actual
// entrypoint with Node before any DOM-driven tests or screenshots run.
test('Public application entrypoint parses as an ES module',()=>{
 const checked=spawnSync(process.execPath,['--check','--input-type=module'],{
  input:app,encoding:'utf8',timeout:15000
 });
 assert.equal(checked.error,undefined,checked.error?.message);
 assert.equal(checked.status,0,checked.stderr||'app.js has an invalid module syntax');
});

test('Password toggle assets retain accessible 44px focusable touch controls',()=>{
 assert.match(sw,/\.\/password-visibility\.js/);
 assert.match(css,/html\.auth-screen \.auth-show-password\{[^}]*min-height:44px/);
 assert.match(css,/html\.auth-screen \.auth-show-password:focus-visible/);
});
