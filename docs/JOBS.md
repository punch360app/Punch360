# PUNCH 360° — Navigation des jobs (décision validée)

## Parcours
- **Accueil → Job en cours → Toutes les jobs** : recherche, filtres Toutes / Mes jobs / À proximité, carte interactive, épingles, photos, numéro, adresse.
- Toucher une job ouvre sa fiche, **sans démarrer de punch**.
- La fiche donne accès à Waze / Google Maps, documents, commandes et punchs associés à cette job.
- Depuis la fiche, le menu ⋮ de chaque segment de punch permet **Archiver** puis **Restaurer**. L'archive ne supprime jamais le registre officiel.
- Le bouton **Changer de job** en dessous du grand bouton Punch ouvre la liste en mode transfert. Le transfert réel sera transactionnel côté serveur (fin du segment A et début du segment B au même instant, sans interrompre le chronomètre global).
- Sans punch actif, la dernière job choisie est proposée par défaut. Le GPS peut suggérer une job proche, jamais confirmer automatiquement.
- Si aucune prochaine job n'est affectée, la carte Job en cours utilise l'espace libéré.
- Barre mobile : **Accueil · Mes heures · Commande · Message · Plus**. L'historique complet des journées appartient à **Mes heures**.

## Ce qui a été codé
- Structure Expo 57, écran Accueil + annuaire Toutes les jobs + fiche.
- Carte native avec épingles et localisation seulement sur demande.
- Recherche par numéro, nom, adresse; filtres toutes/mes jobs/proximité.
- Appels d'itinéraire Waze et Google Maps.
- Transfert de job et archivage en **simulation locale** pour parcourir le produit.
- Chargement réel des jobs préparé dans src/jobs/api.ts avec filtre company_id et authentification Supabase.
- Schéma SQL RLS préparé sous supabase/migrations (NON appliqué à une base).

## LIMITES IMPORTANTES
- Le projet PUNCH Supabase annoncé n'apparaît pas dans les projets de la connexion actuelle. Les autres bases ne doivent jamais être réutilisées.
- La simulation de punch ne sauvegarde aucune heure réelle; elle est signalée à l'écran.
- Les coordonnées de démonstration sont approximatives, ne doivent jamais constituer des géofences officielles.
- Les images exactes du chantier de référence, la connexion Google/Apple, la messagerie, commandes, heures officielles, notifications, Stripe et administration responsive ne sont PAS encore implémentées.
- Les statistiques 28 h 15 et 612 h 20 sont des exemples; météo pas encore intégrée.
- Dans une version future, les maps en binaire Android doivent être configurées avec Google Maps API.
- L'accès aux documents et commandes devra toujours vérifier company_id et job_id avec RLS.

## Démarrer pour évaluer l'interface
1. Cloner le dépôt privé PUNCH, installer Node.js 22+.
2. Exécuter npm install et npx expo install --fix pour aligner les dépendances avec le SDK.
3. Lancer npx expo start et ouvrir dans Expo Go sur Android/iPhone.
4. Ne configurer .env qu'avec les identifiants publics de **Supabase PUNCH** après avoir vérifié le project_id.

## Tests à réaliser
- Accueil → Job en cours → Toutes les jobs.
- Recherche/filtrage; accepter/refuser localisation GPS; ouvrir les épingles et la fiche.
- Sans punch actif, sélectionner une job; avec simulation active, transférer sur une autre et vérifier la continuité.
- Dans la fiche, archiver un segment avec ⋮ puis passer à Archives pour restaurer.
- Vérifier les petits écrans Android/iPhone, les barres système et le clavier.
- Valider le moteur serveur, les permissions et les enregistrements officiels AVANT de permettre un vrai punch en production.
