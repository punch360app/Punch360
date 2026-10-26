import {encryptArchive,decryptArchive,inspectArchive} from './archive-codec.js';
/** Secrets and decrypted bytes stay in memory; only an AES-GCM envelope is downloaded. */
export function createArchivesController({sb,redraw,escape:e,document:doc=globalThis.document,crypto=globalThis.crypto,companies=()=>[],download=(text,name)=>{const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=doc.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}}){
 let revision=0;const s={company:null,platform:false,busy:false,error:'',notice:'',reason:'',confirmation:'',summary:null,plan:null,files:[],header:null,archive:null,result:null,cleanup:[],restoreRequest:null};
 const rpc=async(name,p)=>{const r=await sb.rpc(name,p);if(r.error)throw Error('Opération serveur refusée. Réessayez ou contactez le support.');return r.data};
 function reset(company=null,platform=false){revision++;Object.assign(s,{company,platform,busy:false,error:'',notice:'',reason:'',confirmation:'',summary:null,plan:null,files:[],header:null,archive:null,result:null,cleanup:[],restoreRequest:null})}
 const input=el=>{if(el.id==='archive-company'){reset(el.value,true);redraw()}if(el.id==='archive-reason')s.reason=el.value;if(el.id==='archive-confirmation')s.confirmation=el.value};
 const btn=(label,action,disabled=false)=>`<button class="ess-btn" data-action="archive:${action}" ${s.busy||disabled?'disabled':''}>${label}</button>`;
 function render(){return `<section class="ess-panel"><h2>Archives et récupération</h2><p>Archive applicative chiffrée des données et PDF privés. Les sauvegardes d’infrastructure sont gérées séparément.</p>${s.platform?`<label class="ess-field">Entreprise<select id="archive-company"><option value="">Choisir</option>${companies().map(c=>`<option value="${e(c.id)}" ${c.id===s.company?'selected':''}>${e(c.name)}${c.is_test?' · TEST':''}</option>`).join('')}</select></label>`:''}<label class="ess-field">Motif<input id="archive-reason" maxlength="1000" value="${e(s.reason)}"></label><label class="ess-field">Mot de passe de l’archive (12 caractères minimum)<input id="archive-password" type="password" autocomplete="off" minlength="12" maxlength="256"></label><p class="ess-fine">Conservez ce mot de passe séparément. Il ne peut pas être récupéré par PUNCH. Les copies serveur expirent après 24 heures; le fichier téléchargé reste sous votre responsabilité.</p>${btn('Télécharger une archive chiffrée complète','export',!s.company)}<hr><label class="ess-field">Archive à vérifier<input id="archive-file" type="file" accept=".punch,.json,application/json"></label>${btn('Déchiffrer et prévisualiser','inspect',!s.company)}${s.error?`<p role="alert">${e(s.error)}</p>`:''}${s.notice?`<p role="status">${e(s.notice)}</p>`:''}${s.summary?`<h3>${e(s.summary.company_name)}</h3><p>${s.summary.rows} lignes · ${s.summary.documents} documents · ${e(new Date(s.summary.exported_at).toLocaleString('fr-CA'))}</p><p>La signature serveur a été vérifiée. Les conflits actuels sont conservés; les salariés récupérés restent désactivés sans compte associé ni droits. Les quarts récupérés sont annulés. Rôles, comptes, paiements, autorisations et conversations restent consultables dans le fichier d’archive et ne sont pas rétablis automatiquement.</p><p>PDF : ${s.files.filter(x=>x.status==='missing').length} manquants, ${s.files.filter(x=>x.status==='conflict').length} conflits.</p>${btn('Récupérer uniquement les PDF manquants','files',!s.files.some(x=>x.status==='missing'))}${s.plan?`<p>Données : ${s.plan.missing} récupérables · ${s.plan.conflicts} conflits conservés · ${s.plan.blocked} références ou règles bloquantes · ${s.plan.policy_skipped} exclusions de sécurité.</p><details><summary>Détail des collections</summary>${s.plan.tables.map(t=>`<p>${e(t.name)} : ${t.restored} récupérables, ${t.conflicts} conflits, ${t.blocked} bloquées</p>`).join('')}</details><label class="ess-field">Confirmer le nom actuel de l’entreprise<input id="archive-confirmation" value="${e(s.confirmation)}" autocomplete="off"></label>${btn('Récupérer uniquement les données manquantes','restore',!s.plan.missing)}${btn('Actualiser la prévisualisation','plan')}`:''}`:''}${s.result?`<p role="status">Récupération confirmée : ${s.result.restored} lignes ajoutées. Les données déjà présentes sont conservées.</p>`:''}${btn('Fermer et supprimer les copies temporaires','close')}${s.busy?'<p role="status">Traitement en cours…</p>':''}</section>`}
 async function handle(el){if(!el.dataset.action?.startsWith('archive:'))return false;if(s.busy)return true;const action=el.dataset.action.slice(8),rev=revision,current=()=>rev===revision;let password=doc?.getElementById('archive-password')?.value||'',file=doc?.getElementById('archive-file')?.files?.[0];const reason=s.reason.trim();s.error='';s.busy=true;
 const active=()=>{if(!current())throw Error('Session modifiée : opération interrompue')};
 const fileCall=async(body)=>{active();const r=await sb.functions.invoke('company-archive-files',{body});active();if(r.error||r.data?.error)throw Error(r.data?.error||'Document inaccessible. Réessayez sans supprimer le fichier local.');return r.data};
 const clean=async(id)=>{try{await rpc('company_export_discard',{p_id:id});if(current())s.cleanup=s.cleanup.filter(x=>x!==id)}catch{if(current())s.notice='Copie serveur encore présente : réessayez Fermer. Expiration sous 24 heures.'}};
 try{
  if(action==='export'){
   if(reason.length<3||password.length<12)throw Error('Motif et mot de passe de 12 caractères requis');
   const header=await rpc('company_export_create',{p_company:s.company,p_request:crypto.randomUUID(),p_reason:reason});active();s.cleanup.push(header.id);
   try{let payload_text='';for(let i=0;i<header.chunks;i++){payload_text+=await rpc('company_export_chunk',{p_id:header.id,p_index:i});active()}
    const p=JSON.parse(payload_text),attachments=[];let total=new TextEncoder().encode(payload_text).length;
    for(const f of p.files){if(!f.exists){if(f.required)throw Error('Un document obligatoire manque sur le serveur');continue}total+=Math.ceil(f.size/3)*4;if(total>95*1024*1024)throw Error('Archive trop volumineuse : export opérateur requis');attachments.push(await fileCall({action:'download',id:header.id,bucket:f.bucket,path:f.path}))}
    const archive={format:'punch-company-archive',version:1,header,payload_text,attachments,include_files:true};await inspectArchive(archive,crypto);const encrypted=await encryptArchive(archive,password,crypto);active();download(encrypted,'PUNCH-'+s.company+'-'+new Date().toISOString().slice(0,10)+'.punch');s.notice='Archive chiffrée téléchargée.';
   }finally{await clean(header.id)}
  }else if(action==='inspect'){
   if(!file||file.size>140*1024*1024||reason.length<3)throw Error('Choisissez une archive et indiquez un motif');
   const archive=await decryptArchive(await file.text(),password,crypto);active();const summary=await inspectArchive(archive,crypto);if(summary.company_id!==s.company)throw Error('Archive d’une autre entreprise');
   const header=await rpc('company_archive_import',{p_payload:archive.payload_text,p_signature:archive.header.signature,p_key:archive.header.key_id,p_reason:reason,p_request:crypto.randomUUID()});active();s.cleanup.push(header.id);s.plan=null;s.archive=archive;s.summary=summary;s.header=header;s.files=[];s.result=null;s.restoreRequest=null;
   for(const f of archive.attachments){const r=await fileCall({action:'preview',id:header.id,bucket:f.bucket,path:f.path,data:f.data,sha256:f.sha256,signature:f.signature});s.files.push({...f,status:r.status})}
   s.plan=await rpc('company_restore_plan',{p_id:header.id});active();
  }else if(action==='files'){
   if(!s.header)throw Error('Prévisualisation requise');
   for(const f of s.files.filter(f=>f.status==='missing')){const r=await fileCall({action:'restore',id:s.header.id,bucket:f.bucket,path:f.path,data:f.data,sha256:f.sha256,signature:f.signature});f.status=r.status}
   s.plan=await rpc('company_restore_plan',{p_id:s.header.id});active();s.notice='Documents traités. Vérifiez la nouvelle prévisualisation avant de récupérer les données.';
  }else if(action==='plan'){s.restoreRequest=null;s.plan=await rpc('company_restore_plan',{p_id:s.header.id});active();
  }else if(action==='restore'){
   if(!s.plan||!s.header||s.confirmation!==s.plan.company_name||reason.length<3)throw Error('Confirmez le nom actuel et indiquez le motif');
   s.restoreRequest??=crypto.randomUUID();const result=await rpc('company_restore_missing',{p_id:s.header.id,p_plan_hash:s.plan.plan_hash,p_confirmation:s.confirmation,p_reason:reason,p_request:s.restoreRequest});active();s.result=result;s.plan=null;s.archive=null;s.files=[];await clean(s.header.id);s.header=null;s.restoreRequest=null;
  }else if(action==='close'){
   // A failed remote discard must never keep decrypted PDF bytes or archive payload
   // in the UI. Retain only opaque temporary copy IDs for a later cleanup retry.
   try{
    if(s.company){const pending=await rpc('company_archive_pending',{p_company:s.company});active();s.cleanup=[...new Set([...s.cleanup,...pending.map(x=>x.id)])]}
    for(const id of [...s.cleanup])await clean(id);
    active();
   }finally{
    if(current()){
     s.archive=null;s.files=[];s.summary=null;s.plan=null;s.header=null;s.result=null;
     s.restoreRequest=null;s.confirmation='';s.reason='';
     if(!s.cleanup.length)reset(s.company,s.platform);
    }
   }
  }
 }catch(err){if(current())s.error=err.message}finally{password='';if(current()){const pw=doc?.getElementById('archive-password');if(pw)pw.value='';s.busy=false;redraw()}}return true;
 }
 return {state:s,reset,input,render,handle};
}
