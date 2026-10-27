// Dedicated main-only handoff: one GitHub issue, no product mutations.
const fs=require('node:fs');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const path=require('node:path');
const os=require('node:os');
const TITLE='PUNCH 360 — QA visuelle automatique / Work';
const safe=value=>String(value??'').replace(/[\r\n<>]/g,' ').slice(0,260);
function buildIssue(report,context) {
  if(!report || !Array.isArray(report.results) || !report.feedback ||
     !Array.isArray(report.feedback.issues)) throw new Error('Invalid visual report');
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(context.repo))
    throw new Error('Invalid repo');
  if(!/^\d+$/.test(String(context.runId))) throw new Error('Invalid run');
  const findings=report.feedback.issues.map(x=>({
    priority:safe(x.priority),device:safe(x.device),code:safe(x.code),
    finding:safe(x.finding),nextStep:safe(x.nextStep)
  }));
  const data={
    state:report.feedback.state,shots:report.screenshots,
    approved:report.approvedBaselines,failures:report.failures,findings
  };
  const hash=crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  const approved=data.shots>0 && data.approved===data.shots;
  const url='https://github.com/'+context.repo+'/actions/runs/'+context.runId;
  const body=[
    '<!-- punch-visual-handoff:v1 fingerprint='+hash+' -->',
    '# PUNCH 360 : revue visuelle pour Work',
    '',
    '**'+safe(data.state)+'** | '+data.shots+' captures | '+data.approved+
      ' references approuvees | '+data.failures+' echec(s)',
    '',
    approved ? 'Comparaisons autorisees effectuees, verifier les constats et leurs limites.' :
      '**AUCUNE CONFORMITE FIGMA GLOBALE CONFIRMEE : references manquantes ou partielles.**',
    '',
    'Perimetre : ecrans publics deconnectes uniquement; Essentiel et Construction,',
    'accueil, connexion, inscription, recuperation, S25/iPad/PC. Pas de comptes reels.',
    '',
    '## Corrections prioritaires',
    ...(findings.length ? findings.map(x=>
      '- **'+x.priority+' / '+x.device+' / '+x.code+'** : '+x.finding+
      ' Action : '+x.nextStep
    ) : ['- Aucun constat automatique pour ce perimetre.']),
    '',
    '## Preuves et execution',
    '- [Run GitHub Actions]('+url+')',
    '- [Liste des executions](https://github.com/'+context.repo+'/actions/workflows/visual-review.yml)',
    '- Artefact punch-visual-captures : review.html, report.json, WORK_VISUAL_FIX.md, functional-journeys.json.',
    '- Comparer le SHA du run avec le SHA actuel avant toute correction.',
    '',
    '## Protections',
    '- ChatGPT Work ne demarre PAS automatiquement depuis cette issue.',
    '- Corriger sur une branche distincte avec tests et PR verifiee.',
    '- Ne jamais modifier Stripe, Supabase, RLS, pointages, paie, roles ou clients reels.',
    '- Ne jamais auto-approuver une reference visuelle Figma.',
    ''
  ].join('\n');
  return {title:TITLE,body,fingerprint:hash};
}
function gh(args) {
  return cp.execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],
    env:process.env,maxBuffer:1024*1024}).trim();
}
function main() {
  if(!['push','schedule','workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME))
    throw new Error('Forbidden: only trusted main runs');
  if(process.env.GITHUB_REF!=='refs/heads/main') throw new Error('Only main may publish the issue');
  if(!process.env.GH_TOKEN) throw new Error('GitHub token missing');
  const repo=process.env.GITHUB_REPOSITORY;
  const report=JSON.parse(fs.readFileSync('visual-captures/report.json','utf8'));
  const issue=buildIssue(report,{repo,runId:process.env.GITHUB_RUN_ID});
  const all=JSON.parse(gh(['issue','list','--repo',repo,'--state','all','--limit','1000',
    '--json','number,title,body,state']));
  const previous=all.find(x=>x.title===TITLE);
  const tmp=path.join(os.tmpdir(),'punch-visual-'+process.pid+'.md');
  fs.writeFileSync(tmp,issue.body,'utf8');
  try {
    if(!previous) {
      console.log('Visual Work issue created: '+gh(['issue','create','--repo',repo,
        '--title',TITLE,'--body-file',tmp]));
      return;
    }
    if(previous.state==='OPEN' &&
       String(previous.body||'').includes('fingerprint='+issue.fingerprint)) {
      console.log('Visual issue unchanged; avoiding duplicate noise.');
      return;
    }
    if(previous.state!=='OPEN') gh(['issue','reopen',String(previous.number),'--repo',repo]);
    gh(['issue','edit',String(previous.number),'--repo',repo,'--body-file',tmp]);
    console.log('Visual Work issue updated: #'+previous.number);
  } finally {fs.rmSync(tmp,{force:true});}
}
if(require.main===module) {
  try{main();}catch(e){console.error(e.message);process.exitCode=1;}
}
module.exports={buildIssue};
