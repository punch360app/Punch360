import {renderPublicWelcomeIntro,renderPublicPlanCards} from './public-client-components.js';
import {renderPublicAuthStep} from './public-auth-step.js';

/** A local, side-effect-free preview of actual Punch public welcome components.
 * The login, account creation and live pricing flows must be tested in the app
 * itself; the review never reads storage, authenticates or calls a network API.
 */
export function createPublicClientPreviewController({redraw=()=>{}}={}){
 const state={edition:'construction',mode:'welcome',notice:''};
 const action=(title,name,kind='')=>'<button type="button" class="btn '+kind+'" data-action="'+name+'">'+title+'</button>';
 const formfield=(label,id,_value='',type='text',extra='')=>'<div class="group"><label for="'+id+'">'+label+'</label><input class="field" id="'+id+'" type="'+type+'" value="" '+extra+' disabled aria-disabled="true"></div>';
 const oauthButtons=()=>'<div class="oauth-buttons">'+['Google','Apple'].map(p=>'<button type="button" class="oauth-btn oauth-'+p.toLowerCase()+'" data-action="oauth'+p+'" disabled aria-disabled="true">Continuer avec '+p+'</button>').join('')+'</div>';
 function render(){
  const body=state.mode==='welcome'
   ?renderPublicWelcomeIntro(state.edition)+renderPublicPlanCards(state.edition)+
    action('Continuer →','continueSignup','gold full')+
    '<p class="punch-client-preview-note">Aperçu de la vitrine publique réelle. Les tarifs Essentiel dynamiques et la création de compte doivent être vérifiés dans l’application.</p>'
   :(['login','signup'].includes(state.mode)
     ?renderPublicAuthStep({mode:state.mode,edition:state.edition,readOnly:true,formfield,button:action,oauthButtons})+
      '<p class="punch-client-preview-notice" role="status">Aperçu seulement : champs et authentification désactivés. Aucun compte ni paiement ne peut être créé ici.</p>'
     :'<div class="punch-client-preview-placeholder" role="status"><h2>Mot de passe oublié</h2><p>La récupération sécurisée de compte est disponible uniquement dans l’application réelle.</p>'+action('← Retour à la connexion','openLogin')+'</div>');
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
  if(name==='authMode'){state.mode=state.mode==='login'?'signup':'login';redraw();return true;}
  if(name==='openReset'){state.mode='reset';redraw();return true;}
  if(name==='authBack'){state.mode='welcome';redraw();return true;}
  return false;
 }
 function reset(){state.edition='construction';state.mode='welcome';state.notice='';}
 return {state,render,handle,reset};
}
