// Compare Chromium screenshots with SHA-256-verified, owner-reviewed references.
// A Figma frame is not automatically an approved baseline, particularly for a different screen/role.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {PNG} = require('pngjs');
const {buildFeedback,renderHtml} = require('./visual-feedback.cjs');
const output = 'visual-captures';
const baselines = 'visual-baselines';
fs.mkdirSync(output,{recursive:true});
const images=fs.readdirSync(output).filter(name=>/^punch-(S25|iPad|PC)-logged-out\.png$/.test(name)).sort();
const manifestPath=path.join(baselines,'manifest.json');
let manifest={screens:{}};
let manifestError=null;
if (fs.existsSync(manifestPath)) {
  try {
    manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
    if (!manifest || !manifest.screens || typeof manifest.screens!=='object' || Array.isArray(manifest.screens))
      throw new Error('manifest.screens must be an object');
  } catch (error) {
    manifestError=String(error.message);
  }
}
const results=[];
let failures=0;
for (const name of images) {
  const actual=path.join(output,name);
  const expected=path.join(baselines,name);
  const approval=manifest.screens && manifest.screens[name];
  if (manifestError) {
    results.push({image:name,status:'failed',reason:'invalid-baseline-manifest: '+manifestError});
    failures++;
    continue;
  }
  if (!approval) {
    results.push({image:name,status:'awaiting-approved-Figma-baseline',reason:'No owner-approved manifest entry'});
    continue;
  }
  // There must be an explicit approved hash AND an identified Figma node and screen state.
  if (!/^[a-f0-9]{64}$/i.test(String(approval.approvedSha256||'')) ||
      !/^\d+[:-]\d+$/.test(String(approval.figmaNodeId||'')) ||
      approval.screen!=='logged-out' || !approval.approvedBy || !approval.approvedAt) {
    results.push({image:name,status:'failed',reason:'Incomplete approval metadata'});
    failures++;
    continue;
  }
  if (!fs.existsSync(expected)) {
    results.push({image:name,status:'failed',reason:'Approved reference PNG absent'});
    failures++;
    continue;
  }
  try {
    const referenceBytes=fs.readFileSync(expected);
    const hash=crypto.createHash('sha256').update(referenceBytes).digest('hex');
    if (hash.toLowerCase()!==String(approval.approvedSha256).toLowerCase())
      throw new Error('Approved baseline SHA-256 mismatch');
    const reference=PNG.sync.read(referenceBytes);
    const rendered=PNG.sync.read(fs.readFileSync(actual));
    fs.copyFileSync(expected,path.join(output,'reference-'+name));
    if (reference.width!==rendered.width || reference.height!==rendered.height) {
      results.push({image:name,status:'failed',reason:'dimensions',expected:[reference.width,reference.height],actual:[rendered.width,rendered.height]});
      failures++;
      continue;
    }
    const total=reference.width*reference.height;
    let different=0;
    const overlay=new PNG({width:reference.width,height:reference.height});
    for (let i=0;i<total;i++) {
      const k=i*4;
      let delta=0;
      for (let ch=0;ch<4;ch++) delta=Math.max(delta,Math.abs(reference.data[k+ch]-rendered.data[k+ch]));
      if (delta>40) {
        different++;
        overlay.data[k]=255;overlay.data[k+1]=0;overlay.data[k+2]=40;overlay.data[k+3]=255;
      } else {
        overlay.data[k]=rendered.data[k];overlay.data[k+1]=rendered.data[k+1];overlay.data[k+2]=rendered.data[k+2];overlay.data[k+3]=64;
      }
    }
    const ratio=different/total;
    const status=ratio>0.05?'failed':'passed';
    if (status==='failed') {
      failures++;
      fs.writeFileSync(path.join(output,'diff-'+name),PNG.sync.write(overlay));
    }
    results.push({image:name,status,differentPixels:different,totalPixels:total,differentRatio:Number(ratio.toFixed(6)),figmaNodeId:approval.figmaNodeId});
  } catch (error) {
    results.push({image:name,status:'failed',reason:String(error.message)});
    failures++;
  }
}
if (!images.length) {
  results.push({status:'failed',reason:'No actual Chromium screenshots generated'});
  failures++;
}
const audits=[];
for (const device of ['S25','iPad','PC']) {
  const file=path.join(output,'audit-'+device+'.json');
  if (!fs.existsSync(file)) continue;
  try {
    const audit=JSON.parse(fs.readFileSync(file,'utf8'));
    audits.push(audit);
    if (Array.isArray(audit.pageErrors) && audit.pageErrors.length) failures++;
  } catch (error) {
    results.push({status:'failed',reason:'Invalid audit '+device+': '+error.message});
    failures++;
  }
}
const report={
  generatedAt:new Date().toISOString(),
  coverage:'Public logged-out Web only; no Supabase, Stripe, private Figma contents or authenticated screens',
  screenshots:images.length,
  approvedBaselines:results.filter(result=>result.status==='passed'||(result.status==='failed' && result.figmaNodeId)).length,
  failures, results, audits
};
const feedback=buildFeedback(report,audits);
report.feedback=feedback;
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(output,'review.html'),renderHtml(report,feedback));
const lines=[
  '# Work — revue visuelle automatique PUNCH 360°',
  '',
  'Etat : '+feedback.state+'; captures : '+report.screenshots+'; references approuvees comparees : '+report.approvedBaselines+'; echecs : '+failures,
  'Figma (orientation conceptuelle, pas une reference d ecran deconnecte) : '+feedback.figmaBoard,
  '',
  '## Actions classees par priorite',
  ...feedback.issues.map(item=>'- **'+item.priority+' / '+item.device+' / '+item.code+'** : '+item.finding+' Action : '+item.nextStep),
  '',
  '## Limites et protections',
  '- Ouvrir review.html localement depuis l artefact visual-captures pour voir les images et leurs ecarts.',
  '- Comparaisons pixel a pixel UNIQUEMENT si une reference du meme ecran est approuvee dans visual-baselines/manifest.json et que son hash SHA-256 correspond.',
  '- Aucune reference absente n est automatiquement validee. L absence de reference ne prouve pas que le design est conforme.',
  '- Corriger seulement les elements Web visuels touches; aucune modification d auth, RLS, Supabase, roles, Stripe, paie ou production n est autorisee par ce rapport.',
  '- GitHub Actions ne demarre pas une session ChatGPT Work; cette passation est consommee par la prochaine session Work active.',
  '- Les problemes de taille des cibles tactiles sont des heuristiques; verifier dans le vrai parcours avant de modifier.',
  '',
  '## Resultats machine',
  '```json',JSON.stringify(report,null,2),'```'
];
fs.writeFileSync(path.join(output,'WORK_VISUAL_FIX.md'),lines.join('\n')+'\n');
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,[
    '### Punch — revue visuelle automatique',
    '**'+feedback.state+'** · '+report.screenshots+' captures · '+report.approvedBaselines+' references approuvees · '+failures+' echecs.',
    '',
    ...results.map(result=>'- '+(result.image||'capture')+': **'+result.status+'**'+(result.differentRatio!==undefined?' ('+(result.differentRatio*100).toFixed(2)+' % de pixels differents)':'')),
    '',
    '#### Recommandations Work (automatiques, pas des changements appliques)',
    ...feedback.issues.slice(0,20).map(item=>'- **'+item.priority+'** '+item.device+' · '+item.finding+' '+item.nextStep),
    '',
    'Telecharger l artefact `punch-visual-captures` et ouvrir `review.html` pour les captures et le rapport.',
    ''
  ].join('\n'));
}
console.log(JSON.stringify({state:feedback.state,screenshots:report.screenshots,approved:report.approvedBaselines,failures,recommendations:feedback.issues.length},null,2));
if (failures) process.exitCode=1;
