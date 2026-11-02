import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../src/jobs/catalog.ts',import.meta.url),'utf8');
const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const exports={};
new Function('exports',compiled)(exports);
const {visibleJobs,distanceKm,validGeoPoint,jobHasCoordinates}=exports;
const original=[
 {id:'far',company_id:'A',number:'3',name:'Loin',address:'3 rue Nord',
  latitude:46.9,longitude:-71.4,photo_url:null,assigned_to_me:false},
 {id:'near',company_id:'A',number:'1',name:'Près',address:'1 rue Centre',
  latitude:46.8001,longitude:-71.2001,photo_url:null,assigned_to_me:true},
 {id:'no-gps',company_id:'A',number:'2',name:'Inconnu',address:'2 rue',
  latitude:null,longitude:null,photo_url:null,assigned_to_me:true}
];
const here={latitude:46.8,longitude:-71.2};

test('nearby filter does not incorrectly show all jobs when GPS was denied',()=>{
 assert.deepEqual(visibleJobs(original,'','nearby',null),[]);
 assert.equal(visibleJobs(original,'','all',null).length,3,
  'Unlocalized users can still manually browse every job');
 assert.deepEqual(visibleJobs(original,'','mine',null).map(j=>j.id),['near','no-gps']);
});

test('nearby jobs are sorted by real distance without exposing unmapped jobs',()=>{
 const matches=visibleJobs(original,'','nearby',here);
 assert.deepEqual(matches.map(j=>j.id),['near','far']);
 assert.equal(matches.some(j=>j.id==='no-gps'),false);
 assert.ok(distanceKm(here,{latitude:46.8001,longitude:-71.2001})<
  distanceKm(here,{latitude:46.9,longitude:-71.4}));
});

test('invalid device GPS fixes cannot make any jobs appear nearby',()=>{
 const invalid=[{latitude:NaN,longitude:-71.2},{latitude:99,longitude:-71.2},
  {latitude:46.8,longitude:Infinity},{latitude:46.8,longitude:-200},
  {latitude:undefined,longitude:-71.2}];
 for(const pos of invalid){
  assert.equal(validGeoPoint(pos),false);
  assert.deepEqual(visibleJobs(original,'','nearby',pos),[],
   'Invalid phone GPS is not a distance reference');
 }
 assert.equal(validGeoPoint({latitude:0,longitude:0}),true);
});

test('invalid job geocoding is filtered from nearby map selection',()=>{
 const bad=[{...original[1],id:'bad-lat',latitude:Infinity},
  {...original[1],id:'bad-lon',longitude:999},
  {...original[1],id:'bad-number',latitude:undefined},
  {...original[1],id:'bad-null',longitude:null}];
 for(const job of bad){
  assert.equal(jobHasCoordinates(job),false);
  assert.equal(visibleJobs([job],'','nearby',here).length,0);
  assert.equal(distanceKm(here,{latitude:job.latitude,longitude:job.longitude}),Infinity);
 }
 assert.equal(jobHasCoordinates(original[1]),true);
 assert.equal(jobHasCoordinates(original[2]),false);
});

test('all and my jobs filters still show unmapped jobs for manual selection',()=>{
 const all=visibleJobs([...original],undefined??'','all',here);
 const mine=visibleJobs(original,'','mine',here);
 assert.deepEqual(all.map(j=>j.id),original.map(j=>j.id));
 assert.deepEqual(mine.map(j=>j.id),['near','no-gps']);
});

test('nearby search respects text matching, GPS data and original list immutability',()=>{
 const before=original.map(j=>j.id);
 const matches=visibleJobs(original,'  PRÈS  ','nearby',here);
 assert.deepEqual(matches.map(j=>j.id),['near']);
 assert.deepEqual(original.map(j=>j.id),before);
});

test('distance calculation is finite for valid edge coordinates and never NaN',()=>{
 const antimeridian=distanceKm({latitude:0,longitude:180},{latitude:0,longitude:-180});
 assert.ok(Number.isFinite(antimeridian)&&antimeridian>=0&&antimeridian<0.001);
 assert.equal(distanceKm(here,here),0);
 assert.equal(distanceKm(null,here),Infinity);
});

test('mobile directory explains GPS unavailability rather than showing all as nearby',()=>{
 assert.match(app,/filter==='nearby'&&!validGeoPoint\(pos\)/);
 assert.match(app,/Position GPS indisponible/);
 assert.match(app,/filtered\.filter\(jobHasCoordinates\)/);
 assert.match(app,/jobs\.filter\(jobHasCoordinates\)/);
 assert.match(app,/if\(!validGeoPoint\(point\)\)throw Error\('Coordonnées GPS non valides'\)/);
 const parsed=ts.createSourceFile('App.tsx',app,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(parsed.parseDiagnostics.length,0,'Native map and job picker must parse as TSX');
});
