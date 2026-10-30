// Ephemeral client guards only; authorization still belongs to Supabase RLS and RPCs.
export const operationsIdentity=(account,mode)=>JSON.stringify([
 String(account?.companyId||''),String(account?.userId||''),String(account?.role||''),
 String(account?.edition||''),String(account?.defaultJobId||''),String(mode||'')
]);
export function createOperationsScope(account,mode){
 let identity=operationsIdentity(account,mode),revision=0;
 return {
  matches:(a,m)=>identity===operationsIdentity(a,m),
  current:()=>({identity,revision}),
  enter(a,m){identity=operationsIdentity(a,m);revision++;return {identity,revision}},
  invalidate(){revision++},
  allows:token=>Boolean(token&&token.identity===identity&&token.revision===revision)
 };
}
export const canEditOperations=(role)=>role==='boss'||role==='admin';
export function validOperationsJob(job,jobs){
 return Boolean(job&&jobs.some(j=>j.id===job));
}
export function operationsDraftJob(job,jobs){
 return validOperationsJob(job,jobs)?job:(jobs[0]?.id||'');
}
export function canCancelShift(shift,account){
 return canEditOperations(account?.role)&&Boolean(shift?.id&&shift.company_id===account.companyId&&!shift.cancelled_at);
}
export function canReadCompanyDocument(doc,account){
 return Boolean(doc?.id&&doc.company_id===account?.companyId&&doc.storage_path?.startsWith(account.companyId+'/'));
}
export function parseOperationsShiftDates(start,end){
 const complete=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
 if(!complete.test(start)||!complete.test(end))throw Error('Dates ISO avec fuseau requises');
 const a=Date.parse(start),b=Date.parse(end);
 if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a||b-a>24*3600000)throw Error('Quart invalide, maximum 24 heures');
 return {start:new Date(a).toISOString(),end:new Date(b).toISOString()};
}
