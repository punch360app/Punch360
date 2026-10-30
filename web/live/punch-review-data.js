/**
 * Punch-owned, synthetic demonstration data. This adapter never connects to
 * Supabase, never contains customer records, and keeps interactions in Punch.
 * Atelier's responsive workspace only receives live DOM nodes, not the data.
 */
export const REVIEW_COMPANY_ID='punch-preview-company';
export function createPunchReviewBackend(){
 const stamp='2026-10-28T15:00:00Z';
 const company={id:REVIEW_COMPANY_ID,name:'Entreprise de démonstration PUNCH',
  product_edition:'essential',billing_status:'active',effective_billing_status:'active',
  seat_limit:25,is_test:true,active_members:6,disabled_members:0,active_workers:6,
  workers_without_account:1,created_at:stamp,
  entitlement:{features:['horaires','pointage','support']},
  service_controls:{version:1,suspended:false,grace_days:null}};
 const tickets=[{id:'preview-ticket-1',company_id:REVIEW_COMPANY_ID,
  subject:'Aide pour l’horaire de démonstration',status:'open',
  updated_at:stamp,version:1,company_name:company.name,
  messages:[{id:'preview-message-1',is_platform:false,body:'Comment déplacer un quart dans le calendrier ?',
   created_at:stamp}]}];
 const log=[{id:'preview-audit-1',created_at:stamp,action:'preview.company_created',
  actor_id:'utilisateur-fictif',entity_id:REVIEW_COMPANY_ID,detail:{description:'Exemple sans donnée client réelle'}}];
 const response=data=>({data,error:null});
 const fail=(message,code='42501')=>({data:null,error:{message,code}});
 let next=2;
 const sb={async rpc(name,args={}){
  switch(name){
   case 'platform_search_companies':{
    const q=String(args.p_query||'').toLowerCase();
    return response({items:company.name.toLowerCase().includes(q)||!q?[{...company}]:[],has_more:false});}
   case 'platform_company_detail':
    return args.p_company===company.id?response({...company,service_controls:{...company.service_controls}}):fail('Entreprise inconnue');
   case 'platform_set_company_service':{
    if(args.p_company!==company.id||args.p_expected_version!==company.service_controls.version||args.p_confirmation!==company.id)
     return fail('Version ou entreprise invalide');
    company.service_controls={version:company.service_controls.version+1,suspended:!!args.p_suspended,grace_days:args.p_grace_days??null};
    company.effective_billing_status=company.service_controls.suspended?'restricted':'active';
    log.unshift({id:'preview-audit-'+next++,created_at:new Date().toISOString(),action:'preview.service_changed',
     actor_id:'admin-fictif',entity_id:company.id,detail:{demo:true}});
    return response({...company.service_controls,effective_status:company.effective_billing_status});}
   case 'support_list_tickets':
    return response(tickets.slice().sort((a,b)=>b.updated_at.localeCompare(a.updated_at)).map(({messages,...t})=>({...t})));
   case 'support_ticket_detail':{
    const ticket=tickets.find(t=>t.id===args.p_ticket);
    return ticket?response({...ticket,messages:ticket.messages.map(m=>({...m}))}):fail('Ticket inconnu');}
   case 'support_create_ticket':{
    if(args.p_company!==REVIEW_COMPANY_ID)return fail('Compagnie inconnue');
    const id='preview-ticket-'+next++,time=new Date().toISOString();
    tickets.unshift({id,company_id:REVIEW_COMPANY_ID,subject:String(args.p_subject||''),status:'open',
     updated_at:time,version:1,company_name:company.name,
     messages:[{id:'preview-message-'+next++,body:String(args.p_body||''),is_platform:false,created_at:time}]});
    return response(id);}
   case 'support_reply':{
    const t=tickets.find(t=>t.id===args.p_ticket);
    if(!t||t.version!==args.p_expected_version)return fail('Version inconnue');
    const time=new Date().toISOString();t.messages.push({id:'preview-message-'+next++,body:String(args.p_body||''),is_platform:false,created_at:time});
    t.version++;t.updated_at=time;return response(t.version);}
   case 'support_set_status':{
    const t=tickets.find(t=>t.id===args.p_ticket);
    if(!t||t.version!==args.p_expected_version)return fail('Version inconnue');
    t.status=args.p_status;t.version++;t.updated_at=new Date().toISOString();return response(t.version);}
   case 'platform_search_audit':{
    const q=String(args.p_query||'').toLowerCase();return response(log.filter(t=>t.action.toLowerCase().includes(q)).map(x=>({...x}))); }
   default:return fail('RPC non prévue dans la démonstration');
  }
 }};
 return {sb,companyId:REVIEW_COMPANY_ID};
}
