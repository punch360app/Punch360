import React,{useEffect,useRef,useState} from 'react';
import {Alert,Linking,Pressable,ScrollView,Share,Text,TextInput,View} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {File} from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {validatedScheduleShift,validatedShiftCancellationReason} from './operations-schedule-validation';
type Row=Record<string,any>;
export function OperationsPanel({account,mode}:{account:WorkspaceAccount;mode:'schedule'|'documents'|'invite'}){
 const [jobs,setJobs]=useState<Row[]>([]),[members,setMembers]=useState<Row[]>([]),[shifts,setShifts]=useState<Row[]>([]),[docs,setDocs]=useState<Row[]>([]),[acks,setAcks]=useState<Row[]>([]),[job,setJob]=useState(account.defaultJobId||''),[user,setUser]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState(''),[note,setNote]=useState(''),[cancelReason,setCancelReason]=useState(''),[email,setEmail]=useState(''),[role,setRole]=useState('employee'),[token,setToken]=useState(''),[title,setTitle]=useState(''),[version,setVersion]=useState('1'),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 // A reused panel must never render another tenant's jobs, staff or docs.
 const scope=account.companyId+':'+account.userId;
 const scopeRef=useRef(scope);
 scopeRef.current=scope;
 const readRevision=useRef(0);
 const [loadedScope,setLoadedScope]=useState('');
 const manager=['boss','admin'].includes(account.role);
 const text=(v:string)=><Text style={{color:'white'}}>{v}</Text>;
 const button=(v:string,fn:()=>void)=><Pressable disabled={busy} onPress={fn} style={{padding:12,borderRadius:9,backgroundColor:'#29444F',opacity:busy?0.5:1}}>{text(v)}</Pressable>;
 const field=(hint:string,v:string,set:(v:string)=>void)=><TextInput accessibilityLabel={hint} placeholder={hint} value={v} onChangeText={set} autoCapitalize="none" placeholderTextColor="#9FB4C1" style={{padding:12,borderWidth:1,borderColor:'#36505A',color:'white',borderRadius:9}}/>;
 const card=(children:React.ReactNode)=><View style={{padding:14,gap:10,borderRadius:12,backgroundColor:'#112532',borderColor:'#36505A',borderWidth:1}}>{children}</View>;
 async function load(){
  const requestedScope=scope;
  if(scopeRef.current!==requestedScope)return;
  const revision=++readRevision.current;
  // Invitations must remain accessible even if private operations tables are
  // unavailable. Other screens read only the tables their content requires.
  if(mode==='invite'){
   if(scopeRef.current!==requestedScope||readRevision.current!==revision)return;
   setJobs([]);setMembers([]);setShifts([]);setDocs([]);setAcks([]);
   setLoadedScope(requestedScope);
   return;
  }
  const jobQuery=supabase.from('jobs').select('id,number,name').eq('company_id',account.companyId);
  const queries=mode==='schedule'?await Promise.all([
   jobQuery,
   supabase.from('company_members').select('user_id,role').eq('company_id',account.companyId).eq('status','active'),
   supabase.from('scheduled_shifts').select('*').eq('company_id',account.companyId).is('cancelled_at',null).order('starts_at')
  ]):await Promise.all([
   jobQuery,
   supabase.from('job_documents').select('*').eq('company_id',account.companyId).order('created_at',{ascending:false}),
   supabase.from('document_acknowledgements').select('document_id').eq('user_id',account.userId)
  ]);
  if(scopeRef.current!==requestedScope||readRevision.current!==revision)return;
  for(const result of queries){
   if(result.error)throw result.error;
   if(!Array.isArray(result.data))throw Error('Relevé des opérations incomplet. Réessayez.');
  }
  // Supabase types remain nullable even after the strict response check.
  setJobs((queries[0].data||[]) as Row[]);
  if(mode==='schedule'){
   setMembers((queries[1].data||[]) as Row[]);
   setShifts((queries[2].data||[]) as Row[]);
   setDocs([]);setAcks([]);
  }else{
   setMembers([]);setShifts([]);
   setDocs((queries[1].data||[]) as Row[]);
   setAcks((queries[2].data||[]) as Row[]);
  }
  setLoadedScope(requestedScope);
 }
 useEffect(()=>{
  const requestedScope=scope;
  ++readRevision.current;
  // Clear selection and previously rendered private rows on company/user change.
  setLoadedScope('');setJobs([]);setMembers([]);setShifts([]);
  setDocs([]);setAcks([]);setJob(account.defaultJobId||'');
  setUser('');setStart('');setEnd('');setNote('');setCancelReason('');setError('');setBusy(false);
  void load().catch(e=>{
   if(scopeRef.current===requestedScope)setError(e?.message||'Lecture des opérations impossible.');
  });
  return()=>{++readRevision.current};
 },[scope,mode]);
 async function run(fn:()=>Promise<void>){
  if(busy||loadedScope!==scope||scopeRef.current!==scope)return;
  const requestedScope=scope;
  setBusy(true);setError('');
  try{
   await fn();
   if(scopeRef.current===requestedScope)await load();
  }catch(e:any){
   if(scopeRef.current===requestedScope)setError(e?.message||'Opération non confirmée.');
  }finally{
   if(scopeRef.current===requestedScope)setBusy(false);
  }
 }
 const chooseJob=()=>account.edition==='essential'?null:jobs.map(j=><View key={j.id}>{button((job===j.id?'✓ ':'')+'#'+j.number+' — '+j.name,()=>setJob(j.id))}</View>);
 function confirmShiftCancellation(shift:Row){
  // Closing a shift is a consequential action: never use the scheduling
  // note as the cancellation reason or mutate without explicit confirmation.
  if(!manager||busy||loadedScope!==scope||scopeRef.current!==scope)return;
  if(!shifts.some(item=>item.id===shift.id)||
   (shift.company_id!=null&&shift.company_id!==account.companyId)){
   setError('Ce quart ne fait pas partie des opérations chargées de cette entreprise.');
   return;
  }
  let reason:string;
  try{reason=validatedShiftCancellationReason(cancelReason)}
  catch(e:any){setError(e?.message||'Motif d’annulation requis.');return;}
  const when=new Date(shift.starts_at).toLocaleString('fr-CA');
  Alert.alert('Confirmer l’annulation du quart',
   'Employé : '+String(shift.user_id||'—').slice(0,8)+
   '\\nDébut : '+when+'\\nMotif : '+reason+
   '\\nCette action sera enregistrée dans le suivi des quarts.',[
   {text:'Garder ce quart',style:'cancel'},
   {text:'Confirmer l’annulation',style:'destructive',onPress:()=>{
    // A confirmation modal may survive an account switch.
    if(scopeRef.current!==scope||loadedScope!==scope)return;
    void run(async()=>{
     const r=await supabase.rpc('cancel_shift',{p_shift:shift.id,p_reason:reason});
     if(r.error)throw r.error;
     if(scopeRef.current===scope)setCancelReason('');
    });
   }}
  ]);
 }
 async function upload(){if(!job||!title.trim()||!Number.isInteger(Number(version))||Number(version)<1)throw Error('Job, titre et version requis');const pick=await DocumentPicker.getDocumentAsync({type:'application/pdf',copyToCacheDirectory:true});if(pick.canceled)return;const asset=pick.assets[0];if((asset.size||0)>26214400)throw Error('PDF maximum 25 Mo');const bytes=await new File(asset.uri).arrayBuffer();if(bytes.byteLength>26214400||Array.from(new Uint8Array(bytes).slice(0,5)).join(',')!=='37,80,68,70,45')throw Error('PDF invalide');const path=account.companyId+'/'+job+'/'+Crypto.randomUUID()+'.pdf';const u=await supabase.storage.from('job-documents').upload(path,bytes,{contentType:'application/pdf',upsert:false});if(u.error)throw u.error;const r=await supabase.from('job_documents').insert({company_id:account.companyId,job_id:job,name:title.trim(),version:Number(version),storage_path:path,created_by:account.userId,requires_ack:true});if(r.error)throw r.error;setTitle('');}
 if(loadedScope!==scope)return <View style={{padding:14,gap:10}}>
  <Text style={{color:'white'}}>{error||'Chargement des opérations de cette entreprise…'}</Text>
  {error?<Pressable accessibilityRole="button" onPress={()=>{
   const requestedScope=scope;
   setError('');
   void load().catch(e=>{
    if(scopeRef.current===requestedScope)setError(e?.message||'Lecture des opérations impossible.');
   });
  }} style={{padding:12,borderRadius:9,backgroundColor:'#29444F'}}>
   {text('Réessayer le chargement')}
  </Pressable>:null}
 </View>;
 return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:12,paddingBottom:25}}>{error?<Text style={{color:'#FF9999'}}>{error}</Text>:null}{busy?text('Enregistrement…'):null}
 {mode==='schedule'?<>{manager?card(<>{text('Planifier un quart')}{chooseJob()}{members.map(m=><View key={m.user_id}>{button((user===m.user_id?'✓ ':'')+m.user_id.slice(0,8)+' · '+m.role,()=>setUser(m.user_id))}</View>)}{field('Début ISO avec fuseau',start,setStart)}{field('Fin ISO avec fuseau',end,setEnd)}{text('Exemple : 2026-11-03T07:00:00-05:00 · maximum 24 h')}{field('Note / motif',note,setNote)}{button('Planifier',()=>run(async()=>{
 const payload=validatedScheduleShift({companyId:account.companyId,userId:user,jobId:job,start,end,note});
 if(!members.some(m=>m.user_id===user)||!jobs.some(j=>j.id===job))
  throw Error('Sélectionne un employé actif et un chantier de cette entreprise.');
 const r=await supabase.rpc('schedule_shift',payload);
 if(r.error)throw r.error;
}))}</>):null}{manager&&shifts.length>0?card(<>{text('Annuler un quart · confirmation obligatoire')}{field('Motif d’annulation (minimum 3 caractères)',cancelReason,setCancelReason)}</>):null}{shifts.map(s=><View key={s.id}>{card(<>{text((account.edition==='essential'?'Affectation':'#'+(jobs.find(j=>j.id===s.job_id)?.number||'—'))+' · '+s.user_id.slice(0,8))}{text(new Date(s.starts_at).toLocaleString('fr-CA')+' → '+new Date(s.ends_at).toLocaleString('fr-CA'))}{text(s.note)}{manager?button('Demander l’annulation du quart',()=>confirmShiftCancellation(s)):null}</>)}</View>)}</>:null}
 {mode==='documents'?<>{manager?card(<>{text('Publier une révision PDF privée')}{chooseJob()}{field('Titre du document',title,setTitle)}{field('Numéro de version',version,setVersion)}{button('Choisir et publier un PDF',()=>run(upload))}</>):null}{docs.map(d=><View key={d.id}>{card(<>{text(d.name+' · v'+d.version)}{button('Ouvrir le PDF privé',()=>run(async()=>{const r=await supabase.storage.from('job-documents').createSignedUrl(d.storage_path,60);if(r.error)throw r.error;await Linking.openURL(r.data.signedUrl)}))}{d.requires_ack?(acks.some(a=>a.document_id===d.id)?text('✓ Lecture confirmée'):button('Confirmer la lecture de cette version',()=>run(async()=>{const r=await supabase.from('document_acknowledgements').insert({document_id:d.id,user_id:account.userId});if(r.error&&r.error.code!=='23505')throw r.error}))):null}</>)}</View>)}</>:null}
 {mode==='invite'?<>{manager?card(<>{text('Inviter un membre avec le rôle exact')}{text('Abonnement actif et place disponible requis. Aucun rôle Boss attribué aux invités.')}{field('Courriel du destinataire',email,setEmail)}{(['employee','lead','admin'] as const).map(r=><View key={r}>{button((role===r?'✓ ':'')+r,()=>setRole(r))}</View>)}{button('Créer et partager le lien (72 h)',()=>run(async()=>{const r=await supabase.rpc('create_company_invitation',{p_company:account.companyId,p_email:email,p_role:role,p_hours:72});if(r.error)throw r.error;await Share.share({message:'Rejoins notre compagnie PUNCH : https://punch360app.github.io/Punch360/?invite='+encodeURIComponent(r.data.token)})}))}</>):null}{card(<>{text('Rejoindre une compagnie par invitation')}{field('Code d’invitation',token,setToken)}{button('Accepter l’invitation',()=>run(async()=>{const r=await supabase.rpc('accept_company_invitation',{p_token:token});if(r.error)throw r.error;setToken('')}))}</>)}</>:null}
 </ScrollView>;
}
