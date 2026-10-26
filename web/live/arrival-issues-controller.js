import {arrivalIssuePayload,arrivalIssueForShift,canReportArrivalIssue,arrivalStatusLabel,ARRIVAL_ISSUE_LABELS} from './arrival-issues.js';

/** Private sidecar of the published schedule. Never calls punch/GPS/absence/payment. */
export function createArrivalIssuesController({sb,document:doc,escape:e,redraw,notify,workerLabel=(id)=>id}){
 let revision=0;
 const s={company:null,user:null,own:null,manager:false,items:[],hasMore:false,unavailable:false,
  openShift:null,openKind:null,request:null,error:'',busy:false};
 const rpc=async(name,args)=>{const result=await sb.rpc(name,args);if(result.error)throw result.error;return result.data;};
 const btn=(title,action,attr='')=>'<button class="ess-btn" type="button" data-action="ess:plan-arrival-'+action+'" '+attr+
  (s.busy?' disabled':'')+'>'+e(title)+'</button>';
 async function refresh(){
  const at=++revision,company=s.company,user=s.user;
  if(!company||!user){s.items=[];s.unavailable=true;return;}
  try{
   const result=await rpc('list_essential_shift_arrival_issues',{p_company:company});
   if(at!==revision||s.company!==company||s.user!==user)return;
   s.items=Array.isArray(result?.items)?result.items:[];s.hasMore=!!result?.has_more;s.unavailable=false;
  }catch{if(at===revision){s.items=[];s.unavailable=true;}}
 }
 async function load(company,user,own,role){
  if(s.company!==company||s.user!==user){
   reset();s.company=company;s.user=user;
  }
  s.own=own;s.manager=['boss','admin'].includes(role);
  await refresh();
 }
 function reset(){revision++;Object.assign(s,{company:null,user:null,own:null,manager:false,items:[],
  hasMore:false,unavailable:false,openShift:null,openKind:null,request:null,error:'',busy:false});}
 function renderForm(shifts){
  if(!s.openShift||s.unavailable)return '';
  const sh=shifts.find(x=>x.id===s.openShift);
  if(!canReportArrivalIssue(sh,s.own,arrivalIssueForShift(s.items,s.openShift,s.openKind))){
   return '<p role="alert">Ce quart ne peut plus être signalé.</p>';
  }
  return '<section class="ess-panel" aria-label="Communication volontaire sur mon quart"><h3>'+
  e(ARRIVAL_ISSUE_LABELS.find(x=>x[0]===s.openKind)?.[1]||'Signalement')+'</h3>'+
  '<p class="ess-fine">Un avis sera envoyé au responsable. Aucune arrivée, absence, durée de route, GPS, sortie, heure payée ou retard ne sera déduit automatiquement.</p>'+
  '<label class="ess-field">Précision facultative (500 caractères max)<input id="arrival-message" maxlength="500" autocomplete="off"></label>'+
  (s.openKind==='late'?'<label class="ess-field">Retard estimé en minutes (facultatif, 1–240)<input id="arrival-eta" inputmode="numeric" type="number" min="1" max="240"></label>':'')+
  btn('Confirmer et avertir le responsable','report','data-id="'+e(s.openShift)+'"')+
  btn('Annuler','cancel')+'</section>';
 }
 function renderControls(shift){
  if(s.unavailable||!s.own||shift.worker_id!==s.own)return '';
  return ARRIVAL_ISSUE_LABELS.map(([kind,label])=>{
   const existing=arrivalIssueForShift(s.items,shift.id,kind);
   if(existing)return '<p role="status">'+e(label)+' : '+e(arrivalStatusLabel(existing))+'</p>';
   return canReportArrivalIssue(shift,s.own,null)?btn(label,'open','data-id="'+e(shift.id)+'" data-kind="'+kind+'"'):'';
  }).join('');
 }
 function renderInbox(){
  if(!s.manager||s.unavailable)return '';
  return '<section class="ess-panel" aria-label="Signalements des arrivées et accès"><h3>Retards déclarés et problèmes d’accès</h3>'+
  '<p class="ess-fine">Messages volontairement envoyés par les salariés pour leurs quarts; pas de déduction GPS, de paie ou d’absence.</p>'+
  (s.hasMore?'<p role="alert">Plus de 500 signalements. Le résultat est limité : consulter l’historique séparément.</p>':'')+
  (s.items.length?s.items.map(x=>'<article class="ess-person"><div>'+
   '<b>'+e(x.kind==='late'?'Retard déclaré':'Problème d’accès')+'</b>'+
   '<small>Salarié : '+e(workerLabel(x.worker_id))+' · Quart : '+e(x.shift_id)+'</small>'+
   (x.estimate_minutes?'<small>Estimation volontaire : '+e(x.estimate_minutes)+' min (non vérifiée)</small>':'')+
   (x.private_message?'<p>'+e(x.private_message)+'</p>':'')+
   '<small>'+e(arrivalStatusLabel(x))+'</small></div>'+
   (x.status==='reported'?btn('Pris en charge','ack','data-id="'+e(x.id)+'"'):'')+
   '</article>').join(''):'<p>Aucun signalement récent.</p>')+'</section>';
 }
 async function handle(action,el,shifts){
  s.error='';const id=el.dataset?.id;
  if(action==='cancel'){s.openShift=null;s.openKind=null;s.request=null;redraw();return true;}
  if(action==='open'){
   const kind=el.dataset?.kind,shift=shifts.find(x=>x.id===id);
   if(!ARRIVAL_ISSUE_LABELS.some(x=>x[0]===kind)||s.unavailable||
    !canReportArrivalIssue(shift,s.own,arrivalIssueForShift(s.items,id,kind)))return true;
   s.openShift=id;s.openKind=kind;s.request=null;redraw();return true;
  }
  if(s.busy)return true;
  s.busy=true;
  try{
   if(action==='report'){
    const shift=shifts.find(x=>x.id===id);
    if(s.openShift!==id||!canReportArrivalIssue(shift,s.own,arrivalIssueForShift(s.items,id,s.openKind)))throw Error('Ce quart ne peut plus être signalé.');
    const payload=arrivalIssuePayload(s.openKind,doc.getElementById('arrival-message')?.value||'',doc.getElementById('arrival-eta')?.value||'');
    if(!doc.defaultView.confirm('Envoyer ce signalement au responsable ? Aucun pointage ni statut d’absence ne sera modifié.'))return true;
    if(!s.request||s.request.shift!==id||s.request.kind!==s.openKind)
      s.request={shift:id,kind:s.openKind,id:doc.defaultView.crypto.randomUUID()};
    await rpc('report_essential_shift_arrival_issue',{
      p_shift:id,p_expected_version:shift.version,...payload,p_request:s.request.id});
    s.openShift=null;s.openKind=null;s.request=null;
    await refresh();notify('Signalement transmis; vous verrez la prise en charge dans votre horaire.');
   }else if(action==='ack'){
    if(!s.manager||!s.items.some(x=>x.id===id&&x.status==='reported'))throw Error('Responsable autorisé requis.');
    await rpc('ack_essential_shift_arrival_issue',{p_company:s.company,p_issue:id});
    await refresh();notify('Signalement pris en charge. Une confirmation a été envoyée à l’employé.');
   }
  }catch(err){s.error=err.message;notify(s.error);}finally{s.busy=false;redraw();}
  return true;
 }
 return {state:s,load,reset,refresh,renderForm,renderControls,renderInbox,handle};
}
