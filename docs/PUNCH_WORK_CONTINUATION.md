# PUNCH 360° — État courant unique

## Lot actif — admissibilité des salariés pour les manques de qualification (SHIFT-021, partiel)

**PR [#134](https://github.com/punch360app/Punch360/pull/134)**, branche `feat/qualified-coverage-eligible-workers-20261026`. Depuis la vue Boss/Admin Pro existante, un intervalle de déficit de qualification révèle les salariés du département/site portant le certificat valide et leur statut **Disponible / Indisponible / Inconnu**, calculé au serveur d'après le congé approuvé, les affectations/absences, les exceptions datées puis la disponibilité hebdomadaire. Période de 12 heures maximum, explicitement annoncée quand un déficit est plus long. Les motifs privés, coordonnées et notes RH ne quittent pas le serveur; aucun quart, offre, salaire ou solde modifié. Permissions Boss/Admin Pro et RH Certifications, refus d'employé/entreprise différente.

**Supabase exclusif :** migration `20261026190002_qualified_coverage_candidates` installée dans `mlabstdxxwjdpfaxiwmg` (aucune autre base). `supabase/tests/qualified_coverage_candidates.sql` exécuté sur le schéma réellement installé en **BEGIN/ROLLBACK** : deux entreprises synthétiques, deux salariés certifiés, inconnu sans règle, priorité exception datée, congé approuvé, quart existant, isolation multi-entreprise. Accès authentifié par RPC uniquement (anon interdit). **À finaliser :** CI sur SHA final de #134, fusion, Pages sur SHA fusionné, registre auto, recette navigateur authentifiée et appareils distincts.

## Dernier lot fusionné et publié — besoins consolidés/copie de plages (SHIFT-021/029, partiel)

PR [#133](https://github.com/punch360app/Punch360/pull/133) fusionnée, commit `238d4b03f1788936aef9ef385675447d8221888b`. CI post-fusion [#40381240935](https://github.com/punch360app/Punch360/actions/runs/40381240935) **SUCCESS**, Pages [#40381240885](https://github.com/punch360app/Punch360/actions/runs/40381240885) **SUCCESS**; aucun changement Supabase. Vue conjointe du besoin par qualification, quarts vacants, heures planifiées; copie indépendante de plages datées, sans modifier de quart publié. Web/Expo code et tests Node; appareils physiques et authentification navigateur non encore attestés.

## Parcours précédent — préférences du salarié (SHIFT-019)

PR [#131](https://github.com/punch360app/Punch360/pull/131) fusionnée, CI post-fusion #40376947911 **SUCCESS**, Pages #40376947912 **SUCCESS**, migration Supabase `20261026181713_essential_worker_schedule_preferences` appliquée et SQL rollback validé. Préférences de quarts, heures souhaitées et volontariat distinct des banques de temps; gestionnaire autorisé peut consigner ancienneté/limites déclarées, sans effet automatique sur paie ou horaires. Appareils physiques non attestés.

**Mise à jour : 26 octobre 2026.** Les décisions et l’ordre global sont dans le [maître](prompt-board/MASTER_PROMPT_20261025.md); point d’entrée [WORK_START](prompt-board/WORK_START.md). Les anciens états sont [archivés](prompt-board/history/CONTINUATION_BEFORE_CLEANUP_20261026.md), sans consigne de reprise active.

## Dernier parcours fonctionnel fusionné et publié

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

Finir la PR #134 : contrôler les tests de la tête définitive, fusionner si CI verte, attendre le résultat Pages sur le SHA de fusion, puis vérifier la synchronisation automatique de SHIFT-021 sans déclarer la fonctionnalité complète. Étape suivante : modèles de besoins récurrents et exceptions de plages/fêtes SHIFT-020/029–033, sans moteur parallèle ni écrasement d'un horaire publié. Blocages Stripe #35 et OAuth #102 inchangés; appareil Expo/recette Web authentifiée non prouvés. Préserver SACATALOG-016, contrats, prix propriétaires 19/39/69 et six IDs Stripe, Construction, Twilio en dernier.

## Coordination et protections

À ce point de contrôle, #86 reste le brouillon historique du lecteur non intégré; #130 est fusionnée. Revérifier les branches/PR avant écriture. Aucun workflow de #130 encore en cours dans les huit dernières exécutions vérifiées; ne pas supposer l’absence de nouveaux travaux après ce point.

Tarifs propriétaire **19/39/69 $ CAD**, **20/25/50 membres**, **+2 $**, annuel **−15 %**, bornes **1/3/illimitées**, six Price IDs et contrats préservés. Supabase exclusivement `mlabstdxxwjdpfaxiwmg`, Construction séparée, données réelles et secrets protégés. Pas de paiement réel ni restauration destructive en recette. Les trois compteurs viennent du registre GitHub et leurs totaux sont générés depuis les IDs du maître, sans validation locale du propriétaire.
