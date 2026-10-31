export function createSupportController({sb,redraw,escape:e,document:doc=globalThis.document,crypto=globalThis.crypto}){
 let generation=0;const s={company:null,platform:false,tickets:[],detail:null,error:'',busy:false,subject:'',body:'',reply:'',createRequest:null,replyRequest:null,more:true};
 const labels={open:'Ouverte',waiting:'En attente de votre réponse',resolved:'Résolue',closed:'Fermée'};
 const button=(title,action,id='')=>`<button type="button" class="ess-btn" data-action="support:${action}" data-id="${e(id)}" ${s.busy?'disabled':''}>${title}</button>`;
 function denied(error){return error?.code==='42501'||[401,403,'401','403'].includes(error?.status)}
 function clearPrivate(){
  s.tickets=[];s.detail=null;s.reply='';s.more=false;
  s.replyRequest=null;s.createRequest=null;
 }
 const localErrors=[
  'Objet et message de trois caractères minimum requis',
  'Réponse de trois caractères minimum requise',
  'Résultat réseau incertain : réessayez d’abord la demande originale',
  'Résultat réseau incertain : réessayez d’abord la réponse originale',
  'Sélectionnez une demande avant de répondre',
  'Sélectionnez une demande ouverte avant de changer son état'
 ];
 function errorText(error){
  if(denied(error)){
   clearPrivate();
   return 'Accès au support expiré ou refusé. Reconnectez-vous.';
  }
  if(localErrors.includes(error?.message))return error.message;
  return 'Impossible de charger ou modifier les demandes. Réessayez.';
 }
 async function rpc(name,args){const r=await sb.rpc(name,args);if(r.error)throw r.error;return r.data}
 function reset(){generation++;Object.assign(s,{company:null,platform:false,tickets:[],detail:null,error:'',busy:false,subject:'',body:'',reply:'',createRequest:null,replyRequest:null,more:true})}
 async function refresh(more=false){const n=generation,last=more?s.tickets.at(-1):null;const data=await rpc('support_list_tickets',{p_company:s.platform?null:s.company,p_before:last?.updated_at||null,p_before_id:last?.id||null});if(n!==generation)return;if(!Array.isArray(data))throw Error('INVALID_SUPPORT_RESPONSE');s.tickets=more?[...s.tickets,...data.filter(t=>!s.tickets.some(x=>x.id===t.id))]:data;s.more=data.length===50;}
 async function load(company,platform=false){
  // A context switch must hide the previous company's tickets immediately,
  // before the new network request resolves. An in-flight older request cannot
  // restore the old content because reset() advances the generation.
  reset();
  s.company=company;s.platform=platform;
  if(!company&&!platform){redraw();return;}
  const n=generation;
  s.busy=true;
  redraw();
  try{await refresh()}
  catch(err){if(n===generation)s.error=errorText(err)}
  finally{if(n===generation){s.busy=false;redraw()}}
 }
 function input(el){const key=el.id?.replace('support-','');if(['subject','body','reply'].includes(key))s[key]=el.value;}
 function render(){const d=s.detail;return `<div class="punch-support"><h2>Support PUNCH</h2><p>Évitez d’inclure des mots de passe, NIP ou renseignements médicaux dans vos messages.</p>${s.error?`<p class="ess-notice" role="alert">${e(s.error)}</p>`:''}${s.busy?'<p class="ess-notice" role="status" aria-live="polite">Vérification en cours…</p>':''}${!s.platform?`<section class="ess-panel"><h3>Nouvelle demande</h3><label class="ess-field">Objet<input id="support-subject" maxlength="160" value="${e(s.subject)}" ${s.busy?'disabled':''}></label><label class="ess-field">Message<textarea id="support-body" maxlength="5000" ${s.busy?'disabled':''}>${e(s.body)}</textarea></label>${button('Envoyer la demande','create')}</section>`:''}<section class="ess-panel"><h3>Demandes</h3>${button('Actualiser','refresh')}${s.tickets.map(t=>`<article class="ess-person"><div><b>${e(t.subject)}</b><small>${e(labels[t.status])} · ${e(new Date(t.updated_at).toLocaleString('fr-CA'))}</small>${s.platform?`<small>${e(t.company_name)}</small>`:''}</div>${button('Ouvrir','open',t.id)}</article>`).join('')||'<p>Aucune demande.</p>'}${s.more?button('Charger les demandes précédentes','more'):''}</section>${d?`<section class="ess-panel"><h3>${e(d.subject)}</h3><p>${e(labels[d.status])}</p><p class="ess-fine">200 messages les plus récents.</p>${d.messages.map(m=>`<article class="ess-person"><div><b>${m.is_platform?'Équipe PUNCH':'Entreprise'}</b><time>${e(new Date(m.created_at).toLocaleString('fr-CA'))}</time><p style="white-space:pre-wrap">${e(m.body)}</p></div></article>`).join('')}${d.status!=='closed'?`<label class="ess-field">Votre réponse<textarea id="support-reply" maxlength="5000" ${s.busy?'disabled':''}>${e(s.reply)}</textarea></label>${button('Envoyer la réponse','reply')}`:''}<div class="ess-checks">${Object.entries(labels).filter(([status])=>status!==d.status&&(s.platform||status!=='waiting')).map(([status,title])=>button(status==='open'?'Réouvrir':title,'status',status)).join('')}</div></section>`:''}</div>`;}
 async function handle(el){
  const raw=el?.dataset?.action;
  if(!raw?.startsWith('support:'))return false;
  const action=raw.slice(8);
  if(!['create','open','reply','status','refresh','more'].includes(action))return true;
  if(s.busy||action==='more'&&!s.more)return true;
  const n=generation;s.busy=true;s.error='';redraw();
  try{
   if(action==='create'){
    const payload={p_company:s.company,p_subject:s.subject.trim(),p_body:s.body.trim()};
    if(payload.p_subject.length<3||payload.p_body.length<3)
     throw Error('Objet et message de trois caractères minimum requis');
    if(s.createRequest&&JSON.stringify(s.createRequest.payload)!==JSON.stringify(payload))
     throw Error('Résultat réseau incertain : réessayez d’abord la demande originale');
    s.createRequest??={id:crypto.randomUUID(),payload};
    const id=await rpc('support_create_ticket',{...payload,p_request:s.createRequest.id});
    if(n!==generation)return true;
    s.createRequest=null;s.subject='';s.body='';
    const d=await rpc('support_ticket_detail',{p_ticket:id});
    if(n===generation){
     if(!d||!Array.isArray(d.messages))throw Error('INVALID_SUPPORT_RESPONSE');
     s.detail=d;
    }
   }else if(action==='open'){
    const d=await rpc('support_ticket_detail',{p_ticket:el.dataset.id});
    if(n!==generation)return true;
    if(!d||!Array.isArray(d.messages))throw Error('INVALID_SUPPORT_RESPONSE');
    s.detail=d;s.reply='';s.replyRequest=null;
   }else if(action==='reply'){
    if(!s.detail)throw Error('Sélectionnez une demande avant de répondre');
    const payload={p_ticket:s.detail.id,p_body:s.reply.trim(),
     p_expected_version:s.detail.version};
    if(payload.p_body.length<3)
     throw Error('Réponse de trois caractères minimum requise');
    if(s.replyRequest&&JSON.stringify(s.replyRequest.payload)!==JSON.stringify(payload))
     throw Error('Résultat réseau incertain : réessayez d’abord la réponse originale');
    s.replyRequest??={id:crypto.randomUUID(),payload};
    await rpc('support_reply',{...payload,p_request:s.replyRequest.id});
    if(n!==generation)return true;
    s.replyRequest=null;s.reply='';
    const d=await rpc('support_ticket_detail',{p_ticket:payload.p_ticket});
    if(n===generation){
     if(!d||!Array.isArray(d.messages))throw Error('INVALID_SUPPORT_RESPONSE');
     s.detail=d;
    }
   }else if(action==='status'){
    if(!s.detail||!labels[el.dataset.id]||s.detail.status===el.dataset.id)
     throw Error('Sélectionnez une demande ouverte avant de changer son état');
    const target=s.detail;
    await rpc('support_set_status',{p_ticket:target.id,
     p_status:el.dataset.id,p_expected_version:target.version});
    if(n!==generation)return true;
    const d=await rpc('support_ticket_detail',{p_ticket:target.id});
    if(n===generation){
     if(!d||!Array.isArray(d.messages))throw Error('INVALID_SUPPORT_RESPONSE');
     s.detail=d;
    }
   }
   if(n===generation){
    await refresh(action==='more');
    if(action==='refresh'&&s.detail){
     const d=await rpc('support_ticket_detail',{p_ticket:s.detail.id});
     if(n===generation){
      if(!d||!Array.isArray(d.messages))throw Error('INVALID_SUPPORT_RESPONSE');
      s.detail=d;
     }
    }
   }
  }catch(err){if(n===generation)s.error=errorText(err)}
  finally{if(n===generation){s.busy=false;redraw()}}
  return true;
 }
 return {state:s,reset,load,render,input,handle};
}
