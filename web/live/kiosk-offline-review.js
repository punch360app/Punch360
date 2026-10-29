import {LOCALE_STRINGS} from './essential-locale.js';

/** Boss/Admin-only review of provisional records. The server owns the decision. */
export function createOfflineReviewController({sb,redraw,escape:e,getLocale=()=> 'fr'}){
 let generation=0;
 const s={company:null,rows:[],error:'',note:'',busy:false,pending:null};
 const t=key=>LOCALE_STRINGS[getLocale()]?.[key]??LOCALE_STRINGS.fr[key]??key;
 const dateLocale=()=>({fr:'fr-CA',en:'en-CA',es:'es-ES',pt:'pt-BR',it:'it-IT',de:'de-DE',ar:'ar',zh:'zh-CN',hi:'hi-IN',tl:'fil-PH'})[getLocale()]||'fr-CA';
 function reset(){generation++;Object.assign(s,{company:null,rows:[],error:'',note:'',busy:false,pending:null})}
 async function refresh(){
  const n=generation,r=await sb.rpc('list_kiosk_offline',{p_company:s.company});
  if(n!==generation)return;
  if(r.error)throw Error('reviewLoadFailed');
  if(!Array.isArray(r.data))throw Error('reviewLoadFailed');
  s.rows=r.data;
  if(s.pending&&!s.rows.some(row=>row.id===s.pending.id&&!row.closed_at))s.pending=null;
 }
 async function load(company){
  reset();s.company=company;
  try{await refresh()}catch{s.error='reviewLoadFailed'}
 }
 const btn=(key,action,id='')=>`<button class="ess-btn" data-action="offreview:${action}" data-id="${e(id)}" ${s.busy?'disabled':''}>${e(t(key))}</button>`;
 const actionNames={in:'reviewEntryIn',out:'reviewEntryOut',break_start:'reviewBreakUnpaid',break_start_paid:'reviewBreakPaid',break_end:'reviewBreakEnd'};
 const statusNames={pending:'reviewPending',approved:'reviewApproved',rejected:'reviewRejected',conflict:'reviewConflict'};
 function render(){
  return `<section class="ess-panel">
   <h2>${e(t('reviewTitle'))}</h2><p>${e(t('reviewHelp'))}</p>
   ${s.error?`<p role="alert">${e(t(s.error))}</p>`:''}
   <label class="ess-field">${e(t('reviewReason'))}<input id="offreview-note" value="${e(s.note)}" maxlength="1000" ${s.pending?'readonly':''}></label>
   ${btn('reviewRefresh','refresh')}
   ${s.rows.map(g=>`<article class="ess-panel"><h3>${e(g.worker)} · ${e(g.device)}</h3>
    ${g.events.map(ev=>`<p><bdi dir="ltr">${e(new Date(ev.at).toLocaleString(dateLocale()))}</bdi> · ${e(t(actionNames[ev.action]||ev.action))} · ${e(t(statusNames[ev.state]||ev.state))}${ev.note?' · '+e(ev.note):''}</p>`).join('')}
    ${!g.closed_at?(s.pending?.id===g.id?
      '<p class="ess-notice" role="status"><strong>'+e(t(s.pending.action==='approve'?'reviewApprove':'reviewReject'))+'</strong> — '+e(g.worker)+' · '+e(g.device)+'</p>'+btn('save','confirm',g.id)+btn('cancel','cancel',g.id):
      btn('reviewApprove','approve',g.id)+btn('reviewReject','reject',g.id)):''}
   </article>`).join('')||`<p>${e(t('reviewEmpty'))}</p>`}
   <p>${e(t('reviewLimit'))}</p>
  </section>`;
 }
 function input(el){if(el.id==='offreview-note')s.note=el.value}
 async function handle(el){
  const raw=el?.dataset?.action;
  if(!raw?.startsWith('offreview:'))return false;
  if(s.busy)return true;
  const action=raw.slice('offreview:'.length);
  if(action==='cancel'){
   s.pending=null;s.error='';redraw();return true;
  }
  if(action==='approve'||action==='reject'){
   const row=s.rows.find(x=>x.id===el.dataset.id&&!x.closed_at);
   if(!row){s.pending=null;s.error='reviewSaveFailed';redraw();return true;}
   if(s.note.trim().length<3){s.pending=null;s.error='reviewReasonRequired';redraw();return true;}
   s.pending={id:row.id,action,note:s.note.trim()};
   s.error='';redraw();return true; // explicit first step; NO write
  }
  if(action!=='refresh'&&action!=='confirm'){
   s.error='reviewSaveFailed';redraw();return true;
  }
  if(action==='confirm'&&(!s.pending||s.pending.id!==el.dataset.id||
    s.note.trim()!==s.pending.note)){
   s.pending=null;s.error='reviewSaveFailed';redraw();return true;
  }
  const n=generation,pending=s.pending;
  s.busy=true;s.error='';redraw(); // disable confirmation while awaiting
  try{
   if(action==='confirm'){
    // Revalidate the current lot after an authoritative read; the RPC owns final approval.
    await refresh();
    if(n!==generation)return true;
    const row=s.rows.find(x=>x.id===pending.id&&!x.closed_at);
    if(!row)throw Error('reviewSaveFailed');
    const r=await sb.rpc('review_kiosk_offline',
     {p_grant:pending.id,p_approve:pending.action==='approve',p_note:pending.note});
    if(r.error)throw Error('reviewSaveFailed');
    if(n===generation){s.pending=null;s.note='';}
   }
   if(n===generation)await refresh();
  }catch(err){
   if(n===generation)s.error=['reviewReasonRequired','reviewLoadFailed','reviewSaveFailed'].includes(err.message)?err.message:'reviewSaveFailed';
  }finally{
   if(n===generation){s.busy=false;redraw();}
  }
  return true;
 }

 return {state:s,load,reset,render,input,handle};
}
