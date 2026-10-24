import * as Network from 'expo-network';
import {cachedLocalIdentity,rememberLocalIdentity,forgetLocalIdentity} from './localIdentity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React,{useEffect,useState} from 'react';
import {ActivityIndicator,Alert,Linking,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import type {Session} from '@supabase/supabase-js';
import {supabase} from '../lib/supabase';

export type WorkspaceAccount={companyId:string;companyName:string;role:'employee'|'lead'|'admin'|'boss';userId:string;billingStatus:string;email:string;edition?:'construction'|'essential';defaultJobId?:string|null};
type Member={company_id:string;role:WorkspaceAccount['role'];companies:{name:string;billing_status:string;product_edition?:'construction'|'essential';default_punch_job_id?:string|null}|{name:string;billing_status:string;product_edition?:'construction'|'essential';default_punch_job_id?:string|null}[]|null};
const CO={bg:'#08131C',panel:'#132630',yellow:'#FFBF40',mint:'#22E1B1',muted:'#A9BAC4',white:'#FFFFFF',stroke:'#38515E'};
export function AuthGate({children}:{children:(account:WorkspaceAccount)=>React.ReactNode}){
 const [session,setSession]=useState<Session|null>(null);
 const [boot,setBoot]=useState(true);
 const [busy,setBusy]=useState(false);
 const [account,setAccount]=useState<WorkspaceAccount|null>(null);
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [companyName,setCompanyName]=useState('');
 const [edition,setEdition]=useState<'construction'|'essential'>('construction');
 const [inviteToken,setInviteToken]=useState('');
 const [loginMode,setLoginMode]=useState<'login'|'signup'>('login');
 const [error,setError]=useState('');
 async function refresh(){
  const network=await Network.getNetworkStateAsync();if(network.isConnected===false||network.isInternetReachable===false){const local=await cachedLocalIdentity();if(local){const saved=await AsyncStorage.getItem('punch-workspace:'+local.id);if(saved){setAccount(JSON.parse(saved));setBoot(false);return;}}}
  const {data,error:sessionError}=await supabase.auth.getSession();
  setSession(data.session);
  if(!data.session){const local=sessionError?await cachedLocalIdentity():null;const saved=local?await AsyncStorage.getItem('punch-workspace:'+local.id):null;setAccount(saved?JSON.parse(saved):null);setBoot(false);return;}
  const u=data.session.user;await rememberLocalIdentity(u);
  const {data:membership,error:e}=await supabase.from('company_members')
   .select('company_id,role,companies(name,billing_status,product_edition,default_punch_job_id)').eq('user_id',u.id).eq('status','active').limit(1).maybeSingle();
  if(e){const cached=await AsyncStorage.getItem('punch-workspace:'+u.id);if(cached){setAccount(JSON.parse(cached));setError('Mode hors ligne');}else{setError(e.message);setAccount(null);}}
  else if(membership){
   const m=membership as unknown as Member;
   const company=Array.isArray(m.companies)?m.companies[0]:m.companies;
   const workspace={companyId:m.company_id,companyName:company?.name||'Ma compagnie',role:m.role,userId:u.id,email:u.email||'',billingStatus:company?.billing_status||'setup',edition:company?.product_edition||'construction',defaultJobId:company?.default_punch_job_id||null};setAccount(workspace);await AsyncStorage.setItem('punch-workspace:'+u.id,JSON.stringify(workspace));
  }else{setAccount(null);await AsyncStorage.removeItem('punch-workspace:'+u.id);}
  setBoot(false);
 }
 useEffect(()=>{
  refresh();
  const {data:sub}=supabase.auth.onAuthStateChange((_event,newSession)=>{
   if(_event==='SIGNED_OUT')forgetLocalIdentity();
   setSession(newSession);
   setBoot(true);
   // Différer l'appel asynchrone au prochain tour pour éviter un deadlock Supabase Auth.
   Promise.resolve().then(()=>refresh());
  });
  const listener=Linking.addEventListener('url',async({url})=>{
   try{
    if(!url.includes('/auth/callback'))return;
    const code=new URL(url).searchParams.get('code');
    if(code){const {error:e}=await supabase.auth.exchangeCodeForSession(code);if(e)throw e;}
    else setError('Connexion annulée ou URL de retour invalide.');
   }catch(e:any){setError(e.message||'Connexion impossible');}
  });
  return()=>{sub.subscription.unsubscribe();listener.remove()};
 },[]);
 async function emailAuth(){
  setError('');setBusy(true);
  try{
   if(!email.trim()||password.length<8)throw Error('Courriel requis et mot de passe de 8 caractères minimum.');
   const result=loginMode==='signup'?
    await supabase.auth.signUp({email:email.trim().toLowerCase(),password}):
    await supabase.auth.signInWithPassword({email:email.trim().toLowerCase(),password});
   if(result.error)throw result.error;
   if(loginMode==='signup'&&!result.data.session)Alert.alert('Vérifie tes courriels','Un lien de confirmation peut être nécessaire pour activer ton compte.');
  }catch(e:any){setError(e.message||'Connexion impossible');}finally{setBusy(false);}
 }
 async function social(provider:'google'|'apple'){
  setBusy(true);setError('');
  try{
   const {data,error:e}=await supabase.auth.signInWithOAuth({
    provider,options:{redirectTo:'punchapp://auth/callback',skipBrowserRedirect:true}
   });
   if(e)throw e;
   if(!data.url)throw Error('Lien de connexion non disponible');
   await Linking.openURL(data.url);
  }catch(e:any){setError(e.message||'Fournisseur non configuré');}
  finally{setBusy(false);}
 }
 async function createCompany(){
  setBusy(true);setError('');
  try{
   const {error:e}=await supabase.rpc('create_company_for_edition',{p_name:companyName.trim(),p_edition:edition});
   if(e)throw e;
   await refresh();
  }catch(e:any){setError(e.message||'Création impossible');}
  finally{setBusy(false);}
 }
 if(boot)return <View style={st.center}><ActivityIndicator size="large" color={CO.yellow}/><Text style={st.hint}>Chargement sécurisé de PUNCH 360°…</Text></View>;
 if(account)return <>{children(account)}</>;
 return <View style={st.center}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={st.stack}>
   <Text style={st.logo}>⛑ PUNCH <Text style={{color:CO.yellow}}>360°</Text></Text>
   <Text style={st.head}>{session?'Créer ma compagnie':loginMode==='login'?'Se connecter':'Créer un compte'}</Text>
   <Text style={st.hint}>{session?'Configuration de ton espace entreprise. Tu devras choisir et payer un forfait avant d’inviter des employés.':'Tes heures. Tes équipes. Tes chantiers. Tout au même endroit.'}</Text>
   {session?<>
    <TextInput style={st.input} placeholderTextColor="#718693" placeholder="Code d’invitation reçu" value={inviteToken} onChangeText={setInviteToken} autoCapitalize="none"/>
    <Pressable style={st.social} disabled={busy} onPress={async()=>{setBusy(true);setError('');try{const r=await supabase.rpc('accept_company_invitation',{p_token:inviteToken.trim()});if(r.error)throw r.error;await refresh()}catch(e:any){setError(e.message)}finally{setBusy(false)}}}><Text style={st.socialText}>Rejoindre la compagnie invitante</Text></Pressable>
    <View style={{gap:8}}>{(['essential','construction'] as const).map(v=><Pressable key={v} style={st.social} onPress={()=>setEdition(v)}><Text style={st.socialText}>{edition===v?'✓ ':''}{v==='essential'?'Essentiel — bureau / manufacture · 19 $ / mois proposés':'Construction — chantiers et commandes · 49 $ / mois proposés'}</Text></Pressable>)}</View>
    <TextInput style={st.input} placeholderTextColor="#718693" placeholder="Nom de ma compagnie" value={companyName} onChangeText={setCompanyName} autoCapitalize="words"/>
    <Pressable style={[st.button,{backgroundColor:CO.yellow}]} disabled={busy} onPress={createCompany}><Text style={st.buttonText}>Créer ma compagnie</Text></Pressable>
    <Pressable onPress={()=>supabase.auth.signOut()}><Text style={st.alt}>Utiliser un autre compte</Text></Pressable>
   </>:<>
    <TextInput style={st.input} placeholder="Adresse courriel" placeholderTextColor="#718693" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail}/>
    <TextInput style={st.input} placeholder="Mot de passe" placeholderTextColor="#718693" autoCapitalize="none" secureTextEntry value={password} onChangeText={setPassword}/>
    <Pressable style={[st.button,{backgroundColor:CO.yellow}]} disabled={busy} onPress={emailAuth}><Text style={st.buttonText}>{loginMode==='login'?'Se connecter':'Créer mon compte'}</Text></Pressable>
    <Pressable style={st.social} disabled={busy} onPress={()=>social('google')}><Text style={st.socialText}>Continuer avec Google</Text></Pressable>
    <Pressable style={st.social} disabled={busy} onPress={()=>social('apple')}><Text style={st.socialText}>Continuer avec Apple</Text></Pressable>
    <Pressable onPress={()=>{setLoginMode(v=>v==='login'?'signup':'login');setError('')}}><Text style={st.alt}>{loginMode==='login'?'Nouveau? Créer un compte':'Déjà inscrit? Se connecter'}</Text></Pressable>
   </>}
   {error?<Text style={st.error}>{error}</Text>:null}
   {busy?<ActivityIndicator color={CO.mint}/>:null}
   <Text style={st.small}>Connexion Google et Apple : nécessite l’activation des fournisseurs dans Supabase et les URL de retour pour Android et iPhone.</Text>
 </ScrollView></View>
}
const st=StyleSheet.create({
 center:{flex:1,backgroundColor:CO.bg,justifyContent:'center'},
 stack:{padding:25,gap:16,justifyContent:'center',minHeight:600},
 logo:{fontSize:31,color:CO.white,fontWeight:'900'},
 head:{fontSize:26,fontWeight:'800',color:CO.white},
 hint:{color:CO.muted,lineHeight:20},
 input:{color:CO.white,backgroundColor:CO.panel,borderWidth:1,borderColor:CO.stroke,borderRadius:13,minHeight:53,paddingHorizontal:14},
 button:{minHeight:54,borderRadius:13,alignItems:'center',justifyContent:'center'},
 buttonText:{fontSize:16,fontWeight:'800',color:CO.bg},
 social:{borderRadius:13,borderWidth:1,borderColor:CO.stroke,padding:15,alignItems:'center'},
 socialText:{color:CO.white,fontWeight:'700'},
 alt:{color:CO.yellow,textAlign:'center',padding:8},
 error:{color:'#FF8484',lineHeight:19},
 small:{fontSize:11,color:'#91A8B3',textAlign:'center',lineHeight:17,marginTop:10}
});
