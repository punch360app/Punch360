import React,{useEffect,useRef,useState} from 'react';
import {Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {File,Paths} from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Crypto from 'expo-crypto';
import {payrollExportCSV,payrollFields} from '../../web/live/payroll-export.js';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {canUsePayrollPreview,createPayrollExportScope,mayUsePayrollExport,payrollDefaultColumns,
 payrollPrivateRows,payrollRequestKey,validExportFilename,validPayrollMapping,
 validatePayrollProfile} from './payrollExportScope.js';

type Row=Record<string,any>;
type Column={key:string;header:string};
type Token=ReturnType<ReturnType<typeof createPayrollExportScope>['current']>;
const emptyColumns=()=>payrollDefaultColumns() as Column[];
const errorLoad='Profils de paie indisponibles ou incomplets. Vérifie les permissions puis réessaie.';
const errorAction='Action non confirmée ou autorisation refusée. Actualise avant de réessayer.';
const border='#E1E8DB',ink='#2F4935';
export function PayrollExportPanel({account,workers,estimate}:{account:WorkspaceAccount;workers:Row[];estimate:Row|null}){
 const [profiles,setProfiles]=useState<Row[]>([]),[mappings,setMappings]=useState<Row[]>([]);
 const [selected,setSelected]=useState(''),[name,setName]=useState('');
 const [delimiter,setDelimiter]=useState(','),[active,setActive]=useState(true);
 const [columns,setColumns]=useState<Column[]>(emptyColumns);
 const [worker,setWorker]=useState(''),[external,setExternal]=useState(''),[reason,setReason]=useState('');
 const [preview,setPreview]=useState<Row|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false);
 const scope=useRef(createPayrollExportScope(account,estimate));
 const latest=useRef({account,estimate});latest.current={account,estimate};
 const alive=useRef(false),loadId=useRef(0),actionLock=useRef(false);
 const request=useRef<{key:string;id:string}|null>(null);
 const identityMatches=scope.current.matches(account,estimate);
 const current=(token:Token)=>alive.current&&scope.current.allows(token)&&
  scope.current.matches(latest.current.account,latest.current.estimate);
 const allowed=mayUsePayrollExport(account);
 const disabled=!identityMatches||busy||loading||!loaded||!allowed;
 const profile=profiles.find(p=>p.id===selected);
 const workersAvailable=Array.isArray(workers)&&workers.length<=500?
  workers.filter(w=>w?.id&&(!w.company_id||w.company_id===account.companyId)):[];
 const safePreview=canUsePayrollPreview(preview,account,estimate,profile)?preview:null;
 const text=(value:string)=><Text style={{color:ink,lineHeight:20}}>{value}</Text>;
 const button=(caption:string,fn:()=>void,blocked=false)=><Pressable accessibilityRole="button"
  accessibilityLabel={caption} accessibilityState={{disabled:disabled||blocked}}
  disabled={disabled||blocked} onPress={fn}
  style={{minHeight:48,padding:12,justifyContent:'center',borderRadius:9,
   backgroundColor:border,opacity:disabled||blocked?0.5:1}}>
  {text(caption)}
 </Pressable>;
 const field=(label:string,value:string,set:(v:string)=>void,limit=100)=><View style={{gap:4}}>
  {text(label)}<TextInput accessibilityLabel={label} value={value} editable={!disabled}
   maxLength={limit} onChangeText={v=>{set(v);setPreview(null);request.current=null}}
   style={{padding:12,minHeight:48,borderWidth:1,borderColor:border,borderRadius:8,color:ink}}/>
 </View>;
 function clearPreview(){setPreview(null);request.current=null;setNotice('')}
 async function rpc(name:string,args:Row,token:Token){
  if(!current(token))throw Error('Compte ou rapport modifié');
  const r=await supabase.rpc(name,args);
  if(!current(token))throw Error('Compte ou rapport modifié');
  if(r.error)throw Error('RPC refusée');
  return r.data;
 }
 async function load(token:Token=scope.current.current()){
  if(!current(token)||!allowed)return false;
  const id=++loadId.current;
  setLoading(true);setLoaded(false);setPreview(null);
  try{
   const [p,m]=await Promise.all([
    supabase.from('essential_payroll_export_profiles')
     .select('id,company_id,name,version,columns,delimiter,active')
     .eq('company_id',account.companyId).limit(1001),
    supabase.from('essential_payroll_worker_mappings')
     .select('company_id,profile_id,worker_id,external_id,version')
     .eq('company_id',account.companyId).limit(1001)
   ]);
   if(!current(token)||loadId.current!==id)return false;
   if(p.error||m.error)throw Error('Lecture refusée');
   const profileRows=payrollPrivateRows(p.data,account.companyId);
   const mappingRows=payrollPrivateRows(m.data,account.companyId);
   if(mappingRows.some(row=>!profileRows.some(x=>x.id===row.profile_id)))
    throw Error('Références absentes');
   setProfiles(profileRows);setMappings(mappingRows);
   setSelected(value=>profileRows.some(row=>row.id===value)?value:'');
   setLoaded(true);setError('');return true;
  }catch{
   if(current(token)&&loadId.current===id){
    setProfiles([]);setMappings([]);setPreview(null);setLoaded(false);setError(errorLoad);
   }
   return false;
  }finally{if(current(token)&&loadId.current===id)setLoading(false)}
 }
 useEffect(()=>{
  const token=scope.current.enter(account,estimate);
  alive.current=true;loadId.current++;actionLock.current=false;request.current=null;
  setProfiles([]);setMappings([]);setSelected('');setName('');setDelimiter(',');
  setActive(true);setColumns(emptyColumns());setWorker('');setExternal('');setReason('');
  setPreview(null);setError('');setNotice('');setBusy(false);setLoading(true);setLoaded(false);
  if(allowed)void load(token);
  else{setLoading(false);setError('Export réservé aux responsables autorisés de l’édition Essentiel.')}
  return()=>{alive.current=false;scope.current.invalidate();loadId.current++};
 },[account.companyId,account.userId,account.role,account.edition,
   estimate?.id,estimate?.company_id,estimate?.week_start,estimate?.payload?.generated_at,
   estimate?.payload?.rule_version]);
 async function run(action:(token:Token)=>Promise<void>,refresh=false){
  const token=scope.current.current();
  if(!current(token)||disabled||actionLock.current)return;
  actionLock.current=true;setBusy(true);setError('');setNotice('');
  try{
   await action(token);
   if(!current(token))return;
   if(refresh){const ok=await load(token);if(current(token)&&ok)setNotice('Profils actualisés.')}
   else setNotice('Opération terminée.');
  }catch{if(current(token))setError(errorAction)}
  finally{if(current(token)){actionLock.current=false;setBusy(false)}}
 }
 function selectProfile(id:string){
  if(disabled)return;
  if(id&&!profiles.some(p=>p.id===id))return;
  const p=profiles.find(x=>x.id===id);
  setSelected(id);setName(String(p?.name||''));setDelimiter(String(p?.delimiter||','));
  setActive(p?.active??true);
  setColumns(p?.columns?.map((c:Row)=>({key:String(c.key),header:String(c.header)}))||emptyColumns());
  setWorker('');setExternal('');setPreview(null);request.current=null;setNotice('');
 }
 function saveProfile(){
  let valid:{name:string;columns:Column[];reason:string};
  try{valid=validatePayrollProfile(name,delimiter,columns,reason)}
  catch{setError('Nom, colonnes, séparateur ou motif invalide.');return}
  const selectedProfile=profile;
  void run(async token=>{
   const id=await rpc('save_payroll_export_profile',{
    p_company:account.companyId,p_id:selectedProfile?.id||null,
    p_version:selectedProfile?.version||0,p_name:valid.name,
    p_columns:valid.columns,p_delimiter:delimiter,p_active:active,p_reason:valid.reason
   },token);
   if(current(token)){clearPreview();setSelected(String(id));setName(valid.name)}
  },true);
 }
 function mapWorker(){
  if(!profile)return;
  let values:{worker:string;external:string;reason:string};
  try{values=validPayrollMapping(worker,external,reason,workersAvailable)}
  catch{setError('Employé, matricule ou motif invalide.');return}
  const p=profile;
  const mapping=mappings.find(m=>m.profile_id===p.id&&m.worker_id===values.worker);
  void run(async token=>{
   await rpc('save_payroll_worker_mapping',{
    p_profile:p.id,p_worker:values.worker,p_external:values.external,
    p_version:mapping?.version||0,p_reason:values.reason
   },token);
   if(current(token)){clearPreview();setExternal(values.external)}
  },true);
 }
 function prepare(){
  if(!profile||!profile.active||!estimate||estimate.company_id!==account.companyId){
   setError('Profil actif et rapport de cette entreprise requis.');return;
  }
  const p=profile,e=estimate;
  const key=payrollRequestKey(account,p,e);
  if(request.current?.key!==key)request.current={key,id:Crypto.randomUUID()};
  const id=request.current.id;
  void run(async token=>{
   const response=await rpc('prepare_payroll_export',{
    p_profile:p.id,p_profile_version:p.version,p_estimate:e.id,p_request:id
   },token);
   if(!current(token))return;
   if(!canUsePayrollPreview(response,account,e,p))throw Error('Aperçu invalide');
   setPreview(response);
  });
 }
 function share(){
  const snapshot=safePreview,p=profile,e=estimate;
  if(!snapshot||!p||!e){setError('Prépare un nouvel aperçu pour ce rapport.');return}
  void run(async token=>{
   if(!current(token)||!canUsePayrollPreview(snapshot,account,e,p))throw Error('Aperçu périmé');
   const csv=payrollExportCSV(snapshot.payload);
   const filename=validExportFilename(snapshot);
   if(!current(token))throw Error('Compte modifié');
   const sharing=await Sharing.isAvailableAsync();
   if(!current(token))return;
   if(!sharing)throw Error('Partage non disponible');
   const file=new File(Paths.cache,filename);
   try{
    if(!current(token))throw Error('Compte modifié');
    file.create({overwrite:true});
    file.write('\ufeff'+csv);
    if(!current(token)||!canUsePayrollPreview(snapshot,latest.current.account,latest.current.estimate,p))return;
    // Once the native sharing sheet is opened, its outcome is controlled by the device/user.
    await Sharing.shareAsync(file.uri,{mimeType:'text/csv',dialogTitle:'Partager l’aperçu préparatoire'});
   }finally{if(file.exists)file.delete()}
  });
 }
 if(!identityMatches)return <View style={{padding:15}}>
  <Text accessibilityLiveRegion="polite">Changement de compte ou de rapport en cours…</Text>
 </View>;
 if(!allowed)return <View style={{padding:15}}>
  <Text accessibilityRole="alert">Export de paie réservé aux responsables autorisés de l’édition Essentiel.</Text>
 </View>;
 return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:12,padding:15}}>
  <Text style={{fontSize:20,fontWeight:'700',color:ink}}>Export vers votre logiciel de paie</Text>
  {text('Format d’import à valider avec le fournisseur. Semaine fermée et matricules requis. Aucune transmission automatique.')}
  {loading?text('Chargement des profils de paie…'):null}
  {busy?text('Traitement en cours…'):null}
  {error?<Text accessibilityRole="alert" style={{color:'#9D4036'}}>{error}</Text>:null}
  {notice?<Text accessibilityLiveRegion="polite">{notice}</Text>:null}
  {!loading&&!busy?<Pressable accessibilityRole="button" accessibilityLabel="Réessayer le chargement"
   onPress={()=>{setError('');void load()}}
   style={{padding:12,minHeight:48,justifyContent:'center',backgroundColor:border,borderRadius:8}}>
   {text(loaded?'Actualiser':'Réessayer')}
  </Pressable>:null}
  {loaded?<>
   {button('Nouveau profil',()=>selectProfile(''))}
   {profiles.map(p=><View key={p.id}>{button(p.name+' · v'+p.version+(p.active?'':' (désactivé)'),
    ()=>selectProfile(p.id))}</View>)}
   {field('Nom du format',name,setName,100)}
   {button('Séparateur : '+(delimiter===','?'virgule':'point-virgule'),()=>{
    setDelimiter(delimiter===','?';':',');clearPreview();
   })}
   {button(active?'Profil actif':'Profil désactivé',()=>{setActive(!active);clearPreview()})}
   {text('Colonnes et en-têtes')}
   {payrollFields.map(([key,label]:string[])=>{
    const col=columns.find(c=>c.key===key);
    return <View key={key}>
     <Pressable accessibilityRole="checkbox" accessibilityLabel={label}
      accessibilityState={{checked:!!col,disabled:disabled||key==='external_id'}}
      disabled={disabled||key==='external_id'} onPress={()=>{
       setColumns(old=>col?old.filter(c=>c.key!==key):[...old,{key,header:label}]);clearPreview();
      }} style={{padding:12,minHeight:48,justifyContent:'center'}}>
      {text((col?'✓ ':'○ ')+label)}
     </Pressable>
     {col?field('En-tête '+label,col.header,v=>{setColumns(old=>old.map(c=>c.key===key?{...c,header:v}:c));clearPreview()},80):null}
    </View>;
   })}
   {field('Motif',reason,setReason,1000)}
   {button('Enregistrer le profil',saveProfile)}
   {profile?<>
    {text('Correspondance des matricules')}
    {workersAvailable.map(w=><View key={w.id}>
     {button((worker===w.id?'✓ ':'')+String(w.name||[w.first_name,w.last_name].filter(Boolean).join(' ')),
      ()=>{setWorker(w.id);setExternal('');clearPreview()})}
    </View>)}
    {text('Matricule actuel : '+String(mappings.find(m=>m.profile_id===selected&&m.worker_id===worker)?.external_id||'Non configuré'))}
    {field('Matricule fournisseur',external,setExternal,80)}
    {button('Enregistrer la correspondance',mapWorker,!worker)}
    {button('Préparer l’aperçu du rapport sélectionné',prepare,!estimate||!profile.active)}
   </>:null}
   {safePreview?<>
    {text('Semaine du '+String(safePreview.payload.week)+' · '+String(safePreview.payload.profile_name)+
     ' v'+String(safePreview.payload.profile_version))}
    {text(String(safePreview.payload.notice||''))}
    <Text selectable style={{fontFamily:'monospace',color:ink}}>{payrollExportCSV(safePreview.payload)}</Text>
    {button('Partager cet aperçu CSV',share)}
   </>:null}
  </>:null}
 </ScrollView>;
}
