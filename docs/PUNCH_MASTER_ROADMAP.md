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
| E19 | Moteur d’horaires | EN COURS | Nuit/DST/récurrences/rotations/échanges et modèles versionnés développés; export personnel ICS Web/Expo ajouté en source, import appareils non validé. Abonnement calendrier auto, postes exclusifs et intégrations externes restent ouverts |
| E20 | Pauses et règles de temps | EN COURS | Payées/non payées, demandes/corrections et offline mobile; politiques par département versionnées et appliquées au moteur; terrain restant |
| E21 | Corrections et approbations | EN COURS | Sessions et pauses auditées; journée intégrale oubliée et notifications internes livrées; push/recette terrain restants |
| E22 | Fermetures et rapports | EN COURS | Verrouillage/export, snapshots Pro; contrôles avancés/export complet restants |
| E23 | Communications, événements et notifications | EN COURS | Annonces/alertes internes et préférences push partielles; événements Boss/Admin, fêtes, réunions et visio prévus sous COMM-002–007 et COMM-013–016, **non livrés**; fournisseurs/réception réelle restent à valider |
| E24 | Super Administration complète | EN COURS | MFA/catalogue/clients/tests/abonnements, suppression et coffre des comptes test; support Web/Expo, promotions Stripe et rapports financiers livrés; rapprochement bancaire et recette fournisseur restants |
| E25 | Stripe et sursis | EN COURS | Backend et interfaces; recette fournisseur, réabonnement et rapprochement restants |
| E26 | Données et confidentialité | EN COURS | Isolation/audit; Loi 25, région, rétention, restauration à valider |
| E27 | Hors ligne | EN COURS | Journal mobile et borne provisoire signée testés en logiciel/SQL; appareils et pertes réelles restants |
| E28 | Site commercial | EN COURS | Trois cartes, comparatif du catalogue et FAQ; recette visuelle complète restante |
| E29 | Dix langues, modes et RTL | À FAIRE | Infrastructure/traduction complète non livrées |
| E30 | Pile partagée et déploiements | EN COURS | TS/Expo/Supabase/CI; builds signés et distribution restants |
| E31 | Matrice QA complète | EN COURS | 140 tests Node/DOM; suites SQL transactionnelles; fournisseur/charge/appareils restants |
| E32 | Livraison commerciale | EN COURS | Aucun lancement commercial déclaré avant recettes |
| E33 | Livrables complets du prompt | EN COURS | Ne pas clôturer tant que les lignes précédentes restent ouvertes |
| E34 | Disponibilités hebdomadaires récurrentes, exceptions et heures souhaitées Plus/Pro | À FAIRE | Étendre essential_availability déjà présente; aucun doublon de table. Voir PLANIFICATION_INTELLIGENTE_ABSENCES_20261025.md P1 |
| E35 | Besoins récurrents par poste et tableau des quarts à couvrir Plus/Pro | À FAIRE | Réutiliser modèles d'horaires, couverture Pro et qualifications existants; postes exclusifs/variations restent à concevoir. Voir P1 |
| E36 | Génération intelligente Pro et interface guidée en 3 étapes | À FAIRE | Brouillon explicable, contraintes, ancienneté, équité, heures, prévisualisation et publication manuelle. Voir P2 |
| E37 | Signalement d'absence explicite de l'employé sur un quart | À FAIRE | Aucun no-show, retard, GPS ou absence de punch ne lance une offre; pas d'effacement d'heures. Motifs prédéfinis, note facultative, confidentialité; voir P3 |
| E38 | Banque de remplaçants, offres par vagues et un seul gagnant | À FAIRE | Réutiliser quarts vacants/candidatures; attribution atomique; mode Boss approbation ou automatique. Voir P3 |
| E39 | Notifications, concurrence, QA et SMS différé du remplacement | À FAIRE | Push interne selon préférences; SMS/Twilio en dernier. Tests concurrence, multi-tenant, DST, réseau et appareils. Voir P4 |
| E40 | Tâches de quart, modèles par poste et formations internes Plus/Pro | À FAIRE | TASK-001–010 du Prompt maître; aucune deuxième identité, horaire, formation RH ou notification. UX simple, transfert au remplaçant confirmé, accès mobile et QA. |

Voir `PUNCH_WORK_CONTINUATION.md` pour la tâche active et les versions du serveur. Les instructions récentes du propriétaire priment sur l’ordre indicatif de ce tableau.

> Archives du 25 octobre, PR #14 : interfaces Web Boss/Super Admin, chiffrement/signature, documents privés, prévisualisation et récupération additive développés; 89 tests Node/DOM et quatre scripts SQL archives sur fixtures réussis. Backend appliqué et Edge déployée; CI/Pages à vérifier dans le suivi. Recette authentifiée binaire Storage/appareils, charge/concurrence et PRA infrastructure encore ouverts. Voir COMPANY_ARCHIVES_20261025.md. Les exigences E07/E22/E26/E31 restent EN COURS.

