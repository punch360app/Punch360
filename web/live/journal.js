// Shared by Expo and Web. Every event is persisted BEFORE the first network request.
export class PunchJournal {
 constructor({storage,send,uuid,company,user,withLock}){this.storage=storage;this.send=send;this.uuid=uuid;this.company=company;this.user=user;this.key=`punch-journal-v1:${user}:${company}`;this.withLock=withLock||((fn)=>fn());this.serial=Promise.resolve();this.flushing=null;}
 async read(){const raw=await this.storage.get(this.key);if(!raw)return [];const events=JSON.parse(raw);if(!Array.isArray(events))throw Error('Journal local illisible : conservation des données pour récupération');return events;}
 exclusive(fn){const task=this.serial.then(()=>this.withLock(fn));this.serial=task.catch(()=>{});return task;}
 async append(action,job,fix,occurredAt=new Date().toISOString()){
  return this.exclusive(async()=>{const queue=await this.read();const event={id:this.uuid(),company:this.company,user:this.user,action,job:job||null,fix:fix||null,occurredAt,offline:queue.some(e=>e.status==='pending'),status:'pending',previous:queue.at(-1)?.id||null};queue.push(event);await this.storage.set(this.key,JSON.stringify(queue));return event;});
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
export function projectPendingPunches(snapshot,events){
 const sessions=snapshot.sessions.map(s=>({...s})),segments=snapshot.segments.map(s=>({...s})),breaks=(snapshot.breaks||[]).map(s=>({...s}));
 for(const event of events.filter(e=>e.status==='pending')){
  const active=sessions.find(s=>!s.ended_at);
  if(event.action==='in'&&!active){const id='local-'+event.id;sessions.unshift({id,company_id:event.company,user_id:event.user,started_at:event.occurredAt,ended_at:null});segments.unshift({id,company_id:event.company,session_id:id,job_id:event.job,started_at:event.occurredAt,ended_at:null});}
  if(event.action==='break_start'&&active)breaks.unshift({id:'local-'+event.id,company_id:event.company,user_id:event.user,session_id:active.id,started_at:event.occurredAt,ended_at:null});
  if(event.action==='break_end'&&active)for(const pause of breaks)if(pause.session_id===active.id&&!pause.ended_at)pause.ended_at=event.occurredAt;
  if(event.action==='out'&&active){for(const pause of breaks)if(pause.session_id===active.id&&!pause.ended_at)pause.ended_at=event.occurredAt;active.ended_at=event.occurredAt;for(const seg of segments)if(seg.session_id===active.id&&!seg.ended_at)seg.ended_at=event.occurredAt;}
  if(event.action==='transfer'&&active){for(const seg of segments)if(seg.session_id===active.id&&!seg.ended_at)seg.ended_at=event.occurredAt;segments.unshift({id:'local-'+event.id,company_id:event.company,session_id:active.id,job_id:event.job,started_at:event.occurredAt,ended_at:null});}
 }
 return {sessions,segments,breaks,active:sessions.find(s=>!s.ended_at)||null,lastJobId:segments[0]?.job_id||null};
}
