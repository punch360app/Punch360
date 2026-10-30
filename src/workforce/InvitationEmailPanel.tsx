import React,{useEffect,useRef,useState} from 'react';
import {Pressable,Switch,Text,TextInput,View} from 'react-native';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {createInviteEmailScope,parseInvitationHours} from './inviteEmailScope.js';

type Worker={id:string;email?:string|null;first_name?:string;last_name?:string};
type Settings={email_auto:boolean;expires_hours:number;version:number};
type History={id:string;created_at:string;email_status:string;activated:boolean;revoked:boolean;expired:boolean;attempts:number};
type Token=ReturnType<ReturnType<typeof createInviteEmailScope>['current']>;
const blank:Settings={email_auto:false,expires_hours:72,version:0};
const errorText='Impossible de vérifier les invitations de ce compte. Réessaie.';
const labels:Record<string,string>={ready:'À envoyer',retry:'Reprise planifiée',sending:'Envoi en cours',sent:'Acceptée par le fournisseur',delivered:'Livrée',opened:'Ouverture signalée',failed:'Échec',unknown:'Résultat inconnu',cancelled:'Annulée',not_requested:'Courriel non demandé'};

export function InvitationEmailPanel({account,workers}:{account:WorkspaceAccount;workers:Worker[]}){
 const [settings,setSettings]=useState<Settings>(blank);
 const [hours,setHours]=useState('72'),[auto,setAuto]=useState(false);
 const [history,setHistory]=useState<History[]>([]),[selectedWorker,setSelectedWorker]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false);
 const scope=useRef(createInviteEmailScope(account.companyId,account.userId,account.role));
 const alive=useRef(false),sequence=useRef(0),statusSequence=useRef(0),actionLock=useRef(false);
 const latest=useRef({companyId:account.companyId,userId:account.userId,role:account.role});
 latest.current={companyId:account.companyId,userId:account.userId,role:account.role};
 const identityMatches=scope.current.matches(account.companyId,account.userId,account.role);
 const manager=account.role==='boss'||account.role==='admin';
 const current=(token:Token)=>{
  const id=latest.current;
  return alive.current&&scope.current.allows(token)&&scope.current.matches(id.companyId,id.userId,id.role);
 };
 const disabled=busy||loading||!loaded;

 async function load(token:Token=scope.current.current()){
  if(!current(token)||!manager)return;
  const request=++sequence.current;
  setLoading(true);setLoaded(false);
  try{
   const r=await supabase.from('invitation_delivery_settings')
    .select('email_auto,expires_hours,version').eq('company_id',account.companyId).limit(2);
   if(!current(token)||request!==sequence.current)return;
   if(r.error||!Array.isArray(r.data)||r.data.length>1)throw Error('settings');
   const value=r.data[0]??blank;
   if(typeof value.email_auto!=='boolean'||!Number.isInteger(value.version)||value.version<0||
      !Number.isInteger(value.expires_hours)||value.expires_hours<1||value.expires_hours>720)throw Error('invalid');
   setSettings(value);setHours(String(value.expires_hours));setAuto(value.email_auto);
   setError('');setLoaded(true);
  }catch{
   if(current(token)&&request===sequence.current){
    setSettings(blank);setHours('72');setAuto(false);
    setHistory([]);setSelectedWorker('');setLoaded(false);setError(errorText);
   }
  }finally{if(current(token)&&request===sequence.current)setLoading(false)}
 }
 useEffect(()=>{
  const token=scope.current.enter(account.companyId,account.userId,account.role);
  alive.current=true;sequence.current++;statusSequence.current++;actionLock.current=false;
  setSettings(blank);setHours('72');setAuto(false);setHistory([]);setSelectedWorker('');
  setError('');setNotice('');setBusy(false);setLoading(true);setLoaded(false);
  if(manager)void load(token);
  else{setLoading(false);setError('Accès aux paramètres réservé aux responsables autorisés.')}
  return()=>{alive.current=false;scope.current.invalidate();sequence.current++;statusSequence.current++};
 },[account.companyId,account.userId,account.role]);

 async function run(task:(token:Token)=>Promise<void>){
  const token=scope.current.current();
  if(!identityMatches||!manager||!current(token)||!loaded||actionLock.current)return;
  actionLock.current=true;setBusy(true);setError('');setNotice('');
  try{await task(token)}catch{
   if(current(token))setError('Opération refusée ou paramètres modifiés. Actualise puis réessaie.');
  }finally{if(current(token)){actionLock.current=false;setBusy(false)}}
 }
 async function save(token:Token){
  if(!current(token))return;
  const n=parseInvitationHours(hours);
  if(n===null){setError('La validité doit être un nombre entier entre 1 et 720 heures.');return;}
  const r=await supabase.rpc('set_invitation_delivery_settings',{
   p_company:account.companyId,p_email_auto:auto,p_hours:n,p_expected_version:settings.version
  });
  if(!current(token))return;
  if(r.error)throw Error('save');
  // The RPC returns void; re-read the server version rather than guessing its value.
  await load(token);
  if(current(token)&&scope.current.allows(token))setNotice('Réglages enregistrés; aucun courriel confirmé envoyé.');
 }
 async function status(token:Token,id:string){
  if(!current(token)||!workers.some(w=>w.id===id&&w.email))return;
  const request=++statusSequence.current;
  setHistory([]);setSelectedWorker('');
  const r=await supabase.rpc('worker_email_delivery_status',{p_worker:id});
  if(!current(token)||request!==statusSequence.current)return;
  if(r.error||!Array.isArray(r.data))throw Error('status');
  setSelectedWorker(id);
  setHistory(r.data.slice(0,100));
 }
 if(!identityMatches)return <View style={{padding:16,borderRadius:12}}>
  <Text accessibilityLiveRegion="polite">Changement de compte en cours…</Text>
 </View>;
 return <View style={{padding:16,gap:12,borderWidth:1,borderColor:'#E1E8DB',borderRadius:12}}>
  <Text style={{fontSize:20,fontWeight:'600',color:'#2F4935'}}>Invitations par courriel</Text>
  <Text>Les paramètres règlent les prochaines invitations. Un fournisseur et un domaine expéditeur doivent encore être configurés et testés.</Text>
  {loading?<Text accessibilityLiveRegion="polite">Chargement des réglages…</Text>:null}
  {busy?<Text accessibilityLiveRegion="polite">Vérification ou enregistrement en cours…</Text>:null}
  {error?<Text accessibilityRole="alert" style={{color:'#A1392D'}}>{error}</Text>:null}
  {notice?<Text accessibilityLiveRegion="polite">{notice}</Text>:null}
  {manager&&!loading&&!busy?<Pressable accessibilityRole="button" accessibilityLabel="Réessayer le chargement des réglages"
   onPress={()=>{setError('');void load()}} style={{minHeight:48,padding:12,backgroundColor:'#E1E8DB',borderRadius:9,justifyContent:'center'}}>
   <Text>{loaded?'Actualiser les réglages':'Réessayer'}</Text>
  </Pressable>:null}
  {manager&&loaded?<View style={{gap:10}}>
   <Text>Envoi automatique des invitations par courriel</Text>
   <Switch value={auto} onValueChange={setAuto} disabled={disabled} accessibilityLabel="Invitations automatiques par courriel"/>
   <Text>Validité des nouvelles invitations (1–720 heures)</Text>
   <TextInput accessibilityLabel="Validité des invitations en heures" editable={!disabled} value={hours} onChangeText={setHours}
    keyboardType="number-pad" style={{minHeight:48,padding:12,borderWidth:1,borderColor:'#E1E8DB',borderRadius:8}}/>
   <Pressable accessibilityRole="button" accessibilityLabel="Enregistrer les réglages" disabled={disabled}
    onPress={()=>void run(save)} style={{minHeight:48,padding:12,justifyContent:'center',borderRadius:9,backgroundColor:'#E1E8DB',opacity:disabled?0.5:1}}>
    <Text>Enregistrer les réglages</Text>
   </Pressable>
   {workers.filter(w=>Boolean(w.email)).map(w=><Pressable key={w.id} accessibilityRole="button" disabled={disabled}
    onPress={()=>void run(token=>status(token,w.id))}
    style={{minHeight:48,padding:12,justifyContent:'center',borderRadius:9,backgroundColor:selectedWorker===w.id?'#DCE9D6':'#F1F4EC',opacity:disabled?0.5:1}}>
    <Text>Suivi : {w.first_name} {w.last_name}</Text>
   </Pressable>)}
   {selectedWorker?<Text>Historique des invitations (100 dernières au maximum)</Text>:null}
   {history.map(i=><Text key={i.id}>
    {new Date(i.created_at).toLocaleDateString('fr-CA')} · {i.activated?'Activée':i.revoked?'Annulée':i.expired?'Expirée':labels[i.email_status]||'Statut indisponible'} · {i.attempts} tentative(s)
   </Text>)}
  </View>:null}
 </View>;
}
