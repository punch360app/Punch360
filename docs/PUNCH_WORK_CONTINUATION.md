# Reprise — postes exclusifs Essentiel Pro (nouvelle branche après conflit PR #51)

Dans le **prompt original « Validation SQL archives »**, poste exclusif Pro créé par établissement/département, certification facultative, verrou PostgreSQL transactionnel contre chevauchements, version et audit; interfaces Web/Expo. Migration **`20261026011451_essential_exclusive_positions` appliquée dans le Supabase officiel `mlabstdxxwjdpfaxiwmg`**. Scénario SQL synthétique rollback **réussi après installation**, 0 poste et 0 affectation conservés, accès anon refusé. CI 167/167 Node/DOM, TypeScript Expo et syntaxe Web réussis sur branche précédente avant recopie sur la dernière version de main. Détails : `docs/ESSENTIAL_EXCLUSIVE_POSITIONS_20261025.md`.

Ancienne PR #51 en conflit documentaire avec la fusion parallèle du prompt maître; **nouvelle PR** reprend le code sans effacer ni modifier le document `docs/prompt-board/MASTER_PROMPT_20261025.md` désormais dans main. Le prompt maître reste en attente : priorité exclusive au **prompt original Validation SQL archives**.

Restent la recette authentifiée Web/Expo et les prochaines étapes du prompt original : surveillance des certifications invalidées, planning spécial et disponibilité, calendriers automatiques révocables, interventions Boss/récupération Auth, traductions RTL, design final, intégrations Stripe sandbox/OAuth/notifications/paie, tests terrain et de charge/PRA. SMS en dernier.

---

> **Prompt maître unique après la PR #26 :** [`docs/prompt-board/MASTER_PROMPT_20261025.md`](prompt-board/MASTER_PROMPT_20261025.md), 518 exigences en 29 lots. L'ancien giga-prompt a été retiré du dépôt courant après consolidation; seul l'historique Git conserve son ancien texte. Les bilans plus anciens ci-dessous doivent être comparés au dernier code, aux migrations et à la CI, et ne sont pas des instructions pour rejouer un ancien travail.

# Reprise en cours — tarifs négociés : approbation et consentement Boss (PR #40)

Après la PR #38 fusionnée (propositions tarifaires immuables), la PR #40 développe : approbation Super Admin MFA d'une proposition (sans facturation), consultation de l'offre **pour le Boss seulement**, création d'une commande Stripe standard **après consentement explicite du Boss**, réutilisation du parcours Stripe existant (checkout/preview/confirm + webhook signé) et sauvegarde des anciens snapshots avant mise à jour des contrats confirmés. Écrans **Web et Expo**; migrations 20261025214230 et 20261025215638 appliquées au seul Supabase `mlabstdxxwjdpfaxiwmg`.

Scénarios SQL synthétiques rollback de consentement/versions/doublons/refus et historique contractuel **réussis avant et après installation**. Aucune offre client réelle, aucun paiement Stripe et aucun contrat réel modifiés. CI TypeScript/Node et Web en cours de vérification après dernières modifications. **Les vrais scénarios Stripe sandbox/Apple/Google/notification et tests sur appareils restent nécessaires**; le prompt original reste incomplet. Issue #35 ne peut pas être close sur la seule base du code.

Prochaines étapes : vérifier dernière CI, fusionner PR #40 si verte, contrôler Pages; demander la configuration Stripe en mode test pour recette réelle. Puis continuer actions Boss/reprise Auth sécurisée, postes exclusifs/affectations, calendrier synchronisé, 10 langues/RTL, design final, tests/recettes fournisseurs, charge/PRA, builds signés. SMS/Twilio à la fin. Le prompt maître #26 de 453 exigences reste distinct et non démarré.

---

# Tarifs particuliers — phase A sûre (PR #38)

Migration `20261025214230_platform_company_price_proposals` appliquée dans Supabase exclusif; première phase projets **draft_pending_stripe** seulement : devis serveur en cents CAD, calcul annuel, historique immuable, motif/MFA/session vivante, entreprise réelle Essentiel, version catalogue et proposition attendue, confirmation UUID, audit. Console Super Admin → « Tarifs particuliers », accès direct depuis le répertoire. SQL rollback réussi, aucune proposition ni facture réelle modifiée. Tests Node/DOM CI à confirmer après dernières éditions. Documentation : `docs/PLATFORM_SPECIAL_PRICES_20261025.md`.

