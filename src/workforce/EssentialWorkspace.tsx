import {SupervisorApprovalsPanel,useSupervisorApprovalAccess} from './SupervisorApprovalsPanel';
import {useBreakPolicy} from './BreakPoliciesPanel';
import {MissingDaysPanel} from './MissingDaysPanel';
import {SupportPanel} from '../support/SupportPanel';
import {BreakCorrectionsPanel} from './BreakCorrectionsPanel';
import {EssentialPayrollPanel} from '../hr/EssentialPayrollPanel';
import {EssentialCommunicationsPanel} from '../hr/EssentialCommunicationsPanel';
import {EssentialHrPanel} from '../hr/EssentialHrPanel';
import {AppearancePanel,ThemeDecoration,usePersonalTheme} from '../appearance/AppearancePanel';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {EssentialPlanningPanel} from './EssentialPlanningPanel';
import React,{useEffect,useRef,useState} from 'react';
import {Alert,AppState,Pressable,SafeAreaView,ScrollView,StatusBar,StyleSheet,Text,View,useWindowDimensions,Linking,Platform} from 'react-native';
import * as Network from 'expo-network';
import {Ionicons} from '@expo/vector-icons';
import type {WorkspaceAccount} from '../auth/AuthGate';
import {loadPunchState,punchIn,punchOut,punchBreak,hoursFor,PunchState} from '../punch/api';
import {personalUpcomingClientVisit} from '../../web/live/personal-client-visit.js';
import {essentialWorkerPunchJobId} from '../../web/live/essential-mobile-punch.js';
import {essentialMobileDailyHours} from '../../web/live/essential-hours-view.js';
import {PersonalMissionCard} from './MissionsPanel';
import {navigationProviders,navigationUrl,navigationDestination,navigationPreferenceKey,chooseNavigationPreference,writeNavigationPreference} from '../../web/live/navigation-choices.js';
import {journalSummary} from '../punch/journal';
import {supabase} from '../lib/supabase';
import {nativeEssentialLanguages,nativeEssentialText,readNativeLocale,writeNativeLocale,nativeLocaleDirection} from '../i18n/essential-native-locale';
import {MorePortal} from '../hr/MorePortal';
import {OperationsPanel} from './OperationsPanel';
import {GeofencePanel} from './GeofencePanel';
import {WorkforcePanel} from './WorkforcePanel';
const Z={bg:'#FAFBF8',text:'#2F4935',muted:'#8C9C86',line:'#E1E8DB',sage:'#779574'};
const duration=(ms:number)=>{const n=Math.max(0,Math.floor(ms/1000));return [Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(x=>String(x).padStart(2,'0')).join(':')};
const hm=(ms:number)=>{const n=Math.floor(ms/60000);return Math.floor(n/60)+' h '+String(n%60).padStart(2,'0')};
/** A journal flush is not proof of a current server attendance snapshot.
 * Never describe a cached fallback as synchronized official hours.
 */
export function essentialManualPunchSyncNotice({
 blocked,pending,conflicts,readSource,cacheWriteFailed
}:{
 blocked:boolean;pending:number;conflicts:number;
 readSource:PunchState['readSource'];cacheWriteFailed:boolean
}):string{
 if(blocked)return 'Journal local à vérifier : aucun envoi confirmé. Contactez votre responsable.';
 if(pending&&conflicts)return pending+' pointage(s) en attente et '+conflicts+' conflit(s) à vérifier.';
 if(pending)return pending+' pointage(s) en attente. Réessayez avec une connexion stable.';
 if(conflicts)return conflicts+' conflit(s) à vérifier avec votre responsable.';
 if(readSource!=='server')
  return 'Relevé serveur indisponible · synchronisation non confirmée. Réessayez avec une connexion stable.';
 if(cacheWriteFailed)
  return 'Aucun pointage local en attente · copie hors ligne indisponible sur cet appareil.';
 return 'Aucun pointage local en attente. Vérifiez vos heures dans le relevé serveur.';
}
export function EssentialWorkspace({account}:{account:WorkspaceAccount}){
 const breakPolicy=useBreakPolicy(account),canApproveTeam=useSupervisorApprovalAccess(account);
 const [page,setPage]=useState<'home'|'hours'|'schedule'|'more'>('home'),[detail,setDetail]=useState(''),[punch,setPunch]=useState<PunchState>({sessions:[],segments:[],active:null,lastJobId:null,breaks:[]}),[now,setNow]=useState(Date.now()),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[pending,setPending]=useState(0),[conflicts,setConflicts]=useState(0),[pendingItems,setPendingItems]=useState<{label:string;occurredAt:string|null}[]>([]),[conflictItems,setConflictItems]=useState<{label:string;occurredAt:string|null}[]>([]),[mobileAllowed,setMobileAllowed]=useState(false),[siteJob,setSiteJob]=useState(account.defaultJobId);
 // Never permit PUNCH when journalSummary reports an unreadable local queue.
 const [journalBlocked,setJournalBlocked]=useState(true);
 const dimensions=useWindowDimensions(),compact=dimensions.height<850;
 const [language,setLanguage]=useState('fr'),[languageMenu,setLanguageMenu]=useState(false);
 const [missionWorker,setMissionWorker]=useState<{key:string;id:string}|null>(null);
 const [myVisit,setMyVisit]=useState<ReturnType<typeof personalUpcomingClientVisit>|null>(null),[visitUnavailable,setVisitUnavailable]=useState(false),[visitExpanded,setVisitExpanded]=useState(false);
 const [fixedAddress,setFixedAddress]=useState(''),[fixedName,setFixedName]=useState('');
 const [navPref,setNavPref]=useState<string|null>(null),[navChooser,setNavChooser]=useState(false);
 // Ignore old timer and reconnect reads after a newer punch or sync.
 const punchReadRevision=useRef(0),punchActionInFlight=useRef(false),syncInFlight=useRef(false);
 const visitContext=useRef(account.companyId+':'+account.userId);visitContext.current=account.companyId+':'+account.userId;
 const navKey=navigationPreferenceKey(account.userId,account.companyId);
 useEffect(()=>{let current=true;setNavPref(null);setNavChooser(false);setFixedAddress('');setFixedName('');
  AsyncStorage.getItem(navKey).then(pref=>{if(current)setNavPref(chooseNavigationPreference(pref,Platform.OS))}).catch(()=>{});
  return()=>{current=false};
 },[navKey]);
 const rtl=nativeLocaleDirection(language)==='rtl';
 const tr=(key:string)=>nativeEssentialText(language,key);
 useEffect(()=>{let mounted=true;setLanguage('fr');setLanguageMenu(false);
  readNativeLocale(AsyncStorage,account.userId).then(code=>{if(mounted)setLanguage(code)});
  return()=>{mounted=false};
 },[account.userId]);
 async function chooseLanguage(code:string){setLanguage(code);setLanguageMenu(false);
  try{await writeNativeLocale(AsyncStorage,account.userId,code);}
  catch{setNotice('Impossible d’enregistrer votre préférence de langue.');}
 }

 const appearance=usePersonalTheme(account.userId),t=appearance.theme,Z={bg:t.bg,text:t.text,muted:t.muted,line:t.line,sage:t.accent};const styles=makeStyles(Z,t.surface,compact);
 const manager=['boss','admin'].includes(account.role);
 useEffect(()=>{if(appearance.needsChoice){setPage('more');setDetail('appearance');}},[appearance.needsChoice]);
 async function load(){
  if(punchActionInFlight.current||syncInFlight.current)return;
  const requestedFor=account.companyId+':'+account.userId;
  const revision=++punchReadRevision.current;
  const current=()=>visitContext.current===requestedFor&&punchReadRevision.current===revision;
  try{
  const cacheKey='essential-punch-channel:'+account.companyId+':'+account.userId;
  // Damaged or unreadable channel permissions cannot block the hours view.
  // They are treated as unknown authorization, never as an active grant.
  let cached:any=null;
  try{const raw=await AsyncStorage.getItem(cacheKey);cached=raw?JSON.parse(raw):null}
  catch{/* Continue loading the attendance snapshot with permissions disabled. */}
  if(!current())return;
  const validCache=cached?.version===2&&Number.isFinite(cached.checkedAt)&&
    typeof cached.allowed==='boolean'&&
    (cached.job===null||typeof cached.job==='string')&&
    cached.checkedAt<=Date.now()&&Date.now()-cached.checkedAt<86400000;
  let offline=true;
  try{const network=await Network.getNetworkStateAsync();
   offline=network.isConnected===false||network.isInternetReachable===false;
  }catch{/* Unknown connectivity never grants new mobile permissions. */}
  if(!current())return;
  if(offline){
   if(validCache){setSiteJob(cached.job);setMobileAllowed(cached.allowed)}else{setSiteJob(null);setMobileAllowed(false);setNotice('Connexion requise pour actualiser les méthodes de pointage autorisées.');}
   if(visitContext.current===requestedFor){setMissionWorker(null);setMyVisit(null);setVisitUnavailable(true);setFixedAddress('');setFixedName('');}
  }else{
   // A rejected permissions request must not hide the employee's hours.
   // Treat it like a failed query, not as evidence of mobile PUNCH access.
   let channel:any;
   try{channel=await supabase.from('company_workers').select('id,status,can_mobile_punch,personal_access,location_id').eq('company_id',account.companyId).eq('auth_user_id',account.userId).maybeSingle();}
   catch{channel={data:null,error:true};}
   if(!current())return;
   if(channel.error){if(validCache){setSiteJob(cached.job);setMobileAllowed(cached.allowed)}else{setSiteJob(null);setMobileAllowed(false)}if(visitContext.current===requestedFor){setMissionWorker(null);setMyVisit(null);setVisitUnavailable(true);setFixedAddress('');setFixedName('');}}
   else if(channel.data){if(visitContext.current===requestedFor)setMissionWorker({key:requestedFor,id:channel.data.id});let assignedLocation=null;
    if(channel.data.location_id){
     // Unknown site assignment cannot authorize a default-job fallback,
     // but it must not suppress the independent read-only hours snapshot.
     let site:any;
     try{site=await supabase.from('essential_locations')
      .select('id,company_id,punch_job_id,active,name,address')
      .eq('company_id',account.companyId).eq('id',channel.data.location_id).maybeSingle();}
     catch{site={data:null,error:true};}
     if(!current())return;
     // A missing, inactive or unreadable assigned location must never
     // silently redirect PUNCH IN to the company's default Job.
     assignedLocation=site.error?null:site.data;
     if(visitContext.current===requestedFor){
      setFixedAddress(assignedLocation?.address||'');setFixedName(assignedLocation?.name||'');
     }
    }else if(visitContext.current===requestedFor){setFixedAddress('');setFixedName('');}
    const job=essentialWorkerPunchJobId(account.companyId,channel.data,
     assignedLocation?[assignedLocation]:[],account.defaultJobId);
    const allowed=channel.data.status==='active'&&channel.data.can_mobile_punch===true&&channel.data.personal_access===true;setSiteJob(job);setMobileAllowed(allowed);
    await AsyncStorage.setItem(cacheKey,JSON.stringify({version:2,job,allowed,checkedAt:Date.now()})).catch(()=>{});
    if(!current())return;
    try{
     const anchor=Date.now();
     const result=await supabase.rpc('list_essential_assigned_client_sites',{
      p_company:account.companyId,p_from:new Date(anchor-12*3600000).toISOString(),
      p_to:new Date(anchor+48*3600000).toISOString()});
     if(!current())return;
     if(result.error)throw result.error;
     if(visitContext.current===requestedFor){
      setMyVisit(personalUpcomingClientVisit(result.data?.items,channel.data.id,anchor));
      setVisitUnavailable(!!result.data?.has_more);
     }
    }catch{if(visitContext.current===requestedFor){setMyVisit(null);setVisitUnavailable(true);}}
   }else{setSiteJob(null);setMobileAllowed(false);if(visitContext.current===requestedFor){setMissionWorker(null);setMyVisit(null);setVisitUnavailable(false);setFixedAddress('');setFixedName('');}}
  }
  const updated=await loadPunchState(account.companyId);
  const summary=await journalSummary(account.companyId);
  if(!current())return;
  setPunch(updated);setJournalBlocked(!!updated.localJournalBlocked||summary.blocked);setPending(summary.pending);setConflicts(summary.conflicts);
  setPendingItems(summary.pendingItems);setConflictItems(summary.conflictItems);
  if(updated.snapshotUnverified)setNotice('Relevé hors ligne indisponible : pointage suspendu jusqu’à vérification en ligne.');
  else if(updated.localJournalBlocked||summary.blocked)
   setNotice('Journal local à vérifier : pointage bloqué sur cet appareil. Heures serveur consultables.');
  else setNotice(previous=>previous.startsWith('Journal local à vérifier :')?'':previous);
 }catch(e:any){if(current()){setJournalBlocked(true);setNotice(e?.message||String(e))}}}

 useEffect(()=>{setMobileAllowed(false);setSiteJob(null);setJournalBlocked(true);load();const timer=setInterval(load,30000),tick=setInterval(()=>setNow(Date.now()),1000);const app=AppState.addEventListener('change',s=>{if(s==='active')load()});const network=Network.addNetworkStateListener(s=>{if(s.isConnected&&s.isInternetReachable!==false)load()});return()=>{++punchReadRevision.current;clearInterval(timer);clearInterval(tick);app.remove();network.remove()}},[account.companyId,account.userId]);
 const date=new Date(now),day=new Date(date.getFullYear(),date.getMonth(),date.getDate()).getTime(),week=new Date(date.getFullYear(),date.getMonth(),date.getDate()-(date.getDay()+6)%7).getTime();
 const worked=hoursFor(punch.segments,now,day,now,punch.breaks||[]),weekly=hoursFor(punch.segments,now,week,now,punch.breaks||[]),paused=!!punch.active&&(punch.breaks||[]).some(b=>b.session_id===punch.active?.id&&b.ended_at===null);
 // Local projections and offline snapshots are never payroll-approved hours.
 const dailyHours:{dayStart:number;netMs:number;grossMs:number;unpaidMs:number}[]=essentialMobileDailyHours({
  sessions:punch.sessions,segments:punch.segments,breaks:punch.breaks||[],
  companyId:account.companyId,userId:account.userId,now
 });
 const hoursOrigin=punch.snapshotUnverified?'Relevé hors ligne introuvable ou illisible · pointage suspendu':
  journalBlocked?'Journal local à vérifier':
  // Pending local events must always be visible as unconfirmed, including
  // when the network read falls back to a saved snapshot or cache write fails.
  punch.hasLocalProjection?(punch.readSource==='cache'
   ?'Dernier relevé sauvegardé + pointages locaux en attente · non confirmés'
   :'Relevé serveur + pointages locaux en attente · non confirmés'):
  punch.cacheWriteFailed?'Relevé serveur · copie hors ligne indisponible sur cet appareil':
  punch.readSource==='cache'?'Dernier relevé sauvegardé sur cet appareil':
  punch.readSource==='server'?'Dernier relevé reçu du serveur':'Relevé non vérifié';
 async function act(action:'punch'|'pause',paid=false){
  if(busy||punchActionInFlight.current||syncInFlight.current||!mobileAllowed||journalBlocked)return;
  if(action==='punch'&&!punch.active&&!siteJob){
   setNotice('Établissement de pointage non confirmé. Consultez votre responsable avant de commencer.');
   return;
  }
  punchActionInFlight.current=true;++punchReadRevision.current;setBusy(true);setNotice('');try{const result=action==='pause'?await punchBreak(account.companyId,paused,paid):punch.active?await punchOut(account.companyId):await punchIn(account.companyId,siteJob!);setNotice(result.queued?'Enregistré sur cet appareil. Envoi au retour du réseau.':result.review_status==='pending'?'Enregistré · validation du responsable requise':'Enregistré.');punchActionInFlight.current=false;await load()}catch(e:any){setNotice(e.message)}finally{punchActionInFlight.current=false;setBusy(false)}}
 async function syncLocalPunches(){
  if(busy||punchActionInFlight.current||syncInFlight.current||journalBlocked)return;
   syncInFlight.current=true;
   const revision=++punchReadRevision.current;
  setBusy(true);
  try{
   const network=await Network.getNetworkStateAsync();
   if(network.isConnected===false||network.isInternetReachable===false){
    setNotice('Connexion Internet requise pour transmettre les pointages.');
    return;
   }
   // Reuse the same secured journal flush and server hours refresh as auto-sync.
   const requestedFor=account.companyId+':'+account.userId;
   const updated=await loadPunchState(account.companyId);
   const summary=await journalSummary(account.companyId);
   if(visitContext.current!==requestedFor||punchReadRevision.current!==revision)return;
   setPunch(updated);setJournalBlocked(!!updated.localJournalBlocked||summary.blocked);setPending(summary.pending);setConflicts(summary.conflicts);
  setPendingItems(summary.pendingItems);setConflictItems(summary.conflictItems);
   setNotice(essentialManualPunchSyncNotice({
     blocked:!!updated.localJournalBlocked||summary.blocked,
     pending:summary.pending,conflicts:summary.conflicts,
     readSource:updated.readSource,cacheWriteFailed:!!updated.cacheWriteFailed
    }));
  }catch(e:any){if(visitContext.current===account.companyId+':'+account.userId&&punchReadRevision.current===revision)setNotice('Synchronisation non confirmée : '+(e?.message||String(e)))}
  finally{syncInFlight.current=false;setBusy(false)}
 }
 const navDestination=navigationDestination({visit:myVisit,usualAddress:fixedAddress,usualName:fixedName,incomplete:visitUnavailable});
 const navOptions=navigationProviders(Platform.OS);
 const activeNav=chooseNavigationPreference(navPref,Platform.OS);
 async function navigateToWork(provider:string,remember:boolean){
  if(!navDestination)return;
  try{
   const url=navigationUrl(provider,navDestination.address,Platform.OS);
   if(remember){await AsyncStorage.setItem(navKey,provider);setNavPref(provider);}
   await Linking.openURL(url);setNavChooser(false);
  }catch(e:any){setNotice(e.message||'Impossible d’ouvrir l’itinéraire. Choisissez une autre application.');setNavChooser(true);}
 }
 function openWorkNavigation(){if(!navDestination)return;
  if(activeNav){void navigateToWork(activeNav,false)}else setNavChooser(true);
 }
 const txt=(v:string,style:object={})=><Text style={[{color:Z.text,fontSize:14},style]}>{v}</Text>;
 const menu=(title:string,id:string)=><Pressable key={id} onPress={()=>setDetail(id)} style={[styles.menu,rtl&&{flexDirection:'row-reverse'}]}>{txt(title,{textAlign:rtl?'right':'left',writingDirection:rtl?'rtl':'ltr'})}<Ionicons name="chevron-forward" size={17} color={Z.muted}/></Pressable>;
 async function saveNavigationSetting(provider:string|null){
  try{
   const expected=account.companyId+':'+account.userId;
   const result=await writeNavigationPreference(AsyncStorage,account.userId,account.companyId,provider,Platform.OS);
   if(visitContext.current===expected){setNavPref(result);setNavChooser(false);setNotice(result?'Préférence de navigation enregistrée.':'Préférence de navigation effacée.');}
  }catch(error:any){setNotice(error?.message||'Impossible de conserver la préférence de navigation.');}
 }
 const navigationSettings=<ScrollView contentContainerStyle={{gap:13,paddingBottom:24}}>
  <View style={[styles.card,{gap:11}]}>
   {txt('Réglages · Navigation',{fontSize:21,fontWeight:'700'})}
   {txt('Choisissez votre application préférée même sans horaire ni lieu attribué. La préférence reste personnelle, sur cet appareil, et propre à cette compagnie.',{fontSize:12,color:Z.muted})}
   {txt('Préférence actuelle : '+(navOptions.find(option=>option.id===navPref)?.label||'Demander à chaque trajet'),{fontSize:13,fontWeight:'600'})}
   {navOptions.map(option=><Pressable accessibilityRole="button" accessibilityState={{selected:navPref===option.id}}
    key={option.id} onPress={()=>{void saveNavigationSetting(option.id)}}
    style={{padding:13,borderWidth:1,borderColor:Z.line,borderRadius:10,backgroundColor:navPref===option.id?Z.bg:t.surface,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
    {txt(option.label,{fontWeight:navPref===option.id?'700':'500'})}
    {navPref===option.id?<Ionicons name="checkmark-circle" size={19} color={Z.sage}/>:null}
   </Pressable>)}
   {navPref?<Pressable accessibilityRole="button" onPress={()=>{void saveNavigationSetting(null)}} style={{paddingVertical:12}}>
    {txt('Effacer ma préférence',{color:Z.sage,fontWeight:'700'})}
   </Pressable>:null}
   {txt('Depuis Accueil Punch, le choix « Juste cette fois » reste disponible. Aucun pointage, GPS PUNCH ou suivi de trajet ne démarre ici.',{fontSize:12,color:Z.muted})}
  </View>
 </ScrollView>;
 const content=detail?<View style={{flex:1,gap:12}}><Pressable onPress={()=>setDetail('')} style={{paddingVertical:12}}>{txt('← '+tr('cancel'),{color:Z.sage})}</Pressable>{detail==='supervision'?<SupervisorApprovalsPanel key={account.companyId+account.userId} account={account}/>:detail==='missingDays'?<MissingDaysPanel key={account.companyId+account.userId} account={account}/>:detail==='support'?<SupportPanel key={account.companyId+account.userId} account={account}/>:detail==='breakCorrections'?<BreakCorrectionsPanel key={account.companyId+account.userId} account={account}/>:detail==='payroll'?<EssentialPayrollPanel key={account.companyId+account.userId} account={account}/>:detail==='communications'?<EssentialCommunicationsPanel key={account.companyId+account.userId} account={account}/>:detail==='hr'?<EssentialHrPanel key={account.companyId+account.userId} account={account}/>:detail==='appearance'?<AppearancePanel appearance={appearance} onPreviewActual={()=>{setDetail('');setPage('home')}}/>:detail==='navigation'?navigationSettings:detail==='profile'||detail==='leave'?<MorePortal key={detail} initialSection={detail} account={account} onRefresh={load}/>:detail==='invite'?<OperationsPanel account={account} mode="invite"/>:detail==='geofence'?<GeofencePanel account={account}/>:<WorkforcePanel account={account}/>}</View>:page==='home'?<View style={{flex:1,gap:compact?9:20,paddingTop:compact?8:18}}><View>{txt(date.toLocaleDateString('fr-CA',{weekday:'long',day:'numeric',month:'long'}).toUpperCase(),{color:Z.muted,fontSize:10,letterSpacing:1.2})}{txt(tr('greeting')+'.',{fontSize:compact?26:34,fontWeight:'400',letterSpacing:-1,marginTop:10})}{txt('Une journée à votre rythme.',{color:Z.muted,fontSize:13,marginTop:7})}</View><View style={styles.clock}>{txt((paused?'◌ En pause':punch.active?'● Votre journée est en cours':'● Prêt pour votre journée ?'),{color:Z.sage,fontSize:11})}{txt(duration(worked),{fontSize:compact?36:51,fontWeight:'300',letterSpacing:-2,fontVariant:['tabular-nums'],marginVertical:12})}{!mobileAllowed?txt('Le pointage s’effectue sur la tablette de votre entreprise.',{fontSize:12,color:Z.sage,textAlign:'center'}):null}{breakPolicy?.paid_mode&&breakPolicy.paid_mode!=='choice'?txt(breakPolicy.paid_mode==='paid'?'Politique du département : pauses payées':'Politique du département : pauses non payées',{fontSize:11,color:Z.muted}):null}{txt('Temps travaillé · pauses non payées exclues',{color:Z.muted,fontSize:10})}<Pressable disabled={busy||!mobileAllowed||journalBlocked||(!punch.active&&!siteJob)} style={[styles.punch,(busy||!mobileAllowed||journalBlocked||(!punch.active&&!siteJob))&&{opacity:.5}]} onPress={()=>Alert.alert(punch.active?'Terminer votre journée ?':'Commencer votre journée ?',account.companyName,[{text:'Annuler',style:'cancel'},{text:'Confirmer',onPress:()=>act('punch')}])}>{txt(journalBlocked?'Journal à vérifier':!mobileAllowed?'Pointage sur tablette':!punch.active&&!siteJob?'Établissement à vérifier':busy?'Enregistrement…':punch.active?tr('endDay'):tr('startDay'),{color:'white',fontSize:15,fontWeight:'500'})}<Ionicons name="arrow-up-outline" size={20} color="white" style={{transform:[{rotate:'45deg'}]}}/></Pressable>{punch.active&&mobileAllowed&&!journalBlocked?<Pressable disabled={busy} onPress={()=>paused?act('pause'):Alert.alert('Type de pause','Choisissez selon la politique applicable.',[{text:'Annuler',style:'cancel'},...(breakPolicy?.paid_mode!=='paid'?[{text:'Non payée / repas',onPress:()=>act('pause')}]:[]),...(breakPolicy?.paid_mode!=='unpaid'?[{text:'Payée',onPress:()=>act('pause',true)}]:[])])} style={{padding:9}}>{txt(paused?tr('resume'):tr('break'),{color:Z.muted,fontSize:11})}</Pressable>:txt('Un geste pour commencer. Un autre pour terminer.',{fontSize:10,color:Z.muted,marginTop:9})}</View>
 {myVisit?<View style={{padding:compact?9:14,borderWidth:1,borderColor:Z.line,borderRadius:12,gap:compact?3:6}}>
   {txt(myVisit.ongoing?'Intervention prévue à cette heure':'Prochaine intervention',{color:Z.sage,fontSize:11,fontWeight:'700'})}
   {txt(myVisit.client+' · '+myVisit.title,{fontSize:compact?13:15,fontWeight:'600'})}
   {txt(myVisit.address,{fontSize:11,color:Z.muted})}
   <View style={{flexDirection:'row',gap:14}}>
    <Pressable accessibilityRole="button" onPress={openWorkNavigation}>{txt('Itinéraire ↗',{color:Z.sage,fontWeight:'700',fontSize:12})}</Pressable>
    <Pressable accessibilityRole="button" onPress={()=>setVisitExpanded(v=>!v)}>{txt(visitExpanded?'Masquer les détails':'Détails',{color:Z.muted,fontSize:12})}</Pressable>
   </View>
   {visitExpanded?<>
    {myVisit.instructions?txt(myVisit.instructions,{fontSize:11}):null}
    {myVisit.contact?txt('Contact : '+myVisit.contact+(myVisit.phone?' · '+myVisit.phone:''),{fontSize:11}):null}
   </>:null}
  </View>:null}
 {!myVisit&&navDestination?.kind==='fixed'?<View style={{padding:compact?9:14,borderWidth:1,borderColor:Z.line,borderRadius:12,gap:5}}>
  {txt('Votre lieu habituel',{fontSize:12,fontWeight:'600',color:Z.sage})}
  {txt(navDestination.title,{fontWeight:'700'})}{txt(navDestination.address,{fontSize:11,color:Z.muted})}
  <Pressable accessibilityRole="button" onPress={openWorkNavigation}>{txt('Itinéraire ↗',{color:Z.sage,fontWeight:'700'})}</Pressable>
 </View>:null}
 {navDestination&&activeNav?<Pressable accessibilityRole="button" onPress={()=>setNavChooser(true)}>
  {txt('Changer d’application de navigation',{fontSize:11,color:Z.sage})}
 </Pressable>:null}
 {navDestination&&navChooser?<View style={{padding:12,gap:7,borderColor:Z.line,borderWidth:1,borderRadius:12}}>
  {txt('Choisir la navigation vers :',{fontWeight:'700'})}{txt(navDestination.address,{fontSize:11})}
  {txt('L’application choisie ne recevra que l’adresse. Aucun GPS PUNCH ni pointage.',{fontSize:11,color:Z.muted})}
  {navOptions.map(choice=><View key={choice.id} style={{paddingVertical:4,borderBottomWidth:1,borderColor:Z.line,gap:4}}>
   {txt(choice.label,{fontWeight:'600'})}
   <View style={{flexDirection:'row',gap:12,flexWrap:'wrap'}}>
    <Pressable accessibilityRole="button" onPress={()=>{void navigateToWork(choice.id,false)}}>
     {txt('Juste cette fois ↗',{color:Z.sage,fontSize:12})}
    </Pressable>
    <Pressable accessibilityRole="button" onPress={()=>{void navigateToWork(choice.id,true)}}>
     {txt('Toujours utiliser',{color:Z.sage,fontSize:12})}
    </Pressable>
   </View>
  </View>)}
  <Pressable accessibilityRole="button" onPress={()=>setNavChooser(false)}>{txt('Annuler',{color:Z.muted})}</Pressable>
 </View>:null}
 <PersonalMissionCard companyId={account.companyId} workerId={missionWorker?.key===visitContext.current?missionWorker.id:null} navProvider={navPref}/>
 {visitUnavailable?txt('Adresses d’intervention : consultation en ligne indisponible ou incomplète.',{fontSize:10,color:Z.muted}):null}
 <View style={{flexDirection:'row',gap:35,padding:3}}><View>{txt(tr('thisWeek').toUpperCase(),{fontSize:10,letterSpacing:1,color:Z.muted})}{txt(hm(weekly),{fontSize:27,fontWeight:'300',marginTop:10})}</View><View>{txt(tr('status').toUpperCase(),{fontSize:10,letterSpacing:1,color:Z.muted})}{txt(journalBlocked?'Journal à vérifier':pending?pending+' en attente':conflicts?conflicts+' conflit(s)':punch.readSource==='cache'?'Copie locale':punch.readSource==='server'?'Relevé serveur':'Relevé non vérifié',{fontSize:15,marginTop:15,color:Z.sage})}</View></View><View style={{marginTop:'auto',borderTopColor:Z.line,borderTopWidth:1,paddingTop:16,paddingBottom:12}}>{txt(account.companyName,{fontSize:12,fontWeight:'500'})}{txt('Votre espace de travail',{fontSize:10,color:Z.muted,marginTop:4})}</View></View>:page==='hours'?<View style={{flex:1,gap:12}}>{txt(tr('myHours'),{fontSize:26,marginVertical:14})}<View style={styles.card}>{txt(tr('thisWeek').toUpperCase(),{color:Z.muted,fontSize:10})}{txt(hm(weekly),{fontSize:36,fontWeight:'300',marginTop:8})}
 {txt(hoursOrigin,{fontSize:11,color:Z.muted,marginTop:7})}
 {txt('Total indicatif · les heures restent sujettes à validation.',{fontSize:10,color:Z.muted,marginTop:4})}
 </View>{journalBlocked||pending||conflicts?<View style={[styles.card,{gap:7}]}>
 {txt(journalBlocked?'Journal local à vérifier':pending?pending+' pointage(s) à transmettre':'Conflits de synchronisation',
  {color:Z.sage,fontWeight:'700',fontSize:13})}
 {txt(journalBlocked?'Les pointages locaux sont bloqués; les heures serveur restent consultables. Contactez votre responsable.':
  (pending?pending+' en attente de transmission. ':'')+(conflicts?conflicts+' conflit(s) à vérifier. ':'')+
  'Ces événements ne constituent pas une validation officielle des heures.',
  {fontSize:12,color:Z.muted})}
 {!journalBlocked?<>
  {pendingItems.map((item,i)=><View key={'pending-'+i} style={{paddingVertical:3}}>
   {txt('À transmettre · '+item.label+' · '+(item.occurredAt?
    new Date(item.occurredAt).toLocaleString('fr-CA',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):
    'Heure indisponible'),{fontSize:11,color:Z.muted})}
  </View>)}
  {pending>pendingItems.length?txt('Et '+(pending-pendingItems.length)+' autre(s) pointage(s) en attente.',{fontSize:11,color:Z.muted}):null}
  {conflictItems.map((item,i)=><View key={'conflict-'+i} style={{paddingVertical:3}}>
   {txt('Conflit à vérifier · '+item.label+' · '+(item.occurredAt?
    new Date(item.occurredAt).toLocaleString('fr-CA',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):
    'Heure indisponible'),{fontSize:11,color:Z.muted})}
  </View>)}
  {conflicts>conflictItems.length?txt('Et '+(conflicts-conflictItems.length)+' autre(s) conflit(s).',{fontSize:11,color:Z.muted}):null}
 </>:null}
 {pending>0&&!journalBlocked?<Pressable accessibilityRole="button" accessibilityState={{disabled:busy}}
  disabled={busy} onPress={()=>{void syncLocalPunches()}} style={{paddingVertical:9}}>
  {txt(busy?'Synchronisation…':'Synchroniser maintenant',{color:Z.sage,fontWeight:'700'})}
 </Pressable>:null}
 </View>:null}<ScrollView contentContainerStyle={{gap:9}}>
 {dailyHours.length?<View style={[styles.card,{gap:9}]}>
  {txt('Détail quotidien · temps indicatif',{fontWeight:'700',fontSize:13})}
  {dailyHours.map(row=><View key={row.dayStart} style={{paddingVertical:4,gap:3}}>
   <View style={{flexDirection:'row',justifyContent:'space-between'}}>
    {txt(new Date(row.dayStart).toLocaleDateString('fr-CA',{weekday:'short',month:'short',day:'numeric'}),{fontSize:12,color:Z.muted})}
    {txt(hm(row.netMs)+' net',{fontSize:12,fontWeight:'600',color:Z.sage})}
   </View>
   {txt('Brut '+hm(row.grossMs)+' · Pause non payée '+hm(row.unpaidMs),
    {fontSize:10,color:Z.muted})}
  </View>)}
  {txt('Inclut les pointages locaux en attente, le cas échéant. Non approuvé.',{fontSize:10,color:Z.muted})}
 </View>:null}
 {punch.sessions.map(s=><View key={s.id} style={styles.card}>{txt(new Date(s.started_at).toLocaleDateString('fr-CA'),{fontWeight:'500'})}{txt(new Date(s.started_at).toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'})+' → '+(s.ended_at?new Date(s.ended_at).toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'}):'En cours'),{fontSize:12,color:Z.muted,marginTop:5})}{txt(hm(hoursFor(punch.segments.filter(p=>p.session_id===s.id),now,0,now,punch.breaks||[])),{marginTop:9,color:Z.sage})}</View>)}</ScrollView>{menu('Corriger une pause','breakCorrections')}{menu('Correction et export de mes heures','approvals')}</View>:page==='schedule'?<View style={{flex:1}}>{txt(tr('myCalendar'),{fontSize:26,marginVertical:18})}<EssentialPlanningPanel account={account}/></View>:<ScrollView contentContainerStyle={{gap:6,paddingBottom:16}}>{txt(tr('mySpace'),{fontSize:26,marginVertical:18})}<View style={{paddingVertical:6,gap:4}}>
 <Pressable accessibilityRole="button" accessibilityLabel={tr('language')} accessibilityState={{expanded:languageMenu}} onPress={()=>setLanguageMenu(v=>!v)} style={[styles.menu,rtl&&{flexDirection:'row-reverse'}]}>
 {txt(tr('language')+' : '+(nativeEssentialLanguages.find(x=>x.code===language)?.name||'Français'),{textAlign:rtl?'right':'left'})}
 <Ionicons name="chevron-down" size={17} color={Z.muted}/>
 </Pressable>
 {languageMenu?<View style={{backgroundColor:t.surface,borderWidth:1,borderColor:Z.line,borderRadius:12}}>
 {nativeEssentialLanguages.map(option=><Pressable key={option.code} accessibilityRole="button" accessibilityState={{selected:language===option.code}} onPress={()=>{void chooseLanguage(option.code)}} style={{paddingHorizontal:12,paddingVertical:8}}>
 {txt(option.name,{fontSize:13,textAlign:option.dir==='rtl'?'right':'left',fontWeight:language===option.code?'700':'400'})}
 </Pressable>)}
 </View>:null}
 </View>{menu(tr('profile'),'profile')}{menu(tr('theme')+' · 10 designs','appearance')}{menu('Réglages · Navigation','navigation')}{menu(tr('myLeave'),'leave')}{canApproveTeam?menu('Approbations de mon équipe','supervision'):null}{menu('Journée entièrement oubliée','missingDays')}{menu(tr('breakCorrections'),'breakCorrections')}{menu(tr('hrDocuments'),'hr')}{menu(tr('communications'),'communications')}{menu(tr('support'),'support')}{menu(manager?'Préparation de paie et banques':'Mes banques d’heures','payroll')}{menu(manager?'Approbations et exports':'Mes corrections et exports','approvals')}{manager?menu('Inviter une personne','invite'):null}{menu('Localisation et notifications','geofence')}<Pressable style={styles.menu} onPress={()=>supabase.auth.signOut()}>{txt(tr('logout'),{color:Z.muted})}</Pressable></ScrollView>;
 return <SafeAreaView style={{flex:1,backgroundColor:Z.bg}}><ThemeDecoration theme={t}/><StatusBar barStyle={t.dark?"light-content":"dark-content"}/><View style={styles.header}><View style={styles.mark}>{txt('p',{fontFamily:'serif',fontStyle:'italic',fontSize:27,color:Z.sage})}</View><View>{txt('PUNCH',{fontWeight:'700',fontSize:16,letterSpacing:1})}{txt('Essentiel',{fontSize:10,color:Z.muted,letterSpacing:1})}</View><Pressable onPress={()=>{setDetail('geofence')}} style={{marginLeft:'auto',padding:10}}><Ionicons name="notifications-outline" color={Z.sage} size={21}/></Pressable></View><View style={{flex:1,paddingHorizontal:24}}>{content}</View>{notice||pending||conflicts||journalBlocked?<Text style={{fontSize:10,color:Z.sage,textAlign:'center',padding:8}}>{notice||(
  journalBlocked?'Journal local à vérifier':
  (pending?pending+' en attente':'')+(pending&&conflicts?' · ':'')+(conflicts?conflicts+' conflit(s)':'')
 )}</Text>:null}<View style={[styles.nav,rtl&&{flexDirection:'row-reverse'}]}>{([{id:'home',label:'Punch',icon:'radio-button-on-outline'},{id:'hours',label:'Heures',icon:'time-outline'},{id:'schedule',label:'Horaire',icon:'calendar-outline'},{id:'more',label:'Plus',icon:'menu-outline'}] as const).map(t=><Pressable key={t.id} onPress={()=>{setPage(t.id);setDetail('')}} style={[styles.tab,page===t.id&&{backgroundColor:appearance.theme.surface}]}><Ionicons name={t.icon} size={21} color={page===t.id?Z.sage:Z.muted}/>{txt(tr(t.id==='home'?'punch':t.id==='hours'?'hours':t.id==='schedule'?'schedule':'more'),{fontSize:10,color:page===t.id?Z.sage:Z.muted,textAlign:rtl?'right':'left',writingDirection:rtl?'rtl':'ltr'})}</Pressable>)}</View></SafeAreaView>;
}
const makeStyles=(Z:{bg:string;text:string;muted:string;line:string;sage:string},surface:string,compact:boolean)=>StyleSheet.create({header:{height:80,flexDirection:'row',alignItems:'center',paddingHorizontal:24,gap:10},mark:{width:36,height:40,borderRadius:12,backgroundColor:surface,alignItems:'center',justifyContent:'center'},clock:{padding:compact?10:22,borderWidth:1,borderColor:Z.line,borderRadius:24,backgroundColor:surface,alignItems:'center'},punch:{marginTop:compact?8:20,width:compact?120:160,height:compact?120:160,backgroundColor:Z.sage,borderRadius:80,padding:20,flexDirection:'column',justifyContent:'center',gap:10,alignItems:'center'},card:{padding:17,borderRadius:16,backgroundColor:surface,borderWidth:1,borderColor:Z.line},menu:{padding:16,borderRadius:13,borderWidth:1,borderColor:Z.line,backgroundColor:surface,flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginVertical:3},nav:{borderTopWidth:1,borderTopColor:Z.line,flexDirection:'row',padding:8,gap:4},tab:{flex:1,padding:10,borderRadius:13,alignItems:'center',gap:5}});
