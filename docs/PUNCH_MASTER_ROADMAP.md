# PUNCH Essentiel — suivi maître

État du 24 octobre 2026. Les statuts s’appliquent à chaque exigence entière, pas à la seule présence d’un écran. `EN COURS` comprend les fonctions codées/testées auxquelles manque encore une partie de la recette ou du périmètre. Les preuves détaillées se trouvent dans les documents liés; les SMS restent à la fin.

| ID | Exigence Essentiel | État | Preuve / prochain manque |
|---|---|---|---|
| E01 | Conserver dépôt et Construction | EN COURS | Branches/PR, régressions Node et SQL; validation appareils restante |
| E02 | Identité visuelle et six références | EN COURS | docs/design, composants sage; recette visuelle complète restante |
| E03 | Trois forfaits modifiables | EN COURS | Catalogue versionné, MFA, devis; recette Stripe restante |
| E04 | Fonctions de base du forfait Essentiel | EN COURS | Punch/horaire/heures/congés/CSV et corrections de pauses; recette complète restante |
| E05 | Gestion Plus | EN COURS | Rotations, échanges, départements, annonces; calendriers externes/push restants |
| E06 | Gestion Pro | EN COURS | Couverture, RH, rapports estimatifs; budgets et intégrations paie spécifiques restants |
| E07 | Sécurité commune hors paywall | EN COURS | RLS et tests; audit indépendant, restauration et terrains restants |
| E08 | Borne commune sécurisée | EN COURS | Appairage/PIN/révocation/PWA; journal hors ligne signé et réconciliation développés, terrain restant |
| E09 | Session unique et mixte | EN COURS | SQL borne/téléphone et verrous; concurrence multiconnexions/charge restante |
| E10 | Salarié sans téléphone/courriel | EN COURS | Identité stable et activation conservant heures; recette sur appareil restante |
| E11 | Application personnelle facultative | EN COURS | Canaux séparés, consultation; test terrain restant |
| E12 | Invitations automatiques | EN COURS | File courriel automatique/idempotente et suivi Web/Expo développés; fournisseur/DNS/webhook/recette restants. SMS reportés |
| E13 | Activation Google/Apple/courriel | EN COURS | Liaison sécurisée; fournisseurs OAuth/SMTP à configurer et tester |
| E14 | Thèmes personnels | EN COURS | Dix références 11–20 livrées; autres références en attente |
| E15 | Quatre onglets Employé | EN COURS | Web/Expo, thèmes, modules; petites tailles/accessibilité physique restantes |
| E16 | Console Admin distincte | EN COURS | Gestion sans punch, délégations RH; revue complète des permissions restantes |
| E17 | Console Boss | EN COURS | Entreprise, bornes, paie, facturation; direction/coûts complets restants |
| E18 | Superviseurs par département | EN COURS | Lecture/planification et approbations heures/congés indépendantes par département; recette appareils/concurrence restante |
| E19 | Moteur d’horaires | EN COURS | Nuit/DST/récurrences/rotations/échanges; modèles réutilisables versionnés développés; postes/qualifications et calendrier externe restants |
| E20 | Pauses et règles de temps | EN COURS | Payées/non payées, demandes/corrections et offline mobile; politiques par département versionnées et appliquées au moteur; terrain restant |
| E21 | Corrections et approbations | EN COURS | Sessions et pauses auditées; journée intégrale oubliée et notifications internes livrées; push/recette terrain restants |
| E22 | Fermetures et rapports | EN COURS | Verrouillage/export, snapshots Pro; contrôles avancés/export complet restants |
| E23 | Communications et notifications | EN COURS | Annonces/alertes internes; préférences, appareils et file push développés; activation fournisseur/réception réelle et courriels restants |
| E24 | Super Administration complète | EN COURS | MFA/catalogue/clients/tests/abonnements, suppression et coffre des comptes test; support Web/Expo, promotions Stripe et rapports financiers livrés; rapprochement bancaire et recette fournisseur restants |
| E25 | Stripe et sursis | EN COURS | Backend et interfaces; recette fournisseur, réabonnement et rapprochement restants |
| E26 | Données et confidentialité | EN COURS | Isolation/audit; Loi 25, région, rétention, restauration à valider |
| E27 | Hors ligne | EN COURS | Journal mobile et borne provisoire signée testés en logiciel/SQL; appareils et pertes réelles restants |
| E28 | Site commercial | EN COURS | Trois cartes, comparatif du catalogue et FAQ; recette visuelle complète restante |
| E29 | Dix langues, modes et RTL | À FAIRE | Infrastructure/traduction complète non livrées |
| E30 | Pile partagée et déploiements | EN COURS | TS/Expo/Supabase/CI; builds signés et distribution restants |
| E31 | Matrice QA complète | EN COURS | 126 tests Node/DOM; suites SQL transactionnelles; fournisseur/charge/appareils restants |
| E32 | Livraison commerciale | EN COURS | Aucun lancement commercial déclaré avant recettes |
| E33 | Livrables complets du prompt | EN COURS | Ne pas clôturer tant que les lignes précédentes restent ouvertes |

