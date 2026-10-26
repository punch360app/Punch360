import * as Network from 'expo-network';
import {cachedLocalIdentity,rememberLocalIdentity,forgetLocalIdentity} from './localIdentity';
import {processNativeOAuthCallback} from './nativeOAuthCallback';
import {requireServerVerifiedIdentity} from './serverVerifiedIdentity';
import {mayRestoreCachedWorkspace} from './offlineWorkspaceGuard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,Linking,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import type {Session} from '@supabase/supabase-js';
import {supabase} from '../lib/supabase';
import {listVerifiedWorkspaces,chooseVerifiedWorkspace} from '../../web/live/company-workspaces.js';

export type WorkspaceAccount={companyId:string;companyName:string;role:'employee'|'lead'|'admin'|'boss';userId:string;billingStatus:string;email:string;edition?:'construction'|'essential';defaultJobId?:string|null};
const MEMBERSHIP_COLUMNS='user_id,company_id,role,status,companies(name,billing_status,product_edition,default_punch_job_id)';
const RECOVERY_REDIRECT='punchapp://auth/callback?type=recovery';
const CO={bg:'#08131C',panel:'#132630',yellow:'#FFBF40',mint:'#22E1B1',muted:'#A9BAC4',white:'#FFFFFF',stroke:'#38515E'};
export function AuthGate({children}:{children:(account:WorkspaceAccount)=>React.ReactNode}){
 const [session,setSession]=useState<Session|null>(null);
 const [boot,setBoot]=useState(true);
 const [busy,setBusy]=useState(false);
 const [account,setAccount]=useState<WorkspaceAccount|null>(null);
 const [workspaces,setWorkspaces]=useState<WorkspaceAccount[]>([]);
 const [showWorkspacePicker,setShowWorkspacePicker]=useState(false);
 const [email,setEmail]=useState('');
 const [password,setPassword]=useState('');
 const [newPassword,setNewPassword]=useState('');
 const [confirmPassword,setConfirmPassword]=useState('');
 const [recoveryRequest,setRecoveryRequest]=useState(false);
 const [isRecovering,setIsRecovering]=useState(false);
 const [notice,setNotice]=useState('');
 const [companyName,setCompanyName]=useState('');
 const [edition,setEdition]=useState<'construction'|'essential'>('construction');
 const [inviteToken,setInviteToken]=useState('');
 const [loginMode,setLoginMode]=useState<'login'|'signup'>('login');
 const [error,setError]=useState('');
 // An older membership query must never revive another user's workspace.
 const authRevision=useRef(0);
 // An explicit logout must block delayed offline restoration immediately,
 // even while the identity cache is being removed asynchronously.
 const explicitlySignedOut=useRef(false);
 async function cachedWorkspace(id:string){
  const selected=await AsyncStorage.getItem('punch-last-company:'+id);
  if(!selected)return null;
  const raw=await AsyncStorage.getItem('punch-workspace:'+id+':'+selected);
  if(!raw)return null;
  try{const data=JSON.parse(raw) as WorkspaceAccount;return data.userId===id&&data.companyId===selected?data:null;}
  catch{return null;}
 }
 async function refresh(){
  const revision=++authRevision.current;
  const current=()=>revision===authRevision.current;
  const offlineAllowed=()=>mayRestoreCachedWorkspace(revision,authRevision.current,explicitlySignedOut.current);
  setError('');
  try{
   const network=await Network.getNetworkStateAsync();
   if(!current())return;
   if(network.isConnected===false||network.isInternetReachable===false){
    if(!offlineAllowed()){
     if(!current())return;
     setWorkspaces([]);setAccount(null);setShowWorkspacePicker(false);setSession(null);
     setError('Reconnecte-toi en ligne pour accéder à ton compte.');return;
    }
    const local=await cachedLocalIdentity();if(!offlineAllowed())return;
    const cache=local?await cachedWorkspace(local.id):null;if(!offlineAllowed())return;
    setWorkspaces([]);setAccount(cache);setShowWorkspacePicker(false);setSession(null);
    setError(cache?'Mode hors ligne — espace sélectionné seulement. Les changements d’entreprise nécessitent Internet.':'Connexion Internet requise.');return;
   }
   const {data,error:sessionError}=await supabase.auth.getSession();
   if(!current())return;
   if(sessionError||!data.session){
    setSession(null);setAccount(null);setWorkspaces([]);setShowWorkspacePicker(false);
    if(sessionError)setError('Session non vérifiée — reconnecte-toi en ligne.');
    return;
   }
   // The cached getSession().user is not trustworthy for roles. Confirm
   // the exact token with the Auth server BEFORE querying company_members.
   const serverIdentity=await supabase.auth.getUser(data.session.access_token);
   if(!current())return;
   const u=requireServerVerifiedIdentity(data.session,serverIdentity);
   setSession({...data.session,user:u});
   const {data:memberships,error:e}=await supabase.from('company_members')
    .select(MEMBERSHIP_COLUMNS).eq('user_id',u.id).eq('status','active').order('company_id').limit(100);
   if(!current())return;
   if(e){setAccount(null);setWorkspaces([]);setShowWorkspacePicker(false);setError('Impossible de vérifier vos accès. Réessayez.');return;}
   const verified=listVerifiedWorkspaces(memberships||[],u) as WorkspaceAccount[];
   const stored=await AsyncStorage.getItem('punch-last-company:'+u.id);
   if(!current())return;
   const chosen=chooseVerifiedWorkspace(verified,stored) as WorkspaceAccount|null;
   if(chosen){
    await AsyncStorage.setItem('punch-last-company:'+u.id,chosen.companyId);if(!current())return;
    await AsyncStorage.setItem('punch-workspace:'+u.id+':'+chosen.companyId,JSON.stringify(chosen));
    if(!current())return;
    await rememberLocalIdentity(u);if(!current())return;
    setAccount(chosen);setShowWorkspacePicker(false);
   }else{
    setAccount(null);setShowWorkspacePicker(verified.length>1);
    if(!verified.length){
     await AsyncStorage.removeItem('punch-last-company:'+u.id);if(!current())return;
    }
   }
   if(current())setWorkspaces(verified);
  }catch{
   if(!current())return;
   setSession(null);setAccount(null);setWorkspaces([]);setShowWorkspacePicker(false);
   setError('Identité ou accès non vérifié. Reconnecte-toi en ligne.');
  }finally{if(current())setBoot(false);}
 }
 async function selectWorkspace(companyId:string){
  if(busy)return;
  const revision=authRevision.current;
  const current=()=>revision===authRevision.current;
  setBusy(true);setError('');
  try{
   const {data,error:authError}=await supabase.auth.getUser();
   if(!current())return;
   if(authError||!data.user||data.user.id!==session?.user.id)throw Error('Reconnecte-toi pour choisir une entreprise.');
   const user=data.user;
   const {data:memberships,error:memberError}=await supabase.from('company_members')
    .select(MEMBERSHIP_COLUMNS).eq('user_id',user.id).eq('status','active').order('company_id').limit(100);
   if(!current())return;
   if(memberError)throw Error('Impossible de confirmer cet accès.');
   const verified=listVerifiedWorkspaces(memberships||[],user) as WorkspaceAccount[];
   const selected=verified.find(w=>w.companyId===companyId);
   if(!selected){setAccount(null);setWorkspaces(verified);setShowWorkspacePicker(verified.length>1);throw Error('Accès retiré : cette entreprise n’est plus accessible.');}
   // Persist only a verified workspace. Never display it after the auth generation changes.
   await AsyncStorage.setItem('punch-last-company:'+user.id,selected.companyId);
   if(!current())return;
   await AsyncStorage.setItem('punch-workspace:'+user.id+':'+selected.companyId,JSON.stringify(selected));
   if(!current())return;
   setWorkspaces(verified);setAccount(selected);setShowWorkspacePicker(false);
  }catch(e:any){if(current())setError(e.message||'Changement d’entreprise refusé.');}
  finally{if(current())setBusy(false);}
 }
 useEffect(()=>{
  refresh();
  const {data:sub}=supabase.auth.onAuthStateChange((_event,newSession)=>{
   // Invalidate membership queries immediately, before async local storage calls.
   ++authRevision.current;
   setBusy(false);
   if(_event==='SIGNED_OUT'){
    explicitlySignedOut.current=true;
    void forgetLocalIdentity().catch(()=>{});
    setIsRecovering(false);setWorkspaces([]);setAccount(null);setShowWorkspacePicker(false);
    setSession(null);setBoot(false);setError('');return;
   }
   explicitlySignedOut.current=false;
   if(_event==='PASSWORD_RECOVERY')setIsRecovering(true);
   setSession(newSession);
   setBoot(true);
   // Différer l'appel asynchrone au prochain tour pour éviter un deadlock Supabase Auth.
   setTimeout(()=>refresh(),0);
  });
  let active=true;
  const handledCodes=new Set<string>();
  async function handleNativeLink(url:string|null){
   const result=await processNativeOAuthCallback(
    url,handledCodes,code=>supabase.auth.exchangeCodeForSession(code));
   if(!active)return;
   if(result==='recovery')setIsRecovering(true);
   else if(result==='invalid')setError('Lien de connexion invalide ou annulé.');
   else if(result==='failed')setError('Lien expiré ou connexion impossible. Recommence la connexion.');
  }
  // Foreground and cold-start redirects are two separate paths on iOS/Android.
  // Register first, then inspect the launch URL; duplicated codes are ignored.
  const listener=Linking.addEventListener('url',({url})=>{void handleNativeLink(url);});
  void Linking.getInitialURL().then(url=>{if(active)void handleNativeLink(url);})
   .catch(()=>{if(active)setError('Impossible de lire le lien de connexion. Réessaie.');});
  return()=>{active=false;sub.subscription.unsubscribe();listener.remove()};
 },[]);
 async function emailAuth(){
  setError('');setBusy(true);
  try{
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))throw Error('Entre une adresse courriel valide.');
   if(!password||(loginMode==='signup'&&password.length<8))throw Error(loginMode==='signup'?'Choisis un mot de passe d’au moins 8 caractères.':'Entre ton mot de passe.');
   const result=loginMode==='signup'?
    await supabase.auth.signUp({email:email.trim().toLowerCase(),password,options:{emailRedirectTo:'punchapp://auth/callback'}}):
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

 async function requestRecovery(){
  setBusy(true);setError('');setNotice('');
  try{
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))throw Error('Entre une adresse courriel valide.');
   const r=await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(),{redirectTo:RECOVERY_REDIRECT});
   if(r.error)throw r.error;
   setNotice('Si ce compte existe, un lien de récupération sera envoyé. Consulte aussi les indésirables.');
  }catch(e:any){setError(e.message||'Impossible d’envoyer le lien pour le moment.');}
  finally{setBusy(false);}
 }
 async function completeRecovery(){
  setBusy(true);setError('');setNotice('');
  try{
   if(!isRecovering||!session)throw Error('Lien de récupération invalide ou expiré. Redemande un nouveau lien.');
   if(newPassword.length<8)throw Error('Choisis un mot de passe d’au moins 8 caractères.');
   if(newPassword!==confirmPassword)throw Error('Les deux mots de passe ne correspondent pas.');
   const userId=session.user.id;
   const r=await supabase.auth.updateUser({password:newPassword});if(r.error)throw r.error;
   setNewPassword('');setConfirmPassword('');setPassword('');
   const keys=await AsyncStorage.getAllKeys();
   const scoped=keys.filter(key=>key==='punch-last-company:'+userId||key==='punch-workspace:'+userId||key.startsWith('punch-workspace:'+userId+':'));
   if(scoped.length)await AsyncStorage.multiRemove(scoped);
   await forgetLocalIdentity();
   const out=await supabase.auth.signOut({scope:'global'});
   if(out.error)throw Error('Mot de passe modifié, mais la fermeture des sessions a échoué. Ferme tes sessions dans les paramètres du compte.');
   setAccount(null);setIsRecovering(false);setRecoveryRequest(false);setLoginMode('login');
   setNotice('Mot de passe mis à jour. Connecte-toi de nouveau.');
  }catch(e:any){setError(e.message||'La mise à jour a échoué.');}
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
 if(account&&!isRecovering&&!showWorkspacePicker)return <View style={{flex:1}}>
   {workspaces.length>1?<Pressable accessibilityRole="button" accessibilityLabel="Changer d’entreprise" onPress={()=>setShowWorkspacePicker(true)} style={{padding:10,backgroundColor:'#E1E8DB',alignItems:'center'}}>
    <Text style={{color:'#2F4935',fontWeight:'700'}}>⌄ {account.companyName} · Changer d’entreprise</Text>
   </Pressable>:null}
   <View key={account.companyId+':'+account.role} style={{flex:1}}>{children(account)}</View>
  </View>;
 if(session&&!isRecovering&&showWorkspacePicker&&workspaces.length>0)return <View style={st.center}><ScrollView contentContainerStyle={st.stack}>
   <Text style={st.logo}>PUNCH 360°</Text><Text style={st.head}>Choisir mon entreprise</Text>
   <Text style={st.hint}>Chaque entreprise conserve son rôle, ses horaires et ses données. Votre employeur ne voit pas les autres.</Text>
   {workspaces.map(w=><Pressable key={w.companyId} accessibilityRole="button" disabled={busy} style={st.social} onPress={()=>selectWorkspace(w.companyId)}>
    <Text style={st.socialText}>{w.companyName}</Text>
    <Text style={st.hint}>{w.edition==='essential'?'Essentiel':'Construction'} · {w.role}</Text>
   </Pressable>)}
   {account?<Pressable onPress={()=>setShowWorkspacePicker(false)}><Text style={st.alt}>Retour à {account.companyName}</Text></Pressable>:null}
   {error?<Text style={st.error}>{error}</Text>:null}
   {busy?<ActivityIndicator color={CO.mint}/>:null}
  </ScrollView></View>;
 return <View style={st.center}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={st.stack}>
   <Text style={st.logo}>⛑ PUNCH <Text style={{color:CO.yellow}}>360°</Text></Text>
   <Text style={st.head}>{isRecovering?'Choisir un nouveau mot de passe':recoveryRequest?'Mot de passe oublié':session?'Créer ma compagnie':loginMode==='login'?'Se connecter':'Créer un compte'}</Text>
   <Text style={st.hint}>{isRecovering?'Ton identité a été vérifiée par le lien de récupération Supabase.':recoveryRequest?'Reçois un lien sécurisé pour réinitialiser ton accès.':session?'Configuration de ton espace entreprise. Tu devras choisir et payer un forfait avant d’inviter des employés.':'Tes heures. Tes équipes. Tes chantiers. Tout au même endroit.'}</Text>
   {isRecovering?<>\n    <TextInput style={st.input} placeholder="Nouveau mot de passe" placeholderTextColor="#718693" secureTextEntry autoCapitalize="none" autoComplete="new-password" value={newPassword} onChangeText={setNewPassword}/>\n    <TextInput style={st.input} placeholder="Confirmer le nouveau mot de passe" placeholderTextColor="#718693" secureTextEntry autoCapitalize="none" autoComplete="new-password" value={confirmPassword} onChangeText={setConfirmPassword}/>\n    <Pressable style={[st.button,{backgroundColor:CO.yellow}]} disabled={busy} onPress={completeRecovery}><Text style={st.buttonText}>Enregistrer et fermer les sessions</Text></Pressable>\n   </>:session?<>
    <TextInput style={st.input} placeholderTextColor="#718693" placeholder="Code d’invitation reçu" value={inviteToken} onChangeText={setInviteToken} autoCapitalize="none"/>
    <Pressable style={st.social} disabled={busy} onPress={async()=>{setBusy(true);setError('');try{const r=await supabase.rpc('accept_company_invitation',{p_token:inviteToken.trim()});if(r.error)throw r.error;await refresh()}catch(e:any){setError(e.message)}finally{setBusy(false)}}}><Text style={st.socialText}>Rejoindre la compagnie invitante</Text></Pressable>
    <View style={{gap:8}}>{(['essential','construction'] as const).map(v=><Pressable key={v} style={st.social} onPress={()=>setEdition(v)}><Text style={st.socialText}>{edition===v?'✓ ':''}{v==='essential'?'Essentiel — bureau / manufacture · 19 $ / mois proposés':'Construction — chantiers et commandes · 49 $ / mois proposés'}</Text></Pressable>)}</View>
    <TextInput style={st.input} placeholderTextColor="#718693" placeholder="Nom de ma compagnie" value={companyName} onChangeText={setCompanyName} autoCapitalize="words"/>
    <Pressable style={[st.button,{backgroundColor:CO.yellow}]} disabled={busy} onPress={createCompany}><Text style={st.buttonText}>Créer ma compagnie</Text></Pressable>
    <Pressable onPress={()=>supabase.auth.signOut()}><Text style={st.alt}>Utiliser un autre compte</Text></Pressable>
   </>:recoveryRequest?<>
    <TextInput style={st.input} placeholder="Adresse courriel du compte" placeholderTextColor="#718693" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail}/>
    <Pressable style={[st.button,{backgroundColor:CO.yellow}]} disabled={busy} onPress={requestRecovery}><Text style={st.buttonText}>Envoyer un lien sécurisé</Text></Pressable>
    <Pressable onPress={()=>{setRecoveryRequest(false);setNotice('');setError('')}}><Text style={st.alt}>Retour à la connexion</Text></Pressable>
   </>:<>
    <TextInput style={st.input} placeholder="Adresse courriel" placeholderTextColor="#718693" keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail}/>
    <TextInput style={st.input} placeholder="Mot de passe" placeholderTextColor="#718693" autoCapitalize="none" secureTextEntry value={password} onChangeText={setPassword}/>
    <Pressable style={[st.button,{backgroundColor:CO.yellow}]} disabled={busy} onPress={emailAuth}><Text style={st.buttonText}>{loginMode==='login'?'Se connecter':'Créer mon compte'}</Text></Pressable>
    <Pressable style={st.social} disabled={busy} onPress={()=>social('google')}><Text style={st.socialText}>Continuer avec Google</Text></Pressable>
    <Pressable style={st.social} disabled={busy} onPress={()=>social('apple')}><Text style={st.socialText}>Continuer avec Apple</Text></Pressable>
    {loginMode==='login'?<Pressable onPress={()=>{setRecoveryRequest(true);setError('');setNotice('')}}><Text style={st.alt}>Mot de passe oublié ?</Text></Pressable>:null}
    <Pressable onPress={()=>{setLoginMode(v=>v==='login'?'signup':'login');setError('');setNotice('')}}><Text style={st.alt}>{loginMode==='login'?'Nouveau? Créer un compte':'Déjà inscrit? Se connecter'}</Text></Pressable>
   </>}
   {error?<Text style={st.error}>{error}</Text>:null}{notice?<Text style={st.hint}>{notice}</Text>:null}
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