> Journées oubliées du 25 octobre : demandes Web/Expo, approbation séparée, pauses, anti-chevauchement, verrouillage de semaine et notifications internes développés. Deux migrations appliquées, 92 tests Node/DOM et deux SQL dédiés réussis; Web publié par PR #15, CI/Pages et fichier public vérifiés. Les autres compléments E18/E20/E21 et la borne hors ligne restent ouverts. Détails : ESSENTIAL_MISSING_DAYS_20261025.md.

> Borne hors ligne du 25 octobre : identité expirante, double chiffrement local, HMAC/chaîne, IndexedDB durable, contrôle des révocations, replay idempotent et réconciliation séparée Web/Expo développés. 102 tests Node/DOM et deux SQL dédiés; backend/Edge appliqués. Les observations ne sont officielles qu’après approbation. Recette physique/réseau/énergie/charge restante : E08/E09/E27/E31 restent EN COURS. Voir KIOSK_OFFLINE_20261025.md.

> Politiques de pauses : Web/borne/Expo et contrôle serveur du type payé/non payé, historique immuable et snapshots développés. 105 tests Node/DOM, SQL dédié et régressions pauses/hors ligne/archives réussis; quatre migrations appliquées. Durées/délais indicatifs, aucune déduction automatique. Voir DEPARTMENT_BREAK_POLICIES_20261025.md. E20 reste EN COURS pour recette complète.

> Approbations déléguées : Web/Expo et backend développés; trois migrations appliquées, 108 tests Node/DOM, TypeScript, SQL dédié et quatre régressions réussis. Aucune ouverture RLS des salariés privés. Voir SUPERVISOR_APPROVALS_20261025.md; publication Web à vérifier dans le suivi actif.


Actualisation budgets (2026-10-25) : Web/Expo développés, SQL fixtures annulées et tests Node/TypeScript; backend appliqué, publication Web essential-37 en cours. Voir LABOR_BUDGETS_20261025.md. Intégrations paie/couverture par qualifications restent ouvertes.

Export de paie configurable (2026-10-25) : profils/correspondances/aperçus Web et source Expo développés, migration appliquée, 132 tests et SQL annulé. Fournisseur nommé/import réel restent non validés. Voir PAYROLL_EXPORTS_20261025.md.

Couverture indépendante par qualification (2026-10-25) : plages et rapports Web/source Expo développés, 135 tests/TypeScript et SQL fixtures DST/expiration/congés/RLS/restauration; backend appliqué, publication à vérifier. Postes exclusifs/affectations et récurrence des règles ouverts. Voir QUALIFIED_COVERAGE_20261025.md.

Contrôles commerciaux Super Admin (2026-10-25) : suspension/réactivation de gestion Essentiel et sursis particulier développés, MFA/session/audit, pointage conservé. Backend appliqué, 137 tests et SQL fixtures. Publication Web à vérifier; autres actions plateforme et fournisseur restent ouvertes.

Annuaire des abonnements (2026-10-25) : filtres/pagination/indicateurs réel-test, audit et prix incomplets développés, migration appliquée, 140 tests/TypeScript et deux SQL annulés. Publication Web à vérifier. Voir SUBSCRIPTION_DIRECTORY_20261025.md.

## Extension priorisée — horaires intelligents et remplacement (décision du 25 octobre 2026)

**Source officielle des exigences : [PROMPT MAÎTRE — 490 points](prompt-board/MASTER_PROMPT_20261025.md).** Le document [Planification et absences](PLANIFICATION_INTELLIGENTE_ABSENCES_20261025.md) sert de spécification complémentaire. Suivi sans doublon : E34 = SHIFT-016–019; E35 = SHIFT-020–021; E36 = SHIFT-022–025; E37 = COVER-018–021 + HR-018; E38 = COVER-022–025; E39 = QA-018–020. Les lignes E34–E39 représentent ces mêmes exigences, sans créer de tickets parallèles.

Ordre pour les nouveaux écarts (en coordination avec les lots de sécurité, archives et QA déjà engagés) :
1. **P0 — audit anti-doublons :** confirmer les tables, RPC, flux et tests existants.
2. **P1 — socle Plus/Pro (E34–E35) :** disponibilité récurrente, exceptions ponctuelles, saisie manager et besoins récurrents par poste.
3. **P2 — expérience Pro (E36) :** trois écrans Besoins → Employés → Générer/prévisualiser/publier, mode simple d'abord, optimisation explicable et publication humaine.
4. **P3 — Signalement d'absence (E37–E38) :** **uniquement déclenché par le signalement d'absence volontaire confirmé de l'employé concerné**; filtrage de banque, offres par vagues, une seule attribution transactionnelle et mode d'approbation configurable.
5. **P4 — fiabilité (E39) :** notifications internes/push, sécurité, règles locales, réessais, concurrence et recette; **aucun vrai SMS avant l'étape Twilio finale déjà reportée**.

Aucune refonte ni ajout de fonctionnalités payantes silencieux. La conception/les documents ne constituent ni une livraison technique ni une recette.