/** Ephemeral workspace and thread tokens for asynchronous Expo messaging. Never stores content. */
const identity=(company,user,role)=>JSON.stringify([String(company||''),String(user||''),String(role||'')]);
export function createMessagesScope(companyId,userId,role){
 let key=identity(companyId,userId,role),epoch=0,threadId='',threadEpoch=0;
 const current=()=>({key,epoch,threadId,threadEpoch});
 const allowsWorkspace=token=>Boolean(token&&token.key===key&&token.epoch===epoch);
 return {
  matches:(company,user,nextRole)=>key===identity(company,user,nextRole),
  enter(company,user,nextRole){key=identity(company,user,nextRole);epoch++;threadId='';threadEpoch++;return current();},
  selectThread(nextId){threadId=String(nextId||'');threadEpoch++;return current();},
  invalidate(){epoch++;threadId='';threadEpoch++;},
  current,
  allowsWorkspace,
  allowsThread:token=>allowsWorkspace(token)&&Boolean(threadId)&&token.threadId===threadId&&token.threadEpoch===threadEpoch
 };
}
