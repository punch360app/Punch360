// Ephemeral client guards. All write permissions and visibility remain server-enforced.
export const teamsIdentity=a=>JSON.stringify([String(a?.companyId||''),String(a?.userId||''),String(a?.role||''),String(a?.edition||'')]);
export function createTeamsScope(a){
 let identity=teamsIdentity(a),revision=0;
 return {
  matches:b=>identity===teamsIdentity(b),
  current:()=>({identity,revision}),
  enter(b){identity=teamsIdentity(b);revision++;return {identity,revision}},
  invalidate(){revision++},
  allows:token=>Boolean(token&&token.identity===identity&&token.revision===revision)
 };
}
export const canManageTeams=a=>a?.role==='boss'||a?.role==='admin';
export const canSeeTeamHours=a=>a?.role==='lead';
export function boundedTeamRows(rows,limit=250){
 if(!Array.isArray(rows)||rows.length>limit)throw Error('Répertoire incomplet');
 return rows;
}
export function validTeamName(name){
 return typeof name==='string'&&name.trim().length>=1&&name.trim().length<=140;
}
export function teamCreationAllowed(account,lead,people,name){
 return canManageTeams(account)&&validTeamName(name)&&people.some(x=>x.user_id===lead&&x.role==='lead'&&x.status==='active');
}
export function teamMemberAllowed(account,team,worker,teams,people){
 return canManageTeams(account)&&teams.some(x=>x.id===team&&x.company_id===account.companyId)&&
  people.some(p=>p.user_id===worker&&['lead','employee'].includes(p.role)&&p.status==='active');
}
export function teamJobAllowed(account,team,job,teams,jobs){
 return canManageTeams(account)&&teams.some(x=>x.id===team&&x.company_id===account.companyId)&&
  jobs.some(j=>j.id===job&&j.company_id===account.companyId);
}
export function localTeamDay(now=new Date()){
 const start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 return {start:start.toISOString(),end:new Date(start.getFullYear(),start.getMonth(),start.getDate()+1).toISOString()};
}
export function visibleLeadHours(segments,memberIds,jobIds,start,end,now=Date.now()){
 const a=Date.parse(start),b=Date.parse(end);
 if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)throw Error('Journée invalide');
 const people=new Set(memberIds),jobs=new Set(jobIds),seen=new Set();
 let milliseconds=0,count=0;
 for(const s of boundedTeamRows(segments,500)){
  if(!s||typeof s.id!=='string'||seen.has(s.id))throw Error('Segments incomplets');
  seen.add(s.id);
  const owner=Array.isArray(s.punch_sessions)?s.punch_sessions[0]?.user_id:s.punch_sessions?.user_id;
  if(!people.has(owner)||!jobs.has(s.job_id))continue;
  const x=Date.parse(s.started_at),y=s.ended_at?Date.parse(s.ended_at):now;
  if(!Number.isFinite(x)||!Number.isFinite(y)||y<x)throw Error('Segment invalide');
  const length=Math.max(0,Math.min(now,b,y)-Math.max(a,x));
  if(length>0){milliseconds+=length;count++}
 }
 return {milliseconds,count};
}
