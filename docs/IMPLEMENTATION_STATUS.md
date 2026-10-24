# PUNCH 360° — État de livraison et prochaines étapes

**Projet officiel** : `punch360app/Punch360` (dépôt GitHub), Supabase `mlabstdxxwjdpfaxiwmg`.
**IMPORTANT** : développement, pas une application validée pour gérer la paie.
**Référence visuelle choisie** : site de construction au coucher du soleil, noir anthracite, jaune casque, accent vert turquoise, verre sombre; le design final doit être confronté aux captures de référence Android/iPhone et PC. Les images décoratives du design de référence **ne sont pas encore fournies dans les assets du dépôt**.

## Ce qui a été codé et poussé
- App Expo/React Native : navigation fixe **Accueil / Mes heures / Commande / Message / Plus**.
- Accueil : gros PUNCH IN vert, PUNCH OUT rouge si actif, chronomètre, derniers totaux semaine/année calculés à partir des segments du serveur, carte Job en cours, prochaine job seulement si affectée dans le futur; si aucune prochaine job, carte actuelle agrandie.
- **Job en cours → Toutes les jobs** : rechercher par numéro/nom/adresse, filtres Toutes/Mes jobs/À proximité, carte native, épingles, sélection de job et fiche; Google Maps et Waze. Géolocalisation sur demande, suggestion de job proche avec confirmation, jamais de punch silencieux.
- Bouton Changer de job : RPC serveur atomique, stoppe le segment A et démarre B au même instant sans arrêter la session globale.
- Punchs : RPC serveur `punch_in/punch_transfer/punch_out`, timestamp serveur, RLS par compagnie, une seule session active et un seul segment actif par session.
- Mes heures : cumul semaine/année et liste des sessions. Archivage personnel depuis les punchs de la fiche job; enregistre dans `punch_archive_preferences`, sans supprimer les heures officielles.
- Commande : demande textuelle associée à la job courante et historique simple.
- Messages : conversations limitées aux membres, écriture de messages, groupes Admin/Boss avec sélection des membres, chat privé Chef/équipe; synchronisation simple par rafraîchissement.
- Plus : profil, téléphone, 2 contacts d'urgence, liste cartes/certifications sans photos, demandes vacances/congés, création job pour Admin/Boss, création d'équipe, affectation d'employé et équipe sur une job.
- Auth Supabase : connexion courriel/mot de passe et session persistante; RPC création compagnie (créateur = Boss). Les flux Google et Apple sont préparés côté app MAIS fournisseurs externes non configurés.
- Backend : migrations exactes sous `supabase/migrations/`, tables et RLS multi-entreprise, privilèges SQL minimaux, séparation private/team, permissions sur heures par jobs des équipes, restrictions sur gestion lorsque compagnie est en statut restricted/cancelled.
- Tests automatiques GitHub : TypeScript et vérification des dépendances Expo à chaque commit.

## À terminer avant toute utilisation réelle
### Priorité 1 — fiabilité paie/inscription
- Tests de bout en bout avec vrais comptes de test, Android, iPhone, tablette; SQL RLS sans fuite interentreprise.
- Gestion pause/dîner configurable, déductions légales, journées multijobs, arrondis, anomalies, corrections avec approbation, fermeture semaine, export CSV/XLSX et registre CCQ.
- Mode hors ligne : journal local idempotent, synchronisation et résolution des conflits sans perte de temps.
- Workflow de connexion Google et Apple (OAuth console + redirect Android/iOS + development builds), confirmation de courriel et récupération de mot de passe.
- Stripe Billing pour forfaits, paiement initial avant invitation, places réservées à expiration configurable, place additionnelle payée au prorata, réduction à renouvellement, codes promo, factures, webhooks signés et portail.
- **30 jours de grâce** après premier renouvellement impayé, puis gestion Admin/Boss/Chef bloquée; employés continuent de PUNCH IN/OUT et consulter leurs heures. Aucun effacement pour non-paiement.
- Invitations SMS/courriel sécurisées à usage unique : rejoindre compagnie avec rôle exact, sans devenir automatiquement Boss.
### Priorité 2 — chantiers et RH
- Gestion des permissions personnalisées des chefs, approbation des heures de leur équipe par job.
- Affectations planifiées par dates et heures; prochaine job; coordonnées manuelles sur carte pour adresses inexistantes.
- Plans PDF en stockage privé par job, révisions, directives, extras, rapports archi, confirmation lecture.
- Photos de chantier et photo carte CCQ recto/verso en bucket privé; alertes d’expiration, consentement, journal d'accès.
- Catalogue de matériel avec photos/articles/fournisseurs/unité, panier multiligne, workflow commande, notifications et historiques par job.
- Congés : workflow d'approbation/rejet, conflits d'affectation, calendrier.
- Messagerie : ajout/suppression de participants aux groupes, photos/PDF/vocaux, lecture, push, limites de conservation, revue chiffrement bout-en-bout.
- Interface complète du chef (heures équipe / présence / rapports chantier).
### Priorité 3 — commerce et expérience
- Site PC de vente « PUNCH 360° » et tunnel créer compte / se connecter / compagnie / forfait / paiement.
- Admin/Boss responsive téléphone/tablette/PC pour équipes, jobs, paie, documents, matériel, rapports.
- Espace Super Admin PUNCH pour tarifs/forfaits/membres/compagnies/transactions/sursis/abonnements.
- Modes clair/sombre/auto et 10 langues dont arabe (RTL), relecture humaine des traductions.
- Météo live du chantier, alertes, notifications push; menus principaux sans défilement, mais détails scrollables.
- Design final : photographies de chantier, effet de relief des contrôles, adaptabilité Android/iPhone, tests de différences visuelles par rapport aux références.
- Version APK / TestFlight et publication Android/iOS; vrais tests terrain avant diffusion.

## Sécurité et confidentialité
- Clé Supabase publishable seulement côté client, jamais de `service_role` ni secrets Stripe/Apple dans app.
- Les appels RPC privilégiés exposés aux utilisateurs authentifiés ont des validations explicites d'identité et de compagnie. Les alertes de l'advisor Supabase sur ces fonctions doivent être réévaluées après tout changement.
- Les groupes privés d'équipe : ni Boss/Admin ni Super Admin ne doivent pouvoir lire les messages sans être eux-mêmes membres autorisés (et le rôle de manager est exclu des groupes privés).
- Aucun suivi GPS continu : accès lorsque l'employé utilise la fonction, confirmation explicite.
- **Localisation Supabase actuelle : US East (us-east-1)**. Avant commercialisation québécoise et collecte de cartes/contacts d'urgence/GPS, évaluer la conformité et la nécessité d'une implantation Canada (Loi 25).
- Archive de punch = préférence d'affichage personnelle, jamais suppression/écrasement d'un registre.
- Réévaluer les permissions de stockage et les quotas avant déploiement de documents personnels.

## Points d'attention
- Le dépôt GitHub est présentement public; privilégier privé pendant développement.
- Une vérification TypeScript réussie ne prouve pas une application installée, un OAuth opérationnel ni des écrans pixel-perfect.
- Les premières fonctionnalités sont une base progressive, pas un livrable fini.
