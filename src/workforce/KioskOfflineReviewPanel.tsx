import React,{useEffect,useRef,useState} from 'react';
import {Pressable,Text,TextInput,View} from 'react-native';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {canConfirmKioskLot,canReviewKioskOffline,createKioskOfflineScope,isPendingKioskLot,kioskReviewRows,validKioskReviewNote} from './kioskOfflineReviewScope.js';

// Only the server can authorize and apply provisional punches. No automatic acceptance.
type Decision={id:string;approve:boolean;note:string};
type Row=Record<string,any>;
type Token=ReturnType<ReturnType<typeof createKioskOfflineScope>['current']>;
const actions:Record<string,string>={in:'Entrée',out:'Sortie',break_start:'Pause non payée',break_start_paid:'Pause payée',break_end:'Fin de pause'};
const states:Record<string,string>={pending:'En attente',approved:'Confirmé',rejected:'Refusé',conflict:'Conflit'};
function safeDate(raw:unknown){const t=Date.parse(String(raw||''));return Number.isFinite(t)?new Date(t).toLocaleString('fr-CA'):'Date à vérifier';}
export function KioskOfflineReviewPanel({account}:{account:WorkspaceAccount}){
 const [rows,setRows]=useState<Row[]>([]),[note,setNote]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false);
 const [pending,setPending]=useState<Decision|null>(null);
 const scope=useRef(createKioskOfflineScope(account));
 const latest=useRef(account);latest.current=account;
 const alive=useRef(false),generation=useRef(0),inFlight=useRef(false);
 const identityMatches=scope.current.matches(account),manager=canReviewKioskOffline(account);
 const current=(token:Token)=>alive.current&&scope.current.allows(token)&&scope.current.matches(latest.current);
 const disabled=!identityMatches||loading||busy||!loaded||!manager;
 const safeError='Décision non enregistrée. Actualisez ou contactez le support.';
 async function load(token:Token=scope.current.current()){
  if(!current(token)||!manager)return false;
  const n=++generation.current;
  setLoading(true);setLoaded(false);setNotice('');
  try{
   if(!current(token))throw Error('Compte modifié');
   const result=await supabase.rpc('list_kiosk_offline',{p_company:account.companyId});
   if(!current(token)||n!==generation.current)return false;
   if(result.error)throw Error('load-denied');
   const grants=kioskReviewRows(result.data);
   setRows(grants);
   setPending(prev=>prev&&!isPendingKioskLot(grants.find(x=>x.id===prev.id),grants)?null:prev);
   setError('');setLoaded(true);return true;
  }catch{
   if(current(token)&&n===generation.current){
    setRows([]);setPending(null);setLoaded(false);
    setError('Impossible de charger les observations. Réessayer.');
   }
   return false;
  }finally{if(current(token)&&n===generation.current)setLoading(false)}
 }
 useEffect(()=>{
  const token=scope.current.enter(account);
  alive.current=true;generation.current++;inFlight.current=false;
  setRows([]);setNote('');setPending(null);setError('');setNotice('');
  setBusy(false);setLoading(true);setLoaded(false);
  if(canReviewKioskOffline(account))void load(token);
  else{setLoading(false);setError('Accès réservé aux responsables de la compagnie.')}
  return()=>{alive.current=false;scope.current.invalidate();generation.current++};
 },[account.companyId,account.userId,account.role,account.edition]);

 async function run(task:(token:Token)=>Promise<void>){
  const token=scope.current.current();
  if(disabled||inFlight.current||!current(token))return;
  inFlight.current=true;setBusy(true);setError('');setNotice('');
  try{
   await task(token);
   if(!current(token))return;
   const refreshed=await load(token);
   if(current(token)&&refreshed)setNotice('Liste des observations actualisée.');
  }catch{
   if(current(token))setError(safeError);
  }finally{if(current(token)){inFlight.current=false;setBusy(false)}}
 }
 function choose(id:string,approve:boolean){
  if(disabled||inFlight.current)return;
  if(!validKioskReviewNote(note)){setError('Motif de décision requis (3 à 1000 caractères).');return;}
  const row=rows.find(x=>x.id===id);
  if(!isPendingKioskLot(row,rows)){setError(safeError);setPending(null);return;}
  setPending({id,approve,note:note.trim()});setError('');setNotice('');
 }
 async function commit(token:Token){
  const selected=pending;
  if(!canConfirmKioskLot(selected,note,rows,account))throw Error('Confirmation invalide');
  if(!current(token))throw Error('Compte modifié');
  const latestRows=await supabase.rpc('list_kiosk_offline',{p_company:account.companyId});
  if(!current(token))return;
  if(latestRows.error)throw Error('Lecture refusée');
  const checked=kioskReviewRows(latestRows.data);
  if(!canConfirmKioskLot(selected,note,checked,account))throw Error('Lot déjà traité');
  // Recheck account immediately before the sensitive server RPC.
  if(!current(token))throw Error('Compte modifié');
  const result=await supabase.rpc('review_kiosk_offline',{
   p_grant:selected!.id,p_approve:selected!.approve,p_note:selected!.note
  });
  if(!current(token))return;
  if(result.error)throw Error('Décision refusée');
  setPending(null);setNote('');
 }
 const button=(caption:string,fn:()=>void)=><Pressable accessibilityRole="button" accessibilityLabel={caption}
  accessibilityState={{disabled}} disabled={disabled} onPress={fn}
  style={{padding:12,minHeight:48,justifyContent:'center',backgroundColor:'#edf2e9',borderRadius:8,opacity:disabled?0.5:1}}>
  <Text style={{color:'#2F4935'}}>{caption}</Text></Pressable>;
 if(!identityMatches)return <View style={{padding:16}}>
  <Text accessibilityLiveRegion="polite">Changement de compte en cours…</Text>
 </View>;
 if(!manager)return <View style={{padding:16}}>
  <Text accessibilityRole="alert">Réconciliation hors ligne réservée aux responsables autorisés.</Text>
 </View>;
 return <View style={{gap:12,padding:12}}>
  <Text style={{fontSize:22,color:'#2F4935'}}>Réconciliation hors ligne</Text>
  <Text>Observations provisoires : vérifiez les heures et pauses avant confirmation. Une journée encore ouverte, une semaine fermée ou un autre appareil peuvent empêcher la décision.</Text>
  {loading?<Text accessibilityLiveRegion="polite">Chargement des observations…</Text>:null}
  {busy?<Text accessibilityLiveRegion="polite">Validation en cours…</Text>:null}
  {error?<Text accessibilityRole="alert" style={{color:'#a13e32'}}>{error}</Text>:null}
  {notice?<Text accessibilityLiveRegion="polite">{notice}</Text>:null}
  {!loading&&!busy?<Pressable accessibilityRole="button" accessibilityLabel="Réessayer le chargement"
   onPress={()=>{setError('');void load()}} style={{padding:12,minHeight:48,backgroundColor:'#edf2e9',borderRadius:8}}>
   <Text style={{color:'#2F4935'}}>{loaded?'Actualiser':'Réessayer'}</Text>
  </Pressable>:null}
  {loaded?<>
   <TextInput accessibilityLabel="Motif de décision hors ligne" placeholder="Motif de décision"
    value={note} onChangeText={setNote} editable={!disabled&&!pending} maxLength={1000}
    style={{padding:12,minHeight:48,borderWidth:1,borderColor:'#E1E8DB',borderRadius:8,color:'#2F4935'}}/>
   {rows.map(grant=><View key={grant.id} style={{gap:8,padding:14,backgroundColor:'white',borderRadius:10}}>
    <Text style={{fontWeight:'600',color:'#2F4935'}}>{String(grant.worker||'Employé')} · {String(grant.device||'Borne')}</Text>
    {(grant.events||[]).map((ev:Row,i:number)=><Text key={String(ev.id||i)}>
     {safeDate(ev.at)} · {actions[ev.action]||'Action inconnue'} · {states[ev.state]||'Statut inconnu'}
     {ev.note?' · '+String(ev.note):''}
    </Text>)}
    {isPendingKioskLot(grant,rows)?pending?.id===grant.id?
     <View style={{gap:8,padding:12,backgroundColor:'#eef3e8',borderRadius:8}}>
      <Text accessibilityLiveRegion="polite" style={{color:'#2F4935',fontWeight:'600'}}>
       {pending.approve?'Confirmer les observations':'Refuser et conserver l’historique'} — {String(grant.worker||'Employé')} · {String(grant.device||'Borne')}
      </Text>
      {button('Enregistrer cette décision',()=>void run(commit))}
      <Pressable accessibilityRole="button" accessibilityLabel="Annuler cette confirmation"
       disabled={busy} onPress={()=>{setPending(null);setError('')}} style={{padding:12,minHeight:48,justifyContent:'center'}}>
       <Text style={{color:'#2F4935'}}>Annuler</Text>
      </Pressable>
     </View>:
     <View style={{gap:8}}>
      {button('Confirmer les observations',()=>choose(grant.id,true))}
      {button('Refuser et conserver l’historique',()=>choose(grant.id,false))}
     </View>:null}
   </View>)}
   <Text>100 lots récents au maximum. Une borne encore déconnectée peut conserver d’autres observations sur son appareil.</Text>
  </>:null}
 </View>;
}
