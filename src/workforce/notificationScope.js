/** In-memory account epochs; UI validation does not replace server RLS. */
const keyFor=(company,user,role)=>JSON.stringify([String(company||''),String(user||''),String(role||'')]);
export function createNotificationScope(company,user,role){
 let identity=keyFor(company,user,role),epoch=0;
 const current=()=>({identity,epoch});
 const matches=(companyId,userId,roleId)=>identity===keyFor(companyId,userId,roleId);
 const allows=token=>Boolean(token&&token.identity===identity&&token.epoch===epoch);
 return {
  matches,allows,current,
  enter(companyId,userId,roleId){identity=keyFor(companyId,userId,roleId);epoch++;return current();},
  invalidate(){epoch++;}
 };
}
