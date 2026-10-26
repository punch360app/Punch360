
> **Décision du propriétaire — 26 octobre 2026 :** les forfaits actifs sont volontairement personnalisés. Essentiel : **19 $ CAD/mois, 20 membres inclus, +2 $/membre additionnel**; Plus : **39 $, 25 membres, +2 $**; Pro : **69 $, 50 membres, +2 $**; remise annuelle **15 %**. Conserver les versions actuelles du catalogue et **les six identifiants Stripe existants**, sans réinitialisation ni création automatique pour remplacer ces prix. L'ancienne grille 5 places et +3/4/5 $ est **historique et remplacée**. Préserver contrats/snapshots/produits, ne pas toucher Construction. Issue #90 résolue par confirmation du propriétaire; issue #35 encore ouverte pour les essais fournisseur.

# Vérification après fusion Super Admin P0 (26 octobre 2026)

PR **#89 fusionnée** sur `main` : les anciennes réponses de la facturation Boss sont isolées; tests CI Node/DOM, TypeScript, syntaxe Web **verts**; publication Web **réussie**. Edge `essential-billing` **v2 ACTIVE**, `verify_jwt=true`, code d'erreur d'accès stabilisé. Son adaptateur Stripe partagé préexistant a été conservé inchangé au déploiement ciblé; sa source déployée diffère toujours de la version plus récente du dépôt par la validation des chaînes de requête : réconcilier/tester séparément avant livraison Stripe. Aucun test fournisseur ni paiement réel. L'issue **#35** reste ouverte.

