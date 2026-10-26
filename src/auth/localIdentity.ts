import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import {supabase} from '../lib/supabase';
import {requireServerVerifiedIdentity} from './serverVerifiedIdentity';
import {selectNativeDeviceIdentity} from './deviceIdentityGate';
export type LocalIdentity={id:string;email?:string};
const KEY='punch-last-identity';
export async function rememberLocalIdentity(user:LocalIdentity){await AsyncStorage.setItem(KEY,JSON.stringify({id:user.id,email:user.email}));}
export async function forgetLocalIdentity(){await AsyncStorage.removeItem(KEY);}
export async function cachedLocalIdentity():Promise<LocalIdentity|null>{
 try{
  const raw=await AsyncStorage.getItem(KEY);
  return raw?JSON.parse(raw) as LocalIdentity:null;
 }catch{return null;}
}
export async function getLocalIdentity():Promise<LocalIdentity>{
 const network=await Network.getNetworkStateAsync();
 const offline=network.isConnected===false||network.isInternetReachable===false;
 return selectNativeDeviceIdentity(offline,cachedLocalIdentity,async()=>{
  const {data,error}=await supabase.auth.getSession();
  if(error||!data.session)throw Error('IDENTITY_VERIFICATION_REQUIRED');
  const verified=await supabase.auth.getUser(data.session.access_token);
  return requireServerVerifiedIdentity(data.session,verified);
 });
}
