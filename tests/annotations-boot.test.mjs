import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Window} from 'happy-dom';
import {showAtelierBootFailure,loadAtelierResponsiveModule} from '../web/live/annotation-boot.js';

const source=readFileSync(new URL('../web/live/annotations.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../web/live/annotations.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../web/live/annotations.css',import.meta.url),'utf8');

test('Atelier shared responsive renderer stays mandatory, but startup failure remains recoverable',()=>{
 assert.match(source,/await import\(ATELIER_RESPONSIVE_URL\)/);
 assert.match(source,/await loadAtelierResponsiveModule\(/);
 assert.doesNotMatch(source,/^import\s+\{mountResponsiveWorkspace\}\s+from/m);
 assert.match(source,/mountResponsiveWorkspace\(\{/);
 assert.match(source,/renderApp\(\{container,slot\}\)/);
 assert.match(source,/renderWeb\(\{container\}\)/);
 assert.match(source,/showAtelierBootFailure\(\$\('punch-preview-boot'\),\(\)=>window\.location\.reload\(\)\)/);
 assert.match(source,/import \{showAtelierBootFailure,loadAtelierResponsiveModule\} from '\.\/annotation-boot\.js'/);
});

test('Retry has a visible 44px target, keyboard focus, and updated assets',()=>{
 assert.match(css,/#punch-preview-boot \.punch-preview-retry\{[^}]*min-height:44px/);
 assert.match(css,/#punch-preview-boot \.punch-preview-retry:focus-visible/);
 assert.match(html,/annotations\.css\?v=4/);
 assert.match(html,/annotations\.js\?v=5/);
});

test('Retry button actually executes the browser reload callback without a shared Atelier mount',async()=>{
 const window=new Window({url:'https://punch360app.github.io/Punch360/annotations.html'});
 const doc=window.document;
 const boot=doc.createElement('div');doc.body.append(boot);
 let attempts=0;
 showAtelierBootFailure(boot,()=>{attempts++;});
 assert.equal(boot.getAttribute('role'),'alert');
 const retry=boot.querySelector('button.punch-preview-retry');
 assert.ok(retry);
 assert.equal(retry.type,'button');
 assert.match(boot.textContent,/Les annotations locales restent sur cet appareil/);
 assert.match(retry.textContent,/Réessayer/);
 assert.equal(attempts,0);
 retry.click();
 assert.equal(attempts,1);
 retry.click();
 assert.equal(attempts,2);
 assert.equal(boot.querySelectorAll('button').length,1);
 assert.doesNotThrow(()=>showAtelierBootFailure(null,()=>{}));
 await window.happyDOM.close();
});

test('The real Atelier importer succeeds or forwards a network rejection',async()=>{
 const module={mountResponsiveWorkspace(){}};
 assert.equal(await loadAtelierResponsiveModule(async()=>module,80),module);
 await assert.rejects(loadAtelierResponsiveModule(async()=>{throw Error('REMOTE_UNAVAILABLE')},80),/REMOTE_UNAVAILABLE/);
});

test('A stalled Atelier module fails within its deadline, without mounting a replacement',async()=>{
 let resolveImport;
 const blocked=new Promise(resolve=>{resolveImport=resolve});
 await assert.rejects(loadAtelierResponsiveModule(()=>blocked,15),/Délai de chargement/);
 let mounts=0;
 resolveImport({mountResponsiveWorkspace(){mounts++}});
 await Promise.resolve();
 assert.equal(mounts,0);
 await assert.rejects(loadAtelierResponsiveModule(()=>blocked,0),RangeError);
 await assert.rejects(loadAtelierResponsiveModule(null,30),TypeError);
});
