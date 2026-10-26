# PUNCH 360° — État courant unique

## Lot actif — heures planifiées par client/adresse (MLOC-007 partiel)

**Branche :** `feat/essential-planned-hours-by-client-20261026` — PR à ouvrir après les tests finaux. Dans **Horaire → Prévu / réel**, Boss/Admin Essentiel peut calculer à partir des vrais `scheduled_shifts` et des **seules adresses déjà autorisées** `list_essential_assigned_client_sites` les **heures prévues brutes uniques par salarié et par client/adresse**, filtrer salarié/département/adresse, voir les quarts sans salarié séparément et exporter un CSV local sur Web ou partager le CSV texte sur Expo.

**Garde-fous :** les quarts qui se chevauchent chez **des clients différents** ont leurs minutes litigieuses **exclues du total attribué** et signalées séparément; les chevauchements chez **le même client** sont dédupliqués. Les heures réellement travaillées par client **ne sont pas encore attribuées** : le temps constaté, les pauses et la paie ne sont jamais imputés à un lieu sur la seule foi d'un quart prévu. Refus des périodes non intégralement chargées et des jeux de 1 000 quarts/destinations tronqués; intervalle 31 jours maximum, dates UTC de fin exclusive. Aucun nouveau SQL ni permission, pointage, GPS, Stripe, contrat ou SMS.

**Preuves :** calcul pur `web/live/planned-client-report.js`, tests multi-salariés/conflictuels, CSV anti-formule `tests/planned-client-report.test.mjs`, parcours UI Boss/Admin/refus employé `tests/planned-client-report-ui.test.mjs`. CI finale, PR, Pages exact SHA et suivi automatique **à vérifier**. Recettes authentifiées et appareils physiques non attestées. MLOC-007 reste **partiel** : il manque les segments de pointage réellement attribués aux clients et le rapprochement prévu/réel selon droits.

## Dernier lot fusionné et publié — prochaine intervention Accueil Punch (MLOC-004 partiel)

