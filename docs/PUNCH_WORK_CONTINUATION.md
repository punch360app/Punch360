# Reprise active — journées oubliées, 25 octobre 2026

PR #14 archives fusionnée : commit `9810f1d0498acfbd6240db0ce38257df28d1a68a`. CI #110 réussie avant fusion; fichiers publics archives.js/archive-codec.js/essential.js/sw.js vérifiés identiques aux fichiers livrés. Page publique chargée dans Chrome cloud sans erreur applicative observée; aucune session authentifiée disponible dans ce navigateur, donc recette complète PDF/boss non exécutée.

Lot suivant : branche `feat/missing-day-approval`. Journées complètes oubliées développées Web/Expo, deux migrations appliquées. 92 tests Node/DOM et TypeScript réussis; deux scripts SQL sur fixtures et régression archives réussis. Voir `ESSENTIAL_MISSING_DAYS_20261025.md`. Déploiement Web : PR/CI à vérifier; Expo : TypeScript seulement, aucun appareil.

| Domaine | Développé | Testé | Déployé | Reste / intervention externe |
|---|---|---|---|---|
| Archives applicatives | Oui | Tests et SQL détaillés ci-dessous | Oui, PR #14 + backend + Edge | Recette connectée PDF fictif, appareils, charge/PRA |
| Journée oubliée et notification interne de décision | Oui, Web/Expo | 92 tests et 2 SQL | Backend oui; Web PR/CI en cours | Appareils, multiconnexion, sélecteur de dates |
| Borne hors ligne sécurisée | Non | Non | Non | Travail de développement, pas un simple accès fournisseur manquant |
| Google | Flux existant | Fournisseur activé observé | Configuration existante | Connexion complète à exécuter |
| Apple | Flux existant | Fournisseur désactivé observé | Non activé | Configuration Apple fournisseur et recette |
| Infra / confidentialité | Procédure d’archive/PRA | Région observée us-east-1 | Pas de PRA exécuté | Rétention/PITR, copies Storage indépendantes, environnement isolé, RPO/RTO |

Les autres exigences restent EN COURS : politiques de pauses, délégations fines, modèles/coûts/budgets/paie, push/préférences/courriels, dix langues/RTL, design complémentaire, audit Super Admin, recette Stripe, QA et builds signés. SMS en dernier. Le prompt global n’est pas terminé.

---
Historique des archives :

# Reprise active — 25 octobre 2026 : archives

Branche `wip/company-archives-handoff-20261025`, PR #14. Main vérifié au départ : `a5f0a43`; seule PR ouverte #14. Les PR #11–13 sont préservées. Le SQL de restauration inachevé a été remplacé par cinq migrations plus petites effectivement appliquées; les trois migrations d’export et la clé Vault n’ont pas été rejouées.

| Domaine | Développé | Testé | Déployé | Intervention externe / recette restante |
|---|---|---|---|---|
| Archives SQL, intégrité, signature, prévisualisation et récupération | Oui | Quatre scripts SQL transactionnels sur fixtures; régressions borne/operations/pauses | Oui, Supabase | Charge/concurrence multiconnexion |
| Chiffrement et interfaces Boss / Super Admin Web | Oui | 89 tests Node/DOM + TypeScript | Oui, PR #14 fusionnée / fichiers publics vérifiés | Recette navigateur connecté avec PDF fictif et appareils |
| PDF privés signés, conflits sans écrasement | Oui | Handler à transport injecté + preuves SQL | Edge company-archive-files v1 | Recette intégrée Storage/Auth/binaire réel |
| Copies temporaires et purge | Oui | Suppression/expiration SQL; cron actif 15 min observé | Oui | Observer une exécution planifiée, supervision opérateur |
| Sauvegarde infrastructure / PRA | Procédure documentée | Aucun exercice de sinistre | Non | Plan/rétention/PITR, stockage indépendant, environnement isolé, RPO/RTO |

