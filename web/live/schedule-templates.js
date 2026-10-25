/** Templates only copy planning inputs; publication keeps the existing checked engine. */
export function scheduleTemplateConfiguration(form){
 const mode=form.mode;if(!['weekly','rotate2','rotate3'].includes(mode))throw Error('Choisir une récurrence ou une rotation pour enregistrer un modèle.');
 const days=String(form.days||'').split(',').map(x=>Number(x.trim()));
 if(!days.length||days.some(d=>!Number.isInteger(d)||d<1||d>7)||new Set(days).size!==days.length)throw Error('Jours ISO distincts de 1 à 7 requis.');
 const config={mode,days,note:String(form.note||'')};
 for(let week=1;week<=(mode==='weekly'?1:mode==='rotate2'?2:3);week++){
  const suffix=week===1?'':week;for(const part of ['startTime','endTime']){const key=part+suffix,value=String(form[key]||'');if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(value))throw Error('Heures du cycle invalides.');config[key]=value;}
  if(config['startTime'+suffix]===config['endTime'+suffix])throw Error('Début et fin identiques.');
 }
 return config;
}
export function scheduleTemplateForm(template){return {...template.configuration,days:template.configuration.days.join(','),location:template.location_id,department:template.department_id||'',templateName:template.name};}
