import React,{useEffect,useRef,useState} from 'react';
import {AppState,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {approvalRpcNames,canActOnApproval,createApprovalScope} from './approvalScope.js';

type Token=ReturnType<ReturnType<typeof createApprovalScope>['current']>;
type Approval={id:string;kind:string;worker?:string;reason?:string;start?:string;end?:string;
 before_start?:string;before_end?:string;paid?:boolean;breaks?:Array<{start:string;end:string;paid:boolean}>};
const managerRole=(role:string)=>role==='boss'||role==='admin';
const readFailure='Impossible de vérifier les demandes à approuver. Réessaie.';

export function useSupervisorApprovalAccess(account:WorkspaceAccount){
 const manager=managerRole(account.role);
 const scope=useRef(createApprovalScope(account.companyId,account.userId,account.role));
 const latest=useRef({companyId:account.companyId,userId:account.userId,role:account.role});
 latest.current={companyId:account.companyId,userId:account.userId,role:account.role};
 const alive=useRef(false),sequence=useRef(0);
 const [snapshot,setSnapshot]=useState<{token:Token;allowed:boolean}>({
  token:scope.current.current(),allowed:false
 });
 const identityMatches=scope.current.matches(account.companyId,account.userId,account.role);
 const current=(token:Token)=>{
  const id=latest.current;
  return alive.current&&scope.current.allows(token)&&scope.current.matches(id.companyId,id.userId,id.role);
 };
 useEffect(()=>{
  const token=scope.current.enter(account.companyId,account.userId,account.role);
  alive.current=true;sequence.current++;
  const load=async()=>{
   if(!current(token))return;
   const request=++sequence.current;
   // Fail closed immediately when refreshing a delegated permission after returning from background.
   setSnapshot({token,allowed:manager});
   if(manager)return;
   try{
    const r=await supabase.from('essential_supervisors')
     .select('active,can_approve_time,can_approve_leave')
     .eq('company_id',account.companyId).eq('user_id',account.userId).limit(100);
    if(!current(token)||request!==sequence.current)return;
    const allowed=!r.error&&Array.isArray(r.data)&&r.data.length<100&&
     r.data.some(x=>x.active&&(x.can_approve_time||x.can_approve_leave));
    setSnapshot({token,allowed:Boolean(allowed)});
   }catch{
    if(current(token)&&request===sequence.current)setSnapshot({token,allowed:false});
   }
  };
  void load();
  const subscription=AppState.addEventListener('change',state=>{
   if(state==='active')void load();
  });
  return()=>{
   alive.current=false;scope.current.invalidate();sequence.current++;
   subscription.remove();
  };
 },[account.companyId,account.userId,account.role]);
 return identityMatches&&scope.current.allows(snapshot.token)&&snapshot.allowed;
}

export function SupervisorApprovalsPanel({account}:{account:WorkspaceAccount}){
 const canApprove=useSupervisorApprovalAccess(account);
 const [rows,setRows]=useState<Approval[]>([]);
 const [note,setNote]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false);
 const scope=useRef(createApprovalScope(account.companyId,account.userId,account.role));
 const latest=useRef({companyId:account.companyId,userId:account.userId,role:account.role});
 latest.current={companyId:account.companyId,userId:account.userId,role:account.role};
 const alive=useRef(false),sequence=useRef(0),actionLock=useRef(false);
 const identityMatches=scope.current.matches(account.companyId,account.userId,account.role);
 const current=(token:Token)=>{
  const id=latest.current;
  return alive.current&&scope.current.allows(token)&&scope.current.matches(id.companyId,id.userId,id.role);
 };
 const disabled=busy||loading||!loaded||!canApprove;
 async function load(token:Token=scope.current.current()){
  if(!current(token)||!canApprove)return false;
  const request=++sequence.current;
  setRows([]);setLoading(true);setLoaded(false);setNotice('');
  try{
   const r=await supabase.rpc('supervisor_approval_inbox',{p_company:account.companyId});
   if(!current(token)||request!==sequence.current)return false;
   if(r.error||!Array.isArray(r.data)||r.data.length>400)throw Error('inbox');
   // The server limits the departments and delegated permissions; do not permit unknown actions.
   const clean:Approval[]=r.data.filter((row:Approval)=>row&&typeof row.id==='string'&&
    Boolean(approvalRpcNames[row.kind as keyof typeof approvalRpcNames])).map((row:Approval)=>({
    id:row.id,kind:row.kind,worker:row.worker,reason:row.reason,start:row.start,end:row.end,
    before_start:row.before_start,before_end:row.before_end,paid:row.paid,breaks:row.breaks
   }));
   if(clean.length!==r.data.length)throw Error('invalid-inbox');
   setRows(clean);setError('');setLoaded(true);return true;
  }catch{
   if(current(token)&&request===sequence.current){
    setRows([]);setLoaded(false);setError(readFailure);
   }
   return false;
  }finally{
   if(current(token)&&request===sequence.current)setLoading(false);
  }
 }
 useEffect(()=>{
  const token=scope.current.enter(account.companyId,account.userId,account.role);
  alive.current=true;sequence.current++;actionLock.current=false;
  setRows([]);setNote('');setError('');setNotice('');
  setBusy(false);setLoading(true);setLoaded(false);
  if(canApprove)void load(token);else setLoading(false);
  const subscription=AppState.addEventListener('change',state=>{
   if(state==='active'&&current(token)&&canApprove)void load(token);
  });
  return()=>{
   alive.current=false;scope.current.invalidate();sequence.current++;
   subscription.remove();
  };
 },[account.companyId,account.userId,account.role,canApprove]);
 async function run(row:Approval,approve:boolean){
  const token=scope.current.current();
  if(!identityMatches||!current(token)||!canApprove||!loaded||loading||actionLock.current)return;
  if(!canActOnApproval(rows,row.kind,row.id))return;
  const reason=note.trim();
  if(reason.length<3||reason.length>1000){
   setError('Un motif de décision de 3 à 1000 caractères est requis.');return;
  }
  const rpc=approvalRpcNames[row.kind as keyof typeof approvalRpcNames];
  actionLock.current=true;setBusy(true);setError('');setNotice('');
  try{
   const result=await supabase.rpc(rpc,{p_request:row.id,p_approve:approve,p_note:reason});
   if(!current(token))return;
   if(result.error)throw Error('review');
   const verified=await load(token);
   if(current(token)&&verified){
    setNote('');
    setNotice('Décision enregistrée, liste des demandes actualisée.');
   }
  }catch{
   if(current(token))setError('Décision refusée ou demande déjà traitée. Actualise puis réessaie.');
  }finally{
   if(current(token)){actionLock.current=false;setBusy(false)}
  }
 }
 const button=(label:string,fn:()=>void)=><Pressable accessibilityRole="button" accessibilityLabel={label}
  accessibilityState={{disabled}} disabled={disabled} onPress={fn}
  style={{minHeight:48,padding:12,justifyContent:'center',borderRadius:8,backgroundColor:'#edf2e9',opacity:disabled?0.5:1}}>
  <Text style={{color:'#2F4935'}}>{label}</Text>
 </Pressable>;
 const date=(v?:string)=>{
  if(!v)return 'À préciser';
  if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v;
  const parsed=Date.parse(v);
  return Number.isFinite(parsed)?new Date(parsed).toLocaleString('fr-CA'):'Date indisponible';
 };
 if(!identityMatches)return <View style={{padding:16}}>
  <Text accessibilityLiveRegion="polite">Changement de compte en cours…</Text>
 </View>;
 if(!canApprove)return <View style={{padding:16}}>
  <Text accessibilityLiveRegion="polite">Vérification des autorisations ou délégation non disponible.</Text>
 </View>;
 return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:16,gap:12}}>
  <Text style={{fontSize:23,color:'#2F4935'}}>Approbations de mon équipe</Text>
  <Text>Demandes limitées aux départements et aux pouvoirs délégués. Les salaires et coordonnées privées demeurent inaccessibles.</Text>
  {loading?<Text accessibilityLiveRegion="polite">Chargement des demandes…</Text>:null}
  {busy?<Text accessibilityLiveRegion="polite">Décision en cours…</Text>:null}
  {error?<Text accessibilityRole="alert" style={{color:'#A1392D'}}>{error}</Text>:null}
  {notice?<Text accessibilityLiveRegion="polite">{notice}</Text>:null}
  {!busy&&!loading?<Pressable accessibilityRole="button" accessibilityLabel="Réessayer le chargement des approbations"
   onPress={()=>{setError('');void load()}} style={{minHeight:48,padding:12,justifyContent:'center',borderRadius:8,backgroundColor:'#edf2e9'}}>
   <Text style={{color:'#2F4935'}}>{loaded?'Actualiser':'Réessayer'}</Text>
  </Pressable>:null}
  {loaded?<TextInput accessibilityLabel="Motif de décision" placeholder="Motif de décision"
   editable={!disabled} value={note} onChangeText={setNote} maxLength={1000}
   style={{padding:12,minHeight:48,borderWidth:1,borderColor:'#E1E8DB',borderRadius:8}}/>:null}
  {loaded&&rows.map(row=><View key={row.kind+row.id} style={{gap:8,padding:14,borderWidth:1,borderColor:'#E1E8DB',borderRadius:10}}>
   <Text style={{fontWeight:'600'}}>{row.worker||'Salarié'} · {({time:'Correction d’heures',pause:'Correction de pause',day:'Journée oubliée',leave:'Congé'} as Record<string,string>)[row.kind]}</Text>
   {row.before_start?<Text>Avant : {date(row.before_start)} → {date(row.before_end)}</Text>:null}
   <Text>Demande : {date(row.start)} → {date(row.end)}{row.kind==='pause'?' · '+(row.paid?'Payée':'Non payée'):''}</Text>
   {Array.isArray(row.breaks)?row.breaks.map((p,i)=><Text key={i}>Pause : {date(p.start)} → {date(p.end)} · {p.paid?'Payée':'Non payée'}</Text>):null}
   <Text>{row.reason||'Motif non précisé'}</Text>
   {button('Approuver',()=>void run(row,true))}
   {button('Refuser',()=>void run(row,false))}
  </View>)}
  {loaded&&!rows.length?<Text>Aucune demande dans vos périmètres.</Text>:null}
  <Text>Au maximum 100 demandes récentes par catégorie; les autoapprobations et les délégations révoquées sont refusées au serveur.</Text>
 </ScrollView>;
}
