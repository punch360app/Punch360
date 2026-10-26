# Instructions de reprise pour ChatGPT Work — prompts PUNCH

**SOURCE MAÎTRE PRIORITAIRE :** [MASTER_PROMPT_20261025.md](MASTER_PROMPT_20261025.md) — **578 exigences uniques en 29 lots** (giga-prompt de continuation intégré et dédupliqué). Lire intégralement et reprendre dans l'ordre P0 → P4. Sur `main`, ce fichier est la référence active après fusion de la PR #26; vérifier la présence effective du fichier et les nouvelles PR avant chaque séance. Le code de l'application doit toujours partir du `main` le plus récent. L'ancien giga-prompt a été supprimé après sa consolidation dans le Prompt maître; ne pas le chercher comme document actif.

**Contrôle complémentaire P0 (26 octobre) :** PR [#89](https://github.com/punch360app/Punch360/pull/89) **fusionnée**, GitHub Actions TypeScript/Node et Pages **vertes**; protection de session du devis Boss en production Web, Edge `essential-billing` v2 ACTIVE / JWT conservé. L'issue [#35](https://github.com/punch360app/Punch360/issues/35) n'est PAS close faute de recette fournisseur. Nouvelle issue [#90](https://github.com/punch360app/Punch360/issues/90) : les forfaits actifs Supabase contiennent 20/25/50 places et +2 $/place malgré les références maître à 5 +3/4/5; l'historique privé prouve des modifications avec acteur identifié. **Ne pas écraser ces versions sans identifier leur raison ni altérer les contrats historiques.** Six Price IDs Stripe actifs en CAD sont présents dans le catalogue, mais non vérifiés contre l'API du fournisseur. Le dossier Drive `promt` contient les cinq documents déjà indexés, ainsi que deux dossiers visuels et des instructions : aucun nouveau prompt à numéroter; le document privé de paiement emploie des noms historiques et ne remplace pas le maître. [Rapport](../SUPER_ADMIN_BOSS_BILLING_RACE_20261026.md).

**Reprise mise à jour le 26 octobre 2026 :** le reste du prompt historique « Validation SQL archives » est désormais intégré **dans le maître**, section `PASSATION DU PROMPT « VALIDATION SQL ARCHIVES »`. Ne plus ouvrir cet ancien prompt comme flux de travail indépendant. Commencer par **Super Admin : tarifs particuliers (#35), Stripe sandbox, comptes et authentification**, puis les recettes réelles d'archives/PRA et QA appareils. PR #83 a déjà corrigé le plafond PDF Storage; ne pas rejouer ce lot. Conserver les 578 IDs existants; chaque test fournisseur ou appareil manquant reste distinctement signalé. **Cette passation ne signifie pas que tout le maître est terminé.**

Lis **entièrement** :
1. `docs/prompt-board/MASTER_PROMPT_20261025.md`
2. `docs/prompt-board/README.md`
3. `docs/prompt-board/INDEX.md`
4. `docs/README_COLLABORATEUR_WORK.md`
5. `docs/PUNCH_MASTER_ROADMAP.md`
6. `docs/PUNCH_WORK_CONTINUATION.md`
7. La documentation technique pertinente au prompt traité.

## Mission
Utilise le Drive du propriétaire, dossier `promt`, comme boîte d'entrée et GitHub `punch360app/Punch360` comme tableau de suivi. Compare la liste Drive à `INDEX.md`, propose les nouvelles entrées après vérification, décompose les prompts en issues indépendantes et reprends l'implémentation du dépôt existant.

Avant de déclarer qu'une tâche est accomplie, examine le code du dernier `main`, les PR ouvertes/fusionnées, les preuves de tests et l'état réellement déployé. Ne déclare jamais un prompt entièrement terminé si seulement quelques sous-tâches le sont.

Travaille sur une branche séparée et prépare des PR. Avec les permissions nécessaires, maintiens l'index et les issues après chaque lot, avec liens de preuve, éléments bloqués et prochaines actions. Ne demande pas « continue » à chaque sous-tâche, mais ne prétends jamais que le travail se poursuivra tout seul une fois la séance terminée.

## Règles non négociables
- Projet Supabase **exclusif** : `mlabstdxxwjdpfaxiwmg`.
- Conserver les deux éditions Essentiel et Construction.
- Conserver les droits/forfaits, les données réelles, les fichiers privés, les fonctions et les travaux parallèles.
- Ne pas publier les prompts bruts de Drive dans le dépôt public sans revue de confidentialité.
- Ne jamais publier de secrets dans le client, les PR, les logs, ni la documentation.
- SMS/Twilio en dernier selon l'ordre du propriétaire.
- Suivi obligatoire par tâche : **développé / testé / déployé / intervention externe**.
- Déploiement, fournisseurs, Wallet, GPS en arrière-plan et appareils réels ne sont pas supposés testés par la présence d'un écran.

En cas d'absence d'accès Drive, noter précisément le blocage dans `INDEX.md` et avancer sur les tâches GitHub déjà connues, sans inventer le contenu manquant.
