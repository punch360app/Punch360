import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {AppState, Platform} from 'react-native';
import {createClient} from '@supabase/supabase-js';

// La clé « publishable » est publique PAR CONCEPTION. Aucune clé service_role/Stripe secrète ici.
// Le projet dédié PUNCH 360° est protégé par ses politiques RLS.
export const PUNCH_SUPABASE_URL = 'https://mlabstdxxwjdpfaxiwmg.supabase.co';
const publicKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_nTBs7dPcKFdkqUZVc3D1YA_LddvQj0b';
export const supabase = createClient(PUNCH_SUPABASE_URL,publicKey,{
 global:{fetch:async(input,init)=>{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),12000);try{return await fetch(input,{...init,signal:init?.signal||controller.signal})}finally{clearTimeout(timer)}}},
 auth:{
  storage: Platform.OS==='web'?undefined:AsyncStorage,
  autoRefreshToken:true,
  persistSession:true,
  detectSessionInUrl:false,
  flowType:'pkce'
 }
});
if(Platform.OS!=='web'){
 AppState.addEventListener('change',state=>{
  if(state==='active')supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
 });
}
