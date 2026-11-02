import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/jobs/api.ts',import.meta.url),'utf8');
const one=source.indexOf('export function scopedJobCache('),two=source.indexOf('export async function listMyCompanyJobs(',one),end=source.indexOf('export async function createJob(',two);
assert.ok(one>0&&two>one&&end>two);
const sanitizer=source.slice(one,two)
 .replace('export function scopedJobCache(value:unknown,companyId:string):JobLoad|null{','function scopedJobCache(value,companyId){')
 .replace(' as Partial<JobLoad>','');
const scopedJobCache=new Function(sanitizer+'return scopedJobCache;')();
const loader=source.slice(two,end)
 .replace('export async function listMyCompanyJobs(companyId:string):Promise<JobLoad>{','async function listMyCompanyJobs(companyId){')
 .replace('new Map<string,string|null>','new Map')
 .replace('const jobs:Job[]=','const jobs=')
 .replace('const result:JobLoad=','const result=');
const job=(company='A')=>({id:'J1',company_id:company,number:'214',name:'Job',address:'Québec',
 latitude:46.8,longitude:-71.2,photo_url:null,assigned_to_me:true,planned_start:null});
const valid=()=>({jobs:[job()],demo:false,message:''});
function fixture({online=false,networkError=false,cache=valid(),serverJobs=[job()],
 jobsError=false,assignError=false,writeFail=false}={}){
 const calls=[],store=new Map();
 if(cache!==null)store.set('punch-jobs:U:A',JSON.stringify(cache));
 const AsyncStorage={
  getItem:async key=>{calls.push(['get',key]);return store.get(key)||null},
  setItem:async(key,value)=>{calls.push(['set',key]);if(writeFail)throw Error('stockage saturé');store.set(key,value)}
 };
 const query={select:()=>query,eq:()=>query,order:()=>Promise.resolve({data:serverJobs,error:jobsError?Error('server jobs'):null}),
  then:(ok,err)=>Promise.resolve({data:[],error:null}).then(ok,err)};
 const assignment={select:()=>assignment,eq:()=>assignment,
  then:(ok,err)=>Promise.resolve({data:[],error:assignError?Error('assign'):null}).then(ok,err)};
 const shift={select:()=>shift,eq:()=>shift,is:()=>shift,gt:()=>shift,order:()=>Promise.resolve({data:[],error:null})};
 const supabase={from:t=>{calls.push(['table',t]);return t==='jobs'?query:t==='job_assignments'?assignment:shift}};
 const fn=new Function('getLocalIdentity','AsyncStorage','Network','supabase','scopedJobCache',loader+'return listMyCompanyJobs;')(
  async()=>({id:'U'}),AsyncStorage,
  {getNetworkStateAsync:async()=>{if(networkError)throw Error('network');return {isConnected:online,isInternetReachable:online}}},
  supabase,scopedJobCache);
 return {calls,store,run:()=>fn('A')};
}
test('valid identity-scoped cached jobs are available offline',async()=>{
 const h=fixture(),r=await h.run();assert.deepEqual(r.jobs.map(x=>x.id),['J1']);
 assert.equal(h.calls.filter(x=>x[0]==='table').length,0);
});
test('network detection failure reuses safe offline cache rather than throwing',async()=>{
 const h=fixture({networkError:true}),r=await h.run();assert.equal(r.jobs[0].id,'J1');
});
test('foreign-company cached job is refused without exposing any row',async()=>{
 for(const cache of [{...valid(),jobs:[job('B')]},{...valid(),jobs:[job(),job('B')]}]){
  const h=fixture({cache});await assert.rejects(h.run(),/hors ligne indisponibles/);
  assert.equal(h.calls.filter(x=>x[0]==='set').length,0);
 }
});
test('damaged legacy cache, fake demo and impossible coordinate are rejected',async()=>{
 for(const cache of [{jobs:'bad',demo:false},{...valid(),demo:true},
  {...valid(),jobs:[{...job(),latitude:900}]},{...valid(),jobs:[{...job(),photo_url:42}]}]){
  assert.equal(scopedJobCache(cache,'A'),null);
 }
});
test('no cache offline gives a recoverable message rather than foreign contents',async()=>{
 await assert.rejects(fixture({cache:null}).run(),/reconnectez/);
});
test('online jobs API error falls back only to scoped valid cache',async()=>{
 const h=fixture({online:true,jobsError:true}),r=await h.run();
 assert.equal(r.jobs[0].company_id,'A');
});
test('online job error with foreign cached rows never returns stale tenant jobs',async()=>{
 await assert.rejects(fixture({online:true,jobsError:true,cache:{...valid(),jobs:[job('B')]}}).run(),/server jobs/);
});
test('server mixing foreign company jobs must fail closed without writing cache',async()=>{
 const h=fixture({online:true,serverJobs:[job(),job('B')]});
 await assert.rejects(h.run(),/Réponse chantiers hors entreprise/);
 assert.equal(h.calls.filter(x=>x[0]==='set').length,0);
});
test('isolated cache helper refuses absent/invalid IDs and object contamination',()=>{
 assert.equal(scopedJobCache({...valid(),jobs:[{...job(),id:''}]},'A'),null);
 assert.equal(scopedJobCache({...valid(),jobs:[null]},'A'),null);
 assert.equal(scopedJobCache({demo:false,jobs:[],message:''},'A').jobs.length,0);
});
test('offline cache key uses both authenticated user and active company',()=>{
 assert.match(source,/const key='punch-jobs:'\+identity\.id\+':'\+companyId/);
 assert.match(source,/raw\?scopedJobCache\(JSON\.parse\(raw\),companyId\):null/);
 assert.doesNotMatch(source,/if\(cached\)return JSON\.parse\(cached\)/);
});

test('offline catalog explicitly labels cache rather than a fresh server snapshot',async()=>{
 assert.equal((await fixture().run()).readSource,'cache');
});
test('online catalog explicitly marks server origin and stores it',async()=>{
 const h=fixture({online:true}),result=await h.run();
 assert.equal(result.readSource,'server');
 assert.equal(JSON.parse(h.store.get('punch-jobs:U:A')).readSource,'server');
});
test('online fallback after API error cannot pretend catalog is fresh',async()=>{
 assert.equal((await fixture({online:true,jobsError:true}).run()).readSource,'cache');
});
test('legacy cache marked server must still be labeled as cached when reused',()=>{
 assert.equal(scopedJobCache({...valid(),readSource:'server'},'A').readSource,'cache');
});

test('live catalog remains available when local storage refuses the cache update',async()=>{
 const h=fixture({online:true,writeFail:true,cache:null}),result=await h.run();
 assert.equal(result.readSource,'server');assert.equal(result.jobs[0].id,'J1');
 assert.match(result.message,/Sauvegarde hors ligne indisponible/);
 assert.equal(h.calls.filter(c=>c[0]==='set').length,1);
});
test('failed cache update keeps previous snapshot untouched and warns about offline storage',async()=>{
 const h=fixture({online:true,writeFail:true}),result=await h.run();
 assert.equal(result.readSource,'server');
 assert.equal(JSON.parse(h.store.get('punch-jobs:U:A')).readSource,undefined);
 assert.match(result.message,/Sauvegarde hors ligne indisponible/);
});
