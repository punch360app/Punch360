/** Super Admin directory and per-company real-user access controls.
 * Client is presentation only. SQL RPCs enforce owner+live MFA, version and exact UUID confirmation.
 */
export function createPlatformUsersController({sb,redraw,escape:e,prompt:ask=(...args)=>globalThis.prompt(...args),confirm:confirmAction=(...args)=>globalThis.confirm(...args)}){
 let generation=0;
 const initial=()=>({reason:'',query:'',company:'',test:'',status:'',applied:{},items:[],pages:[],cursor:null,next:null,error:'',busy:false,selected:null,preview:null});
 const s=initial();
 function reset(){generation++;Object.assign(s,initial());}
 function clearPrivate(){s.items=[];s.pages=[];s.next=null;s.cursor=null;s.selected=null;s.preview=null;}
 const validUuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
 function input(el){const key={'platform-user-reason':'reason','platform-user-query':'query','platform-user-company':'company','platform-user-test':'test','platform-user-status':'status'}[el.id];if(key)s[key]=el.value;}
 async function rpc(name,args){const r=await sb.rpc(name,args);if(r.error)throw r.error;return r.data;}
 function denied(error){s.error=error?.message||'Action impossible.';if(error?.code==='42501')clearPrivate();}
 async function search(cursor=null,newFilters=false){
  if(newFilters)s.applied={reason:s.reason.trim(),query:s.query.trim(),company:s.company.trim()||null,test:s.test===''?null:s.test==='true',status:s.status||null};
  const f=s.applied,n=++generation;s.busy=true;s.error='';
  if(newFilters||cursor!==s.cursor){s.selected=null;s.preview=null;}
  try{
   if((f.reason||'').length<3)throw Error('Motif de consultation requis.');
   const data=await rpc('platform_search_users',{p_reason:f.reason,p_query:f.query,p_company:f.company,p_test:f.test,p_state:f.status,p_before:cursor?.before||null,p_before_id:cursor?.before_id||null});
   if(n!==generation)return false;
   s.items=data.items||[];s.cursor=cursor;s.next=data.has_more?{before:data.before,before_id:data.before_id}:null;
   return true;
  }catch(err){if(n===generation)denied(err);return false}
  finally{if(n===generation){s.busy=false;redraw();}}
 }
 const button=(label,a,disabled=false,extra='')=>`<button type="button" class="ess-btn" data-action="platform-user:${a}" ${disabled||s.busy?'disabled':''} ${extra}>${label}</button>`;
 function renderPreview(){
  const v=s.preview;
  if(!v)return '';
  const confirmValue=v.user_id+':'+v.company_id;
  const title=v.suspended?'Rétablir l’accès à cette entreprise':'Suspendre l’accès à cette entreprise';
  return `<section class="ess-panel" aria-label="Intervention sur un membre réel"><h3>Accès à une seule compagnie — compte réel</h3>
  <p><b>${e(s.selected?.email||v.user_id)}</b></p>
  <p>Compagnie : <code>${e(v.company_id)}</code> · Rôle : ${e(v.role)} · Membre : ${e(v.member_status)} · Version : ${Number(v.version)||0}</p>
  <p>Dossier salarié : ${v.worker_count===0?'Aucun':v.worker_count===1?e(v.worker_status||'Présent'):'Conflit à vérifier'} · Punch actif : ${v.active_punch?'Oui':'Non'}.</p>
  <p class="ess-fine">Cette action concerne seulement cette entreprise Essentiel. Elle n’efface pas les heures, ne change pas Stripe et ne bloque pas la connexion à d’autres entreprises. Les Boss et propriétaires ne sont pas admissibles ici.</p>
  <p class="ess-fine"><b>Confirmation obligatoire :</b> ${e(confirmValue)}</p>
  ${v.suspended?button('Rétablir cet accès','restore',!v.can_restore):button('Suspendre cet accès','suspend',!v.can_suspend)}
  ${button('Fermer la fiche','close')}
  ${!v.suspended&&!v.can_suspend?'<p role="status">Suspension non permise : punch actif, statut inactif ou dossier à vérifier.</p>':''}
  ${v.suspended&&!v.can_restore?'<p role="status">Rétablissement bloqué : le dossier a été modifié, vérification manuelle requise.</p>':''}
  </section>`;
 }
 function render(){
  return `<section class="ess-panel"><h3>Utilisateurs de la plateforme</h3>
  <p>Consultation limitée au propriétaire avec session MFA active. Un motif est journalisé pour chaque page; aucun mot de passe ni jeton n’est exposé.</p>
  <label class="ess-field">Motif de consultation ou d’intervention<input id="platform-user-reason" maxlength="1000" value="${e(s.reason)}"></label>
  <label class="ess-field">Courriel ou identifiant<input id="platform-user-query" maxlength="200" value="${e(s.query)}"></label>
  <label class="ess-field">Identifiant d’entreprise (obligatoire pour intervenir)<input id="platform-user-company" value="${e(s.company)}"></label>
  <label class="ess-field">Type<select id="platform-user-test">${[['','Tous'],['false','Réels'],['true','Comptes test']].map(([v,l])=>`<option value="${v}" ${s.test===v?'selected':''}>${l}</option>`).join('')}</select></label>
  <label class="ess-field">État Auth<select id="platform-user-status">${[['','Tous'],['active','Actif'],['banned','Suspendu'],['deleted','Supprimé']].map(([v,l])=>`<option value="${v}" ${s.status===v?'selected':''}>${l}</option>`).join('')}</select></label>
  ${button('Rechercher','search')}
  ${s.error?`<p role="alert">${e(s.error)}</p>`:''}
  ${s.items.map(u=>`<article class="ess-person"><div><b>${e(u.email||'Courriel indisponible')}</b>
  <small>${e(u.id)} · ${u.is_test?'TEST':'Réel'}${u.is_platform_owner?' · Propriétaire plateforme':''}</small>
  <small>${u.email_confirmed_at?'Courriel confirmé':'Courriel non confirmé'} · ${u.active_memberships} entreprise(s) active(s)</small>
  <small>${u.deleted_at?'Supprimé':u.banned_until&&new Date(u.banned_until)>new Date()?'Suspendu dans Auth':'Actif dans Auth'}</small>
  </div>${!u.is_test&&!u.is_platform_owner&&!u.deleted_at&&validUuid(s.applied.company)?button('Gérer dans cette compagnie','inspect',false,`data-id="${e(u.id)}"`):''}</article>`).join('')||'<p>Aucun résultat. Saisir un motif et lancer la recherche.</p>'}
  <nav aria-label="Pages des utilisateurs">${button('Précédente','previous',!s.pages.length)}${button('Suivante','next',!s.next)}</nav></section>${renderPreview()}`;
 }
 async function handle(el){
  const parts=el.dataset.action?.split(':');if(parts?.[0]!=='platform-user')return false;
  const a=parts[1];if(s.busy)return true;
  if(a==='search'){s.pages=[];await search(null,true);return true;}
  if(a==='next'&&s.next){const before=s.cursor;if(await search(s.next)){s.pages.push(before);redraw();}return true;}
  if(a==='previous'&&s.pages.length){const prev=s.pages.at(-1);if(await search(prev)){s.pages.pop();redraw();}return true;}
  if(a==='close'){s.selected=null;s.preview=null;redraw();return true;}
  if(!['inspect','suspend','restore'].includes(a))return true;
  s.busy=true;s.error='';const n=generation;
  try{
   if(!validUuid(s.applied.company)||s.reason.trim().length<8||s.applied.company!==s.company.trim())throw Error('Filtrer par une entreprise UUID valide et saisir un motif de 8 caractères minimum.');
   if(a==='inspect'){
    const selected=s.items.find(u=>u.id===el.dataset.id&&!u.is_test&&!u.is_platform_owner&&!u.deleted_at);
    if(!selected)throw Error('Choisir un membre réel du résultat courant.');
    const v=await rpc('platform_member_access_preview',{p_company:s.applied.company,p_user:selected.id,p_reason:s.reason.trim()});
    if(n===generation){s.selected=selected;s.preview=v;}
   }else{
    const v=s.preview,selected=s.selected;
    if(!v||!selected||v.user_id!==selected.id||v.company_id!==s.applied.company||!((a==='suspend'&&v.can_suspend)||(a==='restore'&&v.can_restore)))throw Error('Rouvrir la fiche et vérifier les permissions.');
    const exact=selected.id+':'+s.applied.company;
    if(!confirmAction((a==='suspend'?'Suspendre':'Rétablir')+' l’accès UNIQUEMENT à cette entreprise? Les heures restent conservées.'))return true;
    const confirmation=ask('Retapez exactement les deux UUID séparés par deux-points :\n'+exact);
    if(confirmation===null)return true;
    if(confirmation.trim()!==exact)throw Error('Les identifiants de confirmation ne correspondent pas.');
    await rpc('platform_member_access_change',{p_company:s.applied.company,p_user:selected.id,p_action:a,p_expected_version:v.version,p_confirmation:exact,p_reason:s.reason.trim()});
    if(n!==generation)return true;
    s.preview=await rpc('platform_member_access_preview',{p_company:s.applied.company,p_user:selected.id,p_reason:s.reason.trim()});
    if(n===generation){s.selected=selected;s.error='Intervention confirmée par le serveur. Actualisez la liste si nécessaire.';}
   }
  }catch(err){if(n===generation)denied(err);}
  finally{if(n===generation){s.busy=false;redraw();}}
  return true;
 }
 return {state:s,reset,input,search,render,handle};
}
