// Read previously server-verified account hints without treating a browser
// cache as fresh permission. Corrupt data remains untouched for recovery.
const roles=new Set(['employee','lead','admin','boss']);
const editions=new Set(['essential','construction']);
function readJson(storage,key){
 try{const raw=storage.getItem(key);return raw?JSON.parse(raw):null}catch{return null}
}
export function cachedOfflineWebUser(storage){
 const value=readJson(storage,'punch-local-user');
 if(!value||typeof value!=='object'||Array.isArray(value)||
  typeof value.id!=='string'||!value.id.trim()||
  value.id.length>256||
  (value.email!=null&&typeof value.email!=='string'))return null;
 return {id:value.id,...(typeof value.email==='string'?{email:value.email}:{})};
}
export function cachedOfflineWebAccount(storage,user){
 if(!user||typeof user.id!=='string'||!user.id)return null;
 let companyId;
 try{companyId=storage.getItem('punch-last-company:'+user.id)}catch{return null}
 if(typeof companyId!=='string'||!companyId.trim()||companyId.length>256)return null;
 const value=readJson(storage,'punch-account:'+user.id+':'+companyId);
 if(!value||typeof value!=='object'||Array.isArray(value)||
  value.company_id!==companyId||
  (value.user_id!=null&&value.user_id!==user.id)||
  !roles.has(value.role)||!value.companies||
  typeof value.companies!=='object'||Array.isArray(value.companies)||
  !editions.has(value.companies.product_edition))return null;
 const info=value.companies;
 return {company_id:companyId,role:value.role,companies:{
  name:typeof info.name==='string'?info.name:'Ma compagnie',
  billing_status:typeof info.billing_status==='string'?info.billing_status:'setup',
  product_edition:info.product_edition,
  default_punch_job_id:typeof info.default_punch_job_id==='string'?
   info.default_punch_job_id:null
 }};
}
