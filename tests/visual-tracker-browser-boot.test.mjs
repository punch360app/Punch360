import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {Window} from 'happy-dom';

const html=readFileSync(new URL('../web/live/suivi.html',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('../web/live/work-progress.json',import.meta.url),'utf8'));
const scripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
const js=scripts.find(m=>!m[1].includes('application/json'))?.[2];
if(!js)throw Error('Missing interactive tracker script');

test('entire inline JavaScript parses, including priority grouping fallback',()=>{
 assert.doesNotThrow(()=>new Script(js,{filename:'suivi.html:inline.js'}));
 assert.match(js,/typeof Object\.groupBy==='function'/);
 assert.match(js,/return groups;\},\{\}\)/);
});

async function boot(fetchImpl){
 const window=new Window({url:'https://punch360app.github.io/Punch360/suivi.html'});
 window.document.write(html);
 const sandbox={document:window.document,localStorage:window.localStorage,
  fetch:fetchImpl,setInterval:()=>1,scrollTo:()=>{},confirm:()=>false,
  Blob:window.Blob,URL:window.URL,console};
 new Script(js,{filename:'suivi.html:inline.js'}).runInNewContext(sandbox,{timeout:10000});
 await new Promise(resolve=>setImmediate(resolve));
 return window;
}

test('browser boot paints Work 3 counters from GitHub register and exits loading state',async()=>{
 const window=await boot(async()=>({ok:true,json:async()=>manifest}));
 const text=id=>window.document.getElementById(id)?.textContent?.trim();
 assert.equal(text('progressFraction'),'82 / 578');
 assert.equal(text('progressTestedFraction'),'26 / 578');
 assert.equal(text('progressDeliveredFraction'),'0 / 578');
 assert.match(text('progressPercent'),/14[.,]2 %/);
 assert.match(text('progressTestedPercent'),/4[.,]5 %/);
 assert.match(text('progressDeliveredPercent'),/0[.,]0 %/);
 assert.match(text('workRecent'),/Dernières PR fusionnées/);
 assert.ok(!text('progressRemaining').includes('Chargement'));
 await window.happyDOM.close();
});

test('offline mobile browser shows last verified snapshot, not stuck on dashes',async()=>{
 const window=await boot(async()=>{throw Error('Offline or blocked cross-origin request');});
 const text=id=>window.document.getElementById(id)?.textContent?.trim();
 assert.equal(text('progressFraction'),'82 / 578');
 assert.equal(text('progressTestedFraction'),'26 / 578');
 assert.equal(text('progressDeliveredFraction'),'0 / 578');
 assert.match(text('progressSync'),/Mode instantané/);
 assert.ok(!text('progressRemaining').includes('Chargement'));
 await window.happyDOM.close();
});
