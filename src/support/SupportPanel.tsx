import React,{useEffect,useRef,useState} from 'react';
import {Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import * as Crypto from 'expo-crypto';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {createSupportAccountScope,isKnownSupportTicket,safeSupportTicketDetail,safeSupportTicketPage} from './supportScope.js';

type Row=Record<string,any>;
type Ticket={id:string;company_id:string;created_by:string;subject:string;status:string;version:number;updated_at:string};
type Detail=Ticket&{messages:{id:string;body:string;is_platform:boolean;created_at:string}[]};
type Token=ReturnType<ReturnType<typeof createSupportAccountScope>['current']>;
const labels:Record<string,string>={open:'Ouverte',waiting:'En attente de votre réponse',resolved:'Résolue',closed:'Fermée'};
const card={padding:16,gap:10,borderWidth:1,borderColor:'#E1E8DB',borderRadius:12,backgroundColor:'white'} as const;
const localErrors=[
 'Objet et message requis (3 caractères minimum).',
 'Réponse de trois caractères minimum requise.',
 'Résultat incertain : réessayez le message original avant de le modifier.'
];
function safeError(error:unknown){
 const e=error as {code?:string;status?:number|string;message?:string}|null;
 if(e?.code==='42501'||[401,403,'401','403'].includes(e?.status??''))
  return 'Accès au support expiré ou refusé. Reconnectez-vous.';
 if(e?.message&&localErrors.includes(e.message))return e.message;
 return 'Impossible de charger ou modifier les demandes. Réessayez.';
}
function accessDenied(error:unknown){
 const e=error as {code?:string;status?:number|string}|null;
 return e?.code==='42501'||[401,403,'401','403'].includes(e?.status??'');
}
const safeDate=(raw:unknown)=>{
 const t=Date.parse(String(raw||''));return Number.isFinite(t)?new Date(t).toLocaleString('fr-CA'):'Date à vérifier';
};
export function SupportPanel({account}:{account:WorkspaceAccount}){
 const [tickets,setTickets]=useState<Ticket[]>([]),[detail,setDetail]=useState<Detail|null>(null);
 const [subject,setSubject]=useState(''),[body,setBody]=useState(''),[reply,setReply]=useState('');
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[loaded,setLoaded]=useState(false),[more,setMore]=useState(false);
 const scope=useRef(createSupportAccountScope(account)),latest=useRef(account);
 latest.current=account;
 const alive=useRef(false),loadId=useRef(0),detailId=useRef(0),actionLock=useRef(false);
 const request=useRef(new Map<string,{payload:string;id:string}>());
 const rowsRef=useRef<Ticket[]>([]);
 const identityMatches=scope.current.matches(account);
 const current=(token:Token)=>alive.current&&scope.current.allows(token)&&scope.current.matches(latest.current);
 const disabled=!identityMatches||busy||loading||!loaded;
 const clearPrivate=()=>{
  rowsRef.current=[];setTickets([]);setDetail(null);setReply('');setMore(false);
 };
 async function rpc(name:string,args:Row,token:Token){
  if(!current(token))throw Error('Compte modifié');
  const r=await supabase.rpc(name,args);
  if(!current(token))throw Error('Compte modifié');
  if(r.error)throw r.error;
  return r.data;
 }
 async function load(append=false,token:Token=scope.current.current()){
  if(!current(token))return false;
  const operation=++loadId.current;
  const before=append?rowsRef.current.at(-1):null;
  if(append&&!before)return false;
  try{
   const rows=await rpc('support_list_tickets',{
    p_company:account.companyId,p_before:before?.updated_at||null,p_before_id:before?.id||null
   },token);
   if(!current(token)||operation!==loadId.current)return false;
   const page=safeSupportTicketPage(rows,account) as Ticket[];
   if(append&&page.some(r=>rowsRef.current.some(x=>x.id===r.id)))
    throw Error('Pagination incohérente');
   if(rowsRef.current.length+page.length>500)throw Error('Pagination trop longue');
   const combined=append?[...rowsRef.current,...page]:page;
   rowsRef.current=combined;setTickets(combined);setMore(page.length===50&&combined.length<500);
   if(!append)setLoaded(true);
   setError('');
   return true;
  }catch(err){
   if(current(token)&&operation===loadId.current){
    if(accessDenied(err)||!append){clearPrivate();setLoaded(false)}
    else setMore(false);
    setError(safeError(err));
   }
   return false;
  }
 }
 async function show(id:string,token:Token,allowNew=false){
  if(!current(token)||(!allowNew&&!isKnownSupportTicket(id,rowsRef.current)))return false;
  const operation=++detailId.current;
  const result=await rpc('support_ticket_detail',{p_ticket:id},token);
  if(!current(token)||operation!==detailId.current)return false;
  const safe=safeSupportTicketDetail(result,account) as Detail;
  if(!allowNew&&!isKnownSupportTicket(safe.id,rowsRef.current))throw Error('Demande inconnue');
  if(safe.id!==id)throw Error('Demande incohérente');
  setDetail(safe);
  const pending=request.current.get(id);
  setReply(pending?String(JSON.parse(pending.payload).p_body||''):'');
  return true;
 }
 useEffect(()=>{
  const token=scope.current.enter(account);
  alive.current=true;loadId.current++;detailId.current++;actionLock.current=false;
  // The ledger is for retries within one signed-in identity; never reuse it under another.
  request.current.clear();clearPrivate();setSubject('');setBody('');
  setError('');setNotice('');setBusy(false);setLoading(true);setLoaded(false);
  void load(false,token).finally(()=>{if(current(token))setLoading(false)});
  return()=>{alive.current=false;scope.current.invalidate();loadId.current++;detailId.current++};
 },[account.companyId,account.userId,account.role,account.edition]);
 async function run(action:(token:Token)=>Promise<void>){
  const token=scope.current.current();
  if(!identityMatches||disabled||!current(token)||actionLock.current)return;
  actionLock.current=true;setBusy(true);setError('');setNotice('');
  try{await action(token)}
  catch(err){
   if(current(token)){
    if(accessDenied(err)){clearPrivate();setLoaded(false)}
    setError(safeError(err));
   }
  }finally{if(current(token)){actionLock.current=false;setBusy(false)}}
 }
 function requestId(payload:Row){
  const key=String(payload.p_ticket||payload.p_company),signature=JSON.stringify(payload);
  const pending=request.current.get(key);
  if(pending&&pending.payload!==signature)
   throw Error('Résultat incertain : réessayez le message original avant de le modifier.');
  if(!pending)request.current.set(key,{payload:signature,id:Crypto.randomUUID()});
  return request.current.get(key)!.id;
 }
 async function create(token:Token){
  const payload={p_company:account.companyId,p_subject:subject.trim(),p_body:body.trim()};
  if(payload.p_subject.length<3||payload.p_body.length<3)
   throw Error('Objet et message requis (3 caractères minimum).');
  const id=await rpc('support_create_ticket',{...payload,p_request:requestId(payload)},token);
  if(!current(token))return;
  const opened=await show(String(id),token,true);
  if(!current(token)||!opened)return;
  const refreshed=await load(false,token);
  if(!current(token)||!refreshed)return;
  request.current.delete(account.companyId);
  setSubject('');setBody('');setNotice('Demande enregistrée.');
 }
 async function send(token:Token){
  const selected=detail;
  if(!selected||selected.status==='closed'||selected.company_id!==account.companyId)return;
  const payload={p_ticket:selected.id,p_body:reply.trim(),p_expected_version:selected.version};
  if(payload.p_body.length<3)throw Error('Réponse de trois caractères minimum requise.');
  await rpc('support_reply',{...payload,p_request:requestId(payload)},token);
  if(!current(token))return;
  const opened=await show(selected.id,token,true);
  if(!current(token)||!opened)return;
  const refreshed=await load(false,token);
  if(!current(token)||!refreshed)return;
  request.current.delete(selected.id);setReply('');setNotice('Réponse enregistrée.');
 }
 async function status(value:string,token:Token){
  const selected=detail;
  if(!selected||selected.company_id!==account.companyId||
   !['open','resolved','closed'].includes(value)||selected.status===value)return;
  await rpc('support_set_status',{p_ticket:selected.id,p_status:value,p_expected_version:selected.version},token);
  if(!current(token))return;
  await show(selected.id,token,true);
  if(current(token))await load(false,token);
 }
 const text=(value:string)=><Text style={{color:'#2F4935',lineHeight:22}}>{value}</Text>;
 const button=(title:string,action:(token:Token)=>Promise<void>)=>
  <Pressable accessibilityRole="button" accessibilityLabel={title}
   accessibilityState={{disabled}} disabled={disabled} onPress={()=>void run(action)}
   style={{padding:12,minHeight:48,borderRadius:8,backgroundColor:'#edf2e9',opacity:disabled?0.5:1}}>
   {text(title)}
  </Pressable>;
 const field=(label:string,value:string,change:(s:string)=>void,maxLength:number,multiline=false)=>
  <View style={{gap:5}}>{text(label)}
   <TextInput accessibilityLabel={label} editable={!disabled} value={value}
    onChangeText={change} maxLength={maxLength} multiline={multiline}
    style={{color:'#2F4935',borderWidth:1,borderColor:'#E1E8DB',padding:12,
     minHeight:multiline?100:48,borderRadius:8,textAlignVertical:'top'}}/>
  </View>;
 if(!identityMatches)return <View style={{padding:16,backgroundColor:'#FAFBF8'}}>
  <Text accessibilityLiveRegion="polite">Changement de compte en cours…</Text>
 </View>;
 return <ScrollView keyboardShouldPersistTaps="handled"
  contentContainerStyle={{padding:16,gap:16,paddingBottom:40}}>
  <Text style={{fontSize:24,color:'#2F4935'}}>Support PUNCH</Text>
  {text('Ne transmettez pas de mot de passe, NIP ou renseignement médical.')}
  {error?<Text accessibilityRole="alert" style={{color:'#a13e32'}}>{error}</Text>:null}
  {notice?<Text accessibilityLiveRegion="polite">{notice}</Text>:null}
  {busy||loading?<Text accessibilityLiveRegion="polite" style={{color:'#4e7051'}}>Vérification en cours…</Text>:null}
  {!busy&&!loading?<Pressable accessibilityRole="button" accessibilityLabel="Réessayer le chargement"
   onPress={()=>{if(!actionLock.current){setError('');setLoading(true);void load(false).finally(()=>{if(scope.current.matches(latest.current))setLoading(false)})}}}
   style={{minHeight:48,padding:12,borderRadius:8,backgroundColor:'#edf2e9'}}>
   {text(loaded?'Actualiser':'Réessayer')}
  </Pressable>:null}
  {loaded?<View style={card}>
   {text('Nouvelle demande')}
   {field('Objet',subject,setSubject,160)}
   {field('Message',body,setBody,5000,true)}
   {button('Envoyer la demande',create)}
  </View>:null}
  {loaded?<View style={card}>
   {text('Mes demandes de support')}
   {tickets.map(t=><View key={t.id} style={{gap:5}}>
    {text(t.subject+' · '+(labels[t.status]||'Statut inconnu'))}
    {button('Ouvrir la demande',token=>show(t.id,token).then(()=>{}))}
   </View>)}
   {!tickets.length?text('Aucune demande.'):null}
   {more?button('Charger les demandes précédentes',token=>load(true,token).then(()=>{})):null}
  </View>:null}
  {loaded&&detail?<View style={card}>
   {text(detail.subject+' · '+(labels[detail.status]||'Statut inconnu'))}
   {text('200 messages les plus récents.')}
   {detail.messages.map(m=><View key={m.id} style={{paddingVertical:10,gap:4}}>
    {text(m.is_platform?'Équipe PUNCH':'Entreprise')}
    {text(safeDate(m.created_at))}
    {text(m.body)}
   </View>)}
   {detail.status!=='closed'?<>
    {field('Votre réponse',reply,setReply,5000,true)}
    {button('Envoyer la réponse',send)}
   </>:null}
   {['open','resolved','closed'].filter(x=>x!==detail.status).map(x=>
    <View key={x}>{button(x==='open'?'Réouvrir':labels[x],token=>status(x,token))}</View>)}
  </View>:null}
 </ScrollView>;
}
