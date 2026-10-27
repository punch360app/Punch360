export const UUID='[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const valid=new RegExp('^'+UUID+'$','i');
export function validCleanupItem(item){
 if(!item||typeof item!=='object')return false;
 const {id,company,mission,path,claim}=item;
 if(![id,company,mission,claim].every(x=>typeof x==='string'&&valid.test(x)))return false;
 return typeof path==='string'&&path===company+'/'+mission+'/'+id;
}
export function cleanupSummary(){return {claimed:0,deleted:0,failed:0,invalid:0};}
