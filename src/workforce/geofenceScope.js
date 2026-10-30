// Client-side render and async scope only; server RLS and RPCs remain authoritative.
export const geofenceIdentity=account=>JSON.stringify([
 String(account?.companyId||''),String(account?.userId||''),String(account?.role||''),String(account?.edition||'')
]);
export function createGeofenceScope(account){
 let identity=geofenceIdentity(account),revision=0;
 return {
  matches:account=>identity===geofenceIdentity(account),
  current:()=>({identity,revision}),
  enter(account){identity=geofenceIdentity(account);revision++;return {identity,revision}},
  invalidate(){revision++},
  allows:token=>Boolean(token&&token.identity===identity&&token.revision===revision)
 };
}
export const canAdministerGeofence=account=>account?.role==='boss'||account?.role==='admin';
export function geofenceJobAllowed(job,jobs){
 return Boolean(job&&jobs.some(j=>j.id===job));
}
export function canReviewLocation(check,account,checks){
 return canAdministerGeofence(account)&&Boolean(check?.id&&check.company_id===account.companyId&&check.review_status==='pending'&&check.user_id!==account.userId&&checks.some(c=>c.id===check.id));
}
export function canReviewOfflineBreak(receipt,account,receipts){
 return canAdministerGeofence(account)&&Boolean(receipt?.event_id&&receipt.company_id===account.companyId&&receipt.user_id!==account.userId&&
 ['break_start','break_end'].includes(receipt.action)&&receipt.result?.review_status==='pending'&&receipt.result?.sync_status==='synced'&&
 receipts.some(r=>r.event_id===receipt.event_id&&r.user_id===receipt.user_id));
}
export function canReadNotification(notification,account,notifications){
 return Boolean(notification?.id&&notification.company_id===account?.companyId&&notification.recipient_id===account?.userId&&
 notifications.some(n=>n.id===notification.id));
}
export function geofenceRadiusPayload(lat,lon,radius){
 // Both coordinates may be absent to disable a configured location, but never partial.
 const emptyLat=String(lat).trim()==='',emptyLon=String(lon).trim()==='';
 if(emptyLat!==emptyLon)throw Error('Deux coordonnées nécessaires');
 const latitude=emptyLat?null:Number(lat),longitude=emptyLon?null:Number(lon),r=Number(radius);
 if(!Number.isInteger(r)||r<10||r>10000||
 (!emptyLat&&(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude<-90||latitude>90||longitude<-180||longitude>180)))throw Error('Coordonnées/rayon invalides');
 return {latitude,longitude,punch_radius_m:r};
}
export function geofenceReviewPayload(note,start,end,correct){
 const reason=String(note||'').trim();
 if(reason.length<3||reason.length>1000)throw Error('Motif requis (3 à 1000 caractères)');
 if(!correct)return {p_note:reason,p_start:null,p_end:null};
 const parse=value=>{
  if(!value)return null;
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value))throw Error('Date complète avec fuseau requise');
  const ms=Date.parse(value);if(!Number.isFinite(ms))throw Error('Date invalide');
  return new Date(ms).toISOString();
 };
 const p_start=parse(start),p_end=parse(end);
 if(!p_start&&!p_end)throw Error('Une heure corrigée au minimum');
 if(p_start&&p_end&&p_end<=p_start)throw Error('Sortie après entrée requise');
 return {p_note:reason,p_start,p_end};
}
