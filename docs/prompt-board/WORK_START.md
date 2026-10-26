## Total automatique du suivi

À chaque modification du prompt maître publiée sur main, Pages exécute `node scripts/sync-tracker-master.mjs` : liste HTML, lots, total, registre publié et instantané sont synchronisés. Ajouter chaque demande comme exigence identifiée `- [ ] **CODE-001** — Description` sous un titre `## P2 — Titre (CODE, 1 points)`. Les cases cochées restent dans le total; elles ne certifient pas une livraison. Les IDs doivent rester uniques et stables. Les nouvelles exigences n’acquièrent aucune preuve de réalisation automatiquement. Ne plus maintenir un total fixe de 578 dans les scripts ou tests.

> **Audit initial du suivi Work élargi :** 82/578 exigences rattachées à des PR fusionnées (travail souvent partiel), dont 26 avec tests logiciels attestés et 56 dont la CI historique reste à vérifier. Ce n'est pas 82 fonctions terminées. L'horodatage et les comptes sont fournis dans `web/live/work-progress.json`; le site recalcule toujours depuis ce registre. Si le total progresse, vérifier les IDs et ne pas en déduire une livraison sans preuves d'appareils/fournisseurs.

## Suivi automatique Work — obligatoire depuis le 26 octobre 2026

Le tableau HTML `web/live/suivi.html` ne doit **jamais** afficher le pourcentage issu des cases cochées par le propriétaire. Sa source est `web/live/work-progress.json`, un registre **versionné sur GitHub**, construit avec les identifiants exacts du prompt maître (578). Ce registre a été initialisé par un audit rétrospectif conservateur de PR déjà fusionnées : les fonctionnalités non encore associées à une preuve restent `non vérifiées`, **pas nécessairement non développées**.

**Pour CHAQUE PR créée par Work**, après avoir identifié les IDs du maître effectivement touchés, inclure dans le corps de la PR une ligne explicite, par exemple :

```text
PUNCH-PROGRESS: STRIPE-012, GOV-014
```

Ne lister **que** les exigences ayant reçu du code ou un audit concret dans la PR, pas toutes les exigences du lot. Le workflow GitHub `.github/workflows/work-progress.yml` s'exécute **automatiquement après la fusion** : il vérifie les résultats `PUNCH TypeScript` sur le SHA de tête et enregistre la PR et ses IDs dans `work-progress.json`. Toute PR fusionnée même sans ligne `PUNCH-PROGRESS` est ajoutée à l'historique des PR, mais **n'incrémente pas artificiellement le nombre d'exigences travaillées**. Ne jamais confondre une fusion avec une preuve de déploiement.

Le site charge le registre depuis GitHub Pages au démarrage et l'actualise environ chaque minute quand il est ouvert. Après propagation GitHub Pages, le compteur Work est donc partagé entre tous les appareils, **sans case locale manuelle**. Les quatre états par ID restent indépendants : `developed` (non vérifié/partiel/vérifié), `tested` (non vérifié/logiciel), `deployed` (booléen), `external_required` (booléen). La clôture de bout en bout exige des preuves de développement, de tests, de déploiement et de recette. Le workflow de merge **n'attribue jamais automatiquement `deployed:true`**. Pour une livraison démontrée sur appareils/fournisseurs, mettre à jour l'ID manuellement dans le même registre avec la preuve appropriée et laisser le contrôle CI valider le JSON. Ne jamais créer d'ID hors du prompt maître.

**Attention :** un changement de schéma ou un nouvel ID implique une mise à jour des tests, pas un total recalculé d'après le nombre de PR. Les tarifications 19/39/69, inclusions 20/25/50, +2 CAD, 15 % annuel, contrats existants, six IDs Stripe et l'édition Construction restent protégés.

---

# Instructions de reprise pour ChatGPT Work — prompts PUNCH

**REPRISE COURANTE / AUTOPILOTE (26 OCTOBRE 2026) :** lire immédiatement [AUTOPILOT_HANDOFF_20261026.md](AUTOPILOT_HANDOFF_20261026.md) après ce fichier. Il enregistre les PR #112/#113 fusionnées avec CI verte, la PR #114 en cours, l'ordre de vérification GitHub Actions et les blocages Stripe/OAuth réels. Ce fichier ne remplace ni les 578 exigences du prompt maître, ni la vérification du dernier main.


**RÈGLE IMMÉDIATE POUR WORK :** **Décision du propriétaire — 26 octobre 2026 :** les forfaits actifs sont volontairement personnalisés. Essentiel : **19 $ CAD/mois, 20 membres inclus, +2 $/membre additionnel**; Plus : **39 $, 25 membres, +2 $**; Pro : **69 $, 50 membres, +2 $**; remise annuelle **15 %**. Conserver les versions actuelles du catalogue et **les six identifiants Stripe existants**, sans réinitialisation ni création automatique pour remplacer ces prix. L'ancienne grille 5 places et +3/4/5 $ est **historique et remplacée**. Préserver contrats/snapshots/produits, ne pas toucher Construction. Issue #90 résolue par confirmation du propriétaire; issue #35 encore ouverte pour les essais fournisseur.

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
