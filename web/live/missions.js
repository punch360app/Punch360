import {navigationUrl,navigationPlatform,navigationPreferenceKey,chooseNavigationPreference} from './navigation-choices.js';
// A mission never mutates punches, shifts, payroll, mileage, invoices or GPS.
export function missionDate(d=new Date()){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
export function missionProgress(items){
 const ordered=(Array.isArray(items)?items:[]).filter(x=>['published','completed'].includes(x.status)).sort((a,b)=>a.sort_order-b.sort_order||String(a.id).localeCompare(String(b.id)));
 const done=ordered.filter(x=>x.status==='completed').length;
 return {total:ordered.length,done,next:ordered.find(x=>x.status==='published')||null,allDone:ordered.length>0&&done===ordered.length};
}
export function missionAddress(m){return [m?.address_line,m?.unit,m?.city,m?.region,m?.postal_code,m?.country].filter(Boolean).join(', ');}
export function missionArgs(company,form,existing=null,publish=false){
 const day=String(form.day||''),order=Number(form.order),title=String(form.title||'').trim();
 if(!company||!form.worker||!form.site||!(/^\d{4}-\d{2}-\d{2}$/.test(day))||!Number.isInteger(order)||order<1||order>999||
  title.length<2||title.length>140||String(form.instructions||'').length>500)throw Error('Mission, employé, lieu, ordre ou date invalide.');
 return {p_company:company,p_id:existing?.id||null,p_version:existing?.version||0,p_worker:form.worker,p_site:form.site,p_day:day,p_order:order,
  p_title:title,p_instructions:String(form.instructions||''),p_publish:!!publish};
}
export function createMissionManager({sb,document:doc,escape:e,redraw,notify}){
 const s={company:null,enabled:false,day:missionDate(),roster:[],sites:[],missions:[],error:'',truncated:false,busy:false,
  edit:null,form:{day:missionDate(),worker:'',site:'',order:'1',title:'',instructions:''}};
 let generation=0;
 async function rpc(name,args){const response=await sb.rpc(name,args);if(response.error)throw response.error;return response.data;}
 async function load(company,roster=[]){
  const gen=++generation;Object.assign(s,{company,roster,enabled:false,missions:[],sites:[],error:''});
  if(!company)return;
  try{
   const cfg=await rpc('essential_missions_configuration',{p_company:company,p_enabled:null});
   if(gen!==generation)return;s.enabled=!!cfg?.enabled;
   if(s.enabled){
    const [sites,missions]=await Promise.all([
     rpc('list_essential_client_sites',{p_company:company,p_search:'',p_after:null,p_limit:100}),
     rpc('list_essential_missions',{p_company:company,p_day:s.day,p_worker:null,p_include_drafts:true})]);
    if(gen!==generation)return;s.sites=(sites.items||[]).filter(x=>x.active);
    s.missions=missions.items||[];s.truncated=!!missions.truncated;
   }
  }catch(err){if(gen===generation)s.error=err.message;}
 }
 function reset(){generation++;Object.assign(s,{company:null,enabled:false,sites:[],missions:[],error:'',edit:null});}
 function field(label,id,value,type='text'){return '<label class="ess-field">'+e(label)+'<input type="'+type+'" id="mission-'+id+'" value="'+e(value||'')+'"></label>';}
 function select(label,id,selected,options){return '<label class="ess-field">'+e(label)+'<select id="mission-'+id+'">'+options.map(([v,t])=>'<option value="'+e(v)+'" '+(v===selected?'selected':'')+'>'+e(t)+'</option>').join('')+'</select></label>';}
 function button(text,act,id=''){return '<button type="button" class="ess-btn" data-action="ess:plan-mission-'+act+'" '+(id?'data-id="'+e(id)+'" ':'')+(s.busy?'disabled':'')+'>'+e(text)+'</button>';}
 function render(){
  if(!s.company)return '';
  const f=s.form;
  let body='<section class="ess-panel"><h3>Missions et tournées</h3><p>Missions distinctes des pointages et des heures. La tournée intelligente viendra séparément.</p>'+
   (s.error?'<p role="alert">'+e(s.error)+'</p>':'')+
   '<p>Module '+(s.enabled?'activé':'désactivé')+' pour cette compagnie.</p>'+button(s.enabled?'Désactiver':'Activer','toggle');
  if(s.enabled){
   body+='<div class="ess-form-grid">'+field('Journée','day',s.day,'date')+
    button('Afficher la journée','refresh')+
    select('Salarié','worker',f.worker,[['','Sélectionner'],...s.roster.filter(w=>w.status==='active').map(w=>[w.id,w.name])])+
    select('Adresse client','site',f.site,[['','Sélectionner'],...s.sites.map(x=>[x.id,x.client_name+' · '+x.name+' · '+x.city])])+
    field('Ordre du jour','order',f.order,'number')+field('Titre','title',f.title)+field('Instructions internes','instructions',f.instructions)+
    '</div>'+button('Enregistrer brouillon','draft')+button('Approuver et publier','publish');
   body+='<h4>Interventions du '+e(s.day)+'</h4>'+
    s.missions.map(x=>'<article class="ess-person"><div><b>'+x.sort_order+'. '+e(x.title)+'</b><small>'+
      e([x.first_name,x.last_name].filter(Boolean).join(' '))+' · '+e(x.client_name)+' · '+e(x.site_name)+
      ' · '+e(x.status)+'</small></div>'+(x.status==='draft'?button('Modifier le brouillon','edit',x.id):'')+'</article>').join('');
   if(s.truncated)body+='<p role="alert">Plus de 200 interventions : liste tronquée.</p>';
   if(s.sites.length>=100)body+='<p>Adresses limitées à 100 par chargement; un carnet très volumineux exige un filtre avant attribution.</p>';
  }
  return body+'</section>';
 }
 async function handle(action,el){
  if(!s.company||s.busy)return true;s.busy=true;s.error='';
  try{
   if(action==='toggle'){
    const enabled=!s.enabled;if(!doc.defaultView.confirm((enabled?'Activer':'Désactiver')+' les missions ?'))return true;
    await rpc('essential_missions_configuration',{p_company:s.company,p_enabled:enabled});
    await load(s.company,s.roster);notify(enabled?'Missions activées.':'Missions désactivées.');
   }else if(action==='refresh'){
    s.day=doc.getElementById('mission-day')?.value||s.day;await load(s.company,s.roster);
   }else if(action==='edit'){
    const item=s.missions.find(x=>x.id===el.dataset.id&&x.status==='draft');
    if(!item)throw Error('Brouillon non trouvé.');
    s.edit=item;s.form={worker:item.worker_id,site:item.site_id,day:item.mission_day,order:String(item.sort_order),title:item.title,instructions:''};
    s.day=item.mission_day;
   }else if(action==='draft'||action==='publish'){
    const val=x=>doc.getElementById('mission-'+x)?.value||'';
    const form={worker:val('worker'),site:val('site'),day:val('day'),order:val('order'),title:val('title'),instructions:val('instructions')};
    const args=missionArgs(s.company,form,s.edit,action==='publish');
    if(action==='publish'&&!doc.defaultView.confirm('Publier cette mission ? Une mission publiée ne peut pas être réaffectée silencieusement.'))return true;
    await rpc('save_essential_mission',args);
    s.day=form.day;s.edit=null;s.form={worker:form.worker,site:form.site,day:form.day,order:String(Number(form.order)+1),title:'',instructions:''};
    await load(s.company,s.roster);notify(action==='publish'?'Mission publiée (sans pointage).':'Brouillon enregistré.');
   }else return false;
  }catch(err){s.error=err.message;}finally{s.busy=false;redraw();}
  return true;
 }
 return {state:s,load,render,handle,reset};
}
export function createPersonalMissionController({sb,document:doc,escape:e,redraw,notify}){
 const s={company:null,user:null,worker:null,day:missionDate(),items:[],enabled:false,error:'',truncated:false,busy:false,pending:new Map()};
 let generation=0;
 async function load(company,user,worker,day=missionDate()){
  const gen=++generation;Object.assign(s,{company,user,worker,day,items:[],enabled:false,error:''});
  if(!company||!worker)return;
  try{
   const response=await sb.rpc('list_essential_missions',{p_company:company,p_day:day,p_worker:worker,p_include_drafts:false});
   if(response.error)throw response.error;
   if(gen!==generation)return;
   s.items=response.data?.items||[];s.enabled=!!response.data?.enabled;s.truncated=!!response.data?.truncated;
  }catch{if(gen===generation)s.error='Missions indisponibles : connexion requise.';}
 }
 function reset(){generation++;Object.assign(s,{company:null,user:null,worker:null,items:[],enabled:false,error:''});s.pending.clear();}
 function render(){
  if(!s.company||!s.worker||!s.enabled)return '';
  if(s.error||s.truncated)return '<section class="zen-company"><p role="alert">'+e(s.error||'Tournée incomplète; contactez le responsable.')+'</p></section>';
  const p=missionProgress(s.items);
  if(!p.total)return '';
  if(p.allDone)return '<section class="zen-company"><b>Toutes les missions sont terminées.</b><small>Votre session de travail reste indépendante.</small></section>';
  const x=p.next,addr=missionAddress(x);
  const platform=navigationPlatform('web',doc.defaultView?.navigator?.userAgent||'');
  let pref=null;try{pref=chooseNavigationPreference(doc.defaultView.localStorage.getItem(navigationPreferenceKey(s.user,s.company)),platform);}catch{}
  const route=addr?navigationUrl(pref||'google',addr,platform):null;
  return '<section class="zen-company" aria-label="Prochaine mission"><div><small>Prochaine mission · '+(p.done+1)+' de '+p.total+'</small>'+
   '<strong>'+e(x.title)+' · '+e(x.client_name)+' · '+e(x.site_name)+'</strong><small>'+e(addr)+'</small>'+
   (route?'<a href="'+e(route)+'" target="_blank" rel="noopener noreferrer">Itinéraire ↗</a>':'')+
   '<p>Terminer cette mission ne termine pas votre journée.</p><button type="button" class="ess-btn" data-action="mission:finish" data-id="'+e(x.id)+'" '+(s.busy?'disabled':'')+'>Terminer</button></div></section>';
 }
 async function finish(id){
  if(!s.company||!s.worker||!s.enabled||s.busy)throw Error('Mission non autorisée.');
  const x=s.items.find(m=>m.id===id&&m.status==='published');if(!x)throw Error('Mission modifiée : rechargez.');
  if(!doc.defaultView.navigator.onLine)throw Error('Connexion requise. Aucune fin n’a été enregistrée.');
  if(!doc.defaultView.confirm('Terminer « '+x.title+' » sans pointer la sortie ?'))return false;
  const request=s.pending.get(id)||doc.defaultView.crypto.randomUUID();
  s.pending.set(id,request);s.busy=true;
  try{
   const resp=await sb.rpc('complete_essential_mission',{p_company:s.company,p_id:id,p_version:x.version,p_request:request});
   if(resp.error)throw resp.error;s.pending.delete(id);
   await load(s.company,s.user,s.worker,s.day);notify('Mission terminée; votre pointage ne change pas.');return true;
  }catch{s.error='Fin non confirmée : réessayez la même demande après vérification.';return false;}
  finally{s.busy=false;redraw();}
 }
 return {state:s,load,render,finish,reset};
}
