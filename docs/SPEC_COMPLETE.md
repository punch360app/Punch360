# PUNCH 360° — Référence fonctionnelle consolidée
Version de conception : 23 octobre 2026. Une exigence ici n'est PAS nécessairement codée. L'état technique vérifié est dans docs/REQUIREMENTS_AUDIT.md et docs/IMPLEMENTATION_STATUS.md.

## Identité et appareils
- PUNCH 360° : marque commerciale bilingue FR/EN, logo compact PUNCH dans l'application.
- Site de vente PC : chantier au coucher du soleil, bleu-noir anthracite, jaune chantier et vert/turquoise, slogan « Le chantier dans ta poche », Se connecter / Créer un compte uniquement dans l'entête.
- Mobile Android/iPhone; Admin et Boss aussi tablette/iPad/PC responsive.
- Mode clair/sombre/automatique. 10 langues à traduire et réviser, prise en charge RTL si arabe.
- Écran PRINCIPAL de chaque onglet compact sans défilement; les listes longues, détails, PDF et fils de messages peuvent défiler.

## Navigation et accueil EMPLOYÉ
Barre FIXE : **Accueil · Mes heures · Commande · Message · Plus**.
- Accueil : date, météo, éventuelles alertes, cumul semaine/année, photo et numéro de job, prochaine affectation, et très gros bouton PUNCH.
- Sans pointage : PUNCH IN vert, job suggérée = dernière job punchée par défaut; GPS peut suggérer une autre job avec confirmation.
- Punch actif : PUNCH OUT rouge et chronomètre heures/minutes/secondes en direct; continue malgré écran verrouillé.
- Changer de job sous bouton PUNCH : transfert en une action, sans deux gestes Punch OUT / PUNCH IN; horodatage serveur, chaque job conserve son segment, pas de chevauchement.
- Carte Job en cours ouvre **Toutes les jobs** : recherche, filtres Toutes/Mes jobs/À proximité, carte et marqueurs GPS, photos, numéro de job et adresses.
- Sélection de job = choix; la consultation de fiche n'est JAMAIS un punch.
- Carte Prochain chantier cliquable et visible uniquement si prochaine affectation existante et différente de la job actuellement pointée. Sinon Job en cours prend l'espace des deux cartes.
- Aucun doublon Plans/Commande/Messages sur l'Accueil; accès contextualisé depuis la fiche de la job ou les onglets.

## Mes jobs, fiches et archivage
- Toutes les jobs de la compagnie accessibles selon RLS; Mes jobs filtre les affectations; À proximité utilise la position explicitement demandée.
- Fiche job : photo, adresse ou punaise pour site sans adresse, rayon GPS paramétrable, Waze et Google Maps, plans PDF, extras, demandes spéciales, commandes liées à la job.
- Fiche job → liste des punchs → ⋮ Archiver; restaurer depuis Archives. Archivage = uniquement masquage personnel, jamais suppression des heures réglementaires.
- Historique global journalier/semaine/mois/année est dans **Mes heures**, pas dans l'accueil.
- Changement de job et punch peuvent se faire même hors ligne, événements horodatés/synchronisés plus tard et anomalies signalées.

## Mes heures
- Entrées/sorties, heures par jour et chantier, pauses/dîner déductions configurables conformes aux règles applicables.
- Demandes de correction par l'employé : statut En attente, notification Admin/Boss ou Chef autorisé, valeur officielle inchangée avant approbation, traçabilité complète.
- Approbation hebdomadaire et verrouillage des semaines avant paie; procédure formelle après fermeture.
- Historique conservé, exports CSV employé/tous/chantiers par semaine/mois/année/période libre.
- Détection d'anomalies : chevauchement, sortie oubliée, double punch, GPS imprécis, longues journées, différentiel hors ligne.

## Commandes de matériel
- Onglet Commande : catalogue géré Admin/Boss, photos, code item, quantités, panier, demande libre/photo, destinataire entreprise et job.
- Notification au responsable, approbation/refus, statuts Demandé/Approuvé/Commandé/Livré, commentaire.
- Commandes en cours et historique par job, pas de doublon sur accueil.
- Chef autorisé peut faire ou approuver des demandes limitées à son équipe.

## Messages
- Discussions type Messenger : privées ou de groupe, pièces jointes, messages vocaux, notifications de lecture.
- Admin/Boss crée les groupes de chantier.
- Chef d'équipe a groupe privé avec ses membres; boss/admin/super admin n'ont pas accès au contenu (accès protégé sur serveur, stratégie de chiffrement à concevoir).
- Messages non lus signalés uniquement dans l'onglet Message et cloche de notifications globale, pas de tuile répétée sur Accueil.

