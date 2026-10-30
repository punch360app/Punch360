import React,{useEffect,useRef,useState} from 'react';
import {Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {createMessagesScope} from './messageScope.js';

type Chat={id:string;title:string;kind:string};
type SelectedChat=Chat&{companyId:string;userId:string;role:string};
type Entry={id:string;sender_id:string;body:string;created_at:string};
type Candidate={user_id:string;role:string;name:string};
const c={bg:'#08131C',panel:'#122632',line:'#36505A',text:'#FFFFFF',muted:'#9BB0BD',gold:'#FFBF40',green:'#21DEAE'};
const failure='Impossible de charger ou modifier la messagerie. Réessaie.';

export function MessagesScreen({account}:{account:WorkspaceAccount}){
 const [chats,setChats]=useState<Chat[]>([]);
 const [active,setActive]=useState<SelectedChat|null>(null);
 const [messages,setMessages]=useState<Entry[]>([]);
 const [draft,setDraft]=useState('');
 const [groupName,setGroupName]=useState('');
 const [newGroup,setNewGroup]=useState(false);
 const [busy,setBusy]=useState(false);
 const [listLoading,setListLoading]=useState(true);
 const [threadLoading,setThreadLoading]=useState(false);
 const [error,setError]=useState('');
 const [candidates,setCandidates]=useState<Candidate[]>([]);
 const [picked,setPicked]=useState<string[]>([]);
 const scope=useRef(createMessagesScope(account.companyId,account.userId,account.role));
 const alive=useRef(false);
 const actionLocked=useRef(false);
 const threadRequest=useRef(0);
 const manager=account.role==='boss'||account.role==='admin';
 const lead=account.role==='lead';
 const identityMatches=scope.current.matches(account.companyId,account.userId,account.role);
 // Render gating runs before effects: no A content is painted when props switch to B.
 const selected=identityMatches&&active?.companyId===account.companyId&&active?.userId===account.userId&&active?.role===account.role?active:null;
 const threadReady=Boolean(selected&&scope.current.current().threadId===selected.id);
 const current=(token:ReturnType<typeof scope.current.current>)=>alive.current&&scope.current.allowsWorkspace(token);
 const currentThread=(token:ReturnType<typeof scope.current.current>)=>alive.current&&scope.current.allowsThread(token);

 async function load(token:ReturnType<typeof scope.current.current>){
  const {data,error:loadError}=await supabase.from('conversations')
   .select('id,title,kind').eq('company_id',account.companyId);
  if(!current(token))return;
  if(loadError||!Array.isArray(data)){setChats([]);setError(failure);return;}
  setChats(data);
 }
 async function loadCandidates(token:ReturnType<typeof scope.current.current>){
  const {data:people,error:peopleError}=await supabase.from('company_members')
   .select('user_id,role').eq('company_id',account.companyId).eq('status','active');
  if(!current(token))return;
  if(peopleError||!Array.isArray(people)){setCandidates([]);setError(failure);return;}
  const filtered=people.filter(p=>p.user_id!==account.userId);
  if(!filtered.length){setCandidates([]);return;}
  const {data:profiles,error:profileError}=await supabase.from('employee_profiles')
   .select('user_id,full_name').in('user_id',filtered.map(p=>p.user_id));
  if(!current(token))return;
  if(profileError){setCandidates([]);setError(failure);return;}
  setCandidates(filtered.map(p=>({...p,name:profiles?.find(pr=>pr.user_id===p.user_id)?.full_name||p.user_id.slice(0,8)})));
 }
 async function loadThread(id:string,token:ReturnType<typeof scope.current.current>){
  const sequence=++threadRequest.current;
  const {data,error:loadError}=await supabase.from('conversation_messages')
   .select('id,sender_id,body,created_at').eq('conversation_id',id)
   .eq('company_id',account.companyId).order('created_at').limit(100);
  if(!currentThread(token)||sequence!==threadRequest.current)return;
  if(loadError||!Array.isArray(data)){setMessages([]);setError(failure);return;}
  setMessages(data);
 }

 useEffect(()=>{
  const token=scope.current.enter(account.companyId,account.userId,account.role);
  alive.current=true;actionLocked.current=false;threadRequest.current++;
  setChats([]);setActive(null);setMessages([]);setDraft('');
  setGroupName('');setNewGroup(false);setCandidates([]);setPicked([]);
  setBusy(false);setError('');setListLoading(true);setThreadLoading(false);
  void load(token).catch(()=>{if(current(token)){setChats([]);setError(failure)}})
   .finally(()=>{if(current(token))setListLoading(false)});
  if(manager)void loadCandidates(token).catch(()=>{if(current(token)){setCandidates([]);setError(failure)}});
  return()=>{alive.current=false;scope.current.invalidate();threadRequest.current++};
 },[account.companyId,account.userId,account.role]);

 useEffect(()=>{
  if(!selected||!alive.current||!identityMatches)return;
  const token=scope.current.selectThread(selected.id);
  threadRequest.current++;
  setMessages([]);setDraft('');setError('');setThreadLoading(true);
  void loadThread(selected.id,token).catch(()=>{if(currentThread(token)){setMessages([]);setError(failure)}})
   .finally(()=>{if(currentThread(token))setThreadLoading(false)});
  const timer=setInterval(()=>{void loadThread(selected.id,token).catch(()=>{
   if(currentThread(token))setError(failure);
  })},8000);
  return()=>{clearInterval(timer);scope.current.selectThread('');threadRequest.current++};
 },[selected?.id,account.companyId,account.userId,account.role]);

 async function runAction(action:(token:ReturnType<typeof scope.current.current>)=>Promise<void>){
  const token=scope.current.current();
  if(!current(token)||!identityMatches||actionLocked.current)return;
  actionLocked.current=true;setBusy(true);setError('');
  try{await action(token)}catch{if(current(token))setError(failure)}
  finally{if(current(token)){actionLocked.current=false;setBusy(false)}}
 }
 function selectChat(chat:Chat){
  // Invalidate previous thread immediately, including when opened by a successful action.
  scope.current.selectThread(chat.id);threadRequest.current++;
  setMessages([]);setDraft('');setThreadLoading(true);
  setActive({...chat,companyId:account.companyId,userId:account.userId,role:account.role});
 }
 function openChat(chat:Chat){
  if(actionLocked.current)return;
  selectChat(chat);
 }
 function closeChat(){
  if(actionLocked.current)return;
  scope.current.selectThread('');threadRequest.current++;
  setActive(null);setNewGroup(false);setMessages([]);setDraft('');setError('');
 }
 async function send(token:ReturnType<typeof scope.current.current>){
  if(!selected||!currentThread(token)||!draft.trim())return;
  const body=draft.trim(),id=selected.id;
  const {error:sendError}=await supabase.from('conversation_messages')
   .insert({company_id:account.companyId,conversation_id:id,sender_id:account.userId,body});
  if(!currentThread(token))return;
  if(sendError){setError('Message non envoyé. Réessaie.');return;}
  setDraft('');await loadThread(id,token);
 }
 async function createGroup(token:ReturnType<typeof scope.current.current>){
  const name=groupName.trim();
  if(!manager||!name||!current(token))return;
  const {data,error:createError}=await supabase.rpc('create_company_group',{
   p_company:account.companyId,p_title:name,p_member_ids:[...picked]
  });
  if(!current(token))return;
  if(createError||typeof data!=='string'){setError(failure);return;}
  setNewGroup(false);setGroupName('');setPicked([]);
  await load(token);
  if(current(token))selectChat({id:data,title:name,kind:'group'});
 }
 async function createLeadChat(token:ReturnType<typeof scope.current.current>){
  if(!lead||!current(token))return;
  const {data,error:teamError}=await supabase.from('teams').select('id,name')
   .eq('lead_user_id',account.userId).eq('company_id',account.companyId).limit(1).maybeSingle();
  if(!current(token))return;
  if(teamError||!data){setError('Aucune équipe attribuée ou accessible.');return;}
  const result=await supabase.rpc('create_private_team_chat',{p_team:data.id});
  if(!current(token))return;
  if(result.error||typeof result.data!=='string'){setError(failure);return;}
  await load(token);
  if(current(token))selectChat({id:result.data,title:data.name,kind:'team_private'});
 }
 const row=(children:React.ReactNode)=><View style={{padding:13,marginVertical:5,backgroundColor:c.panel,borderWidth:1,borderColor:c.line,borderRadius:13}}>{children}</View>;
 if(!identityMatches)return <View style={{padding:16,flex:1}}><Text accessibilityLiveRegion="polite" style={{color:c.text}}>Changement d’entreprise en cours…</Text></View>;
 return <View style={{flex:1,paddingHorizontal:15,backgroundColor:'transparent'}}>
  <View style={{minHeight:65,flexDirection:'row',alignItems:'center',gap:12}}>
   {selected||newGroup?<Pressable accessibilityRole="button" accessibilityLabel="Retour aux conversations" disabled={busy}
    onPress={closeChat} style={{minHeight:48,minWidth:48,justifyContent:'center',opacity:busy?0.5:1}}>
    <Ionicons name="arrow-back" color={c.gold} size={24}/></Pressable>:<Ionicons name="chatbubbles-outline" color={c.gold} size={24}/>}
   <Text style={{flex:1,color:c.text,fontSize:23,fontWeight:'800'}} numberOfLines={2}>{selected?.title|| (newGroup?'Créer un groupe':'Messages')}</Text>
   {!selected&&!newGroup&&(manager||lead)?<Pressable accessibilityRole="button"
    accessibilityLabel={manager?'Créer un groupe':'Ouvrir le groupe privé de mon équipe'} disabled={busy}
    onPress={()=>manager?setNewGroup(true):void runAction(createLeadChat)}
    style={{minHeight:48,minWidth:48,justifyContent:'center',alignItems:'center',opacity:busy?0.5:1}}>
    <Ionicons name="add-circle" color={c.gold} size={30}/></Pressable>:null}
  </View>
  {error?<Text accessibilityRole="alert" style={{color:'#FFC4B9',paddingVertical:8}}>{error}</Text>:null}
  {busy?<Text accessibilityLiveRegion="polite" style={{color:c.muted}}>Traitement en cours…</Text>:null}
  {selected?<><Text style={{color:c.green,fontSize:12,marginBottom:8}}>{selected.kind==='team_private'?'🔒 Groupe privé de l’équipe':'Visible seulement par les membres du groupe'}</Text>
   <ScrollView style={{flex:1}} contentContainerStyle={{gap:8}}>
    {!threadReady||threadLoading?<Text accessibilityLiveRegion="polite" style={{color:c.muted}}>Chargement des messages…</Text>:
     messages.map(m=><View key={m.id} style={{backgroundColor:m.sender_id===account.userId?'#1B5C4B':c.panel,padding:12,borderRadius:13,maxWidth:'88%',alignSelf:m.sender_id===account.userId?'flex-end':'flex-start'}}>
      <Text style={{color:c.text}}>{m.body}</Text>
      <Text style={{color:c.muted,fontSize:11,marginTop:4}}>{new Date(m.created_at).toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'})}</Text>
     </View>)}
   </ScrollView>
   <View style={{flexDirection:'row',gap:8,paddingVertical:8}}>
    <TextInput accessibilityLabel="Écrire un message" editable={!busy&&threadReady&&!threadLoading}
     style={{flex:1,color:c.text,backgroundColor:c.panel,borderWidth:1,borderColor:c.line,borderRadius:12,paddingHorizontal:12,minHeight:48}}
     placeholderTextColor={c.muted} placeholder="Ton message…" value={threadReady?draft:''} onChangeText={setDraft}/>
    <Pressable accessibilityRole="button" accessibilityLabel="Envoyer le message"
     disabled={busy||!threadReady||threadLoading||!draft.trim()} onPress={()=>void runAction(send)}
     style={{backgroundColor:c.gold,borderRadius:12,minHeight:48,minWidth:48,alignItems:'center',justifyContent:'center',opacity:busy||!threadReady||threadLoading||!draft.trim()?0.5:1}}>
     <Ionicons name="send" color={c.bg} size={22}/></Pressable>
   </View>
  </>:newGroup?<>
   {row(<><Text style={{color:c.muted}}>Nouveau groupe de chantier</Text>
    <TextInput accessibilityLabel="Nom du groupe" editable={!busy} style={{color:c.text,fontSize:17,paddingVertical:10,minHeight:48}}
     placeholderTextColor={c.muted} placeholder="Nom du groupe" value={groupName} onChangeText={setGroupName}/></>)}
   <Text style={{color:c.muted,marginVertical:8}}>Membres à inviter au groupe :</Text>
   <ScrollView style={{maxHeight:330}}>{candidates.map(m=><Pressable key={m.user_id} accessibilityRole="checkbox"
    accessibilityState={{checked:picked.includes(m.user_id),disabled:busy}} disabled={busy}
    onPress={()=>setPicked(list=>list.includes(m.user_id)?list.filter(x=>x!==m.user_id):[...list,m.user_id])}
    style={{flexDirection:'row',gap:9,alignItems:'center',padding:11,minHeight:48,backgroundColor:c.panel,marginVertical:3,borderRadius:9}}>
    <Ionicons name={picked.includes(m.user_id)?'checkbox':'square-outline'} color={c.gold} size={22}/>
    <Text style={{color:c.text,flex:1}}>{m.name} · {m.role}</Text></Pressable>)}</ScrollView>
   <Pressable accessibilityRole="button" disabled={busy||!groupName.trim()}
    onPress={()=>void runAction(createGroup)} style={{backgroundColor:c.gold,borderRadius:12,padding:14,minHeight:48,opacity:busy||!groupName.trim()?0.5:1}}>
    <Text style={{fontWeight:'800',textAlign:'center'}}>Créer le groupe</Text></Pressable>
   <Text style={{color:c.muted,fontSize:12,marginTop:12}}>Les membres choisis rejoignent immédiatement cette conversation.</Text>
  </>:<ScrollView style={{flex:1}}>
   {listLoading?<Text accessibilityLiveRegion="polite" style={{color:c.muted}}>Chargement des conversations…</Text>:
    chats.length===0?row(<Text style={{color:c.muted}}>Aucune conversation. Le boss, l’admin ou le chef d’équipe peut créer son groupe autorisé.</Text>):
    chats.map(chat=><Pressable key={chat.id} accessibilityRole="button" accessibilityLabel={'Ouvrir '+chat.title}
     disabled={busy} onPress={()=>openChat(chat)} style={{minHeight:48}}>{row(<View style={{flexDirection:'row',gap:12,alignItems:'center'}}>
     <Ionicons name={chat.kind==='team_private'?'lock-closed':'people'} color={chat.kind==='team_private'?c.green:c.gold} size={24}/>
     <Text style={{color:c.text,fontSize:16,flex:1}}>{chat.title}</Text><Ionicons name="chevron-forward" color={c.muted} size={19}/>
    </View>)}</Pressable>)}
  </ScrollView>}
 </View>;
}
