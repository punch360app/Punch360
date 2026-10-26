import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Alert,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';

type Admin={user_id:string;role:string;status?:string};
type Handoff={id:string;company_id:string;from_user:string;to_user:string;
 status:'pending'|'accepted'|'expired';version:number;expires_at:string;
 can_accept:boolean;can_complete:boolean};
type Command='request'|'accept'|'complete'|'cancel';
const ink='#2F4935',muted='#617766',edge='#E1E8DB',sage='#779574';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function BossHandoffPanel({account}:{account:WorkspaceAccount}){
 const [mfa,setMfa]=useState(false),[factor,setFactor]=useState<string|null>(null),[code,setCode]=useState('');
 const [admins,setAdmins]=useState<Admin[]>([]),[successor,setSuccessor]=useState('');
 const [reason,setReason]=useState(''),[handoff,setHandoff]=useState<Handoff|null>(null);
 const [pending,setPending]=useState<Command|null>(null),[confirmation,setConfirmation]=useState('');
 const [notice,setNotice]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const isBoss=account.role==='boss',allowed=account.edition==='essential'&&['boss','admin'].includes(account.role);
 const rpc=async(name:string,args:Record<string,unknown>)=>{
  const {data,error:e}=await supabase.rpc(name as any,args as any);
  if(e)throw e;return data as any;
 };
 const load=useCallback(async()=>{
  if(!allowed)return;
  setBusy(true);setError('');
  try{
   const aal=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
   if(aal.error)throw aal.error;
   const isAal2=aal.data?.currentLevel==='aal2';
   setMfa(isAal2);setPending(null);setConfirmation('');
   if(!isAal2){setHandoff(null);return;}
   const [current,people]=await Promise.all([
    rpc('essential_boss_handoff_status',{p_company:account.companyId}),
    isBoss?supabase.from('company_members').select('user_id,role,status')
      .eq('company_id',account.companyId).eq('status','active').eq('role','admin'):Promise.resolve({data:[],error:null})
   ]);
   if(people.error)throw people.error;
   setAdmins((people.data||[]) as Admin[]);
   setHandoff(current as Handoff|null);
  }catch(e:any){setError(e.message||'Impossible de charger le transfert.');setHandoff(null);}
  finally{setBusy(false);}
 },[account.companyId,allowed,isBoss]);
 useEffect(()=>{setMfa(false);setHandoff(null);setAdmins([]);setSuccessor('');
  setReason('');setPending(null);setConfirmation('');load();
 },[load,account.userId]);
 async function verifyMfa(){
  if(busy)return;setBusy(true);setError('');setNotice('');
  try{
   if(!/^\d{6}$/.test(code))throw Error('Saisissez les 6 chiffres de votre authentificateur.');
   let factorId=factor;
   if(!factorId){
    const r=await supabase.auth.mfa.listFactors();
    if(r.error)throw r.error;
    factorId=r.data?.totp?.find(f=>f.status==='verified')?.id||null;
   }
   if(!factorId)throw Error('Configurez d’abord le MFA TOTP dans PUNCH Web, puis revenez ici.');
   const v=await supabase.auth.mfa.challengeAndVerify({factorId,code});
   if(v.error)throw v.error;
   setFactor(null);setCode('');setNotice('Votre identité MFA est confirmée.');
  }catch(e:any){setError(e.message||'Échec de la vérification MFA.');}
  finally{setBusy(false);}
  // The refreshed Supabase session has AAL2; fetch the protected handoff separately.
  const level=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if(level.data?.currentLevel==='aal2')await load();
 }
 function expectedFor(action:Command){
  if(action==='request')return account.companyId+':'+successor;
  if(!handoff)return '';
  return account.companyId+':'+(action==='accept'?handoff.from_user:handoff.to_user);
 }
 function choose(action:Command){
  setError('');setNotice('');
  if(!mfa){setError('Confirmez d’abord votre identité MFA.');return;}
  if(action==='request'){
   if(!isBoss||handoff&&handoff.status!=='expired')return setError('Le transfert est déjà en cours.');
   if(!admins.some(a=>a.user_id===successor&&a.role==='admin')||!uuid.test(successor))return setError('Sélectionnez un administrateur actif.');
   if(reason.trim().length<8)return setError('Expliquez le transfert (8 caractères minimum).');
  }else if(!handoff)return setError('Aucun transfert actif.');
  if(action==='accept'&&!handoff?.can_accept)return setError('Vous n’êtes pas le successeur désigné.');
  if(action==='complete'&&(!isBoss||!handoff?.can_complete))return setError('La confirmation finale appartient au Boss.');
  setPending(action);setConfirmation('');
 }
 async function execute(){
  if(!pending||busy)return;
  const expected=expectedFor(pending);
  if(pending!=='cancel'&&confirmation!==expected){
   setError('Recopiez exactement les identifiants pour autoriser cette action.');return;
  }
  const action=pending;setBusy(true);setError('');setNotice('');
  try{
   let result:any;
   if(action==='request'){
    result=await rpc('essential_boss_handoff_request',{
     p_company:account.companyId,p_successor:successor,p_confirmation:confirmation,p_reason:reason.trim()
    });
   }else if(action==='accept'){
    result=await rpc('essential_boss_handoff_accept',{
     p_company:account.companyId,p_handoff:handoff!.id,
     p_expected_version:handoff!.version,p_confirmation:confirmation
    });
   }else if(action==='complete'){
    result=await rpc('essential_boss_handoff_complete',{
     p_company:account.companyId,p_handoff:handoff!.id,
     p_expected_version:handoff!.version,p_confirmation:confirmation
    });
   }else{
    result=await rpc('essential_boss_handoff_cancel',{
     p_company:account.companyId,p_handoff:handoff!.id,p_expected_version:handoff!.version
    });
   }
   setPending(null);setConfirmation('');
   if(action==='complete'){
    setHandoff(null);
    // Force the next login to reload the newly granted roles instead of reusing
    // a stale local WorkspaceAccount from before the server transaction.
    const out=await supabase.auth.signOut({scope:'local'});
    if(out.error)throw out.error;
    Alert.alert('Direction transférée','Reconnectez-vous pour actualiser vos autorisations.');
   }else{
    const updated=await rpc('essential_boss_handoff_status',{p_company:account.companyId});
    setHandoff(updated as Handoff|null);
    setNotice(action==='request'?'Demande envoyée au successeur.':
      action==='accept'?'Acceptation confirmée. Le Boss doit finaliser.':'Demande annulée.');
   }
  }catch(e:any){setError(e.message||'Cette opération a été refusée. Actualisez le statut.');}
  finally{setBusy(false);}
 }
 const panel=(children:React.ReactNode)=><View style={{backgroundColor:'#fff',borderWidth:1,borderColor:edge,
  borderRadius:14,padding:16,gap:10,marginBottom:12}}>{children}</View>;
 const button=(title:string,action:()=>void,disabled=false)=><Pressable accessibilityRole="button"
  disabled={disabled||busy} onPress={action} style={{padding:13,borderRadius:10,
   backgroundColor:disabled||busy?'#CBD4C8':sage,alignItems:'center'}}>
  <Text style={{color:'#fff',fontWeight:'700'}}>{title}</Text></Pressable>;
 const field=(label:string,value:string,onChangeText:(value:string)=>void,secure=false)=><View style={{gap:6}}>
  <Text style={{color:ink,fontWeight:'600'}}>{label}</Text>
  <TextInput style={{borderRadius:9,borderColor:edge,borderWidth:1,padding:12,color:ink,minHeight:46}}
   autoCapitalize="none" autoCorrect={false} value={value} secureTextEntry={secure}
   onChangeText={onChangeText}/>
 </View>;
 return <ScrollView contentContainerStyle={{padding:18,gap:12}}>
  <Text style={{fontSize:23,color:ink,fontWeight:'800'}}>Transmission de direction</Text>
  <Text style={{color:muted}}>Seul le Boss peut proposer le transfert vers un administrateur actif de cette entreprise. Les deux doivent valider leur identité MFA.</Text>
  {error?<Text accessibilityRole="alert" style={{color:'#B42318'}}>{error}</Text>:null}
  {notice?<Text style={{color:ink}}>{notice}</Text>:null}
  {busy?<ActivityIndicator color={sage}/>:null}
  {!allowed?panel(<Text style={{color:ink}}>Disponible pour Essentiel, aux rôles Boss et Admin.</Text>):
  !mfa?panel(<>
   <Text style={{fontSize:17,color:ink,fontWeight:'700'}}>Vérification MFA obligatoire</Text>
   <Text style={{color:muted}}>Si aucun authentificateur n’est encore lié, configurez-le depuis la console Web sécurisée, puis entrez votre code ici.</Text>
   {field('Code à 6 chiffres',code,setCode)}
   {button('Vérifier mon identité',verifyMfa,code.length!==6)}
   {button('Actualiser le niveau MFA',()=>void load())}
  </>):<>
   {panel(<>
    {button('Actualiser la demande',()=>void load())}
    {handoff&&handoff.status!=='expired'?<>
     <Text style={{color:ink,fontWeight:'700'}}>Demande : {handoff.status==='pending'?'En attente du successeur':'Acceptée, confirmation finale attendue'}</Text>
     <Text style={{color:muted}}>Boss actuel : {handoff.from_user}</Text>
     <Text style={{color:muted}}>Successeur : {handoff.to_user}</Text>
     <Text style={{color:muted}}>Échéance : {new Date(handoff.expires_at).toLocaleString('fr-CA')}</Text>
     {handoff.can_accept?button('Accepter la responsabilité',()=>choose('accept')):null}
     {handoff.can_complete&&isBoss?button('Confirmer et transférer le rôle Boss',()=>choose('complete')):null}
     {button('Annuler la demande',()=>choose('cancel'))}
    </>:isBoss?<>
     <Text style={{fontSize:17,color:ink,fontWeight:'700'}}>Demander un transfert volontaire</Text>
     <Text style={{color:muted}}>Choisissez un administrateur actif. Les autres entreprises ne seront pas modifiées.</Text>
     {admins.map(a=><Pressable key={a.user_id} accessibilityRole="radio"
      accessibilityState={{selected:successor===a.user_id}}
      onPress={()=>setSuccessor(a.user_id)} style={{padding:12,borderWidth:1,borderRadius:9,
       borderColor:successor===a.user_id?sage:edge,backgroundColor:successor===a.user_id?'#F0F5ED':'#fff'}}>
      <Text style={{color:ink}}>{successor===a.user_id?'◉':'◯'} {a.user_id}</Text>
     </Pressable>)}
     {admins.length===0?<Text style={{color:muted}}>Aucun administrateur actif admissible.</Text>:null}
     {field('Motif du transfert',reason,setReason)}
     {button('Préparer le transfert',()=>choose('request'),!successor||reason.trim().length<8)}
    </>:<Text style={{color:muted}}>Aucun transfert vous concernant en attente.</Text>}
   </>)}
   {pending?panel(<>
    <Text style={{fontSize:17,fontWeight:'800',color:ink}}>Confirmer : {pending==='request'?'demande de transfert':pending==='accept'?'acceptation':pending==='complete'?'transfert définitif':'annulation'}</Text>
    <Text style={{color:muted}}>{pending==='complete'?'Vous deviendrez administrateur; votre successeur sera le Boss.':'Cette opération est enregistrée dans le journal des accès.'}</Text>
    {pending!=='cancel'?<>
     <Text selectable style={{color:ink,fontWeight:'600'}}>{expectedFor(pending)}</Text>
     {field('Recopier exactement ces identifiants',confirmation,setConfirmation)}
    </>:null}
    {button('Confirmer maintenant',()=>void execute(),pending!=='cancel'&&confirmation!==expectedFor(pending))}
    {button('Retour sans modifier',()=>{setPending(null);setConfirmation('');})}
   </>):null}
  </>}
  <Text style={{color:muted,fontSize:12}}>La récupération du mot de passe ne transfère jamais la direction. Si le Boss est indisponible, contactez le support : aucun transfert forcé n’est autorisé.</Text>
 </ScrollView>;
}
