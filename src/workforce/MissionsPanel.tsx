import React,{useEffect,useRef,useState} from 'react';
import {Alert,AppState,Linking,Pressable,Share,Text,TextInput,View} from 'react-native';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {reserveMissionCompletionRequest,acknowledgeMissionCompletionRequest} from '../../web/live/mission-completion-request.js';
import {missionOfflineEligible,queueOfflineMissionCompletion,listOfflineMissionCompletions,syncOfflineMissionCompletions} from '../../web/live/mission-offline-queue.js';
import * as Network from 'expo-network';
import * as DocumentPicker from 'expo-document-picker';
import {supabase} from '../lib/supabase';
import {missionAddress,missionArgs,missionDate,missionProgress,missionWarningEligible,missionNavigationOptions,personalMissionTour,publishedSwapTargets,publishedSwapArgs} from '../../web/live/missions.js';
import {missionDayReview,missionDayReviewCsv,MISSION_STATES} from '../../web/live/mission-day-review.js';
import {MISSION_ISSUE_REASONS,missionIssueArgs,missionIssueLabel} from '../../web/live/mission-issues.js';
import {missionChecklistItems,missionChecklistConfirmed} from '../../web/live/mission-checklist.js';
import {ISSUE_DECISIONS,missionIssueDecisionArgs,issueDecisionLabel,resolvedMissionNotice} from '../../web/live/mission-issue-decision.js';
import {missionPostponeArgs} from '../../web/live/mission-postpone.js';
import {missionCancelArgs} from '../../web/live/mission-cancel.js';
import {missionReassignArgs} from '../../web/live/mission-reassign.js';
import {missionRescheduleArgs} from '../../web/live/mission-reschedule.js';
import {nextMissionDay,validateUpcomingMissionDay} from '../../web/live/mission-upcoming.js';
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
 const [enabled,setEnabled]=useState(false),[commentRequired,setCommentRequired]=useState(false),[photoRequired,setPhotoRequired]=useState(false),[photoOptional,setPhotoOptional]=useState(false),[checklistRequired,setChecklistRequired]=useState(false),[checklistDraft,setChecklistDraft]=useState(''),[checklistSavedItems,setChecklistSavedItems]=useState<string[]>([]),[missions,setMissions]=useState<Row[]>([]),
  [sites,setSites]=useState<Row[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [truncated,setTruncated]=useState(false);
 const [reviewWorker,setReviewWorker]=useState(''),[reviewStatus,setReviewStatus]=useState(''),[reviewClient,setReviewClient]=useState('');
 const [day,setDay]=useState(missionDate()),[worker,setWorker]=useState(''),[site,setSite]=useState(''),
  [order,setOrder]=useState('1'),[missionTitle,setMissionTitle]=useState(''),
  [instructions,setInstructions]=useState(''),[editing,setEditing]=useState<Row|null>(null),[swapSource,setSwapSource]=useState<Row|null>(null);
 const [cancelTarget,setCancelTarget]=useState<Row|null>(null),[cancelReason,setCancelReason]=useState('');
 const cancelRequests=useRef<Map<string,string>>(new Map());
 const [decisionTarget,setDecisionTarget]=useState<Row|null>(null),[decisionAction,setDecisionAction]=useState('resume'),[decisionReason,setDecisionReason]=useState('');
 const decisionRequests=useRef<Map<string,string>>(new Map());
 const [postponeTarget,setPostponeTarget]=useState<Row|null>(null),[postponeDay,setPostponeDay]=useState(missionDate()),[postponeOrder,setPostponeOrder]=useState('1'),[postponeReason,setPostponeReason]=useState('');
 const postponeRequests=useRef<Map<string,string>>(new Map());
 const [reassignTarget,setReassignTarget]=useState<Row|null>(null),[reassignWorker,setReassignWorker]=useState(''),[reassignOrder,setReassignOrder]=useState('1'),[reassignReason,setReassignReason]=useState('');
 const reassignRequests=useRef<Map<string,string>>(new Map());
 const [rescheduleTarget,setRescheduleTarget]=useState<Row|null>(null),[rescheduleDay,setRescheduleDay]=useState(missionDate()),
  [rescheduleSite,setRescheduleSite]=useState(''),[rescheduleOrder,setRescheduleOrder]=useState('1'),[rescheduleReason,setRescheduleReason]=useState('');
 const rescheduleRequests=useRef<Map<string,string>>(new Map());
 const counter=useRef(0);
 async function load(date=day){
  const current=++counter.current;
  try{
   const conf=await rpc('essential_missions_configuration',{p_company:companyId,p_enabled:null});
   if(current!==counter.current)return;
   setEnabled(!!conf.enabled);setCommentRequired(!!conf.comment_required);setPhotoRequired(!!conf.photo_required);setPhotoOptional(!!conf.photo_optional);
   setChecklistRequired(!!conf.checklist_required);setChecklistSavedItems(Array.isArray(conf.checklist_items)?conf.checklist_items:[]);setChecklistDraft(Array.isArray(conf.checklist_items)?conf.checklist_items.join('\n'):'');
   if(conf.enabled){
    const [places,listing]=await Promise.all([
     rpc('list_essential_client_sites',{p_company:companyId,p_search:'',p_after:null,p_limit:100}),
     rpc('list_essential_missions',{p_company:companyId,p_day:date,p_worker:null,p_include_drafts:true})]);
    if(current!==counter.current)return;
    setSites((places.items||[]).filter((x:Row)=>x.active));
    setMissions(listing.items||[]);setTruncated(!!listing.truncated);
    if(listing.truncated)setMessage('La journée contient plus de 200 missions. Réduisez ou segmentez le lot.');
   }else{setSites([]);setMissions([]);setTruncated(false)}
  }catch(e:any){if(current===counter.current)setMessage(e.message||'Missions indisponibles')}
 }
 useEffect(()=>{setEnabled(false);setCommentRequired(false);setPhotoRequired(false);setPhotoOptional(false);setChecklistRequired(false);setChecklistDraft('');setChecklistSavedItems([]);setMissions([]);setSites([]);setEditing(null);
  setWorker('');setSite('');setSwapSource(null);setCancelTarget(null);setCancelReason('');cancelRequests.current.clear();setDecisionTarget(null);setDecisionAction('resume');setDecisionReason('');decisionRequests.current.clear();setPostponeTarget(null);setPostponeDay(missionDate());setPostponeOrder('1');setPostponeReason('');postponeRequests.current.clear();setReassignTarget(null);setReassignWorker('');setReassignOrder('1');setReassignReason('');reassignRequests.current.clear();setRescheduleTarget(null);setRescheduleDay(missionDate());setRescheduleSite('');setRescheduleOrder('1');setRescheduleReason('');rescheduleRequests.current.clear();setMessage('');setReviewWorker('');setReviewStatus('');setReviewClient('');setTruncated(false);
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
 const toggleProofPolicy=()=>{
  const required=!commentRequired;
  Alert.alert('Preuve de fin de mission',
   required?'Exiger un commentaire de 5 à 1000 caractères avant de terminer chaque mission ?':'Ne plus exiger de commentaire de fin ? Les anciennes preuves restent privées.',
   [{text:'Retour',style:'cancel'},{text:'Confirmer',onPress:()=>void work(async()=>{
    await rpc('set_essential_mission_proof_policy',{p_company:companyId,p_comment_required:required});
    await load();setMessage(required?'Commentaire obligatoire activé.':'Preuve obligatoire désactivée.');
   })}]);
 };
 const setPhotoMode=(mode:'none'|'optional'|'required')=>{
    const description=mode==='none'?'Désactiver la preuve photo future ?':mode==='required'?'Exiger une photo pour terminer chaque mission ?':'Permettre une photo privée facultative ?';
    Alert.alert('Preuve photo privée',description,
     [{text:'Annuler',style:'cancel'},{text:'Confirmer',onPress:()=>void work(async()=>{
       await rpc('set_essential_mission_photo_mode',{p_company:companyId,p_mode:mode});
       await load();setMessage('Politique de photo enregistrée.');
     })}]);
  };
  const viewPhoto=(photo:string)=>void work(async()=>{
   const result=await supabase.functions.invoke('mission-photo',{body:{action:'view',company:companyId,photo}});
   if(result.error||!result.data?.url)throw Error('Preuve privée inaccessible');
   const link=new URL(result.data.url);
   if(link.protocol!=='https:'||link.hostname!=='mlabstdxxwjdpfaxiwmg.supabase.co')throw Error('Destination privée non autorisée');
   await Linking.openURL(link.href);
  });
  const saveChecklistPolicy=(required:boolean)=>{
  let items:string[]=[];
  try{items=required?missionChecklistItems(checklistDraft):checklistSavedItems}
  catch(e:any){setMessage(e.message||'Checklist invalide');return;}
  Alert.alert('Checklist de fin de mission',
   required?'Exiger la confirmation de toutes les étapes avant de terminer ?':'Ne plus exiger de checklist pour cette compagnie ?',
   [{text:'Annuler',style:'cancel'},{text:'Confirmer',onPress:()=>void work(async()=>{
    await rpc('set_essential_mission_checklist_policy',{p_company:companyId,p_required:required,p_items:items});
    await load();setMessage(required?'Checklist obligatoire enregistrée.':'Checklist obligatoire désactivée.');
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
 const postponeIssue=()=>{
  const m=postponeTarget;if(!m||busy||truncated)return;
  const key=['postpone',m.id,postponeDay,postponeOrder,postponeReason.trim()].join(':');
  const request=postponeRequests.current.get(key)||Crypto.randomUUID();
  let args:Row;
  try{args=missionPostponeArgs(companyId,m,postponeDay,postponeOrder,postponeReason,request)}
  catch(e:any){setMessage(e.message||'Report invalide');return;}
  Alert.alert('Reporter la mission ?', 'Le salarié sera avisé de la nouvelle journée. Aucun pointage ou heure ne change.',
   [{text:'Retour',style:'cancel'},{text:'Reporter',onPress:()=>void work(async()=>{
     postponeRequests.current.set(key,request);
     await rpc('postpone_essential_mission_issue',args);
     postponeRequests.current.delete(key);
     setPostponeTarget(null);setPostponeReason('');
     await load(day);
     setMessage('Mission reportée au '+postponeDay+'. Avis interne au salarié si compte actif.');
   })}]);
 };
 const resolveIssue=()=>{
  const m=decisionTarget;if(!m||busy||truncated)return;
  const key=['decision',m.id,decisionAction,decisionReason.trim()].join(':');
  const request=decisionRequests.current.get(key)||Crypto.randomUUID();
  let args:Row;
  try{args=missionIssueDecisionArgs(companyId,m,decisionAction,decisionReason,request)}
  catch(e:any){setMessage(e.message||'Décision et motif requis');return;}
  Alert.alert('Confirmer la décision de mission ?',
   'L’employé sera avisé. Aucun horaire, heure ni pointage ne change.',
   [{text:'Retour',style:'cancel'},
    {text:decisionAction==='resume'?'Reprendre la mission':'Annuler après examen',
     onPress:()=>void work(async()=>{
      decisionRequests.current.set(key,request);
      await rpc('resolve_essential_mission_issue',args);
      decisionRequests.current.delete(key);
      setDecisionTarget(null);setDecisionReason('');
      await load(day);
      setMessage('Décision enregistrée. Avis interne au salarié si son compte est actif.');
     })}]);
 };
 const cancelPublished=()=>{
  const m=cancelTarget;if(!m||busy||truncated)return;
  const key='cancel:'+m.id,request=cancelRequests.current.get(key)||Crypto.randomUUID();
  let args:Row;
  try{args=missionCancelArgs(companyId,m,cancelReason,request)}
  catch(e:any){setMessage(e.message||'Motif obligatoire (5 à 200 caractères)');return;}
  Alert.alert('Annuler la mission publiée ?',
   'L’employé recevra un avis. Les heures, la session de pointage et les itinéraires restent indépendants.',
   [{text:'Retour',style:'cancel'},{text:'Annuler la mission',style:'destructive',
    onPress:()=>void work(async()=>{
     cancelRequests.current.set(key,request);
     await rpc('cancel_essential_published_mission',args);
     cancelRequests.current.delete(key);setCancelTarget(null);setCancelReason('');
     await load(day);setMessage('Mission annulée. Avis interne envoyé si le compte salarié est actif.');
    })}]);
 };
 const reassignPublished=()=>{
  const m=reassignTarget;if(!m||busy||truncated)return;
  const key='reassign:'+m.id,request=reassignRequests.current.get(key)||Crypto.randomUUID();
  if(!roster.some(w=>w.id===reassignWorker&&w.status==='active')){
   setMessage('Sélectionnez un salarié actif.');return;
  }
  let args:Row;
  try{args=missionReassignArgs(companyId,m,reassignWorker,reassignOrder,reassignReason,request)}
  catch(e:any){setMessage(e.message||'Réaffectation invalide');return;}
  Alert.alert('Réaffecter la mission publiée ?',
   'Vérifiez qualifications et disponibilités du nouveau salarié. Les deux employés seront avisés si leurs comptes sont actifs; aucun pointage ne change.',
   [{text:'Retour',style:'cancel'},{text:'Réaffecter',onPress:()=>void work(async()=>{
    reassignRequests.current.set(key,request);
    await rpc('reassign_essential_published_mission',args);
    reassignRequests.current.delete(key);
    setReassignTarget(null);setReassignWorker('');setReassignReason('');
    await load(day);setMessage('Mission réaffectée; les pointages et heures sont inchangés.');
   })}]);
 };
 const reschedulePublished=()=>{
  const m=rescheduleTarget;if(!m||busy||truncated)return;
  if(!sites.some(s=>s.id===rescheduleSite&&s.active)){setMessage('Sélectionnez une adresse client active.');return;}
  const key=['reschedule',m.id,rescheduleDay,rescheduleSite,rescheduleOrder,rescheduleReason.trim()].join(':');
  const request=rescheduleRequests.current.get(key)||Crypto.randomUUID();
  let args:Row;
  try{args=missionRescheduleArgs(companyId,m,rescheduleDay,rescheduleSite,rescheduleOrder,rescheduleReason,request)}
  catch(e:any){setMessage(e.message||'Programmation invalide');return;}
  Alert.alert('Reprogrammer la mission publiée ?',
   'Vérifiez les disponibilités et la nouvelle adresse. Un avis sera envoyé au salarié si son compte est actif. Les heures et pointages ne changent pas.',
   [{text:'Retour',style:'cancel'},{text:'Reprogrammer',onPress:()=>void work(async()=>{
    rescheduleRequests.current.set(key,request);
    await rpc('reschedule_essential_published_mission',args);
    rescheduleRequests.current.delete(key);
    setRescheduleTarget(null);setRescheduleReason('');setDay(rescheduleDay);
    await load(rescheduleDay);setMessage('Mission reprogrammée. Le salarié a été avisé si son compte est actif.');
   })}]);
 };
 const swapWith=(second:Row)=>{
  const first=swapSource;if(!first)return;
  let args:Row;
  try{args=publishedSwapArgs(companyId,first,second)}catch(e:any){setMessage(e.message);return;}
  Alert.alert('Changer l’ordre de la tournée ?',
   'Échanger « '+first.title+' » et « '+second.title+' » pour le même salarié. La mission terminée et les pointages restent inchangés.',
   [{text:'Annuler',style:'cancel'},
    {text:'Échanger',onPress:()=>void work(async()=>{
     await rpc('swap_essential_published_missions',args);
     setSwapSource(null);await load(day);
     setMessage('Ordre publié mis à jour. L’employé recevra un avis interne si son compte est actif.');
    })}]);
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
  {label('Preuve de fin : '+(commentRequired?'commentaire obligatoire de 5 à 1000 caractères':'aucune preuve obligatoire'))}
  {button(commentRequired?'Ne plus exiger de commentaire':'Exiger un commentaire de fin',toggleProofPolicy,busy)}
   {label('Photo privée de fin : '+(photoRequired?'obligatoire':photoOptional?'facultative':'désactivée')+' · JPEG/PNG/WebP · 5 Mio')}
   {!photoRequired?button('Exiger une photo',()=>setPhotoMode('required'),busy):null}
   {!photoOptional?button('Autoriser une photo facultative',()=>setPhotoMode('optional'),busy):null}
   {photoRequired||photoOptional?button('Désactiver la photo',()=>setPhotoMode('none'),busy):null}
  {label('Checklist de fin : '+(checklistRequired?'obligatoire':'non exigée'))}
  {label('Définissez jusqu’à huit étapes, une par ligne (3 à 120 caractères).')}
  <TextInput accessibilityLabel="Étapes de checklist de fin" multiline maxLength={1000}
   value={checklistDraft} onChangeText={setChecklistDraft} style={{borderWidth:1,borderColor:'#CADAC8',borderRadius:9,padding:10,minHeight:95,color:'#243B2A'}}/>
  {button(checklistRequired?'Enregistrer les étapes obligatoires':'Exiger cette checklist',()=>saveChecklistPolicy(true),busy)}
  {checklistRequired?button('Ne plus exiger la checklist',()=>saveChecklistPolicy(false),busy):null}
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
   <View style={{gap:8,padding:11,backgroundColor:'#F4F7F2',borderRadius:10}}>
    {title('Suivi des missions de la journée')}
    {label('À faire ne signifie pas absent ni en retard. Aucune déduction GPS, kilométrique ou salariale.')}
    {(()=>{
     const report=missionDayReview(missions,{worker:reviewWorker,status:reviewStatus,client:reviewClient},truncated);
     return <>
      {label('À faire : '+report.counts.published+' · Terminées : '+report.counts.completed+
       ' · En cours : '+report.counts.in_progress+' · À traiter : '+report.counts.impossible+' · Reportées : '+report.counts.postponed+' · Brouillons : '+report.counts.draft+' · Annulées : '+report.counts.cancelled)}
      {label('Filtrer par employé')}
      {options([{id:'',name:'Tous les employés'},...roster.filter(w=>w.status==='active')],reviewWorker,setReviewWorker,w=>w.id,w=>w.name)}
      {label('Filtrer par état')}
      {options(MISSION_STATES.map(([id,name])=>({id,name})),reviewStatus,setReviewStatus,w=>w.id,w=>w.name)}
      {input('Rechercher un client',reviewClient,setReviewClient)}
      {label(report.shown+' mission(s) affichée(s) sur '+report.scopedTotal)}
      {report.visible.map(m=><View key={m.id} style={{padding:8,borderBottomWidth:1,borderColor:'#DCE8D6',gap:2}}>
       {label(m.sort_order+' · '+[m.first_name,m.last_name].filter(Boolean).join(' ')+' · '+m.client_name)}
       {label(m.title+' · '+m.site_name+' · '+(MISSION_STATES.find(z=>z[0]===m.status)?.[1]||m.status)+(m.status==='impossible'?' · '+missionIssueLabel(m.issue_reason):''))}
      </View>)}
      {report.truncated?label('Liste tronquée à 200 missions : export CSV refusé.'):button('Partager la liste affichée (CSV)',()=>{
       try{void Share.share({message:missionDayReviewCsv(report,day)}).catch(err=>setMessage(err.message));}
       catch(err:any){setMessage(err.message)}
      },busy)}
     </>;
    })()}
   </View>
   {missions.map(m=><View key={m.id} style={{borderBottomWidth:1,borderColor:'#EFF2ED',paddingVertical:6,gap:3}}>
    {title(String(m.sort_order)+'. '+m.title)}
    {label([m.first_name,m.last_name].filter(Boolean).join(' ')+' · '+m.client_name+' · '+m.site_name+' · '+m.status)}
    {m.status==='impossible'?<>{label('Motif : '+missionIssueLabel(m.issue_reason))}{m.issue_note?label('Précision privée du salarié : '+m.issue_note):null}</>:null}
    {m.issue_decision_at?label('Décision du responsable : '+issueDecisionLabel(m.issue_decision)+' · '+(m.issue_decision_reason||'')):null}
    {m.status==='completed'&&m.completion_comment?label('Preuve privée de fin : '+m.completion_comment):null}
    {m.status==='completed'&&Array.isArray(m.completion_checklist)&&m.completion_checklist.length?
     label('Checklist privée confirmée : '+m.completion_checklist.join(' · ')):null}
     {m.status==='completed'&&m.completion_photo_id?button('Voir la photo privée',()=>viewPhoto(m.completion_photo_id),busy):null}
    {m.status==='impossible'&&!truncated?button(decisionTarget?.id===m.id?'Fermer la décision':'Traiter le signalement',()=>{
     setDecisionTarget(v=>v?.id===m.id?null:m);setDecisionAction('resume');setDecisionReason('');
    },busy):null}
    {m.status==='impossible'&&!truncated?button(postponeTarget?.id===m.id?'Fermer le report':'Reporter à une autre journée',()=>{
     setPostponeTarget(v=>v?.id===m.id?null:m);setPostponeDay(missionDate());setPostponeOrder(String(m.sort_order));setPostponeReason('');
    },busy):null}
    {postponeTarget?.id===m.id?<View style={{gap:6,padding:10,backgroundColor:'#F4F7F2',borderRadius:9}}>
     {label('Choisissez une journée après la date initiale et un rang libre. Même salarié, même site client.')}
     {input('Nouvelle date AAAA-MM-JJ',postponeDay,setPostponeDay)}
     {input('Rang de tournée 1 à 999',postponeOrder,setPostponeOrder)}
     {input('Motif visible au salarié (5 à 200 caractères)',postponeReason,setPostponeReason)}
     {button('Confirmer le report',postponeIssue,busy)}
    </View>:null}
    {decisionTarget?.id===m.id?<View style={{gap:6,padding:10,backgroundColor:'#F4F7F2',borderRadius:9}}>
     {label('Décision explicite : reprendre ou annuler cette intervention. Aucun effet automatique sur le pointage ou les heures.')}
     {ISSUE_DECISIONS.map(([v,name])=><View key={v}>{button((decisionAction===v?'✓ ':'')+name,()=>setDecisionAction(v),busy)}</View>)}
     {input('Motif visible par le salarié (5 à 200 caractères)',decisionReason,setDecisionReason)}
     {button('Confirmer la décision',resolveIssue,busy)}
    </View>:null}
    {m.status==='draft'?button('Modifier le brouillon',()=>{
     setEditing(m);setWorker(m.worker_id);setSite(m.site_id);setDay(m.mission_day);
     setOrder(String(m.sort_order));setMissionTitle(m.title);setInstructions('');
     setMessage('Les anciennes instructions privées ne sont pas réaffichées.');
    },busy):null}
    {m.status==='published'&&!truncated?button(cancelTarget?.id===m.id?'Fermer le formulaire d’annulation':'Annuler cette mission',()=>{
     setCancelTarget(v=>v?.id===m.id?null:m);setCancelReason('');
    },busy):null}
    {cancelTarget?.id===m.id?<View style={{gap:6,padding:10,backgroundColor:'#F4F7F2',borderRadius:9}}>
     {input('Motif de l’annulation (5 à 200 caractères)',cancelReason,setCancelReason)}
     {button('Confirmer l’annulation',cancelPublished,busy)}
    </View>:null}
    {m.status==='published'&&!truncated?button(reassignTarget?.id===m.id?'Fermer la réaffectation':'Réaffecter à un autre salarié',()=>{
     setReassignTarget(v=>v?.id===m.id?null:m);setReassignWorker('');setReassignOrder(String(m.sort_order));setReassignReason('');
    },busy):null}
    {reassignTarget?.id===m.id?<View style={{gap:5,padding:10,backgroundColor:'#F4F7F2',borderRadius:9}}>
     {label('Sélectionnez un salarié actif. Vérifiez manuellement ses qualifications et disponibilités avant la validation.')}
     {options(roster.filter(w=>w.status==='active'&&w.id!==m.worker_id),reassignWorker,setReassignWorker,w=>w.id,w=>w.name||w.first_name)}
     {input('Rang dans sa tournée (1 à 999)',reassignOrder,setReassignOrder)}
     {input('Motif obligatoire (5 à 200 caractères)',reassignReason,setReassignReason)}
     {button('Confirmer la réaffectation',reassignPublished,busy)}
    </View>:null}
    {m.status==='published'&&!truncated?button(rescheduleTarget?.id===m.id?'Fermer la reprogrammation':'Reprogrammer jour, lieu ou rang',()=>{
     setRescheduleTarget(v=>v?.id===m.id?null:m);setRescheduleDay(m.mission_day);setRescheduleSite(m.site_id);
     setRescheduleOrder(String(m.sort_order));setRescheduleReason('');
    },busy):null}
    {rescheduleTarget?.id===m.id?<View style={{gap:5,padding:10,backgroundColor:'#F4F7F2',borderRadius:9}}>
     {label('Même salarié; vérifiez manuellement ses disponibilités. Aucune session de pointage ni heure modifiée.')}
     {input('Nouvelle date AAAA-MM-JJ',rescheduleDay,setRescheduleDay)}
     {label('Nouvelle adresse client active')}
     {options(sites,rescheduleSite,setRescheduleSite,s=>s.id,s=>s.client_name+' · '+s.name+' · '+s.city)}
     {input('Rang dans la journée (1 à 999)',rescheduleOrder,setRescheduleOrder)}
     {input('Motif obligatoire (5 à 200 caractères)',rescheduleReason,setRescheduleReason)}
     {button('Confirmer la nouvelle programmation',reschedulePublished,busy)}
    </View>:null}
    {m.status==='published'&&!truncated&&publishedSwapTargets(m,missions).length?
     button(swapSource?.id===m.id?'Annuler l’échange':'Modifier l’ordre de ce salarié',
      ()=>setSwapSource(previous=>previous?.id===m.id?null:m),busy):null}
    {swapSource?.id===m.id?<View style={{gap:6,padding:10,backgroundColor:'#F4F7F2',borderRadius:9}}>
     {label('Choisissez la deuxième mission publiée du même employé et du même jour :')}
     {publishedSwapTargets(m,missions).map((other:Row)=>
      <View key={other.id}>{button(other.sort_order+' · '+other.title,()=>swapWith(other),busy)}</View>)}
    </View>:null}
   </View>)}
  </>:null}
 </View>;
}
export function PersonalMissionCard({companyId,workerId,navProvider}:{companyId:string;workerId:string|null;navProvider:string|null}){
 const [items,setItems]=useState<Row[]>([]),[enabled,setEnabled]=useState(false),[commentRequired,setCommentRequired]=useState(false),[completionComment,setCompletionComment]=useState(''),
  [checklistRequired,setChecklistRequired]=useState(false),[checklistItems,setChecklistItems]=useState<string[]>([]),[checklistChecked,setChecklistChecked]=useState<number[]>([]),[photoRequired,setPhotoRequired]=useState(false),[photoOptional,setPhotoOptional]=useState(false),[photoAsset,setPhotoAsset]=useState<DocumentPicker.DocumentPickerAsset|null>(null),[busy,setBusy]=useState(false),
  [message,setMessage]=useState(''),[truncated,setTruncated]=useState(false),
  [queued,setQueued]=useState<{mission:string;version:number}[]>([]);
 const requests=useRef<Map<string,string>>(new Map()),current=useRef(0);
 const verifiedUserId=useRef<string|null>(null);
 const queueIdentity=()=>({user:verifiedUserId.current||'',company:companyId,worker:workerId||''});
 const readQueue=()=>listOfflineMissionCompletions({storage:AsyncStorage,identity:queueIdentity()});
  const stagedPhoto=useRef<{id:string;version:number;photoId:string}|null>(null);
 const hadEnabled=useRef(false),[connectionWarning,setConnectionWarning]=useState(false),[navOpen,setNavOpen]=useState(false),[tourOpen,setTourOpen]=useState(false),[tourRouteId,setTourRouteId]=useState<string|null>(null);
 const [issueOpen,setIssueOpen]=useState(false),[issueReason,setIssueReason]=useState(''),[issueNote,setIssueNote]=useState('');
 const [detailOpen,setDetailOpen]=useState(false),[detailBusy,setDetailBusy]=useState(false),
  [detailInstructions,setDetailInstructions]=useState(''),[detailError,setDetailError]=useState('');
 const detailGeneration=useRef(0);
 const [upcomingOpen,setUpcomingOpen]=useState(false),[upcomingDay,setUpcomingDay]=useState(nextMissionDay()),
  [upcomingLoadedDay,setUpcomingLoadedDay]=useState<string|null>(null),[upcomingItems,setUpcomingItems]=useState<Row[]>([]),
  [upcomingTruncated,setUpcomingTruncated]=useState(false),[upcomingError,setUpcomingError]=useState(''),[upcomingBusy,setUpcomingBusy]=useState(false);
 const upcomingGeneration=useRef(0);
 async function refresh(){
  if(!workerId||!companyId)return;
  const gen=++current.current;
  try{
   const res=await rpc('list_essential_missions',{p_company:companyId,p_day:missionDate(),p_worker:workerId,p_include_drafts:false});
   if(gen!==current.current)return;
   setEnabled(!!res.enabled);setCommentRequired(!!res.comment_required);setPhotoRequired(!!res.photo_required);setPhotoOptional(!!res.photo_optional);setChecklistRequired(!!res.checklist_required);
   setChecklistItems(Array.isArray(res.checklist_items)?res.checklist_items:[]);hadEnabled.current=!!res.enabled;setConnectionWarning(false);setItems(res.items||[]);setTruncated(!!res.truncated);setMessage('');
   // Only an online Auth-verifiable identity can authorize staging a future offline action.
   const verified=await supabase.auth.getUser();
   if(gen!==current.current)return;
   verifiedUserId.current=verified.error?null:(verified.data.user?.id||null);
   if(verifiedUserId.current){
    try{setQueued(await readQueue());}catch(e:any){setMessage('File de missions à vérifier : '+(e.message||'stockage inaccessible'));setQueued([]);}
   }else setQueued([]);
  }catch(e:any){if(gen===current.current){const warning=missionWarningEligible(hadEnabled.current,true);setEnabled(false);setCommentRequired(false);setPhotoRequired(false);setPhotoOptional(false);setChecklistRequired(false);setChecklistItems([]);setItems([]);setConnectionWarning(warning);setMessage(warning?'Missions non disponibles en ligne. Aucune fin n’a été enregistrée.':'');}}
 }
 useEffect(()=>{current.current++;upcomingGeneration.current++;detailGeneration.current++;setDetailOpen(false);setDetailBusy(false);setDetailInstructions('');setDetailError('');setUpcomingOpen(false);setUpcomingDay(nextMissionDay());setUpcomingLoadedDay(null);setUpcomingItems([]);setUpcomingTruncated(false);setUpcomingError('');setUpcomingBusy(false);hadEnabled.current=false;verifiedUserId.current=null;setQueued([]);setConnectionWarning(false);setNavOpen(false;setTourOpen(false);setTourRouteId(null);setIssueOpen(false);setIssueReason('');setIssueNote('');setItems([]);setEnabled(false);setCommentRequired(false);setPhotoRequired(false);setPhotoOptional(false);setPhotoAsset(null);stagedPhoto.current=null;setCompletionComment('');setChecklistRequired(false);setChecklistItems([]);setChecklistChecked([]);setMessage('');requests.current.clear();
  if(workerId)void refresh();
  const subscription=AppState.addEventListener('change',state=>{if(state==='active'&&workerId)void refresh()});
  return()=>{current.current++;upcomingGeneration.current++;detailGeneration.current++;subscription.remove()};
 },[companyId,workerId]);
 const progress=missionProgress(items),next=progress.next;
 const missionConflict='ambiguous' in progress&&progress.ambiguous===true;
 const missionConflictRank='ambiguousRank' in progress?progress.ambiguousRank:null;
 const tour=personalMissionTour(items,workerId);
 useEffect(()=>{detailGeneration.current++;setDetailOpen(false);setDetailBusy(false);setDetailInstructions('');setDetailError('');setNavOpen(false);setIssueOpen(false);setIssueReason('');setIssueNote('');setCompletionComment('');setChecklistChecked([]);setPhotoAsset(null);stagedPhoto.current=null},[next?.id,next?.version]);
 const showDetails=()=>{
  if(!next||busy||truncated||missionConflict)return;
  if(detailOpen){detailGeneration.current++;setDetailOpen(false);setDetailBusy(false);setDetailInstructions('');setDetailError('');return;}
  const gen=++detailGeneration.current,id=next.id,version=next.version;
  setDetailOpen(true);setDetailBusy(true);setDetailInstructions('');setDetailError('');
  void (async()=>{
   try{
    const network=await Network.getNetworkStateAsync();
    if(network.isConnected===false||network.isInternetReachable===false)throw Error('Connexion requise pour ouvrir les instructions privées.');
    if(gen!==detailGeneration.current)return;
    const data=await rpc('get_essential_published_mission_details',{p_company:companyId,p_id:id,p_version:version});
    if(gen!==detailGeneration.current)return;
    if(data.id!==id||data.version!==version)throw Error('Mission modifiée : rechargez les détails.');
    setDetailInstructions(String(data.instructions||''));
   }catch(e:any){if(gen===detailGeneration.current){setDetailInstructions('');setDetailError(e.message||'Instructions privées indisponibles.');}}
   finally{if(gen===detailGeneration.current)setDetailBusy(false)}
  })();
 };
 const reportIssue=()=>{
  if(!next||busy||truncated||missionConflict)return;
  if(!MISSION_ISSUE_REASONS.some(([key])=>key===issueReason)){setMessage('Choisissez un motif de signalement.');return;}
  const id=next.id,requestKey='issue:'+id,request=requests.current.get(requestKey)||Crypto.randomUUID();
  let args:Row;
  try{args=missionIssueArgs(companyId,next,issueReason,issueNote,request)}
  catch(e:any){setMessage(e.message||'Signalement invalide');return;}
  Alert.alert('Signaler cette mission impossible ?',
   'Le responsable recevra un avis interne. Aucun pointage, absence ni retard ne sera déduit.',
   [{text:'Annuler',style:'cancel'},{text:'Signaler',onPress:()=>{void (async()=>{
    requests.current.set(requestKey,request);setBusy(true);setMessage('');
    try{
     const network=await Network.getNetworkStateAsync();
     if(network.isConnected===false||network.isInternetReachable===false)throw Error('Connexion requise.');
     await rpc('report_essential_mission_issue',args);
     requests.current.delete(requestKey);setIssueOpen(false);await refresh();
     setMessage('Mission impossible signalée; votre pointage reste inchangé.');
    }catch{setMessage('Signalement non confirmé : reconnectez-vous et réessayez (même demande).');}
    finally{setBusy(false)}
   })()}}]);
 };
 const startMission=()=>{
  if(!next||next.status!=='published'||busy||truncated||missionConflict)return;
  const id=next.id,key='start:'+id,request=requests.current.get(key)||Crypto.randomUUID();
  Alert.alert('Commencer cette mission ?',
   'Démarrer la mission ne démarre pas votre pointage, vos heures ou un suivi GPS.',
   [{text:'Annuler',style:'cancel'},{text:'Commencer',onPress:()=>{void (async()=>{
    requests.current.set(key,request);setBusy(true);setMessage('');
    try{
     const network=await Network.getNetworkStateAsync();
     if(network.isConnected===false||network.isInternetReachable===false)throw Error('Connexion requise.');
     await rpc('start_essential_mission',{p_company:companyId,p_mission:id,p_version:next.version,p_request:request});
     requests.current.delete(key);await refresh();
     setMessage('Mission en cours. Le pointage reste indépendant.');
    }catch{setMessage('Début non confirmé : reconnectez-vous et réessayez la même demande.');}
    finally{setBusy(false)}
   })()}}]);
 };
 const pickPhoto=()=>{void (async()=>{
   try{
    const picked=await DocumentPicker.getDocumentAsync({type:['image/jpeg','image/png','image/webp'],copyToCacheDirectory:true,multiple:false});
    if(picked.canceled||!picked.assets?.length)return;
    const file=picked.assets[0];
    if(!file.size||file.size<16||file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.mimeType||''))
     throw Error('Image invalide : JPEG, PNG ou WebP, 5 Mio maximum.');
    setPhotoAsset(file);stagedPhoto.current=null;setMessage('');
   }catch(e:any){setMessage(e.message||'Choix de photo impossible');}
  })()};
  const complete=()=>{
  if(!next||busy||truncated||missionConflict)return;
  const proof=commentRequired?completionComment.trim():null;
  if(commentRequired&&(!proof||proof.length<5||proof.length>1000)){
   setMessage('Commentaire de fin obligatoire (5 à 1000 caractères).');return;
  }
  if(checklistRequired&&!missionChecklistConfirmed(checklistItems,checklistChecked)){
   setMessage('Cochez toutes les étapes de la checklist avant de terminer.');return;
  }
  if(photoRequired&&!photoAsset&&stagedPhoto.current?.id!==next.id){setMessage('Choisissez une photo de fin de mission.');return;}
   Alert.alert('Terminer la mission ?', 'Cette action ne termine pas votre journée ni votre pointage.',
   [{text:'Annuler',style:'cancel'},{text:'Terminer',onPress:()=>{void (async()=>{
     setBusy(true);setMessage('');
     const id=next.id;
     try{
      const network=await Network.getNetworkStateAsync();
      const offline=network.isConnected===false||network.isInternetReachable===false;
      if(offline){
       if(!missionOfflineEligible({verified:!!verifiedUserId.current&&hadEnabled.current,
         enabled,truncated,ambiguous:missionConflict,commentRequired,checklistRequired,
         photoRequired,photoSelected:!!photoAsset||!!stagedPhoto.current,mission:next}))
        throw Error('Preuves ou session en ligne requises : aucune fin mise en attente.');
       await queueOfflineMissionCompletion({storage:AsyncStorage,
        identity:{...queueIdentity(),mission:id,version:next.version},
        day:next.mission_day||missionDate(),uuid:()=>Crypto.randomUUID()});
       setQueued(await readQueue());
       setMessage('En attente de synchronisation — le serveur n’a pas confirmé la fin.');
       return;
      }
      if(queued.some(q=>q.mission===id&&q.version===next.version))
       throw Error('Fin déjà en attente : utilisez le bouton Vérifier et synchroniser.');
      const verified=await supabase.auth.getUser();
      if(verified.error||!verified.data.user?.id)throw Error('Session à revalider en ligne.');
      const durable=await reserveMissionCompletionRequest({
       storage:AsyncStorage,
       identity:{company:companyId,user:verified.data.user.id,worker:workerId,mission:id,version:next.version},
       uuid:()=>Crypto.randomUUID()
      });
      const request=durable.id;
      const previousPhoto=stagedPhoto.current;
       const photoAllowed=photoRequired||photoOptional;
       let photo=photoAllowed&&previousPhoto?.id===id&&previousPhoto?.version===next.version?(previousPhoto?.photoId??null):null;
       if(photoAllowed&&(photoRequired||!!photoAsset)&&!photo){
        if(!photoAsset)throw Error('Photo manquante');
        const body=new FormData();
        body.append('company',companyId);body.append('mission',id);body.append('version',String(next.version));
        body.append('file',{uri:photoAsset.uri,name:photoAsset.name||'preuve.jpg',type:photoAsset.mimeType||'image/jpeg'} as any);
        const uploaded=await supabase.functions.invoke('mission-photo',{body});
        if(uploaded.error||!uploaded.data?.photo_id)throw Error('Téléversement non confirmé');
        photo=uploaded.data.photo_id;stagedPhoto.current={id,version:next.version,photoId:photo!};
       }
       await rpc(photo?'complete_essential_mission_v4':checklistRequired?'complete_essential_mission_v3':commentRequired?'complete_essential_mission_v2':'complete_essential_mission',{
       p_company:companyId,p_id:id,p_version:next.version,p_request:request,
       ...(commentRequired||checklistRequired||photo?{p_comment:proof}:{}),...(checklistRequired||photo?{p_checklist:checklistRequired?checklistItems:null}:{}),...(photo?{p_photo:photo}:{})});
      await acknowledgeMissionCompletionRequest(AsyncStorage,durable);
      requests.current.delete(id);setCompletionComment('');setChecklistChecked([]);setPhotoAsset(null);stagedPhoto.current=null;await refresh();setMessage('Mission terminée. Le pointage reste inchangé.');
     }catch{setMessage('Fin non confirmée : reconnectez-vous et réessayez (même demande).');}
     finally{setBusy(false)}
    })()}}]);
 };
 const syncQueued=()=>{void (async()=>{
  if(!workerId||!companyId||busy)return;
  setBusy(true);setMessage('');
  const company=companyId,worker=workerId,user=verifiedUserId.current,gen=current.current;
  const ensureContext=()=>{
   if(gen!==current.current||companyId!==company||workerId!==worker)
    throw Error('Espace de travail modifié : aucune fin envoyée.');
  };
  try{
   const network=await Network.getNetworkStateAsync();
   if(network.isConnected===false||network.isInternetReachable===false)
    throw Error('Connexion requise pour vérifier les fins en attente.');
   if(!user)throw Error('Identité en ligne non vérifiée.');
   const result=await syncOfflineMissionCompletions({
    storage:AsyncStorage,identity:{company,worker,user},
    verifyUser:async()=>{
     ensureContext();
     const verified=await supabase.auth.getUser();
     ensureContext();
     if(verified.error)throw verified.error;
     return verified.data.user?.id;
    },
    fetchDay:async day=>{
     ensureContext();
     const data=await rpc('list_essential_missions',
      {p_company:company,p_day:day,p_worker:worker,p_include_drafts:false});
     ensureContext();
     return data;
    },
    nextMissionId:rows=>{
     const progress=missionProgress(rows);
     return progress.ambiguous?null:progress.next?.id;
    },
    send:async entry=>{
     ensureContext();
     const data=await rpc('complete_essential_mission',
      {p_company:company,p_id:entry.mission,p_version:entry.version,p_request:entry.request});
     ensureContext();
     return data;
    }
   });
   ensureContext();
   setQueued(await readQueue());
   await refresh();
   if(companyId!==company||workerId!==worker)return;
   setMessage(result.sent+' fin(s) confirmée(s). '+result.pending+' en attente.'+
    (result.conflicts.length?' Mission modifiée : vérification manuelle requise.':'')+
    (result.networkError?' '+result.networkError:'')+
    ' Aucun pointage modifié.');
  }catch(e:any){setMessage('Synchronisation non confirmée : '+(e.message||'connexion inaccessible'));}
  finally{setBusy(false);}
 })()};
 const loadUpcoming=()=>{
  if(!workerId||!companyId||!enabled||upcomingBusy)return;
  setUpcomingItems([]);setUpcomingLoadedDay(null);setUpcomingTruncated(false);setUpcomingError('');setUpcomingBusy(true);
  const gen=++upcomingGeneration.current;
  void (async()=>{
   try{
    validateUpcomingMissionDay(upcomingDay,missionDate());
    const network=await Network.getNetworkStateAsync();
    if(network.isConnected===false||network.isInternetReachable===false)throw Error('Connexion requise pour consulter vos interventions à venir.');
    if(gen!==upcomingGeneration.current)return;
    const result=await rpc('list_essential_missions',{p_company:companyId,p_day:upcomingDay,p_worker:workerId,p_include_drafts:false});
    if(gen!==upcomingGeneration.current)return;
    if(!result.enabled)throw Error('Le module Missions est désactivé pour cette compagnie.');
    setUpcomingItems(result.items||[]);setUpcomingTruncated(!!result.truncated);setUpcomingLoadedDay(upcomingDay);
   }catch(e:any){if(gen===upcomingGeneration.current){setUpcomingItems([]);setUpcomingLoadedDay(null);setUpcomingError(e.message||'Interventions futures indisponibles.');}}
   finally{if(gen===upcomingGeneration.current)setUpcomingBusy(false)}
  })();
 };
 const futureTour=upcomingLoadedDay?personalMissionTour(upcomingItems,workerId,25,upcomingLoadedDay):null;
 if(!workerId)return null;
 if(!enabled&&queued.length)return <View style={{padding:12,borderWidth:1,borderColor:'#DCE8D6',borderRadius:12,gap:8}}>
  {title('Fins de mission en attente')}
  {label(queued.length+' demande(s) enregistrée(s) sur cet appareil. Aucune fin serveur confirmée.')}
  {button('Vérifier et synchroniser',syncQueued,busy)}
  {!!message?label(message):null}
 </View>;
 if(connectionWarning&&!enabled)return <View accessibilityRole="alert" style={{padding:12,borderRadius:11,backgroundColor:'#F7FAF5',borderWidth:1,borderColor:'#DCE8D6',gap:6}}>
  {title('Missions momentanément indisponibles')}
  {label('Connexion requise pour actualiser vos missions. Aucune fin ni sortie de pointage n’a été enregistrée.')}
 </View>;
 if(!enabled)return null;
 const address=missionAddress(next);
 const routes=missionNavigationOptions(next,Platform.OS,navProvider);
 return <View style={{padding:12,borderWidth:1,borderColor:'#DCE8D6',borderRadius:12,gap:7,backgroundColor:'#F7FAF5'}}>
  {queued.length?<View style={{padding:9,borderRadius:8,backgroundColor:'#FBEEDB',gap:5}}>
   {label(queued.length+' fin(s) de mission en attente. Pas encore confirmées par le serveur.')}
   {button('Vérifier et synchroniser',syncQueued,busy)}
  </View>:null}
  {connectionWarning?label('Missions affichées depuis la dernière consultation en ligne : données à actualiser.'):null}
  {items.filter((m:Row)=>m.issue_decision_at).map((m:Row)=><View key={'decision-'+m.id} style={{padding:8,backgroundColor:'#E8F2E8',borderRadius:8}}>{label('Décision du responsable : '+resolvedMissionNotice(m))}</View>)}
  {title(!progress.total?'Aucune mission pour aujourd’hui':progress.allDone?'Toutes les missions sont terminées':missionConflict?'Ordre des missions à confirmer':!next&&progress.blocked?'Missions signalées au responsable':next?.status==='in_progress'?'Mission en cours · '+(progress.done+progress.blocked+1)+' de '+progress.total:'Prochaine mission · '+(progress.done+progress.blocked+1)+' de '+progress.total)}
  {!next&&progress.blocked&&!missionConflict?label('Aucune prochaine mission publiée. Les étapes signalées nécessitent un suivi; le pointage ne change pas.'):null}
  {missionConflict?<Text accessibilityRole="alert" style={{color:'#B04C37'}}>
   Plusieurs missions publiées portent le rang {String(missionConflictRank)}. Demandez au responsable de confirmer la prochaine étape. Aucun trajet n’est sélectionné ni aucune mission terminée automatiquement.
  </Text>:null}
  {next&&!truncated?<>{title(next.title+' · '+next.client_name)}{label(next.site_name+' · '+address)}
   {routes.preferred?button('Itinéraire avec '+routes.preferred.label,
    ()=>{const route=routes.preferred;if(route)void Linking.openURL(route.url).catch(e=>setMessage(e.message||'Application indisponible'))}):null}
   {routes.choices.length?button(routes.preferred?"Changer d’application d’itinéraire":"Choisir l’application d’itinéraire",()=>setNavOpen(v=>!v)):null}
   {navOpen?<View style={{gap:4}}>
    {label('Destination de cette mission seulement. Aucun trajet, GPS PUNCH ou pointage déclenché.')}
    {routes.choices.map(route=><View key={route.id}>{button(route.label+' · juste cette fois',
      ()=>{void Linking.openURL(route.url).catch(e=>setMessage(e.message||'Application indisponible'))})}</View>)}
   </View>:null}
   {button(detailOpen?'Masquer les détails':'Détails de la mission',showDetails,detailBusy)}
   {detailOpen?<View style={{padding:10,borderRadius:9,backgroundColor:'white',gap:5}}>
    {label('Instructions de cette mission — consultées sur demande')}
    {detailBusy?label('Chargement sécurisé...'):detailError?
     <Text accessibilityRole="alert" style={{color:'#B04C37'}}>{detailError}</Text>:
     <Text style={{color:'#243B2A'}}>{detailInstructions||'Aucune instruction supplémentaire publiée.'}</Text>}
    {label('Aucun pointage ni GPS déclenché.')}
   </View>:null}
   {next.status==='published'?button('Commencer cette mission',startMission,busy):label('En cours — mission démarrée volontairement, pointage inchangé.')}
   {checklistRequired?<View style={{gap:5,padding:10,borderRadius:9,backgroundColor:'white'}}>
    {label('Checklist obligatoire — confirmez toutes les étapes pour terminer.')}
    {checklistItems.map((item,i)=><View key={i}>{button((checklistChecked.includes(i)?'✓ ':'□ ')+item,()=>{
      setChecklistChecked(old=>old.includes(i)?old.filter(x=>x!==i):[...old,i]);
    },busy)}</View>)}
   </View>:null}
   {commentRequired?<View style={{gap:4,padding:10,borderRadius:9,backgroundColor:'white'}}>
    {label('Commentaire de fin obligatoire (5 à 1000 caractères). Visible seulement par les responsables de cette compagnie.')}
    <TextInput accessibilityLabel="Commentaire privé de fin de mission" value={completionComment} onChangeText={setCompletionComment}
     multiline maxLength={1000} style={{borderWidth:1,borderColor:'#CADAC8',borderRadius:9,padding:10,minHeight:85,color:'#243B2A'}}/>
   </View>:null}
   {(photoRequired||photoOptional)?<View style={{gap:4,padding:10,borderRadius:9,backgroundColor:'white'}}>
     {label('Photo privée '+(photoRequired?'obligatoire':'facultative')+' · JPEG, PNG ou WebP · 5 Mio maximum, visible seulement par le responsable.')}
     {button(photoAsset?'Changer la photo':'Choisir une photo',pickPhoto,busy)}
     {photoAsset?label('Prête : '+photoAsset.name):stagedPhoto.current?.id===next.id?label('Photo téléversée, fin à confirmer.'):null}
    </View>:null}
    {queued.some(q=>q.mission===next.id&&q.version===next.version)?
      label('Fin de cette mission en attente de synchronisation.'):
      button(photoRequired?'Terminer avec photo':checklistRequired?'Terminer avec checklist':commentRequired?'Terminer avec commentaire':'Terminer',complete,busy)}
   {button(issueOpen?'Fermer le signalement':'Signaler une mission impossible',()=>setIssueOpen(v=>!v),busy)}
   {issueOpen?<View style={{gap:6,padding:10,backgroundColor:'white',borderRadius:9}}>
    {label('Choisissez un motif. Aucun pointage, retard ou absence ne sera déduit.')}
    {MISSION_ISSUE_REASONS.map(([key,name])=><View key={key}>{button((issueReason===key?'✓ ':'')+name,()=>setIssueReason(key),busy)}</View>)}
    {label('Précision privée (facultative, 300 caractères maximum)')}
    <TextInput accessibilityLabel="Précision de mission impossible" value={issueNote} onChangeText={setIssueNote}
     multiline maxLength={300} style={{borderWidth:1,borderColor:'#CADAC8',borderRadius:9,padding:10,minHeight:65,color:'#243B2A'}}/>
    {button('Confirmer le signalement',reportIssue,busy)}
   </View>:null}
   {label('Terminer une mission ne pointe jamais la sortie.')}
  </>:null}
  {tour.total>0?button(tourOpen?'Masquer ma tournée du jour':'Voir mes interventions du jour ('+tour.total+')',()=>setTourOpen(v=>!v)):null}
  {tourOpen?<View style={{gap:7,paddingVertical:8}}>
   {label('Ordre publié, sans GPS PUNCH, temps de trajet estimé ni changement d’heures.')}
   {tour.ambiguous?<Text accessibilityRole="alert" style={{color:'#B04C37'}}>Deux missions ont le même rang; confirmer l’ordre avec le responsable.</Text>:null}
   {tour.rows.map((stop:Row)=><View key={stop.id} style={{padding:9,backgroundColor:'white',borderWidth:1,borderColor:'#DCE8D6',borderRadius:8,gap:5}}>
    {title(stop.title+' · '+stop.client_name)}
    {label(stop.site_name+' · '+(stop.status==='completed'?'Terminée':stop.status==='impossible'?'À traiter':stop.status==='in_progress'?'En cours':'À faire'))}
    {stop.status==='impossible'?label('Motif : '+missionIssueLabel(stop.issue_reason)):null}
    {label(missionAddress(stop))}
    {['published','in_progress'].includes(stop.status)&&missionNavigationOptions(stop,Platform.OS,navProvider).choices.length?
     button(tourRouteId===stop.id?'Masquer les itinéraires':'Itinéraire vers cette étape',
      ()=>setTourRouteId(v=>v===stop.id?null:stop.id)):null}
    {tourRouteId===stop.id&&['published','in_progress'].includes(stop.status)?
     missionNavigationOptions(stop,Platform.OS,navProvider).choices.map(route=><View key={route.id}>
      {button(route.label+' · cette étape',()=>{void Linking.openURL(route.url).catch(e=>setMessage(e.message||'Application indisponible'))})}
     </View>):null}
   </View>)}
   {tour.hasMore?label('Seules les 25 premières missions sont affichées; contactez le responsable pour une tournée segmentée.'):null}
  </View>:null}
  <View style={{gap:6,padding:9,backgroundColor:'white',borderRadius:9}}>
   {button(upcomingOpen?'Masquer mes interventions à venir':'Consulter mes prochaines interventions',()=>{
    upcomingGeneration.current++;setUpcomingOpen(v=>!v);setUpcomingItems([]);setUpcomingLoadedDay(null);setUpcomingTruncated(false);setUpcomingError('');setUpcomingBusy(false);
   })}
   {upcomingOpen?<View style={{gap:6}}>
    {label('Consultez les 14 prochains jours, uniquement vos missions publiées pour la compagnie actuelle. Aucun pointage ni trajet automatique.')}
    {input('Date future AAAA-MM-JJ',upcomingDay,setUpcomingDay)}
    {button('Afficher cette journée',loadUpcoming,upcomingBusy)}
    {upcomingBusy?label('Chargement des interventions...'):null}
    {!!upcomingError?<Text accessibilityRole="alert" style={{color:'#B04C37'}}>{upcomingError}</Text>:null}
    {upcomingTruncated?label('Plus de 200 missions : tournée future incomplète. Contactez votre responsable.'):null}
    {futureTour&&!upcomingTruncated&&!upcomingBusy?<>
     {label('Interventions du '+upcomingLoadedDay+' · '+futureTour.total+' mission(s)'+(futureTour.hasMore?' (25 premières affichées)':''))}
     {futureTour.ambiguous?<Text accessibilityRole="alert" style={{color:'#B04C37'}}>Plusieurs missions portent le même rang. Confirmez l’ordre avec votre responsable.</Text>:null}
     {futureTour.rows.map((stop:Row)=><View key={stop.id} style={{gap:4,padding:8,borderRadius:8,backgroundColor:'#F7FAF5'}}>
      {title(stop.sort_order+'. '+stop.title)}
      {label(stop.client_name+' · '+stop.site_name+' · '+(stop.status==='published'?'À faire':stop.status==='completed'?'Terminée':'À traiter'))}
      {label(missionAddress(stop))}
      {stop.status==='published'?missionNavigationOptions(stop,Platform.OS,navProvider).choices.map(route=>
       <View key={route.id}>{button(route.label+' · cette intervention',()=>{
        void Linking.openURL(route.url).catch(err=>setUpcomingError(err.message||'Navigation indisponible'));
       })}</View>):null}
     </View>)}
    </>:null}
   </View>:null}
  </View>
  {!!message?<Text accessibilityLiveRegion="polite" style={{color:'#B04C37'}}>{message}</Text>:null}
  {truncated?label('Plus de 200 missions : demandez une tournée segmentée au responsable.'):null}
 </View>;
}
