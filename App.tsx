import {ManagementWorkspace} from './src/workforce/ManagementWorkspace';
import {EssentialWorkspace} from './src/workforce/EssentialWorkspace';
import * as Network from 'expo-network';
import React,{useEffect,useMemo,useState} from 'react';
import {Alert,AppState,FlatList,Image,Keyboard,Linking,Platform,Pressable,SafeAreaView,ScrollView,StatusBar,StyleSheet,Text,TextInput,View,useWindowDimensions} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {LinearGradient} from 'expo-linear-gradient';
import * as Location from 'expo-location';
import MapView,{Marker} from 'react-native-maps';
import {Job,JobFilter,Point,DEMO_JOBS,distanceKm,visibleJobs} from './src/jobs/catalog';
import {listMyCompanyJobs,createJob} from './src/jobs/api';
import {AuthGate, WorkspaceAccount} from './src/auth/AuthGate';
import {GeofencePanel} from './src/workforce/GeofencePanel';
import {journalSummary} from './src/punch/journal';
import {MorePortal} from './src/hr/MorePortal';
import {MessagesScreen} from './src/messages/MessagesScreen';
import {supabase} from './src/lib/supabase';
import {loadPunchState,punchIn,punchOut,punchTransfer,archiveSegment,restoreSegment,loadArchives,hoursFor,PunchSession,PunchSegment} from './src/punch/api';

