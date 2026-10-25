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

## Extension prioritaire du giga-prompt — Planification intelligente et signalement d'absence (validée le 25 octobre 2026)

**Intégrer et implémenter ce bloc dans le développement PUNCH Essentiel existant**, sans repartir de zéro, en respectant les travaux de sécurité/archives déjà engagés. Ces exigences sont désormais partie du cahier des charges principal. Le document détaillé `docs/PLANIFICATION_INTELLIGENTE_ABSENCES_20261025.md` sert de référence technique complémentaire et la roadmap E34–E39 permet le suivi; **le présent giga-prompt est autonome sur les décisions métier ci-dessous.** Fonctionnalités **non encore livrées** tant que les tests et le déploiement ne sont pas réels.

### P0 — Audit anti-doublons obligatoire et compatibilité

Avant d'ajouter du code, identifier et réutiliser les composants existants : `scheduled_shifts`, `essential_availability`, création de quarts individuels/récurrents/rotatifs, échanges, quarts vacants/candidatures, congés/absences, identités sans application personnelle, couverture/qualifications Pro, alertes et notifications, versions, RLS, contrôle des droits/abonnements et journal d'audit. Lire `docs/ESSENTIAL_PLANNING_20261024.md`, `docs/QUALIFIED_COVERAGE_20261025.md` et les migrations et tests actuels. Pour chaque sous-fonction, indiquer **existant / incomplet / absent** avant modification. Ne jamais créer de deuxième système de calendrier, d'employé, de candidature ou de notification.

### P1 — Disponibilités simples et besoins des équipes (Essentiel Plus et Pro)

1. **Disponibilités employé récurrentes** : l'employé saisit une fois sa semaine type (jours/plages, matin/jour/soir ou heures exactes), avec plusieurs créneaux possibles, date d'effet et fin facultative. Les exceptions par jour/semaine (vacances, rendez-vous, indisponibilité, disponibilité exceptionnelle) prévalent sur la semaine habituelle. Ne pas déduire qu'une disponibilité est acquise lorsqu'elle est inconnue.
2. **Saisie déléguée par Admin/Boss autorisé**, notamment si l'employé n'a ni téléphone, ni courriel, ni compte personnel. Historique des changements et identité de l'auteur. Les indisponibilités ou modifications tardives signalent un conflit avec un quart publié, **sans l'annuler ni le déplacer en secret**. Congés approuvés prioritaires.
3. **Préférences de travail** : heures souhaitées par semaine, minimum/maximum applicable, préférence matin/soir/nuit/fin de semaine, qualifications/postes, ancienneté et volontariat aux heures supplémentaires; les règles locales ou de convention applicables doivent être configurables, pas inventées.
4. **Besoins récurrents par site/département/poste**, heures d'ouverture et effectif requis par plage, exceptions hebdomadaires et fonctions/qualifications exigées. Réutiliser le moteur de modèles de quarts et la couverture déjà en place. Console Admin lisible : heures à attribuer, salariés disponibles, quarts vacants, dépassements, incompatibilités.
5. **Rappels facultatifs de mise à jour**, date limite/gel des modifications configurable; notifications via infrastructure existante, sans ressaisie hebdomadaire obligatoire. Les salariés gardent une expérience « Mes disponibilités » très simple.

### P2 — Planificateur automatique Essentiel Pro : seulement TROIS étapes visibles

**1. Besoins → 2. Employés → 3. Générer, prévisualiser et publier.** Le modèle de départ doit suffire en quelques clics sur mobile, tablette et PC, sans configuration technique. Mode **Simple** activé par défaut; mode **Avancé** facultatif. Page mobile sans colonnes tronquées, commandes tactiles larges, FR/EN, messages explicites et état sauvegardé.

