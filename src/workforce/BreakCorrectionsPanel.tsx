import React,{useEffect,useRef,useState} from 'react';
import {Pressable,ScrollView,Switch,Text,TextInput,View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {breakCorrectionPayload} from '../../web/live/break-corrections';
import {durableLedgerRequest} from '../../web/live/idempotency';
import {canCancelBreakCorrection,canChooseBreakSession,canManageBreakCorrections,canReviewBreakCorrection,canSelectOriginalBreak,createBreakCorrectionScope,validDecisionNote} from './breakCorrectionScope.js';

type Row=Record<string,any>;
type Token=ReturnType<ReturnType<typeof createBreakCorrectionScope>['current']>;
const blank=()=>({session:'',breakId:'',start:'',end:'',paid:false,reason:''});
const card={padding:16,gap:10,borderWidth:1,borderColor:'#E1E8DB',borderRadius:12,backgroundColor:'white'} as const;
const statusLabel:Record<string,string>={pending:'En attente',approved:'Approuvée',rejected:'Refusée',cancelled:'Annulée'};
const date=(raw:unknown)=>{const n=Date.parse(String(raw||''));return Number.isFinite(n)?new Date(n).toLocaleString('fr-CA'):'Date inconnue'};
export function BreakCorrectionsPanel({account}:{account:WorkspaceAccount}){
 const [sessions,setSessions]=useState<Row[]>([]),[breaks,setBreaks]=useState<Row[]>([]);
 const [requests,setRequests]=useState<Row[]>([]),[people,setPeople]=useState<Row[]>([]);
 const [form,setForm]=useState(blank),[note,setNote]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false);
 const scope=useRef(createBreakCorrectionScope(account));
 const latest=useRef(account);latest.current=account;
 const alive=useRef(false),loadId=useRef(0),actionLock=useRef(false);
 const identityMatches=scope.current.matches(account),manager=canManageBreakCorrections(account);
 const current=(token:Token)=>alive.current&&scope.current.allows(token)&&scope.current.matches(latest.current);
 const disabled=!identityMatches||busy||loading||!loaded;
 const text=(value:string)=><Text style={{color:'#2F4935',lineHeight:21}}>{value}</Text>;
 const button=(title:string,onPress:()=>void)=><Pressable accessibilityRole="button" accessibilityLabel={title}
  accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
  style={{minHeight:48,padding:12,justifyContent:'center',borderRadius:8,backgroundColor:'#edf2e9',opacity:disabled?0.5:1}}>
  {text(title)}</Pressable>;
 const input=(label:string,value:string,onChangeText:(v:string)=>void)=><View style={{gap:5}}>
  {text(label)}<TextInput accessibilityLabel={label} autoCapitalize="none" value={value} onChangeText={onChangeText}
   editable={!disabled} maxLength={1000} style={{padding:12,minHeight:48,borderWidth:1,borderColor:'#E1E8DB',borderRadius:8,color:'#2F4935'}}/>
 </View>;
 async function load(token:Token=scope.current.current()){
  if(!current(token))return false;
  const revision=++loadId.current;setLoading(true);setLoaded(false);
  try{
   let sessionsQuery=supabase.from('punch_sessions')
    .select('id,company_id,worker_id,user_id,started_at,ended_at')
    .eq('company_id',account.companyId).not('ended_at','is',null);
   if(!manager)sessionsQuery=sessionsQuery.eq('user_id',account.userId);
   let requestsQuery=supabase.from('essential_break_corrections')
    .select('id,company_id,session_id,requested_by,requested_start,requested_end,requested_paid,original_break,reason,status,review_note')
    .eq('company_id',account.companyId).order('created_at',{ascending:false});
   if(!manager)requestsQuery=requestsQuery.eq('requested_by',account.userId);
   const [a,b,c]=await Promise.all([
    sessionsQuery.order('started_at',{ascending:false}).limit(101),
    requestsQuery.limit(101),
    manager?supabase.rpc('essential_team_roster',{p_company:account.companyId}):Promise.resolve({data:[],error:null})
   ]);
   if(!current(token)||revision!==loadId.current)return false;
   if(a.error||b.error||c.error||!Array.isArray(a.data)||!Array.isArray(b.data)||
    !Array.isArray(c.data)||a.data.length>100||b.data.length>100)throw Error('incomplete');
   const ids=a.data.map(s=>s.id);
   const d=ids.length?await supabase.from('punch_breaks')
    .select('id,company_id,session_id,started_at,ended_at,is_paid')
    .eq('company_id',account.companyId).in('session_id',ids).order('started_at').limit(1001)
    :{data:[],error:null};
   if(!current(token)||revision!==loadId.current)return false;
   if(d.error||!Array.isArray(d.data)||d.data.length>1000)throw Error('incomplete');
   setSessions(a.data);setBreaks(d.data);setRequests(b.data);setPeople(c.data);
   setForm(previous=>{
    if(!a.data.some(s=>s.id===previous.session))return blank();
    if(previous.breakId&&!d.data.some(b=>b.id===previous.breakId&&b.session_id===previous.session))
     return {...previous,breakId:'',start:'',end:'',paid:false};
    return previous;
   });
   setError('');setLoaded(true);return true;
  }catch{
   if(current(token)&&revision===loadId.current){
    setSessions([]);setBreaks([]);setRequests([]);setPeople([]);setForm(blank());
    setError('Corrections de pauses indisponibles ou incomplètes. Réessaie.');setLoaded(false);
   }
   return false;
  }finally{if(current(token)&&revision===loadId.current)setLoading(false)}
 }
 useEffect(()=>{
  const token=scope.current.enter(account);
  alive.current=true;loadId.current++;actionLock.current=false;
  setSessions([]);setBreaks([]);setRequests([]);setPeople([]);setForm(blank());setNote('');
  setBusy(false);setLoading(true);setLoaded(false);setError('');setNotice('');
  void load(token);
  return()=>{alive.current=false;scope.current.invalidate();loadId.current++};
 },[account.companyId,account.userId,account.role,account.edition]);
 async function rpc(name:string,args:Row,token:Token){
  if(!current(token))throw Error('Compte modifié');
  const r=await supabase.rpc(name,args);
  if(!current(token))throw Error('Compte modifié');
  if(r.error)throw Error('Autorisation refusée');
  return r.data;
 }
 async function run(action:(token:Token)=>Promise<void>){
  const token=scope.current.current();
  if(!identityMatches||disabled||!current(token)||actionLock.current)return;
  actionLock.current=true;setBusy(true);setError('');setNotice('');
  try{
   await action(token);
   if(!current(token))return;
   const ok=await load(token);
   if(current(token)&&ok)setNotice('Demandes actualisées.');
  }catch{if(current(token))setError('Action impossible ou autorisation refusée. Vérifie puis réessaie.')}
  finally{if(current(token)){actionLock.current=false;setBusy(false)}}
 }
 function submit(){
  const session=sessions.find(s=>s.id===form.session);
  if(!canChooseBreakSession(session,sessions,account)||
   (form.breakId&&!breaks.some(b=>b.id===form.breakId&&b.session_id===form.session&&b.ended_at))){
   setError('Choisis une journée terminée et une pause autorisées.');return;
  }
  let payload:Row;
  try{payload=breakCorrectionPayload(form)}
  catch(e){setError(e instanceof Error?e.message:'Dates et motif à vérifier.');return;}
  void run(async token=>{
   await durableLedgerRequest({
    storage:{get:AsyncStorage.getItem,set:AsyncStorage.setItem,remove:AsyncStorage.removeItem},
    key:'punch-break-request:'+account.companyId+':'+account.userId,
    payload,uuid:Crypto.randomUUID,
    digest:v=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,v),
    send:args=>rpc('request_essential_break_correction',args,token)
   });
   if(current(token))setForm(blank());
  });
 }
 function review(request:Row,approve:boolean){
  if(!canReviewBreakCorrection(request,account,requests,sessions,people))return;
  const reason=note.trim();
  if(!validDecisionNote(reason)){setError('Motif de décision de 3 à 1000 caractères requis.');return;}
  void run(async token=>{
   await rpc('review_essential_break_correction',{p_request:request.id,p_approve:approve,p_note:reason},token);
   if(current(token))setNote('');
  });
 }
 function cancel(request:Row){
  if(!canCancelBreakCorrection(request,account,requests))return;
  void run(async token=>{await rpc('cancel_essential_break_correction',{p_request:request.id},token)});
 }
 if(!identityMatches)return <View style={{padding:16}}>
  <Text accessibilityLiveRegion="polite">Changement de compte en cours…</Text>
 </View>;
 return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:16,gap:16,paddingBottom:40}}>
  <Text style={{fontSize:23,color:'#2F4935',fontWeight:'600'}}>Corrections de pauses</Text>
  {text('Les heures officielles restent inchangées avant approbation par une autre personne.')}
  {loading?<Text accessibilityLiveRegion="polite">Chargement des corrections…</Text>:null}
  {busy?<Text accessibilityLiveRegion="polite">Traitement en cours…</Text>:null}
  {error?<Text accessibilityRole="alert" style={{color:'#a13e32'}}>{error}</Text>:null}
  {notice?text(notice):null}
  {!loading&&!busy?<Pressable accessibilityRole="button" accessibilityLabel="Réessayer le chargement"
   onPress={()=>{setError('');void load()}} style={{minHeight:48,padding:12,backgroundColor:'#edf2e9',borderRadius:8}}>
   {text(loaded?'Actualiser':'Réessayer')}
  </Pressable>:null}
  {loaded?<View style={card}>
   {text('Choisir une journée terminée (100 récentes)')}
   <ScrollView style={{maxHeight:170}} nestedScrollEnabled>
    {sessions.map(s=><View key={s.id}>
     {button((s.id===form.session?'✓ ':'')+
      (people.find(w=>w.id===s.worker_id)?.name||'Ma journée')+' · '+date(s.started_at),
      ()=>{if(canChooseBreakSession(s,sessions,account))setForm({...blank(),session:s.id})})}
    </View>)}
   </ScrollView>
   {form.session?<>
    {button(form.breakId?'Ajouter plutôt une pause oubliée':'✓ Ajouter une pause oubliée',
     ()=>setForm({...blank(),session:form.session}))}
    {breaks.filter(b=>b.session_id===form.session&&b.ended_at).map(b=><View key={b.id}>
     {button((form.breakId===b.id?'✓ ':'')+date(b.started_at)+' → '+date(b.ended_at)+
      ' · '+(b.is_paid?'Payée':'Non payée'),
      ()=>{if(canSelectOriginalBreak(b,form.session,breaks))
       setForm({...form,breakId:b.id,start:b.started_at,end:b.ended_at,paid:b.is_paid})})}
    </View>)}
    {text('Dates complètes avec fuseau, ex. 2026-10-20T12:00:00-04:00')}
    {input('Début demandé',form.start,v=>setForm({...form,start:v}))}
    {input('Fin demandée',form.end,v=>setForm({...form,end:v}))}
    <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
     {text('Pause payée')}
     <Switch accessibilityLabel="Pause payée" disabled={disabled} value={form.paid}
      onValueChange={paid=>setForm({...form,paid})}/>
    </View>
    {input('Motif de la demande',form.reason,v=>setForm({...form,reason:v}))}
    {button('Soumettre pour approbation',submit)}
   </>:null}
  </View>:null}
  {loaded&&manager?<View style={card}>{input('Motif pour les décisions',note,setNote)}</View>:null}
  {loaded?<View style={card}>
   {text('100 demandes récentes')}
   {requests.map(r=><View key={r.id} style={{gap:7,paddingVertical:12,borderBottomWidth:1,borderColor:'#E1E8DB'}}>
    {text(String(r.reason||'Motif non précisé')+' · '+(statusLabel[r.status]||'Statut inconnu'))}
    {text('Avant : '+(r.original_break?date(r.original_break.started_at)+' → '+
     date(r.original_break.ended_at)+' · '+(r.original_break.is_paid?'Payée':'Non payée'):'Aucune pause'))}
    {text('Demande : '+date(r.requested_start)+' → '+date(r.requested_end)+
     ' · '+(r.requested_paid?'Payée':'Non payée'))}
    {r.review_note?text(String(r.review_note)):null}
    {canCancelBreakCorrection(r,account,requests)?button('Annuler ma demande',()=>cancel(r)):null}
    {canReviewBreakCorrection(r,account,requests,sessions,people)?<>
     {button('Approuver',()=>review(r,true))}{button('Refuser',()=>review(r,false))}
    </>:null}
   </View>)}
  </View>:null}
 </ScrollView>;
}
