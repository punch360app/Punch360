import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildTeamWorkerJobPairs,createTeamsScope,summarizeTeamHours} from '../src/hr/teamsScope.js';

test('old team data cannot repaint after company/user/role change or unmount',()=>{
 const s=createTeamsScope('company-A','lead-A','lead'),old=s.enter('company-A','lead-A','lead');
 const next=s.enter('company-B','lead-A','lead');
 assert.equal(s.allows(old),false);assert.equal(s.allows(next),true);
 const other=s.enter('company-B','lead-B','lead');assert.equal(s.allows(next),false);
 const manager=s.enter('company-B','lead-B','boss');assert.equal(s.allows(other),false);
 s.invalidate();assert.equal(s.allows(manager),false);
});

test('a lead sees only worker/job pairs from the same supervised team',()=>{
 const pairs=buildTeamWorkerJobPairs([{id:'team-A'},{id:'team-B'}],[
  {team_id:'team-A',user_id:'alice'},{team_id:'team-B',user_id:'bob'},
  {team_id:'team-C',user_id:'outsider'}],[
  {team_id:'team-A',job_id:'site-X'},{team_id:'team-B',job_id:'site-Y'},
  {team_id:'team-C',job_id:'site-Z'}]);
 assert.equal(pairs.has(JSON.stringify(['alice','site-X'])),true);
 assert.equal(pairs.has(JSON.stringify(['bob','site-Y'])),true);
 assert.equal(pairs.has(JSON.stringify(['alice','site-Y'])),false);
 assert.equal(pairs.has(JSON.stringify(['bob','site-X'])),false);
 assert.equal(pairs.has(JSON.stringify(['outsider','site-Z'])),false);
});

test('hours count only authorized team pair and intersect with today',()=>{
 const day=Date.parse('2026-10-29T04:00:00Z'),now=day+3600000;
 const pairs=buildTeamWorkerJobPairs([{id:'T'}],[{team_id:'T',user_id:'A'}],[{team_id:'T',job_id:'X'}]);
 const sessions=[{id:'s1',user_id:'A'},{id:'s2',user_id:'B'}];
 const seg=(id,session_id,job_id,started_at,ended_at=null)=>({id,session_id,job_id,started_at,ended_at});
 const segments=[
  seg('one','s1','X','2026-10-29T03:30:00Z','2026-10-29T04:30:00Z'),
  seg('two','s1','X','2026-10-29T04:45:00Z',null),
  seg('three','s1','Y','2026-10-29T04:00:00Z',null),
  seg('four','s2','X','2026-10-29T04:00:00Z',null),
  seg('one','s1','X','2026-10-29T03:30:00Z','2026-10-29T04:30:00Z'),
  seg('bad','s1','X','invalid',null)
 ];
 assert.deepEqual(summarizeTeamHours(segments,sessions,pairs,day,now),{milliseconds:45*60000,count:2});
});

test('empty assignments and invalid time ranges produce zero without other teams',()=>{
 const pairs=buildTeamWorkerJobPairs([{id:'T'}],[],[]);
 assert.deepEqual(summarizeTeamHours([{id:'x',session_id:'s',job_id:'X',started_at:'2026-10-29T00:00:00Z'}],
 [{id:'s',user_id:'A'}],pairs,1,200),{milliseconds:0,count:0});
 assert.deepEqual(summarizeTeamHours([],[],pairs,10,5),{milliseconds:0,count:0});
});

test('late network result after switching account is ignored',async()=>{
 const s=createTeamsScope('A','lead','lead'),old=s.enter('A','lead','lead');
 let finish;const pending=new Promise(resolve=>{finish=resolve}),display=[];
 const p=pending.then(v=>{if(s.allows(old))display.push(v)});
 s.enter('B','lead','lead');finish({hours:999});await p;
 assert.deepEqual(display,[]);
});


test('TeamsPanel includes guards and bounded supervised hours query',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../src/hr/TeamsPanel.tsx',import.meta.url),'utf8');
 assert.match(source,/if\(!identityMatches\)return <View/);
 assert.match(source,/scope\.current\.enter\(account\.companyId,account\.userId,account\.role\)/);
 assert.match(source,/requestVersion\.current/);
 assert.match(source,/buildTeamWorkerJobPairs\(visible,members\.data,assignments\.data\)/);
 assert.match(source,/summarizeTeamHours\(segments,sessions,pairs,dayStart,now\)/);
 assert.match(source,/\.eq\('company_id',account\.companyId\)\.in\('team_id',teamIds\)/);
 assert.match(source,/\.order\('id'\)\.range\(offset,offset\+499\)/);
 assert.match(source,/if\(offset===4500\)throw Error\('cap'\)/);
 assert.match(source,/if\(!identityMatches\|\|!manager\|\|!current\(token\)\|\|actionLock\.current\|\|loading\)return/);
 assert.match(source,/const \[loading,setLoading\]/);
 assert.match(source,/minHeight:48/);
 assert.doesNotMatch(source,/select\('started_at,ended_at'\)\.eq\('company_id',account\.companyId\)/);
});