- **Étape Besoins** : récupérer automatiquement les besoins récurrents, site, semaine, plages et postes; proposer les exceptions à corriger, sans repartir à zéro.
- **Étape Employés** : afficher disponibilité réelle, absences approuvées, heures prévues, compétences, limites, souhaits et conflits. Ne jamais forcer un salarié indisponible.
- **Étape Génération** : moteur **déterministe, explicable, côté serveur / revérifié côté serveur**, pas de dépendance à une IA payante. Contraintes strictes : qualifications valides, droits de site/poste, congés/indisponibilités, conflits et chevauchements, repos minimum, max heures légal/contractuel configuré, quarts verrouillés, nuit, minuit et changements d'heure Québec. Optimisation souple et pondération paramétrable : ancienneté, répartition équitable des heures, objectifs horaires, rotation des soirs/week-ends, stabilité et coûts si renseignés.
- Générer un **brouillon uniquement**. Montrer couverture, heures par salarié, conflits, raisons des quarts non remplis et différences avant/après. Permettre correction directe, échange/déplacement, verrouillage et régénération partielle. **Seul un Admin/Boss habilité publie volontairement**; concurrence vérifiée à la publication, audit, notifications et confirmation de consultation. Aucun faux succès si un conflit apparaît.
- Distribuer une **simulation locale sur données fictives** pour essayer l'interface si utile, mais ne pas la présenter comme un moteur Supabase livré ou testé.

### P3 — Signalement d'absence explicite et remplacement automatique contrôlé (Essentiel Pro)

**RÈGLE ABSOLUE VALIDÉE PAR LE PROPRIÉTAIRE : le remplacement automatique ne commence QUE lorsque l'employé concerné effectue personnellement un signalement d'absence explicite et confirmé pour le quart en question.** Pas de signalement d'absence = **pas** de recherche automatique, **pas** d'offres, **pas** de remplacement. Un retard, un non-punch/no-show, une sortie non pointée, un GPS absent, une détection IA ou une alerte ne remplacent JAMAIS le signalement d'absence. Ces événements peuvent déclencher leurs alertes existantes, sans offres aux remplaçants. Les absences déclarées manuellement par un Admin utilisent un circuit distinct, sans simuler faussement un signalement d'absence de l'employé.

1. Bouton salarié sur son quart « **Signaler mon absence** » → écran de confirmation montrant poste, lieu, date et heures. Motif choisi dans les options prédéfinies ou non précisé, confidentiel; événement serveur authentifié, audité, horodaté, idempotent et rattaché au quart/version. Notification gestionnaire. Ne pas changer silencieusement d'autres quarts, ni supprimer un punch déjà effectué, ni fermer automatiquement un punch encore ouvert. Vérifier le cas d'un quart déjà commencé.
   - **Choix du motif dans l'écran de confirmation** : proposer une liste simple et non médicale détaillée : **Maladie**, **Enfant malade**, **Rendez-vous médical**, **Urgence familiale**, **Obligation familiale ou garde**, **Problème de transport**, **Raison personnelle**, **Autre**, **Je préfère ne pas préciser**. L'employé peut sélectionner un motif, sans être obligé de révéler des informations de santé : « Je préfère ne pas préciser » reste toujours possible. **Autre** révèle un champ « Précision (facultative) »; une note facultative peut être offerte pour les autres motifs. Boutons « Retour » / « Confirmer mon absence » et résumé clair du quart. Le motif est enregistré avec le signalement et son auteur, mais **jamais envoyé ni exposé aux remplaçants**; seules les personnes autorisées de l'entreprise le consultent, dans les limites de leurs fonctions, avec accès audité et durée de conservation configurable. N'inférer ni une maladie justifiée, ni un congé payé, ni un droit d'absence à partir de cette sélection : les règles RH restent distinctes.
