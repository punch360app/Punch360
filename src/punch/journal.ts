import * as Network from 'expo-network';
import {getLocalIdentity} from '../auth/localIdentity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import {supabase} from '../lib/supabase';
import {PunchJournal,hasUnsafePunchJournalEntries} from '../../web/live/journal.js';
import {localPunchSyncState} from '../../web/live/punch-sync-state.js';
const journals=new Map<string,PunchJournal>();
export async function getPunchJournal(company:string){
 const identity=await getLocalIdentity();
 const user=identity.id,key=user+':'+company;
 if(!journals.has(key))journals.set(key,new PunchJournal({company,user,uuid:()=>Crypto.randomUUID(),storage:{get:key=>AsyncStorage.getItem(key),set:(key,value)=>AsyncStorage.setItem(key,value)},send:async event=>{
  // A durable event remains tied to its original worker and company.
  // Never submit its RPC using a different session after an account switch.
  if(event.company!==company||event.user!==user)
   throw Error('Pointage conservé : entreprise ou salarié du journal incohérent.');
  const network=await Network.getNetworkStateAsync();
  if(network.isConnected!==true||network.isInternetReachable!==true)
   throw Error('Réseau non confirmé : pointage conservé sur cet appareil.');
  // getUser contacts Supabase Auth; a locally restored identity or a
  // different signed-in worker is not authorization to replay saved hours.
  const verified=await supabase.auth.getUser();
  if(verified.error||verified.data?.user?.id!==user)
   throw Error('Compte changé ou non vérifié : pointage conservé pour le bon salarié.');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
  try{const request=event.action==='break_start'&&event.paid?supabase.rpc('sync_paid_break_start',{p_event:event.id,p_company:event.company,p_occurred_at:event.occurredAt,p_offline:event.offline,p_previous:event.previous}):event.action.startsWith('break_')?supabase.rpc('sync_break_event',{p_event:event.id,p_company:event.company,p_action:event.action,p_occurred_at:event.occurredAt,p_offline:event.offline,p_previous:event.previous}):supabase.rpc('sync_punch_event',{p_event:event.id,p_company:event.company,p_action:event.action,p_occurred_at:event.occurredAt,p_offline:event.offline,p_job:event.job,p_latitude:event.fix?.latitude??null,p_longitude:event.fix?.longitude??null,p_accuracy:event.fix?.accuracy??null,p_previous:event.previous});const {data,error}=await request.abortSignal(controller.signal);if(error)throw error;return data;}
  finally{clearTimeout(timeout)}
 }}));return journals.get(key)!;
}
export async function journalSummary(company:string){
 const j=await getPunchJournal(company);
 const blocked={pending:0,conflicts:0,blocked:true,pendingItems:[],conflictItems:[]};
 let events;
 try{events=await j.read()}catch{return blocked}
 if(hasUnsafePunchJournalEntries(events,j.company,j.user))return blocked;
 // Reuse the sanitized Web projection: never expose GPS, job, server payloads.
 const visible=localPunchSyncState(events,j.company,j.user);
 return {pending:visible.pending.length,conflicts:visible.conflicts.length,blocked:false,
  pendingItems:visible.pending.slice(-5),conflictItems:visible.conflicts.slice(-5)};
}
