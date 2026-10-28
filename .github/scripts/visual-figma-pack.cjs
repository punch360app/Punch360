// Create Figma-ready evidence sheets from 24 REAL browser screenshots.
// This never writes to Figma and never approves a visual baseline.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {PNG}=require('pngjs');
const devices={S25:[412,915],iPad:[820,1180],PC:[1440,900]};
const editions=['construction','essential'];
const states=['welcome','login','signup','reset'];
const gutter=18;
const out='visual-captures';
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
function nameFor(device,edition,state) {
  return edition==='construction' && state==='welcome'
    ? 'punch-'+device+'-logged-out.png'
    : 'punch-'+device+'-'+edition+'-'+state+'.png';
}
function compose(buffers,width,height,pad=gutter) {
  if(buffers.length!==8) throw new Error('Exactly eight images are required for a contact sheet');
  const sheet=new PNG({width:4*width+5*pad,height:2*height+3*pad});
  // Opaque light gutters make boundaries visible in both light and dark UIs.
  for(let i=0;i<sheet.data.length;i+=4) {
    sheet.data[i]=229;sheet.data[i+1]=233;sheet.data[i+2]=239;sheet.data[i+3]=255;
  }
  buffers.forEach((bytes,i)=>{
    const img=PNG.sync.read(bytes);
    if(img.width!==width || img.height!==height)
      throw new Error('Screenshot '+i+' has wrong dimensions: '+img.width+'x'+img.height);
    const x=pad+(i%4)*(width+pad), y=pad+Math.floor(i/4)*(height+pad);
    for(let row=0;row<height;row++) {
      const src=row*width*4;
      const dst=((y+row)*sheet.width+x)*4;
      img.data.copy(sheet.data,dst,src,src+width*4);
    }
  });
  return PNG.sync.write(sheet);
}
function createPack(folder=out,dimensions=devices) {
  const journeysPath=path.join(folder,'functional-journeys.json');
  if(!fs.existsSync(journeysPath)) throw new Error('Missing functional journeys; cannot build Figma pack');
  const data=JSON.parse(fs.readFileSync(journeysPath,'utf8'));
  if(data.visits!==24 || !Array.isArray(data.results) || data.results.length!==24)
    throw new Error('Figma pack requires exactly 24 actually visited public browser screens');
  const visited=new Map();
  for(const row of data.results) {
    const id=[row.device,row.edition,row.state].join('/');
    const expected=nameFor(row.device,row.edition,row.state);
    if(!dimensions[row.device] || !editions.includes(row.edition) ||
       !states.includes(row.state) || row.image!==expected || visited.has(id))
      throw new Error('Duplicate or unexpected visited UI: '+id);
    visited.set(id,row);
  }
  const sheets=[];
  for(const [device,[width,height]] of Object.entries(dimensions)) {
    const records=[],bytes=[];
    for(const edition of editions) for(const state of states) {
      const id=[device,edition,state].join('/');
      if(!visited.has(id)) throw new Error('Missing visited UI: '+id);
      const filename=nameFor(device,edition,state);
      const content=fs.readFileSync(path.join(folder,filename));
      bytes.push(content);
      records.push({
        edition,state,filename,sha256:sha(content),
        source:'real Chromium browser capture',approved:false,figmaNodeId:null
      });
    }
    const composite=compose(bytes,width,height);
    const file='figma-contact-'+device+'.png';
    fs.writeFileSync(path.join(folder,file),composite);
    sheets.push({
      device,filename:file,sha256:sha(composite),
      width:4*width+5*gutter,height:2*height+3*gutter,
      originalViewport:[width,height],layout:'row 1 Construction, row 2 Essentiel; columns Accueil/Connexion/Inscription/Recuperation',
      records
    });
  }
  const manifest={
    version:1,kind:'visual-evidence-not-approved-design',
    sourceRun:process.env.GITHUB_RUN_ID||null,
    sourceCommit:process.env.GITHUB_SHA||null,
    figmaFile:'https://www.figma.com/design/m3y6yfu7LL84Dp9ntGOXYZ',
    approval:'none; manual matching-screen review required before a baseline can be approved',
    authenticatedFlowsCovered:false,externalNetworkBlocked:true,
    shots:visited.size,sheets
  };
  fs.writeFileSync(path.join(folder,'figma-handoff.json'),JSON.stringify(manifest,null,2)+'\n');
  const lines=[
    '# PUNCH 360 — preuves visuelles pretes a examiner dans Figma',
    '',
    '**NON APPROUVE / aucune synchronisation Figma confirmee.**',
    'Les PNG sont des captures reelles de parcours Web PUBLICS deconnectes, 2 editions x 4 vues x 3 appareils.',
    'Ils ne representent pas les tableaux de bord employe et Super Admin authentifies.',
    '',
    '## Planches generees depuis les 24 PNG originaux',
    ...sheets.map(s=>'- '+s.device+' : '+s.filename+' ('+s.width+' x '+s.height+' px, sha256 '+s.sha256+')'),
    '',
    'Chaque planche range les ecrans Construction sur la premiere ligne et Essentiel sur la deuxieme;',
    'de gauche a droite : Accueil, Connexion, Inscription, Mot de passe oublie.',
    'Le manifest figma-handoff.json liste chaque PNG source et son SHA-256.',
    '',
    '## Travail restant avec Figma',
    '- Importer ces trois PNG dans une page de revue distincte de la maquette de reference (ne jamais ecraser un design approuve).',
    '- Conserver les fichiers PNG sources pour toute comparaison pixel a pixel, jamais la planche composite.',
    '- Associer par ecran/edition/taille une vraie frame Figma destinee au MEME etat.',
    '- Faire approuver la reference par le proprietaire avant tout enregistrement dans visual-baselines/manifest.json.',
    '- Une fois le connecteur Figma accessible, Work peut consommer ces artefacts; GitHub Actions ne peut pas lancer une session Work.',
    '',
    '## Protections',
    '- Ne contient aucun compte connecte, token, Stripe, Supabase, RLS, paie, pointage ni donnee client.',
    '- Un pack d images ne prouve ni fidelite Figma ni bon fonctionnement des parcours connectes.',
    '- Figma n est pas synchronise automatiquement : ce dossier est une passerelle de preuves seulement.',
    ''
  ];
  fs.writeFileSync(path.join(folder,'FIGMA_HANDOFF.md'),lines.join('\n'));
  return manifest;
}
if(require.main===module) {
  try{
    const result=createPack();
    console.log('Figma evidence pack: '+result.shots+' sources / '+result.sheets.length+
      ' composites; no baselines approved.');
  }catch(e){console.error(e);process.exitCode=1;}
}
module.exports={compose,createPack,nameFor};
