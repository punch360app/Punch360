import React,{useEffect,useRef,useState} from 'react';
import {Alert,Pressable,ScrollView,Switch,Text,TextInput,View} from 'react-native';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {announcementReceiptRows,canAcknowledgeAnnouncement,canPublishCommunication,
 canWithdrawAnnouncement,canWriteShiftNote,communicationRows,createCommunicationsScope,
 validCommunicationNote,validCommunicationPublication} from './communicationsScope.js';

type Row=Record<string,any>;
type Token=ReturnType<ReturnType<typeof createCommunicationsScope>['current']>;
type Feed={announcements:Row[];notes:Row[];receipts:Row[];departments:Row[];features:string[]};
const empty=():Feed=>({announcements:[],notes:[],receipts:[],departments:[],features:[]});
const ink='#2F4935',edge='#d7e0d1',alertText='#aa4235';
const errorLoad='Communications indisponibles ou liste incomplète. Réessaie.';
const errorAction='Action impossible ou autorisation refusée. Actualise avant de réessayer.';
const date=(value:unknown)=>{
 const ms=Date.parse(String(value||''));
 return Number.isFinite(ms)?new Date(ms).toLocaleString('fr-CA'):'Date à vérifier';
};
export function EssentialCommunicationsPanel({account}:{account:WorkspaceAccount}){
 const [data,setData]=useState<Feed>(empty);
 const [title,setTitle]=useState(''),[body,setBody]=useState(''),[department,setDepartment]=useState('');
 const [urgent,setUrgent]=useState(false),[note,setNote]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false);
 const scope=useRef(createCommunicationsScope(account)),latest=useRef(account);
 latest.current=account;
 const alive=useRef(false),loadId=useRef(0),actionLock=useRef(false);
 const identityMatches=scope.current.matches(account);
 const current=(token:Token)=>alive.current&&scope.current.allows(token)&&scope.current.matches(latest.current);
 const disabled=!identityMatches||busy||loading||!loaded;
 const canPublish=canPublishCommunication(account,data.features);
 const canNote=canWriteShiftNote(account,data.features);
 const text=(value:string)=><Text style={{color:ink,lineHeight:22}}>{value}</Text>;
 const button=(label:string,action:()=>void,blocked=false)=><Pressable accessibilityRole="button"
  accessibilityLabel={label} accessibilityState={{disabled:disabled||blocked}}
  disabled={disabled||blocked} onPress={action}
  style={{minHeight:48,justifyContent:'center',padding:12,borderRadius:9,marginVertical:3,
   backgroundColor:'#4d7051',opacity:disabled||blocked?.5:1}}>
  <Text style={{color:'white',fontWeight:'600'}}>{label}</Text>
 </Pressable>;
 const field=(label:string,value:string,change:(s:string)=>void,maxLength:number,multi=false)=><View style={{gap:4}}>
  {text(label)}<TextInput accessibilityLabel={label} value={value} onChangeText={change}
   editable={!disabled} maxLength={maxLength} multiline={multi}
   style={{padding:12,minHeight:multi?100:48,borderWidth:1,borderColor:edge,
    borderRadius:8,backgroundColor:'white',color:ink,textAlignVertical:'top'}}/>
 </View>;
 async function rpc(name:string,args:Row,token:Token){
  if(!current(token))throw Error('Compte modifié');
  const result=await supabase.rpc(name,args);
  if(!current(token))throw Error('Compte modifié');
  if(result.error)throw Error('Action refusée');
  return result.data;
 }
 async function load(token:Token=scope.current.current()){
  if(!current(token))return false;
  const id=++loadId.current;
  setLoading(true);setLoaded(false);setData(empty());setNotice('');
  try{
   const [a,n,d,ent]=await Promise.all([
    supabase.from('essential_announcements')
     .select('id,company_id,department_id,title,body,urgent,created_at,expires_at,withdrawn_at')
     .eq('company_id',account.companyId).order('created_at',{ascending:false}).limit(501),
    supabase.from('essential_shift_notes')
     .select('id,company_id,author_id,department_id,body,created_at')
     .eq('company_id',account.companyId).order('created_at',{ascending:false}).limit(501),
    supabase.from('essential_departments').select('id,company_id,name,active')
     .eq('company_id',account.companyId).order('name').limit(501),
    rpc('essential_entitlements',{p_company:account.companyId},token)
   ]);
   if(!current(token)||id!==loadId.current)return false;
   if(a.error||n.error||d.error)throw Error('Données indisponibles');
   const announcements=communicationRows(a.data,account.companyId);
   const notes=communicationRows(n.data,account.companyId);
   const departments=communicationRows(d.data,account.companyId);
   if(!ent||!Array.isArray(ent.features))throw Error('Droits indisponibles');
   const receipts:Row[]=[];
   const ids=announcements.map(row=>row.id);
   for(let i=0;i<ids.length;i+=100){
    if(!current(token)||id!==loadId.current)return false;
    const batch=ids.slice(i,i+100);
    const r=await supabase.from('essential_announcement_receipts')
     .select('announcement_id,user_id,read_at')
     .eq('user_id',account.userId).in('announcement_id',batch).limit(101);
    if(!current(token)||id!==loadId.current)return false;
    if(r.error)throw Error('Lectures indisponibles');
    receipts.push(...announcementReceiptRows(r.data,account.userId,batch,100));
   }
   if(!current(token)||id!==loadId.current)return false;
   setData({announcements,notes,departments,receipts,features:ent.features});
   setDepartment(prev=>prev&&departments.some(x=>x.id===prev&&x.active)?prev:'');
   setLoaded(true);setError('');return true;
  }catch{
   if(current(token)&&id===loadId.current){
    setData(empty());setLoaded(false);setError(errorLoad);
   }
   return false;
  }finally{if(current(token)&&id===loadId.current)setLoading(false)}
 }
 useEffect(()=>{
  const token=scope.current.enter(account);
  alive.current=true;loadId.current++;actionLock.current=false;
  setData(empty());setTitle('');setBody('');setDepartment('');setUrgent(false);setNote('');
  setError('');setNotice('');setBusy(false);setLoading(true);setLoaded(false);
  void load(token);
  return()=>{alive.current=false;scope.current.invalidate();loadId.current++};
 },[account.companyId,account.userId,account.role,account.edition]);
 async function run(action:(token:Token)=>Promise<void>){
  const token=scope.current.current();
  if(!current(token)||disabled||actionLock.current)return;
  actionLock.current=true;setBusy(true);setError('');setNotice('');
  try{
   await action(token);
   if(!current(token))return;
   const updated=await load(token);
   if(current(token)&&updated)setNotice('Communications actualisées.');
  }catch{
   if(current(token))setError(errorAction);
  }finally{
   if(current(token)){actionLock.current=false;setBusy(false)}
  }
 }
 function publish(){
  if(!canPublish)return;
  let payload:{title:string;body:string;department:string|null};
  try{payload=validCommunicationPublication(title,body,department,data.departments)}
  catch{setError('Titre, message ou département invalide.');return}
  const important=urgent;
  void run(async token=>{
   await rpc('publish_essential_announcement',{
    p_company:account.companyId,p_department:payload.department,
    p_title:payload.title,p_body:payload.body,p_urgent:important
   },token);
   if(current(token)){setTitle('');setBody('');setUrgent(false)}
  });
 }
 function acknowledge(row:Row){
  if(!canAcknowledgeAnnouncement(row,account,data.announcements,data.receipts))return;
  void run(async token=>{
   if(!current(token))throw Error('Compte modifié');
   await rpc('acknowledge_essential_announcement',{p_id:row.id},token);
  });
 }
 function withdraw(row:Row){
  if(!canWithdrawAnnouncement(row,account,data.features,data.announcements)||disabled)return;
  const token=scope.current.current();
  Alert.alert('Retirer l’annonce','Son historique et les confirmations de lecture seront conservés.',
   [{text:'Annuler',style:'cancel'},{
    text:'Retirer',style:'destructive',onPress:()=>{
     if(!current(token)||!canWithdrawAnnouncement(row,account,data.features,data.announcements))return;
     void run(async activeToken=>{
      if(!current(activeToken))throw Error('Compte modifié');
      await rpc('withdraw_essential_announcement',{
       p_id:row.id,p_reason:'Retrait depuis la console mobile'
      },activeToken);
     });
    }
   }]);
 }
 function saveNote(){
  if(!canNote)return;
  let clean:string;
  try{clean=validCommunicationNote(note)}
  catch{setError('Note de 1 à 3000 caractères requise.');return}
  void run(async token=>{
   await rpc('add_essential_shift_note',{p_company:account.companyId,p_body:clean},token);
   if(current(token))setNote('');
  });
 }
 if(!identityMatches)return <View style={{padding:16}}>
  <Text accessibilityLiveRegion="polite">Changement de compte en cours…</Text>
 </View>;
 return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:20,gap:13,backgroundColor:'#FAFBF8'}}>
  <Text style={{fontSize:25,fontWeight:'700',color:ink}}>Communications</Text>
  {loading?<Text accessibilityLiveRegion="polite">Chargement des annonces et notes…</Text>:null}
  {busy?<Text accessibilityLiveRegion="polite">Traitement en cours…</Text>:null}
  {error?<Text accessibilityRole="alert" style={{color:alertText}}>{error}</Text>:null}
  {notice?<Text accessibilityLiveRegion="polite">{notice}</Text>:null}
  {!loading&&!busy?<Pressable accessibilityRole="button" accessibilityLabel="Réessayer le chargement"
   onPress={()=>{setError('');void load()}}
   style={{minHeight:48,padding:12,justifyContent:'center',borderRadius:9,backgroundColor:'#dce9d6'}}>
   {text(loaded?'Actualiser':'Réessayer')}
  </Pressable>:null}
  {loaded?<>
   {canPublish?<View style={{gap:9}}>
    <Text style={{fontSize:20,color:ink}}>Nouvelle annonce</Text>
    {field('Titre',title,setTitle,140)}
    {field('Message',body,setBody,5000,true)}
    <Text style={{color:ink}}>Destinataires</Text>
    <View style={{flexDirection:'row',flexWrap:'wrap',gap:5}}>
     {[{id:'',name:'Entreprise entière'},...data.departments.filter(x=>x.active)].map(d=>
      <Pressable key={d.id} accessibilityRole="radio" accessibilityLabel={d.name}
       accessibilityState={{selected:department===d.id,disabled}}
       disabled={disabled} onPress={()=>setDepartment(d.id)}
       style={{minHeight:48,padding:12,justifyContent:'center',borderRadius:8,
        backgroundColor:department===d.id?'#dce9d6':'white'}}>
       {text(d.name)}
      </Pressable>)}
    </View>
    <View style={{flexDirection:'row',alignItems:'center',gap:10,minHeight:48}}>
     <Switch accessibilityLabel="Annonce importante" disabled={disabled} value={urgent} onValueChange={setUrgent}/>
     {text('Annonce importante')}
    </View>
    {button('Publier',publish)}
   </View>:null}
   {data.announcements.map(a=><View key={a.id} style={{padding:16,borderRadius:12,backgroundColor:'white',gap:7}}>
    <Text style={{fontSize:19,fontWeight:'700',color:ink}}>{a.urgent?'IMPORTANT · ':''}{String(a.title||'')}</Text>
    {text(String(a.body||''))}
    {text(date(a.created_at)+(a.withdrawn_at?' · Retirée':''))}
    {data.receipts.some(r=>r.announcement_id===a.id&&r.user_id===account.userId)?
     text('Lecture confirmée'):
     canAcknowledgeAnnouncement(a,account,data.announcements,data.receipts)?
      button('Confirmer ma lecture',()=>acknowledge(a)):null}
    {canWithdrawAnnouncement(a,account,data.features,data.announcements)?
     button('Retirer la publication',()=>withdraw(a)):null}
   </View>)}
   {!data.announcements.length?text('Aucune annonce publiée.'):null}
   {canNote?<View style={{gap:9}}>
    <Text style={{fontSize:20,color:ink}}>Notes de quart</Text>
    {field('Ma note opérationnelle',note,setNote,3000,true)}
    {button('Enregistrer ma note',saveNote)}
    {text('Visible par vous et les responsables autorisés du département.')}
    {data.notes.map(n=><View key={n.id} style={{padding:14,backgroundColor:'white',borderRadius:10,gap:5}}>
     {text(String(n.body||''))}{text(date(n.created_at))}
    </View>)}
   </View>:null}
  </>:null}
 </ScrollView>;
}