**À développer pour clôturer issue #35 et le prompt original :** validation fournisseur Stripe test, devis prorata, soumission idempotente, confirmation webhook, passage actif seulement après paiement confirmé; prix réels jamais testés. Ensuite accès Boss/recouvrement sécurisé, postes/affectations, calendrier abonné, langues/RTL, design, appareils et PRA; SMS en dernier. Ne pas passer au prompt maître de 453 exigences avant la clôture du prompt original.

---

# Reprise officielle — après PR #34 : tarifs particuliers, 25 octobre 2026

État `main` : **PR #32** (Boss restreint Web/Expo), **PR #33** (export personnel iCalendar Web/Expo), **PR #34** (suspension/restauration ciblée d'un membre réel Essentiel) fusionnées. PR #34 au merge `7e504833239fab9d478002d359f44dd2a96c5394`. Migration Supabase active `20261025211947_platform_real_member_access`, tests SQL synthétiques avec `ROLLBACK` réussis et zéro intervention réelle. GitHub CI branche PR #34 : **156/156 tests** (plus TypeScript/Expo/syntaxe Web). CI + Pages de fusion vérifiées réussies.

**Prochaine tâche de code prioritaire** : <https://github.com/punch360app/Punch360/issues/35> — Super Admin : **tarifs négociés par compagnie Essentiel**, devis et contrats immuables, intégration Stripe sandbox + vraies confirmations webhook, sans toucher aux paiements réels lors des tests. Examiner l'existant `private.essential_contracts`, `public.essential_quote`, `public.essential_billing_order`, `supabase/functions/essential-billing`, `web/live/commercial.js`, `web/live/platform-directory.js`, et le dépôt `docs/PLATFORM_COMMERCIAL_20261025.md` avant d'agir. Ne pas recommencer ce qui est déjà livré.

**Autres points toujours ouverts** : action sur accès Boss avec protocole sécurisé de succession, réémission/récupération Auth sans accès à mots de passe réels; postes exclusifs et affectations, calendrier auto abonnable/révocable, langues et RTL, fin du design, recette Stripe/OAuth/Apple/Google, build appareils, charge/PRA, fournisseurs push/courriel/paie, SMS/Twilio en dernier. La PR documentaire #26 qui contient le prompt maître est distincte, non fusionnée et ne doit pas être écrasée.

Les comptes existants, abonnements, heures et PUNCH Construction restent protégés. La recette réelle par interface authentifiée de l'opération membre #34 est encore à faire : ne pas confondre CI/SQL avec validation terrain. Ne jamais modifier ou suspendre un vrai client pendant une recette.

---

# Reprise active — actions réelles Super Admin par compagnie, 25 octobre 2026

PR #34 `feat/platform-scoped-real-member-controls-20261025` : premier bloc d'action Super Admin réelle ciblée sur **un compte non-Boss d'une entreprise Essentiel réelle**, sans modifier les comptes Auth, les autres compagnies, le salaire, les pointages historiques ni Stripe. Actions `suspend` / `restore`, audit, MFA AAL2/session vivante, raison, UUID exact, version attendue. Le trigger existant `sync_essential_member_worker` désactive automatiquement le salarié : sa restauration doit préserver son état précédent. Compte propriétaire/Boss/test exclu; interventions interrompues si pointage ouvert. UI Web annuaire et tests ajoutés.

La recette SQL sur utilisateurs/entreprises synthétiques dans une transaction `BEGIN/ROLLBACK` a réussi : séparation multi-compagnies, refus Boss/propriétaire/non-MFA, version périmée, mauvais identifiants, audit et indicateurs du salarié restaurés. Aucune compagnie ni compte réel n'a été modifié par cette recette. Document : `docs/PLATFORM_REAL_MEMBER_ACCESS_20261025.md`.

**Prochaines étapes** : CI verte, migration Supabase appliquée version `20261025211947` (0 intervention réelle; privilège anon refusé). Fusionner/publier en ordre sûr, faire une vraie recette MFA sur une compagnie **fictive mais non facturée**. Ensuite contrats/tarifs particuliers par entreprise, puis planning postes exclusifs et intégrations externes. Les droits Boss et l'authentification globale restent des chantiers séparés; ne pas prétendre lire les mots de passe réels. Ne pas confondre l'action réelle ciblée et la suspension de toute l'entreprise. Le prompt global n'est pas terminé.

---

# Reprise active — accès Boss pendant restriction commerciale, 25 octobre 2026

Base main : annuaire des abonnements fusionné au commit `13d2920c9d97`. PR #26 (prompt maître) séparée et préservée.

