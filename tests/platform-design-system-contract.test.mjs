import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../web/live/platform-directory.css',import.meta.url),'utf8');
const parent=readFileSync(new URL('../web/live/essential.css',import.meta.url),'utf8');
const audit=readFileSync(new URL('../web/live/platform-audit.js',import.meta.url),'utf8');
const directory=readFileSync(new URL('../web/live/platform-directory.js',import.meta.url),'utf8');
const sw=readFileSync(new URL('../web/live/sw.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../web/live/index.html',import.meta.url),'utf8');

test('both Super Admin pages reuse accessible design-system feedback and MFA denial handling',()=>{
 for(const content of [audit,directory]){
  assert.match(content,/platform-ui-guards\.js/);
  assert.match(content,/renderPlatformFeedback\(s,e\)/);
  assert.match(content,/isPlatformAuthorizationDenied\(error\)/);
 }
});

test('company cards and buttons keep sage tokens, 44px touch targets and a mobile layout',()=>{
 assert.match(parent,/\.essential-management\{[^}]*--ess-sage:#779574/);
 assert.match(css,/\.platform-directory\s*\{/);
 assert.match(css,/var\(--ess-sage,#779574\)/);
 assert.match(css,/\.platform-directory \.ess-person\{[^}]*flex-wrap:wrap/);
 assert.match(css,/\.platform-directory \.ess-person \.ess-btn\{[^}]*min-height:44px/);
 assert.match(css,/@media\(max-width:600px\)[\s\S]*?\.platform-directory \.ess-person \.ess-btn\{[^}]*width:100%/);
 assert.match(css,/focus-visible/);
 assert.match(directory,/type="button" class="ess-btn"/);
});

test('new shared modules and scoped CSS are included in the PWA and live HTML',()=>{
 assert.match(sw,/punch-360-essential-v49/);
 assert.match(sw,/\.\/platform-ui-guards\.js/);
 assert.match(sw,/\.\/platform-directory\.css\?v=directory-1/);
 assert.match(html,/platform-directory\.css\?v=directory-1/);
});
