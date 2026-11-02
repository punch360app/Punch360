import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../web/live/',import.meta.url);

test('offline PWA cache includes exact versioned assets for app and kiosk shells',()=>{
 const serviceWorker=readFileSync(new URL('sw.js',root),'utf8');
 const list=serviceWorker.match(/const FILES=\[([\s\S]*?)\];/);
 assert.ok(list,'Service worker must declare an install precache');
 const cached=new Set([...list[1].matchAll(/'(\.\/[^']+)'/g)].map(match=>match[1]));
 assert.ok(cached.has('./')&&cached.has('./index.html')&&cached.has('./kiosk.html'),
  'Both offline entrypoints must be in the precache');
 const missing=[];
 for(const page of ['index.html','kiosk.html']){
  const html=readFileSync(new URL(page,root),'utf8');
  for(const match of html.matchAll(/<(?:link|script)\b[^>]*>/gi)){
   const asset=match[0].match(/\b(?:href|src)\s*=\s*(['"])(\.\/[^'"]+)\1/i)?.[2];
   if(asset&&!cached.has(asset))missing.push(page+': '+asset);
  }
 }
 const kioskManifest=JSON.parse(readFileSync(new URL('kiosk.webmanifest',root),'utf8'));
 for(const icon of kioskManifest.icons||[]){
  if(icon.src?.startsWith('./')&&!cached.has(icon.src))
   missing.push('kiosk.webmanifest: '+icon.src);
 }
 assert.deepEqual(missing,[],
  'Offline cache must match the actual URL, including its version query string');
});
