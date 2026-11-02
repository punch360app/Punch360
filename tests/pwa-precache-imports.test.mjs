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
 check(new URL('app.js',root));
 assert.deepEqual([...missing].sort(),[],'Offline boot is missing one or more imported JS modules');
 assert.ok(seen.size>=20,'Expected real app dependency graph rather than a trivial sample');
});
