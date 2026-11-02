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
const editions=new Set(['essential','construction']);
function safePreviousIds(ids){
 return Array.isArray(ids)&&ids.length<=100&&ids.every(validCreatedCompanyId)
  ?[...new Set(ids)]:null;
}
function safeContext(value){
 const previousIds=safePreviousIds(value?.previousIds);
 return previousIds&&editions.has(value?.edition)
  ?{previousIds,edition:value.edition}:{};
}
// Session-scoped recovery is an untrusted hint only; it never grants access.
export function savePendingCompanyCreation(storage,userId,companyId,context={}){
 if(!validCreatedCompanyId(userId))return false;
 try{storage.setItem(KEY,JSON.stringify({
  userId,companyId:validCreatedCompanyId(companyId)?companyId:null,
  ...safeContext(context)
 }));return true}catch{return false}
}
export function readPendingCompanyCreation(storage,userId){
 if(!validCreatedCompanyId(userId))return null;
 try{
  const raw=JSON.parse(storage.getItem(KEY)||'null');
  if(raw?.userId!==userId||
   !(raw.companyId===null||validCreatedCompanyId(raw.companyId)))return null;
  return {companyId:raw.companyId,...safeContext(raw)};
 }catch{return null}
}
export function clearPendingCompanyCreation(storage){
 try{storage.removeItem(KEY);return true}catch{return false}
}
/** Recovery is permitted only if EXACTLY ONE newly visible, active,
 * RLS-verified boss workspace matches the requested edition. Neither a
 * browser receipt nor a guessed company ID may authorize a membership.
 */
export function recoverCreatedCompanyWorkspace(pending,userId,verifiedWorkspaces){
 if(!pending||pending.companyId!==null||!validCreatedCompanyId(userId)||
  !Array.isArray(verifiedWorkspaces))return null;
 const previousIds=safePreviousIds(pending.previousIds);
 if(!previousIds||!editions.has(pending.edition))return null;
 const known=new Set(previousIds);
 const newlyVerified=verifiedWorkspaces.filter(w=>w?.userId===userId&&
  validCreatedCompanyId(w.companyId)&&!known.has(w.companyId)&&
  w.role==='boss'&&w.edition===pending.edition);
 return newlyVerified.length===1?newlyVerified[0]:null;
}
