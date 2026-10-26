import React,{useEffect,useRef,useState} from 'react';
import {Alert,AppState,Linking,Pressable,Text,TextInput,View} from 'react-native';
import * as Crypto from 'expo-crypto';
import * as Network from 'expo-network';
import {supabase} from '../lib/supabase';
import {missionAddress,missionArgs,missionDate,missionProgress} from '../../web/live/missions.js';
import {navigationUrl,chooseNavigationPreference} from '../../web/live/navigation-choices.js';
import {Platform} from 'react-native';
type Row=Record<string,any>;
async function rpc(name:string,args:Row):Promise<Row>{
 const result=await supabase.rpc(name,args);
 if(result.error)throw result.error;
 return result.data as Row;
}
const title=(value:string)=><Text style={{fontSize:17,fontWeight:'700',color:'#2F4935'}}>{value}</Text>;
const label=(value:string)=><Text style={{fontSize:12,color:'#59735A'}}>{value}</Text>;
const button=(value:string,onPress:()=>void,disabled=false)=>(
 <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
  style={{padding:12,borderRadius:10,minHeight:44,justifyContent:'center',backgroundColor:disabled?'#B7C8B5':'#557B55',marginVertical:3}}>
  <Text style={{color:'white',textAlign:'center',fontWeight:'600'}}>{value}</Text>
 </Pressable>
);
const input=(caption:string,value:string,change:(v:string)=>void)=>(
 <View style={{gap:3}}>{label(caption)}<TextInput accessibilityLabel={caption} value={value}
 onChangeText={change} style={{borderWidth:1,borderColor:'#CADAC8',borderRadius:9,padding:10,minHeight:43,color:'#243B2A'}}/></View>
);
export function MissionManagerPanel({companyId,roster}:{companyId:string;roster:Row[]}){
 const [enabled,setEnabled]=useState(false),[missions,setMissions]=useState<Row[]>([]),
  [sites,setSites]=useState<Row[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [day,setDay]=useState(missionDate()),[worker,setWorker]=useState(''),[site,setSite]=useState(''),
  [order,setOrder]=useState('1'),[missionTitle,setMissionTitle]=useState(''),
  [instructions,setInstructions]=useState(''),[editing,setEditing]=useState<Row|null>(null);
 const counter=useRef(0);
 async function load(date=day){
  const current=++counter.current;
  try{
   const conf=await rpc('essential_missions_configuration',{p_company:companyId,p_enabled:null});
   if(current!==counter.current)return;
   setEnabled(!!conf.enabled);
   if(conf.enabled){
    const [places,listing]=await Promise.all([
     rpc('list_essential_client_sites',{p_company:companyId,p_search:'',p_after:null,p_limit:100}),
     rpc('list_essential_missions',{p_company:companyId,p_day:date,p_worker:null,p_include_drafts:true})]);
    if(current!==counter.current)return;
    setSites((places.items||[]).filter((x:Row)=>x.active));
    setMissions(listing.items||[]);
    if(listing.truncated)setMessage('La journée contient plus de 200 missions. Réduisez ou segmentez le lot.');
   }else{setSites([]);setMissions([])}
  }catch(e:any){if(current===counter.current)setMessage(e.message||'Missions indisponibles')}
 }
 useEffect(()=>{setEnabled(false);setMissions([]);setSites([]);setEditing(null);
  setWorker('');setSite('');setMessage('');
  void load();return()=>{counter.current++};
 },[companyId]);
 async function work(callback:()=>Promise<void>){
  if(busy)return;setBusy(true);setMessage('');
  try{await callback()}catch(e:any){setMessage(e.message||'Action impossible')}
  finally{setBusy(false)}
 }
 const toggle=()=>{
  Alert.alert(enabled?'Désactiver les missions ?':'Activer les missions ?',
   'Le module reste indépendant des quarts, pointages et factures.',
   [{text:'Annuler',style:'cancel'},{text:'Confirmer',onPress:()=>void work(async()=>{
    const response=await rpc('essential_missions_configuration',{p_company:companyId,p_enabled:!enabled});
    setEnabled(!!response.enabled);await load();
   })}]);
 };
 const save=(publish:boolean)=>{
  if(publish)Alert.alert('Publier la mission ?', 'La mission sera visible à l’employé. Aucun pointage ne sera déclenché.',
   [{text:'Annuler',style:'cancel'}, {text:'Publier',onPress:()=>void work(async()=>{
    await rpc('save_essential_mission',missionArgs(companyId,
     {day,worker,site,order,title:missionTitle,instructions},editing,true));
    setEditing(null);setMissionTitle('');setInstructions('');setOrder(String(Number(order)+1));
    await load(day);setMessage('Mission publiée.');
   })}]);
  else void work(async()=>{
    await rpc('save_essential_mission',missionArgs(companyId,
     {day,worker,site,order,title:missionTitle,instructions},editing,false));
    setEditing(null);setMissionTitle('');setInstructions('');setOrder(String(Number(order)+1));
    await load(day);setMessage('Brouillon enregistré.');
  });
 };
 const options=(values:Row[],chosen:string,pick:(id:string)=>void,key:(v:Row)=>string,name:(v:Row)=>string)=>(
  <View style={{gap:5}}>
   {values.map(v=><Pressable key={key(v)} onPress={()=>pick(key(v))}
    style={{padding:9,backgroundColor:chosen===key(v)?'#DCE9D6':'#F7FAF5',borderRadius:8}}>
    <Text style={{fontSize:12,color:'#2F4935'}}>{name(v)}</Text>
   </Pressable>)}
  </View>
 );
 return <View style={{padding:14,backgroundColor:'white',borderWidth:1,borderColor:'#DCE8D6',borderRadius:12,gap:9}}>
  {title('Missions et tournées — manuel')}
  {label('Chaque mission reste séparée du pointage, des heures, des trajets et de la paie.')}
  {button(enabled?'Désactiver le module':'Activer le module',toggle,busy)}
  {!!message?<Text accessibilityLiveRegion="polite" style={{color:'#B04C37'}}>{message}</Text>:null}
  {enabled?<>
   {input('Date AAAA-MM-JJ',day,setDay)}
   {button('Afficher les missions de cette journée',()=>void work(()=>load(day)),busy)}
   {label('Employé')}
   {options(roster.filter(w=>w.status==='active'),worker,setWorker,w=>w.id,w=>w.name||w.first_name)}
   {label('Lieu client')}
   {options(sites,site,setSite,x=>x.id,x=>x.client_name+' · '+x.name+' · '+x.city)}
   {sites.length>=100?label('Plus de 100 adresses : affinez votre carnet avant de sélectionner un lieu non chargé.'):null}
   {input('Numéro d’ordre',order,setOrder)}
   {input('Titre de la mission',missionTitle,setMissionTitle)}
   {input('Instructions de mission (privées)',instructions,setInstructions)}
   {button('Enregistrer le brouillon',()=>save(false),busy)}
   {button('Approuver et publier',()=>save(true),busy)}
   {missions.map(m=><View key={m.id} style={{borderBottomWidth:1,borderColor:'#EFF2ED',paddingVertical:6,gap:3}}>
    {title(String(m.sort_order)+'. '+m.title)}
    {label([m.first_name,m.last_name].filter(Boolean).join(' ')+' · '+m.client_name+' · '+m.site_name+' · '+m.status)}
    {m.status==='draft'?button('Modifier le brouillon',()=>{
     setEditing(m);setWorker(m.worker_id);setSite(m.site_id);setDay(m.mission_day);
     setOrder(String(m.sort_order));setMissionTitle(m.title);setInstructions('');
     setMessage('Les anciennes instructions privées ne sont pas réaffichées.');
    },busy):null}
   </View>)}
  </>:null}
 </View>;
}
export function PersonalMissionCard({companyId,workerId,navProvider}:{companyId:string;workerId:string|null;navProvider:string|null}){
 const [items,setItems]=useState<Row[]>([]),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),
  [message,setMessage]=useState(''),[truncated,setTruncated]=useState(false);
 const requests=useRef<Map<string,string>>(new Map()),current=useRef(0);
 async function refresh(){
  if(!workerId||!companyId)return;
  const gen=++current.current;
  try{
   const res=await rpc('list_essential_missions',{p_company:companyId,p_day:missionDate(),p_worker:workerId,p_include_drafts:false});
   if(gen!==current.current)return;
   setEnabled(!!res.enabled);setItems(res.items||[]);setTruncated(!!res.truncated);setMessage('');
  }catch(e:any){if(gen===current.current){setEnabled(false);setItems([]);setMessage('Missions non disponibles en ligne.');}}
 }
 useEffect(()=>{current.current++;setItems([]);setEnabled(false);setMessage('');requests.current.clear();
  if(workerId)void refresh();
  const subscription=AppState.addEventListener('change',state=>{if(state==='active'&&workerId)void refresh()});
  return()=>{current.current++;subscription.remove()};
 },[companyId,workerId]);
 const progress=missionProgress(items),next=progress.next;
 const complete=()=>{
  if(!next||busy)return;
  Alert.alert('Terminer la mission ?', 'Cette action ne termine pas votre journée ni votre pointage.',
   [{text:'Annuler',style:'cancel'},{text:'Terminer',onPress:()=>{void (async()=>{
     setBusy(true);setMessage('');
     const id=next.id,request=requests.current.get(id)||Crypto.randomUUID();
     requests.current.set(id,request);
     try{
      const network=await Network.getNetworkStateAsync();
      if(network.isConnected===false||network.isInternetReachable===false)throw Error('Connexion requise.');
      await rpc('complete_essential_mission',{p_company:companyId,p_id:id,p_version:next.version,p_request:request});
      requests.current.delete(id);await refresh();setMessage('Mission terminée. Le pointage reste inchangé.');
     }catch{setMessage('Fin non confirmée : reconnectez-vous et réessayez (même demande).');}
     finally{setBusy(false)}
    })()}}]);
 };
 if(!workerId||!enabled)return null;
 if(!progress.total&& !message)return null;
 const address=missionAddress(next);
 const provider=chooseNavigationPreference(navProvider,Platform.OS)||'google';
 return <View style={{padding:12,borderWidth:1,borderColor:'#DCE8D6',borderRadius:12,gap:7,backgroundColor:'#F7FAF5'}}>
  {title(progress.allDone?'Toutes les missions sont terminées':'Prochaine mission · '+(progress.done+1)+' de '+progress.total)}
  {next?<>{title(next.title+' · '+next.client_name)}{label(next.site_name+' · '+address)}
   {!!address?button('Itinéraire',()=>{void Linking.openURL(navigationUrl(provider,address,Platform.OS))}):null}
   {button('Terminer',complete,busy)}
   {label('Terminer une mission ne pointe jamais la sortie.')}
  </>:null}
  {!!message?<Text accessibilityLiveRegion="polite" style={{color:'#B04C37'}}>{message}</Text>:null}
  {truncated?label('Plus de 200 missions : demandez une tournée segmentée au responsable.'):null}
 </View>;
}