Lot `fix/restricted-boss-access-20261025` : navigation restreinte du Boss Essentiel (Abonnement, Support, propre pointage), interdiction d'afficher les écrans de gestion pendant restriction effective, chargement prioritaire des deux services, et bilan de facturation conservé quand Stripe est indisponible. Aucune table ni donnée Supabase modifiée. Tests de rôle/fournisseur et test DOM ajoutés; **146/146 Node/DOM, TypeScript, vérification Expo et syntaxe Web réussis** sur [CI run 40225728289](https://github.com/punch360app/Punch360/actions/runs/40225728289). Les RPC de statut/support et `essential_entitlements` ont été contrôlées en lecture seule sur Supabase. Suite à cela, recette SQL transactionnelle `supabase/tests/restricted_boss_access.sql` **réussie**, avec contrôle de zéro fixture restante après rollback. Correction Web **et Expo** intégrée dans la branche. Publication Pages et recette authentifiée encore à confirmer. Détails : `RESTRICTED_BOSS_ACCESS_20261025.md`.

**Prochaine action** : valider CI, tests et accès d'une vraie session **compagnie fictive** restreinte, puis fusion autorisée; reprendre ensuite actions comptes réels et conditions tarifaires particulières du Super Admin. Restent aussi postes exclusifs/affectations, calendriers externes, langues/RTL, apparence, OAuth/Stripe réels en sandbox, push/courriel, appareils/PRA/charge. SMS en dernier. Aucun lot n'est réputé terminé sur la seule base d'une PR.

---

# Reprise active — annuaire des abonnements, 25 octobre 2026

Contrôles de service publiés : PR #30 fusionnée dans `edef3ac9ca11a95ed0c5e2dd64d7c42b6c37af5f`, CI #173 et CI/Pages du merge réussis; platform-directory.js public vérifié identique.

Lot courant `feat/platform-subscription-directory` : consultation paginée 50 comptes, filtres entreprise/réel-test/accès/forfait/périodicité, motif obligatoire et audit, MFA/session vivante. Totaux calculés sur tous les résultats filtrés, prix non confirmé = MRR/ARR inconnus avec somme partielle connue, contrats résiliés exclus du MRR. Factures réglées cumulées distinctes du rapprochement bancaire. 100 derniers webhooks du périmètre explicitement bornés. Remplace la liste Web sans pagination; ancien RPC conservé pour compatibilité. Corrige aussi la remise à zéro du contrôleur de couverture lors d’un changement de compte/compagnie. Migration platform_subscription_directory appliquée. 140 tests Node/DOM et TypeScript; deux SQL annulés (52 comptes 50+2, filtres, MFA, MRR incomplet, annuel/12 et résiliation) réussis. Web essential-41 PR/CI à vérifier. Voir SUBSCRIPTION_DIRECTORY_20261025.md.

Le prompt global n’est pas terminé : actions sur utilisateurs réels et conditions tarifaires particulières; postes exclusifs/affectations et calendrier externe; dix langues/RTL; références/design restant; recette OAuth/Apple, Stripe test, fournisseurs push/courriel/paie; builds signés/appareils, charge/concurrence/confidentialité/PRA. SMS en dernier. Aucun paiement/message/suspension d’une entreprise réelle pendant la recette. Préserver le travail du collaborateur et la PR documentaire #26.

---
Historique :

# Reprise active — contrôles de service Super Admin, 25 octobre 2026

Couverture par qualification publiée : PR #29 fusionnée dans `232033935a1848921f9347ed7f13a4f91362c39c`; CI #164 et CI/Pages du merge réussis. qualified-coverage.js et essential.js publics vérifiés identiques.

Lot courant `feat/platform-company-service-controls` : suspension/réactivation de la gestion Essentiel et sursis client 0–365 jours ou héritage du contrat, hors état Stripe. MFA avec session vivante, motif, confirmation UUID exact et version attendue. Pointage des salariés existants conservé. Réactivation = état calculé selon le paiement confirmé, sans fabriquer d’abonnement actif. Fiche et répertoire affichent/filtrent l’état effectif; cache brut et prix/contrats inchangés, Construction préservé. Deux migrations appliquées. Source Web essential-40 développée, 137 tests Node/DOM et TypeScript; SQL complet sur fixtures annulées réussi avant extension du filtre, puis petit scénario dédié du filtre effectif réussi, avec régressions facturation et pagination réussies. Le gros scénario modifié a renvoyé des erreurs de requestState expiré, pas une erreur SQL; il a été séparé plutôt que annoncé réexécuté. Publication PR/CI à vérifier. Voir PLATFORM_SERVICE_CONTROLS_20261025.md.

