# PUNCH 360° — reprise complète du travail restant

Tu reprends le développement existant de PUNCH 360°. Termine les exigences restantes du cahier des charges. Travaille réellement dans le dépôt et Supabase : aucune simulation annoncée comme fonctionnelle, aucun redémarrage à zéro.

## Sources et accès

- Dépôt officiel : https://github.com/punch360app/Punch360
- Projet Supabase exclusif : mlabstdxxwjdpfaxiwmg
- URL : https://mlabstdxxwjdpfaxiwmg.supabase.co
- Web : https://punch360app.github.io/Punch360/?edition=essential
- Borne : https://punch360app.github.io/Punch360/kiosk.html
- Branche du travail archives inachevé : wip/company-archives-handoff-20261025

Commence par lire docs/README_COLLABORATEUR_WORK.md, docs/PUNCH_MASTER_ROADMAP.md, docs/PUNCH_WORK_CONTINUATION.md et les bilans récents dans docs/. Vérifie main, les PR ouvertes et le schéma réel avant toute écriture. Le tableau maître reste une liste de suivi, pas une certification de livraison complète.

Utilise les connexions GitHub PUNCH et Supabase qui donnent accès au projet indiqué. Ne touche à aucun autre projet. Les permissions Supabase sont déjà « Allow all actions ». Des appels ont renvoyé « Invalid or expired requestState » malgré cette permission : vérifier ce qui a réellement été appliqué avant une reprise. La séparation du gros SQL archives en trois migrations a permis l’application. Ne pas contourner une interdiction de sécurité. Un appel CLI a été bloqué pour télémétrie PostHog; privilégier le connecteur et les fichiers locaux, sans cette connexion tierce.

## État livré à conserver

PR #11 : suppression des accès test, réinitialisation et coffre chiffré des mots de passe test, MFA et audit. Aucun mot de passe de compte réel n’est récupérable.

PR #12 : support clients Web/Expo, réponses et statuts; recherche/pagination/détails/export CSV de l’audit plateforme.

PR #13, fusionnée et Web publié : promotions Stripe administrables et rapports financiers par période Québec, entreprise et séparation test/réel. Fonction Edge platform-promotions v1 déployée. Les vrais paiements et codes promotionnels n’ont pas été créés pendant la recette. Les chiffres des factures ne rapprochent pas frais Stripe, remboursements ou versements bancaires.

Déjà présents : identités salariées stables sans compte obligatoire, invitations et activation sans doublon, borne en ligne avec NIP/appairage/révocation, session partagée téléphone/tablette, horaires récurrents/rotatifs, échanges, disponibilités, établissements/départements, RH et communications, pauses payées/non payées et corrections, paie estimative et banques, catalogue tarifaire serveur versionné et dix thèmes personnels 11–20.

Dernière suite exécutée : 80 tests Node/DOM et TypeScript réussis. Le répertoire contient 25 scripts SQL, dont les nouveaux scénarios promotions/finance ont été exécutés en transactions annulées. Ne pas présenter cette couverture comme une recette complète du produit. Bundles Metro Android/iOS générés précédemment; ce ne sont ni des APK/IPA signés ni des essais physiques.

## Travail archives à reprendre immédiatement

La branche de reprise conserve du code incomplet, non fusionné :
- supabase/migrations/20261025054147_company_archive_storage.sql
- supabase/migrations/20261025054148_company_archive_payload.sql
- supabase/migrations/20261025054149_company_archive_api.sql
- supabase/migrations/20261025112017_company_archive_restore.sql
- web/live/archive-codec.js

Les trois premières migrations sont DÉJÀ APPLIQUÉES sur Supabase. La table privée company_exports, la clé de signature conservée dans Vault et la fonction company_export_create existent. Ne pas réinitialiser la clé ni rejouer aveuglément les CREATE. La restauration n’est PAS appliquée : company_restore_plan(uuid) est absente. Son dernier code, le chiffrement navigateur et le parcours complet n’ont pas de recette fonctionnelle réussie.

Le design prévu : vue cohérente des données métier d’une entreprise, documents privés essential-hr et job-documents, Boss avec session vivante ou Super Admin MFA, motif et audit, copies serveur temporaires, exclusion des mots de passe/NIP/jetons, export chiffré côté navigateur et signature serveur vérifiée à l’import. La restauration doit prévisualiser les changements et ajouter uniquement les données métier manquantes : aucun écrasement d’une ligne actuelle, aucun rétablissement automatique de permissions, paiements ou sessions de punch ouvertes. Les salariés récupérés restent désactivés jusqu’à réautorisation. La récupération reste liée à l’entreprise d’origine.

