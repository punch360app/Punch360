import * as Network from 'expo-network';
import {getLocalIdentity} from '../auth/localIdentity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import {supabase} from '../lib/supabase';
import {PunchJournal} from '../../web/live/journal.js';
const journals=new Map<string,PunchJournal>();
export async function getPunchJournal(company:string){
 const identity=await getLocalIdentity();
 const user=identity.id,key=user+':'+company;
 if(!journals.has(key))journals.set(key,new PunchJournal({company,user,uuid:()=>Crypto.randomUUID(),storage:{get:key=>AsyncStorage.getItem(key),set:(key,value)=>AsyncStorage.setItem(key,value)},send:async event=>{
  const network=await Network.getNetworkStateAsync();if(network.isConnected===false||network.isInternetReachable===false)throw Error('Réseau indisponible');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);
  try{const request=event.action.startsWith('break_')?supabase.rpc('sync_break_event',{p_event:event.id,p_company:event.company,p_action:event.action,p_occurred_at:event.occurredAt,p_offline:event.offline,p_previous:event.previous}):supabase.rpc('sync_punch_event',{p_event:event.id,p_company:event.company,p_action:event.action,p_occurred_at:event.occurredAt,p_offline:event.offline,p_job:event.job,p_latitude:event.fix?.latitude??null,p_longitude:event.fix?.longitude??null,p_accuracy:event.fix?.accuracy??null,p_previous:event.previous});const {data,error}=await request.abortSignal(controller.signal);if(error)throw error;return data;}
  finally{clearTimeout(timeout)}
 }}));return journals.get(key)!;
}
export async function journalSummary(company:string){const events=await (await getPunchJournal(company)).read();return {pending:events.filter(e=>e.status==='pending').length,conflicts:events.filter(e=>e.status==='conflict').length};}
