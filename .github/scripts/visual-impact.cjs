// Risk-scoped VISUAL review only. TypeScript + npm test remain mandatory on PRs.
// This file must fail closed: any unknown change forces all 24 real browser captures.
const fs=require('node:fs');
const SAFE_HELPERS=new Set([
 'web/live/mission-batch-import.js',
 'web/live/mission-recurrence.js',
 'web/live/mission-day-review.js',
 'web/live/mission-offline-queue.js',
 'web/live/mission-completion-request.js'
]);
function classify(paths){
 if(!Array.isArray(paths)||!paths.length)return {mode:'full',reason:'No verified diff'};
 let helper=0;
 for(const raw of paths){
  if(typeof raw!=='string'||!raw.trim()||raw!==raw.trim()||raw.includes('\\')||raw.includes('..'))
   return {mode:'full',reason:'Malformed or ambiguous changed path'};
  if(SAFE_HELPERS.has(raw)){helper++;continue;}
  // Tests and prose never justify skipping actual UI changes. Only narrowly
  // allow them when every OTHER changed path is one of the named pure helpers.
  if(/^tests\/[A-Za-z0-9._/-]+\.test\.mjs$/.test(raw)||
     /^docs\/[A-Za-z0-9._/-]+\.md$/.test(raw)||
     raw==='README.md')continue;
  return {mode:'full',reason:'UI, CSS, shared logic, security or unknown file: '+raw};
 }
 if(!helper)return {mode:'full',reason:'No known pure helper changed'};
 return {mode:'fast',reason:helper+' nonvisual helper file(s); mandatory application tests remain active'};
}
if(require.main===module){
 let paths=[];
 try{paths=fs.readFileSync(process.argv[2],'utf8').split(/\r?\n/).filter(Boolean);}
 catch(error){console.error('No trusted changed-path list; force full:',error.message);}
 const result=classify(paths);
 process.stdout.write(result.mode+'\n');
 console.error('PUNCH visual impact: '+JSON.stringify(result));
}
module.exports={classify,SAFE_HELPERS};
