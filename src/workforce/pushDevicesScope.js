/** Ephemeral account context for Expo push device UI. Server RLS and RPC remain authoritative. */
const identity=(company,user,role)=>JSON.stringify([String(company||''),String(user||''),String(role||'')]);
export function createPushDevicesScope(company,user,role){
 let key=identity(company,user,role),epoch=0;
 const current=()=>({key,epoch});
 return {
  current,
  matches:(c,u,r)=>key===identity(c,u,r),
  enter(c,u,r){key=identity(c,u,r);epoch++;return current();},
  invalidate(){epoch++},
  allows:token=>Boolean(token&&token.key===key&&token.epoch===epoch)
 };
}
