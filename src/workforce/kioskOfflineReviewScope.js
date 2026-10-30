// Ephemeral Expo review guards; Supabase RPC remains the only authority for punch mutations.
export const kioskReviewIdentity=account=>JSON.stringify([
 String(account?.companyId||''),String(account?.userId||''),String(account?.role||''),String(account?.edition||'')
]);
export const canReviewKioskOffline=account=>account?.role==='boss'||account?.role==='admin';
export function createKioskOfflineScope(account){
 let identity=kioskReviewIdentity(account),revision=0;
 return {
  matches:a=>identity===kioskReviewIdentity(a),
  current:()=>({identity,revision}),
  enter(a){identity=kioskReviewIdentity(a);revision++;return {identity,revision}},
  invalidate(){revision++},
  allows:token=>Boolean(token&&token.identity===identity&&token.revision===revision)
 };
}
export function kioskReviewRows(value){
 if(!Array.isArray(value)||value.length>100||value.some(row=>
  !row||typeof row.id!=='string'||!Array.isArray(row.events)))throw Error('Incomplete kiosk review data');
 return value;
}
export function isPendingKioskLot(row,rows){
 return Boolean(row?.id&&!row.closed_at&&row.events?.some(e=>e?.state==='pending')&&
  rows.some(r=>r.id===row.id&&!r.closed_at&&r.events?.some(e=>e?.state==='pending')));
}
export function validKioskReviewNote(note){
 return typeof note==='string'&&note.trim().length>=3&&note.trim().length<=1000;
}
export function canConfirmKioskLot(pending,note,rows,account){
 return canReviewKioskOffline(account)&&Boolean(pending&&typeof pending.id==='string'&&
  typeof pending.approve==='boolean'&&validKioskReviewNote(note)&&
  pending.note===note.trim()&&isPendingKioskLot(rows.find(r=>r.id===pending.id),rows));
}