Détails et limites : `COMPANY_ARCHIVES_20261025.md`. Aucune récupération de données officielles pendant les tests. Connexion fournisseur de bout en bout et exécution physique ne sont pas déclarées testées. Région Supabase observée `us-east-1`; traitement des exigences de confidentialité encore ouvert.

Tous les autres lots du prompt demeurent ouverts : borne hors ligne, journée oubliée/politiques/délégations/modèles/budgets/paie, push/courriel, recette OAuth, dix langues/RTL, design complémentaire, audit Super Admin, recette Stripe test, QA et builds signés. SMS toujours en dernier. Prochaine tâche après publication de #14 : borne hors ligne sécurisée. Aucun prompt complet annoncé terminé.

---
Historique antérieur :

> Lot commercial du 25 octobre : promotions immuables en brouillon, publication Stripe avec confirmation serveur, désactivation et reprise; rapports financiers paginés, filtres Québec et séparation test/réel. Fonction platform-promotions déployée, recettes fournisseur réelles non exécutées. Prochaine priorité : export/sauvegarde/restauration.

> Reprise du 25 octobre : comptes test livrés PR #11. Lot actif : support clients et recherche/audit intégré Web; demandes et réponses serveur, isolation entreprise, session MFA plateforme vivante et versions optimistes. SMS toujours reportés.

# Reprise du travail PUNCH

Dernière reprise : 24 octobre 2026. Lot RH fusionné dans la PR #8 (`8b47e3f`). Comparatif/FAQ fusionnés dans la PR #9 (`63ecd81`). Lot courant : `feat/essential-break-corrections`. Le guide collaborateur et le README sont conservés.

## Livré dans le lot courant

Code Web/Expo pour documents RH privés/versionnés, délégations séparées Documents/Certifications/Rémunération, confirmations, renouvellements de certifications; annonces et notes de quart; alertes internes horaires. Pauses explicitement payées/non payées avec journal mobile commun et borne en ligne. Rapports Pro estimatifs, règles/taux datés, indemnités saisies, banques auditables, CSV et snapshots.

Backend officiel : trois migrations appliquées `20261024232827`, `20261024232829`, `20261024232903`; Edge `essential-kiosk` version 4. Aucun fournisseur SMS/paiement activé par ce lot. Contrôles : TypeScript, 61 tests Node/DOM, 20 scripts SQL transactionnels, Deno, bundles Metro Android/iOS. Pas d’essai appareil physique ou de recette Storage/fournisseurs complète.

Détails, preuves et limites : `docs/ESSENTIAL_HR_PAYROLL_20261024.md`. Ne pas déclarer le produit commercialisable sur cette base.

Comparatif public et FAQ : catalogue serveur pour les montants, les membres inclus, les bornes, les établissements et les modules. FAQ accessible au clavier; borne hors ligne explicitement indisponible. Tests DOM sur modification de prix/limites/fonctions, masquage des forfaits privés/inactifs et échappement des noms. Version Web `essential-22`. Recette visuelle navigateur non effectuée : exécutable Playwright indisponible.

## Coordination

Avant de reprendre : fetch de main, vérifier PR/branches actives et ce document. Aucun autre travail ne doit remplacer les migrations ou les modules de temps pendant leur fusion. Les secrets restent côté serveur et le projet Supabase demeure exclusivement `mlabstdxxwjdpfaxiwmg`.

Corrections de pauses livrées dans ce lot : voir `ESSENTIAL_BREAK_CORRECTIONS_20261024.md`. Migration serveur appliquée `20261024234057`; interfaces Web/Expo, contrôle de période, snapshots originaux, annulation et approbation séparées.

Prochaines priorités restant à développer : journée oubliée et politiques de pauses, export complet/sauvegarde/restauration, hors ligne sécurisé de la borne, compléments Super Admin/promotions et langues; puis recettes fournisseurs/appareils. Les dix thèmes de borne et l’accès administratif temporaire évoqués dans le nouveau guide doivent être coordonnés avec l’autre Work, en conservant les références visuelles réelles et une session séparée de l’autorisation technique de borne. Les SMS sont reportés à la fin selon la priorité explicite du propriétaire.
