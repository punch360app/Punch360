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

## Robustesse, sécurité et priorités
- Multi-entreprise avec isolation stricte company_id, vérification RLS, permissions serveur, stockage photos/PDF privé.
- Le serveur a autorité pour horodatages officiels et approbations; pas de suppression de temps, journal d'audit.
- Sauvegarde/restauration testées, export complet de données et conformité à la rétention réglementaire.
- Priorités : sécurité/base des compagnies/équipes -> moteur punch & validations -> annuaire/affectations -> documents, commandes, messagerie -> paiements et outils avancés.
- Chaque nouvelle fonctionnalité doit avoir un emplacement clair dans un des cinq onglets ou une vue secondaire, sans doublons.
