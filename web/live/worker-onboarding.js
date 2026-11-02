/** Worker invitation activation is an untrusted request until BOTH the server
 * accepts the token and an authenticated membership + worker record are read.
 * Never infer an entitlement from the URL or a tab receipt.
 */
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tokenPattern=/^[0-9a-f]{64}$/i;
export function validWorkerInviteToken(value){
 return typeof value==='string'&&tokenPattern.test(value);
}
export async function acceptWorkerInviteOnce(rpc,token){
 if(!validWorkerInviteToken(token))throw Error('Lien d’activation invalide. Demandez une nouvelle invitation.');
 const result=await rpc('accept_worker_invitation',{p_token:token});
 if(result?.error)throw result.error;
 if(!result||!Object.hasOwn(result,'data'))throw Error('Réponse d’activation absente; vérifiez votre accès.');
 return {accepted:true,companyId:typeof result.data==='string'&&uuid.test(result.data)?result.data:null};
}
const KEY='punch-worker-activation-pending-v1';
const safePreviousIds=ids=>Array.isArray(ids)&&ids.length<=100&&ids.every(x=>typeof x==='string'&&uuid.test(x))?[...new Set(ids)]:null;
export function savePendingWorkerActivation(storage,userId,companyId,previousIds=[]){
 if(typeof userId!=='string'||!uuid.test(userId))return false;
 const safe=safePreviousIds(previousIds);
 if(!safe)return false;
 try{storage.setItem(KEY,JSON.stringify({userId,companyId:typeof companyId==='string'&&uuid.test(companyId)?companyId:null,previousIds:safe}));return true}catch{return false}
}
export function readPendingWorkerActivation(storage,userId){
 if(typeof userId!=='string'||!uuid.test(userId))return null;
 try{
  const x=JSON.parse(storage.getItem(KEY)||'null'),previousIds=safePreviousIds(x?.previousIds);
  return x?.userId===userId&&previousIds&&(x.companyId===null||(typeof x.companyId==='string'&&uuid.test(x.companyId)))
   ?{companyId:x.companyId,previousIds}:null;
 }catch{return null}
}
export function clearPendingWorkerActivation(storage){
 try{storage.removeItem(KEY);return true}catch{return false}
}
export function recoverWorkerActivation(pending,userId,workspaces){
 if(!pending||pending.companyId!==null||!Array.isArray(workspaces))return null;
 const old=safePreviousIds(pending.previousIds);
 if(!old||typeof userId!=='string'||!uuid.test(userId))return null;
 const seen=new Set(old);
 const newWorkspaces=workspaces.filter(w=>w?.userId===userId&&w.edition==='essential'&&
  typeof w.companyId==='string'&&uuid.test(w.companyId)&&!seen.has(w.companyId));
 return newWorkspaces.length===1?newWorkspaces[0]:null;
}
export function isWorkerActivationVerified(companyId,userId,account,workspaces,worker){
 return typeof companyId==='string'&&uuid.test(companyId)&&typeof userId==='string'&&uuid.test(userId)&&
  account?.company_id===companyId&&Array.isArray(workspaces)&&
  workspaces.some(w=>w?.companyId===companyId&&w.userId===userId&&w.edition==='essential')&&
  worker?.company_id===companyId&&worker.auth_user_id===userId&&worker.status==='active'&&
  worker.personal_access===true;
}
