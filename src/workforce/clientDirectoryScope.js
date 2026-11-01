// Expo-only guards. Boss/Admin eligibility and optimistic versions are enforced by RPCs.
export function createClientDirectoryScope(company){
 let current=String(company||''),version=0;
 return {
  matches:company=>current===String(company||''),
  enter(company){current=String(company||'');version++;return {company:current,version}},
  current:()=>({company:current,version}),
  invalidate(){version++},
  allows:token=>Boolean(token&&token.company===current&&token.version===version&&current)
 };
}
export const directorySearch=value=>{
 const search=String(value||'').trim();
 if(search.length>100)throw Error('Recherche de 100 caractères maximum');
 return search;
};
export function safeDirectoryPage(payload,company,previous=[],more=false,limit=50){
 const items=payload?.items;
 if(!Array.isArray(items)||items.length>limit||typeof payload.has_more!=='boolean'||
  items.some(x=>!x||typeof x.id!=='string'||!x.id||x.company_id!==company||
   !Number.isInteger(x.version)||x.version<1))throw Error('Réponse de répertoire invalide');
 if(new Set(items.map(x=>x.id)).size!==items.length)throw Error('Doublons dans le répertoire');
 if(items.some((x,i)=>i>0&&x.id<=items[i-1].id))throw Error('Pagination désordonnée');
 if(more&&previous.length&&items.length&&items[0].id<=previous[previous.length-1].id)throw Error('Curseur invalide');
 if(payload.has_more&&items.length===0)throw Error('Pagination incomplète');
 return more?[...previous,...items]:items;
}
export function canEditDirectoryRow(row,company,visible){
 return Boolean(row?.id&&row.company_id===company&&Number.isInteger(row.version)&&row.version>0&&
  visible.some(v=>v.id===row.id&&v.company_id===company&&v.version===row.version));
}
export function canCreateSiteForClient(clientId,clients){
 return Boolean(clientId&&clients.some(c=>c.id===clientId&&c.active));
}
