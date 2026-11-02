// Shared by Expo and Web. Every event is persisted BEFORE the first network request.
export class PunchJournal {
 constructor({storage,send,uuid,company,user,withLock}){this.storage=storage;this.send=send;this.uuid=uuid;this.company=company;this.user=user;this.key=`punch-journal-v1:${user}:${company}`;this.withLock=withLock||((fn)=>fn());this.serial=Promise.resolve();this.flushing=null;}
 async read(){const raw=await this.storage.get(this.key);if(!raw)return [];const events=JSON.parse(raw);if(!Array.isArray(events))throw Error('Journal local illisible : conservation des données pour récupération');return events;}
 exclusive(fn){const task=this.serial.then(()=>this.withLock(fn));this.serial=task.catch(()=>{});return task;}
 async append(action,job,fix,occurredAt=new Date().toISOString(),paid=false,offline=false){
  return this.exclusive(async()=>{const queue=await this.read();const event={id:this.uuid(),company:this.company,user:this.user,action,job:job||null,fix:fix||null,occurredAt,...(paid?{paid:true}:{}),offline:offline===true||queue.some(e=>e.status==='pending'),status:'pending',previous:queue.at(-1)?.id||null};queue.push(event);await this.storage.set(this.key,JSON.stringify(queue));return event;});
 }
 async flush(){
  if(this.flushing)return this.flushing;
  this.flushing=this.exclusive(async()=>{const queue=await this.read();let sent=0;for(const event of queue){if(event.status!=='pending')continue;
   try{const result=await this.send(event);if(!['synced','conflict'].includes(result?.sync_status))throw Error('Accusé serveur invalide');event.status=result.sync_status;event.result=result;sent++;await this.storage.set(this.key,JSON.stringify(queue));
    // Server records dependent conflicts without applying them to official time.
   }catch(err){event.offline=true;event.error=String(err?.message||err);await this.storage.set(this.key,JSON.stringify(queue));break;}
  }return {sent,events:queue,pending:queue.filter(e=>e.status==='pending').length};}).finally(()=>{this.flushing=null});return this.flushing;
 }
 async pending(){return (await this.read()).filter(e=>e.status==='pending');}
}
export function projectPendingPunches(snapshot,events,scope=null){
 const identity=typeof scope?.company==='string'&&scope.company&&
  typeof scope?.user==='string'&&scope.user?scope:null;
 const sessions=snapshot.sessions.map(s=>({...s})),segments=snapshot.segments.map(s=>({...s})),breaks=(snapshot.breaks||[]).map(s=>({...s}));
 for(const event of events.filter(e=>e.status==='pending'&&(!identity||
  e.company===identity.company&&e.user===identity.user))){
  // A stale or contaminated snapshot must never let one employee's
  // offline event edit a different employee/company session.
  const active=sessions.find(s=>!s.ended_at&&
   (s.company_id==null||s.company_id===event.company)&&
   (s.user_id==null||s.user_id===event.user));
  const ownsRecord=record=>record?.session_id===active?.id&&
   (record.company_id==null||record.company_id===event.company)&&
   (record.user_id==null||record.user_id===event.user);
  if(event.action==='in'&&!active){const id='local-'+event.id;sessions.unshift({id,company_id:event.company,user_id:event.user,started_at:event.occurredAt,ended_at:null});segments.unshift({id,company_id:event.company,session_id:id,job_id:event.job,started_at:event.occurredAt,ended_at:null});}
  if(event.action==='break_start'&&active)breaks.unshift({id:'local-'+event.id,company_id:event.company,user_id:event.user,session_id:active.id,started_at:event.occurredAt,ended_at:null,is_paid:event.paid===true});
  if(event.action==='break_end'&&active)for(const pause of breaks)if(ownsRecord(pause)&&!pause.ended_at)pause.ended_at=event.occurredAt;
  if(event.action==='out'&&active){for(const pause of breaks)if(ownsRecord(pause)&&!pause.ended_at)pause.ended_at=event.occurredAt;active.ended_at=event.occurredAt;for(const seg of segments)if(ownsRecord(seg)&&!seg.ended_at)seg.ended_at=event.occurredAt;}
  if(event.action==='transfer'&&active){for(const seg of segments)if(ownsRecord(seg)&&!seg.ended_at)seg.ended_at=event.occurredAt;segments.unshift({id:'local-'+event.id,company_id:event.company,session_id:active.id,job_id:event.job,started_at:event.occurredAt,ended_at:null});}
 }
 const pending=events.filter(e=>e.status==='pending'&&(!identity||
  e.company===identity.company&&e.user===identity.user)),latest=pending.at(-1);
 const owner=identity||latest&&{company:latest.company,user:latest.user};
 const active=sessions.find(s=>!s.ended_at&&(!owner||
  (s.company_id==null&&!identity||s.company_id===owner.company)&&
  (s.user_id==null&&!identity||s.user_id===owner.user)))||null;
 // A pending local event supplies the identity for the last selected job.
 // Do not display or reuse another tenant's job from a mixed old cache.
 const ownSessionIds=owner?new Set(sessions.filter(s=>
  s.company_id===owner.company&&s.user_id===owner.user).map(s=>s.id)):null;
 const lastSegment=owner?segments.find(s=>
  s.company_id===owner.company&&ownSessionIds.has(s.session_id)):segments[0];
 return {sessions,segments,breaks,active,lastJobId:lastSegment?.job_id||null};
}
