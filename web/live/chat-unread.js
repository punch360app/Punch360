// UI-only indicator; RPCs enforce company membership and entitlement.
export function createChatUnreadController({sb}){
 const state={company:null,counts:new Map(),revision:0};
 const reset=()=>{state.revision++;state.company=null;state.counts=new Map();};
 const count=id=>state.counts.get(id)||0;
 const total=()=>Math.min(99,[...state.counts.values()].reduce((a,b)=>a+b,0));
 async function load(companyId){
  if(typeof companyId!=='string'||!companyId){reset();return false;}
  if(state.company!==companyId){state.company=null;state.counts=new Map();}
  const revision=++state.revision;
  const response=await sb.rpc('chat_unread_counts',{p_company:companyId});
  if(revision!==state.revision)return false;
  if(response.error)throw response.error;
  const counts=new Map();
  for(const row of Array.isArray(response.data)?response.data:[]){
   if(typeof row?.conversation_id!=='string'||!row.conversation_id)continue;
   if(!Number.isSafeInteger(row.unread)||row.unread<0)continue;
   counts.set(row.conversation_id,Math.min(99,row.unread));
  }
  state.company=companyId;state.counts=counts;return true;
 }
 async function mark(companyId,conversationId,messageId){
  if(state.company!==companyId||!conversationId||!messageId)return false;
  const revision=state.revision;
  const response=await sb.rpc('chat_mark_read',{p_company:companyId,p_conversation:conversationId,p_message:messageId});
  if(response.error)throw response.error;
  if(revision!==state.revision||state.company!==companyId)return false;
  return await load(companyId);
 }
 return {state,load,mark,reset,count,total};
}
