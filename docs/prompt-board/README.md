# PUNCH 360° — Centre de suivi des prompts

Ce répertoire définit le fonctionnement **Drive → GitHub → ChatGPT Work → statut vérifié**. Il ne change ni l'application ni Supabase.

## Source de vérité après consolidation

**Un seul prompt à exécuter :** [`MASTER_PROMPT_20261025.md`](MASTER_PROMPT_20261025.md) (**549 exigences uniques, 29 lots**). L'ancien giga-prompt a été supprimé après son intégration; les spécifications techniques sur les absences servent de références détaillées, pas de deuxième liste d'exigences à coder. Les exigences horaires avancés et signalement volontaire sont rangées sous SHIFT-016–025, COVER-018–025, HR-018 et QA-018–020, sans réimplémenter les mécanismes existants. Avant de développer, vérifier le dernier `main`, les PR, la base officielle et les tests ; un document n'est pas une preuve de livraison.

## Principe
- **Google Drive** : boîte d'entrée des nouveaux prompts et visuels. Dossier existant intitulé `promt` dans le Drive autorisé du propriétaire.
- **GitHub (ce dépôt)** : source de vérité des tâches, modifications, preuves et statuts. Les prompts doivent être triés en exigences vérifiables, sans duplication du code existant.
- **ChatGPT Work** : au début de chaque séance, lire `docs/prompt-board/WORK_START.md` et `INDEX.md`; chercher les nouveaux fichiers Drive si le connecteur est disponible; vérifier le code, les PR, les migrations et les tests; ouvrir des PR et actualiser les statuts.
- **Lecture par le propriétaire** : consulter `INDEX.md` sur `main` après fusion des PR, et les GitHub Issues/PR associées.

**Important :** La présence d'un document dans Drive ou GitHub ne déclenche pas Work automatiquement. Il faut ouvrir une tâche Work ou mettre en place une automatisation autorisée. La synchronisation continue Drive → GitHub n'est PAS installée ici. Une connexion Drive et une connexion GitHub autorisées sont nécessaires pour que Work lise les deux.

## États autorisés
- **À auditer** : prompt présent, périmètre non encore comparé au code courant.
- **À faire** : exigence vérifiée et manquante.
- **En cours** : branche/PR ou travaux identifiables.
- **À tester** : code présent, preuve de tests ou de déploiement manquante.
- **Bloqué** : dépendance identifiée avec action concrète.
- **Terminé** : code, tests ET déploiement pertinent vérifiés, avec preuves. Un comportement fournisseur/appareil non testé doit rester ouvert.

Pour chaque exigence, indiquer **Développé / Testé / Déployé / Intervention externe** séparément. Toute affirmation « terminé » doit donner des références exactes vers PR/commit, migrations et résultats de tests, plus la recette sur appareil/fournisseur si nécessaire. Ne jamais considérer la seule existence d'un écran comme une livraison.

## Processus de travail
1. Repérer les nouveaux fichiers dans le Drive `promt` (y compris les sous-dossiers); lire seulement les documents liés au projet PUNCH.
2. Examiner les documents et repérer les mots de passe, NIP, clés API, données RH/GPS, finances personnelles, et autres secrets. **Ne rien recopier de sensible dans ce dépôt public**.
3. Comparer toutes les exigences au code actuel, à `docs/PUNCH_MASTER_ROADMAP.md`, `docs/PUNCH_WORK_CONTINUATION.md`, aux PR et au serveur officiel. Conserver les acquis.
4. Décomposer les prompts en tâches avec identifiant stable (`P-001`, etc.). Créer des issues GitHub pour les tâches décidées, associer les PR, tester puis mettre les preuves à jour.
5. Mettre `INDEX.md` à jour via une PR, et respecter les travaux concurrents avant fusion.
6. Garder PUNCH Construction intact. Ne jamais modifier les données réelles pour faire une recette.

## Confidentialité
Le dépôt `punch360app/Punch360` est **public**. Ne pas publier automatiquement les fichiers Google Drive, ni leurs liens privés ou leurs données sensibles. Ne pas ajouter de synchronisation Drive/GitHub qui contourne les droits ou publie des documents sans contrôle. Avant toute automatisation, définir le périmètre et stocker les identifiants du fournisseur uniquement dans les secrets sécurisés du workflow.

Voir [INDEX.md](INDEX.md) et [WORK_START.md](WORK_START.md).
