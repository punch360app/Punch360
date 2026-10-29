import React,{useEffect,useRef,useState} from 'react';
import {Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import * as Crypto from 'expo-crypto';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {createSupportScope} from './supportScope.js';

type Ticket={id:string;subject:string;status:string;version:number;updated_at:string};
type Detail=Ticket&{messages:{id:string;body:string;is_platform:boolean;created_at:string}[]};
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
export function SupportPanel({account}:{account:WorkspaceAccount}){
 const [tickets,setTickets]=useState<Ticket[]>([]),[detail,setDetail]=useState<Detail|null>(null);
 const [subject,setSubject]=useState(''),[body,setBody]=useState(''),[reply,setReply]=useState('');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [more,setMore]=useState(false);
 const alive=useRef(false),locked=useRef(false);
 const scope=useRef(createSupportScope(account.companyId));
 const request=useRef(new Map<string,{payload:string;id:string}>());
 const active=(token:number,company:string)=>alive.current&&scope.current.allows(company,token);
 async function rpc(name:string,args:Record<string,unknown>){
  const r=await supabase.rpc(name,args);if(r.error)throw r.error;return r.data;
 }
 async function load(append=false,token=scope.current.current().epoch,company=account.companyId){
  const last=append?tickets.at(-1):null;
  const rows=await rpc('support_list_tickets',{
   p_company:company,p_before:last?.updated_at||null,p_before_id:last?.id||null
  });
  if(!active(token,company))return;
  if(!Array.isArray(rows))throw Error('INVALID_SUPPORT_RESPONSE');
  setTickets(old=>append?[...old,...rows.filter((r:Ticket)=>!old.some(x=>x.id===r.id))]:rows);
  setMore(rows.length===50);
 }
 async function show(id:string,token:number,company:string){
  const d=await rpc('support_ticket_detail',{p_ticket:id});
  if(!active(token,company))return;
  if(!d||!Array.isArray(d.messages))throw Error('INVALID_SUPPORT_RESPONSE');
  setDetail(d);
  const pending=request.current.get(id);
  setReply(pending?JSON.parse(pending.payload).p_body:'');
 }
 useEffect(()=>{
  const company=account.companyId,token=scope.current.enter(company);
  alive.current=true;locked.current=false;
  setTickets([]);setDetail(null);setSubject('');setBody('');setReply('');
  setError('');setMore(false);setBusy(false);setLoading(true);
  load(false,token,company).catch(err=>{
   if(active(token,company))setError(safeError(err));
  }).finally(()=>{if(active(token,company))setLoading(false)});
  return()=>{alive.current=false;scope.current.invalidate()};
 },[account.companyId]);
 async function run(action:(token:number,company:string)=>Promise<void>){
  const company=account.companyId,token=scope.current.current().epoch;
  if(!active(token,company)||locked.current)return;
  locked.current=true;setBusy(true);setError('');
  try{await action(token,company)}
  catch(err){
   if(active(token,company)){
    if(accessDenied(err)){setTickets([]);setDetail(null);setReply('');setMore(false)}
    setError(safeError(err));
   }
  }finally{
   if(active(token,company)){locked.current=false;setBusy(false)}
  }
 }
 function requestId(payload:Record<string,unknown>){
  const key=String(payload.p_ticket||payload.p_company),signature=JSON.stringify(payload);
  const pending=request.current.get(key);
  if(pending&&pending.payload!==signature)
   throw Error('Résultat incertain : réessayez le message original avant de le modifier.');
  if(!pending)request.current.set(key,{payload:signature,id:Crypto.randomUUID()});
  return request.current.get(key)!.id;
 }
 async function create(token:number,company:string){
  const payload={p_company:company,p_subject:subject.trim(),p_body:body.trim()};
  if(payload.p_subject.length<3||payload.p_body.length<3)
   throw Error('Objet et message requis (3 caractères minimum).');
  const id=await rpc('support_create_ticket',{...payload,p_request:requestId(payload)});
  if(!active(token,company))return;
  request.current.delete(company);setSubject('');setBody('');
  await show(id,token,company);
  if(active(token,company))await load(false,token,company);
 }
 async function send(token:number,company:string){
  if(!detail)return;
  const payload={p_ticket:detail.id,p_body:reply.trim(),p_expected_version:detail.version};
  if(payload.p_body.length<3)throw Error('Réponse de trois caractères minimum requise.');
  await rpc('support_reply',{...payload,p_request:requestId(payload)});
  if(!active(token,company))return;
  request.current.delete(detail.id);setReply('');
  await show(detail.id,token,company);
  if(active(token,company))await load(false,token,company);
 }
 async function status(value:string,token:number,company:string){
  if(!detail||!['open','resolved','closed'].includes(value))return;
  const selected=detail;
  await rpc('support_set_status',{p_ticket:selected.id,p_status:value,p_expected_version:selected.version});
  if(!active(token,company))return;
  await show(selected.id,token,company);
  if(active(token,company))await load(false,token,company);
 }
 const text=(value:string)=><Text style={{color:'#2F4935',lineHeight:22}}>{value}</Text>;
 const button=(title:string,action:(token:number,company:string)=>Promise<void>)=>
  <Pressable accessibilityRole="button" disabled={busy||loading}
   onPress={()=>run(action)}
   style={{padding:12,minHeight:48,borderRadius:8,backgroundColor:'#edf2e9',opacity:busy||loading?.5:1}}>
   {text(title)}
  </Pressable>;
 const field=(label:string,value:string,change:(s:string)=>void,maxLength:number,multiline=false)=>
  <View style={{gap:5}}>{text(label)}
   <TextInput accessibilityLabel={label} editable={!busy&&!loading} value={value}
    onChangeText={change} maxLength={maxLength} multiline={multiline}
    style={{color:'#2F4935',borderWidth:1,borderColor:'#E1E8DB',padding:12,
     minHeight:multiline?100:48,borderRadius:8,textAlignVertical:'top'}}/>
  </View>;
 // Render gating is essential: effects run after paint, so never show company A
 // even for a single frame when props have already switched to company B.
 if(scope.current.current().company!==account.companyId)
  return <View style={{padding:16,backgroundColor:'#FAFBF8'}}>
   <Text accessibilityLiveRegion="polite" style={{color:'#2F4935'}}>Changement d’entreprise en cours…</Text>
  </View>;
 return <ScrollView keyboardShouldPersistTaps="handled"
  contentContainerStyle={{padding:16,gap:16,paddingBottom:40}}>
  <Text style={{fontSize:24,color:'#2F4935'}}>Support PUNCH</Text>
  {text('Ne transmettez pas de mot de passe, NIP ou renseignement médical.')}
  {error?<Text accessibilityRole="alert" style={{color:'#a13e32'}}>{error}</Text>:null}
  {busy||loading?<Text accessibilityLiveRegion="polite" style={{color:'#4e7051'}}>
   Vérification en cours…</Text>:null}
  <View style={card}>
   {text('Nouvelle demande')}
   {field('Objet',subject,setSubject,160)}
   {field('Message',body,setBody,5000,true)}
   {button('Envoyer la demande',create)}
  </View>
  <View style={card}>
   {button('Actualiser',async(token,company)=>{
    await load(false,token,company);
    if(active(token,company)&&detail)await show(detail.id,token,company);
   })}
   {tickets.map(t=><View key={t.id} style={{gap:5}}>
    {text(t.subject+' · '+(labels[t.status]||t.status))}
    {button('Ouvrir la demande',(token,company)=>show(t.id,token,company))}
   </View>)}
   {!tickets.length&&!loading?text('Aucune demande.'):null}
   {more?button('Charger les demandes précédentes',(token,company)=>load(true,token,company)):null}
  </View>
  {detail?<View style={card}>
   {text(detail.subject+' · '+(labels[detail.status]||detail.status))}
   {text('200 messages les plus récents.')}
   {detail.messages.map(m=><View key={m.id} style={{paddingVertical:10,gap:4}}>
    {text(m.is_platform?'Équipe PUNCH':'Entreprise')}
    {text(new Date(m.created_at).toLocaleString('fr-CA'))}
    {text(m.body)}
   </View>)}
   {detail.status!=='closed'?<>
    {field('Votre réponse',reply,setReply,5000,true)}
    {button('Envoyer la réponse',send)}
   </>:null}
   {['open','resolved','closed'].filter(x=>x!==detail.status).map(x=>
    <View key={x}>
     {button(x==='open'?'Réouvrir':labels[x],(token,company)=>status(x,token,company))}
    </View>)}
  </View>:null}
 </ScrollView>;
}
