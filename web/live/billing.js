export function createBillingController({sb,redraw,escape:e,document:doc=globalThis.document,open=url=>globalThis.location.assign(url)}){
 const s={company:null,summary:null,offer:null,plans:[],configured:false,error:'',busy:false,preview:null,order:null,invoices:[],invoicesHasMore:false};let revision=0;let quoteRevision=0;let renewalAttempt=null;
 const money=n=>new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD'}).format(n/100);
 async function rpc(name,p){const r=await sb.rpc(name,p);if(r.error)throw r.error;return r.data;}
 async function call(action,extra={}){const r=await sb.functions.invoke('essential-billing',{body:{action,companyId:s.company,...extra}});if(r.error)throw r.error;if(r.data.error)throw Error(r.data.error);return r.data;}
 async function load(company){
  quoteRevision++;
  if(company!==s.company)renewalAttempt=null;
  const n=++revision;
  Object.assign(s,{company,summary:null,offer:null,plans:[],configured:false,preview:null,order:null,invoices:[],invoicesHasMore:false,error:'',busy:false});
  try{
   // The company's effective restriction status must remain visible even when Stripe is down.
   const summary=await rpc('essential_billing_summary',{p_company:company});
   if(n!==revision)return;
   s.summary=summary;
   try{s.offer=await rpc('essential_company_price_offer',{p_company:company});if(n!==revision)return;}catch{if(n!==revision)return;s.offer=null;}
   const p=await sb.from('essential_plans').select('*').order('sort_order');
   if(n!==revision)return;
   if(p.error)throw p.error;
   s.plans=p.data||[];
   try{
    const provider=await call('status');
    if(n!==revision)return;
    s.configured=provider.configured===true;
    if(s.configured&&!summary.test_company){
     try{const invoices=await call('invoices');if(n===revision){s.invoices=invoices.invoices||[];s.invoicesHasMore=invoices.has_more===true;}}
     catch(err){if(n===revision)s.error='Factures indisponibles : '+err.message;}
    }
   }catch(err){if(n===revision)s.error='Service Stripe indisponible : '+err.message;}
  }catch(err){if(n===revision)s.error=err.message;}
 }
 function reset(){quoteRevision++;renewalAttempt=null;revision++;Object.assign(s,{company:null,summary:null,offer:null,plans:[],configured:false,preview:null,order:null,invoices:[],invoicesHasMore:false,error:'',busy:false});}
 // A quote must match the exact choices visible when it was accepted.
 // Invalidate both the confirmation and outstanding preview callbacks at the
 // first edit; do not redraw on every number keystroke (loses input focus).
 function invalidateQuote(){
  quoteRevision++;s.order=null;s.preview=null;
  doc.querySelector('[data-action="bill:confirm"]')?.setAttribute('disabled','');
 }
 function input(el){
  if(!['billing-plan','billing-cadence','billing-seats'].includes(el?.id))return false;
  invalidateQuote();
  return true;
 }
 function render(){const b=s.summary;return `<h2>Abonnement et factures</h2>${s.error?`<p class="ess-notice" role="alert">${e(s.error)}</p>`:''}${!b?'<p>Chargement…</p>':`<section class="ess-panel"><p>État : <b>${e(b.status)}</b> · ${b.active_humans} personnes actives · ${b.seats} places</p>${b.paid_through?`<p>Période payée jusqu’au ${e(new Date(b.paid_through).toLocaleString('fr-CA'))}</p>`:''}${b.test_company?'<p>Compagnie de test : aucun paiement réel autorisé.</p>':!s.configured?'<p>Stripe attend sa configuration serveur. Aucun paiement ne peut être effectué.</p>':''}${b.contract?`<p>Contrat : ${e(b.contract.snapshot.title)} · ${b.contract.cadence==='yearly'?'Annuel':'Mensuel'} · ${money(b.contract.snapshot.amount_cents)}</p><p>Membres inclus au contrat : ${b.contract.snapshot.included_seats_unlimited===true?'illimité (aucun supplément)':e(String(b.contract.snapshot.included_seats??'—'))}</p>`:''}${s.offer?`<section class="ess-panel"><h3>Offre négociée de PUNCH</h3><p><b>${e(s.offer.title||s.offer.plan_id)}</b> · ${s.offer.seats} places · ${money(s.offer.due_cents)} ${s.offer.cadence==='yearly'?'par an':'par mois'}, avant taxes.</p><p>Disponible dès le ${e(s.offer.effective_on)}. Le tarif ne s’applique qu’après votre acceptation et la confirmation du paiement Stripe.</p><button class="ess-btn" data-action="bill:offer" ${s.busy||!s.configured||b.test_company||!s.offer.available?'disabled':''}>Accepter l’offre et prévisualiser chez Stripe</button></section>`:''}<label class="ess-field">Forfait<select id="billing-plan">${s.plans.map(p=>`<option value="${e(p.id)}" ${p.id===b.contract?.plan_id?'selected':''}>${e(p.title)}${p.included_seats_unlimited===true?' — membres illimités':''}</option>`).join('')}</select></label><label class="ess-field">Paiement<select id="billing-cadence"><option value="monthly">Mensuel</option><option value="yearly" ${b.contract?.cadence==='yearly'?'selected':''}>Annuel — réduction du forfait</option></select></label><label class="ess-field">Places humaines<input id="billing-seats" type="number" min="${Math.max(1,b.active_humans)}" max="100000" value="${Math.max(1,b.seats)}"></label><button class="ess-btn" data-action="bill:quote" ${s.busy||!s.configured||b.test_company?'disabled':''}>${b.has_subscription?'Prévisualiser le changement':'Vérifier le total'}</button><p class="ess-fine">Prix avant taxes. Les contrats existants gardent leurs tarifs pour un changement de places dans le même forfait. Le paiement annuel couvre douze mois d’avance.</p></section>${s.preview?`<section class="ess-panel"><h3>Votre confirmation</h3><p>${e(s.preview.description)}</p><p>${s.preview.effective_at?'Date d’effet : '+e(new Date(s.preview.effective_at*1000).toLocaleString('fr-CA')):''}</p><button class="ess-btn" data-action="bill:confirm" ${s.busy?'disabled':''}>${b.has_subscription?'Confirmer ce changement':'Continuer vers Stripe'}</button><p class="ess-fine">Les taxes et promotions applicables sont détaillées par Stripe. L’accès change après confirmation serveur du paiement.</p></section>`:''}${b.has_subscription?`<section class="ess-panel"><button class="ess-btn" data-action="bill:portal">Moyen de paiement et portail Stripe</button><button class="ess-btn" data-action="bill:${b.canceled?'resume':'cancel'}">${b.canceled?'Reprendre le renouvellement':'Résilier à la fin de la période payée'}</button></section>`:''}<section class="ess-panel"><h3>Factures</h3>${s.invoices.map(i=>`<article class="ess-person"><div>${e(i.number||i.id)} · ${e(i.status)} · ${money(i.total)}</div>${i.url?`<a href="${e(i.url)}" target="_blank" rel="noopener">Ouvrir chez Stripe</a>`:''}</article>`).join('')||'<p>Aucune facture disponible.</p>'}${s.invoicesHasMore?'<p class="ess-fine">Seules les 100 dernières factures sont affichées ici. Consultez le portail Stripe pour les autres.</p>':''}</section>`}`;}
 async function handle(el){if(!el.dataset.action?.startsWith('bill:'))return false;if(s.busy)return true;if(!s.company||!s.summary)return true;
  const operationRevision=revision,operationCompany=s.company;
  const action=el.dataset.action.slice(5);
  if(action==='offer'||action==='quote')invalidateQuote();
  const capturedQuote=quoteRevision,tracksQuote=['offer','quote','confirm'].includes(action);
  const current=()=>revision===operationRevision&&s.company===operationCompany;
  const quoteCurrent=()=>!tracksQuote||quoteRevision===capturedQuote;
  const guarded=async(promise)=>{const value=await promise;if(!current()||!quoteCurrent())throw Error('STALE_BILLING_VIEW');return value;};
  s.busy=true;s.error='';try{
  if(action==='offer'){
   s.preview=null;
   if(!s.offer||!s.offer.available||!s.configured||s.summary.test_company)throw Error('Offre non disponible ou Stripe non configuré.');
   s.order=await guarded(rpc('essential_company_price_order',{p_company:operationCompany,p_approval_version:s.offer.approval_version}));
   if(s.summary.has_subscription){
    const r=await guarded(call('preview',{orderId:s.order}));
    s.preview={description:`Offre négociée : montant à régler selon Stripe ${money(r.preview.amount_due)}. Total de facture ${money(r.preview.total)}.`,...r.preview};
   }else{
    s.preview={description:`Offre négociée ${money(s.offer.due_cents)} ${s.offer.cadence==='yearly'?'par an':'par mois'}, avant taxes. ${s.offer.seats} places. Le paiement sera confirmé dans Stripe.`,effective_at:Math.floor(Date.now()/1000)};
   }
  }
  else if(action==='quote'){s.preview=null;const seats=Number(doc.getElementById('billing-seats')?.value),plan=doc.getElementById('billing-plan')?.value,cadence=doc.getElementById('billing-cadence')?.value;if(!Number.isSafeInteger(seats)||seats<1)throw Error('Nombre de places invalide');s.order=await guarded(rpc('essential_billing_order',{p_company:operationCompany,p_plan:plan,p_cadence:cadence,p_seats:seats}));if(s.summary.has_subscription){const r=await guarded(call('preview',{orderId:s.order}));s.preview={description:`Montant de la prévisualisation Stripe : ${money(r.preview.amount_due)}. Total de facture : ${money(r.preview.total)}.`,...r.preview};}else{const q=await guarded(rpc('essential_quote',{p_plan:plan,p_seats:seats,p_cadence:cadence}));s.preview={description:`${money(q.due_cents)} ${cadence==='yearly'?'pour douze mois':'par mois'}, avant taxes. ${seats} personnes.`,effective_at:Math.floor(Date.now()/1000)};}}
  else if(action==='confirm'){if(!s.preview||!s.order)throw Error('Prévisualisation requise');const r=await guarded(call(s.summary.has_subscription?'confirm':'checkout',{orderId:s.order}));if(r.url)open(r.url);else {s.preview=null;s.order=null;const reloadCompany=s.company;await load(reloadCompany);if(s.company===reloadCompany)redraw();}}
  else if(action==='portal'){const r=await guarded(call('portal'));open(r.url);}
  else if(action==='cancel'||action==='resume'){if(action==='cancel'&&!globalThis.confirm('Arrêter le renouvellement à la fin de la période payée ?'))return true;const prior=renewalAttempt;const id=prior?.company===operationCompany&&prior.action===action?prior.id:crypto.randomUUID();renewalAttempt={company:operationCompany,action,id};await guarded(call(action,{requestId:id}));renewalAttempt=null;const reloadCompany=s.company;await load(reloadCompany);if(s.company===reloadCompany)redraw();}
 }catch(err){if(current()&&quoteCurrent())s.error=err instanceof Error?err.message:'BILLING_REQUEST_FAILED';}finally{if(current()){s.busy=false;redraw();}}return true;}
 return {state:s,load,render,handle,input,reset};
}
