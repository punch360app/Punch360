import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../web/live/',import.meta.url);
const sw=readFileSync(new URL('sw.js',root),'utf8');
const cachePaths=new Set([...sw.matchAll(/['"](\.\/[^'"]+)['"]/g)]
 .map(match=>new URL(match[1],root).pathname));

test('installed PWA precaches all static JavaScript modules used by the app',()=>{
 const seen=new Set(),missing=new Set();
 function check(url){
  if(seen.has(url.pathname))return;
  seen.add(url.pathname);
  assert.ok(url.pathname.startsWith(root.pathname),'Import outside the PWA folder: '+url.pathname);
  if(!cachePaths.has(url.pathname))missing.add(url.pathname.slice(root.pathname.length));
  const source=readFileSync(url,'utf8');
  // Current application uses single-line static ESM imports, including side-effect imports.
  const statements=/^\s*import\s+(?:[^;\n]+?\s+from\s+)?['"](\.[^'"]+)['"];?\s*$/gm;
  for(const match of source.matchAll(statements)){
   const child=new URL(match[1],url);
   if(child.pathname.endsWith('.js'))check(child);
  }
 }
 // The kiosk has its own entrypoint and nested imports. Checking app.js alone
 // can leave the employee PWA usable while the offline kiosk fails to boot.
 check(new URL('app.js',root));
 const appCount=seen.size;
 check(new URL('kiosk.js',root));
 assert.ok(seen.has(new URL('kiosk-offline.js',root).pathname),
  'Kiosk offline queue must be part of the verified dependency graph');
 assert.ok(seen.has(new URL('kiosk-locale.js',root).pathname),
  'Kiosk localization must be part of the verified dependency graph');
 assert.deepEqual([...missing].sort(),[],'Offline app or kiosk boot is missing imported JS modules');
 assert.ok(appCount>=20,'Expected real app dependency graph rather than a trivial sample');
 assert.ok(seen.size>appCount,'Kiosk must contribute to the checked dependency graph');
});
