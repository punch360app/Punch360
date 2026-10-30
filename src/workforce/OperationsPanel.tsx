import React,{useEffect,useRef,useState} from 'react';
import {Linking,Pressable,ScrollView,Share,Text,TextInput,View} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {File} from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {canCancelShift,canEditOperations,canReadCompanyDocument,createOperationsScope,operationsDraftJob,parseOperationsShiftDates,validOperationsJob} from './operationsScope.js';

type Row=Record<string,any>;
type Mode='schedule'|'documents'|'invite';
type Token=ReturnType<ReturnType<typeof createOperationsScope>['current']>;
const LIMIT=250,MAX_PDF=26214400;
const loadFailure='Impossible de charger les données de cet espace. Réessaie.';
const operationFailure='Opération impossible ou autorisation refusée. Vérifie puis réessaie.';
const safeDate=(v:unknown)=>{
 const d=Date.parse(String(v||''));return Number.isFinite(d)?new Date(d).toLocaleString('fr-CA'):'Date indisponible';
};
export function OperationsPanel({account,mode}:{account:WorkspaceAccount;mode:Mode}){
 const [jobs,setJobs]=useState<Row[]>([]),[members,setMembers]=useState<Row[]>([]),
  [shifts,setShifts]=useState<Row[]>([]),[docs,setDocs]=useState<Row[]>([]),[acks,setAcks]=useState<Row[]>([]);
 const [job,setJob]=useState(''),[user,setUser]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState(''),
  [note,setNote]=useState(''),[email,setEmail]=useState(''),[role,setRole]=useState('employee'),
  [inviteToken,setInviteToken]=useState(''),[title,setTitle]=useState(''),[version,setVersion]=useState('1');
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),
  [loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false);
 const scope=useRef(createOperationsScope(account,mode));
 const latest=useRef({account,mode});latest.current={account,mode};
 const alive=useRef(false),loadNumber=useRef(0),actionLock=useRef(false);
 const identityMatches=scope.current.matches(account,mode);
 const manager=canEditOperations(account.role);
 const disabled=!identityMatches||busy||loading||!loaded;
 const current=(token:Token)=>{
  const view=latest.current;return alive.current&&scope.current.allows(token)&&scope.current.matches(view.account,view.mode);
 };
 const text=(value:string)=><Text style={{color:'#F5FAF6',lineHeight:22}}>{value}</Text>;
 const card=(children:React.ReactNode)=><View style={{padding:14,gap:10,borderRadius:12,backgroundColor:'#112532',borderColor:'#36505A',borderWidth:1}}>{children}</View>;
 const button=(value:string,action:()=>void)=><Pressable accessibilityRole="button" accessibilityLabel={value}
  accessibilityState={{disabled}} disabled={disabled} onPress={action}
  style={{minHeight:48,justifyContent:'center',padding:12,borderRadius:9,backgroundColor:'#29444F',opacity:disabled?0.5:1}}>
  {text(value)}</Pressable>;
 const field=(label:string,value:string,change:(v:string)=>void)=><TextInput
  accessibilityLabel={label} placeholder={label} placeholderTextColor="#9FB4C1"
  value={value} onChangeText={change} editable={!disabled} autoCapitalize="none" maxLength={1000}
  style={{minHeight:48,padding:12,borderWidth:1,borderColor:'#36505A',color:'#FFFFFF',borderRadius:9}}/>;

 function clear(){
  setJobs([]);setMembers([]);setShifts([]);setDocs([]);setAcks([]);
  setJob('');setUser('');setStart('');setEnd('');setNote('');setEmail('');setRole('employee');
  setInviteToken('');setTitle('');setVersion('1');setError('');setNotice('');setBusy(false);
  setLoaded(false);setLoading(true);
 }
 async function load(token:Token=scope.current.current()){
  if(!current(token))return false;
  const id=++loadNumber.current;setLoading(true);setLoaded(false);
  try{
   const lists:Record<string,Row[]>={jobs:[],members:[],shifts:[],docs:[],acks:[]};
   // Only read the data needed by this tab, and always enforce the company scope.
   if(mode==='schedule'){
    const membersQuery=supabase.from('company_members').select('user_id,role')
     .eq('company_id',account.companyId).eq('status','active');
    let shiftsQuery=supabase.from('scheduled_shifts')
     .select('id,company_id,user_id,job_id,starts_at,ends_at,note,cancelled_at')
     .eq('company_id',account.companyId).is('cancelled_at',null).order('starts_at');
    if(account.role==='employee')shiftsQuery=shiftsQuery.eq('user_id',account.userId);
    const queries=await Promise.all([
     supabase.from('jobs').select('id,number,name').eq('company_id',account.companyId).limit(LIMIT),
     manager?membersQuery.limit(LIMIT):Promise.resolve({data:[],error:null}),
     shiftsQuery.limit(LIMIT)
    ]);
    if(!current(token)||id!==loadNumber.current)return false;
    if(queries.some(x=>x.error||!Array.isArray(x.data)||x.data.length>=LIMIT))throw Error('incomplete');
    lists.jobs=queries[0].data||[];
    lists.members=queries[1].data||[];
    lists.shifts=queries[2].data||[];
   }else if(mode==='documents'){
    const queries=await Promise.all([
     manager?supabase.from('jobs').select('id,number,name').eq('company_id',account.companyId).limit(LIMIT):
      Promise.resolve({data:[],error:null}),
     supabase.from('job_documents').select('id,company_id,job_id,name,version,requires_ack,storage_path,created_at')
      .eq('company_id',account.companyId).order('created_at',{ascending:false}).limit(LIMIT),
     supabase.from('document_acknowledgements').select('document_id').eq('user_id',account.userId).limit(LIMIT)
    ]);
    if(!current(token)||id!==loadNumber.current)return false;
    if(queries.some(x=>x.error||!Array.isArray(x.data)||x.data.length>=LIMIT))throw Error('incomplete');
    lists.jobs=queries[0].data||[];
    lists.docs=(queries[1].data||[]).filter(d=>canReadCompanyDocument(d,account));
    const docIds=new Set(lists.docs.map(d=>d.id));
    lists.acks=(queries[2].data||[]).filter(a=>docIds.has(a.document_id));
   }
   if(!current(token)||id!==loadNumber.current)return false;
   setJobs(lists.jobs);setMembers(lists.members);setShifts(lists.shifts);
   setDocs(lists.docs);setAcks(lists.acks);
   setJob(old=>operationsDraftJob(old||account.defaultJobId,lists.jobs));
   setUser(old=>lists.members.some(m=>m.user_id===old)?old:'');
   setError('');setLoaded(true);return true;
  }catch{
   if(current(token)&&id===loadNumber.current){
    setJobs([]);setMembers([]);setShifts([]);setDocs([]);setAcks([]);
    setLoaded(false);setError(loadFailure);
   }
   return false;
  }finally{
   if(current(token)&&id===loadNumber.current)setLoading(false);
  }
 }
 useEffect(()=>{
  const token=scope.current.enter(account,mode);
  alive.current=true;loadNumber.current++;actionLock.current=false;clear();
  void load(token);
  return()=>{alive.current=false;scope.current.invalidate();loadNumber.current++};
 },[account.companyId,account.userId,account.role,account.edition,account.defaultJobId,mode]);

 async function run(action:(token:Token)=>Promise<void>,reload=true){
  const token=scope.current.current();
  if(!identityMatches||!current(token)||disabled||actionLock.current)return;
  actionLock.current=true;setBusy(true);setError('');setNotice('');
  try{
   await action(token);
   if(!current(token))return;
   if(reload)await load(token);
   if(current(token))setNotice('Action enregistrée.'); 
  }catch{
   if(current(token))setError(operationFailure);
  }finally{
   if(current(token)){actionLock.current=false;setBusy(false)}
  }
 }
 async function checkedRpc(name:string,params:Row,token:Token){
  if(!current(token))throw Error('identity changed');
  const r=await supabase.rpc(name,params);
  if(!current(token))throw Error('identity changed');
  if(r.error)throw Error('permission denied');
  return r.data;
 }
 function chooseJob(){
  return account.edition==='essential'?null:jobs.map(j=><View key={j.id}>
   {button((job===j.id?'✓ ':'')+'#'+j.number+' — '+j.name,()=>setJob(j.id))}
  </View>);
 }
 function schedule(){
  if(!manager||!validOperationsJob(job,jobs)||!members.some(m=>m.user_id===user)){
   setError('Sélectionne un employé et un établissement autorisés.');return;
  }
  let dates:{start:string,end:string};
  try{dates=parseOperationsShiftDates(start,end)}catch{setError('Dates ISO avec fuseau valides requises, pour un quart de 24 h maximum.');return;}
  if(note.length>1000){setError('Note trop longue.');return;}
  void run(async token=>{
   await checkedRpc('schedule_shift',{p_company:account.companyId,p_user:user,p_job:job,
    p_start:dates.start,p_end:dates.end,p_note:note.trim()},token);
   if(current(token)){setStart('');setEnd('');setNote('')}
  });
 }
 function cancelShift(shift:Row){
  if(!canCancelShift(shift,account)||!shifts.some(s=>s.id===shift.id))return;
  const reason=note.trim();
  if(reason.length<3){setError('Motif d’annulation d’au moins 3 caractères requis.');return;}
  void run(async token=>{await checkedRpc('cancel_shift',{p_shift:shift.id,p_reason:reason},token)});
 }
 async function upload(token:Token){
  if(!manager||!validOperationsJob(job,jobs)||!title.trim()||
   !/^[0-9]+$/.test(version)||!Number.isSafeInteger(Number(version))||Number(version)<1){
   throw Error('invalid input');
  }
  const selectedJob=job,selectedTitle=title.trim(),selectedVersion=Number(version);
  if(selectedTitle.length>1000)throw Error('invalid title');
  const pick=await DocumentPicker.getDocumentAsync({type:'application/pdf',copyToCacheDirectory:true});
  if(!current(token)||pick.canceled)return;
  const asset=pick.assets?.[0];
  if(!asset||asset.size&&asset.size>MAX_PDF)throw Error('pdf too large');
  const bytes=await new File(asset.uri).arrayBuffer();
  if(!current(token))return;
  if(bytes.byteLength>MAX_PDF||bytes.byteLength<5||
   Array.from(new Uint8Array(bytes).slice(0,5)).join(',')!=='37,80,68,70,45')throw Error('bad pdf');
  // Do not start Storage upload after account/tab changes while the picker or read is pending.
  if(!current(token))throw Error('identity changed');
  const path=account.companyId+'/'+selectedJob+'/'+Crypto.randomUUID()+'.pdf';
  const uploaded=await supabase.storage.from('job-documents').upload(path,bytes,{contentType:'application/pdf',upsert:false});
  if(!current(token))return; // An already-started upload cannot be rolled back from the client.
  if(uploaded.error)throw Error('storage rejected');
  if(!current(token))throw Error('identity changed');
  const inserted=await supabase.from('job_documents').insert({company_id:account.companyId,job_id:selectedJob,
   name:selectedTitle,version:selectedVersion,storage_path:path,created_by:account.userId,requires_ack:true});
  if(!current(token))return;
  if(inserted.error)throw Error('database rejected');
  setTitle('');
 }
 function openDocument(doc:Row){
  if(!canReadCompanyDocument(doc,account)||!docs.some(d=>d.id===doc.id))return;
  void run(async token=>{
   if(!current(token))throw Error('identity changed');
   const r=await supabase.storage.from('job-documents').createSignedUrl(doc.storage_path,60);
   if(!current(token))return;
   if(r.error||!r.data?.signedUrl)throw Error('denied');
   if(!current(token))throw Error('identity changed');
   await Linking.openURL(r.data.signedUrl);
  },false);
 }
 function acknowledge(doc:Row){
  if(!canReadCompanyDocument(doc,account)||!docs.some(d=>d.id===doc.id)||!doc.requires_ack||
   acks.some(a=>a.document_id===doc.id))return;
  void run(async token=>{
   if(!current(token))throw Error('identity changed');
   const r=await supabase.from('document_acknowledgements').insert({document_id:doc.id,user_id:account.userId});
   if(!current(token))return;
   if(r.error&&r.error.code!=='23505')throw Error('ack denied');
  });
 }
 function invite(){
  if(!manager||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())||
   !['employee','lead','admin'].includes(role)){
   setError('Courriel et rôle d’invitation valides requis.');return;
  }
  const recipient=email.trim().toLowerCase(),selectedRole=role;
  void run(async token=>{
   const r=await checkedRpc('create_company_invitation',{p_company:account.companyId,
    p_email:recipient,p_role:selectedRole,p_hours:72},token);
   if(!current(token)||typeof r?.token!=='string'||!r.token)return;
   // No invitation token is displayed or shared after the active account has changed.
   if(!current(token))throw Error('identity changed');
   await Share.share({message:'Rejoins notre compagnie PUNCH : https://punch360app.github.io/Punch360/?invite='+encodeURIComponent(r.token)});
   if(current(token))setEmail('');
  });
 }
 function acceptInvite(){
  const code=inviteToken.trim();
  if(!code||code.length>1000){setError('Code d’invitation requis.');return;}
  void run(async token=>{
   await checkedRpc('accept_company_invitation',{p_token:code},token);
   if(current(token))setInviteToken('');
  },false);
 }
 if(!identityMatches)return <View style={{padding:16}}>
  <Text accessibilityLiveRegion="polite">Changement de compte en cours…</Text>
 </View>;
 return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:12,padding:16,paddingBottom:25}}>
  {loading?<Text accessibilityLiveRegion="polite">Chargement des opérations…</Text>:null}
  {busy?<Text accessibilityLiveRegion="polite">Traitement en cours…</Text>:null}
  {error?<Text accessibilityRole="alert" style={{color:'#A1392D'}}>{error}</Text>:null}
  {notice?<Text accessibilityLiveRegion="polite" style={{color:'#2F4935'}}>{notice}</Text>:null}
  {!loading&&!busy?<Pressable accessibilityRole="button" accessibilityLabel="Réessayer le chargement des opérations"
   onPress={()=>{setError('');void load()}}
   style={{minHeight:48,padding:12,borderRadius:9,backgroundColor:'#29444F',justifyContent:'center'}}>
   {text(loaded?'Actualiser':'Réessayer')}</Pressable>:null}
  {loaded&&mode==='schedule'?<>
   {manager?card(<>
    {text('Planifier un quart')}{chooseJob()}
    {members.map(m=><View key={m.user_id}>
     {button((user===m.user_id?'✓ ':'')+String(m.user_id).slice(0,8)+' · '+m.role,()=>setUser(m.user_id))}
    </View>)}
    {field('Début ISO avec fuseau',start,setStart)}{field('Fin ISO avec fuseau',end,setEnd)}
    {field('Note / motif',note,setNote)}{button('Planifier',schedule)}
   </>):null}
   {shifts.map(s=><View key={s.id}>{card(<>
    {text((account.edition==='essential'?'Affectation':'#'+(jobs.find(j=>j.id===s.job_id)?.number||'—'))+' · '+String(s.user_id).slice(0,8))}
    {text(safeDate(s.starts_at)+' → '+safeDate(s.ends_at))}
    {text(String(s.note||''))}
    {canCancelShift(s,account)?button('Annuler ce quart (motif dans le formulaire)',()=>cancelShift(s)):null}
   </>)}</View>)}
  </>:null}
  {loaded&&mode==='documents'?<>
   {manager?card(<>
    {text('Publier une révision PDF privée')}{chooseJob()}
    {field('Titre du document',title,setTitle)}{field('Numéro de version',version,setVersion)}
    {button('Choisir et publier un PDF',()=>void run(upload))}
   </>):null}
   {docs.map(d=><View key={d.id}>{card(<>
    {text(String(d.name)+' · v'+d.version)}
    {button('Ouvrir le PDF privé',()=>openDocument(d))}
    {d.requires_ack?(acks.some(a=>a.document_id===d.id)?text('✓ Lecture confirmée'):
     button('Confirmer la lecture de cette version',()=>acknowledge(d))):null}
   </>)}</View>)}
  </>:null}
  {loaded&&mode==='invite'?<>
   {manager?card(<>
    {text('Inviter un membre avec le rôle exact')}
    {text('Abonnement actif et place disponible requis. Aucun rôle Boss attribué aux invités.')}
    {field('Courriel du destinataire',email,setEmail)}
    {(['employee','lead','admin'] as const).map(r=><View key={r}>
     {button((role===r?'✓ ':'')+r,()=>setRole(r))}
    </View>)}
    {button('Créer et partager le lien (72 h)',invite)}
   </>):null}
   {card(<>
    {text('Rejoindre une compagnie par invitation')}
    {field('Code d’invitation',inviteToken,setInviteToken)}
    {button('Accepter l’invitation',acceptInvite)}
   </>)}
  </>:null}
 </ScrollView>;
}
