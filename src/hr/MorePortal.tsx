import {OperationsPanel} from '../workforce/OperationsPanel';
import {GeofencePanel} from '../workforce/GeofencePanel';
import React,{useEffect,useRef,useState} from 'react';
import {Alert,Pressable,ScrollView,Text,TextInput,View,StyleSheet} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {supabase} from '../lib/supabase';
import {createJob} from '../jobs/api';
import {WorkforcePanel} from '../workforce/WorkforcePanel';
import {TeamsPanel} from './TeamsPanel';
import {WorkspaceAccount} from '../auth/AuthGate';
import {createMorePortalScope} from './morePortalScope.js';
const C={bg:'#08131C',panel:'#112532',panel2:'#1B3441',text:'#FFFFFF',muted:'#9FB4C1',gold:'#FFBF40',mint:'#21E2B0',stroke:'#36505A'};
export type Section='menu'|'profile'|'emergency'|'credentials'|'leave'|'admin'|'teams'|'workforce'|'geofence'|'schedule'|'documents'|'invite';
type Leave={id:string;leave_type:string;begins_on:string;ends_on:string;status:string};
type Contact={id:string;name:string;phone:string;relationship:string|null;priority:number};
function Txt({children,small=false,bold=false,color=C.text}:{children:React.ReactNode;small?:boolean;bold?:boolean;color?:string}){return <Text style={{color,fontSize:small?12:15,fontWeight:bold?'800':'400',lineHeight:small?17:22}}>{children}</Text>}
function Field({label,value,onChange,placeholder,disabled=false}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string;disabled?:boolean}){return <View style={{gap:4,marginTop:9}}><Txt small color={C.muted}>{label}</Txt><TextInput accessibilityLabel={label} editable={!disabled} style={s.field} value={value} onChangeText={onChange} placeholder={placeholder||label} placeholderTextColor="#7D95A1" autoCapitalize="sentences"/></View>}
function Btn({label,onPress,accent=false,disabled=false}:{label:string;onPress:()=>void;accent?:boolean;disabled?:boolean}){return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[s.btn,accent&&{backgroundColor:C.gold},disabled&&{opacity:0.5}]}><Txt color={accent?C.bg:C.text} bold>{label}</Txt></Pressable>}
function Card({children}:{children:React.ReactNode}){return <View style={s.card}>{children}</View>}
export function MorePortal({account,onRefresh,initialSection='menu',managementOnly=false}:{account:WorkspaceAccount;managementOnly?:boolean;initialSection?:Section;onRefresh:()=>Promise<void>}){
 const [section,setSection]=useState<Section>(initialSection);
 const [fullName,setFullName]=useState('');
 const [phone,setPhone]=useState('');
 const [contactName,setContactName]=useState('');
 const [contactPhone,setContactPhone]=useState('');
 const [contactRelation,setContactRelation]=useState('');
 const [contactPriority,setContactPriority]=useState(1);
 const [contacts,setContacts]=useState<Contact[]>([]);
 const [credentialType,setCredentialType]=useState('Carte CCQ');
 const [trade,setTrade]=useState('');
 const [expires,setExpires]=useState('');
 const [credentials,setCredentials]=useState<{id:string;credential_type:string;expires_on:string|null;trade:string|null}[]>([]);
 const [leaveType,setLeaveType]=useState('vacation');
 const [from,setFrom]=useState('');
 const [to,setTo]=useState('');
 const [reason,setReason]=useState('');
 const [leaves,setLeaves]=useState<Leave[]>([]);
 const [number,setNumber]=useState('');
 const [jobName,setJobName]=useState('');
 const [address,setAddress]=useState('');
 const scope=useRef(createMorePortalScope(account.companyId,account.userId,account.role));
 const alive=useRef(false),reloadSequence=useRef(0),actionLock=useRef(false);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [privateReadsVerified,setPrivateReadsVerified]=useState(false);
 const identityMatches=scope.current.matches(account.companyId,account.userId,account.role);
 const current=(token:ReturnType<typeof scope.current.current>)=>alive.current&&scope.current.allows(token);
 const manager=account.role==='admin'||account.role==='boss';
 const restricted=['restricted','cancelled'].includes(account.billingStatus);
 async function reload(token:ReturnType<typeof scope.current.current>=scope.current.current()){
  if(!current(token))return;
  const seq=++reloadSequence.current;
  setLoading(true);setPrivateReadsVerified(false);
  try{
   const [p,c,k,l]=await Promise.all([
    supabase.from('employee_profiles').select('full_name,phone').eq('user_id',account.userId).maybeSingle(),
    supabase.from('emergency_contacts').select('id,name,phone,relationship,priority').eq('user_id',account.userId).order('priority'),
    supabase.from('employee_credentials').select('id,credential_type,expires_on,trade').eq('user_id',account.userId),
    supabase.from('leave_requests').select('id,leave_type,begins_on,ends_on,status').eq('company_id',account.companyId).eq('user_id',account.userId).order('created_at',{ascending:false})
   ]);
   if(!current(token)||seq!==reloadSequence.current)return;
   if(p.error||c.error||k.error||l.error){
    setFullName('');setPhone('');setContacts([]);setCredentials([]);setLeaves([]);
    setError('Impossible de vérifier les renseignements de ce compte.');
    return;
   }
   setFullName(p.data?.full_name||'');setPhone(p.data?.phone||'');
   setContacts((c.data||[]) as Contact[]);
   setCredentials(k.data||[]);
   setLeaves((l.data||[]) as Leave[]);
   setPrivateReadsVerified(true);setError('');
  }catch{
   if(current(token)&&seq===reloadSequence.current){
    setFullName('');setPhone('');setContacts([]);setCredentials([]);setLeaves([]);
    setError('Impossible de vérifier les renseignements de ce compte.');
   }
  }finally{
   if(current(token)&&seq===reloadSequence.current)setLoading(false);
  }
 }
 useEffect(()=>{
  const token=scope.current.enter(account.companyId,account.userId,account.role);
  alive.current=true;reloadSequence.current++;actionLock.current=false;
  setError('');setBusy(false);setLoading(true);setPrivateReadsVerified(false);
  setSection(initialSection);
  setFullName('');setPhone('');setContactName('');setContactPhone('');
  setContactRelation('');setContactPriority(1);setContacts([]);
  setCredentialType('Carte CCQ');setTrade('');setExpires('');setCredentials([]);
  setLeaveType('vacation');setFrom('');setTo('');setReason('');setLeaves([]);
  setNumber('');setJobName('');setAddress('');
  void reload(token);
  return()=>{alive.current=false;scope.current.invalidate();reloadSequence.current++};
 },[account.userId,account.companyId,account.role]);
 async function runAction(work:(token:ReturnType<typeof scope.current.current>)=>Promise<void>){
  const token=scope.current.current();
  if(!identityMatches||!current(token)||loading||actionLock.current)return;
  actionLock.current=true;setBusy(true);setError('');
  try{await work(token)}
  catch{if(current(token))setError('Opération impossible. Réessaie.')}
  finally{if(current(token)){actionLock.current=false;setBusy(false)}}
 }
 function notify(title:string,token:ReturnType<typeof scope.current.current>){
  if(current(token))Alert.alert(title,'Vérifie tes autorisations ou réessaie.');
 }
 async function saveProfile(token:ReturnType<typeof scope.current.current>){
  if(!current(token)||!privateReadsVerified)return;
  const {error:saveError}=await supabase.from('employee_profiles').upsert({user_id:account.userId,full_name:fullName.trim(),phone:phone.trim()},{onConflict:'user_id'});
  if(!current(token))return;
  if(saveError)notify('Profil non enregistré',token);else Alert.alert('Profil enregistré');
 }
 async function saveContact(token:ReturnType<typeof scope.current.current>){
  if(!current(token)||!privateReadsVerified)return;
  if(!contactName.trim()||!contactPhone.trim())return Alert.alert('Nom et numéro requis');
  const {error:saveError}=await supabase.from('emergency_contacts').upsert({user_id:account.userId,name:contactName.trim(),phone:contactPhone.trim(),relationship:contactRelation.trim(),priority:contactPriority},{onConflict:'user_id,priority'});
  if(!current(token))return;
  if(saveError)notify('Contact non enregistré',token);
  else{setContactName('');setContactPhone('');await reload(token);if(current(token))Alert.alert('Contact enregistré');}
 }
 async function saveCredential(token:ReturnType<typeof scope.current.current>){
  if(!current(token)||!privateReadsVerified)return;
  if(!credentialType.trim())return Alert.alert('Type de carte requis');
  const {error:saveError}=await supabase.from('employee_credentials').insert({user_id:account.userId,credential_type:credentialType.trim(),trade:trade.trim()||null,expires_on:expires.trim()||null});
  if(!current(token))return;
  if(saveError)notify('Carte non ajoutée',token);
  else{setExpires('');await reload(token);if(current(token))Alert.alert('Carte ajoutée','Le téléversement privé recto/verso sera ajouté séparément.');}
 }
 async function requestLeave(token:ReturnType<typeof scope.current.current>){
  if(!current(token)||!privateReadsVerified)return;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||to<from)return Alert.alert('Dates invalides','Format requis AAAA-MM-JJ.');
  const {error:saveError}=await supabase.from('leave_requests').insert({company_id:account.companyId,user_id:account.userId,leave_type:leaveType,begins_on:from,ends_on:to,reason:reason.trim()||null});
  if(!current(token))return;
  if(saveError)notify('Demande non envoyée',token);
  else{setReason('');await reload(token);if(current(token))Alert.alert('Demande enregistrée','Statut : en attente d’approbation.');}
 }
 async function addJob(token:ReturnType<typeof scope.current.current>){
  if(!current(token)||!manager)return;
  if(restricted)return Alert.alert('Administration suspendue','Le boss doit régulariser l’abonnement.');
  try{
   await createJob(account.companyId,number,jobName,address);
   if(!current(token))return;
   setNumber('');setJobName('');setAddress('');
   await onRefresh();
   if(current(token))Alert.alert('Chantier créé');
  }catch{notify('Création impossible',token)}
 }
 const privateFieldsDisabled=busy||loading||!privateReadsVerified;
 const privateSection=['profile','emergency','credentials','leave'].includes(section);
 const open=(next:Section)=>{if(!identityMatches||busy||loading)return;setSection(next);setError('');void reload()};
 if(!identityMatches)return <View style={{flex:1,padding:16}}><Text accessibilityLiveRegion="polite" style={{color:C.text}}>Changement de compte en cours…</Text></View>;
 return <View style={{flex:1,paddingHorizontal:14,paddingBottom:8,gap:10}}>
  <View style={s.header}><Pressable onPress={()=>section==='menu'?undefined:setSection('menu')}><Ionicons name={section==='menu'?'grid-outline':'arrow-back'} size={23} color={C.gold}/></Pressable><Text style={s.title}>{section==='menu'?'Plus':section==='profile'?'Mon profil':section==='emergency'?'Contacts d’urgence':section==='credentials'?'Compétences et cartes':section==='leave'?'Mes congés et absences':section==='teams'?'Mes équipes':section==='schedule'?'Horaire':section==='documents'?'Plans et documents':section==='invite'?'Invitations':section==='geofence'?'Punch GPS et alertes':section==='workforce'?'Heures et approbations':'Administration'}</Text></View>
  {error?<View style={{gap:8,paddingVertical:4}}><Text accessibilityRole="alert" style={{color:'#FFB5A8'}}>{error}</Text>
   {!loading&&!busy?<Pressable accessibilityRole="button" accessibilityLabel="Réessayer le chargement du compte"
    onPress={()=>{setError('');void reload()}} style={{minHeight:48,padding:12,borderRadius:10,backgroundColor:C.panel2,alignSelf:'flex-start'}}>
    <Txt color={C.text} bold>Réessayer</Txt></Pressable>:null}
  </View>:null}
  {loading||busy?<Text accessibilityLiveRegion="polite" style={{color:C.muted}}>{busy?'Enregistrement en cours…':'Chargement du compte…'}</Text>:null}
  {section==='schedule'||section==='documents'||section==='invite'?<OperationsPanel account={account} mode={section}/>:section==='geofence'?<GeofencePanel account={account}/>:section==='workforce'?<WorkforcePanel account={account} managementOnly={managementOnly}/>:section==='teams'?<TeamsPanel account={account}/>:section==='menu'?<View style={{gap:10,flex:1}}>
   <Card><Txt bold>{account.companyName}</Txt><Txt small color={C.muted}>{account.email} · {account.role}</Txt><Txt small color={restricted?'#FE8F8F':C.mint}>Abonnement : {account.billingStatus}</Txt></Card>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>{([
    ['person-outline','Mon profil','profile'],
    ['call-outline','Contacts d’urgence','emergency'],
    ['ribbon-outline','Cartes et compétences CCQ','credentials'],
    ['calendar-outline','Congés et absences','leave'],
    ['calendar-number-outline','Horaire et affectations','schedule'],
    ['document-text-outline','Plans PDF et lecture','documents'],
    ...(manager?[['mail-outline','Invitations sécurisées','invite']]:[]),
    ['checkmark-done-outline','Corrections, approbations et exports','workforce'],
    ['locate-outline',manager?'Rayon de punch et notifications':'Mes alertes de punch','geofence'],
    ...(manager?[['business-outline','Gérer les chantiers','admin'],['people-outline','Gérer les équipes','teams']]:account.role==='lead'?[['people-outline','Mon équipe','teams']]:[])
   ] as string[][]).filter(([, ,v])=>!managementOnly||!['emergency','credentials','leave'].includes(v)).filter(([, ,v])=>account.edition!=='essential'||!['admin','teams','documents','credentials'].includes(v)).map(([icon,label,v])=><Pressable key={v} onPress={()=>open(v as Section)} style={[s.menuItem,{width:'48%',padding:9}]}><Ionicons name={icon as any} color={C.gold} size={22}/><Text style={{color:C.text,flex:1,fontSize:15,fontWeight:'600'}}>{label}</Text><Ionicons name="chevron-forward" color={C.muted} size={19}/></Pressable>)}</View>
   <Txt small color={C.muted}>À suivre : réglages langue et thème, notifications push et forfait.</Txt>
   <Pressable onPress={()=>supabase.auth.signOut()} style={s.logOut}><Txt color={C.gold}>Se déconnecter</Txt></Pressable>
  </View>:<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:20,gap:11}}>
   {privateSection&&!privateReadsVerified?<Card><Txt small color={C.muted}>Vérification des renseignements en cours. Aucun détail privé n’est affiché avant validation.</Txt></Card>:null}
   {section==='profile'&&privateReadsVerified?<Card><Txt bold>Informations personnelles</Txt><Field disabled={privateFieldsDisabled} label="Nom et prénom" value={fullName} onChange={setFullName}/><Field disabled={privateFieldsDisabled} label="Téléphone" value={phone} onChange={setPhone}/><Btn disabled={privateFieldsDisabled} accent label="Enregistrer le profil" onPress={()=>void runAction(saveProfile)}/><Txt small color={C.muted}>Les responsables autorisés peuvent consulter ces renseignements professionnels.</Txt></Card>:null}
   {section==='emergency'&&privateReadsVerified?<><Card><Txt bold>Deux contacts d’urgence</Txt><Txt small color={C.muted}>Accès réservé à toi et aux responsables autorisés.</Txt><Field disabled={privateFieldsDisabled} label="Nom du contact" value={contactName} onChange={setContactName}/><Field disabled={privateFieldsDisabled} label="Téléphone" value={contactPhone} onChange={setContactPhone}/><Field disabled={privateFieldsDisabled} label="Lien (conjoint, parent...)" value={contactRelation} onChange={setContactRelation}/><View style={{flexDirection:'row',gap:10,marginTop:10}}><Btn disabled={privateFieldsDisabled} label={'Priorité : '+contactPriority} onPress={()=>setContactPriority(v=>v===1?2:1)}/></View><Btn disabled={privateFieldsDisabled} accent label="Ajouter / mettre à jour" onPress={()=>void runAction(saveContact)}/></Card>{contacts.map(c=><Card key={c.id}><Txt bold>{c.priority}. {c.name}</Txt><Txt>{c.phone}</Txt><Txt small color={C.muted}>{c.relationship||'Contact d’urgence'}</Txt></Card>)}</>:null}
   {section==='credentials'&&privateReadsVerified?<><Card><Txt bold>Cartes et certifications</Txt><Field disabled={privateFieldsDisabled} label="Type (CCQ, ASP, SIMDUT, nacelle…)" value={credentialType} onChange={setCredentialType}/><Field disabled={privateFieldsDisabled} label="Métier / qualification" value={trade} onChange={setTrade}/><Field disabled={privateFieldsDisabled} label="Expiration AAAA-MM-JJ (si applicable)" value={expires} onChange={setExpires}/><Btn disabled={privateFieldsDisabled} accent label="Ajouter ma carte" onPress={()=>void runAction(saveCredential)}/><Txt small color={C.muted}>Les photos recto/verso devront être téléversées dans un stockage privé. Aucun document sensible ne doit être déposé dans une galerie publique.</Txt></Card>{credentials.map(c=><Card key={c.id}><Txt bold>{c.credential_type}</Txt><Txt small color={C.muted}>{c.trade||'Qualification non spécifiée'} · Expire : {c.expires_on||'Non précisé'}</Txt></Card>)}</>:null}
   {section==='leave'&&privateReadsVerified?<><Card><Txt bold>Faire une demande</Txt><View style={{flexDirection:'row',gap:8,flexWrap:'wrap',marginTop:10}}>{[['vacation','Vacances'],['sick','Maladie'],['personal','Personnel'],['other','Autre']].map(([val,label])=><Pressable key={val} onPress={()=>setLeaveType(val)} style={[s.chip,leaveType===val&&{backgroundColor:C.gold}]}><Txt small bold color={leaveType===val?C.bg:C.text}>{label}</Txt></Pressable>)}</View><Field disabled={privateFieldsDisabled} label="Du (AAAA-MM-JJ)" value={from} onChange={setFrom}/><Field disabled={privateFieldsDisabled} label="Au (AAAA-MM-JJ)" value={to} onChange={setTo}/><Field disabled={privateFieldsDisabled} label="Commentaire (facultatif)" value={reason} onChange={setReason}/><Btn disabled={privateFieldsDisabled} accent label="Soumettre la demande" onPress={()=>void runAction(requestLeave)}/></Card><Card><Txt bold>Mes demandes</Txt>{leaves.length===0?<Txt small color={C.muted}>Aucune demande.</Txt>:leaves.map(l=><View key={l.id} style={s.leaveRow}><Txt small>{l.begins_on} → {l.ends_on} · {l.leave_type}</Txt><Txt small color={l.status==='approved'?C.mint:C.gold}>{l.status}</Txt></View>)}</Card></>:null}
   {section==='admin'?<Card><Txt bold>Ajouter une job</Txt><Txt small color={C.muted}>Les jobs deviennent accessibles dans la liste GPS « Toutes les jobs ».</Txt>{restricted?<Txt color="#FF8A8A">Administration suspendue pour défaut de paiement.</Txt>:null}<Field disabled={busy||loading} label="Numéro de job" value={number} onChange={setNumber}/><Field disabled={busy||loading} label="Nom du chantier" value={jobName} onChange={setJobName}/><Field disabled={busy||loading} label="Adresse (ou coordonnées à définir)" value={address} onChange={setAddress}/><Btn disabled={busy||loading} accent label="Créer ce chantier" onPress={()=>void runAction(addJob)}/></Card>:null}
  </ScrollView>}
 </View>;
}
const s=StyleSheet.create({
 header:{height:65,flexDirection:'row',alignItems:'center',gap:13},
 title:{fontSize:23,fontWeight:'900',color:C.text},
 card:{backgroundColor:C.panel,borderRadius:14,borderWidth:1,borderColor:C.stroke,padding:15,gap:6},
 field:{height:48,backgroundColor:C.panel2,borderWidth:1,borderColor:C.stroke,borderRadius:10,paddingHorizontal:12,color:C.text},
 menuItem:{padding:13,backgroundColor:C.panel,borderColor:C.stroke,borderWidth:1,borderRadius:12,flexDirection:'row',alignItems:'center',gap:12},
 logOut:{padding:14,alignItems:'center'},
 btn:{backgroundColor:C.panel2,borderColor:C.stroke,borderWidth:1,borderRadius:11,paddingHorizontal:13,paddingVertical:11,minHeight:48,alignItems:'center',justifyContent:'center',marginTop:12},
 chip:{paddingHorizontal:12,paddingVertical:8,borderRadius:20,backgroundColor:C.panel2},
 leaveRow:{paddingVertical:8,borderBottomWidth:1,borderBottomColor:C.stroke,gap:2}
});