À terminer : tester et corriger les RPC, vérifier les droits interentreprises et sessions révoquées; créer le service de téléchargement/restauration des PDF avec signatures et refus d’écrasement; construire les interfaces Boss/Super Admin; tester le codec, les archives corrompues, mauvais mots de passe, références, conflits et reprises; exécuter une véritable restauration sur données fictives en transaction annulée et vérifier les résultats. Ne jamais lancer une restauration sur les données réelles pendant la recette. Vérifier réellement le nettoyage des copies temporaires; ne pas présumer que pg_cron est disponible. L’export applicatif ne remplace pas une sauvegarde complète d’infrastructure ni un plan de reprise après sinistre : préparer aussi ces procédures et identifier honnêtement ce qui nécessite l’accès fournisseur.

## Autres exigences restant à terminer

1. Borne hors ligne sécurisée : journal durable, appareil enregistré, preuve d’identité valide et expirante, jamais de NIP en clair, idempotence, conflits et réconciliation; événements provisoires jusqu’à validation serveur. Tests perte/révocation de tablette, horloge erronée et synchronisation entre appareils.
2. Compléments métier : journée de travail entièrement oubliée soumise à approbation; politiques de pauses par département; délégations fines des superviseurs; modèles d’horaires/postes et couverture; notifications de décisions; coûts/budgets et intégrations de paie réellement utilisables. Conserver les limites des estimations de paie.
3. Notifications push et préférences; invitations automatiques par courriel avec reprises et statuts. Vérifier Google/Apple/courriel et leurs redirections; identifier les configurations fournisseur manquantes sans demander de secrets dans le chat.
4. Internationalisation réelle : dix langues, français/anglais prioritaires, espagnol, portugais, italien, allemand, arabe, chinois simplifié, hindi, tagalog; dates, monnaies, fuseaux et RTL. Ne pas annoncer une langue complète après traduction de quelques libellés.
5. Design : interfaces épurées blanc chaud/vert sauge, cohérentes avec les références dans docs/design; aucun visuel de chantier dans Essentiel. Garder les dix thèmes 11–20 déjà livrés. Retrouver les autres références avant de prétendre avoir reproduit vingt designs; l’absence de références ne doit pas bloquer les autres tâches.
6. Compléments Super Admin : relire le cahier des charges et vérifier toutes les sections entreprises, utilisateurs, abonnements, fonctions, prix, support, promotions, sécurité et exports. Ne pas refaire les sections déjà livrées. Compléter les recherches, paginations, actions et journaux réellement manquants. Préserver les conditions contractuelles des clients existants.
7. Commerce : recette Stripe en environnement test des six couples forfait/cadence, remises, prorata, places, promotions, factures, annulation/reprise, webhooks signés/idempotents et sursis configurable. Le pointage existant doit continuer après impayé; ne jamais activer un abonnement au simple retour de Checkout. Préserver les six prix Stripe existants et ne jamais coder définitivement les tarifs dans l’interface.
8. Livraison : vérification complète RLS/tenants/permissions, concurrence et charge, réseau perdu/retour, minuit et DST, accessibilité, petits écrans, clavier, portrait/paysage, Android/iPhone/iPad/tablette/PC. Préparer les builds distribuables/signés et la documentation. Distinguer compilation, export Metro, test automatisé et exécution physique. Confidentialité, rétention, transferts hors Canada et exigences Québec/Loi 25 doivent être vérifiés sans inventer une conformité.
9. SMS/Twilio EN DERNIER, selon ma décision explicite. L’intégration serveur existe déjà : conserver ses protections, préparer la configuration et tester réellement quand les identifiants sont disponibles. Ne pas envoyer de SMS ni effectuer de paiement réel durant les tests sans instruction précise.

## Règles de travail et clôture

Travaille de manière autonome, sans me faire répéter « continue » après chaque bloc. Publie les lots réellement testés par PR/CI, vérifie le déploiement Web et poursuis les autres exigences. Préserve PUNCH Construction, les historiques et la base réelle. Aucun secret dans le client, GitHub, les logs ou le chat; aucune fausse base ni bypass RLS.

Si un fournisseur, une signature Apple, un appareil physique ou une permission manque, avance sur tout ce qui n’en dépend pas. Présente ensuite une liste courte, concrète et vérifiée des interventions indispensables. Ne promets pas que seuls Stripe et Twilio resteront si d’autres accès sont réellement nécessaires.

Tiens le suivi à jour avec quatre statuts distincts : développé, testé, déployé, intervention externe requise. Ne déclare « prompt terminé » que lorsque toutes les exigences sont satisfaites ou que chaque blocage externe restant est identifié précisément. Commence maintenant par récupérer la branche archives, vérifier l’état réellement appliqué, puis terminer et tester le parcours d’archives/restauration.
