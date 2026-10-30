// Ephemeral UI safeguards. Supabase policies and RPCs remain authoritative.
export const communicationIdentity=a=>JSON.stringify([
 String(a?.companyId||''),String(a?.userId||''),String(a?.role||''),String(a?.edition||'')
]);
export function createCommunicationsScope(account){
 let identity=communicationIdentity(account),revision=0;
 return {
  matches:a=>identity===communicationIdentity(a),
  current:()=>({identity,revision}),
  enter(a){identity=communicationIdentity(a);revision++;return {identity,revision}},
  invalidate(){revision++},
  allows:token=>Boolean(token&&token.identity===identity&&token.revision===revision)
 };
}
export const canPublishCommunication=(a,features)=>a?.edition==='essential'&&
 ['boss','admin'].includes(a?.role)&&features?.includes('announcements')===true;
export const canWriteShiftNote=(a,features)=>a?.edition==='essential'&&features?.includes('hr_documents')===true;
export function communicationRows(data,company,limit=500){
 if(!Array.isArray(data)||data.length>limit||data.some(x=>!x||typeof x.id!=='string'||
  x.company_id!==company))throw Error('Liste incomplète');
 return data;
}
export function announcementReceiptRows(data,user,ids,limit=500){
 if(!Array.isArray(data)||data.length>limit||data.some(x=>!x||x.user_id!==user||!ids.includes(x.announcement_id)))
  throw Error('Reçus incomplets');
 return data;
}
export function validCommunicationPublication(title,body,department,departments){
 if(typeof title!=='string'||title.trim().length<2||title.trim().length>140||
  typeof body!=='string'||body.trim().length<1||body.trim().length>5000)throw Error('Titre ou message invalide');
 if(department&&!departments.some(d=>d.id===department&&d.active))throw Error('Département indisponible');
 return {title:title.trim(),body:body.trim(),department:department||null};
}
export function validCommunicationNote(value){
 if(typeof value!=='string'||value.trim().length<1||value.trim().length>3000)throw Error('Note de 1 à 3000 caractères requise');
 return value.trim();
}
export function canAcknowledgeAnnouncement(row,a,announcements,receipts){
 return Boolean(row?.id&&row.company_id===a?.companyId&&!row.withdrawn_at&&
  (!row.expires_at||Date.parse(row.expires_at)>Date.now())&&
  announcements.some(x=>x.id===row.id)&&
  !receipts.some(r=>r.announcement_id===row.id&&r.user_id===a.userId));
}
export function canWithdrawAnnouncement(row,a,features,announcements){
 return canPublishCommunication(a,features)&&Boolean(row?.id&&row.company_id===a.companyId&&
  !row.withdrawn_at&&announcements.some(x=>x.id===row.id));
}
