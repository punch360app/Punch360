/** Negotiated commercial quotes: drafts only, never activate Stripe or rewrite contracts. */
export function createPlatformPriceProposalsController({sb,redraw,escape:e}){
 let generation=0;
 const fresh=()=>({company:'',reason:'',plan:'essential',cadence:'monthly',seats:'5',base:'1900',included:'5',extra:'300',discount:'15',effective:new Date(Date.now()+7*86400000).toISOString().slice(0,10),confirmation:'',approveConfirmation:'',approval:null,list:null,preview:null,error:'',notice:'',busy:false});
 const s=fresh();
 const money=n=>new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD'}).format(Number(n||0)/100);
 const uuid=x=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x||'');
 function reset(){generation++;Object.assign(s,fresh());}
 function choose(companyId){if(!uuid(companyId))return false;reset();s.company=companyId;redraw();return true;}
 function input(el){
  if(s.busy)return;
  const k=el.id?.replace(/^platform-price-/,'');
  if(!k||!(k in s))return;
  s[k]=el.value;
  if(k==='company'||k==='reason'){s.list=null;s.approval=null;s.confirmation='';s.approveConfirmation='';}
  s.preview=null;s.notice='';
 }
 const btn=(title,action,disabled=false,extra='')=>`<button type="button" class="ess-btn" data-action="platform-price:${action}" ${disabled||s.busy?'disabled':''} ${extra}>${title}</button>`;
 function args(){
  if(!uuid(s.company)||s.reason.trim().length<8)throw Error('Entreprise UUID et motif détaillé (8 caractères minimum) requis.');
  if(!/^\d{4}-\d\d-\d\d$/.test(s.effective))throw Error('Date d’effet invalide.');
  const integer=k=>{const x=String(s[k]??'').trim();if(!/^\d+$/.test(x))throw Error('Montants et quantités doivent être des entiers en cents CAD.');const n=Number(x);if(!Number.isSafeInteger(n))throw Error('Montant trop élevé.');return n;};
  return {p_company:s.company,p_plan:s.plan,p_cadence:s.cadence,p_seats:integer('seats'),p_base:integer('base'),
  p_included:integer('included'),p_extra:integer('extra'),p_discount:integer('discount'),
  p_effective_on:s.effective,p_reason:s.reason.trim()};
 }
 async function rpc(name,parameters){const r=await sb.rpc(name,parameters);if(r.error){const err=Error('Opération Super Admin refusée. Vérifiez votre session MFA et réessayez.');err.code=r.error.code;throw err;}return r.data;}
 function render(){
  return `<section class="ess-panel"><h3>Tarifs particuliers par entreprise</h3><p>Propositions non activées, réservées au Super Admin MFA. Elles ne changent ni le forfait du Boss, ni Stripe, ni les factures, même après enregistrement. Les montants sont en cents CAD avant taxes.</p>
  ${s.error?`<p role="alert">${e(s.error)}</p>`:''}${s.notice?`<p role="status">${e(s.notice)}</p>`:''}
  <label class="ess-field">Identifiant de compagnie Essentiel réelle<input id="platform-price-company" value="${e(s.company)}" autocomplete="off"></label>
  <label class="ess-field">Motif détaillé<input id="platform-price-reason" value="${e(s.reason)}" maxlength="1000"></label>
  ${btn('Charger les projets et la version','load')}
  ${s.list?`<p>Version : ${Number(s.list.version)} · Dernières propositions (max. 20) · approbation v${Number(s.approval?.version||0)}</p>${(s.list.items||[]).map((x,i)=>`<p>v${Number(x.proposal_version)} · ${e(x.plan_id)} · ${money(x.due_cents)} / ${e(x.cadence)} · ${e(x.status)}. ${s.approval?.proposal_id===x.id?'Approuvée, en attente d’acceptation du Boss et de confirmation Stripe.':'Non approuvée.'} ${i===0&&s.approval?.proposal_id!==x.id?btn('Approuver cette proposition pour le Boss','approve',false,`data-id="${e(x.id)}"`):''}</p>`).join('')}<label class="ess-field">Pour approuver, recopier l’identifiant de l’entreprise<input id="platform-price-approveConfirmation" value="${e(s.approveConfirmation)}" autocomplete="off"></label><p>${e(s.company)}</p><p>Cette approbation seule n’effectue aucun paiement. Le Boss devra accepter le devis chez Stripe.</p>`:''}
  <fieldset ${s.busy?'disabled':''}><legend>Créer un devis négocié, sans activation</legend>
  <label class="ess-field">Forfait<select id="platform-price-plan">${[['essential','Essentiel'],['essential_plus','Plus'],['essential_pro','Pro']].map(([v,n])=>`<option value="${v}" ${s.plan===v?'selected':''}>${n}</option>`).join('')}</select></label>
  <label class="ess-field">Périodicité<select id="platform-price-cadence"><option value="monthly" ${s.cadence==='monthly'?'selected':''}>Mensuelle</option><option value="yearly" ${s.cadence==='yearly'?'selected':''}>Annuelle</option></select></label>
  ${[['seats','Nombre de places'],['base','Prix de base mensuel (cents CAD)'],['included','Places incluses'],['extra','Supplément par place (cents CAD)'],['discount','Réduction annuelle (%)']].map(([key,title])=>`<label class="ess-field">${title}<input id="platform-price-${key}" type="number" min="0" step="1" value="${e(s[key])}"></label>`).join('')}
  <label class="ess-field">Date d’effet proposée<input type="date" id="platform-price-effective" value="${e(s.effective)}"></label>
  ${btn('Prévisualiser','preview',!s.list)}
  ${s.preview?`<p>Prix prévu : ${money(s.preview.monthly_cents)} / mois ou ${money(s.preview.annual_cents)} / an. Montant selon la période : <strong>${money(s.preview.due_cents)}</strong>. Avant taxes.</p><p><b>Aucun paiement ou contrat modifié.</b></p>
  <label class="ess-field">Recopier l'identifiant exact de la compagnie<input id="platform-price-confirmation" autocomplete="off" value="${e(s.confirmation)}"></label><p>${e(s.company)}</p>
  ${btn('Enregistrer le projet immuable','draft')}`:''}
  </fieldset></section>`;
 }
 async function handle(el){
  const a=el.dataset.action?.split(':');if(a?.[0]!=='platform-price')return false;
  if(!['load','preview','draft','approve'].includes(a[1]))return false;
  if(s.busy)return true;
  const n=generation,active=()=>n===generation;
  s.error='';s.busy=true;s.notice='';
  try{
   if(a[1]==='approve'){
    if(!uuid(s.company)||s.reason.trim().length<8||!s.list||!s.approval||s.list.company_id!==s.company)throw Error('Charger la compagnie et son état d’approbation.');
    if(s.approveConfirmation!==s.company)throw Error('Recopier exactement l’UUID entreprise avant approbation.');
    const proposal=s.list.items?.[0];
    if(!proposal||proposal.id!==el.dataset.id||s.approval.proposal_id===proposal.id)throw Error('Choisir la proposition la plus récente.');
    const target=s.company,reason=s.reason.trim();
    await rpc('platform_company_price_approve',{p_company:target,p_proposal:proposal.id,p_expected_approval_version:s.approval.version,p_confirmation:s.approveConfirmation,p_reason:reason});
    if(!active())return true;
    const approval=await rpc('platform_company_price_approval_status',{p_company:target,p_reason:reason});
    if(!active())return true;
    s.approval=approval;
    s.approveConfirmation='';
    s.notice='Tarif proposé au Boss. Aucun prix activé ni paiement prélevé.';
   }else{
    const params=args();
    if(a[1]==='load'){
     const list=await rpc('platform_company_price_list',{p_company:params.p_company,p_reason:params.p_reason});
     if(!active())return true;
     const approval=await rpc('platform_company_price_approval_status',{p_company:params.p_company,p_reason:params.p_reason});
     if(!active())return true;
     s.list=list;s.approval=approval;s.preview=null;
    }else{
     if(!s.list||s.list.company_id!==params.p_company)throw Error('Charger d’abord la version courante.');
     if(a[1]==='preview'){
      const preview=await rpc('platform_company_price_preview',params);
      if(!active())return true;
      s.preview=preview;
     }else if(a[1]==='draft'){
      if(!s.preview)throw Error('Prévisualiser le devis avant sa création.');
      if(s.confirmation!==params.p_company)throw Error('Confirmation de l’identifiant de la compagnie incorrecte.');
      const saved=await rpc('platform_company_price_draft',{...params,p_expected_version:s.list.version,p_expected_plan_version:s.preview.plan_version,p_confirmation:s.confirmation});
      if(!active())return true;
      // A saved server draft is not active and must be reloaded from the same company.
      const list=await rpc('platform_company_price_list',{p_company:params.p_company,p_reason:params.p_reason});
      if(!active())return true;
      s.notice='Projet v'+saved.version+' enregistré. Aucune activation Stripe.';
      s.list=list;s.preview=null;s.confirmation='';
     }
    }
   }
  }catch(err){
   if(active()){s.error=err.message||'Opération refusée.';if(err.code==='42501'){s.list=null;s.preview=null;s.approval=null;}}
  }finally{if(active()){s.busy=false;redraw();}}
  return true;
 }
 return {state:s,reset,choose,input,render,handle};
}
