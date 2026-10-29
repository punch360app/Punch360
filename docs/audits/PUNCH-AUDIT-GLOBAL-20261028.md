# PUNCH-AUDIT-GLOBAL-20261028 — matrice de reprise

**Priorité confirmée sur `main` par la PR #219.** Mandat en cours ; cette matrice n'atteste pas une recette de l'application entière.

## Règle de couverture et état initial

Chaque ligne de la matrice doit être affinée par **page/sous-page, état, rôle, viewport, objectif client, défaut mesuré, priorité, correction, capture, verdict**. Vérifier les états chargement, vide, erreur, sélection, refus d'accès, désactivé, succès, hors ligne, clavier et contenu long selon pertinence. Un écran absent reste « non livré » ou « NON VÉRIFIÉ », pas « UX OK ».

| Famille du vrai produit | Rôle et formats | Audit initial et preuve | Statut |
| --- | --- | --- | --- |
| Accueil/vente Essentiel et Construction | Public, S25/iPad/PC | Captures GitHub Actions existantes, quatre états publics par édition; inventaire détaillé des contrôles et alertes ajouté par ce lot | En contrôle automatisé partiel |
| Connexion / création / récupération | Public, S25/iPad/PC | Navigations entre les états déjà exercées par `visual-capture.cjs`; aucune soumission ni Auth réelle | En contrôle automatisé partiel |
| Espace salarié, carte QR et pointage téléphone | Salarié, petits/grands téléphones | Aucun compte de test utilisé par ce lot | NON VÉRIFIÉ |
| Borne tablette, lecture caméra du QR présenté par salarié | Opérateur, tablette portrait/paysage | Permissions caméra, secours matricule/NIP et vraie lecture non testés | NON VÉRIFIÉ |
| Heures, corrections, validation, export | Boss/Admin/chef/salarié selon droits, tablette/PC/téléphone | Contrats de temps et isolation des compagnies à préserver | NON VÉRIFIÉ |
| Horaires, missions, trajets et hors ligne | Chef/Boss/Admin/salarié, multi-formats | `MISSION-012` en validation avant la campagne, ne pas écraser ni marquer terminé | NON VÉRIFIÉ |
| Personnel, messages, notifications, réglages et autres pages réellement livrées | Rôles autorisés, multi-formats | Inventaire exhaustif par route et bouton à réaliser | NON VÉRIFIÉ |
| Super Admin, MFA, tableaux, catalogue et contrats | Super Admin, PC/iPad surtout; téléphone d'urgence | Vérifier vraies données et protections serveur, sans opération réelle | NON VÉRIFIÉ |
| Construction et fonctions conditionnées aux forfaits | Rôles autorisés, multi-formats | Découvrir les pages/états réels; garder distinct d'Essentiel | NON VÉRIFIÉ |

## Première protection technique de la campagne

- `visual-capture.cjs` enrichit les **24 captures d'états publics réellement exécutés** avec le recensement des contrôles DOM affichés, y compris ceux situés sous la ligne de flottaison. Pour chaque contrôle : type, nom accessible, action, taille, état désactivé, visibilité dans le viewport, ordre et index. Jamais de valeur de formulaire.
- `ux-public-inventory.cjs` signale les libellés accessibles manquants, les IDs dupliqués et les pseudo-boutons inaccessibles au clavier. Le résultat `public-ui-inventory.json` est versé dans l'artefact `punch-visual-captures`; les constats sont **à examiner/corriger** et ne constituent pas une approbation visuelle.
- `tests/ux-public-inventory.test.mjs` couvre les contrôles hors écran et la détection des écarts. `tests/ux-design-contract.test.mjs` protège les invariants sauge, focus, cibles tactiles et dispositions responsive fondamentales.
- Les tests existants imposent déjà des cibles tactiles de 44 px sur les quatre états publics et le contrôle de 24 captures. **Les pages privées et l'exécution réelle de chaque bouton ne sont pas couvertes par ces preuves publiques.**

## Limites, concurrence et prochaine étape

La PR #217 modifie `web/live/app.js`, `essential.js`, `essential.css`, `tests/essential-ui.test.mjs` et le maître ; elle reste indépendante. La PR #86 est une préparation Storage non intégrée. Les travaux de `MISSION-012`, MFA, prix, heures, droits, QR et isolations sont préservés. Ne pas générer ni approuver de nouvelles baselines à partir des rendus dégradés.

**Prochain correctif utilisateur :** examiner l'artefact `public-ui-inventory.json` et les captures sur le SHA final de ce lot; corriger les défauts publics confirmés sur une branche non conflictuelle ou après résolution de #217, puis étendre progressivement l'inventaire aux vrais parcours authentifiés avec comptes isolés et preuves par rôle/format. Verdict global actuel : **NON VÉRIFIÉ**.
