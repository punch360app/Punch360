import React,{useEffect,useState} from 'react';
import {Alert,Pressable,ScrollView,Text,TextInput,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {supabase} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';

type Chat={id:string;title:string;kind:string};
type Entry={id:string;sender_id:string;body:string;created_at:string};
const c={bg:'#08131C',panel:'#122632',line:'#36505A',text:'#FFFFFF',muted:'#9BB0BD',gold:'#FFBF40',green:'#21DEAE'};
export function MessagesScreen({account}:{account:WorkspaceAccount}){
 const [chats,setChats]=useState<Chat[]>([]);
 const [active,setActive]=useState<Chat|null>(null);
 const [messages,setMessages]=useState<Entry[]>([]);
 const [draft,setDraft]=useState('');
 const [groupName,setGroupName]=useState('');
 const [newGroup,setNewGroup]=useState(false);
 const [busy,setBusy]=useState(false);
 const manager=account.role==='boss'||account.role==='admin';
 const lead=account.role==='lead';
 async function load(){
  const {data,error}=await supabase.from('conversations').select('id,title,kind').eq('company_id',account.companyId);
  if(error)Alert.alert('Messagerie',error.message);else setChats(data||[]);
 }
 async function loadThread(id:string){
  const {data,error}=await supabase.from('conversation_messages')
   .select('id,sender_id,body,created_at').eq('conversation_id',id).order('created_at').limit(100);
  if(!error)setMessages(data||[]);
 }
 useEffect(()=>{load()},[account.companyId]);
 useEffect(()=>{if(!active)return;loadThread(active.id);const t=setInterval(()=>loadThread(active.id),8000);return()=>clearInterval(t)},[active?.id]);
 async function send(){
  if(!active||!draft.trim()||busy)return;
  setBusy(true);
  const {error}=await supabase.from('conversation_messages')
   .insert({company_id:account.companyId,conversation_id:active.id,sender_id:account.userId,body:draft.trim()});
  if(error)Alert.alert('Message non envoyé',error.message);else{setDraft('');await loadThread(active.id)}
  setBusy(false);
 }
 async function createGroup(){
  if(!groupName.trim())return;
  if(!manager)return Alert.alert('Seuls le boss et l’admin créent les groupes généraux.');
  const {data,error}=await supabase.rpc('create_company_group',{p_company:account.companyId,p_title:groupName,p_member_ids:[]});
  if(error)Alert.alert('Groupe non créé',error.message);
  else{setNewGroup(false);setGroupName('');await load();setActive({id:data as string,title:groupName,kind:'group'})}
 }
 async function createLeadChat(){
  const {data,error}=await supabase.from('teams').select('id,name').eq('lead_user_id',account.userId).eq('company_id',account.companyId).limit(1).maybeSingle();
  if(error||!data)return Alert.alert('Aucune équipe attribuée','L’admin doit créer ton équipe.');
  const result=await supabase.rpc('create_private_team_chat',{p_team:data.id});
  if(result.error)return Alert.alert('Chat privé',result.error.message);
  await load();setActive({id:result.data as string,title:data.name,kind:'team_private'});
 }
 const row=(children:React.ReactNode)=> <View style={{padding:13,marginVertical:5,backgroundColor:c.panel,borderWidth:1,borderColor:c.line,borderRadius:13}}>{children}</View>;
 return <View style={{flex:1,paddingHorizontal:15,backgroundColor:'transparent'}}>
  <View style={{height:65,flexDirection:'row',alignItems:'center',gap:12}}>
   {active||newGroup?<Pressable onPress={()=>{setActive(null);setNewGroup(false)}}><Ionicons name="arrow-back" color={c.gold} size={24}/></Pressable>:<Ionicons name="chatbubbles-outline" color={c.gold} size={24}/>}
   <Text style={{flex:1,color:c.text,fontSize:23,fontWeight:'800'}}>{active?.title|| (newGroup?'Créer un groupe':'Messages')}</Text>
   {!active&&!newGroup&&(manager||lead)?<Pressable onPress={()=>manager?setNewGroup(true):createLeadChat()}><Ionicons name="add-circle" color={c.gold} size={30}/></Pressable>:null}
  </View>
  {active?<><Text style={{color:c.green,fontSize:11,marginBottom:8}}>{active.kind==='team_private'?'🔒 Groupe privé de l’équipe':'Visible seulement par les membres du groupe'}</Text>
   <ScrollView style={{flex:1}} contentContainerStyle={{gap:8}}>{messages.map(m=><View key={m.id} style={{backgroundColor:m.sender_id===account.userId?'#1B5C4B':c.panel,padding:12,borderRadius:13,maxWidth:'88%',alignSelf:m.sender_id===account.userId?'flex-end':'flex-start'}}><Text style={{color:c.text}}>{m.body}</Text><Text style={{color:c.muted,fontSize:10,marginTop:4}}>{new Date(m.created_at).toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'})}</Text></View>)}</ScrollView>
   <View style={{flexDirection:'row',gap:8,paddingVertical:8}}><TextInput style={{flex:1,color:c.text,backgroundColor:c.panel,borderWidth:1,borderColor:c.line,borderRadius:12,paddingHorizontal:12,minHeight:48}} placeholderTextColor={c.muted} placeholder="Ton message…" value={draft} onChangeText={setDraft}/><Pressable onPress={send} style={{backgroundColor:c.gold,borderRadius:12,padding:12}}><Ionicons name="send" color={c.bg} size={22}/></Pressable></View>
  </>:newGroup?<>
   {row(<><Text style={{color:c.muted}}>Nouveau groupe de chantier</Text><TextInput style={{color:c.text,fontSize:17,paddingVertical:10}} placeholderTextColor={c.muted} placeholder="Nom du groupe" value={groupName} onChangeText={setGroupName}/></>)}
   <Pressable onPress={createGroup} style={{backgroundColor:c.gold,borderRadius:12,padding:14}}><Text style={{fontWeight:'800',textAlign:'center'}}>Créer le groupe</Text></Pressable>
   <Text style={{color:c.muted,fontSize:11,marginTop:12}}>Le responsable pourra ajouter les membres autorisés dans l’administration.</Text>
  </>:<ScrollView style={{flex:1}}>
   {chats.length===0?row(<Text style={{color:c.muted}}>Aucune conversation. Le boss, l’admin ou le chef d’équipe peut créer son groupe autorisé.</Text>):chats.map(chat=><Pressable key={chat.id} onPress={()=>setActive(chat)}>{row(<View style={{flexDirection:'row',gap:12,alignItems:'center'}}><Ionicons name={chat.kind==='team_private'?'lock-closed':'people'} color={chat.kind==='team_private'?c.green:c.gold} size={24}/><Text style={{color:c.text,fontSize:16,flex:1}}>{chat.title}</Text><Ionicons name="chevron-forward" color={c.muted} size={19}/></View>)}</Pressable>)}
  </ScrollView>}
 </View>;
}
