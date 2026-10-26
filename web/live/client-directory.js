// MLOC-001. Manager-only client directory. It does not create business branches,
// punch jobs, GPS events, shifts or notifications. API permissions remain authoritative.
export const blankClient=()=>({name:'',reference:'',contact_name:'',contact_phone:'',active:true});
export const blankSite=()=>({
 client_id:'',name:'',address_line:'',unit:'',city:'',region:'',postal_code:'',
 country:'CA',timezone:'America/Toronto',latitude:'',longitude:'',
 contact_name:'',contact_phone:'',access_instructions:'',internal_notes:'',active:true
});
const str=(v,max,label,required=false)=>{
 const value=String(v??'').trim();
 if(value.length>max||(required&&value.length<2))throw Error(label+' invalide.');
 return value;
};
const num=(v,min,max,label)=>{
 if(v===null||v===undefined||String(v).trim()==='')return null;
 const s=String(v).trim();
 if(!/^-?\d+(?:\.\d+)?$/.test(s))throw Error(label+' invalide.');
 const value=Number(s);
 if(!Number.isFinite(value)||value<min||value>max)throw Error(label+' hors limites.');
 return value;
};
/** @param {string} company @param {Record<string,any>} form @param {{id?:string,version?:number}|null} [row] */
export function clientSaveArgs(company,form,row=null){
 if(!company)throw Error('Compagnie manquante.');
 return {p_company:company,p_id:row?.id||null,p_expected_version:row?.version||0,
  p_name:str(form.name,160,'Nom',true),p_reference:str(form.reference,60,'Référence'),
  p_contact_name:str(form.contact_name,120,'Contact'),p_contact_phone:str(form.contact_phone,35,'Téléphone'),
  p_active:form.active===true||form.active==='true'};
}
/** @param {string} company @param {Record<string,any>} form @param {{id?:string,version?:number}|null} [row] */
export function siteSaveArgs(company,form,row=null){
 if(!company)throw Error('Compagnie manquante.');
 const lat=num(form.latitude,-90,90,'Latitude'),lng=num(form.longitude,-180,180,'Longitude');
 if((lat===null)!==(lng===null))throw Error('Latitude et longitude doivent être toutes les deux indiquées ou vides.');
 const name=str(form.name,140,'Nom du lieu',true),
   address=str(form.address_line,180,'Adresse',true),city=str(form.city,120,'Ville',true);
 if(address.length<3)throw Error('Adresse trop courte.');
 if(!form.client_id)throw Error('Choisissez un client actif.');
 const timezone=str(form.timezone,100,'Fuseau',true);
 if(!/^[A-Za-z0-9_+./-]+$/.test(timezone))throw Error('Fuseau IANA invalide.');
 return {p_company:company,p_id:row?.id||null,p_expected_version:row?.version||0,
  p_client:form.client_id,p_name:name,p_address_line:address,p_unit:str(form.unit,80,'Unité'),
  p_city:city,p_region:str(form.region,120,'Région'),
  p_postal_code:str(form.postal_code,25,'Code postal'),p_country:str(form.country,3,'Pays',true),
  p_timezone:timezone,p_latitude:lat,p_longitude:lng,
  p_contact_name:str(form.contact_name,120,'Contact'),p_contact_phone:str(form.contact_phone,35,'Téléphone'),
  p_access_instructions:str(form.access_instructions,1200,'Instructions'),
  p_internal_notes:str(form.internal_notes,1200,'Notes internes'),
  p_active:form.active===true||form.active==='true'};
}
export function siteAddress(s){
 return [s.address_line,s.unit,s.city,s.region,s.postal_code,s.country].filter(Boolean).join(', ');
}
const clientFields=[['Client','name'],['Référence','reference'],['Nom du contact','contact_name'],['Téléphone professionnel','contact_phone']];
const siteFields=[
 ['Nom du lieu','name'],['Adresse','address_line'],['Appartement / unité','unit'],['Ville','city'],
 ['Province / région','region'],['Code postal','postal_code'],['Pays (CA, US...)','country'],['Fuseau IANA','timezone'],
 ['Latitude (facultative)','latitude'],['Longitude (facultative)','longitude'],
 ['Contact professionnel','contact_name'],['Téléphone professionnel','contact_phone'],
 ['Instructions d’accès non sensibles','access_instructions'],['Notes internes aux responsables','internal_notes']
];
export function createClientDirectoryController({sb,escape:e,document:doc,redraw,notify}){
 let revision=0;
 const state={company:null,clients:[],sites:[],clientMore:false,siteMore:false,
  clientSearch:'',siteSearch:'',clientDraft:null,siteDraft:null,clientEdit:null,siteEdit:null,
  error:'',busy:false,unavailable:false};
 const selectValue=(id,fallback='')=>doc.getElementById('directory-'+id)?.value??fallback;
 const field=(label,key,val)=>'<label class="ess-field">'+label+'<input id="directory-'+key+'" value="'+e(val??'')+'"></label>';
 const activeChoice=(key,value)=>'<label class="ess-field">Statut<select id="directory-'+key+'"><option value="true" '+(value?'selected':'')+'>Actif</option><option value="false" '+(!value?'selected':'')+'>Archivé</option></select></label>';
 const button=(title,action,attrs='')=>'<button type="button" class="ess-btn" data-action="ess:plan-client-'+action+'" '+(state.busy?'disabled':'')+' '+attrs+'>'+e(title)+'</button>';
 const rpc=async(name,args)=>{const res=await sb.rpc(name,args);if(res.error)throw res.error;return res.data;};
 async function page(kind,more=false,expectedRevision=revision){
  const requestCompany=state.company;
  const isClient=kind==='clients',name=isClient?'list_essential_clients':'list_essential_client_sites';
  const key=isClient?'clients':'sites',hasMore=isClient?'clientMore':'siteMore';
  const list=state[key],last=more&&list.length?list[list.length-1].id:null;
  const answer=await rpc(name,{p_company:requestCompany,p_search:state[isClient?'clientSearch':'siteSearch'],p_after:last,p_limit:50});
  if(expectedRevision!==revision||state.company!==requestCompany)return;
  state[key]=more?[...list,...(answer.items||[])]:answer.items||[];
  state[hasMore]=!!answer.has_more;
 }
 async function load(company){
  const now=++revision;
  if(state.company!==company){
   Object.assign(state,{company,clients:[],sites:[],clientMore:false,siteMore:false,
    clientSearch:'',siteSearch:'',clientDraft:null,siteDraft:null,clientEdit:null,siteEdit:null,error:'',unavailable:false});
  }
  try{
   await Promise.all([page('clients'),page('sites')]);
   if(now!==revision)return;
   state.unavailable=false;
  }catch(err){if(now===revision){state.error=err.message;state.unavailable=true;}}
 }
 function reset(){revision++;Object.assign(state,{company:null,clients:[],sites:[],clientMore:false,siteMore:false,
  clientDraft:null,siteDraft:null,clientEdit:null,siteEdit:null,clientSearch:'',siteSearch:'',error:'',busy:false,unavailable:false});}
 function render(){
  const sc=state;
  const clients=sc.clients.filter(c=>c.active);
  const options=clients.map(c=>'<option value="'+e(c.id)+'" '+(sc.siteDraft?.client_id===c.id?'selected':'')+'>'+e(c.name)+'</option>').join('');
  const form=(fields,draft,kind)=>fields.map(([label,key])=>field(label,kind+'-'+key,draft[key])).join('');
  return '<section class="ess-panel"><h3>Clients et adresses d’intervention</h3>'+
   '<p class="ess-fine">Un client peut avoir plusieurs adresses. Ces lieux sont illimités et distincts des établissements de votre entreprise : ils ne comptent pas dans les limites de bornes ou d’abonnement. Aucune affectation ou localisation GPS n’est créée ici. Contacts et instructions réservés aux responsables.</p>'+
   (sc.error?'<p role="alert">'+e(sc.error)+'</p>':'')+
   '<div class="ess-worker-layout"><section class="ess-panel"><h4>Clients</h4>'+
   field('Rechercher un client','client-search',sc.clientSearch)+button('Rechercher','search-clients')+
   button('Nouveau client','new-client')+
   sc.clients.map(c=>'<article class="ess-person"><div><b>'+e(c.name)+'</b><small>'+e(c.reference||'')+(c.active?'':' · Archivé')+'</small></div>'+
    button('Modifier','edit-client','data-id="'+e(c.id)+'"')+
    (c.active?button('Ajouter une adresse','new-site','data-id="'+e(c.id)+'"'):'')+'</article>').join('')+
   (sc.clientMore?button('Voir davantage de clients','more-clients'):'')+
   (sc.clientDraft?'<h4>'+(sc.clientEdit?'Modifier':'Ajouter')+' un client</h4><div class="ess-form-grid">'+form(clientFields,sc.clientDraft,'client')+
    activeChoice('client-active',sc.clientDraft.active)+'</div>'+button('Enregistrer le client','save-client')+
    button('Fermer','close-client'):'')+'</section>'+
   '<section class="ess-panel"><h4>Adresses d’intervention</h4>'+
   field('Rechercher une adresse ou une ville','site-search',sc.siteSearch)+button('Rechercher','search-sites')+
   button('Nouvelle adresse','new-site')+
   sc.sites.map(s=>'<article class="ess-person"><div><b>'+e(s.name)+'</b><small>'+e(s.client_name)+' · '+e(siteAddress(s))+(s.active?'':' · Archivée')+'</small></div>'+
    button('Modifier','edit-site','data-id="'+e(s.id)+'"')+'</article>').join('')+
   (sc.siteMore?button('Voir davantage d’adresses','more-sites'):'')+
   (sc.siteDraft?'<h4>'+(sc.siteEdit?'Modifier':'Ajouter')+' une adresse</h4>'+
    '<p class="ess-fine">Sélectionnez un client visible. Cherchez-le d’abord si nécessaire. Aucune vérification automatique de l’adresse par un tiers.</p>'+
    '<label class="ess-field">Client<select id="directory-site-client_id">'+
     '<option value="">Choisir un client</option>'+options+'</select></label>'+
    '<div class="ess-form-grid">'+form(siteFields,sc.siteDraft,'site')+
    activeChoice('site-active',sc.siteDraft.active)+'</div>'+
    button('Enregistrer l’adresse','save-site')+button('Fermer','close-site'):'')+'</section></div></section>';
 }
 function draftFromFields(kind){
  const source=kind==='client'?state.clientDraft:state.siteDraft,keys=kind==='client'?clientFields:siteFields;
  const result={...source};
  for(const [,key] of keys)result[key]=selectValue(kind+'-'+key,result[key]);
  result.active=selectValue(kind+'-active',result.active?'true':'false')==='true';
  if(kind==='site')result.client_id=selectValue('site-client_id',result.client_id);
  return result;
 }
 async function handle(action,el){
  if(state.busy)return true;
  state.error='';state.busy=true;
  try{
   const id=el.dataset.id;
   if(action==='search-clients'){state.clientSearch=selectValue('client-search');await page('clients');}
   else if(action==='search-sites'){state.siteSearch=selectValue('site-search');await page('sites');}
   else if(action==='more-clients'){if(state.clientMore)await page('clients',true);}
   else if(action==='more-sites'){if(state.siteMore)await page('sites',true);}
   else if(action==='new-client'){state.clientEdit=null;state.clientDraft=blankClient();}
   else if(action==='new-site'){state.siteEdit=null;state.siteDraft={...blankSite(),client_id:id||state.clients.find(c=>c.active)?.id||''};}
   else if(action==='edit-client'){
    const c=state.clients.find(c=>c.id===id);if(!c)throw Error('Client introuvable. Actualisez.');
    state.clientEdit=c;state.clientDraft={...c};
   }
   else if(action==='edit-site'){
    const s=state.sites.find(s=>s.id===id);if(!s)throw Error('Adresse introuvable. Actualisez.');
    state.siteEdit=s;state.siteDraft={...s};
   }
   else if(action==='close-client'){state.clientEdit=null;state.clientDraft=null;}
   else if(action==='close-site'){state.siteEdit=null;state.siteDraft=null;}
   else if(action==='save-client'){
    if(!state.clientDraft)throw Error('Chargez un client.');
    const form=draftFromFields('client');
    if(!form.active&&state.clientEdit?.active&&!doc.defaultView.confirm('Archiver le client ? Archivez d’abord ses adresses actives. Rien ne sera supprimé.'))return true;
    await rpc('save_essential_client',clientSaveArgs(state.company,form,state.clientEdit));
    state.clientEdit=null;state.clientDraft=null;await page('clients');notify('Fiche client enregistrée. Aucun abonnement modifié.');
   }
   else if(action==='save-site'){
    if(!state.siteDraft)throw Error('Chargez une adresse.');
    const form=draftFromFields('site');
    if(!form.active&&state.siteEdit?.active&&!doc.defaultView.confirm('Archiver cette adresse ? Les affectations historiques restent conservées.'))return true;
    await rpc('save_essential_client_site',siteSaveArgs(state.company,form,state.siteEdit));
    state.siteEdit=null;state.siteDraft=null;await page('sites');notify('Adresse enregistrée; aucun quart ni établissement créé.');
   }else return false;
  }catch(err){state.error=err.message;}finally{state.busy=false;redraw();}
  return true;
 }
 return {state,load,reset,render,handle};
}
