/** Ephemeral identity guards for the Expo employee directory. Server permissions remain authoritative. */
const identity=(company,user,role)=>JSON.stringify([String(company||''),String(user||''),String(role||'')]);
export function createPeopleScope(company,user,role){
 let key=identity(company,user,role),epoch=0;
 const current=()=>({key,epoch});
 return {
  matches:(c,u,r)=>key===identity(c,u,r),
  enter(c,u,r){key=identity(c,u,r);epoch++;return current()},
  invalidate(){epoch++},
  current,
  allows:token=>Boolean(token&&token.key===key&&token.epoch===epoch)
 };
}
