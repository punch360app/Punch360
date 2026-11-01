// Ephemeral Expo UI protection; RPC and RLS remain the authority.
export const qualifiedCoverageIdentity=a=>JSON.stringify([
 String(a?.companyId||''),String(a?.userId||''),String(a?.role||''),String(a?.edition||'')
]);
export function createQualifiedCoverageScope(a){
 let key=qualifiedCoverageIdentity(a),revision=0;
 return {
  matches:a=>key===qualifiedCoverageIdentity(a),
  current:()=>({key,revision}),
  enter(a){key=qualifiedCoverageIdentity(a);revision++;return {key,revision}},
  invalidate(){revision++},
  allows:t=>Boolean(t&&t.key===key&&t.revision===revision)
 };
}
export const mayLoadQualifiedCoverage=a=>a?.edition==='essential'&&['boss','admin'].includes(a?.role);
export function qualifiedResourceRows(data,company,limit=250){
 if(!Array.isArray(data)||data.length>limit||data.some(x=>!x||typeof x.id!=='string'||!x.id||x.company_id!==company))throw Error('Référentiel indisponible');
 if(new Set(data.map(x=>x.id)).size!==data.length)throw Error('Doublons');
 return data;
}
export function qualifiedDateLabel(value,zone){
 const time=Date.parse(String(value||''));
 if(!Number.isFinite(time))return 'Date à vérifier';
 try{return new Intl.DateTimeFormat('fr-CA',{timeZone:zone||'America/Toronto',dateStyle:'medium',timeStyle:'short'}).format(new Date(time))}catch{return 'Date à vérifier'}
}
export function canInvokeQualifiedAction(account,allowed,loading,busy,action,editAllowed){
 if(!mayLoadQualifiedCoverage(account)||!allowed||loading||busy)return false;
 if(['new','edit','copy','save','candidates'].includes(action)&&!editAllowed)return false;
 return ['new','edit','copy','save','report','candidates'].includes(action);
}
