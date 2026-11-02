import {durableLedgerRequest} from './idempotency.js';
export const blankMissingDay=()=>({worker:'',job:'',start:'',end:'',reason:'',breaks:[]});
export function missingDayPayload(company,form){
 const date=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value)))throw Error('Date complète avec fuseau requise, ex. 2026-10-20T08:00:00-04:00');const [y,m,d]=value.slice(0,10).split('-').map(Number),calendar=new Date(Date.UTC(y,m-1,d));if(calendar.getUTCMonth()!==m-1||calendar.getUTCDate()!==d)throw Error('Date de calendrier invalide');return new Date(value).toISOString()};
 if(!company||!form.worker||!form.job||form.reason.trim().length<3||form.reason.trim().length>1000)throw Error('Salarié, établissement et motif requis');
 const start=date(form.start),end=date(form.end);if(end<=start||Date.parse(end)-Date.parse(start)>26*3600000)throw Error('La fin doit suivre le début, maximum 26 heures');
 if(!Array.isArray(form.breaks)||form.breaks.length>12)throw Error('Maximum 12 pauses');const breaks=form.breaks.map(p=>({start:date(p.start),end:date(p.end),paid:p.paid===true}));
 for(let i=0;i<breaks.length;i++){const p=breaks[i];if(p.start<start||p.end>end||p.end<=p.start||breaks.some((q,j)=>j<i&&p.start<q.end&&p.end>q.start))throw Error('Pauses à l’intérieur de la journée, sans chevauchement');}
 return {p_company:company,p_worker:form.worker,p_job:form.job,p_start:start,p_end:end,p_breaks:breaks,p_reason:form.reason.trim()};
}
/** Read-only employee summary. This does not turn a pending request into approved time. */
export function employeeMissingDaysSummary({companyId,userId,source}={}){
 const empty={ready:false,requests:[]};
 if(!companyId||!userId||source?.company!==companyId||source.user!==userId||
    source.loaded!==true||!Array.isArray(source.workers)||!Array.isArray(source.requests))return empty;
 const workers=new Set(source.workers.filter(w=>w?.auth_user_id===userId&&typeof w.id==='string').map(w=>w.id));
 const labels={pending:'En attente',approved:'Approuvée',rejected:'Refusée',cancelled:'Annulée'};
 const rows=source.requests.filter(r=>r?.company_id===companyId&&workers.has(r.worker_id)&&
  typeof r.id==='string'&&Object.hasOwn(labels,r.status)&&
  typeof r.starts_at==='string'&&Number.isFinite(Date.parse(r.starts_at)))
  .sort((a,b)=>Date.parse(b.created_at||b.starts_at)-Date.parse(a.created_at||a.starts_at))
  .slice(0,8).map(r=>({id:r.id,startsAt:r.starts_at,endsAt:r.ends_at,
   status:r.status,label:labels[r.status]}));
 return {ready:true,requests:rows};
}

/**
 * Summary for the existing manager approval page. Read-only: all decisions
 * remain in the established missing-days controller and the server RPC/RLS.
 * Never show a row from another company, another account or an unknown worker.
 */
export function managerMissingDayApprovalSummary({companyId,reviewerId,source}={}){
 const empty={ready:false,count:0,requests:[]};
 if(typeof companyId!=='string'||!companyId||typeof reviewerId!=='string'||!reviewerId||
    source?.company!==companyId||source.user!==reviewerId||
    !['boss','admin'].includes(source.role)||source.loaded!==true||
    !Array.isArray(source.workers)||!Array.isArray(source.requests))return empty;
 const workers=new Map(source.workers.filter(w=>typeof w?.id==='string'&&w.id&&
  typeof w.auth_user_id==='string').map(w=>[w.id,w]));
 const pending=source.requests.filter(r=>r?.company_id===companyId&&
  r.status==='pending'&&typeof r.id==='string'&&r.id&&
  typeof r.worker_id==='string'&&workers.has(r.worker_id)&&
  workers.get(r.worker_id).auth_user_id!==reviewerId&&
  r.requested_by!==reviewerId&&typeof r.starts_at==='string'&&
  Number.isFinite(Date.parse(r.starts_at)))
  .sort((a,b)=>Date.parse(b.created_at||b.starts_at)-Date.parse(a.created_at||a.starts_at));
 return {ready:true,count:pending.length,requests:pending.slice(0,5).map(r=>({
  id:r.id,startsAt:r.starts_at,endsAt:typeof r.ends_at==='string'&&
   Number.isFinite(Date.parse(r.ends_at))?r.ends_at:null,
  workerName:[workers.get(r.worker_id).first_name,workers.get(r.worker_id).last_name]
   .filter(x=>typeof x==='string'&&x.trim()).join(' ')||'Salarié'
 }))};
}

