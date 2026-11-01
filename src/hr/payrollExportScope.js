import {payrollFields} from '../../web/live/payroll-export.js';
// UI guards only. SQL RPCs remain authoritative for compensation, versions and closed weeks.
export const payrollEstimateKey=e=>e?JSON.stringify([
 String(e.id||''),String(e.company_id||''),String(e.week_start||''),
 String(e.payload?.generated_at||''),String(e.payload?.rule_version??'')
]):'none';
export const payrollExportIdentity=(a,e)=>JSON.stringify([
 String(a?.companyId||''),String(a?.userId||''),String(a?.role||''),
 String(a?.edition||''),payrollEstimateKey(e)
]);
export function createPayrollExportScope(a,e){
 let identity=payrollExportIdentity(a,e),revision=0;
 return {
  matches:(a,e)=>identity===payrollExportIdentity(a,e),
  enter(a,e){identity=payrollExportIdentity(a,e);revision++;return {identity,revision}},
  current:()=>({identity,revision}),
  invalidate(){revision++},
  allows:t=>Boolean(t&&t.identity===identity&&t.revision===revision)
 };
}
export const mayUsePayrollExport=a=>a?.edition==='essential'&&['boss','admin'].includes(a?.role);
export function payrollPrivateRows(rows,company,limit=1000){
 if(!Array.isArray(rows)||rows.length>limit||rows.some(r=>!r||r.company_id!==company))
  throw Error('Répertoire de paie indisponible');
 return rows;
}
export const payrollDefaultColumns=()=>[
 {key:'external_id',header:'Matricule fournisseur'},
 {key:'regular_hours',header:'Heures régulières'},
 {key:'overtime_hours',header:'Heures supplémentaires'}
];
export function validatePayrollProfile(name,delimiter,columns,reason){
 const allowed=new Set(payrollFields.map(([key])=>key));
 if(typeof name!=='string'||name.trim().length<3||name.trim().length>100||
 ![',',';'].includes(delimiter)||!Array.isArray(columns)||columns.length<2||columns.length>20||
 !columns.some(c=>c.key==='external_id')||
 columns.some(c=>!allowed.has(c?.key)||typeof c.header!=='string'||!c.header.trim()||
 c.header.length>80||/[\u0000-\u001f\u007f]/.test(c.header))||
 new Set(columns.map(c=>c.key)).size!==columns.length||
 new Set(columns.map(c=>c.header)).size!==columns.length||
 typeof reason!=='string'||reason.trim().length<3||reason.trim().length>1000)
 throw Error('Profil ou motif invalide');
 return {name:name.trim(),columns:columns.map(c=>({key:c.key,header:c.header.trim()})),reason:reason.trim()};
}
export function validPayrollMapping(worker,external,reason,workers){
 if(!worker||!workers.some(w=>w.id===worker)||
 typeof external!=='string'||!external.trim()||external.trim().length>80||
 /[\u0000-\u001f\u007f]/.test(external)||
 typeof reason!=='string'||reason.trim().length<3||reason.trim().length>1000)
 throw Error('Matricule ou motif invalide');
 return {worker,external:external.trim(),reason:reason.trim()};
}
export function canUsePayrollPreview(preview,a,estimate,profile){
 if(!mayUsePayrollExport(a)||!preview?.id||!preview.payload||!profile?.id||!estimate?.id)return false;
 const p=preview.payload;
 return preview.company_id===a.companyId&&preview.created_by===a.userId&&
 preview.profile_id===profile.id&&preview.estimate_id===estimate.id&&
 p.profile_version===profile.version&&p.delimiter===profile.delimiter&&
 Array.isArray(p.rows)&&p.rows.length>0&&Array.isArray(p.columns)&&
 p.columns.length>0;
}
export function payrollRequestKey(a,profile,estimate){
 return [a?.companyId,a?.userId,profile?.id,profile?.version,payrollEstimateKey(estimate)].join(':');
}
export function validExportFilename(preview){
 const week=String(preview?.payload?.week||'');
 const id=String(preview?.id||'');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(week)||!/^[0-9a-f-]{36}$/i.test(id))
  throw Error('Référence export invalide');
 return 'PUNCH-paie-'+week+'-'+id+'.csv';
}
