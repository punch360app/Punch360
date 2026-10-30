import React,{useEffect,useRef,useState} from 'react';
import {Platform,Pressable,Text,View} from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {createPushDevicesScope} from './pushDevicesScope.js';
type Row={id:string;platform:string;updated_at:string;revoked_at:string|null};
export function PushDevicesPanel({account}:{account:WorkspaceAccount}){
 const [devices,setDevices]=useState<Row[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);const generation=useRef(0);
 async function load(){const n=generation.current;const r=await supabase.rpc('list_push_devices',{p_company:account.companyId});if(r.error)throw Error(r.error.message);if(n===generation.current)setDevices(r.data||[])}
 useEffect(()=>{const n=++generation.current;setDevices([]);setError('');load().catch(e=>{if(n===generation.current)setError(e.message)});return()=>{generation.current++}},[account.companyId,account.userId]);
 async function run(fn:()=>Promise<void>){if(busy)return;const n=generation.current;setBusy(true);setError('');try{await fn();if(n===generation.current)await load()}catch(e:any){if(n===generation.current)setError(e.message)}finally{if(n===generation.current)setBusy(false)}}
 async function register(){const n=generation.current;
  if(!Device.isDevice||!['android','ios'].includes(Platform.OS))throw Error('Un appareil Android ou iOS physique avec une application installée est requis.');
  const projectId=Constants.easConfig?.projectId||Constants.expoConfig?.extra?.eas?.projectId;
  if(!projectId)throw Error('Le rattachement Expo/EAS doit être configuré avant l’autorisation push.');
  if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('work',{name:'PUNCH · Travail',importance:Notifications.AndroidImportance.DEFAULT});
  const permission=await Notifications.requestPermissionsAsync();if(!permission.granted)throw Error('Autorisation refusée. Vous pouvez la modifier dans les réglages de l’appareil.');
  const token=(await Notifications.getExpoPushTokenAsync({projectId})).data;if(n!==generation.current)return;
  const r=await supabase.rpc('register_push_device',{p_company:account.companyId,p_token:token,p_platform:Platform.OS});if(r.error)throw Error(r.error.message);
 }
 return <View style={{padding:16,gap:12,backgroundColor:'#FAFBF8',borderRadius:12}}><Text style={{fontSize:20,color:'#2F4935'}}>Mes appareils push</Text><Text>Autoriser cet appareil ne remplace pas vos préférences par catégorie. Aucun contenu RH ni motif de décision n’est affiché sur l’écran verrouillé.</Text>{error?<Text accessibilityRole="alert">{error}</Text>:null}<Pressable accessibilityRole="button" disabled={busy} onPress={()=>run(register)} style={{padding:14,backgroundColor:'#E1E8DB'}}><Text>Autoriser cet appareil</Text></Pressable>{devices.map(d=><View key={d.id}><Text>{d.platform} · {new Date(d.updated_at).toLocaleDateString('fr-CA')} · {d.revoked_at?'Révoqué':'Autorisé'}</Text>{!d.revoked_at?<Pressable accessibilityRole="button" disabled={busy} onPress={()=>run(async()=>{const r=await supabase.rpc('revoke_push_device',{p_device:d.id});if(r.error)throw Error(r.error.message)})} style={{padding:14}}><Text>Révoquer cet appareil</Text></Pressable>:null}</View>)}</View>;
}
