# PUNCH Essentiel — développement du 24 octobre 2026

## Livré dans ce lot

- Catalogue Supabase de trois forfaits Essentiel, distinct de Construction. Montants et limites du brief, fonctionnalités commerciales, visibilité, ordre et recommandation modifiables.
- Console Web Super Admin : tarifs et modules, entreprises et journal d'audit. Les modifications des trois forfaits exigent l'identité plateforme serveur, un JWT MFA aal2, un motif et la version attendue. Le formulaire permet de configurer un authentificateur TOTP. L'historique est privé et immuable pour le client; une nouvelle version ne touche pas aux contrats existants.
- Devis serveur en cents : mensuel/annuel, rabais sur base et suppléments, sans jamais confirmer un paiement. Cartes Web publiques utilisant les tarifs Supabase, choix mensuel/annuel et nombre de membres.
- Table `company_workers` : salarié stable sans Auth ni faux courriel. Roster et création Web/Expo. Les membres Essentiel existants sont rattachés automatiquement à un dossier lors de la création d'entreprise ou d'une adhésion.
- Droits distincts de punch mobile/tablette et accès personnel enregistrés; interdiction de punch mobile imposée aux trois endpoints de temps existants. Le réglage de canaux est disponible par RPC Boss; formulaire de configuration à terminer. Le flag `personal_access` ne constitue pas encore une révocation globale des anciennes lectures RLS.
- Invitations d'activation liées au worker, jetons 256 bits hachés, 72 h, usage unique, quotas et audit. Un courriel ou téléphone déjà confirmé dans Auth doit correspondre au canal invité. L'activation réutilise le dossier, sans nouvelle place ni promotion Boss.
- Envoi automatique SMS demandé depuis la création Web/Expo si téléphone et consentement; partage manuel du lien disponible. Les envois réels restent désactivés sans configuration serveur explicite. Pas d'envoi automatique courriel livré.
- Deux Edge Functions actives : `essential-invite` (JWT + getUser + autorisation RPC), `essential-sms-status` (signature Twilio + AccountSid, sans JWT utilisateur). Les credentials sont uniquement côté serveur. Tentatives d'envoi atomiques, résultats inconnus non rejoués automatiquement et accusés de livraison ordonnés même si le callback arrive avant le résultat d'envoi.
- Récupération des migrations plateforme déjà appliquées mais absentes du dépôt : platform_foundations et platform_test_teams. Aucune réexécution de ces anciennes migrations sur la base.

## Tests réellement exécutés

- `npm run check` et 24 tests Node/DOM, tous passés.
- `deno check` sur les deux fonctions, réussi.
- Sept scripts SQL sur le projet officiel, chaque fois BEGIN/ROLLBACK : workforce_workflows, operations, geofence_offline, essential_breaks, admin_office_role, essential_catalog_workers, essential_worker_invitations. Aucun salarié/compte fictif conservé après ces transactions.
- Contrôle supplémentaire d'accusés SMS : delivered ne redescend pas à sent. Aucun SMS envoyé.
- Invocations HTTP réelles sans identité : essential-invite = 401; essential-sms-status = 503 sans secrets fournisseur. Ce ne sont pas des preuves de livraison SMS.
- Le téléchargement Chromium a échoué (archive invalide). Les tests DOM ne remplacent pas des essais de rendu, builds Android/iOS ou exécution sur iPad.
- Advisors sécurité consultés : tables privées sans politiques clients intentionnellement fermées; avertissements sur RPC SECURITY DEFINER publiques attendus avec contrôles d'accès testés. Protection des mots de passe compromis Supabase encore désactivée; à configurer avant commercialisation.

## Configuration Twilio à compléter

Dans les secrets Edge Functions du projet PUNCH uniquement :

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_MESSAGING_SERVICE_SID`
- `PUNCH_SMS_ENABLED=true` seulement après configuration/validation du compte et de l'expéditeur.

Le callback est `https://mlabstdxxwjdpfaxiwmg.supabase.co/functions/v1/essential-sms-status`. Ne pas mettre ces secrets dans GitHub public ni dans les variables EXPO_PUBLIC. Les compagnies test sont refusées au moment de réclamer un envoi.

Une invitation téléphone seul exige actuellement une identité Auth avec téléphone confirmé : le parcours OTP téléphone dans l'interface reste à ajouter. Un salarié invité par SMS avec courriel dans son dossier peut se connecter avec ce courriel confirmé. Les fournisseurs OAuth doivent être configurés pour Google/Apple avant de déclarer ces parcours validés.

## Reste obligatoire — produit non commercialisable à ce stade

