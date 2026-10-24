// Persist the request identifier before a financial ledger mutation, without
// persisting wages, amounts or reasons in the browser's preference storage.
export async function durableLedgerRequest({storage,key,payload,uuid,digest,send}){
 const hash=await digest(JSON.stringify(payload));const raw=await storage.get(key);let pending=raw?JSON.parse(raw):null;
 if(pending&&pending.hash!==hash)throw Error('Une opération précédente reste non confirmée. Rétablissez ses valeurs et réessayez avant de créer un autre mouvement.');
 if(!pending){pending={id:uuid(),hash};await storage.set(key,JSON.stringify(pending));}
 const result=await send({...payload,p_request:pending.id});await storage.remove(key);return result;
}
