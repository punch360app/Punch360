import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const jobs=readFileSync(new URL('../src/jobs/api.ts',import.meta.url),'utf8');
test('source follows job refresh independently of attendance read',()=>{
 assert.match(app,/const \[jobsReadSource,setJobsReadSource\]=useState<'cache'\|'server'\|null>\(null\)/);
 assert.match(app,/setJobsReadSource\(result\.readSource\|\|'server'\)/);
 assert.match(app,/else setJobsReadSource\('cache'\)/);
});
test('catalog warns about cached jobs without claiming they are current',()=>{
 assert.match(app,/jobsReadSource==='cache'\?<T color=\{C\.gold\} size=\{11\}>Chantiers sauvegardés/);
 assert.match(app,/à revalider en ligne/);
});
test('transfer confirmation calls out stale cached catalog',()=>{
 assert.match(app,/jobsReadSource==='cache'\?' Liste des chantiers sauvegardée : sélection à revalider/);
 assert.match(app,/if\(punchActive\)Alert\.alert\('Transférer mon punch'/);
});
test('cached job source cannot be confused with live Supabase data',()=>{
 assert.match(jobs,/readSource\?:'cache'\|'server'/);
 assert.match(jobs,/readSource:'cache'/);
 assert.match(jobs,/readSource:'server'/);
});