const C={bg:'#08131C',panel:'#0E202B',panel2:'#122934',stroke:'#30454E',text:'#FFFFFF',muted:'#A5B9C5',gold:'#FFBF40',mint:'#21E2B0',red:'#EF4B4B'};
type Page='home'|'jobs'|'detail'|'hours'|'orders'|'messages'|'more'|'alerts';
type Segment={id:string;jobId:string;start:number;end:number|null};
const T=({children,size=14,color=C.text,bold=false,style={},numberOfLines}:{children:React.ReactNode;size?:number;color?:string;bold?:boolean;style?:any;numberOfLines?:number})=><Text numberOfLines={numberOfLines} style={[{fontSize:size,color,fontWeight:bold?'800':'400'},style]}>{children}</Text>;
function Icon({name,color=C.gold,size=21}:{name:any;color?:string;size?:number}){return <Ionicons name={name} size={size} color={color}/>;}
function Card({children,style}:{children:React.ReactNode;style?:any}){return <View style={[styles.card,style]}>{children}</View>}
function Action({icon,label,onPress,primary=false}:{icon:any;label:string;onPress:()=>void;primary?:boolean}){return <Pressable onPress={onPress} style={[styles.action,primary&&{borderColor:C.mint}]}><Icon name={icon} size={16} color={primary?C.mint:C.gold}/><T size={12} bold>{label}</T></Pressable>}
function Logo({subtitle}:{subtitle?:string}){return <View style={{flexDirection:'row',alignItems:'center',gap:9}}><Icon name="construct" color={C.gold} size={27}/><T size={24} bold>PUNCH <T color={C.gold} size={17} bold>360°</T></T>{subtitle?<T size={10} color={C.muted}>{subtitle}</T>:null}</View>}
function JobIcon({job}:{job:Job}){return job.photo_url?<Image source={{uri:job.photo_url}} style={styles.photo}/>:<LinearGradient colors={['#43545B','#253844','#0B1A25']} style={styles.photo}><Icon name="business" size={34} color="#D6E3EB"/><T size={9} color={C.gold}>JOB {job.number}</T></LinearGradient>}
function waze(job:Job){if(job.latitude!==null&&job.longitude!==null)Linking.openURL('https://waze.com/ul?ll='+job.latitude+','+job.longitude+'&navigate=yes');else Linking.openURL('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(job.address));}
function mapLink(job:Job){const q=job.latitude!==null&&job.longitude!==null?job.latitude+','+job.longitude:job.address;Linking.openURL('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q));}
const clock=(sec:number)=>{const n=Math.max(0,Math.floor(sec));return [Math.floor(n/3600),Math.floor(n%3600/60),n%60].map(x=>String(x).padStart(2,'0')).join(':')};
const dateLabel=()=>new Intl.DateTimeFormat('fr-CA',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date());

function Workspace({account}:{account:WorkspaceAccount}){
 const {height}=useWindowDimensions();const compact=height<760;
 const [jobs,setJobs]=useState<Job[]>([]);
 const [message,setMessage]=useState('Bienvenue dans PUNCH 360°');
 const [demo,setDemo]=useState(false);
 const [page,setPage]=useState<Page>('home');
 const [selectedId,setSelectedId]=useState('');
 const [detailId,setDetailId]=useState('');
 const [pickerMode,setPickerMode]=useState<'browse'|'switch'>('browse');
 const [query,setQuery]=useState('');
 const [filter,setFilter]=useState<JobFilter>('all');
 const [pos,setPos]=useState<Point|null>(null);
 const [gpsBusy,setGpsBusy]=useState(false);
 const [punchActive,setPunchActive]=useState(false);
 const [startMs,setStartMs]=useState<number|null>(null);
 const [now,setNow]=useState(Date.now());
 const [segments,setSegments]=useState<Segment[]>([]);
 const [serverSegments,setServerSegments]=useState<PunchSegment[]>([]);
 const [sessions,setSessions]=useState<PunchSession[]>([]);
 const [working,setWorking]=useState(false);
 const [jobNumber,setJobNumber]=useState('');
 const [jobName,setJobName]=useState('');
 const [jobAddress,setJobAddress]=useState('');
 const [orderNote,setOrderNote]=useState('');
 const [orders,setOrders]=useState<{id:string;status:string;note:string|null;created_at:string;job_id:string}[]>([]);
 const [archived,setArchived]=useState<string[]>([]);
 const [showArchived,setShowArchived]=useState(false);
 async function refresh(){
  try{
   const net=await Network.getNetworkStateAsync();const offline=net.isConnected===false||net.isInternetReachable===false;
   const [result,punch,archives,orderResult]=await Promise.all([
    listMyCompanyJobs(account.companyId),loadPunchState(account.companyId),loadArchives(),
    offline?Promise.resolve({data:null,error:{message:'offline'}}):supabase.from('material_orders').select('id,job_id,status,note,created_at').eq('company_id',account.companyId).order('created_at',{ascending:false}).limit(50)
   ]);
   setJobs(result.jobs);setDemo(false);const local=await journalSummary(account.companyId);setMessage(local.pending?'HORS LIGNE · '+local.pending+' punch(s) conservé(s) sur ce téléphone':local.conflicts?local.conflicts+' conflit(s) transmis à l’administration':result.message||account.companyName);
   setSessions(punch.sessions);setServerSegments(punch.segments);
   setSegments(punch.segments.map(s=>({id:s.id,jobId:s.job_id,start:Date.parse(s.started_at),end:s.ended_at?Date.parse(s.ended_at):null})));
   setArchived(archives);
   const openSegment=punch.segments.find(s=>s.session_id===punch.active?.id&&s.ended_at===null);
   const mostRecent=openSegment?.job_id||punch.lastJobId;
   setSelectedId(old=>openSegment?.job_id || (old&&result.jobs.some(j=>j.id===old)?old:(mostRecent&&result.jobs.some(j=>j.id===mostRecent)?mostRecent:result.jobs[0]?.id||'')));
   setPunchActive(!!punch.active);setStartMs(punch.active?Date.parse(punch.active.started_at):null);
   if(!orderResult.error)setOrders(orderResult.data||[]);
  }catch(e:any){setMessage('Erreur de synchronisation : '+(e.message||String(e)));}
 }
 useEffect(()=>{refresh();const retry=setInterval(refresh,30000);const network=Network.addNetworkStateListener(state=>{if(state.isConnected&&state.isInternetReachable!==false)refresh()});const sub=AppState.addEventListener('change',v=>{if(v==='active')refresh()});return()=>{sub.remove();network.remove();clearInterval(retry)}},[account.companyId]);
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id)},[]);
 const current=jobs.find(j=>j.id===selectedId)||jobs[0];
 const detail=jobs.find(j=>j.id===detailId)||current;
 const upcoming=jobs.filter(j=>j.assigned_to_me&&j.id!==current?.id&&j.planned_start&&Date.parse(j.planned_start)>Date.now()).sort((a,b)=>String(a.planned_start).localeCompare(String(b.planned_start)))[0];
 const elapsed=startMs&&punchActive?(now-startMs)/1000:0;
 const today=new Date(now);
 const yearBegin=new Date(today.getFullYear(),0,1).getTime();
 const weekday=(today.getDay()+6)%7;
 const weekBegin=new Date(today.getFullYear(),today.getMonth(),today.getDate()-weekday).getTime();
 const weekDuration=hoursFor(serverSegments,now,weekBegin,now);
 const annualDuration=hoursFor(serverSegments,now,yearBegin,now);
 const formatHours=(duration:number)=>{
  const mins=Math.floor(duration/60000);
  return Math.floor(mins/60)+' h '+String(mins%60).padStart(2,'0');
 };
 const filtered=useMemo(()=>visibleJobs(jobs,query,filter,pos),[jobs,query,filter,pos]);
 const gpsNearest=useMemo(()=>pos?jobs.filter(j=>j.latitude!==null&&j.longitude!==null).sort((a,b)=>distanceKm(pos,{latitude:a.latitude!,longitude:a.longitude!})-distanceKm(pos,{latitude:b.latitude!,longitude:b.longitude!}))[0]:null,[pos,jobs]);
 async function locate(){
  setGpsBusy(true);
  try{const p=await Location.requestForegroundPermissionsAsync();if(p.status!=='granted'){Alert.alert('GPS désactivé','Autorise la localisation pendant l’utilisation pour afficher les jobs à proximité.');return;}
   const result=await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
   const point={latitude:result.coords.latitude,longitude:result.coords.longitude};
   setPos(point);
   if(!punchActive&&page==='home'){
    const nearby=jobs.filter(j=>j.latitude!==null&&j.longitude!==null)
     .map(j=>({job:j,km:distanceKm(point,{latitude:j.latitude!,longitude:j.longitude!})}))
     .sort((a,b)=>a.km-b.km)[0];
    if(nearby&&nearby.km<=0.5&&nearby.job.id!==selectedId){
     Alert.alert('Job détectée à proximité','#'+nearby.job.number+' — '+nearby.job.name+'\nConfirmer cette job pour ton prochain PUNCH IN ?',[
      {text:'Garder la job actuelle',style:'cancel'},
      {text:'Utiliser cette job',onPress:()=>setSelectedId(nearby.job.id)}
     ]);
    }
   }
  }catch(e){Alert.alert('Localisation indisponible','Tu peux choisir une job manuellement.')}finally{setGpsBusy(false)}
 }
 function openJobs(mode:'browse'|'switch'='browse'){Keyboard.dismiss();setPickerMode(mode);setQuery('');setFilter('all');setPage('jobs')}
 function openDetail(j:Job){setDetailId(j.id);setShowArchived(false);setPage('detail')}
 function switchTo(j:Job){
  if(j.id===selectedId){setPage('home');return;}
  const apply=async()=>{
   if(working)return;setWorking(true);
   try{
    if(punchActive)await punchTransfer(account.companyId,j.id);
    setSelectedId(j.id);setPage('home');await refresh();
   }catch(e:any){Alert.alert('Transfert impossible',e.message||String(e))}
   finally{setWorking(false);}
  };
  if(punchActive)Alert.alert('Transférer mon punch',
   'Le temps de #'+current?.number+' se termine au même instant où commence celui de #'+j.number+'. Le compteur de la journée continue.',
   [{text:'Annuler',style:'cancel'},{text:'Confirmer',onPress:apply}]);
  else apply();
 }
 function togglePunch(){
  if(!current){Alert.alert('Aucune job','Sélectionne une job avant de puncher.');return;}
  if(working)return;
  Alert.alert(punchActive?'Confirmer PUNCH OUT':'Confirmer PUNCH IN',
   '#'+current.number+' — '+current.name,
   [{text:'Annuler',style:'cancel'},{text:'Confirmer',onPress:async()=>{
    setWorking(true);
    try{if(punchActive)await punchOut(account.companyId);
    else await punchIn(account.companyId,current.id);
    await refresh();
    }catch(e:any){Alert.alert('Punch non enregistré',e.message||String(e))}
    finally{setWorking(false)}
   }}]);
 }
 function archivePunch(id:string){
  Alert.alert('Archiver ce punch ?','Il sera masqué de ta liste, sans supprimer ses heures officielles.',
   [{text:'Annuler',style:'cancel'},{text:'Archiver',onPress:async()=>{
    try{await archiveSegment(id);await refresh()}catch(e:any){Alert.alert('Erreur',e.message)}
   }}]);
 }
 async function unarchive(id:string){
  try{await restoreSegment(id);await refresh()}catch(e:any){Alert.alert('Erreur',e.message)}
 }
 function Header({back,title}:{back?:()=>void;title?:string}){return <View style={styles.header}>{back?<Pressable onPress={back} style={{paddingRight:12}}><Icon name="arrow-back" color={C.text}/></Pressable>:null}<View style={{flex:1}}>{title?<T size={21} bold>{title}</T>:<><Logo/><T size={12} color={C.muted}>{dateLabel()}</T></>}</View><Pressable onPress={()=>setPage('alerts')}><Icon name="notifications-outline" color={C.text}/></Pressable><View style={styles.avatar}><T size={12} bold>FM</T></View></View>}
 function Bottom(){return <View style={styles.nav}>{([{id:'home',label:'Accueil',icon:'home'},{id:'hours',label:'Mes heures',icon:'time-outline'},{id:'orders',label:'Commande',icon:'cart-outline'},{id:'messages',label:'Message',icon:'chatbubble-outline'},{id:'more',label:'Plus',icon:'grid-outline'}] as const).map(tab=><Pressable key={tab.id} onPress={()=>setPage(tab.id)} style={[styles.navItem,(page===tab.id||(page==='jobs'||page==='detail')&&tab.id==='home')&&styles.navSelected]}><Icon name={tab.icon} color={(page===tab.id||(page==='jobs'||page==='detail')&&tab.id==='home')?C.gold:C.muted} size={22}/><T size={10} bold={page===tab.id} color={(page===tab.id||(page==='jobs'||page==='detail')&&tab.id==='home')?C.gold:C.muted}>{tab.label}</T></Pressable>)}</View>}
 function JobCard({job,title,status,pressMode='browse',expanded=false}:{job:Job;title:string;status:string;pressMode?:'browse'|'switch';expanded?:boolean}){return <Pressable onPress={()=>openJobs(pressMode)} style={[styles.card,{padding:12},expanded&&{flex:1}]}><View style={styles.row}><Icon name={title==='Prochain chantier'?'calendar':'briefcase'} size={18}/><T bold size={15} style={{flex:1}}>{title}</T><T size={11} color={status==='En cours'?C.mint:C.gold}>{status}</T><Icon name="chevron-forward" color={C.muted}/></View><View style={[styles.row,{marginTop:9}]}><JobIcon job={job}/><View style={{flex:1,gap:3}}><T bold size={15}>#{job.number} — {job.name}</T><T size={11} color={C.muted} numberOfLines={2} style={{lineHeight:15}}>{job.address}</T><View style={styles.row}><Icon name="location" color={C.mint} size={14}/><T size={11} color={C.muted}>{title==='Prochain chantier'?'Voir la fiche et les jobs':'Plans '+(job.plan_count??'–')+' · Commandes '+(job.open_order_count??'–')}</T></View></View><Pressable onPress={e=>{e.stopPropagation();waze(job)}} style={styles.navRoute}><Icon name="navigate" color={C.text} size={20}/></Pressable></View>{expanded?<View style={{flex:1,justifyContent:'flex-end',paddingTop:10}}><Action icon="swap-horizontal" label="Changer de job / GPS" onPress={()=>openJobs('switch')}/></View>:null}</Pressable>}
 function Home(){return <View style={{flex:1,paddingHorizontal:14,paddingBottom:5,gap:compact?7:10}}><Header/><View style={[styles.row,{gap:10}]}><Card style={{flex:1,padding:10,flexDirection:'row',alignItems:'center',gap:8}}><Icon name="partly-sunny" size={26}/><View><T size={15} bold>Météo</T><T size={10} color={C.muted}>À connecter</T></View></Card><Card style={{flex:1,padding:10,flexDirection:'row',alignItems:'center',gap:8}}><Icon name="location-outline" size={23}/><View><T size={12} bold>Position GPS</T><Pressable onPress={locate}><T size={10} color={C.mint}>{pos?'Détectée':'Localiser'}</T></Pressable></View></Card></View><View style={{alignItems:'center',justifyContent:'center',height:compact?165:200}}><Pressable onPress={togglePunch} style={[styles.punchCircle,{height:compact?155:186,width:compact?155:186,borderColor:punchActive?C.red:C.mint,shadowColor:punchActive?C.red:C.mint,backgroundColor:punchActive?'rgba(96,12,22,0.96)':'rgba(0,53,48,0.94)'}]}><Icon name={punchActive?'stop':'play'} size={42} color={C.text}/><T size={20} bold>PUNCH {punchActive?'OUT':'IN'}</T><T size={13} color={punchActive?'#FFACAC':C.mint} bold>{clock(elapsed)}</T></Pressable><Pressable onPress={()=>openJobs('switch')} style={{position:'absolute',bottom:0,backgroundColor:C.panel,borderColor:C.stroke,borderWidth:1,borderRadius:24,paddingHorizontal:14,paddingVertical:5,flexDirection:'row',alignItems:'center',gap:5}}><Icon name="swap-horizontal" size={16} color={C.mint}/><T size={11}>Changer de job</T></Pressable></View><View style={styles.row}><Card style={{flex:1,padding:12}}><T size={10} color={C.muted}>Cette semaine</T><T size={20} bold>{formatHours(weekDuration)}</T></Card><Card style={{flex:1,padding:12}}><T size={10} color={C.muted}>Cette année</T><T size={20} bold>{formatHours(annualDuration)}</T></Card></View>{current?<JobCard job={current} title="Job en cours" status={punchActive?'En cours':'Non pointé'} expanded={!upcoming}/>:<Pressable onPress={()=>openJobs('browse')}><Card><T>Choisir une job</T></Card></Pressable>}{upcoming?<JobCard job={upcoming} title="Prochain chantier" status={upcoming.planned_start||'À venir'}/>:null}<Pressable onPress={()=>current&&openDetail(current)}><Card style={{padding:10,borderColor:'#70333B',backgroundColor:'#28161F'}}><View style={styles.row}><Icon name="warning" color={C.red}/><View style={{flex:1}}><T bold size={12}>Documents importants</T><T size={10} color={C.muted}>Consulter les plans de la job sélectionnée</T></View><Icon name="chevron-forward" color={C.muted}/></View></Card></Pressable></View>}
 function JobsDirectory(){return <View style={{flex:1,paddingHorizontal:14,gap:9}}><Header back={()=>setPage('home')} title="Toutes les jobs"/><View style={styles.search}><Icon name="search" size={19} color={C.muted}/><TextInput value={query} onChangeText={setQuery} placeholder="Rechercher un numéro, nom ou adresse" placeholderTextColor="#718996" style={{flex:1,color:C.text,fontSize:13}} clearButtonMode="while-editing"/></View><View style={styles.row}>{([{id:'all',label:'Toutes'},{id:'mine',label:'Mes jobs'},{id:'nearby',label:'À proximité'}] as const).map(f=><Pressable key={f.id} onPress={()=>{setFilter(f.id);if(f.id==='nearby'&&!pos)locate()}} style={[styles.pill,filter===f.id&&{backgroundColor:C.gold,borderColor:C.gold}]}><T size={12} bold color={filter===f.id?C.bg:C.text}>{f.label}</T></Pressable>)}</View><View style={{height:175,borderRadius:14,overflow:'hidden',borderColor:C.stroke,borderWidth:1}}><MapView style={{flex:1}} showsUserLocation={!!pos} initialRegion={{latitude:46.82,longitude:-71.23,latitudeDelta:0.32,longitudeDelta:0.48}} region={filter==='nearby'&&pos?{latitude:pos.latitude,longitude:pos.longitude,latitudeDelta:0.25,longitudeDelta:0.25}:undefined} customMapStyle={[{elementType:'geometry',stylers:[{color:'#172b36'}]},{elementType:'labels.text.fill',stylers:[{color:'#b4c3cc'}]},{featureType:'road',elementType:'geometry',stylers:[{color:'#334954'}]},{featureType:'water',elementType:'geometry',stylers:[{color:'#123a51'}]}]}>{filtered.filter(j=>j.latitude!==null&&j.longitude!==null).map(j=><Marker key={j.id} coordinate={{latitude:j.latitude!,longitude:j.longitude!}} title={'#'+j.number+' — '+j.name} description={j.address} pinColor={j.id===current?.id?C.mint:C.gold} onCalloutPress={()=>openDetail(j)}/>)}</MapView><Pressable onPress={locate} style={styles.locateBtn}><Icon name="locate" size={21} color={C.text}/></Pressable></View><View style={styles.row}><T bold size={13}>{filtered.length} chantier{filtered.length>1?'s':''}</T><T size={10} color={C.muted}>{pickerMode==='switch'?'Choisir pour transférer':'Ouvre une job pour ses détails'}</T></View><FlatList style={{flex:1}} data={filtered} keyExtractor={j=>j.id} keyboardShouldPersistTaps="handled" ListEmptyComponent={<T color={C.muted}>Aucune job correspondante.</T>} contentContainerStyle={{paddingBottom:8,gap:7}} renderItem={({item})=><Pressable onPress={()=>openDetail(item)} style={[styles.card,{padding:9}]}><View style={styles.row}><JobIcon job={item}/><View style={{flex:1,gap:4}}><T size={15} bold>#{item.number} — {item.name}</T><T size={11} color={C.muted} numberOfLines={2}>{item.address}</T><View style={styles.row}>{item.assigned_to_me?<T size={10} color={C.mint}>Ma job · </T>:null}{pos&&item.latitude!==null&&item.longitude!==null?<T size={10} color={C.muted}>{distanceKm(pos,{latitude:item.latitude,longitude:item.longitude}).toFixed(1)} km</T>:null}{item.id===current?.id?<T size={10} color={C.gold}>Sélectionnée</T>:null}</View></View><Icon name="chevron-forward" color={C.muted}/></View></Pressable>}/></View>}
 function DetailScreen(){if(!detail)return <View/>;const relevant=segments.filter(s=>s.jobId===detail.id&&(showArchived?archived.includes(s.id):!archived.includes(s.id)));return <View style={{flex:1,paddingHorizontal:14}}><Header back={()=>setPage('jobs')} title={'Job #'+detail.number}/><ScrollView contentContainerStyle={{gap:12,paddingBottom:22}}><Card><View style={styles.row}><JobIcon job={detail}/><View style={{flex:1,gap:5}}><T bold size={19}>{detail.name}</T><T size={12} color={C.muted}>{detail.address}</T></View></View><View style={[styles.row,{marginTop:12}]}><Action icon="navigate" label="Waze" onPress={()=>waze(detail)}/><Action icon="map" label="Google Maps" onPress={()=>mapLink(detail)}/></View></Card><View style={styles.row}><Card style={{flex:1}}><Icon name="document-text" size={21}/><T bold>Plans et documents</T><T size={11} color={C.muted}>{detail.plan_count!==undefined?detail.plan_count+' fichiers':'Documents liés à la job'}</T></Card><Card style={{flex:1}}><Icon name="cart" size={21}/><T bold>Commandes</T><T size={11} color={C.muted}>{detail.open_order_count!==undefined?detail.open_order_count+' en cours':'Historique par chantier'}</T></Card></View><Action icon="swap-horizontal" label={punchActive?'Transférer mon punch ici':'Sélectionner cette job'} onPress={()=>switchTo(detail)}/><Card><View style={styles.row}><T bold style={{flex:1}}>Punchs de cette job</T><Pressable onPress={()=>setShowArchived(v=>!v)}><T color={C.gold} size={12}>{showArchived?'Actifs':'Archives'}</T></Pressable></View>{relevant.length===0?<T color={C.muted} style={{marginTop:13}}>Aucun punch {showArchived?'archivé':'enregistré sur cette job'}.</T>:relevant.map(s=><View key={s.id} style={[styles.row,{paddingVertical:11,borderTopColor:C.stroke,borderTopWidth:1,marginTop:8}]}><Icon name="time-outline" color={C.mint}/><View style={{flex:1}}><T size={12}>{new Date(s.start).toLocaleString('fr-CA')}</T><T size={11} color={C.muted}>{s.end?'Terminé':'En cours'}</T></View><Pressable onPress={()=>showArchived?unarchive(s.id):archivePunch(s.id)} style={{padding:7}}><Icon name={showArchived?'arrow-undo':'ellipsis-vertical'} color={C.text}/></Pressable></View>)}</Card></ScrollView></View>}
 function HoursScreen(){return <View style={{flex:1,paddingHorizontal:14,gap:10}}><Header title="Mes heures"/><View style={styles.row}><Card style={{flex:1}}><T size={11} color={C.muted}>Cette semaine</T><T size={22} bold>{formatHours(weekDuration)}</T></Card><Card style={{flex:1}}><T size={11} color={C.muted}>Cette année</T><T size={22} bold>{formatHours(annualDuration)}</T></Card></View><Card style={{flex:1}}><T size={16} bold>Historique de mes punchs</T><T size={11} color={C.muted}>Appuie sur une job de l’accueil pour archiver un ancien punch.</T><ScrollView contentContainerStyle={{gap:8,paddingTop:13}}>{sessions.length===0?<T color={C.muted}>Aucune heure enregistrée.</T>:sessions.map(s=><Pressable key={s.id} style={{padding:10,borderRadius:10,backgroundColor:C.panel2}} onPress={()=>{const segment=serverSegments.find(z=>z.session_id===s.id);const job=jobs.find(z=>z.id===segment?.job_id);if(job)openDetail(job)}}><View style={styles.row}><Icon name="time" color={s.ended_at?C.gold:C.mint}/><View style={{flex:1}}><T size={13} bold>{new Date(s.started_at).toLocaleDateString('fr-CA')}</T><T size={11} color={C.muted}>{new Date(s.started_at).toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'})} — {s.ended_at?new Date(s.ended_at).toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'}):'En cours'}</T></View><T size={12} bold>{formatHours(Math.max(0,(s.ended_at?Date.parse(s.ended_at):now)-Date.parse(s.started_at)))}</T><Icon name="chevron-forward" color={C.muted}/></View></Pressable>)}</ScrollView></Card></View>}
 function OrdersScreen(){return <View style={{flex:1,paddingHorizontal:14,gap:12}}><Header title="Commande"/><Card><T size={15} bold>Nouvelle demande de matériel</T><T color={C.muted} size={12}>Job : {current?('#'+current.number+' — '+current.name):'Sélectionner une job'}</T><TextInput placeholder="Décrire le matériel, les quantités…" multiline value={orderNote} onChangeText={setOrderNote} placeholderTextColor={C.muted} style={{minHeight:85,backgroundColor:C.panel2,borderRadius:10,color:C.text,padding:12,marginVertical:11,textAlignVertical:'top'}}/><Action icon="send" label="Envoyer à l’administration" onPress={async()=>{if(!current||!orderNote.trim()){Alert.alert('Information manquante','Choisis une job et décris le matériel.');return;}try{const {error}=await supabase.from('material_orders').insert({company_id:account.companyId,job_id:current.id,created_by:account.userId,note:orderNote.trim()});if(error)throw error;setOrderNote('');await refresh();Alert.alert('Commande envoyée','La demande est enregistrée pour cette job.');}catch(e:any){Alert.alert('Commande non envoyée',e.message)}}}/></Card><Card style={{flex:1}}><T size={16} bold>Historique des commandes</T><ScrollView contentContainerStyle={{gap:9,paddingTop:10}}>{orders.length===0?<T size={12} color={C.muted}>Aucune commande.</T>:orders.map(o=><View key={o.id} style={{padding:10,backgroundColor:C.panel2,borderRadius:9}}><View style={styles.row}><T size={12} bold>#{jobs.find(j=>j.id===o.job_id)?.number||'Job'}</T><T size={10} color={C.gold}>{o.status}</T><T size={10} color={C.muted}>{new Date(o.created_at).toLocaleDateString('fr-CA')}</T></View><T size={12} color={C.muted}>{o.note||'Matériel'}</T></View>)}</ScrollView></Card></View>}
 function MoreScreen(){return <View style={{flex:1,paddingHorizontal:14,gap:10}}><Header title="Plus"/><Card><T size={16} bold>{account.companyName}</T><T size={12} color={C.muted}>Mon rôle : {account.role} · Abonnement : {account.billingStatus}</T></Card>{account.role==='boss'||account.role==='admin'?<Card><T size={15} bold>Créer une job</T>{[{v:jobNumber,set:setJobNumber,h:'Numéro de job'},{v:jobName,set:setJobName,h:'Nom du chantier'},{v:jobAddress,set:setJobAddress,h:'Adresse ou emplacement'}].map(f=><TextInput key={f.h} style={{height:40,backgroundColor:C.panel2,color:C.text,borderRadius:8,paddingHorizontal:9,marginTop:7}} value={f.v} onChangeText={f.set} placeholder={f.h} placeholderTextColor={C.muted}/>)}<View style={{marginTop:9}}><Action icon="add" label="Ajouter le chantier" onPress={async()=>{if(!jobNumber.trim()||!jobName.trim()){Alert.alert('Champs requis','Numéro et nom du chantier.');return;}try{await createJob(account.companyId,jobNumber,jobName,jobAddress);setJobNumber('');setJobName('');setJobAddress('');await refresh();Alert.alert('Job ajoutée','Le chantier apparaît dans Toutes les jobs.');}catch(e:any){Alert.alert('Erreur',e.message)}}}/></View></Card>:null}<Card style={{gap:8}}><T size={14} bold>Mon espace</T><T size={12} color={C.muted}>Mon horaire · Congés et absences · Carte CCQ · Contacts d’urgence · Langues · Thème</T><T size={11} color={C.gold}>Ces modules sont prévus dans la prochaine phase.</T></Card><Action icon="log-out" label="Se déconnecter" onPress={()=>supabase.auth.signOut()}/></View>}
 function SimplePage({title,icon,lines}:{title:string;icon:any;lines:string[]}){return <View style={{flex:1,paddingHorizontal:14,gap:16}}><Header title={title}/><Card style={{alignItems:'center',padding:24,gap:15}}><Icon name={icon} size={46}/><T size={17} bold>{title}</T>{lines.map((l,i)=><T key={i} color={C.muted} style={{textAlign:'center'}}>{l}</T>)}</Card></View>}
 return <SafeAreaView style={{flex:1,backgroundColor:C.bg}}><StatusBar backgroundColor={C.bg} barStyle="light-content"/><LinearGradient colors={['#25313B','#132532','#08131C','#08131C']} style={StyleSheet.absoluteFill}/>{page==='alerts'?<View style={{flex:1,paddingHorizontal:14}}><Header title="Notifications et punchs GPS" back={()=>setPage('home')}/><GeofencePanel account={account}/></View>:page==='home'?Home():page==='jobs'?JobsDirectory():page==='detail'?DetailScreen():page==='hours'?HoursScreen():page==='orders'?OrdersScreen():page==='messages'?<MessagesScreen account={account}/>:<MorePortal account={account} onRefresh={refresh}/>}<View style={styles.demoBar}><T size={9} color={C.gold} style={{textAlign:'center'}}>{working?'ENREGISTREMENT…':message||'PUNCH 360°'}</T></View><Bottom/></SafeAreaView>
}

const styles=StyleSheet.create({
 header:{minHeight:65,flexDirection:'row',alignItems:'center',gap:13,paddingTop:8,paddingBottom:7},
 row:{flexDirection:'row',alignItems:'center',gap:8},
 card:{backgroundColor:'rgba(13,30,42,0.95)',borderRadius:14,borderWidth:1,borderColor:C.stroke,padding:13,overflow:'hidden'},
 photo:{height:75,width:87,borderRadius:9,alignItems:'center',justifyContent:'center',overflow:'hidden'},
 avatar:{height:34,width:34,borderRadius:20,borderWidth:1,borderColor:C.gold,backgroundColor:'#233744',alignItems:'center',justifyContent:'center'},
 nav:{height:67,flexDirection:'row',alignItems:'center',justifyContent:'space-around',backgroundColor:'#0A1823',borderTopColor:C.stroke,borderTopWidth:1},
 navItem:{flex:1,height:61,gap:5,alignItems:'center',justifyContent:'center',borderRadius:15},
 navSelected:{backgroundColor:'#2A251A'},
 punchCircle:{backgroundColor:'rgba(0,53,48,0.94)',borderWidth:7,borderRadius:100,alignItems:'center',justifyContent:'center',gap:3,shadowOpacity:0.6,shadowRadius:12,elevation:8},
 navRoute:{height:46,width:40,backgroundColor:C.panel2,borderColor:C.stroke,borderWidth:1,borderRadius:13,alignItems:'center',justifyContent:'center'},
 search:{height:44,backgroundColor:C.panel,borderRadius:13,borderColor:C.stroke,borderWidth:1,paddingHorizontal:12,flexDirection:'row',alignItems:'center',gap:9},
 pill:{borderWidth:1,borderColor:C.stroke,backgroundColor:C.panel,paddingHorizontal:13,paddingVertical:9,borderRadius:23,flex:1,alignItems:'center'},
 locateBtn:{position:'absolute',right:10,bottom:10,padding:8,backgroundColor:C.panel,borderRadius:25,borderWidth:1,borderColor:C.stroke},
 action:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,backgroundColor:C.panel2,borderRadius:11,borderColor:C.stroke,borderWidth:1,paddingVertical:11,paddingHorizontal:7},
 demoBar:{height:20,justifyContent:'center',backgroundColor:'#242217'}
});
export default function App(){return <AuthGate>{account=>account.role==='admin'||account.role==='boss'?<ManagementWorkspace account={account}>{account.role==='boss'?(account.edition==='essential'?<EssentialWorkspace account={account}/>:<Workspace account={account}/>):null}</ManagementWorkspace>:account.edition==='essential'?<EssentialWorkspace account={account}/>:<Workspace account={account}/>}</AuthGate>}
