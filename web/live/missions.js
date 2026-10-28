import {navigationUrl,navigationPlatform,navigationPreferenceKey,chooseNavigationPreference,navigationProviders} from './navigation-choices.js';
import {reserveMissionCompletionRequest,acknowledgeMissionCompletionRequest} from './mission-completion-request.js';
import {missionDayReview,missionDayReviewCsv,MISSION_STATES} from './mission-day-review.js';
import {parseMissionDraftCsv,validateMissionDraftRows,importMissionDraftRows,MISSION_IMPORT_HEADER} from './mission-batch-import.js';
import {recurringMissionDrafts,recurringMissionConflict} from './mission-recurrence.js';
import {MISSION_ISSUE_REASONS,missionIssueArgs,missionIssueLabel} from './mission-issues.js';
import {ISSUE_DECISIONS,missionIssueDecisionArgs,issueDecisionLabel,resolvedMissionNotice} from './mission-issue-decision.js';
import {missionPostponeArgs} from './mission-postpone.js';
import {missionChecklistItems,missionChecklistConfirmed} from './mission-checklist.js';
import {missionOfflineEligible,queueOfflineMissionCompletion,listOfflineMissionCompletions,syncOfflineMissionCompletions} from './mission-offline-queue.js';
import {missionCancelArgs} from './mission-cancel.js';
import {missionReassignArgs} from './mission-reassign.js';
import {missionRescheduleArgs} from './mission-reschedule.js';
import {nextMissionDay,validateUpcomingMissionDay} from './mission-upcoming.js';
// A mission never mutates punches, shifts, payroll, mileage, invoices or GPS.
export function missionDate(d=new Date()){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
/** A failed refresh shows a warning only for a mission module this same account has previously seen active. */
export function missionWarningEligible(previousEnabled,sameWorkspace){return !!previousEnabled&&!!sameWorkspace;}
export function missionProgress(items){
 const ordered=(Array.isArray(items)?items:[]).filter(x=>['published','in_progress','completed','impossible'].includes(x.status)).sort((a,b)=>a.sort_order-b.sort_order||String(a.id).localeCompare(String(b.id)));
 const done=ordered.filter(x=>x.status==='completed').length;
 const blocked=ordered.filter(x=>x.status==='impossible').length;
 const started=ordered.filter(x=>x.status==='in_progress');
 const pending=ordered.filter(x=>x.status==='published');
 // A stable database id is NOT permission to invent an order for two published
 // missions at the same rank. Leave the next stop unresolved until a manager
 // explicitly resolves the conflict; completed steps never compete with it.
 const ambiguous=!started.length&&pending.length>1&&Number(pending[0].sort_order)===Number(pending[1].sort_order);
 const result={total:ordered.length,done,blocked,next:ambiguous?null:(started[0]||pending[0]||null),
  allDone:ordered.length>0&&done===ordered.length};
 return ambiguous?{...result,ambiguous:true,ambiguousRank:pending[0].sort_order}:result;
}
/** Distinct published missions of the same worker/day only; never completed or drafts. */
export function publishedSwapTargets(mission,items){
 if(!mission||mission.status!=='published')return [];
 return (Array.isArray(items)?items:[]).filter(x=>x&&x.id!==mission.id&&x.status==='published'&&
  x.worker_id===mission.worker_id&&x.mission_day===mission.mission_day&&x.sort_order!==mission.sort_order)
  .sort((a,b)=>Number(a.sort_order)-Number(b.sort_order)||String(a.id).localeCompare(String(b.id)));
}
export function publishedSwapArgs(company,first,second){
 if(!company||!first?.id||!second?.id||first.id===second.id||
  first.status!=='published'||second.status!=='published'||first.worker_id!==second.worker_id||
  first.mission_day!==second.mission_day||
  !Number.isInteger(first.version)||first.version<1||!Number.isInteger(second.version)||second.version<1)
   throw Error('Sélectionnez deux missions publiées du même salarié et du même jour.');
 return {p_company:company,p_first:first.id,p_first_version:first.version,
  p_second:second.id,p_second_version:second.version};
}
export function missionAddress(m){return [m?.address_line,m?.unit,m?.city,m?.region,m?.postal_code,m?.country].filter(Boolean).join(', ');}
/** A private, bounded projection of today's already-authorized missions.
 * Never includes access notes, contacts, worker IDs or internal fields in the UI.
 */
export function personalMissionTour(items,workerId,limit=25,day=missionDate()){
 if(!workerId)return {rows:[],total:0,hasMore:false,ambiguous:false};
 if(!Number.isInteger(limit)||limit<1||limit>50)throw Error('Limite de tournée invalide');
 const eligible=(Array.isArray(items)?items:[]).filter(m=>m&&m.worker_id===workerId&&
  ['published','in_progress','completed','impossible'].includes(m.status)&&m.id&&(!m.mission_day||m.mission_day===day))
  .sort((a,b)=>Number(a.sort_order)-Number(b.sort_order)||String(a.id).localeCompare(String(b.id)));
 const pending=eligible.filter(m=>['published','in_progress'].includes(m.status));
 const ambiguity=pending.some((m,i)=>i>0&&m.sort_order===pending[i-1].sort_order);
 const rows=eligible.slice(0,limit).map(m=>({
  id:m.id,title:m.title||'Mission',client_name:m.client_name||'Client',
  site_name:m.site_name||'Lieu',status:m.status,issue_reason:m.issue_reason||null,sort_order:m.sort_order,
  address_line:m.address_line||'',unit:m.unit||'',city:m.city||'',
  region:m.region||'',postal_code:m.postal_code||'',country:m.country||''
 }));
 return {rows,total:eligible.length,hasMore:eligible.length>limit,ambiguous:ambiguity};
}

/** Voluntary, provider-specific directions for the single mission already authorized by the server.
 * Only address fields reach the map URL: never notes, entry codes, phone or worker identity.
 * Missing/invalid destinations are unavailable, not silently replaced with the office.
 */
/** @param {Record<string,any>|null|undefined} m @param {string} platform @param {string|null} preferred */
export function missionNavigationOptions(m,platform='web',preferred=null){
 if(String(m?.address_line||'').trim().length<3||String(m?.city||'').trim().length<2)return {choices:[],preferred:null};
 try{
  const addr=missionAddress(m);
  const choices=navigationProviders(platform).map(p=>({id:p.id,label:p.label,url:navigationUrl(p.id,addr,platform)}));
  const selected=chooseNavigationPreference(preferred,platform);
  return {choices,preferred:choices.find(c=>c.id===selected)||null};
 }catch{return {choices:[],preferred:null};}
}
/** @param {string} company @param {Record<string,any>} form @param {{id?:string,version?:number}|null} [existing] @param {boolean} [publish] */
export function missionArgs(company,form,existing=null,publish=false){
 const day=String(form.day||''),order=Number(form.order),title=String(form.title||'').trim();
 if(!company||!form.worker||!form.site||!(/^\d{4}-\d{2}-\d{2}$/.test(day))||!Number.isInteger(order)||order<1||order>999||
  title.length<2||title.length>140||String(form.instructions||'').length>500)throw Error('Mission, employé, lieu, ordre ou date invalide.');
 return {p_company:company,p_id:existing?.id||null,p_version:existing?.version||0,p_worker:form.worker,p_site:form.site,p_day:day,p_order:order,
  p_title:title,p_instructions:String(form.instructions||''),p_publish:!!publish};
}
export function createMissionManager({sb,document:doc,escape:e,redraw,notify}){
 const s={company:null,enabled:false,commentRequired:false,photoRequired:false,photoOptional:false,checklistRequired:false,checklistItems:[],checklistDraft:'',day:missionDate(),roster:[],sites:[],missions:[],error:'',truncated:false,busy:false,
  review:{status:'',worker:'',client:''},sitesComplete:false,importPreview:null,importMessage:'',recurrencePreview:null,postponeId:null,decisionId:null,decisionAction:'resume',edit:null,cancelId:null,reassignId:null,rescheduleId:null,form:{day:missionDate(),worker:'',site:'',order:'1',title:'',instructions:''}};
 let generation=0;
 const cancelRequests=new Map();
 const reassignRequests=new Map();
 const rescheduleRequests=new Map();
 const decisionRequests=new Map();
 const postponeRequests=new Map();
 async function rpc(name,args){const response=await sb.rpc(name,args);if(response.error)throw response.error;return response.data;}
 async function load(company,roster=[]){
  if(s.company!==company){cancelRequests.clear();reassignRequests.clear();rescheduleRequests.clear();decisionRequests.clear();postponeRequests.clear();s.postponeId=null;s.decisionId=null;s.cancelId=null;s.reassignId=null;s.rescheduleId=null;}
  const gen=++generation;Object.assign(s,{company,roster,enabled:false,commentRequired:false,photoRequired:false,photoOptional:false,checklistRequired:false,checklistItems:[],checklistDraft:'',missions:[],sites:[],sitesComplete:false,importPreview:null,importMessage:'',recurrencePreview:null,error:''});
  if(!company)return;
  try{
   const cfg=await rpc('essential_missions_configuration',{p_company:company,p_enabled:null});
   if(gen!==generation)return;s.enabled=!!cfg?.enabled;s.commentRequired=!!cfg?.comment_required;s.photoRequired=!!cfg?.photo_required;s.photoOptional=!!cfg?.photo_optional;s.checklistRequired=!!cfg?.checklist_required;
   s.checklistItems=Array.isArray(cfg?.checklist_items)?cfg.checklist_items:[];s.checklistDraft=s.checklistItems.join('\n');
   if(s.enabled){
    const [sites,missions]=await Promise.all([
     rpc('list_essential_client_sites',{p_company:company,p_search:'',p_after:null,p_limit:100}),
     rpc('list_essential_missions',{p_company:company,p_day:s.day,p_worker:null,p_include_drafts:true})]);
    if(gen!==generation)return;s.sites=(sites.items||[]).filter(x=>x.active);s.sitesComplete=!sites.has_more&&(sites.items||[]).length<100;
    s.missions=missions.items||[];s.truncated=!!missions.truncated;
   }
  }catch(err){if(gen===generation)s.error=err.message;}
 }
 function reset(){generation++;cancelRequests.clear();reassignRequests.clear();rescheduleRequests.clear();decisionRequests.clear();postponeRequests.clear();Object.assign(s,{company:null,enabled:false,commentRequired:false,photoRequired:false,photoOptional:false,checklistRequired:false,checklistItems:[],checklistDraft:'',sites:[],missions:[],sitesComplete:false,importPreview:null,importMessage:'',recurrencePreview:null,error:'',edit:null,postponeId:null,decisionId:null,decisionAction:'resume',cancelId:null,reassignId:null,rescheduleId:null});}
 function field(label,id,value,type='text'){return '<label class="ess-field">'+e(label)+'<input type="'+type+'" id="mission-'+id+'" value="'+e(value||'')+'"></label>';}
 function select(label,id,selected,options){return '<label class="ess-field">'+e(label)+'<select id="mission-'+id+'">'+options.map(([v,t])=>'<option value="'+e(v)+'" '+(v===selected?'selected':'')+'>'+e(t)+'</option>').join('')+'</select></label>';}
 function button(text,act,id=''){return '<button type="button" class="ess-btn" data-action="ess:plan-mission-'+act+'" '+(id?'data-id="'+e(id)+'" ':'')+(s.busy?'disabled':'')+'>'+e(text)+'</button>';}
 function render(){
  if(!s.company)return '';
  const f=s.form;
  let body='<section class="ess-panel"><h3>Missions et tournées</h3><p>Missions distinctes des pointages et des heures. La tournée intelligente viendra séparément.</p>'+
   (s.error?'<p role="alert">'+e(s.error)+'</p>':'')+
   '<p>Module '+(s.enabled?'activé':'désactivé')+' pour cette compagnie.</p>'+button(s.enabled?'Désactiver':'Activer','toggle')+
   '<p>Preuve à la fin : <b>'+(s.commentRequired?'commentaire obligatoire (5 à 1000 caractères)':'aucune preuve exigée')+'</b>.</p>'+
   button(s.commentRequired?'Ne plus exiger de commentaire':'Exiger un commentaire de fin','proof-policy')+
    '<p>Photo privée de fin : <b>'+(s.photoRequired?'obligatoire':s.photoOptional?'facultative':'désactivée')+'</b>. JPEG, PNG ou WebP, 5 Mio maximum.</p>'+
    (!s.photoRequired?button('Exiger une photo','photo-mode-required'):'')+
    (!s.photoOptional?button('Autoriser une photo facultative','photo-mode-optional'):'')+
    (s.photoRequired||s.photoOptional?button('Désactiver la photo','photo-mode-none'):'')+
   '<p>Checklist de fin : <b>'+(s.checklistRequired?'obligatoire':'non exigée')+'</b>.</p>'+
   '<label class="ess-field">Étapes à confirmer (une par ligne, maximum 8)<textarea id="mission-checklist-policy" rows="5" maxlength="1000">'+e(s.checklistDraft)+'</textarea></label>'+
   button(s.checklistRequired?'Enregistrer les étapes obligatoires':'Exiger cette checklist','checklist-enable')+
   (s.checklistRequired?button('Ne plus exiger la checklist','checklist-disable'):'');
  if(s.enabled){
   body+='<div class="ess-form-grid">'+field('Journée','day',s.day,'date')+
    button('Afficher la journée','refresh')+
    select('Salarié','worker',f.worker,[['','Sélectionner'],...s.roster.filter(w=>w.status==='active').map(w=>[w.id,w.name])])+
    select('Adresse client','site',f.site,[['','Sélectionner'],...s.sites.map(x=>[x.id,x.client_name+' · '+x.name+' · '+x.city])])+
    field('Ordre du jour','order',f.order,'number')+field('Titre','title',f.title)+field('Instructions internes','instructions',f.instructions)+
    '</div>'+button('Enregistrer brouillon','draft')+button('Approuver et publier','publish')+
    '<section class="ess-panel" aria-label="Import CSV de missions"><h4>Importer plusieurs missions CSV</h4>'+
    '<p class="ess-fine">Crée uniquement des brouillons, jamais des missions publiées. Prévisualisation obligatoire : maximum 50 lignes pour la journée '+e(s.day)+'. Aucun pointage ou horaire modifié.</p>'+
    '<p>Colonnes dans cet ordre : <code>'+e(MISSION_IMPORT_HEADER)+'</code>. Pour le salarié et le lieu, utilisez les identifiants actifs ou les noms uniques du carnet (client · lieu · ville).</p>'+
    '<label class="ess-field">Fichier CSV (64 Kio maximum)<input id="mission-import-file" type="file" accept=".csv,text/csv"></label>'+
    button('Vérifier le fichier et prévisualiser','import-preview')+
    (s.importMessage?'<p role="status">'+e(s.importMessage)+'</p>':'')+
    (s.importPreview?'<p role="status">'+s.importPreview.validated.total+' lignes · '+
      s.importPreview.validated.errors.length+' erreur(s). '+(s.importPreview.validated.valid?'Aucune mission publiée; confirmez les brouillons.':'Corrigez toutes les erreurs avant l’import.')+'</p>'+
      (s.importPreview.validated.errors.length?'<ul>'+s.importPreview.validated.errors.map(x=>
        '<li>Ligne '+e(x.line)+' : '+e(x.detail)+'</li>').join('')+'</ul>':'')+
      '<details><summary>Voir les lignes proposées</summary><div style="overflow-x:auto"><table><thead><tr><th>Ligne</th><th>Salarié</th><th>Lieu</th><th>Ordre</th><th>Mission</th></tr></thead><tbody>'+
      s.importPreview.validated.rows.map(row=>'<tr><td>'+e(row.line)+'</td><td>'+e(row.employee)+'</td><td>'+
       e(row.site)+'</td><td>'+e(row.order)+'</td><td>'+e(row.title)+'</td></tr>').join('')+
      '</tbody></table></div></details>'+
      (s.importPreview.validated.valid?button('Créer '+s.importPreview.validated.total+' brouillon(s) après confirmation','import-confirm'):''):'')+
    '</section>'+
    '<section class="ess-panel" aria-label="Récurrence des missions"><h4>Répéter cette mission</h4>'+
    '<p class="ess-fine">Utilisez les champs salarié, lieu, date, ordre, titre et instructions ci-dessus. Crée 2 à 12 brouillons, chaque semaine ou aux deux semaines, sur 180 jours maximum. Les dates sont vérifiées une par une; aucune publication automatique.</p>'+
    '<label class="ess-field">Fréquence<select id="mission-recurrence-weeks"><option value="1">Chaque semaine</option><option value="2">Aux deux semaines</option></select></label>'+
    '<label class="ess-field">Nombre d’occurrences<input id="mission-recurrence-count" type="number" min="2" max="12" value="4"></label>'+
    button('Prévisualiser les dates','recurrence-preview')+
    (s.recurrencePreview?'<p role="status">'+s.recurrencePreview.rows.length+
      ' brouillon(s) proposés pour le même salarié et le même lieu. Aucun envoi effectué.</p>'+
      '<ol>'+s.recurrencePreview.rows.map(row=>'<li>'+e(row.day)+' · '+e(row.title)+
      ' (rang '+e(row.order)+')</li>').join('')+'</ol>'+
      button('Créer ces brouillons après vérification','recurrence-confirm'):'')+
    '</section>';
   const analysis=missionDayReview(s.missions,s.review,s.truncated);
   body+='<section class="ess-panel" aria-label="Suivi quotidien des missions">'+
    '<h4>Suivi des missions — '+e(s.day)+'</h4>'+
    '<p class="ess-fine">Statuts explicites; une mission non terminée n’est pas une absence ou un retard. Aucun temps de travail ni trajet n’est inféré.</p>'+
    '<p role="status">À faire : '+analysis.counts.published+
    ' · En cours : '+analysis.counts.in_progress+' · Terminées : '+analysis.counts.completed+' · À traiter : '+analysis.counts.impossible+' · Brouillons : '+analysis.counts.draft+
    ' · Reportées : '+analysis.counts.postponed+' · Annulées : '+analysis.counts.cancelled+'</p>'+
    select('Filtrer par salarié','review-worker',s.review.worker,[['','Tous les salariés'],...s.roster.filter(w=>w.status==='active').map(w=>[w.id,w.name])])+
    select('Filtrer par état','review-status',s.review.status,MISSION_STATES)+
    field('Rechercher un client','review-client',s.review.client)+
    button('Appliquer les filtres','review-apply')+
    '<p>'+analysis.shown+' mission(s) affichée(s) sur '+analysis.scopedTotal+' correspondante(s).</p>'+
    (analysis.truncated?'<p role="alert">Plus de 200 missions : résultats tronqués. Export CSV désactivé.</p>':button('Exporter les missions affichées (CSV)','review-csv'))+
    '<div style="overflow-x:auto"><table><thead><tr><th>Ordre</th><th>Salarié</th><th>Client</th><th>Lieu</th><th>Mission</th><th>État</th></tr></thead><tbody>'+
    analysis.visible.map(x=>'<tr><td>'+e(x.sort_order)+'</td><td>'+e([x.first_name,x.last_name].filter(Boolean).join(' '))+
     '</td><td>'+e(x.client_name)+'</td><td>'+e(x.site_name)+'</td><td>'+e(x.title)+'</td><td>'+
      e(MISSION_STATES.find(s=>s[0]===x.status)?.[1]||x.status)+(x.status==='impossible'?' · '+e(missionIssueLabel(x.issue_reason)):'')+'</td></tr>').join('')+
    '</tbody></table></div></section>';
   body+='<h4>Interventions du '+e(s.day)+'</h4>'+
    s.missions.map(x=>'<article class="ess-person"><div><b>'+x.sort_order+'. '+e(x.title)+'</b><small>'+
      e([x.first_name,x.last_name].filter(Boolean).join(' '))+' · '+e(x.client_name)+' · '+e(x.site_name)+
      ' · '+e(x.status)+'</small>'+(x.status==='impossible'?'<small>Motif : '+e(missionIssueLabel(x.issue_reason))+'</small>'+(x.issue_note?'<p class="ess-fine">Note privée du salarié : '+e(x.issue_note)+'</p>':''):'')+
      (x.status==='completed'&&x.completion_comment?'<p class="ess-fine">Preuve privée de fin : '+e(x.completion_comment)+'</p>':'')+
      (x.status==='completed'&&Array.isArray(x.completion_checklist)&&x.completion_checklist.length?
       '<p class="ess-fine">Checklist privée confirmée : '+x.completion_checklist.map(v=>e(v)).join(' · ')+'</p>':'')+(x.status==='completed'&&x.completion_photo_id?button('Voir la photo privée','view-photo',x.completion_photo_id):'')+'</div>'+(x.issue_decision_at?'<small>Décision : '+e(issueDecisionLabel(x.issue_decision))+' · '+e(x.issue_decision_reason||'')+'</small>':'')+
    (x.status==='impossible'&&!s.truncated?button(s.decisionId===x.id?'Fermer la décision':'Traiter le signalement','decision-open',x.id):'')+
    (x.status==='impossible'&&!s.truncated?button(s.postponeId===x.id?'Fermer le report':'Reporter à une autre journée','postpone-open',x.id):'')+
    (s.postponeId===x.id?'<div class="ess-panel"><p>Le même salarié et la même adresse client seront conservés; sélectionnez une nouvelle journée et un rang libre.</p>'+
     '<label class="ess-field">Nouvelle journée<input type="date" id="mission-postpone-day-'+e(x.id)+'" value=""></label>'+
     '<label class="ess-field">Rang (1 à 999)<input type="number" min="1" max="999" id="mission-postpone-order-'+e(x.id)+'" value="'+e(x.sort_order)+'"></label>'+
     '<label class="ess-field">Motif communiqué au salarié<input maxlength="200" id="mission-postpone-reason-'+e(x.id)+'"></label>'+
     button('Confirmer le report','postpone-submit',x.id)+'</div>':'')+
    (s.decisionId===x.id?'<div class="ess-panel"><p>Reprendre la mission publiée ou annuler après examen. Aucun pointage, heure ni paie ne changera.</p>'+
     '<label class="ess-field">Décision<select id="mission-decision-action-'+e(x.id)+'">'+ISSUE_DECISIONS.map(([v,t])=>'<option value="'+e(v)+'" '+(v===s.decisionAction?'selected':'')+'>'+e(t)+'</option>').join('')+'</select></label>'+
     '<label class="ess-field">Motif communiqué à l’employé (5 à 200 caractères)<input maxlength="200" id="mission-decision-reason-'+e(x.id)+'"></label>'+
     button('Confirmer la décision du responsable','decision-submit',x.id)+'</div>':'')+
    (x.status==='draft'?button('Modifier le brouillon','edit',x.id):'')+
    (x.status==='published'?button(s.cancelId===x.id?'Fermer l’annulation':'Annuler la mission publiée','cancel-open',x.id):'')+
    (s.cancelId===x.id?'<label class="ess-field">Motif de l’annulation (obligatoire, 5 à 200 caractères)<input id="mission-cancel-reason-'+e(x.id)+'" maxlength="200" placeholder="Ex. client indisponible"></label>'+button('Confirmer l’annulation','cancel-submit',x.id):'')+
    (x.status==='published'&&!s.truncated?button(s.reassignId===x.id?'Fermer la réaffectation':'Réaffecter à un autre salarié','reassign-open',x.id):'')+
    (s.reassignId===x.id?
     '<div class="ess-panel"><p class="ess-fine">Réaffectation manuelle. Vérifiez vous-même les qualifications et disponibilités du salarié; aucune validation de poste automatisée dans ce parcours.</p>'+
     '<label class="ess-field">Nouveau salarié<select id="mission-reassign-worker-'+e(x.id)+'">'+
     '<option value="">Sélectionner un salarié actif</option>'+s.roster.filter(w=>w.status==='active'&&w.id!==x.worker_id).map(w=>
      '<option value="'+e(w.id)+'">'+e(w.name)+'</option>').join('')+'</select></label>'+
     '<label class="ess-field">Rang de tournée du nouveau salarié<input id="mission-reassign-order-'+e(x.id)+'" type="number" min="1" max="999" value="'+e(x.sort_order)+'"></label>'+
     '<label class="ess-field">Motif obligatoire (5 à 200 caractères)<input id="mission-reassign-reason-'+e(x.id)+'" maxlength="200"></label>'+
     button('Confirmer la réaffectation','reassign-submit',x.id)+'</div>':'')+
    (x.status==='published'&&!s.truncated?button(s.rescheduleId===x.id?'Fermer la reprogrammation':'Reprogrammer jour, lieu ou rang','reschedule-open',x.id):'')+
    (s.rescheduleId===x.id?
     '<div class="ess-panel"><p class="ess-fine">Mission publiée : choisissez la nouvelle journée, l’adresse active et le rang du même salarié. Vérifiez les disponibilités et confirmez; aucun pointage ne sera modifié.</p>'+
     '<label class="ess-field">Nouvelle journée<input type="date" id="mission-reschedule-day-'+e(x.id)+'" value="'+e(x.mission_day)+'"></label>'+
     '<label class="ess-field">Nouvelle adresse client<select id="mission-reschedule-site-'+e(x.id)+'">'+
     s.sites.map(site=>'<option value="'+e(site.id)+'" '+(site.id===x.site_id?'selected':'')+'>'+e(site.client_name+' · '+site.name+' · '+site.city)+'</option>').join('')+'</select></label>'+
     '<label class="ess-field">Nouveau rang (1 à 999)<input type="number" min="1" max="999" id="mission-reschedule-order-'+e(x.id)+'" value="'+e(x.sort_order)+'"></label>'+
     '<label class="ess-field">Motif obligatoire (5 à 200 caractères)<input maxlength="200" id="mission-reschedule-reason-'+e(x.id)+'"></label>'+
     button('Confirmer la nouvelle programmation','reschedule-submit',x.id)+'</div>':'')+
    (x.status==='published'&&!s.truncated&&publishedSwapTargets(x,s.missions).length?
     '<label class="ess-field">Échanger le rang avec<select id="mission-swap-'+e(x.id)+'">'+
     '<option value="">Choisir une mission publiée</option>'+
     publishedSwapTargets(x,s.missions).map(other=>'<option value="'+e(other.id)+'">'+
       e(String(other.sort_order)+'. '+other.title)+'</option>').join('')+
     '</select></label>'+button('Confirmer le nouvel ordre','swap-order',x.id):'')+
    '</article>').join('');
   if(s.truncated)body+='<p role="alert">Plus de 200 interventions : liste tronquée.</p>';
   if(s.sites.length>=100)body+='<p>Adresses limitées à 100 par chargement; un carnet très volumineux exige un filtre avant attribution.</p>';
  }
  return body+'</section>';
 }
 async function handle(action,el){
  if(!s.company||s.busy)return true;s.busy=true;s.error='';
  try{
   if(action==='toggle'){
    const enabled=!s.enabled;if(!doc.defaultView.confirm((enabled?'Activer':'Désactiver')+' les missions ?'))return true;
    await rpc('essential_missions_configuration',{p_company:s.company,p_enabled:enabled});
    await load(s.company,s.roster);notify(enabled?'Missions activées.':'Missions désactivées.');
   }else if(action==='proof-policy'){
    const required=!s.commentRequired;
    if(!doc.defaultView.confirm((required?'Exiger un commentaire pour terminer':'Ne plus exiger de commentaire à la fin des')+' missions de cette compagnie ? Les missions terminées restent inchangées.'))return true;
    const company=s.company,gen=generation;
    await rpc('set_essential_mission_proof_policy',{p_company:company,p_comment_required:required});
    if(gen!==generation||s.company!==company)return true;
    await load(company,s.roster);notify(required?'Commentaire de fin obligatoire.':'Aucune preuve de fin obligatoire.');
    }else if(action.startsWith('photo-mode-')){
     const mode=action.slice('photo-mode-'.length);
     if(!['none','optional','required'].includes(mode))throw Error('Choix de photo invalide.');
     if(!doc.defaultView.confirm(mode==='none'?'Désactiver les futures preuves photo pour cette compagnie ?':mode==='required'?'Exiger une photo avant chaque fin de mission ?':'Autoriser une photo facultative au salarié ?'))return true;
     const company=s.company,gen=generation;
     await rpc('set_essential_mission_photo_mode',{p_company:company,p_mode:mode});
     if(s.company!==company||gen!==generation)return true;
     await load(company,s.roster);notify('Politique de photo enregistrée.');
    }else if(action==='view-photo'){
     const company=s.company;
     const result=await sb.functions.invoke('mission-photo',{body:{action:'view',company,photo:el?.dataset?.id}});
     if(result.error||!result.data?.url)throw Error('Preuve privée inaccessible.');
     const link=new URL(result.data.url);
     if(link.protocol!=='https:'||link.hostname!=='mlabstdxxwjdpfaxiwmg.supabase.co')throw Error('Destination photo invalide.');
     if(company!==s.company)return true;
     const a=doc.createElement('a');a.href=link.href;a.target='_blank';a.rel='noopener noreferrer';doc.body.appendChild(a);a.click();a.remove();
    }else if(action==='checklist-enable'||action==='checklist-disable'){
    const required=action==='checklist-enable',raw=doc.getElementById('mission-checklist-policy')?.value??s.checklistDraft;
    const items=required?missionChecklistItems(raw):s.checklistItems;
    if(!doc.defaultView.confirm(required?'Exiger toutes ces étapes avant la fin des missions ?':'Ne plus exiger la checklist pour cette compagnie ?'))return true;
    const company=s.company,gen=generation;
    await rpc('set_essential_mission_checklist_policy',{p_company:company,p_required:required,p_items:items});
    if(s.company!==company||gen!==generation)return true;
    await load(company,s.roster);notify(required?'Checklist obligatoire enregistrée.':'Checklist obligatoire désactivée.');
   }else if(action==='import-preview'){
    if(s.truncated||!s.sitesComplete)throw Error('Carnet ou journée incomplet(e) : import refusé.');
    const file=doc.getElementById('mission-import-file')?.files?.[0];
    if(!file||file.size>65536||file.size===0)throw Error('Choisissez un CSV de 1 à 64 Kio.');
    const company=s.company,day=s.day,gen=generation;
    const source=await file.text();
    if(gen!==generation||s.company!==company||s.day!==day)
     throw Error('Entreprise ou journée modifiée : prévisualisation annulée.');
    const rows=parseMissionDraftCsv(source);
    const validated=validateMissionDraftRows(rows,
     {roster:s.roster,sites:s.sites,existing:s.missions,day,sitesComplete:s.sitesComplete});
    s.importPreview={rows,validated,company,day,gen};
    s.importMessage=validated.valid?
     'Prévisualisation prête : '+validated.total+' brouillon(s) à confirmer. Aucune écriture serveur.':
     'Corrigez les '+validated.errors.length+' erreur(s) puis choisissez à nouveau votre fichier.';
   }else if(action==='import-confirm'){
    const preview=s.importPreview;
    if(!preview?.validated?.valid||preview.company!==s.company||preview.day!==s.day||
       preview.gen!==generation||!s.enabled||s.truncated||!s.sitesComplete)
     throw Error('Prévisualisation obsolète : vérifiez à nouveau le CSV.');
    const company=s.company,day=s.day,gen=generation,roster=s.roster;
    if(!doc.defaultView.confirm('Créer '+preview.validated.total+
      ' brouillon(s) pour '+day+' ? Aucune publication automatique. Si le réseau coupe, rafraîchir et prévisualiser à nouveau pour détecter les doublons.'))
     return true;
    const assertCurrent=()=>{
     if(s.company!==company||s.day!==day||generation!==gen)
      throw Error('Contexte de travail modifié : import interrompu.');
    };
    try{
     if(!sb.auth?.getUser)throw Error('Session Auth à revérifier.');
     const verified=await sb.auth.getUser();assertCurrent();
     if(verified.error||!verified.data?.user?.id)throw Error('Session expirée : reconnectez-vous.');
     // Re-read the authorized lists immediately before any write.
     const cfg=await rpc('essential_missions_configuration',{p_company:company,p_enabled:null});
     assertCurrent();
     if(cfg?.enabled!==true)throw Error('Module désactivé ou permissions révoquées.');
     const [freshSites,freshMissions]=await Promise.all([
      rpc('list_essential_client_sites',{p_company:company,p_search:'',p_after:null,p_limit:100}),
      rpc('list_essential_missions',{p_company:company,p_day:day,p_worker:null,p_include_drafts:true})
     ]);
     assertCurrent();
     if(freshSites?.has_more||(freshSites?.items||[]).length>=100||
        freshMissions?.enabled!==true||freshMissions?.truncated||
        !Array.isArray(freshSites?.items)||!Array.isArray(freshMissions?.items))
      throw Error('Liste serveur incomplète ou non autorisée : import refusé.');
     const current=validateMissionDraftRows(preview.rows,{roster,sites:freshSites.items,
      existing:freshMissions.items,day,sitesComplete:true});
     if(!current.valid)throw Error('Mission ou ordre modifié depuis la prévisualisation : import annulé.');
     const result=await importMissionDraftRows(current.rows,{
      beforeEach:async()=>{
       assertCurrent();
       const auth=await sb.auth.getUser();assertCurrent();
       if(auth.error||auth.data?.user?.id!==verified.data.user.id)
        throw Error('Session modifiée : import interrompu.');
      },
      save:async row=>{
       assertCurrent();
       const value=await rpc('save_essential_mission',
        missionArgs(company,{worker:row.workerId,site:row.siteId,day:row.day,
         order:row.order,title:row.title,instructions:row.instructions},null,false));
       assertCurrent();return value;
      }
     });
     s.importPreview=null;s.importMessage='';
     await load(company,roster);
     notify(result.completed+' brouillon(s) créés et confirmés par le serveur. Vérifiez-les avant publication.');
    }catch(error){
     s.importPreview=null;
     throw Error('Import non confirmé ou partiel; aucun essai automatique. '+
      String(error?.message||error));
    }
   }else if(action==='recurrence-preview'){
    if(s.truncated||!s.sitesComplete)throw Error('Carnet ou journée incomplets : récurrence refusée.');
    const val=k=>doc.getElementById('mission-'+k)?.value||'';
    const worker=val('worker'),site=val('site');
    if(!s.roster.some(w=>w.id===worker&&w.status==='active')||
       !s.sites.some(x=>x.id===site&&x.active))
     throw Error('Sélectionnez un salarié et une adresse active de cette compagnie.');
    const form={worker,site,day:val('day'),order:val('order'),title:val('title'),
     instructions:val('instructions')};
    missionArgs(s.company,form,null,false);
    const rows=recurringMissionDrafts({...form,workerId:worker,siteId:site,
     intervalWeeks:doc.getElementById('mission-recurrence-weeks')?.value||'',
     count:doc.getElementById('mission-recurrence-count')?.value||''},{today:missionDate()});
    s.recurrencePreview={rows,company:s.company,gen:generation};
   }else if(action==='recurrence-confirm'){
    const preview=s.recurrencePreview,company=s.company,gen=generation,roster=s.roster;
    if(!preview||preview.company!==company||preview.gen!==gen||!s.enabled||!s.sitesComplete)
     throw Error('Prévisualisation expirée. Vérifiez les dates à nouveau.');
    if(!doc.defaultView.confirm('Créer '+preview.rows.length+
      ' brouillon(s) aux dates proposées ? Les employés ne seront pas avisés avant publication.'))return true;
    const assertCurrent=()=>{
     if(s.company!==company||generation!==gen)
      throw Error('Entreprise ou écran modifié : création interrompue.');
    };
    try{
     if(!sb.auth?.getUser)throw Error('Session Auth à vérifier.');
     const actor=await sb.auth.getUser();assertCurrent();
     if(actor.error||!actor.data?.user?.id)throw Error('Session expirée.');
     const cfg=await rpc('essential_missions_configuration',{p_company:company,p_enabled:null});
     assertCurrent();
     if(cfg?.enabled!==true)throw Error('Missions désactivées ou accès révoqué.');
     const sites=await rpc('list_essential_client_sites',
      {p_company:company,p_search:'',p_after:null,p_limit:100});
     assertCurrent();
     if(sites?.has_more||!Array.isArray(sites?.items)||sites.items.length>=100)
      throw Error('Carnet client incomplet : récurrence refusée.');
     const verifyRow=async row=>{
      assertCurrent();
      const auth=await sb.auth.getUser();assertCurrent();
      if(auth.error||auth.data?.user?.id!==actor.data.user.id)
       throw Error('Identité modifiée : création interrompue.');
      if(!roster.some(w=>w.id===row.workerId&&w.status==='active')||
         !sites.items.some(site=>site.id===row.siteId&&site.active))
       throw Error('Salarié ou lieu devenu indisponible.');
      const latest=await rpc('list_essential_missions',
       {p_company:company,p_day:row.day,p_worker:null,p_include_drafts:true});
      assertCurrent();
      if(latest?.enabled!==true||latest?.truncated||!Array.isArray(latest?.items)||
         latest.items.some(x=>x&&(x.company_id&&x.company_id!==company||
          x.mission_day&&x.mission_day!==row.day)))
       throw Error('Journée incomplète ou non autorisée : création refusée.');
      const conflict=recurringMissionConflict(row,latest.items);
      if(conflict)throw Error(row.day+' : '+conflict);
     };
     // Preflight ALL dates before the first write; re-check each immediately before save.
     for(const row of preview.rows)await verifyRow(row);
     const result=await importMissionDraftRows(preview.rows,{
      beforeEach:verifyRow,
      save:async row=>{
       assertCurrent();
       const saved=await rpc('save_essential_mission',
        missionArgs(company,{worker:row.workerId,site:row.siteId,day:row.day,
         order:row.order,title:row.title,instructions:row.instructions},null,false));
       assertCurrent();return saved;
      }
     });
     s.recurrencePreview=null;
     await load(company,roster);
     notify(result.completed+' brouillon(s) de récurrence créés. Vérifiez chaque date avant publication.');
    }catch(error){
     s.recurrencePreview=null;
     throw Error('Récurrence interrompue; ne relancez pas sans actualiser les dates. '+
      String(error?.message||error));
    }
   }else if(action==='review-apply'){
    s.review={worker:doc.getElementById('mission-review-worker')?.value||'',status:doc.getElementById('mission-review-status')?.value||'',client:doc.getElementById('mission-review-client')?.value||''};
   }else if(action==='review-csv'){
    if(!s.company||!s.enabled)throw Error('Export désactivé pour cette entreprise.');
    const company=s.company,day=s.day,gen=generation,filter={...s.review};
    const stillCurrent=()=>{
     if(gen!==generation||s.company!==company||s.day!==day)
      throw Error('Contexte modifié pendant la vérification : export annulé.');
    };
    // Cached dashboards must NEVER authorize sensitive downloads on their own.
    if(!sb.auth?.getUser)throw Error('Vérification de session indisponible : export refusé.');
    const verified=await sb.auth.getUser();
    stillCurrent();
    if(verified.error||!verified.data?.user?.id)
     throw Error('Session non confirmée. Reconnectez-vous avant l’export.');
    const fresh=await rpc('list_essential_missions',
     {p_company:company,p_day:day,p_worker:null,p_include_drafts:true});
    stillCurrent();
    if(fresh?.enabled!==true||fresh?.truncated||!Array.isArray(fresh?.items))
     throw Error('Liste non autorisée ou incomplète : export refusé.');
    if(fresh.items.some(row=>row&&(row.company_id&&row.company_id!==company||
      row.mission_day&&row.mission_day!==day)))
     throw Error('Résultat hors entreprise ou hors journée : export refusé.');
    const analysis=missionDayReview(fresh.items,filter,false);
    const content=missionDayReviewCsv(analysis,day);
    const win=doc.defaultView,url=win.URL.createObjectURL(new win.Blob([content],{type:'text/csv;charset=utf-8'}));
    try{
     stillCurrent();
     const link=doc.createElement('a');link.href=url;link.download='punch-missions-'+day+'.csv';
     doc.body.appendChild(link);link.click();link.remove();
    }finally{win.URL.revokeObjectURL(url);}
    notify('CSV de la journée revérifiée sur le serveur, sans notes privées ni heures de paie.');
   }else if(action==='refresh'){
    s.day=doc.getElementById('mission-day')?.value||s.day;await load(s.company,s.roster);
   }else if(action==='postpone-open'){
    const m=s.missions.find(x=>x.id===el.dataset.id&&x.status==='impossible');
    if(!m||s.truncated)throw Error('Signalement non disponible ou liste tronquée.');
    s.postponeId=s.postponeId===m.id?null:m.id;
   }else if(action==='postpone-submit'){
    if(s.truncated)throw Error('Liste tronquée : actualisez avant le report.');
    const m=s.missions.find(x=>x.id===el.dataset.id&&x.status==='impossible');
    if(!m||s.postponeId!==m.id)throw Error('Signalement modifié : actualisez.');
    const day=doc.getElementById('mission-postpone-day-'+m.id)?.value||'';
    const order=doc.getElementById('mission-postpone-order-'+m.id)?.value||'';
    const reason=doc.getElementById('mission-postpone-reason-'+m.id)?.value||'';
    const key=['postpone',m.id,day,order,String(reason).trim()].join(':');
    const request=postponeRequests.get(key)||doc.defaultView.crypto.randomUUID();
    const args=missionPostponeArgs(s.company,m,day,order,reason,request);
    if(!doc.defaultView.confirm('Reporter « '+m.title+' » au '+day+' ? Le salarié sera avisé, sans modifier son pointage ou ses heures.'))return true;
    postponeRequests.set(key,request);
    const company=s.company,gen=generation;
    await rpc('postpone_essential_mission_issue',args);
    if(company!==s.company||gen!==generation)return true;
    postponeRequests.delete(key);s.postponeId=null;
    await load(company,s.roster);
    notify('Mission reportée au '+day+'. L’employé sera avisé si son compte est actif.');
   }else if(action==='decision-open'){
    const m=s.missions.find(x=>x.id===el.dataset.id&&x.status==='impossible');
    if(!m||s.truncated)throw Error('Signalement non disponible ou liste tronquée. Rechargez.');
    s.decisionId=s.decisionId===m.id?null:m.id;s.decisionAction='resume';
   }else if(action==='decision-submit'){
    if(s.truncated)throw Error('Liste tronquée : rechargez avant la décision.');
    const m=s.missions.find(x=>x.id===el.dataset.id&&x.status==='impossible');
    if(!m||s.decisionId!==m.id)throw Error('Signalement traité ou modifié : actualisez.');
    const decision=doc.getElementById('mission-decision-action-'+m.id)?.value||'';
    const reason=doc.getElementById('mission-decision-reason-'+m.id)?.value||'';
    const key=['decision',m.id,decision,String(reason).trim()].join(':');
    const request=decisionRequests.get(key)||doc.defaultView.crypto.randomUUID();
    const args=missionIssueDecisionArgs(s.company,m,decision,reason,request);
    if(!doc.defaultView.confirm((decision==='resume'?'Remettre la mission à faire':'Annuler la mission après examen')+
     ' ? Le salarié sera avisé dans sa compagnie. Ses heures et son pointage restent inchangés.'))return true;
    decisionRequests.set(key,request);
    const company=s.company,gen=generation;
    await rpc('resolve_essential_mission_issue',args);
    if(company!==s.company||gen!==generation)return true;
    decisionRequests.delete(key);s.decisionId=null;
    await load(company,s.roster);
    notify('Décision enregistrée. L’employé a été avisé si son compte est actif.');
   }else if(action==='cancel-open'){
    const x=s.missions.find(m=>m.id===el.dataset.id&&m.status==='published');
    if(!x)throw Error('Mission publiée introuvable. Actualisez.');
    s.cancelId=s.cancelId===x.id?null:x.id;
   }else if(action==='cancel-submit'){
    if(s.truncated)throw Error('Liste tronquée : rechargez avant annulation.');
    const x=s.missions.find(m=>m.id===el.dataset.id&&m.status==='published');
    if(!x||s.cancelId!==x.id)throw Error('Mission publiée modifiée : actualisez.');
    const reason=doc.getElementById('mission-cancel-reason-'+x.id)?.value||'';
    const key='cancel:'+x.id,request=cancelRequests.get(key)||doc.defaultView.crypto.randomUUID();
    const args=missionCancelArgs(s.company,x,reason,request);
    if(!doc.defaultView.confirm('Annuler « '+x.title+' » pour ce salarié ? Le salarié sera averti; les pointages et heures restent inchangés.'))return true;
    cancelRequests.set(key,request);
    await rpc('cancel_essential_published_mission',args);
    cancelRequests.delete(key);s.cancelId=null;
    await load(s.company,s.roster);notify('Mission annulée; avis interne envoyé si le salarié possède un compte actif.');
   }else if(action==='reassign-open'){
    if(s.truncated)throw Error('Liste tronquée : actualisez avant de réaffecter.');
    const m=s.missions.find(x=>x.id===el.dataset.id&&x.status==='published');
    if(!m)throw Error('Mission publiée introuvable. Actualisez.');
    s.reassignId=s.reassignId===m.id?null:m.id;
   }else if(action==='reassign-submit'){
    if(s.truncated)throw Error('Liste tronquée : actualisez avant de réaffecter.');
    const m=s.missions.find(x=>x.id===el.dataset.id&&x.status==='published');
    if(!m||s.reassignId!==m.id)throw Error('Mission modifiée. Actualisez.');
    const worker=doc.getElementById('mission-reassign-worker-'+m.id)?.value||'';
    if(!s.roster.some(w=>w.id===worker&&w.status==='active'))throw Error('Sélectionnez un salarié actif.');
    const order=doc.getElementById('mission-reassign-order-'+m.id)?.value||'';
    const reason=doc.getElementById('mission-reassign-reason-'+m.id)?.value||'';
    const key='reassign:'+m.id,request=reassignRequests.get(key)||doc.defaultView.crypto.randomUUID();
    const args=missionReassignArgs(s.company,m,worker,order,reason,request);
    if(!doc.defaultView.confirm('Réaffecter « '+m.title+' » à un autre salarié ? Vérifiez qualifications et disponibilités. Deux avis internes seront envoyés si les comptes sont actifs; aucune heure ni pointage ne change.'))return true;
    reassignRequests.set(key,request);
    await rpc('reassign_essential_published_mission',args);
    reassignRequests.delete(key);s.reassignId=null;
    await load(s.company,s.roster);
    notify('Mission réaffectée. Les employés concernés ont été avisés si leurs comptes sont actifs.');
   }else if(action==='reschedule-open'){
    if(s.truncated)throw Error('Liste tronquée : actualisez avant de reprogrammer.');
    const m=s.missions.find(x=>x.id===el.dataset.id&&x.status==='published');
    if(!m)throw Error('Mission publiée introuvable. Actualisez.');
    s.rescheduleId=s.rescheduleId===m.id?null:m.id;
   }else if(action==='reschedule-submit'){
    if(s.truncated)throw Error('Liste tronquée : actualisez avant de reprogrammer.');
    const m=s.missions.find(x=>x.id===el.dataset.id&&x.status==='published');
    if(!m||s.rescheduleId!==m.id)throw Error('Mission modifiée : rechargez.');
    const day=doc.getElementById('mission-reschedule-day-'+m.id)?.value||'';
    const site=doc.getElementById('mission-reschedule-site-'+m.id)?.value||'';
    const order=doc.getElementById('mission-reschedule-order-'+m.id)?.value||'';
    const reason=doc.getElementById('mission-reschedule-reason-'+m.id)?.value||'';
    if(!s.sites.some(x=>x.id===site&&x.active))throw Error('Adresse client non disponible. Actualisez le carnet.');
    const key=['reschedule',m.id,day,site,order,reason.trim()].join(':');
    const request=rescheduleRequests.get(key)||doc.defaultView.crypto.randomUUID();
    const args=missionRescheduleArgs(s.company,m,day,site,order,reason,request);
    if(!doc.defaultView.confirm('Reprogrammer « '+m.title+' » au '+day+' ? Le salarié recevra un avis. Vérifiez les disponibilités; aucune heure ni pointage ne change.'))return true;
    rescheduleRequests.set(key,request);
    await rpc('reschedule_essential_published_mission',args);
    rescheduleRequests.delete(key);s.rescheduleId=null;s.day=day;
    await load(s.company,s.roster);notify('Mission reprogrammée et salarié averti si son compte est actif.');
   }else if(action==='swap-order'){
    if(s.truncated)throw Error('Tournée tronquée : rechargez un lot complet avant de modifier l’ordre.');
    const source=s.missions.find(x=>x.id===el.dataset.id);
    const selected=doc.getElementById('mission-swap-'+el.dataset.id)?.value||'';
    const target=publishedSwapTargets(source,s.missions).find(x=>x.id===selected);
    const args=publishedSwapArgs(s.company,source,target);
    if(!doc.defaultView.confirm('Échanger les missions « '+source.title+' » et « '+target.title+
      ' » pour ce salarié ? L’employé recevra un avis; aucune heure ni pointage ne change.'))return true;
    await rpc('swap_essential_published_missions',args);
    await load(s.company,s.roster);
    notify('Ordre publié mis à jour. Un avis interne a été envoyé au salarié concerné si son compte est actif.');
   }else if(action==='edit'){
    const item=s.missions.find(x=>x.id===el.dataset.id&&x.status==='draft');
    if(!item)throw Error('Brouillon non trouvé.');
    s.edit=item;s.form={worker:item.worker_id,site:item.site_id,day:item.mission_day,order:String(item.sort_order),title:item.title,instructions:''};
    s.day=item.mission_day;
   }else if(action==='draft'||action==='publish'){
    const val=x=>doc.getElementById('mission-'+x)?.value||'';
    const form={worker:val('worker'),site:val('site'),day:val('day'),order:val('order'),title:val('title'),instructions:val('instructions')};
    const args=missionArgs(s.company,form,s.edit,action==='publish');
    if(action==='publish'&&!doc.defaultView.confirm('Publier cette mission ? Une mission publiée ne peut pas être réaffectée silencieusement.'))return true;
    await rpc('save_essential_mission',args);
    s.day=form.day;s.edit=null;s.form={worker:form.worker,site:form.site,day:form.day,order:String(Number(form.order)+1),title:'',instructions:''};
    await load(s.company,s.roster);notify(action==='publish'?'Mission publiée (sans pointage).':'Brouillon enregistré.');
   }else return false;
  }catch(err){s.error=err.message;}finally{s.busy=false;redraw();}
  return true;
 }
 return {state:s,load,render,handle,reset};
}
export function createPersonalMissionController({sb,document:doc,escape:e,redraw,notify}){
 const s={company:null,user:null,worker:null,day:missionDate(),items:[],commentRequired:false,photoRequired:false,photoOptional:false,uploadedPhoto:null,checklistRequired:false,checklistItems:[],completionChecks:null,completionDraft:null,enabled:false,previouslyEnabled:false,loadedOnline:false,queued:[],queueMessage:'',error:'',truncated:false,busy:false,pending:new Map(),issue:null,details:null,upcoming:{open:false,day:nextMissionDay(),loadedDay:null,items:[],truncated:false,error:'',busy:false}};
 let generation=0,upcomingGeneration=0,detailsGeneration=0;
 const queueStorage={
  getItem:key=>doc.defaultView.sessionStorage.getItem(key),
  setItem:(key,value)=>doc.defaultView.sessionStorage.setItem(key,value),
  removeItem:key=>doc.defaultView.sessionStorage.removeItem(key),
  getAllKeys:()=>Array.from({length:doc.defaultView.sessionStorage.length},
    (_,i)=>doc.defaultView.sessionStorage.key(i))
 };
 const queueIdentity=()=>({company:s.company,user:s.user,worker:s.worker});
 async function readQueue(identity=queueIdentity()){return listOfflineMissionCompletions({storage:queueStorage,identity});}
 async function load(company,user,worker,day=missionDate()){
  const same=s.company===company&&s.user===user&&s.worker===worker;
  const previous=missionWarningEligible(s.previouslyEnabled||s.enabled,same);
  if(!same){s.pending.clear();s.uploadedPhoto=null;s.issue=null;s.completionDraft=null;s.completionChecks=null;s.queued=[];s.loadedOnline=false;s.queueMessage='';s.upcoming.open=false;s.upcoming.day=nextMissionDay();}
  upcomingGeneration++;detailsGeneration++;s.details=null;Object.assign(s.upcoming,{loadedDay:null,items:[],truncated:false,error:'',busy:false});
  const gen=++generation;Object.assign(s,{company,user,worker,day,items:[],enabled:false,commentRequired:false,photoRequired:false,photoOptional:false,checklistRequired:false,checklistItems:[],previouslyEnabled:previous,error:''});
  if(!company||!worker)return;
  try{
   const response=await sb.rpc('list_essential_missions',{p_company:company,p_day:day,p_worker:worker,p_include_drafts:false});
   if(response.error)throw response.error;
   if(gen!==generation)return;
   s.items=response.data?.items||[];s.commentRequired=!!response.data?.comment_required;s.photoRequired=!!response.data?.photo_required;s.photoOptional=!!response.data?.photo_optional;s.checklistRequired=!!response.data?.checklist_required;
   s.checklistItems=Array.isArray(response.data?.checklist_items)?response.data.checklist_items:[]; s.enabled=!!response.data?.enabled;s.previouslyEnabled=s.enabled;s.truncated=!!response.data?.truncated;s.loadedOnline=true;
   try{const queued=await readQueue({company,user,worker});if(gen!==generation)return;s.queued=queued;s.queueMessage='';}
   catch(e){if(gen!==generation)return;s.queued=[];s.queueMessage='File locale inaccessible : '+String(e?.message||e);}
  }catch{
   if(gen!==generation)return;
   s.error='Missions indisponibles : connexion requise.';
   // Only opaque, context-scoped pending IDs are shown; no stale client/route data.
   try{const queued=await readQueue({company,user,worker});if(gen!==generation)return;s.queued=queued;}
   catch(e){if(gen!==generation)return;s.queued=[];s.queueMessage='File locale inaccessible : '+String(e?.message||e);}
  }
 }
 function reset(){generation++;upcomingGeneration++;detailsGeneration++;Object.assign(s,{company:null,user:null,worker:null,items:[],commentRequired:false,photoRequired:false,photoOptional:false,uploadedPhoto:null,checklistRequired:false,checklistItems:[],completionChecks:null,completionDraft:null,enabled:false,previouslyEnabled:false,loadedOnline:false,queued:[],queueMessage:'',error:'',issue:null,details:null,upcoming:{open:false,day:nextMissionDay(),loadedDay:null,items:[],truncated:false,error:'',busy:false}});s.pending.clear();}
 function render(){
  if(!s.company||!s.worker)return '';
  if(!s.enabled&&s.queued.length)return '<section class="zen-company" role="status"><b>'+s.queued.length+' fin(s) locale(s) toujours en attente.</b><p>Connexion requise pour revalider votre session. Aucune mission n’est confirmée et aucune information client n’est mise en cache.</p><button type="button" class="ess-btn" data-action="mission:sync">Vérifier et synchroniser</button></section>';
  if(!s.enabled&&s.error&&s.previouslyEnabled)return '<section class="zen-company" role="status"><b>Missions momentanément indisponibles</b><small>Connexion requise pour actualiser vos missions. Aucune fin de mission n’a été enregistrée et aucun pointage n’a été modifié.</small></section>';
  if(!s.enabled)return s.queued.length?'<section class="zen-company" role="status"><b>'+s.queued.length+' fin(s) locale(s) non synchronisée(s).</b><button type="button" class="ess-btn" data-action="mission:sync">Vérifier et synchroniser</button></section>':'';
  if(s.truncated)return '<section class="zen-company"><p role="alert">Tournée incomplète; contactez le responsable.</p></section>';
  const p=missionProgress(s.items);
  const platform=navigationPlatform('web',doc.defaultView?.navigator?.userAgent||'');
  let pref=null;try{pref=chooseNavigationPreference(doc.defaultView.localStorage.getItem(navigationPreferenceKey(s.user,s.company)),platform);}catch{}
  const renderUpcoming=()=>{
    const u=s.upcoming;
    let html='<section class="ess-panel" aria-label="Interventions à venir">'+
      s.items.filter(x=>x.issue_decision_at).map(x=>'<p role="status">Décision du responsable : '+e(resolvedMissionNotice(x))+'</p>').join('')+
      '<button type="button" class="ess-btn" data-action="mission:upcoming-toggle">'+
      (u.open?'Masquer mes interventions à venir':'Consulter mes prochaines interventions')+'</button>';
    if(!u.open)return html+'</section>';
    const today=missionDate(),next=nextMissionDay();
    html+='<p class="ess-fine">Consultez une journée à venir (14 jours maximum). Seulement vos missions publiées dans cette compagnie; aucun pointage ni trajet automatique.</p>'+
      '<label class="ess-field">Journée future<input type="date" id="mission-upcoming-day" min="'+e(next)+'" value="'+e(u.day)+'"></label>'+
      '<button type="button" class="ess-btn" data-action="mission:upcoming-load" '+(u.busy?'disabled':'')+'>Afficher cette journée</button>';
    if(u.busy)html+='<p role="status">Chargement des interventions...</p>';
    if(u.error)html+='<p role="alert">'+e(u.error)+'</p>';
    if(u.truncated)html+='<p role="alert">Plus de 200 interventions : tournée future incomplète. Contactez le responsable.</p>';
    if(u.loadedDay&&!u.truncated&&!u.busy&&!u.error){
      const tour=personalMissionTour(u.items,s.worker,25,u.loadedDay);
      html+='<h4>Interventions du '+e(u.loadedDay)+'</h4>'+
        (!tour.total?'<p>Aucune mission publiée pour cette journée.</p>':
         '<p>'+tour.total+' mission(s) pour cette journée'+(tour.hasMore?' — 25 premières affichées':'')+'.</p>')+
        (tour.ambiguous?'<p role="alert">Ordre identique sur plusieurs étapes : confirmez la séquence avec votre responsable.</p>':'')+
        tour.rows.map(stop=>{
          const route=missionNavigationOptions(stop,platform,pref);
          return '<article class="ess-person"><b>'+e(stop.sort_order+'. '+stop.title)+'</b><small>'+
           e(stop.client_name)+' · '+e(stop.site_name)+' · '+e(stop.status==='published'?'À faire':stop.status==='in_progress'?'En cours':stop.status==='completed'?'Terminée':'À traiter')+
           '</small><small>'+e(missionAddress(stop))+'</small>'+
           (stop.status==='published'?route.choices.map(choice=>'<a href="'+e(choice.url)+'" target="_blank" rel="noopener noreferrer">'+e(choice.label)+' · cette intervention ↗</a>').join(''):'')+
           '</article>';
        }).join('');
    }
    return html+'</section>';
  };
  const queueNotice=()=> (s.queued.length?
    '<p role="status">'+s.queued.length+' fin(s) en attente : le serveur n’a PAS confirmé la fin.</p>'+
    '<button type="button" class="ess-btn" data-action="mission:sync" '+(s.busy?'disabled':'')+'>Vérifier et synchroniser les fins en attente</button>':'')+
    (s.queueMessage?'<p role="alert">'+e(s.queueMessage)+'</p>':'');
  const showUpcoming=html=>html+queueNotice()+renderUpcoming();
  if(!p.total)return showUpcoming('<section class="zen-company"><b>Aucune mission pour aujourd’hui.</b></section>');
  const renderTour=()=>{
    const tour=personalMissionTour(s.items,s.worker);
    return '<details class="ess-panel"><summary>Voir mes interventions de la journée ('+tour.total+')</summary>'+
      '<p>Ordre publié par votre responsable, sans calcul automatique de trajet ni changement de pointage.</p>'+
      (tour.ambiguous?'<p role="alert">Deux étapes ont le même rang : ordre à confirmer avec le responsable.</p>':'')+
      tour.rows.map(stop=>{
       const options=missionNavigationOptions(stop,platform,pref).choices;
       return '<article class="ess-person"><b>'+e(stop.title)+'</b><small>'+
        e(stop.client_name)+' · '+e(stop.site_name)+' · '+(stop.status==='completed'?'Terminée':stop.status==='impossible'?'À traiter':stop.status==='in_progress'?'En cours':'À faire')+
        '</small><small>'+e(missionAddress(stop))+'</small>'+ 
        (stop.status==='impossible'?'<small>Motif : '+e(missionIssueLabel(stop.issue_reason))+'</small>':'')+
        (['published','in_progress'].includes(stop.status)?options.map(route=>'<a href="'+e(route.url)+'" target="_blank" rel="noopener noreferrer">'+
        e(route.label)+' · cette étape ↗</a>').join(''):'')+'</article>';
      }).join('')+
      (tour.hasMore?'<p>Seules les 25 premières étapes sont affichées; demander une tournée segmentée au responsable.</p>':'')+
      '</details>';
  };
  if(p.allDone)return showUpcoming('<section class="zen-company"><b>Toutes les missions sont terminées.</b><small>Votre session de travail reste indépendante.</small></section>'+renderTour());
  if(!p.next&&!p.ambiguous&&p.blocked)return showUpcoming('<section class="zen-company" role="status"><b>Mission signalée au responsable</b><p>Aucune prochaine étape publiée. Le responsable doit traiter le signalement; votre pointage reste inchangé.</p></section>'+renderTour());
  if(p.ambiguous)return '<section class="zen-company" aria-label="Ordre des missions à confirmer">'+
   '<p role="alert"><b>Prochaine mission indéterminée</b> : plusieurs interventions publiées ont le même rang ('+
   e(p.ambiguousRank)+'). Demandez au responsable de confirmer la séquence. Aucun itinéraire n’est choisi automatiquement et aucune mission n’a été terminée.</p>'+
   renderTour()+'</section>'+renderUpcoming();
  const x=p.next,addr=missionAddress(x);
  const routes=missionNavigationOptions(x,platform,pref);
  return '<section class="zen-company" aria-label="Prochaine mission">'+queueNotice()+'<div>'+(s.error?'<p role="alert">'+e(s.error)+'</p>':'')+'<small>'+(x.status==='in_progress'?'Mission en cours':'Prochaine mission')+' · '+(p.done+p.blocked+1)+' de '+p.total+'</small>'+
   '<strong>'+e(x.title)+' · '+e(x.client_name)+' · '+e(x.site_name)+'</strong><small>'+e(addr)+'</small>'+
   (routes.preferred?'<a href="'+e(routes.preferred.url)+'" target="_blank" rel="noopener noreferrer">Itinéraire avec '+e(routes.preferred.label)+' ↗</a>':'')+
   (routes.choices.length?'<details '+(!routes.preferred?'open':'')+'><summary>'+(routes.preferred?'Changer d’application d’itinéraire':'Choisir l’application d’itinéraire')+'</summary>'+
     '<p>Adresse de cette mission seulement. Aucun GPS PUNCH, temps de trajet ou pointage déclenché.</p>'+
     routes.choices.map(route=>'<p><a href="'+e(route.url)+'" target="_blank" rel="noopener noreferrer">'+e(route.label)+' · juste cette fois ↗</a></p>').join('')+
     '</details>':'')+
   renderTour()+
   '<p>Terminer cette mission ne termine pas votre journée.</p>'+ 
   '<button type="button" class="ess-btn" data-action="mission:details-'+(s.details?.id===x.id?'close':'open')+'" data-id="'+e(x.id)+'"> '+(s.details?.id===x.id?'Masquer les détails':'Détails de la mission')+'</button>'+
   (s.details?.id===x.id?'<section class="ess-panel" aria-label="Instructions de mission"><h4>Instructions de cette mission</h4>'+
     (s.details.loading?'<p role="status">Chargement sécurisé...</p>':
      s.details.error?'<p role="alert">'+e(s.details.error)+'</p>':
      '<p>'+e(s.details.instructions||'Aucune instruction supplémentaire publiée.')+'</p>')+
     '<p class="ess-fine">Informations consultées sur demande. Ne modifie pas le pointage et ne démarre aucun GPS.</p></section>':'')+
   (x.status==='published'?'<button type="button" class="ess-btn" data-action="mission:start" data-id="'+e(x.id)+'" '+(s.busy?'disabled':'')+'>Commencer cette mission</button>':'')+
   (s.checklistRequired?'<div class="ess-panel" aria-label="Checklist de fin obligatoire"><b>Confirmez toutes les étapes avant de terminer</b>'+
     s.checklistItems.map((item,i)=>'<label class="ess-field"><input type="checkbox" id="mission-proof-check-'+e(x.id)+'-'+i+'" '+
      (s.completionChecks?.id===x.id&&s.completionChecks.checked.includes(i)?'checked':'')+'> '+e(item)+'</label>').join('')+'</div>':'')+
   (s.commentRequired?'<label class="ess-field">Commentaire de fin obligatoire (5 à 1000 caractères)<textarea id="mission-completion-comment-'+e(x.id)+'" maxlength="1000" rows="4">'+e(s.completionDraft?.id===x.id?s.completionDraft.text:'')+'</textarea></label><p class="ess-fine">Commentaire privé, visible uniquement par les responsables autorisés de cette compagnie.</p>':'')+
   ((s.photoRequired||s.photoOptional)?'<label class="ess-field">Photo privée '+(s.photoRequired?'obligatoire':'facultative')+' (JPEG, PNG ou WebP, maximum 5 Mio)<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" id="mission-photo-file-'+e(x.id)+'"></label>'+(s.uploadedPhoto?.mission===x.id&&s.uploadedPhoto?.version===x.version?'<p role="status">Photo déjà téléversée, en attente de la fin.</p>':''):'')+
    (s.queued.some(q=>q.mission===x.id&&q.version===x.version)?
      '<p role="status">Fin de cette mission en attente de confirmation serveur.</p>':
      '<button type="button" class="ess-btn" data-action="mission:finish" data-id="'+e(x.id)+'" '+(s.busy?'disabled':'')+'>'+(s.checklistRequired?'Terminer avec checklist':s.commentRequired?'Terminer avec commentaire':'Terminer')+'</button>')+ 
   '<button type="button" class="ess-btn" data-action="mission:issue-open" data-id="'+e(x.id)+'" '+(s.busy?'disabled':'')+'>Signaler une mission impossible</button>'+
   (s.issue?.id===x.id?'<div class="ess-panel"><p>Le responsable sera informé. Aucun retard, absence ou pointage ne sera déduit.</p>'+
    '<label>Motif<select id="mission-issue-reason"><option value="">Choisir un motif</option>'+MISSION_ISSUE_REASONS.map(([k,v])=>'<option value="'+e(k)+'" '+(s.issue.reason===k?'selected':'')+'>'+e(v)+'</option>').join('')+'</select></label>'+
    '<label>Précision privée (facultative)<textarea id="mission-issue-note" maxlength="300">'+e(s.issue.note||'')+'</textarea></label>'+
    '<button type="button" class="ess-btn" data-action="mission:issue-submit" data-id="'+e(x.id)+'" '+(s.busy?'disabled':'')+'>Confirmer le signalement</button>'+
    '<button type="button" class="ess-btn" data-action="mission:issue-close" data-id="'+e(x.id)+'">Annuler</button></div>':'')+
   '</div></section>'+renderUpcoming();
 }
 async function handleUpcoming(action){
  if(!s.company||!s.worker||!s.user||!s.enabled||s.truncated)throw Error('Consultation des missions non autorisée.');
  const u=s.upcoming;
  if(action==='toggle'){
   upcomingGeneration++;u.open=!u.open;Object.assign(u,{items:[],loadedDay:null,truncated:false,error:'',busy:false});redraw();return true;
  }
  if(action!=='load'||!u.open||u.busy)throw Error('Ouvrez la consultation avant de choisir une journée.');
  const day=doc.getElementById('mission-upcoming-day')?.value||u.day;
  u.day=day;Object.assign(u,{items:[],loadedDay:null,truncated:false,error:'',busy:true});
  const gen=++upcomingGeneration,company=s.company,worker=s.worker,user=s.user;
  try{
   validateUpcomingMissionDay(day,missionDate());
   if(doc.defaultView.navigator.onLine===false)throw Error('Connexion requise pour les prochaines interventions.');
   const response=await sb.rpc('list_essential_missions',{p_company:company,p_day:day,p_worker:worker,p_include_drafts:false});
   if(response.error)throw response.error;
   if(gen!==upcomingGeneration||company!==s.company||worker!==s.worker||user!==s.user)return false;
   if(!response.data?.enabled)throw Error('Missions désactivées dans cette compagnie.');
   u.items=response.data.items||[];u.truncated=!!response.data.truncated;u.loadedDay=day;return true;
  }catch(err){if(gen===upcomingGeneration)u.error=err.message||'Interventions à venir indisponibles.';return false;}
  finally{if(gen===upcomingGeneration){u.busy=false;redraw();}}
 }
 async function handleDetails(action,id){
  if(!s.company||!s.user||!s.worker||!s.enabled||s.truncated||s.busy)
   throw Error('Détails non autorisés pour cette compagnie.');
  if(action==='close'){
   detailsGeneration++;s.details=null;redraw();return true;
  }
  const next=missionProgress(s.items).next;
  if(action!=='open'||!next||next.id!==id||!['published','in_progress'].includes(next.status)||missionProgress(s.items).ambiguous)
   throw Error('Mission publiée absente ou modifiée : actualisez.');
  const gen=++detailsGeneration,company=s.company,user=s.user,worker=s.worker,version=next.version;
  s.details={id,version,loading:true,error:'',instructions:''};redraw();
  try{
   if(doc.defaultView.navigator.onLine===false)throw Error('Connexion requise pour afficher les instructions privées.');
   const response=await sb.rpc('get_essential_published_mission_details',{p_company:company,p_id:id,p_version:version});
   if(response.error)throw response.error;
   if(gen!==detailsGeneration||s.company!==company||s.user!==user||s.worker!==worker)return false;
   const current=missionProgress(s.items).next;
   if(!current||current.id!==id||current.version!==version||
    response.data?.id!==id||response.data?.version!==version)
    throw Error('Mission actualisée entre-temps. Rechargez les détails.');
   s.details.instructions=String(response.data.instructions||'');return true;
  }catch(err){if(gen===detailsGeneration){s.details.instructions='';s.details.error=err.message||'Détails indisponibles.';}return false;}
  finally{if(gen===detailsGeneration){s.details.loading=false;redraw();}}
 }
 async function handleIssue(action,id){
  if(!s.company||!s.worker||!s.enabled||s.busy||s.truncated)throw Error('Mission non autorisée ou tournée incomplète.');
  const progress=missionProgress(s.items);
  if(progress.ambiguous||progress.next?.id!==id)throw Error('Ordre modifié : actualisez avant de signaler.');
  const mission=s.items.find(x=>x.id===id&&['published','in_progress'].includes(x.status));
  if(!mission)throw Error('Mission modifiée : actualisez.');
  if(action==='issue-open'){s.issue={id,reason:'',note:''};redraw();return true;}
  if(action==='issue-close'){s.issue=null;redraw();return true;}
  if(action!=='issue-submit'||s.issue?.id!==id)throw Error('Ouvrez le signalement de cette mission.');
  const reason=doc.getElementById('mission-issue-reason')?.value||'';
  const note=doc.getElementById('mission-issue-note')?.value||'';
  if(!MISSION_ISSUE_REASONS.some(x=>x[0]===reason))throw Error('Choisissez un motif.');
  if(String(note).trim().length>300)throw Error('Précision trop longue (300 caractères maximum).');
  s.issue={id,reason,note};
  if(doc.defaultView.navigator.onLine===false)throw Error('Connexion requise : aucun signalement enregistré.');
  if(!doc.defaultView.confirm('Signaler cette mission impossible ? Votre pointage ne change pas.'))return false;
  const key='issue:'+id,request=s.pending.get(key)||doc.defaultView.crypto.randomUUID();
  const args=missionIssueArgs(s.company,mission,reason,note,request);
  s.pending.set(key,request);s.busy=true;s.error='';
  try{
   const result=await sb.rpc('report_essential_mission_issue',args);
   if(result.error)throw result.error;
   s.pending.delete(key);s.issue=null;
   await load(s.company,s.user,s.worker,s.day);
   notify('Mission impossible signalée au responsable. Aucun pointage modifié.');
   return true;
  }catch{ s.error='Signalement non confirmé : vérifiez la connexion et réessayez la même demande.';return false; }
  finally{s.busy=false;redraw();}
 }
 async function start(id){
  if(!s.company||!s.worker||!s.enabled||s.busy||s.truncated)
   throw Error('Début de mission non autorisé.');
  const state=missionProgress(s.items);
  if(state.ambiguous||state.next?.id!==id||state.next.status!=='published')
   throw Error('Ordre publié ambigu ou mission modifiée : actualisez.');
  if(!doc.defaultView.navigator.onLine)throw Error('Connexion requise. Mission non commencée.');
  if(!doc.defaultView.confirm('Commencer cette mission sans démarrer votre pointage ?'))return false;
  const m=state.next,key='start:'+id,request=s.pending.get(key)||doc.defaultView.crypto.randomUUID();
  s.pending.set(key,request);s.busy=true;s.error='';
  try{
   const response=await sb.rpc('start_essential_mission',{p_company:s.company,p_mission:m.id,
    p_version:m.version,p_request:request});
   if(response.error)throw response.error;
   s.pending.delete(key);
   await load(s.company,s.user,s.worker,s.day);
   notify('Mission en cours. Votre pointage et vos heures sont inchangés.');
   return true;
  }catch{s.error='Début non confirmé : vérifiez la connexion et réessayez la même demande.';return false;}
  finally{s.busy=false;redraw();}
 }
 async function syncQueued(){
  if(!s.company||!s.worker||!s.user||s.busy)throw Error('Synchronisation non autorisée.');
  if(doc.defaultView.navigator.onLine===false)throw Error('Connexion requise pour synchroniser les fins en attente.');
  const company=s.company,user=s.user,worker=s.worker,gen=generation,day=s.day;
  const requireContext=()=>{
   if(gen!==generation||s.company!==company||s.user!==user||s.worker!==worker)
    throw Error('Contexte de travail modifié : aucune synchronisation.');
  };
  s.busy=true;s.error='';
  try{
   const result=await syncOfflineMissionCompletions({
    storage:queueStorage,identity:{company,user,worker},
    verifyUser:async()=>{
     requireContext();
     const verified=await sb.auth.getUser();
     requireContext();
     if(verified.error)throw verified.error;
     return verified.data?.user?.id;
    },
    fetchDay:async pendingDay=>{
     requireContext();
     const res=await sb.rpc('list_essential_missions',
      {p_company:company,p_day:pendingDay,p_worker:worker,p_include_drafts:false});
     requireContext();
     if(res.error)throw res.error;
     return res.data;
    },
    nextMissionId:rows=>{
     const progress=missionProgress(rows);
     return progress.ambiguous?null:progress.next?.id;
    },
    send:async entry=>{
     requireContext();
     const res=await sb.rpc('complete_essential_mission',
      {p_company:company,p_id:entry.mission,p_version:entry.version,p_request:entry.request});
     requireContext();
     if(res.error)throw res.error;
     return res.data;
    }
   });
   requireContext();
   s.queued=await readQueue();
   s.queueMessage=result.conflicts.length?
    result.conflicts.length+' demande(s) nécessitent une vérification manuelle (mission ou règles modifiées).':'';
   if(result.networkError)s.queueMessage+=' '+result.networkError;
   s.busy=false;
   await load(company,user,worker,day);
   if(result.sent)notify(result.sent+' fin(s) confirmée(s) par le serveur. Aucun pointage modifié.');
   if(result.conflicts.length||result.networkError)s.queueMessage=
    (result.conflicts.length+' demande(s) encore en attente. '+(result.networkError||'Vérification manuelle requise.')).trim();
   return !result.networkError;
  }catch(err){s.error='Synchronisation non confirmée : '+String(err?.message||err);return false;}
  finally{s.busy=false;redraw();}
 }
 async function finish(id){
  if(!s.company||!s.worker||!s.enabled||s.busy)throw Error('Mission non autorisée.');
  const latest=missionProgress(s.items);
  if(s.truncated||latest.ambiguous||latest.next?.id!==id)throw Error('Ordre des missions non confirmé ou modifié : rechargez et contactez votre responsable.');
  const x=s.items.find(m=>m.id===id&&['published','in_progress'].includes(m.status));if(!x)throw Error('Mission modifiée : rechargez.');
  const proof=s.commentRequired?String(doc.getElementById('mission-completion-comment-'+id)?.value??s.completionDraft?.text??'').trim():null;
  if(s.commentRequired){s.completionDraft={id,text:proof};if(proof.length<5||proof.length>1000)throw Error('Commentaire de fin requis (5 à 1000 caractères).');}
  if(s.checklistRequired){
   const checked=s.checklistItems.map((_,i)=>doc.getElementById('mission-proof-check-'+id+'-'+i)?.checked?i:-1).filter(i=>i>=0);
   s.completionChecks={id,checked};
   if(!missionChecklistConfirmed(s.checklistItems,checked))throw Error('Cochez toutes les étapes de la checklist avant de terminer.');
  }
  const candidate=(s.photoRequired||s.photoOptional)?doc.getElementById('mission-photo-file-'+id)?.files?.[0]:null;
  const cached=s.uploadedPhoto?.mission===id&&s.uploadedPhoto?.version===x.version?s.uploadedPhoto:null;
  if(s.photoRequired&&!candidate&&!cached)throw Error('Choisissez une photo de fin de mission.');
  if(candidate&&(candidate.size<16||candidate.size>5*1024*1024||
    !['image/jpeg','image/png','image/webp'].includes(candidate.type)))throw Error('Photo invalide : JPEG, PNG ou WebP, maximum 5 Mio.');
  if(doc.defaultView.navigator.onLine===false){
   if(!missionOfflineEligible({verified:s.loadedOnline,enabled:s.enabled,truncated:s.truncated,
       ambiguous:latest.ambiguous,commentRequired:s.commentRequired,checklistRequired:s.checklistRequired,
       photoRequired:s.photoRequired,photoSelected:!!candidate||!!cached,mission:x}))
    throw Error('Cette mission exige des preuves ou une validation en ligne. Aucune fin mise en attente.');
   if(!doc.defaultView.confirm('Mettre cette fin en attente hors ligne ? Elle ne sera officielle qu’après synchronisation et nouvelle vérification des droits.'))return false;
   s.busy=true;
   try{
    await queueOfflineMissionCompletion({storage:queueStorage,
     identity:{...queueIdentity(),mission:id,version:x.version},day:s.day,
     uuid:()=>doc.defaultView.crypto.randomUUID()});
    s.queued=await readQueue();
    notify('Fin enregistrée en attente de synchronisation. Aucun pointage modifié.');return true;
   }catch(err){s.error='Mise en attente impossible : '+String(err?.message||err);return false;}
   finally{s.busy=false;redraw();}
  }
  if(s.queued.some(q=>q.mission===id&&q.version===x.version))return syncQueued();
  if(!doc.defaultView.confirm('Terminer « '+x.title+' » sans pointer la sortie ?'))return false;
  s.busy=true;
  try{
   const durable=await reserveMissionCompletionRequest({
    storage:doc.defaultView.sessionStorage,
    identity:{company:s.company,user:s.user,worker:s.worker,mission:id,version:x.version},
    uuid:()=>doc.defaultView.crypto.randomUUID()
   });
   const request=durable.id;
   let photo=cached?.photoId||null;
   if((s.photoRequired||s.photoOptional)&&candidate&&!photo){
    const body=new doc.defaultView.FormData();
    body.append('company',s.company);body.append('mission',id);body.append('version',String(x.version));
    body.append('file',candidate,candidate.name);
    const uploaded=await sb.functions.invoke('mission-photo',{body});
    if(uploaded.error||!uploaded.data?.photo_id)throw Error('Téléversement non confirmé.');
    photo=uploaded.data.photo_id;
    s.uploadedPhoto={mission:id,version:x.version,photoId:photo};
   }
   const resp=await sb.rpc(photo?'complete_essential_mission_v4':s.checklistRequired?'complete_essential_mission_v3':s.commentRequired?'complete_essential_mission_v2':'complete_essential_mission',{
    p_company:s.company,p_id:id,p_version:x.version,p_request:request,...(s.commentRequired||s.checklistRequired||photo?{p_comment:proof}:{}),
    ...(s.checklistRequired||photo?{p_checklist:s.checklistRequired?s.checklistItems:null}:{}),...(photo?{p_photo:photo}:{})});
   if(resp.error)throw resp.error;
   await acknowledgeMissionCompletionRequest(doc.defaultView.sessionStorage,durable);
   s.pending.delete(id);s.completionDraft=null;s.completionChecks=null;s.uploadedPhoto=null;
   await load(s.company,s.user,s.worker,s.day);notify('Mission terminée; votre pointage ne change pas.');return true;
  }catch(err){s.error='Fin non confirmée : '+(String(err?.message||'').includes('Commentaire')?'commentaire requis; actualisez les missions.':'vérifiez la connexion et réessayez la même demande.');return false;}
  finally{s.busy=false;redraw();}
 }
 return {state:s,load,render,start,finish,syncQueued,handleIssue,handleUpcoming,handleDetails,reset};
}
