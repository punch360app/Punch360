// UI identity/selection guards only; Supabase RLS, payroll engine and RPC own authorization.
export const laborBudgetIdentity=(a,week,department)=>JSON.stringify([
 String(a?.companyId||''),String(a?.userId||''),String(a?.role||''),
 String(a?.edition||''),String(week||''),String(department||'')
]);
export function createLaborBudgetScope(a,week,department){
 let identity=laborBudgetIdentity(a,week,department),generation=0;
 return {
  matches:(x,w,d)=>identity===laborBudgetIdentity(x,w,d),
  enter(x,w,d){identity=laborBudgetIdentity(x,w,d);generation++;return {identity,generation}},
  current:()=>({identity,generation}),
  invalidate(){generation++},
  allows:token=>Boolean(token&&token.identity===identity&&token.generation===generation)
 };
}
export function laborBudgetMonday(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Lundi AAAA-MM-JJ requis');
 const d=new Date(value+'T00:00:00Z');
 if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value||d.getUTCDay()!==1)
  throw Error('La date doit être un lundi valide');
 return value;
}
export function thisLaborBudgetMonday(now=new Date()){
 const local=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 local.setDate(local.getDate()-(local.getDay()+6)%7);
 return [String(local.getFullYear()).padStart(4,'0'),String(local.getMonth()+1).padStart(2,'0'),String(local.getDate()).padStart(2,'0')].join('-');
}
export function laborBudgetAmountCents(amount){
 const value=String(amount||'').trim().replace(',','.');
 if(!/^\d+(\.\d{1,2})?$/.test(value))throw Error('Montant positif ou nul, 2 décimales maximum');
 const [d,f='']=value.split('.');
 const cents=Number(d)*100+Number((f+'00').slice(0,2));
 if(!Number.isSafeInteger(cents)||cents<0||cents>100000000000)throw Error('Budget hors limites');
 return cents;
}
export function validLaborBudgetReason(reason){
 return typeof reason==='string'&&reason.trim().length>=3&&reason.trim().length<=1000;
}
export function allowedLaborDepartment(id,departments){
 return id===''||Boolean(id&&departments.some(d=>d.id===id&&d.active));
}
export function scopedLaborBudget(b,a,week,department){
 return Boolean(b&&b.company_id===a?.companyId&&b.week_start===week&&
  (b.department_id||'')===department&&Number.isInteger(b.version)&&b.version>=1);
}
export function matchesLaborReport(payload,budget,week,department){
 return Boolean(payload&&budget&&payload.budget_id===budget.id&&
  payload.week===week&&(payload.department_id||'')===department&&
  payload.budget_version===budget.version);
}
