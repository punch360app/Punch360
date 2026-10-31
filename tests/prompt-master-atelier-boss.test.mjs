import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const master=readFileSync(new URL('../docs/prompt-board/MASTER_PROMPT_20261025.md',import.meta.url),'utf8');
const start=readFileSync(new URL('../docs/prompt-board/WORK_START.md',import.meta.url),'utf8');
const target='asdk_app_6ae2765c4234819191e00ccdec236afb';
const oldTarget='asdk_app_6ae22e22dbb88191870e10edbf2a9699';
const coordination=master.split('## PRIORITÉ IMMÉDIATE')[0];

test('Prompt maître routes substantive Punch work to the explicitly connected Atelier partagé',()=>{
 assert.match(master,/^# PUNCH 360° — PROMPT MAÎTRE/m);
 assert.ok(coordination.includes(target));
 assert.ok(coordination.includes('12fb1917-94ea-481d-b131-16c58a5bf010'));
 assert.ok(!coordination.includes(oldTarget),'legacy connector must not be the mandated coordinator');
 assert.ok(master.indexOf('## COORDINATION OBLIGATOIRE')<master.indexOf('## PRIORITÉ IMMÉDIATE'));
 assert.match(start,/BOSS Atelier partagé pour les travaux substantiels/);
 assert.ok(start.includes(target));
 assert.ok(!start.split('> **COMMENCER PAR PUNCH-AUDIT')[0].includes(oldTarget));
});

test('BOSS method selects relevant experts without pretending to launch autonomous agents',()=>{
 for(const contract of ['list_agents','get_agent','get_application','prepare_agent_mission','consult_boss','request_id','expected_version']) {
  assert.ok(coordination.includes(contract),`missing orchestration contract: ${contract}`);
 }
 for(const level of ['SOFT','MEDIUM','GOD MODE']) {
  assert.ok(coordination.includes(level),`missing level: ${level}`);
 }
 assert.match(coordination,/Un seul intégrateur/);
 assert.match(coordination,/aucun service BOSS autonome/);
 assert.match(coordination,/Non synchronisé avec Atelier/);
 assert.match(coordination,/fusionné, déployé/);
});

test('MEDIUM is the automatic BOSS level unless Fred explicitly chooses SOFT or GOD MODE',()=>{
 assert.match(coordination,/Niveau automatique MEDIUM quand aucun niveau n'est précisé/);
 assert.match(coordination,/mode MEDIUM par défaut, sans reposer la question du niveau/);
 assert.match(coordination,/SOFT\*\* ou \*\*GOD MODE\*\* l'emporte toujours/);
 assert.match(coordination,/conserver son niveau déjà fixé/);
 assert.match(coordination,/ne mobilise jamais 20 experts automatiquement/);
 assert.match(start,/MEDIUM automatiquement, sans question supplémentaire/);
 assert.match(start,/demande explicite SOFT ou GOD MODE/);
 assert.doesNotMatch(coordination,/Pour une nouvelle mission sans niveau fixé, demander un seul choix/);
});

test('Existing audit, product priorities, and security rules remain required',()=>{
 assert.match(master,/PUNCH-AUDIT-GLOBAL-20261028/);
 assert.match(master,/QR employé vers caméra tablette/);
 assert.match(master,/SACATALOG-016/);
 assert.match(start,/PUNCH-AUDIT-GLOBAL-20261028/);
 assert.match(start,/PUNCH TypeScript/);
 assert.match(start,/Punch 360 safe visual review/);
});
