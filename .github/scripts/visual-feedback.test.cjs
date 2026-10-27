const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {PNG}=require('pngjs');
const {buildFeedback,renderHtml}=require('./visual-feedback.cjs');
const compare=path.join(__dirname,'visual-compare.cjs');
const filename='punch-S25-logged-out.png';
function png(color) {
  const image=new PNG({width:3,height:3});
  for(let i=0;i<image.data.length;i+=4) {
    image.data[i]=color;image.data[i+1]=0;image.data[i+2]=0;image.data[i+3]=255;
  }
  return PNG.sync.write(image);
}
function workspace(t,actualColor,referenceColor,approve) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'punch-visual-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.mkdirSync(path.join(dir,'visual-captures'));
  fs.mkdirSync(path.join(dir,'visual-baselines'));
  fs.writeFileSync(path.join(dir,'visual-captures',filename),png(actualColor));
  if(referenceColor!==undefined) {
    const bytes=png(referenceColor);
    fs.writeFileSync(path.join(dir,'visual-baselines',filename),bytes);
    if(approve) fs.writeFileSync(path.join(dir,'visual-baselines','manifest.json'),JSON.stringify({
      screens:{[filename]:{
        approvedSha256:crypto.createHash('sha256').update(bytes).digest('hex'),
        approvedSource:'capture-reelle-validee',screen:'logged-out',approvedBy:'owner',approvedAt:'2026-10-27'
      }}
    }));
  }
  return dir;
}
function run(dir) {
  const r=spawnSync(process.execPath,[compare],{cwd:dir,encoding:'utf8'});
  return {status:r.status,report:JSON.parse(fs.readFileSync(path.join(dir,'visual-captures','report.json'),'utf8'))};
}
test('missing visual approval never pretends comparison succeeded',t=>{
  const dir=workspace(t,30,30,false);
  const result=run(dir);
  assert.equal(result.status,0);
  assert.equal(result.report.approvedBaselines,0);
  assert.equal(result.report.feedback.state,'awaiting-approved-reference');
  assert.equal(result.report.results[0].status,'awaiting-approved-baseline');
  assert.ok(fs.existsSync(path.join(dir,'visual-captures','review.html')));
});
test('matching explicitly approved screenshot passes',t=>{
  const dir=workspace(t,30,30,true);
  const result=run(dir);
  assert.equal(result.status,0);
  assert.equal(result.report.approvedBaselines,1);
  assert.equal(result.report.results[0].status,'passed');
});
test('mismatching pixels block comparison and create overlay',t=>{
  const dir=workspace(t,250,30,true);
  const result=run(dir);
  assert.equal(result.status,1);
  assert.equal(result.report.results[0].status,'failed');
  assert.ok(fs.existsSync(path.join(dir,'visual-captures','diff-'+filename)));
});
test('tampered approved reference is rejected',t=>{
  const dir=workspace(t,30,30,true);
  fs.writeFileSync(path.join(dir,'visual-baselines',filename),png(50));
  const result=run(dir);
  assert.equal(result.status,1);
  assert.match(result.report.results[0].reason,/SHA-256/);
});
test('audits generate concrete recommendations, never claim correction ran',()=>{
  const report={results:[{image:filename,status:'awaiting-approved-baseline'}],approvedBaselines:0,failures:0,screenshots:1};
  const feedback=buildFeedback(report,[{device:'S25',viewport:{width:412},layout:{overflowPx:24},tapTargets:{smallCount:2},pageErrors:[]}]);
  assert.equal(feedback.state,'awaiting-approved-reference');
  assert.ok(feedback.issues.some(x=>x.code==='horizontal-overflow'));
  assert.ok(feedback.issues.some(x=>x.code==='small-touch-targets'));
  assert.ok(!renderHtml(report,feedback).includes('undefined'));
});
