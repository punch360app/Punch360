import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

// IDs are stable: adding an unchecked requirement never grants completion evidence.
export function parseMaster(master){
 const sections=[]; const ids=new Set(); let section;
 for(const line of master.split(/\r?\n/)){
  const heading=line.match(/^## (P[0-4]) — (.+?) \(([A-Z]+), \d+ points\)/);
  if(heading){section={priority:heading[1],title:heading[2],code:heading[3],tasks:[]};sections.push(section);}
  const task=line.match(/^- \[[ xX]\] \*\*([A-Z]+-\d{3})\*\* — (.+)$/);
  if(!task)continue;
  if(!section||!task[1].startsWith(section.code+'-'))throw Error('INVALID_MASTER_SECTION: '+task[1]);
  if(ids.has(task[1]))throw Error('DUPLICATE_MASTER_ID: '+task[1]);
  ids.add(task[1]);section.tasks.push({id:task[1],label:task[2]});
 }
 if(!ids.size)throw Error('EMPTY_MASTER');
 return sections.filter(s=>s.tasks.length);
}
export function syncTracker(html,manifest,master){
 const sections=parseMaster(master);
 const match=html.match(/<script type="application\/json" id="dataBundle">([\s\S]*?)<\/script>/);
 if(!match)throw Error('MISSING_DATA_BUNDLE');
 const bundle=JSON.parse(match[1]);
 bundle.sections=sections.map(s=>{const old=bundle.sections.find(x=>x.code===s.code)||{};return {...old,...s,status:old.status||'a_verifier',summary:old.summary||s.title,evidence:old.evidence||'Nouvelle exigence : preuves à vérifier.',requirements:s.tasks.map(t=>t.label),total:s.tasks.length};});
 const total=sections.reduce((n,s)=>n+s.tasks.length,0);
 bundle.total_requirements=total;
 const next=structuredClone(manifest);next.denominator=total;
 // Preserve all historical evidence, including retired IDs; the UI counts active IDs only.
 const active=new Set(sections.flatMap(s=>s.tasks.map(t=>t.id)));
 const records=Object.entries(next.requirements||{}).filter(([id])=>active.has(id)).map(([,r])=>r);
 const documented=records.filter(r=>['partial','verified'].includes(r.developed));
 const tested=documented.filter(r=>r.tested==='software');
 const snapshot={schema_version:1,denominator:total,generated_at:next.generated_at,snapshot_counts:{documented:documented.length,developedTested:tested.length,delivered:tested.filter(r=>r.developed==='verified'&&r.deployed===true&&r.external_required===false).length},activity:next.activity||[]};
 const safe=value=>JSON.stringify(value).replace(/</g,'\\u003c');
 html=html.replace('manifest=await res.json();break;', "const candidate=await res.json();if(candidate.schema_version!==1||candidate.denominator!==validTaskIds.size||!candidate.requirements)throw Error('INVALID_WORK_PROGRESS');manifest=candidate;break;");
 html=html.replace("  if(Object.keys(manifest.requirements).some(id=>!validTaskIds.has(id)))throw Error('UNKNOWN_REQUIREMENT_ID');\n",'');
 html=html.replace(match[0],'<script type="application/json" id="dataBundle">'+safe(bundle)+'</script>');
 html=html.replace(/(<script type="application\/json" id="workProgressSnapshot">)[\s\S]*?(<\/script>)/,(_,a,b)=>a+safe(snapshot)+b);
 html=html.replace(/\d+ exigences\.<br>\d+ lots à suivre\./,total+' exigences.<br>'+sections.length+' lots à suivre.');
 html=html.replace(/(id="navCount">)\d+/, '$1'+total).replace(/— \/ \d+/g,'— / '+total);
 return {html,manifest:next};
}
export function syncFiles(){
 const path='web/live/suivi.html',register='web/live/work-progress.json';
 const result=syncTracker(readFileSync(path,'utf8'),JSON.parse(readFileSync(register,'utf8')),readFileSync('docs/prompt-board/MASTER_PROMPT_20261025.md','utf8'));
 writeFileSync(path,result.html);writeFileSync(register,JSON.stringify(result.manifest,null,2)+'\n');
 console.log('Tracker synchronized:',result.manifest.denominator,'requirements');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)syncFiles();
