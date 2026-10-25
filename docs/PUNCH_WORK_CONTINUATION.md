# Reprise active — file push et appareils, 25 octobre 2026

Préférences et routes employé publiées : PR #21 fusionnée dans `ef16fe74c461bb9ba27213b8449483b92006252e`, CI #134 et CI/Pages fusionnés réussis; fichiers publics notification-preferences.js, app.js et sw.js vérifiés identiques.

Lot courant `feat/push-delivery` : appareils liés aux sessions, révocation Web/Expo, file privée avec consentement, worker avec tickets/reçus/erreurs et purge. Trois migrations appliquées; Edge push-delivery v2 déployée, activation fournisseur non effectuée, aucun cron d’envoi. 116 tests Node/DOM, TypeScript, config Expo et SQL dédié/régressions réussis. Détails, limites et interventions dans `NOTIFICATIONS_20261025.md`. Publication par PR/CI à vérifier.

Prochaine priorité indépendante : invitations automatiques par courriel avec états et reprises, en préservant les jetons d’activation existants et SMS reportés. Reste aussi budgets/paie/couverture, OAuth réel/Apple, langues/RTL, design manquant, Super Admin, recette Stripe, builds/appareils/confidentialité/PRA. Le prompt global reste ouvert.

---
Historique :

# Reprise active — préférences et notifications, 25 octobre 2026

Modèles publiés : PR #20 fusionnée dans `03b607b97d2e1ae664cf894190b8e9aee5059379`, CI #131 réussie. Fichiers publics schedule-templates.js, planning.js et sw.js vérifiés identiques.

Lot `feat/notification-preferences` : préférences personnelles par entreprise/catégorie/canal, version attendue et isolation RLS Web/Expo. Migration notification_preferences appliquée; SQL transactionnel réussi. Correction de navigation employé vers journées oubliées et supervision (écrans auparavant masqués par la liste de routage); test DOM complet ajouté. La livraison push/courriel ne doit pas être annoncée fonctionnelle par la seule sauvegarde des préférences; UI explicite. Prochaine étape : appareils push, file de livraison et envois/reçus, puis invitations courriel.

Autres exigences toujours ouvertes : couverture par postes, coûts/budgets/paie, OAuth/Apple, dix langues/RTL, design manquant, Super Admin, recette Stripe, builds signés/appareils et confidentialité/PRA. SMS en dernier; conserver Construction et la branche du collaborateur déplacements/portefeuille.

---
Historique :

# Reprise active — modèles d’horaires, 25 octobre 2026

Approbations déléguées publiées : PR #19 fusionnée dans `140f55b83268359e2b8d1bbb46480e008e464f4f`, CI #128 réussie puis CI/Pages du commit fusionné réussis. Fichiers publics supervisor-approvals.js, planning.js et sw.js vérifiés identiques.

Lot courant : `feat/schedule-templates`. Modèles réutilisables de récurrences/rotations Web/Expo, configuration sans salarié/date, version attendue, archivage et périmètre de planification. Deux migrations appliquées. Le moteur existant publie les quarts; les sauvegardes de modèles n’en créent aucun. Voir `SCHEDULE_TEMPLATES_20261025.md`. PR/CI à vérifier.

Restent coûts/budgets/intégrations paie, couverture par postes/qualifications et calendrier externe, push/préférences/courriels, OAuth/Apple, dix langues/RTL, références visuelles manquantes, Super Admin, Stripe test, builds signés/appareils et confidentialité/PRA. Préserver la branche du collaborateur déplacements/portefeuille; SMS en dernier. Le prompt global reste ouvert.

---
Historique :

# Reprise active — approbations déléguées, 25 octobre 2026

Politiques de pauses publiées : PR #18 fusionnée dans `81313e226d7b6ec80d83415a0c3d5616f3900345`, CI #125 réussie. Fichiers publics break-policies.js, kiosk.js et sw.js vérifiés identiques à la livraison.

Lot courant : `feat/supervisor-approval-scopes`. Trois migrations appliquées : périmètres heures/congés indépendants, boîte minimale par département, ponts vers les moteurs existants et notifications internes de décision. 108 tests Node/DOM et TypeScript; SQL dédié et quatre régressions réussis sur fixtures annulées. Configuration Boss et interfaces Web/Expo développées; publication PR/CI à vérifier. Voir `SUPERVISOR_APPROVALS_20261025.md`.

Prochaine priorité : examiner les modèles d’horaires, couverture/coûts/budgets et intégrations de paie existants avant extension. Ne pas écraser la branche du collaborateur `feat/essential-pro-wallet-mileage-20261025`. Restent aussi push/préférences/courriels, recette OAuth/Apple, dix langues/RTL, références de design manquantes, Super Admin, Stripe test, builds signés/appareils et confidentialité/PRA. SMS en dernier. Le prompt complet reste ouvert.

---
Historique :

# Reprise active — politiques de pauses, 25 octobre 2026

Lot hors ligne publié : PR #17 fusionnée dans `a522dc304ef1ca9e6679c59bd5068d2a9a1770d1`, CI #122 réussie. Fichiers publics kiosk-offline.js, kiosk-offline-review.js, kiosk.js et sw.js vérifiés identiques. Les limites matérielles/terrain restent décrites dans `KIOSK_OFFLINE_20261025.md`.

Lot courant : `feat/department-break-policies`. Politiques versionnées, contrôle du type payé/non payé dans le moteur, contexte interne du chemin mobile payé, snapshots et UI Web/borne/Expo. Quatre migrations appliquées; TypeScript et 105 tests Node/DOM; SQL dédié sur fixtures et régressions pauses/hors ligne/archives réussis. Web : PR/CI à vérifier. Détails : `DEPARTMENT_BREAK_POLICIES_20261025.md`.

