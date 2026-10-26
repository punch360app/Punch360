import * as Crypto from 'expo-crypto';
import {File,Paths} from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import {buildPersonalCalendar} from '../../web/live/personal-calendar.js';
import {weeklyArgs,weeklyDaysLabel,weeklyPreviewLabel} from '../../web/live/weekly-availability.js';
import {PERIOD_CHOICES,WEEKEND_CHOICES,preferencePayload,contractPayload,periodLabel} from '../../web/live/schedule-preferences.js';
import {nextIsoMonday,reminderSelection,reminderResultLabel} from '../../web/live/availability-reminders.js';
import {ClientDirectoryPanel} from './ClientDirectoryPanel';
import {assignedSiteForShift,assignedSiteAddress,assignedSiteMapsUrl,assignedSiteSummary,shiftSiteAssignmentArgs} from '../../web/live/shift-client-sites.js';
import {buildMultiSiteOverview} from '../../web/live/multi-site-overview.js';
import {navigationStopChoices} from '../../web/live/navigation-choices.js';
import {plannedClientReport,plannedClientReportCsv} from '../../web/live/planned-client-report.js';
import {ABSENCE_REASONS,absenceForShift,absenceStatus,canReportShift,prepareAbsence} from '../../web/live/shift-absence.js';
import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,AppState,Platform,Pressable,Share,ScrollView,StyleSheet,Text,TextInput,View,Linking} from 'react-native';
import {supabase,PUNCH_SUPABASE_URL} from '../lib/supabase';
import type {WorkspaceAccount} from '../auth/AuthGate';
type Row=Record<string,any>;
export function EssentialPlanningPanel({account,initial='calendar'}:{account:WorkspaceAccount;initial?:'calendar'|'organization'}){
 const [tab,setTab]=useState<'calendar'|'organization'|'requests'|'availability'|'report'>(initial),[data,setData]=useState<Row>({templates:[],positions:[],locations:[],departments:[],roster:[],shifts:[],requests:[],absences:[],absenceUnavailable:false,scopes:[],availability:[],weeklyRules:[],weeklyPreview:[],weeklyUnavailable:false,workerPrefs:[],prefsUnavailable:false,assignedSites:[],assignedSitesUnavailable:false,loadedFrom:'',loadedTo:'',options:[],features:[],workers:[]}),[form,setForm]=useState<Row>({mode:'single',timezone:'America/Toronto',first:new Date().toISOString().slice(0,10),weeks:'2',days:'1,2,3,4,5',startTime:'07:00',endTime:'15:00',startTime2:'15:00',endTime2:'23:00',startTime3:'23:00',endTime3:'07:00',weeklyDays:'1,2,3,4,5',weeklyStart:'07:00',weeklyEnd:'15:00',weeklyFrom:new Date().toISOString().slice(0,10),weeklyUntil:'',weeklyAvailable:'true',weeklyWorker:'',weeklyLocation:'',prefWorker:'',prefDesired:'',prefPeriods:'',prefWeekend:'flexible',prefVolunteer:'false',prefLastMinute:'false',prefExtra:'',contractMin:'',contractMax:'',contractSeniority:'',prefLoadedWorker:'',prefVersion:0,reminderWeek:nextIsoMonday(new Date().toISOString().slice(0,10)),reminderDue:nextIsoMonday(new Date().toISOString().slice(0,10)),reminderDepartment:'',visitSearch:'',visitSite:'',reportFrom:new Date().toISOString().slice(0,10),reportTo:new Date(Date.now()+7*86400000).toISOString().slice(0,10),clientReportWorker:'',clientReportSite:'',clientReportDepartment:'',overviewDay:new Date().toISOString().slice(0,10),overviewPeriod:'day',overviewWorker:'',overviewSite:'',overviewDepartment:''}),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[showForm,setShowForm]=useState(false),[editing,setEditing]=useState<Row|null>(null),[report,setReport]=useState<Row|null>(null),[positionAlerts,setPositionAlerts]=useState<Row|null>(null),[calendarFeed,setCalendarFeed]=useState<Row|null>(null),[calendarLink,setCalendarLink]=useState('');
 const activeAccount=useRef('');activeAccount.current=account.companyId+':'+account.userId;const loadRevision=useRef(0);
 const prefsToForm=(row:Row|undefined,worker:string):Row=>({
  prefLoadedWorker:worker,prefWorker:worker,prefVersion:Number(row?.version||0),
  prefDesired:String(row?.desired_weekly_hours??''),
  prefPeriods:Array.isArray(row?.preferred_periods)?row.preferred_periods.join(','):'',
  prefWeekend:row?.weekend_preference||'flexible',prefVolunteer:String(row?.overtime_volunteer===true),
  prefLastMinute:String(row?.last_minute_volunteer===true),
  prefExtra:String(row?.desired_extra_weekly_hours??''),
  contractSeniority:row?.seniority_from||'',contractMin:String(row?.contracted_min_weekly_hours??''),
  contractMax:String(row?.contracted_max_weekly_hours??'')
 });
 const selectedTemplate=useRef<Row|null>(null);
 const absenceRequest=useRef<{shift:string;id:string}|null>(null);
 const weeklyRequest=useRef<{key:string;id:string}|null>(null);
 const prefRequest=useRef<{key:string;id:string}|null>(null);
 const [reminderResult,setReminderResult]=useState<Row|null>(null);
 const reminderKey=useRef<string|null>(null);
 const [absenceShift,setAbsenceShift]=useState<string|null>(null);
 const [clientReportFilters,setClientReportFilters]=useState<Row|null>(null);
 const [overviewView,setOverviewView]=useState<'employee'|'location'>('employee');
 const [visitShift,setVisitShift]=useState<string|null>(null),[visitChoices,setVisitChoices]=useState<Row[]>([]),[visitMore,setVisitMore]=useState(false);
 const batch=useRef<{key:string;id:string}|null>(null);
 const manager=['boss','admin'].includes(account.role),feature=(f:string)=>data.features.includes(f),canPlan=(dept:string|null)=>manager||(feature('supervisors')&&data.scopes.some((g:Row)=>g.active&&g.can_plan&&g.department_id===dept)),anyPlan=manager||(feature('supervisors')&&data.scopes.some((g:Row)=>g.active&&g.can_plan));
 async function rpc(name:string,args?:Row){const r=await supabase.rpc(name,args);if(r.error)throw r.error;return r.data;}
 async function rows(table:string){const r=await supabase.from(table).select('*').eq('company_id',account.companyId);if(r.error)throw r.error;return r.data||[];}
 async function load(){const key=account.companyId+':'+account.userId;if(activeAccount.current!==key)return;const revision=++loadRevision.current;
  const end=new Date();end.setDate(end.getDate()+90);const start=new Date();start.setDate(start.getDate()-7);
  const [ent,locations,departments,roster,scopes,requests,availability,shifts,own]=await Promise.all([rpc('essential_entitlements',{p_company:account.companyId}),rows('essential_locations'),rows('essential_departments'),rpc('essential_team_roster',{p_company:account.companyId}),rows('essential_supervisors'),rows('essential_shift_requests'),rows('essential_availability'),supabase.from('scheduled_shifts').select('*').eq('company_id',account.companyId).gt('ends_at',start.toISOString()).lt('starts_at',end.toISOString()).order('starts_at').limit(1000),supabase.from('company_workers').select('id').eq('company_id',account.companyId).eq('auth_user_id',account.userId).maybeSingle()]);
  if(shifts.error)throw shifts.error;if(own.error)throw own.error;const options=ent.features.includes('shift_swaps')?await rpc('essential_swap_options',{p_company:account.companyId}):[];
  const workers=manager?await rows('company_workers'):[],templates=await rows('essential_schedule_templates');let feed=null;try{if(own.data?.id)feed=await rpc('personal_calendar_feed_status',{p_company:account.companyId});}catch{/* optional personal feed not available */}const positions=manager&&ent.features.includes('minimum_coverage')?await rows('essential_positions'):[];
  let absences:Row[]=[],absenceUnavailable=false;
  if(ent.features.includes('advanced_schedules'))try{const reports=await rpc('list_essential_shift_absences',{p_company:account.companyId});absences=Array.isArray(reports)?reports:[];}catch{absenceUnavailable=true;}
  let weeklyRules:Row[]=[],weeklyPreview:Row[]=[],weeklyUnavailable=false;
  if(ent.features.includes('availability'))try{
   const from=new Date(),to=new Date(from.getTime()+31*86400000);
   const [rules,preview]=await Promise.all([rpc('list_essential_weekly_availability',{p_company:account.companyId}),rpc('essential_availability_shift_preview',{p_company:account.companyId,p_from:from.toISOString(),p_to:to.toISOString()})]);
   weeklyRules=Array.isArray(rules)?rules:[];weeklyPreview=Array.isArray(preview?.shifts)?preview.shifts:[];
  }catch{weeklyUnavailable=true;}
  let workerPrefs:Row[]=[],prefsUnavailable=false;
  if(ent.features.includes('availability'))try{const prefs=await rpc('list_essential_worker_schedule_preferences',{p_company:account.companyId});workerPrefs=Array.isArray(prefs)?prefs:[];}catch{prefsUnavailable=true;}
  let assignedSites:Row[]=[],assignedSitesUnavailable=false;
  try{
   const destinations=await rpc('list_essential_assigned_client_sites',{p_company:account.companyId,p_from:start.toISOString(),p_to:end.toISOString()});
   assignedSites=Array.isArray(destinations?.items)?destinations.items:[];
   assignedSitesUnavailable=!!destinations?.has_more;
  }catch{assignedSitesUnavailable=true;}
  if(activeAccount.current!==key||loadRevision.current!==revision)return;
  setData({templates,positions,locations,departments,roster,scopes,requests,availability,absences,absenceUnavailable,weeklyRules,weeklyPreview,weeklyUnavailable,workerPrefs,prefsUnavailable,assignedSites,assignedSitesUnavailable,loadedFrom:start.toISOString().slice(0,10),loadedTo:end.toISOString().slice(0,10),shifts:shifts.data||[],features:ent.features,options,own:own.data?.id,workers});setCalendarFeed(feed);
  const myWorkerId=own.data?.id;
  if(!manager&&myWorkerId&&!prefsUnavailable)setForm(f=>f.prefLoadedWorker===myWorkerId?f:{...f,...prefsToForm(workerPrefs.find((p:Row)=>p.worker_id===myWorkerId),myWorkerId)});
  setForm(f=>({...f,location:f.location||locations[0]?.id,avLocation:f.avLocation||locations[0]?.id,weeklyLocation:f.weeklyLocation||locations[0]?.id,posLocation:f.posLocation||locations[0]?.id}));
 }
 useEffect(()=>{setAbsenceShift(null);setClientReportFilters(null);absenceRequest.current=null;weeklyRequest.current=null;prefRequest.current=null;reminderKey.current=null;setReminderResult(null);setVisitShift(null);setVisitChoices([]);setForm(f=>({...f,prefLoadedWorker:''}));setPositionAlerts(null);setCalendarLink('');setCalendarFeed(null);load().catch(e=>setNotice(e.message));const timer=setInterval(()=>{if(AppState.currentState==='active')load().catch(()=>{})},60000);const listener=AppState.addEventListener('change',v=>{if(v==='active')load().catch(e=>setNotice(e.message))});return()=>{loadRevision.current++;clearInterval(timer);listener.remove()}},[account.companyId]);
 async function run(fn:()=>Promise<unknown>){if(busy)return;setBusy(true);setNotice('');try{await fn();await load()}catch(e:any){setNotice(e.message)}finally{setBusy(false)}}
 const set=(key:string,value:string)=>setForm(f=>({...f,[key]:value}));
 const text=(t:string,style:object={})=><Text style={[s.text,style]}>{t}</Text>;
 const field=(label:string,key:string,placeholder=label)=><View style={{gap:5}}>{text(label,{fontSize:12,color:'#6c8066'})}<TextInput accessibilityLabel={label} value={String(form[key]??'')} onChangeText={v=>set(key,v)} placeholder={placeholder} placeholderTextColor="#8a9982" style={s.input} autoCapitalize="none"/></View>;
 const button=(label:string,onPress:()=>void)=><Pressable disabled={busy} onPress={onPress} style={[s.button,busy&&{opacity:.5}]}>{text(label,{color:'white',fontWeight:'600'})}</Pressable>;
 const choose=(label:string,key:string,options:[string,string][]) :React.ReactNode=><View style={{gap:7}}>{text(label,{fontSize:12,color:'#6c8066'})}<View style={s.options}>{options.map(([id,name])=><Pressable accessibilityRole="radio" accessibilityState={{selected:String(form[key]??'')===id}} key={id} onPress={()=>set(key,id)} style={[s.option,String(form[key]??'')===id&&{backgroundColor:'#dce9d6'}]}>{text(name,{fontSize:12})}</Pressable>)}</View></View>;
 const location=(key:string)=>choose('Établissement',key,data.locations.map((l:Row)=>[l.id,l.name]));
 const department=()=>choose('Département','department',[['','Aucun'],...data.departments.filter((d:Row)=>d.location_id===form.location).map((d:Row)=>[d.id,d.name] as [string,string])]);
 const date=(value:string,zone='America/Toronto')=>new Date(value).toLocaleString('fr-CA',{timeZone:zone,month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
 const local=(value:string,zone:string)=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));const p=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;};
 const name=(id:string)=>data.roster.find((w:Row)=>w.id===id)?.name||'Salarié';
 async function publish(){
  const base={p_company:account.companyId,p_worker:form.worker||null,p_location:form.location,p_department:form.department||null};
  if(form.mode==='single'){if(!form.start||!form.end)throw Error('Début et fin requis.');await rpc('save_essential_local_shift',{...base,p_start_local:form.start,p_end_local:form.end,p_note:form.note||'',p_shift:editing?.id||null,p_expected_version:editing?.version??null});}
  else{
   const days=String(form.days).split(',').map(Number),count=Number(form.weeks);if(days.some(d=>!Number.isInteger(d)||d<1||d>7)||!Number.isInteger(count)||count<1||count>26)throw Error('Jours 1–7 et nombre de cycles valides requis.');
   let params:Row;
   if(form.mode==='weekly')params={...base,p_first:form.first,p_weeks:count,p_weekdays:days,p_start:form.startTime,p_end:form.endTime,p_note:form.note||''};
   else{if(new Date(form.first+'T12:00:00Z').getUTCDay()!==1)throw Error('Choisissez un lundi pour débuter la rotation.');const weeks=form.mode==='rotate3'?3:2;params={...base,p_first:form.first,p_cycle_days:weeks*7,p_cycles:count,p_pattern:Array.from({length:weeks},(_,week)=>days.map(day=>({day:week*7+day-1,start:form['startTime'+(week?week+1:'')],end:form['endTime'+(week?week+1:'')]}))).flat()};}
   const key=JSON.stringify(params);if(batch.current?.key!==key)batch.current={key,id:Crypto.randomUUID()};
   await rpc(form.mode==='weekly'?'repeat_essential_shifts':'rotate_essential_shifts',{...params,p_request:batch.current.id});batch.current=null;
  }setShowForm(false);setEditing(null);setNotice('Horaire publié.');
 }
 async function saveTemplate(update=false){
  if(!['weekly','rotate2','rotate3'].includes(form.mode))throw Error('Choisir une récurrence ou une rotation.');
  const config:Row={mode:form.mode,days:String(form.days||'').split(',').map(Number),note:form.note||''};
  for(let week=1;week<=(form.mode==='weekly'?1:form.mode==='rotate2'?2:3);week++){const suffix=week===1?'':week;for(const part of ['startTime','endTime'])config[part+suffix]=form[part+suffix];}
  await rpc('save_essential_schedule_template',{p_company:account.companyId,p_location:form.location,p_department:form.department||null,p_name:form.templateName||'',p_configuration:config,p_template:update?selectedTemplate.current?.id:null,p_expected_version:update?selectedTemplate.current?.version:null});selectedTemplate.current=null;setNotice('Modèle enregistré, aucun quart publié.');
 }
 const templates=feature('advanced_schedules')&&!editing?<View style={s.card}>{text('Modèles réutilisables',{fontSize:19,fontWeight:'600'})}{text('Charger un modèle, vérifier dates et salarié, puis publier. Aucun quart existant n’est modifié.')}{data.templates.filter((t:Row)=>t.active).map((t:Row)=><View key={t.id}>{text(t.name+' · v'+t.version)}{button('Charger',()=>{selectedTemplate.current=t;setForm(f=>({...f,...t.configuration,days:t.configuration.days.join(','),location:t.location_id,department:t.department_id||'',templateName:t.name}));batch.current=null;setEditing(null);setShowForm(true)})}{button('Archiver',()=>run(()=>rpc('archive_essential_schedule_template',{p_template:t.id,p_expected_version:t.version})))}</View>)}{field('Nom du modèle','templateName')}{selectedTemplate.current?button('Mettre à jour le modèle chargé',()=>run(()=>saveTemplate(true))):null}{button('Enregistrer le cycle comme nouveau modèle',()=>run(()=>saveTemplate(false)))}</View>:null;
 async function sharePersonalCalendar(){
  if(!data.own)throw Error('Aucun dossier salarié lié à ce compte : export non disponible.');
  if(data.shifts.length>=1000)throw Error('Plus de 1 000 quarts chargés : choisir une période plus courte avant export.');
  const personal=buildPersonalCalendar({companyId:account.companyId,workerId:data.own,shifts:data.shifts,locations:data.locations});
  if(!personal.count)throw Error('Aucun quart personnel publié pour la période affichée.');
  if(!(await Sharing.isAvailableAsync()))throw Error('Partage de fichier indisponible sur cet appareil.');
  const file=new File(Paths.cache,'PUNCH_horaire_personnel.ics');
  if(file.exists)file.delete();
  file.create();
  await file.write(personal.content);
  try{await Sharing.shareAsync(file.uri,{mimeType:'text/calendar',dialogTitle:'Exporter mon horaire'});}
  finally{try{file.delete();}catch{/* nettoyage du cache à la prochaine utilisation */}}
  setNotice(personal.count+' quart(s) exportés. Importation manuelle : pas de mise à jour automatique.');
 }
 const privateCalendar=<View style={s.card}>
 {text('Calendrier synchronisé',{fontSize:18,fontWeight:'600'})}
 {text('L’abonnement iCalendar se met à jour lorsque votre application Calendrier recharge le lien.',{fontSize:12})}
 {text('Confidentiel : toute personne qui possède le lien peut consulter vos quarts jusqu’à sa révocation.',{fontSize:12})}
 {text(calendarFeed?.active?'Lien privé actif':'Aucun lien privé actif')}
 {button('Créer ou renouveler mon lien privé',()=>Alert.alert('Lien privé de calendrier','L’ancien lien sera immédiatement révoqué. Conservez le nouveau lien secret.',[{text:'Annuler',style:'cancel'},{text:'Créer',onPress:()=>run(async()=>{const r=await rpc('personal_calendar_feed_rotate',{p_company:account.companyId});const rawUrl=String(PUNCH_SUPABASE_URL||'');const base=rawUrl.endsWith('/')?rawUrl.slice(0,-1):rawUrl;if(!base.startsWith('https://'))throw Error('Serveur calendrier indisponible.');setCalendarLink(base+'/functions/v1/essential-calendar?token='+r.token);setCalendarFeed({active:true});})}]))}
 {calendarFeed?.active?button('Révoquer mon lien',()=>Alert.alert('Révoquer le lien','Les calendriers abonnés ne pourront plus obtenir vos nouveaux quarts.',[{text:'Annuler',style:'cancel'},{text:'Révoquer',style:'destructive',onPress:()=>run(async()=>{await rpc('personal_calendar_feed_revoke',{p_company:account.companyId});setCalendarLink('');setCalendarFeed({active:false});})}])):null}
 {calendarLink?<>{text('Copiez maintenant ce lien : il ne sera pas montré à nouveau.',{fontSize:12})}<Text selectable style={s.text}>{calendarLink}</Text>{button('Partager le lien privé',()=>{Share.share({message:calendarLink}).catch(()=>{})})}</>:null}
 </View>;
 const absenceForm=absenceShift&&canReportShift(data.shifts.find((x:Row)=>x.id===absenceShift),data.own,absenceForShift(data.absences,absenceShift))?<View style={s.card}>
  {text('Signaler mon absence',{fontSize:20,fontWeight:'600'})}
  {text('Vous confirmez votre absence pour un quart précis. Votre responsable sera averti; aucun pointage, congé payé ou salaire ne sera modifié. Le motif demeure privé.',{fontSize:12})}
  {choose('Motif','absenceReason',[['','Choisir un motif'],...ABSENCE_REASONS] as [string,string][])}
  {field('Précision facultative (400 caractères max)','absenceNote')}
  {button('Confirmer mon absence',()=>{
   try{prepareAbsence(form.absenceReason,form.absenceNote);}catch(error:any){setNotice(error.message);return;}
   Alert.alert('Confirmer mon absence ?','Une notification sera envoyée à votre responsable. Aucun remplacement ne sera lancé automatiquement.',[
    {text:'Annuler',style:'cancel'},
    {text:'Confirmer',onPress:()=>run(async()=>{
     const shift=data.shifts.find((x:Row)=>x.id===absenceShift);
     if(!canReportShift(shift,data.own,absenceForShift(data.absences,absenceShift)))throw Error('Ce quart ne peut plus être signalé.');
     if(!absenceRequest.current||absenceRequest.current.shift!==absenceShift)absenceRequest.current={shift:absenceShift,id:Crypto.randomUUID()};
     await rpc('report_essential_shift_absence',{p_shift:shift.id,p_expected_version:shift.version,...prepareAbsence(form.absenceReason,form.absenceNote),p_request:absenceRequest.current.id});
     setAbsenceShift(null);absenceRequest.current=null;setNotice('Absence signalée. Votre responsable a été avisé.');
    })}
   ]);
  })}
  {button('Annuler',()=>{setAbsenceShift(null);absenceRequest.current=null;})}
 </View>:null;
 let overview:ReturnType<typeof buildMultiSiteOverview>|null=null,overviewError='';
 if(manager)try{
  overview=buildMultiSiteOverview({shifts:data.shifts,assignedSites:data.assignedSites,roster:data.roster,
   day:String(form.overviewDay),period:form.overviewPeriod,view:overviewView,
   worker:form.overviewWorker,site:form.overviewSite,department:form.overviewDepartment});
 }catch(e:any){overviewError=e.message||'Date invalide';}
 const overviewSiteOptions=[...new Map((data.assignedSites||[]).filter((x:Row)=>x.client_site_id)
  .map((x:Row)=>[x.client_site_id,[x.client_site_id,x.client_name+' · '+x.site_name] as [string,string]])).values()] as [string,string][];
 const multiSiteView=manager?<View style={s.card}>
  {text('Calendrier des interventions',{fontSize:19,fontWeight:'700'})}
  {text('Deux vues du même horaire publié. Aucun trajet ni kilométrage estimé; aucune modification des pointages.',{fontSize:12})}
  <View style={{flexDirection:'row',gap:6,flexWrap:'wrap'}}>
   {button('Par employé',()=>setOverviewView('employee'))}
   {button('Par emplacement',()=>setOverviewView('location'))}
  </View>
  {text('Vue active : '+(overviewView==='employee'?'Par employé':'Par emplacement'),{fontWeight:'600'})}
  {field('Date (AAAA-MM-JJ)','overviewDay')}
  {choose('Période','overviewPeriod',[['day','Jour'],['week','Semaine']])}
  {choose('Salarié','overviewWorker',[['','Tous'],...data.roster.filter((x:Row)=>x.status==='active').map((x:Row)=>[x.id,x.name] as [string,string])])}
  {choose('Département','overviewDepartment',[['','Tous'],...data.departments.filter((x:Row)=>x.active).map((x:Row)=>[x.id,x.name] as [string,string])])}
  {choose('Lieu client','overviewSite',[['','Tous'],...overviewSiteOptions])}
  {overviewError?text(overviewError,{color:'#B34E38'}):null}
  {overview?<>
   {text(overview.shown+' quart(s) · '+overview.noWorker+' sans salarié · '+overview.noSite+' sans adresse · '+overview.overlapShifts+' dans un chevauchement.',{fontSize:12,fontWeight:'600'})}
   {overview.travelCheckShifts?text('Trajets à vérifier entre clients : aucun temps réel de déplacement connu.',{fontSize:12}):null}
   {(overview.incomplete||data.assignedSitesUnavailable)?text('Données possiblement tronquées. Réduisez la période et rechargez.',{fontSize:12,color:'#B34E38'}):null}
   {overview.groups.length===0?text('Aucun quart avec ces filtres.'):null}
   {overview.groups.map(group=><View key={group.key} style={{gap:7,paddingVertical:9,borderBottomWidth:1,borderColor:'#E1E8DB'}}>
    {text(group.label,{fontWeight:'700',fontSize:16})}
    {group.items.map((item:Row)=><View key={item.id} style={{gap:2,padding:9,borderRadius:8,backgroundColor:'#F4F7F2'}}>
     {text(item.workerName,{fontWeight:'600'})}
     {text(date(item.shift.starts_at,item.shift.timezone)+' → '+date(item.shift.ends_at,item.shift.timezone),{fontSize:12})}
     {text((item.clientName||'Client non attribué')+' · '+item.placeName,{fontSize:12})}
     {item.address?text(item.address,{fontSize:12}):null}
     {item.overlap?text('Conflit : quarts qui se chevauchent pour ce salarié.',{fontSize:12,color:'#B34E38'}):null}
     {item.travelCheck?text('Déplacement à confirmer, durée inconnue.',{fontSize:12}):null}
    </View>)}
   </View>)}
  </>:null}
 </View>:null;
 const calendar=<>{multiSiteView}{absenceForm}<View style={s.card}>{text('Quarts publiés',{fontSize:19,fontWeight:'600'})}{text('7 derniers jours et 90 prochains jours · maximum 1 000 quarts',{fontSize:11,color:'#6c8066'})}{data.own?button('Partager mon horaire (.ics)',()=>run(sharePersonalCalendar)):null}{data.own?privateCalendar:null}{data.own?text('Calendrier personnel, importation manuelle; les futures modifications ne se synchronisent pas automatiquement.',{fontSize:11,color:'#6c8066'}):null}{anyPlan?button(showForm?'Fermer le formulaire':'Planifier',()=>{setEditing(null);setShowForm(v=>!v)}):null}</View>{showForm?<View style={s.card}>{choose('Salarié','worker',[...(feature('advanced_schedules')?[['','Quart à combler'] as [string,string]]:[]),...data.roster.map((w:Row)=>[w.id,w.name] as [string,string])])}{location('location')}{department()}{choose('Organisation','mode',[['single','Quart unique'],...(feature('advanced_schedules')?[['weekly','Hebdomadaire'],['rotate2','Jour / soir'],['rotate3','Jour / soir / nuit']] as [string,string][]:[])])}{text('Heures locales de '+(data.locations.find((l:Row)=>l.id===form.location)?.timezone||'l’établissement'),{fontSize:12})}{form.mode==='single'?<>{field('Début local','start','2026-11-02T07:00')}{field('Fin locale','end','2026-11-02T15:00')}</>:<>{field('Premier jour AAAA-MM-JJ','first')}{field('Semaines / cycles','weeks')}{field('Jours ISO séparés par virgules','days')}{field('Début A','startTime')}{field('Fin A','endTime')}{form.mode!=='weekly'?<>{field('Début B','startTime2')}{field('Fin B','endTime2')}</>:null}{form.mode==='rotate3'?<>{field('Début C','startTime3')}{field('Fin C','endTime3')}</>:null}</>}{field('Note','note')}{button('Publier',()=>run(publish))}{templates}</View>:null}{data.shifts.filter((x:Row)=>!x.cancelled_at).map((x:Row)=><View key={x.id} style={s.card}>{text(x.worker_id?name(x.worker_id):'Quart disponible',{fontWeight:'600'})}{text(date(x.starts_at,x.timezone)+' → '+date(x.ends_at,x.timezone))}{text((data.locations.find((l:Row)=>l.id===x.location_id)?.name||'Établissement')+' · version '+x.version,{fontSize:12,color:'#6c8066'})}{x.position_id?text('Poste : '+(data.positions.find((p:Row)=>p.id===x.position_id)?.title||'Poste exclusif')):null}{x.note?text(x.note):null}
 {assignedSiteForShift(data.assignedSites,x.id)?<View style={{gap:5,padding:9,backgroundColor:'#F4F7F2',borderRadius:8}}>
  {text('Client · '+assignedSiteSummary(assignedSiteForShift(data.assignedSites,x.id)),{fontWeight:'600'})}
  {text(assignedSiteAddress(assignedSiteForShift(data.assignedSites,x.id)),{fontSize:12})}
  {assignedSiteForShift(data.assignedSites,x.id)?.access_instructions?text('Accès : '+assignedSiteForShift(data.assignedSites,x.id).access_instructions,{fontSize:12}):null}
  {assignedSiteForShift(data.assignedSites,x.id)?.contact_name?text('Contact sur place : '+assignedSiteForShift(data.assignedSites,x.id).contact_name,{fontSize:12}):null}
  {text('Itinéraire vers cet arrêt : choisir une application',{fontSize:12,fontWeight:'600'})}
  <View style={{flexDirection:'row',gap:6,flexWrap:'wrap'}}>
   {navigationStopChoices(assignedSiteForShift(data.assignedSites,x.id),Platform.OS).map((choice:{id:string;label:string;url:string})=>
    <View key={choice.id}>{button(choice.label,()=>Linking.openURL(choice.url).catch(e=>setNotice(e.message)))}</View>)}
  </View>
  {text('Aucun GPS permanent ni suivi de trajet activé.',{fontSize:11})}
 </View>:null}
 {manager?button('Associer une adresse client',()=>run(async()=>{
    const response=await rpc('list_essential_client_sites',{p_company:account.companyId,p_search:'',p_after:null,p_limit:50});
    setVisitShift(x.id);setVisitChoices(response.items||[]);setVisitMore(!!response.has_more);
    setForm(f=>({...f,visitSearch:'',visitSite:x.client_site_id||''}));
  })):null}
 {manager&&visitShift===x.id?<View style={{gap:8,padding:10,borderColor:'#DCE8D6',borderWidth:1,borderRadius:10}}>
   {text('Adresse réelle de ce quart',{fontWeight:'700'})}
   {text('Aucun changement d’heures ni de pointage. Les adresses de clients ne sont pas des établissements.',{fontSize:12})}
   {field('Rechercher le client, la ville ou l’adresse','visitSearch')}
   {button('Rechercher les lieux',()=>run(async()=>{
     const result=await rpc('list_essential_client_sites',{p_company:account.companyId,p_search:form.visitSearch||'',p_after:null,p_limit:50});
     setVisitChoices(result.items||[]);setVisitMore(!!result.has_more);setForm(f=>({...f,visitSite:''}));
   }))}
   {choose('Adresse du client','visitSite',[['','Aucun lieu client'],...visitChoices.filter(c=>c.active).map(c=>[c.id,c.client_name+' · '+c.name+' · '+c.city] as [string,string])])}
   {visitMore?text('Plus de 50 résultats : précisez la recherche.',{fontSize:12}):null}
   {button('Confirmer le lieu du quart',()=>Alert.alert('Modifier le lieu du quart ?','Une notification interne sera envoyée au salarié concerné. Les heures restent identiques.',[
    {text:'Annuler',style:'cancel'},
    {text:'Confirmer',onPress:()=>run(async()=>{
      if(form.visitSite&&!visitChoices.some(c=>c.id===form.visitSite&&c.active))throw Error('Lieu non présent dans la recherche.');
      await rpc('set_essential_shift_client_site',shiftSiteAssignmentArgs(account.companyId,x,form.visitSite));
      setVisitShift(null);setVisitChoices([]);
    })}
   ]))}
   {button('Fermer',()=>{setVisitShift(null);setVisitChoices([])})}
  </View>:null}
 {feature('advanced_schedules')&&!data.absenceUnavailable?(()=>{const report=absenceForShift(data.absences,x.id);
  if(report)return <View style={{gap:6}}>{text(absenceStatus(report.status),{fontSize:12,fontWeight:'600'})}{manager&&report.status==='reported'&&report.worker_id!==data.own?<>{button('Pris en charge',()=>run(()=>rpc('review_essential_shift_absence',{p_absence:report.id,p_decision:'acknowledged'})))}{button('Suivi requis',()=>run(()=>rpc('review_essential_shift_absence',{p_absence:report.id,p_decision:'follow_up'})))}</>:null}</View>;
  return canReportShift(x,data.own,false)?button('Signaler mon absence',()=>{setAbsenceShift(x.id);setForm(f=>({...f,absenceReason:'',absenceNote:''}));absenceRequest.current=null;}):null;
 })():null}{x.user_id===account.userId?button('Confirmer la lecture',()=>run(()=>rpc('acknowledge_essential_shift',{p_shift:x.id,p_version:x.version}))):null}{manager&&feature('minimum_coverage')?<>{choose('Poste exclusif','position-'+x.id,[['','Aucun'],...data.positions.filter((p:Row)=>p.active&&p.location_id===x.location_id&&(!p.department_id||p.department_id===x.department_id)).map((p:Row)=>[p.id,p.title] as [string,string])])}{field('Motif du changement de poste','positionReason-'+x.id)}{button('Attribuer le poste',()=>run(()=>rpc('assign_essential_position',{p_company:account.companyId,p_shift:x.id,p_position:form['position-'+x.id]||null,p_expected_version:x.version,p_reason:form['positionReason-'+x.id]||''})))}</>:null}{canPlan(x.department_id)?<>{button('Modifier le quart',()=>{setEditing({id:x.id,version:x.version});setForm(f=>({...f,mode:'single',worker:x.worker_id||'',location:x.location_id,department:x.department_id||'',start:local(x.starts_at,x.timezone),end:local(x.ends_at,x.timezone),note:x.note}));setShowForm(true)})}{field('Motif d’annulation','reason-'+x.id)}{button('Annuler le quart',()=>Alert.alert('Annuler ce quart ?','Un motif et une trace sont conservés.',[{text:'Retour',style:'cancel'},{text:'Annuler le quart',onPress:()=>run(()=>rpc('cancel_essential_shift',{p_shift:x.id,p_expected_version:x.version,p_reason:form['reason-'+x.id]||''}))}]))}</>:null}{feature('shift_swaps')&&x.starts_at>new Date().toISOString()?(x.worker_id===data.own?<>{button('Demander un remplacement',()=>run(()=>rpc('request_essential_shift_change',{p_shift:x.id,p_kind:'release'})))}{choose('Quart à proposer en échange','swap-'+x.id,data.options.filter((o:Row)=>o.location_id===x.location_id&&o.department_id===x.department_id).map((o:Row)=>[o.id,o.name+' · '+date(o.starts_at,x.timezone)]))}{button('Proposer l’échange',()=>run(()=>rpc('request_essential_shift_change',{p_shift:x.id,p_kind:'swap',p_other:form['swap-'+x.id]||null})))}</>:x.worker_id===null?button('Me proposer pour ce quart',()=>run(()=>rpc('request_essential_shift_change',{p_shift:x.id,p_kind:'claim'}))):null):null}</View>)}</>;
 const organization=<><ClientDirectoryPanel companyId={account.companyId}/><View style={s.card}>{text('Établissements',{fontSize:20,fontWeight:'600'})}{data.locations.map((l:Row)=><View key={l.id}>{text(l.name,{fontWeight:'600'})}{text(l.timezone,{fontSize:12})}</View>)}{manager?<>{field('Nom du nouvel établissement','locationName')}{field('Adresse','address')}{field('Fuseau IANA','timezone')}{button('Créer l’établissement',()=>run(()=>rpc('save_essential_location',{p_company:account.companyId,p_name:form.locationName,p_address:form.address||'',p_timezone:form.timezone})))}</>:null}</View><View style={s.card}>{text('Départements',{fontSize:20,fontWeight:'600'})}{data.departments.map((d:Row)=><View key={d.id}>{text(d.name)}{manager&&feature('minimum_coverage')?<>{field('Minimum requis','minimum-'+d.id)}{button('Enregistrer le minimum',()=>run(()=>rpc('set_essential_minimum_staff',{p_department:d.id,p_minimum:Number(form['minimum-'+d.id])})))}</>:null}</View>)}{manager&&feature('departments')?<>{location('location')}{field('Nom du département','departmentName')}{button('Créer le département',()=>run(()=>rpc('save_essential_department',{p_company:account.companyId,p_location:form.location,p_name:form.departmentName})))}</>:null}</View>{manager&&feature('minimum_coverage')?<View style={s.card}>{text('Postes exclusifs · Pro',{fontSize:19,fontWeight:'600'})}{text('Un seul quart simultané par poste. Les certifications sont vérifiées côté serveur.')}
 {button('Vérifier certifications des postes (90 jours)',()=>run(async()=>{const start=new Date(),end=new Date(start.getTime()+90*86400000);const r=await rpc('essential_position_certification_alerts',{p_company:account.companyId,p_start:start.toISOString(),p_end:end.toISOString()});setPositionAlerts(r)}))}
 {positionAlerts?<View>{text(positionAlerts.count+' quart(s) avec certification manquante ou expirée.',{fontWeight:'600'})}{positionAlerts.truncated?text('Rapport limité aux 200 premiers quarts'):null}{(positionAlerts.items||[]).map((a:Row)=><View key={a.shift_id}>{text(a.position_title+' · '+a.certificate_title+' · '+date(a.starts_at))}</View>)}</View>:null}
 {choose('Établissement','posLocation',data.locations.filter((x:Row)=>x.active).map((x:Row)=>[x.id,x.name] as [string,string]))}{choose('Département','posDepartment',[['','Aucun'],...data.departments.filter((x:Row)=>x.location_id===form.posLocation).map((x:Row)=>[x.id,x.name] as [string,string])])}{field('Nom du poste','posTitle')}{field('Certification requise, facultative','posCertificate')}{field('Motif','posReason')}{button('Créer un poste',()=>run(()=>rpc('save_essential_position',{p_company:account.companyId,p_location:form.posLocation,p_department:form.posDepartment||null,p_title:form.posTitle,p_certificate:form.posCertificate||null,p_active:true,p_id:null,p_expected_version:0,p_reason:form.posReason||''})))}{data.positions.filter((x:Row)=>x.active).map((p:Row)=><View key={p.id}>{text(p.title+' · '+(data.locations.find((l:Row)=>l.id===p.location_id)?.name||'Établissement'))}{button('Désactiver le poste',()=>Alert.alert('Désactiver le poste ?','Les quarts futurs doivent être désaffectés.',[{text:'Retour',style:'cancel'},{text:'Désactiver',onPress:()=>run(()=>rpc('save_essential_position',{p_company:account.companyId,p_location:p.location_id,p_department:p.department_id,p_title:p.title,p_certificate:p.required_certificate,p_active:false,p_id:p.id,p_expected_version:p.version,p_reason:form.posReason||''}))}]))}</View>)}</View>:null}{manager?<View style={s.card}>{text('Affecter un salarié',{fontSize:19,fontWeight:'600'})}{choose('Salarié','assignWorker',data.roster.map((w:Row)=>[w.id,w.name]))}{location('location')}{department()}{button('Enregistrer l’affectation',()=>run(()=>rpc('assign_essential_worker',{p_worker:form.assignWorker,p_location:form.location,p_department:form.department||null})))}</View>:null}{account.role==='boss'&&feature('supervisors')?<View style={s.card}>{text('Autoriser un superviseur',{fontSize:19,fontWeight:'600'})}{data.scopes.map((g:Row)=><View key={g.user_id+g.department_id}>{text((data.workers.find((w:Row)=>w.auth_user_id===g.user_id)?.first_name||'Superviseur')+' · '+(data.departments.find((d:Row)=>d.id===g.department_id)?.name||'Département'))}{g.active?<><Pressable accessibilityRole="checkbox" accessibilityState={{checked:form['approveTime-'+g.department_id+'-'+g.user_id]??g.can_approve_time}} onPress={()=>setForm(f=>({...f,['approveTime-'+g.department_id+'-'+g.user_id]:!(f['approveTime-'+g.department_id+'-'+g.user_id]??g.can_approve_time)}))} style={{padding:12}}>{text(((form['approveTime-'+g.department_id+'-'+g.user_id]??g.can_approve_time)?'✓ ':'○ ')+'Approuver les heures')}</Pressable><Pressable accessibilityRole="checkbox" accessibilityState={{checked:form['approveLeave-'+g.department_id+'-'+g.user_id]??g.can_approve_leave}} onPress={()=>setForm(f=>({...f,['approveLeave-'+g.department_id+'-'+g.user_id]:!(f['approveLeave-'+g.department_id+'-'+g.user_id]??g.can_approve_leave)}))} style={{padding:12}}>{text(((form['approveLeave-'+g.department_id+'-'+g.user_id]??g.can_approve_leave)?'✓ ':'○ ')+'Approuver les congés')}</Pressable>{button('Enregistrer les approbations',()=>run(async()=>{await rpc('set_supervisor_approvals',{p_company:account.companyId,p_department:g.department_id,p_user:g.user_id,p_time:form['approveTime-'+g.department_id+'-'+g.user_id]??g.can_approve_time,p_leave:form['approveLeave-'+g.department_id+'-'+g.user_id]??g.can_approve_leave,p_expected_version:g.approval_version,p_reason:form.approvalReason||''});setForm(f=>{const n={...f};delete n['approveTime-'+g.department_id+'-'+g.user_id];delete n['approveLeave-'+g.department_id+'-'+g.user_id];return n})}))}</>:null}{button(g.active?'Révoquer ce périmètre':'Réactiver ce périmètre',()=>run(()=>rpc('set_essential_supervisor',{p_company:account.companyId,p_department:g.department_id,p_user:g.user_id,p_can_plan:g.can_plan,p_active:!g.active})))}</View>)}{field('Motif des modifications d’approbations','approvalReason')}{choose('Membre','supervisor',data.workers.filter((w:Row)=>w.auth_user_id&&['employee','lead'].includes(w.role)).map((w:Row)=>[w.auth_user_id,w.first_name+' '+w.last_name]))}{department()}{choose('Permissions','permission',[['read','Consultation'],['plan','Planification']])}{button('Autoriser',()=>run(()=>rpc('set_essential_supervisor',{p_company:account.companyId,p_department:form.department,p_user:form.supervisor,p_can_plan:form.permission==='plan',p_active:true})))}</View>:null}</>;
 const requests=<><View style={s.card}>{text('Demandes de changement',{fontSize:20,fontWeight:'600'})}{anyPlan?field('Motif de décision','decisionNote'):null}</View>{data.requests.map((r:Row)=>{const x=data.shifts.find((x:Row)=>x.id===r.shift_id);return <View key={r.id} style={s.card}>{text(({claim:'Prise de quart',release:'Remplacement',swap:'Échange'} as Row)[r.kind]+' · '+r.status)}{r.review_note?text(r.review_note):null}{r.status==='pending'&&r.other_worker_id===data.own?<>{button('Accepter la proposition',()=>run(()=>rpc('answer_essential_swap',{p_request:r.id,p_accept:true})))}{button('Refuser la proposition',()=>run(()=>rpc('answer_essential_swap',{p_request:r.id,p_accept:false})))}</>:null}{['pending','accepted'].includes(r.status)&&canPlan(x?.department_id)&&r.worker_id!==data.own&&r.other_worker_id!==data.own?<>{button('Approuver',()=>run(()=>rpc('review_essential_shift_request',{p_request:r.id,p_approve:true,p_note:form.decisionNote||''})))}{button('Refuser',()=>run(()=>rpc('review_essential_shift_request',{p_request:r.id,p_approve:false,p_note:form.decisionNote||''})))}</>:null}{r.worker_id===data.own&&['pending','accepted'].includes(r.status)?button('Annuler ma demande',()=>run(()=>rpc('cancel_essential_shift_request',{p_request:r.id}))):null}</View>})}</>;

 const reminders=manager&&feature('availability')?<View style={s.card}>
  {text('Rappeler les disponibilités',{fontSize:20,fontWeight:'600'})}
  {text('Rappels internes uniquement. Seuls les salariés sans disponibilité déclarée sont concernés, une seule fois par semaine. Aucun SMS, aucune affectation. Les salariés sans compte ne peuvent pas recevoir ce rappel.',{fontSize:12})}
  {field('Semaine du (lundi, AAAA-MM-JJ)','reminderWeek')}
  {field('Date limite (AAAA-MM-JJ)','reminderDue')}
  {choose('Département','reminderDepartment',[['','Toute la compagnie'],...data.departments.filter((d:Row)=>d.active).map((d:Row)=>[d.id,d.name])])}
  {button('Prévisualiser les rappels',()=>run(async()=>{
   const args=reminderSelection(form);
   const key=JSON.stringify(args);
   const result=await rpc('essential_availability_reminder_batch',{p_company:account.companyId,...args,p_confirm:false});
   setReminderResult(result);reminderKey.current=key;
  }))}
  {reminderResult?text(reminderResultLabel(reminderResult),{fontSize:13}):null}
  {reminderResult&&!reminderResult.confirmed&&reminderResult.pending>0?button('Confirmer l’envoi interne',()=>{
    const args=reminderSelection(form),key=JSON.stringify(args);
    if(reminderKey.current!==key){setNotice('Actualisez l’aperçu avant d’envoyer.');return;}
    Alert.alert('Envoyer des rappels ?',reminderResult.pending+' notification(s) internes, aucun SMS.',[
     {text:'Annuler',style:'cancel'},
     {text:'Envoyer',onPress:()=>run(async()=>{
       if(reminderKey.current!==key)throw Error('Aperçu expiré. Rechargez.');
       const result=await rpc('essential_availability_reminder_batch',{p_company:account.companyId,...args,p_confirm:true});
       setReminderResult(result);reminderKey.current=null;
       setNotice(result.sent+' rappel(s) créés. Les doublons sont bloqués côté serveur.');
     })}
    ]);
   }):null}
 </View>:null;
 const preferenceCard=feature('availability')?<View style={s.card}>
  {text('Mes préférences de travail',{fontSize:20,fontWeight:'600'})}
  {text('Ces souhaits ne créent ni contrat, heure travaillée, droit à l’over ni banque de temps. Les certifications restent dans le dossier RH.',{fontSize:12})}
  {data.prefsUnavailable?text('Préférences indisponibles pour ce dossier.'):<>
   {manager?choose('Salarié (avec ou sans téléphone)','prefWorker',[['','Choisir un salarié'],...data.workers.filter((w:Row)=>w.status==='active').map((w:Row)=>[w.id,[w.first_name,w.last_name].filter(Boolean).join(' ')])]):null}
   {manager?button('Charger son dossier',()=>{const worker=form.prefWorker,row=data.workerPrefs.find((p:Row)=>p.worker_id===worker);if(!row){setNotice('Dossier non disponible.');return;}setForm(f=>({...f,...prefsToForm(row,worker)}));prefRequest.current=null;}):null}
   {form.prefLoadedWorker&&(manager?form.prefLoadedWorker===form.prefWorker:form.prefLoadedWorker===data.own)?<>
    {field('Heures souhaitées par semaine (optionnel)','prefDesired')}
    {choose('Quarts préférés','prefPeriods',PERIOD_CHOICES as [string,string][])}
    {choose('Fin de semaine','prefWeekend',WEEKEND_CHOICES as [string,string][])}
    {choose('Volontaire aux quarts supplémentaires','prefVolunteer',[['false','Non'],['true','Oui']])}
    {choose('Disponible à la dernière minute','prefLastMinute',[['false','Non'],['true','Oui']])}
    {field('Heures supplémentaires souhaitées, non acquises','prefExtra')}
    {button('Enregistrer mes préférences',()=>run(async()=>{
      const worker=manager?form.prefWorker:data.own;
      const key=JSON.stringify([worker,form.prefDesired,form.prefPeriods,form.prefWeekend,form.prefVolunteer,form.prefLastMinute,form.prefExtra,form.prefVersion]);
      if(prefRequest.current?.key!==key)prefRequest.current={key,id:Crypto.randomUUID()};
      await rpc('save_essential_worker_schedule_preferences',{p_company:account.companyId,...preferencePayload(form,worker,prefRequest.current.id,form.prefVersion)});
      prefRequest.current=null;setForm(f=>({...f,prefLoadedWorker:''}));setNotice('Préférences enregistrées; aucun quart ni solde modifié.');
    }))}
    {text('Quarts sauvegardés : '+periodLabel(data.workerPrefs.find((x:Row)=>x.worker_id===form.prefLoadedWorker)?.preferred_periods),{fontSize:12})}
    {text('Certifications RH : '+(data.workerPrefs.find((x:Row)=>x.worker_id===form.prefLoadedWorker)?.certifications||[]).map((q:Row)=>q.title+(q.expires_on?' (expire '+q.expires_on+')':'')).join(', '),{fontSize:12})}
    {manager?<>{text('Informations du responsable',{fontSize:17,fontWeight:'600'})}{text('Ancienneté et limites déclarées, sans règle légale automatique.',{fontSize:12})}
     {field('Date d’ancienneté AAAA-MM-JJ','contractSeniority')}
     {field('Minimum hebdomadaire déclaré','contractMin')}
     {field('Maximum hebdomadaire déclaré','contractMax')}
     {button('Enregistrer les données du responsable',()=>Alert.alert('Confirmer ?', 'La paie et les quarts ne sont pas modifiés.',[
       {text:'Annuler',style:'cancel'},
       {text:'Confirmer',onPress:()=>run(async()=>{await rpc('set_essential_worker_schedule_constraints',{p_company:account.companyId,...contractPayload(form,form.prefWorker,form.prefVersion)});setForm(f=>({...f,prefLoadedWorker:''}));})}
     ]))}</>:null}
   </>:text('Chargez votre dossier pour le modifier.')}
  </>}
 </View>:null;
 const weeklyCard=feature('availability')?<View style={s.card}>
  {text('Ma semaine type',{fontSize:20,fontWeight:'600'})}
  {text('Définissez une règle une seule fois. Pour plusieurs plages, ajoutez plusieurs règles. Les exceptions datées ont priorité; les quarts déjà publiés restent inchangés.',{fontSize:12})}
  {data.weeklyUnavailable?text('Service des disponibilités récurrentes indisponible; les exceptions restent accessibles.'):<>
   {manager?choose('Salarié (avec ou sans compte)','weeklyWorker',[['','Choisir un salarié'],...data.workers.filter((w:Row)=>w.status==='active').map((w:Row)=>[w.id,[w.first_name,w.last_name].filter(Boolean).join(' ')])]):null}
   {choose('Établissement','weeklyLocation',data.locations.filter((x:Row)=>x.active).map((x:Row)=>[x.id,x.name]))}
   {field('Jours ISO (1=lundi, 7=dimanche)','weeklyDays','1,2,3,4,5')}
   {field('Début (HH:MM)','weeklyStart','07:00')}
   {field('Fin (HH:MM)','weeklyEnd','15:00')}
   {field('À partir du (AAAA-MM-JJ)','weeklyFrom')}
   {field('Date de fin facultative','weeklyUntil')}
   {choose('Statut','weeklyAvailable',[['true','Disponible'],['false','Indisponible']])}
   {button('Ajouter cette règle',()=>run(async()=>{
    const worker=manager?form.weeklyWorker:data.own;
    const payload=JSON.stringify([worker,form.weeklyLocation,form.weeklyDays,form.weeklyStart,form.weeklyEnd,form.weeklyFrom,form.weeklyUntil,form.weeklyAvailable]);
    if(weeklyRequest.current?.key!==payload)weeklyRequest.current={key:payload,id:Crypto.randomUUID()};
    const result=await rpc('save_essential_weekly_availability',{p_company:account.companyId,...weeklyArgs(form,worker,weeklyRequest.current.id)});
    weeklyRequest.current=null;
    setNotice(result?.conflicts?result.conflicts+' quart(s) publiés en conflit; aucun quart modifié.':'Semaine type enregistrée.');
   }))}
   {text('Règles enregistrées',{fontSize:16,fontWeight:'600'})}
   {data.weeklyRules.length===0?text('Aucune règle : disponibilité inconnue.'):data.weeklyRules.map((r:Row)=><View key={r.id} style={{gap:5,paddingVertical:8}}>
    {text(weeklyDaysLabel(r.days)+' · '+r.starts_local+'–'+r.ends_local+' · '+(r.available?'Disponible':'Indisponible'))}
    {manager?text(name(r.worker_id),{fontSize:12}):null}
    {text('Du '+r.effective_from+(r.effective_until?' au '+r.effective_until:' sans fin')+' · v'+r.version,{fontSize:12})}
    {button('Retirer la règle',()=>Alert.alert('Retirer la règle ?','Les quarts publiés ne seront pas modifiés.',[
      {text:'Annuler',style:'cancel'},
      {text:'Retirer',onPress:()=>run(()=>rpc('remove_essential_weekly_availability',{p_id:r.id,p_version:r.version}))}
    ]))}
   </View>)}
   {text('Vérification des quarts publiés',{fontSize:16,fontWeight:'600'})}
   {text('Inconnu ne signifie jamais disponible. Une indisponibilité sur un quart publié est un conflit à examiner.',{fontSize:12})}
   {data.weeklyPreview.map((p:Row)=><View key={p.shift_id}>
     {text(date(p.starts_at)+' · '+(manager?name(p.worker_id)+' · ':'')+weeklyPreviewLabel(p)+(p.conflict?' · Conflit':'')+' ('+p.source+')',{color:p.conflict?'#9a521c':'#2F4935'})}
   </View>)}
  </>}
 </View>:null;
 const availability=<>{reminders}{preferenceCard}{weeklyCard}<View style={s.card}>{text('Mes disponibilités',{fontSize:20,fontWeight:'600'})}{location('avLocation')}{field('Du (local)','avStart','2026-11-02T07:00')}{field('Au (local)','avEnd','2026-11-02T17:00')}{choose('Statut','available',[['false','Indisponible'],['true','Disponible']])}{field('Note','avNote')}{button('Enregistrer',()=>run(()=>rpc('set_essential_local_availability',{p_company:account.companyId,p_location:form.avLocation,p_start_local:form.avStart,p_end_local:form.avEnd,p_available:form.available==='true',p_note:form.avNote||''})))}{data.availability.map((a:Row)=><View key={a.id}>{text(name(a.worker_id)+' · '+(a.available?'Disponible':'Indisponible'))}{text(date(a.starts_at)+' → '+date(a.ends_at))}{a.worker_id===data.own?button('Retirer',()=>run(()=>rpc('remove_essential_availability',{p_id:a.id}))):null}</View>)}</View></>;
 let plannedSummary:ReturnType<typeof plannedClientReport>|null=null,plannedError='';
 if(clientReportFilters&&manager)try{
  plannedSummary=plannedClientReport({shifts:data.shifts,assignedSites:data.assignedSites,
   from:clientReportFilters.from,to:clientReportFilters.to,worker:clientReportFilters.worker,
   site:clientReportFilters.site,department:clientReportFilters.department,
   loadedFrom:data.loadedFrom,loadedTo:data.loadedTo,incomplete:data.assignedSitesUnavailable});
 }catch(e:any){plannedError=e.message||'Rapport incomplet';}
 const clientSiteOptions=[...new Map((data.assignedSites||[]).filter((x:Row)=>x.client_site_id)
  .map((x:Row)=>[x.client_site_id,[x.client_site_id,x.client_name+' · '+x.site_name] as [string,string]])).values()] as [string,string][];
 const clientReportCard=manager?<View style={s.card}>
  {text('Heures prévues par client / adresse',{fontSize:19,fontWeight:'700'})}
  {text('Heures planifiées brutes et uniques par salarié. Les conflits entre clients différents sont exclus. Aucune heure réellement travaillée ni paiement ne peut être attribué par ce rapport.',{fontSize:12})}
  {text('Utilise les dates Du/Au de ce rapport (UTC), sur une période entièrement chargée dans Horaire, maximum 31 jours.',{fontSize:12})}
  {choose('Salarié','clientReportWorker',[['','Tous'],...data.roster.filter((x:Row)=>x.status==='active').map((x:Row)=>[x.id,x.name] as [string,string])])}
  {choose('Adresse client','clientReportSite',[['','Toutes'],...clientSiteOptions])}
  {choose('Département','clientReportDepartment',[['','Tous'],...data.departments.filter((x:Row)=>x.active).map((x:Row)=>[x.id,x.name] as [string,string])])}
  {button('Calculer les heures prévues par client',()=>setClientReportFilters({
   from:form.reportFrom,to:form.reportTo,worker:form.clientReportWorker,
   site:form.clientReportSite,department:form.clientReportDepartment
  }))}
  {plannedError?text(plannedError,{fontSize:12,color:'#B34E38'}):null}
  {plannedSummary?<View style={{gap:8}}>
   {text('Heures prévues attribuables : '+plannedSummary.totalHours.toFixed(2)+' h',{fontWeight:'700'})}
   {text('Créneaux en conflit exclus : '+plannedSummary.conflictHours.toFixed(2)+' h · même lieu dédupliqué : '+plannedSummary.sameSiteOverlapHours.toFixed(2)+' h · quarts non pourvus : '+plannedSummary.vacantHours.toFixed(2)+' h.',{fontSize:12})}
   {plannedSummary.rows.map((row:Row)=><View key={row.siteId||'__missing__'} style={{padding:10,borderRadius:9,backgroundColor:'#F4F7F2',gap:4}}>
     {text(row.client+' · '+row.site,{fontWeight:'600'})}
     {row.city?text(row.city,{fontSize:12}):null}
     {text(row.scheduledHours.toFixed(2)+' h prévues · '+row.workers+' salarié(s)',{fontSize:12})}
    </View>)}
   {button('Partager le rapport CSV (texte)',()=>{void Share.share({message:plannedClientReportCsv(plannedSummary)});})}
  </View>:null}
 </View>:null;
 const reporting=<><View style={s.card}>{text('Heures brutes prévues / réelles',{fontSize:20,fontWeight:'600'})}{field('Du AAAA-MM-JJ (UTC)','reportFrom')}{field('Au exclusif AAAA-MM-JJ (UTC)','reportTo')}{text('Maximum 31 jours. Ce rapport ne constitue pas un calcul de paie.',{fontSize:12})}{button('Calculer',()=>run(async()=>{const r=await rpc('essential_planning_report',{p_company:account.companyId,p_start:form.reportFrom+'T00:00:00Z',p_end:form.reportTo+'T00:00:00Z'});setReport(r)}))}{report?<>{text('Planifiées : '+(report.planned_gross_ms/3600000).toFixed(2)+' h')}{text('Réelles : '+(report.actual_gross_ms/3600000).toFixed(2)+' h')}{text(report.vacant_shifts+' quart(s) à combler')}{report.coverage_included?report.coverage_gaps.map((g:Row,i:number)=><View key={i}>{text(g.name+' · '+date(g.starts_at)+' → '+date(g.ends_at)+': '+g.staffed+'/'+g.minimum_staff)}</View>):text('Couverture minimale : forfait Pro requis.')}</>:null}</View>{clientReportCard}</>;
 return <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled"><View style={s.options}>{(['calendar',...(manager?['organization','report']:[]),...(feature('shift_swaps')?['requests']:[]),...(feature('availability')?['availability']:[])] as typeof tab[]).map(t=><Pressable key={t} onPress={()=>setTab(t)} style={[s.option,tab===t&&{backgroundColor:'#dce9d6'}]}>{text(({calendar:'Horaire',organization:'Organisation',requests:'Demandes',availability:'Disponibilités',report:'Prévu / réel'})[t],{fontSize:13})}</Pressable>)}</View>{notice?<Text accessibilityLiveRegion="polite" style={s.notice}>{notice}</Text>:null}{busy?<ActivityIndicator color="#779574"/>:null}{feature('supervisors')&&data.scopes.some((g:Row)=>g.active)?<View style={s.card}>{text('Présences de mon équipe',{fontSize:19,fontWeight:'600'})}{data.roster.map((w:Row)=><View key={w.id}>{text(w.name+' · '+(w.working?(w.paused?'En pause':'Au travail'):'Non pointé'))}</View>)}</View>:null}{tab==='report'?reporting:tab==='organization'?organization:tab==='requests'?requests:tab==='availability'?availability:calendar}</ScrollView>;
}
const s=StyleSheet.create({container:{padding:18,gap:14,backgroundColor:'#FAFBF8'},text:{color:'#2F4935',fontSize:14,lineHeight:21},card:{padding:17,gap:12,borderWidth:1,borderColor:'#E1E8DB',borderRadius:14,backgroundColor:'white'},input:{borderWidth:1,borderColor:'#E1E8DB',borderRadius:9,padding:12,minHeight:46,color:'#2F4935'},button:{padding:13,minHeight:46,borderRadius:10,backgroundColor:'#4e7051',alignItems:'center'},options:{flexDirection:'row',flexWrap:'wrap',gap:7},option:{borderWidth:1,borderColor:'#E1E8DB',padding:10,borderRadius:9},notice:{padding:13,backgroundColor:'#edf3e7',color:'#2F4935',borderRadius:10}});