1. Migrer prudemment le registre de temps/horaire vers worker_id tout en conservant les anciennes heures; borne/NIP/appairage et moteur interappareils, hors ligne borne, révocation et tests de concurrence réels.
2. Compléter la console mobile Super Admin, les réglages de canaux, les départements/établissements, le rôle superviseur et les permissions fines.
3. Révocation complète de l'accès personnel, récupération d'identité, statut des invitations dans la fiche et notifications d'erreur aux responsables.
4. Stripe réel : produits/prix versionnés, snapshots contractuels lors d'une confirmation serveur, Checkout, portail, prorata, webhooks, coupons, échecs/sursis et taxes. La table privée de contrats est une fondation, pas une facturation opérationnelle.
5. Les matrices commerciales n'impliquent pas la livraison des fonctions avancées : horaires rotatifs, disponibilités, échanges, couverture, messagerie enrichie, RH, primes/coûts/banques et paie restent à terminer.
6. Catalogue des 20 thèmes : originaux 1–10 à retrouver; seuls 11–20 sont joints. Galerie, profil synchronisé et validation contraste restant à réaliser.
7. Traductions, accessibilité et revue visuelle complète; sauvegardes/restauration vérifiée; builds, appareils et distribution.

Les sept références visuelles reçues sont conservées dans `docs/design/essential-2026-10-24`. Construction conserve ses prix, sa navigation et ses endpoints; les scripts SQL de régression passent.

## Lot suivant — borne en ligne et registre salarié

Les sections de reste ci-dessus décrivent le lot initial. Les éléments suivants ont ensuite été développés et vérifiés :

- Registre partagé : `punch_sessions.worker_id` conserve l'identité métier; `user_id` devient facultatif. Les sessions Construction conservent leur identité Auth et leurs parcours. Index unique sur le salarié stable pour interdire deux sessions ouvertes. Les endpoints mobiles continuent d'utiliser les mêmes tables et verrous.
- Activation du compte personnel : rattache les anciennes sessions/pauses de borne sans changer leurs IDs, le worker ni les heures.
- Appairage de borne par code 256 bits à usage unique, 10 min; jeton de pointage limité haché côté serveur, liste des appareils sans secrets, révocation distante. Limite issue du contrat si présent, sinon du forfait Essentiel de base. Le choix Plus/Pro doit encore être relié à la souscription Stripe, pas librement accordé par le client.
- Enrôlement NIP : le responsable génère un code temporaire (15 min), le remet au salarié vérifié; le salarié saisit son NIP lui-même sur la borne. Bcrypt coût 12; le responsable ne voit pas le NIP. Minimum six chiffres, échecs conservés et blocage temporaire appareil + salarié après cinq tentatives.
- Écran Web dédié `kiosk.html`, sans client Auth ni session employé; tablette stocke uniquement son jeton limité dans IndexedDB. Identification à chaque opération et retour après 15 secondes d'inactivité; aucune liste de salariés ni historique des autres personnes. Pas de Keychain/Keystore natif livré.
- Borne IN / OUT / pause non payée / reprise, horodatage serveur et IDs idempotents. Authentification par appareil + NIP dans une troisième fonction Edge `essential-kiosk`, sans JWT général, avec fonctions DB réservées service_role. Refus des appareils révoqués. Le pointage continue si compagnie `restricted`.
- Gestion Web : Bornes de pointage, génération du code, révocation; modes téléphone/tablette/mixte par salarié pour le Boss, et code d'enrôlement de NIP. Exports utilisent l'identifiant stable lorsqu'aucun compte personnel n'existe.
- La borne **ne prend pas de pointage hors ligne** dans ce lot. L'interface indique connexion requise et ne prétend jamais avoir synchronisé un événement non confirmé. Un réessai après réponse perdue réutilise le même event_id en mémoire; après retour à l'accueil, le salarié se réidentifie pour consulter l'état serveur.

Vérification finale : 25 tests Node/DOM, TypeScript, `deno check` sur trois fonctions, huit scripts SQL transactionnels passés. Le nouveau script teste le pointage sans Auth, appairage non rejouable, PIN haché, idempotence, activation pendant un punch ouvert, pause mobile/reprise borne, IN borne/OUT mobile et IN mobile/OUT borne, impayé, blocage PIN et révocation. Pas de test de charge ou de concurrence interconnexions réel.

Metro a produit les bundles Hermes Android (815 modules) et iOS (822 modules). Ce sont des bundles JS/bytecode, **pas des APK/IPA signés ni des tests sur appareils physiques**. L'inspection visuelle navigateur reste non réalisée dans cet environnement.

Stripe, programmes horaires avancés, vingt thèmes, langues, RH/paie, sauvegardes et restauration, hors ligne borne, permissions fines et distribution native restent à terminer. Ce lot n'est pas une certification de paie ni la fin du cahier des charges.
