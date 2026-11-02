import * as Network from 'expo-network';
import {getLocalIdentity} from '../auth/localIdentity';
import {supabase} from '../lib/supabase';

export type NativeLeaveType='vacation'|'sick'|'personal'|'other';
const leaveTypes=new Set<string>(['vacation','sick','personal','other']);

/** ISO date-only values stay in the employee's local calendar day. */
export function validLeaveDate(value:string):boolean{
 if(typeof value!=='string'||!/^(\d{4})-(\d{2})-(\d{2})$/.test(value))return false;
 const [year,month,day]=value.split('-').map(Number);
 if(year<1900||year>9999||month<1||month>12||day<1)return false;
 const maxDay=new Date(Date.UTC(year,month,0)).getUTCDate();
 return day<=maxDay;
}

export function validatedLeaveRequest(input:{
 companyId:string;userId:string;leaveType:string;from:string;to:string;reason:string;
}){
 if(!input.companyId?.trim()||!input.userId?.trim())
  throw Error('Compte ou entreprise indisponible : demande non envoyée.');
 if(!leaveTypes.has(input.leaveType))
  throw Error('Choisissez un type de congé valide.');
 if(!validLeaveDate(input.from)||!validLeaveDate(input.to))
  throw Error('Dates invalides : utilisez AAAA-MM-JJ et une date réelle.');
 if(input.to<input.from)
  throw Error('La fin du congé doit être le même jour ou après le début.');
 return {company_id:input.companyId,user_id:input.userId,
  leave_type:input.leaveType as NativeLeaveType,
  begins_on:input.from,ends_on:input.to,reason:input.reason.trim()||null};
}

// Non-idempotent insert: do not repeat a request while the first attempt
// might already have been accepted by the server.
const pendingLeaveRequests=new Set<string>();
export async function submitNativeLeaveRequest(input:Parameters<typeof validatedLeaveRequest>[0]){
 const payload=validatedLeaveRequest(input);
 const scope=payload.company_id+':'+payload.user_id;
 if(pendingLeaveRequests.has(scope))
  throw Error('Demande déjà en cours : attendez la confirmation avant de réessayer.');
 pendingLeaveRequests.add(scope);
 try{
  let online=false;
  try{const net=await Network.getNetworkStateAsync();
   online=net.isConnected===true&&net.isInternetReachable===true;
  }catch{/* Unknown network does not authorize a non-idempotent submission. */}
  if(!online)throw Error('Connexion Internet requise pour demander un congé.');
  const local=await getLocalIdentity();
  if(local?.id!==payload.user_id)
   throw Error('Compte changé : demande non envoyée.');
  const verified=await supabase.auth.getUser();
  if(verified.error||verified.data?.user?.id!==payload.user_id)
   throw Error('Compte non vérifié : demande non envoyée.');
  const latest=await getLocalIdentity();
  if(latest?.id!==payload.user_id)
   throw Error('Compte changé avant envoi : demande non envoyée.');
  const {error}=await supabase.from('leave_requests').insert(payload);
  if(error)throw error;
  return true;
 }finally{
  pendingLeaveRequests.delete(scope);
 }
}
