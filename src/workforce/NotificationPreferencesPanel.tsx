import React,{useEffect,useRef,useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {createNotificationScope} from './notificationScope.js';

const categories=[['schedule','Horaires et remplacements'],['decisions','Décisions et approbations'],['announcements','Annonces'],['reminders','Rappels'],['other','Autres notifications']];
type Row={category:string;push_enabled:boolean;email_enabled:boolean;version:number};
type Token=ReturnType<ReturnType<typeof createNotificationScope>['current']>;
const failure='Impossible de vérifier tes préférences. Réessaie.';
export function NotificationPreferencesPanel({account}:{account:WorkspaceAccount}){
 const [rows,setRows]=useState<Row[]>([]);
 const [draft,setDraft]=useState<Record<string,Row>>({});
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false);
 const scope=useRef(createNotificationScope(account.companyId,account.userId,account.role));
 const alive=useRef(false),actionLock=useRef(false),requestId=useRef(0);
 const identityMatches=scope.current.matches(account.companyId,account.userId,account.role);
 const current=(token:Token)=>alive.current&&scope.current.allows(token);
 const canInteract=identityMatches&&loaded&&!loading&&!busy;

 async function load(token:Token=scope.current.current()){
  if(!current(token))return;
  const request=++requestId.current;
  setLoading(true);setLoaded(false);setError('');setNotice('');
  try{
   // Explicit user scoping complements (but does not replace) server RLS.
   const r=await supabase.from('notification_preferences')
    .select('category,push_enabled,email_enabled,version')
    .eq('company_id',account.companyId).eq('user_id',account.userId).limit(10);
   if(!current(token)||request!==requestId.current)return;
   if(r.error||!Array.isArray(r.data)||r.data.length>categories.length)throw Error('read');
   const permitted=new Set(categories.map(([id])=>id));
   if(r.data.some(x=>!permitted.has(x.category)||!Number.isInteger(x.version)||x.version<1))throw Error('invalid');
   setRows(r.data);setDraft({});setLoaded(true);setError('');
  }catch{
   if(current(token)&&request===requestId.current){
    setRows([]);setDraft({});setLoaded(false);setError(failure);
   }
  }finally{
   if(current(token)&&request===requestId.current)setLoading(false);
  }
 }
 useEffect(()=>{
  const token=scope.current.enter(account.companyId,account.userId,account.role);
  alive.current=true;requestId.current++;actionLock.current=false;
  setRows([]);setDraft({});setError('');setNotice('');
  setBusy(false);setLoading(true);setLoaded(false);
  void load(token);
  return()=>{alive.current=false;scope.current.invalidate();requestId.current++};
 },[account.companyId,account.userId,account.role]);

 async function save(category:string){
  const token=scope.current.current();
  if(!current(token)||!loaded||actionLock.current||!draft[category])return;
  if(!categories.some(([id])=>id===category))return;
  const old=rows.find(r=>r.category===category),row=draft[category];
  const version=old?.version??0;
  if(!Number.isInteger(version)||version<0){setError(failure);return;}
  actionLock.current=true;setBusy(true);setError('');setNotice('');
  try{
   const r=await supabase.rpc('set_notification_preference',{
    p_company:account.companyId,p_category:category,
    p_push:Boolean(row.push_enabled),p_email:Boolean(row.email_enabled),
    p_expected_version:version
   });
   if(!current(token))return;
   if(r.error||!Number.isInteger(r.data)||r.data<1)throw Error('save');
   setRows(values=>values.filter(v=>v.category!==category).concat({
    category,push_enabled:Boolean(row.push_enabled),email_enabled:Boolean(row.email_enabled),version:r.data
   }));
   setDraft(values=>{const next={...values};delete next[category];return next});
   setNotice('Préférence enregistrée. La livraison n’est pas encore confirmée.');
  }catch{
   if(current(token))setError('Enregistrement impossible ou version modifiée. Recharge tes préférences puis réessaie.');
  }finally{
   if(current(token)){actionLock.current=false;setBusy(false)}
  }
 }
 function toggle(category:string,channel:'push_enabled'|'email_enabled'){
  if(!canInteract||actionLock.current)return;
  const row=draft[category]||rows.find(r=>r.category===category)||
   {category,push_enabled:false,email_enabled:false,version:0};
  setDraft(values=>({...values,[category]:{...row,[channel]:!row[channel]}}));
  setNotice('');
 }
 if(!identityMatches)return <View style={{padding:16,backgroundColor:'#FAFBF8'}}>
  <Text accessibilityLiveRegion="polite" style={{color:'#2F4935'}}>Changement de compte en cours…</Text>
 </View>;
 return <View style={{padding:16,gap:12,backgroundColor:'#FAFBF8',borderRadius:12}}>
  <Text style={{fontSize:22,color:'#2F4935',fontWeight:'700'}}>Préférences de notifications</Text>
  <Text>Choix personnels propres à cette entreprise. L’historique reste disponible dans la boîte de réception.</Text>
  <Text>La livraison push et courriel nécessite encore l’activation et la recette des fournisseurs. Un choix enregistré ne confirme pas une livraison.</Text>
  {loading?<Text accessibilityLiveRegion="polite" style={{color:'#2F4935'}}>Chargement des préférences…</Text>:null}
  {busy?<Text accessibilityLiveRegion="polite" style={{color:'#2F4935'}}>Enregistrement en cours…</Text>:null}
  {notice?<Text accessibilityLiveRegion="polite" style={{color:'#2F4935'}}>{notice}</Text>:null}
  {error?<Text accessibilityRole="alert" style={{color:'#A1392D'}}>{error}</Text>:null}
  {!loading&&!busy?<Pressable accessibilityRole="button" accessibilityLabel="Réessayer le chargement des préférences"
   disabled={busy} onPress={()=>void load()}
   style={{padding:12,minHeight:48,alignSelf:'flex-start',backgroundColor:'#E1E8DB',borderRadius:9,justifyContent:'center'}}>
   <Text style={{color:'#2F4935'}}>{!loaded?'Réessayer le chargement':'Actualiser les préférences'}</Text>
  </Pressable>:null}
  {loaded?categories.map(([category,label])=>{
   const row=draft[category]||rows.find(r=>r.category===category);
   const changed=Boolean(draft[category]);
   return <View key={category} style={{gap:8,borderTopWidth:1,borderColor:'#E1E8DB',paddingTop:12}}>
    <Text style={{color:'#2F4935',fontWeight:'600'}}>{label}</Text>
    {(['push_enabled','email_enabled'] as const).map(channel=><Pressable key={channel}
     disabled={!canInteract} accessibilityRole="checkbox"
     accessibilityLabel={(channel==='push_enabled'?'Push':'Courriel')+' — '+label}
     accessibilityState={{checked:Boolean(row?.[channel]),disabled:!canInteract}}
     onPress={()=>toggle(category,channel)}
     style={{padding:12,minHeight:48,justifyContent:'center',opacity:canInteract?1:0.5}}>
     <Text style={{color:'#2F4935'}}>{row?.[channel]?'✓ ':'○ '}
      {channel==='push_enabled'?'Push sur mes appareils autorisés':'Courriel'}</Text>
    </Pressable>)}
    <Pressable disabled={!canInteract||!changed} accessibilityRole="button"
     accessibilityLabel={'Enregistrer — '+label} accessibilityState={{disabled:!canInteract||!changed}}
     onPress={()=>void save(category)}
     style={{padding:12,minHeight:48,justifyContent:'center',backgroundColor:'#E1E8DB',borderRadius:9,opacity:canInteract&&changed?1:0.5}}>
     <Text style={{color:'#2F4935'}}>Enregistrer</Text>
    </Pressable>
   </View>
  }):null}
 </View>;
}