2. Après la confirmation serveur **seulement**, ouvrir une unique recherche dans la **banque de remplaçants volontaires**. Filtrer disponibilités récurrentes/exceptions, compétences et certifications valides, établissement/département, temps de repos, chevauchements, absences/congés, limites d'heures, disponibilités de dernière minute et restrictions contractuelles. Classer selon priorités d'entreprise configurables (ancienneté, équité, heures souhaitées, préférence, budget), avec explication; aucune donnée médicale du titulaire transmise.
3. **Offres par vagues** aux candidats admissibles, délais et escalade configurables (premier groupe puis élargissement si personne n'accepte); anti-spam, déduplication, rappels, expiration. Notifications dans PUNCH/push d'abord; **texto SMS en option lorsque Twilio sera activé à la fin du giga-prompt**. Ne jamais envoyer un véritable SMS durant les tests.
4. **Une seule personne peut accepter et obtenir le quart.** À chaque acceptation : revalidation d'admissibilité et réservation/affectation par **transaction atomique côté Supabase** avec verrou de concurrence, idempotence, contrôle de version, identité et tenant. Si deux personnes cliquent simultanément, **une seule gagne**, les autres voient « Quart déjà attribué » et leurs offres se ferment. Ne jamais se fier uniquement au premier clic sur l'interface.
5. Réglage propre au Boss, conservé et contrôlé par serveur : **Mode A — Approbation obligatoire** : le premier volontaire admissible réserve le quart, un responsable approuve avant attribution; en cas de refus, reprise de la recherche selon règles. **Mode B — Auto-remplacement** : la première acceptation admissible attribue le quart immédiatement. Aucune autoapprobation illicite, auditer toutes les décisions.
6. Si personne n'accepte à temps : quart reste ouvert, alerte au responsable, propositions de nouvelle vague/délais ou gestion manuelle. Si un responsable couvre déjà le quart, annuler toutes les offres en attente; gérer annulation post-acceptation sans double attribution. L'historique de signalements d'absence/offres/réponses/attributions reste consultable par les acteurs autorisés.
7. Conserver les heures/punchs précédents, la paie et l'audit, les frontières RLS entre entreprises et les règles hors ligne. **Le signalement d'absence n'est pas lui-même un punch OUT**.

### P4 — Vérification, notifications et clôture

- Tests SQL de concurrence réelle : deux acceptations strictement simultanées → un seul gagnant en mode A comme en mode B; réessais/requêtes concurrentes, offres expirées, qualification retirée, quart changé/annulé, banque vide, site différent, délégations, salarié sans Auth, fuseaux/fin de semaine/DST, congés, repos et heures maximales.
- Tests négatifs obligatoires : employé en retard, aucun punch, GPS absent, anomalie/no-show **sans signalement d'absence** → **zéro proposition envoyée**, zéro réaffectation automatique. Un signalement répété → une seule demande idempotente.
- Tests UX mobile, accessibilité, réseau/app fermée, notifications et données réelles isolées; aucune intervention sur la compagnie officielle pendant les essais. Tests TypeScript, DOM, SQL transactionnel, environnements de démonstration. Séparer statuts **développé / testé / déployé / intervention externe requise**.
- Les envois SMS/Twilio et tests fournisseurs réels se feront **EN DERNIER** comme déjà décidé; les parcours pourront être implémentés/testés avec adaptateurs simulés avant. Respecter les forfaits/entitlements et les prix contractuels, sans ajout forcé à Essentiel de base ni changement à PUNCH Construction.

**Critères de sortie :** un salarié peut signaler son absence pour son quart, choisir un motif prédéfini (ou « Je préfère ne pas préciser ») et éventuellement une note; aucun motif ne fuit vers les remplaçants; un employé saisit sa semaine type une seule fois; un Admin visualise besoins + disponibilités et publie un planning Pro après prévisualisation en trois étapes; un signalement d'absence volontaire confirmé lance le processus de remplacement sans intervention obligatoire en mode autorisé; exactement un candidat admissible obtient le quart; sans signalement d'absence aucune offre, et sans candidat aucun quart n'est attribué par défaut. Ne pas déclarer la fonction terminée avant implémentation et preuves.

## Règles de travail et clôture

Travaille de manière autonome, sans me faire répéter « continue » après chaque bloc. Publie les lots réellement testés par PR/CI, vérifie le déploiement Web et poursuis les autres exigences. Préserve PUNCH Construction, les historiques et la base réelle. Aucun secret dans le client, GitHub, les logs ou le chat; aucune fausse base ni bypass RLS.

Si un fournisseur, une signature Apple, un appareil physique ou une permission manque, avance sur tout ce qui n’en dépend pas. Présente ensuite une liste courte, concrète et vérifiée des interventions indispensables. Ne promets pas que seuls Stripe et Twilio resteront si d’autres accès sont réellement nécessaires.

Tiens le suivi à jour avec quatre statuts distincts : développé, testé, déployé, intervention externe requise. Ne déclare « prompt terminé » que lorsque toutes les exigences sont satisfaites ou que chaque blocage externe restant est identifié précisément. Commence maintenant par récupérer la branche archives, vérifier l’état réellement appliqué, puis terminer et tester le parcours d’archives/restauration.