PR [#141](https://github.com/punch360app/Punch360/pull/141) fusionnée, commit `da08c78371b4a24ee2d9f1277c45a8d58ad609e6` ; TypeScript post-fusion [#40400854261](https://github.com/punch360app/Punch360/actions/runs/40400854261) **SUCCESS**, Pages [#40400854315](https://github.com/punch360app/Punch360/actions/runs/40400854315) **SUCCESS**. Accueil Punch Web/Expo présente la propre prochaine intervention du salarié, l'adresse client et les consignes autorisées; Itinéraire Google Maps volontaire. Aucun transfert de pointage activé : le moteur `punch_transfer`, `sync_punch_event` et le GPS actuel utilisent `jobs`, non le lieu client; aligner GPS/pauses/synchronisation hors ligne avant de proposer « Changer de client ». Le prompt maître PR #142 ajoute les destinations universelles Google Maps, Waze et Plans Apple, à développer séparément, sans prétendre qu'elles sont déjà livrées.

## Dernier lot fusionné et publié — double vue calendrier (MLOC-003 partiel)

PR [#140](https://github.com/punch360app/Punch360/pull/140) fusionnée sur `3bf769b09bff8b9800e3caec488356f33e018e49`, CI post-fusion [#40399201020](https://github.com/punch360app/Punch360/actions/runs/40399201020) **SUCCESS**, Pages [#40399200939](https://github.com/punch360app/Punch360/actions/runs/40399200939) **SUCCESS**, registre [#40399201648](https://github.com/punch360app/Punch360/actions/runs/40399201648) **SUCCESS**; aucun SQL. Vues Web/Expo « Par employé / Par emplacement » avec filtres jour/semaine/salarié/département/adresse, chevauchements véritables et alertes informatives sans estimation du trajet. Recettes physiques et navigateurs authentifiés encore non attestées.

## Dernier lot fusionné et publié — adresses clients sur quarts (MLOC-002/004/006 partiels)

PR [#138](https://github.com/punch360app/Punch360/pull/138) fusionnée (commit `34b9904fb3b17f5d0ac0da8f93c1fc8446b16330`), migration `20261026200019_essential_shift_client_sites` appliquée au seul Supabase `mlabstdxxwjdpfaxiwmg`, SQL deux compagnies **BEGIN/ROLLBACK** confirmé, tests et GitHub Pages succès. Un Boss/Admin rattache un lieu actif à un quart existant sans changer les pointages; salarié voit ses propres destinations et peut demander un itinéraire sans GPS permanent. Pas de transfert atomique pendant un seul pointage (MLOC-004 reste partiel).

## Dernier lot fusionné et publié — carnet clients et adresses (MLOC-001)

PR [#137](https://github.com/punch360app/Punch360/pull/137) fusionnée sur `99d1cb6685cee9ae487632540a9f68925f75de3a`; CI post-fusion [#40389621191](https://github.com/punch360app/Punch360/actions/runs/40389621191) **SUCCESS**, Pages [#40389621185](https://github.com/punch360app/Punch360/actions/runs/40389621185) **SUCCESS**. Migration `20261026194235_essential_client_intervention_directory` appliquée et 107 adresses fictives testées en ROLLBACK. Clients et lieux illimités, recherches, pagination, archivage, versions, confidentialité manager, aucune succursale/borne/membre facturable créée. Recette Web authentifiée et installation native ouvertes.

## Lot antérieur publié — rappels internes de disponibilités (SHIFT-021)

PR [#136](https://github.com/punch360app/Punch360/pull/136), Pages [#40385738566](https://github.com/punch360app/Punch360/actions/runs/40385738566) **SUCCESS**, migration `20261026191607_essential_availability_reminders` appliquée. Rappel interne d’une semaine avec aperçu et confirmation, sans doublon, sans Twilio ni changement d’heures. Les blocages OAuth/Stripe sont séparés.

**Mise à jour : 26 octobre 2026.** Les décisions et l’ordre global sont dans le [maître](prompt-board/MASTER_PROMPT_20261025.md); point d’entrée [WORK_START](prompt-board/WORK_START.md). Les anciens états sont [archivés](prompt-board/history/CONTINUATION_BEFORE_CLEANUP_20261026.md), sans consigne de reprise active.

## Historique — disponibilités hebdomadaires fusionnées

**Disponibilités hebdomadaires Essentiel Plus/Pro — SHIFT-016/017/018.** PR [#130](https://github.com/punch360app/Punch360/pull/130) fusionnée sur `7057c365a1de704bfc8e2af6cbb3b78fa7ad0326`. Employé : semaine type à plages multiples; Boss/Admin habilité : saisie pour un salarié actif, même sans compte; aperçu des conflits avec priorité absence/congé/exception/semaine type/inconnu. Aucun changement automatique des quarts, heures ou paie.

- **Développé :** Web/Expo et migration `20261026175720_essential_weekly_availability`; installation et SQL ROLLBACK sur deux compagnies fictives attestés dans #130, projet exclusif `mlabstdxxwjdpfaxiwmg`.
- **Testé :** CI tête #40373854973/#40373862707 et CI post-fusion [#40374125308](https://github.com/punch360app/Punch360/actions/runs/40374125308) **SUCCESS**.
- **Déployé :** Pages [#40374125469](https://github.com/punch360app/Punch360/actions/runs/40374125469) **SUCCESS** sur le SHA fusionné; recette navigateur authentifiée complète et appareils à prouver séparément.
- **Intervention externe :** build Expo installée et essais Android/iPhone non attestés; génération automatique et préférences complètes SHIFT-019–025 hors de cette PR.

**Parcours précédent :** absence volontaire et décision responsable, PR #129 fusionnée, migration `20261026163938` attestée, CI/Pages réussies. La recherche/attribution automatique d’un remplaçant n’est pas certifiée par ce lot.

## Maintenance documentaire de cette reprise

Branche `docs/master-execution-cleanup-20261026`. Nettoyage demandé par le propriétaire : prix actuels conservés, un ordre global et des jalons, blocages externes séparés, diagnostics datés archivés, suivi automatique et logo « Heure validée » explicites. Les 578 IDs antérieurs sont conservés. **Nouvelle demande ajoutée au maître : `SACATALOG-016`, membres inclus configurables ou illimités dans le Super Admin**, avec zéro supplément par membre en mode illimité et conservation des contrats. Cette capacité est spécifiée, **pas encore implémentée**; aucune preuve de réalisation ne lui est attribuée. Le total du suivi est recalculé depuis le maître. Cette maintenance ne prouve pas une livraison supplémentaire des modules métier. PR, SHA et CI font foi dans GitHub.

## Blocages distincts — ne pas refaire sans élément nouveau

| Domaine | Manque documenté | Intervention minimale / suite |
|---|---|---|
| Stripe, issue [#35](https://github.com/punch360app/Punch360/issues/35) | Migration `20261026110100_billing_confirm_intent` et publication Edge récentes non attestées dans les dernières preuves; recette sandbox complète manquante. | Valider migration et compatibilité clients/Edge, puis publier ensemble et tester paiement fictif/prorata/taxes/webhook/annulation/reprise sur sociétés fictives. Vérifier l’état réel avant toute application; si accès manque, le nommer et poursuivre un lot indépendant. |
| OAuth, issue [#102](https://github.com/punch360app/Punch360/issues/102) | Google/Apple, SMTP et recettes physiques encore incomplets. | Consoles/URL de retour/DNS et comptes de test/appareils; `SERVICES-001/002/008` hérite de la priorité Auth, ce n’est pas une tâche à attendre jusqu’aux SMS. |
| Archives/PRA | Pipeline Auth/Storage sur PDF synthétique et exercice PRA global non attestés. | Une recette intégrée avec cas négatifs, puis PRA isolé distinct; ne pas redévelopper le lecteur PDF #83 ni fusionner le brouillon #86 sans comparer le correctif déjà livré. |
| Appareils et services | Essais installés Android/iPhone/iPad, push/Wallet et couverture globale manquants. | Conserver les limites par parcours; tests automatisés et publication Pages ne les remplacent pas. SMS/Twilio en dernier. |

## Prochaine action exécutable

Ouvrir la PR du rapport prévu par client, confirmer sa CI tête définitive (notamment les clics Web et la séparation employé/Boss), fusionner si verte et sans conflit avec #142, surveiller Pages au SHA exact et registre. Maintenir **MLOC-007 partiel** (pas de pointages réels attribués par client). Ensuite choisir un lot indépendant de la mutation sensible du moteur Punch (p. ex. destinations Waze/Plans Apple exigées par PR #142), ou spécifier entièrement le transfert atomique/idempotent avec GPS/pauses/offline avant activation. Aucun test physique ne doit être inventé. Stripe #35 et OAuth #102 restent des recettes fournisseur distinctes; préserver six Price IDs et décisions de forfait, SMS/Twilio en dernier.

## Coordination et protections

À ce point de contrôle, #86 reste le brouillon historique du lecteur non intégré; #130 est fusionnée. Revérifier les branches/PR avant écriture. Aucun workflow de #130 encore en cours dans les huit dernières exécutions vérifiées; ne pas supposer l’absence de nouveaux travaux après ce point.

Tarifs propriétaire **19/39/69 $ CAD**, **20/25/50 membres**, **+2 $**, annuel **−15 %**, bornes **1/3/illimitées**, six Price IDs et contrats préservés. Supabase exclusivement `mlabstdxxwjdpfaxiwmg`, Construction séparée, données réelles et secrets protégés. Pas de paiement réel ni restauration destructive en recette. Les trois compteurs viennent du registre GitHub et leurs totaux sont générés depuis les IDs du maître, sans validation locale du propriétaire.
