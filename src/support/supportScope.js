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


/** Scoped to a signed-in company member, not merely an organization. */
export const supportAccountIdentity=account=>JSON.stringify([
 String(account?.companyId||''),String(account?.userId||''),
 String(account?.role||''),String(account?.edition||'')
]);
export function createSupportAccountScope(initialAccount){
 let identity=supportAccountIdentity(initialAccount),epoch=0;
 return {
  current:()=>({identity,epoch}),
  matches:account=>identity===supportAccountIdentity(account),
  enter(account){identity=supportAccountIdentity(account);return {identity,epoch:++epoch}},
  invalidate(){epoch++},
  allows:token=>Boolean(token&&token.identity===identity&&token.epoch===epoch)
 };
}
export function safeSupportTicketPage(rows,account){
 if(!Array.isArray(rows)||rows.length>50||rows.some(t=>
  !t||typeof t.id!=='string'||!t.id||t.company_id!==account?.companyId||
  typeof t.created_by!=='string'||typeof t.subject!=='string'||
  !Number.isInteger(t.version)||t.version<1||
  !['open','waiting','resolved','closed'].includes(t.status)||
  (!['boss','admin'].includes(account?.role)&&t.created_by!==account?.userId)))
  throw Error('Liste de support incomplète');
 if(new Set(rows.map(t=>t.id)).size!==rows.length)throw Error('Doublon de support');
 return rows;
}
export function safeSupportTicketDetail(ticket,account,limit=200){
 safeSupportTicketPage([ticket],account);
 if(!Array.isArray(ticket.messages)||ticket.messages.length>limit||
  ticket.messages.some(m=>!m||typeof m.id!=='string'||typeof m.body!=='string'))
  throw Error('Conversation incomplète');
 if(new Set(ticket.messages.map(m=>m.id)).size!==ticket.messages.length)
  throw Error('Messages en double');
 return ticket;
}
export function isKnownSupportTicket(id,tickets){
 return Boolean(id&&tickets.some(t=>t.id===id));
}
