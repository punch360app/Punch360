import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import {supabase} from '../lib/supabase';
export type LocalIdentity={id:string;email?:string};
const KEY='punch-last-identity';
export async function rememberLocalIdentity(user:LocalIdentity){await AsyncStorage.setItem(KEY,JSON.stringify({id:user.id,email:user.email}));}
export async function forgetLocalIdentity(){await AsyncStorage.removeItem(KEY);}
export async function cachedLocalIdentity():Promise<LocalIdentity|null>{return JSON.parse(await AsyncStorage.getItem(KEY)||'null');}
export async function getLocalIdentity():Promise<LocalIdentity>{
 const network=await Network.getNetworkStateAsync();
 if(network.isConnected===false||network.isInternetReachable===false){const local=await cachedLocalIdentity();if(local)return local;}
 const {data,error}=await supabase.auth.getSession();if(data.session){await rememberLocalIdentity(data.session.user);return data.session.user;}
 if(error){const local=await cachedLocalIdentity();if(local)return local;}
 throw Error('Reconnecte-toi à ton compte pour accéder à ce téléphone. Les punchs en attente sont conservés.');
}