Prochaines exigences indépendantes : annuaire/pagination abonnements et actions utilisateurs réels, conditions particulières, postes exclusifs/affectations, langues/RTL et design restant. Fournisseurs/recettes : OAuth réel/Apple, Stripe test, push/courriel, paie nommée; builds signés/appareils/confidentialité/PRA. SMS en dernier. Aucune opération réelle de suspension, paiement ou message pendant les tests. Le prompt global reste ouvert.

---
Historique :

# Reprise active — couverture par qualification, 25 octobre 2026

Export de paie publié : PR #28 fusionnée dans `ae380d2b47e3526c2bb68ec7c975d1cc3ccdbc74`. CI #157 puis CI/Pages du merge réussis; payroll-export.js, payroll.js et sw.js publics vérifiés identiques.

Lot courant `feat/qualified-coverage` : plages explicites département/qualification/minimum, versions attendues, configuration gestionnaire Pro + Certifications, rapport agrégé gestionnaire Pro. Le rapport compte les salariés actifs affectés au quart, avec certificat émis et valide à chaque intervalle local, hors congé approuvé. Découpage aux bornes des quarts et minuits locaux (DST inclus). Aucun accès supplémentaire aux dossiers RH privés. Web et source Expo développés, 135 tests Node/DOM et TypeScript; SQL expiration à minuit/DST, renouvellement, congé approuvé, version périmée, RLS et récupération désactivée réussi en rollback. Migration qualified_coverage_windows appliquée. Web essential-39 par PR/CI à vérifier; appareils non testés. Voir QUALIFIED_COVERAGE_20261025.md.

Ce lot traite la couverture indépendante par qualification. Les postes exclusifs et l’affectation d’un salarié à un poste précis ne sont pas implémentés; plusieurs qualifications peuvent être satisfaites par un même salarié. Les créneaux sont explicites (pas de récurrence automatique des exigences de couverture). Autres exigences indépendantes ouvertes : actions Super Admin restantes, langues/RTL, design manquant. Fournisseurs : OAuth réel/Apple, Stripe test, push/courriel, paie nommée. Builds signés/appareils et confidentialité/PRA restent ouverts. SMS en dernier; préserver le travail du collaborateur et la PR documentaire #26.

---
Historique :

# Reprise active — export configurable de paie, 25 octobre 2026

Budgets publiés : PR #27 fusionnée dans `523049bc5c409b063f64076d11a902c0804ad943`; CI #154 puis CI/Pages du merge réussis. labor-budgets.js, essential.js et sw.js publics vérifiés identiques.

Lot courant `feat/payroll-export-profiles` : profils CSV versionnés (colonnes/en-têtes/séparateur/activation), correspondances explicites et uniques des matricules fournisseur, aperçu conservé et audité avec reprise idempotente. Semaine fermée obligatoire; rapport régénéré comparé au snapshot choisi pour refuser les données périmées, taux/sorties manquants refusés. Web/Expo développés, 132 tests Node/DOM et TypeScript réussis; SQL sur fixtures annulées réussi. Migrations essential_payroll_export_profiles et archive_payroll_budget_collections appliquées; restauration profils désactivés et snapshots testée sur fixtures annulées, quatre régressions SQL archives/paie/budgets réussies, fichiers Web essential-38 par PR/CI à vérifier. Aucun envoi vers un fournisseur; aucun format propriétaire certifié. Voir PAYROLL_EXPORTS_20261025.md.

Prochain travail indépendant : couverture par poste/qualification, actions Super Admin et langues/RTL. Fournisseur de paie et spécification d’import restent nécessaires pour une intégration nommée testée. OAuth réel/Apple, design manquant, Stripe test, push/courriel, builds signés/appareils et confidentialité/PRA restent ouverts. SMS en dernier. Préserver PR documentaire #26 et travail déplacements/portefeuille du collaborateur.

---
Historique :

# Reprise active — budgets de main-d’œuvre, 25 octobre 2026

PR #25 fusionnée dans `3f6343dc20eeede6340e885140ee68d01c794f34`. Branche active `feat/labor-budgets`, base synchronisée avec main. PR documentaire #26 d’un autre collaborateur préservée.

Budgets hebdomadaires entreprise/département Web/Expo, version attendue et audit, comparaison conservée avec le moteur des coûts pointés existant. Coût/écart laissés inconnus si taux absent ou session ouverte. Heures planifiées brutes/vacances séparées du coût réel estimatif. Migrations `essential_labor_budgets` et `essential_labor_budget_read_policy` appliquées; la seconde corrige l’appel du helper privé dans les politiques SELECT sans élargir ses droits. SQL complet sur fixtures annulées réussi après correction. Source Expo validée par TypeScript, aucun appareil physique. Publication Web essential-37 par PR/CI en cours; vérifier avant de la déclarer déployée.

