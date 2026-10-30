import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {activeHandoffAdmins,canViewHandoff,createBossHandoffScope,handoffActionAllowed,handoffExpected,validHandoffStatus} from './bossHandoffScope.js';

type Admin={user_id:string;role:string;status:string};
type Handoff={id:string;company_id:string;from_user:string;to_user:string;
 status:'pending'|'accepted'|'expired';version:number;expires_at:string;
 can_accept:boolean;can_complete:boolean};
type Command='request'|'accept'|'complete'|'cancel';
type Decision={action:Command;id:string|null;version:number|null;expected:string;successor:string;reason:string};
type Token=ReturnType<ReturnType<typeof createBossHandoffScope>['current']>;
const ink='#2F4935',muted='#617766',edge='#E1E8DB',sage='#779574';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const failed='Opération non confirmée ou autorisation refusée. Actualise le statut avant de réessayer.';
const safeDate=(raw:unknown)=>{const ms=Date.parse(String(raw||''));return Number.isFinite(ms)?new Date(ms).toLocaleString('fr-CA'):'Date à vérifier'};

export function BossHandoffPanel({account}:{account:WorkspaceAccount}){
 const [mfa,setMfa]=useState(false),[code,setCode]=useState('');
 const [admins,setAdmins]=useState<Admin[]>([]),[successor,setSuccessor]=useState('');
 const [reason,setReason]=useState(''),[handoff,setHandoff]=useState<Handoff|null>(null);
 const [pending,setPending]=useState<Decision|null>(null),[confirmation,setConfirmation]=useState('');
 const [notice,setNotice]=useState(''),[error,setError]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false);
 const scope=useRef(createBossHandoffScope(account));
 const latest=useRef(account);latest.current=account;
 const alive=useRef(false),loadId=useRef(0),actionLock=useRef(false);
 const identityMatches=scope.current.matches(account),isBoss=account.role==='boss';
 const allowed=canViewHandoff(account);
 const current=(token:Token)=>alive.current&&scope.current.allows(token)&&scope.current.matches(latest.current);
 const disabled=!identityMatches||busy||loading||!loaded||!allowed;
 const panel=(children:React.ReactNode)=><View style={{backgroundColor:'#fff',borderWidth:1,
  borderColor:edge,borderRadius:14,padding:16,gap:10,marginBottom:12}}>{children}</View>;
 const button=(title:string,fn:()=>void,blocked=false)=><Pressable accessibilityRole="button"
  accessibilityLabel={title} accessibilityState={{disabled:disabled||blocked}}
  disabled={disabled||blocked} onPress={fn} style={{minHeight:48,justifyContent:'center',
   padding:12,borderRadius:10,backgroundColor:disabled||blocked?'#CBD4C8':sage,alignItems:'center'}}>
  <Text style={{color:'#fff',fontWeight:'700'}}>{title}</Text>
 </Pressable>;
 const field=(label:string,value:string,change:(v:string)=>void,numeric=false)=><View style={{gap:6}}>
  <Text style={{color:ink,fontWeight:'600'}}>{label}</Text>
  <TextInput accessibilityLabel={label} value={value} onChangeText={change}
   editable={!disabled&&!pending} maxLength={numeric?6:1000} autoCapitalize="none" autoCorrect={false}
   keyboardType={numeric?'number-pad':'default'}
   style={{minHeight:48,padding:12,color:ink,borderRadius:9,borderWidth:1,borderColor:edge}}/>
 </View>;
 async function rpc(name:string,args:Record<string,unknown>,token:Token){
  if(!current(token))throw Error('Compte modifié');
  const r=await supabase.rpc(name as any,args as any);
  if(!current(token))throw Error('Compte modifié');
  if(r.error)throw Error('Autorisation refusée');
  return r.data as any;
 }
 async function load(token:Token=scope.current.current()){
  if(!current(token)||!allowed)return false;
  const id=++loadId.current;setLoading(true);setLoaded(false);
  setPending(null);setConfirmation('');setCode('');setError('');setNotice('');
  try{
   if(!current(token))throw Error('Compte modifié');
   const aal=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
   if(!current(token)||id!==loadId.current)return false;
   if(aal.error)throw Error('MFA indisponible');
   if(aal.data?.currentLevel!=='aal2'){
    setMfa(false);setAdmins([]);setHandoff(null);setLoaded(true);
    return true;
   }
   const [status,people]=await Promise.all([
    rpc('essential_boss_handoff_status',{p_company:account.companyId},token),
    isBoss?supabase.from('company_members').select('user_id,role,status')
     .eq('company_id',account.companyId).eq('status','active').eq('role','admin').limit(501):
     Promise.resolve({data:[],error:null})
   ]);
   if(!current(token)||id!==loadId.current)return false;
   if(people.error||!Array.isArray(people.data)||people.data.length>500)throw Error('Liste indisponible');
   setAdmins(isBoss?activeHandoffAdmins(people.data,account):[]);
   setHandoff(validHandoffStatus(status,account));
   setMfa(true);setLoaded(true);return true;
  }catch{
   if(current(token)&&id===loadId.current){
    setMfa(false);setAdmins([]);setHandoff(null);setPending(null);setLoaded(false);
    setError('Session MFA ou transmission indisponible. Réessaie.');
   }
   return false;
  }finally{if(current(token)&&id===loadId.current)setLoading(false)}
 }
 useEffect(()=>{
  const token=scope.current.enter(account);
  alive.current=true;loadId.current++;actionLock.current=false;
  setMfa(false);setCode('');setAdmins([]);setSuccessor('');setReason('');
  setHandoff(null);setPending(null);setConfirmation('');
  setNotice('');setError('');setBusy(false);setLoading(true);setLoaded(false);
  if(allowed)void load(token);
  else{setLoading(false);setError('Disponible uniquement pour Boss/Admin de l’édition Essentiel.')}
  return()=>{alive.current=false;scope.current.invalidate();loadId.current++};
 },[account.companyId,account.userId,account.role,account.edition]);
 async function run(action:(token:Token)=>Promise<void>,refresh=false){
  const token=scope.current.current();
  if(disabled||!current(token)||actionLock.current)return;
  actionLock.current=true;setBusy(true);setError('');setNotice('');
  try{
   await action(token);
   if(!current(token))return;
   if(refresh)await load(token);
  }catch{
   if(current(token)){setError(failed);setPending(null);setConfirmation('')}
  }finally{if(current(token)){actionLock.current=false;setBusy(false)}}
 }
 function verifyMfa(){
  if(!/^\d{6}$/.test(code)){setError('Code MFA à six chiffres requis.');return}
  const supplied=code;
  void run(async token=>{
   if(!current(token))throw Error('Compte modifié');
   const factors=await supabase.auth.mfa.listFactors();
   if(!current(token))return;
   if(factors.error)throw Error('MFA indisponible');
   const factorId=factors.data?.totp?.find(f=>f.status==='verified')?.id;
   if(!factorId)throw Error('Authentificateur non configuré');
   if(!current(token))throw Error('Compte modifié');
   const verification=await supabase.auth.mfa.challengeAndVerify({factorId,code:supplied});
   if(!current(token))return;
   if(verification.error)throw Error('Code MFA refusé');
   // A successful challenge alone is not trusted; refetch the live assurance level.
   const aal=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
   if(!current(token))return;
   if(aal.error||aal.data?.currentLevel!=='aal2')throw Error('AAL2 non confirmé');
   setCode('');setNotice('Identité MFA confirmée.');
   await load(token);
  });
 }
 function choose(action:Command){
  if(disabled||!mfa||actionLock.current)return;
  if(!handoffActionAllowed(action,handoff,account,admins,successor,reason)){
   setError('Demande ou rôle non admissible. Actualise la demande.');return;
  }
  if(action==='request'&&!uuid.test(successor)){setError('Sélectionne un administrateur actif.');return}
  const expected=handoffExpected(action,account.companyId,handoff,successor);
  setPending({action,id:handoff?.id||null,version:handoff?.version||null,
   expected,successor,reason:reason.trim()});
  setConfirmation('');setError('');setNotice('');
 }
 function execute(){
  const decision=pending;
  if(!decision||disabled||!mfa||actionLock.current)return;
  if(decision.action!=='cancel'&&confirmation!==decision.expected){
   setError('Recopie exactement la confirmation.');return;
  }
  if(!handoffActionAllowed(decision.action,handoff,account,admins,decision.successor,decision.reason)||
   decision.id!==(handoff?.id||null)||decision.version!==(handoff?.version||null)||
   handoffExpected(decision.action,account.companyId,handoff,decision.successor)!==decision.expected){
   setPending(null);setError('Statut modifié. Actualise avant de confirmer.');return;
  }
  void run(async token=>{
   // Check live session before the sensitive RPC. Supabase also enforces an active AAL2 session.
   const aal=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
   if(!current(token))return;
   if(aal.error||aal.data?.currentLevel!=='aal2')throw Error('MFA expiré');
   if(!current(token))throw Error('Compte modifié');
   const action=decision.action;
   if(action!=='request'){
    const latestStatus=validHandoffStatus(
     await rpc('essential_boss_handoff_status',{p_company:account.companyId},token),account
    );
    if(!current(token))return;
    if(!latestStatus||latestStatus.id!==decision.id||latestStatus.version!==decision.version||
     !handoffActionAllowed(action,latestStatus,account,admins,decision.successor,decision.reason))throw Error('Version périmée');
   }
   if(!current(token))throw Error('Compte modifié');
   if(action==='request'){
    await rpc('essential_boss_handoff_request',{p_company:account.companyId,
     p_successor:decision.successor,p_confirmation:decision.expected,p_reason:decision.reason},token);
   }else if(action==='accept'){
    await rpc('essential_boss_handoff_accept',{p_company:account.companyId,
     p_handoff:decision.id,p_expected_version:decision.version,p_confirmation:decision.expected},token);
   }else if(action==='complete'){
    await rpc('essential_boss_handoff_complete',{p_company:account.companyId,
     p_handoff:decision.id,p_expected_version:decision.version,p_confirmation:decision.expected},token);
   }else{
    await rpc('essential_boss_handoff_cancel',{p_company:account.companyId,
     p_handoff:decision.id,p_expected_version:decision.version},token);
   }
   if(!current(token))return;
   setPending(null);setConfirmation('');
   if(action==='complete'){
    setHandoff(null);setMfa(false);setLoaded(false);
    // A completed server transaction cannot be undone by the UI; force a fresh login.
    const signedOut=await supabase.auth.signOut({scope:'local'});
    if(!current(token))return;
    if(signedOut.error)throw Error('Reconnexion manuelle requise');
    Alert.alert('Direction transférée','Reconnectez-vous pour actualiser vos autorisations.');
    return;
   }
   const status=validHandoffStatus(await rpc('essential_boss_handoff_status',
    {p_company:account.companyId},token),account);
   if(!current(token))return;
   setHandoff(status);
   setNotice(action==='request'?'Demande envoyée au successeur.':
    action==='accept'?'Acceptation confirmée. Le Boss doit finaliser.':'Demande annulée.');
  });
 }
 if(!identityMatches)return <View style={{padding:16}}>
  <Text accessibilityLiveRegion="polite">Changement de compte en cours…</Text>
 </View>;
 if(!allowed)return <View style={{padding:16}}><Text accessibilityRole="alert">
  Transmission réservée au Boss et aux administrateurs du forfait Essentiel.
 </Text></View>;
 return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:18,gap:12}}>
  <Text style={{fontSize:23,color:ink,fontWeight:'800'}}>Transmission de direction</Text>
  <Text style={{color:muted}}>Transfert volontaire uniquement : le Boss propose, l’administrateur accepte
   avec MFA, puis le Boss confirme. Le serveur vérifie les deux sessions.</Text>
  {loading?<ActivityIndicator accessibilityLabel="Chargement de la transmission"/>:null}
  {busy?<ActivityIndicator accessibilityLabel="Action MFA ou transfert en cours"/>:null}
  {error?<Text accessibilityRole="alert" style={{color:'#B42318'}}>{error}</Text>:null}
  {notice?<Text accessibilityLiveRegion="polite" style={{color:ink}}>{notice}</Text>:null}
  {!loading&&!busy?<Pressable accessibilityRole="button" accessibilityLabel="Actualiser le statut MFA"
   onPress={()=>{if(!actionLock.current){void load()}}}
   style={{minHeight:48,justifyContent:'center',padding:12,borderRadius:10,backgroundColor:'#E1E8DB'}}>
   {txt('Actualiser le statut')}
  </Pressable>:null}
  {loaded&&!mfa?panel(<>
   <Text style={{fontSize:17,color:ink,fontWeight:'700'}}>MFA obligatoire</Text>
   <Text style={{color:muted}}>Si aucun authentificateur vérifié n’existe, configure-le sur PUNCH Web.</Text>
   {field('Code MFA à 6 chiffres',code,setCode,true)}
   {button('Vérifier mon identité MFA',verifyMfa,code.length!==6)}
  </>):null}
  {loaded&&mfa?<>
   {panel(<>
    {handoff&&handoff.status!=='expired'?<>
     <Text style={{fontWeight:'700',color:ink}}>Demande : {handoff.status==='pending'?'En attente du successeur':'Acceptée, confirmation finale attendue'}</Text>
     {txt('Boss actuel : '+handoff.from_user)}
     {txt('Successeur : '+handoff.to_user)}
     {txt('Échéance : '+safeDate(handoff.expires_at))}
     {handoffActionAllowed('accept',handoff,account,admins,successor,reason)?
      button('Accepter la responsabilité',()=>choose('accept')):null}
     {handoffActionAllowed('complete',handoff,account,admins,successor,reason)?
      button('Confirmer le transfert définitif',()=>choose('complete')):null}
     {handoffActionAllowed('cancel',handoff,account,admins,successor,reason)?
      button('Annuler la demande',()=>choose('cancel')):null}
    </>:isBoss?<>
     {txt('Choisis un administrateur actif pour une succession volontaire.')}
     {admins.map(admin=><Pressable key={admin.user_id} accessibilityRole="radio"
      accessibilityState={{selected:successor===admin.user_id,disabled}}
      disabled={disabled||!!pending} onPress={()=>setSuccessor(admin.user_id)}
      style={{minHeight:48,padding:12,justifyContent:'center',borderWidth:1,borderRadius:9,
       borderColor:successor===admin.user_id?sage:edge}}>
      {txt((successor===admin.user_id?'◉ ':'○ ')+admin.user_id)}
     </Pressable>)}
     {admins.length===0?txt('Aucun administrateur actif admissible.'):null}
     {field('Motif du transfert (8 caractères minimum)',reason,setReason)}
     {button('Préparer le transfert',()=>choose('request'),
      !handoffActionAllowed('request',handoff,account,admins,successor,reason))}
    </>:txt('Aucune transmission en attente pour ce compte.')}
   </>)}
   {pending?panel(<>
    <Text style={{fontSize:17,fontWeight:'700',color:ink}}>
     {pending.action==='request'?'Confirmer la demande':pending.action==='accept'?'Accepter la responsabilité':
      pending.action==='complete'?'Transfert définitif du rôle Boss':'Confirmer l’annulation'}
    </Text>
    <Text style={{color:muted}}>La demande doit toujours correspondre au compte, au rôle et à la version en cours.</Text>
    {pending.action!=='cancel'?<>
     <Text selectable style={{color:ink,fontWeight:'600'}}>{pending.expected}</Text>
     {field('Recopier les identifiants exactement',confirmation,setConfirmation)}
    </>:null}
    {button('Confirmer maintenant',execute,pending.action!=='cancel'&&confirmation!==pending.expected)}
    {button('Retour sans modifier',()=>{setPending(null);setConfirmation('')})}
   </>):null}
  </>:null}
  <Text style={{color:muted,fontSize:12}}>Aucune récupération de mot de passe ne transfère la direction.
   Si le Boss est indisponible, contacte le support. Aucun transfert forcé.</Text>
 </ScrollView>;
}
