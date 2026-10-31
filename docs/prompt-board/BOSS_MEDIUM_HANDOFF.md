# PUNCH 360 — Feuille d'exécution BOSS (MEDIUM)

Ce guide précise la routine de reprise du [prompt maître](MASTER_PROMPT_20261025.md) et de [WORK_START](WORK_START.md), sans remplacer leurs décisions. Application Atelier existante : `12fb1917-94ea-481d-b131-16c58a5bf010`. Dépôt unique : `punch360app/Punch360`.

## 1. Reprendre le travail réellement existant

1. Identifier la dernière décision explicite du propriétaire et le chantier le plus prioritaire. Le rush Bento 05 (PR #261, empilée sur #217) et les incidents critiques de sécurité ou d'intégrité gardent leur priorité respective.
2. Lire la fiche Atelier avec `get_application` (tâches, versions, missions), puis `list_agents` et uniquement les `get_agent` pertinents. Comparer à `main`, aux PR ouvertes, à leurs bases et aux fichiers réellement modifiés. Réutiliser une tâche/mission déjà ouverte lorsque son objectif est le même.
3. Consigner avant modification : **objectif**, **révision de départ**, **PR et branches concurrentes**, **fichiers concernés**, **acceptation vérifiable** et **niveau**. Une préférence ou un concept non approuvé reste une proposition.

## 2. Coordination MEDIUM sans exécution fictive

Le BOSS coordonne **de 1 à 4 postes au maximum**, seulement si le périmètre permet du travail indépendant ; quatre postes ne sont pas un quota. Il choisit les expertises réellement présentes dans `list_agents`, pas un nombre d'agents supposé.

- **Pilote intégrateur** : seul responsable des écritures sur sa zone de fichiers, des contrats et du résultat final.
- **Expert métier/architecture ou sécurité** : revue des dépendances, rôles et limites ; ne modifie pas la même zone.
- **UX/design ou performance** : examen ciblé lorsque le lot touche ces aspects ; conserver des preuves réelles.
- **QA** : scénarios sur la révision livrée, reproductibilité, non-régression et limites d'environnement.

Ne créer un poste additionnel que pour un résultat distinct. Si aucun véritable orchestrateur `consult_boss` ni sous-agent exécutable n'est exposé, appliquer cette méthode dans le chat, appeler réellement les experts Atelier disponibles, et **ne pas annoncer quatre travailleurs autonomes lancés**. `prepare_agent_mission` enregistre une mission, mais ne lance pas un travailleur.

## 3. Protection des chantiers et relances

- **Une zone = un intégrateur.** Si un autre travail touche déjà les mêmes fichiers, intervenir en revue seule ou ouvrir une branche isolée explicitement empilée sur la branche propriétaire ; ne pas écraser, fusionner ou rebaser ses changements sans accord.
- Pour une reprise, lire le dernier SHA et vérifier l'état des CI **à ce SHA précis**. Ne pas refaire un test inchangé sans raison, ni masquer un échec ou déclarer « vert » pendant un workflow en cours.
- Si `get_application` échoue mais `list_applications` fonctionne, **la fiche n'est que partiellement accessible** : sa description ne remplace pas la liste des tâches, leurs versions ou leurs affectations. Ne pas créer de tâche en double ni réécrire le contexte par supposition. Réessayer une lecture limitée ; conserver le relais non transmis et annoncer précisément **« Non synchronisé avec Atelier »** pour cette partie.
- Pour toute écriture Atelier, utiliser un `request_id` stable sur les nouveaux essais. Relire avant `update_task`, `update_agent_mission` ou `update_application` et passer `expected_version`. En cas de conflit, relire et préserver la version de l'autre. Laisser **« À attribuer »** si aucun responsable n'a été désigné.

## 4. Fiche de fin de lot obligatoire (6 lignes)

1. **Mission / état** : proposée, codée, testée, en revue, fusionnée, déployée ou vérifiée en réel — ces états sont différents.
2. **Portée** : rôle, édition, écrans, fichiers, scénarios et données fictives ou environnement utilisé.
3. **Git** : PR, branche, SHA de départ et SHA réellement vérifié ; dépendances et zones concurrentes.
4. **Preuves** : commandes de tests réellement exécutées, résultats exacts, captures et rapports identifiables.
5. **Limites / blocages** : services indisponibles, essais physiques non faits, autorisations manquantes, synchronisation partielle.
6. **Reprise suivante** : **une action concrète et non dupliquée**, responsable « À attribuer » sauf désignation explicite.

**Interdictions permanentes :** aucune fusion, publication, migration de données réelles, changement d'accès, paiement ou activation de facturation par la seule commande « Continue le prompt maître ». Ne pas transmettre de jetons, secrets ni données personnelles à Atelier.
