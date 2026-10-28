/** PUNCH platform Super Admin directory. Server RPC exclusively controls role grants.
 * Root can add at most two existing, email-confirmed Auth accounts, with live MFA.
 * Never write auth.users, JWT metadata, company roles or session state from here.
 */
export function createPlatformAdminsController({sb,redraw,escape:e,
  prompt:ask=(...args)=>globalThis.prompt(...args),notify=()=>{}}){
 let generation=0;
 const initial=()=>({items:[],loaded:false,isRoot:false,max:3,email:'',confirmation:'',
   reason:'',busy:false,error:'',status:''});
 const s=initial();
 const normalized=v=>String(v??'').trim().toLowerCase();
 const validUuid=v=>typeof v==='string'&&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
 function reset(){generation++;Object.assign(s,initial());}
 function accept(value){
  if(!value||!Array.isArray(value.items)||!Number.isSafeInteger(value.count)||
     value.count<1||value.count>3||value.items.length!==value.count||
     value.max!==3||typeof value.is_root!=='boolean'||
     value.items.some(x=>!validUuid(x.id)||!['root','delegate'].includes(x.role)||
      typeof x.email!=='string'))throw Error('Réponse Super Admin non valide');
  s.items=value.items;s.max=value.max;s.isRoot=value.is_root;s.loaded=true;
 }
 async function rpc(name,args){
  const r=await sb.rpc(name,args);
  if(r.error)throw r.error;
  return r.data;
 }
 function input(el){
  const keys={'platform-admin-email':'email','platform-admin-confirm':'confirmation',
   'platform-admin-reason':'reason'};
  if(keys[el.id])s[keys[el.id]]=String(el.value??'');
 }
 async function load(){
  const gen=++generation;s.busy=true;s.error='';
  try{
   const response=await rpc('platform_admin_members');
   if(gen!==generation)return false;
   accept(response);return true;
  }catch(err){
   if(gen!==generation)return false;
   s.items=[];s.loaded=false;s.isRoot=false;s.error=String(err?.message||err);
   return false;
  }finally{if(gen===generation){s.busy=false;redraw();}}
 }
 async function handle(el){
  const action=el?.dataset?.action;
  if(!['platform-admin:refresh','platform-admin:add','platform-admin:remove'].includes(action))
   return false;
  if(action==='platform-admin:refresh')return load();
  if(s.busy)return true;
  const gen=++generation;s.busy=true;s.error='';s.status='';
  try{
   if(!s.loaded||!s.isRoot)throw Error('Seul le propriétaire principal peut gérer les Super Admins.');
   if(s.reason.trim().length<8||s.reason.trim().length>500)
    throw Error('Motif de sécurité requis (8 à 500 caractères).');
   if(action==='platform-admin:add'){
    const email=normalized(s.email);
    if(s.items.length>=s.max)throw Error('Maximum de trois Super Admins atteint.');
    if(s.confirmation!=='AJOUTER '+email)
     throw Error('Tapez exactement AJOUTER suivi du courriel.');
    const result=await rpc('platform_admin_add',
     {p_email:email,p_confirmation:s.confirmation,p_reason:s.reason.trim()});
    if(gen!==generation)return true;
    accept(result);s.email='';s.confirmation='';
    s.status='Compte Super Admin autorisé. Son propriétaire doit se connecter avec MFA.';
   }else{
    const id=el.dataset.id;
    const item=s.items.find(x=>x.id===id);
    if(!validUuid(id)||!item||item.role!=='delegate')
     throw Error('Ce compte ne peut pas être retiré.');
    const confirmation=ask('Tapez RETIRER '+normalized(item.email)+
      ' pour retirer immédiatement ses droits Super Admin :')||'';
    if(confirmation!=='RETIRER '+normalized(item.email))return true;
    const result=await rpc('platform_admin_remove',
     {p_user:id,p_confirmation:confirmation,p_reason:s.reason.trim()});
    if(gen!==generation)return true;
    accept(result);s.status='Accès Super Admin révoqué. Les autres données du compte sont conservées.';
   }
   notify(s.status);
  }catch(err){
   if(gen!==generation)return true;
   if(err?.code==='42501'){s.items=[];s.isRoot=false;s.loaded=false;}
   s.error=String(err?.message||err);
  }finally{if(gen===generation){s.busy=false;redraw();}}
  return true;
 }
 function render(){
  return '<section class="ess-panel" aria-label="Gestion des Super Admins">'+
   '<h3>Super Admins de la plateforme</h3>'+
   '<p>Maximum 3 comptes au total : propriétaire principal + 2 autres. Chaque compte se connecte avec son propre courriel et sa double authentification. Les accès sont vérifiés par Supabase, pas par les rôles d’entreprise.</p>'+
   (s.error?'<p role="alert">'+e(s.error)+'</p>':'')+
   (s.status?'<p role="status">'+e(s.status)+'</p>':'')+
   (!s.loaded?'<p>Aucune liste vérifiée. Reconnectez-vous avec MFA pour actualiser.</p>':
    '<p><strong>'+s.items.length+' / '+s.max+'</strong> Super Admins autorisés</p>'+
    '<ul>'+s.items.map(x=>'<li><strong>'+e(x.email)+'</strong> — '+
      (x.role==='root'?'Propriétaire principal (protégé)':'Super Admin')+
      (x.mfa_ready?' · MFA configuré':' · MFA à configurer')+
      (s.isRoot&&x.role==='delegate'?
       ' <button type="button" class="ess-btn" data-action="platform-admin:remove" data-id="'+
        e(x.id)+'" '+(s.busy?'disabled':'')+'>Retirer cet accès</button>':'')+
      '</li>').join('')+'</ul>')+
   (s.loaded&&s.isRoot?
    '<div class="ess-form-grid">'+
      '<label class="ess-field">Motif obligatoire (journalisé)<input id="platform-admin-reason" maxlength="500" value="'+e(s.reason)+'" autocomplete="off"></label>'+
      (s.items.length<s.max?'<label class="ess-field">Courriel confirmé dans Supabase Auth<input id="platform-admin-email" type="email" autocomplete="off" value="'+e(s.email)+'"></label>'+
       '<label class="ess-field">Confirmation exacte : AJOUTER suivi du courriel<input id="platform-admin-confirm" autocomplete="off" value="'+e(s.confirmation)+'"></label>':'')+
    '</div>'+
    (s.items.length<s.max?'<button type="button" class="ess-btn" data-action="platform-admin:add" '+(s.busy?'disabled':'')+'>Autoriser un Super Admin</button>':
       '<p>Les trois places sont occupées. Le propriétaire peut retirer l’un des deux comptes secondaires.</p>'):'')+
   '<button type="button" class="ess-btn" data-action="platform-admin:refresh" '+(s.busy?'disabled':'')+'>Actualiser la liste des accès</button>'+
   '<p class="ess-fine">Créer et confirmer d’abord chaque compte dans Supabase → Authentication → Users. Ne communiquez jamais les mots de passe. L’ajout est désactivé sans session MFA valide du propriétaire.</p>'+
   '</section>';
 }
 return {state:s,load,render,handle,input,reset};
}
