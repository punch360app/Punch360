import {InvitationEmailPanel} from './InvitationEmailPanel';
import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Pressable,ScrollView,Share,StyleSheet,Switch,Text,TextInput,View} from 'react-native';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {createPeopleScope} from './peopleScope.js';

type Worker={id:string;employee_number:string;first_name:string;last_name:string;auth_user_id:string|null;email:string|null;phone:string|null;status:string;can_mobile_punch:boolean};
type Token=ReturnType<ReturnType<typeof createPeopleScope>['current']>;
const loadFailure='Impossible de vérifier les employés de ce compte. Réessaie.';
export function EssentialPeoplePanel({account}:{account:WorkspaceAccount}){
 const [workers,setWorkers]=useState<Worker[]>([]);
 const [first,setFirst]=useState(''),[last,setLast]=useState(''),[number,setNumber]=useState('');
 const [email,setEmail]=useState(''),[phone,setPhone]=useState(''),[consent,setConsent]=useState(false);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false);
 const [notice,setNotice]=useState(''),[error,setError]=useState('');
 const scope=useRef(createPeopleScope(account.companyId,account.userId,account.role));
 const alive=useRef(false),loadSeq=useRef(0),actionLock=useRef(false);
 const latest=useRef({companyId:account.companyId,userId:account.userId,role:account.role});
 latest.current={companyId:account.companyId,userId:account.userId,role:account.role};
 const identityMatches=scope.current.matches(account.companyId,account.userId,account.role);
 const current=(token:Token)=>{
  const a=latest.current;
  return alive.current&&scope.current.allows(token)&&scope.current.matches(a.companyId,a.userId,a.role);
 };
 const disabled=busy||loading||!loaded;

 async function load(token:Token=scope.current.current()){
  if(!current(token))return;
  const request=++loadSeq.current;
  setLoading(true);setLoaded(false);
  try{
   const r=await supabase.from('company_workers').select('*').eq('company_id',account.companyId).order('employee_number');
   if(!current(token)||request!==loadSeq.current)return;
   if(r.error||!Array.isArray(r.data))throw Error('read');
   setWorkers(r.data);setLoaded(true);setError('');
  }catch{
   if(current(token)&&request===loadSeq.current){
    setWorkers([]);setLoaded(false);setError(loadFailure);
   }
  }finally{
   if(current(token)&&request===loadSeq.current)setLoading(false);
  }
 }
 useEffect(()=>{
  const token=scope.current.enter(account.companyId,account.userId,account.role);
  alive.current=true;loadSeq.current++;actionLock.current=false;
  setWorkers([]);setFirst('');setLast('');setNumber('');setEmail('');setPhone('');setConsent(false);
  setBusy(false);setLoading(true);setLoaded(false);setNotice('');setError('');
  void load(token);
  return()=>{alive.current=false;scope.current.invalidate();loadSeq.current++};
 },[account.companyId,account.userId,account.role]);

 async function invite(token:Token,worker:Worker){
  if(!current(token)||!worker.id||worker.auth_user_id||(!worker.email&&!worker.phone))return;
  const r=await supabase.functions.invoke('essential-invite',{body:{workerId:worker.id}});
  if(!current(token))return;
  if(r.error||r.data?.error||typeof r.data?.activationUrl!=='string')throw Error('invite');
  setNotice(r.data.smsStatus==='sent'?'SMS accepté par le fournisseur.':'SMS non envoyé : configuration ou autorisation à vérifier.');
  // Do not share an activation link from an old account after switching sessions.
  if(!current(token))return;
  await Share.share({message:'Activez votre espace PUNCH Essentiel : '+r.data.activationUrl});
 }
 async function run(operation:(token:Token)=>Promise<void>){
  const token=scope.current.current();
  if(!identityMatches||!current(token)||!loaded||actionLock.current)return;
  actionLock.current=true;setBusy(true);setError('');setNotice('');
  try{await operation(token)}
  catch{if(current(token))setError('Opération impossible ou autorisation refusée. Réessaie.')}
  finally{if(current(token)){actionLock.current=false;setBusy(false)}}
 }
 async function create(token:Token){
  if(!current(token))return;
  const firstName=first.trim(),lastName=last.trim(),employeeNumber=number.trim();
  const employeeEmail=email.trim(),employeePhone=phone.trim(),smsConsent=consent;
  if(!firstName||!employeeNumber){setError('Prénom et matricule requis.');return;}
  const r=await supabase.rpc('create_essential_worker',{
   p_company:account.companyId,p_number:employeeNumber,p_first:firstName,p_last:lastName,
   p_email:employeeEmail||null,p_phone:employeePhone||null,p_sms_consent:smsConsent
  });
  if(!current(token))return;
  if(r.error||!r.data?.id)throw Error('create');
  setFirst('');setLast('');setNumber('');setEmail('');setPhone('');setConsent(false);
  await load(token);
  if(!current(token))return;
  setNotice('Dossier salarié créé sans compte ni courriel fictif.');
  if(employeePhone&&smsConsent){
   await invite(token,{id:r.data.id,employee_number:employeeNumber,first_name:firstName,last_name:lastName,
    auth_user_id:null,email:employeeEmail||null,phone:employeePhone,status:'active',can_mobile_punch:false});
  }
 }
 const field=(label:string,value:string,set:(v:string)=>void,kind:'default'|'email-address'|'phone-pad'='default')=>
  <View style={{gap:5}}><Text style={s.label}>{label}</Text>
   <TextInput editable={!disabled} value={value} onChangeText={set} keyboardType={kind}
    autoCapitalize={kind==='default'?'words':'none'} style={s.input} accessibilityLabel={label}/></View>;
 if(!identityMatches)return <View style={{padding:20,backgroundColor:'#FAFBF8'}}>
  <Text accessibilityLiveRegion="polite" style={s.label}>Changement de compte en cours…</Text>
 </View>;
 return <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
  <Text style={s.title}>Employés</Text>
  {loading?<Text accessibilityLiveRegion="polite" style={s.label}>Chargement des employés…</Text>:null}
  {busy?<Text accessibilityLiveRegion="polite" style={s.label}>Opération en cours…</Text>:null}
  {error?<Text accessibilityRole="alert" style={[s.notice,{color:'#A1392D'}]}>{error}</Text>:null}
  {notice?<Text accessibilityLiveRegion="polite" style={s.notice}>{notice}</Text>:null}
  {!loading&&!busy?<Pressable accessibilityRole="button" accessibilityLabel="Réessayer le chargement des employés"
   onPress={()=>{setError('');void load()}} style={[s.button,{backgroundColor:'#edf3e7',alignSelf:'flex-start'}]}>
   <Text style={[s.buttonText,{color:'#2F4935'}]}>{loaded?'Actualiser':'Réessayer'}</Text>
  </Pressable>:null}
  {loaded?<InvitationEmailPanel key={[account.companyId,account.userId,account.role].join(':')} account={account} workers={workers}/>:null}
  {loaded?<View style={s.card}>
   <Text style={s.subtitle}>Nouvel employé</Text>
   <Text style={s.label}>Un seul dossier, avec ou sans compte personnel.</Text>
   {field('Prénom',first,setFirst)}{field('Nom',last,setLast)}{field('Matricule',number,setNumber)}
   {field('Téléphone international (facultatif)',phone,setPhone,'phone-pad')}
   {field('Courriel (facultatif)',email,setEmail,'email-address')}
   <View style={s.row}><Switch disabled={disabled} value={consent} onValueChange={setConsent}
    trackColor={{true:'#779574'}} accessibilityLabel="Consentement aux invitations SMS"/>
    <Text style={[s.label,{flex:1}]}>Consentement aux invitations SMS</Text></View>
   <Pressable accessibilityRole="button" accessibilityLabel="Créer l’employé" disabled={disabled}
    onPress={()=>void run(create)} style={[s.button,disabled&&{opacity:0.5}]}>
    {busy?<ActivityIndicator color="white"/>:<Text style={s.buttonText}>Créer l’employé</Text>}
   </Pressable>
  </View>:null}
  {loaded?<View style={s.card}>
   <Text style={s.subtitle}>{workers.length} dossier(s) salarié(s)</Text>
   {workers.map(w=><View key={w.id} style={s.person}>
    <Text style={s.name}>{w.first_name} {w.last_name}</Text>
    <Text style={s.label}>{w.employee_number} · {w.auth_user_id?'Compte lié':'Sans compte personnel'}</Text>
    <Text style={s.label}>{w.can_mobile_punch?'Mobile autorisé':'Pointage sur tablette'} · {w.status}</Text>
    {!w.auth_user_id&&(w.email||w.phone)?<Pressable accessibilityRole="button"
     accessibilityLabel={'Inviter '+w.first_name+' '+w.last_name} disabled={disabled}
     onPress={()=>void run(token=>invite(token,w))} style={[s.button,disabled&&{opacity:0.5}]}>
     <Text style={s.buttonText}>Inviter sur l’application</Text>
    </Pressable>:null}
   </View>)}
  </View>:null}
 </ScrollView>;
}
const s=StyleSheet.create({container:{padding:20,gap:16,backgroundColor:'#FAFBF8'},title:{fontSize:27,fontWeight:'600',color:'#2F4935'},subtitle:{fontSize:19,fontWeight:'600',color:'#2F4935'},card:{padding:18,gap:14,borderWidth:1,borderColor:'#E1E8DB',backgroundColor:'white',borderRadius:14},label:{fontSize:13,lineHeight:19,color:'#6d8066'},input:{borderWidth:1,borderColor:'#E1E8DB',backgroundColor:'#FAFBF8',borderRadius:9,minHeight:48,padding:12,color:'#2F4935'},button:{backgroundColor:'#4e7051',borderRadius:10,padding:14,alignItems:'center',minHeight:48},buttonText:{color:'white',fontWeight:'600'},row:{flexDirection:'row',alignItems:'center',gap:12},person:{paddingVertical:12,gap:8,borderBottomWidth:1,borderColor:'#E1E8DB'},name:{fontSize:15,fontWeight:'600',color:'#2F4935'},notice:{color:'#2F4935',backgroundColor:'#edf3e7',padding:14,borderRadius:10}});
