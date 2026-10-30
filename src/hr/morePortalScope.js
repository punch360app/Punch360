/** In-memory identity tokens for Expo HR screens; no private records are persisted. */
const identity=(company,user,role)=>JSON.stringify([String(company||''),String(user||''),String(role||'')]);
export function createMorePortalScope(company,user,role){
 let key=identity(company,user,role),epoch=0;
 const current=()=>({key,epoch});
 return {
  matches:(companyId,userId,roleId)=>key===identity(companyId,userId,roleId),
  enter(companyId,userId,roleId){key=identity(companyId,userId,roleId);epoch++;return current();},
  invalidate(){epoch++},
  current,
  allows:token=>Boolean(token&&token.key===key&&token.epoch===epoch)
 };
}
