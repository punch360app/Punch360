const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {PNG}=require('pngjs');
const {compose,createPack,nameFor}=require('./visual-figma-pack.cjs');
function image(width,height,color){
  const p=new PNG({width,height});
  for(let i=0;i<p.data.length;i+=4){
    p.data[i]=color;p.data[i+1]=10;p.data[i+2]=20;p.data[i+3]=255;
  }
  return PNG.sync.write(p);
}
test('contact sheet maintains row/column order and original screenshots',()=>{
  const bytes=Array.from({length:8},(_,i)=>image(3,2,i*20));
  const out=PNG.sync.read(compose(bytes,3,2,2));
  assert.equal(out.width,4*3+5*2);
  assert.equal(out.height,2*2+3*2);
  const pixel=(x,y)=>out.data[(y*out.width+x)*4];
  assert.equal(pixel(2,2),0);
  assert.equal(pixel(7,2),20);
  assert.equal(pixel(2,6),80);
  assert.equal(pixel(0,0),229);
});
test('invalid screenshot dimensions are rejected rather than cropped',()=>{
  const bytes=Array.from({length:8},()=>image(3,2,12));
  bytes[3]=image(2,3,99);
  assert.throws(()=>compose(bytes,3,2,2),/wrong dimensions/);
});
test('24 real screenshots produce exactly three unapproved, digest-tagged contact sheets',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'punch-figma-pack-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const dims={S25:[3,2],iPad:[4,3],PC:[5,3]};
  const results=[];
  for(const [device,[w,h]] of Object.entries(dims)){
    for(const edition of ['construction','essential']){
      for(const state of ['welcome','login','signup','reset']){
        const filename=nameFor(device,edition,state);
        results.push({device,edition,state,image:filename});
        fs.writeFileSync(path.join(dir,filename),image(w,h,results.length));
      }
    }
  }
  fs.writeFileSync(path.join(dir,'functional-journeys.json'),JSON.stringify({visits:24,results}));
  const manifest=createPack(dir,dims);
  assert.equal(manifest.shots,24);
  assert.equal(manifest.sheets.length,3);
  assert.equal(manifest.approval.includes('none'),true);
  assert.equal(manifest.authenticatedFlowsCovered,false);
  for(const sheet of manifest.sheets){
    assert.ok(fs.statSync(path.join(dir,sheet.filename)).size>0);
    assert.equal(sheet.records.length,8);
    assert.ok(sheet.records.every(x=>x.approved===false&&x.figmaNodeId===null&&/^[a-f0-9]{64}$/.test(x.sha256)));
  }
  assert.match(fs.readFileSync(path.join(dir,'FIGMA_HANDOFF.md'),'utf8'),/NON APPROUVE/);
});
test('partial journeys are not silently presented as a complete Figma pack',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'punch-figma-invalid-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.writeFileSync(path.join(dir,'functional-journeys.json'),JSON.stringify({visits:23,results:[]}));
  assert.throws(()=>createPack(dir,{S25:[3,2]}),/exactly 24/);
});
