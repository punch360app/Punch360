import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../web/live/',import.meta.url);
const worker=readFileSync(new URL('sw.js',root),'utf8');
const precacheList=worker.match(/\bconst FILES\s*=\s*\[([\s\S]*?)\];/);
assert.ok(precacheList,'Expected the installed service worker FILES list');
const cached=new Set([...precacheList[1].matchAll(/(['"])(\.\/[^'"]*)\1/g)]
 .map(match=>new URL(match[2],root).href));

function checkPrecached(reference,base,label){
 const url=new URL(reference,base);
 assert.equal(url.origin,root.origin,label+' must remain on the application origin');
 assert.ok(url.pathname.startsWith(root.pathname),label+' must remain inside the PWA');
 assert.ok(cached.has(url.href),label+' is missing from the install cache: '+reference);
}

test('employee and kiosk entrypoints precache the exact versioned JS/CSS and manifest URLs',()=>{
 for(const name of ['index.html','kiosk.html']){
  const page=new URL(name,root);
  const html=readFileSync(page,'utf8');
  checkPrecached('./'+name,root,name);
  const references=[...html.matchAll(/<(?:script|link)\b[^>]*>/gi)]
   .map(match=>match[0].match(/\b(?:src|href)\s*=\s*(['"])(.*?)\1/i)?.[2])
   .filter(ref=>ref&&/\.(?:js|css|webmanifest)(?:\?|$)/.test(ref));
  assert.ok(references.length>=3,name+' must include real scripts and styles');
  for(const reference of references)checkPrecached(reference,page,name);
 }
 checkPrecached('./',root,'Application home');
});

test('kiosk installed manifest keeps its launch page and icons offline',()=>{
 const manifestUrl=new URL('kiosk.webmanifest',root);
 const manifest=JSON.parse(readFileSync(manifestUrl,'utf8'));
 checkPrecached('./kiosk.webmanifest',root,'Kiosk manifest');
 assert.equal(typeof manifest.start_url,'string');
 checkPrecached(manifest.start_url,manifestUrl,'Kiosk launch page');
 assert.ok(Array.isArray(manifest.icons)&&manifest.icons.length>0,'Kiosk icons must be declared');
 for(const icon of manifest.icons){
  assert.equal(typeof icon.src,'string');
  checkPrecached(icon.src,manifestUrl,'Kiosk icon');
 }
});
