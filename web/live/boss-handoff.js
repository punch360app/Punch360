/** Verified, voluntary Boss succession. Never bypasses Supabase Auth or AAL2. */
export function createBossHandoffController({
 sb,redraw,escape:e,getMembers=()=>[],confirm:confirmAction=(...args)=>globalThis.confirm(...args),
 prompt:ask=(...args)=>globalThis.prompt(...args),onCompleted=()=>{}
}){
 let generation=0;
 const make=()=>({company:null,role:null,memberId:null,selected:'',reason:'',status:null,busy:false,error:'',notice:''});
 const s=make();
 function reset(){generation++;Object.assign(s,make());}
 const rpc=async(name,args)=>{const r=await sb.rpc(name,args);if(r.error)throw r.error;return r.data;};
 async function load(company,role,memberId){
  const n=++generation;
  Object.assign(s,{company,role,memberId,error:'',notice:'',busy:true,status:null});
  try{if(company&&['boss','admin'].includes(role))s.status=await rpc('essential_boss_handoff_status',{p_company:company});}
  catch(err){if(n===generation)s.error=err.message||'Session MFA requise';}
  finally{if(n===generation){s.busy=false;redraw();}}
 }
 function input(el){if(el.id==='boss-handoff-reason')s.reason=el.value;
  if(el.id==='boss-handoff-successor')s.selected=el.value;}
 const button=(label,action,disabled=false)=>`<button type="button" class="ess-btn" data-action="boss-handoff:${action}" ${disabled||s.busy?'disabled':''}>${label}</button>`;
 function render(role=s.role){
  if(!s.company)return '<p>Sélectionnez une entreprise.</p>';
  const admins=getMembers().filter(x=>x.role==='admin'&&x.status==='active'&&x.user_id!==s.memberId);
  const h=s.status;
  return `<section class="ess-panel"><h3>Transmission volontaire de la direction</h3>
  <p class="ess-fine">Transfert uniquement entre le Boss actuel et un administrateur de la même compagnie. Les deux doivent vérifier leur identité avec MFA. Il n’est jamais possible de consulter un mot de passe.</p>
  ${s.error?`<p role="alert">${e(s.error)}</p>`:''}
  ${s.notice?`<p role="status">${e(s.notice)}</p>`:''}
  ${button('Actualiser le statut','refresh')}
  ${h?`<p>État : <b>${e(h.status)}</b> · v${Number(h.version)}</p><p>Boss : <code>${e(h.from_user)}</code></p><p>Successeur : <code>${e(h.to_user)}</code></p><p>Date limite : ${e(h.expires_at)}</p>
  ${h.status==='pending'&&h.can_accept?button('Accepter la responsabilité (MFA)','accept'):''}
  ${h.status==='accepted'&&h.can_complete?button('Confirmer et transférer le rôle Boss (MFA)','complete'):''}
  ${['pending','accepted'].includes(h.status)&&h.status!=='expired'?button('Annuler la demande','cancel'):''}
  ` :role==='boss'?`<p>Choisissez un administrateur actif pour préparer la succession.</p>
   <label class="ess-field">Administrateur successeur
   <select id="boss-handoff-successor"><option value="">Choisir…</option>${admins.map(m=>`<option value="${e(m.user_id)}" ${s.selected===m.user_id?'selected':''}>${e(m.email||m.name||m.user_id.slice(0,12))}</option>`).join('')}</select></label>
   <label class="ess-field">Motif (8 caractères minimum)<input id="boss-handoff-reason" maxlength="1000" value="${e(s.reason)}"></label>
   ${button('Demander le transfert sécurisé','request',!admins.length)}
   `: '<p>Aucun transfert en attente pour votre compte.</p>'}
  <p class="ess-fine">Le transfert ne sera effectif qu’après l’acceptation MFA du successeur et une seconde confirmation MFA du Boss. Si le Boss ne peut plus accéder à son compte, contactez le support : aucun transfert automatique n’est autorisé.</p></section>`;
 }
 async function handle(el){
  const action=el.dataset?.action?.split(':');if(action?.[0]!=='boss-handoff')return false;
  if(s.busy)return true;
  const n=generation;s.error='';s.notice='';s.busy=true;
  try{
   if(!s.company||!['boss','admin'].includes(s.role))throw Error('Gestion Essentiel requise.');
   if(action[1]==='refresh'){
    s.status=await rpc('essential_boss_handoff_status',{p_company:s.company});
   }else if(action[1]==='request'){
    if(s.role!=='boss'||s.status)throw Error('Seul un Boss peut demander un nouveau transfert.');
    const admins=getMembers().filter(m=>m.role==='admin'&&m.status==='active');
    if(!admins.some(m=>m.user_id===s.selected))throw Error('Choisir un administrateur actif.');
    if(s.reason.trim().length<8)throw Error('Motif détaillé obligatoire.');
    const expected=s.company+':'+s.selected;
    if(!confirmAction('Proposer le transfert de la direction à cet administrateur?'))return true;
    if(ask('Retapez exactement ces identifiants pour confirmer :\n'+expected)!==expected)throw Error('Confirmation incorrecte.');
    await rpc('essential_boss_handoff_request',{p_company:s.company,p_successor:s.selected,p_confirmation:expected,p_reason:s.reason.trim()});
    s.notice='Demande créée. Le successeur doit maintenant accepter avec MFA.';
    s.status=await rpc('essential_boss_handoff_status',{p_company:s.company});
   }else{
    const h=s.status;if(!h||!['pending','accepted'].includes(h.status))throw Error('Aucune demande valide.');
    if(action[1]==='accept'){
     if(!h.can_accept)throw Error('Seul le successeur désigné peut accepter.');
     const expected=s.company+':'+h.from_user;
     if(ask('Pour accepter, recopiez :\n'+expected)!==expected)throw Error('Confirmation incorrecte.');
     await rpc('essential_boss_handoff_accept',{p_company:s.company,p_handoff:h.id,p_expected_version:h.version,p_confirmation:expected});
     s.notice='Acceptation enregistrée. Le Boss actuel doit confirmer une dernière fois.';
    }else if(action[1]==='complete'){
     if(!h.can_complete||s.role!=='boss')throw Error('Finalisation réservée au Boss actuel.');
     if(!confirmAction('Transférer le rôle Boss ? Vous deviendrez administrateur après confirmation.'))return true;
     const expected=s.company+':'+h.to_user;
     if(ask('Dernière vérification : recopiez exactement\n'+expected)!==expected)throw Error('Confirmation incorrecte.');
     await rpc('essential_boss_handoff_complete',{p_company:s.company,p_handoff:h.id,p_expected_version:h.version,p_confirmation:expected});
     reset();await onCompleted();return true;
    }else if(action[1]==='cancel'){
     if(!confirmAction('Annuler cette demande de transfert ?'))return true;
     await rpc('essential_boss_handoff_cancel',{p_company:s.company,p_handoff:h.id,p_expected_version:h.version});
     s.notice='Demande de transfert annulée.';
    }else return true;
    s.status=await rpc('essential_boss_handoff_status',{p_company:s.company});
   }
  }catch(err){if(n===generation)s.error=err.message||'Action refusée par le serveur.';}
  finally{if(n===generation){s.busy=false;redraw();}}
  return true;
 }
 return {state:s,reset,load,input,render,handle};
}
