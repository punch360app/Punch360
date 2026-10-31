/**
 * Choose the initial public landing edition without changing signed-in users.
 * Explicit ?edition= links override a previously selected preference.
 * A new visitor sees the approved Essentiel Bento with its real three plans.
 */
export function resolvePublicEdition(search='',storedEdition=null){
 const requested=new URLSearchParams(search).get('edition');
 if(requested==='essential'||requested==='construction')return requested;
 return storedEdition==='construction'?'construction':'essential';
}
