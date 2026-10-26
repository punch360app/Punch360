// MLOC-002/004: link an EXISTING scheduled shift to a client destination.
// No additional punch or job; maps are opened only after explicit user action.
export function assignedSiteForShift(items,shiftId){
 return Array.isArray(items)?items.find(x=>x.shift_id===shiftId)||null:null;
}
export function assignedSiteAddress(site){
 if(!site)return '';
 return [site.address_line,site.unit,site.city,site.region,site.postal_code,site.country]
  .map(x=>String(x??'').trim()).filter(Boolean).join(', ');
}
export function assignedSiteMapsUrl(site){
 const address=assignedSiteAddress(site);
 if(!address)throw Error('Cette intervention n’a pas d’adresse exploitable.');
 return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address);
}
export function shiftSiteAssignmentArgs(company,shift,siteId){
 if(!company||!shift?.id||!Number.isInteger(Number(shift.version))||Number(shift.version)<1)
  throw Error('Quart et version valides requis.');
 const selected=siteId===null||String(siteId??'').trim()===''?null:String(siteId).trim();
 return {p_company:company,p_shift:shift.id,p_site:selected,p_expected_version:Number(shift.version)};
}
export function assignedSiteSummary(site){
 if(!site)return '';
 return [site.client_name,site.site_name,site.city].filter(Boolean).join(' · ');
}
