/** Client validation only; server owns all eligibility, rights and idempotence. */
export function nextIsoMonday(dateStr){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr)))throw Error('Date requise.');
 const d=new Date(dateStr+'T12:00:00Z');if(!Number.isFinite(d.getTime()))throw Error('Date invalide.');
 const weekday=d.getUTCDay()||7;
 d.setUTCDate(d.getUTCDate()+(8-weekday)%7);
 return d.toISOString().slice(0,10);
}
export function reminderSelection(form){
 const week=String(form.reminderWeek??''),due=String(form.reminderDue??'');
 const valid=x=>/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
 if(!valid(week)||!valid(due)||new Date(week+'T12:00:00Z').getUTCDay()!==1)throw Error('Choisissez un lundi et une date limite valides.');
 const max=new Date(week+'T12:00:00Z');max.setUTCDate(max.getUTCDate()+6);
 if(due>max.toISOString().slice(0,10))throw Error('La date limite doit être dans la semaine demandée.');
 return {p_week:week,p_due:due,p_department:form.reminderDepartment||null};
}
export function reminderResultLabel(value){
 if(!value)return 'Aucun aperçu.';
 return 'À rappeler : '+Number(value.pending||0)
 +' · Disponibilités déjà déclarées : '+Number(value.with_declaration||0)
 +' · Sans compte accessible : '+Number(value.without_account||0)
 +' · Déjà rappelés cette semaine : '+Number(value.already_sent||0)
 +(value.confirmed?' · Notifications internes créées : '+Number(value.sent||0):'');
}
