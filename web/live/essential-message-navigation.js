// CORE-001: tabs mirror this company's server-verified contract snapshot.
// Server-side RLS and RPC checks remain authoritative on every operation.
export function canUseEssentialMessages(companyId,entitlementCompanyId,entitlement){
 return typeof companyId==='string'&&companyId.length>0&&companyId===entitlementCompanyId&&
  Array.isArray(entitlement?.features)&&entitlement.features.includes('messages');
}
export function essentialTabs({companyId,entitlementCompanyId,entitlement,labels={}}={}){
 const tabs=[['home','◉',labels.home||'Punch'],['hours','◷',labels.hours||'Heures'],
  ['schedule','▦',labels.schedule||'Horaire']];
 if(canUseEssentialMessages(companyId,entitlementCompanyId,entitlement))tabs.push(['messages','▤','Messages']);
 tabs.push(['more','☷',labels.more||'Plus']);
 return tabs;
}