## Plus et Mon profil
- Plus : Mon horaire, Mes congés/absences/vacances, Mon profil, documents personnels et paramètres (GPS, langue, thème, notifications).
- Aucun « Mes jobs » dans Plus : annuaire accessible depuis Job en cours / Prochain chantier.
- Congés : demande par période/motif, absence maladie/personnel/vacances, approbation autorisée, prise en compte des conflits d'horaire.
- Profil : photo, téléphone, courriel; carte de compétence CCQ recto/verso, métier, statut/échéance; ASP/SIMDUT/nacelle/certifications; deux contacts d'urgence et appel en un geste.
- Cartes/documents personnels privés : accessibles seulement à l'employé, Admin/Boss autorisés, Chef uniquement si permission spéciale; ne pas collecter NAS ni infos médicales non nécessaires.

## Rôles et gestion
- Quatre rôles Entreprise : Employé, Chef d'équipe, Admin, Boss.
- Chef a permissions indépendantes, personnalisées : consulter les heures/punchs des membres et jobs qu'il dirige, approuver éventuellement leurs modifications (pas les siennes), commandes, affectations, documents, rapport journalier.
- Plusieurs chefs/équipes sur une même job; employé peut changer d'équipe/chantier; affectations historisées.
- Admin/Boss : équipes, jobs, photos, planification, vacances, rapports CSV, approbations, fermeture des semaines, catalogue et commandes.
- PDF versionnés par job, confirmation de prise de connaissance, historique des anciennes versions.

## Inscription et tarification
- Boss/Admin initial crée compte Google/Apple/courriel, crée sa compagnie, choisit forfait et PAIE AVANT toute invitation.
- Inviter par courriel/SMS via lien sécurisé; invité rejoint exactement la compagnie/rôle, jamais Boss automatiquement; place facturable temporairement réservée.
- Compagnie peut acheter des places additionnelles au prorata avant activation des invitations supplémentaires; échec = invitation en attente.
- Tous les membres actifs (employé, chef, admin, boss) comptent; super admin plateforme pas facturé. Places libérées réutilisables immédiatement; réduction tarifaire au prochain renouvellement.
- Propositions indicatives : 49 CAD/mois pour 5 places, +7 CAD/place/mois, totalement modifiables par Super Admin; prix définitifs non fixés.
- Stripe Billing et webhooks validés côté serveur; Super Admin gère forfaits/tarifs/promotions/clients/paiements/rapports commerciaux.
- Renouvellement impayé : 30 jours de sursis (compte complet), après 30 jours verrouillage gestion Admin/Boss/Chef mais **les employés continuent de puncher et consulter leurs heures**. Les responsables peuvent payer et accéder aux registres/exports nécessaires; réactivation après confirmation de paiement.
- Résiliation : accès jusqu'à la fin payée, puis même verrouillage gestion sans effacer les données.


## PUNCH Essentiel — pointage mixte téléphone et tablette commune (décision officielle)
- La même compagnie Essentiel peut autoriser **téléphone personnel, tablette commune ou les deux**. L'employé peut faire IN sur mobile et OUT sur tablette (et inversement) : même session, même registre serveur, **aucun double punch**.
- La tablette est une **borne sécurisée appairée à un établissement**. Chaque action demande un matricule individuel + NIP privé (6 chiffres minimum) ; écran réinitialisé automatiquement en 10–15 s ; aucune donnée RH/historique d'un autre employé n'est visible.
- L'employé sans téléphone ou courriel doit pouvoir être créé avec une identité salarié interne indépendante de `auth.users`; une refonte contrôlée du modèle de punch existant est nécessaire avant livraison.
- Appairage par code court à usage unique ; jeton limité au pointage, sécurisé en Keystore/Keychain, borne révocable à distance, protection anti-essais NIP et audit. Jamais de clé service_role ou de session Auth générale sur la borne.
- Hors ligne tablette : journal durable, preuve d'identité protégée, état provisoire explicite, synchronisation idempotente, vérification et approbation des anomalies au retour. Pas d'affirmation de sécurité hors ligne tant que la vérification n'est pas réellement mise en œuvre.
- Interface Employé : quatre onglets **Punch · Heures · Horaire · Plus**, blanc chaud et vert sauge. Interface tablette : pavé matricule/NIP, boutons Punch/Pause/Reprise/Sortie uniquement. Admin : employés, bornes, statut, horaires et approbations **sans pouvoir puncher**. Boss : métriques entreprises, contrôle des modes et bornes, facturation.
- Borne = **appareil, pas une place payante**. Tous les humains actifs restent facturables selon le forfait. Une borne par établissement est une proposition produit, sans prix supplémentaire fixé.
- Après sursis impayé, les salariés existants continuent leur pointage sur téléphone et borne déjà autorisée; Admin/Boss restent limités à facturation et archives nécessaires. Ne pas invalider des bornes à cause d'une facture impayée.
- **Voir la [spécification complète](ESSENTIAL_MIXED_PUNCH_SPEC.md)** pour le wireframe, l'ordre de développement, le schéma, les règles métier, la sécurité, les cas hors ligne et les tests obligatoires. La présence dans le cahier des charges ne signifie pas que la borne est développée.

