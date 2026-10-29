
const $=id=>document.getElementById(id),SVG='http://www.w3.org/2000/svg';
const STORE='screens',DB='punch-visual-notes-v1',MAX_IMAGE=12*1024*1024;
const IMAGE_RE=/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i;
const STATUSES={todo:'À corriger',progress:'En cours',review:'À vérifier',approved:'Approuvée'};
const DEVICES={mobile:'Téléphone',tablet:'Tablette / iPad',desktop:'PC'};
let db=null,storageOk=false,screens=[],selectedId=null,viewMode='before',tool='pin',draft=null,toastTimer;
const stamp=()=>new Date().toISOString();
const newId=()=>crypto.randomUUID();
const selected=()=>screens.find(s=>s.id===selectedId);
const clamp=n=>Math.min(1000,Math.max(0,n));
function msg(t){clearTimeout(toastTimer);$('toast').textContent=t;$('toast').classList.remove('hidden');toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),4600)}
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function dbCall(mode,run){return new Promise((resolve,reject)=>{if(!db)return reject(Error('Base locale indisponible'));const tr=db.transaction(STORE,mode),request=run(tr.objectStore(STORE));request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);tr.onerror=()=>reject(tr.error)})}
async function save(row){
 try{if(storageOk)await dbCall('readwrite',s=>s.put(row));else msg('Stockage local indisponible : exporte ta revue avant de fermer')}
 catch{storageOk=false;msg('Stockage saturé ou indisponible. Exporte ta revue pour la conserver.')}
}
async function erase(id){try{if(storageOk)await dbCall('readwrite',s=>s.delete(id))}catch{msg('La suppression locale n’est pas confirmée')}}
function sort(){screens.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)))}
function metrics(){
 $('metric-captures').textContent=screens.length;
 const all=screens.flatMap(s=>s.notes);
 $('metric-notes').textContent=all.filter(n=>n.status!=='approved').length;
 $('nav-count').textContent=all.length;$('mobile-count').textContent=all.length;
 $('screen-count').textContent=screens.length+' écran'+(screens.length>1?'s':'');
}
function update(){
 const s=selected();if(!s)return;s.updatedAt=stamp();sort();void save(s);renderScreens();metrics();
}
function tab(which){
 $('activity-view').classList.toggle('hidden',which!=='activity');
 $('reviews-view').classList.toggle('hidden',which!=='reviews');
 $('page-title').textContent=which==='activity'?'Vue d’ensemble':'Annotations visuelles';
 document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===which);if(b.classList.contains('nav-item'))b.setAttribute('aria-current',b.dataset.tab===which?'page':'false')});
 history.replaceState(null,'',which==='reviews'?'#annotations':location.pathname);
}
async function init(){
 try{db=await openDB();storageOk=true;screens=await dbCall('readonly',s=>s.getAll());sort()}catch{screens=[];msg('Stockage local non disponible. Les exports restent possibles')}
 selectedId=screens[0]?.id||null;renderScreens();metrics();renderEditor()
}
function showModal(){$('capture-form').reset();$('capture-dialog').showModal();$('capture-name').focus()}
function closeModal(){$('capture-dialog').close()}
async function asImage(file){
 if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||!file.size||file.size>MAX_IMAGE)throw Error('Image PNG, JPG ou WebP de 12 Mo maximum requise.');
 const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Lecture de l’image impossible'));reader.readAsDataURL(file)});
 if(typeof data!=='string'||!IMAGE_RE.test(data))throw Error('Format de capture invalide');
 const dims=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve([img.naturalWidth,img.naturalHeight]);img.onerror=()=>reject(Error('Image illisible'));img.src=data});
 if(dims.some(x=>x<30||x>12000))throw Error('Dimensions de la capture incompatibles');
 return {data,name:file.name.slice(0,120),width:dims[0],height:dims[1]}
}
async function createScreen(ev){
 ev.preventDefault();const name=$('capture-name').value.trim(),file=$('capture-file').files[0];
 if(!name||!file)return msg('Ajoute un nom et une capture.');
 const button=$('create-screen');button.disabled=true;
 try{const image=await asImage(file),s={id:newId(),name:name.slice(0,100),device:$('capture-device').value,before:image,after:null,notes:[],createdAt:stamp(),updatedAt:stamp()};
 screens.unshift(s);selectedId=s.id;viewMode='before';draft=null;await save(s);
 metrics();renderScreens();renderEditor();tab('reviews');closeModal();msg('Capture ajoutée. Dessine une annotation sur l’image.')}
 catch(e){msg(e.message||'Capture impossible')}finally{button.disabled=false}
}
function renderScreens(){
 const pane=$('screens-list');pane.replaceChildren();
 if(!screens.length){const p=document.createElement('p');p.className='notes-empty';p.textContent='Aucune capture pour le moment.';pane.append(p);return}
 for(const s of screens){
  const b=document.createElement('button');b.type='button';b.className='screen-row'+(s.id===selectedId?' active':'');b.setAttribute('aria-pressed',String(s.id===selectedId));
  const thumb=document.createElement('span');thumb.className='screen-thumb';const img=new Image();img.alt='';img.src=s.before.data;thumb.append(img);
  const body=document.createElement('span'),name=document.createElement('strong'),dev=document.createElement('small');
  name.textContent=s.name;dev.textContent=DEVICES[s.device]||'Capture';body.append(name,dev);
  const count=document.createElement('span');count.className='screen-badge';count.textContent=s.notes.length;
  b.append(thumb,body,count);b.addEventListener('click',()=>{selectedId=s.id;viewMode='before';draft=null;renderScreens();renderEditor()});pane.append(b)
 }
}
function view(which){viewMode=which;draft=null;renderEditor()}
function renderEditor(){
 const s=selected();$('empty-editor').classList.toggle('hidden',!!s);$('editor-content').classList.toggle('hidden',!s);if(!s)return;
 $('selected-title').textContent=s.name;$('selected-device').textContent=(DEVICES[s.device]||'CAPTURE').toUpperCase();
 $('selected-meta').textContent='Ajouté le '+new Date(s.createdAt).toLocaleDateString('fr-CA')+' · '+s.before.width+' × '+s.before.height+' px';
 $('annotation-count').textContent=s.notes.length+' annotation'+(s.notes.length>1?'s':'');$('notes-tally').textContent=s.notes.length;
 $('add-after').textContent=s.after?'↻ Remplacer « Après »':'+ Image « Après »';
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===viewMode));
 document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
 $('tools-strip').classList.toggle('hidden',viewMode==='compare'||(viewMode==='after'&&!s.after));
 drawScreens();drawNotes();if(draft)editPanel(draft);else $('note-editor').classList.add('hidden')
}
function drawScreens(){
 const area=$('image-area'),s=selected();area.replaceChildren();if(!s)return;
 if(viewMode==='compare'){const cols=document.createElement('div');cols.className='compare-layout';cols.append(imageColumn(s,'before',true),imageColumn(s,'after',true));area.append(cols)}
 else if(viewMode==='after'&&!s.after){
  const box=document.createElement('div'),text=document.createElement('div'),btn=document.createElement('button');box.className='compare-placeholder';text.textContent='Pas encore de capture Après.';btn.type='button';btn.className='btn btn-dark';btn.textContent='Ajouter une capture Après';btn.addEventListener('click',()=>$('after-file').click());box.append(text,btn);area.append(box)
 }else area.append(imageColumn(s,viewMode,false));
}
function svgElement(tag,attributes={},text=null){
 const el=document.createElementNS(SVG,tag);for(const [name,val] of Object.entries(attributes))el.setAttribute(name,String(val));if(text!==null)el.textContent=String(text);return el
}
function imageColumn(s,side,readonly){
 const col=document.createElement('div'),cap=document.createElement('div');col.className='image-col';cap.className='image-caption';cap.textContent=side==='before'?'AVANT · ORIGINAL':'APRÈS · COMPARAISON';col.append(cap);
 if(!s[side]){const missing=document.createElement('div');missing.className='compare-placeholder';missing.textContent='Ajoute une capture Après pour comparer les deux versions.';col.append(missing);return col}
 const frame=document.createElement('div'),image=new Image(),svg=svgElement('svg',{viewBox:'0 0 1000 1000',preserveAspectRatio:'none',role:'img','aria-label':'Annotations de cette capture'});
 frame.className='image-frame'+(readonly?' readonly':'');image.src=s[side].data;image.alt=s.name+', '+side;image.draggable=false;
 frame.append(image,svg);col.append(frame);refreshSvg(svg,s,side);if(!readonly)enableDrawing(svg,s,side);return col
}
function refreshSvg(svg,s,side,ghost=null){
 svg.replaceChildren();
 s.notes.forEach((n,index)=>{if(n.side===side)shape(svg,n,index+1,Boolean(draft&&draft.id===n.id),true)});
 if(ghost)shape(svg,ghost,s.notes.length+1,true,false)
}
function shape(svg,n,index,active,interactive){
 const g=svgElement('g'),color=active?'#e5a447':'#487b4b';
 if(interactive){g.classList.add('mark-clickable');g.setAttribute('role','button');g.setAttribute('tabindex','0');g.setAttribute('aria-label','Annotation '+index);
  g.addEventListener('pointerdown',ev=>ev.stopPropagation());g.addEventListener('click',ev=>{ev.stopPropagation();editExisting(n.id)});
  g.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();editExisting(n.id)}})}
 if(n.kind==='rect'){
  const r=svgElement('rect',{x:Math.min(n.x1,n.x2),y:Math.min(n.y1,n.y2),width:Math.max(8,Math.abs(n.x2-n.x1)),height:Math.max(8,Math.abs(n.y2-n.y1)),rx:8,class:'mark-rect'});
  if(active)r.classList.add('mark-selected');g.append(r)
 }else if(n.kind==='arrow'){
  const line=svgElement('line',{x1:n.x1,y1:n.y1,x2:n.x2,y2:n.y2,class:'mark-line'});if(active)line.classList.add('mark-selected');g.append(line);
  const angle=Math.atan2(n.y2-n.y1,n.x2-n.x1),len=33;
  const points=[[n.x2,n.y2],[n.x2-len*Math.cos(angle-.5),n.y2-len*Math.sin(angle-.5)],[n.x2-len*Math.cos(angle+.5),n.y2-len*Math.sin(angle+.5)]];
  g.append(svgElement('polygon',{points:points.map(p=>p.join(',')).join(' '),fill:color}))
 }
 const x=n.kind==='pin'?n.x1:n.x2,y=n.kind==='pin'?n.y1:n.y2;
 const circle=svgElement('circle',{cx:x,cy:y,r:28,class:'mark-circle'});if(active)circle.classList.add('mark-selected');
 g.append(circle,svgElement('text',{x,y:y+1,class:'mark-number'},index));svg.append(g)
}
function point(ev,svg){const r=svg.getBoundingClientRect();return {x:Math.round(clamp((ev.clientX-r.left)/r.width*1000)),y:Math.round(clamp((ev.clientY-r.top)/r.height*1000))}}
function enableDrawing(svg,s,side){
 let drag=null;
 svg.addEventListener('pointerdown',ev=>{if(ev.button!==0||draft)return;const p=point(ev,svg);drag={id:newId(),side,kind:tool,x1:p.x,y1:p.y,x2:p.x,y2:p.y,text:'',status:'todo',createdAt:stamp()};svg.setPointerCapture?.(ev.pointerId);ev.preventDefault();refreshSvg(svg,s,side,drag)});
 svg.addEventListener('pointermove',ev=>{if(!drag)return;const p=point(ev,svg);drag.x2=p.x;drag.y2=p.y;refreshSvg(svg,s,side,drag)});
 svg.addEventListener('pointerup',ev=>{
  if(!drag)return;const p=point(ev,svg);drag.x2=p.x;drag.y2=p.y;
  if(drag.kind==='pin'){drag.x2=drag.x1;drag.y2=drag.y1}
  else if(Math.abs(drag.x2-drag.x1)<20&&Math.abs(drag.y2-drag.y1)<20){drag.x2=clamp(drag.x1+120);drag.y2=clamp(drag.y1+90)}
  draft=drag;drag=null;refreshSvg(svg,s,side,draft);editPanel(draft);$('note-editor').scrollIntoView({behavior:'smooth',block:'nearest'});
 });
 svg.addEventListener('pointercancel',()=>{drag=null;refreshSvg(svg,s,side,draft?.side===side?draft:null)})
}
function drawNotes(){
 const pane=$('notes-list'),s=selected();pane.replaceChildren();if(!s)return;
 if(!s.notes.length){const p=document.createElement('p');p.className='notes-empty';p.textContent='Aucune remarque. Utilise Repère, Zone ou Flèche sur la capture.';pane.append(p);return}
 s.notes.forEach((n,i)=>{
  const b=document.createElement('button'),head=document.createElement('div'),number=document.createElement('span'),label=document.createElement('span'),status=document.createElement('span'),p=document.createElement('p');
  b.type='button';b.className='note-card'+(draft?.id===n.id?' active':'');head.className='note-head';
  number.className='note-number';number.textContent=i+1;label.className='note-label';label.textContent=n.side==='after'?'APRÈS':'AVANT';
  status.className='note-status '+n.status;status.textContent=STATUSES[n.status]||STATUSES.todo;p.textContent=n.text;
  head.append(number,label,status);b.append(head,p);b.addEventListener('click',()=>editExisting(n.id));pane.append(b)
 })
}
function editExisting(id){const n=selected()?.notes.find(x=>x.id===id);if(!n)return;if(viewMode!==n.side){viewMode=n.side;renderEditor()}draft={...n};editPanel(draft);drawNotes()}
function editPanel(n){
 $('note-editor').classList.remove('hidden');
 const exists=selected()?.notes.some(x=>x.id===n.id);
 $('note-editor-title').textContent=exists?'Modifier l’annotation':'Nouvelle annotation';
 $('note-text').value=n.text||'';$('note-status').value=n.status||'todo';$('remove-note').classList.toggle('hidden',!exists);
 $('note-text').focus({preventScroll:true})
}
function closeNote(){draft=null;$('note-editor').classList.add('hidden');drawNotes();drawScreens()}
function saveNote(){
 if(!draft||!selected())return;
 const text=$('note-text').value.trim();if(text.length<3)return msg('Explique la correction en au moins trois caractères.');
 const s=selected(),n={...draft,text:text.slice(0,2000),status:STATUSES[$('note-status').value]?$('note-status').value:'todo',updatedAt:stamp()};
 const index=s.notes.findIndex(x=>x.id===n.id);if(index>=0)s.notes[index]=n;else s.notes.push(n);
 draft=null;update();renderEditor();msg('Annotation enregistrée sur cet appareil.')
}
function deleteNote(){
 if(!draft||!selected()||!confirm('Supprimer cette annotation ?'))return;
 selected().notes=selected().notes.filter(n=>n.id!==draft.id);draft=null;update();renderEditor();msg('Annotation supprimée')
}
async function addAfter(ev){
 const s=selected(),file=ev.target.files?.[0];if(!s||!file)return;
 try{const img=await asImage(file);if(s.after&&!confirm('Remplacer l’image Après ? Les repères existants restent aux mêmes positions relatives.'))return;
  s.after=img;viewMode='compare';draft=null;update();renderEditor();msg('Capture Après ajoutée')
 }catch(e){msg(e.message||'Import impossible')}finally{ev.target.value=''}
}
async function removeScreen(){
 const s=selected();if(!s||!confirm('Supprimer « '+s.name+' » et toutes ses notes sur cet appareil ?'))return;
 screens=screens.filter(x=>x.id!==s.id);await erase(s.id);selectedId=screens[0]?.id||null;draft=null;viewMode='before';renderScreens();metrics();renderEditor();msg('Capture supprimée localement')
}
function exportReview(){
 if(!screens.length)return msg('Ajoute une capture avant d’exporter.');
 const file={format:'punch360-annotation-review',version:1,exportedAt:stamp(),
  warning:'Cet export contient des captures et des commentaires ; aucun envoi automatique à Atelier.',screens};
 const blob=new Blob([JSON.stringify(file,null,2)],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='punch360-revue-'+stamp().slice(0,10)+'.json';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
 msg('Revue exportée. Joins le fichier JSON dans ce chat pour transmettre tes notes.')
}
function validateScreen(s){
 if(!s||typeof s.name!=='string'||!s.name.trim()||s.name.length>100||
  !['mobile','tablet','desktop'].includes(s.device)||!Array.isArray(s.notes)||s.notes.length>500)
  throw Error('Contenu de capture invalide.');
 const validImage=x=>!x||typeof x==='object'&&typeof x.data==='string'&&x.data.length<MAX_IMAGE*1.4&&IMAGE_RE.test(x.data)&&Number.isInteger(x.width)&&x.width>=30&&x.width<=12000&&Number.isInteger(x.height)&&x.height>=30&&x.height<=12000;
 if(!s.before||!validImage(s.before)||!validImage(s.after))throw Error('Image non reconnue dans le fichier.');
 const notes=s.notes.map(n=>{
  if(!n||!['pin','rect','arrow'].includes(n.kind)||!['before','after'].includes(n.side)||!STATUSES[n.status]||
   typeof n.text!=='string'||n.text.length>2000||!['x1','x2','y1','y2'].every(k=>typeof n[k]==='number'&&Number.isFinite(n[k])&&n[k]>=0&&n[k]<=1000))
   throw Error('Annotation non reconnue.');
  return {id:newId(),kind:n.kind,side:n.side,text:n.text,status:n.status,x1:n.x1,x2:n.x2,y1:n.y1,y2:n.y2,createdAt:stamp(),updatedAt:stamp()}
 });
 const img=x=>x?{data:x.data,name:String(x.name||'capture').slice(0,120),width:x.width,height:x.height}:null;
 return {id:newId(),name:s.name,device:s.device,before:img(s.before),after:img(s.after),notes,createdAt:stamp(),updatedAt:stamp()}
}
async function importReview(ev){
 const file=ev.target.files?.[0];if(!file)return;
 try{
  if(file.size>60*1024*1024)throw Error('Fichier trop grand (60 Mo maximum).');
  const body=JSON.parse(await file.text());
  if(body.format!=='punch360-annotation-review'||body.version!==1||!Array.isArray(body.screens)||
   body.screens.length>50||body.screens.length===0)throw Error('Ce fichier n’est pas un export Punch 360 reconnu.');
  const items=body.screens.map(validateScreen);
  if(!confirm('Importer '+items.length+' capture(s) sans écraser les anciennes ?'))return;
  screens.unshift(...items);sort();for(const s of items)await save(s);
  selectedId=items[0].id;viewMode='before';draft=null;metrics();renderScreens();renderEditor();tab('reviews');
  msg(items.length+' capture(s) importée(s) localement.')
 }catch(e){msg(e.message||'Import impossible')}finally{ev.target.value=''}
}
const API='https://api.github.com/repos/punch360app/Punch360';
function validLink(value){
 try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='github.com'&&u.pathname.startsWith('/punch360app/Punch360/')?u.href:'https://github.com/punch360app/Punch360'}catch{return 'https://github.com/punch360app/Punch360'}
}
function dateLabel(v){return v?new Date(v).toLocaleString('fr-CA',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'Date inconnue'}
function feed(icon,title,subtitle,url,status,kind=''){
 const line=document.createElement('div');line.className='feed-row';
 const symbol=document.createElement('span');symbol.className='feed-icon '+kind;symbol.textContent=icon;
 const text=document.createElement('div');text.className='feed-text';
 const a=document.createElement('a');a.className='feed-title';a.textContent=title;a.href=validLink(url);a.target='_blank';a.rel='noopener noreferrer';
 const sub=document.createElement('div');sub.className='feed-sub';sub.textContent=subtitle;
 const tag=document.createElement('span');tag.className='feed-status'+(status==='Échec'?' bad':'');tag.textContent=status;
 text.append(a,sub);line.append(symbol,text,tag);return line
}
async function readGitHub(route){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),11000);
 try{const response=await fetch(API+route,{signal:controller.signal,headers:{Accept:'application/vnd.github+json'},cache:'no-store'});
  if(!response.ok)throw Error('GitHub indisponible');return await response.json()
 }finally{clearTimeout(timeout)}
}
let loadingGitHub=false;
async function refreshGithub(){
 if(loadingGitHub)return;loadingGitHub=true;$('refresh-github').disabled=true;
 const [prs,runs]=await Promise.allSettled([readGitHub('/pulls?state=open&per_page=8'),readGitHub('/actions/runs?per_page=8')]);
 if(prs.status==='fulfilled'){
  const list=prs.value;$('metric-pr').textContent=list.length===8?'8+':list.length;$('metric-pr-sub').textContent='Demandes en cours · GitHub public';
  $('prs-list').replaceChildren();if(!list.length)$('prs-list').textContent='Aucune PR ouverte.';
  list.forEach(p=>$('prs-list').append(feed('#','#'+p.number+' · '+p.title,dateLabel(p.updated_at),p.html_url,p.draft?'Brouillon':'Ouverte','orange')))
 }else{$('metric-pr').textContent='—';$('metric-pr-sub').textContent='Non disponible';$('prs-list').textContent='GitHub ne répond pas. Ouvre le lien « Toutes les PR ».'}
 if(runs.status==='fulfilled'){
  const list=runs.value.workflow_runs||[],recent=list[0];
  const verdict=r=>r.status!=='completed'?'En cours':r.conclusion==='success'?'Réussi':r.conclusion==='failure'?'Échec':r.conclusion==='cancelled'?'Annulé':'À vérifier';
  $('metric-workflow').textContent=recent?verdict(recent):'—';$('metric-workflow-sub').textContent=recent?.name||'Aucun workflow récent';
  $('runs-list').replaceChildren();if(!list.length)$('runs-list').textContent='Aucun test récent.';
  list.slice(0,6).forEach(r=>$('runs-list').append(feed(verdict(r)==='Réussi'?'✓':verdict(r)==='Échec'?'!':'◷',
    r.name||'Workflow',(r.head_branch||'main')+' · '+dateLabel(r.created_at),r.html_url,verdict(r),verdict(r)==='Réussi'?'':'purple')))
 }else{$('metric-workflow').textContent='—';$('metric-workflow-sub').textContent='Non disponible';$('runs-list').textContent='GitHub ne répond pas. Ouvre le lien « Tous les tests ».'}
 $('last-sync').textContent='Consultation GitHub : '+new Date().toLocaleTimeString('fr-CA',{hour:'2-digit',minute:'2-digit'})+
  ' · actualisation toutes les 3 minutes environ. Tes annotations ne sont pas synchronisées.';
 loadingGitHub=false;$('refresh-github').disabled=false
}
function bind(){
 document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>tab(b.dataset.tab)));
 [$('new-capture-top'),$('empty-add'),$('add-screen')].forEach(b=>b.addEventListener('click',showModal));
 $('hero-annotate').addEventListener('click',()=>{tab('reviews');if(!screens.length)showModal()});
 [$('close-dialog'),$('cancel-dialog')].forEach(b=>b.addEventListener('click',closeModal));
 $('capture-dialog').addEventListener('click',ev=>{if(ev.target===$('capture-dialog'))closeModal()});
 $('capture-form').addEventListener('submit',createScreen);
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>view(b.dataset.view)));
 document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{tool=b.dataset.tool;draft=null;renderEditor()}));
 $('add-after').addEventListener('click',()=>$('after-file').click());
 $('after-file').addEventListener('change',addAfter);
 $('delete-screen').addEventListener('click',removeScreen);
 $('save-note').addEventListener('click',saveNote);$('remove-note').addEventListener('click',deleteNote);
 [$('cancel-note'),$('close-note')].forEach(b=>b.addEventListener('click',closeNote));
 $('export-button').addEventListener('click',exportReview);
 $('import-button').addEventListener('click',()=>$('import-file').click());
 $('import-file').addEventListener('change',importReview);
 $('refresh-github').addEventListener('click',refreshGithub);
 document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&draft&&!$('capture-dialog').open)closeNote()});
 setInterval(()=>{if(document.visibilityState==='visible')void refreshGithub()},180000)
}
bind();tab(location.hash==='#annotations'?'reviews':'activity');void init();void refreshGithub();
