# PUNCH 360° — Centre de suivi des prompts

Entrée unique : [WORK_START.md](WORK_START.md). Exigences et ordre global : [MASTER_PROMPT_20261025.md](MASTER_PROMPT_20261025.md). État courant et prochaine action : [PUNCH_WORK_CONTINUATION.md](../PUNCH_WORK_CONTINUATION.md).

## Fonctionnement du suivi

Le [suivi public](https://punch360app.github.io/Punch360/suivi.html) affiche trois ratios distincts depuis le registre versionné `web/live/work-progress.json` : **travail documenté**, **développement avec tests** et **livré et validé**. Ils se recalculent depuis les IDs actifs du maître et leurs preuves GitHub, partagées entre les appareils. Ils ne mesurent pas un pourcentage global inventé de l’application.

Les notes et validations personnelles de la page restent locales au navigateur. Elles n’influencent aucun de ces trois compteurs. Une exigence sans preuve enregistrée peut déjà avoir du code; une PR liée peut ne couvrir qu’une partie du parcours.

Le générateur `node scripts/sync-tracker-master.mjs` synchronise la liste HTML, les lots, le total, le registre publié et l’instantané lors des tests et de la publication Pages. Toute nouvelle demande distincte reçoit un ID unique stable au format reconnu dans le maître; aucune preuve n’est attribuée automatiquement. Ne pas maintenir manuellement de total fixe. Une clarification enrichit l’ID existant.

Chaque PR indique les IDs réellement touchés sur une ligne `PUNCH-PROGRESS: ID-001, ID-002`. Après fusion, le workflow de suivi enregistre PR et CI vérifiée; **une fusion ne prouve pas le déploiement**. Les états développé/testé/déployé/intervention externe restent indépendants. L’état livré exige les preuves applicables au parcours complet, y compris fournisseur ou appareil lorsque nécessaire.

## Sources et confidentialité

- **Maître** : seule liste fonctionnelle et seul ordre global. Annexes et spécifications détaillent les mêmes IDs, sans deuxième module ou prompt concurrent.
- **Passation courante** : lot actif, dernier livré, PR/SHA, CI et déploiements confirmés, blocages, prochaine action et travaux à préserver.
- **GitHub** : code, tâches et preuves. Roadmap et rapports historiques ne commandent pas de recommencer leurs anciennes priorités.
- **Drive privé `promt`** : boîte d’entrée des demandes/visuels; [INDEX.md](INDEX.md) garde leur correspondance. Aucun document brut, secret, lien privé ou donnée RH/GPS publié automatiquement.

La lecture du maître ne déclenche pas de travail entre les sessions. La synchronisation continue Drive → GitHub n’est pas installée. Les blocages d’accès Drive n’empêchent pas de poursuivre les parcours déjà documentés.

## Clôture d’une exigence

Établir ce qui manque réellement dans le dernier code, livrer un parcours cohérent, exécuter les contrôles pertinents et obligatoires, suivre CI/déploiement jusqu’au résultat final et conserver les preuves. Une interface seule, un test simulé ou une build compilée ne suffit pas à certifier une recette complète. Un fournisseur bloqué reste ouvert et laisse avancer les tâches indépendantes.

Le [contexte historique avant réorganisation](history/MASTER_CONTEXT_BEFORE_CLEANUP_20261026.md) conserve les anciennes passations; les versions antérieures des fichiers restent dans Git. Les décisions actuelles du propriétaire, les tarifs et les six Price IDs du maître priment sur ces états datés.
