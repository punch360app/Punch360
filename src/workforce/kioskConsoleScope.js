// UI-side only. Supabase RPC permissions remain the source of authority.
export const kioskConsoleIdentity=account=>JSON.stringify([
 String(account?.companyId||''),String(account?.userId||''),
 String(account?.role||''),String(account?.edition||'')
]);
export function createKioskConsoleScope(account){
 let identity=kioskConsoleIdentity(account),revision=0;
 return {
  matches:account=>identity===kioskConsoleIdentity(account),
  current:()=>({identity,revision}),
  enter(account){identity=kioskConsoleIdentity(account);revision++;return {identity,revision}},
  invalidate(){revision++},
  allows:token=>Boolean(token&&token.identity===identity&&token.revision===revision)
 };
}
export const mayManageKiosks=account=>account?.edition==='essential'&&
 ['boss','admin'].includes(account?.role);
export const maySetWorkerChannels=account=>mayManageKiosks(account)&&account.role==='boss';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const idsValid=rows=>rows.every(row=>row&&typeof row.id==='string'&&uuid.test(row.id))&&
 new Set(rows.map(row=>row.id)).size===rows.length;
export function validKioskDevices(rows,limit=100){
 // The list_kiosk_devices RPC is already company-filtered; its JSON omits company_id.
 if(!Array.isArray(rows)||rows.length>limit||!idsValid(rows)||
 rows.some(row=>typeof row.name!=='string'||!row.name.trim()||
 (row.idle_seconds!=null&&![5,10,15,30,60].includes(row.idle_seconds))))
 throw Error('Liste de bornes indisponible');
 return rows;
}
export function validKioskLocations(rows,company,limit=250){
 if(!Array.isArray(rows)||rows.length>limit||!idsValid(rows)||
 rows.some(row=>row.company_id!==company||typeof row.name!=='string'))
 throw Error('Établissements indisponibles');
 return rows;
}
export function validKioskWorkers(rows,company,limit=500){
 if(!Array.isArray(rows)||rows.length>limit||!idsValid(rows)||
 rows.some(row=>row.company_id!==company||typeof row.status!=='string'||
 typeof row.can_kiosk_punch!=='boolean'||typeof row.can_mobile_punch!=='boolean'))
 throw Error('Liste de salariés indisponible');
 return rows;
}
export function validPairingInput(location,name,locations){
 if(!locations.some(l=>l.id===location&&l.active===true)||
 typeof name!=='string'||name.trim().length<2||name.trim().length>100)
 throw Error('Nom ou établissement invalide');
 return {location,name:name.trim()};
}
export function canAlterKiosk(device,devices,account){
 return mayManageKiosks(account)&&Boolean(device?.id&&!device.revoked_at&&
 devices.some(d=>d.id===device.id&&!d.revoked_at));
}
export function canAlterKioskWorker(worker,workers,account){
 return maySetWorkerChannels(account)&&Boolean(worker?.id&&worker.company_id===account.companyId&&worker.status==='active'&&
 workers.some(w=>w.id===worker.id&&w.status==='active'&&w.company_id===account.companyId));
}
export function canEnrollKioskPin(worker,workers,account){
 return mayManageKiosks(account)&&Boolean(worker?.id&&worker.company_id===account.companyId&&worker.status==='active'&&
 worker.can_kiosk_punch===true&&worker.role!=='admin'&&
 workers.some(w=>w.id===worker.id&&w.status==='active'&&w.company_id===account.companyId&&w.can_kiosk_punch===true));
}
export const kioskIdleOptions=[5,10,15,30,60];
export function validKioskSecret(secret){
 if(typeof secret!=='string'||!secret.trim()||secret.length>250)throw Error('Code non disponible');
 return secret;
}
