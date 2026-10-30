import React,{useEffect,useRef,useState} from 'react';
import {AppState,Pressable,Text,TextInput,View} from 'react-native';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {createBreakPolicyScope,currentDepartmentPolicy,parseBreakPolicyMinutes} from './breakPolicyScope.js';

type Row=Record<string,any>;
type Token=ReturnType<ReturnType<typeof createBreakPolicyScope>['current']>;
const blank='Impossible de vérifier les politiques de pauses. Réessaie.';
const choices=['choice','paid','unpaid'];
const modeNames:Record<string,string>={choice:'Choix du salarié',paid:'Pauses payées',unpaid:'Pauses non payées'};

export function useBreakPolicy(account:WorkspaceAccount){
 const [policy,setPolicy]=useState<Row|null>(null);
 const scope=useRef(createBreakPolicyScope(account.companyId,account.userId,account.role));
 const alive=useRef(false),request=useRef(0);
 const latest=useRef({companyId:account.companyId,userId:account.userId,role:account.role});
 latest.current={companyId:account.companyId,userId:account.userId,role:account.role};
 const current=(token:Token)=>{
  const a=latest.current;
  return alive.current&&scope.current.allows(token)&&scope.current.matches(a.companyId,a.userId,a.role);
 };
 useEffect(()=>{
  const token=scope.current.enter(account.companyId,account.userId,account.role);
  alive.current=true;request.current++;setPolicy(null);
  const load=async()=>{
   if(!current(token))return;
   const sequence=++request.current;
   try{
    const r=await supabase.rpc('essential_worker_break_policy',{p_company:account.companyId});
    if(!current(token)||sequence!==request.current)return;
    setPolicy(r.error?null:(r.data??null));
   }catch{
    if(current(token)&&sequence===request.current)setPolicy(null);
   }
  };
  void load();
  const subscription=AppState.addEventListener('change',state=>{
   if(state==='active')void load();
  });
  return()=>{
   alive.current=false;scope.current.invalidate();request.current++;
   subscription.remove();
  };
 },[account.companyId,account.userId,account.role]);
 // The parent can render once with changed props before the cleanup effect runs.
 return scope.current.matches(account.companyId,account.userId,account.role)?policy:null;
}

