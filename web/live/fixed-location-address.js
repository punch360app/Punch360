// NAV-002 — descriptive navigation address for an EXISTING establishment.
// Never updates the job ID or the GPS perimeter used to validate a Punch.
export function locationAddressDraft(location){
 const parts=location?.address_components&&typeof location.address_components==='object'
  ?location.address_components:{};
 return {
  line:String(parts.line||location?.address||''),
  unit:String(parts.unit||''),city:String(parts.city||''),
  region:String(parts.region||''),postal_code:String(parts.postal_code||''),
  country:String(parts.country||'CA'),timezone:String(location?.timezone||'America/Toronto')
 };
}
const field=(v,max,name,min=0)=>{
 const value=String(v??'').trim();
 if(value.length<min||value.length>max||/[\u0000-\u001F\u007F]/.test(value))
  throw Error(name+' invalide.');
 return value;
};
export function locationNavigationAddressArgs(company,location,draft){
 if(!company||!location?.id||!Number.isInteger(Number(location.navigation_address_version))||Number(location.navigation_address_version)<1)
  throw Error('Établissement ou version manquante, rechargez les données.');
 const line=field(draft.line,180,'Adresse civique',3);
 const city=field(draft.city,120,'Ville',2);
 const country=field(draft.country,3,'Pays',2).toUpperCase();
 if(country.length>3||!/^[A-Z]{2,3}$/.test(country))throw Error('Code pays invalide.');
 const timezone=field(draft.timezone,100,'Fuseau horaire',2);
 if(!/^[A-Za-z0-9_+./-]+$/.test(timezone))throw Error('Fuseau IANA invalide.');
 return {
  p_company:company,p_location:location.id,p_expected_version:Number(location.navigation_address_version),
  p_address_line:line,p_unit:field(draft.unit,80,'Unité'),
  p_city:city,p_region:field(draft.region,120,'Province'),
  p_postal_code:field(draft.postal_code,25,'Code postal'),p_country:country,p_timezone:timezone
 };
}
