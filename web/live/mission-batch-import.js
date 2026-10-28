// MISSION-012 (partial): bounded, validated CSV-to-draft import on the existing
// manager server RPC. Never automatically publishes, changes time or retries
// uncertain writes. All content stays in memory until explicit confirmation.
const HEADER=['employe','lieu','date','ordre','titre','instructions'];
const MAX_BYTES=65536,MAX_ROWS=50;
const dayPattern=/^\d{4}-\d{2}-\d{2}$/;
const norm=v=>String(v??'').normalize('NFKC').trim().toLocaleLowerCase('fr-CA');
function parseRecords(text,delim){
 const out=[];let row=[],field='',quoted=false,closed=false,started=false;
 const pushField=()=>{row.push(field);field='';closed=false;started=false;};
 const pushRow=()=>{pushField();out.push(row);row=[];};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){
   if(c==='"'){
    if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}
   }else field+=c;
  }else if(c==='"'){
   if(started||closed)throw Error('Guillemets CSV mal placés.');
   quoted=true;started=true;
  }else if(c===delim){pushField();}
  else if(c==='\n'||c==='\r'){
   if(c==='\r'&&text[i+1]==='\n')i++;
   pushRow();
  }else{
   if(closed)throw Error('Texte après une cellule CSV entre guillemets.');
   field+=c;started=true;
  }
 }
 if(quoted)throw Error('Cellule CSV non fermée.');
 if(row.length||field.length||started||closed)pushRow();
 return out.filter(row=>row.some(x=>x.trim()!==''));
}
export function parseMissionDraftCsv(source){
 if(typeof source!=='string'||!source.trim())throw Error('Choisissez un CSV non vide.');
 if(new TextEncoder().encode(source).length>MAX_BYTES)throw Error('CSV trop volumineux : maximum 64 Kio.');
 const text=source.replace(/^\uFEFF/,'');
 // Header names are ASCII; accept comma or semicolon but never guess columns.
 let records;
 for(const separator of [';',',']){
  const attempt=parseRecords(text,separator);
  if(attempt.length&&attempt[0].map(norm).join('|')===HEADER.join('|')){
   records=attempt;break;
  }
 }
 if(!records)throw Error('En-têtes CSV requis : employe;lieu;date;ordre;titre;instructions.');
 if(records.length===1)throw Error('CSV sans mission à importer.');
 if(records.length-1>MAX_ROWS)throw Error('Maximum 50 missions par import.');
 const rows=[];
 for(let i=1;i<records.length;i++){
  if(records[i].length!==HEADER.length)throw Error('Ligne '+(i+1)+' : six colonnes requises.');
  const [employee,site,day,order,title,instructions]=records[i].map(v=>v.trim());
  rows.push({line:i+1,employee,site,day,order,title,instructions});
 }
 return rows;
}
const keyOrder=x=>[x.day,x.workerId,x.order].join('|');
const keyTitle=x=>[x.day,x.workerId,x.siteId,norm(x.title)].join('|');
export function validateMissionDraftRows(rows,{roster,sites,existing,day,sitesComplete=true}={}){
 if(!Array.isArray(rows)||!rows.length||rows.length>MAX_ROWS||
    !Array.isArray(roster)||!Array.isArray(sites)||!Array.isArray(existing)||
    !dayPattern.test(String(day))||!sitesComplete)
  throw Error('Liste, journée ou carnet incomplet : aucune importation autorisée.');
 const activeWorkers=roster.filter(x=>x?.status==='active');
 const activeSites=sites.filter(x=>x?.active);
 const found=[],errors=[],orders=new Set(),titles=new Set();
 for(const m of existing){
  if(!m||m.status==='cancelled'||m.status==='postponed')continue;
  const item={day:m.mission_day,workerId:m.worker_id,siteId:m.site_id,
   order:Number(m.sort_order),title:m.title};
  if(item.day===day){orders.add(keyOrder(item));titles.add(keyTitle(item));}
 }
 for(const row of rows){
  const fail=[];
  const workerMatches=activeWorkers.filter(x=>norm(x.id)===norm(row.employee)||
   norm(x.name)===norm(row.employee));
  const siteMatches=activeSites.filter(x=>norm(x.id)===norm(row.site)||
   norm([x.client_name,x.name,x.city].filter(Boolean).join(' · '))===norm(row.site));
  const worker=workerMatches.length===1?workerMatches[0]:null;
  const site=siteMatches.length===1?siteMatches[0]:null;
  if(!worker)fail.push('Salarié introuvable ou ambigu');
  if(!site)fail.push('Lieu introuvable ou ambigu');
  if(row.day!==day||!dayPattern.test(row.day))fail.push('La journée doit correspondre à celle affichée');
  const order=Number(row.order);
  if(!/^[1-9]\d*$/.test(row.order)||!Number.isInteger(order)||order>999)
   fail.push('Ordre invalide (1 à 999)');
  if(row.title.length<2||row.title.length>140)fail.push('Titre requis (2 à 140 caractères)');
  if(row.instructions.length>500)fail.push('Instructions trop longues (500 caractères maximum)');
  if(!fail.length){
   const item={line:row.line,day:row.day,workerId:worker.id,siteId:site.id,
    order,title:row.title,instructions:row.instructions,
    employee:worker.name,site:site.client_name+' · '+site.name};
   const o=keyOrder(item),t=keyTitle(item);
   if(orders.has(o))fail.push('Rang déjà occupé pour ce salarié et cette journée');
   if(titles.has(t))fail.push('Mission déjà présente pour ce salarié et ce lieu');
   if(!fail.length){orders.add(o);titles.add(t);found.push(item);}
  }
  if(fail.length)errors.push({line:row.line,detail:fail.join('; ')});
 }
 return {valid:errors.length===0&&found.length===rows.length,rows:found,errors,total:rows.length};
}
// The server owns every write; an uncertain error stops immediately. Never
// silently retry a save without reloading the authoritative mission list.
export async function importMissionDraftRows(rows,{beforeEach,save}={}){
 if(!Array.isArray(rows)||!rows.length||rows.length>MAX_ROWS||
    typeof beforeEach!=='function'||typeof save!=='function')
  throw Error('Prévisualisation absente ou invalide.');
 let completed=0;
 for(const row of rows){
  try{
   await beforeEach(row);
   const ack=await save(row);
   if(!ack?.id||ack.status!=='draft'||!Number.isSafeInteger(ack.version)||ack.version<1)
    throw Error('Accusé de brouillon serveur invalide.');
   completed++;
  }catch(e){
   const error=new Error('Import interrompu après '+completed+' brouillon(s) confirmés sur '+rows.length+
    '. Actualisez la journée avant une nouvelle prévisualisation. '+String(e?.message||e));
   error.completed=completed;
   throw error;
  }
 }
 return {completed,total:rows.length};
}
export const MISSION_IMPORT_HEADER=HEADER.join(';');
