// Deterministic, read-only recommendations from isolated visual CI.
// No LLM calls, production accounts, or automatic changes to product code.
function buildFeedback(report, audits) {
  const items = [];
  const add = (priority, code, device, finding, nextStep) =>
    items.push({priority, code, device, finding, nextStep});
  for (const result of report.results) {
    if (!result.image) continue;
    if (result.status === 'awaiting-approved-baseline') {
      add('P2', 'reference-pending', result.image,
        'Aucune image de reference approuvee pour cet ecran.',
        'Faire approuver une capture du MEME ecran et du MEME etat, puis enregistrer son PNG et son SHA-256 dans visual-baselines/manifest.json.');
    } else if (result.status === 'failed') {
      add('P1', 'visual-regression', result.image,
        'Ecart visuel mesure : '+(result.differentRatio === undefined ? (result.reason || 'comparaison impossible') : (result.differentRatio * 100).toFixed(2)+' % des pixels.'),
        'Ouvrir capture, reference et diff; corriger uniquement le rendu Web, sans toucher aux permissions, a la facturation ou au serveur.');
    }
  }
  for (const audit of audits) {
    const device = audit.device || 'unknown';
    if (audit.pageErrors && audit.pageErrors.length) {
      add('P1', 'runtime-error', device,
        audit.pageErrors.length+' erreur(s) JavaScript pendant le chargement.',
        'Corriger les erreurs visibles dans audit-'+device+'.json avant de valider le rendu.');
    }
    if (audit.layout && audit.layout.overflowPx > 3) {
      add('P2', 'horizontal-overflow', device,
        'Debordement horizontal de '+audit.layout.overflowPx+' px.',
        'Verifier les conteneurs responsives, le scroll lateral involontaire et les marges a cette largeur.');
    }
    if (audit.tapTargets && audit.tapTargets.smallCount > 0 && audit.viewport && audit.viewport.width < 900) {
      add('P3', 'small-touch-targets', device,
        audit.tapTargets.smallCount+' cible(s) tactiles visibles inferieures a 44 x 44 px (heuristique).',
        'Revoir seulement les boutons importants et leur zone tactile; ne pas modifier la logique de leurs actions.');
    }
  }
  const order = {P1:0, P2:1, P3:2};
  items.sort((a,b)=>(order[a.priority]-order[b.priority]) || a.device.localeCompare(b.device) || a.code.localeCompare(b.code));
  return {
    state: report.failures ? 'failed' : report.approvedBaselines ? 'checked' : 'awaiting-approved-reference',
    automated: true,
    disclaimer: 'Constats deterministes sur des ecrans publics deconnectes seulement; pas une validation UX humaine, ni une correction Work lancee.',
    issues: items
  };
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function renderHtml(report, feedback) {
  const screenshots = report.results.filter(r=>r.image && /^[a-zA-Z0-9_.-]+\.png$/.test(r.image));
  const labels = {
    passed:'Comparee : OK', failed:'Ecart a corriger',
    'awaiting-approved-baseline':'Reference a approuver'
  };
  const panels=screenshots.map(result=>{
    const name=escapeHtml(result.image);
    const refName=escapeHtml('reference-'+result.image);
    const diffName=escapeHtml('diff-'+result.image);
    return '<section class="shot"><h2>'+name+'</h2><p>'+escapeHtml(labels[result.status]||result.status)+'</p><div class="imgs"><figure><img src="'+name+'" alt="Capture reelle '+name+'"><figcaption>Capture Chromium reelle</figcaption></figure>'+
      (result.status!=='awaiting-approved-baseline' && result.reason!=='dimensions'
        ? '<figure><img src="'+refName+'" alt="Reference approuvee"><figcaption>Reference approuvee</figcaption></figure>' : '')+
      (result.status==='failed' && result.differentRatio!==undefined
        ? '<figure><img src="'+diffName+'" alt="Ecarts de pixels"><figcaption>Differences</figcaption></figure>' : '')+
      '</div></section>';
  }).join('');
  const recommendations=feedback.issues.map(item=>'<li><strong>'+escapeHtml(item.priority)+' · '+escapeHtml(item.device)+' · '+escapeHtml(item.code)+'</strong><p>'+escapeHtml(item.finding)+'</p><p>'+escapeHtml(item.nextStep)+'</p></li>').join('');
  return '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
    '<title>PUNCH — revue visuelle CI</title><style>body{font:16px system-ui,sans-serif;background:#f5f7f9;color:#152331;margin:0;padding:24px}main{max-width:1320px;margin:auto}a{color:#1456b8}section{background:white;border:1px solid #d9e1e8;border-radius:12px;padding:18px;margin:18px 0}h1{font-size:26px}h2{font-size:19px}.imgs{display:flex;flex-wrap:wrap;gap:18px}figure{margin:0;max-width:400px;flex:1 1 260px}img{display:block;width:100%;height:auto;border:1px solid #ccd4dd}figcaption{font-size:13px;margin:8px 0}li{margin:12px 0}li p{margin:5px 0}</style>'+
    '<main><h1>PUNCH 360° — revue visuelle automatique</h1><p>Etat : <strong>'+escapeHtml(feedback.state)+'</strong> · '+report.screenshots+' captures · '+report.approvedBaselines+' references verifiees · '+report.failures+' echecs.</p>'+
    '<p>'+escapeHtml(feedback.disclaimer)+'</p>'+
    '<section><h2>Recommandations pour Work</h2><ol>'+(recommendations||'<li>Aucun constat automatique.</li>')+'</ol></section>'+panels+
    '<section><p>Les captures sont deconnectees, avec reseau externe bloque. Ne jamais approuver automatiquement une reference ou publier des donnees sensibles.</p></section></main></html>\n';
}
module.exports = {buildFeedback, renderHtml};
