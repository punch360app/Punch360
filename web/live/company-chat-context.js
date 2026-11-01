// Never reuse a conversation loaded for another company. This local check
// complements (and does not replace) RLS on conversations and messages.
export function isCurrentCompanyChat({companyId,loadedCompanyId,conversations,chatId}={}){
 return typeof companyId==='string'&&companyId.length>0&&companyId===loadedCompanyId&&
  typeof chatId==='string'&&chatId.length>0&&Array.isArray(conversations)&&
  conversations.some(c=>c?.id===chatId&&(!c.company_id||c.company_id===companyId));
}
