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
| E08 | Borne commune sécurisée | EN COURS | Appairage/PIN/révocation/PWA et tests; hors ligne sécurisé restant |
| E09 | Session unique et mixte | EN COURS | SQL borne/téléphone et verrous; concurrence multiconnexions/charge restante |
| E10 | Salarié sans téléphone/courriel | EN COURS | Identité stable et activation conservant heures; recette sur appareil restante |
| E11 | Application personnelle facultative | EN COURS | Canaux séparés, consultation; test terrain restant |
| E12 | Invitations automatiques | EN COURS | Adaptateur Twilio; SMS explicitement reportés, envoi courriel complet restant |
| E13 | Activation Google/Apple/courriel | EN COURS | Liaison sécurisée; fournisseurs OAuth/SMTP à configurer et tester |
| E14 | Thèmes personnels | EN COURS | Dix références 11–20 livrées; autres références en attente |
| E15 | Quatre onglets Employé | EN COURS | Web/Expo, thèmes, modules; petites tailles/accessibilité physique restantes |
| E16 | Console Admin distincte | EN COURS | Gestion sans punch, délégations RH; revue complète des permissions restantes |
| E17 | Console Boss | EN COURS | Entreprise, bornes, paie, facturation; direction/coûts complets restants |
| E18 | Superviseurs par département | EN COURS | Lecture/planification et tests; délégations d’approbations fines restantes |
| E19 | Moteur d’horaires | EN COURS | Nuit/DST/récurrences/rotations/échanges; modèles complexes/postes restants |
| E20 | Pauses et règles de temps | EN COURS | Payées/non payées, demandes/corrections et offline mobile; politiques par département restantes |
| E21 | Corrections et approbations | EN COURS | Sessions et pauses auditées; journée intégrale oubliée et notifications restantes |
| E22 | Fermetures et rapports | EN COURS | Verrouillage/export, snapshots Pro; contrôles avancés/export complet restants |
| E23 | Communications et notifications | EN COURS | Annonces, lectures, notes, alertes internes; push et préférences restants |
| E24 | Super Administration complète | EN COURS | MFA/catalogue/clients/tests/abonnements, suppression et coffre des comptes test; promotions/support/finances avancés restants |
| E25 | Stripe et sursis | EN COURS | Backend et interfaces; recette fournisseur, réabonnement et rapprochement restants |
| E26 | Données et confidentialité | EN COURS | Isolation/audit; Loi 25, région, rétention, restauration à valider |
| E27 | Hors ligne | EN COURS | Journal mobile testé; borne hors ligne non livrée |
| E28 | Site commercial | EN COURS | Trois cartes, comparatif du catalogue et FAQ; recette visuelle complète restante |
| E29 | Dix langues, modes et RTL | À FAIRE | Infrastructure/traduction complète non livrées |
| E30 | Pile partagée et déploiements | EN COURS | TS/Expo/Supabase/CI; builds signés et distribution restants |
| E31 | Matrice QA complète | EN COURS | 66 tests Node/DOM et 21 SQL; fournisseur/charge/appareils restants |
| E32 | Livraison commerciale | EN COURS | Aucun lancement commercial déclaré avant recettes |
| E33 | Livrables complets du prompt | EN COURS | Ne pas clôturer tant que les lignes précédentes restent ouvertes |

Voir `PUNCH_WORK_CONTINUATION.md` pour la tâche active et les versions du serveur. Les instructions récentes du propriétaire priment sur l’ordre indicatif de ce tableau.
