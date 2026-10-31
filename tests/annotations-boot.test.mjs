import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../web/live/annotations.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../web/live/annotations.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../web/live/annotations.css',import.meta.url),'utf8');

test('Atelier shared responsive renderer stays mandatory, but startup failure remains recoverable',()=>{
 assert.match(source,/await import\(ATELIER_RESPONSIVE_URL\)/);
 assert.doesNotMatch(source,/^import\s+\{mountResponsiveWorkspace\}\s+from/m);
 assert.match(source,/mountResponsiveWorkspace\(\{/);
 assert.match(source,/renderApp\(\{container,slot\}\)/);
 assert.match(source,/renderWeb\(\{container\}\)/);
 assert.match(source,/retry\.addEventListener\('click',\(\)=>window\.location\.reload\(\)\)/);
 assert.match(source,/boot\.setAttribute\('role','alert'\)/);
 assert.match(source,/boot\.append\(message,retry\)/);
 assert.match(source,/Les annotations locales restent sur cet appareil/);
});

test('Retry has a visible 44px target, keyboard focus, and updated assets',()=>{
 assert.match(css,/#punch-preview-boot \.punch-preview-retry\{[^}]*min-height:44px/);
 assert.match(css,/#punch-preview-boot \.punch-preview-retry:focus-visible/);
 assert.match(html,/annotations\.css\?v=4/);
 assert.match(html,/annotations\.js\?v=4/);
});
