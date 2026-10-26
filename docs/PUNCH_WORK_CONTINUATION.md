# PUNCH 360° — État courant unique

## Lot actif — prochaine intervention sur Accueil Punch (MLOC-004 partiel)

Branche `feat/essential-punch-home-next-client-20261026` : le salarié voit dans **Accueil Punch** (Web/PWA et Expo) **uniquement sa propre** prochaine intervention ou celle prévue maintenant, le client, l’adresse, les instructions non sensibles en détails à la demande et un bouton « Itinéraire » ouvrant volontairement Google Maps. Source unique : RPC autorisée `list_essential_assigned_client_sites` + identifiant de son dossier salarié, y compris quand le serveur retourne tous les salariés à un Boss. Sélection bornée aux 48 prochaines heures, sans horaires inventés, GPS, écran supplémentaire ni impact aux pointages. Hors ligne ou résultats tronqués : indisponibilité visible plutôt que fausse affectation. Test partagé `tests/personal-client-visit.test.mjs` : choix du quart courant/suivant, salarié distinct, aucun contact privé d'autrui, pas d'heures, de km, de suivi de position ni de nouvelle session.

**À terminer :** CI tête finale et PR, fusion, publication GitHub Pages sur le SHA exact, synchronisation automatique du suivi. Aucun SQL nouveau. Vérifier de façon distincte navigateur connecté et builds installés Android/iPhone; pas encore attestés.

**Blocage démontré du transfert MLOC-004 :** `punch_transfer` et `punch_with_location` travaillent avec `jobs` et une géolocalisation sur le lieu technique, non avec `essential_client_sites`. Activer le bouton « Changer de client » sans modifier de manière cohérente `sync_punch_event`, la validation ponctuelle GPS `MLOC-005/CORE-021`, les pauses et le journal hors ligne introduirait une validation au mauvais endroit ou des relectures de temps incohérentes. Aucun raccourci ou RPC non synchronisée n’a été publié. **Prochaine étape:** concevoir et tester le transfert atomique/idempotent sous la session existante avec le journal offline, et la validation GPS au lieu client réel, sur entreprises/personnes synthétiques avant d’exposer le bouton. MLOC-004 reste partiel.

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

Finaliser et fusionner la PR du lot « prochaine intervention Accueil Punch » après CI réussie; surveiller Pages au SHA de fusion et le tracker automatique. Ne pas déclarer le transfert entre clients « terminé » : `punch_transfer`, `sync_punch_event`, GPS client, pauses, hors ligne, idempotence et validation doivent être alignés et exercés sur données fictives avant exposition utilisateur. Si ce transfert reste bloqué, avancer sur une autre fonction métier sans réécrire les protections. Prix 19/39/69, contrats, six IDs Stripe et éditions préservés; Stripe #35 et OAuth #102 attendent une recette fournisseur; SMS/Twilio en dernier.

## Coordination et protections

À ce point de contrôle, #86 reste le brouillon historique du lecteur non intégré; #130 est fusionnée. Revérifier les branches/PR avant écriture. Aucun workflow de #130 encore en cours dans les huit dernières exécutions vérifiées; ne pas supposer l’absence de nouveaux travaux après ce point.

Tarifs propriétaire **19/39/69 $ CAD**, **20/25/50 membres**, **+2 $**, annuel **−15 %**, bornes **1/3/illimitées**, six Price IDs et contrats préservés. Supabase exclusivement `mlabstdxxwjdpfaxiwmg`, Construction séparée, données réelles et secrets protégés. Pas de paiement réel ni restauration destructive en recette. Les trois compteurs viennent du registre GitHub et leurs totaux sont générés depuis les IDs du maître, sans validation locale du propriétaire.
