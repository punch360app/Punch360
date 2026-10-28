// MISSION-010 (partial): retain only an opaque idempotency request ID across restarts.
// This is NOT an offline completion queue. No photos, notes, GPS, client details or
// mission payloads are stored. The server remains authoritative for permissions.
const VALID_PART=/^[a-zA-Z0-9_-]{1,80}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AGE=30*24*60*60*1000;
export function missionCompletionRequestKey({user,company,worker,mission,version}){
  for(const value of [user,company,worker,mission]){
    if(typeof value!=='string'||!VALID_PART.test(value))
      throw Error('Identité de mission absente ou invalide; réauthentifiez-vous.');
  }
  if(!Number.isSafeInteger(version)||version<1)
    throw Error('Version de mission invalide : actualisez les missions.');
  return ['punch-mission-completion-request-v1',user,company,worker,mission,String(version)].join(':');
}
function readSaved(raw,now){
  let entry;
  try{entry=JSON.parse(raw)}catch{throw Error('Reprise locale illisible : aucune nouvelle fin envoyée.');}
  if(!entry||!UUID.test(entry.id)||!Number.isSafeInteger(entry.createdAt)||
     entry.createdAt>now+5*60*1000||now-entry.createdAt>MAX_AGE)
    throw Error('Reprise locale expirée ou invalide : vérification manuelle requise, aucune fin envoyée.');
  return entry;
}
export async function reserveMissionCompletionRequest({storage,identity,uuid,now=Date.now}){
  if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function'||
     typeof uuid!=='function')throw Error('Conservation anti-doublon indisponible.');
  const key=missionCompletionRequestKey(identity);
  // Storage failures are deliberately NOT ignored: do not emit an uncertain
  // completion with a fresh request ID when durability cannot be guaranteed.
  const time=now(),existing=await storage.getItem(key);
  if(existing!==null && existing!==undefined)
    return {key,id:readSaved(existing,time).id,reused:true};
  const id=uuid();
  if(typeof id!=='string'||!UUID.test(id))throw Error('Identifiant de demande invalide.');
  await storage.setItem(key,JSON.stringify({id,createdAt:time}));
  // Verify the write before calling the server (storage may silently fail).
  const stored=await storage.getItem(key);
  if(!stored||readSaved(stored,time).id!==id)
    throw Error('Conservation anti-doublon non confirmée : fin non envoyée.');
  return {key,id,reused:false};
}
export async function acknowledgeMissionCompletionRequest(storage,{key,id},now=Date.now){
  if(!storage||typeof storage.getItem!=='function'||typeof storage.removeItem!=='function')
    throw Error('Conservation anti-doublon indisponible.');
  const raw=await storage.getItem(key);
  if(raw===null||raw===undefined)return false;
  const existing=readSaved(raw,now());
  if(existing.id!==id)throw Error('Demande locale modifiée : aucune purge autorisée.');
  await storage.removeItem(key);
  return true;
}
