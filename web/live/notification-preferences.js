export const notificationCategories=[['schedule','Horaires et remplacements'],['decisions','Décisions et approbations'],['announcements','Annonces'],['reminders','Rappels'],['other','Autres notifications']];

export function createNotificationPreferencesController({sb,redraw,escape:e,document:doc=null}){
 let generation=0;
 const s={company:null,devices:[],rows:[],draft:{},pendingDevice:null,error:'',status:'',busy:false};
 const original=category=>s.rows.find(r=>r.category===category)||{};
 const current=category=>s.draft[category]||original(category);
 const enabled=(value,channel)=>value[channel+'_enabled']===true;
 const changed=category=>['push','email'].some(channel=>
  enabled(current(category),channel)!==enabled(original(category),channel));
 function reset(){
  generation++;
  Object.assign(s,{company:null,devices:[],rows:[],draft:{},pendingDevice:null,error:'',status:'',busy:false});
 }
 async function load(company){
  reset();s.company=company;const n=generation;
  const r=await sb.from('notification_preferences').select('*').eq('company_id',company);
  if(n!==generation)return;
  if(r.error)s.error='Impossible de charger les préférences de notifications.';
  else s.rows=Array.isArray(r.data)?r.data:[];
  const devices=await sb.rpc('list_push_devices',{p_company:company});
  if(n===generation){
   if(devices.error)s.error='Impossible de charger les appareils autorisés.';
   else s.devices=Array.isArray(devices.data)?devices.data:[];
  }
 }
 function render(){
  return `<section class="ess-panel"><h2>Préférences de notifications</h2><p>Vos choix sont propres à cette entreprise. L’historique reste disponible dans la boîte de réception.</p><p>La livraison push et courriel exige encore l’activation et la recette des fournisseurs. Enregistrer un choix ne confirme pas une livraison.</p>`+
   (s.error?`<p role="alert">${e(s.error)}</p>`:'')+
   `<p role="status" aria-live="polite" data-notification-save-status>${e(s.status)}</p>`+
   notificationCategories.map(([id,label])=>{
    const row=current(id),dirty=changed(id);
    return `<fieldset><legend>${e(label)}</legend>`+
     ['push','email'].map(channel=>`<label><input type="checkbox" id="notification-pref-${id}-${channel}" ${enabled(row,channel)?'checked':''} ${s.busy?'disabled':''}>${channel==='push'?'Push sur mes appareils autorisés':'Courriel'}</label>`).join('')+
     `<p role="status" data-notification-dirty ${dirty?'':'hidden'}>Modifications non enregistrées</p>`+
     `<button type="button" class="ess-btn" data-action="notification-pref:save" data-category="${id}" ${s.busy||!dirty?'disabled':''}>Enregistrer</button>`+
     ` <button type="button" class="ess-btn" data-action="notification-pref:discard" data-category="${id}" ${s.busy||!dirty?'disabled':''}>Annuler les modifications</button></fieldset>`;
   }).join('')+
   '<h3>Mes appareils push</h3><p>L’autorisation d’un appareil s’effectue depuis l’application installée. Vous pouvez révoquer ici un appareil perdu.</p>'+
    s.devices.map(d=>`<p>${e(d.platform)} · ${d.revoked_at?'Révoqué':
     s.pendingDevice===d.id?
      `<span role="status">Confirmer la révocation de cet appareil ?</span> <button type="button" class="ess-btn" data-action="notification-pref:revoke-confirm" data-device="${e(d.id)}" ${s.busy?'disabled':''}>Confirmer la révocation</button> <button type="button" class="ess-btn" data-action="notification-pref:revoke-cancel" data-device="${e(d.id)}" ${s.busy?'disabled':''}>Annuler</button>`:
      `Autorisé <button type="button" class="ess-btn" data-action="notification-pref:revoke" data-device="${e(d.id)}" ${s.busy?'disabled':''}>Révoquer cet appareil</button>`}</p>`).join('')+
   (s.devices.length?'':'<p>Aucun appareil enregistré.</p>')+'</section>';
 }
 function input(el){
  const m=/^notification-pref-(schedule|decisions|announcements|reminders|other)-(push|email)$/.exec(el?.id||'');
  if(!m||s.busy)return;
  const [,category,channel]=m;
  s.draft[category]={...current(category),[channel+'_enabled']:!!el.checked};
  s.status='';
  // Update the feedback beside the clicked checkbox without re-rendering the
  // whole SPA, which would move focus and scroll on phones.
  const root=el.closest?.('fieldset');
  const dirty=changed(category);
  if(root){
   const status=root.querySelector('[data-notification-dirty]');
   if(status)status.hidden=!dirty;
   for(const action of ['save','discard']){
    const button=root.querySelector('[data-action="notification-pref:'+action+'"]');
    if(button)button.disabled=!dirty;
   }
  }
  const savedStatus=doc?.querySelector?.('[data-notification-save-status]');
  if(savedStatus)savedStatus.textContent='';
 }
 async function handle(el){
  const action=el?.dataset?.action;
  if(action==='notification-pref:discard'){
   if(s.busy)return true;
   const category=el.dataset.category;
   if(!notificationCategories.some(([id])=>id===category))return true;
   delete s.draft[category];s.error='';s.status='Modifications annulées.';
   redraw();return true;
  }
  if(action==='notification-pref:revoke-cancel'){
   if(s.busy)return true;
   if(el.dataset.device===s.pendingDevice)s.pendingDevice=null;
   s.status='Révocation annulée.';redraw();
   return true;
  }
  if(action==='notification-pref:revoke'){
   if(s.busy)return true;
   // An old/stale DOM button cannot act on a revoked or absent device.
   const device=s.devices.find(d=>d.id===el.dataset.device&&!d.revoked_at);
   if(!device||!s.company)return true;
   s.pendingDevice=device.id;s.error='';s.status='Aucun appareil révoqué. Confirmez votre choix.';
   redraw();return true;
  }
  if(action==='notification-pref:revoke-confirm'){
   if(s.busy)return true;
   const device=s.devices.find(d=>d.id===el.dataset.device&&!d.revoked_at);
   if(!device||s.pendingDevice!==device.id||!s.company)return true;
   s.busy=true;const n=generation,company=s.company;
   s.error='';s.status='';redraw();
   try{
    const r=await sb.rpc('revoke_push_device',{p_device:device.id});
    if(r.error)throw r.error;
    if(n===generation){
     await load(company);
     if(generation===n+1&&s.company===company){
      s.status='La révocation de l’appareil a été demandée.';
      redraw();
     }
    }
   }catch{
    if(n===generation)s.error='Impossible de révoquer cet appareil. Réessayez.';
   }finally{
    if(n===generation){s.busy=false;redraw();}
   }
   return true;
  }
  if(action!=='notification-pref:save')return false;
  if(s.busy)return true;
  const n=generation,company=s.company,category=el.dataset.category;
  if(!notificationCategories.some(([id])=>id===category))return true;
  if(!changed(category))return true;
  const old=original(category),draft=current(category);
  const push=enabled(draft,'push'),email=enabled(draft,'email');
  s.busy=true;s.error='';s.status='';redraw();
  try{
   const r=await sb.rpc('set_notification_preference',{
    p_company:company,p_category:category,p_push:push,p_email:email,
    p_expected_version:old?.version||0
   });
   if(r.error)throw r.error;
   if(n===generation){
    s.rows=s.rows.filter(x=>x.category!==category).concat({
     category,push_enabled:push,email_enabled:email,version:r.data
    });
    delete s.draft[category];
    s.status='Préférences enregistrées pour cette entreprise. La livraison des notifications n’est pas confirmée.';
   }
  }catch{
   if(n===generation)s.error='Impossible d’enregistrer ces préférences. Réessayez.';
  }finally{
   if(n===generation){s.busy=false;redraw();}
  }
  return true;
 }
 return {state:s,reset,load,render,input,handle};
}
