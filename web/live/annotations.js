
import {mountResponsiveWorkspace} from 'https://atelier-projets-jf.juliensav.chatgpt.site/responsive/v1/entry.mjs';
import {createSupportController} from './support.js';
import {createPlatformDirectoryController} from './platform-directory.js';
import {createPlatformAuditController} from './platform-audit.js';
import {createPunchReviewBackend,REVIEW_COMPANY_ID} from './punch-review-data.js';

// Project-specific ID; unrelated to other apps and stable between revisions.
const PROJECT_ID='punch360-12fb1917-94ea-481d-b131-16c58a5bf010';
const STORAGE_KEY=PROJECT_ID+':live-annotations:v1';
const VALID_SCREENS=['support','directory','audit'];
const STATUS_LABELS={todo:'À corriger',progress:'En cours',review:'À vérifier',approved:'Approuvée'};
const SCREEN_LABELS={support:'Support — entreprise',directory:'Super Admin — entreprises',audit:"Super Admin — journal d'audit"};
const $=id=>document.getElementById(id);
const project=createPunchReviewBackend();
const mounts=new Set();
let screen='support',notes=[],annotationMode=false,selectedNote=null,selectedTarget=null,toastTimer=0;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const id=()=>crypto.randomUUID();
function notify(text){
 const box=$('punch-review-toast');if(!box)return;
 clearTimeout(toastTimer);box.textContent=text;box.classList.remove('hidden');
 toastTimer=setTimeout(()=>box.classList.add('hidden'),4400);
}
function safeNotes(payload){
 if(!Array.isArray(payload)||payload.length>250)return [];
 return payload.filter(n=>n&&VALID_SCREENS.includes(n.screen)&&['primary','secondary','web'].includes(n.slot)&&
  typeof n.selector==='string'&&n.selector.length<=350&&
  typeof n.text==='string'&&n.text.length<=2000&&STATUS_LABELS[n.status])
  .map(n=>({id:typeof n.id==='string'?n.id.slice(0,80):id(),screen:n.screen,slot:n.slot,
   selector:n.selector,label:String(n.label||'Élément').slice(0,140),text:n.text,
   status:n.status,createdAt:String(n.createdAt||new Date().toISOString()).slice(0,40)}));
}
function loadNotes(){
 try{return safeNotes(JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'))}
 catch{return []}
}
function saveNotes(){
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(notes));return true}
 catch{notify('Stockage local indisponible. Exporte tes commentaires.');return false}
}
notes=loadNotes();
function screenTitle(view){
 const h=document.createElement('h2');h.className='punch-live-title';
 h.textContent=SCREEN_LABELS[view.screen]+' · données de démonstration';
 return h;
}
function controllerFor(view){
 const redraw=()=>{if(!view.disposed)draw(view)};
 const sb=project.sb;
 if(view.screen==='support')return createSupportController({sb,redraw,escape:esc});
 if(view.screen==='directory')return createPlatformDirectoryController({sb,redraw,escape:esc,
  onArchives:()=>notify('Archives non ouvertes dans cette démonstration.'),
  onPriceCompany:()=>notify('Les tarifs réels ne sont pas modifiés.')});
 return createPlatformAuditController({sb,redraw,escape:esc});
}
function draw(view){
 if(view.disposed)return;
 const root=view.host;root.replaceChildren();
 root.append(screenTitle(view));
 const panel=document.createElement('div');panel.className='punch-live-controls';
 // The controller owns its actual markup and logic. No screenshot or iframe is used.
 panel.innerHTML=view.controller.render();
 root.append(panel);
 root.classList.toggle('punch-annotate-active',annotationMode);
 schedulePins();
}
async function load(view){
 const c=view.controller;
 try{
  if(view.screen==='support')await c.load(REVIEW_COMPANY_ID,false);
  else await c.load();
  if(!view.disposed)draw(view);
 }catch(err){if(!view.disposed){view.host.textContent='Impossible de charger l’écran de démonstration.';notify(err.message)}}
}
function changeScreenFor(view,newScreen){
 if(view.disposed)return;
 view.controller?.reset?.();
 view.screen=newScreen;
 view.controller=controllerFor(view);
 draw(view);
 void load(view);
}
function screenMount(container,slot){
 // The shared Atelier module supplies the content slot, device presets and chrome.
 const host=document.createElement('div');
 host.className='punch-live-screen essential-management';
 host.setAttribute('data-punch-live-root','true');
 host.setAttribute('data-punch-slot',slot);
 const view={slot,container,host,screen,disposed:false,controller:null};
 container.append(host);
 mounts.add(view);
 const onInput=e=>view.controller?.input?.(e.target);
 const onClick=async e=>{
  const element=e.target.closest?.('[data-action]');
  if(!element||!host.contains(element)||view.disposed||annotationMode)return;
  await view.controller?.handle?.(element);
  // All presentation instances share the same synthetic Punch state, not library state.
  mounts.forEach(other=>{if(other!==view&&!other.disposed&&other.screen===view.screen)void load(other)});
 };
 host.addEventListener('input',onInput);
 host.addEventListener('change',onInput);
 host.addEventListener('click',onClick);
 changeScreenFor(view,screen);
 return {
  dispose(){
   if(view.disposed)return;view.disposed=true;view.controller?.reset?.();
   host.removeEventListener('input',onInput);host.removeEventListener('change',onInput);host.removeEventListener('click',onClick);
   mounts.delete(view);host.remove();schedulePins();
  }
 };
}
function setScreen(next){
 if(!VALID_SCREENS.includes(next))return;
 screen=next;
 selectedTarget=null;selectedNote=null;closeNoteForm();
 for(const view of mounts)changeScreenFor(view,next);
 renderNotes();schedulePins();
}
function selectorFor(element,root){
 const value=element.getAttribute('data-action');
 if(value){
  const extra=element.getAttribute('data-id');
  const safe=s=>String(s).replace(/\\/g,'\\\\').replace(/"/g,'\\"');
  return '[data-action="'+safe(value)+'"]'+(extra?'[data-id="'+safe(extra)+'"]':'');
 }
 if(element.id&&window.CSS?.escape)return '#'+CSS.escape(element.id);
 const fragments=[];let el=element;
 while(el&&el!==root&&fragments.length<8){
  const tag=el.tagName.toLowerCase();
  const siblings=[...el.parentElement.children].filter(x=>x.tagName===el.tagName);
  fragments.unshift(tag+':nth-of-type('+(siblings.indexOf(el)+1)+')');el=el.parentElement;
 }
 return fragments.join(' > ');
}
function anchorFor(note){
 const view=[...mounts].find(v=>v.screen===note.screen&&v.slot===note.slot&&!v.disposed);
 if(!view)return null;
 try{return view.host.querySelector(note.selector)}catch{return null}
}
let pinFrame=0;
function schedulePins(){
 if(pinFrame)return;pinFrame=requestAnimationFrame(()=>{pinFrame=0;drawPins()});
}
function drawPins(){
 document.querySelectorAll('.punch-annotation-pin').forEach(x=>x.remove());
 for(const n of notes.filter(x=>x.screen===screen)){
  const target=anchorFor(n);
  if(!target)continue;
  const rect=target.getBoundingClientRect();
  if(!rect.width||!rect.height||rect.bottom<0||rect.top>innerHeight)continue;
  const pin=document.createElement('div');pin.className='punch-annotation-pin';
  pin.textContent=String(notes.filter(x=>x.screen===screen).indexOf(n)+1);
  pin.style.left=Math.max(1,Math.min(innerWidth-27,rect.left-8))+'px';
  pin.style.top=Math.max(1,Math.min(innerHeight-27,rect.top-8))+'px';
  pin.setAttribute('aria-hidden','true');document.body.append(pin);
 }
}
function openNoteForm(note,target=null){
 selectedNote=note;selectedTarget=target;
 const form=$('punch-note-form');form.classList.remove('hidden');
 $('punch-note-target').textContent=note.label+' · '+SCREEN_LABELS[note.screen]+' · '+note.slot;
 $('punch-note-text').value=note.text||'';
 $('punch-note-status').value=note.status||'todo';
 $('punch-note-delete').classList.toggle('hidden',!notes.some(x=>x.id===note.id));
 $('punch-note-text').focus({preventScroll:true});
}
function closeNoteForm(){
 selectedNote=null;selectedTarget=null;$('punch-note-form')?.classList.add('hidden');
 document.querySelectorAll('.punch-review-highlight').forEach(x=>x.classList.remove('punch-review-highlight'));
}
function editNote(note){
 const target=anchorFor(note);if(target)target.classList.add('punch-review-highlight');
 openNoteForm({...note},target);
}
function listNode(note,index){
 const b=document.createElement('button');b.type='button';b.className='punch-note';
 const left=document.createElement('span'),h=document.createElement('strong'),sub=document.createElement('small'),badge=document.createElement('span');
 h.textContent=index+'. '+note.text;sub.textContent=note.label+' · '+note.slot;
 badge.className='punch-note-status';badge.textContent=STATUS_LABELS[note.status];
 left.append(h,sub);b.append(left,badge);b.addEventListener('click',()=>editNote(note));return b;
}
function renderNotes(){
 const current=notes.filter(n=>n.screen===screen),box=$('punch-notes');box.replaceChildren();
 $('review-count').textContent=String(current.length);
 if(!current.length){
  const p=document.createElement('p');p.textContent='Aucune annotation pour cet écran.';box.append(p);
 }else current.forEach((n,index)=>box.append(listNode(n,index+1)));
 schedulePins();
}
function handleAnnotateClick(e){
 if(!annotationMode)return;
 const target=e.target.closest?.('button,input,select,textarea,a,[data-action],label,summary');
 const root=target?.closest?.('[data-punch-live-root]');
 if(!root)return;
 e.preventDefault();e.stopImmediatePropagation();
 const selector=selectorFor(target,root);
 const view=[...mounts].find(v=>v.host===root);
 if(!view)return;
 const label=(target.getAttribute('aria-label')||target.textContent||target.getAttribute('placeholder')||target.tagName).trim().replace(/\s+/g,' ').slice(0,140);
 target.classList.add('punch-review-highlight');
 openNoteForm({id:id(),screen:view.screen,slot:view.slot,selector,label,text:'',status:'todo',createdAt:new Date().toISOString()},target);
}
function mode(enabled){
 annotationMode=!!enabled;
 $('annotate-mode').setAttribute('aria-pressed',String(annotationMode));
 $('punch-mode-hint').textContent=annotationMode?
  'Mode annotation : clique un vrai bouton ou champ. Il ne déclenchera aucune opération pendant ce mode.':
  'Mode interaction : utilise les commandes PUNCH sur les données fictives.';
 mounts.forEach(v=>v.host.classList.toggle('punch-annotate-active',annotationMode));
}
function saveNote(e){
 e.preventDefault();
 if(!selectedNote)return;
 const text=$('punch-note-text').value.trim();
 if(text.length<3)return notify('Décris la correction en au moins trois caractères.');
 const status=$('punch-note-status').value;
 if(!STATUS_LABELS[status])return;
 const n={...selectedNote,text:text.slice(0,2000),status};
 const idx=notes.findIndex(x=>x.id===n.id);
 if(idx>=0)notes[idx]=n;else if(notes.length<250)notes.push(n);else return notify('Limite locale de 250 annotations.');
 const saved=saveNotes();closeNoteForm();renderNotes();
 notify(saved?'Annotation enregistrée dans ce navigateur.':'Annotation non sauvegardée : exporte-la.');
}
function deleteNote(){
 if(!selectedNote||!notes.some(n=>n.id===selectedNote.id))return;
 if(!confirm('Supprimer cette annotation locale ?'))return;
 notes=notes.filter(n=>n.id!==selectedNote.id);saveNotes();closeNoteForm();renderNotes();
}
function exportNotes(){
 const data={format:'punch360-live-annotations',version:1,projectId:PROJECT_ID,
  exportedAt:new Date().toISOString(),warning:'Annotations locales sur les écrans de démonstration, aucune synchronisation Atelier.',notes};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;
 a.download='punch360-annotations-'+new Date().toISOString().slice(0,10)+'.json';
 document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
 notify('Revue exportée. Joins le JSON dans notre chat pour transmettre tes commentaires.');
}
async function importNotes(e){
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>1024*1024)throw Error('Limite de 1 Mo par export.');
  const parsed=JSON.parse(await file.text());
  if(parsed.format!=='punch360-live-annotations'||parsed.version!==1||parsed.projectId!==PROJECT_ID||
     !Array.isArray(parsed.notes)||parsed.notes.length>250)throw Error('Ce fichier ne correspond pas au projet Punch 360.');
  const valid=safeNotes(parsed.notes).map(n=>({...n,id:id()}));
  if(!confirm('Importer '+valid.length+' annotations sans écraser les précédentes ?'))return;
  notes=[...notes,...valid].slice(0,250);saveNotes();renderNotes();
  notify('Annotations importées dans ce navigateur.');
 }catch(err){notify(err.message||'Import impossible.')}
 finally{e.target.value=''}
}
function githubUrl(u){
 try{const x=new URL(u);return x.protocol==='https:'&&x.hostname==='github.com'&&x.pathname.startsWith('/punch360app/Punch360/')?x.href:null}
 catch{return null}
}
async function githubStatus(){
 const target=$('punch-github-status');target.textContent='Actualisation GitHub…';
 try{
  const control=new AbortController(),time=setTimeout(()=>control.abort(),10000);
  const requests=['https://api.github.com/repos/punch360app/Punch360/pulls?state=open&per_page=6',
    'https://api.github.com/repos/punch360app/Punch360/actions/runs?per_page=3'];
  const result=await Promise.all(requests.map(url=>fetch(url,{signal:control.signal,headers:{Accept:'application/vnd.github+json'}})));
  clearTimeout(time);if(result.some(r=>!r.ok))throw Error('GitHub indisponible');
  const prs=await result[0].json(),runs=(await result[1].json()).workflow_runs||[];
  target.replaceChildren();
  const text=document.createElement('span');text.textContent=prs.length+' PR ouvertes · dernier test : ';
  target.append(text);
  const latest=runs[0];if(latest){
   const link=document.createElement('a');link.href=githubUrl(latest.html_url)||'https://github.com/punch360app/Punch360/actions';
   link.target='_blank';link.rel='noopener noreferrer';
   link.textContent=latest.status==='completed'?(latest.conclusion==='success'?'Réussi':latest.conclusion==='failure'?'Échec':'À vérifier'):'En cours';
   target.append(link);
  }else target.append('aucune exécution récente');
 }catch{target.textContent='GitHub indisponible : ouvrir le lien PR GitHub pour le statut réel.'}
}
function bind(){
 $('punch-screen-select').addEventListener('change',e=>setScreen(e.target.value));
 $('annotate-mode').addEventListener('click',()=>mode(!annotationMode));
 $('test-mode').addEventListener('click',()=>{mode(false);closeNoteForm()});
 document.addEventListener('click',handleAnnotateClick,true);
 $('punch-note-form').addEventListener('submit',saveNote);
 $('punch-note-delete').addEventListener('click',deleteNote);
 $('punch-note-cancel').addEventListener('click',closeNoteForm);
 $('review-export').addEventListener('click',exportNotes);
 $('review-import').addEventListener('click',()=>$('review-import-file').click());
 $('review-import-file').addEventListener('change',importNotes);
 $('github-refresh').addEventListener('click',githubStatus);
 const panel=$('punch-review'),reopen=$('punch-review-reopen');
 $('review-toggle').addEventListener('click',()=>{panel.classList.add('hidden');reopen.classList.remove('hidden')});
 reopen.addEventListener('click',()=>{reopen.classList.add('hidden');panel.classList.remove('hidden')});
 window.addEventListener('scroll',schedulePins,true);
 window.addEventListener('resize',schedulePins);
 setInterval(()=>{if(document.visibilityState==='visible')void githubStatus()},180000);
}
bind();renderNotes();void githubStatus();
try{
 const result=await mountResponsiveWorkspace({
  projectId:PROJECT_ID,
  title:'PUNCH 360° — revue responsive',
  renderApp({container,slot}){return screenMount(container,slot||'primary')},
  renderWeb({container}){return screenMount(container,'web')}
 });
 $('punch-preview-boot')?.remove();
 if(!result)console.info('Atelier responsive workspace mounted (no disposable handle).');
}catch(err){
 $('punch-preview-boot').textContent='Impossible de charger l’aperçu partagé Atelier. Réessaie ou consulte les tests GitHub.';
 console.error('Atelier responsive module failed',err);
}
