import React,{useEffect,useRef,useState} from 'react';
import {Pressable,ScrollView,Switch,Text,TextInput,View} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {blankMissingDay,missingDayPayload} from '../../web/live/missing-days';
import {durableLedgerRequest} from '../../web/live/idempotency';
import {canCancelMissingDay,canReviewMissingDay,chooseMissingDaySelection,createMissingDayScope} from './missingDayScope.js';

type Row=Record<string,any>;
type Token=ReturnType<ReturnType<typeof createMissingDayScope>['current']>;
const failure='Impossible de vérifier les journées oubliées de ce compte. Réessaie.';
const statuses:Record<string,string>={pending:'En attente',approved:'Approuvée',rejected:'Refusée',cancelled:'Annulée'};
export function MissingDaysPanel({account}:{account:WorkspaceAccount}){
 const [form,setForm]=useState(blankMissingDay);
 const [workers,setWorkers]=useState<Row[]>([]),[jobs,setJobs]=useState<Row[]>([]),[requests,setRequests]=useState<Row[]>([]);
 const [note,setNote]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false);
 const scope=useRef(createMissingDayScope(account.companyId,account.userId,account.role));
 const latest=useRef({companyId:account.companyId,userId:account.userId,role:account.role});
 latest.current={companyId:account.companyId,userId:account.userId,role:account.role};
 const alive=useRef(false),sequence=useRef(0),actionLock=useRef(false);
 const identityMatches=scope.current.matches(account.companyId,account.userId,account.role);
 const manager=account.role==='boss'||account.role==='admin';
 const current=(token:Token)=>{
  const id=latest.current;
  return alive.current&&scope.current.allows(token)&&scope.current.matches(id.companyId,id.userId,id.role);
 };
 const disabled=busy||loading||!loaded;
 const txt=(value:string)=><Text style={{color:'#2F4935',lineHeight:22}}>{value}</Text>;

 async function load(token:Token=scope.current.current()){
  if(!current(token))return false;
  const request=++sequence.current;
  setLoading(true);setLoaded(false);setNotice('');
  try{
   let workerQuery=supabase.from('company_workers')
    .select('id,first_name,last_name,auth_user_id')
    .eq('company_id',account.companyId).eq('status','active');
   if(!manager)workerQuery=workerQuery.eq('auth_user_id',account.userId);
   let requestQuery=supabase.from('essential_missing_days')
    .select('id,worker_id,requested_by,starts_at,ends_at,reason,breaks,status,review_note')
    .eq('company_id',account.companyId).order('created_at',{ascending:false}).limit(100);
   if(!manager)requestQuery=requestQuery.eq('requested_by',account.userId);
   const [a,b,c]=await Promise.all([
    workerQuery.limit(500),
    supabase.from('jobs').select('id,name').eq('company_id',account.companyId).limit(500),
    requestQuery
   ]);
   if(!current(token)||request!==sequence.current)return false;
   if(a.error||b.error||c.error||!Array.isArray(a.data)||!Array.isArray(b.data)||!Array.isArray(c.data)||
      a.data.length>=500||b.data.length>=500)throw Error('incomplete');
   // Keep only choices belonging to the current authorized account.
   setWorkers(a.data);setJobs(b.data);setRequests(c.data);
   setForm(old=>chooseMissingDaySelection(old,a.data,b.data));
   setLoaded(true);setError('');return true;
  }catch{
   if(current(token)&&request===sequence.current){
    setWorkers([]);setJobs([]);setRequests([]);setForm(blankMissingDay());
    setLoaded(false);setError(failure);
   }
   return false;
  }finally{
   if(current(token)&&request===sequence.current)setLoading(false);
  }
 }
 useEffect(()=>{
  const token=scope.current.enter(account.companyId,account.userId,account.role);
  alive.current=true;sequence.current++;actionLock.current=false;
  setForm(blankMissingDay());setWorkers([]);setJobs([]);setRequests([]);
  setNote('');setError('');setNotice('');setBusy(false);setLoading(true);setLoaded(false);
  void load(token);
  return()=>{alive.current=false;scope.current.invalidate();sequence.current++};
 },[account.companyId,account.userId,account.role]);

 async function rpc(name:string,p:Row,token:Token){
  if(!current(token))throw Error('Compte modifié');
  const response=await supabase.rpc(name,p);
  if(!current(token))throw Error('Compte modifié');
  if(response.error)throw Error('Opération refusée');
  return response.data;
 }
 async function run(task:(token:Token)=>Promise<void>){
  const token=scope.current.current();
  if(!identityMatches||!current(token)||!loaded||loading||actionLock.current)return;
  actionLock.current=true;setBusy(true);setError('');setNotice('');
  try{
   await task(token);
   if(!current(token))return;
   const refreshed=await load(token);
   if(current(token)&&refreshed)setNotice('Liste des demandes actualisée.');
  }catch{
   if(current(token))setError('Opération impossible ou autorisation refusée. Vérifie puis réessaie.');
  }finally{
   if(current(token)){actionLock.current=false;setBusy(false)}
  }
 }
 function submit(){
  if(disabled||actionLock.current)return;
  if(!workers.some(w=>w.id===form.worker)||!jobs.some(j=>j.id===form.job)){
   setError('Choisis un employé et un établissement autorisés.');return;
  }
  let payload:Row;
  try{payload=missingDayPayload(account.companyId,form)}
  catch(e){setError(e instanceof Error?e.message:'Vérifie les dates, les pauses et le motif.');return;}
  const selectedWorker=form.worker,selectedJob=form.job;
  void run(async token=>{
   // Preserve the existing stable request identifier even across network retry.
   // The send callback checks account scope after asynchronous storage/digest awaits.
   await durableLedgerRequest({
    storage:{get:AsyncStorage.getItem,set:AsyncStorage.setItem,remove:AsyncStorage.removeItem},
    key:'punch-missing-day:'+account.companyId+':'+account.userId,
    payload,uuid:Crypto.randomUUID,
    digest:v=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,v),
    send:args=>rpc('request_essential_missing_day',args,token)
   });
   if(!current(token))return;
   setForm({...blankMissingDay(),worker:selectedWorker,job:selectedJob});
  });
 }
 function review(r:Row,approve:boolean){
  if(!canReviewMissingDay(r,account,workers)||!requests.some(x=>x.id===r.id))return;
  const decision=note.trim();
  if(decision.length<3||decision.length>1000){
   setError('Motif de décision requis (3 à 1000 caractères).');return;
  }
  void run(async token=>{
   await rpc('review_essential_missing_day',{p_request:r.id,p_approve:approve,p_note:decision},token);
   if(current(token))setNote('');
  });
 }
 function cancel(r:Row){
  if(!canCancelMissingDay(r,account.userId)||!requests.some(x=>x.id===r.id))return;
  void run(async token=>{await rpc('cancel_essential_missing_day',{p_request:r.id},token)});
 }
 const btn=(label:string,onPress:()=>void)=><Pressable accessibilityRole="button" accessibilityLabel={label}
  accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
  style={{minHeight:48,padding:12,borderRadius:8,backgroundColor:'#edf2e9',opacity:disabled?0.5:1}}>
  {txt(label)}</Pressable>;
 const input=(label:string,value:string,onChangeText:(v:string)=>void)=><View style={{gap:4}}>
  {txt(label)}<TextInput accessibilityLabel={label} editable={!disabled} value={value}
   onChangeText={onChangeText} autoCapitalize="none" maxLength={1000}
   style={{minHeight:48,borderWidth:1,borderColor:'#E1E8DB',borderRadius:8,padding:12,color:'#2F4935'}}/>
 </View>;
 const renderDate=(value?:string)=>{
  const date=Date.parse(value||'');
  return Number.isFinite(date)?new Date(date).toLocaleString('fr-CA'):'Date à vérifier';
 };
 if(!identityMatches)return <View style={{padding:16}}>
  <Text accessibilityLiveRegion="polite">Changement de compte en cours…</Text>
 </View>;
 return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:16,gap:12}}>
  <Text style={{fontSize:23,color:'#2F4935'}}>Journée entièrement oubliée</Text>
  {txt('La demande ne modifie aucune heure officielle avant l’approbation par une autre personne.')}
  {loading?<Text accessibilityLiveRegion="polite">Chargement des demandes…</Text>:null}
  {busy?<Text accessibilityLiveRegion="polite">Traitement en cours…</Text>:null}
  {error?<Text accessibilityRole="alert" style={{color:'#A1392D'}}>{error}</Text>:null}
  {notice?<Text accessibilityLiveRegion="polite">{notice}</Text>:null}
  {!loading&&!busy?<Pressable accessibilityRole="button" accessibilityLabel="Réessayer le chargement des journées"
   onPress={()=>{setError('');void load()}}
   style={{minHeight:48,padding:12,borderRadius:8,justifyContent:'center',backgroundColor:'#edf2e9'}}>
   {txt(loaded?'Actualiser':'Réessayer')}
  </Pressable>:null}
  {loaded?<>
   {workers.map(w=><View key={w.id}>{btn((form.worker===w.id?'✓ ':'')+w.first_name+' '+w.last_name,
    ()=>setForm(old=>({...old,worker:w.id})))}</View>)}
   {jobs.map(j=><View key={j.id}>{btn((form.job===j.id?'✓ ':'')+j.name,
    ()=>setForm(old=>({...old,job:j.id})))}</View>)}
   {txt('Utilise une date complète avec fuseau, par exemple 2026-10-20T08:00:00-04:00. Pour une nuit, saisis le décalage de chaque extrémité.')}
   {input('Entrée',form.start,start=>setForm(old=>({...old,start})))}
   {input('Sortie',form.end,end=>setForm(old=>({...old,end})))}
   {input('Motif',form.reason,reason=>setForm(old=>({...old,reason})))}
   {form.breaks.map((p,i)=><View key={i} style={{gap:8,padding:12,borderWidth:1,borderColor:'#E1E8DB',borderRadius:8}}>
    {input('Début de pause '+(i+1),p.start,start=>setForm(old=>({...old,breaks:old.breaks.map((b,j)=>j===i?{...b,start}:b)})))}
    {input('Fin de pause '+(i+1),p.end,end=>setForm(old=>({...old,breaks:old.breaks.map((b,j)=>j===i?{...b,end}:b)})))}
    {txt('Pause payée')}
    <Switch disabled={disabled} accessibilityLabel={'Pause payée '+(i+1)} value={p.paid}
     onValueChange={paid=>setForm(old=>({...old,breaks:old.breaks.map((b,j)=>j===i?{...b,paid}:b)}))}/>
    {btn('Retirer la pause',()=>setForm(old=>({...old,breaks:old.breaks.filter((_,j)=>j!==i)})))}
   </View>)}
   {form.breaks.length<12?btn('Ajouter une pause',()=>setForm(old=>({...old,breaks:[...old.breaks,{start:'',end:'',paid:false}]}))):null}
   {btn('Soumettre pour approbation',submit)}
   {manager?input('Motif de décision',note,setNote):null}
   {txt('100 demandes récentes au maximum')}
   {requests.map(r=><View key={r.id} style={{padding:12,gap:8,borderWidth:1,borderColor:'#E1E8DB',borderRadius:8}}>
    {txt((workers.find(w=>w.id===r.worker_id)?.first_name||'Salarié')+' · '+(statuses[r.status]||'Statut indisponible'))}
    {txt(renderDate(r.starts_at)+' → '+renderDate(r.ends_at))}
    {txt(String(r.reason||'Motif non précisé')+' · '+(Array.isArray(r.breaks)?r.breaks.length:0)+' pause(s)')}
    {r.review_note?txt(String(r.review_note)):null}
    {canCancelMissingDay(r,account.userId)?btn('Annuler ma demande',()=>cancel(r)):null}
    {canReviewMissingDay(r,account,workers)?<>
     {btn('Approuver',()=>review(r,true))}{btn('Refuser',()=>review(r,false))}
    </>:null}
   </View>)}
  </>:null}
 </ScrollView>;
}
