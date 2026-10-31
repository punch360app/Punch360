import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const handoff=readFileSync(new URL('../docs/prompt-board/BOSS_MEDIUM_HANDOFF.md',import.meta.url),'utf8');
const start=readFileSync(new URL('../docs/prompt-board/WORK_START.md',import.meta.url),'utf8');

test('Work entrypoint links the MEDIUM BOSS handoff protocol',()=>{
 assert.match(start,/\[fiche de reprise courte\]\(BOSS_MEDIUM_HANDOFF\.md\)/);
 assert.match(handoff,/PUNCH 360 — Feuille d'exécution BOSS/);
 assert.match(handoff,/12fb1917-94ea-481d-b131-16c58a5bf010/);
 assert.match(handoff,/PR #261.*#217/);
});

test('BOSS chooses a bounded useful team without fabricating workers',()=>{
 assert.match(handoff,/de 1 à 4 postes au maximum/);
 for(const contract of ['list_agents','get_agent','prepare_agent_mission','consult_boss']) {
  assert.ok(handoff.includes(contract),'missing actual tool contract: '+contract);
 }
 assert.match(handoff,/ne pas annoncer quatre travailleurs autonomes lancés/);
 assert.match(handoff,/Une zone = un intégrateur/);
});

test('Partial Atelier outages fail closed and do not duplicate work',()=>{
 for(const contract of ['get_application','list_applications','request_id','expected_version','Non synchronisé avec Atelier','À attribuer']) {
  assert.ok(handoff.includes(contract),'missing recovery contract: '+contract);
 }
 assert.match(handoff,/Ne pas créer de tâche en double/);
 assert.match(handoff,/En cas de conflit, relire et préserver/);
});

test('A handoff distinguishes tests, deployment and real verification',()=>{
 assert.match(handoff,/SHA réellement vérifié/);
 assert.match(handoff,/tests réellement exécutées/);
 assert.match(handoff,/fusionnée, déployée ou vérifiée en réel/);
 assert.match(handoff,/aucune fusion, publication, migration de données réelles/);
 assert.match(start,/Cette fiche ne délègue aucune autorisation de fusion, publication ou paiement/);
});
