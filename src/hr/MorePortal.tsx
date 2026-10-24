import React,{useEffect,useState} from 'react';
import {Alert,Pressable,ScrollView,Text,TextInput,View,StyleSheet} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {supabase} from '../lib/supabase';
import {createJob} from '../jobs/api';
import {TeamsPanel} from './TeamsPanel';
import {WorkspaceAccount} from '../auth/AuthGate';
const C={bg:'#08131C',panel:'#112532',panel2:'#1B3441',text:'#FFFFFF',muted:'#9FB4C1',gold:'#FFBF40',mint:'#21E2B0',stroke:'#36505A'};
type Section='menu'|'profile'|'emergency'|'credentials'|'leave'|'admin'|'teams';
type Leave={id:string;leave_type:string;begins_on:string;ends_on:string;status:string};
type Contact={id:string;name:string;phone:string;relationship:string|null;priority:number};
function Txt({children,small=false,bold=false,color=C.text}:{children:React.ReactNode;small?:boolean;bold?:boolean;color?:string}){return <Text style={{color,fontSize:small?12:15,fontWeight:bold?'800':'400',lineHeight:small?17:22}}>{children}</Text>}
function Field({label,value,onChange,placeholder}:{label:string;value:string;onChange:(v:string)=>void;placeholder?:string}){return <View style={{gap:4,marginTop:9}}><Txt small color={C.muted}>{label}</Txt><TextInput style={s.field} value={value} onChangeText={onChange} placeholder={placeholder||label} placeholderTextColor="#7D95A1" autoCapitalize="sentences"/></View>}
function Btn({label,onPress,accent=false}:{label:string;onPress:()=>void;accent?:boolean}){return <Pressable onPress={onPress} style={[s.btn,accent&&{backgroundColor:C.gold}]}><Txt color={accent?C.bg:C.text} bold>{label}</Txt></Pressable>}
function Card({children}:{children:React.ReactNode}){return <View style={s.card}>{children}</View>}
export function MorePortal({account,onRefresh}:{account:WorkspaceAccount;onRefresh:()=>Promise<void>}){
 const [section,setSection]=useState<Section>('menu');
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
 const manager=account.role==='admin'||account.role==='boss';
 const restricted=['restricted','cancelled'].includes(account.billingStatus);
 async function reload(){
  try{
   const [p,c,k,l]=await Promise.all([
    supabase.from('employee_profiles').select('full_name,phone').eq('user_id',account.userId).maybeSingle(),
    supabase.from('emergency_contacts').select('id,name,phone,relationship,priority').eq('user_id',account.userId).order('priority'),
    supabase.from('employee_credentials').select('id,credential_type,expires_on,trade').eq('user_id',account.userId),
    supabase.from('leave_requests').select('id,leave_type,begins_on,ends_on,status').eq('company_id',account.companyId).eq('user_id',account.userId).order('created_at',{ascending:false})
   ]);
   if(p.data){setFullName(p.data.full_name||'');setPhone(p.data.phone||'');}
   if(!c.error)setContacts((c.data||[]) as Contact[]);
   if(!k.error)setCredentials(k.data||[]);
   if(!l.error)setLeaves((l.data||[]) as Leave[]);
  }catch{}
 }
 useEffect(()=>{reload()},[account.userId,account.companyId]);
 const notify=(title:string,e:any)=>Alert.alert(title,e?.message||String(e));
 async function saveProfile(){
  const {error}=await supabase.from('employee_profiles').upsert({user_id:account.userId,full_name:fullName.trim(),phone:phone.trim()},{onConflict:'user_id'});
  if(error)notify('Profil non enregistré',error);else Alert.alert('Profil enregistré');
 }
 async function saveContact(){
  if(!contactName.trim()||!contactPhone.trim())return Alert.alert('Nom et numéro requis');
  const {error}=await supabase.from('emergency_contacts').upsert({user_id:account.userId,name:contactName.trim(),phone:contactPhone.trim(),relationship:contactRelation.trim(),priority:contactPriority},{onConflict:'user_id,priority'});
  if(error)notify('Contact non enregistré',error);else{setContactName('');setContactPhone('');await reload();Alert.alert('Contact enregistré');}
 }
 async function saveCredential(){
  if(!credentialType.trim())return Alert.alert('Type de carte requis');
  const {error}=await supabase.from('employee_credentials').insert({user_id:account.userId,credential_type:credentialType.trim(),trade:trade.trim()||null,expires_on:expires.trim()||null});
  if(error)notify('Carte non ajoutée',error);else{setExpires('');await reload();Alert.alert('Carte ajoutée','Le téléversement privé recto/verso sera ajouté séparément.');}
 }
 async function requestLeave(){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||to<from)return Alert.alert('Dates invalides','Format requis AAAA-MM-JJ.');
  const {error}=await supabase.from('leave_requests').insert({company_id:account.companyId,user_id:account.userId,leave_type:leaveType,begins_on:from,ends_on:to,reason:reason.trim()||null});
  if(error)notify('Demande non envoyée',error);else{setReason('');await reload();Alert.alert('Demande enregistrée','Statut : en attente d’approbation.');}
 }
 async function addJob(){
  if(restricted)return Alert.alert('Administration suspendue','Le boss doit régulariser l’abonnement.');
  try{await createJob(account.companyId,number,jobName,address);setNumber('');setJobName('');setAddress('');await onRefresh();Alert.alert('Chantier créé');}
  catch(e){notify('Création impossible',e)}
 }
 const open=(next:Section)=>{setSection(next);reload()};
 return <View style={{flex:1,paddingHorizontal:14,paddingBottom:8,gap:10}}>
  <View style={s.header}><Pressable onPress={()=>section==='menu'?undefined:setSection('menu')}><Ionicons name={section==='menu'?'grid-outline':'arrow-back'} size={23} color={C.gold}/></Pressable><Text style={s.title}>{section==='menu'?'Plus':section==='profile'?'Mon profil':section==='emergency'?'Contacts d’urgence':section==='credentials'?'Compétences et cartes':section==='leave'?'Mes congés et absences':section==='teams'?'Mes équipes':'Administration'}</Text></View>
  {section==='teams'?<TeamsPanel account={account}/>:section==='menu'?<View style={{gap:10,flex:1}}>
   <Card><Txt bold>{account.companyName}</Txt><Txt small color={C.muted}>{account.email} · {account.role}</Txt><Txt small color={restricted?'#FE8F8F':C.mint}>Abonnement : {account.billingStatus}</Txt></Card>
   {([
    ['person-outline','Mon profil','profile'],
    ['call-outline','Contacts d’urgence','emergency'],
    ['ribbon-outline','Cartes et compétences CCQ','credentials'],
    ['calendar-outline','Congés et absences','leave'],
    ...(manager?[['business-outline','Gérer les chantiers','admin'],['people-outline','Gérer les équipes','teams']]:account.role==='lead'?[['people-outline','Mon équipe','teams']]:[])
   ] as string[][]).map(([icon,label,v])=><Pressable key={v} onPress={()=>open(v as Section)} style={s.menuItem}><Ionicons name={icon as any} color={C.gold} size={22}/><Text style={{color:C.text,flex:1,fontSize:15,fontWeight:'600'}}>{label}</Text><Ionicons name="chevron-forward" color={C.muted} size={19}/></Pressable>)}
   <Txt small color={C.muted}>À suivre : horaire, réglages langue et thème, notifications, approbations et forfait.</Txt>
   <Pressable onPress={()=>supabase.auth.signOut()} style={s.logOut}><Txt color={C.gold}>Se déconnecter</Txt></Pressable>
  </View>:<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:20,gap:11}}>
   {section==='profile'?<Card><Txt bold>Informations personnelles</Txt><Field label="Nom et prénom" value={fullName} onChange={setFullName}/><Field label="Téléphone" value={phone} onChange={setPhone}/><Btn accent label="Enregistrer le profil" onPress={saveProfile}/><Txt small color={C.muted}>Les responsables autorisés peuvent consulter ces renseignements professionnels.</Txt></Card>:null}
   {section==='emergency'?<><Card><Txt bold>Deux contacts d’urgence</Txt><Txt small color={C.muted}>Accès réservé à toi et aux responsables autorisés.</Txt><Field label="Nom du contact" value={contactName} onChange={setContactName}/><Field label="Téléphone" value={contactPhone} onChange={setContactPhone}/><Field label="Lien (conjoint, parent...)" value={contactRelation} onChange={setContactRelation}/><View style={{flexDirection:'row',gap:10,marginTop:10}}><Btn label={'Priorité : '+contactPriority} onPress={()=>setContactPriority(v=>v===1?2:1)}/></View><Btn accent label="Ajouter / mettre à jour" onPress={saveContact}/></Card>{contacts.map(c=><Card key={c.id}><Txt bold>{c.priority}. {c.name}</Txt><Txt>{c.phone}</Txt><Txt small color={C.muted}>{c.relationship||'Contact d’urgence'}</Txt></Card>)}</>:null}
   {section==='credentials'?<><Card><Txt bold>Cartes et certifications</Txt><Field label="Type (CCQ, ASP, SIMDUT, nacelle…)" value={credentialType} onChange={setCredentialType}/><Field label="Métier / qualification" value={trade} onChange={setTrade}/><Field label="Expiration AAAA-MM-JJ (si applicable)" value={expires} onChange={setExpires}/><Btn accent label="Ajouter ma carte" onPress={saveCredential}/><Txt small color={C.muted}>Les photos recto/verso devront être téléversées dans un stockage privé. Aucun document sensible ne doit être déposé dans une galerie publique.</Txt></Card>{credentials.map(c=><Card key={c.id}><Txt bold>{c.credential_type}</Txt><Txt small color={C.muted}>{c.trade||'Qualification non spécifiée'} · Expire : {c.expires_on||'Non précisé'}</Txt></Card>)}</>:null}
   {section==='leave'?<><Card><Txt bold>Faire une demande</Txt><View style={{flexDirection:'row',gap:8,flexWrap:'wrap',marginTop:10}}>{[['vacation','Vacances'],['sick','Maladie'],['personal','Personnel'],['other','Autre']].map(([val,label])=><Pressable key={val} onPress={()=>setLeaveType(val)} style={[s.chip,leaveType===val&&{backgroundColor:C.gold}]}><Txt small bold color={leaveType===val?C.bg:C.text}>{label}</Txt></Pressable>)}</View><Field label="Du (AAAA-MM-JJ)" value={from} onChange={setFrom}/><Field label="Au (AAAA-MM-JJ)" value={to} onChange={setTo}/><Field label="Commentaire (facultatif)" value={reason} onChange={setReason}/><Btn accent label="Soumettre la demande" onPress={requestLeave}/></Card><Card><Txt bold>Mes demandes</Txt>{leaves.length===0?<Txt small color={C.muted}>Aucune demande.</Txt>:leaves.map(l=><View key={l.id} style={s.leaveRow}><Txt small>{l.begins_on} → {l.ends_on} · {l.leave_type}</Txt><Txt small color={l.status==='approved'?C.mint:C.gold}>{l.status}</Txt></View>)}</Card></>:null}
   {section==='admin'?<Card><Txt bold>Ajouter une job</Txt><Txt small color={C.muted}>Les jobs deviennent accessibles dans la liste GPS « Toutes les jobs ».</Txt>{restricted?<Txt color="#FF8A8A">Administration suspendue pour défaut de paiement.</Txt>:null}<Field label="Numéro de job" value={number} onChange={setNumber}/><Field label="Nom du chantier" value={jobName} onChange={setJobName}/><Field label="Adresse (ou coordonnées à définir)" value={address} onChange={setAddress}/><Btn accent label="Créer ce chantier" onPress={addJob}/></Card>:null}
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
 btn:{backgroundColor:C.panel2,borderColor:C.stroke,borderWidth:1,borderRadius:11,paddingHorizontal:13,paddingVertical:11,alignItems:'center',marginTop:12},
 chip:{paddingHorizontal:12,paddingVertical:8,borderRadius:20,backgroundColor:C.panel2},
 leaveRow:{paddingVertical:8,borderBottomWidth:1,borderBottomColor:C.stroke,gap:2}
});