**Nouvelle vigilance issue [#90](https://github.com/punch360app/Punch360/issues/90)** : catalogue actif inclusions 20/25/50 places à +2 $ et historiques d'édition avec acteur, versus 5 places +3/4/5 dans maître/seed. Six Price IDs CAD enregistrés mais pas encore vérifiés en API Stripe sandbox. **Aucune réécriture silencieuse**, résolution par parcours Super Admin versionné après audit. Inventaire Drive `promt` inchangé (5 prompts et deux dossiers visuels). Voir [rapport Super Admin](SUPER_ADMIN_BOSS_BILLING_RACE_20261026.md).

---

# Lot courant — P0-A Boss / facturation, garde anti-réponses tardives (26 octobre 2026)

Après lecture de `docs/prompt-board/WORK_START.md`, du maître de 578 IDs et de l'issue #35, le prochain correctif **ciblé** protège `web/live/billing.js` quand le Boss change d'entreprise ou se déconnecte pendant une offre négociée, un devis Stripe ou l'ouverture d'un portail. Une ancienne réponse n'ouvre plus le portail ni ne remplit une autre société. Le serveur `essential-billing` masque maintenant les erreurs internes d'autorisation. Tests `tests/billing-tenant-isolation.test.mjs` (trois scénarios).

**Développé :** oui, sur branche/PR. **Testé :** CI à confirmer; aucun paiement fournisseur. **Déployé :** non vérifié (Edge officielle `essential-billing` toujours v1 au début du lot). **Intervention externe :** configuration Stripe sandbox et recette deux entreprises, appareils, publication Edge. Aucun SQL écrit ni donnée réelle modifiée. Détails dans [rapport P0-A](SUPER_ADMIN_BOSS_BILLING_RACE_20261026.md). L'issue #35 reste ouverte : ne pas annoncer la facturation négociée entièrement prête. **P0-B ensuite; SMS/Twilio en dernier.**

---

# Transfert acté vers le prompt maître — 26 octobre 2026

**Décision officielle :** le **reste** du travail du prompt « Validation SQL archives » est maintenant consigné **uniquement** dans `docs/prompt-board/MASTER_PROMPT_20261025.md`, section **PASSATION DU PROMPT « VALIDATION SQL ARCHIVES »**. Ne plus demander à Work de recommencer cet ancien prompt; lire `docs/prompt-board/WORK_START.md` et avancer sur les IDs existants par priorité. **Départ P0 : Super Admin prix particuliers / issue #35 → Stripe test et facturation → MFA/permissions multi-compagnies → Google/Apple/courriel.** Ensuite P1 : une vraie recette PDF **synthétique** sur Supabase avec Auth/Storage, exercice de sauvegarde/PRA, tests concurrence et vrais Android/iOS/iPad. Puis traductions spécialisées/notifications; **SMS/Twilio en dernier**. Les 578 exigences du maître restent inchangées. Pas de modification des contrats, documents, heures ou paiements réels.

**Ne pas refaire :** PR #14, #75, #80, #83–85 ont livré le code d'archives et les tests; **issue #81 fermée** après #83 (plafond Storage réel de 25 Mio), PR #82 durcissement MFA et PR #87 isolation Super Admin. Comparer la vieille PR brouillon #86 à #83 avant d'y toucher. L'intégration Stripe fournisseur, OAuth/SMTP, PRA, recettes terrain et longue QA restent **non démontrées** malgré des écrans et tests simulés. Les preuves détaillées et limites demeurent ci-dessous pour l'historique, pas comme un deuxième ordre de mission.

---

# Reprise Super Admin — isolation des devis par session (26 octobre 2026)

Après validation des PR d'archives, passage aux priorités visibles de Super Admin : les devis négociés déjà existants ne sont pas reconstruits. **Correctif** dans `web/live/platform-price-proposals.js` : les retours RPC arrivant après logout/changement de compagnie/MFA ne réaffichent plus un ancien client ni ne lancent de lecture supplémentaire. Les diagnostics RPC sensibles sont remplacés par un message neutre; sélection depuis le répertoire affiche le nom échappé de l'entreprise et rappelle qu'aucun abonnement n'est modifié sans le Boss et Stripe. Tests `tests/platform-price-session-isolation.test.mjs`, PWA rafraîchie. Documentation `docs/SUPER_ADMIN_PRICE_SESSION_20261026.md`.

Ce lot n'active **aucun tarif ni paiement**. Issue #35 toujours ouverte pour validations et intégration fournisseurs Stripe; PR #82 MFA/transfert Boss parallèle. La vraie recette d'archives et les essais matériels du prompt « Validation SQL archives » demeurent ouverts. Le prompt maître reste séparé, SMS/Twilio dernier.

---

# Reprise vérifiée — protection contre les PDF Storage surdimensionnés (PR #83)

Le défaut P1 **issue #81** est **résolu et fermé**. La PR #83 est fusionnée dans `main`, avec lectures bornées aux octets effectivement reçus, arrêt et annulation au premier dépassement de 25 Mio, et conservation du calcul SHA-256, preuve, permissions et anti-écrasement. Test de 26 Mio sans en-tête, en-tête mensonger, taille annoncée trop grande, limite exactement 25 Mio, et scénario PDF synthétique complet. CI **217 tests sur 217** réussie. Fonction Edge `company-archive-files` déployée en **version 2 ACTIVE** et `verify_jwt=true` dans le seul Supabase officiel. Documentation : `docs/ARCHIVE_STORAGE_STREAM_CAP_20261026.md`.

**L'ensemble du prompt original « Validation SQL archives » reste ouvert** : recette avec deux vrais comptes de test (Boss/Super Admin) et PDF synthétiques sur un environnement isolé autorisé, quota et concurrence, sauvegardes et PRA, facturation Stripe sandbox, Apple/Google OAuth, notifications, traductions spécialisées et builds natifs. Aucune donnée client réelle n'a été modifiée. Continuer les validations restantes, SMS/Twilio en dernier; le prompt maître consolidé reste distinct.

---

# Reprise — limite d'export des archives et erreurs PDF contrôlées (26 octobre 2026)

Suite à la PR #80 fusionnée et déployée, le prompt original **« Validation SQL archives »** progresse avec `web/live/archive-preflight.js` et `tests/archive-preflight.test.mjs`. Le navigateur borne à **4 096 blocs et 20 Mio UTF-8** la reconstruction du contenu SQL, refuse les blocs absents et les tailles PDF invalides/> 25 Mio avant l'appel Edge, masque les diagnostics PDF inconnus tout en gardant le nettoyage des copies temporaires. Contrôles d'Unicode et de refus avant requêtes également testés. PWA rafraîchie. Documentation : `docs/ARCHIVE_CLIENT_PREFLIGHT_20261026.md`. Aucune migration, aucun PDF réel ni abonnement modifié.

**Issue #81 fermée — correctif livré par PR #83** : les deux lectures PDF Storage de la fonction Edge utilisent désormais un lecteur de flux borné aux **25 Mio réels**, y compris sans `Content-Length` fiable, avec annulation immédiate et erreur 413. CI **217/217** réussie; fonction Edge `company-archive-files` **version 2 ACTIVE**, vérification JWT conservée sur `mlabstdxxwjdpfaxiwmg`. Les essais PDF authentifiés en conditions réelles, la charge et le PRA restent **ouverts**; ne pas déclarer l’ensemble des archives prêt pour production.

Vérification read-only Supabase du 26 octobre : `company-archive-files` ACTIVE, cron `punch-expired-company-exports` actif; avis RLS/SECURITY DEFINER à auditer sans supprimer les permissions délibérées. Restants du prompt original : vrai cycle PDF fictif authentifié, Stripe sandbox, OAuth Google/Apple, traductions spécialisées, vraie QA iOS/Android/iPad, charge et PRA. SMS/Twilio en dernier. Prompt maître séparé.

---

# Reprise — archives binaires fictives et nettoyage en cas d'échec (26 octobre 2026)

Après les PR #77–79 fusionnées (langues borne et console, CI/Pages vertes), retour au **cœur du prompt original « Validation SQL archives »**. Ce lot ajoute un test intégrant réellement le contrôleur Web, AES-GCM, le handler Edge testé et les RPC/Storage **synthétiques** (pas d'accès client réel) : export en blocs, téléchargement et vérification du PDF fictif, chiffrement, prévisualisation après suppression simulée, restauration sans écrasement puis plan et lignes simulés; mauvais mot de passe interdit toute importation. `tests/archive-binary-flow.test.mjs`.

Correction dans `web/live/archives.js` : Fermer efface les octets et données déchiffrés même si le serveur échoue à supprimer ou lister les copies temporaires; conserver seulement l'ID opaque pour réessai; ne plus exposer de diagnostic SQL brut. `tests/archive-cleanup-failure.test.mjs`. Détails : `docs/ARCHIVE_BINARY_TESTS_AND_CLEANUP_20261026.md`.

**Blocage technique non réglé** : lecture `arrayBuffer()` non bornée lorsque Storage ment ou omet `Content-Length` dans `company-archive-files/handler.mjs`. Tentative directe bloquée par contrôle de sécurité GitHub; aucune modification Edge revendiquée. Nécessite lecteur à taille réelle bornée + test. Restent surtout la vraie recette PDF avec authentification Boss/Super Admin, test de charge, PRA, Stripe test, OAuth et appareils. **Pas de migration ni de données client modifiées. SMS/Twilio toujours à la fin, prompt maître séparé.** Vérifier CI/PR avant annonce de déploiement.

---

# Reprise — gestion des bornes Boss/Admin en 10 langues (26 octobre 2026)

La PR #78 a été fusionnée (CI/Pages réussies). Suite du prompt original « Validation SQL archives » : page Boss/Admin de gestion des bornes (`essential.js`) désormais traduite dans la langue Essentiel existante en 10 langues, avec vingt clés ajoutées, horodatage RTL isolé, identifiants HTML échappés, URLs PWA sans code secret et actions de sécurité inchangées. Nouveau test `tests/essential-kiosk-management-locale.test.mjs`, PWA v41; documentation `docs/ESSENTIAL_KIOSK_MANAGEMENT_LOCALE_20261026.md`. Vérifier CI/fusion/Pages de cette nouvelle branche avant annonce de déploiement. Aucune mutation Supabase ni client réel.

Le prompt original reste **ouvert** pour intégrations fournisseurs, archives PDF binaires authentifiées, QA appareil/charge/PRA et traductions spécialisées RH/paie/Super Admin. SMS/Twilio à la fin. Le prompt maître séparé n'est pas encore démarré.

---

# Reprise — traduction de la réconciliation hors ligne Boss/Admin (26 octobre 2026)

Après la PR #77 fusionnée, la suite du prompt original « Validation SQL archives » concerne l'écran de supervision des observations provisoires : `kiosk-offline-review.js` lit maintenant la langue Essentiel du compte (FR/EN/ES/PT/IT/DE/AR/ZH/HI/TL) par le contrôleur déjà existant. Vingt clés ajoutées au dictionnaire commun, labels de décisions/états/pauses traduits, date en LTR sous RTL, refus de confirmer sans motif, serveur seul responsable de l'approbation et messages d'erreurs sécurisés. Nouveau test `tests/kiosk-offline-review-locale.test.mjs`; PWA actualisée et dictionnaire pré-caché. Voir `docs/ESSENTIAL_KIOSK_OFFLINE_REVIEW_LOCALE_20261026.md`. Aucune mutation de base, client ou pointage réel. Valider CI et Pages avant d'annoncer la livraison.

**À poursuivre dans le prompt original :** textes de configuration des bornes Boss, autres traductions spécialisées, QA linguistique et terrain, Stripe sandbox, OAuth/SMTP, archives PDF binaires, charge/concurrence et PRA. SMS en dernier. Le prompt maître est distinct.

---

# Reprise — états de session traduits sur la borne (26 octobre 2026)

Poursuite **du prompt original « Validation SQL archives »** après les PR #75 (sécurité SQL archives) et #76 (incidents multilingues), toutes deux fusionnées et validées. Cette branche ajoute 11 clés × 10 langues pour l'écran réel de la borne : salutation, statut provisoire hors ligne, horodatage serveur, politiques de pauses, compteur d'observations en attente, appairage et notices de réussite. Une opération terminée efface toujours l'identité et revient au français sur la borne partagée; les données privées ne sont pas stockées dans les préférences. Test `tests/kiosk-session-locale.test.mjs`; cache PWA renouvelé. Voir `docs/ESSENTIAL_KIOSK_SESSION_LOCALIZATION_20261026.md`. CI, fusion et Pages à vérifier. Aucun SQL, aucun abonnement ni compte client modifié.

**Suite du prompt original :** couvrir le reste des traductions RH/paie/Super Admin et les notifications, QA appareil et RTL, Stripe sandbox/OAuth, export d'archives PDF authentifié, tests de charge et PRA. Ne pas démarrer le prompt maître avant la clôture de Validation. SMS/Twilio en dernier.

---

# Reprise — messages d'incident sûrs et multilingues pour la borne (26 octobre 2026)

Suite au contrôle d'archives SQL de la PR #75 fusionnée (transaction lecture seule, aucun client modifié), le prompt original « Validation SQL archives » poursuit le lot de messages de sécurité de la borne dans `feat/essential-kiosk-localized-errors-20261026` : erreurs serveur et incidents hors ligne normalisés en quinze catégories explicites dans les dix langues déjà livrées. Le frontend **n'affiche jamais les détails d'erreurs fournisseur inconnus**; le traitement serveur, le journal provisoire, la conservation des observations, le NIP, le délai et la réconciliation ne changent pas. Test ajouté : `tests/kiosk-error-localization.test.mjs`. Version PWA ajustée pour forcer le renouvellement des ressources. Ce lot ne couvre pas encore l'ensemble des textes métier/politiques de pause, ni la revue humaine des traductions ou les appareils physiques. Stripe sandbox, OAuth, charge, PRA et builds restent ouverts; SMS dernier, prompt maître à traiter ensuite.

---

# Reprise — vérification SQL en lecture seule des archives (26 octobre 2026)

Dans le prompt original **« Validation SQL archives »**, branche `test/archive-security-posture-20261026` : nouveau test `supabase/tests/company_archive_security_posture.sql` exécuté avec succès sur `mlabstdxxwjdpfaxiwmg` en transaction `BEGIN READ ONLY` / `ROLLBACK`, sans aucun changement d'entreprise, de PDF, de session ni de configuration. Assertions : quatre tables privées RLS et aucun droit `anon/authenticated`, 20 fonctions archives/restore sans exécution publique/anonyme, preuve serveur non ouverte aux salariés, deux buckets PDF privés et cron de purge actif. Rapport : `docs/ARCHIVE_SQL_SECURITY_POSTURE_20261026.md`. Cette vérification technique ne remplace pas les quatre scénarios SQL de restauration fictive déjà réussis ni la recette Storage binaire/OAuth/Stripe/appareils/charge/PRA restante. **Prompt maître non démarré; SMS/Twilio toujours en dernier.**

---

# Reprise — Borne commune Essentiel en 10 langues (PR de réconciliation)

Ce lot du prompt original **« Validation SQL archives »** reprend le code de la PR #73 sur le `main` actuel pour résoudre uniquement un conflit de documentation. La borne PWA comprend désormais le sélecteur de 10 langues, l'arabe RTL sans inversion des chiffres, l'identification/NIP et le pointage localisés, une réinitialisation au français après chaque session, aucun stockage de préférence par salarié et un pré-cache PWA de `kiosk-locale.js`. Tests DOM/Node d'identification, PIN non conservé, hors ligne et anti-doublons, plus dictionnaire 10 langues. **Aucun SQL, compte ou contrat réel touché.** Documentation : `docs/ESSENTIAL_KIOSK_TEN_LANGUAGES_20261026.md`.

Le prompt original reste ouvert : tous les messages de sécurité/hors ligne de la borne, QA linguistique humaine, traductions RH/paie/Super Admin, abonnements calendrier tiers, test Stripe sandbox/OAuth, builds signés, charge et PRA. SMS en dernier. Le prompt maître et ses modifications de documentation parallèles sont conservés mais **ne doivent pas être traités avant la fin du prompt Validation**.

---

# Reprise vérifiée — comptes multi-entreprises, rôle et heures séparés (PR #68, #70, #71)

Le prompt original **« Validation SQL archives »** progresse sans relancer le prompt maître. Trois fusions supplémentaires sont terminées :

- **PR #68** : sélecteur d'entreprise Web et Expo pour une même identité Auth appartenant à plusieurs employeurs. L'ancien chargement Expo `.limit(1).maybeSingle()` est remplacé par la liste d'appartenances actives. Le rôle et l'édition de chaque compagnie sont confirmés côté serveur à chaque sélection. Les caches Expo et Web sont isolés par `userId:companyId`. Impossible de changer de compagnie si des punchs hors ligne attendent encore leur synchronisation.
- **PR #70** : test SQL `supabase/tests/multicompany_rls_isolation.sql`, exécuté avec succès sur le seul Supabase officiel `mlabstdxxwjdpfaxiwmg` dans `BEGIN`/`ROLLBACK`. Boss A ne peut voir ni créer de quart B; Boss B ne voit pas A; un utilisateur avec rôle employé A et admin B retrouve ses deux dossiers; un salarié B ne voit pas les quarts privés d'autres personnes; un compte extérieur n'a pas de données. Contrôle après rollback : **zéro utilisateur et zéro compagnie fictive conservés**.
- **PR #71** : la dernière job sélectionnée dans le navigateur est enregistrée sous la clé `utilisateur:compagnie` dans les trois chemins de lecture/écriture (retour session, GPS, sélection manuelle), évitant les contaminations de préférences entre deux employeurs.

Documentation de ce bloc : `docs/MULTICOMPANY_IDENTITY_SELECTOR_20261026.md` et `docs/MULTICOMPANY_SQL_VALIDATION_20261026.md`. La CI TypeScript/Expo et Web/Node était verte sur les branches fusionnées; confirmer le dernier déploiement `main` avant recette sur appareil. Aucune mutation de client réel.

**Restant du prompt original** : recette authentifiée Web/Expo avec deux vrais comptes de test dans deux entreprises, notifications/push et chats tenant-scoped, suivi hors ligne entre deux entreprises, horaires de nuit et passage d'heure, traductions complètes des écrans spécialisés, responsive sur appareil, test Stripe sandbox et taxes/prorata, fournisseurs Google/Apple et SMTP, paie et exports, tests de charge et PRA, builds Android/iOS signés, parcours borne tablette et GPS. SMS/Twilio toujours en dernier, conformément à la priorité validée.

**Ne pas commencer le prompt maître documentaire tant que le prompt original n'est pas clos.** Aucun pourcentage de finition globale ne doit être affirmé sans audit du code et recette fournisseurs.

---

# Reprise du prompt original — langues de base Expo Android/iOS (nouvelle PR)

Après PR #67 (navigation Essentiel Web, 10 langues + RTL), le prochain bloc du **prompt original « Validation SQL archives »** élargit le même dictionnaire à Expo : `src/i18n/essential-native-locale.js`, gestion des préférences AsyncStorage par compte, sélecteurs de langue pour Boss/Admin et employés, navigation/onglets/pointage essentiel traduits, RTL arabe limité aux conteneurs pertinents. `web/live/essential-locale.js` contient les mêmes clés pour Web et Expo. Tests `tests/essential-native-locale.test.mjs`; documentation `docs/ESSENTIAL_EXPO_NATIVE_LOCALE_20261026.md`. CI et publication Web à confirmer avant fusion. **Aucune migration Supabase, aucun compte ou abonnement réel modifié.**

Le prompt original n'est **pas terminé** : traductions des sous-pages spécialisées et borne, juridique/paie, QA linguistique et RTL terrain; tests du calendrier Google/Apple/Outlook, transfert Boss deux comptes MFA, Stripe sandbox/webhooks, horaires avancés, notifications/OAuth, tests de charge/PRA et builds signés. SMS/Twilio en dernier.

Le prompt maître consolidé existe déjà dans GitHub mais reste **hors portée** jusqu'à la clôture complète du prompt original.

---

# Reprise — dix langues Essentiel et premier socle RTL

Étape suivante du **prompt original « Validation SQL archives »** : fichier `web/live/essential-locale.js` proposant FR, EN, ES, PT, IT, DE, AR (RTL), ZH, HI, TL, avec dictionnaire complet **des clés de navigation et actions essentielles**. Les préférences sont enregistrées par identifiant utilisateur sur l'appareil, sans affecter une autre compagnie et sans modifier la borne ni Construction. `web/live/app.js` ajoute un choix de langue dans les paramètres Essentiel, traduit la barre d'onglets et les principales commandes de pointage et applique le RTL à la page personnelle. `web/live/styles.css` conserve les horaires et identifiants numériques en LTR. Tests `tests/essential-locale.test.mjs` et DOM `tests/ui.test.mjs`. Documentation `docs/ESSENTIAL_MULTILINGUAL_NAV_20261026.md`.

**Important : la couverture complète des dix langues reste à terminer.** Les sous-pages RH/paie/gestion, le Super Admin, les messages et erreurs serveur, courriels, la borne et les écrans natifs Expo ne sont **pas encore traduits**. La présente livraison n'inclut aucune migration SQL et ne nécessite aucun paiement fournisseur. CI, fusion PR et Pages à confirmer. La traduction juridique et salariale doit être vérifiée humainement.

Les autres travaux du prompt original restent ouverts : recette de transfert Boss avec 2 appareils MFA, calendriers tiers, Stripe test, horaires spéciaux/variantes, responsive terrain, fournisseurs OAuth/push/paie, tests charge/PRA et builds signés. SMS/Twilio en dernier. Ne pas basculer au prompt maître consolidé.

---

# Reprise — transfert Boss volontaire dans Expo (PR #65 remplacée)

Suite du prompt original **« Validation SQL archives »**. Le transfert Boss sécurisé de la PR #62 (SQL Supabase `20261026032012`) couvre désormais l'interface native Expo : `src/workforce/BossHandoffPanel.tsx`, navigation `src/workforce/ManagementWorkspace.tsx`. Le Boss propose le transfert à un administrateur actif du même tenant; cet Admin accepte avec MFA TOTP AAL2; le Boss confirme à nouveau avec MFA avant permutation serveur des rôles. Les deux parties doivent recopier leurs UUID attendus. Déconnexion locale du Boss après mutation pour purger ses rôles en cache. Côté Web, `boss-handoff.js` ne lance plus de lecture privée sur simple actualisation avant AAL2, test DOM ajouté. **Aucune migration nouvelle, aucun compte réel touché.**

Les essais serveur de succession via SQL synthétique transactionnel ont été réussis sur la migration déjà installée. CI TypeScript/Node/DOM et Web de la nouvelle interface passée verte sur la branche d'origine. Cette nouvelle branche reprend les mêmes changements sur la base actuelle de `main` pour résoudre un conflit documentaire dû à une fusion parallèle du prompt maître. Il reste à confirmer la CI rebased, fusionner, puis tester avec deux comptes MFA sur Android/iPhone installés. La succession d'un Boss inaccessible n'est pas automatiquement autorisée; ce cas nécessite un protocole juridique indépendant.

Suite du **prompt original** : QA terrain, horaires complexes, dix langues et RTL, ergonomie, Stripe sandbox, Google/Apple et notifications/paie, builds et reprise après sinistre. SMS en dernier. Le prompt maître et ses nouvelles exigences restent distincts.

---

> **Nouvelles exigences E57–E59 — succession Admin/Boss et comptes multientreprises (documentation seulement).** Un seul compte Auth peut appartenir à plusieurs compagnies avec rôle/dossier salarié/politiques distincts; permissions révoquées côté serveur au départ de l'Admin, transfert sécurisé du Boss, sélecteur d'entreprise et calendrier global personnel sans accès croisé des employeurs. Problème du code actuel à corriger dans `src/auth/AuthGate.tsx` : `.limit(1).maybeSingle()` charge une seule appartenance. Tests QA-031–032 requis avant annonce de livraison.

# Reprise — succession volontaire de direction Essentiel (PR #62)

Le prompt original « Validation SQL archives » poursuit les accès Boss avec une procédure **volontaire à deux participants MFA AAL2**. Le Boss propose le transfert vers un administrateur actif; l'administrateur accepte dans sa session MFA; le Boss initial confirme et devient administrateur. Le successeur devient Boss uniquement après cette dernière confirmation. Blocages serveur : 48 heures, mauvais rôle/tenant, confirmation, version périmée, session MFA expirée, absence de consentement et plusieurs Boss actifs. Audit conservé. Interface Web : `web/live/boss-handoff.js`, depuis la gestion de direction, MFA TOTP inclus. Documentation : `docs/ESSENTIAL_BOSS_HANDOFF_20261026.md`.

Migration Supabase officielle `20261026032012_essential_boss_dual_consent_handoff` appliquée dans `mlabstdxxwjdpfaxiwmg`; SQL synthétique rollback passé après installation. **Aucun compte ni rôle client réel modifié**. PR #62 : <https://github.com/punch360app/Punch360/pull/62>. Il reste à vérifier la CI finale, fusionner la PR si elle passe, confirmer Pages et effectuer la recette authentifiée de succession avec deux comptes et deux appareils fictifs.

Restants du prompt original : protocole de succession en cas de Boss indisponible (contrôle juridique distinct), validations Stripe sandbox, qualité des horaires spéciaux, traductions et RTL, design responsive, test OAuth/notifications/paie, builds natifs et PRA. SMS/Twilio à la fin. Le prompt maître consolidé demeure séparé.

---

# Reprise — récupération personnelle de compte Auth dans Expo (PR #58)

Prompt original **« Validation SQL archives »** : l'interface Web disposait déjà de « Mot de passe oublié ». La PR #58 complète le parcours **Expo Android/iOS** : demande d'un lien `resetPasswordForEmail`, callback deep link PKCE, vérification par l'événement `PASSWORD_RECOVERY`, création d'un nouveau mot de passe par le titulaire via `updateUser`, puis déconnexion globale et purge du cache d'identité. Aucune lecture de mot de passe ni changement administratif d'identité; aucun SQL ni compte réel modifié. Documentation : `docs/EXPO_ACCOUNT_RECOVERY_20261026.md`.

**Validation restante** : CI TypeScript, fusion PR #58, autoriser les URL de redirection de récupération dans Supabase, configurer les courriels et faire une vraie recette sur build Android/iPhone. La succession/transfert de compte **Boss** reste un module séparé, avec preuves de consentement et contrôle de propriété; ne pas le confondre avec un simple reset d'Auth.

Le calendrier personnel PR #55 est fusionné et le service Edge `essential-calendar` v2 déployé; tests SQL, 173 Node/DOM et Pages réussis. La recette avec un calendrier Google/Apple/Outlook authentique reste nécessaire. Continuer ensuite le prompt original : accès Boss sécurisés, cas particuliers d'horaires, langues et RTL, design responsive final, fournisseurs Stripe sandbox/OAuth/notifications/paie, builds natifs et PRA. SMS en dernier. **Ne pas commencer le prompt maître consolidé.**

---

# Reprise — abonnement calendrier personnel privé (PR #55)

Le prompt original **« Validation SQL archives »** continue avec un flux personnel **iCalendar par URL secrète et révocable**, sans connexion OAuth aux comptes Google/Apple/Microsoft. SQL `20261026014802_essential_personal_calendar_feeds` installée dans le projet exclusif Supabase `mlabstdxxwjdpfaxiwmg`. Fonction Edge `essential-calendar` **version 2** déployée, contrôle du secret par empreinte SHA-256 et vérification de l'appartenance active à chaque lecture; aucune lecture directe par `anon` ou `authenticated`. Web et Expo : création, renouvellement et révocation du lien privé. Chaque renouvellement invalide immédiatement l'ancien lien; déclencheurs de révocation sur perte d'accès/changement de rôle; aucun lien créé en réel lors des tests.

Recette SQL transactionnelle `supabase/tests/essential_personal_calendar_feeds.sql` rejouée après installation : succès et ROLLBACK. Tests TypeScript/Node/DOM en CI; dernière exécution à vérifier avant la fusion de la PR #55, ainsi que Pages. Lien confidentiel donnant accès aux quarts, donc ne pas le rendre public. Les calendriers externes rafraîchissent selon leurs propres intervalles.

**Suite du prompt original** : revue et recette des accès Boss/récupération Auth, horaires spéciaux et affectations, 10 langues/RTL, UX responsive, intégration Stripe test/OAuth, appareils et résilience/PRA, SMS en dernier. Le prompt maître fusionné au dépôt reste distinct; **ne pas le traiter maintenant**.

---

# Reprise — Alertes de certifications pour postes exclusifs (PR #54)

Après la fusion de la PR #52 et son déploiement Web réussi, le prompt original **Validation SQL archives** continue avec la détection des certifications expirées/retirées après publication des quarts. Rapport serveur Pro/gestionnaire en lecture seule, borné à 90 jours et 200 anomalies, interfaces Web et Expo. Migration Supabase **`20261026012801_essential_position_cert_alerts` installée**; test SQL synthétique avec ROLLBACK réussi après installation, aucun changement de données clients. PR : <https://github.com/punch360app/Punch360/pull/54>. CI, fusion et Pages à vérifier; recette authentifiée et notifications automatiques restent ouvertes.

Priorité : continuer le **prompt original** (calendriers synchronisés révocables, accès Boss/récupération Auth, horaires avancés, langues/RTL, UX, Stripe sandbox/OAuth, appareils, charge/PRA). Ne pas basculer sur le prompt maître consolidé, même s'il existe désormais dans main; SMS en dernier.

---

# Reprise — postes exclusifs Essentiel Pro (nouvelle branche après conflit PR #51)

Dans le **prompt original « Validation SQL archives »**, poste exclusif Pro créé par établissement/département, certification facultative, verrou PostgreSQL transactionnel contre chevauchements, version et audit; interfaces Web/Expo. Migration **`20261026011451_essential_exclusive_positions` appliquée dans le Supabase officiel `mlabstdxxwjdpfaxiwmg`**. Scénario SQL synthétique rollback **réussi après installation**, 0 poste et 0 affectation conservés, accès anon refusé. CI 167/167 Node/DOM, TypeScript Expo et syntaxe Web réussis sur branche précédente avant recopie sur la dernière version de main. Détails : `docs/ESSENTIAL_EXCLUSIVE_POSITIONS_20261025.md`.

Ancienne PR #51 en conflit documentaire avec la fusion parallèle du prompt maître; **nouvelle PR** reprend le code sans effacer ni modifier le document `docs/prompt-board/MASTER_PROMPT_20261025.md` désormais dans main. Le prompt maître reste en attente : priorité exclusive au **prompt original Validation SQL archives**.

Restent la recette authentifiée Web/Expo et les prochaines étapes du prompt original : surveillance des certifications invalidées, planning spécial et disponibilité, calendriers automatiques révocables, interventions Boss/récupération Auth, traductions RTL, design final, intégrations Stripe sandbox/OAuth/notifications/paie, tests terrain et de charge/PRA. SMS en dernier.

---

> **Prompt maître unique après la PR #26 :** [`docs/prompt-board/MASTER_PROMPT_20261025.md`](prompt-board/MASTER_PROMPT_20261025.md), 578 exigences en 29 lots. L'ancien giga-prompt a été retiré du dépôt courant après consolidation; seul l'historique Git conserve son ancien texte. Les bilans plus anciens ci-dessous doivent être comparés au dernier code, aux migrations et à la CI, et ne sont pas des instructions pour rejouer un ancien travail.

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
