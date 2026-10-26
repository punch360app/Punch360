import {scheduleTemplateConfiguration,scheduleTemplateForm} from './schedule-templates.js';
import {buildPersonalCalendar,downloadCalendarIcs} from './personal-calendar.js';
import {ABSENCE_REASONS,absenceForShift,absenceStatus,canReportShift,prepareAbsence} from './shift-absence.js';
import {weeklyArgs,weeklyDaysLabel,weeklyPreviewLabel} from './weekly-availability.js';
import {PERIOD_CHOICES,WEEKEND_CHOICES,preferencePayload,contractPayload,periodLabel} from './schedule-preferences.js';
import {nextIsoMonday,reminderSelection,reminderResultLabel} from './availability-reminders.js';
/** Essentiel organization and planning UI. Every write is a validated server RPC. */
export function createPlanningController({sb,redraw,notify,escape:e,document:doc,exportIcs=downloadCalendarIcs}){
 let generation=0;
 const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
 const future=()=>{const d=new Date();d.setDate(d.getDate()+31);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');};
 const s={company:null,user:null,own:null,role:null,entitlement:{},templates:[],positions:[],positionAlerts:null,feedStatus:null,feedUrl:null,locations:[],departments:[],scopes:[],roster:[],workers:[],shifts:[],requests:[],absences:[],absenceShift:null,absenceRequest:null,absenceUnavailable:false,acks:[],availability:[],weeklyRules:[],weeklyPreview:[],weeklyUnavailable:false,weeklyRequest:null,workerPrefs:[],prefsUnavailable:false,prefLoadedWorker:null,prefLoadedVersion:0,prefRequest:null,reminderPreview:null,reminderKey:null,options:[],error:'',busy:false,showForm:false,tab:'calendar',editing:null,report:null,template:null,batch:null,form:{mode:'single',first:today(),weeks:'2',days:'1,2,3,4,5',startTime:'07:00',endTime:'15:00',startTime2:'15:00',endTime2:'23:00',startTime3:'23:00',endTime3:'07:00',timezone:'America/Toronto',reportFrom:today(),reportTo:future(),calendarFrom:today(),calendarTo:future(),weeklyDays:'1,2,3,4,5',weeklyStart:'07:00',weeklyEnd:'15:00',weeklyFrom:today(),weeklyUntil:'',weeklyAvailable:'true',weeklyWorker:'',weeklyLocation:'',prefWorker:'',prefDesired:'',prefPeriods:'',prefWeekend:'flexible',prefVolunteer:'false',prefLastMinute:'false',prefExtra:'',contractMin:'',contractMax:'',contractSeniority:'',reminderWeek:nextIsoMonday(today()),reminderDue:nextIsoMonday(today()),reminderDepartment:''}};
 const manager=()=>['boss','admin'].includes(s.role),feature=f=>Array.isArray(s.entitlement.features)&&s.entitlement.features.includes(f);
 const canPlan=d=>manager()||(feature('supervisors')&&s.scopes.some(g=>g.active&&g.can_plan&&g.department_id===d));
 const anyPlan=()=>manager()||(feature('supervisors')&&s.scopes.some(g=>g.active&&g.can_plan));
 const btn=(text,action,extra='')=>`<button type="button" class="ess-btn" data-action="ess:plan-${action}" ${s.busy?'disabled':''} ${extra}>${text}</button>`;
 const field=(label,key,type='text',extra='')=>`<label class="ess-field">${label}<input id="plan-${key}" type="${type}" value="${e(s.form[key]??'')}" ${extra}></label>`;
 const select=(label,key,options)=>`<label class="ess-field">${label}<select id="plan-${key}">${options.map(([id,name])=>`<option value="${e(id)}" ${String(s.form[key]??'')===String(id)?'selected':''}>${e(name)}</option>`).join('')}</select></label>`;
 const locationSelect=key=>select('Établissement',key,s.locations.filter(l=>l.active).map(l=>[l.id,l.name+' · '+l.timezone]));
 const departments=(key,location)=>select('Département',key,[['','Aucun département'],...s.departments.filter(d=>d.active&&(!location||d.location_id===location)).map(d=>[d.id,d.name])]);
 const workerName=id=>s.roster.find(w=>w.id===id)?.name||s.workers.find(w=>w.id===id)?.first_name||'Salarié';
 const place=id=>s.locations.find(l=>l.id===id)?.name||'Établissement';
 const date=(value,zone='America/Toronto')=>new Intl.DateTimeFormat('fr-CA',{timeZone:zone,weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
 const local=(value,zone)=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));const p=Object.fromEntries(parts.map(p=>[p.type,p.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;};
 const val=key=>doc.getElementById('plan-'+key)?.value.trim()??s.form[key]??'';
 async function rpc(name,args){const r=await sb.rpc(name,args);if(r.error)throw r.error;return r.data;}
 async function rows(table){const r=await sb.from(table).select('*').eq('company_id',s.company);if(r.error)throw r.error;return Array.isArray(r.data)?r.data:[];}
 async function load(account,user,own,workers=[]){const revision=++generation;const company=account.company_id;if(s.company!==account.company_id||s.user!==user){s.feedUrl=null;s.feedStatus=null;s.absenceShift=null;s.absenceRequest=null;s.absences=[];s.weeklyRules=[];s.weeklyPreview=[];s.weeklyRequest=null;s.workerPrefs=[];s.prefLoadedWorker=null;s.prefLoadedVersion=0;s.prefRequest=null;s.form.prefWorker='';s.reminderPreview=null;s.reminderKey=null;}s.company=account.company_id;s.role=account.role;s.user=user;s.own=own;s.workers=workers;s.error='';
  const results=await Promise.all([rpc('essential_entitlements',{p_company:s.company}),rows('essential_locations'),rows('essential_departments'),rows('essential_supervisors'),rpc('essential_team_roster',{p_company:s.company}),sb.from('scheduled_shifts').select('*').eq('company_id',s.company).gt('ends_at',s.form.calendarFrom+'T00:00:00Z').lt('starts_at',s.form.calendarTo+'T00:00:00Z').order('starts_at').limit(1000),rows('essential_shift_requests'),rows('essential_availability'),rows('essential_schedule_templates')]);
  if(revision!==generation)return;s.entitlement=results[0]||{};s.locations=results[1];s.departments=results[2];s.scopes=results[3];s.roster=Array.isArray(results[4])?results[4]:[];
  if(results[5].error)throw results[5].error;s.shifts=Array.isArray(results[5].data)?results[5].data:[];s.requests=results[6];s.availability=results[7];s.templates=results[8];s.absences=[];s.absenceUnavailable=false;
  if(feature('advanced_schedules')){
   try{const reports=await rpc('list_essential_shift_absences',{p_company:s.company});if(revision!==generation)return;s.absences=Array.isArray(reports)?reports:[];}
   catch{s.absenceUnavailable=true;}
  }s.positions=[];s.positionAlerts=null;if(['boss','admin'].includes(s.role)&&Array.isArray(s.entitlement.features)&&s.entitlement.features.includes('minimum_coverage'))s.positions=await rows('essential_positions');if(revision!==generation)return;const ack=await sb.from('essential_shift_acknowledgements').select('*').eq('user_id',s.user);if(revision!==generation)return;if(ack.error)throw ack.error;s.acks=Array.isArray(ack.data)?ack.data:[];
  s.form.location ||= s.locations[0]?.id||'';s.form.orgLocation ||= s.locations[0]?.id||'';s.form.avLocation ||= s.locations[0]?.id||'';s.form.assignLocation ||= s.locations[0]?.id||'';s.form.posLocation ||= s.locations[0]?.id||'';s.form.weeklyLocation ||= s.locations[0]?.id||'';
  if(s.own){try{s.feedStatus=await rpc('personal_calendar_feed_status',{p_company:company});}catch{s.feedStatus={active:false,unavailable:true};}}else{s.feedStatus=null;s.feedUrl=null;}
  s.weeklyRules=[];s.weeklyPreview=[];s.weeklyUnavailable=false;
  if(feature('availability')){
   try{const [rules,preview]=await Promise.all([
     rpc('list_essential_weekly_availability',{p_company:company}),
     rpc('essential_availability_shift_preview',{p_company:company,p_from:s.form.calendarFrom+'T00:00:00Z',p_to:new Date(new Date(s.form.calendarFrom+'T00:00:00Z').getTime()+31*86400000).toISOString()})
   ]);if(revision!==generation)return;s.weeklyRules=Array.isArray(rules)?rules:[];s.weeklyPreview=Array.isArray(preview?.shifts)?preview.shifts:[];}
   catch{s.weeklyUnavailable=true;}
  }
  s.workerPrefs=[];s.prefsUnavailable=false;
  if(feature('availability')){
   try{const prefs=await rpc('list_essential_worker_schedule_preferences',{p_company:company});if(revision!==generation)return;s.workerPrefs=Array.isArray(prefs)?prefs:[];}
   catch{s.prefsUnavailable=true;}
   if(!manager()&&s.own&&s.prefLoadedWorker!==s.own)loadPrefsForm(s.own);
  }
  if(feature('shift_swaps')){const opts=await rpc('essential_swap_options',{p_company:company});if(revision!==generation)return;s.options=Array.isArray(opts)?opts:[];}else s.options=[];
 }
 async function reload(){await load({company_id:s.company,role:s.role},s.user,s.own,s.workers);}
 function renderOrganization(){return `<div class="plan-workspace"><h2>Établissements et départements</h2>${s.error?`<p class="ess-notice" role="alert">${e(s.error)}</p>`:''}<p class="ess-fine">Forfait : ${e(s.entitlement.title||'Essentiel')}${s.entitlement.simulated?' · environnement de test':''}</p><div class="ess-worker-layout"><section class="ess-panel"><h3>Établissements</h3>${s.locations.map(l=>`<article class="ess-person"><div><b>${e(l.name)}</b><small>${e(l.address)} · ${e(l.timezone)}</small></div></article>`).join('')}${manager()?`${field('Nom du nouvel établissement','locationName')}${field('Adresse','address')}${field('Fuseau IANA','timezone')}${btn('Créer l’établissement','location')}`:''}</section><section class="ess-panel"><h3>Départements</h3>${s.departments.map(d=>`<article class="ess-person"><div><b>${e(d.name)}</b><small>${e(place(d.location_id))}${feature('minimum_coverage')?' · minimum '+d.minimum_staff:''}</small></div>${manager()&&feature('minimum_coverage')?btn('Minimum','minimum',`data-id="${e(d.id)}"`):''}</article>`).join('')||'<p>Aucun département.</p>'}${manager()&&feature('departments')?`${locationSelect('orgLocation')}${field('Nom du département','departmentName')}${btn('Créer le département','department')}`:'<p class="ess-fine">Départements disponibles avec Plus et Pro.</p>'}</section></div>${manager()?renderAssignments():''}${manager()&&feature('minimum_coverage')?renderPositions():''}${s.role==='boss'&&feature('supervisors')?renderSupervisors():''}</div>`;}
 function renderAssignments(){return `<section class="ess-panel"><h3>Affecter un salarié</h3><div class="ess-form-grid">${select('Salarié','assignWorker',s.roster.map(w=>[w.id,w.name]))}${locationSelect('assignLocation')}${departments('assignDepartment',s.form.assignLocation)}</div>${btn('Enregistrer l’affectation','assign')}</section>`;}
 function renderPositions(){return `<section class="ess-panel"><h3>Postes exclusifs · Pro</h3><p class="ess-fine">Un seul quart à la fois par poste. Une qualification peut être exigée. Chaque quart peut recevoir un poste sans changer ses heures.</p>
 <div class="ess-form-grid">${locationSelect('posLocation')}${departments('posDepartment',s.form.posLocation)}${field('Nom du poste','posTitle')}${field('Certification requise (facultative)','posCertificate')}${field('Motif de configuration','posReason')}</div>${btn('Créer un poste','pos-create')}
 <h4>Postes actifs</h4>${s.positions.filter(p=>p.active).map(p=>`<p><b>${e(p.title)}</b> · ${e(place(p.location_id))}${p.required_certificate?' · Certificat : '+e(p.required_certificate):''} · v${Number(p.version)} ${btn('Désactiver','pos-disable',`data-id="${e(p.id)}"`)} </p>`).join('')||'<p>Aucun poste créé.</p>'}
 <h4>Alertes de certification</h4><p class="ess-fine">Contrôle en lecture seule des 90 prochains jours. Aucune modification automatique des quarts.</p>
 ${btn('Vérifier les certifications des postes','pos-alerts')}
 ${s.positionAlerts?`<div role="status"><p>${s.positionAlerts.count} quart(s) avec certification requise non valide.</p>${s.positionAlerts.truncated?'<p>Plus de 200 alertes : filtrage nécessaire.</p>':''}${(s.positionAlerts.items||[]).map(a=>`<p><b>${e(a.position_title)}</b> · ${e(workerName(a.worker_id))} · ${e(a.certificate_title)} · ${e(date(a.starts_at))} → ${e(date(a.ends_at))}</p>`).join('')}</div>`:''}
 </section>`;}
 function renderSupervisors(){return `<section class="ess-panel"><h3>Superviseurs autorisés</h3><p class="ess-fine">Accès limité au département. Aucun accès aux salaires ou aux contacts privés.</p>${s.scopes.map(g=>`<article class="ess-person"><div><b>${e(s.workers.find(w=>w.auth_user_id===g.user_id)?.first_name||g.user_id.slice(0,8))}</b><small>${e(s.departments.find(d=>d.id===g.department_id)?.name||'Département')} · ${g.can_plan?'Planification autorisée':'Consultation'} · ${g.active?'Actif':'Révoqué'}</small></div>${g.active?`<div><label class="ess-check"><input id="plan-approve-time-${e(g.department_id)}-${e(g.user_id)}" type="checkbox" ${(s.form['approve-time-'+g.department_id+'-'+g.user_id]??g.can_approve_time)?'checked':''}>Approuver les heures</label><label class="ess-check"><input id="plan-approve-leave-${e(g.department_id)}-${e(g.user_id)}" type="checkbox" ${(s.form['approve-leave-'+g.department_id+'-'+g.user_id]??g.can_approve_leave)?'checked':''}>Approuver les congés</label>${btn('Enregistrer les approbations','supervisor-approvals',`data-user="${e(g.user_id)}" data-department="${e(g.department_id)}" data-version="${g.approval_version}"`)}${btn('Révoquer','revoke-supervisor',`data-user="${e(g.user_id)}" data-department="${e(g.department_id)}"`)}</div>`:''}</article>`).join('')}<div class="ess-form-grid">${select('Membre avec compte personnel','supervisorUser',s.workers.filter(w=>w.auth_user_id&&['employee','lead'].includes(w.role)).map(w=>[w.auth_user_id,w.first_name+' '+w.last_name]))}${select('Département','supervisorDepartment',s.departments.map(d=>[d.id,d.name]))}${select('Permission','supervisorPermission',[['read','Consultation'],['plan','Planifier les quarts']])}</div>${btn('Autoriser ce superviseur','supervisor')}${field('Motif de modification des approbations','approvalReason')}</section>`;}
 function renderSchedule(){const tabs=[['calendar','Horaire'],...(feature('availability')?[['availability','Disponibilités']]:[]),...(feature('shift_swaps')?[['requests','Demandes']]:[]),...(manager()?[['report','Prévu / réel']]:[])];return `<div class="plan-workspace"><div class="ess-pricing-head"><h2>${manager()?'Planification':anyPlan()?'Horaire et supervision':'Mon horaire'}</h2>${anyPlan()?btn(s.showForm?'Fermer le formulaire':'Planifier un quart','toggle'):''}</div><nav class="plan-tabs" aria-label="Horaire">${tabs.map(([id,name])=>btn(name,'tab',`data-id="${id}" aria-pressed="${s.tab===id}"`)).join('')}</nav>${manager()&&feature('minimum_coverage')?field('Motif du poste','posReason'):''}${s.error?`<p class="ess-notice" role="alert">${e(s.error)}</p>`:''}${s.showForm&&anyPlan()?renderShiftForm():''}${s.scopes.some(g=>g.active)?'<section class="ess-panel"><h3>Présences de mon équipe</h3>'+s.roster.map(w=>'<p>'+e(w.name)+' · '+(w.working?(w.paused?'En pause':'Au travail'):'Non pointé')+'</p>').join('')+'</section>':''}${s.tab==='availability'?renderAvailability():s.tab==='requests'?renderRequests():s.tab==='report'?renderReport():renderCalendar()}</div>`;}
 function renderTemplates(){return feature('advanced_schedules')?`<section class="ess-panel"><h3>Modèles réutilisables</h3><p>Un modèle ne publie aucun quart. Charger, vérifier les dates et le salarié, puis publier l’horaire.</p>${s.templates.filter(t=>t.active).map(t=>`<article><b>${e(t.name)}</b> · v${t.version} ${btn('Charger','template-load',`data-id="${e(t.id)}"`)}${btn('Archiver','template-archive',`data-id="${e(t.id)}"`)}</article>`).join('')||'<p>Aucun modèle enregistré.</p>'}${field('Nom du modèle','templateName')}${s.template?btn('Mettre à jour le modèle chargé','template-update'):''}${btn('Enregistrer le cycle comme nouveau modèle','template-save')}</section>`:'';}
 function renderShiftForm(){return `<section class="ess-panel"><h3>${s.editing?'Modifier le quart · version '+s.editing.version:'Nouveau quart'}</h3><div class="ess-form-grid">${select('Salarié','worker',[...(feature('advanced_schedules')?[['','Quart à combler']]:[]),...s.roster.filter(w=>w.status==='active').map(w=>[w.id,w.name])])}${locationSelect('location')}${departments('department',s.form.location)}${select('Organisation','mode',[['single','Quart unique'],...(feature('advanced_schedules')?[['weekly','Récurrence hebdomadaire'],['rotate2','Rotation jour / soir · 2 semaines'],['rotate3','Rotation jour / soir / nuit · 3 semaines']]:[])])}</div><p class="ess-fine">Les heures ci-dessous sont celles de l’établissement (${e(s.locations.find(l=>l.id===s.form.location)?.timezone||'America/Toronto')}). Les heures ambiguës aux changements saisonniers sont refusées.</p>${s.form.mode==='single'?`<div class="ess-form-grid">${field('Début local','start','datetime-local')}${field('Fin locale (date suivante pour la nuit)','end','datetime-local')}${field('Note','note')}</div>`:`<div class="ess-form-grid">${field('Premier jour du cycle','first','date')}${field('Semaines / nombre de cycles','weeks','number','min="1" max="26"')}${field('Jours ISO (1=lundi, 7=dimanche)','days','text')}${field('Début · semaine A','startTime','time')}${field('Fin · semaine A','endTime','time')}${s.form.mode!=='weekly'?field('Début · semaine B','startTime2','time')+field('Fin · semaine B','endTime2','time'):''}${s.form.mode==='rotate3'?field('Début · semaine C','startTime3','time')+field('Fin · semaine C','endTime3','time'):''}</div>`}${btn(s.busy?'Enregistrement…':s.editing?'Publier la modification':'Publier l’horaire','publish')}</section>${!s.editing?renderTemplates():''}`;}
 function renderAbsenceForm(){
  if(!s.absenceShift||s.absenceUnavailable)return '';
  const shift=s.shifts.find(x=>x.id===s.absenceShift);
  if(!canReportShift(shift,s.own,absenceForShift(s.absences,s.absenceShift)))return '';
  return `<section class="ess-panel" aria-label="Signaler mon absence"><h3>Signaler mon absence</h3>
  <p>Quart du ${e(date(shift.starts_at,shift.timezone))} au ${e(date(shift.ends_at,shift.timezone))}.</p>
  <p class="ess-fine">Votre responsable sera averti. Aucun pointage, congé ou salaire ne sera modifié automatiquement. Votre motif et votre précision restent privés.</p>
  ${select('Motif (aucun choix présélectionné)','absenceReason',[['','Choisir un motif'],...ABSENCE_REASONS])}
  ${field('Précision facultative (400 caractères max)','absenceNote','text','maxlength="400"')}
  ${btn('Confirmer mon absence','absence-report',`data-id="${e(shift.id)}"`)}
  ${btn('Annuler','absence-cancel')}</section>`;
 }
 function renderAbsenceControls(shift){
  if(!feature('advanced_schedules')||s.absenceUnavailable)return '';
  const report=absenceForShift(s.absences,shift.id);
  if(report){
   return `<p role="status">${e(absenceStatus(report.status))}</p>`+
    (manager()&&report.status==='reported'&&report.worker_id!==s.own?
      btn('Pris en charge','absence-review',`data-id="${e(report.id)}" data-decision="acknowledged"`)+
      btn('Suivi requis','absence-review',`data-id="${e(report.id)}" data-decision="follow_up"`):'');
  }
  return canReportShift(shift,s.own,false)?btn('Signaler mon absence','absence-open',`data-id="${e(shift.id)}"`):'';
 }
 function renderCalendar(){const visible=s.shifts.filter(x=>!x.cancelled_at).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));return `<section class="ess-panel"><h3>Quarts publiés</h3>${renderAbsenceForm()}${s.own?btn('Télécharger mon horaire (.ics)','export-ics')+'<p class="ess-fine">Export personnel de la période affichée, compatible avec les applications Calendrier. Fichier instantané : les changements futurs ne se synchronisent pas automatiquement.</p>':''}
 ${s.own?`<details class="ess-panel"><summary>Synchroniser mon horaire avec mon calendrier</summary>
 <p class="ess-fine">Lien privé iCalendar compatible avec les calendriers qui acceptent un abonnement par URL. Les mises à jour dépendent de la fréquence de synchronisation du calendrier.</p>
 <p class="ess-fine"><b>Confidentialité :</b> toute personne détenant le lien pourra consulter vos quarts jusqu'à sa révocation. Ne le publiez pas.</p>
 ${s.feedStatus?.active?'<p>Lien de calendrier actif.</p>':'<p>Aucun lien actif.</p>'}
 ${s.feedStatus?.unavailable?'<p>Service indisponible pour ce dossier salarié.</p>':''}
 ${btn('Créer ou renouveler le lien privé','feed-rotate')}
 ${s.feedStatus?.active?btn('Révoquer le lien','feed-revoke'):''}
 ${s.feedUrl?`<label class="ess-field">Copiez ce lien maintenant — il ne sera pas réaffiché<input readonly aria-label="Lien privé calendrier" value="${e(s.feedUrl)}"></label>${btn('Copier le lien','feed-copy')}`:''}
 </details>`:''}<div class="ess-form-grid">${field('Du (UTC)','calendarFrom','date')}${field('Au exclusif (UTC)','calendarTo','date')}</div>${btn('Afficher cette période','reload')}${s.shifts.length>=1000?'<p class="ess-notice">Limite de 1 000 quarts : réduisez la période pour consulter tous les résultats.</p>':''}${!visible.length?'<p>Aucun quart planifié.</p>':''}${visible.map(x=>`<article class="plan-shift"><div><b>${x.worker_id?e(workerName(x.worker_id)):'Quart disponible'}</b><small>${e(date(x.starts_at,x.timezone))} → ${e(date(x.ends_at,x.timezone))}</small><small>${e(place(x.location_id))}${x.department_id?' · '+e(s.departments.find(d=>d.id===x.department_id)?.name||'Département'):''}${x.position_id?' · Poste : '+e(s.positions.find(p=>p.id===x.position_id)?.title||'Poste exclusif'):''} · v${x.version}</small><p>${e(x.note||'')}</p></div><div class="plan-actions">${canPlan(x.department_id)?btn('Modifier','edit',`data-id="${e(x.id)}"`)+btn('Annuler','cancel',`data-id="${e(x.id)}"`)+(manager()&&feature('minimum_coverage')?select('Poste exclusif','pos-'+x.id,[['','Aucun poste'],...s.positions.filter(p=>p.active&&p.location_id===x.location_id&&(!p.department_id||p.department_id===x.department_id)).map(p=>[p.id,p.title])])+btn('Affecter le poste','pos-assign',`data-id="${e(x.id)}"`):''):''}${x.user_id===s.user?(s.acks.some(a=>a.shift_id===x.id&&a.version===x.version)?'<span class="ess-badge">Lecture confirmée</span>':btn('Confirmer la lecture','ack',`data-id="${e(x.id)}"`)):''}${renderAbsenceControls(x)}${feature('shift_swaps')&&new Date(x.starts_at)>new Date()?(x.worker_id===s.own?btn('Demander un remplacement','release',`data-id="${e(x.id)}"`)+select('Proposer un échange','swap-'+x.id,[['','Choisir le quart du collègue'],...s.options.filter(o=>o.location_id===x.location_id&&o.department_id===x.department_id).map(o=>[o.id,o.name+' · '+date(o.starts_at,x.timezone)])])+btn('Proposer l’échange','swap',`data-id="${e(x.id)}"`):x.worker_id===null?btn('Me proposer pour ce quart','claim',`data-id="${e(x.id)}"`):''):''}</div></article>`).join('')}</section>`;}
 function loadPrefsForm(worker){
  const row=s.workerPrefs.find(p=>p.worker_id===worker);
  s.prefLoadedWorker=worker;s.prefLoadedVersion=Number(row?.version||0);s.prefRequest=null;
  Object.assign(s.form,{prefWorker:worker,prefDesired:row?.desired_weekly_hours??'',
   prefPeriods:Array.isArray(row?.preferred_periods)?row.preferred_periods.join(','):'',
   prefWeekend:row?.weekend_preference||'flexible',
   prefVolunteer:String(row?.overtime_volunteer===true),
   prefLastMinute:String(row?.last_minute_volunteer===true),
   prefExtra:row?.desired_extra_weekly_hours??'',
   contractMin:row?.contracted_min_weekly_hours??'',
   contractMax:row?.contracted_max_weekly_hours??'',
   contractSeniority:row?.seniority_from||''});
 }
 function renderAvailabilityReminders(){
  if(!manager()||!feature('availability'))return '';
  const departments=[['','Toute la compagnie'],...s.departments.filter(d=>d.active).map(d=>[d.id,d.name])];
  return `<section class="ess-panel"><h3>Demander les disponibilités de la semaine</h3>
   <p class="ess-fine">Aperçu avant envoi. Seuls les employés actifs qui n’ont aucune règle hebdomadaire ni exception datée pour cette semaine sont ciblés. Une seule notification interne par salarié et par semaine; aucun SMS et aucune modification aux quarts. Les salariés sans compte ne peuvent pas recevoir de notification.</p>
   <div class="ess-form-grid">
    ${field('Semaine du (lundi)','reminderWeek','date')}
    ${field('Date limite de réponse','reminderDue','date')}
    ${select('Département','reminderDepartment',departments)}
   </div>
   ${btn('Prévisualiser les rappels','reminder-preview')}
   ${s.reminderPreview?`<p role="status">${e(reminderResultLabel(s.reminderPreview))}</p>
    ${!s.reminderPreview.confirmed&&s.reminderPreview.pending>0?btn('Confirmer l’envoi interne','reminder-send'):''}`:''}
   </section>`;
 }
 function renderWorkerPreferences(){
  if(!feature('availability'))return '';
  if(s.prefsUnavailable)return '<p role="alert">Préférences personnelles temporairement indisponibles.</p>';
  const worker=manager()?s.form.prefWorker:s.own;
  const row=s.workerPrefs.find(p=>p.worker_id===worker);
  const loaded=!!worker&&s.prefLoadedWorker===worker;
  return `<section class="ess-panel"><h3>Mes préférences de travail</h3>
  <p class="ess-fine">Ces choix sont des souhaits, pas une promesse de quart, une limite légale, une heure gagnée ni une banque de temps. Les qualifications viennent du dossier RH.</p>
  ${manager()?select('Dossier salarié','prefWorker',[['','Choisir un salarié'],...s.workers.filter(w=>w.status==='active').map(w=>[w.id,[w.first_name,w.last_name].filter(Boolean).join(' ')])])+btn('Charger le dossier','pref-load'):''}
  ${loaded?`<div class="ess-form-grid">
   ${field('Heures souhaitées par semaine (facultatif)','prefDesired','number','min="0" max="80" step="0.25"')}
   ${select('Préférence de quart','prefPeriods',PERIOD_CHOICES)}
   ${select('Fin de semaine','prefWeekend',WEEKEND_CHOICES)}
   ${select('Volontaire pour des quarts supplémentaires','prefVolunteer',[['false','Non'],['true','Oui']])}
   ${select('Disponible à la dernière minute','prefLastMinute',[['false','Non'],['true','Oui']])}
   ${field('Heures supplémentaires souhaitées, non acquises','prefExtra','number','min="0" max="40" step="0.25"')}
   </div>${btn('Enregistrer mes préférences','pref-save')}
   <p class="ess-fine">Préférences enregistrées : ${e(periodLabel(row?.preferred_periods))}. 
   Certifications RH : ${(row?.certifications||[]).map(v=>e(v.title)+(v.expires_on?' (expiration '+e(v.expires_on)+')':'')).join(', ')||'Aucune renseignée'}.</p>
   ${manager()?`<h4>Informations du responsable</h4><p class="ess-fine">Ancienneté et min/max déclarés par l’entreprise. Ils ne créent aucune règle légale automatique.</p>
   <div class="ess-form-grid">${field('Date d’ancienneté connue','contractSeniority','date')}
   ${field('Minimum hebdomadaire déclaré','contractMin','number','min="0" max="80" step="0.25"')}
   ${field('Maximum hebdomadaire déclaré','contractMax','number','min="0" max="80" step="0.25"')}</div>
   ${btn('Enregistrer les informations du responsable','contract-save')}`:''}
   `:'<p>Choisissez un salarié et chargez son dossier.</p>'}</section>`;
 }
 function renderWeeklyAvailability(){
  if(!feature('availability'))return '';
  if(s.weeklyUnavailable)return '<section class="ess-panel"><p role="alert">Les disponibilités récurrentes sont temporairement indisponibles. Vos exceptions datées restent disponibles.</p></section>';
  const personnel=manager()?select('Salarié (y compris sans téléphone)','weeklyWorker',[['','Choisir un salarié'],...s.workers.filter(w=>w.status==='active').map(w=>[w.id,[w.first_name,w.last_name].filter(Boolean).join(' ')])]):'';
  const rules=s.weeklyRules.filter(r=>manager()||r.worker_id===s.own);
  const preview=s.weeklyPreview.filter(p=>manager()||p.worker_id===s.own);
  return `<section class="ess-panel"><h3>Ma semaine type</h3>
  <p class="ess-fine">Une règle s’applique chaque semaine aux jours sélectionnés. Ajouter plusieurs règles pour des plages distinctes. Les exceptions datées et congés approuvés restent prioritaires. Aucun quart publié n’est modifié.</p>
  <div class="ess-form-grid">${personnel}${locationSelect('weeklyLocation')}
  ${field('Jours (1=lun, 7=dim, séparés par des virgules)','weeklyDays')}
  ${field('Début de plage','weeklyStart','time')}${field('Fin de plage','weeklyEnd','time')}
  ${field('À partir du','weeklyFrom','date')}${field('Jusqu’au (facultatif)','weeklyUntil','date')}
  ${select('Statut hebdomadaire','weeklyAvailable',[['true','Disponible'],['false','Indisponible']])}</div>
  ${btn('Ajouter cette règle','weekly-save')}
  <h4>Règles actives</h4>
  ${rules.map(r=>`<article class="plan-shift"><div><b>${e(weeklyDaysLabel(r.days))} · ${e(r.starts_local)}–${e(r.ends_local)}</b>
    <small>${r.available?'Disponible':'Indisponible'} · ${e(place(r.location_id))} · du ${e(r.effective_from)} ${r.effective_until?'au '+e(r.effective_until):'(sans fin)'} · v${r.version}</small>
    ${manager()?`<small>${e(workerName(r.worker_id))}</small>`:''}
    </div>${btn('Retirer la règle','weekly-remove',`data-id="${e(r.id)}" data-version="${r.version}"`)}</article>`).join('')||'<p>Aucune semaine type définie; disponibilité inconnue.</p>'}
  <h4>Vérification des quarts publiés (31 jours)</h4>
  <p class="ess-fine">Un état « Inconnu » ne signifie pas disponible. Un conflit n’annule pas le quart.</p>
  ${preview.map(p=>`<p class="${p.conflict?'ess-notice':'ess-fine'}">
   ${e(date(p.starts_at))} · ${manager()?e(workerName(p.worker_id))+' · ':''}
   ${e(weeklyPreviewLabel(p))}${p.conflict?' · Conflit à examiner':''} (${e(p.source)})
  </p>`).join('')||'<p>Aucun quart dans cette période.</p>'}</section>`;
 }
 function renderAvailability(){return `<div>${renderAvailabilityReminders()}${renderWorkerPreferences()}${renderWeeklyAvailability()}<section class="ess-panel"><h3>Exceptions datées</h3><p class="ess-fine">Une indisponibilité déclarée ne supprime pas un quart déjà publié. Prévenez votre responsable pour le faire modifier.</p><div class="ess-form-grid">${locationSelect('avLocation')}${field('Du (heure locale)','avStart','datetime-local')}${field('Au (heure locale)','avEnd','datetime-local')}${select('Statut','available',[['false','Indisponible'],['true','Disponible']])}${field('Note facultative','avNote')}</div>${btn('Enregistrer','availability')}${s.availability.map(a=>`<article class="ess-person"><div><b>${e(workerName(a.worker_id))} · ${a.available?'Disponible':'Indisponible'}</b><small>${e(date(a.starts_at))} → ${e(date(a.ends_at))}</small></div>${a.worker_id===s.own?btn('Retirer','remove-availability',`data-id="${e(a.id)}"`):''}</article>`).join('')}</section></div>`;}
 function renderRequests(){const labels={claim:'Prise de quart vacant',release:'Remplacement demandé',swap:'Échange de quarts'},statuses={pending:'En attente',accepted:'Accord du collègue reçu',approved:'Approuvée',rejected:'Refusée',cancelled:'Annulée'};return `<section class="ess-panel"><h3>Demandes de changement</h3>${anyPlan()?field('Motif de décision obligatoire','decisionNote'):''}${s.requests.map(r=>{const source=s.shifts.find(x=>x.id===r.shift_id);return `<article class="plan-shift"><div><b>${labels[r.kind]||e(r.kind)} · ${e(workerName(r.worker_id))}</b><small>${source?e(date(source.starts_at,source.timezone)):''} · ${statuses[r.status]||e(r.status)}</small>${r.review_note?`<p>${e(r.review_note)}</p>`:''}</div><div class="plan-actions">${r.status==='pending'&&r.other_worker_id===s.own?btn('Accepter la proposition','accept-swap',`data-id="${e(r.id)}"`)+btn('Refuser la proposition','decline-swap',`data-id="${e(r.id)}"`):''}${['pending','accepted'].includes(r.status)&&canPlan(source?.department_id)&&r.worker_id!==s.own&&r.other_worker_id!==s.own?btn('Approuver','approve',`data-id="${e(r.id)}"`)+btn('Refuser','reject',`data-id="${e(r.id)}"`):''}${['pending','accepted'].includes(r.status)&&r.worker_id===s.own?btn('Annuler ma demande','cancel-request',`data-id="${e(r.id)}"`):''}</div></article>`;}).join('')||'<p>Aucune demande.</p>'}</section>`;}
 function renderReport(){const r=s.report;return `<section class="ess-panel"><h3>Heures brutes prévues et réelles</h3><div class="ess-form-grid">${field('Du (date ISO)','reportFrom','date')}${field('Au (date de fin exclusive)','reportTo','date')}</div><p class="ess-fine">Période UTC, maximum 31 jours. Les durées sont brutes et ne constituent pas une paie calculée.</p>${btn('Calculer le rapport','report')}${r?`<div class="ess-metrics"><div><small>Planifiées</small><strong>${(r.planned_gross_ms/3600000).toFixed(2)} h</strong></div><div><small>Réelles</small><strong>${(r.actual_gross_ms/3600000).toFixed(2)} h</strong></div></div><p>${r.vacant_shifts} quart(s) à combler</p>${r.coverage_included?`<h3>Couverture insuffisante</h3><p class="ess-fine">Minimum configuré appliqué sur toute la période sélectionnée; choisir vos heures d’ouverture pour éviter les alertes hors activité.</p>${r.coverage_gaps.map(g=>`<p>${e(g.name)} · ${e(date(g.starts_at))} → ${e(date(g.ends_at))} : ${g.staffed}/${g.minimum_staff}</p>`).join('')||'<p>Aucun manque dans cette période.</p>'}`:'<p class="ess-fine">Couverture minimale disponible avec Pro.</p>'}`:''}</section>`;}
 function edit(id){const x=s.shifts.find(x=>x.id===id);if(!x)return;s.editing={id:x.id,version:x.version};Object.assign(s.form,{worker:x.worker_id||'',location:x.location_id,department:x.department_id||'',mode:'single',start:local(x.starts_at,x.timezone),end:local(x.ends_at,x.timezone),note:x.note});s.showForm=true;s.tab='calendar';}
 async function handle(el){if(s.busy)return true;const a=el.dataset.action.slice(9),id=el.dataset.id;s.error='';
  if(a==='feed-rotate'||a==='feed-revoke'||a==='feed-copy'){
    try{
     if(!s.own)throw Error('Un compte salarié personnel est requis.');
     if(a==='feed-copy'){if(!s.feedUrl)throw Error('Aucun lien à copier.');await doc.defaultView.navigator.clipboard.writeText(s.feedUrl);notify('Lien privé copié. Ne le partagez pas publiquement.');}
     else{
      const msg=a==='feed-rotate'?'Créer ou renouveler ce lien ? L’ancien sera immédiatement invalidé.':'Révoquer ce lien ? Votre calendrier ne sera plus synchronisé.';
      if(!doc.defaultView.confirm(msg))return true;
      const result=await rpc(a==='feed-rotate'?'personal_calendar_feed_rotate':'personal_calendar_feed_revoke',{p_company:s.company});
      if(a==='feed-rotate'){
       const base=String(sb.supabaseUrl||'').replace(/\/$/,'');
       if(!/^https:\/\//.test(base))throw Error('Serveur calendrier non configuré.');
       s.feedUrl=base+'/functions/v1/essential-calendar?token='+result.token;s.feedStatus={active:true};
       notify('Lien privé créé. Copiez-le : il ne sera affiché qu’une fois.');
      }else{s.feedStatus={active:false};s.feedUrl=null;notify('Lien de calendrier révoqué.');}
     }
    }catch(err){s.error=err.message;notify(s.error);}
    redraw();return true;
   }
  if(a==='export-ics'){
    try{
     if(s.shifts.length>=1000)throw Error('Période trop grande : réduisez les dates pour exporter un horaire complet.');
     const result=buildPersonalCalendar({companyId:s.company,workerId:s.own,companyName:'PUNCH Essentiel',shifts:s.shifts,locations:s.locations});
     if(!result.count)throw Error('Aucun quart personnel publié dans la période affichée.');
     exportIcs({content:result.content,document:doc});
     notify(result.count+' quart(s) personnels exportés. Importation manuelle, sans synchronisation automatique.');
    }catch(err){s.error=err.message;notify(s.error);}
    redraw();return true;
   }
  if(a==='absence-open'){const shift=s.shifts.find(x=>x.id===id),already=absenceForShift(s.absences,id);if(!feature('advanced_schedules')||s.absenceUnavailable||!canReportShift(shift,s.own,already)){s.error='Ce quart ne peut plus être signalé.';}else{s.absenceShift=id;s.form.absenceReason='';s.form.absenceNote='';s.absenceRequest=null;}redraw();return true;}
  if(a==='absence-cancel'){s.absenceShift=null;s.absenceRequest=null;redraw();return true;}
  if(a==='template-load'){const t=s.templates.find(t=>t.id===id&&t.active);if(!t)return true;Object.assign(s.form,scheduleTemplateForm(t));s.template=t;s.batch=null;s.editing=null;s.showForm=true;redraw();return true;}if(a==='toggle'){s.showForm=!s.showForm;s.editing=null;redraw();return true;}if(a==='tab'){s.tab=id;redraw();return true;}if(a==='edit'){edit(id);redraw();return true;}
  s.busy=true;try{
   if(a==='template-save'||a==='template-update'){await rpc('save_essential_schedule_template',{p_company:s.company,p_location:val('location'),p_department:val('department')||null,p_name:val('templateName'),p_configuration:scheduleTemplateConfiguration(s.form),p_template:a==='template-update'?s.template?.id:null,p_expected_version:a==='template-update'?s.template?.version:null});s.template=null;notify('Modèle enregistré; aucun quart publié.');}
   else if(a==='template-archive'){const t=s.templates.find(t=>t.id===id);await rpc('archive_essential_schedule_template',{p_template:id,p_expected_version:t.version});}
   else if(a==='absence-report'){
    const shift=s.shifts.find(x=>x.id===id);
    if(s.absenceShift!==id||!canReportShift(shift,s.own,absenceForShift(s.absences,id)))throw Error('Ce quart ne peut plus être signalé.');
    const payload=prepareAbsence(val('absenceReason'),val('absenceNote'));
    if(!doc.defaultView.confirm('Confirmer mon absence pour ce quart ? Aucun pointage ni congé payé ne sera automatiquement modifié.'))return true;
    if(!s.absenceRequest||s.absenceRequest.shift!==id)s.absenceRequest={shift:id,id:crypto.randomUUID()};
    await rpc('report_essential_shift_absence',{p_shift:id,p_expected_version:shift.version,...payload,p_request:s.absenceRequest.id});
    s.absenceShift=null;s.absenceRequest=null;notify('Absence signalée. Le responsable a reçu une notification.');
   }
   else if(a==='absence-review'){
    const report=s.absences.find(x=>x.id===id);
    if(!report||!manager()||report.status!=='reported'||report.worker_id===s.own)throw Error('Décision non autorisée.');
    const decision=el.dataset.decision;
    if(!['acknowledged','follow_up'].includes(decision))throw Error('Décision invalide.');
    await rpc('review_essential_shift_absence',{p_absence:id,p_decision:decision});
    notify('Signalement pris en charge. Le salarié a été informé.');
   }
   else if(a==='location'){await rpc('save_essential_location',{p_company:s.company,p_name:val('locationName'),p_address:val('address'),p_timezone:val('timezone')});}
   else if(a==='department'){await rpc('save_essential_department',{p_company:s.company,p_location:val('orgLocation'),p_name:val('departmentName')});}
   else if(a==='assign'){await rpc('assign_essential_worker',{p_worker:val('assignWorker'),p_location:val('assignLocation'),p_department:val('assignDepartment')||null});}
   else if(a==='supervisor-approvals'){const scope=el.dataset.department+'-'+el.dataset.user,time=doc.getElementById('plan-approve-time-'+scope),leave=doc.getElementById('plan-approve-leave-'+scope);if(!time||!leave)throw Error('Actualiser les permissions');await rpc('set_supervisor_approvals',{p_company:s.company,p_department:el.dataset.department,p_user:el.dataset.user,p_time:time.checked,p_leave:leave.checked,p_expected_version:Number(el.dataset.version),p_reason:val('approvalReason')});delete s.form['approve-time-'+scope];delete s.form['approve-leave-'+scope];}
   else if(a==='supervisor'||a==='revoke-supervisor'){await rpc('set_essential_supervisor',{p_company:s.company,p_department:a==='supervisor'?val('supervisorDepartment'):el.dataset.department,p_user:a==='supervisor'?val('supervisorUser'):el.dataset.user,p_can_plan:a==='supervisor'&&val('supervisorPermission')==='plan',p_active:a==='supervisor'});}
   else if(a==='pos-alerts'){
    const start=new Date(),end=new Date(start.getTime()+90*86400000);
    s.positionAlerts=await rpc('essential_position_certification_alerts',{p_company:s.company,p_start:start.toISOString(),p_end:end.toISOString()});
    return true;
   }
   else if(a==='pos-create'){await rpc('save_essential_position',{p_company:s.company,p_location:val('posLocation'),p_department:val('posDepartment')||null,p_title:val('posTitle'),p_certificate:val('posCertificate')||null,p_active:true,p_id:null,p_expected_version:0,p_reason:val('posReason')});notify('Poste exclusif créé.');}
   else if(a==='pos-disable'){const p=s.positions.find(p=>p.id===id);if(!p)throw Error('Poste inconnu');if(!doc.defaultView.confirm('Désactiver ce poste ? Les quarts futurs doivent d’abord être désaffectés.'))return true;await rpc('save_essential_position',{p_company:s.company,p_location:p.location_id,p_department:p.department_id,p_title:p.title,p_certificate:p.required_certificate,p_active:false,p_id:p.id,p_expected_version:p.version,p_reason:val('posReason')});notify('Poste désactivé.');}
   else if(a==='pos-assign'){const x=s.shifts.find(x=>x.id===id);if(!x)throw Error('Quart inconnu');await rpc('assign_essential_position',{p_company:s.company,p_shift:id,p_position:val('pos-'+id)||null,p_expected_version:x.version,p_reason:val('posReason')});notify('Affectation mise à jour.');}
   else if(a==='minimum'){const value=doc.defaultView.prompt('Minimum de personnes requises pour ce département');if(value===null)return true;const n=Number(value);if(!Number.isSafeInteger(n)||n<0)throw Error('Nombre entier positif ou nul requis.');await rpc('set_essential_minimum_staff',{p_department:id,p_minimum:n});}
   else if(a==='publish'){
    const base={p_company:s.company,p_worker:val('worker')||null,p_location:val('location'),p_department:val('department')||null},mode=val('mode');
    if(mode==='single'){if(!val('start')||!val('end'))throw Error('Début et fin requis.');await rpc('save_essential_local_shift',{...base,p_start_local:val('start'),p_end_local:val('end'),p_note:val('note'),p_shift:s.editing?.id||null,p_expected_version:s.editing?.version??null});}
    else{
     const days=String(val('days')).split(',').map(x=>Number(x.trim()));const weeks=Number(val('weeks'));if(days.some(d=>!Number.isInteger(d)||d<1||d>7)||!Number.isInteger(weeks)||weeks<1||weeks>26)throw Error('Jours 1 à 7 et nombre de semaines valides requis.');
     const params=mode==='weekly'?{...base,p_first:val('first'),p_weeks:weeks,p_weekdays:days,p_start:val('startTime'),p_end:val('endTime'),p_note:val('note')}:{...base,p_first:val('first'),p_cycle_days:mode==='rotate3'?21:14,p_cycles:weeks,p_pattern:Array.from({length:mode==='rotate3'?3:2},(_,week)=>days.map(d=>({day:week*7+d-1,start:val('startTime'+(week?week+1:'')),end:val('endTime'+(week?week+1:''))}))).flat()};
     if(mode!=='weekly'&&new Date(val('first')+'T12:00:00Z').getUTCDay()!==1)throw Error('Choisissez un lundi comme premier jour du cycle de rotation.');const key=JSON.stringify(params);if(s.batch?.key!==key)s.batch={key,id:crypto.randomUUID()};await rpc(mode==='weekly'?'repeat_essential_shifts':'rotate_essential_shifts',{...params,p_request:s.batch.id});s.batch=null;
    }s.showForm=false;s.editing=null;notify('Horaire publié. Les salariés avec compte reçoivent une notification interne.');
   }else if(a==='cancel'){const x=s.shifts.find(x=>x.id===id),reason=doc.defaultView.prompt('Motif de l’annulation');if(reason===null)return true;await rpc('cancel_essential_shift',{p_shift:id,p_expected_version:x.version,p_reason:reason});}
   else if(a==='ack'){await rpc('acknowledge_essential_shift',{p_shift:id,p_version:s.shifts.find(x=>x.id===id).version});notify('Lecture confirmée pour cette version.');}
   else if(['claim','release','swap'].includes(a)){const other=a==='swap'?val('swap-'+id):null;if(a==='swap'&&!other)throw Error('Choisissez un quart à proposer.');await rpc('request_essential_shift_change',{p_shift:id,p_kind:a,p_other:other});s.tab='requests';notify('Demande enregistrée. L’horaire reste inchangé avant approbation.');}
   else if(a==='accept-swap'||a==='decline-swap')await rpc('answer_essential_swap',{p_request:id,p_accept:a==='accept-swap'});
   else if(a==='approve'||a==='reject'){if(val('decisionNote').length<3)throw Error('Un motif de décision est requis.');await rpc('review_essential_shift_request',{p_request:id,p_approve:a==='approve',p_note:val('decisionNote')});}
   else if(a==='cancel-request')await rpc('cancel_essential_shift_request',{p_request:id});
   else if(a==='reminder-preview'||a==='reminder-send'){
    if(!manager()||!feature('availability'))throw Error('Rappels réservés au responsable.');
    const form={reminderWeek:val('reminderWeek'),reminderDue:val('reminderDue'),reminderDepartment:val('reminderDepartment')};
    const args=reminderSelection(form),key=JSON.stringify(args);
    if(a==='reminder-send'){
      if(!s.reminderPreview||s.reminderPreview.confirmed||s.reminderKey!==key)throw Error('Actualisez l’aperçu avant l’envoi.');
      if(!doc.defaultView.confirm('Envoyer '+s.reminderPreview.pending+' rappel(s) internes pour la semaine du '+args.p_week+' ? Aucun SMS ne sera envoyé.'))return true;
    }
    const result=await rpc('essential_availability_reminder_batch',{p_company:s.company,...args,p_confirm:a==='reminder-send'});
    s.reminderPreview=result;s.reminderKey=a==='reminder-preview'?key:null;
    if(a==='reminder-send')notify(result.sent+' notification(s) internes créées. Aucune relance en double.');
   }
   else if(a==='pref-load'){
    const worker=manager()?val('prefWorker'):s.own;
    if(!worker||!s.workerPrefs.some(x=>x.worker_id===worker))throw Error('Dossier salarié inconnu. Actualisez.');
    loadPrefsForm(worker);redraw();return true;
   }
   else if(a==='pref-save'){
    const worker=manager()?s.form.prefWorker:s.own;
    if(s.prefsUnavailable||!worker||s.prefLoadedWorker!==worker)throw Error('Chargez votre dossier avant modification.');
    const prefs={prefDesired:val('prefDesired'),prefPeriods:val('prefPeriods'),prefWeekend:val('prefWeekend'),prefVolunteer:val('prefVolunteer'),
      prefLastMinute:val('prefLastMinute'),prefExtra:val('prefExtra')};
    const key=JSON.stringify([worker,prefs,s.prefLoadedVersion]);
    if(s.prefRequest?.key!==key)s.prefRequest={key,id:crypto.randomUUID()};
    await rpc('save_essential_worker_schedule_preferences',{p_company:s.company,...preferencePayload(prefs,worker,s.prefRequest.id,s.prefLoadedVersion)});
    s.prefLoadedWorker=null;s.prefRequest=null;notify('Préférences enregistrées, sans changement d’horaire ni banque d’heures.');
   }
   else if(a==='contract-save'){
    const worker=s.form.prefWorker;
    if(!manager()||s.prefLoadedWorker!==worker)throw Error('Seul un responsable peut modifier ces informations.');
    if(!doc.defaultView.confirm('Enregistrer ces informations déclarées, sans modifier la paie ni l’horaire ?'))return true;
    await rpc('set_essential_worker_schedule_constraints',{p_company:s.company,...contractPayload({
      contractSeniority:val('contractSeniority'),contractMin:val('contractMin'),contractMax:val('contractMax')
    },worker,s.prefLoadedVersion)});
    s.prefLoadedWorker=null;notify('Données du responsable mises à jour.');
   }
   else if(a==='weekly-save'){
    if(!feature('availability')||s.weeklyUnavailable)throw Error('Les règles hebdomadaires ne sont pas activées.');
    const worker=manager()?val('weeklyWorker'):s.own;
    if(!s.weeklyRequest)s.weeklyRequest={id:crypto.randomUUID(),worker,form:JSON.stringify(['weeklyDays','weeklyStart','weeklyEnd','weeklyFrom','weeklyUntil','weeklyAvailable','weeklyLocation'].map(val))};
    const formKey=JSON.stringify(['weeklyDays','weeklyStart','weeklyEnd','weeklyFrom','weeklyUntil','weeklyAvailable','weeklyLocation'].map(val));
    if(s.weeklyRequest.worker!==worker||s.weeklyRequest.form!==formKey)s.weeklyRequest={id:crypto.randomUUID(),worker,form:formKey};
    const form={weeklyDays:val('weeklyDays'),weeklyStart:val('weeklyStart'),weeklyEnd:val('weeklyEnd'),
      weeklyFrom:val('weeklyFrom'),weeklyUntil:val('weeklyUntil'),weeklyAvailable:val('weeklyAvailable'),weeklyLocation:val('weeklyLocation')};
    const result=await rpc('save_essential_weekly_availability',{p_company:s.company,...weeklyArgs(form,worker,s.weeklyRequest.id)});
    s.weeklyRequest=null;
    notify(result?.conflicts?result.conflicts+' quart(s) déjà publiés en conflit. Aucun quart modifié.':'Règle hebdomadaire enregistrée.');
   }
   else if(a==='weekly-remove'){
    const rule=s.weeklyRules.find(r=>r.id===id);
    if(!rule||!doc.defaultView.confirm('Retirer cette règle sans toucher aux horaires publiés ?'))return true;
    await rpc('remove_essential_weekly_availability',{p_id:id,p_version:Number(el.dataset.version)});
    notify('Règle retirée; horaires publiés inchangés.');
   }
   else if(a==='availability'){await rpc('set_essential_local_availability',{p_company:s.company,p_location:val('avLocation'),p_start_local:val('avStart'),p_end_local:val('avEnd'),p_available:val('available')==='true',p_note:val('avNote')});}
   else if(a==='remove-availability')await rpc('remove_essential_availability',{p_id:id});
   else if(a==='report'){if(!val('reportFrom')||!val('reportTo'))throw Error('Deux dates sont requises.');s.report=await rpc('essential_planning_report',{p_company:s.company,p_start:val('reportFrom')+'T00:00:00Z',p_end:val('reportTo')+'T00:00:00Z'});}
   await reload();
  }catch(err){s.error=err.message;notify(err.message);}finally{s.busy=false;redraw();}return true;
 }
 function input(el){if(!el?.id?.startsWith('plan-'))return;s.form[el.id.slice(5)]=el.type==='checkbox'?el.checked:el.value;if(['plan-location','plan-assignLocation','plan-mode'].includes(el.id)){if(el.id==='plan-location')s.form.department='';if(el.id==='plan-assignLocation')s.form.assignDepartment='';redraw();}}
 function reset(){generation++;s.template=null;s.templates=[];s.positions=[];s.positionAlerts=null;s.feedUrl=null;s.feedStatus=null;s.company=null;s.user=null;s.own=null;s.roster=[];s.workers=[];s.shifts=[];s.requests=[];s.scopes=[];s.locations=[];s.departments=[];s.availability=[];s.weeklyRules=[];s.weeklyPreview=[];s.workerPrefs=[];s.prefLoadedWorker=null;s.prefRequest=null;s.reminderPreview=null;s.reminderKey=null;s.report=null;s.options=[];s.editing=null;s.batch=null;}
 return {state:s,load,reload,renderOrganization,renderSchedule,handle,input,reset};
}