Voir `PUNCH_WORK_CONTINUATION.md` pour la tâche active et les versions du serveur. Les instructions récentes du propriétaire priment sur l’ordre indicatif de ce tableau.

> Archives du 25 octobre, PR #14 : interfaces Web Boss/Super Admin, chiffrement/signature, documents privés, prévisualisation et récupération additive développés; 89 tests Node/DOM et quatre scripts SQL archives sur fixtures réussis. Backend appliqué et Edge déployée; CI/Pages à vérifier dans le suivi. Recette authentifiée binaire Storage/appareils, charge/concurrence et PRA infrastructure encore ouverts. Voir COMPANY_ARCHIVES_20261025.md. Les exigences E07/E22/E26/E31 restent EN COURS.

> Journées oubliées du 25 octobre : demandes Web/Expo, approbation séparée, pauses, anti-chevauchement, verrouillage de semaine et notifications internes développés. Deux migrations appliquées, 92 tests Node/DOM et deux SQL dédiés réussis; Web publié par PR #15, CI/Pages et fichier public vérifiés. Les autres compléments E18/E20/E21 et la borne hors ligne restent ouverts. Détails : ESSENTIAL_MISSING_DAYS_20261025.md.

> Borne hors ligne du 25 octobre : identité expirante, double chiffrement local, HMAC/chaîne, IndexedDB durable, contrôle des révocations, replay idempotent et réconciliation séparée Web/Expo développés. 102 tests Node/DOM et deux SQL dédiés; backend/Edge appliqués. Les observations ne sont officielles qu’après approbation. Recette physique/réseau/énergie/charge restante : E08/E09/E27/E31 restent EN COURS. Voir KIOSK_OFFLINE_20261025.md.

> Politiques de pauses : Web/borne/Expo et contrôle serveur du type payé/non payé, historique immuable et snapshots développés. 105 tests Node/DOM, SQL dédié et régressions pauses/hors ligne/archives réussis; quatre migrations appliquées. Durées/délais indicatifs, aucune déduction automatique. Voir DEPARTMENT_BREAK_POLICIES_20261025.md. E20 reste EN COURS pour recette complète.

> Approbations déléguées : Web/Expo et backend développés; trois migrations appliquées, 108 tests Node/DOM, TypeScript, SQL dédié et quatre régressions réussis. Aucune ouverture RLS des salariés privés. Voir SUPERVISOR_APPROVALS_20261025.md; publication Web à vérifier dans le suivi actif.


Actualisation budgets (2026-10-25) : Web/Expo développés, SQL fixtures annulées et tests Node/TypeScript; backend appliqué, publication Web essential-37 en cours. Voir LABOR_BUDGETS_20261025.md. Intégrations paie/couverture par qualifications restent ouvertes.
