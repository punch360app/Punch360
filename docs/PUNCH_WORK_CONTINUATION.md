# PUNCH 360° — État courant unique

## Lot actif — Réglages personnels de navigation (NAV-004, partiel)

**PR [#149](https://github.com/punch360app/Punch360/pull/149)** rebasée sur le `main` incluant #147. L'employé ou responsable règle **sa propre** application préférée dans **Plus → Réglages → Navigation** sans démarrer d'itinéraire, consulter un client ni pointer. Sur Web/PWA, « Toujours Google Maps/Waze/Plans Apple compatible » ou « Demander à chaque fois / Effacer » utilise `localStorage` propre à l'utilisateur et la compagnie. Sur Expo, même clé dans `AsyncStorage` et choix synchronisé avec Accueil Punch; l'application compatible est déterminée par la plateforme (pas Apple natif sur Android). Aucun code d'accès, GPS, abonnement ou information de client n'est écrit dans la préférence.

**Preuves du lot :** `tests/ui.test.mjs` exerce la vraie page paramètres Web, le choix Waze, son effacement, la redessination et la continuité des paramètres de langue; les fonctions réelles de navigation sont injectées dans le banc de test. CI TypeScript/Node/DOM tête finale à suivre; Web Pages et registre après fusion. **Appareils iOS/Android installés et services cartographiques présents non attestés**, NAV-004 reste partiel; préférence stockée par appareil, non synchronisée entre appareils. Sans migration SQL ni changement Stripe/Twilio.

## Dernier lot fusionné et publié — consignes d’accès révélées sur demande (NAV-008 partiel)

**PR [#147](https://github.com/punch360app/Punch360/pull/147)** fusionnée, commit `a40297bd29cb7722dd3a81e257cc7021ae132138`; CI post-fusion [#40406530468](https://github.com/punch360app/Punch360/actions/runs/40406530468) **SUCCESS**, Pages [#40406530489](https://github.com/punch360app/Punch360/actions/runs/40406530489) **SUCCESS**, registre [#40406530892](https://github.com/punch360app/Punch360/actions/runs/40406530892) **SUCCESS**. Web/Expo : consignes d'accès d'un client cachées jusqu'à l'ouverture volontaire du quart autorisé, fermeture et remise à zéro au changement d'entreprise, refus de quart étranger. Les URL Maps/Waze/Plans ne comportent aucun code/contact. La RPC autorisée transmet toujours les consignes au client autorisé, mais aucun droit séparé de code sensible n'est encore implémenté. Recette appareil et navigateur connecté non attestée.

## Dernier lot fusionné et publié — itinéraires distincts par arrêt (NAV-006 partiel)

PR [#146](https://github.com/punch360app/Punch360/pull/146) fusionnée sur `b309e4fc6b019870966c1732c27a3573cbe13c0c`, TypeScript post-fusion [#40405810510](https://github.com/punch360app/Punch360/actions/runs/40405810510) **SUCCESS**, Pages [#40405810494](https://github.com/punch360app/Punch360/actions/runs/40405810494) **SUCCESS**, registre [#40405811334](https://github.com/punch360app/Punch360/actions/runs/40405811334) **SUCCESS**. Chaque quart client publié possède une sélection Google/Waze/Plans Apple ou choix Android compatible; ni changement de session ni kilomètres/itinéraire multiarrêts inventés. Recette installée et authentifiée non attestée.

## Dernier lot fusionné et publié — choix d’itinéraire sur Accueil Punch (NAV-001/002/003/004/005/009/010 partiels)

PR [#144](https://github.com/punch360app/Punch360/pull/144) fusionnée commit `e2c3e6c690db24f9ef4c67148dab8e20034b07e5`. CI post-fusion [#40404810530](https://github.com/punch360app/Punch360/actions/runs/40404810530) **SUCCESS**, Pages [#40404810547](https://github.com/punch360app/Punch360/actions/runs/40404810547) **SUCCESS**; registre [#40404811923](https://github.com/punch360app/Punch360/actions/runs/40404811923) **SUCCESS**. Accueil Punch Web/PWA et source Expo : l’employé utilise son intervention prévue, sinon l’établissement habituel réellement assigné, pour ouvrir Google Maps, Waze, Plans Apple sur compatible; préférence locale par utilisateur et compagnie. Aucun GPS de routine ni mutation de pointage. Il manque adresse du siège en dernier recours autorisé, écran de réglages dédiés, couverture Construction, recette navigateur authentifiée et installations Android/iPhone.

## Dernier lot fusionné et publié — heures planifiées par client/adresse (MLOC-007 partiel)

PR [#143](https://github.com/punch360app/Punch360/pull/143), fusion `0f70f8aae1ddd28b449e3f7ba64abc12c55246f5`; TypeScript [#40403223227](https://github.com/punch360app/Punch360/actions/runs/40403223227) **SUCCESS**, Pages [#40403223300](https://github.com/punch360app/Punch360/actions/runs/40403223300) **SUCCESS**, suivi [#40403223164](https://github.com/punch360app/Punch360/actions/runs/40403223164) **SUCCESS**. Boss/Admin : heures brutes planifiées par client et adresse, conflits entre adresses exclus, périodes bornées et CSV Web / CSV texte Expo. Les **heures réellement travaillées par client** ne sont pas encore attribuées; aucun double pointage ni paie.

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

PR #149, branche `feat/essential-personal-navigation-settings-20261026`, attendre **les contrôles obligatoires sur le nouveau SHA rebasé**, corriger si échec; fusionner seulement vert et règles applicables respectées, puis surveiller Pages et registre sur le SHA fusionné. Préserver #147 de confidentialité et #86 ancien draft. NAV-004 reste partiel tant que les applications cartographiques ne sont pas testées sur Android/iPhone installés. Reprendre une autre exigence réalisable du maître sans contourner le blocage MLOC-004 du transfert de pointage et sans toucher aux six Price IDs, contrats, prix propriétaires, éditions ou SMS/Twilio.

## Coordination et protections

À ce point de contrôle, #86 reste le brouillon historique du lecteur non intégré; #130 est fusionnée. Revérifier les branches/PR avant écriture. Aucun workflow de #130 encore en cours dans les huit dernières exécutions vérifiées; ne pas supposer l’absence de nouveaux travaux après ce point.

Tarifs propriétaire **19/39/69 $ CAD**, **20/25/50 membres**, **+2 $**, annuel **−15 %**, bornes **1/3/illimitées**, six Price IDs et contrats préservés. Supabase exclusivement `mlabstdxxwjdpfaxiwmg`, Construction séparée, données réelles et secrets protégés. Pas de paiement réel ni restauration destructive en recette. Les trois compteurs viennent du registre GitHub et leurs totaux sont générés depuis les IDs du maître, sans validation locale du propriétaire.
