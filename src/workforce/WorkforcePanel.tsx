import {File,Paths} from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React,{useEffect,useRef,useState} from 'react';
import {Pressable,ScrollView,Share,Platform,Text,TextInput,View} from 'react-native';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {belongsToActiveSession,canChangeOrder,canManageWorkforce,canReviewWorkforceRequest,createWorkforceScope,csvCell,exportSessionIds,payrollMonday,workforceCorrectionDates} from './workforceScope.js';

type Row=Record<string,any>;
type Token=ReturnType<ReturnType<typeof createWorkforceScope>['current']>;
const LIMIT=150,EXPORT_MAX=10000;
const box={backgroundColor:'#112532',borderColor:'#36505A',borderWidth:1,borderRadius:12,padding:14,gap:8} as const;
const stateError='Impossible de charger les données de ce compte. Réessaie.';
const actionError='Opération refusée ou impossible. Vérifie les données puis réessaie.';
function Label({children}:{children:React.ReactNode}){return <Text style={{color:'#FFFFFF',fontSize:14,lineHeight:21}}>{children}</Text>}
function safeRows(value:Row,limit:number):Row[]{
 if(value.error||!Array.isArray(value.data)||value.data.length>=limit)throw Error('Incomplete data');
 return value.data;
}
const safeDate=(v:unknown)=>{const t=Date.parse(String(v||''));return Number.isFinite(t)?new Date(t).toLocaleString('fr-CA'):'Date à vérifier'};
export function WorkforcePanel({account,managementOnly=false}:{account:WorkspaceAccount;managementOnly?:boolean}){
 const [sessions,setSessions]=useState<Row[]>([]),[corrections,setCorrections]=useState<Row[]>([]),
  [leaves,setLeaves]=useState<Row[]>([]),[orders,setOrders]=useState<Row[]>([]),[weeks,setWeeks]=useState<Row[]>([]);
 const [sessionId,setSessionId]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState(''),
  [reason,setReason]=useState(''),[note,setNote]=useState(''),[week,setWeek]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false),
  [error,setError]=useState(''),[notice,setNotice]=useState('');
 const scope=useRef(createWorkforceScope(account,managementOnly));
 const latest=useRef({account,managementOnly});latest.current={account,managementOnly};
 const alive=useRef(false),loadId=useRef(0),actionLock=useRef(false);
 const identityMatches=scope.current.matches(account,managementOnly),manager=canManageWorkforce(account);
 const current=(token:Token)=>alive.current&&scope.current.allows(token)&&
  scope.current.matches(latest.current.account,latest.current.managementOnly);
 const disabled=!identityMatches||busy||loading||!loaded;
 const Button=({title,onPress}:{title:string;onPress:()=>void})=><Pressable
  accessibilityRole="button" accessibilityLabel={title} accessibilityState={{disabled}} disabled={disabled}
  onPress={onPress} style={{minHeight:48,justifyContent:'center',padding:12,backgroundColor:'#29444F',borderRadius:9,opacity:disabled?.5:1}}>
  <Label>{title}</Label></Pressable>;
 const input=(placeholder:string,value:string,set:(v:string)=>void)=><TextInput
  accessibilityLabel={placeholder} placeholder={placeholder} placeholderTextColor="#9FB4C1" value={value}
  onChangeText={set} editable={!disabled} maxLength={1000} autoCapitalize="none"
  style={{minHeight:48,color:'#FFFFFF',borderWidth:1,borderColor:'#36505A',borderRadius:8,padding:12}}/>;
 const reset=()=>{
  setSessions([]);setCorrections([]);setLeaves([]);setOrders([]);setWeeks([]);
  setSessionId('');setStart('');setEnd('');setReason('');setNote('');setWeek('');
  setBusy(false);setLoading(true);setLoaded(false);setError('');setNotice('');
 };
 async function load(token:Token=scope.current.current()){
  if(!current(token))return false;
  const revision=++loadId.current;
  setLoading(true);setLoaded(false);setNotice('');
  try{
   const personal=!managementOnly||!manager;
   let sessionQuery=supabase.from('punch_sessions')
    .select('id,company_id,user_id,worker_id,started_at,ended_at')
    .eq('company_id',account.companyId);
   if(personal)sessionQuery=sessionQuery.eq('user_id',account.userId);
   let correctionQuery=supabase.from('punch_correction_requests')
    .select('id,company_id,requested_by,session_id,requested_start,requested_end,reason,status')
    .eq('company_id',account.companyId);
   if(!manager)correctionQuery=correctionQuery.eq('requested_by',account.userId);
   let leaveQuery=supabase.from('leave_requests')
    .select('id,company_id,user_id,begins_on,ends_on,leave_type,status')
    .eq('company_id',account.companyId).eq('status','pending');
   if(!manager)leaveQuery=leaveQuery.eq('user_id',account.userId);
   let orderQuery=supabase.from('material_orders')
    .select('id,company_id,created_by,note,status')
    .eq('company_id',account.companyId);
   if(!manager)orderQuery=orderQuery.eq('created_by',account.userId);
   const [sr,cr,lr,or,wr]=await Promise.all([
    sessionQuery.order('started_at',{ascending:false}).limit(LIMIT),
    correctionQuery.order('created_at',{ascending:false}).limit(LIMIT),
    manager?leaveQuery.limit(LIMIT):Promise.resolve({data:[],error:null}),
    manager?orderQuery.order('created_at',{ascending:false}).limit(LIMIT):Promise.resolve({data:[],error:null}),
    manager?supabase.from('payroll_weeks').select('company_id,week_start,reopened_at')
     .eq('company_id',account.companyId).order('week_start',{ascending:false}).limit(LIMIT):
     Promise.resolve({data:[],error:null})
   ]);
   if(!current(token)||revision!==loadId.current)return false;
   const nextSessions=safeRows(sr,LIMIT),nextCorrections=safeRows(cr,LIMIT),
    nextLeaves=safeRows(lr,LIMIT),nextOrders=safeRows(or,LIMIT),nextWeeks=safeRows(wr,LIMIT);
   setSessions(nextSessions);setCorrections(nextCorrections);setLeaves(nextLeaves);
   setOrders(nextOrders);setWeeks(nextWeeks);
   if(!nextSessions.some(s=>s.id===sessionId)){
    setSessionId('');setStart('');setEnd('');
   }
   setLoaded(true);setError('');return true;
  }catch{
   if(current(token)&&revision===loadId.current){
    setSessions([]);setCorrections([]);setLeaves([]);setOrders([]);setWeeks([]);
    setSessionId('');setLoaded(false);setError(stateError);
   }
   return false;
  }finally{
   if(current(token)&&revision===loadId.current)setLoading(false);
  }
 }
 useEffect(()=>{
  const token=scope.current.enter(account,managementOnly);
  alive.current=true;loadId.current++;actionLock.current=false;reset();
  void load(token);
  return()=>{alive.current=false;scope.current.invalidate();loadId.current++};
 },[account.companyId,account.userId,account.role,account.edition,managementOnly]);
 async function rpc(name:string,args:Row,token:Token){
  if(!current(token))throw Error('Compte modifié');
  const response=await supabase.rpc(name,args);
  if(!current(token))throw Error('Compte modifié');
  if(response.error)throw Error('Accès refusé');
  return response.data;
 }
 async function run(action:(token:Token)=>Promise<void>,refresh=true){
  const token=scope.current.current();
  if(!identityMatches||disabled||!current(token)||actionLock.current)return;
  actionLock.current=true;setBusy(true);setError('');setNotice('');
  try{
   await action(token);
   if(!current(token))return;
   if(refresh)await load(token);
   if(current(token))setNotice('Données actualisées.');
  }catch{
   if(current(token))setError(actionError);
  }finally{
   if(current(token)){actionLock.current=false;setBusy(false)}
  }
 }
 function requestCorrection(){
  const session=sessions.find(s=>s.id===sessionId);
  if(!belongsToActiveSession(session,sessions,account,managementOnly)){
   setError('Choisis une journée terminée de ton compte.');return;
  }
  const message=reason.trim();
  if(message.length<3||message.length>1000){setError('Motif de 3 à 1000 caractères requis.');return;}
  let dates:{start:string,end:string};
  try{dates=workforceCorrectionDates(start,end)}
  catch{setError('Entrée et sortie valides, avec fuseau, maximum 26 h.');return;}
  void run(async token=>{
   if(!current(token))throw Error('Compte modifié');
   const r=await supabase.from('punch_correction_requests').insert({
    company_id:account.companyId,session_id:sessionId,requested_by:account.userId,
    requested_start:dates.start,requested_end:dates.end,reason:message
   });
   if(!current(token))return;
   if(r.error)throw Error('Demande refusée');
   setReason('');
  });
 }
 function review(kind:'correction'|'leave',row:Row,approve:boolean){
  const candidates=kind==='correction'?corrections:leaves;
  if(!candidates.some(x=>x.id===row.id)||!canReviewWorkforceRequest(row,account,kind))return;
  const message=note.trim();
  if(message.length<3||message.length>1000){setError('Motif de décision de 3 à 1000 caractères requis.');return;}
  void run(async token=>{
   await rpc(kind==='correction'?'review_punch_correction':'review_leave',
    {p_request:row.id,p_approve:approve,p_note:message},token);
  });
 }
 function advanceOrder(order:Row,status:string){
  if(!orders.some(o=>o.id===order.id)||!canChangeOrder(order,account,status))return;
  const message=note.trim();
  if(message.length<3||message.length>1000){setError('Motif de décision de 3 à 1000 caractères requis.');return;}
  void run(async token=>{
   await rpc('advance_material_order',{p_order:order.id,p_status:status,p_note:message},token);
  });
 }
 function setPayrollWeek(close:boolean){
  if(!manager)return;
  let monday:string;
  try{monday=payrollMonday(week)}
  catch{setError('Indique un lundi valide AAAA-MM-JJ.');return;}
  const message=note.trim();
  if(message.length<3||message.length>1000){setError('Motif de décision de 3 à 1000 caractères requis.');return;}
  void run(async token=>{
   await rpc('set_payroll_week',{p_company:account.companyId,p_week:monday,p_close:close,p_reason:message},token);
  });
 }
 async function exportCSV(token:Token){
  const personal=!managementOnly||!manager;
  const rows:Row[]=[];
  // Fail closed on excessively large exports rather than silently omitting wages/time segments.
  for(let offset=0;offset<=EXPORT_MAX;offset+=400){
   if(!current(token))throw Error('Compte modifié');
   let query=supabase.from('punch_segments')
    .select('id,session_id,job_id,started_at,ended_at,punch_sessions!inner(user_id,worker_id)')
    .eq('company_id',account.companyId).order('id').range(offset,offset+399);
   if(personal)query=query.eq('punch_sessions.user_id',account.userId);
   const result=await query;
   if(!current(token))return;
   if(result.error||!Array.isArray(result.data))throw Error('Lecture impossible');
   rows.push(...result.data);
   if(rows.length>EXPORT_MAX)throw Error('Export trop volumineux');
   if(result.data.length<400)break;
  }
  const pauses:Row[]=[];
  // Restrict breaks to the exact sessions present in the already-scoped export.
  const ids=exportSessionIds(rows);
  for(let i=0;i<ids.length;i+=50){
   const batch=ids.slice(i,i+50);
   // Page explicitly: PostgREST can silently cap a huge .limit() at max_rows.
   for(let page=0;page<=EXPORT_MAX;page+=400){
    if(!current(token))throw Error('Compte modifié');
    const result=await supabase.from('punch_breaks')
     .select('session_id,started_at,ended_at,is_paid').eq('company_id',account.companyId)
     .in('session_id',batch).order('id').range(page,page+399);
    if(!current(token))return;
    if(result.error||!Array.isArray(result.data))throw Error('Pauses indisponibles');
    pauses.push(...result.data);
    if(pauses.length>EXPORT_MAX)throw Error('Export trop volumineux');
    if(result.data.length<400)break;
   }
  }
  let roster:Row[]=[],locations:Row[]=[];
  if(account.edition==='essential'&&rows.length){
   if(!current(token))throw Error('Compte modifié');
   const [people,sites]=await Promise.all([
    supabase.rpc('essential_team_roster',{p_company:account.companyId}),
    supabase.from('essential_locations').select('name,punch_job_id')
     .eq('company_id',account.companyId).limit(EXPORT_MAX+1)
   ]);
   if(!current(token))return;
   if(people.error||sites.error||!Array.isArray(people.data)||!Array.isArray(sites.data)||
    sites.data.length>EXPORT_MAX)throw Error('Référentiel indisponible');
   roster=people.data;locations=sites.data;
  }
  const unpaid=(segment:Row)=>pauses
   .filter(b=>b.session_id===segment.session_id&&!b.is_paid)
   .reduce((n,b)=>{
    const s=Date.parse(segment.started_at),e=Date.parse(segment.ended_at||'');
    const p=Date.parse(b.started_at),q=Date.parse(b.ended_at||'');
    return n+(Number.isFinite(s)&&Number.isFinite(e)&&Number.isFinite(p)&&Number.isFinite(q)?
     Math.max(0,Math.min(q,e)-Math.max(p,s)):0);
   },0);
  const headers=['Segment',account.edition==='essential'?'Matricule':'Employé',
   account.edition==='essential'?'Établissement':'Job','Entrée','Sortie',
   'Heures brutes','Pauses non payées (h)','Heures nettes'];
  const values=rows.map(r=>{
   const worker=Array.isArray(r.punch_sessions)?r.punch_sessions[0]:r.punch_sessions||{};
   const who=account.edition==='essential'
    ?roster.find(w=>w.id===worker.worker_id)?.employee_number||worker.worker_id||worker.user_id
    :worker.user_id||worker.worker_id;
   const loc=account.edition==='essential'
    ?locations.find(l=>l.punch_job_id===r.job_id)?.name||'Établissement':r.job_id;
   const gross=r.ended_at?(Date.parse(r.ended_at)-Date.parse(r.started_at))/3600000:null;
   const breaks=r.ended_at?unpaid(r)/3600000:null;
   return [r.id,who,loc,r.started_at,r.ended_at,
    gross==null?'':gross.toFixed(4),breaks==null?'':breaks.toFixed(4),
    gross==null||breaks==null?'':(gross-breaks).toFixed(4)];
  });
  if(!current(token))return;
  const csv=[headers,...values].map(r=>r.map(csvCell).join(';')).join('\r\n');
  // No private export can be shared after its original account has switched.
  if(!current(token))throw Error('Compte modifié');
  if(Platform.OS==='web'){
   await Share.share({message:csv,title:'Export PUNCH — heures brutes'});
  }else{
   const file=new File(Paths.cache,'PUNCH-heures-'+Date.now()+'.csv');
   file.write('\uFEFF'+csv);
   if(!current(token))return;
   await Sharing.shareAsync(file.uri,{mimeType:'text/csv',UTI:'public.comma-separated-values-text'});
  }
 }
 if(!identityMatches)return <View style={{padding:16}}>
  <Text accessibilityLiveRegion="polite">Changement de compte en cours…</Text>
 </View>;
 return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:12,padding:16,paddingBottom:25}}>
  {loading?<Text accessibilityLiveRegion="polite">Chargement des heures et des demandes…</Text>:null}
  {busy?<Text accessibilityLiveRegion="polite">Traitement en cours…</Text>:null}
  {error?<Text accessibilityRole="alert" style={{color:'#A1392D'}}>{error}</Text>:null}
  {notice?<Text accessibilityLiveRegion="polite" style={{color:'#2F4935'}}>{notice}</Text>:null}
  {!loading&&!busy?<Pressable accessibilityRole="button" accessibilityLabel="Réessayer le chargement"
   onPress={()=>{setError('');void load()}}
   style={{minHeight:48,padding:12,borderRadius:9,backgroundColor:'#29444F',justifyContent:'center'}}>
   <Label>{loaded?'Actualiser':'Réessayer'}</Label>
  </Pressable>:null}
  {loaded?<>
   {!managementOnly&&account.role!=='admin'?<View style={box}>
    <Label>Demander une correction</Label><Label>Choisis une journée terminée. Les heures officielles restent inchangées avant l’approbation.</Label>
    {sessions.filter(s=>s.ended_at&&s.user_id===account.userId).map(s=>
     <Button key={s.id} title={(s.id===sessionId?'✓ ':'')+safeDate(s.started_at)}
      onPress={()=>{setSessionId(s.id);setStart(s.started_at);setEnd(s.ended_at)}}/>)}
    {input('Entrée ISO avec fuseau (ex. 2026-10-20T07:00:00-04:00)',start,setStart)}
    {input('Sortie ISO avec fuseau',end,setEnd)}
    {input('Raison de la correction',reason,setReason)}
    <Button title="Soumettre pour approbation" onPress={requestCorrection}/>
   </View>:null}
   <View style={box}>
    <Label>Demandes de correction</Label>
    {corrections.map(c=><View key={c.id} style={{gap:6}}>
     <Label>{String(c.reason||'Motif non précisé')} — {String(c.status||'Inconnue')}</Label>
     <Label>{c.requested_start||'Entrée inchangée'} → {c.requested_end||'Sortie inchangée'}</Label>
     {canReviewWorkforceRequest(c,account,'correction')?<>
      <Button title="Approuver" onPress={()=>review('correction',c,true)}/>
      <Button title="Refuser" onPress={()=>review('correction',c,false)}/>
     </>:null}
    </View>)}
   </View>
   {manager?<>
    <View style={box}>
     <Label>Motif pour les décisions et suivis</Label>{input('Motif obligatoire',note,setNote)}
    </View>
    <View style={box}>
     <Label>Congés en attente</Label>
     {leaves.map(l=><View key={l.id} style={{gap:6}}>
      <Label>{String(l.user_id||'').slice(0,8)} · {l.begins_on} → {l.ends_on} · {l.leave_type}</Label>
      {canReviewWorkforceRequest(l,account,'leave')?<>
       <Button title="Approuver" onPress={()=>review('leave',l,true)}/>
       <Button title="Refuser" onPress={()=>review('leave',l,false)}/>
      </>:null}
     </View>)}
    </View>
    <View style={box}>
     <Label>Commandes</Label>
     {orders.map(o=><View key={o.id} style={{gap:6}}>
      <Label>{String(o.note||'')} · {String(o.status||'')}</Label>
      {(['approved','rejected','ordered','delivered'] as const).filter(status=>canChangeOrder(o,account,status))
       .map(status=><Button key={status}
        title={{approved:'Approuver',rejected:'Refuser',ordered:'Marquer commandé',delivered:'Marquer livré'}[status]}
        onPress={()=>advanceOrder(o,status)}/>)}
     </View>)}
    </View>
    <View style={box}>
     <Label>Fermeture des semaines (Québec)</Label>
     {input('Lundi AAAA-MM-JJ',week,setWeek)}
     <Button title="Fermer la semaine" onPress={()=>setPayrollWeek(true)}/>
     <Button title="Rouvrir avec le motif indiqué" onPress={()=>setPayrollWeek(false)}/>
     {weeks.map(w=><Label key={w.week_start}>{w.week_start} · {w.reopened_at?'Rouverte':'Fermée'}</Label>)}
    </View>
   </>:null}
   <Button title="Partager les heures en CSV" onPress={()=>void run(exportCSV,false)}/>
   <Label>Export des heures brutes, pauses non payées saisies et heures nettes. Les règles de paie restent à configurer.</Label>
  </>:null}
 </ScrollView>;
}
