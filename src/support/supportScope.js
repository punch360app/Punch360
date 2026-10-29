/** Ephemeral identity for asynchronous Support screens. Never stores private messages. */
export function createSupportScope(initialCompany){
 let company=String(initialCompany||'');
 let epoch=0;
 return {
  enter(nextCompany){company=String(nextCompany||'');return ++epoch},
  invalidate(){return ++epoch},
  current(){return {company,epoch}},
  allows(targetCompany,token){return company===String(targetCompany||'')&&epoch===token}
 };
}
