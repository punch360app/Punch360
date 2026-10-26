import {readFileSync,writeFileSync} from 'node:fs';
import {parseMaster} from './sync-tracker-master.mjs';

const MASTER='docs/prompt-board/MASTER_PROMPT_20261025.md';
const REGISTER='web/live/work-progress.json';

export function masterIds(master){
 return new Set(parseMaster(master).flatMap(s=>s.tasks.map(t=>t.id)));
}
/** Only explicit, verifiable PR metadata can map a change to requirements. */
export function pullProgressIds(body){
 const matches=[...(body||'').matchAll(/^PUNCH-PROGRESS:\s*([A-Z0-9,;\s-]{1,350})$/gm)];
 return [...new Set(matches.flatMap(m=>m[1].split(/[,;\s]+/).filter(Boolean)))];
}
export function updateWorkRegister(manifest,pull,ciVerified,validIds,now){
 if(!pull?.merged||!Number.isSafeInteger(pull.number)||!pull.merge_commit_sha)
  throw Error('MERGED_PR_REQUIRED');
 if(!validIds.size)throw Error('EMPTY_MASTER');
 const ids=pullProgressIds(pull.body);
 for(const id of ids)if(!validIds.has(id))throw Error('UNKNOWN_PROGRESS_ID: '+id);
 const updated=structuredClone(manifest);
 updated.denominator=validIds.size;
 updated.requirements??={};
 updated.activity??=[];
 const number=pull.number;
 const existing=updated.activity.find(a=>a.number===number);
 if(existing){
  // Re-running the action should not expand evidence or double count a PR.
  if(existing.sha!==pull.merge_commit_sha)throw Error('PR_SHA_CONFLICT');
  return updated;
 }
 for(const id of ids){
  const old=updated.requirements[id]||{};
  updated.requirements[id]={
   ...old,
   developed:old.developed==='verified'?'verified':'partial',
   tested:ciVerified?'software':old.tested||'not_verified',
   deployed:old.deployed===true, // Never assert deployment solely from a PR merge.
   external_required:old.external_required??true,
   pr:[...new Set([...(old.pr||[]),number])],
   note:old.note||'Travail rattaché à la PR #'+number+'. Vérifier la portée, le déploiement et les recettes avant validation complète.'
  };
 }
 updated.activity.unshift({number,sha:pull.merge_commit_sha,ci:ciVerified?'success':'not_verified',ids,title:pull.title||'',merged_at:pull.merged_at||now});
 updated.activity=updated.activity.slice(0,50);
 updated.generated_at=now;
 return updated;
}
async function run(){
 const eventPath=process.env.GITHUB_EVENT_PATH;
 if(!eventPath)return;
 const event=JSON.parse(readFileSync(eventPath,'utf8'));
 const pull=event.pull_request;
 if(!pull?.merged)return;
 const token=process.env.GITHUB_TOKEN,repo=process.env.GITHUB_REPOSITORY;
 if(!token||!/^[-\w]+\/[-\w.]+$/.test(repo||''))throw Error('GITHUB_TOKEN_AND_REPOSITORY_REQUIRED');
 const head=pull.head?.sha;
 if(!/^[a-f0-9]{40}$/.test(head||''))throw Error('INVALID_HEAD_SHA');
 const url='https://api.github.com/repos/'+repo+'/actions/runs?head_sha='+head+'&per_page=100';
 const response=await fetch(url,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
 if(!response.ok)throw Error('CANNOT_VERIFY_CI_'+response.status);
 const runs=(await response.json()).workflow_runs||[];
 const passed=runs.some(r=>r.name==='PUNCH TypeScript'&&r.head_sha===head&&r.status==='completed'&&r.conclusion==='success');
 const master=readFileSync(MASTER,'utf8');
 const manifest=JSON.parse(readFileSync(REGISTER,'utf8'));
 const next=updateWorkRegister(manifest,pull,passed,masterIds(master),new Date().toISOString());
 writeFileSync(REGISTER,JSON.stringify(next,null,2)+'\n');
 console.log('PUNCH progress:',pull.number,'IDs:',pullProgressIds(pull.body),'CI:',passed?'success':'not verified','records:',Object.keys(next.requirements).length);
}
if(process.argv[1]?.endsWith('update-work-progress.mjs')){
 run().catch(e=>{console.error(e);process.exitCode=1;});
}
