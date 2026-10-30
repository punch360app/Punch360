/** Ephemeral identity tokens for invite settings. Database RPC/RLS remain authoritative. */
const identity=(company,user,role)=>JSON.stringify([String(company||''),String(user||''),String(role||'')]);
export function createInviteEmailScope(company,user,role){
 let key=identity(company,user,role),epoch=0;
 const current=()=>({key,epoch});
 return {
  matches:(c,u,r)=>key===identity(c,u,r),
  enter(c,u,r){key=identity(c,u,r);epoch++;return current();},
  invalidate(){epoch++},
  current,
  allows:token=>Boolean(token&&token.key===key&&token.epoch===epoch)
 };
}
export function parseInvitationHours(input){
 if(!/^[0-9]+$/.test(input))return null;
 const value=Number(input);
 return Number.isSafeInteger(value)&&value>=1&&value<=720?value:null;
}