export function createMissingDaysController({sb,redraw,escape:e,storage=globalThis.localStorage,crypto=globalThis.crypto}){
 let generation=0;const s={company:null,user:null,role:null,workers:[],jobs:[],requests:[],form:blankMissingDay(),note:'',busy:false,loaded:false,error:''},manager=()=>['boss','admin'].includes(s.role);
 function reset(){generation++;Object.assign(s,{company:null,user:null,role:null,workers:[],jobs:[],requests:[],form:blankMissingDay(),note:'',busy:false,loaded:false,error:''})}
 const rpc=async(name,args)=>{const r=await sb.rpc(name,args);if(r.error)throw r.error;return r.data};
 async function refresh(){
  const n=generation,company=s.company,worker=s.form.worker;
  s.loaded=false;
  // Employees need only their own worker record, never a company-wide inbox.
  let requestsQuery=sb.from('essential_missing_days').select('*').eq('company_id',company);
  if(!manager()&&worker)requestsQuery=requestsQuery.eq('worker_id',worker);
  const requestsPromise=!manager()&&!worker?Promise.resolve({data:[],error:null}):
   requestsQuery.order('created_at',{ascending:false}).limit(100);
  const [requests,jobs]=await Promise.all([requestsPromise,
   sb.from('jobs').select('id,name').eq('company_id',company)]);
  if(n!==generation)return;
  if(requests.error||jobs.error)throw requests.error||jobs.error;
  s.requests=requests.data||[];s.jobs=jobs.data||[];s.form.job||=s.jobs[0]?.id||'';
  s.loaded=true;
 }
 async function load(account,user,workers=[]){reset();const n=generation;s.company=account?.company_id;s.user=user;s.role=account?.role;s.workers=manager()?workers:workers.filter(w=>w.auth_user_id===user);s.form.worker=s.workers[0]?.id||'';if(s.company)try{await refresh()}catch(err){if(n===generation)s.error=err.message}}
 const btn=(title,action,id='')=>`<button class="ess-btn" data-action="missing:${action}" data-id="${e(id)}" ${s.busy?'disabled':''}>${title}</button>`;
 const field=(label,id,value)=>`<label class="ess-field">${label}<input id="missing-${id}" value="${e(value)}" maxlength="1000"></label>`;
 function render(){const f=s.form;
  const visibleRequests=manager()?s.requests:s.requests.filter(r=>
   r?.company_id===s.company&&s.workers.some(w=>w.id===r.worker_id&&w.auth_user_id===s.user));
  return `<h2>Journée entièrement oubliée</h2><p>Soumettez la journée complète, avec ses pauses. Aucune heure officielle ne change avant l’approbation par une autre personne.</p>${s.error?`<p role="alert">${e(s.error)}</p>`:''}<section class="ess-panel"><label class="ess-field">Salarié<select id="missing-worker">${s.workers.map(w=>`<option value="${e(w.id)}" ${f.worker===w.id?'selected':''}>${e(w.first_name+' '+w.last_name)}</option>`).join('')}</select></label><label class="ess-field">Établissement<select id="missing-job">${s.jobs.map(j=>`<option value="${e(j.id)}" ${f.job===j.id?'selected':''}>${e(j.name)}</option>`).join('')}</select></label><p>Dates avec fuseau : 2026-10-20T08:00:00-04:00. Pour une nuit, indiquez la date de fin suivante et son décalage applicable.</p>${field('Entrée','start',f.start)}${field('Sortie','end',f.end)}${field('Motif de la demande','reason',f.reason)}<h3>Pauses de cette journée</h3>${f.breaks.map((p,i)=>`<div>${field('Début de pause','pause-'+i+'-start',p.start)}${field('Fin de pause','pause-'+i+'-end',p.end)}<label class="ess-check"><input type="checkbox" id="missing-pause-${i}-paid" ${p.paid?'checked':''}>Payée</label>${btn('Retirer cette pause','remove-break',String(i))}</div>`).join('')}${f.breaks.length<12?btn('Ajouter une pause','add-break'):''}${btn('Soumettre pour approbation','submit')}</section>${manager()?`<section class="ess-panel">${field('Motif pour approuver ou refuser','note',s.note)}</section>`:''}<section class="ess-panel"><h3>100 demandes récentes</h3>${visibleRequests.map(r=>`<article class="ess-person"><div><b>${e(s.workers.find(w=>w.id===r.worker_id)?.first_name||'Salarié')}</b><p>${e(new Date(r.starts_at).toLocaleString('fr-CA'))} → ${e(new Date(r.ends_at).toLocaleString('fr-CA'))}</p><p>${e(r.reason)} · ${e(({pending:'En attente',approved:'Approuvée',rejected:'Refusée',cancelled:'Annulée'})[r.status])}</p><small>${r.breaks.length} pause(s) · ${e(r.review_note||'')}</small></div>${r.status==='pending'?(r.requested_by===s.user?btn('Annuler','cancel',r.id):manager()&&s.workers.find(w=>w.id===r.worker_id)?.auth_user_id!==s.user?btn('Approuver','approve',r.id)+btn('Refuser','reject',r.id):''):''}</article>`).join('')||'<p>Aucune demande.</p>'}</section>${btn('Actualiser','refresh')}`;}
 function input(el){if(!el.id?.startsWith('missing-'))return;const key=el.id.slice(8),pause=/^pause-(\d+)-(start|end|paid)$/.exec(key);if(pause){const p=s.form.breaks[Number(pause[1])];if(p)p[pause[2]]=pause[2]==='paid'?el.checked:el.value}else if(key==='note')s.note=el.value;else if(key in s.form&&key!=='breaks')s.form[key]=el.value;}
 async function handle(el){if(!el.dataset.action?.startsWith('missing:'))return false;if(s.busy)return true;const n=generation,action=el.dataset.action.slice(8);s.busy=true;s.error='';try{
  if(action==='add-break')s.form.breaks.push({start:'',end:'',paid:false});else if(action==='remove-break')s.form.breaks.splice(Number(el.dataset.id),1);
  else if(action==='submit'){
    if(!manager()&&!s.workers.some(w=>w.id===s.form.worker&&w.auth_user_id===s.user))
     throw Error('Dossier salarié non autorisé pour cette demande.');
    if(!s.jobs.some(j=>j.id===s.form.job))
     throw Error('Établissement indisponible pour cette demande.');
    const payload=missingDayPayload(s.company,s.form);await durableLedgerRequest({storage:{get:k=>storage.getItem(k),set:(k,v)=>storage.setItem(k,v),remove:k=>storage.removeItem(k)},key:'punch-missing-day:'+s.company+':'+s.user,payload,uuid:()=>crypto.randomUUID(),digest:async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))),x=>x.toString(16).padStart(2,'0')).join(''),send:args=>rpc('request_essential_missing_day',args)});if(n===generation)s.form={...blankMissingDay(),worker:s.form.worker,job:s.form.job};}
  else if(action==='cancel')await rpc('cancel_essential_missing_day',{p_request:el.dataset.id});
  else if(action==='approve'||action==='reject'){if(s.note.trim().length<3)throw Error('Motif de décision requis');await rpc('review_essential_missing_day',{p_request:el.dataset.id,p_approve:action==='approve',p_note:s.note.trim()});}
  if(n===generation&&!['add-break','remove-break'].includes(action))await refresh();
 }catch(err){if(n===generation)s.error=err.message}finally{if(n===generation){s.busy=false;redraw()}}return true;}
 return {state:s,load,reset,render,input,handle};
}
