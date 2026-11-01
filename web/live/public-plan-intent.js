import {estimatePublicPlanPrice} from './commercial.js';

// Public choice is a per-tab, untrusted reminder only. It never grants an entitlement
// or substitutes for server-side catalog, contract, and payment verification.
const KEY='punch-public-plan-intent-v1';
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value);
const validSeats=value=>Number.isSafeInteger(value)&&value>=1&&value<=100000;
const validCadence=value=>value==='monthly'||value==='yearly';

export function rememberPublicPlanIntent(storage,{planId,seats,cadence}={}){
 if(!validId(planId)||!validSeats(seats)||!validCadence(cadence))return false;
 try{storage.setItem(KEY,JSON.stringify({planId,seats,cadence}));return true}catch{return false}
}


// An advertised plan is only a draft preference. A browser that blocks storage
// must still allow signup; no billing, price or entitlement data is persisted.
// Remember the edition as well, or a previous Construction choice could
// override Essentiel after returning from email/OAuth or refreshing the page.
export function beginPublicEssentialSignup(tabStorage,editionStorage,intent){
 const saved=rememberPublicPlanIntent(tabStorage,intent);
 if(!validId(intent?.planId)||!validSeats(intent?.seats)||!validCadence(intent?.cadence))return false;
 try{tabStorage.setItem('punch-selected-plan',intent.planId)}catch{}
 try{editionStorage.setItem('punch-creation-edition','essential')}catch{}
 return saved;
}

export function readPublicPlanIntent(storage){
 try{
  const raw=storage.getItem(KEY);
  if(!raw)return null;
  const intent=JSON.parse(raw);
  if(!intent||!validId(intent.planId)||!validSeats(intent.seats)||!validCadence(intent.cadence))return null;
  return {planId:intent.planId,seats:intent.seats,cadence:intent.cadence};
 }catch{return null}
}

// Only rehydrate editable pricing controls. Never restore authorization,
// payment state, a confirmed contract or a server-selected plan.
export function readPublicPlanEstimate(storage){
 const intent=readPublicPlanIntent(storage);
 return intent?{seats:intent.seats,seatDraft:String(intent.seats),cadence:intent.cadence}:null;
}

export function forgetPublicPlanIntent(storage){
 try{storage.removeItem(KEY);return true}catch{return false}
}

export function renderPublicPlanReminder(storage,plans,escape){
 const intent=readPublicPlanIntent(storage);
 if(!intent)return '';
 const current=(Array.isArray(plans)?plans:[]).find(plan=>plan.id===intent.planId&&plan.active&&plan.public_visible);
 const label=current?'<strong>'+escape(String(current.title||'Forfait à confirmer'))+'</strong>':'<strong>Forfait à revérifier</strong>';
 const quote=current?estimatePublicPlanPrice(current,intent.seats,intent.cadence):null;
 const estimate=quote?'<p>Estimation au catalogue actuel : <strong>'+
  escape(new Intl.NumberFormat('fr-CA',{style:'currency',currency:'CAD'}).format(quote.payableCents/100))+
  '</strong> / '+(intent.cadence==='yearly'?'an':'mois')+' avant taxes.</p>':'';
 const cadence=intent.cadence==='yearly'?'annuel':'mensuel';
 const seats=intent.seats+' membre'+(intent.seats>1?'s':'');
 return '<section class="notice" aria-label="Votre préférence de forfait"><p>Votre sélection Essentiel : '+label+' · '+seats+' · paiement '+cadence+'.</p>'+estimate+'<small>Choix conservé dans cet onglet à titre indicatif. Il ne crée aucun abonnement et ne fixe aucun tarif; le catalogue et le contrat devront être confirmés avant facturation.</small></section>';
}
