import test from 'node:test';
import assert from 'node:assert/strict';
import {createTeamsScope,teamsIdentity,canManageTeams,canSeeTeamHours,boundedTeamRows,teamCreationAllowed,teamMemberAllowed,teamJobAllowed,localTeamDay,visibleLeadHours} from '../src/hr/teamsScope.js';
const a={companyId:'A',userId:'alice',role:'admin',edition:'construction'};
const teams=[{id:'team',company_id:'A',lead_user_id:'lead'}];
const people=[{user_id:'lead',role:'lead',status:'active'},{user_id:'worker',role:'employee',status:'active'}];
const jobs=[{id:'j',company_id:'A',name:'Chantier'}];
test('A B A, role, user and edition changes invalidate all old requests',()=>{
 const s=createTeamsScope(a),old=s.enter(a),b=s.enter({...a,companyId:'B'});
 assert.equal(s.allows(old),false);
 const user=s.enter({...a,userId:'bob'});assert.equal(s.allows(b),false);
 const role=s.enter({...a,role:'lead'});assert.equal(s.allows(user),false);
 s.enter({...a,edition:'essential'});assert.equal(s.allows(role),false);
 s.enter(a);assert.equal(s.allows(old),false);
 const token=s.current();s.invalidate();assert.equal(s.allows(token),false);
 assert.notEqual(teamsIdentity(a),teamsIdentity({...a,edition:'essential'}));
});
test('late data after account change cannot repaint or send a mutation',async()=>{
 const s=createTeamsScope(a),old=s.enter(a);let release;
 const delayed=new Promise(resolve=>release=resolve);
 let writes=0;const task=delayed.then(()=>{if(s.allows(old))writes++});
 s.enter({...a,userId:'other'});release([{id:'private'}]);await task;assert.equal(writes,0);
});
test('team creation and assignments validate active company, lead, member and job',()=>{
 assert.equal(canManageTeams(a),true);
 assert.equal(canSeeTeamHours({...a,role:'lead'}),true);
 assert.equal(canManageTeams({...a,role:'lead'}),false);
 assert.equal(teamCreationAllowed(a,'lead',people,'A Team'),true);
 assert.equal(teamCreationAllowed(a,'lead',people,'  '),false);
 assert.equal(teamCreationAllowed({...a,role:'lead'},'lead',people,'A Team'),false);
 assert.equal(teamCreationAllowed(a,'worker',people,'A Team'),false);
 assert.equal(teamMemberAllowed(a,'team','worker',teams,people),true);
 assert.equal(teamMemberAllowed(a,'team','outsider',teams,people),false);
 assert.equal(teamMemberAllowed({...a,companyId:'B'},'team','worker',teams,people),false);
 assert.equal(teamJobAllowed(a,'team','j',teams,jobs),true);
 assert.equal(teamJobAllowed(a,'team','wrong',teams,jobs),false);
 assert.equal(teamJobAllowed({...a,companyId:'B'},'team','j',teams,jobs),false);
});
test('bounded queries fail closed rather than show partial hours',()=>{
 assert.deepEqual(boundedTeamRows([1,2],2),[1,2]);
 assert.throws(()=>boundedTeamRows([1,2,3],2),/incomplet/);
 assert.throws(()=>boundedTeamRows(null,2),/incomplet/);
});
test('lead hours count only authorized worker/job/day overlap, no duplicate segments',()=>{
 const start='2026-10-30T04:00:00Z',end='2026-10-31T04:00:00Z',now=Date.parse('2026-10-30T19:00:00Z');
 const segment=(id,owner,job,from,to)=>({id,job_id:job,punch_sessions:{user_id:owner},started_at:from,ended_at:to});
 const rows=[
 segment('a','worker','j','2026-10-30T03:00:00Z','2026-10-30T06:00:00Z'),
 segment('b','worker','j','2026-10-30T18:00:00Z',null),
 segment('c','outsider','j','2026-10-30T12:00:00Z','2026-10-30T13:00:00Z'),
 segment('d','worker','wrong','2026-10-30T12:00:00Z','2026-10-30T13:00:00Z'),
 segment('e','worker','j','2026-10-30T02:00:00Z','2026-10-30T03:00:00Z')
 ];
 assert.deepEqual(visibleLeadHours(rows,['worker'],['j'],start,end,now),{milliseconds:3*3600000,count:2});
 assert.throws(()=>visibleLeadHours([rows[0],rows[0]],['worker'],['j'],start,end,now),/incomplets/);
 assert.throws(()=>visibleLeadHours([segment('bad','worker','j','invalid',null)],['worker'],['j'],start,end,now),/invalide/);
});
test('local day bounds include calendar transitions',()=>{
 const d=localTeamDay(new Date(2026,9,30,12));
 assert.equal(new Date(d.start).getDate(),30);
 assert.equal(new Date(d.end).getDate(),31);
 assert.equal(new Date(d.end).getHours(),0);
});
test('Expo TeamsPanel enforces token guards and role-safe period queries',async()=>{
 const {readFileSync}=await import('node:fs');
 const src=readFileSync(new URL('../src/hr/TeamsPanel.tsx',import.meta.url),'utf8');
 assert.match(src,/if\(!identityMatches\)return <View/);
 assert.match(src,/scope\.current\.enter\(account\)/);
 assert.match(src,/scope\.current\.invalidate\(\)/);
 assert.match(src,/actionLock\.current/);
 assert.match(src,/if\(!current\(token\)\)throw/);
 assert.match(src,/\.in\('team_id',teamIds\)/);
 assert.match(src,/\.in\('job_id',jobIds\)/);
 assert.match(src,/\.in\('punch_sessions\.user_id',memberIds\)/);
 assert.match(src,/\.lt\('started_at',window\.end\)/);
 assert.match(src,/visibleLeadHours\(/);
 assert.match(src,/teamCreationAllowed\(/);
 assert.match(src,/teamMemberAllowed\(/);
 assert.match(src,/teamJobAllowed\(/);
 assert.match(src,/minHeight:48/);
 assert.match(src,/accessibilityRole="alert"/);
 assert.match(src,/Réessayer/);
});
