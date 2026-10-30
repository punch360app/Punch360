import {PushDevicesPanel} from './PushDevicesPanel';
import {NotificationPreferencesPanel} from './NotificationPreferencesPanel';
import React,{useEffect,useRef,useState} from 'react';
import {Alert,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {canAdministerGeofence,canReadNotification,canReviewLocation,canReviewOfflineBreak,createGeofenceScope,geofenceJobAllowed,geofenceRadiusPayload,geofenceReviewPayload} from './geofenceScope.js';

type Row=Record<string,any>;
type Token=ReturnType<ReturnType<typeof createGeofenceScope>['current']>;
const locLabels:Record<string,string>={inside:'Dans le rayon',outside:'Hors rayon',missing:'GPS absent',inaccurate:'GPS imprécis',job_unconfigured:'Chantier sans coordonnées'};
const genericFailure='Impossible de charger les validations de ce compte. Réessaie.';
const genericAction='Opération impossible ou autorisation refusée. Vérifie puis réessaie.';
const dateLabel=(value:unknown)=>{
 const ms=Date.parse(String(value||''));return Number.isFinite(ms)?new Date(ms).toLocaleString('fr-CA'):'Date à vérifier';
};
function guardedRows(result:Row,limit:number):Row[]{
 if(result.error||!Array.isArray(result.data)||result.data.length>=limit)throw Error('incomplete');
 return result.data;
}
export function GeofencePanel({account}:{account:WorkspaceAccount}){
 const [jobs,setJobs]=useState<Row[]>([]),[checks,setChecks]=useState<Row[]>([]);
 const [notifications,setNotifications]=useState<Row[]>([]),[receipts,setReceipts]=useState<Row[]>([]);
 const [selected,setSelected]=useState(''),[lat,setLat]=useState(''),[lon,setLon]=useState(''),[radius,setRadius]=useState('200');
 const [note,setNote]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const scope=useRef(createGeofenceScope(account));
 const latest=useRef(account);latest.current=account;
 const alive=useRef(false),loadId=useRef(0),actionLock=useRef(false);
 const identityMatches=scope.current.matches(account),manager=canAdministerGeofence(account);
 const current=(token:Token)=>alive.current&&scope.current.allows(token)&&scope.current.matches(latest.current);
 const disabled=busy||loading||!loaded||!identityMatches;
 const label=(value:string)=><Text style={{color:'#FFFFFF',fontSize:14,lineHeight:21}}>{value}</Text>;
 const card=(children:React.ReactNode)=><View style={{padding:14,gap:10,borderRadius:12,backgroundColor:'#112532',borderColor:'#36505A',borderWidth:1}}>{children}</View>;
 const button=(title:string,onPress:()=>void)=><Pressable accessibilityRole="button" accessibilityLabel={title}
  accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
  style={{minHeight:48,padding:12,justifyContent:'center',borderRadius:9,backgroundColor:'#29444F',opacity:disabled?0.5:1}}>
  {label(title)}</Pressable>;
 const field=(hint:string,value:string,onChangeText:(v:string)=>void)=><TextInput
  accessibilityLabel={hint} placeholder={hint} placeholderTextColor="#9FB4C1"
  value={value} onChangeText={onChangeText} editable={!disabled} maxLength={1000}
  autoCapitalize="none" style={{minHeight:48,padding:12,borderWidth:1,borderColor:'#36505A',color:'#FFFFFF',borderRadius:8}}/>;

 async function load(token:Token=scope.current.current()){
  if(!current(token))return false;
  const id=++loadId.current;setLoading(true);setLoaded(false);setNotice('');
  try{
   let checksQuery=supabase.from('punch_location_checks')
    .select('id,company_id,job_id,user_id,action,review_status,location_status,offline,recorded_at,distance_m,radius_m,accuracy_m')
    .eq('company_id',account.companyId).order('recorded_at',{ascending:false});
   let receiptsQuery=supabase.from('punch_event_receipts')
    .select('company_id,user_id,event_id,action,occurred_at,result')
    .eq('company_id',account.companyId).order('received_at',{ascending:false});
   if(!manager){
    checksQuery=checksQuery.eq('user_id',account.userId);
    receiptsQuery=receiptsQuery.eq('user_id',account.userId);
   }
   const [jobRows,checkRows,notificationRows,receiptRows]=await Promise.all([
    manager?supabase.from('jobs').select('id,company_id,number,name,latitude,longitude,punch_radius_m')
     .eq('company_id',account.companyId).limit(250):Promise.resolve({data:[],error:null}),
    checksQuery.limit(200),
    supabase.from('app_notifications').select('id,company_id,recipient_id,title,body,read_at')
     .eq('company_id',account.companyId).eq('recipient_id',account.userId).order('created_at',{ascending:false}).limit(100),
    receiptsQuery.limit(200)
   ]);
   if(!current(token)||id!==loadId.current)return false;
   const nextJobs=guardedRows(jobRows,250),nextChecks=guardedRows(checkRows,200);
   const nextNotifications=guardedRows(notificationRows,100),nextReceipts=guardedRows(receiptRows,200);
   setJobs(nextJobs);setChecks(nextChecks);setNotifications(nextNotifications);setReceipts(nextReceipts);
   if(!nextJobs.some(j=>j.id===selected)){
    setSelected('');setLat('');setLon('');setRadius('200');
   }
   setError('');setLoaded(true);return true;
  }catch{
   if(current(token)&&id===loadId.current){
    setJobs([]);setChecks([]);setNotifications([]);setReceipts([]);
    setSelected('');setLat('');setLon('');setRadius('200');
    setLoaded(false);setError(genericFailure);
   }
   return false;
  }finally{
   if(current(token)&&id===loadId.current)setLoading(false);
  }
 }
 useEffect(()=>{
  const token=scope.current.enter(account);
  alive.current=true;loadId.current++;actionLock.current=false;
  setJobs([]);setChecks([]);setNotifications([]);setReceipts([]);
  setSelected('');setLat('');setLon('');setRadius('200');setNote('');setStart('');setEnd('');
  setBusy(false);setLoading(true);setLoaded(false);setError('');setNotice('');
  void load(token);
  return()=>{alive.current=false;scope.current.invalidate();loadId.current++};
 },[account.companyId,account.userId,account.role,account.edition]);

 async function checkedRpc(name:string,payload:Row,token:Token){
  if(!current(token))throw Error('Compte modifié');
  const r=await supabase.rpc(name,payload);
  if(!current(token))throw Error('Compte modifié');
  if(r.error)throw Error('Accès refusé');
  return r.data;
 }
 async function run(action:(token:Token)=>Promise<void>){
  const token=scope.current.current();
  if(!identityMatches||!current(token)||disabled||actionLock.current)return;
  actionLock.current=true;setBusy(true);setError('');setNotice('');
  try{
   await action(token);
   if(!current(token))return;
   const ok=await load(token);
   if(current(token)&&ok)setNotice('Données actualisées.');
  }catch{
   if(current(token))setError(genericAction);
  }finally{
   if(current(token)){actionLock.current=false;setBusy(false)}
  }
 }
 function selectJob(j:Row){
  if(!manager||!geofenceJobAllowed(j.id,jobs))return;
  setSelected(j.id);setLat(j.latitude==null?'':String(j.latitude));
  setLon(j.longitude==null?'':String(j.longitude));setRadius(String(j.punch_radius_m??200));
 }
 function saveRadius(){
  if(!manager||!geofenceJobAllowed(selected,jobs))return;
  let payload:Row;
  try{payload=geofenceRadiusPayload(lat,lon,radius)}
  catch{setError('Latitude (-90 à 90), longitude (-180 à 180) et rayon de 10 à 10000 m requis.');return;}
  void run(async token=>{
   if(!current(token))throw Error('Compte modifié');
   const r=await supabase.from('jobs').update(payload).eq('company_id',account.companyId)
    .eq('id',selected).select('id').single();
   if(!current(token))return;
   if(r.error||!r.data?.id)throw Error('Accès refusé');
  });
 }
 function review(check:Row,correct:boolean){
  if(!canReviewLocation(check,account,checks))return;
  let payload:Row;
  try{payload=geofenceReviewPayload(note,start,end,correct)}
  catch(e){setError(e instanceof Error?e.message:'Motif et heures à vérifier.');return;}
  void run(async token=>{
   await checkedRpc('review_punch_location',{p_check:check.id,...payload},token);
   if(!current(token))return;
   setNote('');setStart('');setEnd('');
   Alert.alert(correct?'Correction soumise':'Punch accepté',correct?
    'Le serveur a traité la correction. Vérifie la période avant la paie.':
    'La validation a été enregistrée.');
  });
 }
 function reviewBreak(receipt:Row){
  if(!canReviewOfflineBreak(receipt,account,receipts))return;
  const reason=note.trim();
  if(reason.length<3||reason.length>1000){setError('Motif de 3 à 1000 caractères requis.');return;}
  void run(async token=>{
   await checkedRpc('review_break_event',{p_company:account.companyId,p_worker:receipt.user_id,
    p_event:receipt.event_id,p_note:reason},token);
   if(current(token))setNote('');
  });
 }
 function readNotification(notification:Row){
  if(!canReadNotification(notification,account,notifications)||notification.read_at)return;
  void run(async token=>{
   if(!current(token))throw Error('Compte modifié');
   const r=await supabase.from('app_notifications').update({read_at:new Date().toISOString()})
    .eq('company_id',account.companyId).eq('recipient_id',account.userId)
    .eq('id',notification.id).select('id').single();
   if(!current(token))return;
   if(r.error||!r.data?.id)throw Error('Accès refusé');
  });
 }
 if(!identityMatches)return <View style={{padding:16}}>
  <Text accessibilityLiveRegion="polite">Changement de compte en cours…</Text>
 </View>;
 return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:12,padding:16,paddingBottom:25}}>
  {loading?<Text accessibilityLiveRegion="polite">Chargement des validations…</Text>:null}
  {busy?<Text accessibilityLiveRegion="polite">Traitement en cours…</Text>:null}
  {error?<Text accessibilityRole="alert" style={{color:'#A1392D'}}>{error}</Text>:null}
  {notice?<Text accessibilityLiveRegion="polite" style={{color:'#2F4935'}}>{notice}</Text>:null}
  {!loading&&!busy?<Pressable accessibilityRole="button" accessibilityLabel="Réessayer le chargement"
   onPress={()=>{setError('');void load()}}
   style={{minHeight:48,padding:12,justifyContent:'center',backgroundColor:'#29444F',borderRadius:9}}>
   {label(loaded?'Actualiser':'Réessayer')}</Pressable>:null}
  {loaded&&manager?card(<>
   {label('Périmètre autorisé par chantier')}
   {jobs.map(j=><View key={j.id}>{button((selected===j.id?'✓ ':'')+
    (account.edition==='essential'?'Mon établissement':'#'+j.number+' — '+j.name),()=>selectJob(j))}</View>)}
   {selected?<>
    {field('Latitude',lat,setLat)}{field('Longitude',lon,setLon)}
    {field('Rayon maximum en mètres (10–10000)',radius,setRadius)}
    {button('Enregistrer le rayon',saveRadius)}
   </>:null}
  </>):null}
  {account.edition==='essential'?<View style={{gap:12}}>
   <NotificationPreferencesPanel key={account.companyId+account.userId+account.role} account={account}/>
   <PushDevicesPanel key={'push'+account.companyId+account.userId+account.role} account={account}/>
  </View>:null}
  {loaded?<>
   {card(<>
    {label('Notifications')}
    {notifications.map(notification=><View key={notification.id} style={{gap:6}}>
     {label(String(notification.title||'Notification'))}{label(String(notification.body||''))}
     {!notification.read_at?button('Marquer comme lue',()=>readNotification(notification)):null}
    </View>)}
   </>)}
   {manager?card(<>
    {label('Motif de validation ou de correction')}
    {field('Motif (minimum 3 caractères)',note,setNote)}
    {label('Pour corriger les heures d’une journée terminée :')}
    {field('Nouvelle entrée ISO avec fuseau (facultatif)',start,setStart)}
    {field('Nouvelle sortie ISO avec fuseau (facultatif)',end,setEnd)}
   </>):null}
   {checks.filter(check=>check.review_status==='pending').map(check=><View key={check.id}>{card(<>
    {label((account.edition==='essential'?'Établissement':'#'+(jobs.find(j=>j.id===check.job_id)?.number||'—'))+
     ' · '+(locLabels[check.location_status]||'Statut GPS inconnu')+(check.offline?' · HORS LIGNE':''))}
    {label(String(check.user_id||'').slice(0,8)+' · '+String(check.action||'')+' · '+dateLabel(check.recorded_at))}
    {label('Distance : '+(check.distance_m==null?'inconnue':Math.round(check.distance_m)+' m')+
     ' / maximum '+check.radius_m+' m')}
    {label('Précision : '+(check.accuracy_m==null?'inconnue':Math.round(check.accuracy_m)+' m'))}
    {canReviewLocation(check,account,checks)?<>
     {button('Accepter le punch',()=>review(check,false))}
     {button('Corriger les heures et accepter',()=>review(check,true))}
    </>:label('En attente de validation par une autre personne autorisée')}
   </>)}</View>)}
   {manager?card(<>
    {label('Pauses hors ligne à valider')}
    {receipts.filter(receipt=>canReviewOfflineBreak(receipt,account,receipts))
     .map(receipt=><View key={receipt.event_id}>
      {label(String(receipt.action)+' · '+dateLabel(receipt.occurred_at))}
      {button('Valider (motif ci-dessus)',()=>reviewBreak(receipt))}
     </View>)}
   </>):null}
   {card(<>
    {label('Conflits de synchronisation conservés')}
    {receipts.filter(receipt=>receipt.result?.sync_status==='conflict').map(receipt=><View key={receipt.event_id}>
     {label(String(receipt.user_id||'').slice(0,8)+' · '+String(receipt.action||'')+' · '+dateLabel(receipt.occurred_at))}
     {label('Événement à vérifier avec l’administration. Aucune correction automatique.')}
    </View>)}
   </>)}
  </>:null}
 </ScrollView>;
}
