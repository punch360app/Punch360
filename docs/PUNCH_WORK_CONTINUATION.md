# PUNCH 360° — État courant unique

## Lot actif — besoins de couverture et copie de plages (SHIFT-021, SHIFT-029 partiels)

**Branche** `feat/qualified-coverage-consolidated-view-20261026` ; PR à ouvrir. Réutilise `essential_qualified_coverage`, `qualified_coverage_report` et `essential_planning_report` déjà en production, sans migration SQL. Un Boss/Admin Pro peut consulter dans une vue commune les déficits par qualification, les heures-personnes de déficit, le nombre de quarts vacants, les heures planifiées et les déficits par département, ou copier une plage datée pour en créer une nouvelle indépendante après édition et enregistrement explicites. Les chiffres absents restent « Non disponible », jamais zéro implicite. La copie ne modifie ni la source, ni le planning publié. Web et Expo; tests Node de calcul, rendu, copie indépendante, retards de requêtes et régression.

**Critères avant fusion :** réussite de la CI complète sur la tête définitive; code Web publié via GitHub Pages après fusion, vérifier le workflow sur le SHA exact. Recette Web authentifiée et Expo physique toujours non prouvées. Le moteur récurrent de besoins, les exceptions des Fêtes, la gestion de tous les postes et la génération automatique SHIFT-020/022–025/030–033 ne sont pas livrés par cette vue partielle.

## Dernier lot fusionné et publié — préférences du salarié (SHIFT-019)

PR [#131](https://github.com/punch360app/Punch360/pull/131) fusionnée, commit `f5490672fab5612d8c04701f1099edc376b28727`, CI post-fusion [#40376947911](https://github.com/punch360app/Punch360/actions/runs/40376947911) **SUCCESS**, Pages [#40376947912](https://github.com/punch360app/Punch360/actions/runs/40376947912) **SUCCESS**, migration appliquée `20261026181713_essential_worker_schedule_preferences` uniquement dans `mlabstdxxwjdpfaxiwmg`. Employé : heures souhaitées, jour/soir/nuit/week-end, volontariat sans banque de temps gagnée. Gestionnaire : saisie déléguée et date d'ancienneté/minimum/maximum déclarés, audit; certifications existantes réutilisées. SQL multi-entreprise en ROLLBACK validé. **Recette mobile authentifiée/appareils non attestée.**

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

Finaliser la branche `feat/qualified-coverage-consolidated-view-20261026` : vérifier la CI complète après les derniers tests, créer et fusionner une PR avec `PUNCH-PROGRESS: SHIFT-021, SHIFT-029` seulement (travail partiel), vérifier Pages sur SHA fusionné et le registre de progression. Ensuite inspecter la fondation existante des besoins récurrents et des postes SHIFT-020/026–033 avant d'étendre le moteur. Préserver Stripe #35, OAuth #102, Super Admin `SACATALOG-016` non implémenté, éditions et prix actifs. Ne pas refaire de diagnostic fournisseur sans changement démontré.

## Coordination et protections

À ce point de contrôle, #86 reste le brouillon historique du lecteur non intégré; #130 est fusionnée. Revérifier les branches/PR avant écriture. Aucun workflow de #130 encore en cours dans les huit dernières exécutions vérifiées; ne pas supposer l’absence de nouveaux travaux après ce point.

Tarifs propriétaire **19/39/69 $ CAD**, **20/25/50 membres**, **+2 $**, annuel **−15 %**, bornes **1/3/illimitées**, six Price IDs et contrats préservés. Supabase exclusivement `mlabstdxxwjdpfaxiwmg`, Construction séparée, données réelles et secrets protégés. Pas de paiement réel ni restauration destructive en recette. Les trois compteurs viennent du registre GitHub et leurs totaux sont générés depuis les IDs du maître, sans validation locale du propriétaire.