Prochaines tâches : couverture par qualifications/postes, intégrations de paie, actions Super Admin restantes, dix langues et RTL. Toujours ouverts : recette OAuth/Apple, références visuelles manquantes, Stripe test, push/courriel configurés, builds signés/appareils, confidentialité/PRA. SMS en dernier. Le prompt global reste ouvert.

---
Historique :

# Reprise active — utilisateurs plateforme et fiches, 25 octobre 2026

Sécurité et annuaire entreprises fusionnés : PR #24 dans `7c702399906302c325633ae008d57f9508624825`, CI #143 réussie. Vérification CI/Pages et fichiers publics effectuée dans le lot suivant.

Lot courant `feat/platform-user-directory` : annuaire utilisateurs réels/test en consultation avec motif/audit, filtres/pages; fiche entreprise et aperçu des conditions confirmées. Deux migrations appliquées. 126 tests Node/DOM et TypeScript; SQL dédié sur 52 utilisateurs fictifs et contrôles d’accès/audit réussi en rollback. Web essential-36 par PR/CI à vérifier. Voir `PLATFORM_ACTIONS_AUDIT_20261025.md` pour les actions encore ouvertes.

Prochaine priorité indépendante : conditions/actions entreprise et compléments métier, internationalisation, puis recettes fournisseurs/appareils. Toujours ouverts aussi budgets/paie/couverture, OAuth réel/Apple, design manquant, Stripe test, QA/builds/confidentialité/PRA. SMS en dernier. Le prompt complet reste ouvert.

---
Historique :

# Reprise active — audit Super Admin, 25 octobre 2026

Invitations courriel fusionnées : PR #23 dans `0696bbb1a4342cc37850b5716b1f2915fa5c263c`, CI #140 réussie. Vérifier CI/Pages et fichiers publics du merge. Fournisseur/DNS/SMTP/webhook/ordonnanceur et recette réelle restent ouverts; aucun envoi réel.

Lot courant `feat/platform-audit-followup` : vérification de session vivante commune aux endpoints plateforme legacy, annuaire d’entreprises paginé/filtré et sélection d’archives au-delà des 200 du snapshot. Migration platform_session_and_search appliquée; 124 tests Node/DOM et TypeScript, SQL 56 entreprises + sessions expirées/révoquées, huit régressions réussies sur fixtures annulées. Web essential-35 par PR/CI à vérifier. Inventaire des actions restantes : `PLATFORM_ACTIONS_AUDIT_20261025.md`.

Prochaine priorité : annuaire utilisateurs réels et fiche entreprise, puis actions commerciales restantes. Toujours ouverts aussi budgets/paie/couverture, OAuth réel/Apple, langues/RTL, design manquant, Stripe test, QA/builds/appareils et confidentialité/PRA. SMS en dernier. Le prompt global reste ouvert.

---
Historique :

# Reprise active — invitations courriel, 25 octobre 2026

Push publié : PR #22 fusionnée dans `0e8478015c77067514547e8c8e3eb82d2e20c80c`, CI #137 puis CI/Pages réussis, notification-preferences.js et sw.js publics vérifiés identiques. La livraison fournisseur/appareils reste à activer/tester; voir NOTIFICATIONS_20261025.md.

Lot courant `feat/invitation-email` : réglages auto/validité et suivi Web/Expo, file de jetons chiffrés, envoi idempotent et webhook signé, déclenchement nouveau salarié. Cinq migrations appliquées et deux Edge v1 déployées. 122 tests Node/DOM et TypeScript; SQL dédié + régressions invitations/comptes test/archives réussies sur fixtures annulées. Aucun courriel/SMS réel, aucun cron d’envoi. Publication Web PR/CI à vérifier. Interventions exactes : `INVITATION_EMAIL_20261025.md`.

Reste indépendant : OAuth/courriel/redirections réels, dix langues/RTL, audit Super Admin restant, budgets/paie/couverture/postes, design manquant, recette Stripe et sursis, QA/concurrence/charge, builds/appareils et confidentialité/PRA. Les configurations externes vont au-delà de Stripe/Twilio : EAS/FCM/APNs, fournisseur courriel/DNS/SMTP/webhook et appareils notamment. SMS en dernier. Le prompt global reste ouvert.

---
Historique :

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
