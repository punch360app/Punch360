// Public DOM inspection only: no accounts, submissions, or private data.
function buildPublicInventory(audits) {
  if (!Array.isArray(audits)) throw new TypeError('Expected public screen audits');
  const screens = [];
  const findings = [];
  for (const audit of audits) {
    if (!audit || typeof audit !== 'object' || !Array.isArray(audit.controls)) {
      throw new TypeError('A screen is missing its control inventory');
    }
    const key = [audit.device, audit.edition, audit.screen].join('/');
    const ids = new Set();
    let missingNames = 0;
    for (const control of audit.controls) {
      if (control.id) {
        if (ids.has(control.id)) findings.push({screen:key,code:'duplicate-id',id:control.id});
        ids.add(control.id);
      }
      if (!control.name) {
        missingNames++;
        findings.push({screen:key,code:'missing-accessible-name',element:control.element,action:control.action||null,index:control.index});
      }
      if (control.element === 'role-button' && control.tabIndex < 0) {
        findings.push({screen:key,code:'role-button-not-keyboard-reachable',action:control.action||null,index:control.index});
      }
    }
    screens.push({
      screen:key,viewport:audit.viewport,visibleControls:audit.controls.filter(c=>c.inViewport).length,
      totalControls:audit.controls.length,missingNames,
      touchTargets:audit.tapTargets,layout:audit.layout,
      controls:audit.controls
    });
  }
  return {
    scope:'Public logged-out Web only; static control inventory, not a test of every button result or private role',
    verdict:'NON VÉRIFIÉ for authenticated journeys and actions not exercised by smoke tests',
    screens:screens.length,controls:screens.reduce((n,s)=>n+s.totalControls,0),
    findings,results:screens
  };
}
module.exports={buildPublicInventory};
