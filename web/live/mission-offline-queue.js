// MISSION-010 partial: opt-in offline completion of already displayed, no-proof missions.
// Only UUIDs, a mission day and numeric versions are stored; never cache addresses,
// client names, evidence, credentials, GPS or worker hours. Server is authoritative.
import {missionCompletionRequestKey,reserveMissionCompletionRequest,acknowledgeMissionCompletionRequest} from './mission-completion-request.js';
const ID=/^[a-zA-Z0-9_-]{1,80}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const LIMIT=25, MAX_AGE=30*86400000;
function contextPrefix({user,company,worker}) {
 if(![user,company,worker].every(x=>typeof x==='string'&&ID.test(x)))
  throw Error('Contexte de mission invalide. Reconnectez-vous.');
 return 'punch-mission-completion-request-v1:'+user+':'+company+':'+worker+':';
}
export function missionOfflineEligible({commentRequired=false,checklistRequired=false,photoRequired=false,photoSelected=false,truncated=false,ambiguous=false,mission=null,enabled=false,verified=false}={}) {
 return !!(verified&&enabled&&!truncated&&!ambiguous&&!commentRequired&&!checklistRequired&&!photoRequired&&!photoSelected&&mission&&
  ['published','in_progress'].includes(mission.status)&&Number.isSafeInteger(mission.version)&&mission.version>0);
}
function parseQueue(raw,time) {
 let x;try{x=JSON.parse(raw)}catch{throw Error('File de mission illisible : aucune synchronisation possible.');}
 const invalid=!x?'format':!UUID.test(String(x.id||''))?'identifiant':
  !Number.isSafeInteger(x.createdAt)?'horodatage initial':
  !Number.isSafeInteger(x.queuedAt)?'horodatage en attente':
  !DAY.test(String(x.day||''))?'jour':
  x.createdAt>time+300000||x.queuedAt>time+300000?'horloge en avance':
  time-x.createdAt>MAX_AGE||time-x.queuedAt>MAX_AGE?'expirée':null;
 if(invalid)throw Error('Demande en attente invalide ou expirée ('+invalid+') : vérification manuelle nécessaire.');
 const keys=Object.keys(x).sort().join(',');
 if(keys!=='createdAt,day,id,queuedAt')throw Error('Format de demande en attente non autorisé.');
 return x;
}
export async function queueOfflineMissionCompletion({storage,identity,day,uuid,now=Date.now}) {
 if(!DAY.test(String(day||'')))throw Error('Journée de mission invalide.');
 if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')
  throw Error('Stockage local indisponible.');
 const req=await reserveMissionCompletionRequest({storage,identity,uuid,now});
 const time=now(),raw=await storage.getItem(req.key);
 let existing;try{existing=JSON.parse(raw)}catch{throw Error('Demande locale illisible.');}
 if(!existing||existing.id!==req.id||!Number.isSafeInteger(existing.createdAt))
  throw Error('Identifiant de fin non récupérable.');
 if(existing.queuedAt!==undefined){
  const previous=parseQueue(raw,time);
  if(previous.day!==day)throw Error('Date déjà mise en attente différente : vérification requise.');
  return {...req,day,queued:true};
 }
 const value=JSON.stringify({id:req.id,createdAt:existing.createdAt,queuedAt:time,day});
 await storage.setItem(req.key,value);
 const checked=await storage.getItem(req.key);
 if(!checked||parseQueue(checked,time).id!==req.id)
  throw Error('File locale non confirmée; aucune fin enregistrée.');
 return {...req,day,queued:true};
}
export async function listOfflineMissionCompletions({storage,identity,now=Date.now}) {
 if(!storage||typeof storage.getAllKeys!=='function'||typeof storage.getItem!=='function')
  throw Error('Inventaire de la file indisponible.');
 const prefix=contextPrefix(identity);
 const all=await storage.getAllKeys();
 if(!Array.isArray(all))throw Error('Inventaire local invalide.');
 const relevant=all.filter(k=>typeof k==='string'&&k.startsWith(prefix));
 if(relevant.length>LIMIT)throw Error('Trop de demandes locales : assistance requise.');
 const results=[];
 for(const key of relevant){
  const rest=key.slice(prefix.length).split(':');
  if(rest.length!==2||!ID.test(rest[0])||!/^[1-9]\d*$/.test(rest[1])||
     !Number.isSafeInteger(Number(rest[1])))throw Error('Clé de mission locale invalide.');
  const raw=await storage.getItem(key);
  if(raw==null)continue;
  let entry;try{entry=JSON.parse(raw)}catch{throw Error('File de mission locale illisible.');}
  if(entry?.queuedAt===undefined)continue; // ordinary online idempotency records
  const q=parseQueue(raw,now());
  results.push({key,id:q.id,day:q.day,mission:rest[0],version:Number(rest[1]),queuedAt:q.queuedAt});
 }
 return results.sort((a,b)=>a.queuedAt-b.queuedAt||a.key.localeCompare(b.key));
}
export async function syncOfflineMissionCompletions({storage,identity,verifyUser,fetchDay,nextMissionId,send,now=Date.now}) {
 if(typeof verifyUser!=='function'||typeof fetchDay!=='function'||
    typeof nextMissionId!=='function'||typeof send!=='function')
  throw Error('Vérifications de synchronisation manquantes.');
 const verified=await verifyUser();
 if(verified!==identity.user)throw Error('Session différente ou révoquée : aucune synchronisation.');
 const queued=await listOfflineMissionCompletions({storage,identity,now});
 let sent=0;const conflicts=[];let networkError=null;
 for(const entry of queued){
  try{
   // Fresh server-authorized list on EVERY replay: never trust the offline snapshot.
   const latest=await fetchDay(entry.day);
   const items=Array.isArray(latest?.items)?latest.items:[];
   const row=items.find(x=>x.id===entry.mission);
   if(!latest?.enabled||latest.truncated||latest.comment_required||latest.checklist_required||
      latest.photo_required||!row||row.worker_id!==identity.worker||
      row.version!==entry.version||!['published','in_progress'].includes(row.status)||
      nextMissionId(items)!==entry.mission){
    conflicts.push({mission:entry.mission,reason:'Version, attribution, ordre, preuve ou autorisation modifié(e)'});
    continue;
   }
   const data=await send({mission:entry.mission,version:entry.version,request:entry.id,day:entry.day});
   if(data?.status!=='completed')throw Error('Accusé serveur invalide');
   await acknowledgeMissionCompletionRequest(storage,{key:entry.key,id:entry.id},now);
   sent++;
  }catch(error){
   networkError='Synchronisation interrompue ou refusée; demande conservée : '+String(error?.message||error).slice(0,120);
   break;
  }
 }
 const pending=await listOfflineMissionCompletions({storage,identity,now});
 return {sent,pending:pending.length,conflicts,networkError};
}
