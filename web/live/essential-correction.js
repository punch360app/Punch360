/**
 * Essentiel correction requests only target server-fetched sessions for the
 * signed-in employee in the selected company. Local projections are ineligible.
 * Corrections are requests; they do not modify approved hours.
 */
const parsed=value=>typeof value==='string'&&value.length>0&&Number.isFinite(Date.parse(value))?Date.parse(value):null;

export function essentialCorrectionView({companyId,userId,snapshotCompanyId,snapshot,requests=[]}={}){
 const ready=typeof companyId==='string'&&companyId.length>0&&
  typeof userId==='string'&&userId.length>0&&snapshotCompanyId===companyId&&
  Array.isArray(snapshot?.sessions);
 if(!ready)return {ready:false,sessions:[],requests:[]};
 const sessions=snapshot.sessions.filter(session=>
  typeof session?.id==='string'&&session.id.length>0&&
  session.company_id===companyId&&session.user_id===userId&&
  parsed(session.started_at)!==null&&parsed(session.ended_at)!==null&&
  parsed(session.ended_at)>=parsed(session.started_at));
 return {
  ready:true,
  sessions:[...sessions].sort((a,b)=>Date.parse(b.started_at)-Date.parse(a.started_at)),
  requests:Array.isArray(requests)?requests.filter(request=>
   request?.requested_by===userId&&
   (request.company_id==null||request.company_id===companyId)&&
   typeof request.reason==='string').sort((a,b)=>
    (parsed(b.created_at)??0)-(parsed(a.created_at)??0)):[]
 };
}
function parseLocalDateTime(value){
 if(!value)return {ok:true,iso:null};
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return {ok:false,iso:null};
 const date=new Date(value);
 if(!Number.isFinite(date.getTime()))return {ok:false,iso:null};
 const [year,month,day,hour,minute]=value.match(/\d+/g).map(Number);
 // Reject impossible dates and DST gaps rather than silently shifting them.
 if(date.getFullYear()!==year||date.getMonth()+1!==month||date.getDate()!==day||
    date.getHours()!==hour||date.getMinutes()!==minute)return {ok:false,iso:null};
 return {ok:true,iso:date.toISOString()};
}
export function validateEssentialCorrection({view,sessionId,reason,requestedStart='',requestedEnd=''}={}){
 if(!view?.ready)return {ok:false,message:'Relevé serveur indisponible. Synchronisez vos heures avant de demander une correction.'};
 if(!view.sessions?.some(s=>s.id===sessionId))return {ok:false,message:'Choisissez une journée terminée et vérifiée sur le serveur.'};
 const explanation=typeof reason==='string'?reason.trim():'';
 if(explanation.length<3||explanation.length>1000)return {ok:false,message:'Décrivez la correction en 3 à 1 000 caractères.'};
 const start=parseLocalDateTime(requestedStart),end=parseLocalDateTime(requestedEnd);
 if(!start.ok||!end.ok)return {ok:false,message:'Heure locale invalide. Vérifiez la date et l’heure.'};
 if(start.iso&&end.iso&&Date.parse(end.iso)<=Date.parse(start.iso))
  return {ok:false,message:'La nouvelle sortie doit être après la nouvelle entrée.'};
 return {ok:true,reason:explanation,sessionId,requestedStart:start.iso,requestedEnd:end.iso};
}
