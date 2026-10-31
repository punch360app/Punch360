/** Real public email/password step from Punch live app, extracted unchanged.
 * Renders markup only: account access, OAuth and form submission remain owned
 * exclusively by the production application. Review mode disables submission.
 */
export function renderPublicAuthStep({mode,edition='construction',busy=false,readOnly=false,formfield,button,oauthButtons}){
 if(!['login','signup'].includes(mode))throw new TypeError('Unknown public auth step');
 const signup=mode==='signup',disabled=busy||readOnly?'disabled':'';
 return '<div><span class="eyebrow">'+(edition==='essential'?'PUNCH ESSENTIEL':'PUNCH CONSTRUCTION')+'</span><h2>'+(signup?'Créer mon compte':'Se connecter')+'</h2></div><form id="authForm">'+formfield('Adresse courriel','email','','email','autocomplete="email" inputmode="email" required')+formfield(signup?'Mot de passe · 8 caractères minimum':'Mot de passe','password','','password','autocomplete="'+(signup?'new-password':'current-password')+'" '+(signup?'minlength="8" ':'')+'required')+'<button class="btn gold full" type="submit" '+disabled+'>'+(busy?'Un instant…':signup?'Créer mon compte':'Se connecter')+'</button></form>'+(signup?'':button('Mot de passe oublié ?','openReset','text-link'))+'<div class="oauth-divider"><span>OU</span></div>'+oauthButtons()+button(signup?'Déjà un compte ? Se connecter':'Créer un compte','authMode','text-link');
}
