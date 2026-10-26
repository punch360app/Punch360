// NAV-001–005 (partial): voluntary directions, never a GPS reading, punch, route
// measurement or mileage log. No third-party API, tokens or mapping SDK.
export function navigationPlatform(kind='web',userAgent=''){
 if(kind==='ios'||kind==='android'||kind==='mac')return kind;
 const ua=String(userAgent||'');
 if(/iPhone|iPad|iPod/i.test(ua))return 'ios';
 if(/Android/i.test(ua))return 'android';
 if(/Macintosh|Mac OS X/i.test(ua))return 'mac';
 return 'web';
}
export function navigationProviders(platform='web'){
 return [
  {id:'google',label:'Google Maps'},
  {id:'waze',label:'Waze'},
  ...(['ios','mac'].includes(platform)?[{id:'apple',label:'Plans Apple'}]:[]),
  ...(platform==='android'?[{id:'other',label:'Choisir une autre application'}]:[])
 ];
}
export function navigationAddress(address){
 const text=String(address||'').trim();
 if(text.length<6||text.length>700||/[\u0000-\u001F\u007F]/.test(text))throw Error('Adresse professionnelle manquante ou non exploitable.');
 return text;
}
export function navigationUrl(provider,address,platform='web'){
 const place=encodeURIComponent(navigationAddress(address));
 if(provider==='google')return 'https://www.google.com/maps/dir/?api=1&destination='+place;
 if(provider==='waze')return 'https://waze.com/ul?q='+place+'&navigate=yes';
 if(provider==='apple'&&['ios','mac'].includes(platform))return 'https://maps.apple.com/?daddr='+place;
 if(provider==='other'&&platform==='android')return 'geo:0,0?q='+place;
 throw Error('Application de navigation non disponible sur cet appareil.');
}
/** @param {{visit?:Record<string,any>|null,usualAddress?:string,usualName?:string,incomplete?:boolean}} [options] */
export function navigationDestination({visit=null,usualAddress='',usualName='',incomplete=false}={}){
 // Do not silently substitute a branch address when an assigned client destination
 // could be omitted by the server's bounded result.
 if(visit?.address)return {kind:'client',title:visit.client?[visit.client,visit.title].filter(Boolean).join(' · '):(visit.title||'Client'),address:navigationAddress(visit.address)};
 if(incomplete||visit)return null;
 try{return {kind:'fixed',title:usualName||'Lieu de travail habituel',address:navigationAddress(usualAddress)};}
 catch{return null;}
}
export function chooseNavigationPreference(saved,platform='web'){
 const normalized=String(saved||'');
 return navigationProviders(platform).some(x=>x.id===normalized)?normalized:null;
}
export function navigationPreferenceKey(userId,companyId){
 if(!userId||!companyId)throw Error('Compte et compagnie requis.');
 return 'punch-navigation:'+String(userId)+':'+String(companyId);
}

/**
 * MLOC-006/NAV-006 — one published intervention = one selectable destination.
 * The caller must only supply destinations from the already authorized RPC;
 * never append access codes, notes or contact details to a provider URL.
 * No multi-stop route is manufactured from independently planned shifts.
 */
export function navigationStopDestination(site){
 if(!site?.shift_id||!site?.client_site_id)return null;
 const components=[site.address_line,site.unit,site.city,site.region,site.postal_code,site.country]
   .map(x=>String(x??'').trim()).filter(Boolean);
 if(!site.address_line||!site.city)return null;
 try{
  const address=navigationAddress(components.join(', '));
  return {shiftId:site.shift_id,siteId:site.client_site_id,
    title:[site.client_name,site.site_name].filter(Boolean).join(' · ')||'Intervention client',
    address};
 }catch{return null;}
}
export function navigationStopChoices(site,platform='web'){
 const destination=navigationStopDestination(site);
 if(!destination)return [];
 return navigationProviders(platform).map(provider=>({
  id:provider.id,label:provider.label,url:navigationUrl(provider.id,destination.address,platform)
 }));
}

/** Save or clear a user's current-company navigation provider; never store the address.
 * Supports both synchronous browser storage and asynchronous React Native AsyncStorage.
 * @param {{setItem:(key:string,value:string)=>any,removeItem:(key:string)=>any}} storage
 * @param {string} userId @param {string} companyId
 * @param {string|null} provider @param {string} platform
 */
export async function writeNavigationPreference(storage,userId,companyId,provider,platform='web'){
 const key=navigationPreferenceKey(userId,companyId);
 if(provider===null){await storage.removeItem(key);return null;}
 const selected=chooseNavigationPreference(provider,platform);
 if(!selected||selected!==provider)throw Error('Application de navigation incompatible avec cet appareil.');
 await storage.setItem(key,provider);
 return provider;
}
