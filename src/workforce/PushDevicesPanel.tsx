import React,{useEffect,useRef,useState} from 'react';
import {Platform,Pressable,Text,View} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {createPushDevicesScope} from './pushDevicesScope.js';

type Row={id:string;platform:string;updated_at:string;revoked_at:string|null};
type Token=ReturnType<ReturnType<typeof createPushDevicesScope>['current']>;
const failure='Impossible de vérifier tes appareils. Réessaie.';
export function PushDevicesPanel({account}:{account:WorkspaceAccount}){
 const [devices,setDevices]=useState<Row[]>([]);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false);
 const scope=useRef(createPushDevicesScope(account.companyId,account.userId,account.role));
 const alive=useRef(false),sequence=useRef(0),actionLock=useRef(false);
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
  const request=++sequence.current;
  setLoading(true);setLoaded(false);
  try{
   const r=await supabase.rpc('list_push_devices',{p_company:account.companyId});
   if(!current(token)||request!==sequence.current)return;
   if(r.error||!Array.isArray(r.data)||r.data.length>100)throw Error('read');
   const safe:Row[]=r.data.map((d:Row)=>({
    id:d.id,platform:d.platform,updated_at:d.updated_at,revoked_at:d.revoked_at??null
   }));
   if(safe.some(d=>typeof d.id!=='string'||!['ios','android'].includes(d.platform)||
     typeof d.updated_at!=='string'||(d.revoked_at!==null&&typeof d.revoked_at!=='string')))
    throw Error('format');
   setDevices(safe);setError('');setLoaded(true);
  }catch{
   if(current(token)&&request===sequence.current){
    setDevices([]);setLoaded(false);setError(failure);
   }
  }finally{
   if(current(token)&&request===sequence.current)setLoading(false);
  }
 }
 useEffect(()=>{
  const token=scope.current.enter(account.companyId,account.userId,account.role);
  alive.current=true;sequence.current++;actionLock.current=false;
  setDevices([]);setError('');setNotice('');setBusy(false);setLoading(true);setLoaded(false);
  void load(token);
  return()=>{alive.current=false;scope.current.invalidate();sequence.current++};
 },[account.companyId,account.userId,account.role]);

 async function run(operation:(token:Token)=>Promise<void>){
  const token=scope.current.current();
  if(!identityMatches||!current(token)||!loaded||actionLock.current)return;
  actionLock.current=true;setBusy(true);setError('');setNotice('');
  try{
   await operation(token);
   if(!current(token))return;
   await load(token);
   if(current(token)&&scope.current.allows(token))setNotice('Liste des appareils actualisée.');
  }catch{
   if(current(token))setError('Opération impossible. Vérifie les autorisations et réessaie.');
  }finally{
   if(current(token)){actionLock.current=false;setBusy(false)}
  }
 }
 async function register(token:Token){
  if(!current(token))return;
  if(!Device.isDevice||!['android','ios'].includes(Platform.OS))
   throw Error('A physical iOS or Android device is required');
  const projectId=Constants.easConfig?.projectId||Constants.expoConfig?.extra?.eas?.projectId;
  if(!projectId)throw Error('Expo/EAS project is required');
  if(Platform.OS==='android'){
   await Notifications.setNotificationChannelAsync('work',{name:'PUNCH · Travail',importance:Notifications.AndroidImportance.DEFAULT});
   if(!current(token))return;
  }
  const permission=await Notifications.requestPermissionsAsync();
  if(!current(token))return;
  if(!permission.granted)throw Error('Permission refused');
  const pushToken=(await Notifications.getExpoPushTokenAsync({projectId})).data;
  if(!current(token))return;
  const r=await supabase.rpc('register_push_device',{
   p_company:account.companyId,p_token:pushToken,p_platform:Platform.OS
  });
  if(!current(token))return;
  if(r.error)throw Error('Registration denied');
 }
 async function revoke(token:Token,id:string){
  if(!current(token)||!devices.some(d=>d.id===id&&!d.revoked_at))return;
  const r=await supabase.rpc('revoke_push_device',{p_device:id});
  if(!current(token))return;
  if(r.error)throw Error('Revocation denied');
 }
 if(!identityMatches)return <View style={{padding:16,backgroundColor:'#FAFBF8'}}>
  <Text accessibilityLiveRegion="polite">Changement de compte en cours…</Text>
 </View>;
 return <View style={{padding:16,gap:12,backgroundColor:'#FAFBF8',borderRadius:12}}>
  <Text style={{fontSize:20,color:'#2F4935',fontWeight:'700'}}>Mes appareils push</Text>
  <Text>Autoriser un appareil ne remplace pas tes préférences de notifications. La réception exige une configuration Expo/EAS et des fournisseurs.</Text>
  {loading?<Text accessibilityLiveRegion="polite">Chargement des appareils…</Text>:null}
  {busy?<Text accessibilityLiveRegion="polite">Opération en cours…</Text>:null}
  {error?<Text accessibilityRole="alert" style={{color:'#A1392D'}}>{error}</Text>:null}
  {notice?<Text accessibilityLiveRegion="polite">{notice}</Text>:null}
  {!loading&&!busy?<Pressable accessibilityRole="button" accessibilityLabel="Réessayer le chargement des appareils"
   onPress={()=>{setError('');void load()}} style={{padding:12,minHeight:48,backgroundColor:'#E1E8DB',borderRadius:9,justifyContent:'center'}}>
   <Text>{loaded?'Actualiser':'Réessayer le chargement'}</Text>
  </Pressable>:null}
  <Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{disabled}}
   onPress={()=>void run(register)}
   style={{padding:14,minHeight:48,justifyContent:'center',backgroundColor:'#E1E8DB',borderRadius:9,opacity:disabled?0.5:1}}>
   <Text>Autoriser cet appareil</Text></Pressable>
  {loaded?devices.map(d=><View key={d.id} style={{gap:6,paddingVertical:5}}>
   <Text>{d.platform} · {new Date(d.updated_at).toLocaleDateString('fr-CA')} · {d.revoked_at?'Révoqué':'Autorisé'}</Text>
   {!d.revoked_at?<Pressable accessibilityRole="button" disabled={disabled} accessibilityState={{disabled}}
    onPress={()=>void run(token=>revoke(token,d.id))}
    style={{padding:14,minHeight:48,backgroundColor:'#E1E8DB',borderRadius:9,justifyContent:'center',opacity:disabled?0.5:1}}>
    <Text>Révoquer cet appareil</Text></Pressable>:null}
  </View>):null}
 </View>;
}
