/**
 * Public company onboarding boundary. A successful create_company_for_edition
 * RPC creates exactly one server-side company and returns its UUID. Loading the
 * newly created workspace is a SEPARATE, fallible read-only operation.
 * Never retry the create RPC as a substitute for failed workspace discovery.
 */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validCreatedCompanyId(value){
 return typeof value==='string'&&uuid.test(value);
}
export async function createCompanyOnce(rpc,name,edition){
 const normalized=typeof name==='string'?name.trim():'';
 if(normalized.length<2)throw Error('Entre le nom de ton entreprise (au moins 2 caractères).');
 if(!['essential','construction'].includes(edition))throw Error('Édition de compagnie invalide.');
 const result=await rpc('create_company_for_edition',{p_name:normalized,p_edition:edition});
 if(result?.error)throw result.error;
 if(!result||!Object.hasOwn(result,'data'))throw Error('Réponse du serveur absente; statut de création à vérifier.');
 // Once the server acknowledges success, even an unexpected response shape
 // must never send the user back to a creation button.
 return {accepted:true,companyId:validCreatedCompanyId(result?.data)?result.data:null};
}
export function isCreatedCompanyVerified(companyId,userId,account,verifiedWorkspaces){
 return validCreatedCompanyId(companyId)&&typeof userId==='string'&&
  account?.company_id===companyId&&
  Array.isArray(verifiedWorkspaces)&&verifiedWorkspaces.some(workspace=>
   workspace?.companyId===companyId&&workspace.userId===userId);
}

const KEY='punch-company-creation-pending-v1';
// Session-scoped recovery is a UX flag only: a stored UUID never grants rights.
export function savePendingCompanyCreation(storage,userId,companyId){
 if(!validCreatedCompanyId(userId))return false;
 try{storage.setItem(KEY,JSON.stringify({userId,companyId:validCreatedCompanyId(companyId)?companyId:null}));return true}
 catch{return false}
}
export function readPendingCompanyCreation(storage,userId){
 if(!validCreatedCompanyId(userId))return null;
 try{const raw=JSON.parse(storage.getItem(KEY)||'null');
  return raw?.userId===userId&&
   (raw.companyId===null||validCreatedCompanyId(raw.companyId))
   ?{companyId:raw.companyId}:null;
 }catch{return null}
}
export function clearPendingCompanyCreation(storage){
 try{storage.removeItem(KEY);return true}catch{return false}
}
