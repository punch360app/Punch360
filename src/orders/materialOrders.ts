import * as Network from 'expo-network';
import {getLocalIdentity} from '../auth/localIdentity';
import {supabase} from '../lib/supabase';
import type {Job} from '../jobs/catalog';

/** Validate a draft against the actual identity-scoped list of jobs. */
export function validatedMaterialOrderDraft(
 companyId:string,userId:string,jobId:string,note:string,jobs:readonly Job[]
){
 if(typeof companyId!=='string'||!companyId.trim()||
    typeof userId!=='string'||!userId.trim())
  throw Error('Entreprise ou compte indisponible : commande non envoyée.');
 if(typeof jobId!=='string'||!jobId.trim()||
    !Array.isArray(jobs)||!jobs.some(job=>job?.id===jobId&&
      job.company_id===companyId&&job.company_id!=='demo'))
  throw Error('Sélectionne un chantier actif de cette entreprise.');
 const description=typeof note==='string'?note.trim():'';
 if(!description)throw Error('Décris le matériel et les quantités demandés.');
 if(description.length>4000)
  throw Error('Description trop longue (maximum 4 000 caractères).');
 return {company_id:companyId,job_id:jobId,created_by:userId,note:description};
}

const pendingMaterialOrders=new Set<string>();

/** A request is intentionally not queued or retried after an uncertain response:
 * a non-idempotent insert may already have succeeded upstream.
 */
export async function submitMaterialOrder(input:{
 companyId:string;userId:string;jobId:string;note:string;jobs:readonly Job[];
}):Promise<string>{
 const draft=validatedMaterialOrderDraft(
  input.companyId,input.userId,input.jobId,input.note,input.jobs);
 const scope=draft.company_id+':'+draft.created_by;
 if(pendingMaterialOrders.has(scope))
  throw Error('Commande déjà en cours : attendez la confirmation.');
 pendingMaterialOrders.add(scope);
 try{
  let online=false;
  try{const network=await Network.getNetworkStateAsync();
   online=network.isConnected===true&&network.isInternetReachable===true;
  }catch{/* No proof of connectivity: do not issue a non-idempotent insert. */}
  if(!online)throw Error('Connexion Internet requise pour envoyer la commande.');
  const origin=await getLocalIdentity();
  if(origin?.id!==draft.created_by)
   throw Error('Compte changé : commande non envoyée.');
  const verified=await supabase.auth.getUser();
  if(verified.error||verified.data?.user?.id!==draft.created_by)
   throw Error('Session non vérifiée : commande non envoyée.');
  const latest=await getLocalIdentity();
  if(latest?.id!==draft.created_by)
   throw Error('Compte changé avant envoi : commande non envoyée.');
  let response;
  try{
   response=await supabase.from('material_orders').insert(draft)
    .select('id').single();
  }catch{
   throw Error('Réponse réseau incertaine : vérifie l’historique des commandes avant de réessayer.');
  }
  if(response.error)throw response.error;
  if(typeof response.data?.id!=='string'||!response.data.id)
   throw Error('Envoi non confirmé : vérifie l’historique avant de réessayer pour éviter un doublon.');
  return response.data.id;
 }finally{
  pendingMaterialOrders.delete(scope);
 }
}
