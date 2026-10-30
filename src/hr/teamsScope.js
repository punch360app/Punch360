/** Client-side display scoping only. Server RLS remains authoritative for access. */
const identity=(company,user,role)=>JSON.stringify([String(company||''),String(user||''),String(role||'')]);
export function createTeamsScope(company,user,role){
 let key=identity(company,user,role),epoch=0;
 const current=()=>({key,epoch});
 return {
  matches:(c,u,r)=>key===identity(c,u,r),
  enter(c,u,r){key=identity(c,u,r);epoch++;return current();},
  invalidate(){epoch++},
  current,
  allows:token=>Boolean(token&&token.key===key&&token.epoch===epoch)
 };
}
/** A worker/job pair is permitted only when it belongs to the SAME supervised team. */
export function buildTeamWorkerJobPairs(teams,members,jobs){
 const ids=new Set(teams.map(t=>t.id));
 const membersByTeam=new Map(),jobsByTeam=new Map();
 for(const m of members){
  if(!ids.has(m.team_id))continue;
  if(!membersByTeam.has(m.team_id))membersByTeam.set(m.team_id,new Set());
  membersByTeam.get(m.team_id).add(m.user_id);
 }
 for(const j of jobs){
  if(!ids.has(j.team_id))continue;
  if(!jobsByTeam.has(j.team_id))jobsByTeam.set(j.team_id,new Set());
  jobsByTeam.get(j.team_id).add(j.job_id);
 }
 const pairs=new Set();
 for(const team of ids){
  for(const user of membersByTeam.get(team)||[]){
   for(const job of jobsByTeam.get(team)||[])pairs.add(JSON.stringify([user,job]));
  }
 }
 return pairs;
}
export function summarizeTeamHours(segments,sessions,pairs,dayStartMs,nowMs){
 if(!Number.isFinite(dayStartMs)||!Number.isFinite(nowMs)||nowMs<dayStartMs)
  return {milliseconds:0,count:0};
 const bySession=new Map(sessions.map(x=>[x.id,x.user_id]));
 const seen=new Set();let milliseconds=0,count=0;
 for(const seg of segments){
  const worker=bySession.get(seg.session_id);
  if(!worker||!pairs.has(JSON.stringify([worker,seg.job_id]))||seen.has(seg.id))continue;
  const start=Date.parse(seg.started_at),end=seg.ended_at?Date.parse(seg.ended_at):nowMs;
  if(!Number.isFinite(start)||!Number.isFinite(end))continue;
  const clipped=Math.max(0,Math.min(nowMs,end)-Math.max(dayStartMs,start));
  if(!clipped)continue;
  seen.add(seg.id);milliseconds+=clipped;count++;
 }
 return {milliseconds,count};
}
