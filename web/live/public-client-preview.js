import {renderPublicWelcomeIntro,renderPublicPlanCards} from './public-client-components.js';

/** A local, side-effect-free preview of actual Punch public welcome components.
 * The login, account creation and live pricing flows must be tested in the app
 * itself; the review never reads storage, authenticates or calls a network API.
 */
export function createPublicClientPreviewController({redraw=()=>{}}={}){
 const state={edition:'construction',mode:'welcome',notice:''};
 const action=(title,name,kind='')=>'<button type="button" class="btn '+kind+'" data-action="'+name+'">'+title+'</button>';
 function render(){
  const body=state.mode==='welcome'
   ?renderPublicWelcomeIntro(state.edition)+renderPublicPlanCards(state.edition)+
    action('Continuer →','continueSignup','gold full')+
    '<p class="punch-client-preview-note">Aperçu de la vitrine publique réelle. Les tarifs Essentiel dynamiques et la création de compte doivent être vérifiés dans l’application.</p>'
   :'<div class="punch-client-preview-placeholder" role="status"><h2>'+
    (state.mode==='login'?'Se connecter':'Créer mon compte')+'</h2>'+
    '<p>Le parcours de connexion ou d’inscription est réservé à la véritable application. Aucun compte ni paiement ne peut être créé depuis cet aperçu.</p>'+
    action('← Retour à la vitrine','authBack')+'</div>';
  return '<section class="punch-client-preview" data-punch-client-page>'+
   '<header class="onboard-header"><div class="onboard-brand">PUNCH <b>360°</b></div>'+
   action(state.mode==='welcome'?'Se connecter':'← Retour',state.mode==='welcome'?'openLogin':'authBack','onboard-link')+
   '</header><div class="onboard-main"><div class="authwrap auth-step auth-step-'+state.mode+'">'+body+'</div></div>'+
   (state.notice?'<p class="punch-client-preview-notice" role="status">'+state.notice+'</p>':'')+
   '</section>';
 }
 function handle(el){
  const name=el?.dataset?.action;
  if(name==='chooseEdition'){
   if(!['essential','construction'].includes(el.dataset.id))return false;
   state.edition=el.dataset.id;state.mode='welcome';state.notice='';redraw();return true;
  }
  if(name==='continueSignup'){state.mode='signup';redraw();return true;}
  if(name==='openLogin'){state.mode='login';redraw();return true;}
  if(name==='authBack'){state.mode='welcome';redraw();return true;}
  return false;
 }
 function reset(){state.edition='construction';state.mode='welcome';state.notice='';}
 return {state,render,handle,reset};
}