## Robustesse, sécurité et priorités
- Multi-entreprise avec isolation stricte company_id, vérification RLS, permissions serveur, stockage photos/PDF privé.
- Le serveur a autorité pour horodatages officiels et approbations; pas de suppression de temps, journal d'audit.
- Sauvegarde/restauration testées, export complet de données et conformité à la rétention réglementaire.
- Priorités : sécurité/base des compagnies/équipes -> moteur punch & validations -> annuaire/affectations -> documents, commandes, messagerie -> paiements et outils avancés.
- Chaque nouvelle fonctionnalité doit avoir un emplacement clair dans un des cinq onglets ou une vue secondaire, sans doublons.

## Essentiel — application personnelle facultative avec iPad commun
- Une compagnie qui choisit **tablette commune uniquement pour pointer** peut aussi autoriser chaque salarié à **créer son compte personnel facultatif** sur Android, iPhone ou Web pour voir son **horaire, ses heures, ses congés, ses demandes et les changements d'horaire**. L'employé peut rester uniquement sur borne s'il le préfère.
- **Configurer séparément « méthode de punch » et « accès individuel à l'application ».** Si le pointage mobile est interdit, le compte personnel reste un espace en consultation et ne propose pas PUNCH IN sur téléphone ; si mode mixte, l'app permet aussi de puncher.
- **Ne jamais créer deux salariés pour une même personne :** l'invitation sécurisée associe son Auth personnel à son dossier `worker_id` et son historique antérieur de borne. Le lien d'activation est limité, à usage unique et vérifié côté serveur; jamais d'association par nom/email seul.
- L'employé choisit son thème parmi **les 20 designs PUNCH Essentiel** pour sa propre application; le thème de l'iPad reste commun.
- Une place payante par **personne active**, indépendamment du nombre d'appareils et du moment d'activation de son compte; borne non facturée comme personne.
- Consulter [le parcours détaillé et les tests](ESSENTIAL_MIXED_PUNCH_SPEC.md#13-compte-personnel-facultatif-même-lorsque-lentreprise-choisit-une-tablette-commune). **Conception validée, pas encore implémentée.**


### Compte personnel sans pointage mobile (Essentiel + iPad commun)
- Une compagnie choisissant une tablette iPad commune peut **toujours inviter ses salariés à créer un compte personnel** pour voir horaires, heures, congés, disponibilités et notifications depuis Android/iPhone/Web.
- L'Admin crée d'abord le salarié; invitation sécurisée SMS/courriel/QR temporaire; Google/Apple/email rattache l'utilisateur Auth au **dossier salarié existant**. Pas de nouvelle place payante ni de deuxième historique de punch.
- Boss définit séparément **autoriser pointage tablette**, **autoriser pointage mobile**, **autoriser consultation personnelle**. En mode iPad seulement, l'application personnelle présente les heures mais ne permet pas de punch mobile, y compris via API.
- Un salarié sans smartphone n'a aucune obligation de créer ce compte et continue à pointer sur l'iPad avec NIP. Le matricule ou NIP seul ne permet jamais de réclamer un compte.
- L'employé choisit librement parmi les **20 thèmes Essentiel** sur son téléphone; la tablette partagée garde un thème de borne uniforme.
- Sécurité et détails : [ESSENTIAL_MIXED_PUNCH_SPEC.md](ESSENTIAL_MIXED_PUNCH_SPEC.md#12-accès-personnel-facultatif-à-lhoraire-lorsque-la-compagnie-choisit-lipad-commun--nouvelle-décision-officielle).
