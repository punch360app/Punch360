import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import {supabase} from '../lib/supabase';
import {requireServerVerifiedIdentity} from './serverVerifiedIdentity';
import {selectNativeDeviceIdentity} from './deviceIdentityGate';
import {createNativeIdentityCache} from './nativeIdentityCache';
export type LocalIdentity={id:string;email?:string};
const KEY='punch-last-identity';
const cache=createNativeIdentityCache(AsyncStorage,KEY);
export function rememberLocalIdentity(user:LocalIdentity):Promise<void>{return cache.remember(user);}
export function forgetLocalIdentity():Promise<void>{return cache.forget();}
export function cachedLocalIdentity():Promise<LocalIdentity|null>{return cache.read();}
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