export function BreakPoliciesPanel({account}:{account:WorkspaceAccount}){
 const [rows,setRows]=useState<Row[]>([]),[deps,setDeps]=useState<Row[]>([]);
 const [dep,setDep]=useState(''),[mode,setMode]=useState('choice');
 const [minutes,setMinutes]=useState(''),[after,setAfter]=useState(''),[reason,setReason]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false);
 const scope=useRef(createBreakPolicyScope(account.companyId,account.userId,account.role));
 const alive=useRef(false),sequence=useRef(0),actionLock=useRef(false);
 const latest=useRef({companyId:account.companyId,userId:account.userId,role:account.role});
 latest.current={companyId:account.companyId,userId:account.userId,role:account.role};
 const identityMatches=scope.current.matches(account.companyId,account.userId,account.role);
 const manager=account.role==='boss'||account.role==='admin';
 const current=(token:Token)=>{
  const a=latest.current;
  return alive.current&&scope.current.allows(token)&&scope.current.matches(a.companyId,a.userId,a.role);
 };
 const disabled=busy||loading||!loaded;

 function chooseDepartment(id:string,collection=rows){
  const p=currentDepartmentPolicy(collection,id,Date.now());
  setDep(id);setMode(choices.includes(p?.paid_mode)?p.paid_mode:'choice');
  setMinutes(p?.suggested_minutes==null?'':String(p.suggested_minutes));
  setAfter(p?.after_work_minutes==null?'':String(p.after_work_minutes));
 }
 async function load(token:Token=scope.current.current(),selected=dep){
  if(!current(token)||!manager)return false;
  const version=++sequence.current;
  setLoading(true);setLoaded(false);setNotice('');
  try{
   const [a,b]=await Promise.all([
    supabase.from('essential_departments').select('id,name').eq('company_id',account.companyId).eq('active',true).limit(500),
    supabase.from('essential_break_policies').select('*').eq('company_id',account.companyId).order('version',{ascending:false}).limit(900)
   ]);
   if(!current(token)||version!==sequence.current)return false;
   if(a.error||b.error||!Array.isArray(a.data)||!Array.isArray(b.data)||
      a.data.length>=500||b.data.length>=900)throw Error('incomplete');
   const available=a.data;
   const selectedId=available.some(d=>d.id===selected)?selected:(available[0]?.id||'');
   setDeps(available);setRows(b.data);
   chooseDepartment(selectedId,b.data);
   setLoaded(true);setError('');
   return true;
  }catch{
   if(current(token)&&version===sequence.current){
    setDeps([]);setRows([]);chooseDepartment('',[]);
    setLoaded(false);setError(blank);
   }
   return false;
  }finally{
   if(current(token)&&version===sequence.current)setLoading(false);
  }
 }
 useEffect(()=>{
  const token=scope.current.enter(account.companyId,account.userId,account.role);
  alive.current=true;sequence.current++;actionLock.current=false;
  setRows([]);setDeps([]);setDep('');setMode('choice');
  setMinutes('');setAfter('');setReason('');
  setError('');setNotice('');setBusy(false);setLoading(true);setLoaded(false);
  if(manager)void load(token,'');
  else{setLoading(false);setError('Accès réservé aux responsables autorisés.')}
  return()=>{alive.current=false;scope.current.invalidate();sequence.current++};
 },[account.companyId,account.userId,account.role]);

 async function run(task:(token:Token)=>Promise<void>){
  const token=scope.current.current();
  if(!identityMatches||!current(token)||!manager||!loaded||actionLock.current)return;
  actionLock.current=true;setBusy(true);setError('');setNotice('');
  try{await task(token)}
  catch{
   if(current(token))setError('Opération impossible ou version modifiée. Actualise puis réessaie.');
  }finally{if(current(token)){actionLock.current=false;setBusy(false)}}
 }
 async function save(token:Token){
  if(!current(token))return;
  if(!dep||!deps.some(d=>d.id===dep))throw Error('No active department');
  if(!choices.includes(mode))throw Error('Invalid policy');
  const reasonValue=reason.trim();
  if(reasonValue.length<3||reasonValue.length>1000)throw Error('Motif requis');
  const minValue=parseBreakPolicyMinutes(minutes,240,1);
  const afterValue=parseBreakPolicyMinutes(after,1440,0);
  const expectedVersion=Math.max(0,...rows.filter(p=>p.department_id===dep).map(p=>Number(p.version)||0));
  const result=await supabase.rpc('save_department_break_policy',{
   p_company:account.companyId,p_department:dep,p_expected_version:expectedVersion,
   p_mode:mode,p_minutes:minValue,p_after:afterValue,p_reason:reasonValue
  });
  if(!current(token))return;
  if(result.error)throw Error('Policy rejected');
  const verified=await load(token,dep);
  if(current(token)&&verified){
   setReason('');setNotice('Nouvelle version enregistrée; aucune pause passée modifiée.');
  }
 }
 const button=(label:string,onPress:()=>void)=><Pressable accessibilityRole="button" accessibilityLabel={label}
  disabled={disabled} accessibilityState={{disabled}} onPress={onPress}
  style={{minHeight:48,padding:12,justifyContent:'center',backgroundColor:'#edf2e9',borderRadius:8,opacity:disabled?0.5:1}}>
  <Text style={{color:'#2F4935'}}>{label}</Text>
 </Pressable>;
 const input=(label:string,value:string,onChangeText:(v:string)=>void,numeric=false)=><View style={{gap:5}}>
  <Text style={{color:'#2F4935'}}>{label}</Text>
  <TextInput accessibilityLabel={label} editable={!disabled} value={value} onChangeText={onChangeText}
   keyboardType={numeric?'number-pad':'default'} style={{minHeight:48,padding:12,borderWidth:1,borderColor:'#E1E8DB',borderRadius:8}}/>
 </View>;
 if(!identityMatches)return <View style={{padding:14}}>
  <Text accessibilityLiveRegion="polite">Changement de compte en cours…</Text>
 </View>;
 return <View style={{gap:12,padding:14}}>
  <Text style={{fontSize:22,color:'#2F4935'}}>Politiques de pauses</Text>
  <Text>Versions par département. Les pauses déjà enregistrées ne changent pas; aucune déduction automatique.</Text>
  {loading?<Text accessibilityLiveRegion="polite">Chargement des politiques…</Text>:null}
  {busy?<Text accessibilityLiveRegion="polite">Enregistrement en cours…</Text>:null}
  {error?<Text accessibilityRole="alert" style={{color:'#A1392D'}}>{error}</Text>:null}
  {notice?<Text accessibilityLiveRegion="polite">{notice}</Text>:null}
  {manager&&!loading&&!busy?<Pressable accessibilityRole="button" accessibilityLabel="Réessayer le chargement des politiques"
   onPress={()=>{setError('');void load()}} style={{minHeight:48,padding:12,justifyContent:'center',borderRadius:8,backgroundColor:'#edf2e9'}}>
   <Text style={{color:'#2F4935'}}>{loaded?'Actualiser':'Réessayer'}</Text>
  </Pressable>:null}
  {manager&&loaded?<>
   {deps.map(d=><View key={d.id}>{button((dep===d.id?'✓ ':'')+d.name,()=>chooseDepartment(d.id))}</View>)}
   {deps.length?<>
    {choices.map(value=><View key={value}>{button((mode===value?'✓ ':'')+modeNames[value],()=>setMode(value))}</View>)}
    {input('Durée indicative en minutes (facultatif)',minutes,setMinutes,true)}
    {input('Après combien de minutes (indicatif, facultatif)',after,setAfter,true)}
    {input('Motif de nouvelle version',reason,setReason)}
    {button('Enregistrer, effet dès maintenant',()=>void run(save))}
   </>:<Text>Créez un département pour définir sa politique.</Text>}
   {rows.map(p=><Text key={p.id} style={{color:'#2F4935'}}>
    {deps.find(d=>d.id===p.department_id)?.name||'Département'} · v{p.version} · {modeNames[p.paid_mode]||'Mode inconnu'} · {new Date(p.effective_at).toLocaleString('fr-CA')} · {p.reason}
   </Text>)}
  </>:null}
 </View>;
}