Prochain lot : délégations d’approbation fines par département (heures/congés), isolées des accès RH/rémunération et des pouvoirs de direction. Une branche distante `feat/essential-pro-wallet-mileage-20261025` a été repérée au même commit de base, sans nouveau commit au moment du contrôle; ne pas écraser un futur travail de ce collaborateur dans la paie/dépenses.

Reste ouvert : modèles/coûts/budgets/intégrations paie, push/préférences/courriels, recette OAuth (Apple désactivé observé), dix langues/RTL, autres références de design, audit Super Admin, recette Stripe, builds signés et QA/confidentialité/PRA. Les SMS restent en dernier. Ne pas annoncer le prompt complet terminé.

---
Historique :

# Reprise active — borne hors ligne, 25 octobre 2026

Branche `feat/kiosk-offline-secure-v1`, base main `6e9bc97`. Borne PWA : identité limitée à huit heures après PIN en ligne, autorisation chiffrée deux fois, journal IndexedDB signé/chaîné, reprises sans doublons, contrôles serveur de révocation/NIP/horloge, réconciliation distincte Boss/Admin Web et Expo. Les heures restent provisoires avant confirmation. Détails et limites : `KIOSK_OFFLINE_20261025.md`.

Développé : Web/PWA et source Expo de réconciliation. Testé : TypeScript, 102 tests Node/DOM, deux scripts SQL hors ligne et régressions borne/archives sur fixtures en transactions annulées. Déployé : six migrations additives et Edge essential-kiosk-offline v1; publication Web par PR/CI à vérifier. Intervention externe / recette non exécutée : appareils physiques, perte réseau/énergie, quotas/éviction et charge/multiconnexion serveur. Aucune observation officielle réelle créée pour les tests.

La clé d’archives et les moteurs de pointage Construction/en ligne restent préservés. Aucun paiement ou SMS réel. Ne pas rejouer les migrations hors ligne déjà appliquées. Vérifier la table de migration réelle par nom : les horodatages du connecteur peuvent différer des fichiers CLI.

Autres exigences encore ouvertes : politiques de pauses par département; délégations fines; modèles/couverture/coûts/budgets/paie; push/préférences/courriels; recette OAuth (Apple désactivé observé); dix langues/RTL; design complémentaire; audit Super Admin; recette Stripe; builds signés et QA/confidentialité/PRA. SMS en dernier. Le prompt global n’est pas terminé.

---
Historique des livraisons :

# Reprise active — journées oubliées, 25 octobre 2026

PR #14 archives fusionnée : commit `9810f1d0498acfbd6240db0ce38257df28d1a68a`. CI #110 réussie avant fusion; CI et Pages réussis sur le commit fusionné; fichiers publics archives.js/archive-codec.js/essential.js/sw.js vérifiés identiques aux fichiers livrés. Page publique chargée dans Chrome cloud sans erreur applicative observée; aucune session authentifiée disponible dans ce navigateur, donc recette complète PDF/boss non exécutée.

Lot publié : branche `feat/missing-day-approval`, PR #15 fusionnée dans `30baef7810b2b614c486887b73758bbf2858e0b1`. Journées complètes oubliées développées Web/Expo, deux migrations appliquées. 92 tests Node/DOM et TypeScript réussis; deux scripts SQL sur fixtures et régression archives réussis. Voir `ESSENTIAL_MISSING_DAYS_20261025.md`. Déploiement Web : CI #115 puis CI et Pages du commit fusionné réussis, missing-days.js public vérifié identique; Expo : TypeScript seulement, aucun appareil.

| Domaine | Développé | Testé | Déployé | Reste / intervention externe |
|---|---|---|---|---|
| Archives applicatives | Oui | Tests et SQL détaillés ci-dessous | Oui, PR #14 + backend + Edge | Recette connectée PDF fictif, appareils, charge/PRA |
| Journée oubliée et notification interne de décision | Oui, Web/Expo | 92 tests et 2 SQL | Oui, backend et Web PR #15; Expo source seulement | Appareils, multiconnexion, sélecteur de dates |
| Borne hors ligne sécurisée (état avant ce lot) | Non | Non | Non | Voir le bilan hors ligne en tête pour l’état actuel |
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
| Copies temporaires et purge | Oui | Suppression/expiration SQL; cron actif 15 min observé | Oui | Deux exécutions planifiées réussies observées (12:15 et 12:30 UTC); supervision opérateur à définir |
| Sauvegarde infrastructure / PRA | Procédure documentée | Aucun exercice de sinistre | Non | Plan/rétention/PITR, stockage indépendant, environnement isolé, RPO/RTO |

Détails et limites : `COMPANY_ARCHIVES_20261025.md`. Aucune récupération de données officielles pendant les tests. Connexion fournisseur de bout en bout et exécution physique ne sont pas déclarées testées. Région Supabase observée `us-east-1`; traitement des exigences de confidentialité encore ouvert.

Tous les autres lots du prompt demeurent ouverts : borne hors ligne, journée oubliée/politiques/délégations/modèles/budgets/paie, push/courriel, recette OAuth, dix langues/RTL, design complémentaire, audit Super Admin, recette Stripe test, QA et builds signés. SMS toujours en dernier. Prochaine tâche de développement : borne hors ligne sécurisée (non livrée). Aucun prompt complet annoncé terminé.

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
